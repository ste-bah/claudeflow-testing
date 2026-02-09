"""WebSocket endpoint and connection manager.

Real-time data streaming: price updates, analysis progress, news alerts,
god-agent streaming responses.  Manages multiple client connections with
channel subscriptions, heartbeat monitoring, and auto-cleanup.

Full implementation: TASK-API-008
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_HEARTBEAT_INTERVAL_S = 30
_STALE_TIMEOUT_S = 90  # 3 missed heartbeats
_MAX_CONNECTIONS = 10
_MAX_MESSAGE_BYTES = 65_536  # 64 KB

router = APIRouter(tags=["websocket"])


# ---------------------------------------------------------------------------
# Connection record
# ---------------------------------------------------------------------------
class _Connection:
    """Metadata for a single WebSocket connection."""

    __slots__ = ("ws", "client_id", "connected_at", "subscriptions", "last_heartbeat")

    def __init__(self, ws: WebSocket, client_id: str) -> None:
        self.ws = ws
        self.client_id = client_id
        self.connected_at = datetime.now(tz=timezone.utc).isoformat()
        self.subscriptions: set[str] = set()
        self.last_heartbeat = datetime.now(tz=timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        return {
            "client_id": self.client_id,
            "connected_at": self.connected_at,
            "subscriptions": sorted(self.subscriptions),
            "last_heartbeat": self.last_heartbeat.isoformat(),
        }


# ---------------------------------------------------------------------------
# WebSocketManager
# ---------------------------------------------------------------------------
class WebSocketManager:
    """Manages WebSocket connections, channels, and broadcasts."""

    def __init__(self) -> None:
        self._connections: dict[str, _Connection] = {}
        self._lock = asyncio.Lock()

    # -- lifecycle ----------------------------------------------------------

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Register a new client connection.

        Raises ``ConnectionRefusedError`` if the connection limit is reached.
        """
        async with self._lock:
            if len(self._connections) >= _MAX_CONNECTIONS:
                raise ConnectionRefusedError("Maximum connections reached")
            self._connections[client_id] = _Connection(websocket, client_id)
        logger.info("WebSocket client connected: %s (total: %d)",
                     client_id, len(self._connections))

    async def disconnect(self, client_id: str) -> None:
        """Remove a client from the connection pool."""
        async with self._lock:
            self._connections.pop(client_id, None)
        logger.info("WebSocket client disconnected: %s (total: %d)",
                     client_id, len(self._connections))

    # -- messaging ----------------------------------------------------------

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send *message* to ALL connected clients.

        Uses ``asyncio.gather`` with ``return_exceptions=True`` so a failed
        send to one client does not block the others.
        """
        async with self._lock:
            conns = list(self._connections.values())

        if not conns:
            return

        results = await asyncio.gather(
            *(self._safe_send(c, message) for c in conns),
            return_exceptions=True,
        )

        # Clean up any clients that failed
        for conn, result in zip(conns, results):
            if result is True:  # _safe_send returns True on failure
                await self.disconnect(conn.client_id)

    async def send_to_client(
        self, client_id: str, message: dict[str, Any]
    ) -> None:
        """Send *message* to a single client identified by *client_id*."""
        async with self._lock:
            conn = self._connections.get(client_id)
        if conn is None:
            logger.warning("send_to_client: unknown client %s", client_id)
            return
        failed = await self._safe_send(conn, message)
        if failed:
            await self.disconnect(client_id)

    async def broadcast_to_subscribers(
        self, channel: str, message: dict[str, Any]
    ) -> None:
        """Send *message* only to clients subscribed to *channel*."""
        async with self._lock:
            conns = [
                c for c in self._connections.values()
                if channel in c.subscriptions
            ]

        if not conns:
            return

        results = await asyncio.gather(
            *(self._safe_send(c, message) for c in conns),
            return_exceptions=True,
        )

        for conn, result in zip(conns, results):
            if result is True:
                await self.disconnect(conn.client_id)

    # -- queries ------------------------------------------------------------

    async def get_active_connections(self) -> list[dict[str, Any]]:
        """Return metadata for all active connections."""
        async with self._lock:
            return [c.to_dict() for c in self._connections.values()]

    def get_connection_count(self) -> int:
        """Return the number of active connections."""
        return len(self._connections)

    # -- subscriptions ------------------------------------------------------

    async def subscribe(self, client_id: str, channel: str) -> bool:
        """Add *channel* to the client's subscriptions.

        Returns *True* if the client was found and subscribed.
        """
        async with self._lock:
            conn = self._connections.get(client_id)
            if conn is None:
                return False
            conn.subscriptions.add(channel)
        logger.debug("Client %s subscribed to %s", client_id, channel)
        return True

    async def unsubscribe(self, client_id: str, channel: str) -> bool:
        """Remove *channel* from the client's subscriptions.

        Returns *True* if the client was found (even if not subscribed).
        """
        async with self._lock:
            conn = self._connections.get(client_id)
            if conn is None:
                return False
            conn.subscriptions.discard(channel)
        logger.debug("Client %s unsubscribed from %s", client_id, channel)
        return True

    # -- heartbeat / cleanup ------------------------------------------------

    async def update_heartbeat(self, client_id: str) -> None:
        """Record a heartbeat timestamp for *client_id*."""
        async with self._lock:
            conn = self._connections.get(client_id)
            if conn is not None:
                conn.last_heartbeat = datetime.now(tz=timezone.utc)

    async def cleanup_stale(self) -> list[str]:
        """Remove connections that have missed 3+ heartbeats (≥ 90 s).

        Returns a list of removed client IDs.
        """
        now = datetime.now(tz=timezone.utc)
        stale: list[str] = []

        async with self._lock:
            for cid, conn in list(self._connections.items()):
                elapsed = (now - conn.last_heartbeat).total_seconds()
                if elapsed >= _STALE_TIMEOUT_S:
                    stale.append(cid)
                    self._connections.pop(cid, None)
                    logger.info("Removed stale connection: %s (%.0fs)", cid, elapsed)

        return stale

    # -- internals ----------------------------------------------------------

    async def _safe_send(
        self, conn: _Connection, message: dict[str, Any]
    ) -> bool:
        """Send *message* to *conn*; return *True* on failure."""
        try:
            if conn.ws.client_state != WebSocketState.CONNECTED:
                return True  # already disconnected
            await conn.ws.send_json(message)
            return False
        except Exception:
            logger.warning("Failed to send to client %s", conn.client_id,
                           exc_info=True)
            return True


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
ws_manager = WebSocketManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str | None = Query(default=None),
) -> None:
    """Main WebSocket handler.

    Accepts connections, sends a welcome message, relays client messages
    (subscribe/unsubscribe), and runs a heartbeat loop.
    """
    # Assign or generate client_id
    cid = client_id or str(uuid.uuid4())

    # Reject if at capacity
    if ws_manager.get_connection_count() >= _MAX_CONNECTIONS:
        await websocket.accept()
        await websocket.close(code=1008, reason="Maximum connections reached")
        return

    await websocket.accept()

    try:
        await ws_manager.connect(websocket, cid)
    except ConnectionRefusedError:
        await websocket.close(code=1008, reason="Maximum connections reached")
        return

    # Send welcome message
    welcome: dict[str, Any] = {
        "type": "connected",
        "client_id": cid,
        "server_time": datetime.now(tz=timezone.utc).isoformat(),
        "reconnect_hint": {
            "strategy": "exponential_backoff",
            "initial_delay_ms": 1000,
            "max_delay_ms": 30000,
            "multiplier": 2,
        },
    }
    try:
        await websocket.send_json(welcome)
    except Exception:
        await ws_manager.disconnect(cid)
        return

    # Start heartbeat task
    heartbeat_task = asyncio.create_task(_heartbeat_loop(websocket, cid))

    try:
        await _receive_loop(websocket, cid)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.warning("WebSocket error for client %s", cid, exc_info=True)
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await ws_manager.disconnect(cid)


# ---------------------------------------------------------------------------
# Internal loops
# ---------------------------------------------------------------------------
async def _receive_loop(websocket: WebSocket, client_id: str) -> None:
    """Process incoming messages from the client."""
    while True:
        raw = await websocket.receive_text()

        if len(raw.encode("utf-8")) > _MAX_MESSAGE_BYTES:
            await websocket.send_json({
                "type": "error",
                "source": "server",
                "message": "Message exceeds maximum size",
                "severity": "warning",
            })
            continue

        # Update heartbeat on any client activity
        await ws_manager.update_heartbeat(client_id)

        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            await websocket.send_json({
                "type": "error",
                "source": "server",
                "message": "Invalid JSON",
                "severity": "warning",
            })
            continue

        action = data.get("action")
        if action == "subscribe":
            channel = data.get("channel", "")
            if channel:
                await ws_manager.subscribe(client_id, channel)
                await websocket.send_json({
                    "type": "subscribed",
                    "channel": channel,
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "source": "server",
                    "message": "Channel is required for subscribe",
                    "severity": "warning",
                })
        elif action == "unsubscribe":
            channel = data.get("channel", "")
            if channel:
                await ws_manager.unsubscribe(client_id, channel)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "channel": channel,
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "source": "server",
                    "message": "Channel is required for unsubscribe",
                    "severity": "warning",
                })
        elif action == "ping":
            await websocket.send_json({"type": "pong"})
        else:
            # Acknowledge unrecognised actions (never echo user input)
            await websocket.send_json({
                "type": "ack",
            })


async def _heartbeat_loop(websocket: WebSocket, client_id: str) -> None:
    """Send periodic heartbeat pings to detect dead connections."""
    try:
        while True:
            await asyncio.sleep(_HEARTBEAT_INTERVAL_S)
            try:
                if websocket.client_state != WebSocketState.CONNECTED:
                    break
                await websocket.send_json({
                    "type": "heartbeat",
                    "server_time": datetime.now(tz=timezone.utc).isoformat(),
                })
            except Exception:
                logger.debug("Heartbeat failed for client %s", client_id)
                break
    except asyncio.CancelledError:
        pass
