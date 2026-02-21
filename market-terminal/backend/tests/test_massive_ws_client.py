"""Tests for MassiveWsClient handling options Websocket streaming.

TASK-UPDATE-007
"""

import asyncio
import json
import logging
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import websockets
from websockets.exceptions import WebSocketException

from app.data.massive_ws_client import (
    MassiveWsClient,
    get_massive_ws_client,
    _WS_URL,
    _CB_COOLDOWN_S,
    _CB_MAX_ATTEMPTS
)
from app.config import Settings
from app.api.routes.websocket import WebSocketManager

def _patch_settings(monkeypatch, api_key="test-api-key", tier="developer"):
    # Clear singleton
    import app.data.massive_ws_client as mwc
    mwc._ws_client = None
    
    # Mock settings
    mock_settings = Settings()
    mock_settings.massive_api_key = api_key
    mock_settings.massive_options_tier = tier
    monkeypatch.setattr("app.data.massive_ws_client.get_settings", lambda: mock_settings)

def _patch_ws_manager(monkeypatch):
    mock_manager = MagicMock(spec=WebSocketManager)
    mock_manager.broadcast_to_subscribers = AsyncMock()
    monkeypatch.setattr("app.data.massive_ws_client.ws_manager", mock_manager)
    return mock_manager

def _patch_websockets_connect(monkeypatch):
    mock_ws = AsyncMock()
    mock_ws.state = websockets.protocol.State.OPEN
    mock_ws.send = AsyncMock()
    # Queue for recv
    mock_ws._recv_queue = asyncio.Queue()
    async def mock_recv():
         return await mock_ws._recv_queue.get()
    mock_ws.recv = mock_recv
    mock_ws.close = AsyncMock()
    mock_ws.ping = AsyncMock()
    
    mock_connect_context = AsyncMock()
    mock_connect_context.__aenter__.return_value = mock_ws
    
    mock_connect = MagicMock(return_value=mock_connect_context)
    monkeypatch.setattr("app.data.massive_ws_client.websockets.connect", mock_connect)
    return mock_connect, mock_ws


@pytest.mark.asyncio
async def test_initialization_gated_by_tier(monkeypatch):
    """Client disabled if tier is not developer or advanced."""
    _patch_settings(monkeypatch, tier="free")
    client = get_massive_ws_client()
    assert not client._enabled
    
    # Subscription returns False immediately
    res = await client.subscribe("O:AAPL240315C00170000")
    assert res is False


@pytest.mark.asyncio
async def test_initialization_gated_by_api_key(monkeypatch):
    """Client disabled if API key is blank."""
    _patch_settings(monkeypatch, api_key="")
    client = get_massive_ws_client()
    assert not client._enabled


@pytest.mark.asyncio
async def test_subscribe_valid_ticker_creates_connection(monkeypatch):
    """A valid ticker subscribes and begins the loop."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    
    client = get_massive_ws_client()
    assert client._enabled
    
    # First subscription triggers start()
    res = await client.subscribe("O:AAPL240315C00170000")
    assert res is True
    
    # Wait for background task to invoke connect
    await asyncio.sleep(0.05)
    mock_connect.assert_called_once_with(_WS_URL)
    
    # Check that initial auth msg was sent
    mock_ws.send.assert_any_call('{"action": "auth", "params": "test-api-key"}')
    
    # Cleanup
    await client.stop()


@pytest.mark.asyncio
async def test_subscribe_invalid_ticker_returns_false(monkeypatch):
    """Regex guards against invalid formats."""
    _patch_settings(monkeypatch)
    client = get_massive_ws_client()
    
    res = await client.subscribe("BADTICKER")
    assert res is False
    assert len(client._subscriptions) == 0


@pytest.mark.asyncio
async def test_auth_failure_permanently_disables(monkeypatch):
    """If the connection auth fails, it raises PermissionError and stops."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    
    # Mock an error auth response
    mock_ws._recv_queue.put_nowait(json.dumps({"status": "error", "message": "Unauthorized"}))
    
    client = get_massive_ws_client()
    assert client._enabled
    
    await client.subscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    # After receiving error, it should disable itself
    assert client._enabled is False


@pytest.mark.asyncio
async def test_auth_success_triggers_channel_sub(monkeypatch):
    """On auth success, loop publishes subscriptions."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    
    # Mock success auth response
    mock_ws._recv_queue.put_nowait(json.dumps({"status": "success", "message": "Authenticated"}))
    
    client = get_massive_ws_client()
    await client.subscribe("O:AAPL240315C00170000")
    
    await asyncio.sleep(0.05)
    
    # Check that channel subscribe was sent
    mock_ws.send.assert_called_with('{"action": "subscribe", "params": "OQ.O:AAPL240315C00170000,O.O:AAPL240315C00170000"}')
    
    await client.stop()


@pytest.mark.asyncio
async def test_options_quote_is_broadcast(monkeypatch):
    """OQ messages map into unified broadcast Manager with backpressure."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    mock_manager = _patch_ws_manager(monkeypatch)
    
    # Start loop
    mock_ws._recv_queue.put_nowait(json.dumps({"status": "success"}))
    
    client = get_massive_ws_client()
    await client.subscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    # Feed options quote
    msg = {
        "ev": "OQ",
        "sym": "O:AAPL240315C00170000",
        "bp": 1.50,
        "ap": 1.60,
        "mp": 1.55,
        "bs": 100,
        "as": 50,
        "t": 1708340400000
    }
    mock_ws._recv_queue.put_nowait(json.dumps([msg]))
    await asyncio.sleep(0.05)
    
    # Assert broadcast
    mock_manager.broadcast_to_subscribers.assert_called_once()
    args, _ = mock_manager.broadcast_to_subscribers.call_args
    assert args[0] == "options_quote:O:AAPL240315C00170000"
    assert args[1]["bid"] == 1.50
    assert args[1]["source"] == "massive_ws"

    await client.stop()


@pytest.mark.asyncio
async def test_options_trade_is_broadcast(monkeypatch):
    """O messages map into unified broadcast Manager for Trades."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    mock_manager = _patch_ws_manager(monkeypatch)
    
    mock_ws._recv_queue.put_nowait(json.dumps({"status": "success"}))
    
    client = get_massive_ws_client()
    await client.subscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    # Feed options trade
    msg = {
        "ev": "O",
        "sym": "O:AAPL240315C00170000",
        "p": 1.55,
        "s": 2,
        "x": "CBOE",
        "t": 1708340400000
    }
    mock_ws._recv_queue.put_nowait(json.dumps([msg]))
    await asyncio.sleep(0.05)
    
    mock_manager.broadcast_to_subscribers.assert_called_once()
    args, _ = mock_manager.broadcast_to_subscribers.call_args
    assert args[0] == "options_trade:O:AAPL240315C00170000"
    assert args[1]["price"] == 1.55
    assert args[1]["size"] == 2
    assert args[1]["exchange"] == "CBOE"
    
    await client.stop()


@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_10_attempts(monkeypatch):
    """After 10 reconnection loops, connection suspends processing."""
    _patch_settings(monkeypatch)
    
    # Mock connect to throw exception immediately
    client = get_massive_ws_client()
    
    # Trigger 10 connection attempts 
    client._reconnect_attempts = 10
    
    # Manually assert logic to prevent infinite async loops
    is_safe = await client._evaluate_circuit_breaker()
    
    # Circuit breaker should trip
    assert is_safe is False
    assert client.circuit_breaker_state == "OPEN"


@pytest.mark.asyncio
async def test_unsubscribe_cleans_up_connection(monkeypatch):
    """Empty subscriptions gracefully kill the stream."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    
    client = get_massive_ws_client()
    await client.subscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    # Stream is live
    assert client._receive_task is not None
    
    # Unsubscribe last node
    await client.unsubscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    # Task should be cancelled and connection cleared
    assert client._receive_task is None
    assert client._connection is None

@pytest.mark.asyncio
async def test_get_metrics(monkeypatch):
    """Returns valid latency maps and connection counts."""
    _patch_settings(monkeypatch)
    mock_connect, mock_ws = _patch_websockets_connect(monkeypatch)
    
    client = get_massive_ws_client()
    await client.subscribe("O:AAPL240315C00170000")
    await asyncio.sleep(0.05)
    
    metrics = await client.get_metrics()
    assert metrics["circuit_breaker_state"] == "CLOSED"
    assert metrics["enabled"] is True
    assert metrics["subscriptions_count"] == 1
    
    await client.stop()
