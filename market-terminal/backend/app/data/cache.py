"""Centralized cache layer for Market Terminal.

Provides :class:`CacheManager`, a unified cache-through facade that sits
between API route handlers and the individual data clients (Finnhub, EDGAR,
FRED, yfinance, CFTC).  Features:

* TTL-based expiration per data type (8 types)
* Data freshness tracking via :class:`~app.data.cache_types.CachedResult`
* Source fallback chains (e.g. Finnhub → yfinance for price)
* Per-key ``asyncio.Lock`` to prevent duplicate concurrent fetches
* Cache invalidation per symbol / data type
* In-memory hit/miss statistics
* Background refresh for stale data (stale-while-revalidate)

Full implementation: TASK-DATA-008
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from app.data.cache_types import (
    DATA_TYPES,
    FALLBACK_CHAINS,
    CachedResult,
    format_age,
)

logger = logging.getLogger(__name__)

_MAX_BG_TASKS = 10


# ---------------------------------------------------------------------------
# TTL map (lazy, built once from Settings)
# ---------------------------------------------------------------------------
_ttl_map: dict[str, int] | None = None


def _get_ttl_map() -> dict[str, int]:
    global _ttl_map
    if _ttl_map is None:
        from app.config import get_settings
        s = get_settings()
        _ttl_map = {
            "price":        s.cache_ttl_price,
            "fundamentals": s.cache_ttl_fundamentals,
            "news":         s.cache_ttl_news,
            "macro":        s.cache_ttl_macro,
            "cot":          s.cache_ttl_cot,
            "ownership":    s.cache_ttl_ownership,
            "insider":      s.cache_ttl_insider,
            "analysis":     s.cache_ttl_analysis,
            "options":      s.cache_ttl_options,
            "economic_calendar": s.cache_ttl_economic_calendar,
        }
    return _ttl_map


# ---------------------------------------------------------------------------
# CacheManager
# ---------------------------------------------------------------------------
class CacheManager:
    """Unified cache-through facade for all Market Terminal data sources."""

    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}
        self._bg_tasks: set[asyncio.Task[None]] = set()
        self._stats: dict[str, int] = defaultdict(int)
        logger.info("CacheManager initialized")

    # -- lifecycle ----------------------------------------------------------

    async def close(self) -> None:
        """Cancel background tasks and clear state."""
        for task in self._bg_tasks:
            if not task.done():
                task.cancel()
        if self._bg_tasks:
            await asyncio.gather(*self._bg_tasks, return_exceptions=True)
        n = len(self._bg_tasks)
        self._bg_tasks.clear()
        self._locks.clear()
        self._stats.clear()
        logger.info("CacheManager closed (%d bg tasks cancelled)", n)

    # -- lock management ----------------------------------------------------

    def _get_lock(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    # -- cache key helpers --------------------------------------------------

    @staticmethod
    def _make_key(data_type: str, symbol: str, period: str = "latest") -> str:
        return f"{data_type}:{symbol.upper()}:{period}"

    # -- DB helpers ---------------------------------------------------------

    async def _read_cache(
        self, symbol: str, data_type: str, period: str,
    ) -> tuple[Any, str, float] | None:
        """Read from ``fundamentals_cache``.

        Returns ``(data, fetched_at_iso, age_seconds)`` or *None*.
        """
        from app.data.database import get_database
        db = await get_database()
        row = await db.fetch_one(
            "SELECT value_json, source, fetched_at FROM fundamentals_cache "
            "WHERE symbol = ? AND data_type = ? AND period = ? "
            "ORDER BY fetched_at DESC LIMIT 1",
            (symbol.upper(), data_type, period),
        )
        if row is None:
            return None
        try:
            data = json.loads(row["value_json"])
        except (json.JSONDecodeError, TypeError):
            return None
        fetched_at = row["fetched_at"]
        try:
            dt = datetime.fromisoformat(fetched_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - dt).total_seconds()
        except (ValueError, TypeError):
            age = 0.0
        return data, fetched_at, max(age, 0.0)

    async def _write_cache(
        self,
        symbol: str,
        data_type: str,
        period: str,
        source: str,
        data: Any,
    ) -> None:
        """Upsert into ``fundamentals_cache``."""
        from app.data.database import get_database
        db = await get_database()
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT OR REPLACE INTO fundamentals_cache "
            "(symbol, data_type, period, value_json, source, fetched_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (symbol.upper(), data_type, period, json.dumps(data), source, now),
        )

    async def _delete_cache(
        self, symbol: str, data_type: str | None = None,
    ) -> int:
        """Delete cache entries.  Returns row count deleted."""
        from app.data.database import get_database
        db = await get_database()
        if data_type:
            cur = await db.execute(
                "DELETE FROM fundamentals_cache "
                "WHERE symbol = ? AND data_type = ?",
                (symbol.upper(), data_type),
            )
        else:
            cur = await db.execute(
                "DELETE FROM fundamentals_cache WHERE symbol = ?",
                (symbol.upper(),),
            )
        return cur.rowcount

    # -- result builder -----------------------------------------------------

    @staticmethod
    def _build_result(
        data: Any,
        data_type: str,
        symbol: str,
        period: str,
        source: str,
        is_cached: bool,
        is_stale: bool,
        fetched_at: str,
        age: float,
        ttl: int,
    ) -> CachedResult:
        try:
            dt = datetime.fromisoformat(fetched_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            expires_dt = dt + timedelta(seconds=ttl)
            expires_at = expires_dt.isoformat()
        except (ValueError, TypeError):
            expires_at = ""
        return CachedResult(
            data=data,
            data_type=data_type,
            cache_key=CacheManager._make_key(data_type, symbol, period),
            source=source,
            is_cached=is_cached,
            is_stale=is_stale,
            fetched_at=fetched_at,
            cache_age_seconds=round(age, 1),
            cache_age_human=format_age(age),
            ttl_seconds=ttl,
            expires_at=expires_at,
        )

    # -- background refresh -------------------------------------------------

    def _schedule_bg_refresh(
        self,
        data_type: str,
        symbol: str,
        period: str,
        fetch_kwargs: dict[str, Any] | None = None,
    ) -> bool:
        self._bg_tasks = {t for t in self._bg_tasks if not t.done()}
        if len(self._bg_tasks) >= _MAX_BG_TASKS:
            return False

        async def _do_refresh() -> None:
            try:
                sources = FALLBACK_CHAINS.get(data_type, [])
                for src in sources:
                    result = await self._fetch_from_source(
                        data_type, symbol, period, src, **(fetch_kwargs or {}),
                    )
                    if result is not None:
                        await self._write_cache(symbol, data_type, period, src, result)
                        self._stats["bg_refreshes"] += 1
                        logger.debug(
                            "Background refresh: %s:%s from %s", data_type, symbol, src,
                        )
                        return
            except Exception:
                logger.debug("Background refresh failed: %s:%s", data_type, symbol, exc_info=True)

        task = asyncio.create_task(_do_refresh())
        self._bg_tasks.add(task)
        task.add_done_callback(self._bg_tasks.discard)
        return True

    # -- source dispatch ----------------------------------------------------

    async def _fetch_from_source(
        self,
        data_type: str,
        symbol: str,
        period: str,
        source: str,
        **kwargs: Any,
    ) -> Any | None:
        """Dispatch to the correct client method.  Never raises."""
        try:
            return await self._dispatch(data_type, symbol, period, source, **kwargs)
        except Exception as exc:
            logger.warning(
                "Cache fetch error %s:%s from %s: %s", data_type, symbol, source, exc,
            )
            return None

    async def _dispatch(
        self,
        data_type: str,
        symbol: str,
        period: str,
        source: str,
        **kwargs: Any,
    ) -> Any | None:
        if data_type == "price" and source == "finnhub":
            from app.data.finnhub_client import get_finnhub_client
            return await get_finnhub_client().get_quote(symbol)

        if data_type == "price" and source == "yfinance":
            from app.data.yfinance_client import get_yfinance_client
            return await get_yfinance_client().get_quote(symbol)

        if data_type == "fundamentals" and source == "edgar":
            from app.data.fundamentals_service import get_fundamentals_data
            return await get_fundamentals_data(symbol)

        if data_type == "fundamentals" and source == "yfinance":
            from app.data.yfinance_client import get_yfinance_client
            return await get_yfinance_client().get_info(symbol)

        if data_type == "news" and source == "finnhub":
            from app.data.finnhub_client import get_finnhub_client
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            week_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
            return await get_finnhub_client().get_company_news(symbol, week_ago, today)

        if data_type == "macro" and source == "fred":
            from app.data.fred_client import get_fred_client
            return await get_fred_client().get_latest(symbol)

        if data_type == "cot" and source == "cftc":
            from app.data.cot_client import get_cot_client
            return await get_cot_client().get_market_summary(symbol)

        if data_type == "ownership" and source == "edgar":
            from app.data.edgar_ownership import get_ownership_client
            return await get_ownership_client().get_institutional_holders(symbol)

        if data_type == "insider" and source == "edgar":
            from app.data.edgar_ownership import get_ownership_client
            days = kwargs.get("days", 365)
            return await get_ownership_client().get_insider_transactions(symbol, days=days)

        if data_type == "options" and source == "massive":
            from app.data.massive_client import get_massive_client
            return await get_massive_client().get_options_chain(
                symbol,
                expiration_gte=kwargs.get("expiration_gte"),
                expiration_lte=kwargs.get("expiration_lte"),
                strike_gte=kwargs.get("strike_gte"),
                strike_lte=kwargs.get("strike_lte"),
                contract_type=kwargs.get("contract_type"),
            )

        if data_type == "economic_calendar" and source == "forex_calendar":
            from app.data.forex_calendar_client import get_forex_calendar_client
            client = get_forex_calendar_client()
            if period == "weekly":
                return await client.get_weekly_calendar()
            if period == "today":
                return await client.get_today_events()
            if period == "history":
                return await client.get_event_history(kwargs.get("event_id", ""))
            if period == "predictions":
                return await client.get_predictions()
            return None
            
        if data_type == "economic_calendar" and source == "finnhub":
            from app.data.finnhub_client import get_finnhub_client
            client = get_finnhub_client()
            if period in ("weekly", "today"):
                return await client.get_economic_calendar()
            return None

        logger.warning("No dispatch for %s:%s", data_type, source)
        return None

    # ======================================================================
    # Core cache-through
    # ======================================================================

    async def get_or_fetch(
        self,
        data_type: str,
        symbol: str,
        period: str = "latest",
        *,
        force_refresh: bool = False,
        fetch_fn: Callable[..., Awaitable[Any]] | None = None,
        fetch_kwargs: dict[str, Any] | None = None,
        source_override: str | None = None,
    ) -> CachedResult | None:
        """Universal cache-through method.

        1. Check cache — return if fresh
        2. If stale — return stale + schedule background refresh
        3. On miss or force_refresh — walk fallback chain
        4. Store result and return
        5. All sources fail — return None
        """
        symbol = symbol.upper()
        ttl = _get_ttl_map().get(data_type, 3600)
        cache_key = self._make_key(data_type, symbol, period)
        lock = self._get_lock(cache_key)

        async with lock:
            # --- cache check ---
            if not force_refresh:
                cached = await self._read_cache(symbol, data_type, period)
                if cached is not None:
                    data, fetched_at, age = cached
                    if age <= ttl:
                        self._stats["hits"] += 1
                        logger.debug("Cache HIT %s (%.0fs old)", cache_key, age)
                        return self._build_result(
                            data, data_type, symbol, period, "cache",
                            is_cached=True, is_stale=False,
                            fetched_at=fetched_at, age=age, ttl=ttl,
                        )
                    # stale — return immediately, refresh in background
                    self._stats["stale_hits"] += 1
                    bg = self._schedule_bg_refresh(
                        data_type, symbol, period, fetch_kwargs,
                    )
                    logger.debug("Cache STALE %s (%.0fs old, bg=%s)", cache_key, age, bg)
                    return self._build_result(
                        data, data_type, symbol, period, "cache",
                        is_cached=True, is_stale=True,
                        fetched_at=fetched_at, age=age, ttl=ttl,
                    )

            # --- fetch from sources ---
            self._stats["misses"] += 1
            now_iso = datetime.now(timezone.utc).isoformat()

            # direct fetch_fn override
            if fetch_fn is not None:
                try:
                    result_data = await fetch_fn(**(fetch_kwargs or {}))
                except Exception as exc:
                    logger.warning("Direct fetch failed for %s: %s", cache_key, exc)
                    result_data = None
                if result_data is not None:
                    src = source_override or "custom"
                    await self._write_cache(symbol, data_type, period, src, result_data)
                    self._stats["fetches"] += 1
                    return self._build_result(
                        result_data, data_type, symbol, period, src,
                        is_cached=False, is_stale=False,
                        fetched_at=now_iso, age=0.0, ttl=ttl,
                    )
                return None

            # walk fallback chain
            sources = (
                [source_override] if source_override
                else FALLBACK_CHAINS.get(data_type, [])
            )
            for src in sources:
                start = time.monotonic()
                result_data = await self._fetch_from_source(
                    data_type, symbol, period, src, **(fetch_kwargs or {}),
                )
                elapsed_ms = (time.monotonic() - start) * 1000
                if result_data is not None:
                    await self._write_cache(symbol, data_type, period, src, result_data)
                    self._stats["fetches"] += 1
                    logger.info(
                        "Cache MISS %s -> %s (%.0fms)", cache_key, src, elapsed_ms,
                    )
                    return self._build_result(
                        result_data, data_type, symbol, period, src,
                        is_cached=False, is_stale=False,
                        fetched_at=now_iso, age=0.0, ttl=ttl,
                    )
                self._stats["source_failures"] += 1
                logger.info(
                    "Source %s failed for %s (%.0fms), trying next",
                    src, cache_key, elapsed_ms,
                )

            self._stats["total_failures"] += 1
            logger.warning("All sources failed for %s", cache_key)
            return None

    # ======================================================================
    # Public convenience methods
    # ======================================================================

    async def get_price(
        self, symbol: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Current price quote.  Chain: finnhub → yfinance.  TTL: 15m."""
        return await self.get_or_fetch("price", symbol, force_refresh=force_refresh)

    async def get_historical_prices(
        self,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
        *,
        force_refresh: bool = False,
    ) -> CachedResult | None:
        """Historical OHLCV bars from yfinance.  TTL: 15m."""
        from app.data.yfinance_client import get_yfinance_client
        return await self.get_or_fetch(
            "price", symbol, f"hist_{period}_{interval}",
            force_refresh=force_refresh,
            fetch_fn=get_yfinance_client().get_historical,
            fetch_kwargs={"symbol": symbol, "period": period, "interval": interval},
            source_override="yfinance",
        )

    async def get_fundamentals(
        self, symbol: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Key financial metrics.  Chain: edgar → yfinance.  TTL: 24h."""
        return await self.get_or_fetch("fundamentals", symbol, force_refresh=force_refresh)

    async def get_income_statement(
        self, symbol: str, periods: int = 8, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Income statement from EDGAR.  TTL: 24h."""
        from app.data.edgar_client import get_edgar_client
        return await self.get_or_fetch(
            "fundamentals", symbol, "income_statement",
            force_refresh=force_refresh,
            fetch_fn=get_edgar_client().get_income_statement,
            fetch_kwargs={"symbol": symbol, "periods": periods},
            source_override="edgar",
        )

    async def get_balance_sheet(
        self, symbol: str, periods: int = 8, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Balance sheet from EDGAR.  TTL: 24h."""
        from app.data.edgar_client import get_edgar_client
        return await self.get_or_fetch(
            "fundamentals", symbol, "balance_sheet",
            force_refresh=force_refresh,
            fetch_fn=get_edgar_client().get_balance_sheet,
            fetch_kwargs={"symbol": symbol, "periods": periods},
            source_override="edgar",
        )

    async def get_news(
        self, symbol: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Company news from Finnhub.  TTL: 1h."""
        return await self.get_or_fetch("news", symbol, force_refresh=force_refresh)

    async def get_institutional_holders(
        self, symbol: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """13F institutional ownership from EDGAR.  TTL: 24h."""
        return await self.get_or_fetch("ownership", symbol, force_refresh=force_refresh)

    async def get_insider_transactions(
        self, symbol: str, days: int = 365, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Form 4 insider transactions from EDGAR.  TTL: 4h."""
        return await self.get_or_fetch(
            "insider", symbol, force_refresh=force_refresh,
            fetch_kwargs={"days": days},
        )

    async def get_macro_indicator(
        self, indicator: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Latest macro indicator from FRED.  TTL: 12h."""
        return await self.get_or_fetch("macro", indicator, force_refresh=force_refresh)

    async def get_macro_calendar(
        self, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """Economic calendar from Finnhub.  TTL: 12h."""
        from app.data.finnhub_client import get_finnhub_client
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        week_ahead = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
        return await self.get_or_fetch(
            "macro", "_calendar", "upcoming",
            force_refresh=force_refresh,
            fetch_fn=get_finnhub_client().get_economic_calendar,
            fetch_kwargs={"from_date": today, "to_date": week_ahead},
            source_override="finnhub",
        )

    async def get_cot_data(
        self, symbol: str, *, force_refresh: bool = False,
    ) -> CachedResult | None:
        """COT positioning from CFTC.  TTL: 7d."""
        return await self.get_or_fetch("cot", symbol, force_refresh=force_refresh)

    # ======================================================================
    # Invalidation
    # ======================================================================

    async def invalidate(self, symbol: str, data_type: str | None = None) -> None:
        """Remove cache entries for *symbol* (optionally scoped to *data_type*)."""
        deleted = await self._delete_cache(symbol, data_type)
        logger.info("Invalidated %d entries for %s (type=%s)", deleted, symbol, data_type)

    async def invalidate_on_corporate_action(
        self, symbol: str, action_type: str,
    ) -> None:
        """Invalidate after corporate action (split, merger, earnings, etc.)."""
        await self._delete_cache(symbol)
        logger.info("Invalidated all cache for %s (corporate action: %s)", symbol, action_type)

    async def invalidate_all(self) -> None:
        """Clear ALL cached data.  Use for debugging/maintenance only."""
        from app.data.database import get_database
        db = await get_database()
        await db.execute("DELETE FROM fundamentals_cache WHERE 1=1")
        logger.warning("Invalidated ALL cache entries")

    # ======================================================================
    # Statistics & freshness
    # ======================================================================

    def get_stats(self) -> dict[str, Any]:
        """Return cache statistics snapshot."""
        total = self._stats.get("hits", 0) + self._stats.get("misses", 0)
        return {
            "total_hits": self._stats.get("hits", 0),
            "total_misses": self._stats.get("misses", 0),
            "stale_hits": self._stats.get("stale_hits", 0),
            "hit_rate": self._stats["hits"] / total if total > 0 else 0.0,
            "total_fetches": self._stats.get("fetches", 0),
            "source_failures": self._stats.get("source_failures", 0),
            "total_failures": self._stats.get("total_failures", 0),
            "bg_refreshes": self._stats.get("bg_refreshes", 0),
            "active_bg_tasks": len({t for t in self._bg_tasks if not t.done()}),
        }

    async def get_freshness(self, symbol: str) -> dict[str, Any]:
        """Per-data-type freshness report for *symbol*."""
        symbol = symbol.upper()
        ttl_map = _get_ttl_map()
        result: dict[str, Any] = {"symbol": symbol, "data_types": {}}
        for dt in DATA_TYPES:
            cached = await self._read_cache(symbol, dt, "latest")
            if cached is None:
                result["data_types"][dt] = {"cached": False}
            else:
                _, fetched_at, age = cached
                ttl = ttl_map.get(dt, 3600)
                result["data_types"][dt] = {
                    "cached": True,
                    "age_seconds": round(age, 1),
                    "age_human": format_age(age),
                    "is_stale": age > ttl,
                    "fetched_at": fetched_at,
                }
        return result

    # ======================================================================
    # Background refresh for watchlist
    # ======================================================================

    async def schedule_watchlist_refresh(self, symbols: list[str]) -> None:
        """Refresh price data for watchlist symbols with staggered delays."""
        for sym in symbols:
            await self.get_price(sym, force_refresh=True)
            await asyncio.sleep(1.0)  # stagger to respect rate limits

    async def refresh_symbol(self, symbol: str) -> dict[str, str]:
        """Force-refresh all data types for a symbol."""
        results: dict[str, str] = {}
        for dt, method in [
            ("price", self.get_price),
            ("fundamentals", self.get_fundamentals),
            ("news", self.get_news),
            ("ownership", self.get_institutional_holders),
            ("insider", self.get_insider_transactions),
            ("cot", self.get_cot_data),
        ]:
            try:
                r = await method(symbol, force_refresh=True)
                results[dt] = "refreshed" if r is not None else "failed"
            except Exception:
                results[dt] = "error"
        return results


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_manager: CacheManager | None = None


def get_cache_manager() -> CacheManager:
    """Return the singleton :class:`CacheManager`, creating on first call."""
    global _manager
    if _manager is None:
        _manager = CacheManager()
    return _manager


async def close_cache_manager() -> None:
    """Close the singleton CacheManager and clear the reference."""
    global _manager
    if _manager is not None:
        await _manager.close()
        _manager = None
