"""Tests for TASK-API-002: Ticker endpoint at /api/ticker/{symbol}.

Validates symbol validation, price response structure, fallback/error handling,
query parameters (period, include_history), OHLCV history, market open detection,
asset type inference, price block construction, and edge cases.

Run with: ``pytest tests/test_ticker_endpoint.py -v``
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.data.cache_types import CachedResult
from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_ET = ZoneInfo("America/New_York")

_SAMPLE_QUOTE: dict = {
    "current_price": 185.50,
    "open": 184.00,
    "high": 186.20,
    "low": 183.80,
    "previous_close": 183.90,
    "change": 1.60,
    "percent_change": 0.87,
    "volume": 42_000_000,
    "market_cap": 2_900_000_000_000,
}

_SAMPLE_PROFILE: dict = {
    "name": "Apple Inc",
    "exchange": "NASDAQ",
    "currency": "USD",
    "industry": "Technology",
    "symbol": "AAPL",
}

_SAMPLE_FINANCIALS: dict = {
    "avg_volume_10d": 50_000_000,
    "week_52_high": 199.62,
    "week_52_low": 143.90,
    "market_cap": 2_900_000_000_000,
}

_SAMPLE_HISTORY: list[dict] = [
    {"date": "2026-02-03", "open": 182.0, "high": 184.0, "low": 181.0, "close": 183.5, "volume": 35_000_000},
    {"date": "2026-02-04", "open": 183.5, "high": 185.0, "low": 182.5, "close": 184.2, "volume": 38_000_000},
    {"date": "2026-02-05", "open": 184.2, "high": 186.0, "low": 183.0, "close": 185.5, "volume": 42_000_000},
]


def _make_cached_result(data, **overrides):
    """Build a CachedResult with sensible defaults."""
    defaults = dict(
        data=data,
        data_type="price",
        cache_key="price:AAPL:latest",
        source="finnhub",
        is_cached=True,
        is_stale=False,
        fetched_at="2026-02-07T16:00:00+00:00",
        cache_age_seconds=42.0,
        cache_age_human="42s ago",
        ttl_seconds=900,
        expires_at="2026-02-07T16:15:00+00:00",
    )
    defaults.update(overrides)
    return CachedResult(**defaults)


def _patch_ticker(
    price_data=None,
    price_result="default",
    profile=None,
    financials=None,
    finnhub_enabled=True,
    hist_data=None,
    hist_result="default",
    profile_raises=False,
    financials_raises=False,
):
    """Return a tuple of (cache_patcher, finnhub_patcher) context managers.

    ``price_result="default"`` uses ``_make_cached_result(price_data or _SAMPLE_QUOTE)``.
    ``price_result=None`` means get_price returns None.
    """
    if price_result == "default":
        if price_data is None:
            price_data = dict(_SAMPLE_QUOTE)
        cr = _make_cached_result(price_data)
    else:
        cr = price_result

    cache_mock = MagicMock()
    cache_mock.get_price = AsyncMock(return_value=cr)

    if hist_result == "default" and hist_data is not None:
        hist_cr = _make_cached_result(hist_data, data_type="historical", cache_key="hist:AAPL:1d")
    elif hist_result is None:
        hist_cr = None
    elif hist_result == "default":
        hist_cr = None
    else:
        hist_cr = hist_result
    cache_mock.get_historical_prices = AsyncMock(return_value=hist_cr)

    finnhub_mock = MagicMock()
    type(finnhub_mock).is_enabled = PropertyMock(return_value=finnhub_enabled)

    if profile_raises:
        finnhub_mock.get_company_profile = AsyncMock(side_effect=Exception("profile error"))
    else:
        finnhub_mock.get_company_profile = AsyncMock(return_value=profile)

    if financials_raises:
        finnhub_mock.get_basic_financials = AsyncMock(side_effect=Exception("financials error"))
    else:
        finnhub_mock.get_basic_financials = AsyncMock(return_value=financials)

    cache_patcher = patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock)
    finnhub_patcher = patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock)

    return cache_patcher, finnhub_patcher


def _get(symbol, **params):
    """Shorthand for GET /api/ticker/{symbol}."""
    return client.get(f"/api/ticker/{symbol}", params=params)


# ===================================================================
# 1. Symbol Validation (15+ tests)
# ===================================================================
class TestSymbolValidation:
    """Verify symbol validation: stripping, uppercasing, regex, 400 errors."""

    @pytest.mark.parametrize(
        "symbol",
        ["AAPL", "MSFT", "GOOG", "X", "A", "Z"],
        ids=["aapl", "msft", "goog", "single-X", "single-A", "single-Z"],
    )
    def test_valid_simple_symbols_return_200(self, symbol):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE, financials=_SAMPLE_FINANCIALS)
        with cp, fp:
            resp = _get(symbol)
        assert resp.status_code == 200

    def test_valid_symbol_brk_dot_b(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("BRK.B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.B"

    def test_valid_symbol_bf_dash_b(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("BF-B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BF-B"

    def test_valid_symbol_numeric_chars(self):
        """Symbols with digits are valid (e.g. BRK2, 0700.HK style)."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("BRK2")
        assert resp.status_code == 200

    def test_valid_symbol_ten_chars_max(self):
        """A 10-character alphanumeric symbol is at the boundary."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("ABCDEFGHIJ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "ABCDEFGHIJ"

    def test_case_normalization_lowercase(self):
        """Lowercase input is uppercased."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("aapl")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_case_normalization_mixed(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("aApL")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping_spaces(self):
        """Leading/trailing spaces are stripped."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get(" AAPL ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping_url_encoded_spaces(self):
        """URL-encoded leading/trailing spaces are stripped by the endpoint."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            # %20 encodes a space; FastAPI decodes URL params before routing
            resp = client.get("/api/ticker/%20MSFT%20")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "MSFT"

    def test_invalid_empty_string(self):
        """Empty symbol does not match /{symbol} route -- returns 404 (Not Found)."""
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("")
        # FastAPI route /{symbol} requires a non-empty path segment.
        # Empty string resolves to /api/ticker/ which has no route.
        assert resp.status_code == 404

    def test_invalid_spaces_only(self):
        """Symbol of only spaces returns 400 (validated then rejected)."""
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("   ")
        # URL-encoded spaces reach the route, _validate_symbol strips to empty → 400.
        assert resp.status_code == 400

    def test_invalid_special_chars_exclamation(self):
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("!!!")
        assert resp.status_code == 400

    def test_invalid_special_chars_at_sign(self):
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("AA@L")
        assert resp.status_code == 400

    def test_invalid_special_chars_dollar(self):
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("$AAPL")
        assert resp.status_code == 400

    def test_invalid_too_long_eleven_chars(self):
        """11 characters exceeds the 10 character limit."""
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("ABCDEFGHIJK")
        assert resp.status_code == 400

    def test_invalid_too_long_twenty_chars(self):
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("A" * 20)
        assert resp.status_code == 400

    def test_invalid_contains_space_middle(self):
        """Symbol with embedded space fails regex."""
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("AA PL")
        assert resp.status_code == 400

    def test_invalid_contains_slash(self):
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("AA/PL")
        # Slash in URL will change routing; likely 404 (looking for /api/ticker/AA/PL)
        assert resp.status_code in (400, 404)

    def test_400_body_has_error_key(self):
        """400 response body includes error detail."""
        cp, fp = _patch_ticker()
        with cp, fp:
            resp = _get("!!!")
        body = resp.json()
        assert "error" in body


# ===================================================================
# 2. Price Response Structure (10+ tests)
# ===================================================================
class TestPriceResponseStructure:
    """Verify the shape and content of a successful ticker response."""

    def _get_response(self, **patch_kwargs):
        defaults = dict(profile=_SAMPLE_PROFILE, financials=_SAMPLE_FINANCIALS)
        defaults.update(patch_kwargs)
        cp, fp = _patch_ticker(**defaults)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        return resp.json()

    def test_top_level_keys_present(self):
        body = self._get_response()
        required = {"symbol", "name", "exchange", "currency", "asset_type",
                     "price", "data_source", "data_timestamp", "data_age_seconds",
                     "is_market_open", "cache_hit"}
        assert required.issubset(set(body.keys()))

    def test_symbol_is_uppercase(self):
        body = self._get_response()
        assert body["symbol"] == "AAPL"

    def test_name_from_profile(self):
        body = self._get_response()
        assert body["name"] == "Apple Inc"

    def test_exchange_from_profile(self):
        body = self._get_response()
        assert body["exchange"] == "NASDAQ"

    def test_currency_from_profile(self):
        body = self._get_response()
        assert body["currency"] == "USD"

    def test_data_source_matches_cached_result(self):
        body = self._get_response()
        assert body["data_source"] == "finnhub"

    def test_data_source_yfinance(self):
        cr = _make_cached_result(_SAMPLE_QUOTE, source="yfinance")
        body = self._get_response(price_result=cr)
        assert body["data_source"] == "yfinance"

    def test_data_timestamp_matches_cached_result(self):
        body = self._get_response()
        assert body["data_timestamp"] == "2026-02-07T16:00:00+00:00"

    def test_data_age_seconds_matches_cached_result(self):
        body = self._get_response()
        assert body["data_age_seconds"] == 42.0

    def test_data_age_seconds_custom_value(self):
        cr = _make_cached_result(_SAMPLE_QUOTE, cache_age_seconds=120.5)
        body = self._get_response(price_result=cr)
        assert body["data_age_seconds"] == 120.5

    def test_cache_hit_true(self):
        body = self._get_response()
        assert body["cache_hit"] is True

    def test_cache_hit_false(self):
        cr = _make_cached_result(_SAMPLE_QUOTE, is_cached=False)
        body = self._get_response(price_result=cr)
        assert body["cache_hit"] is False

    def test_is_market_open_is_boolean(self):
        body = self._get_response()
        assert isinstance(body["is_market_open"], bool)

    def test_price_is_dict(self):
        body = self._get_response()
        assert isinstance(body["price"], dict)

    def test_no_ohlcv_key_by_default(self):
        """Without include_history, ohlcv key should not be present."""
        body = self._get_response()
        assert "ohlcv" not in body


# ===================================================================
# 3. Fallback and Error Handling (10+ tests)
# ===================================================================
class TestFallbackAndErrorHandling:
    """Verify error responses and graceful degradation."""

    def test_price_none_returns_404(self):
        cp, fp = _patch_ticker(price_result=None)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 404

    def test_404_body_contains_error_key(self):
        cp, fp = _patch_ticker(price_result=None)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert "error" in body

    def test_404_body_detail_has_symbol(self):
        """The 404 detail dict contains the symbol."""
        cp, fp = _patch_ticker(price_result=None)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        # The global exception handler wraps detail in {"error": detail, "status_code": ...}
        # The detail itself is {"error": "No data available for symbol", "symbol": "AAPL"}
        error_detail = body.get("error", {})
        assert isinstance(error_detail, dict), f"Expected dict, got {type(error_detail)}: {error_detail}"
        assert error_detail.get("symbol") == "AAPL"

    def test_404_body_detail_has_error_message(self):
        cp, fp = _patch_ticker(price_result=None)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        error_detail = body.get("error", {})
        assert isinstance(error_detail, dict), f"Expected dict, got {type(error_detail)}: {error_detail}"
        assert "No data available" in error_detail.get("error", "")

    def test_finnhub_disabled_still_returns_price(self):
        """With finnhub disabled, profile/financials are None but price from cache succeeds."""
        cp, fp = _patch_ticker(finnhub_enabled=False)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] is None
        assert body["exchange"] is None

    def test_finnhub_disabled_currency_defaults_usd(self):
        cp, fp = _patch_ticker(finnhub_enabled=False)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["currency"] == "USD"

    def test_profile_exception_still_200(self):
        """If profile fetch raises, response still succeeds with name=None."""
        cp, fp = _patch_ticker(
            financials=_SAMPLE_FINANCIALS,
            profile_raises=True,
        )
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] is None
        assert body["exchange"] is None

    def test_financials_exception_still_200(self):
        """If financials fetch raises, price block has fallback values."""
        cp, fp = _patch_ticker(
            profile=_SAMPLE_PROFILE,
            financials_raises=True,
        )
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        # With financials=None, market_cap falls back to quote's market_cap
        assert body["price"]["market_cap"] == _SAMPLE_QUOTE["market_cap"]

    def test_both_profile_and_financials_exception(self):
        cp, fp = _patch_ticker(profile_raises=True, financials_raises=True)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] is None
        assert body["price"]["avg_volume_10d"] is None

    def test_profile_none_response_still_200(self):
        """Profile returning None (not raising) still yields 200."""
        cp, fp = _patch_ticker(profile=None, financials=_SAMPLE_FINANCIALS)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        assert resp.json()["name"] is None

    def test_financials_none_market_cap_from_quote(self):
        """When financials is None, market_cap comes from yfinance quote data."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE, financials=None)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["price"]["market_cap"] == _SAMPLE_QUOTE["market_cap"]

    def test_cache_get_price_raises_returns_404(self):
        """If cache.get_price() raises, endpoint treats it as no data (404)."""
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(side_effect=Exception("database unavailable"))
        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=False)
        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            resp = _get("AAPL")
        assert resp.status_code == 404

    def test_cache_get_historical_raises_returns_empty_ohlcv(self):
        """If cache.get_historical_prices() raises, endpoint returns empty ohlcv."""
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(side_effect=Exception("db error"))
        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=False)
        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            resp = _get("AAPL", include_history="true")
        assert resp.status_code == 200
        assert resp.json()["ohlcv"] == []


# ===================================================================
# 4. Query Parameters (10+ tests)
# ===================================================================
class TestQueryParameters:
    """Verify period and include_history query parameters."""

    def test_default_period_is_1d(self):
        """Without specifying period, default is 1d mapped to yfinance '1d'."""
        hist_cr = _make_cached_result(_SAMPLE_HISTORY, data_type="historical")
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(return_value=hist_cr)
        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=True)
        finnhub_mock.get_company_profile = AsyncMock(return_value=_SAMPLE_PROFILE)
        finnhub_mock.get_basic_financials = AsyncMock(return_value=None)
        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            resp = _get("AAPL", include_history="true")
        assert resp.status_code == 200
        cache_mock.get_historical_prices.assert_called_once_with("AAPL", period="1d", interval="1d")

    def test_include_history_false_no_ohlcv(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL", include_history="false")
        body = resp.json()
        assert "ohlcv" not in body

    def test_include_history_default_false(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert "ohlcv" not in body

    def test_include_history_true_adds_ohlcv(self):
        cp, fp = _patch_ticker(
            profile=_SAMPLE_PROFILE,
            hist_data=_SAMPLE_HISTORY,
        )
        with cp, fp:
            resp = _get("AAPL", include_history="true")
        body = resp.json()
        assert "ohlcv" in body
        assert isinstance(body["ohlcv"], list)

    @pytest.mark.parametrize(
        "period_val",
        ["1d", "1w", "1m", "3m", "6m", "1y", "5y"],
        ids=["1d", "1w", "1m", "3m", "6m", "1y", "5y"],
    )
    def test_all_period_values_accepted(self, period_val):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL", period=period_val)
        assert resp.status_code == 200

    def test_invalid_period_returns_422(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL", period="invalid")
        assert resp.status_code == 422

    def test_invalid_period_2w_returns_422(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL", period="2w")
        assert resp.status_code == 422

    @pytest.mark.parametrize(
        "user_period, yf_period",
        [
            ("1d", "1d"),
            ("1w", "5d"),
            ("1m", "1mo"),
            ("3m", "3mo"),
            ("6m", "6mo"),
            ("1y", "1y"),
            ("5y", "5y"),
        ],
        ids=["1d->1d", "1w->5d", "1m->1mo", "3m->3mo", "6m->6mo", "1y->1y", "5y->5y"],
    )
    def test_period_maps_correctly(self, user_period, yf_period):
        """Verify that user-facing period is mapped to the correct yfinance period."""
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(return_value=None)

        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=True)
        finnhub_mock.get_company_profile = AsyncMock(return_value=_SAMPLE_PROFILE)
        finnhub_mock.get_basic_financials = AsyncMock(return_value=None)

        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            _get("AAPL", period=user_period, include_history="true")

        cache_mock.get_historical_prices.assert_called_once_with(
            "AAPL", period=yf_period, interval="1d",
        )

    def test_include_history_true_calls_get_historical(self):
        """With include_history=true, cache.get_historical_prices is invoked."""
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(return_value=None)

        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=True)
        finnhub_mock.get_company_profile = AsyncMock(return_value=None)
        finnhub_mock.get_basic_financials = AsyncMock(return_value=None)

        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            _get("AAPL", include_history="true")

        cache_mock.get_historical_prices.assert_called_once()

    def test_include_history_false_does_not_call_historical(self):
        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(return_value=None)

        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=True)
        finnhub_mock.get_company_profile = AsyncMock(return_value=None)
        finnhub_mock.get_basic_financials = AsyncMock(return_value=None)

        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            _get("AAPL", include_history="false")

        cache_mock.get_historical_prices.assert_not_called()


# ===================================================================
# 5. OHLCV History (10+ tests)
# ===================================================================
class TestOHLCVHistory:
    """Verify OHLCV array shape and edge cases."""

    def _get_with_history(self, hist_data=None, hist_result="default", period="1d"):
        if hist_result == "default" and hist_data is not None:
            hr = _make_cached_result(hist_data, data_type="historical", cache_key="hist:AAPL:1d")
        elif hist_result is not None and hist_result != "default":
            hr = hist_result
        else:
            hr = None

        cache_mock = MagicMock()
        cache_mock.get_price = AsyncMock(return_value=_make_cached_result(_SAMPLE_QUOTE))
        cache_mock.get_historical_prices = AsyncMock(return_value=hr)

        finnhub_mock = MagicMock()
        type(finnhub_mock).is_enabled = PropertyMock(return_value=True)
        finnhub_mock.get_company_profile = AsyncMock(return_value=_SAMPLE_PROFILE)
        finnhub_mock.get_basic_financials = AsyncMock(return_value=None)

        with patch("app.api.routes.ticker.get_cache_manager", return_value=cache_mock), \
             patch("app.api.routes.ticker.get_finnhub_client", return_value=finnhub_mock):
            resp = _get("AAPL", include_history="true", period=period)
        return resp.json()

    def test_ohlcv_present_when_history_requested(self):
        body = self._get_with_history(hist_data=_SAMPLE_HISTORY)
        assert "ohlcv" in body

    def test_ohlcv_is_list(self):
        body = self._get_with_history(hist_data=_SAMPLE_HISTORY)
        assert isinstance(body["ohlcv"], list)

    def test_ohlcv_length_matches_input(self):
        body = self._get_with_history(hist_data=_SAMPLE_HISTORY)
        assert len(body["ohlcv"]) == len(_SAMPLE_HISTORY)

    def test_ohlcv_bar_has_six_keys(self):
        body = self._get_with_history(hist_data=_SAMPLE_HISTORY)
        expected_keys = {"date", "open", "high", "low", "close", "volume"}
        for bar in body["ohlcv"]:
            assert set(bar.keys()) == expected_keys

    def test_ohlcv_bar_values_correct(self):
        body = self._get_with_history(hist_data=_SAMPLE_HISTORY)
        first = body["ohlcv"][0]
        assert first["date"] == "2026-02-03"
        assert first["open"] == 182.0
        assert first["high"] == 184.0
        assert first["low"] == 181.0
        assert first["close"] == 183.5
        assert first["volume"] == 35_000_000

    def test_ohlcv_empty_when_hist_result_none(self):
        """When cache.get_historical_prices returns None, ohlcv is []."""
        body = self._get_with_history(hist_data=None, hist_result=None)
        assert body["ohlcv"] == []

    def test_ohlcv_empty_when_hist_data_not_list(self):
        """When hist_result.data is not a list (e.g. a dict), ohlcv is []."""
        hr = _make_cached_result(
            {"error": "unexpected format"},
            data_type="historical",
            cache_key="hist:AAPL:1d",
        )
        body = self._get_with_history(hist_result=hr)
        assert body["ohlcv"] == []

    def test_ohlcv_empty_when_hist_data_is_string(self):
        hr = _make_cached_result("not-a-list", data_type="historical", cache_key="hist:AAPL:1d")
        body = self._get_with_history(hist_result=hr)
        assert body["ohlcv"] == []

    def test_ohlcv_empty_list_input_yields_empty_list(self):
        body = self._get_with_history(hist_data=[])
        assert body["ohlcv"] == []

    def test_ohlcv_single_bar(self):
        single = [{"date": "2026-02-07", "open": 185.0, "high": 186.0,
                    "low": 184.0, "close": 185.5, "volume": 30_000_000}]
        body = self._get_with_history(hist_data=single)
        assert len(body["ohlcv"]) == 1

    def test_ohlcv_bar_with_extra_keys_only_has_six(self):
        """Extra keys in source data should be dropped from ohlcv bars."""
        bars = [{"date": "2026-02-07", "open": 185.0, "high": 186.0,
                 "low": 184.0, "close": 185.5, "volume": 30_000_000,
                 "adj_close": 185.5, "dividends": 0.0}]
        body = self._get_with_history(hist_data=bars)
        assert len(body["ohlcv"]) == 1
        assert set(body["ohlcv"][0].keys()) == {"date", "open", "high", "low", "close", "volume"}

    def test_ohlcv_bar_with_missing_keys_returns_none_values(self):
        """If a bar dict lacks a key, .get() returns None."""
        bars = [{"date": "2026-02-07"}]
        body = self._get_with_history(hist_data=bars)
        bar = body["ohlcv"][0]
        assert bar["date"] == "2026-02-07"
        assert bar["open"] is None
        assert bar["close"] is None


# ===================================================================
# 6. Market Open Detection (8+ tests)
# ===================================================================
class TestMarketOpenDetection:
    """Verify is_market_open via mocked datetime."""

    def _get_with_time(self, fake_now):
        """Make a request with datetime.now patched to return fake_now."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp, \
             patch("app.api.routes.ticker.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            # Preserve .replace functionality on the fake datetime
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            resp = _get("AAPL")
        return resp.json()

    def test_weekday_during_market_hours_is_open(self):
        # Wednesday 12:00 ET
        fake = datetime(2026, 2, 4, 12, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is True

    def test_weekday_before_open_is_closed(self):
        # Wednesday 9:00 ET (before 9:30)
        fake = datetime(2026, 2, 4, 9, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_weekday_after_close_is_closed(self):
        # Wednesday 16:30 ET (after 16:00)
        fake = datetime(2026, 2, 4, 16, 30, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_at_exactly_930_is_open(self):
        # Wednesday 9:30:00 ET -- should be open (market_open <= now)
        fake = datetime(2026, 2, 4, 9, 30, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is True

    def test_at_exactly_1600_is_closed(self):
        # Wednesday 16:00:00 ET -- should be closed (now < market_close, not <=)
        fake = datetime(2026, 2, 4, 16, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_saturday_is_closed(self):
        # Saturday 12:00 ET
        fake = datetime(2026, 2, 7, 12, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_sunday_is_closed(self):
        # Sunday 12:00 ET
        fake = datetime(2026, 2, 8, 12, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_at_929_is_closed(self):
        # Wednesday 9:29:59 ET -- should be closed
        fake = datetime(2026, 2, 4, 9, 29, 59, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is False

    def test_at_1559_is_open(self):
        # Wednesday 15:59:59 ET -- should be open
        fake = datetime(2026, 2, 4, 15, 59, 59, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is True

    def test_friday_during_hours_is_open(self):
        # Friday 14:00 ET
        fake = datetime(2026, 2, 6, 14, 0, 0, tzinfo=_ET)
        body = self._get_with_time(fake)
        assert body["is_market_open"] is True


# ===================================================================
# 7. Asset Type Inference (8+ tests)
# ===================================================================
class TestAssetTypeInference:
    """Verify _infer_asset_type through HTTP responses."""

    def _get_asset_type(self, symbol="AAPL", profile=None):
        cp, fp = _patch_ticker(profile=profile)
        with cp, fp:
            resp = _get(symbol)
        assert resp.status_code == 200
        return resp.json()["asset_type"]

    def test_profile_with_industry_returns_stock(self):
        profile = {"name": "Apple", "exchange": "NASDAQ", "industry": "Technology"}
        assert self._get_asset_type(profile=profile) == "stock"

    def test_profile_with_crypto_exchange_returns_crypto(self):
        profile = {"name": "Bitcoin", "exchange": "CRYPTO EXCHANGE", "industry": ""}
        assert self._get_asset_type(profile=profile) == "crypto"

    def test_profile_with_crypto_in_exchange_case_insensitive(self):
        profile = {"name": "Ethereum", "exchange": "Crypto Market", "industry": ""}
        # exchange.upper() contains "CRYPTO"
        assert self._get_asset_type(profile=profile) == "crypto"

    def test_no_profile_normal_symbol_returns_stock(self):
        assert self._get_asset_type(symbol="AAPL", profile=None) == "stock"

    def test_no_profile_usd_suffix_returns_crypto(self):
        assert self._get_asset_type(symbol="BTC-USD", profile=None) == "crypto"

    def test_no_profile_eth_usd_returns_crypto(self):
        assert self._get_asset_type(symbol="ETH-USD", profile=None) == "crypto"

    def test_no_profile_short_dash_symbol_returns_stock(self):
        """BF-B has a dash but is <= 5 chars, so heuristic doesn't flag as crypto."""
        # The heuristic: "-USD" in symbol OR ("-" in symbol AND len(symbol) > 5)
        # "BF-B" has len=4 and no "-USD", so should return "stock"
        assert self._get_asset_type(symbol="BF-B", profile=None) == "stock"

    def test_brk_dot_b_no_profile_returns_stock(self):
        """BRK.B with no profile -- no dash, returns stock."""
        assert self._get_asset_type(symbol="BRK.B", profile=None) == "stock"

    def test_profile_with_exchange_but_no_industry_no_crypto(self):
        """Profile has exchange but no industry and not crypto exchange."""
        profile = {"name": "Test Co", "exchange": "NYSE", "industry": ""}
        # No industry (empty string is falsy), so falls through to heuristic
        # But heuristic for "AAPL" with no dash returns "stock"
        assert self._get_asset_type(profile=profile) == "stock"

    def test_long_dash_symbol_no_profile_returns_crypto(self):
        """A 6+ char symbol with a dash triggers crypto heuristic."""
        # "DOGE-USD" has len > 5 and has "-"
        assert self._get_asset_type(symbol="DOGEEE-X", profile=None) == "crypto"


# ===================================================================
# 8. Price Block Construction (8+ tests)
# ===================================================================
class TestPriceBlockConstruction:
    """Verify the price sub-object from _extract_price_block."""

    def _get_price(self, quote=None, financials=None, profile=None):
        if quote is None:
            quote = dict(_SAMPLE_QUOTE)
        cp, fp = _patch_ticker(
            price_data=quote,
            profile=profile or _SAMPLE_PROFILE,
            financials=financials,
        )
        with cp, fp:
            resp = _get("AAPL")
        return resp.json()["price"]

    def test_current_price(self):
        price = self._get_price()
        assert price["current"] == 185.50

    def test_open_price(self):
        price = self._get_price()
        assert price["open"] == 184.00

    def test_high_price(self):
        price = self._get_price()
        assert price["high"] == 186.20

    def test_low_price(self):
        price = self._get_price()
        assert price["low"] == 183.80

    def test_previous_close(self):
        price = self._get_price()
        assert price["previous_close"] == 183.90

    def test_change(self):
        price = self._get_price()
        assert price["change"] == 1.60

    def test_change_percent(self):
        price = self._get_price()
        assert price["change_percent"] == 0.87

    def test_volume_from_quote(self):
        price = self._get_price()
        assert price["volume"] == 42_000_000

    def test_with_financials_avg_volume_10d(self):
        price = self._get_price(financials=_SAMPLE_FINANCIALS)
        assert price["avg_volume_10d"] == 50_000_000

    def test_with_financials_52w_high(self):
        price = self._get_price(financials=_SAMPLE_FINANCIALS)
        assert price["fifty_two_week_high"] == 199.62

    def test_with_financials_52w_low(self):
        price = self._get_price(financials=_SAMPLE_FINANCIALS)
        assert price["fifty_two_week_low"] == 143.90

    def test_with_financials_market_cap_from_financials(self):
        price = self._get_price(financials=_SAMPLE_FINANCIALS)
        assert price["market_cap"] == 2_900_000_000_000

    def test_without_financials_avg_volume_is_none(self):
        price = self._get_price(financials=None)
        assert price["avg_volume_10d"] is None

    def test_without_financials_52w_high_is_none(self):
        price = self._get_price(financials=None)
        assert price["fifty_two_week_high"] is None

    def test_without_financials_52w_low_is_none(self):
        price = self._get_price(financials=None)
        assert price["fifty_two_week_low"] is None

    def test_without_financials_market_cap_from_quote(self):
        """When financials is None, market_cap falls back to quote.market_cap."""
        price = self._get_price(financials=None)
        assert price["market_cap"] == _SAMPLE_QUOTE["market_cap"]

    def test_without_financials_no_market_cap_in_quote(self):
        """If neither financials nor quote has market_cap, result is None."""
        quote = dict(_SAMPLE_QUOTE)
        del quote["market_cap"]
        price = self._get_price(quote=quote, financials=None)
        assert price["market_cap"] is None

    def test_volume_none_when_not_in_quote(self):
        quote = dict(_SAMPLE_QUOTE)
        del quote["volume"]
        price = self._get_price(quote=quote)
        assert price["volume"] is None

    def test_all_price_keys_present(self):
        price = self._get_price(financials=_SAMPLE_FINANCIALS)
        expected = {"current", "open", "high", "low", "previous_close", "change",
                     "change_percent", "volume", "avg_volume_10d",
                     "fifty_two_week_high", "fifty_two_week_low", "market_cap"}
        assert expected.issubset(set(price.keys()))


# ===================================================================
# 9. Edge Cases (5+ tests)
# ===================================================================
class TestEdgeCases:
    """Verify edge cases and boundary conditions."""

    def test_ten_char_symbol_accepted(self):
        """Max-length symbol (10 chars) is valid."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("ABCDEFGHIJ")
        assert resp.status_code == 200

    def test_symbol_with_dot_brk_b(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("BRK.B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.B"

    def test_symbol_with_dash_bf_b(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("BF-B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BF-B"

    def test_post_method_not_allowed(self):
        """POST to the ticker endpoint should return 405."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = client.post("/api/ticker/AAPL")
        assert resp.status_code == 405

    def test_put_method_not_allowed(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = client.put("/api/ticker/AAPL")
        assert resp.status_code == 405

    def test_delete_method_not_allowed(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = client.delete("/api/ticker/AAPL")
        assert resp.status_code == 405

    def test_single_char_symbol(self):
        """Minimum valid symbol (1 char)."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("X")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "X"

    def test_numeric_only_symbol(self):
        """Pure numeric symbol (valid per regex)."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("1234567890")
        assert resp.status_code == 200

    def test_response_content_type_json(self):
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_404_for_unknown_symbol_no_data(self):
        """A valid symbol with no cached data returns 404."""
        cp, fp = _patch_ticker(price_result=None)
        with cp, fp:
            resp = _get("ZZZZZZ")
        assert resp.status_code == 404


# ===================================================================
# 10. Combined / Integration-style tests (additional coverage)
# ===================================================================
class TestCombinedScenarios:
    """End-to-end style tests that exercise multiple features together."""

    def test_full_response_with_history_and_financials(self):
        """Full happy path: price + profile + financials + history."""
        cp, fp = _patch_ticker(
            profile=_SAMPLE_PROFILE,
            financials=_SAMPLE_FINANCIALS,
            hist_data=_SAMPLE_HISTORY,
        )
        with cp, fp:
            resp = _get("AAPL", include_history="true", period="1m")
        assert resp.status_code == 200
        body = resp.json()

        # Top-level
        assert body["symbol"] == "AAPL"
        assert body["name"] == "Apple Inc"
        assert body["exchange"] == "NASDAQ"
        assert body["currency"] == "USD"
        assert body["asset_type"] == "stock"
        assert body["data_source"] == "finnhub"
        assert body["cache_hit"] is True
        assert isinstance(body["is_market_open"], bool)

        # Price
        assert body["price"]["current"] == 185.50
        assert body["price"]["fifty_two_week_high"] == 199.62

        # History
        assert len(body["ohlcv"]) == 3

    def test_degraded_response_finnhub_disabled(self):
        """Finnhub disabled: still returns price from cache, profile fields are None."""
        cp, fp = _patch_ticker(finnhub_enabled=False)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] is None
        assert body["exchange"] is None
        assert body["currency"] == "USD"
        assert body["price"]["current"] == 185.50

    def test_yfinance_source_response(self):
        """Verify data_source reflects yfinance when price came from that source."""
        cr = _make_cached_result(_SAMPLE_QUOTE, source="yfinance")
        cp, fp = _patch_ticker(price_result=cr, profile=None, finnhub_enabled=False)
        with cp, fp:
            resp = _get("MSFT")
        body = resp.json()
        assert body["data_source"] == "yfinance"
        assert body["symbol"] == "MSFT"

    def test_stale_cache_response(self):
        """Stale cache data still returns 200 with correct metadata."""
        cr = _make_cached_result(
            _SAMPLE_QUOTE,
            is_stale=True,
            is_cached=True,
            cache_age_seconds=999.0,
            cache_age_human="16m ago",
        )
        cp, fp = _patch_ticker(price_result=cr, profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_age_seconds"] == 999.0
        assert body["cache_hit"] is True

    def test_crypto_symbol_with_profile(self):
        """Crypto exchange in profile -> asset_type=crypto."""
        crypto_profile = {"name": "Bitcoin", "exchange": "CRYPTO", "currency": "USD", "industry": ""}
        cp, fp = _patch_ticker(profile=crypto_profile)
        with cp, fp:
            resp = _get("BTC-USD")
        body = resp.json()
        assert body["asset_type"] == "crypto"
        assert body["symbol"] == "BTC-USD"

    def test_concurrent_profile_and_financials_failure(self):
        """Both supplementary calls fail, but price is still returned."""
        cp, fp = _patch_ticker(
            profile_raises=True,
            financials_raises=True,
        )
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["price"]["current"] == 185.50
        assert body["name"] is None
        assert body["price"]["avg_volume_10d"] is None

    def test_empty_quote_data(self):
        """If quote data is an empty dict, price fields are all None."""
        cp, fp = _patch_ticker(price_data={}, profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["price"]["current"] is None
        assert body["price"]["open"] is None
        assert body["price"]["volume"] is None

    def test_history_with_no_bars_and_profile(self):
        """History returns empty list, profile present."""
        cp, fp = _patch_ticker(
            profile=_SAMPLE_PROFILE,
            financials=_SAMPLE_FINANCIALS,
            hist_data=[],
        )
        with cp, fp:
            resp = _get("AAPL", include_history="true")
        body = resp.json()
        assert body["ohlcv"] == []
        assert body["name"] == "Apple Inc"

    def test_period_without_history_flag_ignored(self):
        """Sending period without include_history does not add ohlcv."""
        cp, fp = _patch_ticker(profile=_SAMPLE_PROFILE)
        with cp, fp:
            resp = _get("AAPL", period="5y")
        body = resp.json()
        assert "ohlcv" not in body

    def test_multiple_requests_independent(self):
        """Two sequential requests return independent results."""
        cp1, fp1 = _patch_ticker(
            price_data={"current_price": 100},
            profile={"name": "CompA", "exchange": "NYSE", "currency": "USD", "industry": "Finance"},
        )
        with cp1, fp1:
            resp1 = _get("COMPA")

        cp2, fp2 = _patch_ticker(
            price_data={"current_price": 200},
            profile={"name": "CompB", "exchange": "NASDAQ", "currency": "EUR", "industry": "Tech"},
        )
        with cp2, fp2:
            resp2 = _get("COMPB")

        assert resp1.json()["price"]["current"] == 100
        assert resp1.json()["name"] == "CompA"
        assert resp2.json()["price"]["current"] == 200
        assert resp2.json()["name"] == "CompB"
