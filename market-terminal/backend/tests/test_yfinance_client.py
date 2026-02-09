"""Tests for TASK-DATA-006: yfinance Fallback Data Client.

ALL yfinance calls are mocked -- no real Yahoo Finance requests are made.
Run: ``cd market-terminal/backend && python -m pytest tests/test_yfinance_client.py -v``
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pandas as pd
import pytest

import app.data.yfinance_client as mod
from app.data.yfinance_client import (
    CircuitState, YFinanceClient, close_yfinance_client, get_yfinance_client,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_df(rows, date_col="Date"):
    """Build a pandas DataFrame with DatetimeIndex for historical data."""
    df = pd.DataFrame(rows)
    if rows:
        dates = [r.get(date_col, "2024-01-01") for r in rows]
        df.index = pd.DatetimeIndex(dates)
        if date_col in df.columns:
            df = df.drop(columns=[date_col])
    else:
        df.index = pd.DatetimeIndex([])
    return df

def _make_fin_df(data, periods):
    """Build a financials-style DataFrame (items as index, dates as columns)."""
    return pd.DataFrame(
        list(data.values()), index=pd.Index(list(data.keys())),
        columns=pd.DatetimeIndex(periods),
    )

_HIST_ROW = {"Date": "2024-01-02", "Open": 100.0, "High": 105.0, "Low": 98.0,
             "Close": 103.0, "Adj Close": 102.5, "Volume": 1000000}
_VALID_INFO = {"currentPrice": 150.0, "volume": 1000}
_FULL_TICKER = {
    "currentPrice": 150.0, "regularMarketChange": 1.5,
    "regularMarketChangePercent": 1.01, "dayHigh": 151.0, "dayLow": 149.0,
    "open": 149.5, "regularMarketPreviousClose": 148.5, "volume": 50000000,
    "marketCap": 2500000000000,
}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    mod._client = None
    yield
    mod._client = None

@pytest.fixture
def mock_settings():
    s = MagicMock()
    s.circuit_breaker_failure_threshold = 3
    s.circuit_breaker_window_seconds = 300
    s.circuit_breaker_cooldown_seconds = 900
    return s

@pytest.fixture
def client(mock_settings):
    c = YFinanceClient.__new__(YFinanceClient)
    c._cb_failure_threshold = 3
    c._cb_window_seconds = 300
    c._cb_cooldown_seconds = 900
    c._is_fallback = True
    c._yf = MagicMock()
    c._enabled = True
    c._circuit_state = CircuitState.CLOSED
    c._failure_timestamps = deque()
    c._circuit_opened_at = 0.0
    return c

@pytest.fixture
def disabled_client(mock_settings):
    c = YFinanceClient.__new__(YFinanceClient)
    c._cb_failure_threshold = 3
    c._cb_window_seconds = 300
    c._cb_cooldown_seconds = 900
    c._is_fallback = True
    c._yf = None
    c._enabled = False
    c._circuit_state = CircuitState.CLOSED
    c._failure_timestamps = deque()
    c._circuit_opened_at = 0.0
    return c

def _open_circuit(client):
    """Put client into OPEN state (helper)."""
    client._circuit_state = CircuitState.OPEN
    client._circuit_opened_at = time.monotonic()

# ===================================================================
# 1. CircuitState Enum
# ===================================================================
class TestCircuitStateEnum:
    def test_has_closed_value(self):
        assert CircuitState.CLOSED.value == "closed"

    def test_has_open_value(self):
        assert CircuitState.OPEN.value == "open"

    def test_has_half_open_value(self):
        assert CircuitState.HALF_OPEN.value == "half_open"

    def test_exactly_three_members(self):
        assert len(CircuitState) == 3

# ===================================================================
# 2. Singleton
# ===================================================================
class TestSingleton:
    def test_returns_instance(self, mock_settings):
        assert mod._client is None
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                assert isinstance(get_yfinance_client(), YFinanceClient)

    def test_returns_same_instance(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                assert get_yfinance_client() is get_yfinance_client()

    @pytest.mark.asyncio
    async def test_close_clears_singleton(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                get_yfinance_client()
        assert mod._client is not None
        await close_yfinance_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_close_safe_when_none(self):
        assert mod._client is None
        await close_yfinance_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_new_instance_after_close(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                first = get_yfinance_client()
                await close_yfinance_client()
                second = get_yfinance_client()
        assert first is not second and isinstance(second, YFinanceClient)

# ===================================================================
# 3. __init__
# ===================================================================
class TestInit:
    def test_yfinance_installed_enabled(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                c = YFinanceClient()
        assert c._enabled is True and c._yf is not None

    def test_import_error_disabled(self, mock_settings):
        import sys as _sys
        saved = _sys.modules.pop("yfinance", None)
        try:
            orig = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__
            def _imp(name, *a, **kw):
                if name == "yfinance": raise ImportError
                return orig(name, *a, **kw)
            with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
                with patch("builtins.__import__", side_effect=_imp):
                    c = YFinanceClient()
            assert c._enabled is False and c._yf is None
        finally:
            if saved is not None: _sys.modules["yfinance"] = saved

    def test_circuit_breaker_initial_state(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                c = YFinanceClient()
        assert c._circuit_state == CircuitState.CLOSED

    def test_reads_settings(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                c = YFinanceClient()
        assert (c._cb_failure_threshold, c._cb_window_seconds, c._cb_cooldown_seconds) == (3, 300, 900)

    def test_failure_timestamps_empty(self, mock_settings):
        with patch("app.data.yfinance_client.get_settings", return_value=mock_settings):
            with patch.dict("sys.modules", {"yfinance": MagicMock()}):
                c = YFinanceClient()
        assert len(c._failure_timestamps) == 0

# ===================================================================
# 4. Circuit Breaker
# ===================================================================
class TestCircuitBreaker:
    def test_record_failure_increments(self, client):
        client._record_failure()
        assert len(client._failure_timestamps) == 1

    def test_record_failure_opens_at_threshold(self, client):
        for _ in range(2): client._record_failure()
        assert client._circuit_state == CircuitState.CLOSED
        client._record_failure()
        assert client._circuit_state == CircuitState.OPEN

    def test_record_failure_prunes_old(self, client):
        old = time.monotonic() - client._cb_window_seconds - 10
        client._failure_timestamps = deque([old, old])
        client._record_failure()
        assert len(client._failure_timestamps) == 1
        assert client._circuit_state == CircuitState.CLOSED

    def test_record_failure_logs_transition(self, client):
        with patch("app.data.yfinance_client.logger") as log:
            for _ in range(3): client._record_failure()
        assert "OPEN" in log.warning.call_args[0][0]

    def test_record_success_closes_half_open(self, client):
        client._circuit_state = CircuitState.HALF_OPEN
        client._failure_timestamps = deque([time.monotonic()])
        client._record_success()
        assert client._circuit_state == CircuitState.CLOSED

    def test_record_success_clears_failures(self, client):
        client._circuit_state = CircuitState.HALF_OPEN
        client._failure_timestamps = deque([time.monotonic(), time.monotonic()])
        client._record_success()
        assert len(client._failure_timestamps) == 0

    def test_record_success_noop_when_closed(self, client):
        client._failure_timestamps = deque([time.monotonic()])
        client._record_success()
        assert client._circuit_state == CircuitState.CLOSED
        assert len(client._failure_timestamps) == 1

    def test_check_true_when_closed(self, client):
        assert client._check_circuit() is True

    def test_check_false_when_open_before_cooldown(self, client):
        _open_circuit(client)
        assert client._check_circuit() is False

    def test_check_open_to_half_open_after_cooldown(self, client):
        client._circuit_state = CircuitState.OPEN
        client._circuit_opened_at = time.monotonic() - client._cb_cooldown_seconds - 1
        assert client._check_circuit() is True
        assert client._circuit_state == CircuitState.HALF_OPEN

    def test_check_true_when_half_open(self, client):
        client._circuit_state = CircuitState.HALF_OPEN
        assert client._check_circuit() is True

# ===================================================================
# 5. _run_sync
# ===================================================================
class TestRunSync:
    @pytest.mark.asyncio
    async def test_calls_function(self, client):
        with patch("app.data.yfinance_client.asyncio.wait_for", new_callable=AsyncMock, return_value={"d": 42}):
            assert await client._run_sync(MagicMock()) == {"d": 42}

    @pytest.mark.asyncio
    async def test_none_on_timeout(self, client):
        with patch("app.data.yfinance_client.asyncio.wait_for", new_callable=AsyncMock, side_effect=asyncio.TimeoutError()):
            assert await client._run_sync(MagicMock()) is None

    @pytest.mark.asyncio
    async def test_none_on_exception(self, client):
        with patch("app.data.yfinance_client.asyncio.wait_for", new_callable=AsyncMock, side_effect=RuntimeError("boom")):
            assert await client._run_sync(MagicMock()) is None

    @pytest.mark.asyncio
    async def test_records_failure_on_timeout(self, client):
        with patch("app.data.yfinance_client.asyncio.wait_for", new_callable=AsyncMock, side_effect=asyncio.TimeoutError()):
            await client._run_sync(MagicMock())
        assert len(client._failure_timestamps) == 1

    @pytest.mark.asyncio
    async def test_records_failure_on_exception(self, client):
        with patch("app.data.yfinance_client.asyncio.wait_for", new_callable=AsyncMock, side_effect=ValueError("bad")):
            await client._run_sync(MagicMock())
        assert len(client._failure_timestamps) == 1

# ===================================================================
# 6. _add_metadata
# ===================================================================
class TestAddMetadata:
    def test_adds_source(self, client):
        assert client._add_metadata({"p": 1})["_source"] == "yfinance"

    def test_adds_fetched_at(self, client):
        r = client._add_metadata({"p": 1})
        assert "_fetched_at" in r and "T" in r["_fetched_at"]

    def test_adds_is_fallback(self, client):
        assert client._add_metadata({"p": 1})["_is_fallback"] is True

    def test_works_on_dict(self, client):
        d = {"k": "v"}
        assert client._add_metadata(d) is d and d["_source"] == "yfinance"

    def test_works_on_list(self, client):
        data = [{"a": 1}, {"b": 2}]
        result = client._add_metadata(data)
        assert all(i["_source"] == "yfinance" and i["_is_fallback"] is True for i in result)

    def test_non_dict_non_list(self, client):
        assert client._add_metadata("str") == "str"

# ===================================================================
# 7. _validate_quote
# ===================================================================
class TestValidateQuote:
    def test_valid(self):
        assert YFinanceClient._validate_quote({"current_price": 150.0, "volume": 1000000}) is True

    def test_zero_price(self):
        assert YFinanceClient._validate_quote({"current_price": 0}) is False

    def test_negative_price(self):
        assert YFinanceClient._validate_quote({"current_price": -5.0}) is False

    def test_missing_price(self):
        assert YFinanceClient._validate_quote({"volume": 1000}) is False

    def test_none_price(self):
        assert YFinanceClient._validate_quote({"current_price": None}) is False

    def test_negative_volume(self):
        assert YFinanceClient._validate_quote({"current_price": 150.0, "volume": -1}) is False

    def test_none_volume_ok(self):
        assert YFinanceClient._validate_quote({"current_price": 150.0, "volume": None}) is True

    def test_no_volume_key_ok(self):
        assert YFinanceClient._validate_quote({"current_price": 150.0}) is True

# ===================================================================
# 8. _validate_historical
# ===================================================================
class TestValidateHistorical:
    def test_valid(self):
        assert YFinanceClient._validate_historical([{"open": 100, "high": 105, "low": 98, "close": 103}])

    def test_empty(self):
        assert YFinanceClient._validate_historical([]) is False

    def test_negative_open(self):
        assert YFinanceClient._validate_historical([{"open": -1, "high": 105, "low": 98, "close": 103}]) is False

    def test_negative_close(self):
        assert YFinanceClient._validate_historical([{"open": 100, "high": 105, "low": 98, "close": -1}]) is False

    def test_negative_high(self):
        assert YFinanceClient._validate_historical([{"open": 100, "high": -1, "low": 98, "close": 103}]) is False

    def test_negative_low(self):
        assert YFinanceClient._validate_historical([{"open": 100, "high": 105, "low": -1, "close": 103}]) is False

    def test_none_values_ok(self):
        assert YFinanceClient._validate_historical([{"open": None, "high": None, "low": None, "close": None}])

    def test_multi_bar_valid(self):
        assert YFinanceClient._validate_historical([
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": 103, "high": 108, "low": 101, "close": 106},
        ])

    def test_one_bad_bar(self):
        assert YFinanceClient._validate_historical([
            {"open": 100, "high": 105, "low": 98, "close": 103},
            {"open": -1, "high": 108, "low": 101, "close": 106},
        ]) is False

# ===================================================================
# 9. _df_to_records
# ===================================================================
class TestDfToRecords:
    def test_converts(self):
        df = _make_fin_df({"Total Revenue": [100.0, 200.0], "Net Income": [10.0, 20.0]}, ["2024-03-31", "2024-06-30"])
        r = YFinanceClient._df_to_records(df)
        assert len(r) == 2 and r[0]["period"] == "2024-03-31" and r[0]["total_revenue"] == 100.0

    def test_empty_df(self):
        assert YFinanceClient._df_to_records(pd.DataFrame()) == []

    def test_none_df(self):
        assert YFinanceClient._df_to_records(None) == []

    def test_nan_becomes_none(self):
        df = _make_fin_df({"Revenue": [100.0, np.nan]}, ["2024-03-31", "2024-06-30"])
        r = YFinanceClient._df_to_records(df)
        assert r[0]["revenue"] == 100.0 and r[1]["revenue"] is None

# ===================================================================
# 10. get_quote
# ===================================================================
class TestGetQuote:
    @pytest.mark.asyncio
    async def test_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_FULL_TICKER):
            r = await client.get_quote("AAPL")
        assert r["symbol"] == "AAPL" and r["current_price"] == 150.0
        assert r["change"] == 1.5 and r["percent_change"] == 1.01
        assert r["high"] == 151.0 and r["low"] == 149.0 and r["open"] == 149.5
        assert r["previous_close"] == 148.5 and r["volume"] == 50000000
        assert r["_source"] == "yfinance" and r["_is_fallback"] is True
        assert "_fetched_at" in r and "timestamp" in r

    @pytest.mark.asyncio
    async def test_disabled(self, disabled_client):
        assert await disabled_client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_circuit_open(self, client):
        _open_circuit(client)
        assert await client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_no_valid_price(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"sector": "Tech"}):
            assert await client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_price_zero(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"currentPrice": 0}):
            assert await client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_validation_fails(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"currentPrice": 150.0, "volume": -100}):
            assert await client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_run_sync_none(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=None):
            assert await client.get_quote("AAPL") is None

    @pytest.mark.asyncio
    async def test_record_success_called(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_VALID_INFO):
            with patch.object(client, "_record_success") as m:
                await client.get_quote("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_failure_no_price(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"sector": "Tech"}):
            with patch.object(client, "_record_failure") as m:
                await client.get_quote("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_failure_validation(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"currentPrice": 150.0, "volume": -1}):
            with patch.object(client, "_record_failure") as m:
                await client.get_quote("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_logs_start_and_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_VALID_INFO):
            with patch("app.data.yfinance_client.logger") as log:
                await client.get_quote("AAPL")
        calls = log.info.call_args_list
        assert "starting" in calls[0][0][0] and "success" in calls[-1][0][0]

    @pytest.mark.asyncio
    async def test_regular_market_fallback(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"regularMarketPrice": 145.0, "volume": 1000}):
            r = await client.get_quote("AAPL")
        assert r["current_price"] == 145.0

    @pytest.mark.asyncio
    async def test_uppercases_symbol(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_VALID_INFO):
            assert (await client.get_quote("aapl"))["symbol"] == "AAPL"

# ===================================================================
# 11. get_historical
# ===================================================================
class TestGetHistorical:
    @pytest.mark.asyncio
    async def test_success(self, client):
        df = _make_mock_df([_HIST_ROW, {**_HIST_ROW, "Date": "2024-01-03", "Open": 103.0}])
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=df):
            r = await client.get_historical("AAPL")
        assert len(r) == 2
        bar = r[0]
        assert {"date", "open", "high", "low", "close", "volume", "adjusted_close"}.issubset(bar)
        assert bar["_source"] == "yfinance" and bar["_is_fallback"] is True

    @pytest.mark.asyncio
    async def test_disabled(self, disabled_client):
        assert await disabled_client.get_historical("AAPL") is None

    @pytest.mark.asyncio
    async def test_circuit_open(self, client):
        _open_circuit(client)
        assert await client.get_historical("AAPL") is None

    @pytest.mark.asyncio
    async def test_empty_df(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=pd.DataFrame()):
            assert await client.get_historical("AAPL") is None

    @pytest.mark.asyncio
    async def test_none_df(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=None):
            assert await client.get_historical("AAPL") is None

    @pytest.mark.asyncio
    async def test_validation_fails(self, client):
        df = _make_mock_df([{**_HIST_ROW, "Open": -1.0}])
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=df):
            assert await client.get_historical("AAPL") is None

    @pytest.mark.asyncio
    async def test_expected_keys(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_make_mock_df([_HIST_ROW])):
            r = await client.get_historical("AAPL")
        assert {"date", "open", "high", "low", "close", "volume", "adjusted_close"}.issubset(r[0])

    @pytest.mark.asyncio
    async def test_record_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_make_mock_df([_HIST_ROW])):
            with patch.object(client, "_record_success") as m:
                await client.get_historical("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_failure_empty(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=pd.DataFrame()):
            with patch.object(client, "_record_failure") as m:
                await client.get_historical("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_nan_volume_none(self, client):
        df = _make_mock_df([{**_HIST_ROW, "Volume": float("nan")}])
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=df):
            r = await client.get_historical("AAPL")
        assert r[0]["volume"] is None

# ===================================================================
# 12. get_info
# ===================================================================
class TestGetInfo:
    _FULL_INFO = {
        "longName": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics",
        "exchange": "NMS", "marketCap": 2500000000000, "trailingPE": 25.0,
        "forwardPE": 22.0, "trailingEps": 6.15, "dividendYield": 0.005, "beta": 1.2,
        "fiftyTwoWeekHigh": 200.0, "fiftyTwoWeekLow": 130.0,
        "averageDailyVolume10Day": 50000000, "sharesOutstanding": 15000000000,
    }

    @pytest.mark.asyncio
    async def test_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=self._FULL_INFO):
            r = await client.get_info("AAPL")
        assert r["symbol"] == "AAPL" and r["name"] == "Apple Inc."
        assert r["sector"] == "Technology" and r["industry"] == "Consumer Electronics"
        assert r["pe_ratio"] == 25.0 and r["52w_high"] == 200.0
        assert r["_source"] == "yfinance" and r["_is_fallback"] is True

    @pytest.mark.asyncio
    async def test_disabled(self, disabled_client):
        assert await disabled_client.get_info("AAPL") is None

    @pytest.mark.asyncio
    async def test_circuit_open(self, client):
        _open_circuit(client)
        assert await client.get_info("AAPL") is None

    @pytest.mark.asyncio
    async def test_empty_info(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={}):
            assert await client.get_info("AAPL") is None

    @pytest.mark.asyncio
    async def test_none_info(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=None):
            assert await client.get_info("AAPL") is None

    @pytest.mark.asyncio
    async def test_reliability_field(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"longName": "X"}):
            r = await client.get_info("AAPL")
        assert "_reliability" in r and "unofficial" in r["_reliability"].lower()

    @pytest.mark.asyncio
    async def test_record_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"longName": "X"}):
            with patch.object(client, "_record_success") as m:
                await client.get_info("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_failure_empty(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={}):
            with patch.object(client, "_record_failure") as m:
                await client.get_info("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_short_name_fallback(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"shortName": "Apple Inc"}):
            assert (await client.get_info("AAPL"))["name"] == "Apple Inc"

# ===================================================================
# 13. get_financials
# ===================================================================
class TestGetFinancials:
    def _empty_raw(self):
        return {"income": pd.DataFrame(), "balance": pd.DataFrame(), "cashflow": pd.DataFrame()}

    @pytest.mark.asyncio
    async def test_success(self, client):
        raw = {
            "income": _make_fin_df({"Total Revenue": [100.0], "Net Income": [10.0]}, ["2024-03-31"]),
            "balance": _make_fin_df({"Total Assets": [500.0]}, ["2024-03-31"]),
            "cashflow": _make_fin_df({"Operating Cash Flow": [50.0]}, ["2024-03-31"]),
        }
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=raw):
            r = await client.get_financials("AAPL")
        assert r["symbol"] == "AAPL"
        assert isinstance(r["income_statement"], list) and len(r["income_statement"]) == 1
        assert r["income_statement"][0]["total_revenue"] == 100.0
        assert r["_source"] == "yfinance" and r["_is_fallback"] is True

    @pytest.mark.asyncio
    async def test_disabled(self, disabled_client):
        assert await disabled_client.get_financials("AAPL") is None

    @pytest.mark.asyncio
    async def test_circuit_open(self, client):
        _open_circuit(client)
        assert await client.get_financials("AAPL") is None

    @pytest.mark.asyncio
    async def test_none_response(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=None):
            assert await client.get_financials("AAPL") is None

    @pytest.mark.asyncio
    async def test_reliability_field(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=self._empty_raw()):
            r = await client.get_financials("AAPL")
        assert "EDGAR" in r["_reliability"]

    @pytest.mark.asyncio
    async def test_record_success(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=self._empty_raw()):
            with patch.object(client, "_record_success") as m:
                await client.get_financials("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_failure_none(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_record_failure") as m:
                await client.get_financials("AAPL")
        m.assert_called_once()

    @pytest.mark.asyncio
    async def test_empty_dfs(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=self._empty_raw()):
            r = await client.get_financials("AAPL")
        assert r["income_statement"] == [] and r["balance_sheet"] == [] and r["cash_flow"] == []

# ===================================================================
# 14. Properties
# ===================================================================
class TestProperties:
    def test_enabled_true(self, client):
        assert client.is_enabled is True

    def test_enabled_false(self, disabled_client):
        assert disabled_client.is_enabled is False

    def test_enabled_is_bool(self, client):
        assert isinstance(client.is_enabled, bool)

    def test_state_string(self, client):
        assert isinstance(client.circuit_state, str)

    def test_state_closed(self, client):
        assert client.circuit_state == "closed"

    def test_state_open(self, client):
        client._circuit_state = CircuitState.OPEN
        assert client.circuit_state == "open"

    def test_state_half_open(self, client):
        client._circuit_state = CircuitState.HALF_OPEN
        assert client.circuit_state == "half_open"

# ===================================================================
# 15. close()
# ===================================================================
class TestClose:
    @pytest.mark.asyncio
    async def test_no_raise(self, client):
        await client.close()

    @pytest.mark.asyncio
    async def test_idempotent(self, client):
        await client.close()
        await client.close()

# ===================================================================
# 16. Edge Cases
# ===================================================================
class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_full_circuit_cycle(self, client):
        assert client._circuit_state == CircuitState.CLOSED
        for _ in range(3): client._record_failure()
        assert client._circuit_state == CircuitState.OPEN
        client._circuit_opened_at = time.monotonic() - client._cb_cooldown_seconds - 1
        assert client._check_circuit() is True and client._circuit_state == CircuitState.HALF_OPEN
        client._record_success()
        assert client._circuit_state == CircuitState.CLOSED and len(client._failure_timestamps) == 0

    @pytest.mark.asyncio
    async def test_half_open_to_open_on_failure(self, client):
        client._circuit_state = CircuitState.HALF_OPEN
        now = time.monotonic()
        client._failure_timestamps = deque([now, now])
        client._record_failure()
        assert client._circuit_state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_regular_market_fields(self, client):
        info = {"regularMarketPrice": 148.0, "regularMarketDayHigh": 150.0,
                "regularMarketDayLow": 146.0, "regularMarketOpen": 147.0,
                "regularMarketPreviousClose": 147.5, "regularMarketVolume": 40000000}
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=info):
            r = await client.get_quote("MSFT")
        assert r["current_price"] == 148.0 and r["high"] == 150.0

    @pytest.mark.asyncio
    async def test_historical_nan_prices(self, client):
        df = _make_mock_df([{**_HIST_ROW, "Open": float("nan")}])
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=df):
            r = await client.get_historical("AAPL")
        assert r[0]["open"] is None

    @pytest.mark.asyncio
    async def test_iso_timestamp(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=_VALID_INFO):
            r = await client.get_quote("AAPL")
        assert datetime.fromisoformat(r["_fetched_at"]).tzinfo is not None

    @pytest.mark.asyncio
    async def test_rapid_failures(self, client):
        for _ in range(5): client._record_failure()
        assert client._circuit_state == CircuitState.OPEN

    def test_metadata_preserves_keys(self, client):
        d = {"symbol": "AAPL", "price": 150.0}
        r = client._add_metadata(d)
        assert r["symbol"] == "AAPL" and r["price"] == 150.0

    @pytest.mark.asyncio
    async def test_info_uppercases(self, client):
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value={"longName": "X"}):
            assert (await client.get_info("aapl"))["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_financials_uppercases(self, client):
        raw = {"income": pd.DataFrame(), "balance": pd.DataFrame(), "cashflow": pd.DataFrame()}
        with patch.object(client, "_run_sync", new_callable=AsyncMock, return_value=raw):
            assert (await client.get_financials("aapl"))["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_run_sync_passes_args(self, client):
        async def fake_wf(coro, timeout):
            return await coro
        fn = MagicMock(return_value=42)
        with patch("app.data.yfinance_client.asyncio.wait_for", side_effect=fake_wf):
            with patch("app.data.yfinance_client.asyncio.to_thread", new_callable=AsyncMock, return_value=42) as mt:
                await client._run_sync(fn, "a1", "a2")
        mt.assert_called_once_with(fn, "a1", "a2")

    def test_zero_prices_ok(self):
        assert YFinanceClient._validate_historical([{"open": 0.0, "high": 0.0, "low": 0.0, "close": 0.0}])

    def test_df_non_datetime_cols(self):
        df = pd.DataFrame({"c1": [1.0, 2.0], "c2": [3.0, 4.0]}, index=["Rev", "Cost"])
        r = YFinanceClient._df_to_records(df)
        assert len(r) == 2 and r[0]["period"] == "c1"
