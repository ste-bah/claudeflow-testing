"""Async FRED API client for Market Terminal.

Wraps the synchronous ``fredapi`` library with async helpers, a sliding-window
rate limiter (120 req/min), SQLite cache integration (``fundamentals_cache``
and ``macro_events`` tables), and response metadata tagging.

Full implementation: TASK-DATA-005
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FRED_SERIES: dict[str, str] = {
    "gdp": "GDP",
    "gdp_growth": "A191RL1Q225SBEA",
    "cpi_headline": "CPIAUCSL",
    "cpi_core": "CPILFESL",
    "pce_headline": "PCEPI",
    "pce_core": "PCEPILFE",
    "unemployment_rate": "UNRATE",
    "nonfarm_payrolls": "PAYEMS",
    "fed_funds_rate": "FEDFUNDS",
    "treasury_10y": "DGS10",
    "treasury_2y": "DGS2",
    "yield_spread_10y2y": "T10Y2Y",
    "retail_sales": "RSAFS",
    "industrial_production": "INDPRO",
    "consumer_confidence": "UMCSENT",
    "housing_starts": "HOUST",
    "building_permits": "PERMIT",
    "manufacturing_employment": "MANEMP",
    "ism_services": "NMFCI",
    "ppi": "PPIACO",
    "durable_goods": "DGORDER",
    "initial_claims": "ICSA",
}

_MAX_CALLS_PER_MINUTE = 120


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _tag(data: dict | list, *, cached: bool = False) -> dict | list:
    """Attach ``_source``, ``_fetched_at``, ``_cached`` metadata."""
    now = _now_iso()
    items = (
        [data] if isinstance(data, dict)
        else (data if isinstance(data, list) else [])
    )
    for item in items:
        if isinstance(item, dict):
            item.update({"_source": "fred", "_fetched_at": now, "_cached": cached})
    return data


# ---------------------------------------------------------------------------
# FredClient
# ---------------------------------------------------------------------------
class FredClient:
    """Async wrapper around *fredapi* with caching and rate limiting."""

    def __init__(self) -> None:
        settings = get_settings()
        api_key: str = settings.fred_api_key
        self._api_key: str = api_key
        self._enabled: bool = bool(api_key)
        self._cache_ttl_fundamentals: int = settings.cache_ttl_fundamentals
        self._cache_ttl_macro: int = settings.cache_ttl_macro
        self._max_per_min: int = _MAX_CALLS_PER_MINUTE

        # Rate limiter
        self._rate_timestamps: deque[float] = deque()
        self._rate_lock: asyncio.Lock = asyncio.Lock()

        # Lazy fredapi import
        self._fred: Any = None
        if self._enabled:
            try:
                from fredapi import Fred  # type: ignore[import-untyped]
                self._fred = Fred(api_key=api_key)
                logger.info("FRED client initialized (API key configured)")
            except ImportError:
                logger.warning(
                    "fredapi package not installed -- FRED client disabled. "
                    "Install with: pip install fredapi"
                )
                self._enabled = False
        else:
            logger.warning("FRED API key not configured -- client disabled")

        # Requests exception types (lazy, for catch blocks)
        self._requests_exc: tuple[type, ...] = ()
        try:
            import requests  # type: ignore[import-untyped]
            self._requests_exc = (
                requests.ConnectionError,
                requests.Timeout,
            )
        except ImportError:
            pass

    # -- lifecycle ----------------------------------------------------------

    async def close(self) -> None:
        """No persistent connection; matches singleton pattern."""
        logger.info("FredClient closed")

    # -- rate limiter -------------------------------------------------------

    async def _wait_for_rate_limit(self) -> None:
        """Block until a request slot is available (sliding 60-s window)."""
        async with self._rate_lock:
            now = time.monotonic()
            while self._rate_timestamps and self._rate_timestamps[0] < now - 60:
                self._rate_timestamps.popleft()
            if len(self._rate_timestamps) >= self._max_per_min:
                wait = 60 - (now - self._rate_timestamps[0])
                if wait > 0:
                    logger.info(
                        "FRED rate limit reached, waiting %.0fms", wait * 1000
                    )
                    await asyncio.sleep(wait)
                    now = time.monotonic()
                    while (
                        self._rate_timestamps
                        and self._rate_timestamps[0] < now - 60
                    ):
                        self._rate_timestamps.popleft()
            self._rate_timestamps.append(time.monotonic())

    # -- sync fetch via asyncio.to_thread -----------------------------------

    async def _fetch_series(
        self,
        series_id: str,
        start: str | None = None,
        end: str | None = None,
    ) -> Any | None:
        """Fetch a FRED series via ``fredapi`` in a worker thread.

        Returns a ``pandas.Series`` on success or *None* on any error.
        """
        if not self._enabled or self._fred is None:
            return None
        await self._wait_for_rate_limit()

        def _sync() -> Any:
            return self._fred.get_series(
                series_id,
                observation_start=start,
                observation_end=end,
            )

        try:
            return await asyncio.to_thread(_sync)
        except (ValueError, *self._requests_exc) as exc:
            logger.warning("FRED fetch %s failed: %s", series_id, exc)
            return None
        except Exception as exc:
            logger.warning("FRED fetch %s unexpected error: %s", series_id, exc)
            return None

    # -- pandas serialization -----------------------------------------------

    @staticmethod
    def _series_to_records(series: Any) -> list[dict[str, Any]]:
        """Convert ``pandas.Series`` to ``[{"date": "YYYY-MM-DD", "value": float|None}]``."""
        import pandas as pd  # type: ignore[import-untyped]

        records: list[dict[str, Any]] = []
        for idx, val in series.items():
            date_str = idx.strftime("%Y-%m-%d")
            value = float(val) if pd.notna(val) else None
            records.append({"date": date_str, "value": value})
        return records

    @staticmethod
    def _series_to_latest(series: Any) -> dict[str, Any] | None:
        """Extract the latest non-NaN observation from a pandas Series."""
        clean = series.dropna()
        if clean.empty:
            return None
        idx = clean.index[-1]
        val = clean.iloc[-1]
        return {"date": idx.strftime("%Y-%m-%d"), "value": float(val)}

    # -- fundamentals_cache helpers -----------------------------------------

    async def _get_cached_series(
        self,
        series_id: str,
        start: str | None,
        end: str | None,
    ) -> list[dict[str, Any]] | None:
        """Return cached series records from ``fundamentals_cache`` if within TTL."""
        db = await get_database()
        period = f"{start or 'all'}_{end or 'latest'}"
        row = await db.fetch_one(
            "SELECT value_json, fetched_at FROM fundamentals_cache "
            "WHERE symbol = ? AND data_type = 'fred_series' AND period = ? "
            "AND source = 'fred'",
            (series_id, period),
        )
        if row is None:
            return None
        try:
            fetched_dt = datetime.fromisoformat(row["fetched_at"])
            if fetched_dt.tzinfo is None:
                fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
            if age > self._cache_ttl_fundamentals:
                return None
        except (ValueError, TypeError):
            return None
        try:
            return json.loads(row["value_json"])
        except (json.JSONDecodeError, TypeError):
            return None

    async def _store_series_cache(
        self,
        series_id: str,
        start: str | None,
        end: str | None,
        records: list[dict[str, Any]],
    ) -> None:
        """Upsert series records into ``fundamentals_cache``."""
        db = await get_database()
        period = f"{start or 'all'}_{end or 'latest'}"
        await db.execute(
            "INSERT OR REPLACE INTO fundamentals_cache "
            "(symbol, data_type, period, value_json, source, fetched_at) "
            "VALUES (?, 'fred_series', ?, ?, 'fred', ?)",
            (series_id, period, json.dumps(records), _now_iso()),
        )

    # -- macro_events cache helpers -----------------------------------------

    async def _get_cached_macro(
        self, indicator: str
    ) -> dict[str, Any] | None:
        """Return cached latest value from ``macro_events`` if within TTL."""
        db = await get_database()
        row = await db.fetch_one(
            "SELECT event_name, event_date, actual_value, previous_value, "
            "fetched_at FROM macro_events "
            "WHERE event_name = ? AND source = 'fred' "
            "ORDER BY event_date DESC LIMIT 1",
            (indicator,),
        )
        if row is None:
            return None
        try:
            fetched_dt = datetime.fromisoformat(row["fetched_at"])
            if fetched_dt.tzinfo is None:
                fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
            if age > self._cache_ttl_macro:
                return None
        except (ValueError, TypeError):
            return None
        return dict(row)

    async def _store_macro(
        self,
        indicator: str,
        date: str,
        value: float | None,
        previous: float | None = None,
    ) -> None:
        """Upsert a latest-value record into ``macro_events``."""
        db = await get_database()
        await db.execute(
            "INSERT OR REPLACE INTO macro_events "
            "(event_name, event_date, actual_value, previous_value, "
            "impact, source, fetched_at) "
            "VALUES (?, ?, ?, ?, 'medium', 'fred', ?)",
            (indicator, date, value, previous, _now_iso()),
        )

    # ======================================================================
    # Public API
    # ======================================================================

    async def get_series(
        self,
        indicator: str,
        start: str | None = None,
        end: str | None = None,
    ) -> list[dict[str, Any]] | None:
        """Fetch a FRED time series by indicator name.

        Parameters
        ----------
        indicator
            Key from :data:`FRED_SERIES` (e.g. ``"gdp"``, ``"cpi_headline"``).
        start, end
            Optional date strings ``YYYY-MM-DD`` to bound the observation range.

        Returns a list of ``{"date": str, "value": float|None}`` dicts, or
        *None* on failure.
        """
        series_id = FRED_SERIES.get(indicator)
        if series_id is None:
            logger.warning("Unknown FRED indicator: %s", indicator)
            return None

        # Check cache
        cached = await self._get_cached_series(series_id, start, end)
        if cached is not None:
            return _tag(cached, cached=True)  # type: ignore[return-value]

        # Fetch fresh
        raw_series = await self._fetch_series(series_id, start=start, end=end)
        if raw_series is None:
            return None

        try:
            records = self._series_to_records(raw_series)
        except Exception as exc:
            logger.warning(
                "FRED series conversion failed for %s: %s", series_id, exc
            )
            return None

        if not records:
            return None

        # Store cache
        await self._store_series_cache(series_id, start, end, records)
        return _tag(records)  # type: ignore[return-value]

    async def get_latest(
        self, indicator: str
    ) -> dict[str, Any] | None:
        """Fetch the latest observation for a FRED indicator.

        Returns a dict with ``indicator``, ``series_id``, ``date``, ``value``,
        ``previous_value``, and metadata tags, or *None* on failure.
        """
        series_id = FRED_SERIES.get(indicator)
        if series_id is None:
            logger.warning("Unknown FRED indicator: %s", indicator)
            return None

        # Check macro cache
        cached = await self._get_cached_macro(indicator)
        if cached is not None:
            result: dict[str, Any] = {
                "indicator": indicator,
                "series_id": series_id,
                "date": cached.get("event_date"),
                "value": cached.get("actual_value"),
                "previous_value": cached.get("previous_value"),
            }
            return _tag(result, cached=True)  # type: ignore[return-value]

        # Fetch fresh
        raw_series = await self._fetch_series(series_id)
        if raw_series is None:
            return None

        try:
            latest = self._series_to_latest(raw_series)
        except Exception as exc:
            logger.warning(
                "FRED latest extraction failed for %s: %s", series_id, exc
            )
            return None

        if latest is None:
            return None

        # Extract previous value (second-to-last non-NaN observation)
        previous_value: float | None = None
        try:
            clean = raw_series.dropna()
            if len(clean) >= 2:
                previous_value = float(clean.iloc[-2])
        except Exception:
            pass

        # Store macro cache
        await self._store_macro(
            indicator, latest["date"], latest["value"], previous_value
        )

        result = {
            "indicator": indicator,
            "series_id": series_id,
            "date": latest["date"],
            "value": latest["value"],
            "previous_value": previous_value,
        }
        return _tag(result)  # type: ignore[return-value]

    async def get_macro_dashboard(
        self, indicators: list[str] | None = None
    ) -> dict[str, dict[str, Any] | None]:
        """Fetch the latest values for multiple indicators.

        Parameters
        ----------
        indicators
            List of indicator keys from :data:`FRED_SERIES`.  Defaults to
            all 18 indicators when *None*.

        Returns a mapping of ``indicator -> result_dict | None``.
        """
        if indicators is None:
            indicators = list(FRED_SERIES.keys())

        dashboard: dict[str, dict[str, Any] | None] = {}
        for indicator in indicators:
            if indicator not in FRED_SERIES:
                logger.warning(
                    "Skipping unknown indicator in dashboard: %s", indicator
                )
                dashboard[indicator] = None
                continue
            try:
                dashboard[indicator] = await self.get_latest(indicator)
            except Exception as exc:
                logger.warning(
                    "FRED dashboard fetch failed for %s: %s", indicator, exc
                )
                dashboard[indicator] = None
        return dashboard

    async def get_indicator_history(
        self,
        indicator: str,
        start: str | None = None,
        end: str | None = None,
    ) -> list[dict[str, Any]] | None:
        """Fetch historical observations for a FRED indicator.

        Convenience alias that delegates to :meth:`get_series`.
        """
        return await self.get_series(indicator, start=start, end=end)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: FredClient | None = None


def get_fred_client() -> FredClient:
    """Return the singleton :class:`FredClient`, creating it on first call."""
    global _client
    if _client is None:
        _client = FredClient()
    return _client


async def close_fred_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
