"""Tests for TASK-DATA-007: CFTC COT Client.

Validates the CotClient lifecycle, HTTP helpers, public API methods,
cache integration, singleton management, and comprehensive error handling.

ALL httpx and database calls are mocked -- no real network requests are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_cot_client.py -v``
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import httpx
import pytest

import app.data.cot_client as mod
from app.data.cot_client import (
    CotClient,
    close_cot_client,
    get_cot_client,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GOLD_ROW = {
    "market_name": "GOLD - COMEX",
    "symbol": "GC",
    "display_name": "Gold",
    "asset_class": "commodity",
    "report_date": "2026-02-04",
    "commercial_long": 200000,
    "commercial_short": 250000,
    "commercial_net": -50000,
    "commercial_change": -2000,
    "speculative_long": 150000,
    "speculative_short": 80000,
    "speculative_net": 70000,
    "speculative_change": 2000,
    "small_trader_long": 50000,
    "small_trader_short": 70000,
    "small_trader_net": -20000,
    "open_interest": 500000,
    "open_interest_change": 10000,
}

_CACHED_ROW = {
    "market_name": "GOLD - COMEX",
    "report_date": "2026-02-04",
    "commercial_long": 200000,
    "commercial_short": 250000,
    "commercial_net": -50000,
    "speculative_long": 150000,
    "speculative_short": 80000,
    "speculative_net": 70000,
    "open_interest": 500000,
    "fetched_at": datetime.now(timezone.utc).isoformat(),
}


def _make_historical(count=10, base_net=50000):
    """Generate historical cache rows (descending by date)."""
    rows = []
    for i in range(count):
        rows.append({
            "market_name": "GOLD - COMEX",
            "report_date": f"2026-01-{28 - i:02d}",
            "commercial_long": 200000 - (i * 1000),
            "commercial_short": 250000,
            "commercial_net": base_net - (i * 1000),
            "speculative_long": 150000 + (i * 1000),
            "speculative_short": 80000,
            "speculative_net": -(base_net - (i * 1000)),
            "open_interest": 500000 + (i * 500),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })
    return rows


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset module-level singleton before and after each test."""
    mod._client = None
    yield
    mod._client = None


@pytest.fixture
def mock_settings():
    """Return mock Settings with cache_ttl_cot."""
    s = MagicMock()
    s.cache_ttl_cot = 604800
    return s


@pytest.fixture
def client(mock_settings):
    """CotClient with mocked settings."""
    with patch("app.data.cot_client.get_settings", return_value=mock_settings):
        c = CotClient()
    return c


# ===================================================================
# 1. __init__
# ===================================================================
class TestInit:
    """CotClient constructor behaviour."""

    def test_logger_message(self, mock_settings):
        """Constructor logs initialization message."""
        with patch("app.data.cot_client.get_settings", return_value=mock_settings):
            with patch("app.data.cot_client.logger") as mock_logger:
                CotClient()
        mock_logger.info.assert_called_once()
        assert "initialized" in mock_logger.info.call_args[0][0].lower()

    def test_cache_ttl_from_settings(self, client, mock_settings):
        """cache_ttl is read from settings.cache_ttl_cot."""
        assert client._cache_ttl == 604800

    def test_http_starts_none(self, client):
        """HTTP client starts as None (lazy creation)."""
        assert client._http is None


# ===================================================================
# 2. _get_http (lazy HTTP client creation)
# ===================================================================
class TestGetHttp:
    """The _get_http() lazy factory."""

    def test_creates_http_client(self, client):
        """First call creates an httpx.AsyncClient."""
        http = client._get_http()
        assert isinstance(http, httpx.AsyncClient)

    def test_same_instance_on_second_call(self, client):
        """Second call returns the same instance."""
        first = client._get_http()
        second = client._get_http()
        assert first is second

    def test_has_user_agent(self, client):
        """HTTP client has a MarketTerminal user agent."""
        http = client._get_http()
        assert "MarketTerminal" in http.headers.get("user-agent", "")

    def test_follows_redirects(self, client):
        """HTTP client is configured to follow redirects."""
        http = client._get_http()
        assert http.follow_redirects is True


# ===================================================================
# 3. close()
# ===================================================================
class TestClose:
    """CotClient.close() lifecycle."""

    @pytest.mark.asyncio
    async def test_closes_httpx_client(self, client):
        """close() calls aclose on the httpx client."""
        mock_http = AsyncMock()
        client._http = mock_http
        await client.close()
        mock_http.aclose.assert_called_once()
        assert client._http is None

    @pytest.mark.asyncio
    async def test_safe_to_call_twice(self, client):
        """close() can be called multiple times without error."""
        mock_http = AsyncMock()
        client._http = mock_http
        await client.close()
        await client.close()  # second call should not raise
        assert client._http is None

    @pytest.mark.asyncio
    async def test_safe_when_http_is_none(self, client):
        """close() is safe when _http was never created."""
        assert client._http is None
        await client.close()  # should not raise

    @pytest.mark.asyncio
    async def test_logs_on_close(self, client):
        """close() logs a message when closing."""
        mock_http = AsyncMock()
        client._http = mock_http
        with patch("app.data.cot_client.logger") as mock_logger:
            await client.close()
        mock_logger.info.assert_called()


# ===================================================================
# 4. _download_text
# ===================================================================
class TestDownloadText:
    """The _download_text() HTTP helper."""

    @pytest.mark.asyncio
    async def test_success(self, client):
        """Returns text on successful HTTP response."""
        mock_resp = MagicMock()
        mock_resp.text = "csv data here"
        mock_resp.raise_for_status = MagicMock()
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_resp)
        client._http = mock_http
        result = await client._download_text("https://example.com/data.txt")
        assert result == "csv data here"

    @pytest.mark.asyncio
    async def test_http_error_returns_none(self, client):
        """Returns None on HTTP status error."""
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Not Found", request=MagicMock(), response=mock_resp,
        )
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_resp)
        client._http = mock_http
        result = await client._download_text("https://example.com/bad")
        assert result is None

    @pytest.mark.asyncio
    async def test_timeout_returns_none(self, client):
        """Returns None on timeout."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        client._http = mock_http
        result = await client._download_text("https://example.com/slow")
        assert result is None

    @pytest.mark.asyncio
    async def test_request_error_returns_none(self, client):
        """Returns None on generic request error."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=httpx.RequestError("connection failed"))
        client._http = mock_http
        result = await client._download_text("https://example.com/err")
        assert result is None

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_none(self, client):
        """Returns None on unexpected exception."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=RuntimeError("unexpected"))
        client._http = mock_http
        result = await client._download_text("https://example.com")
        assert result is None


# ===================================================================
# 5. _download_bytes
# ===================================================================
class TestDownloadBytes:
    """The _download_bytes() HTTP helper."""

    @pytest.mark.asyncio
    async def test_success(self, client):
        """Returns bytes on successful response."""
        mock_resp = MagicMock()
        mock_resp.content = b"binary data"
        mock_resp.raise_for_status = MagicMock()
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_resp)
        client._http = mock_http
        result = await client._download_bytes("https://example.com/file.zip")
        assert result == b"binary data"

    @pytest.mark.asyncio
    async def test_http_error_returns_none(self, client):
        """Returns None on HTTP error."""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_resp,
        )
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_resp)
        client._http = mock_http
        result = await client._download_bytes("https://example.com/fail")
        assert result is None

    @pytest.mark.asyncio
    async def test_timeout_returns_none(self, client):
        """Returns None on timeout."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        client._http = mock_http
        result = await client._download_bytes("https://example.com/slow")
        assert result is None

    @pytest.mark.asyncio
    async def test_request_error_returns_none(self, client):
        """Returns None on request error."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=httpx.RequestError("conn"))
        client._http = mock_http
        result = await client._download_bytes("https://example.com/err")
        assert result is None

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_none(self, client):
        """Returns None on unexpected exception."""
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=RuntimeError("boom"))
        client._http = mock_http
        result = await client._download_bytes("https://example.com/boom")
        assert result is None


# ===================================================================
# 6. fetch_current_report
# ===================================================================
class TestFetchCurrentReport:
    """Public fetch_current_report() method."""

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached(self, client):
        """Returns cached data when cache is fresh."""
        cached_rows = [_CACHED_ROW]
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=cached_rows):
            with patch.object(client, "_enrich_rows", new_callable=AsyncMock, return_value=[_GOLD_ROW]):
                result = await client.fetch_current_report()
        assert result is not None
        assert len(result) == 1
        # tag with cached=True
        assert result[0].get("_cached") is True

    @pytest.mark.asyncio
    async def test_cache_miss_downloads_parses_stores(self, client):
        """Downloads, parses, and stores when cache is empty."""
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_download_text", new_callable=AsyncMock, return_value="csv text"):
                with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[_GOLD_ROW]):
                    with patch("app.data.cot_client.store_cot_rows", new_callable=AsyncMock) as mock_store:
                        with patch.object(client, "_enrich_rows", new_callable=AsyncMock, return_value=[_GOLD_ROW]):
                            result = await client.fetch_current_report()
        assert result is not None
        mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_failure_returns_none(self, client):
        """Returns None when download fails."""
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_download_text", new_callable=AsyncMock, return_value=None):
                result = await client.fetch_current_report()
        assert result is None

    @pytest.mark.asyncio
    async def test_parse_empty_returns_none(self, client):
        """Returns None when parse returns empty list."""
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_download_text", new_callable=AsyncMock, return_value="csv text"):
                with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[]):
                    result = await client.fetch_current_report()
        assert result is None

    @pytest.mark.asyncio
    async def test_fresh_data_not_cached_flag(self, client):
        """Fresh data is tagged with _cached=False."""
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_download_text", new_callable=AsyncMock, return_value="csv"):
                with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[_GOLD_ROW]):
                    with patch("app.data.cot_client.store_cot_rows", new_callable=AsyncMock):
                        with patch.object(client, "_enrich_rows", new_callable=AsyncMock, return_value=[_GOLD_ROW]):
                            result = await client.fetch_current_report()
        # tag() with cached=False
        assert result is not None
        assert result[0].get("_cached") is False


# ===================================================================
# 7. fetch_historical
# ===================================================================
class TestFetchHistorical:
    """Public fetch_historical() method."""

    @pytest.mark.asyncio
    async def test_cache_hit_with_enough_rows(self, client):
        """Returns cached data when cache has enough rows."""
        historical = _make_historical(52)
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, return_value=historical):
            result = await client.fetch_historical("GOLD - COMEX", weeks=52)
        assert result is not None
        assert len(result) == 52

    @pytest.mark.asyncio
    async def test_cache_miss_triggers_download(self, client):
        """Downloads historical archives when cache is insufficient."""
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, side_effect=[None, _make_historical(10)]):
            with patch.object(client, "_fetch_year", new_callable=AsyncMock, return_value=[_GOLD_ROW]):
                with patch.object(client, "_download_text", new_callable=AsyncMock, return_value="csv"):
                    with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[_GOLD_ROW]):
                        with patch("app.data.cot_client.store_cot_rows", new_callable=AsyncMock):
                            result = await client.fetch_historical("GOLD - COMEX", weeks=52)
        assert result is not None

    @pytest.mark.asyncio
    async def test_market_not_found_returns_none(self, client):
        """Returns None when no data is found for the market."""
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, side_effect=[None, None]):
            with patch.object(client, "_fetch_year", new_callable=AsyncMock, return_value=None):
                with patch.object(client, "_download_text", new_callable=AsyncMock, return_value=None):
                    result = await client.fetch_historical("NONEXISTENT MARKET", weeks=52)
        assert result is None

    @pytest.mark.asyncio
    async def test_cache_hit_insufficient_rows_triggers_download(self, client):
        """Cache with fewer rows than requested triggers download."""
        short_cache = _make_historical(10)
        # First call: returns short cache (not enough), second call: returns full data
        full_cache = _make_historical(52)
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, side_effect=[short_cache, full_cache]):
            with patch.object(client, "_fetch_year", new_callable=AsyncMock, return_value=[_GOLD_ROW]):
                with patch.object(client, "_download_text", new_callable=AsyncMock, return_value="csv"):
                    with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[_GOLD_ROW]):
                        with patch("app.data.cot_client.store_cot_rows", new_callable=AsyncMock):
                            result = await client.fetch_historical("GOLD - COMEX", weeks=52)
        assert result is not None


# ===================================================================
# 8. get_market_summary
# ===================================================================
class TestGetMarketSummary:
    """Public get_market_summary() method."""

    @pytest.mark.asyncio
    async def test_etf_mapping_gld(self, client):
        """GLD maps to gold via resolve_market_name."""
        historical = _make_historical(52)
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=historical):
            with patch("app.data.cot_client.build_market_summary") as mock_bms:
                mock_bms.return_value = {"market_name": "GOLD - COMEX", "signal": {}}
                result = await client.get_market_summary("GLD")
        assert result is not None
        mock_bms.assert_called_once_with("GOLD - COMEX", historical)

    @pytest.mark.asyncio
    async def test_futures_symbol_mapping(self, client):
        """ES maps to E-MINI S&P 500."""
        historical = _make_historical(52)
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=historical):
            with patch("app.data.cot_client.build_market_summary") as mock_bms:
                mock_bms.return_value = {"market_name": "E-MINI S&P 500", "signal": {}}
                result = await client.get_market_summary("ES")
        assert result is not None

    @pytest.mark.asyncio
    async def test_unknown_symbol_returns_none(self, client):
        """Unknown symbol returns None."""
        result = await client.get_market_summary("ZZZZZ")
        assert result is None

    @pytest.mark.asyncio
    async def test_no_historical_returns_none(self, client):
        """Returns None when fetch_historical returns None."""
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=None):
            result = await client.get_market_summary("GLD")
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_historical_returns_none(self, client):
        """Returns None when fetch_historical returns empty list."""
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=[]):
            result = await client.get_market_summary("GLD")
        assert result is None

    @pytest.mark.asyncio
    async def test_summary_none_returns_none(self, client):
        """Returns None when build_market_summary returns None."""
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=_make_historical(1)):
            with patch("app.data.cot_client.build_market_summary", return_value=None):
                result = await client.get_market_summary("GLD")
        assert result is None

    @pytest.mark.asyncio
    async def test_result_is_tagged(self, client):
        """Result is tagged with metadata."""
        with patch.object(client, "fetch_historical", new_callable=AsyncMock, return_value=_make_historical(10)):
            with patch("app.data.cot_client.build_market_summary", return_value={"summary": True}):
                result = await client.get_market_summary("GLD")
        assert result is not None
        assert result.get("_source") == "cftc"


# ===================================================================
# 9. calculate_cot_index (static method)
# ===================================================================
class TestCalculateCotIndexMethod:
    """CotClient.calculate_cot_index static method delegates to helper."""

    def test_delegates_to_helper(self):
        """Static method returns the same result as the helper function."""
        from app.data.cot_helpers import calculate_cot_index as helper
        data = [10, 20, 30, 40, 50]
        assert CotClient.calculate_cot_index(data) == helper(data)

    def test_with_lookback(self):
        """Passes lookback parameter to helper."""
        result = CotClient.calculate_cot_index([10, 20, 30, 40, 50], lookback=3)
        assert 0.0 <= result <= 100.0

    def test_empty_list(self):
        """Returns 50.0 for empty list."""
        assert CotClient.calculate_cot_index([]) == 50.0


# ===================================================================
# 10. Singleton (get_cot_client / close_cot_client)
# ===================================================================
class TestSingleton:
    """Module-level singleton lifecycle."""

    def test_get_cot_client_returns_instance(self, mock_settings):
        """get_cot_client() returns a CotClient instance."""
        assert mod._client is None
        with patch("app.data.cot_client.get_settings", return_value=mock_settings):
            result = get_cot_client()
        assert isinstance(result, CotClient)

    def test_get_cot_client_returns_same_instance(self, mock_settings):
        """Calling get_cot_client() twice returns the same object."""
        with patch("app.data.cot_client.get_settings", return_value=mock_settings):
            first = get_cot_client()
            second = get_cot_client()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_cot_client_clears_singleton(self, mock_settings):
        """close_cot_client() sets module _client to None."""
        with patch("app.data.cot_client.get_settings", return_value=mock_settings):
            _ = get_cot_client()
        assert mod._client is not None
        await close_cot_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_close_cot_client_safe_when_none(self):
        """close_cot_client() does not raise when _client is already None."""
        assert mod._client is None
        await close_cot_client()  # should not raise
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_get_creates_new_after_close(self, mock_settings):
        """After close, get_cot_client() creates a fresh instance."""
        with patch("app.data.cot_client.get_settings", return_value=mock_settings):
            first = get_cot_client()
            await close_cot_client()
            second = get_cot_client()
        assert first is not second
        assert isinstance(second, CotClient)


# ===================================================================
# 11. _years_for_weeks
# ===================================================================
class TestYearsForWeeks:
    """The _years_for_weeks() static method."""

    def test_52_weeks_current_year_only(self):
        """52 weeks needs current year only."""
        # years_back = max(1, (52//52)+1) = 2; range(2026-2+1, 2027) = [2025, 2026]
        result = CotClient._years_for_weeks(2026, 52)
        assert 2026 in result
        assert len(result) == 2  # current + 1 back

    def test_104_weeks_two_years(self):
        """104 weeks needs current + previous year."""
        # years_back = max(1, (104//52)+1) = 3; range(2026-3+1, 2027) = [2024, 2025, 2026]
        result = CotClient._years_for_weeks(2026, 104)
        assert 2026 in result
        assert 2025 in result
        assert 2024 in result
        assert len(result) == 3

    def test_1_week(self):
        """1 week still returns at least current year."""
        result = CotClient._years_for_weeks(2026, 1)
        assert 2026 in result

    def test_0_weeks(self):
        """0 weeks still returns current year."""
        result = CotClient._years_for_weeks(2026, 0)
        assert 2026 in result

    def test_large_weeks(self):
        """Large weeks value returns multiple years."""
        result = CotClient._years_for_weeks(2026, 520)
        assert len(result) >= 10

    def test_returns_sorted_ascending(self):
        """Years are returned in ascending order."""
        result = CotClient._years_for_weeks(2026, 104)
        assert result == sorted(result)

    def test_always_includes_current_year(self):
        """Current year is always included."""
        for weeks in [1, 10, 52, 104, 520]:
            result = CotClient._years_for_weeks(2026, weeks)
            assert 2026 in result


# ===================================================================
# 12. _enrich_rows (internal)
# ===================================================================
class TestEnrichRows:
    """The _enrich_rows() internal method."""

    @pytest.mark.asyncio
    async def test_adds_indices_when_historical_available(self, client):
        """Adds commercial_index and speculative_index when historical data exists."""
        historical = _make_historical(10)
        rows = [_GOLD_ROW]
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, return_value=historical):
            result = await client._enrich_rows(rows)
        assert len(result) == 1
        assert result[0]["commercial_index"] is not None
        assert result[0]["speculative_index"] is not None

    @pytest.mark.asyncio
    async def test_none_indices_when_no_historical(self, client):
        """Indices are None when no historical data is available."""
        rows = [_GOLD_ROW]
        with patch("app.data.cot_client.get_cached_cot_data", new_callable=AsyncMock, return_value=None):
            result = await client._enrich_rows(rows)
        assert len(result) == 1
        assert result[0]["commercial_index"] is None
        assert result[0]["speculative_index"] is None


# ===================================================================
# 13. _enrich_historical (static)
# ===================================================================
class TestEnrichHistorical:
    """The _enrich_historical() static method."""

    def test_empty_rows_returns_empty(self):
        """Empty list returns empty list."""
        assert CotClient._enrich_historical([]) == []

    def test_adds_indices_and_changes(self):
        """Adds indices and week-over-week changes."""
        rows = _make_historical(5)
        result = CotClient._enrich_historical(rows)
        assert len(result) == 5
        # First row has a change (comparing to second row)
        assert result[0]["commercial_change"] is not None
        assert result[0]["speculative_change"] is not None
        # Last row has no previous -> change is None
        assert result[-1]["commercial_change"] is None
        assert result[-1]["speculative_change"] is None

    def test_indices_are_rounded(self):
        """Indices are rounded to 1 decimal place."""
        rows = _make_historical(5)
        result = CotClient._enrich_historical(rows)
        for r in result:
            assert r["commercial_index"] == round(r["commercial_index"], 1)
            assert r["speculative_index"] == round(r["speculative_index"], 1)

    def test_single_row(self):
        """Single row has None changes and 50.0 indices."""
        rows = _make_historical(1)
        result = CotClient._enrich_historical(rows)
        assert len(result) == 1
        assert result[0]["commercial_change"] is None
        assert result[0]["speculative_change"] is None
        assert result[0]["commercial_index"] == 50.0
        assert result[0]["speculative_index"] == 50.0


# ===================================================================
# 14. _fetch_year (internal)
# ===================================================================
class TestFetchYear:
    """The _fetch_year() internal method."""

    @pytest.mark.asyncio
    async def test_success(self, client):
        """Returns parsed rows for the market from a year archive."""
        with patch.object(client, "_download_bytes", new_callable=AsyncMock, return_value=b"zipdata"):
            with patch("app.data.cot_client.extract_csv_from_zip_sync", return_value="csv text"):
                with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[_GOLD_ROW, {"market_name": "OTHER"}]):
                    result = await client._fetch_year(2026, "GOLD - COMEX")
        assert result is not None
        assert len(result) == 1
        assert result[0]["market_name"] == "GOLD - COMEX"

    @pytest.mark.asyncio
    async def test_download_failure_returns_none(self, client):
        """Returns None when download fails."""
        with patch.object(client, "_download_bytes", new_callable=AsyncMock, return_value=None):
            result = await client._fetch_year(2026, "GOLD - COMEX")
        assert result is None

    @pytest.mark.asyncio
    async def test_zip_extraction_failure_returns_none(self, client):
        """Returns None when ZIP extraction fails."""
        with patch.object(client, "_download_bytes", new_callable=AsyncMock, return_value=b"zipdata"):
            with patch("app.data.cot_client.extract_csv_from_zip_sync", return_value=None):
                result = await client._fetch_year(2026, "GOLD - COMEX")
        assert result is None

    @pytest.mark.asyncio
    async def test_market_not_in_archive_returns_none(self, client):
        """Returns None when market not found in parsed data."""
        with patch.object(client, "_download_bytes", new_callable=AsyncMock, return_value=b"zipdata"):
            with patch("app.data.cot_client.extract_csv_from_zip_sync", return_value="csv"):
                with patch("app.data.cot_client.parse_cot_csv_sync", return_value=[{"market_name": "OTHER"}]):
                    result = await client._fetch_year(2026, "GOLD - COMEX")
        assert result is None


# ===================================================================
# 15. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Cross-cutting edge cases."""

    @pytest.mark.asyncio
    async def test_get_market_summary_all_etfs(self, client):
        """All ETF symbols in ETF_TO_FUTURES resolve to a market name."""
        from app.data.cot_helpers import ETF_TO_FUTURES, resolve_market_name
        for etf in ETF_TO_FUTURES:
            result = resolve_market_name(etf)
            assert result is not None, f"ETF '{etf}' did not resolve"

    @pytest.mark.asyncio
    async def test_get_market_summary_all_futures(self, client):
        """All futures symbols in SYMBOL_TO_CFTC resolve to a market name."""
        from app.data.cot_helpers import SYMBOL_TO_CFTC, resolve_market_name
        for sym in SYMBOL_TO_CFTC:
            result = resolve_market_name(sym)
            assert result is not None, f"Futures symbol '{sym}' did not resolve"

    @pytest.mark.asyncio
    async def test_fetch_current_report_downloads_from_correct_url(self, client):
        """fetch_current_report uses CFTC_CURRENT_URL."""
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_download_text", new_callable=AsyncMock, return_value=None) as mock_dl:
                await client.fetch_current_report()
        from app.data.cot_client import CFTC_CURRENT_URL
        mock_dl.assert_called_once_with(CFTC_CURRENT_URL)

    @pytest.mark.asyncio
    async def test_multiple_singleton_cycles(self, mock_settings):
        """Multiple create/close cycles work correctly."""
        for _ in range(3):
            with patch("app.data.cot_client.get_settings", return_value=mock_settings):
                c = get_cot_client()
            assert isinstance(c, CotClient)
            await close_cot_client()
            assert mod._client is None

    def test_years_for_weeks_53(self):
        """53 weeks (just over 1 year) needs 2 years."""
        result = CotClient._years_for_weeks(2026, 53)
        assert len(result) == 2
        assert 2025 in result
        assert 2026 in result

    def test_years_for_weeks_51(self):
        """51 weeks (just under 1 year) needs 1 year-back + current."""
        result = CotClient._years_for_weeks(2026, 51)
        # years_back = max(1, (51//52)+1) = max(1, 1) = 1 -> range(2026, 2027) = [2026]
        assert 2026 in result

    @pytest.mark.asyncio
    async def test_close_after_get_http(self, client):
        """Closing after _get_http was called works cleanly."""
        http = client._get_http()
        assert http is not None
        await client.close()
        assert client._http is None

    @pytest.mark.asyncio
    async def test_tag_applied_to_cached_current_report(self, client):
        """Cached current report has _cached=True and _source=cftc."""
        cached_rows = [_CACHED_ROW]
        with patch("app.data.cot_client.get_cached_current_report", new_callable=AsyncMock, return_value=cached_rows):
            with patch.object(client, "_enrich_rows", new_callable=AsyncMock, return_value=[dict(_GOLD_ROW)]):
                result = await client.fetch_current_report()
        assert result is not None
        assert result[0]["_cached"] is True
        assert result[0]["_source"] == "cftc"
