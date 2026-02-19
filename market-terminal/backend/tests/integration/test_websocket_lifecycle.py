"""Integration tests for WebSocket lifecycle (Flow 4).

Tests the full WebSocket connection cycle: welcome handshake,
subscribe/unsubscribe channels, ping/pong, error handling for
invalid JSON and unknown actions, and the max-connections guard.

Depends on conftest.py fixtures: client, _reset_singletons.
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from starlette.testclient import TestClient


class TestWebSocketLifecycle:
    """WebSocket endpoint /ws -- connection lifecycle and messaging."""

    # ------------------------------------------------------------------
    # 1. Welcome handshake
    # ------------------------------------------------------------------
    def test_connect_receives_welcome(self, client: TestClient):
        """First message after connect is a 'connected' welcome with
        client_id (UUID), server_time, and reconnect_hint."""
        with client.websocket_connect("/ws") as ws:
            welcome = ws.receive_json()

            assert welcome["type"] == "connected"

            # client_id must be a valid UUID-4 string
            cid = welcome["client_id"]
            parsed = uuid.UUID(cid)
            assert parsed.version == 4

            assert "server_time" in welcome

            hint = welcome["reconnect_hint"]
            assert hint["strategy"] == "exponential_backoff"
            assert isinstance(hint["initial_delay_ms"], int)
            assert isinstance(hint["max_delay_ms"], int)
            assert isinstance(hint["multiplier"], int)

    # ------------------------------------------------------------------
    # 2. Subscribe / Unsubscribe
    # ------------------------------------------------------------------
    def test_subscribe_and_unsubscribe(self, client: TestClient):
        """Subscribe to a channel, then unsubscribe; verify both acks."""
        with client.websocket_connect("/ws") as ws:
            _welcome = ws.receive_json()  # consume welcome

            # Subscribe
            ws.send_json({"action": "subscribe", "channel": "price:AAPL"})
            sub_msg = ws.receive_json()

            assert sub_msg["type"] == "subscribed"
            assert sub_msg["channel"] == "price:AAPL"

            # Unsubscribe
            ws.send_json({"action": "unsubscribe", "channel": "price:AAPL"})
            unsub_msg = ws.receive_json()

            assert unsub_msg["type"] == "unsubscribed"
            assert unsub_msg["channel"] == "price:AAPL"

    # ------------------------------------------------------------------
    # 3. Ping / Pong
    # ------------------------------------------------------------------
    def test_ping_pong(self, client: TestClient):
        """Sending action=ping returns a pong message."""
        with client.websocket_connect("/ws") as ws:
            _welcome = ws.receive_json()

            ws.send_json({"action": "ping"})
            pong = ws.receive_json()

            assert pong["type"] == "pong"

    # ------------------------------------------------------------------
    # 4. Invalid JSON
    # ------------------------------------------------------------------
    def test_invalid_json_returns_error(self, client: TestClient):
        """Sending non-JSON text returns an error with 'Invalid JSON'."""
        with client.websocket_connect("/ws") as ws:
            _welcome = ws.receive_json()

            ws.send_text("not json")
            err = ws.receive_json()

            assert err["type"] == "error"
            assert "Invalid JSON" in err["message"]

    # ------------------------------------------------------------------
    # 5. Unknown action
    # ------------------------------------------------------------------
    def test_unknown_action_returns_ack(self, client: TestClient):
        """Unrecognised actions receive a generic 'ack' reply."""
        with client.websocket_connect("/ws") as ws:
            _welcome = ws.receive_json()

            ws.send_json({"action": "foobar"})
            ack = ws.receive_json()

            assert ack["type"] == "ack"

    # ------------------------------------------------------------------
    # 6. Max connections rejected
    # ------------------------------------------------------------------
    def test_max_connections_rejected(self, client: TestClient):
        """When the server is at capacity the next client is accepted
        then immediately closed with code 1008."""
        with patch("app.api.routes.websocket._MAX_CONNECTIONS", 1):
            # First connection -- should succeed
            with client.websocket_connect("/ws") as ws1:
                welcome = ws1.receive_json()
                assert welcome["type"] == "connected"

                # Second connection while first is still open.
                # The server accepts then closes with 1008, which
                # the Starlette TestClient surfaces as a disconnect.
                with pytest.raises(Exception):
                    with client.websocket_connect("/ws") as ws2:
                        ws2.receive_json()
