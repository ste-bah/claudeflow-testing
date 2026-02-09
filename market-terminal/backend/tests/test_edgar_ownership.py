"""Tests for TASK-DATA-004: SEC EDGAR Ownership Client.

Validates the EdgarOwnershipClient constructor, EFTS search, 13F holder
parsing, Form 4 insider parsing, cache layer, response builders, pure helpers,
constants, singleton lifecycle, and comprehensive error handling.

ALL EDGAR / edgartools / HTTP calls are mocked -- no real SEC API requests
are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_edgar_ownership.py -v``
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pandas as pd
import pytest

import app.data.edgar_ownership as mod
from app.data.edgar_ownership import (
    EdgarOwnershipClient,
    close_ownership_client,
    get_ownership_client,
)
from app.data.edgar_ownership_helpers import (
    EFTS_URL,
    HOLDER_CACHE_TTL,
    INSIDER_CACHE_TTL,
    MAX_EFTS_RESULTS,
    MAX_FILINGS_PER_SEARCH,
    TX_CODE_MAP,
    build_holders_response,
    build_insider_response,
    get_cached_holders,
    get_cached_insiders,
    now_iso,
    parse_form4_sync,
    quarter_start,
    store_holders,
    store_insiders,
    tag,
    _extract_price,
    _extract_shares,
    _extract_value,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset module-level singleton between tests."""
    mod._client = None
    yield
    mod._client = None


@pytest.fixture
def mock_settings():
    """Return mock settings with test values."""
    s = MagicMock()
    s.sec_edgar_user_agent = "TestAgent test@test.com"
    s.cache_ttl_fundamentals = 86400
    return s


@pytest.fixture
def client(mock_settings):
    """EdgarOwnershipClient with mocked settings."""
    with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
        c = EdgarOwnershipClient()
    return c


@pytest.fixture
def mock_db():
    """Return a mock database with async fetch_all/execute/executemany."""
    db = AsyncMock()
    db.fetch_all = AsyncMock(return_value=[])
    db.execute = AsyncMock()
    db.executemany = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# Mock builders
# ---------------------------------------------------------------------------

def _make_mock_activity(
    tx_type: str = "buy",
    code: str = "P",
    shares: int = 100,
    value: float = 5000.0,
    price: float = 50.0,
    security_title: str = "Common Stock",
) -> MagicMock:
    """Build a mock TransactionActivity."""
    act = MagicMock()
    act.transaction_type = tx_type
    act.code = code
    act.shares = shares
    act.shares_numeric = shares
    act.value = value
    act.value_numeric = value
    act.price_per_share = price
    act.price_numeric = price
    act.security_title = security_title
    act.is_derivative = False
    return act


def _make_mock_form4_obj(
    insider: str = "John Doe",
    position: str = "CEO",
    activities: list | None = None,
    reporting_date: str = "2025-01-15",
    remaining_shares: int = 10000,
) -> MagicMock:
    """Build a mock Form4 data_object (the result of filing.data_object())."""
    obj = MagicMock()
    obj.insider_name = insider
    summary = MagicMock()
    summary.position = position
    summary.reporting_date = reporting_date
    summary.remaining_shares = remaining_shares
    obj.get_ownership_summary.return_value = summary
    obj.get_transaction_activities.return_value = activities or []
    return obj


def _make_mock_filing(
    form: str = "4",
    filing_date: str = "2025-01-15",
    data_obj: Any = None,
) -> MagicMock:
    """Build a mock Filing object."""
    filing = MagicMock()
    filing.form = form
    filing.filing_date = filing_date
    if data_obj is not None:
        filing.data_object.return_value = data_obj
    else:
        filing.data_object.return_value = None
    return filing


def _make_holdings_df(
    tickers: list[str] | None = None,
    shares: list[int] | None = None,
    values: list[int] | None = None,
) -> pd.DataFrame:
    """Build a mock 13F holdings DataFrame."""
    tickers = tickers or ["AAPL", "MSFT"]
    shares = shares or [1000000, 500000]
    values = values or [250000000, 200000000]
    return pd.DataFrame({
        "Issuer": [f"Company {t}" for t in tickers],
        "Class": ["COM"] * len(tickers),
        "Cusip": ["000000000"] * len(tickers),
        "Ticker": tickers,
        "SharesPrnAmount": shares,
        "Value": values,
    })


def _make_efts_response(hits: list[dict] | None = None) -> dict:
    """Build a mock EFTS search response JSON."""
    if hits is None:
        hits = [
            {
                "_source": {
                    "ciks": ["1234567"],
                    "display_names": ["Big Capital LLC"],
                    "file_date": "2025-01-10",
                    "adsh": "0001234567-25-000001",
                    "period_ending": "2024-12-31",
                },
            },
            {
                "_source": {
                    "ciks": ["7654321"],
                    "display_names": ["Mega Fund Inc"],
                    "file_date": "2025-01-08",
                    "adsh": "0007654321-25-000002",
                    "period_ending": "2024-12-31",
                },
            },
        ]
    return {"hits": {"hits": hits}}


# ===================================================================
# 1. Constants
# ===================================================================
class TestConstants:
    """Tests for module-level constants in edgar_ownership_helpers."""

    def test_efts_url_is_valid_url(self):
        """EFTS_URL starts with https and contains sec.gov."""
        assert EFTS_URL.startswith("https://")
        assert "sec.gov" in EFTS_URL

    def test_tx_code_map_has_expected_keys(self):
        """TX_CODE_MAP contains the standard Form 4 transaction codes."""
        expected_keys = {"P", "S", "M", "G", "F", "A", "D", "C"}
        assert set(TX_CODE_MAP.keys()) == expected_keys

    def test_tx_code_map_values_are_strings(self):
        """All TX_CODE_MAP values are human-readable strings."""
        for code, label in TX_CODE_MAP.items():
            assert isinstance(code, str)
            assert isinstance(label, str)
            assert len(label) > 0

    def test_insider_cache_ttl_is_14400(self):
        """INSIDER_CACHE_TTL is 4 hours (14400 seconds)."""
        assert INSIDER_CACHE_TTL == 14400

    def test_holder_cache_ttl_is_86400(self):
        """HOLDER_CACHE_TTL is 24 hours (86400 seconds)."""
        assert HOLDER_CACHE_TTL == 86400

    def test_max_efts_results_is_positive_int(self):
        """MAX_EFTS_RESULTS is a positive integer."""
        assert isinstance(MAX_EFTS_RESULTS, int)
        assert MAX_EFTS_RESULTS > 0

    def test_max_filings_per_search_is_positive_int(self):
        """MAX_FILINGS_PER_SEARCH is a positive integer."""
        assert isinstance(MAX_FILINGS_PER_SEARCH, int)
        assert MAX_FILINGS_PER_SEARCH > 0

    def test_tx_code_map_buy_sell_exercise(self):
        """TX_CODE_MAP maps P to buy, S to sell, M to exercise."""
        assert TX_CODE_MAP["P"] == "buy"
        assert TX_CODE_MAP["S"] == "sell"
        assert TX_CODE_MAP["M"] == "exercise"


# ===================================================================
# 2. Pure Helpers
# ===================================================================
class TestPureHelpers:
    """Tests for now_iso, tag, and quarter_start."""

    def test_now_iso_returns_iso_string(self):
        """now_iso() returns an ISO 8601 string containing T."""
        result = now_iso()
        assert isinstance(result, str)
        assert "T" in result

    def test_now_iso_is_parseable(self):
        """now_iso() returns a string parseable by datetime.fromisoformat."""
        result = now_iso()
        dt = datetime.fromisoformat(result)
        assert dt is not None

    def test_tag_dict_adds_metadata(self):
        """tag() adds _source, _fetched_at, _cached to a dict."""
        data = {"price": 150.0}
        result = tag(data)
        assert result["_source"] == "edgar"
        assert "_fetched_at" in result
        assert result["_cached"] is False

    def test_tag_list_tags_all_items(self):
        """tag() adds metadata to every dict in a list."""
        data = [{"a": 1}, {"b": 2}]
        result = tag(data)
        assert isinstance(result, list)
        for item in result:
            assert item["_source"] == "edgar"
            assert "_fetched_at" in item
            assert item["_cached"] is False

    def test_tag_cached_true(self):
        """tag() with cached=True sets _cached=True."""
        data = {"value": 42}
        result = tag(data, cached=True)
        assert result["_cached"] is True

    def test_tag_cached_false_default(self):
        """tag() default cached=False sets _cached=False."""
        data = {"value": 42}
        result = tag(data)
        assert result["_cached"] is False

    def test_tag_preserves_existing_keys(self):
        """tag() does not remove existing keys."""
        data = {"symbol": "AAPL", "holders": []}
        result = tag(data)
        assert result["symbol"] == "AAPL"
        assert result["holders"] == []

    def test_quarter_start_1_returns_about_3_months_ago(self):
        """quarter_start(1) returns a date roughly 3 months ago."""
        result = quarter_start(1)
        assert isinstance(result, str)
        dt = datetime.strptime(result, "%Y-%m-%d")
        now = datetime.now(timezone.utc)
        diff = now - dt.replace(tzinfo=timezone.utc)
        # Should be approximately 3 months -- allow 0..6 months window
        assert 0 <= diff.days <= 200

    def test_quarter_start_4_returns_about_1_year_ago(self):
        """quarter_start(4) returns a date roughly 12 months ago."""
        result = quarter_start(4)
        dt = datetime.strptime(result, "%Y-%m-%d")
        now = datetime.now(timezone.utc)
        diff = now - dt.replace(tzinfo=timezone.utc)
        assert 200 <= diff.days <= 500

    def test_quarter_start_0_returns_current_or_recent_quarter(self):
        """quarter_start(0) returns a recent quarter start date."""
        result = quarter_start(0)
        dt = datetime.strptime(result, "%Y-%m-%d")
        now = datetime.now(timezone.utc)
        diff = now - dt.replace(tzinfo=timezone.utc)
        assert 0 <= diff.days <= 120

    def test_quarter_start_day_is_always_01(self):
        """quarter_start returns a date with day = 01."""
        for q in range(0, 8):
            result = quarter_start(q)
            assert result.endswith("-01")

    def test_quarter_start_month_is_quarter_start(self):
        """quarter_start returns a month that is 1, 4, 7, or 10 (quarter start)."""
        for q in range(0, 8):
            result = quarter_start(q)
            month = int(result.split("-")[1])
            assert month in (1, 4, 7, 10), f"quarter_start({q}) = {result}, month={month}"


# ===================================================================
# 3. Cache Helpers
# ===================================================================
class TestCacheHelpers:
    """Tests for get_cached_holders, store_holders, get_cached_insiders, store_insiders."""

    @pytest.mark.asyncio
    async def test_get_cached_holders_returns_list_on_hit(self, mock_db):
        """get_cached_holders returns a list when cache rows exist within TTL."""
        now_str = datetime.now(timezone.utc).isoformat()
        mock_db.fetch_all.return_value = [
            {"holder_name": "Big Fund", "shares": 1000, "fetched_at": now_str},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_holders("AAPL")
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["holder_name"] == "Big Fund"

    @pytest.mark.asyncio
    async def test_get_cached_holders_returns_none_on_empty(self, mock_db):
        """get_cached_holders returns None when no rows found."""
        mock_db.fetch_all.return_value = []
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_holders("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_holders_returns_none_when_ttl_expired(self, mock_db):
        """get_cached_holders returns None when cached data exceeds TTL."""
        old_time = (datetime.now(timezone.utc) - timedelta(seconds=HOLDER_CACHE_TTL + 100)).isoformat()
        mock_db.fetch_all.return_value = [
            {"holder_name": "Big Fund", "shares": 1000, "fetched_at": old_time},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_holders("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_holders_returns_none_on_invalid_fetched_at(self, mock_db):
        """get_cached_holders returns None when fetched_at is unparseable."""
        mock_db.fetch_all.return_value = [
            {"holder_name": "Big Fund", "shares": 1000, "fetched_at": "not-a-date"},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_holders("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_holders_uppercases_symbol(self, mock_db):
        """get_cached_holders uppercases the symbol in the SQL query."""
        mock_db.fetch_all.return_value = []
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await get_cached_holders("aapl")
        call_args = mock_db.fetch_all.call_args[0]
        assert call_args[1][0] == "AAPL"

    @pytest.mark.asyncio
    async def test_store_holders_calls_executemany(self, mock_db):
        """store_holders calls executemany with correct SQL."""
        holders = [
            {"holder_name": "Big Fund", "shares": 1000, "value_usd": 150000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31"},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await store_holders("AAPL", holders)
        mock_db.executemany.assert_called_once()
        sql = mock_db.executemany.call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        assert "ownership_cache" in sql

    @pytest.mark.asyncio
    async def test_store_holders_handles_empty_list(self, mock_db):
        """store_holders does nothing when holders list is empty."""
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await store_holders("AAPL", [])
        mock_db.executemany.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_cached_insiders_returns_list_on_hit(self, mock_db):
        """get_cached_insiders returns a list when cache rows exist within TTL."""
        now_str = datetime.now(timezone.utc).isoformat()
        mock_db.fetch_all.return_value = [
            {"insider_name": "Jane CEO", "shares": 500,
             "transaction_date": "2025-01-10", "fetched_at": now_str},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_insiders("AAPL", 365)
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_cached_insiders_returns_none_on_empty(self, mock_db):
        """get_cached_insiders returns None when no rows found."""
        mock_db.fetch_all.return_value = []
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_insiders("AAPL", 365)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_insiders_returns_none_when_ttl_expired(self, mock_db):
        """get_cached_insiders returns None when cached data exceeds TTL."""
        old_time = (datetime.now(timezone.utc) - timedelta(seconds=INSIDER_CACHE_TTL + 100)).isoformat()
        mock_db.fetch_all.return_value = [
            {"insider_name": "Jane CEO", "shares": 500,
             "transaction_date": "2025-01-10", "fetched_at": old_time},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_insiders("AAPL", 365)
        assert result is None

    @pytest.mark.asyncio
    async def test_store_insiders_calls_executemany(self, mock_db):
        """store_insiders calls executemany with correct SQL."""
        transactions = [
            {"insider_name": "Jane CEO", "insider_title": "CEO",
             "transaction_type": "buy", "shares": 500,
             "price_per_share": 150.0, "total_value": 75000.0,
             "shares_owned_after": 10000,
             "transaction_date": "2025-01-10", "filing_date": "2025-01-12"},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await store_insiders("AAPL", transactions)
        mock_db.executemany.assert_called_once()
        sql = mock_db.executemany.call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        assert "insider_transactions" in sql

    @pytest.mark.asyncio
    async def test_store_insiders_handles_empty_list(self, mock_db):
        """store_insiders does nothing when transactions list is empty."""
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await store_insiders("AAPL", [])
        mock_db.executemany.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_cached_holders_handles_naive_datetime(self, mock_db):
        """get_cached_holders handles naive datetime by assuming UTC."""
        naive_dt = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        mock_db.fetch_all.return_value = [
            {"holder_name": "Big Fund", "shares": 1000, "fetched_at": naive_dt},
        ]
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            result = await get_cached_holders("AAPL")
        assert result is not None


# ===================================================================
# 4. Response Builders
# ===================================================================
class TestResponseBuilders:
    """Tests for build_holders_response and build_insider_response."""

    def test_build_holders_response_creates_proper_structure(self):
        """build_holders_response creates dict with holders, totals, and num_holders."""
        holders = [
            {"holder_name": "Fund A", "shares": 1000, "value_usd": 150000},
            {"holder_name": "Fund B", "shares": 2000, "value_usd": 300000},
        ]
        result = build_holders_response("AAPL", holders)
        assert result["symbol"] == "AAPL"
        assert result["total_institutional_shares"] == 3000
        assert result["total_institutional_value"] == 450000
        assert result["num_holders"] == 2
        # Sorted by shares descending
        assert result["holders"][0]["holder_name"] == "Fund B"
        assert result["holders"][1]["holder_name"] == "Fund A"

    def test_build_holders_response_handles_empty(self):
        """build_holders_response handles empty holders list."""
        result = build_holders_response("AAPL", [])
        assert result["symbol"] == "AAPL"
        assert result["holders"] == []
        assert result["total_institutional_shares"] == 0
        assert result["total_institutional_value"] == 0
        assert result["num_holders"] == 0

    def test_build_holders_response_handles_none_values(self):
        """build_holders_response handles holders with None shares/value."""
        holders = [
            {"holder_name": "Fund A", "shares": None, "value_usd": None},
            {"holder_name": "Fund B", "shares": 500, "value_usd": 75000},
        ]
        result = build_holders_response("AAPL", holders)
        assert result["total_institutional_shares"] == 500
        assert result["total_institutional_value"] == 75000

    def test_build_insider_response_creates_proper_structure(self):
        """build_insider_response creates dict with transactions and summary."""
        transactions = [
            {"insider_name": "CEO", "transaction_type": "buy",
             "shares": 1000, "total_value": 50000},
            {"insider_name": "CFO", "transaction_type": "sell",
             "shares": 500, "total_value": 25000},
        ]
        result = build_insider_response("AAPL", transactions)
        assert result["symbol"] == "AAPL"
        assert len(result["transactions"]) == 2
        s = result["summary"]
        assert s["total_transactions"] == 2
        assert s["total_buys"] == 1
        assert s["total_sells"] == 1
        assert s["total_buy_shares"] == 1000
        assert s["total_sell_shares"] == 500
        assert s["net_shares"] == 500  # 1000 - 500
        assert s["net_value"] == 25000  # 50000 - 25000
        assert s["unique_insiders_buying"] == 1
        assert s["unique_insiders_selling"] == 1

    def test_build_insider_response_handles_empty(self):
        """build_insider_response handles empty transactions list."""
        result = build_insider_response("AAPL", [])
        assert result["symbol"] == "AAPL"
        assert result["transactions"] == []
        s = result["summary"]
        assert s["total_transactions"] == 0
        assert s["total_buys"] == 0
        assert s["total_sells"] == 0
        assert s["net_shares"] == 0
        assert s["net_value"] == 0

    def test_build_insider_response_net_direction_via_net_shares(self):
        """build_insider_response computes net_shares correctly for buying vs selling."""
        # All buys => positive net_shares
        buys_only = [
            {"insider_name": "A", "transaction_type": "buy",
             "shares": 100, "total_value": 5000},
        ]
        result = build_insider_response("AAPL", buys_only)
        assert result["summary"]["net_shares"] > 0

        # All sells => negative net_shares
        sells_only = [
            {"insider_name": "B", "transaction_type": "sell",
             "shares": 200, "total_value": 10000},
        ]
        result = build_insider_response("AAPL", sells_only)
        assert result["summary"]["net_shares"] < 0

    def test_build_insider_response_none_values(self):
        """build_insider_response handles None shares and total_value gracefully."""
        transactions = [
            {"insider_name": "CEO", "transaction_type": "buy",
             "shares": None, "total_value": None},
        ]
        result = build_insider_response("AAPL", transactions)
        assert result["summary"]["total_buy_shares"] == 0
        assert result["summary"]["total_buy_value"] == 0


# ===================================================================
# 5. Form 4 Parser
# ===================================================================
class TestForm4Parser:
    """Tests for parse_form4_sync and _extract_* helpers."""

    def test_parse_form4_sync_extracts_insider_name(self):
        """parse_form4_sync extracts the insider_name from the data_object."""
        activities = [_make_mock_activity(code="P", shares=100, value=5000.0, price=50.0)]
        obj = _make_mock_form4_obj(insider="John Doe", activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["insider_name"] == "John Doe"

    def test_parse_form4_sync_extracts_position(self):
        """parse_form4_sync extracts the position from ownership summary."""
        activities = [_make_mock_activity(code="P")]
        obj = _make_mock_form4_obj(insider="Jane CFO", position="CFO", activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["insider_title"] == "CFO"

    def test_parse_form4_sync_maps_buy_code_p(self):
        """parse_form4_sync maps code P to transaction_type buy."""
        activities = [_make_mock_activity(code="P", shares=100)]
        obj = _make_mock_form4_obj(activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["transactions"][0]["transaction_type"] == "buy"
        assert result["transactions"][0]["code"] == "P"

    def test_parse_form4_sync_maps_sell_code_s(self):
        """parse_form4_sync maps code S to transaction_type sell."""
        activities = [_make_mock_activity(code="S", shares=200)]
        obj = _make_mock_form4_obj(activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["transactions"][0]["transaction_type"] == "sell"

    def test_parse_form4_sync_maps_exercise_code_m(self):
        """parse_form4_sync maps code M to transaction_type exercise."""
        activities = [_make_mock_activity(code="M", shares=300)]
        obj = _make_mock_form4_obj(activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["transactions"][0]["transaction_type"] == "exercise"

    def test_parse_form4_sync_returns_none_on_no_data_object(self):
        """parse_form4_sync returns None when data_object() returns None."""
        filing = _make_mock_filing(data_obj=None)
        result = parse_form4_sync(filing)
        assert result is None

    def test_parse_form4_sync_returns_none_on_no_activities(self):
        """parse_form4_sync returns None when there are no transaction activities."""
        obj = _make_mock_form4_obj(activities=[])
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is None

    def test_parse_form4_sync_returns_none_on_exception(self):
        """parse_form4_sync returns None when data_object() raises an exception."""
        filing = MagicMock()
        filing.data_object.side_effect = Exception("parse error")

        # parse_form4_sync wraps data_object() in try/except → returns None
        result = parse_form4_sync(filing)
        assert result is None

    def test_parse_form4_sync_handles_missing_ownership_summary(self):
        """parse_form4_sync handles exception in get_ownership_summary gracefully."""
        activities = [_make_mock_activity(code="P", shares=50)]
        obj = _make_mock_form4_obj(activities=activities)
        obj.get_ownership_summary.side_effect = Exception("no summary")
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        # insider_title should be None since summary failed
        assert result["insider_title"] is None

    def test_parse_form4_sync_multiple_activities(self):
        """parse_form4_sync handles multiple transaction activities."""
        activities = [
            _make_mock_activity(code="P", shares=100, value=5000.0, price=50.0),
            _make_mock_activity(code="S", shares=200, value=12000.0, price=60.0),
        ]
        obj = _make_mock_form4_obj(activities=activities)
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert len(result["transactions"]) == 2
        assert result["transactions"][0]["transaction_type"] == "buy"
        assert result["transactions"][1]["transaction_type"] == "sell"

    def test_parse_form4_sync_unknown_insider_defaults(self):
        """parse_form4_sync defaults insider_name to 'Unknown' when None."""
        activities = [_make_mock_activity(code="P")]
        obj = _make_mock_form4_obj(activities=activities)
        obj.insider_name = None
        filing = _make_mock_filing(data_obj=obj)

        result = parse_form4_sync(filing)
        assert result is not None
        assert result["insider_name"] == "Unknown"


# ===================================================================
# 5b. Extract Helpers
# ===================================================================
class TestExtractHelpers:
    """Tests for _extract_shares, _extract_value, _extract_price."""

    def test_extract_shares_numeric(self):
        """_extract_shares uses shares_numeric when available."""
        act = MagicMock()
        act.shares_numeric = 500
        act.shares = 999  # ignored
        assert _extract_shares(act) == 500

    def test_extract_shares_fallback_to_shares(self):
        """_extract_shares falls back to shares attribute when shares_numeric is None."""
        act = MagicMock()
        act.shares_numeric = None
        act.shares = 300
        assert _extract_shares(act) == 300

    def test_extract_shares_string_with_comma(self):
        """_extract_shares handles string shares with commas."""
        act = MagicMock()
        act.shares_numeric = None
        act.shares = "1,234"
        assert _extract_shares(act) == 1234

    def test_extract_shares_none_returns_zero(self):
        """_extract_shares returns 0 when both shares_numeric and shares are None."""
        act = MagicMock()
        act.shares_numeric = None
        act.shares = None
        assert _extract_shares(act) == 0

    def test_extract_shares_invalid_string_returns_zero(self):
        """_extract_shares returns 0 for non-numeric string."""
        act = MagicMock()
        act.shares_numeric = None
        act.shares = "N/A"
        assert _extract_shares(act) == 0

    def test_extract_value_numeric(self):
        """_extract_value uses value_numeric when available."""
        act = MagicMock()
        act.value_numeric = 50000.0
        act.value = 99999.0
        assert _extract_value(act) == 50000.0

    def test_extract_value_fallback_to_value(self):
        """_extract_value falls back to value attribute."""
        act = MagicMock()
        act.value_numeric = None
        act.value = 25000.0
        assert _extract_value(act) == 25000.0

    def test_extract_value_string_with_dollar(self):
        """_extract_value handles string value with $ and commas."""
        act = MagicMock()
        act.value_numeric = None
        act.value = "$1,234.56"
        assert _extract_value(act) == 1234.56

    def test_extract_value_none_returns_none(self):
        """_extract_value returns None when both value_numeric and value are None."""
        act = MagicMock()
        act.value_numeric = None
        act.value = None
        assert _extract_value(act) is None

    def test_extract_price_numeric(self):
        """_extract_price uses price_numeric when available."""
        act = MagicMock()
        act.price_numeric = 50.0
        act.price_per_share = 99.0
        assert _extract_price(act) == 50.0

    def test_extract_price_fallback_to_price_per_share(self):
        """_extract_price falls back to price_per_share."""
        act = MagicMock()
        act.price_numeric = None
        act.price_per_share = 75.0
        assert _extract_price(act) == 75.0

    def test_extract_price_none_returns_none(self):
        """_extract_price returns None when both numeric and fallback are None."""
        act = MagicMock()
        act.price_numeric = None
        act.price_per_share = None
        assert _extract_price(act) is None


# ===================================================================
# 6. EdgarOwnershipClient Initialization
# ===================================================================
class TestEdgarOwnershipInit:
    """Tests for EdgarOwnershipClient constructor and lifecycle."""

    def test_constructor_reads_settings(self, mock_settings):
        """Constructor reads user_agent from settings."""
        with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
            c = EdgarOwnershipClient()
        assert c._user_agent == "TestAgent test@test.com"

    def test_http_client_is_lazy(self, client):
        """HTTP client is None until first use."""
        assert client._http is None

    def test_identity_not_set_initially(self, client):
        """_identity_set is False after construction."""
        assert client._identity_set is False

    @pytest.mark.asyncio
    async def test_close_method_works(self, client):
        """close() does not raise (no-op when no client)."""
        await client.close()
        assert client._http is None

    @pytest.mark.asyncio
    async def test_close_method_closes_http(self, client):
        """close() closes the HTTP client if it exists."""
        # Force creation
        http = client._get_http()
        assert http is not None
        await client.close()
        assert client._http is None

    def test_get_http_creates_client(self, client):
        """_get_http lazily creates an httpx.AsyncClient."""
        http = client._get_http()
        assert isinstance(http, httpx.AsyncClient)

    def test_get_http_returns_same_instance(self, client):
        """_get_http returns the same client on repeated calls."""
        first = client._get_http()
        second = client._get_http()
        assert first is second

    def test_ensure_identity_sets_once(self, client):
        """_ensure_identity sets identity only once."""
        mock_edgar = MagicMock()
        with patch.dict("sys.modules", {"edgar": mock_edgar}):
            client._ensure_identity()
            assert client._identity_set is True
            client._ensure_identity()
            mock_edgar.set_identity.assert_called_once_with("TestAgent test@test.com")


# ===================================================================
# 7. _search_efts
# ===================================================================
class TestSearchEfts:
    """Tests for EdgarOwnershipClient._search_efts."""

    @pytest.mark.asyncio
    async def test_returns_list_of_institution_dicts(self, client):
        """_search_efts returns a list of institution dicts on success."""
        efts_json = _make_efts_response()
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = efts_json
        mock_resp.raise_for_status.return_value = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
                result = await client._search_efts("AAPL")

        assert len(result) == 2
        assert result[0]["institution_name"] == "Big Capital LLC"
        assert result[0]["cik"] == 1234567
        assert result[0]["filing_date"] == "2025-01-10"
        assert result[0]["accession_no"] == "0001234567-25-000001"

    @pytest.mark.asyncio
    async def test_handles_empty_results(self, client):
        """_search_efts returns empty list when no hits."""
        efts_json = {"hits": {"hits": []}}
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = efts_json
        mock_resp.raise_for_status.return_value = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
                result = await client._search_efts("AAPL")

        assert result == []

    @pytest.mark.asyncio
    async def test_handles_http_error_gracefully(self, client):
        """_search_efts returns empty list on HTTP error."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(
                httpx.AsyncClient, "get", new_callable=AsyncMock,
                side_effect=httpx.HTTPStatusError(
                    "500 error", request=MagicMock(), response=MagicMock()
                ),
            ):
                result = await client._search_efts("AAPL")

        assert result == []

    @pytest.mark.asyncio
    async def test_respects_max_results(self, client):
        """_search_efts respects max_results limit."""
        # Create 5 hits
        hits = [
            {
                "_source": {
                    "ciks": [str(i)],
                    "display_names": [f"Fund {i}"],
                    "file_date": "2025-01-10",
                    "adsh": f"acc-{i}",
                    "period_ending": "2024-12-31",
                },
            }
            for i in range(5)
        ]
        efts_json = {"hits": {"hits": hits}}
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = efts_json
        mock_resp.raise_for_status.return_value = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
                result = await client._search_efts("AAPL", max_results=3)

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_skips_hits_without_ciks(self, client):
        """_search_efts skips hits that have no CIKs."""
        hits = [
            {
                "_source": {
                    "ciks": [],
                    "display_names": ["Empty CIK Fund"],
                    "file_date": "2025-01-10",
                    "adsh": "acc-empty",
                },
            },
            {
                "_source": {
                    "ciks": ["9999"],
                    "display_names": ["Valid Fund"],
                    "file_date": "2025-01-10",
                    "adsh": "acc-valid",
                },
            },
        ]
        efts_json = {"hits": {"hits": hits}}
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = efts_json
        mock_resp.raise_for_status.return_value = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
                result = await client._search_efts("AAPL")

        assert len(result) == 1
        assert result[0]["institution_name"] == "Valid Fund"

    @pytest.mark.asyncio
    async def test_handles_missing_display_names(self, client):
        """_search_efts uses 'Unknown' when display_names is empty."""
        hits = [
            {
                "_source": {
                    "ciks": ["1111"],
                    "display_names": [],
                    "file_date": "2025-01-10",
                    "adsh": "acc-no-name",
                },
            },
        ]
        efts_json = {"hits": {"hits": hits}}
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = efts_json
        mock_resp.raise_for_status.return_value = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock, return_value=mock_resp):
                result = await client._search_efts("AAPL")

        assert len(result) == 1
        assert result[0]["institution_name"] == "Unknown"

    @pytest.mark.asyncio
    async def test_rate_limits_before_http_call(self, client):
        """_search_efts calls _wait_for_edgar_rate_limit before the HTTP request."""
        call_order = []

        async def mock_rate_limit():
            call_order.append("rate_limit")

        async def mock_get(*args, **kwargs):
            call_order.append("http_get")
            resp = MagicMock(spec=httpx.Response)
            resp.status_code = 200
            resp.json.return_value = {"hits": {"hits": []}}
            resp.raise_for_status.return_value = None
            return resp

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", side_effect=mock_rate_limit):
            with patch.object(httpx.AsyncClient, "get", side_effect=mock_get):
                await client._search_efts("AAPL")

        assert call_order == ["rate_limit", "http_get"]


# ===================================================================
# 8. _parse_13f_holding
# ===================================================================
class TestParse13fHolding:
    """Tests for EdgarOwnershipClient._parse_13f_holding."""

    @pytest.mark.asyncio
    async def test_returns_holding_dict_on_success(self, client):
        """_parse_13f_holding returns dict with holder_name, shares, value_usd."""
        holdings_df = _make_holdings_df(tickers=["AAPL"], shares=[1000000], values=[250000000])
        mock_obj = MagicMock()
        mock_obj.holdings = holdings_df
        mock_obj.report_period = "2024-12-31"

        mock_filing_cls = MagicMock()
        mock_filing_instance = MagicMock()
        mock_filing_instance.obj.return_value = mock_obj
        mock_filing_cls.return_value = mock_filing_instance

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread") as mock_thread:
                # to_thread runs the sync function; simulate it
                def run_sync(fn, *args, **kwargs):
                    return fn(*args, **kwargs) if callable(fn) else fn
                mock_thread.side_effect = lambda fn: fn()

                mock_edgar_mod = MagicMock()
                mock_edgar_mod.Filing = mock_filing_cls
                with patch.dict("sys.modules", {"edgar": mock_edgar_mod}):
                    result = await client._parse_13f_holding(
                        cik=1234567,
                        company_name="Big Capital LLC",
                        form="13F-HR",
                        filing_date="2025-01-10",
                        accession_no="0001234567-25-000001",
                        target_ticker="AAPL",
                    )

        assert result is not None
        assert result["holder_name"] == "Big Capital LLC"
        assert result["shares"] == 1000000
        assert result["value_usd"] == 250000000.0

    @pytest.mark.asyncio
    async def test_returns_none_when_ticker_not_found(self, client):
        """_parse_13f_holding returns None when target ticker not in holdings."""
        holdings_df = _make_holdings_df(tickers=["MSFT", "GOOG"], shares=[500, 600], values=[50000, 60000])
        mock_obj = MagicMock()
        mock_obj.holdings = holdings_df

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread") as mock_thread:
                def run_sync(fn):
                    return fn()
                mock_thread.side_effect = run_sync

                mock_filing_cls = MagicMock()
                mock_filing_instance = MagicMock()
                mock_filing_instance.obj.return_value = mock_obj
                mock_filing_cls.return_value = mock_filing_instance

                mock_edgar_mod = MagicMock()
                mock_edgar_mod.Filing = mock_filing_cls
                with patch.dict("sys.modules", {"edgar": mock_edgar_mod}):
                    result = await client._parse_13f_holding(
                        cik=1234567,
                        company_name="Big Fund",
                        form="13F-HR",
                        filing_date="2025-01-10",
                        accession_no="acc-1",
                        target_ticker="AAPL",
                    )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """_parse_13f_holding returns None on exception."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", side_effect=Exception("parse fail")):
                result = await client._parse_13f_holding(
                    cik=1234567,
                    company_name="Bad Fund",
                    form="13F-HR",
                    filing_date="2025-01-10",
                    accession_no="acc-bad",
                    target_ticker="AAPL",
                )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_obj_is_none(self, client):
        """_parse_13f_holding returns None when filing.obj() returns None."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread") as mock_thread:
                def run_sync(fn):
                    return fn()
                mock_thread.side_effect = run_sync

                mock_filing_cls = MagicMock()
                mock_filing_instance = MagicMock()
                mock_filing_instance.obj.return_value = None
                mock_filing_cls.return_value = mock_filing_instance

                mock_edgar_mod = MagicMock()
                mock_edgar_mod.Filing = mock_filing_cls
                with patch.dict("sys.modules", {"edgar": mock_edgar_mod}):
                    result = await client._parse_13f_holding(
                        cik=1234567,
                        company_name="Fund",
                        form="13F-HR",
                        filing_date="2025-01-10",
                        accession_no="acc-none",
                        target_ticker="AAPL",
                    )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_holdings_is_none(self, client):
        """_parse_13f_holding returns None when holdings attribute is None."""
        mock_obj = MagicMock()
        mock_obj.holdings = None

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread") as mock_thread:
                def run_sync(fn):
                    return fn()
                mock_thread.side_effect = run_sync

                mock_filing_cls = MagicMock()
                mock_filing_instance = MagicMock()
                mock_filing_instance.obj.return_value = mock_obj
                mock_filing_cls.return_value = mock_filing_instance

                mock_edgar_mod = MagicMock()
                mock_edgar_mod.Filing = mock_filing_cls
                with patch.dict("sys.modules", {"edgar": mock_edgar_mod}):
                    result = await client._parse_13f_holding(
                        cik=1234567,
                        company_name="Fund",
                        form="13F-HR",
                        filing_date="2025-01-10",
                        accession_no="acc-no-holdings",
                        target_ticker="AAPL",
                    )

        assert result is None


# ===================================================================
# 9. get_institutional_holders
# ===================================================================
class TestGetInstitutionalHolders:
    """Tests for EdgarOwnershipClient.get_institutional_holders."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_with_cached_flag(self, client, mock_db):
        """get_institutional_holders returns cached data with _cached=True on cache hit."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"holder_name": "Fund A", "shares": 1000, "value_usd": 150000,
             "change_shares": 100, "change_percent": 10.0,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
        ]
        with patch(
            "app.data.edgar_ownership.get_cached_holders",
            new_callable=AsyncMock,
            return_value=cached_rows,
        ):
            result = await client.get_institutional_holders("AAPL")

        assert result is not None
        assert result["_cached"] is True
        assert result["_source"] == "edgar"
        assert result["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_fetches_from_efts_on_cache_miss(self, client):
        """get_institutional_holders fetches from EFTS and parses 13F on cache miss."""
        efts_hits = [
            {"institution_name": "Big Fund", "cik": 1234567,
             "filing_date": "2025-01-10", "accession_no": "acc-1",
             "report_period": "2024-12-31"},
        ]
        holding = {
            "holder_name": "Big Fund",
            "shares": 5000,
            "value_usd": 750000,
            "report_period": "2024-12-31",
            "filing_date": "2025-01-10",
        }

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=efts_hits):
                with patch.object(client, "_parse_13f_holding", new_callable=AsyncMock, return_value=holding):
                    with patch("app.data.edgar_ownership.store_holders", new_callable=AsyncMock) as mock_store:
                        result = await client.get_institutional_holders("AAPL")

        assert result is not None
        assert result["_cached"] is False
        assert result["num_holders"] == 1
        assert result["holders"][0]["holder_name"] == "Big Fund"
        mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_efts_empty(self, client):
        """get_institutional_holders returns None when EFTS search is empty."""
        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=[]):
                result = await client.get_institutional_holders("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_holders_found(self, client):
        """get_institutional_holders returns None when all 13F parses return None."""
        efts_hits = [
            {"institution_name": "Empty Fund", "cik": 1111,
             "filing_date": "2025-01-10", "accession_no": "acc-e",
             "report_period": "2024-12-31"},
        ]

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=efts_hits):
                with patch.object(client, "_parse_13f_holding", new_callable=AsyncMock, return_value=None):
                    result = await client.get_institutional_holders("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_stores_in_cache_after_fetch(self, client):
        """get_institutional_holders stores holders in cache after successful fetch."""
        efts_hits = [
            {"institution_name": "Fund X", "cik": 1111,
             "filing_date": "2025-01-10", "accession_no": "acc-x",
             "report_period": "2024-12-31"},
        ]
        holding = {
            "holder_name": "Fund X", "shares": 100, "value_usd": 15000,
            "report_period": "2024-12-31", "filing_date": "2025-01-10",
        }

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=efts_hits):
                with patch.object(client, "_parse_13f_holding", new_callable=AsyncMock, return_value=holding):
                    with patch("app.data.edgar_ownership.store_holders", new_callable=AsyncMock) as mock_store:
                        await client.get_institutional_holders("AAPL")

        mock_store.assert_called_once()
        stored_sym = mock_store.call_args[0][0]
        assert stored_sym == "AAPL"

    @pytest.mark.asyncio
    async def test_tags_response_with_metadata(self, client):
        """get_institutional_holders tags response with _source and _fetched_at."""
        efts_hits = [
            {"institution_name": "Fund", "cik": 1111,
             "filing_date": "2025-01-10", "accession_no": "acc",
             "report_period": "2024-12-31"},
        ]
        holding = {
            "holder_name": "Fund", "shares": 100, "value_usd": 15000,
            "report_period": "2024-12-31", "filing_date": "2025-01-10",
        }

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=efts_hits):
                with patch.object(client, "_parse_13f_holding", new_callable=AsyncMock, return_value=holding):
                    with patch("app.data.edgar_ownership.store_holders", new_callable=AsyncMock):
                        result = await client.get_institutional_holders("AAPL")

        assert result["_source"] == "edgar"
        assert "_fetched_at" in result

    @pytest.mark.asyncio
    async def test_deduplicates_by_cik(self, client):
        """get_institutional_holders de-duplicates EFTS hits by CIK (keeps first)."""
        efts_hits = [
            {"institution_name": "Fund A", "cik": 1111,
             "filing_date": "2025-01-10", "accession_no": "acc-a1",
             "report_period": "2024-12-31"},
            {"institution_name": "Fund A", "cik": 1111,
             "filing_date": "2025-01-05", "accession_no": "acc-a2",
             "report_period": "2024-09-30"},
            {"institution_name": "Fund B", "cik": 2222,
             "filing_date": "2025-01-08", "accession_no": "acc-b1",
             "report_period": "2024-12-31"},
        ]
        holding = {
            "holder_name": "Fund", "shares": 100, "value_usd": 15000,
            "report_period": "2024-12-31", "filing_date": "2025-01-10",
        }

        parse_count = 0

        async def mock_parse(*args, **kwargs):
            nonlocal parse_count
            parse_count += 1
            return holding

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_search_efts", new_callable=AsyncMock, return_value=efts_hits):
                with patch.object(client, "_parse_13f_holding", side_effect=mock_parse):
                    with patch("app.data.edgar_ownership.store_holders", new_callable=AsyncMock):
                        await client.get_institutional_holders("AAPL")

        # Only 2 unique CIKs should be parsed (1111 and 2222)
        assert parse_count == 2


# ===================================================================
# 10. get_top_holders
# ===================================================================
class TestGetTopHolders:
    """Tests for EdgarOwnershipClient.get_top_holders."""

    @pytest.mark.asyncio
    async def test_returns_top_n_holders_sorted(self, client):
        """get_top_holders returns top N holders sorted by shares descending."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"holder_name": "Small Fund", "shares": 100, "value_usd": 10000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
            {"holder_name": "Big Fund", "shares": 5000, "value_usd": 500000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
            {"holder_name": "Medium Fund", "shares": 1000, "value_usd": 100000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
        ]

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_top_holders("AAPL", top_n=2)

        assert result is not None
        assert len(result) == 2
        # Sorted descending by shares
        assert result[0]["holder_name"] == "Big Fund"
        assert result[1]["holder_name"] == "Medium Fund"

    @pytest.mark.asyncio
    async def test_returns_cached_data_tagged(self, client):
        """get_top_holders tags cached data with _cached=True."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"holder_name": "Fund", "shares": 100, "value_usd": 10000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
        ]

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_top_holders("AAPL", top_n=5)

        assert result is not None
        assert result[0]["_cached"] is True

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, client):
        """get_top_holders returns None when underlying call fails."""
        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "get_institutional_holders", new_callable=AsyncMock, return_value=None):
                result = await client.get_top_holders("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_respects_top_n_parameter(self, client):
        """get_top_holders returns at most top_n results."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"holder_name": f"Fund {i}", "shares": i * 100, "value_usd": i * 10000,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str}
            for i in range(10)
        ]

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_top_holders("AAPL", top_n=3)

        assert result is not None
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_falls_back_to_get_institutional_holders(self, client):
        """get_top_holders falls back to get_institutional_holders on cache miss."""
        full_result = {
            "symbol": "AAPL",
            "holders": [
                {"holder_name": "A", "shares": 200},
                {"holder_name": "B", "shares": 500},
            ],
            "total_institutional_shares": 700,
            "total_institutional_value": 70000,
            "num_holders": 2,
        }

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=None):
            with patch.object(
                client, "get_institutional_holders",
                new_callable=AsyncMock, return_value=full_result,
            ):
                result = await client.get_top_holders("AAPL", top_n=1)

        assert result is not None
        assert len(result) == 1
        assert result[0]["holder_name"] == "B"  # sorted desc by shares


# ===================================================================
# 11. get_insider_transactions
# ===================================================================
class TestGetInsiderTransactions:
    """Tests for EdgarOwnershipClient.get_insider_transactions."""

    @pytest.mark.asyncio
    async def test_returns_cached_data_on_hit(self, client):
        """get_insider_transactions returns cached data with _cached=True."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"insider_name": "CEO", "insider_title": "CEO",
             "transaction_type": "buy", "shares": 500,
             "price_per_share": 150.0, "total_value": 75000.0,
             "shares_owned_after": 10000,
             "transaction_date": "2025-01-10", "filing_date": "2025-01-12",
             "fetched_at": now_str},
        ]

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_insider_transactions("AAPL")

        assert result is not None
        assert result["_cached"] is True
        assert result["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_fetches_form4_on_cache_miss(self, client):
        """get_insider_transactions fetches Form 4 filings on cache miss."""
        activities = [_make_mock_activity(code="P", shares=100, value=5000.0, price=50.0)]
        obj = _make_mock_form4_obj(insider="John CEO", position="CEO", activities=activities)
        filing = _make_mock_filing(filing_date="2025-01-10", data_obj=obj)

        mock_company = MagicMock()
        filings_filter = MagicMock()
        filings_filter.__iter__ = MagicMock(return_value=iter([filing]))
        mock_company.get_filings.return_value.filter.return_value = filings_filter

        parsed = {
            "insider_name": "John CEO",
            "insider_title": "CEO",
            "transactions": [
                {"transaction_type": "buy", "code": "P", "shares": 100,
                 "total_value": 5000.0, "price_per_share": 50.0,
                 "security_title": "Common Stock"},
            ],
        }

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=mock_company):
                with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_ownership.asyncio.to_thread") as mock_thread:
                        mock_thread.side_effect = [filings_filter, parsed]
                        with patch("app.data.edgar_ownership.store_insiders", new_callable=AsyncMock) as mock_store:
                            with patch.object(client, "_parse_form4_filing", new_callable=AsyncMock, return_value=parsed):
                                result = await client.get_insider_transactions("AAPL")

        assert result is not None
        assert result["_cached"] is False

    @pytest.mark.asyncio
    async def test_returns_none_on_company_not_found(self, client):
        """get_insider_transactions returns None when company not found."""
        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=None):
                result = await client.get_insider_transactions("INVALID")

        assert result is None

    @pytest.mark.asyncio
    async def test_handles_empty_filings(self, client):
        """get_insider_transactions handles case when no Form 4 filings found."""
        mock_company = MagicMock()
        filings_filter = MagicMock()
        filings_filter.__iter__ = MagicMock(return_value=iter([]))
        mock_company.get_filings.return_value.filter.return_value = filings_filter

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=mock_company):
                with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=filings_filter):
                        with patch("app.data.edgar_ownership.store_insiders", new_callable=AsyncMock):
                            result = await client.get_insider_transactions("AAPL")

        assert result is not None
        assert result["summary"]["total_transactions"] == 0

    @pytest.mark.asyncio
    async def test_stores_in_cache_after_fetch(self, client):
        """get_insider_transactions stores transactions in cache after fetch."""
        mock_company = MagicMock()
        filings_filter = MagicMock()
        filings_filter.__iter__ = MagicMock(return_value=iter([]))
        mock_company.get_filings.return_value.filter.return_value = filings_filter

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=mock_company):
                with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=filings_filter):
                        with patch("app.data.edgar_ownership.store_insiders", new_callable=AsyncMock) as mock_store:
                            await client.get_insider_transactions("AAPL")

        mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_tags_response_with_metadata(self, client):
        """get_insider_transactions tags response with metadata."""
        mock_company = MagicMock()
        filings_filter = MagicMock()
        filings_filter.__iter__ = MagicMock(return_value=iter([]))
        mock_company.get_filings.return_value.filter.return_value = filings_filter

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=mock_company):
                with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=filings_filter):
                        with patch("app.data.edgar_ownership.store_insiders", new_callable=AsyncMock):
                            result = await client.get_insider_transactions("AAPL")

        assert result["_source"] == "edgar"
        assert "_fetched_at" in result

    @pytest.mark.asyncio
    async def test_returns_none_on_company_exception(self, client):
        """get_insider_transactions returns None when company lookup raises exception."""
        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, side_effect=Exception("err")):
                result = await client.get_insider_transactions("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_filings_fetch_exception(self, client):
        """get_insider_transactions returns None when filings fetch raises exception."""
        mock_company = MagicMock()

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=None):
            with patch.object(client, "_get_company_obj", new_callable=AsyncMock, return_value=mock_company):
                with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
                    with patch("app.data.edgar_ownership.asyncio.to_thread", side_effect=Exception("fetch fail")):
                        result = await client.get_insider_transactions("AAPL")

        assert result is None


# ===================================================================
# 12. get_insider_summary
# ===================================================================
class TestGetInsiderSummary:
    """Tests for EdgarOwnershipClient.get_insider_summary."""

    @pytest.mark.asyncio
    async def test_returns_simplified_summary(self, client):
        """get_insider_summary returns a dict with expected fields."""
        insider_data = {
            "symbol": "AAPL",
            "transactions": [
                {"insider_name": "CEO", "transaction_type": "buy",
                 "shares": 100, "total_value": 5000,
                 "transaction_date": "2025-01-10"},
            ],
            "summary": {
                "total_transactions": 1,
                "total_buys": 1,
                "total_sells": 0,
                "total_buy_shares": 100,
                "total_sell_shares": 0,
                "total_buy_value": 5000,
                "total_sell_value": 0,
                "net_shares": 100,
                "net_value": 5000,
                "unique_insiders_buying": 1,
                "unique_insiders_selling": 0,
            },
            "_cached": False,
        }

        with patch.object(
            client, "get_insider_transactions",
            new_callable=AsyncMock, return_value=insider_data,
        ):
            result = await client.get_insider_summary("AAPL")

        assert result is not None
        assert result["symbol"] == "AAPL"
        assert result["net_direction"] == "buying"
        assert result["net_shares"] == 100
        assert result["total_buys"] == 1
        assert result["total_sells"] == 0

    @pytest.mark.asyncio
    async def test_net_direction_buying(self, client):
        """get_insider_summary returns 'buying' when net_shares > 0."""
        data = {
            "symbol": "AAPL",
            "transactions": [],
            "summary": {"net_shares": 100, "net_value": 5000,
                         "total_buys": 1, "total_sells": 0,
                         "total_buy_value": 5000, "total_sell_value": 0,
                         "unique_insiders_buying": 1, "unique_insiders_selling": 0},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")
        assert result["net_direction"] == "buying"

    @pytest.mark.asyncio
    async def test_net_direction_selling(self, client):
        """get_insider_summary returns 'selling' when net_shares < 0."""
        data = {
            "symbol": "AAPL",
            "transactions": [],
            "summary": {"net_shares": -200, "net_value": -10000,
                         "total_buys": 0, "total_sells": 1,
                         "total_buy_value": 0, "total_sell_value": 10000,
                         "unique_insiders_buying": 0, "unique_insiders_selling": 1},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")
        assert result["net_direction"] == "selling"

    @pytest.mark.asyncio
    async def test_net_direction_neutral(self, client):
        """get_insider_summary returns 'neutral' when net_shares = 0."""
        data = {
            "symbol": "AAPL",
            "transactions": [],
            "summary": {"net_shares": 0, "net_value": 0,
                         "total_buys": 0, "total_sells": 0,
                         "total_buy_value": 0, "total_sell_value": 0,
                         "unique_insiders_buying": 0, "unique_insiders_selling": 0},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")
        assert result["net_direction"] == "neutral"

    @pytest.mark.asyncio
    async def test_includes_top_3_notable_transactions(self, client):
        """get_insider_summary includes top 3 notable transactions by value."""
        txns = [
            {"insider_name": "A", "transaction_type": "buy",
             "shares": 100, "total_value": 1000, "transaction_date": "2025-01-01"},
            {"insider_name": "B", "transaction_type": "sell",
             "shares": 200, "total_value": 5000, "transaction_date": "2025-01-02"},
            {"insider_name": "C", "transaction_type": "buy",
             "shares": 50, "total_value": 500, "transaction_date": "2025-01-03"},
            {"insider_name": "D", "transaction_type": "buy",
             "shares": 300, "total_value": 15000, "transaction_date": "2025-01-04"},
            {"insider_name": "E", "transaction_type": "sell",
             "shares": 150, "total_value": 7500, "transaction_date": "2025-01-05"},
        ]
        data = {
            "symbol": "AAPL",
            "transactions": txns,
            "summary": {"net_shares": 100, "net_value": 4000,
                         "total_buys": 3, "total_sells": 2,
                         "total_buy_value": 16500, "total_sell_value": 12500,
                         "unique_insiders_buying": 3, "unique_insiders_selling": 2},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")

        notable = result["notable_transactions"]
        assert len(notable) == 3
        # Should be sorted by abs(total_value) descending: D(15000), E(7500), B(5000)
        assert notable[0]["insider_name"] == "D"
        assert notable[1]["insider_name"] == "E"
        assert notable[2]["insider_name"] == "B"

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, client):
        """get_insider_summary returns None when get_insider_transactions returns None."""
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=None):
            result = await client.get_insider_summary("INVALID")
        assert result is None

    @pytest.mark.asyncio
    async def test_tags_with_metadata(self, client):
        """get_insider_summary tags result with _source and _fetched_at."""
        data = {
            "symbol": "AAPL",
            "transactions": [],
            "summary": {"net_shares": 0, "net_value": 0,
                         "total_buys": 0, "total_sells": 0,
                         "total_buy_value": 0, "total_sell_value": 0,
                         "unique_insiders_buying": 0, "unique_insiders_selling": 0},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")

        assert result["_source"] == "edgar"
        assert "_fetched_at" in result

    @pytest.mark.asyncio
    async def test_notable_excludes_none_total_value(self, client):
        """get_insider_summary excludes transactions with None total_value from notable."""
        txns = [
            {"insider_name": "A", "transaction_type": "buy",
             "shares": 100, "total_value": None, "transaction_date": "2025-01-01"},
            {"insider_name": "B", "transaction_type": "sell",
             "shares": 200, "total_value": 5000, "transaction_date": "2025-01-02"},
        ]
        data = {
            "symbol": "AAPL",
            "transactions": txns,
            "summary": {"net_shares": -100, "net_value": -5000,
                         "total_buys": 1, "total_sells": 1,
                         "total_buy_value": 0, "total_sell_value": 5000,
                         "unique_insiders_buying": 1, "unique_insiders_selling": 1},
            "_cached": False,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")

        notable = result["notable_transactions"]
        assert len(notable) == 1
        assert notable[0]["insider_name"] == "B"


# ===================================================================
# 13. Singleton Functions
# ===================================================================
class TestSingletonFunctions:
    """Tests for get_ownership_client() and close_ownership_client()."""

    def test_get_ownership_client_creates_singleton(self, mock_settings):
        """get_ownership_client() creates a new EdgarOwnershipClient on first call."""
        assert mod._client is None
        with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
            c = get_ownership_client()
        assert isinstance(c, EdgarOwnershipClient)
        assert mod._client is c

    def test_get_ownership_client_returns_same_instance(self, mock_settings):
        """get_ownership_client() returns the same singleton on repeated calls."""
        with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
            first = get_ownership_client()
            second = get_ownership_client()
        assert first is second

    @pytest.mark.asyncio
    async def test_close_ownership_client_clears_singleton(self, mock_settings):
        """close_ownership_client() closes and clears the singleton."""
        with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
            _ = get_ownership_client()
        assert mod._client is not None
        await close_ownership_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_close_ownership_client_noop_when_none(self):
        """close_ownership_client() is a no-op when _client is None."""
        assert mod._client is None
        await close_ownership_client()
        assert mod._client is None

    @pytest.mark.asyncio
    async def test_new_instance_after_close(self, mock_settings):
        """After close, get_ownership_client creates a new instance."""
        with patch("app.data.edgar_ownership.get_settings", return_value=mock_settings):
            first = get_ownership_client()
            await close_ownership_client()
            second = get_ownership_client()
        assert first is not second
        assert isinstance(second, EdgarOwnershipClient)


# ===================================================================
# 14. _get_company_obj
# ===================================================================
class TestGetCompanyObj:
    """Tests for EdgarOwnershipClient._get_company_obj."""

    @pytest.mark.asyncio
    async def test_returns_company_on_success(self, client):
        """_get_company_obj returns a Company object on success."""
        mock_company = MagicMock()
        mock_company.not_found = False

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=mock_company):
                result = await client._get_company_obj("AAPL")

        assert result is mock_company

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, client):
        """_get_company_obj returns None when company.not_found is True."""
        mock_company = MagicMock()
        mock_company.not_found = True

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=mock_company):
                result = await client._get_company_obj("INVALID")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_to_thread_returns_none(self, client):
        """_get_company_obj returns None when to_thread returns None."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=None):
                result = await client._get_company_obj("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """_get_company_obj returns None on exception."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", side_effect=Exception("network error")):
                result = await client._get_company_obj("AAPL")

        assert result is None


# ===================================================================
# 15. _parse_form4_filing
# ===================================================================
class TestParseForm4Filing:
    """Tests for EdgarOwnershipClient._parse_form4_filing."""

    @pytest.mark.asyncio
    async def test_returns_parsed_dict(self, client):
        """_parse_form4_filing returns parsed dict on success."""
        parsed = {
            "insider_name": "CEO",
            "insider_title": "CEO",
            "transactions": [
                {"transaction_type": "buy", "shares": 100},
            ],
        }

        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", return_value=parsed):
                filing = MagicMock()
                result = await client._parse_form4_filing(filing)

        assert result is not None
        assert result["insider_name"] == "CEO"

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, client):
        """_parse_form4_filing returns None on exception."""
        with patch("app.data.edgar_ownership._wait_for_edgar_rate_limit", new_callable=AsyncMock):
            with patch("app.data.edgar_ownership.asyncio.to_thread", side_effect=Exception("parse fail")):
                filing = MagicMock()
                result = await client._parse_form4_filing(filing)

        assert result is None


# ===================================================================
# 16. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Edge cases and cross-cutting concerns."""

    @pytest.mark.asyncio
    async def test_get_institutional_holders_uppercases_symbol(self, client):
        """get_institutional_holders uppercases the symbol."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"holder_name": "Fund", "shares": 100, "value_usd": 10000,
             "change_shares": 0, "change_percent": 0.0,
             "filing_date": "2025-01-10", "report_period": "2024-12-31",
             "fetched_at": now_str},
        ]

        with patch("app.data.edgar_ownership.get_cached_holders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_institutional_holders("aapl")

        assert result["symbol"] == "AAPL"

    @pytest.mark.asyncio
    async def test_get_insider_transactions_uppercases_symbol(self, client):
        """get_insider_transactions uppercases the symbol."""
        now_str = datetime.now(timezone.utc).isoformat()
        cached_rows = [
            {"insider_name": "CEO", "insider_title": "CEO",
             "transaction_type": "buy", "shares": 100,
             "price_per_share": 50.0, "total_value": 5000.0,
             "shares_owned_after": 1000,
             "transaction_date": "2025-01-10", "filing_date": "2025-01-12",
             "fetched_at": now_str},
        ]

        with patch("app.data.edgar_ownership.get_cached_insiders", new_callable=AsyncMock, return_value=cached_rows):
            result = await client.get_insider_transactions("aapl")

        assert result["symbol"] == "AAPL"

    def test_tag_with_non_dict_non_list(self):
        """tag() with a non-dict/non-list returns data unchanged."""
        result = tag("just a string")
        assert result == "just a string"

    def test_build_holders_response_sorts_descending(self):
        """build_holders_response sorts holders by shares descending."""
        holders = [
            {"holder_name": "Small", "shares": 10},
            {"holder_name": "Big", "shares": 1000},
            {"holder_name": "Medium", "shares": 500},
        ]
        result = build_holders_response("AAPL", holders)
        shares_order = [h["shares"] for h in result["holders"]]
        assert shares_order == [1000, 500, 10]

    @pytest.mark.asyncio
    async def test_get_cached_insiders_uses_correct_cutoff(self, mock_db):
        """get_cached_insiders computes cutoff correctly based on days parameter."""
        mock_db.fetch_all.return_value = []
        with patch("app.data.edgar_ownership_helpers.get_database", return_value=mock_db):
            await get_cached_insiders("AAPL", 30)

        call_args = mock_db.fetch_all.call_args[0]
        # Second param is the cutoff date string
        cutoff_str = call_args[1][1]
        cutoff_dt = datetime.strptime(cutoff_str, "%Y-%m-%d")
        now = datetime.now(timezone.utc)
        diff = now - cutoff_dt.replace(tzinfo=timezone.utc)
        # Should be approximately 30 days
        assert 28 <= diff.days <= 32

    @pytest.mark.asyncio
    async def test_get_insider_summary_preserves_cached_flag(self, client):
        """get_insider_summary preserves the _cached flag from get_insider_transactions."""
        data = {
            "symbol": "AAPL",
            "transactions": [],
            "summary": {"net_shares": 0, "net_value": 0,
                         "total_buys": 0, "total_sells": 0,
                         "total_buy_value": 0, "total_sell_value": 0,
                         "unique_insiders_buying": 0, "unique_insiders_selling": 0},
            "_cached": True,
        }
        with patch.object(client, "get_insider_transactions", new_callable=AsyncMock, return_value=data):
            result = await client.get_insider_summary("AAPL")

        assert result["_cached"] is True

    def test_build_insider_response_unique_insiders(self):
        """build_insider_response correctly counts unique insider names."""
        transactions = [
            {"insider_name": "CEO", "transaction_type": "buy", "shares": 100, "total_value": 5000},
            {"insider_name": "CEO", "transaction_type": "buy", "shares": 200, "total_value": 10000},
            {"insider_name": "CFO", "transaction_type": "sell", "shares": 50, "total_value": 2500},
            {"insider_name": "CFO", "transaction_type": "sell", "shares": 75, "total_value": 3750},
        ]
        result = build_insider_response("AAPL", transactions)
        assert result["summary"]["unique_insiders_buying"] == 1
        assert result["summary"]["unique_insiders_selling"] == 1
