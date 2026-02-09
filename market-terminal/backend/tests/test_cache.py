"""Tests for TASK-DATA-008: Cache Layer (CacheManager).

Validates CacheManager TTL map, key building, DB read/write/delete helpers,
result building, get_or_fetch cache-through logic (fresh hit, stale hit,
cache miss, fallback chains, force refresh, custom fetch_fn, all-sources-fail),
background refresh scheduling, dispatch routing to all data clients,
11 convenience methods, invalidation, statistics, freshness reporting,
watchlist refresh, module-level singleton lifecycle, and close/cleanup.

ALL database and client calls are mocked -- no real DB or API requests are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_cache.py -v``
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

import app.data.cache as cache_mod
from app.data.cache import (
    CacheManager,
    _get_ttl_map,
    _MAX_BG_TASKS,
    get_cache_manager,
    close_cache_manager,
)
from app.data.cache_types import CachedResult, FALLBACK_CHAINS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """Return current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def _past_iso(seconds: int) -> str:
    """Return ISO timestamp *seconds* in the past."""
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()


def _mock_settings():
    """Return a MagicMock with all required cache_ttl_* fields."""
    s = MagicMock()
    s.cache_ttl_price = 900
    s.cache_ttl_fundamentals = 86400
    s.cache_ttl_news = 3600
    s.cache_ttl_macro = 43200
    s.cache_ttl_cot = 604800
    s.cache_ttl_ownership = 86400
    s.cache_ttl_insider = 14400
    s.cache_ttl_analysis = 3600
    return s


def _mock_db():
    """Return an AsyncMock database with fetch_one/fetch_all/execute."""
    db = AsyncMock()
    db.fetch_one = AsyncMock(return_value=None)
    db.fetch_all = AsyncMock(return_value=[])
    cur = MagicMock()
    cur.rowcount = 0
    db.execute = AsyncMock(return_value=cur)
    return db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singletons():
    """Reset module-level singletons before and after each test."""
    cache_mod._ttl_map = None
    cache_mod._manager = None
    yield
    cache_mod._ttl_map = None
    cache_mod._manager = None


@pytest.fixture
def mock_settings():
    return _mock_settings()


@pytest.fixture
def mock_db():
    return _mock_db()


@pytest.fixture
def manager():
    """Return a fresh CacheManager."""
    return CacheManager()


@pytest.fixture
def patched_db(mock_db):
    """Patch get_database to return mock_db for every import."""
    with patch("app.data.database.get_database", new_callable=AsyncMock, return_value=mock_db):
        yield mock_db


@pytest.fixture
def patched_settings(mock_settings):
    """Patch get_settings for TTL map building."""
    with patch("app.config.get_settings", return_value=mock_settings):
        yield mock_settings


# ===================================================================
# 1. TTL Map
# ===================================================================
class TestTtlMap:
    """_get_ttl_map() lazy singleton."""

    def test_builds_from_settings(self, mock_settings):
        """TTL map is built from Settings fields."""
        with patch("app.config.get_settings", return_value=mock_settings):
            result = _get_ttl_map()
        assert result["price"] == 900
        assert result["fundamentals"] == 86400
        assert result["news"] == 3600
        assert result["macro"] == 43200
        assert result["cot"] == 604800
        assert result["ownership"] == 86400
        assert result["insider"] == 14400
        assert result["analysis"] == 3600

    def test_all_eight_data_types_present(self, mock_settings):
        """TTL map has all 8 data types."""
        with patch("app.config.get_settings", return_value=mock_settings):
            result = _get_ttl_map()
        expected = {"price", "fundamentals", "news", "macro", "cot", "ownership", "insider", "analysis"}
        assert set(result.keys()) == expected

    def test_lazy_singleton_called_once(self, mock_settings):
        """Settings are read only once (lazy singleton)."""
        with patch("app.config.get_settings", return_value=mock_settings) as gs:
            _get_ttl_map()
            _get_ttl_map()
            gs.assert_called_once()


# ===================================================================
# 2. _make_key
# ===================================================================
class TestMakeKey:
    """CacheManager._make_key static key builder."""

    def test_normal_key(self):
        """Builds 'data_type:SYMBOL:period'."""
        assert CacheManager._make_key("price", "AAPL", "latest") == "price:AAPL:latest"

    def test_uppercases_symbol(self):
        """Symbol is uppercased in the key."""
        assert CacheManager._make_key("price", "aapl", "latest") == "price:AAPL:latest"

    def test_custom_period(self):
        """Custom period is included in the key."""
        assert CacheManager._make_key("price", "AAPL", "hist_1y_1d") == "price:AAPL:hist_1y_1d"

    def test_default_period(self):
        """Default period is 'latest'."""
        assert CacheManager._make_key("fundamentals", "MSFT") == "fundamentals:MSFT:latest"


# ===================================================================
# 3. _read_cache
# ===================================================================
class TestReadCache:
    """CacheManager._read_cache DB read helper."""

    @pytest.mark.asyncio
    async def test_returns_none_when_no_row(self, manager, patched_db):
        """Returns None when fetch_one returns None."""
        patched_db.fetch_one.return_value = None
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is None

    @pytest.mark.asyncio
    async def test_parses_value_json(self, manager, patched_db):
        """Parses value_json from the row correctly."""
        patched_db.fetch_one.return_value = {
            "value_json": json.dumps({"current_price": 150.0}),
            "source": "finnhub",
            "fetched_at": _now_iso(),
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is not None
        data, fetched_at, age = result
        assert data == {"current_price": 150.0}

    @pytest.mark.asyncio
    async def test_calculates_age(self, manager, patched_db):
        """Age is calculated from fetched_at to now."""
        patched_db.fetch_one.return_value = {
            "value_json": json.dumps({"v": 1}),
            "source": "cache",
            "fetched_at": _past_iso(120),
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is not None
        _, _, age = result
        assert age >= 119  # allow small timing slack
        assert age < 125

    @pytest.mark.asyncio
    async def test_handles_invalid_json(self, manager, patched_db):
        """Returns None on invalid JSON in value_json."""
        patched_db.fetch_one.return_value = {
            "value_json": "NOT JSON {{",
            "source": "cache",
            "fetched_at": _now_iso(),
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is None

    @pytest.mark.asyncio
    async def test_handles_missing_tzinfo(self, manager, patched_db):
        """Handles fetched_at without timezone info by assuming UTC."""
        naive_ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        patched_db.fetch_one.return_value = {
            "value_json": json.dumps({"v": 1}),
            "source": "cache",
            "fetched_at": naive_ts,
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is not None
        _, _, age = result
        assert age >= 0

    @pytest.mark.asyncio
    async def test_handles_invalid_fetched_at(self, manager, patched_db):
        """Age defaults to 0 on invalid fetched_at."""
        patched_db.fetch_one.return_value = {
            "value_json": json.dumps({"v": 1}),
            "source": "cache",
            "fetched_at": "not-a-date",
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is not None
        _, _, age = result
        assert age == 0.0


# ===================================================================
# 4. _write_cache
# ===================================================================
class TestWriteCache:
    """CacheManager._write_cache upsert helper."""

    @pytest.mark.asyncio
    async def test_upserts_with_correct_params(self, manager, patched_db):
        """Upserts into fundamentals_cache with correct values."""
        data = {"current_price": 150.0}
        await manager._write_cache("aapl", "price", "latest", "finnhub", data)
        patched_db.execute.assert_called_once()
        call_args = patched_db.execute.call_args
        params = call_args[0][1]
        assert params[0] == "AAPL"
        assert params[1] == "price"
        assert params[2] == "latest"
        assert json.loads(params[3]) == data
        assert params[4] == "finnhub"

    @pytest.mark.asyncio
    async def test_stores_iso_timestamp(self, manager, patched_db):
        """Stores an ISO-format timestamp in fetched_at."""
        await manager._write_cache("AAPL", "price", "latest", "finnhub", {"v": 1})
        call_args = patched_db.execute.call_args
        params = call_args[0][1]
        ts = params[5]
        # Validate ISO format
        dt = datetime.fromisoformat(ts)
        assert dt.tzinfo is not None


# ===================================================================
# 5. _delete_cache
# ===================================================================
class TestDeleteCache:
    """CacheManager._delete_cache delete helper."""

    @pytest.mark.asyncio
    async def test_with_data_type_scopes(self, manager, patched_db):
        """Deletes scoped to symbol AND data_type."""
        cur = MagicMock()
        cur.rowcount = 3
        patched_db.execute.return_value = cur
        count = await manager._delete_cache("AAPL", "price")
        assert count == 3
        sql = patched_db.execute.call_args[0][0]
        assert "data_type" in sql
        params = patched_db.execute.call_args[0][1]
        assert params == ("AAPL", "price")

    @pytest.mark.asyncio
    async def test_without_data_type_deletes_all(self, manager, patched_db):
        """Deletes all entries for symbol when data_type is None."""
        cur = MagicMock()
        cur.rowcount = 10
        patched_db.execute.return_value = cur
        count = await manager._delete_cache("aapl")
        assert count == 10
        sql = patched_db.execute.call_args[0][0]
        assert "data_type" not in sql
        params = patched_db.execute.call_args[0][1]
        assert params == ("AAPL",)


# ===================================================================
# 6. _build_result
# ===================================================================
class TestBuildResult:
    """CacheManager._build_result constructs CachedResult."""

    def test_returns_cached_result_with_all_fields(self):
        """Returns a CachedResult with all expected fields."""
        result = CacheManager._build_result(
            data={"v": 1},
            data_type="price",
            symbol="AAPL",
            period="latest",
            source="finnhub",
            is_cached=True,
            is_stale=False,
            fetched_at=_now_iso(),
            age=10.0,
            ttl=900,
        )
        assert isinstance(result, CachedResult)
        assert result.data == {"v": 1}
        assert result.data_type == "price"
        assert result.cache_key == "price:AAPL:latest"
        assert result.source == "finnhub"
        assert result.is_cached is True
        assert result.is_stale is False
        assert result.ttl_seconds == 900
        assert result.cache_age_seconds == 10.0

    def test_calculates_expires_at(self):
        """Calculates expires_at from fetched_at + ttl."""
        fetched = _past_iso(60)
        result = CacheManager._build_result(
            data={}, data_type="price", symbol="AAPL", period="latest",
            source="cache", is_cached=True, is_stale=False,
            fetched_at=fetched, age=60.0, ttl=900,
        )
        assert result.expires_at != ""
        expires_dt = datetime.fromisoformat(result.expires_at)
        fetched_dt = datetime.fromisoformat(fetched)
        diff = (expires_dt - fetched_dt).total_seconds()
        assert diff == 900

    def test_handles_invalid_fetched_at(self):
        """expires_at is empty string when fetched_at is invalid."""
        result = CacheManager._build_result(
            data={}, data_type="price", symbol="AAPL", period="latest",
            source="cache", is_cached=True, is_stale=False,
            fetched_at="garbage", age=0.0, ttl=900,
        )
        assert result.expires_at == ""


# ===================================================================
# 7. get_or_fetch
# ===================================================================
class TestGetOrFetch:
    """Core cache-through logic in CacheManager.get_or_fetch."""

    @pytest.mark.asyncio
    async def test_fresh_cache_hit(self, manager, patched_settings):
        """Fresh cache hit returns data with is_cached=True, is_stale=False, increments hits."""
        cached = ({"price": 150}, _now_iso(), 10.0)  # age=10s, ttl=900s -> fresh
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=cached):
            result = await manager.get_or_fetch("price", "AAPL")
        assert result is not None
        assert result.is_cached is True
        assert result.is_stale is False
        assert result.data == {"price": 150}
        assert manager._stats["hits"] == 1

    @pytest.mark.asyncio
    async def test_stale_cache_hit(self, manager, patched_settings):
        """Stale cache returns data with is_stale=True, schedules bg refresh, increments stale_hits."""
        cached = ({"price": 140}, _past_iso(1000), 1000.0)  # age > ttl=900
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=cached):
            with patch.object(manager, "_schedule_bg_refresh", return_value=True) as mock_bg:
                result = await manager.get_or_fetch("price", "AAPL")
        assert result is not None
        assert result.is_cached is True
        assert result.is_stale is True
        assert manager._stats["stale_hits"] == 1
        mock_bg.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_miss_walks_fallback(self, manager, patched_settings):
        """Cache miss walks fallback chain, stores result, increments misses and fetches."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value={"price": 155}):
                with patch.object(manager, "_write_cache", new_callable=AsyncMock) as mock_write:
                    result = await manager.get_or_fetch("price", "AAPL")
        assert result is not None
        assert result.is_cached is False
        assert result.is_stale is False
        assert result.data == {"price": 155}
        assert manager._stats["misses"] == 1
        assert manager._stats["fetches"] == 1
        mock_write.assert_called_once()

    @pytest.mark.asyncio
    async def test_force_refresh_skips_cache(self, manager, patched_settings):
        """force_refresh=True skips cache check and goes directly to sources."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock) as mock_read:
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value={"price": 160}):
                with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                    result = await manager.get_or_fetch("price", "AAPL", force_refresh=True)
        mock_read.assert_not_called()
        assert result is not None
        assert result.is_cached is False
        assert manager._stats["misses"] == 1

    @pytest.mark.asyncio
    async def test_custom_fetch_fn(self, manager, patched_settings):
        """Custom fetch_fn is called and result stored with source_override."""
        custom_fn = AsyncMock(return_value={"custom": True})
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock) as mock_write:
                result = await manager.get_or_fetch(
                    "price", "AAPL",
                    fetch_fn=custom_fn,
                    source_override="yfinance",
                )
        assert result is not None
        assert result.data == {"custom": True}
        assert result.source == "yfinance"
        custom_fn.assert_called_once()
        mock_write.assert_called_once()

    @pytest.mark.asyncio
    async def test_custom_fetch_fn_with_kwargs(self, manager, patched_settings):
        """Custom fetch_fn receives fetch_kwargs."""
        custom_fn = AsyncMock(return_value={"data": "ok"})
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                result = await manager.get_or_fetch(
                    "price", "AAPL",
                    fetch_fn=custom_fn,
                    fetch_kwargs={"period": "1y", "interval": "1d"},
                )
        custom_fn.assert_called_once_with(period="1y", interval="1d")
        assert result is not None

    @pytest.mark.asyncio
    async def test_custom_fetch_fn_returns_none(self, manager, patched_settings):
        """When custom fetch_fn returns None, get_or_fetch returns None."""
        custom_fn = AsyncMock(return_value=None)
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            result = await manager.get_or_fetch(
                "price", "AAPL", fetch_fn=custom_fn,
            )
        assert result is None

    @pytest.mark.asyncio
    async def test_custom_fetch_fn_raises(self, manager, patched_settings):
        """When custom fetch_fn raises, get_or_fetch returns None."""
        custom_fn = AsyncMock(side_effect=RuntimeError("boom"))
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            result = await manager.get_or_fetch(
                "price", "AAPL", fetch_fn=custom_fn,
            )
        assert result is None

    @pytest.mark.asyncio
    async def test_all_sources_fail(self, manager, patched_settings):
        """When all sources fail, returns None and increments total_failures."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value=None):
                result = await manager.get_or_fetch("price", "AAPL")
        assert result is None
        assert manager._stats["total_failures"] == 1
        # price chain has 2 sources (finnhub, yfinance), both failed
        assert manager._stats["source_failures"] == 2

    @pytest.mark.asyncio
    async def test_source_failover(self, manager, patched_settings):
        """First source fails, second succeeds."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(
                manager, "_fetch_from_source", new_callable=AsyncMock,
                side_effect=[None, {"price": 170}],
            ):
                with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                    result = await manager.get_or_fetch("price", "AAPL")
        assert result is not None
        assert result.data == {"price": 170}
        assert manager._stats["source_failures"] == 1
        assert manager._stats["fetches"] == 1

    @pytest.mark.asyncio
    async def test_source_override_limits_chain(self, manager, patched_settings):
        """source_override limits fallback chain to a single source."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(
                manager, "_fetch_from_source", new_callable=AsyncMock,
                return_value={"data": "from yfinance"},
            ) as mock_fetch:
                with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                    result = await manager.get_or_fetch(
                        "price", "AAPL", source_override="yfinance",
                    )
        assert result is not None
        # Only one source was tried
        mock_fetch.assert_called_once()
        assert "yfinance" in str(mock_fetch.call_args)

    @pytest.mark.asyncio
    async def test_per_key_locking(self, manager, patched_settings):
        """Concurrent calls for the same key serialize via per-key lock."""
        call_order = []

        async def slow_read(*a, **kw):
            call_order.append("read_start")
            await asyncio.sleep(0.05)
            call_order.append("read_end")
            return None

        with patch.object(manager, "_read_cache", side_effect=slow_read):
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value=None):
                tasks = [
                    asyncio.create_task(manager.get_or_fetch("price", "AAPL")),
                    asyncio.create_task(manager.get_or_fetch("price", "AAPL")),
                ]
                await asyncio.gather(*tasks)
        # Because of the lock, reads should interleave as: start, end, start, end
        # (not start, start, end, end)
        assert call_order[0] == "read_start"
        assert call_order[1] == "read_end"
        assert call_order[2] == "read_start"
        assert call_order[3] == "read_end"

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self, manager, patched_settings):
        """Symbol is uppercased in get_or_fetch."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None) as mock_read:
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value=None):
                await manager.get_or_fetch("price", "aapl")
        mock_read.assert_called_once_with("AAPL", "price", "latest")

    @pytest.mark.asyncio
    async def test_custom_fetch_fn_source_defaults_to_custom(self, manager, patched_settings):
        """When fetch_fn is used without source_override, source defaults to 'custom'."""
        custom_fn = AsyncMock(return_value={"data": True})
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                result = await manager.get_or_fetch(
                    "price", "AAPL", fetch_fn=custom_fn,
                )
        assert result is not None
        assert result.source == "custom"

    @pytest.mark.asyncio
    async def test_unknown_data_type_uses_default_ttl(self, manager, patched_settings):
        """Unknown data_type defaults to 3600s TTL."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value=None):
                result = await manager.get_or_fetch("unknown_type", "AAPL")
        assert result is None  # no sources
        # Verify misses counter was incremented
        assert manager._stats["misses"] == 1


# ===================================================================
# 8. Background Refresh
# ===================================================================
class TestBgRefresh:
    """CacheManager._schedule_bg_refresh background task management."""

    @pytest.mark.asyncio
    async def test_schedules_refresh_successfully(self, manager):
        """Schedules a background refresh and returns True."""
        with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value={"v": 1}):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                result = manager._schedule_bg_refresh("price", "AAPL", "latest")
        assert result is True
        assert len(manager._bg_tasks) == 1
        # Clean up
        for t in manager._bg_tasks:
            t.cancel()
        await asyncio.gather(*manager._bg_tasks, return_exceptions=True)

    @pytest.mark.asyncio
    async def test_caps_at_max_bg_tasks(self, manager):
        """Returns False when _MAX_BG_TASKS is reached."""
        # Fill with dummy never-resolving tasks
        for _ in range(_MAX_BG_TASKS):
            task = asyncio.create_task(asyncio.sleep(100))
            manager._bg_tasks.add(task)
        result = manager._schedule_bg_refresh("price", "AAPL", "latest")
        assert result is False
        # Clean up tasks
        for t in manager._bg_tasks:
            t.cancel()
        await asyncio.gather(*manager._bg_tasks, return_exceptions=True)

    @pytest.mark.asyncio
    async def test_failed_bg_refresh_does_not_crash(self, manager):
        """A failed background refresh logs but does not crash."""
        with patch.object(
            manager, "_fetch_from_source", new_callable=AsyncMock,
            side_effect=RuntimeError("network error"),
        ):
            manager._schedule_bg_refresh("price", "AAPL", "latest")
            # Wait for the task to complete
            await asyncio.sleep(0.1)
        # Should not raise, bg_tasks should be cleaned up
        remaining = {t for t in manager._bg_tasks if not t.done()}
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_done_callback_cleans_up_task_set(self, manager):
        """Done callback removes completed task from _bg_tasks."""
        with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value={"v": 1}):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                manager._schedule_bg_refresh("price", "AAPL", "latest")
                assert len(manager._bg_tasks) == 1
                # Wait for task to complete
                await asyncio.sleep(0.1)
        # After completion, done callback should have discarded the task
        remaining = {t for t in manager._bg_tasks if not t.done()}
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_bg_refresh_increments_stats(self, manager):
        """Successful bg refresh increments bg_refreshes stat."""
        with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value={"v": 1}):
            with patch.object(manager, "_write_cache", new_callable=AsyncMock):
                manager._schedule_bg_refresh("price", "AAPL", "latest")
                await asyncio.sleep(0.1)
        assert manager._stats["bg_refreshes"] == 1

    @pytest.mark.asyncio
    async def test_bg_refresh_cleans_done_tasks_before_count(self, manager):
        """Completed tasks are pruned before checking the cap."""
        # Create a done task
        done_task = asyncio.create_task(asyncio.sleep(0))
        await asyncio.sleep(0.01)  # let it complete
        manager._bg_tasks.add(done_task)

        # Should be able to add more since done ones are pruned
        with patch.object(manager, "_fetch_from_source", new_callable=AsyncMock, return_value=None):
            result = manager._schedule_bg_refresh("price", "AAPL", "latest")
        assert result is True
        # Clean up
        await asyncio.sleep(0.05)


# ===================================================================
# 9. _dispatch
# ===================================================================
class TestDispatch:
    """CacheManager._dispatch routes to correct client methods."""

    @pytest.mark.asyncio
    async def test_price_finnhub(self, manager):
        """Routes price/finnhub to FinnhubClient.get_quote."""
        mock_client = MagicMock()
        mock_client.get_quote = AsyncMock(return_value={"price": 150})
        with patch("app.data.finnhub_client.get_finnhub_client", return_value=mock_client):
            result = await manager._dispatch("price", "AAPL", "latest", "finnhub")
        assert result == {"price": 150}
        mock_client.get_quote.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_price_yfinance(self, manager):
        """Routes price/yfinance to YFinanceClient.get_quote."""
        mock_client = MagicMock()
        mock_client.get_quote = AsyncMock(return_value={"price": 151})
        with patch("app.data.yfinance_client.get_yfinance_client", return_value=mock_client):
            result = await manager._dispatch("price", "AAPL", "latest", "yfinance")
        assert result == {"price": 151}

    @pytest.mark.asyncio
    async def test_fundamentals_edgar(self, manager):
        """Routes fundamentals/edgar to EdgarClient.get_key_metrics."""
        mock_client = MagicMock()
        mock_client.get_key_metrics = AsyncMock(return_value={"pe": 25})
        with patch("app.data.edgar_client.get_edgar_client", return_value=mock_client):
            result = await manager._dispatch("fundamentals", "AAPL", "latest", "edgar")
        assert result == {"pe": 25}

    @pytest.mark.asyncio
    async def test_fundamentals_yfinance(self, manager):
        """Routes fundamentals/yfinance to YFinanceClient.get_info."""
        mock_client = MagicMock()
        mock_client.get_info = AsyncMock(return_value={"info": True})
        with patch("app.data.yfinance_client.get_yfinance_client", return_value=mock_client):
            result = await manager._dispatch("fundamentals", "AAPL", "latest", "yfinance")
        assert result == {"info": True}

    @pytest.mark.asyncio
    async def test_news_finnhub(self, manager):
        """Routes news/finnhub to FinnhubClient.get_company_news."""
        mock_client = MagicMock()
        mock_client.get_company_news = AsyncMock(return_value=[{"headline": "test"}])
        with patch("app.data.finnhub_client.get_finnhub_client", return_value=mock_client):
            result = await manager._dispatch("news", "AAPL", "latest", "finnhub")
        assert result == [{"headline": "test"}]
        mock_client.get_company_news.assert_called_once()

    @pytest.mark.asyncio
    async def test_macro_fred(self, manager):
        """Routes macro/fred to FredClient.get_latest."""
        mock_client = MagicMock()
        mock_client.get_latest = AsyncMock(return_value={"value": 3.5})
        with patch("app.data.fred_client.get_fred_client", return_value=mock_client):
            result = await manager._dispatch("macro", "GDP", "latest", "fred")
        assert result == {"value": 3.5}

    @pytest.mark.asyncio
    async def test_cot_cftc(self, manager):
        """Routes cot/cftc to CotClient.get_market_summary."""
        mock_client = MagicMock()
        mock_client.get_market_summary = AsyncMock(return_value={"cot": "data"})
        with patch("app.data.cot_client.get_cot_client", return_value=mock_client):
            result = await manager._dispatch("cot", "GLD", "latest", "cftc")
        assert result == {"cot": "data"}

    @pytest.mark.asyncio
    async def test_ownership_edgar(self, manager):
        """Routes ownership/edgar to OwnershipClient.get_institutional_holders."""
        mock_client = MagicMock()
        mock_client.get_institutional_holders = AsyncMock(return_value={"holders": []})
        with patch("app.data.edgar_ownership.get_ownership_client", return_value=mock_client):
            result = await manager._dispatch("ownership", "AAPL", "latest", "edgar")
        assert result == {"holders": []}

    @pytest.mark.asyncio
    async def test_insider_edgar(self, manager):
        """Routes insider/edgar to OwnershipClient.get_insider_transactions."""
        mock_client = MagicMock()
        mock_client.get_insider_transactions = AsyncMock(return_value={"txns": []})
        with patch("app.data.edgar_ownership.get_ownership_client", return_value=mock_client):
            result = await manager._dispatch("insider", "AAPL", "latest", "edgar", days=180)
        assert result == {"txns": []}
        mock_client.get_insider_transactions.assert_called_once_with("AAPL", days=180)

    @pytest.mark.asyncio
    async def test_insider_edgar_default_days(self, manager):
        """insider/edgar defaults to days=365."""
        mock_client = MagicMock()
        mock_client.get_insider_transactions = AsyncMock(return_value={"txns": []})
        with patch("app.data.edgar_ownership.get_ownership_client", return_value=mock_client):
            await manager._dispatch("insider", "AAPL", "latest", "edgar")
        mock_client.get_insider_transactions.assert_called_once_with("AAPL", days=365)

    @pytest.mark.asyncio
    async def test_unknown_combination_returns_none(self, manager):
        """Unknown data_type/source combination returns None."""
        result = await manager._dispatch("unknown", "AAPL", "latest", "nosource")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_from_source_catches_exception(self, manager):
        """_fetch_from_source wraps _dispatch exceptions, returns None."""
        with patch.object(manager, "_dispatch", new_callable=AsyncMock, side_effect=RuntimeError("boom")):
            result = await manager._fetch_from_source("price", "AAPL", "latest", "finnhub")
        assert result is None


# ===================================================================
# 10. Convenience Methods
# ===================================================================
class TestConvenienceMethods:
    """11 convenience methods delegate to get_or_fetch."""

    @pytest.mark.asyncio
    async def test_get_price(self, manager):
        """get_price delegates to get_or_fetch('price', ...)."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="result") as mock_gof:
            result = await manager.get_price("AAPL")
        assert result == "result"
        mock_gof.assert_called_once_with("price", "AAPL", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_price_force_refresh(self, manager):
        """get_price passes force_refresh=True."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_price("AAPL", force_refresh=True)
        mock_gof.assert_called_once_with("price", "AAPL", force_refresh=True)

    @pytest.mark.asyncio
    async def test_get_fundamentals(self, manager):
        """get_fundamentals delegates to get_or_fetch('fundamentals', ...)."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_fundamentals("MSFT")
        mock_gof.assert_called_once_with("fundamentals", "MSFT", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_news(self, manager):
        """get_news delegates to get_or_fetch('news', ...)."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_news("TSLA")
        mock_gof.assert_called_once_with("news", "TSLA", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_institutional_holders(self, manager):
        """get_institutional_holders delegates correctly."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_institutional_holders("GOOG")
        mock_gof.assert_called_once_with("ownership", "GOOG", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_insider_transactions(self, manager):
        """get_insider_transactions passes days kwarg."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_insider_transactions("AAPL", days=180)
        mock_gof.assert_called_once_with(
            "insider", "AAPL", force_refresh=False, fetch_kwargs={"days": 180},
        )

    @pytest.mark.asyncio
    async def test_get_insider_transactions_default_days(self, manager):
        """get_insider_transactions defaults to days=365."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_insider_transactions("AAPL")
        mock_gof.assert_called_once_with(
            "insider", "AAPL", force_refresh=False, fetch_kwargs={"days": 365},
        )

    @pytest.mark.asyncio
    async def test_get_macro_indicator(self, manager):
        """get_macro_indicator delegates correctly."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_macro_indicator("GDP")
        mock_gof.assert_called_once_with("macro", "GDP", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_cot_data(self, manager):
        """get_cot_data delegates correctly."""
        with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
            await manager.get_cot_data("GLD")
        mock_gof.assert_called_once_with("cot", "GLD", force_refresh=False)

    @pytest.mark.asyncio
    async def test_get_historical_prices(self, manager):
        """get_historical_prices uses fetch_fn with yfinance."""
        mock_yf = MagicMock()
        mock_yf.get_historical = AsyncMock(return_value={"bars": []})
        with patch("app.data.yfinance_client.get_yfinance_client", return_value=mock_yf):
            with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
                await manager.get_historical_prices("AAPL", "1y", "1d")
        mock_gof.assert_called_once()
        call_kwargs = mock_gof.call_args
        assert call_kwargs[0][0] == "price"
        assert call_kwargs[0][1] == "AAPL"
        assert call_kwargs[0][2] == "hist_1y_1d"
        assert call_kwargs[1]["source_override"] == "yfinance"
        assert call_kwargs[1]["fetch_fn"] is not None

    @pytest.mark.asyncio
    async def test_get_income_statement(self, manager):
        """get_income_statement uses fetch_fn with edgar."""
        mock_edgar = MagicMock()
        mock_edgar.get_income_statement = AsyncMock(return_value={"income": []})
        with patch("app.data.edgar_client.get_edgar_client", return_value=mock_edgar):
            with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
                await manager.get_income_statement("AAPL", periods=4)
        mock_gof.assert_called_once()
        call_kwargs = mock_gof.call_args
        assert call_kwargs[0][0] == "fundamentals"
        assert call_kwargs[0][2] == "income_statement"
        assert call_kwargs[1]["source_override"] == "edgar"
        assert call_kwargs[1]["fetch_kwargs"] == {"symbol": "AAPL", "periods": 4}

    @pytest.mark.asyncio
    async def test_get_balance_sheet(self, manager):
        """get_balance_sheet uses fetch_fn with edgar."""
        mock_edgar = MagicMock()
        mock_edgar.get_balance_sheet = AsyncMock(return_value={"balance": []})
        with patch("app.data.edgar_client.get_edgar_client", return_value=mock_edgar):
            with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
                await manager.get_balance_sheet("AAPL")
        mock_gof.assert_called_once()
        call_kwargs = mock_gof.call_args
        assert call_kwargs[0][0] == "fundamentals"
        assert call_kwargs[0][2] == "balance_sheet"
        assert call_kwargs[1]["source_override"] == "edgar"

    @pytest.mark.asyncio
    async def test_get_macro_calendar(self, manager):
        """get_macro_calendar uses fetch_fn with finnhub."""
        mock_fh = MagicMock()
        mock_fh.get_economic_calendar = AsyncMock(return_value=[{"event": "CPI"}])
        with patch("app.data.finnhub_client.get_finnhub_client", return_value=mock_fh):
            with patch.object(manager, "get_or_fetch", new_callable=AsyncMock, return_value="r") as mock_gof:
                await manager.get_macro_calendar()
        mock_gof.assert_called_once()
        call_kwargs = mock_gof.call_args
        assert call_kwargs[0][0] == "macro"
        assert call_kwargs[0][1] == "_calendar"
        assert call_kwargs[0][2] == "upcoming"
        assert call_kwargs[1]["source_override"] == "finnhub"


# ===================================================================
# 11. Invalidation
# ===================================================================
class TestInvalidation:
    """Cache invalidation methods."""

    @pytest.mark.asyncio
    async def test_invalidate_calls_delete_cache(self, manager):
        """invalidate calls _delete_cache with symbol."""
        with patch.object(manager, "_delete_cache", new_callable=AsyncMock, return_value=3) as mock_del:
            await manager.invalidate("AAPL")
        mock_del.assert_called_once_with("AAPL", None)

    @pytest.mark.asyncio
    async def test_invalidate_with_data_type_scopes(self, manager):
        """invalidate with data_type scopes the deletion."""
        with patch.object(manager, "_delete_cache", new_callable=AsyncMock, return_value=1) as mock_del:
            await manager.invalidate("AAPL", "price")
        mock_del.assert_called_once_with("AAPL", "price")

    @pytest.mark.asyncio
    async def test_invalidate_on_corporate_action(self, manager):
        """invalidate_on_corporate_action deletes all data for symbol."""
        with patch.object(manager, "_delete_cache", new_callable=AsyncMock, return_value=5) as mock_del:
            await manager.invalidate_on_corporate_action("AAPL", "earnings")
        mock_del.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_invalidate_all(self, manager, patched_db):
        """invalidate_all executes DELETE with 1=1."""
        await manager.invalidate_all()
        patched_db.execute.assert_called_once()
        sql = patched_db.execute.call_args[0][0]
        assert "1=1" in sql
        assert "DELETE" in sql


# ===================================================================
# 12. Statistics
# ===================================================================
class TestStats:
    """CacheManager.get_stats statistics reporting."""

    def test_fresh_manager_has_zero_stats(self, manager):
        """Fresh manager has all zero stats."""
        stats = manager.get_stats()
        assert stats["total_hits"] == 0
        assert stats["total_misses"] == 0
        assert stats["stale_hits"] == 0
        assert stats["total_fetches"] == 0
        assert stats["source_failures"] == 0
        assert stats["total_failures"] == 0
        assert stats["bg_refreshes"] == 0
        assert stats["active_bg_tasks"] == 0

    def test_stats_accumulate(self, manager):
        """Stats accumulate correctly after operations."""
        manager._stats["hits"] = 10
        manager._stats["misses"] = 5
        manager._stats["stale_hits"] = 2
        manager._stats["fetches"] = 5
        manager._stats["source_failures"] = 3
        manager._stats["total_failures"] = 1
        manager._stats["bg_refreshes"] = 2

        stats = manager.get_stats()
        assert stats["total_hits"] == 10
        assert stats["total_misses"] == 5
        assert stats["stale_hits"] == 2
        assert stats["total_fetches"] == 5
        assert stats["source_failures"] == 3
        assert stats["total_failures"] == 1
        assert stats["bg_refreshes"] == 2

    def test_hit_rate_zero_when_no_ops(self, manager):
        """hit_rate is 0.0 when there are no hits or misses."""
        stats = manager.get_stats()
        assert stats["hit_rate"] == 0.0

    def test_hit_rate_correct(self, manager):
        """hit_rate is correctly calculated."""
        manager._stats["hits"] = 8
        manager._stats["misses"] = 2
        stats = manager.get_stats()
        assert stats["hit_rate"] == 0.8

    def test_active_bg_tasks_count(self, manager):
        """active_bg_tasks counts only non-done tasks."""
        # Add a done task
        done_task = MagicMock()
        done_task.done.return_value = True
        # Add a running task
        running_task = MagicMock()
        running_task.done.return_value = False
        manager._bg_tasks = {done_task, running_task}
        stats = manager.get_stats()
        assert stats["active_bg_tasks"] == 1


# ===================================================================
# 13. Freshness
# ===================================================================
class TestFreshness:
    """CacheManager.get_freshness per-data-type freshness reporting."""

    @pytest.mark.asyncio
    async def test_returns_freshness_for_all_data_types(self, manager, patched_settings):
        """Returns freshness for all 8 data types."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            result = await manager.get_freshness("AAPL")
        assert result["symbol"] == "AAPL"
        expected_types = {"price", "fundamentals", "news", "macro", "cot", "ownership", "insider", "analysis"}
        assert set(result["data_types"].keys()) == expected_types

    @pytest.mark.asyncio
    async def test_marks_cached_vs_uncached(self, manager, patched_settings):
        """Marks data type as cached or not cached."""
        async def mock_read(symbol, data_type, period):
            if data_type == "price":
                return ({"v": 1}, _now_iso(), 10.0)
            return None

        with patch.object(manager, "_read_cache", side_effect=mock_read):
            result = await manager.get_freshness("AAPL")
        assert result["data_types"]["price"]["cached"] is True
        assert result["data_types"]["news"]["cached"] is False

    @pytest.mark.asyncio
    async def test_marks_stale_vs_fresh(self, manager, patched_settings):
        """Marks stale vs fresh based on TTL."""
        async def mock_read(symbol, data_type, period):
            if data_type == "price":
                return ({"v": 1}, _past_iso(10), 10.0)  # fresh (10s < 900s)
            if data_type == "news":
                return ({"v": 2}, _past_iso(5000), 5000.0)  # stale (5000s > 3600s)
            return None

        with patch.object(manager, "_read_cache", side_effect=mock_read):
            result = await manager.get_freshness("AAPL")
        assert result["data_types"]["price"]["is_stale"] is False
        assert result["data_types"]["news"]["is_stale"] is True

    @pytest.mark.asyncio
    async def test_freshness_uppercases_symbol(self, manager, patched_settings):
        """Symbol is uppercased."""
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=None):
            result = await manager.get_freshness("aapl")
        assert result["symbol"] == "AAPL"


# ===================================================================
# 14. Watchlist Refresh
# ===================================================================
class TestWatchlistRefresh:
    """schedule_watchlist_refresh and refresh_symbol."""

    @pytest.mark.asyncio
    async def test_schedule_watchlist_refresh(self, manager):
        """Calls get_price for each symbol."""
        with patch.object(manager, "get_price", new_callable=AsyncMock, return_value="r") as mock_gp:
            with patch("app.data.cache.asyncio.sleep", new_callable=AsyncMock):
                await manager.schedule_watchlist_refresh(["AAPL", "MSFT", "GOOG"])
        assert mock_gp.call_count == 3
        mock_gp.assert_any_call("AAPL", force_refresh=True)
        mock_gp.assert_any_call("MSFT", force_refresh=True)
        mock_gp.assert_any_call("GOOG", force_refresh=True)

    @pytest.mark.asyncio
    async def test_refresh_symbol_refreshes_all_data_types(self, manager):
        """refresh_symbol refreshes all data types for a symbol."""
        mock_result = MagicMock()
        with patch.object(manager, "get_price", new_callable=AsyncMock, return_value=mock_result):
            with patch.object(manager, "get_fundamentals", new_callable=AsyncMock, return_value=mock_result):
                with patch.object(manager, "get_news", new_callable=AsyncMock, return_value=mock_result):
                    with patch.object(manager, "get_institutional_holders", new_callable=AsyncMock, return_value=mock_result):
                        with patch.object(manager, "get_insider_transactions", new_callable=AsyncMock, return_value=mock_result):
                            with patch.object(manager, "get_cot_data", new_callable=AsyncMock, return_value=mock_result):
                                results = await manager.refresh_symbol("AAPL")
        assert results["price"] == "refreshed"
        assert results["fundamentals"] == "refreshed"
        assert results["news"] == "refreshed"
        assert results["ownership"] == "refreshed"
        assert results["insider"] == "refreshed"
        assert results["cot"] == "refreshed"

    @pytest.mark.asyncio
    async def test_refresh_symbol_handles_failure(self, manager):
        """refresh_symbol marks failed data types."""
        with patch.object(manager, "get_price", new_callable=AsyncMock, return_value=None):
            with patch.object(manager, "get_fundamentals", new_callable=AsyncMock, return_value=None):
                with patch.object(manager, "get_news", new_callable=AsyncMock, return_value=None):
                    with patch.object(manager, "get_institutional_holders", new_callable=AsyncMock, return_value=None):
                        with patch.object(manager, "get_insider_transactions", new_callable=AsyncMock, return_value=None):
                            with patch.object(manager, "get_cot_data", new_callable=AsyncMock, return_value=None):
                                results = await manager.refresh_symbol("AAPL")
        assert results["price"] == "failed"
        assert results["fundamentals"] == "failed"

    @pytest.mark.asyncio
    async def test_refresh_symbol_handles_exception(self, manager):
        """refresh_symbol marks errored data types."""
        with patch.object(manager, "get_price", new_callable=AsyncMock, side_effect=RuntimeError("boom")):
            with patch.object(manager, "get_fundamentals", new_callable=AsyncMock, return_value=MagicMock()):
                with patch.object(manager, "get_news", new_callable=AsyncMock, return_value=MagicMock()):
                    with patch.object(manager, "get_institutional_holders", new_callable=AsyncMock, return_value=MagicMock()):
                        with patch.object(manager, "get_insider_transactions", new_callable=AsyncMock, return_value=MagicMock()):
                            with patch.object(manager, "get_cot_data", new_callable=AsyncMock, return_value=MagicMock()):
                                results = await manager.refresh_symbol("AAPL")
        assert results["price"] == "error"
        assert results["fundamentals"] == "refreshed"


# ===================================================================
# 15. Singleton
# ===================================================================
class TestSingleton:
    """Module-level singleton functions."""

    def test_get_cache_manager_creates_once(self):
        """get_cache_manager creates an instance on first call."""
        assert cache_mod._manager is None
        mgr = get_cache_manager()
        assert isinstance(mgr, CacheManager)
        assert cache_mod._manager is mgr

    def test_get_cache_manager_returns_same_instance(self):
        """Calling twice returns the same instance."""
        first = get_cache_manager()
        second = get_cache_manager()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_cache_manager_calls_close_and_resets(self):
        """close_cache_manager calls close and sets _manager to None."""
        mgr = get_cache_manager()
        with patch.object(mgr, "close", new_callable=AsyncMock) as mock_close:
            await close_cache_manager()
        mock_close.assert_called_once()
        assert cache_mod._manager is None

    @pytest.mark.asyncio
    async def test_close_cache_manager_noop_when_none(self):
        """close_cache_manager is a no-op when _manager is None."""
        assert cache_mod._manager is None
        await close_cache_manager()  # should not raise
        assert cache_mod._manager is None

    @pytest.mark.asyncio
    async def test_get_creates_new_after_close(self):
        """After close, get_cache_manager creates a fresh instance."""
        first = get_cache_manager()
        with patch.object(first, "close", new_callable=AsyncMock):
            await close_cache_manager()
        second = get_cache_manager()
        assert first is not second
        assert isinstance(second, CacheManager)


# ===================================================================
# 16. Lifecycle (close)
# ===================================================================
class TestLifecycle:
    """CacheManager.close() lifecycle cleanup."""

    @pytest.mark.asyncio
    async def test_close_cancels_bg_tasks(self):
        """close() cancels all background tasks."""
        mgr = CacheManager()
        task1 = asyncio.create_task(asyncio.sleep(100))
        task2 = asyncio.create_task(asyncio.sleep(100))
        mgr._bg_tasks = {task1, task2}
        await mgr.close()
        assert task1.cancelled() or task1.done()
        assert task2.cancelled() or task2.done()

    @pytest.mark.asyncio
    async def test_close_clears_locks_and_stats(self):
        """close() clears _locks, _bg_tasks, and _stats."""
        mgr = CacheManager()
        mgr._locks["key1"] = asyncio.Lock()
        mgr._locks["key2"] = asyncio.Lock()
        mgr._stats["hits"] = 10
        mgr._stats["misses"] = 5
        await mgr.close()
        assert len(mgr._locks) == 0
        assert len(mgr._bg_tasks) == 0
        assert len(mgr._stats) == 0

    @pytest.mark.asyncio
    async def test_close_idempotent(self):
        """close() can be called twice without error."""
        mgr = CacheManager()
        await mgr.close()
        await mgr.close()  # no error

    @pytest.mark.asyncio
    async def test_close_handles_already_done_tasks(self):
        """close() handles tasks that are already done."""
        mgr = CacheManager()
        task = asyncio.create_task(asyncio.sleep(0))
        await asyncio.sleep(0.01)  # let it finish
        mgr._bg_tasks = {task}
        await mgr.close()  # should not raise
        assert len(mgr._bg_tasks) == 0


# ===================================================================
# 17. _get_lock
# ===================================================================
class TestGetLock:
    """CacheManager._get_lock per-key lock management."""

    def test_creates_lock_for_new_key(self):
        """Creates a new asyncio.Lock for a new key."""
        mgr = CacheManager()
        lock = mgr._get_lock("price:AAPL:latest")
        assert isinstance(lock, asyncio.Lock)

    def test_returns_same_lock_for_same_key(self):
        """Returns the same lock for the same key."""
        mgr = CacheManager()
        lock1 = mgr._get_lock("price:AAPL:latest")
        lock2 = mgr._get_lock("price:AAPL:latest")
        assert lock1 is lock2

    def test_different_lock_for_different_key(self):
        """Returns different locks for different keys."""
        mgr = CacheManager()
        lock1 = mgr._get_lock("price:AAPL:latest")
        lock2 = mgr._get_lock("price:MSFT:latest")
        assert lock1 is not lock2


# ===================================================================
# 18. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Cross-cutting edge cases and boundary conditions."""

    @pytest.mark.asyncio
    async def test_read_cache_none_json_type_error(self, manager, patched_db):
        """_read_cache returns None when value_json is None (TypeError)."""
        patched_db.fetch_one.return_value = {
            "value_json": None,
            "source": "cache",
            "fetched_at": _now_iso(),
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_or_fetch_stale_bg_refresh_returns_false(self, manager, patched_settings):
        """When bg refresh is at capacity, stale hit still returns data."""
        cached = ({"price": 100}, _past_iso(1000), 1000.0)
        with patch.object(manager, "_read_cache", new_callable=AsyncMock, return_value=cached):
            with patch.object(manager, "_schedule_bg_refresh", return_value=False):
                result = await manager.get_or_fetch("price", "AAPL")
        assert result is not None
        assert result.is_stale is True

    def test_build_result_naive_fetched_at(self):
        """_build_result handles naive (no tz) fetched_at by assuming UTC."""
        naive_ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        result = CacheManager._build_result(
            data={}, data_type="price", symbol="AAPL", period="latest",
            source="cache", is_cached=True, is_stale=False,
            fetched_at=naive_ts, age=0.0, ttl=900,
        )
        assert result.expires_at != ""

    @pytest.mark.asyncio
    async def test_read_cache_negative_age_clamped_to_zero(self, manager, patched_db):
        """_read_cache clamps negative age to 0."""
        future_ts = (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()
        patched_db.fetch_one.return_value = {
            "value_json": json.dumps({"v": 1}),
            "source": "cache",
            "fetched_at": future_ts,
        }
        result = await manager._read_cache("AAPL", "price", "latest")
        assert result is not None
        _, _, age = result
        assert age == 0.0

    @pytest.mark.asyncio
    async def test_delete_cache_uppercases_symbol(self, manager, patched_db):
        """_delete_cache uppercases the symbol."""
        cur = MagicMock()
        cur.rowcount = 0
        patched_db.execute.return_value = cur
        await manager._delete_cache("aapl", "price")
        params = patched_db.execute.call_args[0][1]
        assert params[0] == "AAPL"

    @pytest.mark.asyncio
    async def test_write_cache_uppercases_symbol(self, manager, patched_db):
        """_write_cache uppercases the symbol."""
        await manager._write_cache("aapl", "price", "latest", "finnhub", {"v": 1})
        params = patched_db.execute.call_args[0][1]
        assert params[0] == "AAPL"

    def test_init_creates_default_stats(self):
        """__init__ creates a defaultdict for stats."""
        mgr = CacheManager()
        assert isinstance(mgr._stats, defaultdict)
        # Accessing a non-existent key should return 0
        assert mgr._stats["nonexistent"] == 0

    def test_init_creates_empty_structures(self):
        """__init__ creates empty locks and bg_tasks."""
        mgr = CacheManager()
        assert len(mgr._locks) == 0
        assert len(mgr._bg_tasks) == 0
