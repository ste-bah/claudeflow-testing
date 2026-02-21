"""Massive WebSocket Client for real-time options data.

Connects to wss://socket.massive.com/options for live quotes and trades.
Authenticates with user API key, parses payloads safely dropping NaNs,
and injects into the unified WebSocketManager.

TASK-UPDATE-007
"""

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set, Tuple

import websockets
from websockets.exceptions import WebSocketException

from app.api.routes.websocket import ws_manager
from app.config import get_settings
from app.data.massive_client import _sanitize_float

logger = logging.getLogger(__name__)

# Constants
_WS_URL = "wss://socket.massive.com/options"
_OPTION_TICKER_REGEX = re.compile(r"^O:[A-Z]{1,10}\d{6}[CP]\d{8}$")

# Heartbeat & Reconnect Configs
_PING_INTERVAL_S = 30
_PING_TIMEOUT_S = 10
_MAX_MESSAGE_BYTES = 65_536  # 64KB
_CB_MAX_ATTEMPTS = 10
_CB_COOLDOWN_S = 120


class MassiveWsClient:
    """Singleton WebSocket client connecting to Massive.com feed."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        settings = get_settings()

        self._api_key = settings.massive_api_key
        self._tier = settings.massive_options_tier or "free"

        self._enabled = True
        self._check_tier_enabled()

        self._subscriptions: Set[str] = set()
        self._connection: Optional[websockets.WebSocketClientProtocol] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._ping_task: Optional[asyncio.Task] = None

        self._reconnect_attempts = 0
        self._circuit_breaker_state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self._last_cb_open_time: Optional[float] = None

        # Metrics
        self._messages_received = 0
        self._reconnection_count = 0
        self._last_message_at: Optional[datetime] = None
        self._latency_ms: Optional[float] = None

    def _check_tier_enabled(self) -> None:
        """Verify the configured Massive Tier supports Websockets."""
        if not self._api_key:
            logger.warning("MassiveWsClient disabled: No API key configured.")
            self._enabled = False
            return

        if self._tier.lower() not in ("developer", "advanced"):
            logger.warning(
                "Massive.com WebSocket requires Developer tier ($79/month). "
                "Real-time streaming disabled; using REST polling fallback."
            )
            self._enabled = False

    @property
    def circuit_breaker_state(self) -> str:
        return self._circuit_breaker_state

    # ------------------------------------------------------------------------
    # Subscriptions API
    # ------------------------------------------------------------------------

    async def subscribe(self, option_ticker: str) -> bool:
        """Subscribe to real-time quotes and trades for *option_ticker*.

        Starts the WebSocket connection if this is the first subscription.
        Returns True if subscription was sent, False if disabled or failed.
        """
        if not self._enabled:
            logger.debug(f"Subscribe skipped for {option_ticker}: Client disabled via Tier or Auth.")
            return False

        if not _OPTION_TICKER_REGEX.match(option_ticker):
            logger.warning(f"Invalid option ticker format rejected: {option_ticker}")
            return False

        async with self._lock:
            if option_ticker in self._subscriptions:
                return True
            self._subscriptions.add(option_ticker)
            is_first = len(self._subscriptions) == 1

        if is_first:
            await self.start()
        else:
            await self._send_throttle_safe("subscribe", option_ticker)
            
        return True

    async def unsubscribe(self, option_ticker: str) -> bool:
        """Unsubscribe from *option_ticker*.

        Stops the WebSocket connection if no subscriptions remain.
        Returns True if unsubscription was sent, False if not subscribed.
        """
        async with self._lock:
            if option_ticker not in self._subscriptions:
                return False
            self._subscriptions.remove(option_ticker)
            is_empty = len(self._subscriptions) == 0

        if is_empty:
            await self.stop()
        else:
            await self._send_throttle_safe("unsubscribe", option_ticker)

        return True

    # ------------------------------------------------------------------------
    # Lifecycle Control
    # ------------------------------------------------------------------------

    async def start(self) -> None:
        """Start the WebSocket connection and receive loop."""
        async with self._lock:
            if self._receive_task is not None and not self._receive_task.done():
                return
            self._reconnect_attempts = 0
            self._receive_task = asyncio.create_task(self._connect_and_loop())

    async def stop(self) -> None:
        """Stop the WebSocket connection and cancel the receive loop task."""
        async with self._lock:
            if self._ping_task:
                self._ping_task.cancel()
                self._ping_task = None
                
            if self._receive_task:
                self._receive_task.cancel()
                self._receive_task = None

            if self._connection:
                await self._connection.close()
                self._connection = None

            self._reconnect_attempts = 0
            self._subscriptions.clear()

    # ------------------------------------------------------------------------
    # Connection Flow
    # ------------------------------------------------------------------------

    async def _connect_and_loop(self) -> None:
        """Main connection and read loop tracking exponential backoff."""
        while True:
            # 1. Check Circuit Breaker State
            if not await self._evaluate_circuit_breaker():
                logger.error("Circuit breaker is OPEN. Suspending reconnection.")
                await asyncio.sleep(_CB_COOLDOWN_S)
                continue

            # 2. Apply exponential backoff BEFORE connect if we're retrying
            async with self._lock:
                attempts = self._reconnect_attempts
                
            if attempts > 0:
                base_delay = 1.0
                delay = min(base_delay * (2 ** attempts), 60.0)
                jitter = random.uniform(0, 0.5)
                full_delay = delay + jitter
                
                logger.info(f"Reconnection attempt {attempts} starting in {full_delay:.2f}s...")
                await asyncio.sleep(full_delay)

            try:
                # 3. Establish stream
                async with websockets.connect(_WS_URL) as ws:
                    async with self._lock:
                        self._connection = ws
                        
                    # 4. Authenticate payload
                    auth_msg = {"action": "auth", "params": self._api_key}
                    await ws.send(json.dumps(auth_msg))
                    
                    auth_replied = False
                    for _ in range(10): # Timeout mapping over 10 seconds approx
                        try:
                            resp_raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                            resp = json.loads(resp_raw)
                            logger.info(f"Auth response: {resp}")
                            
                            # Massive uses generic status indicators
                            if resp.get("status") == "error":
                                raise PermissionError(f"Auth failed: {resp.get('message')}")
                            
                            auth_replied = True
                            break
                        except asyncio.TimeoutError:
                            continue
                            
                    if not auth_replied:
                         raise TimeoutError("No auth response received.")
                        
                    # 5. Success reset stats 
                    async with self._lock:
                        if self._circuit_breaker_state == "HALF_OPEN":
                            self._set_cb_state("CLOSED")
                        self._reconnect_attempts = 0
                        self._reconnection_count += 1
                        subs = list(self._subscriptions)
                        
                        # Trigger pings
                        if self._ping_task:
                            self._ping_task.cancel()
                        self._ping_task = asyncio.create_task(self._heartbeat_ping_loop())

                    # 6. Push cached subscriptions
                    for sub in subs:
                        await self._send_throttle_safe("subscribe", sub, assert_ws=ws)

                    # 7. Listen for multiplexed frames
                    while True:
                        msg_raw = await ws.recv()
                        
                        if len(msg_raw.encode('utf-8')) > _MAX_MESSAGE_BYTES:
                            logger.warning("Message from Massive WebSocket > 64KB. Discarding.")
                            continue
                            
                        self._process_payload(msg_raw)

            except PermissionError as e:
                logger.error(f"Fatal WS Auth Block: {str(e)}")
                self._enabled = False
                await self.stop()
                return # Permanently dies
                
            except (WebSocketException, ConnectionError, TimeoutError, json.JSONDecodeError) as e:
                logger.warning(f"WebSocket mapping disconnected: {str(e)}")
                async with self._lock:
                    self._reconnect_attempts += 1
                    
            except asyncio.CancelledError:
                break
                
            except Exception as e:
                 logger.warning(f"Unexpected WebSocket processing err: {str(e)}", exc_info=True)
                 async with self._lock:
                     self._reconnect_attempts += 1

    # ------------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------------

    async def _evaluate_circuit_breaker(self) -> bool:
        """Transitions circuit breaker states across 120s cooldown intervals."""
        async with self._lock:
            if self._circuit_breaker_state == "OPEN":
                now = asyncio.get_event_loop().time()
                if self._last_cb_open_time is not None and (now - self._last_cb_open_time) >= _CB_COOLDOWN_S:
                    self._set_cb_state("HALF_OPEN")
                    return True
                return False
                
            if self._reconnect_attempts >= _CB_MAX_ATTEMPTS:
                self._set_cb_state("OPEN")
                self._last_cb_open_time = asyncio.get_event_loop().time()
                return False
                
            return True

    def _set_cb_state(self, new_state: str) -> None:
        old_state = self._circuit_breaker_state
        if old_state != new_state:
            self._circuit_breaker_state = new_state
            logger.warning(f"MassiveWsClient circuit breaker: {old_state} -> {new_state}")

    async def _send_throttle_safe(self, action: str, ticker: str, assert_ws: Optional[websockets.WebSocketClientProtocol] = None) -> None:
        """Formats Massive subscribe/unsubscribe comma strings safely over socket."""
        ws = assert_ws or self._connection
        if not ws or getattr(ws, "state", None) != websockets.protocol.State.OPEN:
            return
            
        # OQ.* -> Options Quote || O.* -> Options Trade
        payload = {
            "action": action,
            "params": f"OQ.{ticker},O.{ticker}"
        }
        try:
            await ws.send(json.dumps(payload))
        except WebSocketException:
            pass

    async def _heartbeat_ping_loop(self) -> None:
         # Note: Server ping upstream.
         try:
             while True:
                 await asyncio.sleep(_PING_INTERVAL_S)
                 async with self._lock:
                     ws = self._connection
                     
                 if not ws or getattr(ws, "state", None) != websockets.protocol.State.OPEN:
                     break
                     
                 try:
                     # Send a ping and await the pong (unsolicited timeout checking)
                     pong_waiter = await ws.ping()
                     await asyncio.wait_for(pong_waiter, timeout=_PING_TIMEOUT_S)
                 except asyncio.TimeoutError:
                     logger.warning("Heartbeat ping timeout. Dropping stale Massive upstream.")
                     await ws.close()
                     break
                 except Exception:
                     break
         except asyncio.CancelledError:
             pass

    def _process_payload(self, raw_str: str) -> None:
        """Converts Massive payloads safely checking floats and propagating to WS unified loop."""
        try:
             data = json.loads(raw_str)
        except json.JSONDecodeError:
             return
             
        now = datetime.now(tz=timezone.utc)
        self._last_message_at = now
        self._messages_received += 1

        if not isinstance(data, list):
             data = [data]
             
        for buf in data:
            if not isinstance(buf, dict) or "ev" not in buf:
                 continue
                 
            event_type = buf.get("ev")
            sym = buf.get("sym", "")
            
            # Massive.com embeds timestamp in "t" (epoch ms) or similar string identifiers
            pts: Optional[float] = None
            if "t" in buf and isinstance(buf["t"], (int, float)) and not isinstance(buf["t"], bool):
                 pts = buf["t"]
            
            pdt = now.isoformat()
            if pts:
                 p_time = datetime.fromtimestamp(pts / 1000.0, tz=timezone.utc)
                 pdt = p_time.isoformat()
                 self._latency_ms = (now - p_time).total_seconds() * 1000.0

            if event_type == "OQ":
                 # OQ Options Quote mapping
                 cleaned = {
                     "type": "options_quote",
                     "ticker": sym,
                     "bid": _sanitize_float(buf.get("bp")),
                     "ask": _sanitize_float(buf.get("ap")),
                     "midpoint": _sanitize_float(buf.get("mp")),
                     "bid_size": _sanitize_float(buf.get("bs")),
                     "ask_size": _sanitize_float(buf.get("as")),
                     "timestamp": pdt,
                     "source": "massive_ws"
                 }
                 channel = f"options_quote:{sym}"
                 async def broadcast_safe(chan, msg):
                     await ws_manager.broadcast_to_subscribers(chan, msg)
                 asyncio.create_task(broadcast_safe(channel, cleaned))
                 
            elif event_type == "O":
                 # O Options Trade mapping
                 cleaned = {
                     "type": "options_trade",
                     "ticker": sym,
                     "price": _sanitize_float(buf.get("p")),
                     "size": _sanitize_float(buf.get("s")),
                     "exchange": str(buf.get("x", "")),
                     "timestamp": pdt,
                     "source": "massive_ws"
                 }
                 channel = f"options_trade:{sym}"
                 async def broadcast_safe_trade(chan, msg):
                     await ws_manager.broadcast_to_subscribers(chan, msg)
                 asyncio.create_task(broadcast_safe_trade(channel, cleaned))

    async def get_metrics(self) -> dict[str, Any]:
        """Return current mapping snapshot."""
        async with self._lock:
            subs = len(self._subscriptions)
            is_connected = self._connection is not None and getattr(self._connection, "state", None) == websockets.protocol.State.OPEN
            
        return {
            "messages_received": self._messages_received,
            "reconnection_count": self._reconnection_count,
            "last_message_at": self._last_message_at.isoformat() if self._last_message_at is not None else None,
            "avg_latency_ms": self._latency_ms,
            "subscriptions_count": subs,
            "circuit_breaker_state": self._circuit_breaker_state,
            "enabled": self._enabled,
            "connected": is_connected
        }

# Module-level singleton
_ws_client: Optional[MassiveWsClient] = None

def get_massive_ws_client() -> MassiveWsClient:
    global _ws_client
    if _ws_client is None:
        _ws_client = MassiveWsClient()
    return _ws_client
