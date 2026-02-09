"""Tests for TASK-DATA-002: Finnhub API Client.

Validates FinnhubClient rate limiting, circuit breaker, response normalization,
all 8 API methods, error handling, and module-level singleton functions.

ALL HTTP calls are mocked -- no real Finnhub API requests are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_finnhub_client.py -v``
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.data.finnhub_client import (
    CircuitState,
    FinnhubClient,
    close_finnhub_client,
    get_finnhub_client,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_settings():
    """Settings with a valid test API key and default circuit breaker config."""
    settings = MagicMock()
    settings.finnhub_api_key = "test_api_key_12345"
    settings.circuit_breaker_failure_threshold = 3
    settings.circuit_breaker_window_seconds = 300
    settings.circuit_breaker_cooldown_seconds = 900
    return settings


@pytest.fixture
def mock_settings_no_key():
    """Settings with an empty API key (disabled mode)."""
    settings = MagicMock()
    settings.finnhub_api_key = ""
    settings.circuit_breaker_failure_threshold = 3
    settings.circuit_breaker_window_seconds = 300
    settings.circuit_breaker_cooldown_seconds = 900
    return settings


@pytest.fixture
def client(mock_settings):
    """FinnhubClient with mocked settings and a valid API key."""
    with patch("app.data.finnhub_client.get_settings", return_value=mock_settings):
        c = FinnhubClient()
    return c


@pytest.fixture
def disabled_client(mock_settings_no_key):
    """FinnhubClient with no API key (disabled)."""
    with patch("app.data.finnhub_client.get_settings", return_value=mock_settings_no_key):
        c = FinnhubClient()
    return c


def _make_response(json_data, status_code=200):
    """Build a mock httpx.Response with the given JSON and status code."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data

    if status_code >= 400:
        exc = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(spec=httpx.Request),
            response=resp,
        )
        resp.raise_for_status.side_effect = exc
    else:
        resp.raise_for_status.return_value = None

    return resp


# ===================================================================
# 1. Initialization & Configuration
# ===================================================================
class TestInitialization:
    """Client initialization, API key reading, and property defaults."""

    def test_reads_api_key_from_settings(self, client):
        """Client stores the API key from settings."""
        assert client._api_key == "test_api_key_12345"

    def test_is_enabled_true_with_key(self, client):
        """is_enabled is True when a non-empty API key is provided."""
        assert client.is_enabled is True

    def test_is_enabled_false_with_empty_key(self, disabled_client):
        """is_enabled is False when the API key is empty."""
        assert disabled_client.is_enabled is False

    def test_disabled_when_key_is_empty_string(self, disabled_client):
        """_enabled is False when the API key is an empty string."""
        assert disabled_client._enabled is False

    def test_logs_warning_when_disabled(self, mock_settings_no_key):
        """A warning is logged when the client is initialized without a key."""
        with patch("app.data.finnhub_client.get_settings", return_value=mock_settings_no_key):
            with patch("app.data.finnhub_client.logger") as mock_logger:
                FinnhubClient()
                mock_logger.warning.assert_called_once_with(
                    "Finnhub API key not configured -- client disabled"
                )

    def test_circuit_breaker_config_from_settings(self, client, mock_settings):
        """Circuit breaker configuration is read from settings."""
        assert client._cb_failure_threshold == mock_settings.circuit_breaker_failure_threshold
        assert client._cb_window_seconds == mock_settings.circuit_breaker_window_seconds
        assert client._cb_cooldown_seconds == mock_settings.circuit_breaker_cooldown_seconds

    def test_calls_remaining_starts_at_60(self, client):
        """calls_remaining starts at 60 (no calls made yet)."""
        assert client.calls_remaining == 60

    def test_circuit_state_starts_closed(self, client):
        """Circuit breaker starts in CLOSED state."""
        assert client.circuit_state == CircuitState.CLOSED


# ===================================================================
# 2. Disabled Mode
# ===================================================================
class TestDisabledMode:
    """All API methods must return None and make no HTTP calls when disabled."""

    @pytest.mark.asyncio
    async def test_get_quote_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_quote("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_candles_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_candles("AAPL", "D", 1700000000, 1700100000)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_company_news_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_company_news("AAPL", "2024-01-01", "2024-01-31")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_market_news_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_market_news()
        assert result is None

    @pytest.mark.asyncio
    async def test_get_basic_financials_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_basic_financials("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_company_profile_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_company_profile("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_economic_calendar_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.get_economic_calendar("2024-01-01", "2024-01-31")
        assert result is None

    @pytest.mark.asyncio
    async def test_search_symbol_returns_none_when_disabled(self, disabled_client):
        result = await disabled_client.search_symbol("apple")
        assert result is None

    @pytest.mark.asyncio
    async def test_no_http_calls_when_disabled(self, disabled_client):
        """No httpx.AsyncClient.get is called when the client is disabled."""
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            await disabled_client.get_quote("AAPL")
            await disabled_client.get_candles("AAPL", "D", 0, 0)
            await disabled_client.get_market_news()
            mock_get.assert_not_called()

    @pytest.mark.asyncio
    async def test_warning_logged_per_call_when_disabled(self, disabled_client):
        """A warning is logged for each call when disabled."""
        with patch("app.data.finnhub_client.logger") as mock_logger:
            await disabled_client.get_quote("AAPL")
            mock_logger.warning.assert_called_with(
                "Finnhub client disabled (no API key)"
            )


# ===================================================================
# 3. Rate Limiter
# ===================================================================
class TestRateLimiter:
    """Sliding-window rate limiter enforcing 60 requests per minute."""

    @pytest.mark.asyncio
    async def test_first_request_goes_through(self, client):
        """The first request proceeds without waiting."""
        mock_resp = _make_response({"c": 150.0})
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")
        assert result is not None

    @pytest.mark.asyncio
    async def test_60_requests_allowed_in_quick_succession(self, client):
        """60 requests in rapid succession should all go through."""
        mock_resp = _make_response({"c": 150.0, "d": 1.0, "dp": 0.67, "h": 151.0,
                                    "l": 149.0, "o": 149.5, "pc": 148.5, "t": 1700000000})
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            for _ in range(60):
                await client.get_quote("AAPL")
        assert client.calls_remaining == 0

    @pytest.mark.asyncio
    async def test_calls_remaining_decreases(self, client):
        """calls_remaining decreases after each call."""
        mock_resp = _make_response({"c": 150.0, "d": 1.0, "dp": 0.67, "h": 151.0,
                                    "l": 149.0, "o": 149.5, "pc": 148.5, "t": 1700000000})
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            assert client.calls_remaining == 60
            await client.get_quote("AAPL")
            assert client.calls_remaining == 59
            await client.get_quote("AAPL")
            assert client.calls_remaining == 58

    @pytest.mark.asyncio
    async def test_rate_limiter_uses_asyncio_lock(self, client):
        """The rate limiter uses an asyncio.Lock for concurrency safety."""
        assert isinstance(client._rate_lock, asyncio.Lock)

    @pytest.mark.asyncio
    async def test_old_calls_expire_after_60_seconds(self, client):
        """After 60 seconds, old call timestamps expire and slots reopen."""
        # Fill up the call timestamps 61 seconds in the past
        now = time.monotonic()
        client._call_timestamps = deque([now - 61] * 60)

        # All old calls should be expired, so calls_remaining should be 60
        assert client.calls_remaining == 60

    @pytest.mark.asyncio
    async def test_61st_request_blocks_until_window_slides(self, client):
        """The 61st request causes a sleep until the window slides."""
        mock_resp = _make_response({"c": 150.0, "d": 1.0, "dp": 0.67, "h": 151.0,
                                    "l": 149.0, "o": 149.5, "pc": 148.5, "t": 1700000000})

        # Pre-fill 60 timestamps at the "current" time
        now = time.monotonic()
        client._call_timestamps = deque([now] * 60)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            with patch("app.data.finnhub_client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                await client.get_quote("AAPL")
                # asyncio.sleep should have been called with a positive wait time
                mock_sleep.assert_called_once()
                wait_time = mock_sleep.call_args[0][0]
                assert wait_time > 0


# ===================================================================
# 4. Circuit Breaker
# ===================================================================
class TestCircuitBreaker:
    """Circuit breaker state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED."""

    def test_starts_in_closed_state(self, client):
        """Circuit breaker starts in CLOSED state."""
        assert client.circuit_state == CircuitState.CLOSED

    def test_stays_closed_after_one_failure(self, client):
        """One failure does not open the circuit (threshold is 3)."""
        client._record_failure()
        assert client.circuit_state == CircuitState.CLOSED

    def test_stays_closed_after_two_failures(self, client):
        """Two failures do not open the circuit (threshold is 3)."""
        client._record_failure()
        client._record_failure()
        assert client.circuit_state == CircuitState.CLOSED

    def test_opens_after_threshold_failures(self, client):
        """Three failures within the window open the circuit."""
        client._record_failure()
        client._record_failure()
        client._record_failure()
        assert client.circuit_state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_open_state_returns_none_without_http_call(self, client):
        """When circuit is OPEN, requests return None without HTTP calls."""
        # Force OPEN state
        client._circuit_state = CircuitState.OPEN
        client._circuit_opened_at = time.monotonic()

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            result = await client.get_quote("AAPL")
            assert result is None
            mock_get.assert_not_called()

    def test_transitions_to_half_open_after_cooldown(self, client):
        """After cooldown elapses, OPEN transitions to HALF_OPEN."""
        client._circuit_state = CircuitState.OPEN
        # Set opened_at to be beyond the cooldown period
        client._circuit_opened_at = time.monotonic() - client._cb_cooldown_seconds - 1

        allowed = client._check_circuit()
        assert allowed is True
        assert client.circuit_state == CircuitState.HALF_OPEN

    def test_half_open_to_closed_on_success(self, client):
        """A successful request in HALF_OPEN state transitions to CLOSED."""
        client._circuit_state = CircuitState.HALF_OPEN
        client._failure_timestamps = deque([time.monotonic()])

        client._record_success()

        assert client.circuit_state == CircuitState.CLOSED
        assert len(client._failure_timestamps) == 0

    def test_half_open_to_open_on_failure(self, client):
        """A failure in HALF_OPEN state transitions back to OPEN."""
        client._circuit_state = CircuitState.HALF_OPEN
        # Pre-fill with 2 recent failures so the 3rd triggers OPEN
        now = time.monotonic()
        client._failure_timestamps = deque([now, now])

        client._record_failure()

        assert client.circuit_state == CircuitState.OPEN

    def test_old_failures_outside_window_are_purged(self, client):
        """Failure timestamps older than the window are removed."""
        old_time = time.monotonic() - client._cb_window_seconds - 10
        client._failure_timestamps = deque([old_time, old_time])

        client._record_failure()

        # Only the new failure should remain (old ones purged)
        assert len(client._failure_timestamps) == 1
        assert client.circuit_state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_403_permanently_disables_client(self, client):
        """A 403 response permanently disables the client."""
        mock_resp = _make_response({}, status_code=403)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is None
        assert client._permanently_disabled is True
        assert client.is_enabled is False

    @pytest.mark.asyncio
    async def test_permanently_disabled_blocks_all_subsequent_calls(self, client):
        """After permanent disable, no further requests are attempted."""
        client._permanently_disabled = True

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock) as mock_get:
            result = await client.get_quote("AAPL")
            assert result is None
            mock_get.assert_not_called()


# ===================================================================
# 5. Response Normalization
# ===================================================================
class TestResponseNormalization:
    """camelCase-to-snake_case conversion and metadata tagging."""

    def test_camel_case_to_snake_case(self):
        """camelCase keys are converted to snake_case."""
        assert FinnhubClient._to_snake_case("marketCap") == "market_cap"

    def test_pascal_case_to_snake_case(self):
        """PascalCase is converted to snake_case."""
        assert FinnhubClient._to_snake_case("MarketCap") == "market_cap"

    def test_already_snake_case_unchanged(self):
        """snake_case keys are not modified."""
        assert FinnhubClient._to_snake_case("market_cap") == "market_cap"

    def test_single_word_unchanged(self):
        """A single lowercase word is not modified."""
        assert FinnhubClient._to_snake_case("price") == "price"

    def test_normalize_keys_dict(self):
        """Dict keys are recursively converted to snake_case."""
        data = {"marketCap": 1000, "peRatio": 25.0}
        result = FinnhubClient._normalize_keys(data)
        assert "market_cap" in result
        assert "pe_ratio" in result

    def test_normalize_keys_nested_dict(self):
        """Nested dicts have their keys converted recursively."""
        data = {"companyProfile": {"marketCap": 1000, "finnhubIndustry": "Tech"}}
        result = FinnhubClient._normalize_keys(data)
        assert "company_profile" in result
        assert "market_cap" in result["company_profile"]
        assert "finnhub_industry" in result["company_profile"]

    def test_normalize_keys_list_of_dicts(self):
        """Lists of dicts have all keys converted."""
        data = [{"marketCap": 1000}, {"peRatio": 25.0}]
        result = FinnhubClient._normalize_keys(data)
        assert "market_cap" in result[0]
        assert "pe_ratio" in result[1]

    def test_add_metadata_dict(self):
        """_source and _fetched_at are added to dict responses."""
        data = {"price": 150.0}
        result = FinnhubClient._add_metadata(data)
        assert result["_source"] == "finnhub"
        assert "_fetched_at" in result

    def test_add_metadata_list(self):
        """_source and _fetched_at are added to each dict in a list."""
        data = [{"headline": "News 1"}, {"headline": "News 2"}]
        result = FinnhubClient._add_metadata(data)
        for item in result:
            assert item["_source"] == "finnhub"
            assert "_fetched_at" in item

    def test_fetched_at_is_iso_format(self):
        """_fetched_at is an ISO-8601 timestamp string."""
        data = {"price": 150.0}
        result = FinnhubClient._add_metadata(data)
        fetched = result["_fetched_at"]
        # ISO format contains 'T' and ends with timezone info
        assert "T" in fetched


# ===================================================================
# 6. API Methods with Mocked Responses
# ===================================================================
class TestGetQuote:
    """get_quote() with mocked Finnhub /quote response."""

    @pytest.mark.asyncio
    async def test_get_quote_returns_mapped_fields(self, client):
        """get_quote maps raw single-letter keys to descriptive names."""
        raw_response = {
            "c": 150.0, "d": 1.5, "dp": 1.01, "h": 151.0,
            "l": 149.0, "o": 149.5, "pc": 148.5, "t": 1700000000,
        }
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is not None
        assert result["symbol"] == "AAPL"
        assert result["current_price"] == 150.0
        assert result["change"] == 1.5
        assert result["percent_change"] == 1.01
        assert result["high"] == 151.0
        assert result["low"] == 149.0
        assert result["open"] == 149.5
        assert result["previous_close"] == 148.5
        assert result["_source"] == "finnhub"
        # timestamp should be converted from unix to ISO
        assert result["timestamp"] is not None
        assert "T" in result["timestamp"]

    @pytest.mark.asyncio
    async def test_get_quote_uppercases_symbol(self, client):
        """get_quote uppercases the symbol parameter."""
        raw_response = {"c": 100.0, "d": 0, "dp": 0, "h": 100.0,
                        "l": 100.0, "o": 100.0, "pc": 100.0, "t": 1700000000}
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp) as mock_get:
            result = await client.get_quote("aapl")
            assert result["symbol"] == "AAPL"
            # Verify the HTTP call used the uppercased symbol
            call_kwargs = mock_get.call_args
            assert call_kwargs[1]["params"]["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_get_quote_returns_none_on_empty_response(self, client):
        """get_quote returns None when API returns empty/falsy data."""
        mock_resp = _make_response({})
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")
        assert result is None


class TestGetCandles:
    """get_candles() with mocked Finnhub /stock/candle response."""

    @pytest.mark.asyncio
    async def test_get_candles_returns_ohlcv_list(self, client):
        """get_candles returns a list of OHLCV dicts."""
        raw_response = {
            "s": "ok",
            "o": [150.0, 151.0], "h": [152.0, 153.0], "l": [149.0, 150.0],
            "c": [151.5, 152.5], "v": [1000000, 1100000], "t": [1700000000, 1700086400],
        }
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_candles("AAPL", "D", 1700000000, 1700100000)

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 2
        candle = result[0]
        assert candle["open"] == 150.0
        assert candle["high"] == 152.0
        assert candle["low"] == 149.0
        assert candle["close"] == 151.5
        assert candle["volume"] == 1000000
        assert candle["timestamp"] is not None
        assert candle["_source"] == "finnhub"
        assert "_fetched_at" in candle

    @pytest.mark.asyncio
    async def test_get_candles_no_data_returns_none(self, client):
        """get_candles returns None when Finnhub returns s='no_data'."""
        raw_response = {"s": "no_data"}
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_candles("AAPL", "D", 1700000000, 1700100000)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_candles_empty_arrays(self, client):
        """get_candles with empty arrays returns an empty list."""
        raw_response = {"s": "ok", "o": [], "h": [], "l": [], "c": [], "v": [], "t": []}
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_candles("AAPL", "D", 1700000000, 1700100000)

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 0


class TestGetCompanyNews:
    """get_company_news() with mocked Finnhub /company-news response."""

    @pytest.mark.asyncio
    async def test_get_company_news_returns_normalized_items(self, client):
        """get_company_news returns normalized news items."""
        raw_response = [
            {
                "headline": "Apple Reports Q4 Earnings",
                "summary": "Apple beat expectations",
                "source": "Reuters",
                "url": "https://example.com/news1",
                "datetime": 1700000000,
                "category": "company",
                "related": "AAPL",
            }
        ]
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_company_news("AAPL", "2024-01-01", "2024-01-31")

        assert result is not None
        assert len(result) == 1
        item = result[0]
        assert item["headline"] == "Apple Reports Q4 Earnings"
        assert item["source"] == "Reuters"
        assert item["published_at"] is not None
        assert item["_source"] == "finnhub"
        assert "_fetched_at" in item


class TestGetMarketNews:
    """get_market_news() with mocked Finnhub /news response."""

    @pytest.mark.asyncio
    async def test_get_market_news_default_category(self, client):
        """get_market_news sends 'general' as the default category."""
        raw_response = [
            {
                "headline": "Markets Rally",
                "summary": "Strong day for stocks",
                "source": "Bloomberg",
                "url": "https://example.com/news2",
                "datetime": 1700000000,
                "category": "general",
                "related": "",
            }
        ]
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp) as mock_get:
            result = await client.get_market_news()

        assert result is not None
        assert len(result) == 1
        # Verify "general" was passed as category param
        call_kwargs = mock_get.call_args
        assert call_kwargs[1]["params"]["category"] == "general"


class TestGetBasicFinancials:
    """get_basic_financials() with mocked Finnhub /stock/metric response."""

    @pytest.mark.asyncio
    async def test_get_basic_financials_extracts_metrics(self, client):
        """get_basic_financials extracts and renames metric fields."""
        raw_response = {
            "metric": {
                "pe_normalized_annual": 25.5,
                "market_capitalization": 2800000,
                "dividend_yield_indicated_annual": 0.55,
                "eps_normalized_annual": 6.15,
                "revenue_per_share_annual": 24.0,
                "book_value_per_share_annual": 4.25,
                "52_week_high": 200.0,
                "52_week_low": 130.0,
                "beta": 1.2,
                "10_day_average_trading_volume": 50000000,
            }
        }
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_basic_financials("AAPL")

        assert result is not None
        assert result["symbol"] == "AAPL"
        assert result["pe_ratio"] == 25.5
        assert result["market_cap"] == 2800000
        assert result["dividend_yield"] == 0.55
        assert result["eps"] == 6.15
        assert result["revenue_per_share"] == 24.0
        assert result["book_value_per_share"] == 4.25
        assert result["week_52_high"] == 200.0
        assert result["week_52_low"] == 130.0
        assert result["beta"] == 1.2
        assert result["avg_volume_10d"] == 50000000
        assert result["_source"] == "finnhub"


class TestGetCompanyProfile:
    """get_company_profile() with mocked Finnhub /stock/profile2 response."""

    @pytest.mark.asyncio
    async def test_get_company_profile_renames_fields(self, client):
        """get_company_profile renames market_capitalization to market_cap."""
        raw_response = {
            "country": "US",
            "currency": "USD",
            "exchange": "NASDAQ",
            "name": "Apple Inc",
            "ticker": "AAPL",
            "ipo": "1980-12-12",
            "market_capitalization": 2800000,
            "finnhub_industry": "Technology",
            "logo": "https://example.com/logo.png",
            "weburl": "https://apple.com",
        }
        # Note: _normalize_response converts camelCase keys to snake_case,
        # but these are already snake_case from Finnhub (profile2 uses snake_case).
        # The _normalize_keys call will still process them.
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_company_profile("AAPL")

        assert result is not None
        # market_capitalization should be renamed to market_cap
        assert "market_cap" in result
        # finnhub_industry should be renamed to industry
        assert "industry" in result
        assert result["_source"] == "finnhub"


class TestGetEconomicCalendar:
    """get_economic_calendar() with mocked Finnhub /calendar/economic response."""

    @pytest.mark.asyncio
    async def test_get_economic_calendar_filters_us_only(self, client):
        """get_economic_calendar filters to only US events."""
        raw_response = {
            "economic_calendar": [
                {"event": "CPI Release", "country": "US", "impact": "high"},
                {"event": "GDP Report", "country": "UK", "impact": "high"},
                {"event": "NFP Release", "country": "US", "impact": "high"},
            ]
        }
        # After normalization, keys like economicCalendar become economic_calendar
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_economic_calendar("2024-01-01", "2024-01-31")

        assert result is not None
        # Only US events should be returned
        assert len(result) == 2
        for event in result:
            assert event["country"] == "US"
            assert event["_source"] == "finnhub"


class TestSearchSymbol:
    """search_symbol() with mocked Finnhub /search response."""

    @pytest.mark.asyncio
    async def test_search_symbol_returns_normalized_results(self, client):
        """search_symbol returns normalized search results."""
        raw_response = {
            "count": 3,
            "result": [
                {"description": "Apple Inc", "displaySymbol": "AAPL",
                 "symbol": "AAPL", "type": "Common Stock"},
                {"description": "Apple Hospitality REIT", "displaySymbol": "APLE",
                 "symbol": "APLE", "type": "REIT"},
                {"description": "Appleseed Fund", "displaySymbol": "APPLX",
                 "symbol": "APPLX", "type": "Mutual Fund"},
            ],
        }
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.search_symbol("apple")

        assert result is not None
        assert len(result) == 3
        for item in result:
            assert item["_source"] == "finnhub"
            assert "_fetched_at" in item

    @pytest.mark.asyncio
    async def test_search_symbol_limits_to_10_results(self, client):
        """search_symbol returns at most 10 results."""
        raw_response = {
            "count": 15,
            "result": [
                {"description": f"Company {i}", "symbol": f"SYM{i}", "type": "Common Stock"}
                for i in range(15)
            ],
        }
        mock_resp = _make_response(raw_response)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.search_symbol("test")

        assert result is not None
        assert len(result) == 10


# ===================================================================
# 7. Error Handling
# ===================================================================
class TestErrorHandling:
    """HTTP errors, timeouts, and connection failures."""

    @pytest.mark.asyncio
    async def test_http_500_returns_none_and_records_failure(self, client):
        """HTTP 500 returns None and records a circuit breaker failure."""
        mock_resp = _make_response({}, status_code=500)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is None
        assert len(client._failure_timestamps) == 1

    @pytest.mark.asyncio
    async def test_http_429_triggers_60s_pause(self, client):
        """HTTP 429 triggers a 60-second pause via asyncio.sleep."""
        mock_resp = _make_response({}, status_code=429)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            with patch("app.data.finnhub_client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                result = await client.get_quote("AAPL")

        assert result is None
        mock_sleep.assert_called_once_with(60.0)

    @pytest.mark.asyncio
    async def test_http_403_permanently_disables(self, client):
        """HTTP 403 permanently disables the client."""
        mock_resp = _make_response({}, status_code=403)

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is None
        assert client._permanently_disabled is True

    @pytest.mark.asyncio
    async def test_timeout_returns_none_and_records_failure(self, client):
        """Timeout exception returns None and records failure."""
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock,
                          side_effect=httpx.TimeoutException("read timed out")):
            result = await client.get_quote("AAPL")

        assert result is None
        assert len(client._failure_timestamps) == 1

    @pytest.mark.asyncio
    async def test_connection_error_returns_none_and_records_failure(self, client):
        """Connection error returns None and records failure."""
        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock,
                          side_effect=httpx.ConnectError("Connection refused")):
            result = await client.get_quote("AAPL")

        assert result is None
        assert len(client._failure_timestamps) == 1

    @pytest.mark.asyncio
    async def test_malformed_json_returns_none(self, client):
        """An exception from response.json() returns None and records failure."""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.side_effect = ValueError("Expecting value: line 1")

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is None
        assert len(client._failure_timestamps) == 1

    @pytest.mark.asyncio
    async def test_empty_response_body_returns_none(self, client):
        """An empty/falsy response body returns None."""
        mock_resp = _make_response(None)
        # Override json to return None (empty body)
        mock_resp.json.return_value = None

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_quote("AAPL")

        assert result is None


# ===================================================================
# 8. Singleton Functions
# ===================================================================
class TestSingletonFunctions:
    """Module-level get_finnhub_client() and close_finnhub_client()."""

    def test_get_finnhub_client_returns_instance(self, mock_settings):
        """get_finnhub_client() returns a FinnhubClient instance."""
        import app.data.finnhub_client as mod

        original = mod._client
        mod._client = None
        try:
            with patch("app.data.finnhub_client.get_settings", return_value=mock_settings):
                result = get_finnhub_client()
                assert isinstance(result, FinnhubClient)
        finally:
            mod._client = original

    def test_get_finnhub_client_returns_same_instance(self, mock_settings):
        """get_finnhub_client() returns the same singleton on repeated calls."""
        import app.data.finnhub_client as mod

        original = mod._client
        mod._client = None
        try:
            with patch("app.data.finnhub_client.get_settings", return_value=mock_settings):
                first = get_finnhub_client()
                second = get_finnhub_client()
                assert first is second
        finally:
            mod._client = original

    @pytest.mark.asyncio
    async def test_close_finnhub_client_clears_singleton(self, mock_settings):
        """close_finnhub_client() closes and clears the singleton."""
        import app.data.finnhub_client as mod

        original = mod._client
        mod._client = None
        try:
            with patch("app.data.finnhub_client.get_settings", return_value=mock_settings):
                _ = get_finnhub_client()
                assert mod._client is not None
                await close_finnhub_client()
                assert mod._client is None
        finally:
            mod._client = original

    @pytest.mark.asyncio
    async def test_close_finnhub_client_noop_when_none(self):
        """close_finnhub_client() is a no-op when _client is None."""
        import app.data.finnhub_client as mod

        original = mod._client
        mod._client = None
        try:
            # Should not raise
            await close_finnhub_client()
            assert mod._client is None
        finally:
            mod._client = original


# ===================================================================
# 9. Candles Edge Cases
# ===================================================================
class TestCandlesEdgeCases:
    """Edge cases for the get_candles() method."""

    @pytest.mark.asyncio
    async def test_candles_none_response_returns_none(self, client):
        """get_candles returns None when _request returns None."""
        mock_resp = _make_response(None)
        mock_resp.json.return_value = None

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_candles("AAPL", "D", 1700000000, 1700100000)

        assert result is None

    @pytest.mark.asyncio
    async def test_candles_non_dict_response_returns_none(self, client):
        """get_candles returns None when response is not a dict."""
        mock_resp = _make_response("not a dict")

        with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
            result = await client.get_candles("AAPL", "D", 1700000000, 1700100000)

        assert result is None


# ===================================================================
# 10. Unix Timestamp Conversion
# ===================================================================
class TestUnixToIso:
    """_unix_to_iso() helper method."""

    def test_valid_timestamp(self):
        """A valid Unix timestamp is converted to ISO format."""
        result = FinnhubClient._unix_to_iso(1700000000)
        assert result is not None
        assert "T" in result
        assert "2023" in result

    def test_none_returns_none(self):
        """None input returns None."""
        result = FinnhubClient._unix_to_iso(None)
        assert result is None

    def test_invalid_timestamp_returns_none(self):
        """An out-of-range timestamp returns None."""
        # An absurdly large timestamp that will cause OverflowError
        result = FinnhubClient._unix_to_iso(999999999999999999)
        assert result is None


# ===================================================================
# 11. HTTP Client Lifecycle
# ===================================================================
class TestHttpClientLifecycle:
    """Lazy creation and cleanup of the underlying httpx.AsyncClient."""

    def test_http_client_created_lazily(self, client):
        """_http_client is None until first request."""
        assert client._http_client is None

    def test_get_http_client_creates_instance(self, client):
        """_get_http_client creates an httpx.AsyncClient on first call."""
        http_client = client._get_http_client()
        assert isinstance(http_client, httpx.AsyncClient)
        assert client._http_client is http_client

    def test_get_http_client_returns_same_instance(self, client):
        """_get_http_client returns the same client on repeated calls."""
        first = client._get_http_client()
        second = client._get_http_client()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_sets_http_client_to_none(self, client):
        """close() sets _http_client back to None."""
        _ = client._get_http_client()
        assert client._http_client is not None
        await client.close()
        assert client._http_client is None

    @pytest.mark.asyncio
    async def test_close_is_safe_when_no_client(self, client):
        """close() is safe to call when no HTTP client has been created."""
        assert client._http_client is None
        # Should not raise
        await client.close()
        assert client._http_client is None
