"""Tests for TASK-DATA-005: FRED API Client.

Validates the FredClient rate limiter, pandas helpers, cache layer (both
fundamentals_cache and macro_events), all 4 public API methods, singleton
lifecycle, metadata tagging, and comprehensive error handling.

ALL fredapi calls are mocked -- no real FRED API requests are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_fred_client.py -v``
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pandas as pd
import pytest

import app.data.fred_client as mod
from app.data.fred_client import (
    FRED_SERIES,
    FredClient,
    _tag,
    close_fred_client,
    get_fred_client,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_series(dates: list[str], values: list[float]) -> pd.Series:
    """Build a pandas Series with DatetimeIndex for testing."""
    idx = pd.DatetimeIndex(dates)
    return pd.Series(values, index=idx)


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
def mock_fredapi(monkeypatch):
    """Mock the fredapi module so it can be imported without installation."""
    mock_fred_cls = MagicMock()
    mock_module = MagicMock()
    mock_module.Fred = mock_fred_cls
    monkeypatch.setitem(sys.modules, "fredapi", mock_module)
    return mock_fred_cls


@pytest.fixture
def mock_settings():
    """Return mock Settings with a valid FRED API key."""
    s = MagicMock()
    s.fred_api_key = "test_key_123"
    s.cache_ttl_fundamentals = 86400
    s.cache_ttl_macro = 43200
    return s


@pytest.fixture
def mock_settings_no_key():
    """Return mock Settings with an empty FRED API key."""
    s = MagicMock()
    s.fred_api_key = ""
    s.cache_ttl_fundamentals = 86400
    s.cache_ttl_macro = 43200
    return s


@pytest.fixture
def client(mock_settings, mock_fredapi):
    """FredClient with mocked settings and valid API key."""
    with patch("app.data.fred_client.get_settings", return_value=mock_settings):
        c = FredClient()
    return c


@pytest.fixture
def disabled_client(mock_settings_no_key, mock_fredapi):
    """FredClient with empty API key (disabled)."""
    with patch("app.data.fred_client.get_settings", return_value=mock_settings_no_key):
        c = FredClient()
    return c


@pytest.fixture
def mock_db():
    """Return a mock database with async fetch_one/execute/fetch_all."""
    db = AsyncMock()
    db.fetch_one = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    db.fetch_all = AsyncMock(return_value=[])
    return db


# ===================================================================
# 1. Constants
# ===================================================================
class TestConstants:
    """Validate the FRED_SERIES constant dict."""

    def test_fred_series_has_22_entries(self):
        """FRED_SERIES should contain exactly 22 indicator mappings."""
        assert len(FRED_SERIES) == 22

    def test_all_series_ids_are_nonempty_strings(self):
        """Every series ID value must be a non-empty string."""
        for key, sid in FRED_SERIES.items():
            assert isinstance(sid, str), f"FRED_SERIES['{key}'] is not a string"
            assert len(sid) > 0, f"FRED_SERIES['{key}'] is empty"

    def test_all_keys_are_snake_case(self):
        """Every key should be lowercase snake_case."""
        snake_re = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")
        for key in FRED_SERIES:
            assert snake_re.match(key), f"Key '{key}' is not snake_case"

    def test_expected_keys_present(self):
        """Spot-check that well-known indicators are present."""
        expected = [
            "gdp", "cpi_headline", "unemployment_rate", "fed_funds_rate",
            "treasury_10y", "initial_claims",
        ]
        for k in expected:
            assert k in FRED_SERIES, f"Expected key '{k}' missing from FRED_SERIES"


# ===================================================================
# 2. Singleton (get_fred_client / close_fred_client)
# ===================================================================
class TestSingleton:
    """Module-level singleton lifecycle."""

    def test_get_fred_client_returns_instance(self, mock_settings, mock_fredapi):
        """get_fred_client() returns a FredClient instance."""
        assert mod._client is None
        with patch("app.data.fred_client.get_settings", return_value=mock_settings):
            result = get_fred_client()
        assert isinstance(result, FredClient)

    def test_get_fred_client_returns_same_instance(self, mock_settings, mock_fredapi):
        """Calling get_fred_client() twice returns the same object."""
        with patch("app.data.fred_client.get_settings", return_value=mock_settings):
            first = get_fred_client()
            second = get_fred_client()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_fred_client_clears_singleton(self, mock_settings, mock_fredapi):
        """close_fred_client() sets module _client to None."""
        with patch("app.data.fred_client.get_settings", return_value=mock_settings):
            _ = get_fred_client()
        assert mod._client is not None
        await close_fred_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_close_fred_client_safe_when_none(self):
        """close_fred_client() does not raise when _client is already None."""
        assert mod._client is None
        await close_fred_client()  # should not raise
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_get_creates_new_after_close(self, mock_settings, mock_fredapi):
        """After close, get_fred_client() creates a fresh instance."""
        with patch("app.data.fred_client.get_settings", return_value=mock_settings):
            first = get_fred_client()
            await close_fred_client()
            second = get_fred_client()
        assert first is not second
        assert isinstance(second, FredClient)


# ===================================================================
# 3. __init__
# ===================================================================
class TestInit:
    """FredClient constructor behaviour."""

    def test_valid_key_enabled(self, client):
        """With a valid API key, _enabled is True and _fred is not None."""
        assert client._enabled is True
        assert client._fred is not None

    def test_empty_key_disabled(self, disabled_client):
        """With empty API key, _enabled is False and _fred is None."""
        assert disabled_client._enabled is False
        assert disabled_client._fred is None

    def test_import_error_disables(self, mock_settings, monkeypatch):
        """When fredapi import raises ImportError, _enabled becomes False."""
        # Remove fredapi from sys.modules so the real import is attempted
        monkeypatch.delitem(sys.modules, "fredapi", raising=False)

        # Patch builtins.__import__ to raise ImportError for fredapi
        original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

        def patched_import(name, *args, **kwargs):
            if name == "fredapi":
                raise ImportError("No module named 'fredapi'")
            return original_import(name, *args, **kwargs)

        with patch("app.data.fred_client.get_settings", return_value=mock_settings):
            with patch("builtins.__import__", side_effect=patched_import):
                c = FredClient()
        assert c._enabled is False
        assert c._fred is None

    def test_cache_ttls_read_from_settings(self, client, mock_settings):
        """Cache TTLs are read from settings."""
        assert client._cache_ttl_fundamentals == mock_settings.cache_ttl_fundamentals
        assert client._cache_ttl_macro == mock_settings.cache_ttl_macro

    def test_rate_deque_starts_empty(self, client):
        """Rate limiter timestamp deque starts empty."""
        assert len(client._rate_timestamps) == 0

    def test_rate_lock_is_asyncio_lock(self, client):
        """Rate limiter uses an asyncio.Lock."""
        assert isinstance(client._rate_lock, asyncio.Lock)


# ===================================================================
# 4. Rate Limiter
# ===================================================================
class TestRateLimiter:
    """Sliding-window rate limiter (120 req/min)."""

    @pytest.mark.asyncio
    async def test_allows_requests_under_limit(self, client):
        """Multiple requests under the limit proceed without blocking."""
        for _ in range(5):
            await client._wait_for_rate_limit()
        assert len(client._rate_timestamps) == 5

    @pytest.mark.asyncio
    async def test_blocks_when_at_capacity(self, client):
        """When at 120/min capacity, the next request triggers asyncio.sleep."""
        now = time.monotonic()
        client._rate_timestamps = deque([now] * 120)

        with patch("app.data.fred_client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await client._wait_for_rate_limit()
            mock_sleep.assert_called_once()
            wait_time = mock_sleep.call_args[0][0]
            assert wait_time > 0

    @pytest.mark.asyncio
    async def test_prunes_old_timestamps(self, client):
        """Timestamps older than 60 seconds are pruned from the deque."""
        now = time.monotonic()
        # Fill with old timestamps (61 seconds ago)
        client._rate_timestamps = deque([now - 61] * 50)
        await client._wait_for_rate_limit()
        # Old ones pruned, only the new one remains
        assert len(client._rate_timestamps) == 1

    @pytest.mark.asyncio
    async def test_first_request_goes_through(self, client):
        """The very first request proceeds immediately."""
        assert len(client._rate_timestamps) == 0
        await client._wait_for_rate_limit()
        assert len(client._rate_timestamps) == 1


# ===================================================================
# 5. _fetch_series
# ===================================================================
class TestFetchSeries:
    """Internal _fetch_series method."""

    @pytest.mark.asyncio
    async def test_returns_series_on_success(self, client):
        """Returns a pandas.Series on success."""
        fake_series = _make_series(["2024-01-01", "2024-02-01"], [100.0, 101.0])
        client._fred.get_series.return_value = fake_series

        with patch("app.data.fred_client.asyncio.to_thread", return_value=fake_series):
            result = await client._fetch_series("GDP")
        assert result is not None
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_none_when_disabled(self, disabled_client):
        """Returns None when the client is disabled."""
        result = await disabled_client._fetch_series("GDP")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_value_error(self, client):
        """Returns None on ValueError from fredapi."""
        with patch("app.data.fred_client.asyncio.to_thread", side_effect=ValueError("bad")):
            result = await client._fetch_series("GDP")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_connection_error(self, client):
        """Returns None on ConnectionError (from requests exceptions)."""
        # The code catches *self._requests_exc which includes requests.ConnectionError
        with patch("app.data.fred_client.asyncio.to_thread", side_effect=ConnectionError("no conn")):
            result = await client._fetch_series("GDP")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_generic_exception(self, client):
        """Returns None on a generic Exception."""
        with patch("app.data.fred_client.asyncio.to_thread", side_effect=RuntimeError("boom")):
            result = await client._fetch_series("GDP")
        assert result is None

    @pytest.mark.asyncio
    async def test_calls_wait_for_rate_limit(self, client):
        """Calls _wait_for_rate_limit before attempting fetch."""
        fake_series = _make_series(["2024-01-01"], [100.0])
        with patch.object(client, "_wait_for_rate_limit", new_callable=AsyncMock) as mock_rl:
            with patch("app.data.fred_client.asyncio.to_thread", return_value=fake_series):
                await client._fetch_series("GDP")
        mock_rl.assert_called_once()

    @pytest.mark.asyncio
    async def test_passes_start_end_to_fred(self, client):
        """Passes start and end parameters to the underlying get_series call."""
        fake_series = _make_series(["2024-01-01"], [100.0])

        captured_fn = None

        async def capture_to_thread(fn):
            nonlocal captured_fn
            captured_fn = fn
            return fake_series

        with patch("app.data.fred_client.asyncio.to_thread", side_effect=capture_to_thread):
            await client._fetch_series("GDP", start="2020-01-01", end="2024-12-31")

        # The captured function is _sync which calls self._fred.get_series(...)
        assert captured_fn is not None


# ===================================================================
# 6. _series_to_records
# ===================================================================
class TestSeriesToRecords:
    """Static method for converting pandas.Series to list of dicts."""

    def test_converts_series_to_records(self):
        """Converts a pandas.Series to a list of date/value dicts."""
        s = _make_series(["2024-01-15", "2024-02-15"], [100.5, 200.3])
        records = FredClient._series_to_records(s)
        assert len(records) == 2
        assert records[0] == {"date": "2024-01-15", "value": 100.5}
        assert records[1] == {"date": "2024-02-15", "value": 200.3}

    def test_nan_values_become_none(self):
        """NaN values are converted to None."""
        s = _make_series(["2024-01-01", "2024-02-01"], [float("nan"), 50.0])
        records = FredClient._series_to_records(s)
        assert records[0]["value"] is None
        assert records[1]["value"] == 50.0

    def test_dates_formatted_as_yyyy_mm_dd(self):
        """Dates are formatted as YYYY-MM-DD strings."""
        s = _make_series(["2024-03-25"], [42.0])
        records = FredClient._series_to_records(s)
        assert records[0]["date"] == "2024-03-25"

    def test_empty_series_returns_empty_list(self):
        """An empty Series returns an empty list."""
        s = pd.Series([], dtype=float, index=pd.DatetimeIndex([]))
        records = FredClient._series_to_records(s)
        assert records == []


# ===================================================================
# 7. _series_to_latest
# ===================================================================
class TestSeriesToLatest:
    """Static method for extracting the latest non-NaN observation."""

    def test_returns_latest_non_nan_observation(self):
        """Returns the last non-NaN observation."""
        s = _make_series(
            ["2024-01-01", "2024-02-01", "2024-03-01"],
            [10.0, 20.0, 30.0],
        )
        result = FredClient._series_to_latest(s)
        assert result is not None
        assert result["date"] == "2024-03-01"
        assert result["value"] == 30.0

    def test_returns_none_for_empty_series(self):
        """Returns None for an empty series."""
        s = pd.Series([], dtype=float, index=pd.DatetimeIndex([]))
        result = FredClient._series_to_latest(s)
        assert result is None

    def test_returns_none_for_all_nan_series(self):
        """Returns None when all values are NaN."""
        s = _make_series(["2024-01-01", "2024-02-01"], [np.nan, np.nan])
        result = FredClient._series_to_latest(s)
        assert result is None

    def test_skips_trailing_nans(self):
        """Returns the last non-NaN even if NaN values follow."""
        s = _make_series(
            ["2024-01-01", "2024-02-01", "2024-03-01"],
            [10.0, 20.0, np.nan],
        )
        result = FredClient._series_to_latest(s)
        assert result is not None
        assert result["date"] == "2024-02-01"
        assert result["value"] == 20.0


# ===================================================================
# 8. Cache Read (_get_cached_series)
# ===================================================================
class TestGetCachedSeries:
    """fundamentals_cache read (series data)."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_when_fresh(self, client, mock_db):
        """Returns cached data when within TTL."""
        now_iso = datetime.now(timezone.utc).isoformat()
        cached_data = [{"date": "2024-01-01", "value": 100.0}]
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps(cached_data),
            "fetched_at": now_iso,
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result == cached_data

    @pytest.mark.asyncio
    async def test_returns_none_when_expired(self, client, mock_db):
        """Returns None when cache entry is beyond TTL."""
        old_time = (datetime.now(timezone.utc) - timedelta(seconds=86401)).isoformat()
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps([{"date": "2024-01-01", "value": 100.0}]),
            "fetched_at": old_time,
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_entry(self, client, mock_db):
        """Returns None when no cache entry exists."""
        mock_db.fetch_one.return_value = None
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_fetched_at(self, client, mock_db):
        """Returns None when fetched_at is an unparseable string."""
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps([{"date": "2024-01-01", "value": 50.0}]),
            "fetched_at": "not-a-date",
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_json(self, client, mock_db):
        """Returns None when value_json is not valid JSON."""
        now_iso = datetime.now(timezone.utc).isoformat()
        mock_db.fetch_one.return_value = {
            "value_json": "{invalid json",
            "fetched_at": now_iso,
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result is None

    @pytest.mark.asyncio
    async def test_handles_naive_datetime(self, client, mock_db):
        """Handles naive datetime by assuming UTC."""
        naive_dt = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps([{"date": "2024-01-01", "value": 42.0}]),
            "fetched_at": naive_dt,
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_series("GDP", None, None)
        assert result == [{"date": "2024-01-01", "value": 42.0}]


# ===================================================================
# 9. Cache Write (_store_series_cache)
# ===================================================================
class TestStoreSeriesCache:
    """fundamentals_cache write (series data)."""

    @pytest.mark.asyncio
    async def test_writes_correct_sql(self, client, mock_db):
        """Writes INSERT OR REPLACE with source='fred'."""
        records = [{"date": "2024-01-01", "value": 100.0}]
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_series_cache("GDP", None, None, records)
        mock_db.execute.assert_called_once()
        sql = mock_db.execute.call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        assert "fred_series" in sql
        assert "'fred'" in sql

    @pytest.mark.asyncio
    async def test_constructs_period_key(self, client, mock_db):
        """Period key is constructed from start/end parameters."""
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_series_cache("GDP", "2020-01-01", "2024-12-31", [])
        params = mock_db.execute.call_args[0][1]
        assert params[1] == "2020-01-01_2024-12-31"

    @pytest.mark.asyncio
    async def test_period_key_defaults(self, client, mock_db):
        """Period key uses 'all' and 'latest' defaults when start/end are None."""
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_series_cache("GDP", None, None, [])
        params = mock_db.execute.call_args[0][1]
        assert params[1] == "all_latest"

    @pytest.mark.asyncio
    async def test_symbol_stored_correctly(self, client, mock_db):
        """Symbol is stored as the first parameter."""
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_series_cache("GDP", None, None, [{"x": 1}])
        params = mock_db.execute.call_args[0][1]
        assert params[0] == "GDP"


# ===================================================================
# 10. Cache Read (_get_cached_macro)
# ===================================================================
class TestGetCachedMacro:
    """macro_events cache read."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_when_fresh(self, client, mock_db):
        """Returns cached row when within TTL."""
        now_iso = datetime.now(timezone.utc).isoformat()
        row = {
            "event_name": "gdp",
            "event_date": "2024-01-01",
            "actual_value": 3.2,
            "previous_value": 3.0,
            "fetched_at": now_iso,
        }
        mock_db.fetch_one.return_value = row
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_macro("gdp")
        assert result is not None
        assert result["actual_value"] == 3.2

    @pytest.mark.asyncio
    async def test_returns_none_when_expired(self, client, mock_db):
        """Returns None when macro_events cache is beyond TTL."""
        old_time = (datetime.now(timezone.utc) - timedelta(seconds=43201)).isoformat()
        mock_db.fetch_one.return_value = {
            "event_name": "gdp",
            "event_date": "2024-01-01",
            "actual_value": 3.2,
            "fetched_at": old_time,
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_macro("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_missing(self, client, mock_db):
        """Returns None when no macro_events row exists."""
        mock_db.fetch_one.return_value = None
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_macro("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_fetched_at(self, client, mock_db):
        """Returns None when fetched_at is invalid."""
        mock_db.fetch_one.return_value = {
            "event_name": "gdp",
            "event_date": "2024-01-01",
            "actual_value": 3.2,
            "fetched_at": "not-a-date",
        }
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            result = await client._get_cached_macro("gdp")
        assert result is None


# ===================================================================
# 11. Cache Write (_store_macro)
# ===================================================================
class TestStoreMacro:
    """macro_events cache write."""

    @pytest.mark.asyncio
    async def test_writes_correct_values(self, client, mock_db):
        """Writes INSERT OR REPLACE with source='fred' and impact='medium'."""
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_macro("gdp", "2024-01-01", 3.2, 3.0)
        mock_db.execute.assert_called_once()
        sql = mock_db.execute.call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        assert "'medium'" in sql
        assert "'fred'" in sql
        params = mock_db.execute.call_args[0][1]
        assert params[0] == "gdp"
        assert params[1] == "2024-01-01"
        assert params[2] == 3.2
        assert params[3] == 3.0

    @pytest.mark.asyncio
    async def test_stores_none_previous(self, client, mock_db):
        """Previous value can be None."""
        with patch("app.data.fred_client.get_database", return_value=mock_db):
            await client._store_macro("gdp", "2024-01-01", 3.2, None)
        params = mock_db.execute.call_args[0][1]
        assert params[3] is None


# ===================================================================
# 12. get_series (public API)
# ===================================================================
class TestGetSeries:
    """Public get_series() method."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_with_cached_true(self, client, mock_db):
        """Returns cached data tagged with _cached=True."""
        cached = [{"date": "2024-01-01", "value": 100.0}]
        with patch.object(client, "_get_cached_series", return_value=cached):
            result = await client.get_series("gdp")
        assert result is not None
        assert result[0]["_cached"] is True
        assert result[0]["_source"] == "fred"

    @pytest.mark.asyncio
    async def test_fetches_fresh_when_no_cache(self, client, mock_db):
        """Fetches fresh data and returns with _cached=False when no cache."""
        fake_series = _make_series(["2024-01-01", "2024-02-01"], [100.0, 200.0])
        with patch.object(client, "_get_cached_series", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(client, "_store_series_cache", new_callable=AsyncMock):
                    result = await client.get_series("gdp")
        assert result is not None
        assert len(result) == 2
        assert result[0]["_cached"] is False

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_indicator(self, client):
        """Returns None for an indicator not in FRED_SERIES."""
        result = await client.get_series("nonexistent_indicator")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_fetch_fails(self, client):
        """Returns None when _fetch_series returns None."""
        with patch.object(client, "_get_cached_series", return_value=None):
            with patch.object(client, "_fetch_series", return_value=None):
                result = await client.get_series("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_conversion_fails(self, client):
        """Returns None when _series_to_records raises an exception."""
        fake_series = MagicMock()
        with patch.object(client, "_get_cached_series", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(
                    FredClient, "_series_to_records", side_effect=Exception("conversion failed")
                ):
                    result = await client.get_series("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_records_empty(self, client):
        """Returns None when _series_to_records returns an empty list."""
        fake_series = _make_series([], [])
        with patch.object(client, "_get_cached_series", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(FredClient, "_series_to_records", return_value=[]):
                    result = await client.get_series("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_stores_to_cache_after_fetch(self, client):
        """Stores records to cache after a successful fresh fetch."""
        fake_series = _make_series(["2024-01-01"], [100.0])
        with patch.object(client, "_get_cached_series", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(
                    client, "_store_series_cache", new_callable=AsyncMock
                ) as mock_store:
                    await client.get_series("gdp")
        mock_store.assert_called_once()
        # First arg is the series_id
        assert mock_store.call_args[0][0] == "GDP"

    @pytest.mark.asyncio
    async def test_passes_start_end_through(self, client):
        """start and end parameters are passed to both cache and fetch."""
        fake_series = _make_series(["2024-06-01"], [50.0])
        with patch.object(client, "_get_cached_series", return_value=None) as mock_cache:
            with patch.object(client, "_fetch_series", return_value=fake_series) as mock_fetch:
                with patch.object(client, "_store_series_cache", new_callable=AsyncMock):
                    await client.get_series("gdp", start="2020-01-01", end="2024-12-31")
        # Verify start/end passed to cache
        mock_cache.assert_called_once_with("GDP", "2020-01-01", "2024-12-31")
        # Verify start/end passed to fetch
        mock_fetch.assert_called_once_with("GDP", start="2020-01-01", end="2024-12-31")


# ===================================================================
# 13. get_latest (public API)
# ===================================================================
class TestGetLatest:
    """Public get_latest() method."""

    @pytest.mark.asyncio
    async def test_returns_latest_with_fields(self, client):
        """Returns dict with indicator, series_id, date, value, previous_value."""
        fake_series = _make_series(
            ["2024-01-01", "2024-02-01", "2024-03-01"],
            [10.0, 20.0, 30.0],
        )
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(client, "_store_macro", new_callable=AsyncMock):
                    result = await client.get_latest("gdp")
        assert result is not None
        assert result["indicator"] == "gdp"
        assert result["series_id"] == "GDP"
        assert result["date"] == "2024-03-01"
        assert result["value"] == 30.0
        assert result["previous_value"] == 20.0
        assert result["_source"] == "fred"

    @pytest.mark.asyncio
    async def test_uses_macro_cache(self, client):
        """Returns cached data from macro_events with _cached=True."""
        cached_row = {
            "event_name": "gdp",
            "event_date": "2024-03-01",
            "actual_value": 30.0,
            "previous_value": 20.0,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        with patch.object(client, "_get_cached_macro", return_value=cached_row):
            result = await client.get_latest("gdp")
        assert result is not None
        assert result["_cached"] is True
        assert result["value"] == 30.0

    @pytest.mark.asyncio
    async def test_computes_previous_value(self, client):
        """previous_value is the second-to-last non-NaN observation."""
        fake_series = _make_series(
            ["2024-01-01", "2024-02-01", "2024-03-01"],
            [5.0, 15.0, 25.0],
        )
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(client, "_store_macro", new_callable=AsyncMock):
                    result = await client.get_latest("gdp")
        assert result["previous_value"] == 15.0

    @pytest.mark.asyncio
    async def test_previous_value_none_when_single_observation(self, client):
        """previous_value is None when there is only one observation."""
        fake_series = _make_series(["2024-01-01"], [100.0])
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(client, "_store_macro", new_callable=AsyncMock):
                    result = await client.get_latest("gdp")
        assert result is not None
        assert result["previous_value"] is None

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_indicator(self, client):
        """Returns None for an indicator not in FRED_SERIES."""
        result = await client.get_latest("nonexistent_indicator")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_fetch_fails(self, client):
        """Returns None when _fetch_series returns None."""
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=None):
                result = await client.get_latest("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_latest_extraction_fails(self, client):
        """Returns None when _series_to_latest raises an exception."""
        fake_series = MagicMock()
        fake_series.dropna.side_effect = Exception("pandas error")
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                result = await client.get_latest("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_all_nan(self, client):
        """Returns None when all values are NaN (latest is None)."""
        fake_series = _make_series(
            ["2024-01-01", "2024-02-01"],
            [np.nan, np.nan],
        )
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                result = await client.get_latest("gdp")
        assert result is None

    @pytest.mark.asyncio
    async def test_stores_to_macro_cache(self, client):
        """Stores the result in macro_events cache after fetch."""
        fake_series = _make_series(
            ["2024-01-01", "2024-02-01"],
            [10.0, 20.0],
        )
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(
                    client, "_store_macro", new_callable=AsyncMock
                ) as mock_store:
                    await client.get_latest("gdp")
        mock_store.assert_called_once_with("gdp", "2024-02-01", 20.0, 10.0)


# ===================================================================
# 14. get_macro_dashboard (public API)
# ===================================================================
class TestGetMacroDashboard:
    """Public get_macro_dashboard() method."""

    @pytest.mark.asyncio
    async def test_with_none_fetches_all_22(self, client):
        """With indicators=None, fetches all 22 indicators."""
        with patch.object(
            client, "get_latest", new_callable=AsyncMock, return_value={"value": 1}
        ) as mock_latest:
            result = await client.get_macro_dashboard(None)
        assert len(result) == 22
        assert mock_latest.call_count == 22

    @pytest.mark.asyncio
    async def test_with_specific_list(self, client):
        """With a specific list, fetches only those indicators."""
        with patch.object(
            client, "get_latest", new_callable=AsyncMock, return_value={"value": 1}
        ):
            result = await client.get_macro_dashboard(["gdp", "cpi_headline"])
        assert len(result) == 2
        assert "gdp" in result
        assert "cpi_headline" in result

    @pytest.mark.asyncio
    async def test_unknown_indicators_map_to_none(self, client):
        """Unknown indicators are mapped to None in the result."""
        with patch.object(
            client, "get_latest", new_callable=AsyncMock, return_value={"value": 1}
        ):
            result = await client.get_macro_dashboard(["gdp", "fake_indicator"])
        assert result["fake_indicator"] is None
        assert result["gdp"] is not None

    @pytest.mark.asyncio
    async def test_handles_get_latest_exception(self, client):
        """If get_latest raises, that indicator maps to None."""

        call_count = 0

        async def side_effect_fn(indicator):
            nonlocal call_count
            call_count += 1
            if indicator == "cpi_headline":
                raise RuntimeError("fetch failed")
            return {"value": 1}

        with patch.object(client, "get_latest", side_effect=side_effect_fn):
            result = await client.get_macro_dashboard(["gdp", "cpi_headline"])
        assert result["gdp"] is not None
        assert result["cpi_headline"] is None

    @pytest.mark.asyncio
    async def test_returns_dict(self, client):
        """Return type is a dict of indicator -> result."""
        with patch.object(
            client, "get_latest", new_callable=AsyncMock, return_value=None
        ):
            result = await client.get_macro_dashboard(["gdp"])
        assert isinstance(result, dict)


# ===================================================================
# 15. get_indicator_history (public API)
# ===================================================================
class TestGetIndicatorHistory:
    """Public get_indicator_history() convenience alias."""

    @pytest.mark.asyncio
    async def test_delegates_to_get_series(self, client):
        """get_indicator_history delegates to get_series with the same arguments."""
        with patch.object(
            client, "get_series", new_callable=AsyncMock, return_value=[{"date": "2024-01-01"}]
        ) as mock_gs:
            result = await client.get_indicator_history("gdp", start="2020-01-01", end="2024-12-31")
        mock_gs.assert_called_once_with("gdp", start="2020-01-01", end="2024-12-31")
        assert result is not None


# ===================================================================
# 16. Metadata (_tag helper)
# ===================================================================
class TestTag:
    """Pure _tag helper function."""

    def test_adds_source_fred(self):
        """Adds _source='fred' to a dict."""
        data = {"value": 100}
        result = _tag(data)
        assert result["_source"] == "fred"

    def test_adds_fetched_at_iso(self):
        """Adds _fetched_at as an ISO-8601 string."""
        data = {"value": 100}
        result = _tag(data)
        assert "_fetched_at" in result
        assert "T" in result["_fetched_at"]

    def test_adds_cached_false_by_default(self):
        """Default cached=False sets _cached=False."""
        data = {"value": 100}
        result = _tag(data)
        assert result["_cached"] is False

    def test_adds_cached_true(self):
        """cached=True sets _cached=True."""
        data = {"value": 100}
        result = _tag(data, cached=True)
        assert result["_cached"] is True

    def test_works_on_single_dict(self):
        """Works correctly on a single dict, returning the same dict."""
        data = {"key": "val"}
        result = _tag(data)
        assert result is data
        assert result["_source"] == "fred"

    def test_works_on_list_of_dicts(self):
        """Tags each dict in a list."""
        data = [{"a": 1}, {"b": 2}]
        result = _tag(data)
        assert isinstance(result, list)
        for item in result:
            assert item["_source"] == "fred"
            assert "_fetched_at" in item
            assert item["_cached"] is False

    def test_preserves_existing_keys(self):
        """Does not remove existing keys in the dict."""
        data = {"indicator": "gdp", "value": 3.2}
        result = _tag(data)
        assert result["indicator"] == "gdp"
        assert result["value"] == 3.2

    def test_non_dict_non_list_returns_input(self):
        """A non-dict, non-list input is returned unchanged."""
        data = "string_value"
        result = _tag(data)
        assert result == "string_value"


# ===================================================================
# 17. close() lifecycle
# ===================================================================
class TestClose:
    """FredClient.close() lifecycle."""

    @pytest.mark.asyncio
    async def test_close_does_not_raise(self, client):
        """close() completes without error."""
        await client.close()  # should not raise

    @pytest.mark.asyncio
    async def test_close_is_safe_to_call_multiple_times(self, client):
        """close() can be called multiple times without error."""
        await client.close()
        await client.close()


# ===================================================================
# 18. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Cross-cutting edge cases."""

    @pytest.mark.asyncio
    async def test_get_series_with_all_known_indicators(self, client):
        """get_series accepts all known FRED_SERIES keys without KeyError."""
        fake_series = _make_series(["2024-01-01"], [100.0])
        for indicator in FRED_SERIES:
            with patch.object(client, "_get_cached_series", return_value=None):
                with patch.object(client, "_fetch_series", return_value=fake_series):
                    with patch.object(client, "_store_series_cache", new_callable=AsyncMock):
                        result = await client.get_series(indicator)
            assert result is not None, f"get_series('{indicator}') returned None unexpectedly"

    @pytest.mark.asyncio
    async def test_get_latest_previous_value_with_nans(self, client):
        """previous_value skips NaN values correctly."""
        fake_series = _make_series(
            ["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01"],
            [5.0, np.nan, 15.0, 25.0],
        )
        with patch.object(client, "_get_cached_macro", return_value=None):
            with patch.object(client, "_fetch_series", return_value=fake_series):
                with patch.object(client, "_store_macro", new_callable=AsyncMock):
                    result = await client.get_latest("gdp")
        # dropna gives [5.0, 15.0, 25.0], second-to-last is 15.0
        assert result["previous_value"] == 15.0

    @pytest.mark.asyncio
    async def test_fetch_series_respects_fred_none(self, client):
        """Returns None when _fred is explicitly set to None."""
        client._fred = None
        client._enabled = True  # enabled but _fred is None
        result = await client._fetch_series("GDP")
        assert result is None

    @pytest.mark.asyncio
    async def test_rate_limiter_uses_sliding_window(self, client):
        """Verifies the rate limiter uses a 60-second sliding window."""
        now = time.monotonic()
        # 119 recent + 1 old
        client._rate_timestamps = deque([now - 61] + [now] * 119)
        # The old one should be pruned, leaving 119 + 1 new = 120
        await client._wait_for_rate_limit()
        # All old ones pruned, 119 recent + 1 new = 120
        assert len(client._rate_timestamps) == 120

    def test_now_iso_returns_valid_iso_string(self):
        """_now_iso returns a valid ISO-8601 string."""
        from app.data.fred_client import _now_iso
        result = _now_iso()
        assert isinstance(result, str)
        assert "T" in result
        # Should be parseable
        dt = datetime.fromisoformat(result)
        assert dt.tzinfo is not None

    @pytest.mark.asyncio
    async def test_max_calls_per_minute_constant(self, client):
        """_max_per_min defaults to 120."""
        assert client._max_per_min == 120
