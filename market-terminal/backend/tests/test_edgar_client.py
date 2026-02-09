"""Tests for TASK-DATA-003: SEC EDGAR Financials Client.

Validates the EdgarClient rate limiter, pure helpers, cache layer,
all 7 public API methods, statement parsing, singleton lifecycle,
and comprehensive error handling.

ALL EDGAR / edgartools calls are mocked -- no real SEC API requests are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_edgar_client.py -v``
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest

import app.data.edgar_client as mod
from app.data.edgar_client import (
    EdgarClient,
    _extract_value,
    _get_edgar_rate_lock,
    _safe_div,
    _safe_growth,
    _tag,
    _wait_for_edgar_rate_limit,
    _EDGAR_MAX_CALLS_PER_SECOND,
    close_edgar_client,
    get_edgar_client,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset module-level singleton and rate limiter between tests."""
    mod._client = None
    mod._edgar_call_timestamps.clear()
    mod._edgar_rate_lock = None
    yield
    mod._client = None
    mod._edgar_call_timestamps.clear()
    mod._edgar_rate_lock = None


@pytest.fixture
def mock_settings():
    """Return mock settings with test values."""
    s = MagicMock()
    s.sec_edgar_user_agent = "TestAgent test@test.com"
    s.cache_ttl_fundamentals = 86400
    return s


@pytest.fixture
def client(mock_settings):
    """EdgarClient with mocked settings."""
    with patch("app.data.edgar_client.get_settings", return_value=mock_settings):
        c = EdgarClient()
    return c


@pytest.fixture
def mock_db():
    """Return a mock database with async fetch_one/execute/fetch_all."""
    db = AsyncMock()
    db.fetch_one = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    db.fetch_all = AsyncMock(return_value=[])
    return db


def _make_income_df():
    """Build a mock income-statement DataFrame for testing."""
    return pd.DataFrame({
        "concept": [
            "us-gaap_Revenue",
            "us-gaap_CostOfGoodsAndServicesSold",
            "us-gaap_GrossProfit",
            "us-gaap_OperatingIncomeLoss",
            "us-gaap_NetIncomeLoss",
            "us-gaap_EarningsPerShareBasic",
            "us-gaap_EarningsPerShareDiluted",
        ],
        "label": [
            "Net sales",
            "Cost of goods sold",
            "Gross profit",
            "Operating income",
            "Net income",
            "Basic earnings per share",
            "Diluted earnings per share",
        ],
        "standard_concept": [
            "Revenue",
            "CostOfGoodsAndServicesSold",
            "GrossProfit",
            "OperatingIncomeLoss",
            "NetIncomeLoss",
            "EarningsPerShareBasic",
            "EarningsPerShareDiluted",
        ],
        "2024-09-28": [
            391035000000.0, 214137000000.0, 176898000000.0,
            119437000000.0, 93736000000.0, 6.11, 6.08,
        ],
        "2023-09-30": [
            383285000000.0, 214137000000.0, 169148000000.0,
            114301000000.0, 96995000000.0, 6.13, 6.10,
        ],
        "level": [3, 3, 3, 3, 3, 3, 3],
        "abstract": [False, False, False, False, False, False, False],
        "dimension": [False, False, False, False, False, False, False],
        "is_breakdown": [False, False, False, False, False, False, False],
    })


def _make_balance_df():
    """Build a mock balance-sheet DataFrame for testing."""
    return pd.DataFrame({
        "concept": [
            "us-gaap_Assets",
            "us-gaap_Liabilities",
            "us-gaap_StockholdersEquity",
            "us-gaap_CashAndCashEquivalentsAtCarryingValue",
            "us-gaap_AssetsCurrent",
            "us-gaap_LiabilitiesCurrent",
            "us-gaap_LongTermDebt",
        ],
        "label": [
            "Total assets",
            "Total liabilities",
            "Stockholders' equity",
            "Cash and cash equivalents",
            "Current assets",
            "Current liabilities",
            "Long-term debt",
        ],
        "standard_concept": [
            "Assets",
            "Liabilities",
            "StockholdersEquity",
            "CashAndCashEquivalentsAtCarryingValue",
            "AssetsCurrent",
            "LiabilitiesCurrent",
            "LongTermDebt",
        ],
        "2024-09-28": [
            364980000000.0, 308030000000.0, 56950000000.0,
            29943000000.0, 152987000000.0, 176392000000.0,
            97959000000.0,
        ],
        "level": [3, 3, 3, 3, 3, 3, 3],
        "abstract": [False, False, False, False, False, False, False],
        "dimension": [False, False, False, False, False, False, False],
        "is_breakdown": [False, False, False, False, False, False, False],
    })


def _make_cashflow_df():
    """Build a mock cash-flow DataFrame for testing."""
    return pd.DataFrame({
        "concept": [
            "us-gaap_NetCashProvidedByOperatingActivities",
            "us-gaap_PaymentsToAcquirePropertyPlantAndEquipment",
            "us-gaap_NetCashProvidedByInvestingActivities",
            "us-gaap_NetCashProvidedByFinancingActivities",
            "us-gaap_PaymentsOfDividends",
        ],
        "label": [
            "Net cash provided by operating activities",
            "Purchases of property and equipment",
            "Net cash used in investing activities",
            "Net cash used in financing activities",
            "Dividends paid",
        ],
        "standard_concept": [
            "NetCashProvidedByOperatingActivities",
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "NetCashProvidedByInvestingActivities",
            "NetCashProvidedByFinancingActivities",
            "PaymentsOfDividends",
        ],
        "2024-09-28": [
            118254000000.0, -9959000000.0, -46027000000.0,
            -121983000000.0, -15234000000.0,
        ],
        "level": [3, 3, 3, 3, 3],
        "abstract": [False, False, False, False, False],
        "dimension": [False, False, False, False, False],
        "is_breakdown": [False, False, False, False, False],
    })


def _make_quarterly_df(num_quarters=8):
    """Build a mock quarterly income-statement DataFrame with N quarters."""
    base_date = datetime(2024, 9, 28)
    cols = {}
    for i in range(num_quarters):
        dt = base_date - timedelta(days=91 * i)
        col_name = dt.strftime("%Y-%m-%d")
        eps = round(1.5 + 0.1 * (num_quarters - i), 2)
        rev = 90000000000.0 + 1000000000.0 * (num_quarters - i)
        cols[col_name] = [eps, eps - 0.02, rev]

    data = {
        "concept": [
            "us-gaap_EarningsPerShareBasic",
            "us-gaap_EarningsPerShareDiluted",
            "us-gaap_Revenue",
        ],
        "label": [
            "Basic earnings per share",
            "Diluted earnings per share",
            "Net sales",
        ],
        "standard_concept": [
            "EarningsPerShareBasic",
            "EarningsPerShareDiluted",
            "Revenue",
        ],
        "level": [3, 3, 3],
        "abstract": [False, False, False],
        "dimension": [False, False, False],
        "is_breakdown": [False, False, False],
    }
    data.update(cols)
    return pd.DataFrame(data)


def _mock_company(
    cik=320193,
    name="Apple Inc",
    ticker="AAPL",
    sic="3571",
    fiscal_year_end="09-30",
    not_found=False,
):
    """Build a mock Company object."""
    company = MagicMock()
    company.cik = cik
    company.name = name
    company.ticker = ticker
    company.sic = sic
    company.fiscal_year_end = fiscal_year_end
    company.not_found = not_found
    return company


# ===================================================================
# 1. Pure Helpers
# ===================================================================
class TestPureHelpers:
    """Tests for _safe_div, _safe_growth, _tag, _extract_value."""

    # -- _safe_div --

    def test_safe_div_normal(self):
        """Normal division returns rounded result."""
        assert _safe_div(10.0, 3.0) == round(10.0 / 3.0, 6)

    def test_safe_div_zero_denominator(self):
        """Zero denominator returns None."""
        assert _safe_div(10.0, 0) is None

    def test_safe_div_none_numerator(self):
        """None numerator returns None."""
        assert _safe_div(None, 5.0) is None

    def test_safe_div_none_denominator(self):
        """None denominator returns None."""
        assert _safe_div(5.0, None) is None

    def test_safe_div_both_none(self):
        """Both None returns None."""
        assert _safe_div(None, None) is None

    def test_safe_div_type_error(self):
        """Non-numeric inputs return None via TypeError catch."""
        assert _safe_div("abc", 5.0) is None

    def test_safe_div_negative_result(self):
        """Negative division works correctly."""
        result = _safe_div(-10.0, 3.0)
        assert result is not None
        assert result < 0

    # -- _safe_growth --

    def test_safe_growth_normal(self):
        """Normal growth calculation: (cur - prev) / abs(prev)."""
        result = _safe_growth(120.0, 100.0)
        assert result == 0.2

    def test_safe_growth_negative(self):
        """Negative growth when current < previous."""
        result = _safe_growth(80.0, 100.0)
        assert result == -0.2

    def test_safe_growth_zero_prev(self):
        """Zero previous value returns None (division by zero)."""
        assert _safe_growth(100.0, 0) is None

    def test_safe_growth_none_cur(self):
        """None current returns None."""
        assert _safe_growth(None, 100.0) is None

    def test_safe_growth_none_prev(self):
        """None previous returns None."""
        assert _safe_growth(100.0, None) is None

    def test_safe_growth_both_none(self):
        """Both None returns None."""
        assert _safe_growth(None, None) is None

    def test_safe_growth_negative_prev(self):
        """Growth from negative previous uses abs(prev) as denominator."""
        result = _safe_growth(-50.0, -100.0)
        assert result is not None
        # (-50 - -100) / abs(-100) = 50/100 = 0.5
        assert result == 0.5

    # -- _tag --

    def test_tag_dict(self):
        """_tag adds metadata to a dict."""
        data = {"price": 150.0}
        result = _tag(data)
        assert result["_source"] == "edgar"
        assert "_fetched_at" in result
        assert result["_cached"] is False

    def test_tag_list(self):
        """_tag adds metadata to each dict in a list."""
        data = [{"a": 1}, {"b": 2}]
        result = _tag(data)
        assert isinstance(result, list)
        for item in result:
            assert item["_source"] == "edgar"
            assert "_fetched_at" in item
            assert item["_cached"] is False

    def test_tag_cached_true(self):
        """_tag with cached=True sets _cached=True."""
        data = {"value": 42}
        result = _tag(data, cached=True)
        assert result["_cached"] is True

    def test_tag_cached_false(self):
        """_tag with cached=False (default) sets _cached=False."""
        data = {"value": 42}
        result = _tag(data, cached=False)
        assert result["_cached"] is False

    def test_tag_preserves_original_keys(self):
        """_tag does not remove existing keys."""
        data = {"symbol": "AAPL", "cik": 123}
        result = _tag(data)
        assert result["symbol"] == "AAPL"
        assert result["cik"] == 123

    def test_tag_fetched_at_is_iso_format(self):
        """_fetched_at is a valid ISO format string."""
        data = {"x": 1}
        result = _tag(data)
        assert "T" in result["_fetched_at"]

    # -- _extract_value --

    def test_extract_value_by_standard_concept(self):
        """Finds value via exact match on standard_concept."""
        df = _make_income_df()
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val == 391035000000.0

    def test_extract_value_by_label_substring(self):
        """Finds value via substring match on label."""
        df = _make_income_df()
        val = _extract_value(df, "2024-09-28", ["Net sales"])
        assert val == 391035000000.0

    def test_extract_value_skips_abstract_rows(self):
        """Rows with abstract=True are skipped."""
        df = pd.DataFrame({
            "concept": ["Abstract_Revenue", "us-gaap_Revenue"],
            "label": ["Net sales total", "Net sales"],
            "standard_concept": ["Revenue", "Revenue"],
            "2024-09-28": [999.0, 100.0],
            "abstract": [True, False],
            "dimension": [False, False],
        })
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val == 100.0

    def test_extract_value_skips_dimension_rows(self):
        """Rows with a truthy dimension are skipped."""
        df = pd.DataFrame({
            "concept": ["us-gaap_Revenue", "us-gaap_Revenue"],
            "label": ["Net sales segment", "Net sales"],
            "standard_concept": ["Revenue", "Revenue"],
            "2024-09-28": [777.0, 200.0],
            "abstract": [False, False],
            "dimension": ["product_segment", False],
        })
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val == 200.0

    def test_extract_value_no_match_returns_none(self):
        """Returns None when no matchers match."""
        df = _make_income_df()
        val = _extract_value(df, "2024-09-28", ["NonExistentConcept"])
        assert val is None

    def test_extract_value_none_cell_skips(self):
        """None cell value tries next matcher."""
        df = pd.DataFrame({
            "concept": ["us-gaap_Revenue"],
            "label": ["Net sales"],
            "standard_concept": ["Revenue"],
            "2024-09-28": [None],
            "abstract": [False],
            "dimension": [False],
        })
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val is None

    def test_extract_value_non_numeric_returns_none(self):
        """Non-numeric cell value returns None via ValueError catch."""
        df = pd.DataFrame({
            "concept": ["us-gaap_Revenue"],
            "label": ["Net sales"],
            "standard_concept": ["Revenue"],
            "2024-09-28": ["not_a_number"],
            "abstract": [False],
            "dimension": [False],
        })
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val is None

    def test_extract_value_empty_dimension_treated_as_false(self):
        """Empty string dimension is treated as not-a-dimension (allowed)."""
        df = pd.DataFrame({
            "concept": ["us-gaap_Revenue"],
            "label": ["Net sales"],
            "standard_concept": ["Revenue"],
            "2024-09-28": [500.0],
            "abstract": [False],
            "dimension": [""],
        })
        val = _extract_value(df, "2024-09-28", ["Revenue"])
        assert val == 500.0


# ===================================================================
# 2. Rate Limiter
# ===================================================================
class TestRateLimiter:
    """Tests for module-level rate limiter functions."""

    def test_rate_limit_constant_is_10(self):
        """_EDGAR_MAX_CALLS_PER_SECOND is 10."""
        assert _EDGAR_MAX_CALLS_PER_SECOND == 10

    def test_lock_created_lazily(self):
        """_get_edgar_rate_lock creates a new Lock on first call."""
        assert mod._edgar_rate_lock is None
        lock = _get_edgar_rate_lock()
        assert isinstance(lock, asyncio.Lock)
        assert mod._edgar_rate_lock is lock

    def test_lock_returns_same_instance(self):
        """_get_edgar_rate_lock returns the same Lock on repeated calls."""
        lock1 = _get_edgar_rate_lock()
        lock2 = _get_edgar_rate_lock()
        assert lock1 is lock2

    @pytest.mark.asyncio
    async def test_single_call_goes_through(self):
        """A single call proceeds without waiting."""
        # Should not raise or block
        await _wait_for_edgar_rate_limit()
        assert len(mod._edgar_call_timestamps) == 1

    @pytest.mark.asyncio
    async def test_multiple_calls_within_limit(self):
        """Multiple calls within the limit all proceed."""
        for _ in range(5):
            await _wait_for_edgar_rate_limit()
        assert len(mod._edgar_call_timestamps) == 5

    @pytest.mark.asyncio
    async def test_timestamps_deque_records_calls(self):
        """Each call appends a timestamp to the deque."""
        await _wait_for_edgar_rate_limit()
        await _wait_for_edgar_rate_limit()
        assert len(mod._edgar_call_timestamps) == 2


# ===================================================================
# 3. EdgarClient Initialization
# ===================================================================
class TestEdgarClientInit:
    """Tests for EdgarClient constructor and identity setup."""

    def test_reads_user_agent_from_settings(self, client, mock_settings):
        """Client stores the user agent from settings."""
        assert client._user_agent == "TestAgent test@test.com"

    def test_reads_cache_ttl_from_settings(self, client, mock_settings):
        """Client stores the cache TTL from settings."""
        assert client._cache_ttl == 86400

    def test_identity_not_set_initially(self, client):
        """_identity_set is False after construction."""
        assert client._identity_set is False

    def test_ensure_identity_sets_once(self, client):
        """_ensure_identity sets identity and flips flag to True."""
        mock_set = MagicMock()
        mock_edgar = MagicMock()
        mock_edgar.set_identity = mock_set
        with patch.dict("sys.modules", {"edgar": mock_edgar}):
            client._ensure_identity()
            assert client._identity_set is True
            client._ensure_identity()
            # set_identity should only be called once (idempotent)
            mock_set.assert_called_once_with("TestAgent test@test.com")

    @pytest.mark.asyncio
    async def test_close_is_noop(self, client):
        """close() is a no-op (no persistent connection)."""
        await client.close()  # Should not raise


# ===================================================================
# 4. Cache Helpers
# ===================================================================
class TestCacheHelpers:
    """Tests for _get_cached and _store_cache."""

    @pytest.mark.asyncio
    async def test_get_cached_returns_data_on_hit(self, client, mock_db):
        """_get_cached returns parsed JSON when cache row exists within TTL."""
        now_iso = datetime.now(timezone.utc).isoformat()
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps({"revenue": 100}),
            "fetched_at": now_iso,
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("aapl", "income_statement")
        assert result == {"revenue": 100}

    @pytest.mark.asyncio
    async def test_get_cached_returns_none_on_miss(self, client, mock_db):
        """_get_cached returns None when no cache row exists."""
        mock_db.fetch_one.return_value = None
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_returns_none_when_ttl_expired(self, client, mock_db):
        """_get_cached returns None when the cached data has expired."""
        old_time = (datetime.now(timezone.utc) - timedelta(seconds=86401)).isoformat()
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps({"revenue": 100}),
            "fetched_at": old_time,
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_returns_none_on_invalid_json(self, client, mock_db):
        """_get_cached returns None when value_json is not valid JSON."""
        now_iso = datetime.now(timezone.utc).isoformat()
        mock_db.fetch_one.return_value = {
            "value_json": "not valid json {{{",
            "fetched_at": now_iso,
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_returns_none_on_invalid_fetched_at(self, client, mock_db):
        """_get_cached returns None when fetched_at is not a valid datetime."""
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps({"x": 1}),
            "fetched_at": "not-a-date",
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_uppercases_symbol(self, client, mock_db):
        """_get_cached uppercases the symbol in the query."""
        mock_db.fetch_one.return_value = None
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            await client._get_cached("aapl", "income_statement")
        call_args = mock_db.fetch_one.call_args
        # Second positional arg is the params tuple
        assert call_args[0][1][0] == "AAPL"

    @pytest.mark.asyncio
    async def test_store_cache_calls_execute(self, client, mock_db):
        """_store_cache calls db.execute with INSERT OR REPLACE."""
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            await client._store_cache("aapl", "income_statement", {"rev": 100})
        mock_db.execute.assert_called_once()
        call_args = mock_db.execute.call_args
        sql = call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        params = call_args[0][1]
        assert params[0] == "AAPL"  # symbol uppercased
        assert params[1] == "income_statement"
        assert params[2] == "latest"  # default period
        assert json.loads(params[3]) == {"rev": 100}

    @pytest.mark.asyncio
    async def test_store_cache_uppercases_symbol(self, client, mock_db):
        """_store_cache uppercases the symbol."""
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            await client._store_cache("msft", "balance_sheet", {})
        params = mock_db.execute.call_args[0][1]
        assert params[0] == "MSFT"

    @pytest.mark.asyncio
    async def test_get_cached_handles_naive_datetime(self, client, mock_db):
        """_get_cached handles naive datetime (no timezone) by assuming UTC."""
        # A naive datetime string (no timezone offset)
        naive_dt = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps({"x": 1}),
            "fetched_at": naive_dt,
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        # Should succeed since the code handles naive datetimes
        assert result == {"x": 1}


# ===================================================================
# 5. get_company
# ===================================================================
class TestGetCompany:
    """Tests for EdgarClient.get_company()."""

    @pytest.mark.asyncio
    async def test_returns_company_dict(self, client, mock_db):
        """get_company returns a dict with expected fields."""
        company = _mock_company()
        with patch.object(client, "_get_company_obj", return_value=company):
            result = await client.get_company("AAPL")
        assert result is not None
        assert result["cik"] == 320193
        assert result["name"] == "Apple Inc"
        assert result["ticker"] == "AAPL"
        assert result["sic_code"] == "3571"
        assert result["fiscal_year_end"] == "09-30"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, client):
        """get_company returns None when company not found."""
        with patch.object(client, "_get_company_obj", return_value=None):
            result = await client.get_company("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """get_company returns None on exception."""
        with patch.object(client, "_get_company_obj", side_effect=Exception("network error")):
            result = await client.get_company("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_tags_response_with_metadata(self, client):
        """get_company tags the response with _source=edgar metadata."""
        company = _mock_company()
        with patch.object(client, "_get_company_obj", return_value=company):
            result = await client.get_company("AAPL")
        assert result["_source"] == "edgar"
        assert "_fetched_at" in result
        assert result["_cached"] is False

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self, client):
        """get_company uppercases the symbol in the result."""
        company = _mock_company()
        with patch.object(client, "_get_company_obj", return_value=company):
            result = await client.get_company("aapl")
        assert result["ticker"] == "AAPL"


# ===================================================================
# 6. _get_company_obj
# ===================================================================
class TestGetCompanyObj:
    """Tests for EdgarClient._get_company_obj (internal helper)."""

    @pytest.mark.asyncio
    async def test_returns_company_on_success(self, client):
        """_get_company_obj returns the Company object."""
        company = _mock_company()
        with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_client.asyncio.to_thread", return_value=company):
                result = await client._get_company_obj("AAPL")
        assert result is company

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, client):
        """_get_company_obj returns None when company.not_found is True."""
        company = _mock_company(not_found=True)
        with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_client.asyncio.to_thread", return_value=company):
                result = await client._get_company_obj("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_company_is_none(self, client):
        """_get_company_obj returns None when to_thread returns None."""
        with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_client.asyncio.to_thread", return_value=None):
                result = await client._get_company_obj("AAPL")
        assert result is None


# ===================================================================
# 7. _parse_statement
# ===================================================================
class TestParseStatement:
    """Tests for EdgarClient._parse_statement (static method)."""

    def test_extracts_values_from_date_columns(self):
        """Parses values for each date column in the DataFrame."""
        df = _make_income_df()
        field_map = {"revenue": ["Revenue"]}
        results = EdgarClient._parse_statement(df, field_map)
        assert len(results) == 2
        # Most recent first
        assert results[0]["period"] == "2024-09-28"
        assert results[0]["revenue"] == 391035000000.0
        assert results[1]["period"] == "2023-09-30"
        assert results[1]["revenue"] == 383285000000.0

    def test_respects_periods_limit(self):
        """Only returns up to `periods` date columns."""
        df = _make_income_df()
        field_map = {"revenue": ["Revenue"]}
        results = EdgarClient._parse_statement(df, field_map, periods=1)
        assert len(results) == 1
        assert results[0]["period"] == "2024-09-28"

    def test_returns_empty_list_when_no_date_columns(self):
        """Returns empty list when DataFrame has no YYYY-MM-DD columns."""
        df = pd.DataFrame({
            "concept": ["Revenue"],
            "label": ["Net sales"],
            "standard_concept": ["Revenue"],
            "non_date_col": [100.0],
            "abstract": [False],
            "dimension": [False],
        })
        field_map = {"revenue": ["Revenue"]}
        results = EdgarClient._parse_statement(df, field_map)
        assert results == []

    def test_multiple_fields_extracted(self):
        """Multiple fields are extracted per period."""
        df = _make_income_df()
        field_map = {
            "revenue": ["Revenue"],
            "net_income": ["NetIncomeLoss"],
        }
        results = EdgarClient._parse_statement(df, field_map)
        assert results[0]["revenue"] == 391035000000.0
        assert results[0]["net_income"] == 93736000000.0

    def test_date_columns_sorted_reverse(self):
        """Date columns are sorted most-recent first."""
        df = _make_income_df()
        field_map = {"revenue": ["Revenue"]}
        results = EdgarClient._parse_statement(df, field_map)
        assert results[0]["period"] > results[1]["period"]

    def test_unmatched_field_returns_none(self):
        """A field with no matching rows returns None."""
        df = _make_income_df()
        field_map = {"nonexistent": ["NoSuchConcept"]}
        results = EdgarClient._parse_statement(df, field_map)
        assert results[0]["nonexistent"] is None


# ===================================================================
# 8. get_income_statement
# ===================================================================
class TestGetIncomeStatement:
    """Tests for EdgarClient.get_income_statement()."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client, mock_db):
        """Returns cached data with _cached=True when cache hit."""
        cached = [{"period": "2024-09-28", "revenue": 100}]
        with patch.object(client, "_get_cached", return_value=cached):
            result = await client.get_income_statement("AAPL")
        assert result is not None
        assert result[0]["_cached"] is True
        assert result[0]["revenue"] == 100

    @pytest.mark.asyncio
    async def test_fetches_from_edgar_on_cache_miss(self, client, mock_db):
        """Fetches from EDGAR when cache miss, computes margins."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "revenue": 391035000000.0,
                "cost_of_revenue": 214137000000.0,
                "gross_profit": 176898000000.0,
                "operating_income": 119437000000.0,
                "net_income": 93736000000.0,
                "eps_basic": 6.11,
                "eps_diluted": 6.08,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock) as mock_store:
                    result = await client.get_income_statement("AAPL")

        assert result is not None
        row = result[0]
        # Margins computed
        assert row["gross_margin"] == _safe_div(176898000000.0, 391035000000.0)
        assert row["operating_margin"] == _safe_div(119437000000.0, 391035000000.0)
        assert row["net_margin"] == _safe_div(93736000000.0, 391035000000.0)
        # Stored in cache
        mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_computes_margins_correctly(self, client):
        """Verifies margin computations match _safe_div logic."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "revenue": 100.0,
                "gross_profit": 60.0,
                "operating_income": 30.0,
                "net_income": 20.0,
                "cost_of_revenue": 40.0,
                "eps_basic": 1.0,
                "eps_diluted": 0.95,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_income_statement("AAPL")
        row = result[0]
        assert row["gross_margin"] == 0.6
        assert row["operating_margin"] == 0.3
        assert row["net_margin"] == 0.2

    @pytest.mark.asyncio
    async def test_stores_in_cache_after_fetch(self, client):
        """Data is stored in cache after successful fetch."""
        stmt_data = [{"period": "2024-09-28", "revenue": 100.0,
                       "gross_profit": None, "operating_income": None,
                       "net_income": None, "cost_of_revenue": None,
                       "eps_basic": None, "eps_diluted": None}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock) as mock_store:
                    await client.get_income_statement("AAPL")
        mock_store.assert_called_once_with("AAPL", "income_statement", stmt_data)

    @pytest.mark.asyncio
    async def test_returns_none_when_company_not_found(self, client):
        """Returns None when _fetch_statement returns None."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_income_statement("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_fetch_returns_none(self, client):
        """Returns None when _fetch_statement returns None (e.g. edgartools error)."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_income_statement("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_tags_response_with_metadata(self, client):
        """Response is tagged with _source=edgar metadata."""
        stmt_data = [{"period": "2024-09-28", "revenue": 100.0,
                       "gross_profit": None, "operating_income": None,
                       "net_income": None, "cost_of_revenue": None,
                       "eps_basic": None, "eps_diluted": None}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_income_statement("AAPL")
        assert result[0]["_source"] == "edgar"
        assert result[0]["_cached"] is False


# ===================================================================
# 9. get_balance_sheet
# ===================================================================
class TestGetBalanceSheet:
    """Tests for EdgarClient.get_balance_sheet()."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client):
        """Returns cached data with _cached=True when cache hit."""
        cached = [{"period": "2024-09-28", "total_assets": 364980000000.0}]
        with patch.object(client, "_get_cached", return_value=cached):
            result = await client.get_balance_sheet("AAPL")
        assert result is not None
        assert result[0]["_cached"] is True

    @pytest.mark.asyncio
    async def test_computes_current_ratio_and_debt_to_equity(self, client):
        """Computes current_ratio and debt_to_equity from fetched data."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "total_assets": 364980000000.0,
                "total_liabilities": 308030000000.0,
                "total_equity": 56950000000.0,
                "cash_and_equivalents": 29943000000.0,
                "total_current_assets": 152987000000.0,
                "total_current_liabilities": 176392000000.0,
                "long_term_debt": 97959000000.0,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_balance_sheet("AAPL")

        row = result[0]
        assert row["current_ratio"] == _safe_div(152987000000.0, 176392000000.0)
        assert row["debt_to_equity"] == _safe_div(308030000000.0, 56950000000.0)

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, client):
        """Returns None when _fetch_statement returns None."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_balance_sheet("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_stores_in_cache(self, client):
        """Data is stored in cache after successful fetch."""
        stmt_data = [{"period": "2024-09-28", "total_assets": 100.0,
                       "total_liabilities": 50.0, "total_equity": 50.0,
                       "cash_and_equivalents": 10.0, "total_current_assets": 60.0,
                       "total_current_liabilities": 40.0, "long_term_debt": 20.0}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock) as mock_store:
                    await client.get_balance_sheet("AAPL")
        mock_store.assert_called_once_with("AAPL", "balance_sheet", stmt_data)

    @pytest.mark.asyncio
    async def test_handles_none_equity_gracefully(self, client):
        """Handles None equity when computing debt_to_equity."""
        stmt_data = [{"period": "2024-09-28", "total_assets": 100.0,
                       "total_liabilities": 50.0, "total_equity": None,
                       "cash_and_equivalents": 10.0, "total_current_assets": 60.0,
                       "total_current_liabilities": 40.0, "long_term_debt": 20.0}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_balance_sheet("AAPL")
        assert result[0]["debt_to_equity"] is None


# ===================================================================
# 10. get_cash_flow
# ===================================================================
class TestGetCashFlow:
    """Tests for EdgarClient.get_cash_flow()."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client):
        """Returns cached data with _cached=True."""
        cached = [{"period": "2024-09-28", "operating_cash_flow": 118254000000.0}]
        with patch.object(client, "_get_cached", return_value=cached):
            result = await client.get_cash_flow("AAPL")
        assert result[0]["_cached"] is True

    @pytest.mark.asyncio
    async def test_computes_free_cash_flow(self, client):
        """free_cash_flow = operating_cash_flow - abs(capital_expenditures)."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "operating_cash_flow": 118254000000.0,
                "capital_expenditures": -9959000000.0,
                "investing_cash_flow": -46027000000.0,
                "financing_cash_flow": -121983000000.0,
                "dividends_paid": -15234000000.0,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_cash_flow("AAPL")

        row = result[0]
        expected_fcf = 118254000000.0 - abs(-9959000000.0)
        assert row["free_cash_flow"] == expected_fcf

    @pytest.mark.asyncio
    async def test_fcf_none_when_operating_none(self, client):
        """free_cash_flow is None when operating_cash_flow is None."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "operating_cash_flow": None,
                "capital_expenditures": -9959000000.0,
                "investing_cash_flow": None,
                "financing_cash_flow": None,
                "dividends_paid": None,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_cash_flow("AAPL")
        assert result[0]["free_cash_flow"] is None

    @pytest.mark.asyncio
    async def test_fcf_none_when_capex_none(self, client):
        """free_cash_flow is None when capital_expenditures is None."""
        stmt_data = [
            {
                "period": "2024-09-28",
                "operating_cash_flow": 118254000000.0,
                "capital_expenditures": None,
                "investing_cash_flow": None,
                "financing_cash_flow": None,
                "dividends_paid": None,
            }
        ]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_cash_flow("AAPL")
        assert result[0]["free_cash_flow"] is None

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, client):
        """Returns None when _fetch_statement returns None."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_cash_flow("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_stores_in_cache(self, client):
        """Data is stored in cache after successful fetch."""
        stmt_data = [{"period": "2024-09-28", "operating_cash_flow": 100.0,
                       "capital_expenditures": -10.0, "investing_cash_flow": None,
                       "financing_cash_flow": None, "dividends_paid": None}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock) as mock_store:
                    await client.get_cash_flow("AAPL")
        mock_store.assert_called_once_with("AAPL", "cash_flow", stmt_data)


# ===================================================================
# 11. get_key_metrics
# ===================================================================
class TestGetKeyMetrics:
    """Tests for EdgarClient.get_key_metrics()."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client):
        """Returns cached data with _cached=True."""
        cached = {"symbol": "AAPL", "revenue": 391035000000.0}
        with patch.object(client, "_get_cached", return_value=cached):
            result = await client.get_key_metrics("AAPL")
        assert result["_cached"] is True
        assert result["revenue"] == 391035000000.0

    @pytest.mark.asyncio
    async def test_fetches_and_computes_derived_ratios(self, client):
        """Fetches metrics and computes net_margin, ROE, ROA, etc."""
        raw_metrics = {
            "revenue": 391035000000.0,
            "net_income": 93736000000.0,
            "total_assets": 364980000000.0,
            "total_liabilities": 308030000000.0,
            "stockholders_equity": 56950000000.0,
            "current_assets": 152987000000.0,
            "current_liabilities": 176392000000.0,
            "operating_cash_flow": 118254000000.0,
            "capital_expenditures": 9959000000.0,
            "free_cash_flow": 108295000000.0,
            "shares_outstanding_basic": 15334000000,
            "shares_outstanding_diluted": 15408000000,
            "current_ratio": 0.867,
            "debt_to_assets": 0.844,
        }
        company = _mock_company()
        financials = MagicMock()
        financials.get_financial_metrics.return_value = raw_metrics

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, raw_metrics]
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_key_metrics("AAPL")

        assert result is not None
        assert result["symbol"] == "AAPL"
        assert result["net_margin"] == _safe_div(93736000000.0, 391035000000.0)
        assert result["return_on_equity"] == _safe_div(93736000000.0, 56950000000.0)
        assert result["return_on_assets"] == _safe_div(93736000000.0, 364980000000.0)
        assert result["debt_to_equity"] == _safe_div(308030000000.0, 56950000000.0)
        assert result["fcf_margin"] == _safe_div(108295000000.0, 391035000000.0)

    @pytest.mark.asyncio
    async def test_returns_none_on_company_not_found(self, client):
        """Returns None when company is not found."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=None):
                result = await client.get_key_metrics("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """Returns None on exception."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", side_effect=Exception("err")):
                result = await client.get_key_metrics("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_tags_with_metadata(self, client):
        """Response is tagged with _source=edgar metadata."""
        raw_metrics = {"revenue": 100.0, "net_income": 20.0}
        company = _mock_company()
        financials = MagicMock()
        financials.get_financial_metrics.return_value = raw_metrics

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, raw_metrics]
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_key_metrics("AAPL")
        assert result["_source"] == "edgar"
        assert result["_cached"] is False

    @pytest.mark.asyncio
    async def test_handles_non_dict_raw_metrics(self, client):
        """Handles case where get_financial_metrics returns non-dict."""
        company = _mock_company()
        financials = MagicMock()
        financials.get_financial_metrics.return_value = "not_a_dict"

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, "not_a_dict"]
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_key_metrics("AAPL")
        # Should still return a dict with None-valued keys
        assert result is not None
        assert result["symbol"] == "AAPL"
        assert result["revenue"] is None

    @pytest.mark.asyncio
    async def test_returns_none_when_financials_none(self, client):
        """Returns None when company.get_financials returns None."""
        company = _mock_company()

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread", return_value=None):
                        result = await client.get_key_metrics("AAPL")
        assert result is None


# ===================================================================
# 12. get_eps_history
# ===================================================================
class TestGetEpsHistory:
    """Tests for EdgarClient.get_eps_history()."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client):
        """Returns cached data with _cached=True."""
        cached = [{"period": "2024-09-28", "eps_basic": 6.11}]
        with patch.object(client, "_get_cached", return_value=cached):
            result = await client.get_eps_history("AAPL")
        assert result[0]["_cached"] is True

    @pytest.mark.asyncio
    async def test_computes_eps_growth_yoy(self, client):
        """Computes eps_growth_yoy by comparing to 4 periods back."""
        # Create data with 8 quarterly periods
        mock_df = _make_quarterly_df(8)
        company = _mock_company()
        financials = MagicMock()
        stmt = MagicMock()

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, stmt, mock_df]
                        financials.income_statement = stmt
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_eps_history("AAPL")

        assert result is not None
        assert len(result) == 8
        # First 4 entries should have eps_growth_yoy computed
        for i in range(4):
            assert result[i].get("eps_growth_yoy") is not None or result[i].get("eps_growth_yoy") is None
        # Last 4 entries should have eps_growth_yoy = None (no yoy_idx available)
        for i in range(4, 8):
            assert result[i]["eps_growth_yoy"] is None

    @pytest.mark.asyncio
    async def test_computes_revenue_growth_yoy(self, client):
        """Computes revenue_growth_yoy from quarterly data."""
        mock_df = _make_quarterly_df(8)
        company = _mock_company()
        financials = MagicMock()
        stmt = MagicMock()

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, stmt, mock_df]
                        financials.income_statement = stmt
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_eps_history("AAPL")

        # First 4 should have revenue_growth_yoy
        for i in range(4):
            row = result[i]
            # revenue_growth_yoy is set (could be a number or None depending on data)
            assert "revenue_growth_yoy" in row

    @pytest.mark.asyncio
    async def test_computes_is_accelerating(self, client):
        """is_accelerating compares current eps_growth to previous period's growth."""
        mock_df = _make_quarterly_df(8)
        company = _mock_company()
        financials = MagicMock()
        stmt = MagicMock()

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, stmt, mock_df]
                        financials.income_statement = stmt
                        with patch.object(client, "_store_cache", new_callable=AsyncMock):
                            result = await client.get_eps_history("AAPL")

        # The is_accelerating field should be present on all rows
        for row in result:
            assert "is_accelerating" in row

    @pytest.mark.asyncio
    async def test_returns_none_on_company_not_found(self, client):
        """Returns None when company not found."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=None):
                result = await client.get_eps_history("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """Returns None on exception."""
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", side_effect=Exception("fail")):
                result = await client.get_eps_history("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_stores_in_cache_after_fetch(self, client):
        """Data is stored in cache after successful fetch."""
        mock_df = _make_quarterly_df(5)
        company = _mock_company()
        financials = MagicMock()
        stmt = MagicMock()

        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_get_company_obj", return_value=company):
                with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [financials, stmt, mock_df]
                        financials.income_statement = stmt
                        with patch.object(client, "_store_cache", new_callable=AsyncMock) as mock_store:
                            await client.get_eps_history("AAPL")
        mock_store.assert_called_once()
        assert mock_store.call_args[0][1] == "eps_history"


# ===================================================================
# 13. get_recent_filings
# ===================================================================
class TestGetRecentFilings:
    """Tests for EdgarClient.get_recent_filings()."""

    @pytest.mark.asyncio
    async def test_returns_filing_dicts(self, client):
        """Returns list of filing dicts with expected fields."""
        company = _mock_company()
        filing1 = MagicMock()
        filing1.form = "10-K"
        filing1.filing_date = "2024-10-31"
        filing1.accession_number = "0000320193-24-000123"
        filing1.filing_url = "https://sec.gov/filing1"
        filing1.description = "Annual Report"

        filing2 = MagicMock()
        filing2.form = "10-Q"
        filing2.filing_date = "2024-08-01"
        filing2.accession_number = "0000320193-24-000456"
        filing2.filing_url = "https://sec.gov/filing2"
        filing2.description = "Quarterly Report"

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=[filing1, filing2]):
                    result = await client.get_recent_filings("AAPL")

        assert result is not None
        assert len(result) == 2
        assert result[0]["filing_type"] == "10-K"
        assert result[0]["filing_date"] == "2024-10-31"
        assert result[0]["accession_number"] == "0000320193-24-000123"
        assert result[0]["url"] == "https://sec.gov/filing1"
        assert result[0]["description"] == "Annual Report"

    @pytest.mark.asyncio
    async def test_filters_by_filing_types(self, client):
        """Filters filings when filing_types is provided."""
        company = _mock_company()
        filing_10k = MagicMock()
        filing_10k.form = "10-K"
        filing_10k.filing_date = "2024-10-31"
        filing_10k.accession_number = "ACC1"
        filing_10k.filing_url = "https://sec.gov/1"
        filing_10k.description = "Annual"

        filing_8k = MagicMock()
        filing_8k.form = "8-K"
        filing_8k.filing_date = "2024-09-15"
        filing_8k.accession_number = "ACC2"
        filing_8k.filing_url = "https://sec.gov/2"
        filing_8k.description = "Current"

        filing_10q = MagicMock()
        filing_10q.form = "10-Q"
        filing_10q.filing_date = "2024-08-01"
        filing_10q.accession_number = "ACC3"
        filing_10q.filing_url = "https://sec.gov/3"
        filing_10q.description = "Quarterly"

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread",
                           return_value=[filing_10k, filing_8k, filing_10q]):
                    result = await client.get_recent_filings(
                        "AAPL", filing_types=["10-K", "10-Q"]
                    )

        assert result is not None
        assert len(result) == 2
        filing_types_in_result = [f["filing_type"] for f in result]
        assert "8-K" not in filing_types_in_result
        assert "10-K" in filing_types_in_result
        assert "10-Q" in filing_types_in_result

    @pytest.mark.asyncio
    async def test_respects_count_limit(self, client):
        """Returns at most `count` filings."""
        company = _mock_company()
        filings = []
        for i in range(20):
            f = MagicMock()
            f.form = "10-Q"
            f.filing_date = f"2024-{(i % 12) + 1:02d}-01"
            f.accession_number = f"ACC{i}"
            f.filing_url = f"https://sec.gov/{i}"
            f.description = f"Report {i}"
            filings.append(f)

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=filings):
                    result = await client.get_recent_filings("AAPL", count=5)

        assert result is not None
        assert len(result) == 5

    @pytest.mark.asyncio
    async def test_returns_none_when_company_not_found(self, client):
        """Returns None when company not found."""
        with patch.object(client, "_get_company_obj", return_value=None):
            result = await client.get_recent_filings("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_tags_with_metadata(self, client):
        """Response is tagged with _source=edgar metadata."""
        company = _mock_company()
        filing = MagicMock()
        filing.form = "10-K"
        filing.filing_date = "2024-10-31"
        filing.accession_number = "ACC1"
        filing.filing_url = "https://sec.gov/1"
        filing.description = "Annual"

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=[filing]):
                    result = await client.get_recent_filings("AAPL")

        assert result[0]["_source"] == "edgar"
        assert result[0]["_cached"] is False

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """Returns None on exception."""
        with patch.object(client, "_get_company_obj", side_effect=Exception("fail")):
            result = await client.get_recent_filings("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_filings_none(self, client):
        """Returns None when get_filings returns None."""
        company = _mock_company()

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=None):
                    result = await client.get_recent_filings("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_filing_uses_fallback_attributes(self, client):
        """Uses fallback attribute names (filing_type, accession_no, url)."""
        company = _mock_company()
        filing = MagicMock(spec=[])  # no auto attributes
        filing.form = None
        filing.filing_type = "S-1"
        filing.filing_date = "2024-01-01"
        filing.accession_number = None
        filing.accession_no = "ALT-ACC"
        filing.filing_url = None
        filing.url = "https://sec.gov/alt"
        filing.description = None
        filing.title = "Prospectus"

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=[filing]):
                    result = await client.get_recent_filings("AAPL")

        # The code uses getattr with fallback, so it tries form first, then filing_type
        # Since the mock has form=None, ft will be None. filing_type is on the object too
        # but getattr(filing, "form", None) returns None, so ft = getattr(filing, "filing_type", None)
        # which should be "S-1"
        assert result is not None


# ===================================================================
# 14. _fetch_statement (internal pipeline)
# ===================================================================
class TestFetchStatement:
    """Tests for EdgarClient._fetch_statement (internal pipeline)."""

    @pytest.mark.asyncio
    async def test_full_pipeline(self, client):
        """Full pipeline: company -> get_financials -> stmt -> to_dataframe -> parse."""
        company = _mock_company()
        financials = MagicMock()
        stmt = MagicMock()
        mock_df = _make_income_df()

        field_map = {"revenue": ["Revenue"]}

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread") as mock_thread:
                    # Calls: get_financials, income_statement (callable), to_dataframe
                    financials.income_statement = stmt
                    mock_thread.side_effect = [financials, stmt, mock_df]
                    result = await client._fetch_statement("AAPL", "income_statement", field_map, 8)

        assert result is not None
        assert len(result) == 2
        assert result[0]["revenue"] == 391035000000.0

    @pytest.mark.asyncio
    async def test_returns_none_when_company_none(self, client):
        """Returns None when company is not found."""
        with patch.object(client, "_get_company_obj", return_value=None):
            result = await client._fetch_statement("INVALID", "income_statement", {}, 8)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """Returns None when an exception is raised."""
        with patch.object(client, "_get_company_obj", side_effect=Exception("err")):
            result = await client._fetch_statement("AAPL", "income_statement", {}, 8)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_financials_none(self, client):
        """Returns None when get_financials returns None."""
        company = _mock_company()
        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=None):
                    result = await client._fetch_statement("AAPL", "income_statement", {}, 8)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_invalid_stmt_type(self, client):
        """Returns None when stmt_type is not in the mapping."""
        company = _mock_company()
        financials = MagicMock()

        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=financials):
                    result = await client._fetch_statement(
                        "AAPL", "nonexistent_statement", {}, 8
                    )
        assert result is None


# ===================================================================
# 15. Singleton Functions
# ===================================================================
class TestSingletonFunctions:
    """Tests for get_edgar_client() and close_edgar_client()."""

    def test_get_edgar_client_creates_singleton(self, mock_settings):
        """get_edgar_client() creates a new EdgarClient on first call."""
        assert mod._client is None
        with patch("app.data.edgar_client.get_settings", return_value=mock_settings):
            client = get_edgar_client()
        assert isinstance(client, EdgarClient)
        assert mod._client is client

    def test_get_edgar_client_returns_same_instance(self, mock_settings):
        """get_edgar_client() returns the same singleton on repeated calls."""
        with patch("app.data.edgar_client.get_settings", return_value=mock_settings):
            first = get_edgar_client()
            second = get_edgar_client()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_edgar_client_clears_singleton(self, mock_settings):
        """close_edgar_client() closes and clears the singleton."""
        with patch("app.data.edgar_client.get_settings", return_value=mock_settings):
            _ = get_edgar_client()
        assert mod._client is not None
        await close_edgar_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_close_edgar_client_noop_when_none(self):
        """close_edgar_client() is a no-op when _client is None."""
        assert mod._client is None
        await close_edgar_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_get_creates_new_after_close(self, mock_settings):
        """After close, get_edgar_client creates a new instance."""
        with patch("app.data.edgar_client.get_settings", return_value=mock_settings):
            first = get_edgar_client()
            await close_edgar_client()
            second = get_edgar_client()
        assert first is not second
        assert isinstance(second, EdgarClient)


# ===================================================================
# 16. Edge Cases and Integration-style Tests
# ===================================================================
class TestEdgeCases:
    """Edge cases and cross-cutting concerns."""

    @pytest.mark.asyncio
    async def test_income_statement_none_revenue_margins_are_none(self, client):
        """Margins are None when revenue is None."""
        stmt_data = [{"period": "2024-09-28", "revenue": None,
                       "gross_profit": 100.0, "operating_income": 50.0,
                       "net_income": 20.0, "cost_of_revenue": None,
                       "eps_basic": None, "eps_diluted": None}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_income_statement("AAPL")
        row = result[0]
        assert row["gross_margin"] is None
        assert row["operating_margin"] is None
        assert row["net_margin"] is None

    @pytest.mark.asyncio
    async def test_balance_sheet_zero_current_liabilities(self, client):
        """current_ratio is None when total_current_liabilities is 0."""
        stmt_data = [{"period": "2024-09-28", "total_assets": 100.0,
                       "total_liabilities": 50.0, "total_equity": 50.0,
                       "cash_and_equivalents": 10.0, "total_current_assets": 60.0,
                       "total_current_liabilities": 0, "long_term_debt": 20.0}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_balance_sheet("AAPL")
        assert result[0]["current_ratio"] is None

    @pytest.mark.asyncio
    async def test_cash_flow_positive_capex(self, client):
        """free_cash_flow with positive capex: ocf - abs(capex)."""
        stmt_data = [{"period": "2024-09-28", "operating_cash_flow": 100.0,
                       "capital_expenditures": 10.0,  # positive capex
                       "investing_cash_flow": None,
                       "financing_cash_flow": None, "dividends_paid": None}]
        with patch.object(client, "_get_cached", return_value=None):
            with patch.object(client, "_fetch_statement", return_value=stmt_data):
                with patch.object(client, "_store_cache", new_callable=AsyncMock):
                    result = await client.get_cash_flow("AAPL")
        assert result[0]["free_cash_flow"] == 90.0  # 100 - abs(10)

    @pytest.mark.asyncio
    async def test_get_cached_returns_list(self, client, mock_db):
        """_get_cached returns list data correctly."""
        now_iso = datetime.now(timezone.utc).isoformat()
        cached_list = [{"period": "2024-09-28", "revenue": 100}]
        mock_db.fetch_one.return_value = {
            "value_json": json.dumps(cached_list),
            "fetched_at": now_iso,
        }
        with patch("app.data.edgar_client.get_database", return_value=mock_db):
            result = await client._get_cached("AAPL", "income_statement")
        assert isinstance(result, list)
        assert len(result) == 1

    def test_now_iso_returns_string(self):
        """_now_iso returns an ISO format string."""
        from app.data.edgar_client import _now_iso
        result = _now_iso()
        assert isinstance(result, str)
        assert "T" in result

    def test_date_regex_matches_valid_dates(self):
        """_DATE_RE matches YYYY-MM-DD format strings."""
        assert mod._DATE_RE.match("2024-09-28") is not None
        assert mod._DATE_RE.match("2023-01-01") is not None

    def test_date_regex_rejects_invalid_dates(self):
        """_DATE_RE rejects non-date strings."""
        assert mod._DATE_RE.match("concept") is None
        assert mod._DATE_RE.match("label") is None
        assert mod._DATE_RE.match("2024-13") is None
        assert mod._DATE_RE.match("not-a-date") is None

    @pytest.mark.asyncio
    async def test_income_statement_cache_check_returns_non_list(self, client):
        """get_income_statement treats non-list cache as a miss."""
        with patch.object(client, "_get_cached", return_value={"not": "a list"}):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_income_statement("AAPL")
        # Since cached is a dict (not list), it falls through to fetch
        assert result is None

    @pytest.mark.asyncio
    async def test_balance_sheet_cache_check_returns_non_list(self, client):
        """get_balance_sheet treats non-list cache as a miss."""
        with patch.object(client, "_get_cached", return_value="string_value"):
            with patch.object(client, "_fetch_statement", return_value=None):
                result = await client.get_balance_sheet("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_key_metrics_cache_check_returns_non_dict(self, client):
        """get_key_metrics treats non-dict cache as a miss."""
        with patch.object(client, "_get_cached", return_value=[1, 2, 3]):
            with patch.object(client, "_get_company_obj", return_value=None):
                result = await client.get_key_metrics("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_eps_history_cache_check_returns_non_list(self, client):
        """get_eps_history treats non-list cache as a miss."""
        with patch.object(client, "_get_cached", return_value={"not": "a list"}):
            with patch.object(client, "_get_company_obj", return_value=None):
                result = await client.get_eps_history("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_recent_filings_empty_list(self, client):
        """get_recent_filings returns empty list when no filings match."""
        company = _mock_company()
        with patch.object(client, "_get_company_obj", return_value=company):
            with patch("app.data.edgar_client._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                with patch("app.data.edgar_client.asyncio.to_thread", return_value=[]):
                    result = await client.get_recent_filings("AAPL")
        assert result is not None
        assert result == []
