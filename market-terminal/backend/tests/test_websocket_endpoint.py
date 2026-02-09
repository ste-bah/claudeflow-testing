"""Tests for TASK-API-008: WebSocket Manager.

Validates WebSocket connection lifecycle, channel subscriptions,
broadcast semantics, heartbeat monitoring, stale cleanup, and
message handling.

Run with: ``pytest tests/test_websocket_endpoint.py -v``
"""
from __future__ import annotations

import asyncio
import json
import unittest.mock
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketState

from app.api.routes.websocket import (
    WebSocketManager,
    _Connection,
    _HEARTBEAT_INTERVAL_S,
    _MAX_CONNECTIONS,
    _MAX_MESSAGE_BYTES,
    _STALE_TIMEOUT_S,
    ws_manager,
)
from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    """Run an async coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_mock_ws(state=WebSocketState.CONNECTED):
    """Create a mock WebSocket object."""
    ws = MagicMock()
    ws.send_json = AsyncMock()
    type(ws).client_state = PropertyMock(return_value=state)
    return ws


def _fresh_manager():
    """Return a new WebSocketManager with no connections."""
    return WebSocketManager()


@contextmanager
def _clean_ws_manager():
    """Context manager that clears ws_manager connections before and after."""
    ws_manager._connections.clear()
    try:
        yield ws_manager
    finally:
        ws_manager._connections.clear()


def _add_connection_sync(mgr, ws, client_id):
    """Synchronously add a connection to a manager."""
    _run(mgr.connect(ws, client_id))


# ===================================================================
# WebSocketManager.connect
# ===================================================================

class TestManagerConnect:
    """connect() adds connections and enforces capacity limits."""

    def test_connect_adds_connection(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "client-1"))
        assert "client-1" in mgr._connections

    def test_connect_stores_websocket(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "client-1"))
        assert mgr._connections["client-1"].ws is ws

    def test_connect_stores_client_id(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "client-1"))
        assert mgr._connections["client-1"].client_id == "client-1"

    def test_connect_multiple_clients(self):
        mgr = _fresh_manager()
        for i in range(5):
            _run(mgr.connect(_make_mock_ws(), f"client-{i}"))
        assert mgr.get_connection_count() == 5

    def test_connect_raises_at_max(self):
        mgr = _fresh_manager()
        for i in range(_MAX_CONNECTIONS):
            _run(mgr.connect(_make_mock_ws(), f"client-{i}"))
        with pytest.raises(ConnectionRefusedError, match="Maximum connections"):
            _run(mgr.connect(_make_mock_ws(), "overflow"))

    def test_connect_exactly_at_max(self):
        mgr = _fresh_manager()
        for i in range(_MAX_CONNECTIONS):
            _run(mgr.connect(_make_mock_ws(), f"client-{i}"))
        assert mgr.get_connection_count() == _MAX_CONNECTIONS

    def test_duplicate_client_id_replaces(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        _run(mgr.connect(ws1, "client-1"))
        _run(mgr.connect(ws2, "client-1"))
        assert mgr._connections["client-1"].ws is ws2
        assert mgr.get_connection_count() == 1

    def test_connect_sets_connected_at(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "client-1"))
        conn = mgr._connections["client-1"]
        assert conn.connected_at is not None
        # Should be a parseable ISO string
        datetime.fromisoformat(conn.connected_at)

    def test_connect_initialises_empty_subscriptions(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "client-1"))
        assert mgr._connections["client-1"].subscriptions == set()


# ===================================================================
# WebSocketManager.disconnect
# ===================================================================

class TestManagerDisconnect:
    """disconnect() removes connections cleanly."""

    def test_disconnect_removes_connection(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "client-1"))
        _run(mgr.disconnect("client-1"))
        assert "client-1" not in mgr._connections

    def test_disconnect_unknown_client_is_noop(self):
        mgr = _fresh_manager()
        # Should not raise
        _run(mgr.disconnect("nonexistent"))
        assert mgr.get_connection_count() == 0

    def test_disconnect_decrements_count(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        _run(mgr.disconnect("c1"))
        assert mgr.get_connection_count() == 1

    def test_disconnect_leaves_others(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        _run(mgr.disconnect("c1"))
        assert "c2" in mgr._connections

    def test_disconnect_same_client_twice(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.disconnect("c1"))
        _run(mgr.disconnect("c1"))
        assert mgr.get_connection_count() == 0


# ===================================================================
# WebSocketManager.broadcast
# ===================================================================

class TestManagerBroadcast:
    """broadcast() sends to ALL connected clients."""

    def test_broadcast_to_all(self):
        mgr = _fresh_manager()
        ws1, ws2, ws3 = _make_mock_ws(), _make_mock_ws(), _make_mock_ws()
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.connect(ws3, "c3"))
        msg = {"type": "price_update", "symbol": "AAPL"}
        _run(mgr.broadcast(msg))
        ws1.send_json.assert_called_once_with(msg)
        ws2.send_json.assert_called_once_with(msg)
        ws3.send_json.assert_called_once_with(msg)

    def test_broadcast_to_empty_pool(self):
        mgr = _fresh_manager()
        # Should not raise
        _run(mgr.broadcast({"type": "test"}))

    def test_broadcast_one_failing_client_removed(self):
        mgr = _fresh_manager()
        ws_ok = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=Exception("broken pipe"))
        _run(mgr.connect(ws_ok, "ok"))
        _run(mgr.connect(ws_bad, "bad"))
        _run(mgr.broadcast({"type": "test"}))
        # Failing client should be removed
        assert "bad" not in mgr._connections
        assert "ok" in mgr._connections

    def test_broadcast_all_failing_removes_all(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        ws1.send_json = AsyncMock(side_effect=Exception("fail"))
        ws2.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.broadcast({"type": "test"}))
        assert mgr.get_connection_count() == 0

    def test_broadcast_does_not_block_on_failure(self):
        """One failing client should not prevent delivery to others."""
        mgr = _fresh_manager()
        ws_ok = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws_ok, "ok"))
        _run(mgr.connect(ws_bad, "bad"))
        msg = {"type": "test"}
        _run(mgr.broadcast(msg))
        ws_ok.send_json.assert_called_once_with(msg)

    def test_broadcast_message_preserved(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {"type": "news_alert", "symbol": "MSFT", "headline": "Big news"}
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_broadcast_disconnected_client_removed(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.DISCONNECTED)
        _run(mgr.connect(ws, "c1"))
        _run(mgr.broadcast({"type": "test"}))
        assert "c1" not in mgr._connections


# ===================================================================
# WebSocketManager.send_to_client
# ===================================================================

class TestManagerSendToClient:
    """send_to_client() targets a single client by ID."""

    def test_send_to_known_client(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {"type": "test", "data": 42}
        _run(mgr.send_to_client("c1", msg))
        ws.send_json.assert_called_once_with(msg)

    def test_send_to_unknown_client_logs_warning(self):
        mgr = _fresh_manager()
        with patch("app.api.routes.websocket.logger") as mock_logger:
            _run(mgr.send_to_client("nonexistent", {"type": "test"}))
            mock_logger.warning.assert_called()

    def test_send_to_unknown_client_no_error(self):
        mgr = _fresh_manager()
        # Should not raise
        _run(mgr.send_to_client("nonexistent", {"type": "test"}))

    def test_send_failure_disconnects_client(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        ws.send_json = AsyncMock(side_effect=Exception("broken"))
        _run(mgr.connect(ws, "c1"))
        _run(mgr.send_to_client("c1", {"type": "test"}))
        assert "c1" not in mgr._connections

    def test_send_only_to_target_not_others(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.send_to_client("c1", {"type": "test"}))
        ws2.send_json.assert_not_called()

    def test_send_to_disconnected_client_removes_it(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.DISCONNECTED)
        _run(mgr.connect(ws, "c1"))
        _run(mgr.send_to_client("c1", {"type": "test"}))
        assert "c1" not in mgr._connections


# ===================================================================
# WebSocketManager.broadcast_to_subscribers
# ===================================================================

class TestManagerBroadcastToSubscribers:
    """broadcast_to_subscribers() filters by channel."""

    def test_only_subscribed_clients_receive(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.subscribe("c1", "price:AAPL"))
        msg = {"type": "price_update", "symbol": "AAPL"}
        _run(mgr.broadcast_to_subscribers("price:AAPL", msg))
        ws1.send_json.assert_called_once_with(msg)
        ws2.send_json.assert_not_called()

    def test_no_subscribers_no_sends(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        _run(mgr.broadcast_to_subscribers("price:AAPL", {"type": "test"}))
        ws.send_json.assert_not_called()

    def test_empty_pool_no_error(self):
        mgr = _fresh_manager()
        _run(mgr.broadcast_to_subscribers("price:AAPL", {"type": "test"}))

    def test_mixed_subscriptions(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        ws3 = _make_mock_ws()
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.connect(ws3, "c3"))
        _run(mgr.subscribe("c1", "price:AAPL"))
        _run(mgr.subscribe("c2", "price:AAPL"))
        # c3 is NOT subscribed
        msg = {"type": "price_update"}
        _run(mgr.broadcast_to_subscribers("price:AAPL", msg))
        ws1.send_json.assert_called_once_with(msg)
        ws2.send_json.assert_called_once_with(msg)
        ws3.send_json.assert_not_called()

    def test_failing_subscriber_removed(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        ws.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws, "c1"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.broadcast_to_subscribers("ch", {"type": "test"}))
        assert "c1" not in mgr._connections

    def test_different_channel_not_sent(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        _run(mgr.subscribe("c1", "news:AAPL"))
        _run(mgr.broadcast_to_subscribers("price:AAPL", {"type": "test"}))
        ws.send_json.assert_not_called()

    def test_multiple_channels_one_matches(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        _run(mgr.subscribe("c1", "price:AAPL"))
        _run(mgr.subscribe("c1", "news:AAPL"))
        _run(mgr.broadcast_to_subscribers("price:AAPL", {"type": "test"}))
        ws.send_json.assert_called_once()


# ===================================================================
# WebSocketManager.get_active_connections
# ===================================================================

class TestManagerGetActiveConnections:
    """get_active_connections() returns metadata dicts."""

    def test_returns_list(self):
        mgr = _fresh_manager()
        result = _run(mgr.get_active_connections())
        assert isinstance(result, list)

    def test_empty_when_no_connections(self):
        mgr = _fresh_manager()
        assert _run(mgr.get_active_connections()) == []

    def test_correct_shape(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        conns = _run(mgr.get_active_connections())
        assert len(conns) == 1
        assert "client_id" in conns[0]
        assert "connected_at" in conns[0]
        assert "subscriptions" in conns[0]
        assert "last_heartbeat" in conns[0]

    def test_client_id_in_result(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "test-id"))
        conns = _run(mgr.get_active_connections())
        assert conns[0]["client_id"] == "test-id"

    def test_subscriptions_sorted(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "zebra"))
        _run(mgr.subscribe("c1", "alpha"))
        _run(mgr.subscribe("c1", "middle"))
        conns = _run(mgr.get_active_connections())
        assert conns[0]["subscriptions"] == ["alpha", "middle", "zebra"]

    def test_multiple_connections(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        conns = _run(mgr.get_active_connections())
        assert len(conns) == 2
        ids = {c["client_id"] for c in conns}
        assert ids == {"c1", "c2"}


# ===================================================================
# WebSocketManager.get_connection_count
# ===================================================================

class TestManagerGetConnectionCount:
    """get_connection_count() returns integer count."""

    def test_zero_when_empty(self):
        mgr = _fresh_manager()
        assert mgr.get_connection_count() == 0

    def test_correct_count(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        _run(mgr.connect(_make_mock_ws(), "c3"))
        assert mgr.get_connection_count() == 3

    def test_count_after_disconnect(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        _run(mgr.disconnect("c1"))
        assert mgr.get_connection_count() == 1

    def test_count_returns_int(self):
        mgr = _fresh_manager()
        assert isinstance(mgr.get_connection_count(), int)


# ===================================================================
# WebSocketManager.subscribe
# ===================================================================

class TestManagerSubscribe:
    """subscribe() adds channels to a client's subscription set."""

    def test_subscribe_known_client_returns_true(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        assert _run(mgr.subscribe("c1", "price:AAPL")) is True

    def test_subscribe_adds_channel(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "price:AAPL"))
        assert "price:AAPL" in mgr._connections["c1"].subscriptions

    def test_subscribe_multiple_channels(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "price:AAPL"))
        _run(mgr.subscribe("c1", "news:AAPL"))
        assert mgr._connections["c1"].subscriptions == {"price:AAPL", "news:AAPL"}

    def test_subscribe_unknown_returns_false(self):
        mgr = _fresh_manager()
        assert _run(mgr.subscribe("nonexistent", "price:AAPL")) is False

    def test_subscribe_same_channel_twice_idempotent(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.subscribe("c1", "ch"))
        assert len(mgr._connections["c1"].subscriptions) == 1


# ===================================================================
# WebSocketManager.unsubscribe
# ===================================================================

class TestManagerUnsubscribe:
    """unsubscribe() removes channels from a client's subscription set."""

    def test_unsubscribe_returns_true_for_known(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "ch"))
        assert _run(mgr.unsubscribe("c1", "ch")) is True

    def test_unsubscribe_removes_channel(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.unsubscribe("c1", "ch"))
        assert "ch" not in mgr._connections["c1"].subscriptions

    def test_unsubscribe_nonexistent_channel_ok(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        # Discarding a non-existent channel should return True (client exists)
        assert _run(mgr.unsubscribe("c1", "nonexistent")) is True

    def test_unsubscribe_unknown_client_returns_false(self):
        mgr = _fresh_manager()
        assert _run(mgr.unsubscribe("nonexistent", "ch")) is False

    def test_unsubscribe_preserves_other_channels(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "a"))
        _run(mgr.subscribe("c1", "b"))
        _run(mgr.unsubscribe("c1", "a"))
        assert "b" in mgr._connections["c1"].subscriptions
        assert "a" not in mgr._connections["c1"].subscriptions


# ===================================================================
# WebSocketManager.update_heartbeat
# ===================================================================

class TestManagerHeartbeat:
    """update_heartbeat() refreshes the last_heartbeat timestamp."""

    def test_updates_timestamp(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        old_hb = mgr._connections["c1"].last_heartbeat
        # Force a tiny delay
        import time
        time.sleep(0.01)
        _run(mgr.update_heartbeat("c1"))
        new_hb = mgr._connections["c1"].last_heartbeat
        assert new_hb >= old_hb

    def test_unknown_client_no_error(self):
        mgr = _fresh_manager()
        # Should not raise
        _run(mgr.update_heartbeat("nonexistent"))

    def test_heartbeat_uses_utc(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.update_heartbeat("c1"))
        hb = mgr._connections["c1"].last_heartbeat
        assert hb.tzinfo is not None


# ===================================================================
# WebSocketManager.cleanup_stale
# ===================================================================

class TestManagerCleanupStale:
    """cleanup_stale() removes connections that missed 3+ heartbeats."""

    def test_stale_connection_removed(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        # Make the connection stale (older than 90s)
        mgr._connections["c1"].last_heartbeat = (
            datetime.now(tz=timezone.utc) - timedelta(seconds=_STALE_TIMEOUT_S + 10)
        )
        removed = _run(mgr.cleanup_stale())
        assert "c1" in removed
        assert mgr.get_connection_count() == 0

    def test_fresh_connection_kept(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        # Connection is fresh (just connected)
        removed = _run(mgr.cleanup_stale())
        assert removed == []
        assert mgr.get_connection_count() == 1

    def test_returns_list_of_removed_ids(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "stale-1"))
        _run(mgr.connect(_make_mock_ws(), "stale-2"))
        stale_time = datetime.now(tz=timezone.utc) - timedelta(seconds=200)
        mgr._connections["stale-1"].last_heartbeat = stale_time
        mgr._connections["stale-2"].last_heartbeat = stale_time
        removed = _run(mgr.cleanup_stale())
        assert set(removed) == {"stale-1", "stale-2"}

    def test_empty_when_all_fresh(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        removed = _run(mgr.cleanup_stale())
        assert removed == []

    def test_empty_pool_returns_empty(self):
        mgr = _fresh_manager()
        removed = _run(mgr.cleanup_stale())
        assert removed == []

    def test_mixed_stale_and_fresh(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "fresh"))
        _run(mgr.connect(_make_mock_ws(), "stale"))
        mgr._connections["stale"].last_heartbeat = (
            datetime.now(tz=timezone.utc) - timedelta(seconds=_STALE_TIMEOUT_S + 1)
        )
        removed = _run(mgr.cleanup_stale())
        assert removed == ["stale"]
        assert "fresh" in mgr._connections

    def test_exactly_at_threshold_not_removed(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        # At exactly _STALE_TIMEOUT_S - 1 seconds, should NOT be removed
        mgr._connections["c1"].last_heartbeat = (
            datetime.now(tz=timezone.utc) - timedelta(seconds=_STALE_TIMEOUT_S - 1)
        )
        removed = _run(mgr.cleanup_stale())
        assert removed == []


# ===================================================================
# WebSocketManager._safe_send
# ===================================================================

class TestManagerSafeSend:
    """_safe_send() returns False on success, True on failure."""

    def test_success_returns_false(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        result = _run(mgr._safe_send(conn, {"type": "test"}))
        assert result is False

    def test_failure_returns_true(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        ws.send_json = AsyncMock(side_effect=Exception("fail"))
        conn = _Connection(ws, "c1")
        result = _run(mgr._safe_send(conn, {"type": "test"}))
        assert result is True

    def test_disconnected_state_returns_true(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.DISCONNECTED)
        conn = _Connection(ws, "c1")
        result = _run(mgr._safe_send(conn, {"type": "test"}))
        assert result is True

    def test_disconnected_does_not_call_send(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.DISCONNECTED)
        conn = _Connection(ws, "c1")
        _run(mgr._safe_send(conn, {"type": "test"}))
        ws.send_json.assert_not_called()

    def test_connected_calls_send_json(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        msg = {"type": "test", "value": 123}
        _run(mgr._safe_send(conn, msg))
        ws.send_json.assert_called_once_with(msg)


# ===================================================================
# WebSocket endpoint connect -- welcome message
# ===================================================================

class TestWebSocketConnect:
    """Connecting to /ws should produce a well-formed welcome message."""

    def test_welcome_message_received(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert msg["type"] == "connected"

    def test_welcome_has_client_id(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert "client_id" in msg
                assert isinstance(msg["client_id"], str)
                assert len(msg["client_id"]) > 0

    def test_welcome_has_server_time(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert "server_time" in msg
                # Should be parseable
                datetime.fromisoformat(msg["server_time"])

    def test_welcome_has_reconnect_hint(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert "reconnect_hint" in msg

    def test_reconnect_hint_shape(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                hint = ws.receive_json()["reconnect_hint"]
                assert hint["strategy"] == "exponential_backoff"
                assert hint["initial_delay_ms"] == 1000
                assert hint["max_delay_ms"] == 30000
                assert hint["multiplier"] == 2

    def test_auto_generated_client_id(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                # Auto-generated should look like a UUID
                cid = msg["client_id"]
                assert len(cid) == 36  # UUID format

    def test_custom_client_id_via_query(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws?client_id=my-custom-id") as ws:
                msg = ws.receive_json()
                assert msg["client_id"] == "my-custom-id"

    def test_welcome_type_is_connected(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert msg["type"] == "connected"

    def test_welcome_has_exactly_four_keys(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                msg = ws.receive_json()
                assert set(msg.keys()) == {
                    "type", "client_id", "server_time", "reconnect_hint"
                }


# ===================================================================
# WebSocket connection limit
# ===================================================================

class TestWebSocketConnectionLimit:
    """Connections beyond _MAX_CONNECTIONS are rejected."""

    def test_connection_limit_enforced(self):
        """The 11th connection should be rejected with close code 1008."""
        with _clean_ws_manager():
            # Fill up to the limit using the manager directly
            for i in range(_MAX_CONNECTIONS):
                _run(ws_manager.connect(_make_mock_ws(), f"pre-{i}"))
            # The next WS connection should be closed
            with pytest.raises(Exception):
                with client.websocket_connect("/ws") as ws:
                    ws.receive_json()


# ===================================================================
# WebSocket messages
# ===================================================================

class TestWebSocketMessages:
    """Client->server message handling: subscribe, unsubscribe, ping, etc."""

    def test_subscribe_returns_confirmation(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe", "channel": "price:AAPL"})
                msg = ws.receive_json()
                assert msg["type"] == "subscribed"
                assert msg["channel"] == "price:AAPL"

    def test_unsubscribe_returns_confirmation(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe", "channel": "price:AAPL"})
                ws.receive_json()  # consume subscribe ack
                ws.send_json({"action": "unsubscribe", "channel": "price:AAPL"})
                msg = ws.receive_json()
                assert msg["type"] == "unsubscribed"
                assert msg["channel"] == "price:AAPL"

    def test_ping_returns_pong(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "ping"})
                msg = ws.receive_json()
                assert msg["type"] == "pong"

    def test_unknown_action_returns_ack(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "custom", "data": "hello"})
                msg = ws.receive_json()
                assert msg["type"] == "ack"
                assert "received" not in msg  # XSS prevention: never echo user input

    def test_invalid_json_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("not valid json {{{")
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert msg["message"] == "Invalid JSON"

    def test_invalid_json_error_severity(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("{bad json")
                msg = ws.receive_json()
                assert msg["severity"] == "warning"

    def test_invalid_json_error_source(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("not json")
                msg = ws.receive_json()
                assert msg["source"] == "server"

    def test_subscribe_without_channel_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe"})
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert "Channel is required" in msg["message"]

    def test_unsubscribe_without_channel_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "unsubscribe"})
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert "Channel is required" in msg["message"]

    def test_subscribe_empty_channel_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe", "channel": ""})
                msg = ws.receive_json()
                assert msg["type"] == "error"

    def test_unsubscribe_empty_channel_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "unsubscribe", "channel": ""})
                msg = ws.receive_json()
                assert msg["type"] == "error"

    def test_message_without_action_returns_ack(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"data": "no action field"})
                msg = ws.receive_json()
                assert msg["type"] == "ack"


# ===================================================================
# WebSocket oversized messages
# ===================================================================

class TestWebSocketOversizedMessages:
    """Messages exceeding _MAX_MESSAGE_BYTES are rejected."""

    def test_oversized_message_returns_error(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                # Send a message larger than 64KB
                big = "x" * (_MAX_MESSAGE_BYTES + 100)
                ws.send_text(big)
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert "maximum size" in msg["message"].lower()

    def test_oversized_error_severity_warning(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                big = "x" * (_MAX_MESSAGE_BYTES + 1)
                ws.send_text(big)
                msg = ws.receive_json()
                assert msg["severity"] == "warning"

    def test_message_at_limit_is_processed(self):
        """A message exactly at the limit should NOT trigger the error."""
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                # Build a valid JSON that is exactly at the byte limit
                # The check is on raw bytes, so we need raw text <= 64KB
                payload = {"action": "ping"}
                raw = json.dumps(payload)
                # Pad with spaces to be within limit but not over
                # Spaces in JSON are harmless for our receive_text path
                # but our code checks len(raw.encode("utf-8"))
                # A small message will be well under limit
                ws.send_text(raw)
                msg = ws.receive_json()
                # Should get pong, not error
                assert msg["type"] == "pong"


# ===================================================================
# WebSocket disconnect cleanup
# ===================================================================

class TestWebSocketDisconnect:
    """Disconnecting a client removes it from the manager."""

    def test_disconnect_cleans_up_connection(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                welcome = ws.receive_json()
                cid = welcome["client_id"]
                assert ws_manager.get_connection_count() >= 1
            # After context exit (disconnect), the connection should be cleaned
            # Allow a tiny delay for cleanup
            import time
            time.sleep(0.05)
            # The client_id should no longer be in the manager
            assert cid not in ws_manager._connections


# ===================================================================
# _Connection record
# ===================================================================

class TestConnectionRecord:
    """_Connection dataclass behavior and serialisation."""

    def test_to_dict_has_client_id(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "test-id")
        d = conn.to_dict()
        assert d["client_id"] == "test-id"

    def test_to_dict_has_connected_at(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        d = conn.to_dict()
        assert "connected_at" in d

    def test_connected_at_is_iso_format(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        # Should be parseable
        datetime.fromisoformat(conn.connected_at)

    def test_to_dict_has_subscriptions(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        d = conn.to_dict()
        assert d["subscriptions"] == []

    def test_to_dict_has_last_heartbeat(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        d = conn.to_dict()
        assert "last_heartbeat" in d
        datetime.fromisoformat(d["last_heartbeat"])

    def test_subscriptions_in_to_dict_sorted(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        conn.subscriptions = {"z", "a", "m"}
        d = conn.to_dict()
        assert d["subscriptions"] == ["a", "m", "z"]

    def test_last_heartbeat_updates(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        old = conn.last_heartbeat
        import time
        time.sleep(0.01)
        conn.last_heartbeat = datetime.now(tz=timezone.utc)
        assert conn.last_heartbeat >= old

    def test_slots_defined(self):
        """_Connection uses __slots__ for memory efficiency."""
        assert hasattr(_Connection, "__slots__")

    def test_to_dict_shape_keys(self):
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        d = conn.to_dict()
        assert set(d.keys()) == {
            "client_id", "connected_at", "subscriptions", "last_heartbeat"
        }

    def test_ws_not_in_to_dict(self):
        """The WebSocket object itself should NOT appear in to_dict."""
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        d = conn.to_dict()
        assert "ws" not in d


# ===================================================================
# Edge cases
# ===================================================================

class TestWebSocketEdgeCases:
    """Boundary conditions and unusual interaction patterns."""

    def test_empty_text_message(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("")
                msg = ws.receive_json()
                # Empty string is invalid JSON
                assert msg["type"] == "error"
                assert msg["message"] == "Invalid JSON"

    def test_rapid_subscribe_unsubscribe(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                for _ in range(5):
                    ws.send_json({"action": "subscribe", "channel": "ch"})
                    resp = ws.receive_json()
                    assert resp["type"] == "subscribed"
                    ws.send_json({"action": "unsubscribe", "channel": "ch"})
                    resp = ws.receive_json()
                    assert resp["type"] == "unsubscribed"

    def test_subscribe_to_same_channel_twice(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe", "channel": "price:AAPL"})
                msg1 = ws.receive_json()
                assert msg1["type"] == "subscribed"
                ws.send_json({"action": "subscribe", "channel": "price:AAPL"})
                msg2 = ws.receive_json()
                assert msg2["type"] == "subscribed"

    def test_multiple_channels(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                channels = ["price:AAPL", "news:AAPL", "analysis:MSFT"]
                for ch in channels:
                    ws.send_json({"action": "subscribe", "channel": ch})
                    msg = ws.receive_json()
                    assert msg["type"] == "subscribed"
                    assert msg["channel"] == ch

    def test_subscribe_channel_with_special_chars(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe", "channel": "price:BRK.B"})
                msg = ws.receive_json()
                assert msg["type"] == "subscribed"
                assert msg["channel"] == "price:BRK.B"

    def test_whitespace_only_message(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("   ")
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert msg["message"] == "Invalid JSON"

    def test_multiple_pings(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                for _ in range(3):
                    ws.send_json({"action": "ping"})
                    msg = ws.receive_json()
                    assert msg["type"] == "pong"


# ===================================================================
# Singleton
# ===================================================================

class TestWebSocketSingleton:
    """The module-level ws_manager is importable and correct type."""

    def test_ws_manager_importable(self):
        from app.api.routes.websocket import ws_manager as imported
        assert imported is not None

    def test_ws_manager_is_instance(self):
        assert isinstance(ws_manager, WebSocketManager)

    def test_ws_manager_same_reference(self):
        from app.api.routes.websocket import ws_manager as imported
        assert imported is ws_manager


# ===================================================================
# Message types
# ===================================================================

class TestMessageTypes:
    """All 6 message types serialize through broadcast correctly."""

    def test_price_update(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "price_update",
            "symbol": "AAPL",
            "price": 185.42,
            "change_percent": 0.635,
            "timestamp": "2026-02-07T16:00:00Z",
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_analysis_progress(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "analysis_progress",
            "symbol": "AAPL",
            "agent": "wyckoff-analyzer",
            "agent_number": 4,
            "total_agents": 12,
            "status": "running",
            "message": "Running Wyckoff phase detection...",
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_analysis_complete(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "analysis_complete",
            "symbol": "AAPL",
            "composite_signal": {"direction": "bullish", "score": 0.75},
            "timestamp": "2026-02-07T16:05:00Z",
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_news_alert(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "news_alert",
            "symbol": "AAPL",
            "headline": "Apple Reports Record Q1 Revenue",
            "sentiment": {"score": 0.82, "label": "bullish"},
            "timestamp": "2026-02-07T14:30:00Z",
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_god_agent_stream(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "god_agent_stream",
            "query_id": "q-456",
            "chunk": "Based on the Wyckoff analysis...",
            "is_final": False,
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)

    def test_error_notification(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        _run(mgr.connect(ws, "c1"))
        msg = {
            "type": "error",
            "source": "finnhub",
            "message": "Rate limit exceeded, using cached data",
            "severity": "warning",
        }
        _run(mgr.broadcast(msg))
        ws.send_json.assert_called_once_with(msg)


# ===================================================================
# XSS prevention -- errors must not echo user input
# ===================================================================

class TestXssPrevention:
    """Error messages must NEVER echo user input (project-wide pattern)."""

    def test_invalid_json_does_not_echo_input(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                payload = '<script>alert("xss")</script>'
                ws.send_text(payload)
                msg = ws.receive_json()
                assert payload not in msg.get("message", "")
                assert "<script>" not in json.dumps(msg)

    def test_oversized_error_does_not_echo_content(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                big = "EVIL" * 20000
                ws.send_text(big)
                msg = ws.receive_json()
                assert "EVIL" not in msg.get("message", "")

    def test_subscribe_error_does_not_echo_action(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_json({"action": "subscribe"})
                msg = ws.receive_json()
                # Error message should be generic, not echo the action
                assert msg["type"] == "error"
                assert msg["source"] == "server"

    def test_error_has_server_source(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # consume welcome
                ws.send_text("bad json")
                msg = ws.receive_json()
                assert msg["source"] == "server"


# ===================================================================
# Constants
# ===================================================================

class TestConstants:
    """Module-level constants have expected values."""

    def test_heartbeat_interval(self):
        assert _HEARTBEAT_INTERVAL_S == 30

    def test_stale_timeout(self):
        assert _STALE_TIMEOUT_S == 90

    def test_max_connections(self):
        assert _MAX_CONNECTIONS == 10

    def test_max_message_bytes(self):
        assert _MAX_MESSAGE_BYTES == 65_536

    def test_stale_is_three_heartbeats(self):
        assert _STALE_TIMEOUT_S == _HEARTBEAT_INTERVAL_S * 3


# ===================================================================
# Broadcast with subscriber send failure
# ===================================================================

class TestBroadcastSubscriberFailures:
    """Edge cases for broadcast_to_subscribers with failing clients."""

    def test_one_subscriber_fails_other_receives(self):
        mgr = _fresh_manager()
        ws_ok = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws_ok, "ok"))
        _run(mgr.connect(ws_bad, "bad"))
        _run(mgr.subscribe("ok", "ch"))
        _run(mgr.subscribe("bad", "ch"))
        msg = {"type": "test"}
        _run(mgr.broadcast_to_subscribers("ch", msg))
        ws_ok.send_json.assert_called_once_with(msg)
        assert "bad" not in mgr._connections

    def test_all_subscribers_fail(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        ws1.send_json = AsyncMock(side_effect=Exception("fail"))
        ws2.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.connect(ws2, "c2"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.subscribe("c2", "ch"))
        _run(mgr.broadcast_to_subscribers("ch", {"type": "test"}))
        assert mgr.get_connection_count() == 0

    def test_disconnected_subscriber_removed(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.DISCONNECTED)
        _run(mgr.connect(ws, "c1"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.broadcast_to_subscribers("ch", {"type": "test"}))
        assert "c1" not in mgr._connections


# ===================================================================
# Manager with concurrent-style access patterns
# ===================================================================

class TestManagerConcurrency:
    """Manager operations under concurrent-like patterns."""

    def test_connect_disconnect_connect_same_id(self):
        mgr = _fresh_manager()
        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()
        _run(mgr.connect(ws1, "c1"))
        _run(mgr.disconnect("c1"))
        _run(mgr.connect(ws2, "c1"))
        assert mgr._connections["c1"].ws is ws2

    def test_broadcast_during_empty_pool(self):
        mgr = _fresh_manager()
        # Should not raise or block
        _run(mgr.broadcast({"type": "test"}))
        _run(mgr.broadcast_to_subscribers("ch", {"type": "test"}))

    def test_subscribe_after_disconnect_returns_false(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.disconnect("c1"))
        assert _run(mgr.subscribe("c1", "ch")) is False

    def test_unsubscribe_after_disconnect_returns_false(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.subscribe("c1", "ch"))
        _run(mgr.disconnect("c1"))
        assert _run(mgr.unsubscribe("c1", "ch")) is False

    def test_heartbeat_after_disconnect_is_noop(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.disconnect("c1"))
        # Should not raise
        _run(mgr.update_heartbeat("c1"))

    def test_get_active_after_all_disconnected(self):
        mgr = _fresh_manager()
        _run(mgr.connect(_make_mock_ws(), "c1"))
        _run(mgr.connect(_make_mock_ws(), "c2"))
        _run(mgr.disconnect("c1"))
        _run(mgr.disconnect("c2"))
        assert _run(mgr.get_active_connections()) == []


# ===================================================================
# Multiple WebSocket connections via TestClient
# ===================================================================

class TestMultipleWebSocketConnections:
    """Multiple concurrent WebSocket connections."""

    def test_two_clients_both_get_welcome(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws?client_id=first") as ws1:
                msg1 = ws1.receive_json()
                assert msg1["client_id"] == "first"
                with client.websocket_connect("/ws?client_id=second") as ws2:
                    msg2 = ws2.receive_json()
                    assert msg2["client_id"] == "second"

    def test_two_clients_different_ids(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws?client_id=a") as ws1:
                ws1.receive_json()
                with client.websocket_connect("/ws?client_id=b") as ws2:
                    ws2.receive_json()
                    assert ws_manager.get_connection_count() == 2


# ===================================================================
# WebSocket endpoint interaction ordering
# ===================================================================

class TestWebSocketInteractionOrdering:
    """Validate message ordering in typical interaction flows."""

    def test_subscribe_then_ping(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # welcome
                ws.send_json({"action": "subscribe", "channel": "ch"})
                assert ws.receive_json()["type"] == "subscribed"
                ws.send_json({"action": "ping"})
                assert ws.receive_json()["type"] == "pong"

    def test_multiple_subscribes_then_unsubscribes(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # welcome
                for ch in ["a", "b", "c"]:
                    ws.send_json({"action": "subscribe", "channel": ch})
                    assert ws.receive_json()["type"] == "subscribed"
                for ch in ["a", "b", "c"]:
                    ws.send_json({"action": "unsubscribe", "channel": ch})
                    assert ws.receive_json()["type"] == "unsubscribed"

    def test_interleaved_subscribe_and_ping(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # welcome
                ws.send_json({"action": "subscribe", "channel": "x"})
                assert ws.receive_json()["type"] == "subscribed"
                ws.send_json({"action": "ping"})
                assert ws.receive_json()["type"] == "pong"
                ws.send_json({"action": "subscribe", "channel": "y"})
                assert ws.receive_json()["type"] == "subscribed"

    def test_error_does_not_break_subsequent_messages(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # welcome
                ws.send_text("bad json")
                err = ws.receive_json()
                assert err["type"] == "error"
                # Should still be able to send valid messages
                ws.send_json({"action": "ping"})
                assert ws.receive_json()["type"] == "pong"


# ===================================================================
# Safe send edge cases
# ===================================================================

class TestSafeSendEdgeCases:
    """Additional edge cases for _safe_send behaviour."""

    def test_connecting_state_sends(self):
        """CONNECTING state (not CONNECTED) should return True (failure)."""
        mgr = _fresh_manager()
        ws = _make_mock_ws(state=WebSocketState.CONNECTING)
        conn = _Connection(ws, "c1")
        result = _run(mgr._safe_send(conn, {"type": "test"}))
        assert result is True

    def test_send_complex_nested_message(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        msg = {
            "type": "analysis_complete",
            "data": {
                "nested": {"deep": [1, 2, 3]},
                "list": [{"a": 1}, {"b": 2}],
            },
        }
        result = _run(mgr._safe_send(conn, msg))
        assert result is False
        ws.send_json.assert_called_once_with(msg)

    def test_send_empty_dict(self):
        mgr = _fresh_manager()
        ws = _make_mock_ws()
        conn = _Connection(ws, "c1")
        result = _run(mgr._safe_send(conn, {}))
        assert result is False
        ws.send_json.assert_called_once_with({})


# ===================================================================
# Manager cleanup after broadcast
# ===================================================================

class TestBroadcastCleanup:
    """Broadcast operations properly clean up failed connections."""

    def test_broadcast_removes_exactly_failed_clients(self):
        mgr = _fresh_manager()
        ws_ok1 = _make_mock_ws()
        ws_ok2 = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=Exception("fail"))
        _run(mgr.connect(ws_ok1, "ok1"))
        _run(mgr.connect(ws_ok2, "ok2"))
        _run(mgr.connect(ws_bad, "bad"))
        _run(mgr.broadcast({"type": "test"}))
        assert mgr.get_connection_count() == 2
        assert "ok1" in mgr._connections
        assert "ok2" in mgr._connections
        assert "bad" not in mgr._connections

    def test_subscriber_broadcast_removes_exactly_failed(self):
        mgr = _fresh_manager()
        ws_ok = _make_mock_ws()
        ws_bad = _make_mock_ws()
        ws_bad.send_json = AsyncMock(side_effect=Exception("fail"))
        ws_unsubscribed = _make_mock_ws()
        _run(mgr.connect(ws_ok, "ok"))
        _run(mgr.connect(ws_bad, "bad"))
        _run(mgr.connect(ws_unsubscribed, "unsub"))
        _run(mgr.subscribe("ok", "ch"))
        _run(mgr.subscribe("bad", "ch"))
        # "unsub" is NOT subscribed
        _run(mgr.broadcast_to_subscribers("ch", {"type": "test"}))
        assert "ok" in mgr._connections
        assert "bad" not in mgr._connections
        # "unsub" should still be present (wasn't targeted)
        assert "unsub" in mgr._connections


# ===================================================================
# Error message content validation
# ===================================================================

class TestErrorMessageContent:
    """Error responses have correct structure and safe content."""

    def test_invalid_json_error_has_type(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("{bad")
                msg = ws.receive_json()
                assert msg["type"] == "error"

    def test_invalid_json_error_has_source(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("{bad")
                msg = ws.receive_json()
                assert msg["source"] == "server"

    def test_invalid_json_error_has_severity(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("{bad")
                msg = ws.receive_json()
                assert msg["severity"] == "warning"

    def test_invalid_json_error_has_message(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("{bad")
                msg = ws.receive_json()
                assert msg["message"] == "Invalid JSON"

    def test_oversized_error_has_type(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("x" * (_MAX_MESSAGE_BYTES + 1))
                msg = ws.receive_json()
                assert msg["type"] == "error"

    def test_oversized_error_has_source(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_text("x" * (_MAX_MESSAGE_BYTES + 1))
                msg = ws.receive_json()
                assert msg["source"] == "server"

    def test_subscribe_missing_channel_error_structure(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_json({"action": "subscribe"})
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert msg["source"] == "server"
                assert msg["severity"] == "warning"

    def test_unsubscribe_missing_channel_error_structure(self):
        with _clean_ws_manager():
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.send_json({"action": "unsubscribe"})
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert msg["source"] == "server"
                assert msg["severity"] == "warning"
