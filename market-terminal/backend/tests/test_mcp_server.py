"""Comprehensive tests for the MCP server (market-terminal/backend/app/mcp_server.py).

Covers all 19 tool functions, internal helpers (_validate_symbol, _truncate_response,
_get_lock, _build_dataframes, _load_analyzer, _init_services), error paths, edge
cases, and concurrency behavior.

Run with: ``pytest tests/test_mcp_server.py -v``
"""
from __future__ import annotations

import asyncio
import importlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from types import ModuleType
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# We need to import the module under test.  Because mcp_server.py does
# ``from mcp.server import Server`` at module level we must ensure the
# ``mcp`` package is available (or mocked).  If the real mcp package is
# installed it will be used; otherwise we patch it before import.
# ---------------------------------------------------------------------------

_mcp_available = importlib.util.find_spec("mcp") is not None

if not _mcp_available:
    # Provide a minimal stub so the module-level import succeeds.
    _mcp_mod = ModuleType("mcp")
    _mcp_server_mod = ModuleType("mcp.server")
    _mcp_server_stdio_mod = ModuleType("mcp.server.stdio")

    class _FakeServer:
        def __init__(self, *a: Any, **kw: Any) -> None:
            pass

        def tool(self):
            """Decorator that passes the function through unchanged."""
            def _dec(fn):
                return fn
            return _dec

        def create_initialization_options(self):
            return {}

        async def run(self, *a: Any, **kw: Any) -> None:
            pass

    _mcp_server_mod.Server = _FakeServer  # type: ignore[attr-defined]
    _mcp_server_stdio_mod.stdio_server = MagicMock  # type: ignore[attr-defined]
    _mcp_mod.server = _mcp_server_mod  # type: ignore[attr-defined]
    sys.modules.setdefault("mcp", _mcp_mod)
    sys.modules.setdefault("mcp.server", _mcp_server_mod)
    sys.modules.setdefault("mcp.server.stdio", _mcp_server_stdio_mod)

# Now import the actual module under test.
from app import mcp_server  # noqa: E402
from app.mcp_server import (  # noqa: E402
    _validate_symbol,
    _truncate_response,
    _get_lock,
    _build_dataframes,
    _load_analyzer,
    _init_services,
    _MAX_RESPONSE_BYTES,
    _MAX_WATCHLIST_SIZE,
    _LOCK_TIMEOUT_SECONDS,
    get_price,
    get_volume,
    get_fundamentals,
    get_ownership,
    get_insider_activity,
    get_news,
    get_macro_calendar,
    get_macro_history,
    run_wyckoff,
    run_elliott,
    run_ict,
    run_canslim,
    run_williams,
    run_sentiment,
    run_composite,
    watchlist_list,
    watchlist_add,
    watchlist_remove,
    scan_watchlist,
)


# ---------------------------------------------------------------------------
# CachedResult stub -- mirrors app.data.cache_types.CachedResult
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FakeCachedResult:
    data: Any
    data_type: str = "price"
    cache_key: str = "test"
    source: str = "test"
    is_cached: bool = False
    is_stale: bool = False
    fetched_at: str = ""
    cache_age_seconds: float = 0.0
    cache_age_human: str = "0s"
    ttl_seconds: int = 300
    expires_at: str = ""


# ---------------------------------------------------------------------------
# Common fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_module_state():
    """Reset mcp_server module-level mutable state between tests."""
    mcp_server._cache_manager = None
    mcp_server._database = None
    mcp_server._analyzers.clear()
    mcp_server._analysis_locks.clear()
    yield
    mcp_server._cache_manager = None
    mcp_server._database = None
    mcp_server._analyzers.clear()
    mcp_server._analysis_locks.clear()


@pytest.fixture
def mock_cache():
    """Return a MagicMock that behaves like CacheManager and install it."""
    cm = MagicMock()
    mcp_server._cache_manager = cm
    return cm


@pytest.fixture
def mock_db():
    """Return an AsyncMock that behaves like DatabaseManager and install it."""
    db = AsyncMock()
    mcp_server._database = db
    return db


def _cached(data: Any) -> FakeCachedResult:
    """Shorthand: wrap *data* in a FakeCachedResult."""
    return FakeCachedResult(data=data)


def _bars(n: int = 30) -> list[dict[str, Any]]:
    """Generate *n* OHLCV bar dicts suitable for _build_dataframes."""
    return [
        {"date": f"2025-01-{i + 1:02d}", "open": 100 + i, "high": 110 + i,
         "low": 90 + i, "close": 105 + i, "volume": 1_000_000 + i * 1000}
        for i in range(n)
    ]


# ===================================================================
# 1. TestValidateSymbol -- _validate_symbol helper
# ===================================================================
class TestValidateSymbol:
    """Unit tests for _validate_symbol."""

    def test_uppercase_and_strip(self):
        assert _validate_symbol("  aapl  ") == "AAPL"

    def test_already_uppercase(self):
        assert _validate_symbol("MSFT") == "MSFT"

    def test_numeric_symbol(self):
        assert _validate_symbol("1234") == "1234"

    def test_dot_dash_symbol(self):
        assert _validate_symbol("BRK.B") == "BRK.B"

    def test_max_length_10(self):
        assert _validate_symbol("ABCDEFGHIJ") == "ABCDEFGHIJ"

    def test_exceeds_10_raises(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("ABCDEFGHIJK")

    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("   ")

    def test_special_chars_raise(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("AA@L")

    def test_spaces_in_middle_raise(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("AA PL")

    def test_dollar_sign_raises(self):
        with pytest.raises(ValueError, match="Invalid ticker symbol"):
            _validate_symbol("$AAPL")


# ===================================================================
# 2. TestTruncateResponse -- _truncate_response helper
# ===================================================================
class TestTruncateResponse:
    """Unit tests for _truncate_response."""

    def test_small_dict_unchanged(self):
        data = {"key": "value"}
        result = _truncate_response(data)
        assert result == data
        assert "truncated" not in result

    def test_large_list_truncated(self):
        """A response exceeding _MAX_RESPONSE_BYTES is truncated."""
        data = {"items": ["x" * 500 for _ in range(500)]}
        result = _truncate_response(data, max_bytes=1000)
        assert result.get("truncated") is True
        assert len(json.dumps(result, default=str).encode()) <= 1000

    def test_truncated_flag_added(self):
        data = {"big": list(range(10_000))}
        result = _truncate_response(data, max_bytes=500)
        assert result["truncated"] is True

    def test_no_list_fields_stops_gracefully(self):
        """When all fields are scalars, truncation loop exits without error."""
        data = {"a": "x" * 200_000}
        result = _truncate_response(data, max_bytes=100)
        # Cannot truncate a string field, so just returns with flag
        assert "truncated" in result

    def test_100kb_boundary(self):
        """Payloads at exactly 100KB pass through."""
        # Build data that is just under 100KB
        small = {"data": "a" * 90_000}
        result = _truncate_response(small)
        assert "truncated" not in result

    def test_over_100kb_payload_truncated(self):
        data = {"items": ["x" * 200 for _ in range(2000)]}
        result = _truncate_response(data)
        encoded = json.dumps(result, default=str).encode()
        assert len(encoded) <= _MAX_RESPONSE_BYTES


# ===================================================================
# 3. TestGetLock -- _get_lock helper
# ===================================================================
class TestGetLock:
    """Unit tests for _get_lock."""

    def test_returns_asyncio_lock(self):
        lock = _get_lock("AAPL")
        assert isinstance(lock, asyncio.Lock)

    def test_same_symbol_same_lock(self):
        l1 = _get_lock("MSFT")
        l2 = _get_lock("MSFT")
        assert l1 is l2

    def test_different_symbol_different_lock(self):
        l1 = _get_lock("AAPL")
        l2 = _get_lock("GOOG")
        assert l1 is not l2


# ===================================================================
# 4. TestBuildDataframes -- _build_dataframes helper
# ===================================================================
class TestBuildDataframes:
    """Unit tests for _build_dataframes."""

    def test_empty_list_returns_empty_dfs(self):
        price_df, vol_df = _build_dataframes([])
        assert price_df.empty
        assert vol_df.empty

    def test_valid_bars_return_sorted_dfs(self):
        bars = _bars(10)
        price_df, vol_df = _build_dataframes(bars)
        assert not price_df.empty
        assert not vol_df.empty
        assert list(price_df.columns) == ["date", "open", "high", "low", "close"]
        assert "volume" in vol_df.columns

    def test_missing_columns_returns_empty(self):
        bars = [{"date": "2025-01-01", "foo": 1}]
        price_df, vol_df = _build_dataframes(bars)
        assert price_df.empty
        assert vol_df.empty

    def test_no_volume_column_fills_zero(self):
        bars = [
            {"date": "2025-01-01", "open": 100, "high": 110,
             "low": 90, "close": 105}
        ]
        price_df, vol_df = _build_dataframes(bars)
        assert not price_df.empty
        assert (vol_df["volume"] == 0).all()


# ===================================================================
# 5. TestLoadAnalyzer -- _load_analyzer helper
# ===================================================================
class TestLoadAnalyzer:
    """Unit tests for _load_analyzer."""

    def test_unknown_methodology_returns_none(self):
        assert _load_analyzer("nonexistent") is None

    def test_known_methodology_import_failure_returns_none(self):
        """If importlib fails, returns None and logs."""
        with patch("importlib.import_module", side_effect=ImportError("nope")):
            result = _load_analyzer("wyckoff")
        assert result is None

    def test_caches_analyzer_instance(self):
        """Second call for same methodology returns cached instance."""
        fake = MagicMock()
        fake_mod = MagicMock()
        fake_mod.WyckoffAnalyzer.return_value = fake
        with patch("importlib.import_module", return_value=fake_mod):
            a1 = _load_analyzer("wyckoff")
            a2 = _load_analyzer("wyckoff")
        assert a1 is a2
        assert a1 is fake


# ===================================================================
# 6. TestInitServices -- _init_services
# ===================================================================
class TestInitServices:
    """Unit tests for _init_services."""

    @pytest.mark.asyncio
    async def test_init_sets_cache_manager(self):
        fake_cm = MagicMock()
        with patch("app.mcp_server.get_cache_manager", create=True) as _:
            # Patch the import inside _init_services
            fake_cache_mod = MagicMock()
            fake_cache_mod.get_cache_manager.return_value = fake_cm
            with patch.dict(sys.modules, {"app.data.cache": fake_cache_mod}):
                fake_db_mod = MagicMock()
                fake_db_mod.get_database = AsyncMock(return_value=MagicMock())
                with patch.dict(sys.modules, {"app.data.database": fake_db_mod}):
                    await _init_services()
        assert mcp_server._cache_manager is fake_cm

    @pytest.mark.asyncio
    async def test_init_cache_failure_graceful(self):
        """CacheManager init failure should not crash."""
        fake_cache_mod = MagicMock()
        fake_cache_mod.get_cache_manager.side_effect = RuntimeError("boom")
        fake_db_mod = MagicMock()
        fake_db_mod.get_database = AsyncMock(return_value=MagicMock())
        with patch.dict(sys.modules, {
            "app.data.cache": fake_cache_mod,
            "app.data.database": fake_db_mod,
        }):
            await _init_services()
        assert mcp_server._cache_manager is None

    @pytest.mark.asyncio
    async def test_init_database_failure_graceful(self):
        """DatabaseManager init failure should not crash."""
        fake_cache_mod = MagicMock()
        fake_cache_mod.get_cache_manager.return_value = MagicMock()
        fake_db_mod = MagicMock()
        fake_db_mod.get_database = AsyncMock(side_effect=RuntimeError("db down"))
        with patch.dict(sys.modules, {
            "app.data.cache": fake_cache_mod,
            "app.data.database": fake_db_mod,
        }):
            await _init_services()
        assert mcp_server._database is None


# ===================================================================
# 7. TestGetPrice -- get_price tool
# ===================================================================
class TestGetPrice:
    """Tests for the get_price tool."""

    @pytest.mark.asyncio
    async def test_valid_symbol(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([{"close": 150}]))
        result = await get_price("AAPL")
        assert result["symbol"] == "AAPL"
        assert result["data"] == [{"close": 150}]
        mock_cache.get_historical_prices.assert_awaited_once_with("AAPL", period="1y")

    @pytest.mark.asyncio
    async def test_custom_timeframe(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([]))
        result = await get_price("MSFT", timeframe="6m")
        assert result["timeframe"] == "6m"
        mock_cache.get_historical_prices.assert_awaited_once_with("MSFT", period="6m")

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_price("!!!invalid")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache_manager(self):
        result = await get_price("AAPL")
        assert result == {"error": "Failed to fetch price data"}

    @pytest.mark.asyncio
    async def test_cache_returns_none(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=None)
        result = await get_price("AAPL")
        assert result == {"error": "Failed to fetch price data"}

    @pytest.mark.asyncio
    async def test_cache_raises_exception(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            side_effect=RuntimeError("network"))
        result = await get_price("AAPL")
        assert result == {"error": "Failed to fetch price data"}

    @pytest.mark.asyncio
    async def test_symbol_normalized(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=_cached([]))
        result = await get_price("  aapl  ")
        assert result["symbol"] == "AAPL"


# ===================================================================
# 8. TestGetVolume -- get_volume tool
# ===================================================================
class TestGetVolume:
    """Tests for the get_volume tool."""

    @pytest.mark.asyncio
    async def test_valid_volume(self, mock_cache):
        bars = [{"volume": 1000 + i * 100} for i in range(20)]
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        assert result["symbol"] == "AAPL"
        assert "average_volume" in result
        assert "volume_trend" in result
        assert result["bar_count"] == 20

    @pytest.mark.asyncio
    async def test_no_cache_manager(self):
        result = await get_volume("AAPL")
        assert result == {"error": "Failed to fetch volume data"}

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_volume("$$$")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_empty_data(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([]))
        result = await get_volume("AAPL")
        assert result == {"error": "Failed to fetch volume data"}

    @pytest.mark.asyncio
    async def test_cache_returns_none(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=None)
        result = await get_volume("AAPL")
        assert result == {"error": "Failed to fetch volume data"}

    @pytest.mark.asyncio
    async def test_volume_trend_increasing(self, mock_cache):
        # First 5 bars low volume, last 5 high volume -> increasing
        bars = [{"volume": 100}] * 5 + [{"volume": 500}] * 5
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        assert result["volume_trend"] == "increasing"

    @pytest.mark.asyncio
    async def test_volume_trend_decreasing(self, mock_cache):
        # First 5 bars high volume, last 5 low volume -> decreasing
        bars = [{"volume": 500}] * 5 + [{"volume": 100}] * 5
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        assert result["volume_trend"] == "decreasing"

    @pytest.mark.asyncio
    async def test_volume_trend_stable(self, mock_cache):
        bars = [{"volume": 1000}] * 10
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        assert result["volume_trend"] == "stable"

    @pytest.mark.asyncio
    async def test_unusual_volume_days(self, mock_cache):
        # All bars volume 100, except one at 500 (5x avg) => unusual
        bars = [{"volume": 100}] * 9 + [{"volume": 5000}]
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        assert len(result["unusual_volume_days"]) >= 1

    @pytest.mark.asyncio
    async def test_custom_period(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([{"volume": 100}] * 5))
        result = await get_volume("AAPL", period="6m")
        assert result["period"] == "6m"


# ===================================================================
# 9. TestGetFundamentals -- get_fundamentals tool
# ===================================================================
class TestGetFundamentals:
    """Tests for the get_fundamentals tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        mock_cache.get_fundamentals = AsyncMock(
            return_value=_cached({"pe": 25.0}))
        result = await get_fundamentals("AAPL")
        assert result["symbol"] == "AAPL"
        assert result["data"] == {"pe": 25.0}

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_fundamentals("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_fundamentals("AAPL")
        assert result == {"error": "Failed to fetch fundamentals data"}

    @pytest.mark.asyncio
    async def test_cache_returns_none(self, mock_cache):
        mock_cache.get_fundamentals = AsyncMock(return_value=None)
        result = await get_fundamentals("AAPL")
        assert result == {"error": "Failed to fetch fundamentals data"}

    @pytest.mark.asyncio
    async def test_exception(self, mock_cache):
        mock_cache.get_fundamentals = AsyncMock(
            side_effect=RuntimeError("fail"))
        result = await get_fundamentals("AAPL")
        assert result == {"error": "Failed to fetch fundamentals data"}


# ===================================================================
# 10. TestGetOwnership -- get_ownership tool
# ===================================================================
class TestGetOwnership:
    """Tests for the get_ownership tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        mock_cache.get_institutional_holders = AsyncMock(
            return_value=_cached([{"holder": "Vanguard"}]))
        result = await get_ownership("AAPL")
        assert result["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_ownership("@@@")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_ownership("AAPL")
        assert result == {"error": "Failed to fetch ownership data"}

    @pytest.mark.asyncio
    async def test_cache_returns_none(self, mock_cache):
        mock_cache.get_institutional_holders = AsyncMock(return_value=None)
        result = await get_ownership("AAPL")
        assert result == {"error": "Failed to fetch ownership data"}


# ===================================================================
# 11. TestGetInsiderActivity -- get_insider_activity tool
# ===================================================================
class TestGetInsiderActivity:
    """Tests for the get_insider_activity tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        mock_cache.get_insider_transactions = AsyncMock(
            return_value=_cached([{"type": "buy"}]))
        result = await get_insider_activity("AAPL")
        assert result["symbol"] == "AAPL"
        assert result["days"] == 90

    @pytest.mark.asyncio
    async def test_custom_days(self, mock_cache):
        mock_cache.get_insider_transactions = AsyncMock(
            return_value=_cached([]))
        result = await get_insider_activity("AAPL", days=30)
        assert result["days"] == 30
        mock_cache.get_insider_transactions.assert_awaited_once_with("AAPL", days=30)

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_insider_activity("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_insider_activity("AAPL")
        assert result == {"error": "Failed to fetch insider activity data"}


# ===================================================================
# 12. TestGetNews -- get_news tool
# ===================================================================
class TestGetNews:
    """Tests for the get_news tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        articles = [{"title": f"Article {i}"} for i in range(25)]
        mock_cache.get_news = AsyncMock(return_value=_cached(articles))
        result = await get_news("AAPL")
        assert result["symbol"] == "AAPL"
        # Default limit=20 applied to list
        assert len(result["articles"]) == 20

    @pytest.mark.asyncio
    async def test_custom_limit(self, mock_cache):
        articles = [{"title": f"A{i}"} for i in range(30)]
        mock_cache.get_news = AsyncMock(return_value=_cached(articles))
        result = await get_news("AAPL", limit=5)
        assert len(result["articles"]) == 5

    @pytest.mark.asyncio
    async def test_non_list_data(self, mock_cache):
        mock_cache.get_news = AsyncMock(
            return_value=_cached({"summary": "no articles"}))
        result = await get_news("AAPL")
        # Non-list data is passed through
        assert result["articles"] == {"summary": "no articles"}

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await get_news("###")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_news("AAPL")
        assert result == {"error": "Failed to fetch news data"}


# ===================================================================
# 13. TestGetMacroCalendar -- get_macro_calendar tool
# ===================================================================
class TestGetMacroCalendar:
    """Tests for the get_macro_calendar tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        mock_cache.get_macro_calendar = AsyncMock(
            return_value=_cached([{"event": "CPI"}]))
        result = await get_macro_calendar()
        assert result["days"] == 30
        assert result["data"] == [{"event": "CPI"}]

    @pytest.mark.asyncio
    async def test_custom_days(self, mock_cache):
        mock_cache.get_macro_calendar = AsyncMock(
            return_value=_cached([]))
        result = await get_macro_calendar(days=7)
        assert result["days"] == 7

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_macro_calendar()
        assert result == {"error": "Failed to fetch calendar data"}

    @pytest.mark.asyncio
    async def test_cache_returns_none(self, mock_cache):
        mock_cache.get_macro_calendar = AsyncMock(return_value=None)
        result = await get_macro_calendar()
        assert result == {"error": "Failed to fetch calendar data"}


# ===================================================================
# 14. TestGetMacroHistory -- get_macro_history tool
# ===================================================================
class TestGetMacroHistory:
    """Tests for the get_macro_history tool."""

    @pytest.mark.asyncio
    async def test_valid(self, mock_cache):
        mock_cache.get_macro_indicator = AsyncMock(
            return_value=_cached({"values": [1, 2, 3]}))
        result = await get_macro_history("GDP")
        assert result["indicator"] == "GDP"
        assert result["symbol"] == "SPY"

    @pytest.mark.asyncio
    async def test_custom_symbol(self, mock_cache):
        mock_cache.get_macro_indicator = AsyncMock(
            return_value=_cached({}))
        result = await get_macro_history("CPI", symbol="QQQ")
        assert result["symbol"] == "QQQ"

    @pytest.mark.asyncio
    async def test_invalid_indicator_empty(self, mock_cache):
        result = await get_macro_history("  ")
        assert result == {"error": "Invalid indicator"}

    @pytest.mark.asyncio
    async def test_invalid_indicator_special_chars(self, mock_cache):
        result = await get_macro_history("GDP@!")
        assert result == {"error": "Invalid indicator"}

    @pytest.mark.asyncio
    async def test_indicator_too_long(self, mock_cache):
        result = await get_macro_history("A" * 31)
        assert result == {"error": "Invalid indicator"}

    @pytest.mark.asyncio
    async def test_indicator_normalized_uppercase(self, mock_cache):
        mock_cache.get_macro_indicator = AsyncMock(
            return_value=_cached({}))
        result = await get_macro_history("  gdp  ")
        assert result["indicator"] == "GDP"

    @pytest.mark.asyncio
    async def test_no_cache(self):
        result = await get_macro_history("GDP")
        assert result == {"error": "Failed to fetch macro data"}

    @pytest.mark.asyncio
    async def test_underscores_allowed(self, mock_cache):
        mock_cache.get_macro_indicator = AsyncMock(
            return_value=_cached({}))
        result = await get_macro_history("DGS_10")
        assert result["indicator"] == "DGS_10"


# ===================================================================
# 15. TestRunAnalysisSingle -- run_wyckoff thru run_sentiment
# ===================================================================
class TestRunAnalysisSingle:
    """Tests for the 6 individual analysis tool functions.

    These all delegate to _run_single_analysis, so we test the shared
    logic through representative tools plus tool-specific dispatch.
    """

    def _setup_analysis(self, mock_cache, methodology="wyckoff"):
        """Wire mock_cache to return bars, and install a fake analyzer."""
        bars = _bars(30)
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))

        fake_signal = MagicMock()
        fake_signal.to_dict.return_value = {
            "methodology": methodology, "direction": "bullish",
            "confidence": 0.8, "ticker": "AAPL",
        }
        fake_analyzer = MagicMock()
        fake_analyzer.analyze = AsyncMock(return_value=fake_signal)
        return fake_analyzer

    @pytest.mark.asyncio
    async def test_run_wyckoff_success(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "wyckoff")
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_wyckoff("AAPL")
        assert result["methodology"] == "wyckoff"
        assert result["direction"] == "bullish"

    @pytest.mark.asyncio
    async def test_run_elliott_success(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "elliott_wave")
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_elliott("AAPL")
        assert result["methodology"] == "elliott_wave"

    @pytest.mark.asyncio
    async def test_run_ict_success(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "ict_smart_money")
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_ict("AAPL")
        assert result["methodology"] == "ict_smart_money"

    @pytest.mark.asyncio
    async def test_run_canslim_fetches_fundamentals(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "canslim")
        mock_cache.get_fundamentals = AsyncMock(
            return_value=_cached({"pe": 25}))
        mock_cache.get_institutional_holders = AsyncMock(
            return_value=_cached([]))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_canslim("AAPL")
        assert "error" not in result
        # Verify fundamentals were fetched for CANSLIM
        mock_cache.get_fundamentals.assert_awaited()
        mock_cache.get_institutional_holders.assert_awaited()

    @pytest.mark.asyncio
    async def test_run_williams_fetches_cot(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "larry_williams")
        mock_cache.get_cot_data = AsyncMock(return_value=_cached({}))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_williams("AAPL")
        assert "error" not in result
        mock_cache.get_cot_data.assert_awaited()

    @pytest.mark.asyncio
    async def test_run_sentiment_fetches_news(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache, "sentiment")
        mock_cache.get_news = AsyncMock(
            return_value=_cached([{"title": "test"}]))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_sentiment("AAPL")
        assert "error" not in result
        mock_cache.get_news.assert_awaited()

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await run_wyckoff("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache_manager(self):
        result = await run_wyckoff("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_no_price_data(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=None)
        result = await run_wyckoff("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_empty_price_data(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([]))
        result = await run_wyckoff("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_analyzer_unavailable(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(10)))
        with patch("app.mcp_server._load_analyzer", return_value=None):
            result = await run_wyckoff("AAPL")
        assert result == {"error": "Analysis module unavailable"}

    @pytest.mark.asyncio
    async def test_analyze_raises_value_error(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(10)))
        analyzer = MagicMock()
        analyzer.analyze = AsyncMock(side_effect=ValueError("bad data"))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_wyckoff("AAPL")
        assert result == {"error": "Analysis failed"}

    @pytest.mark.asyncio
    async def test_analyze_raises_generic_exception(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(10)))
        analyzer = MagicMock()
        analyzer.analyze = AsyncMock(side_effect=RuntimeError("crash"))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            result = await run_wyckoff("AAPL")
        assert result == {"error": "Analysis failed"}

    @pytest.mark.asyncio
    async def test_lock_released_after_success(self, mock_cache):
        analyzer = self._setup_analysis(mock_cache)
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            await run_wyckoff("AAPL")
        lock = _get_lock("AAPL")
        assert not lock.locked()

    @pytest.mark.asyncio
    async def test_lock_released_after_error(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(10)))
        analyzer = MagicMock()
        analyzer.analyze = AsyncMock(side_effect=RuntimeError("crash"))
        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            await run_wyckoff("AAPL")
        lock = _get_lock("AAPL")
        assert not lock.locked()

    @pytest.mark.asyncio
    async def test_lock_timeout(self, mock_cache):
        """When lock is already held, timeout returns error."""
        lock = _get_lock("AAPL")
        await lock.acquire()
        try:
            # Patch timeout to be very short
            with patch.object(mcp_server, "_LOCK_TIMEOUT_SECONDS", 0.01):
                result = await run_wyckoff("AAPL")
            assert result == {"error": "Analysis in progress for this symbol"}
        finally:
            lock.release()


# ===================================================================
# 16. TestRunComposite -- run_composite tool
# ===================================================================
class TestRunComposite:
    """Tests for the run_composite tool."""

    @pytest.mark.asyncio
    async def test_invalid_symbol(self, mock_cache):
        result = await run_composite("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_cache_manager(self):
        result = await run_composite("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_no_price_data(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=None)
        result = await run_composite("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_empty_dataframe(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached([]))
        result = await run_composite("AAPL")
        assert result == {"error": "Price data unavailable"}

    @pytest.mark.asyncio
    async def test_all_analyzers_fail(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(30)))
        mock_cache.get_fundamentals = AsyncMock(return_value=None)
        mock_cache.get_institutional_holders = AsyncMock(return_value=None)
        mock_cache.get_cot_data = AsyncMock(return_value=None)
        mock_cache.get_news = AsyncMock(return_value=None)
        with patch("app.mcp_server._load_analyzer", return_value=None):
            result = await run_composite("AAPL")
        assert result == {"error": "All methodology analyses failed"}

    @pytest.mark.asyncio
    async def test_successful_composite(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(30)))
        mock_cache.get_fundamentals = AsyncMock(
            return_value=_cached({"pe": 25}))
        mock_cache.get_institutional_holders = AsyncMock(
            return_value=_cached([]))
        mock_cache.get_cot_data = AsyncMock(return_value=_cached({}))
        mock_cache.get_news = AsyncMock(
            return_value=_cached([{"title": "test"}]))

        fake_signal = MagicMock()
        fake_signal.to_dict.return_value = {"direction": "bullish"}
        fake_analyzer = MagicMock()
        fake_analyzer.analyze = AsyncMock(return_value=fake_signal)

        fake_composite_result = MagicMock()
        fake_composite_result.to_dict.return_value = {
            "overall_direction": "bullish",
            "overall_confidence": 0.75,
        }
        fake_aggregator = MagicMock()
        fake_aggregator.aggregate = AsyncMock(return_value=fake_composite_result)

        with patch("app.mcp_server._load_analyzer", return_value=fake_analyzer):
            with patch.dict(sys.modules, {
                "app.analysis.base": MagicMock(MethodologySignal=MagicMock),
                "app.analysis.composite": MagicMock(
                    CompositeAggregator=MagicMock(return_value=fake_aggregator)),
            }):
                result = await run_composite("AAPL")
        assert result.get("overall_direction") == "bullish"

    @pytest.mark.asyncio
    async def test_lock_released(self, mock_cache):
        mock_cache.get_historical_prices = AsyncMock(return_value=None)
        await run_composite("AAPL")
        # Lock should be released even on error path
        lock = _get_lock("AAPL")
        assert not lock.locked()

    @pytest.mark.asyncio
    async def test_lock_timeout(self, mock_cache):
        lock = _get_lock("AAPL")
        await lock.acquire()
        try:
            with patch.object(mcp_server, "_LOCK_TIMEOUT_SECONDS", 0.01):
                result = await run_composite("AAPL")
            assert result == {"error": "Analysis in progress for this symbol"}
        finally:
            lock.release()

    @pytest.mark.asyncio
    async def test_partial_analyzer_failure_still_aggregates(self, mock_cache):
        """If some analyzers fail but at least one succeeds, composite runs."""
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(_bars(30)))
        mock_cache.get_fundamentals = AsyncMock(return_value=None)
        mock_cache.get_institutional_holders = AsyncMock(return_value=None)
        mock_cache.get_cot_data = AsyncMock(return_value=None)
        mock_cache.get_news = AsyncMock(return_value=None)

        call_count = 0

        def _selective_loader(methodology):
            nonlocal call_count
            call_count += 1
            if methodology == "wyckoff":
                fake_signal = MagicMock()
                fake_signal.to_dict.return_value = {"direction": "bullish"}
                a = MagicMock()
                a.analyze = AsyncMock(return_value=fake_signal)
                return a
            return None

        fake_composite_result = MagicMock()
        fake_composite_result.to_dict.return_value = {
            "overall_direction": "bullish",
            "overall_confidence": 0.5,
        }
        fake_aggregator = MagicMock()
        fake_aggregator.aggregate = AsyncMock(return_value=fake_composite_result)

        with patch("app.mcp_server._load_analyzer", side_effect=_selective_loader):
            with patch.dict(sys.modules, {
                "app.analysis.base": MagicMock(MethodologySignal=MagicMock),
                "app.analysis.composite": MagicMock(
                    CompositeAggregator=MagicMock(return_value=fake_aggregator)),
            }):
                result = await run_composite("AAPL")
        assert result.get("overall_direction") == "bullish"


# ===================================================================
# 17. TestWatchlistList -- watchlist_list tool
# ===================================================================
class TestWatchlistList:
    """Tests for the watchlist_list tool."""

    @pytest.mark.asyncio
    async def test_no_database(self):
        result = await watchlist_list()
        assert result == {"error": "Database operation failed"}

    @pytest.mark.asyncio
    async def test_empty_watchlist(self, mock_db):
        mock_db.fetch_all.return_value = []
        result = await watchlist_list()
        assert result["tickers"] == []
        assert result["count"] == 0
        assert result["max_allowed"] == _MAX_WATCHLIST_SIZE

    @pytest.mark.asyncio
    async def test_with_tickers(self, mock_db):
        mock_db.fetch_all.return_value = [
            {"symbol": "AAPL", "group_name": "tech",
             "sort_order": 0, "added_at": "2025-01-01", "updated_at": "2025-01-02"},
        ]
        # price_cache row
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"close": 150.0, "open": 145.0},  # price
            {"direction": "bullish", "confidence": 0.8},  # signal
        ])
        result = await watchlist_list()
        assert result["count"] == 1
        assert result["tickers"][0]["symbol"] == "AAPL"
        assert result["tickers"][0]["last_price"] == 150.0
        assert result["tickers"][0]["price_change_percent"] is not None
        assert result["tickers"][0]["last_composite_signal"] == "bullish"

    @pytest.mark.asyncio
    async def test_no_price_cache_row(self, mock_db):
        mock_db.fetch_all.return_value = [
            {"symbol": "AAPL", "group_name": "default",
             "sort_order": 0, "added_at": None, "updated_at": None},
        ]
        mock_db.fetch_one = AsyncMock(return_value=None)
        result = await watchlist_list()
        assert result["tickers"][0]["last_price"] is None
        assert result["tickers"][0]["price_change_percent"] is None

    @pytest.mark.asyncio
    async def test_exception_returns_error(self, mock_db):
        mock_db.fetch_all.side_effect = RuntimeError("db crash")
        result = await watchlist_list()
        assert result == {"error": "Database operation failed"}

    @pytest.mark.asyncio
    async def test_groups_extracted(self, mock_db):
        mock_db.fetch_all.return_value = [
            {"symbol": "AAPL", "group_name": "tech",
             "sort_order": 0, "added_at": None, "updated_at": None},
            {"symbol": "XOM", "group_name": "energy",
             "sort_order": 1, "added_at": None, "updated_at": None},
        ]
        mock_db.fetch_one = AsyncMock(return_value=None)
        result = await watchlist_list()
        assert sorted(result["groups"]) == ["energy", "tech"]


# ===================================================================
# 18. TestWatchlistAdd -- watchlist_add tool
# ===================================================================
class TestWatchlistAdd:
    """Tests for the watchlist_add tool."""

    @pytest.mark.asyncio
    async def test_invalid_symbol(self):
        result = await watchlist_add("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_database(self):
        result = await watchlist_add("AAPL")
        assert result == {"error": "Database operation failed"}

    @pytest.mark.asyncio
    async def test_watchlist_full(self, mock_db):
        mock_db.fetch_one = AsyncMock(
            return_value={"cnt": _MAX_WATCHLIST_SIZE})
        result = await watchlist_add("AAPL")
        assert "maximum capacity" in result["error"]

    @pytest.mark.asyncio
    async def test_symbol_already_exists(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"cnt": 5},  # count
            {"id": 1},   # existing symbol
        ])
        result = await watchlist_add("AAPL")
        assert result == {"error": "Symbol already in watchlist"}

    @pytest.mark.asyncio
    async def test_successful_add(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"cnt": 5},           # count check
            None,                 # symbol not found
            {"max_pos": 4},       # max sort_order
        ])
        mock_db.execute = AsyncMock()
        result = await watchlist_add("aapl")
        assert result["added"] == "AAPL"
        assert result["group"] == "default"
        assert result["position"] == 5
        mock_db.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_custom_group(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"cnt": 0}, None, {"max_pos": None},
        ])
        mock_db.execute = AsyncMock()
        result = await watchlist_add("AAPL", group="tech")
        assert result["group"] == "tech"
        assert result["position"] == 0

    @pytest.mark.asyncio
    async def test_first_symbol_position_0(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"cnt": 0}, None, {"max_pos": None},
        ])
        mock_db.execute = AsyncMock()
        result = await watchlist_add("AAPL")
        assert result["position"] == 0

    @pytest.mark.asyncio
    async def test_exception_returns_error(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=RuntimeError("fail"))
        result = await watchlist_add("AAPL")
        assert result == {"error": "Database operation failed"}


# ===================================================================
# 19. TestWatchlistRemove -- watchlist_remove tool
# ===================================================================
class TestWatchlistRemove:
    """Tests for the watchlist_remove tool."""

    @pytest.mark.asyncio
    async def test_invalid_symbol(self):
        result = await watchlist_remove("!!!")
        assert result == {"error": "Invalid ticker symbol"}

    @pytest.mark.asyncio
    async def test_no_database(self):
        result = await watchlist_remove("AAPL")
        assert result == {"error": "Database operation failed"}

    @pytest.mark.asyncio
    async def test_symbol_not_found(self, mock_db):
        mock_db.fetch_one = AsyncMock(return_value=None)
        result = await watchlist_remove("AAPL")
        assert result == {"error": "Symbol not in watchlist"}

    @pytest.mark.asyncio
    async def test_successful_remove(self, mock_db):
        mock_db.fetch_one = AsyncMock(return_value={"id": 1})
        mock_db.execute = AsyncMock()
        result = await watchlist_remove("aapl")
        assert result == {"removed": "AAPL"}
        mock_db.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_exception_returns_error(self, mock_db):
        mock_db.fetch_one = AsyncMock(side_effect=RuntimeError("fail"))
        result = await watchlist_remove("AAPL")
        assert result == {"error": "Database operation failed"}


# ===================================================================
# 20. TestScanWatchlist -- scan_watchlist tool
# ===================================================================
class TestScanWatchlist:
    """Tests for the scan_watchlist tool."""

    @pytest.mark.asyncio
    async def test_delegates_to_scan_impl(self):
        expected = {"results": [], "total_matches": 0}
        with patch("app.mcp_server._scan_impl",
                   new_callable=AsyncMock, create=True) as _:
            # scan_watchlist imports _scan_impl from app.api.routes.scan
            with patch(
                "app.api.routes.scan._scan_impl",
                new_callable=AsyncMock,
                return_value=expected,
            ):
                result = await scan_watchlist()
        assert result == expected

    @pytest.mark.asyncio
    async def test_passes_parameters(self):
        expected = {"results": []}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=expected,
        ):
            result = await scan_watchlist(
                method="wyckoff", signal="bullish",
                min_confidence=0.5, limit=10)
        assert result == expected

    @pytest.mark.asyncio
    async def test_value_error_returns_error(self):
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            side_effect=ValueError("bad params"),
        ):
            result = await scan_watchlist()
        assert result == {"error": "Invalid scan parameters"}

    @pytest.mark.asyncio
    async def test_http_exception_400_returns_error(self):
        """HTTPException duck-typing: class name + status_code 400."""

        class FakeHTTPException(Exception):
            """Mimics FastAPI HTTPException without importing FastAPI."""
            pass

        FakeHTTPException.__name__ = "HTTPException"
        exc = FakeHTTPException("bad request")
        exc.status_code = 400  # type: ignore[attr-defined]

        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            side_effect=exc,
        ):
            result = await scan_watchlist()
        assert result == {"error": "Invalid scan parameters"}

    @pytest.mark.asyncio
    async def test_http_exception_non_400_returns_scan_error(self):
        """HTTPException with status_code != 400 falls through to generic."""

        class FakeHTTPException(Exception):
            pass

        FakeHTTPException.__name__ = "HTTPException"
        exc = FakeHTTPException("server error")
        exc.status_code = 500  # type: ignore[attr-defined]

        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            side_effect=exc,
        ):
            result = await scan_watchlist()
        assert result == {"error": "Scan operation failed"}

    @pytest.mark.asyncio
    async def test_generic_exception_returns_scan_error(self):
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            side_effect=RuntimeError("crash"),
        ):
            result = await scan_watchlist()
        assert result == {"error": "Scan operation failed"}


# ===================================================================
# 21. TestEdgeCases -- Cross-cutting edge cases
# ===================================================================
class TestEdgeCases:
    """Edge cases spanning multiple tools."""

    @pytest.mark.asyncio
    async def test_price_data_non_list(self, mock_cache):
        """get_volume: when data is not a list, error returned."""
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached("not a list"))
        result = await get_volume("AAPL")
        assert result == {"error": "Failed to fetch volume data"}

    @pytest.mark.asyncio
    async def test_volume_bars_missing_volume_key(self, mock_cache):
        """Bars without 'volume' key use 0."""
        bars = [{"foo": "bar"} for _ in range(10)]
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        result = await get_volume("AAPL")
        # All volumes are 0, avg is 0, no unusual days
        assert result["average_volume"] == 0

    @pytest.mark.asyncio
    async def test_truncate_response_called_on_large_output(self, mock_cache):
        """Verify truncation happens on data tools."""
        # Build a CachedResult with massive data
        big_data = [{"x": "y" * 1000} for _ in range(500)]
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(big_data))
        result = await get_price("AAPL")
        encoded = json.dumps(result, default=str).encode()
        assert len(encoded) <= _MAX_RESPONSE_BYTES

    @pytest.mark.asyncio
    async def test_concurrent_analysis_same_symbol(self, mock_cache):
        """Two concurrent analyses on same symbol: one waits, one runs."""
        bars = _bars(10)
        mock_cache.get_historical_prices = AsyncMock(
            return_value=_cached(bars))
        fake_signal = MagicMock()
        fake_signal.to_dict.return_value = {"direction": "bullish"}

        call_event = asyncio.Event()
        release_event = asyncio.Event()

        async def _slow_analyze(*a, **kw):
            call_event.set()
            await release_event.wait()
            return fake_signal

        analyzer = MagicMock()
        analyzer.analyze = _slow_analyze

        with patch("app.mcp_server._load_analyzer", return_value=analyzer):
            with patch.object(mcp_server, "_LOCK_TIMEOUT_SECONDS", 0.05):
                task1 = asyncio.create_task(run_wyckoff("AAPL"))
                # Wait for first call to acquire lock
                await call_event.wait()
                # Second call should timeout
                result2 = await run_wyckoff("AAPL")
                # Now release first call
                release_event.set()
                result1 = await task1

        assert result2 == {"error": "Analysis in progress for this symbol"}
        assert result1["direction"] == "bullish"

    def test_max_response_bytes_constant(self):
        assert _MAX_RESPONSE_BYTES == 100_000

    def test_max_watchlist_size_constant(self):
        assert _MAX_WATCHLIST_SIZE == 50

    def test_lock_timeout_seconds_constant(self):
        assert _LOCK_TIMEOUT_SECONDS == 60

    @pytest.mark.asyncio
    async def test_watchlist_add_50_then_full(self, mock_db):
        """At exactly 50 symbols, adding another fails."""
        mock_db.fetch_one = AsyncMock(return_value={"cnt": 50})
        result = await watchlist_add("AAPL")
        assert "maximum capacity" in result["error"]

    @pytest.mark.asyncio
    async def test_watchlist_add_49_succeeds(self, mock_db):
        """At 49 symbols, adding is allowed."""
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"cnt": 49}, None, {"max_pos": 48},
        ])
        mock_db.execute = AsyncMock()
        result = await watchlist_add("AAPL")
        assert result["added"] == "AAPL"

    @pytest.mark.asyncio
    async def test_open_zero_no_percent_change(self, mock_db):
        """watchlist_list: when open=0, price_change_percent stays None."""
        mock_db.fetch_all.return_value = [
            {"symbol": "AAPL", "group_name": "default",
             "sort_order": 0, "added_at": None, "updated_at": None},
        ]
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"close": 100.0, "open": 0},  # open=0 => no pcp
            None,  # no analysis
        ])
        result = await watchlist_list()
        assert result["tickers"][0]["price_change_percent"] is None

    @pytest.mark.asyncio
    async def test_macro_history_accepts_underscored_indicators(self, mock_cache):
        mock_cache.get_macro_indicator = AsyncMock(
            return_value=_cached({}))
        result = await get_macro_history("T10Y2Y")
        assert result["indicator"] == "T10Y2Y"
