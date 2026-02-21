"""Async Finnhub API client for Market Terminal.

Provides a singleton :class:`FinnhubClient` with rate limiting (60 req/min),
circuit-breaker protection, camelCase-to-snake_case normalization, and
response metadata tagging.

Full implementation: TASK-DATA-002
"""

from __future__ import annotations

import asyncio
import enum
import logging
import re
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_BASE_URL = "https://finnhub.io/api/v1"
_MAX_CALLS_PER_MINUTE = 60
_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT = 30.0
_RATE_LIMIT_PAUSE = 60.0

# ---------------------------------------------------------------------------
# Circuit breaker state
# ---------------------------------------------------------------------------
class CircuitState(enum.Enum):
    """Circuit breaker states: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

# ---------------------------------------------------------------------------
# FinnhubClient
# ---------------------------------------------------------------------------
class FinnhubClient:
    """Async HTTP client for the Finnhub REST API with rate limiting and circuit breaker."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key = settings.finnhub_api_key
        self._api_key: str = api_key
        self._enabled: bool = bool(api_key)
        self._permanently_disabled: bool = False
        if not self._enabled:
            logger.warning("Finnhub API key not configured -- client disabled")
        # Circuit breaker
        self._cb_failure_threshold: int = settings.circuit_breaker_failure_threshold
        self._cb_window_seconds: int = settings.circuit_breaker_window_seconds
        self._cb_cooldown_seconds: int = settings.circuit_breaker_cooldown_seconds
        self._circuit_state: CircuitState = CircuitState.CLOSED
        self._failure_timestamps: deque[float] = deque()
        self._circuit_opened_at: float = 0.0
        # Rate limiter
        self._call_timestamps: deque[float] = deque()
        self._rate_lock: asyncio.Lock = asyncio.Lock()
        # HTTP client (lazy)
        self._http_client: httpx.AsyncClient | None = None

    # -- properties ---------------------------------------------------------

    @property
    def is_enabled(self) -> bool:
        """Return *True* if the client can make requests."""
        return self._enabled and not self._permanently_disabled

    @property
    def circuit_state(self) -> CircuitState:
        """Return the current circuit breaker state."""
        return self._circuit_state

    @property
    def calls_remaining(self) -> int:
        """Approximate API calls available in the current 60-s window."""
        now = time.monotonic()
        valid = sum(1 for ts in self._call_timestamps if ts >= now - 60)
        return max(0, _MAX_CALLS_PER_MINUTE - valid)

    # -- lifecycle ----------------------------------------------------------

    def _get_http_client(self) -> httpx.AsyncClient:
        """Return the shared ``httpx.AsyncClient``, creating it lazily."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                base_url=_BASE_URL,
                headers={"X-Finnhub-Token": self._api_key},
                timeout=httpx.Timeout(connect=_CONNECT_TIMEOUT, read=_READ_TIMEOUT,
                                      write=_READ_TIMEOUT, pool=_READ_TIMEOUT),
            )
        return self._http_client

    async def close(self) -> None:
        """Close the underlying HTTP client.  Safe to call multiple times."""
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None
            logger.info("Finnhub HTTP client closed")

    # -- rate limiter -------------------------------------------------------

    async def _wait_for_rate_limit(self) -> None:
        """Block until a request slot is available (sliding 60-s window)."""
        async with self._rate_lock:
            now = time.monotonic()
            while self._call_timestamps and self._call_timestamps[0] < now - 60:
                self._call_timestamps.popleft()
            if len(self._call_timestamps) >= _MAX_CALLS_PER_MINUTE:
                wait_time = 60 - (now - self._call_timestamps[0])
                if wait_time > 0:
                    logger.info("Finnhub rate limit reached, waiting %.0fms", wait_time * 1000)
                    await asyncio.sleep(wait_time)
                    now = time.monotonic()
                    while self._call_timestamps and self._call_timestamps[0] < now - 60:
                        self._call_timestamps.popleft()
            self._call_timestamps.append(now)

    # -- circuit breaker ----------------------------------------------------

    def _record_failure(self) -> None:
        """Record a failed request and potentially open the circuit."""
        now = time.monotonic()
        self._failure_timestamps.append(now)
        cutoff = now - self._cb_window_seconds
        while self._failure_timestamps and self._failure_timestamps[0] < cutoff:
            self._failure_timestamps.popleft()
        if len(self._failure_timestamps) >= self._cb_failure_threshold:
            if self._circuit_state != CircuitState.OPEN:
                logger.warning(
                    "Finnhub circuit breaker: %s -> OPEN (%d failures in %ds)",
                    self._circuit_state.value, len(self._failure_timestamps),
                    self._cb_window_seconds,
                )
                self._circuit_state = CircuitState.OPEN
                self._circuit_opened_at = now

    def _record_success(self) -> None:
        """Record a successful request; close the breaker if half-open."""
        if self._circuit_state == CircuitState.HALF_OPEN:
            logger.info("Finnhub circuit breaker: HALF_OPEN -> CLOSED")
            self._circuit_state = CircuitState.CLOSED
            self._failure_timestamps.clear()

    def _check_circuit(self) -> bool:
        """Return *True* if the circuit allows a request through."""
        if self._circuit_state == CircuitState.CLOSED:
            return True
        if self._circuit_state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._circuit_opened_at
            if elapsed >= self._cb_cooldown_seconds:
                logger.info("Finnhub circuit breaker: OPEN -> HALF_OPEN (cooldown elapsed)")
                self._circuit_state = CircuitState.HALF_OPEN
                return True
            return False
        return True  # HALF_OPEN -- allow one test request

    # -- core request -------------------------------------------------------

    async def _request(self, endpoint: str, params: dict[str, Any] | None = None) -> dict | list | None:
        """Send GET to *endpoint* with resilience wrappers.  Never raises."""
        if not self.is_enabled:
            if not self._enabled:
                logger.warning("Finnhub client disabled (no API key)")
            elif self._permanently_disabled:
                logger.warning("Finnhub client disabled (permanently disabled due to previous 403)")
            return None
        if not self._check_circuit():
            logger.warning("Finnhub circuit breaker OPEN, skipping request to %s", endpoint)
            return None
        await self._wait_for_rate_limit()
        try:
            client = self._get_http_client()
            response = await client.get(endpoint, params=params)
            response.raise_for_status()
            data = response.json()
            # Allow empty list/dict as valid successful responses
            if data is None:
                return None
            self._record_success()
            return self._normalize_response(data)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 429:
                logger.warning("Finnhub 429 rate limited, pausing %.0fs", _RATE_LIMIT_PAUSE)
                await asyncio.sleep(_RATE_LIMIT_PAUSE)
            elif status == 403:
                logger.warning("Finnhub 403 forbidden on %s -- check API key scope/plan", endpoint)
                # Do NOT permanently disable, as some endpoints (e.g. economic calendar)
                # might be restricted while others (price/news) work fine.
            else:
                logger.error("Finnhub HTTP %d on %s: %s", status, endpoint, exc)
            self._record_failure()
            return None
        except httpx.TimeoutException:
            logger.error("Finnhub timeout on %s", endpoint)
            self._record_failure()
            return None
        except httpx.ConnectError as exc:
            logger.error("Finnhub connection error on %s: %s", endpoint, exc)
            self._record_failure()
            return None
        except Exception as exc:
            logger.error("Finnhub unexpected error on %s: %s", endpoint, exc)
            self._record_failure()
            return None

    # -- response normalisation ---------------------------------------------

    @staticmethod
    def _to_snake_case(name: str) -> str:
        """Convert a camelCase or PascalCase *name* to snake_case."""
        s = re.sub(r"([A-Z]+)", r"_\1", name)
        return s.lower().lstrip("_")

    @classmethod
    def _normalize_keys(cls, data: Any) -> Any:
        """Recursively convert all dict keys to snake_case."""
        if isinstance(data, dict):
            return {cls._to_snake_case(k): cls._normalize_keys(v) for k, v in data.items()}
        if isinstance(data, list):
            return [cls._normalize_keys(item) for item in data]
        return data

    @staticmethod
    def _add_metadata(data: Any) -> Any:
        """Tag every dict in *data* with ``_source`` and ``_fetched_at``."""
        now = datetime.now(timezone.utc).isoformat()
        if isinstance(data, dict):
            data["_source"] = "finnhub"
            data["_fetched_at"] = now
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    item["_source"] = "finnhub"
                    item["_fetched_at"] = now
        return data

    @classmethod
    def _normalize_response(cls, data: Any) -> Any:
        """Normalize keys and attach metadata."""
        return cls._add_metadata(cls._normalize_keys(data))

    @staticmethod
    def _unix_to_iso(ts: int | float | None) -> str | None:
        """Convert a Unix timestamp to an ISO-8601 UTC string."""
        if ts is None:
            return None
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        except (OSError, ValueError, OverflowError):
            return None

    # -- public API: quotes -------------------------------------------------

    async def get_quote(self, symbol: str) -> dict[str, Any] | None:
        """Fetch a real-time quote for *symbol*."""
        raw = await self._request("/quote", params={"symbol": symbol.upper()})
        if raw is None or not isinstance(raw, dict):
            return None
        key_map = {
            "c": "current_price", "d": "change", "dp": "percent_change",
            "h": "high", "l": "low", "o": "open",
            "pc": "previous_close", "t": "timestamp",
        }
        result: dict[str, Any] = {"symbol": symbol.upper()}
        for src, dest in key_map.items():
            result[dest] = raw.get(src)
        result["timestamp"] = self._unix_to_iso(result.get("timestamp"))
        result["_source"] = raw.get("_source", "finnhub")
        result["_fetched_at"] = raw.get("_fetched_at")
        return result

    # -- public API: candles ------------------------------------------------

    async def get_candles(self, symbol: str, resolution: str,
                          from_ts: int, to_ts: int) -> list[dict[str, Any]] | None:
        """Fetch OHLCV candle data for *symbol*."""
        raw = await self._request("/stock/candle", params={
            "symbol": symbol.upper(), "resolution": resolution,
            "from": from_ts, "to": to_ts,
        })
        if raw is None or not isinstance(raw, dict):
            return None
        if raw.get("s") != "ok":
            return None
        opens = raw.get("o", [])
        highs = raw.get("h", [])
        lows = raw.get("l", [])
        closes = raw.get("c", [])
        volumes = raw.get("v", [])
        timestamps = raw.get("t", [])
        now_iso = datetime.now(timezone.utc).isoformat()
        candles: list[dict[str, Any]] = []
        for o, h, l, c, v, t in zip(opens, highs, lows, closes, volumes, timestamps):
            candles.append({
                "open": o, "high": h, "low": l, "close": c, "volume": v,
                "timestamp": self._unix_to_iso(t),
                "_source": "finnhub", "_fetched_at": now_iso,
            })
        return candles

    # -- public API: news ---------------------------------------------------

    async def get_company_news(self, symbol: str, from_date: str,
                               to_date: str) -> list[dict[str, Any]] | None:
        """Fetch company news for *symbol* (dates as ``YYYY-MM-DD``)."""
        raw = await self._request("/company-news", params={
            "symbol": symbol.upper(), "from": from_date, "to": to_date,
        })
        if raw is None or not isinstance(raw, list):
            return None
        return self._format_news_items(raw)

    async def get_market_news(self, category: str = "general") -> list[dict[str, Any]] | None:
        """Fetch general market news (category: general/forex/crypto/merger)."""
        raw = await self._request("/news", params={"category": category})
        if raw is None or not isinstance(raw, list):
            return None
        return self._format_news_items(raw)

    def _format_news_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize a list of Finnhub news items."""
        now_iso = datetime.now(timezone.utc).isoformat()
        results: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            results.append({
                "headline": item.get("headline"), "summary": item.get("summary"),
                "source": item.get("source"), "url": item.get("url"),
                "image": item.get("image"),
                "published_at": self._unix_to_iso(item.get("datetime")),
                "category": item.get("category"), "related": item.get("related"),
                "_source": "finnhub", "_fetched_at": now_iso,
            })
        return results

    # -- public API: financials ---------------------------------------------

    async def get_basic_financials(self, symbol: str) -> dict[str, Any] | None:
        """Fetch key financial metrics for *symbol*."""
        raw = await self._request("/stock/metric", params={
            "symbol": symbol.upper(), "metric": "all",
        })
        if raw is None or not isinstance(raw, dict):
            return None
        metric = raw.get("metric", {})
        if not isinstance(metric, dict):
            return None
        metric_map = {
            "pe_normalized_annual": "pe_ratio",
            "market_capitalization": "market_cap",
            "dividend_yield_indicated_annual": "dividend_yield",
            "eps_normalized_annual": "eps",
            "revenue_per_share_annual": "revenue_per_share",
            "book_value_per_share_annual": "book_value_per_share",
            "52_week_high": "week_52_high",
            "52_week_low": "week_52_low",
            "beta": "beta",
            "10_day_average_trading_volume": "avg_volume_10d",
        }
        now_iso = datetime.now(timezone.utc).isoformat()
        result: dict[str, Any] = {"symbol": symbol.upper()}
        for src, dest in metric_map.items():
            result[dest] = metric.get(src)
        result["_source"] = "finnhub"
        result["_fetched_at"] = now_iso
        return result

    # -- public API: company profile ----------------------------------------

    async def get_company_profile(self, symbol: str) -> dict[str, Any] | None:
        """Fetch the company profile for *symbol*."""
        raw = await self._request("/stock/profile2", params={"symbol": symbol.upper()})
        if raw is None or not isinstance(raw, dict):
            return None
        field_map = {"market_capitalization": "market_cap", "finnhub_industry": "industry"}
        result: dict[str, Any] = {}
        for key, value in raw.items():
            result[field_map.get(key, key)] = value
        result.setdefault("symbol", symbol.upper())
        return result

    # -- public API: economic calendar --------------------------------------

    async def get_economic_calendar(self, from_date: str, to_date: str) -> list[dict[str, Any]] | None:
        """Fetch US economic calendar events (dates as ``YYYY-MM-DD``)."""
        raw = await self._request("/calendar/economic", params={"from": from_date, "to": to_date})
        if raw is None or not isinstance(raw, dict):
            return None
        events = raw.get("economic_calendar", [])
        if not isinstance(events, list):
            return None
        now_iso = datetime.now(timezone.utc).isoformat()
        results: list[dict[str, Any]] = []
        for event in events:
            if not isinstance(event, dict):
                continue
            if event.get("country") != "US":
                continue
            event["_source"] = "finnhub"
            event["_fetched_at"] = now_iso
            results.append(event)
        return results

    # -- public API: symbol search ------------------------------------------

    async def search_symbol(self, query: str) -> list[dict[str, Any]] | None:
        """Search for symbols matching *query* (max 10 results)."""
        raw = await self._request("/search", params={"q": query})
        if raw is None or not isinstance(raw, dict):
            return None
        results = raw.get("result", [])
        if not isinstance(results, list):
            return None
        now_iso = datetime.now(timezone.utc).isoformat()
        limited = results[:10]
        for item in limited:
            if isinstance(item, dict):
                item["_source"] = "finnhub"
                item["_fetched_at"] = now_iso
        return limited


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: FinnhubClient | None = None


def get_finnhub_client() -> FinnhubClient:
    """Return the singleton :class:`FinnhubClient`, creating it on first call."""
    global _client
    if _client is None:
        _client = FinnhubClient()
    return _client


async def close_finnhub_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
