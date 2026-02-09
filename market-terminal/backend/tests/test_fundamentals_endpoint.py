"""Tests for TASK-API-004: Fundamentals endpoint at /api/fundamentals/{symbol}.

Validates symbol validation, non-equity rejection, response structure,
TTM computation, quarterly array, data-source fallback, error handling,
Finnhub-only mode, edge cases, and company info resolution.

Run with: ``pytest tests/test_fundamentals_endpoint.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Mock data factories
# ---------------------------------------------------------------------------

def _make_income_data(quarters: int = 12) -> list[dict]:
    """Return a list of quarterly income records with realistic data.

    Most-recent quarter first.  Revenue scales ~$90-100B/Q to resemble AAPL.
    """
    base_revenue = 100_000_000_000
    base_ni = 25_000_000_000
    base_eps = 1.60
    records = []
    for i in range(quarters):
        year = 2026 - (i // 4)
        quarter = 4 - (i % 4)
        period = f"Q{quarter} {year}"
        rev = base_revenue - (i * 2_000_000_000)
        ni = base_ni - (i * 500_000_000)
        eps = round(base_eps - (i * 0.04), 2)
        prev_rev = base_revenue - ((i + 4) * 2_000_000_000) if i + 4 < quarters else None
        prev_eps = round(base_eps - ((i + 4) * 0.04), 2) if i + 4 < quarters else None
        records.append({
            "period": period,
            "revenue": rev,
            "net_income": ni,
            "eps_diluted": eps,
            "gross_margin": 0.45 - (i * 0.002),
            "operating_margin": 0.30 - (i * 0.001),
            "net_margin": round(ni / rev, 6) if rev else None,
            "revenue_growth_yoy": round((rev - prev_rev) / abs(prev_rev), 6) if prev_rev else None,
            "eps_growth_yoy": round((eps - prev_eps) / abs(prev_eps), 6) if prev_eps else None,
            "_fetched_at": f"{year}-{quarter * 3:02d}-15T12:00:00Z",
        })
    return records


def _make_balance_data(periods: int = 4) -> list[dict]:
    """Return a list of balance sheet records, most-recent first."""
    records = []
    for i in range(periods):
        records.append({
            "total_assets": 350_000_000_000 - (i * 5_000_000_000),
            "total_liabilities": 250_000_000_000 - (i * 3_000_000_000),
            "total_equity": 100_000_000_000 - (i * 2_000_000_000),
            "total_debt": 110_000_000_000 - (i * 1_000_000_000),
            "debt_to_equity": 1.10 + (i * 0.02),
        })
    return records


def _make_cash_flow_data(periods: int = 4) -> list[dict]:
    """Return a list of cash flow records, most-recent first."""
    records = []
    for i in range(periods):
        ocf = 28_000_000_000 - (i * 500_000_000)
        capex = -3_500_000_000 + (i * 100_000_000)
        records.append({
            "operating_cash_flow": ocf,
            "capital_expenditures": capex,
            "free_cash_flow": ocf + capex,
        })
    return records


def _make_company_info(cik: str = "0000320193", name: str = "Apple Inc.", ticker: str = "AAPL") -> dict:
    """Return a company info dict as returned by EdgarClient.get_company()."""
    return {"cik": cik, "name": name, "ticker": ticker}


def _make_market_data(
    pe_ratio: float = 28.5,
    market_cap: float = 2900.0,
    dividend_yield: float = 0.55,
    eps: float = 6.50,
) -> dict:
    """Return Finnhub basic financials. market_cap in millions, dividend_yield in %."""
    return {
        "pe_ratio": pe_ratio,
        "market_cap": market_cap,
        "dividend_yield": dividend_yield,
        "eps": eps,
    }


def _make_profile_data(name: str = "Apple Inc", shares_m: float = 15_500.0) -> dict:
    """Return Finnhub company profile.  ``shares_m`` is shareOutstanding in millions."""
    return {"name": name, "shareOutstanding": shares_m}


# ---------------------------------------------------------------------------
# Patch helper
# ---------------------------------------------------------------------------

def _patch_fundamentals(
    income=None,
    balance=None,
    cash_flow=None,
    company=None,
    market=None,
    profile=None,
    income_raises=False,
    balance_raises=False,
    cash_flow_raises=False,
    company_raises=False,
    market_raises=False,
    profile_raises=False,
):
    """Return (edgar_patcher, finnhub_patcher) context managers.

    All EDGAR and Finnhub calls are mocked.  By default every call returns
    the value passed (or None).  Set ``*_raises=True`` to make the call
    raise an Exception.
    """
    edgar_mock = MagicMock()
    if income_raises:
        edgar_mock.get_eps_history = AsyncMock(side_effect=Exception("edgar income error"))
    else:
        edgar_mock.get_eps_history = AsyncMock(return_value=income)

    if balance_raises:
        edgar_mock.get_balance_sheet = AsyncMock(side_effect=Exception("edgar balance error"))
    else:
        edgar_mock.get_balance_sheet = AsyncMock(return_value=balance)

    if cash_flow_raises:
        edgar_mock.get_cash_flow = AsyncMock(side_effect=Exception("edgar cash flow error"))
    else:
        edgar_mock.get_cash_flow = AsyncMock(return_value=cash_flow)

    if company_raises:
        edgar_mock.get_company = AsyncMock(side_effect=Exception("edgar company error"))
    else:
        edgar_mock.get_company = AsyncMock(return_value=company)

    finnhub_mock = MagicMock()
    if market_raises:
        finnhub_mock.get_basic_financials = AsyncMock(side_effect=Exception("finnhub financials error"))
    else:
        finnhub_mock.get_basic_financials = AsyncMock(return_value=market)

    if profile_raises:
        finnhub_mock.get_company_profile = AsyncMock(side_effect=Exception("finnhub profile error"))
    else:
        finnhub_mock.get_company_profile = AsyncMock(return_value=profile)

    ep = patch("app.api.routes.fundamentals.get_edgar_client", return_value=edgar_mock)
    fp = patch("app.api.routes.fundamentals.get_finnhub_client", return_value=finnhub_mock)
    return ep, fp


def _get(symbol: str) -> object:
    """Shorthand for GET /api/fundamentals/{symbol}."""
    return client.get(f"/api/fundamentals/{symbol}")


# ===================================================================
# 1. Symbol Validation (14 tests)
# ===================================================================
class TestSymbolValidation:
    """Verify symbol validation: stripping, uppercasing, regex, 400 errors."""

    @pytest.mark.parametrize(
        "symbol",
        ["AAPL", "MSFT", "GOOG", "X", "A", "Z"],
        ids=["aapl", "msft", "goog", "single-X", "single-A", "single-Z"],
    )
    def test_valid_simple_symbols_return_200(self, symbol):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get(symbol)
        assert resp.status_code == 200

    def test_valid_symbol_brk_dot_b(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("BRK.B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.B"

    def test_valid_symbol_with_digits(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("BRK2")
        assert resp.status_code == 200

    def test_valid_symbol_ten_chars_max(self):
        """10-character alphanumeric symbol is at the boundary."""
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("ABCDEFGHIJ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "ABCDEFGHIJ"

    def test_case_normalization_lowercase(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("aapl")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_case_normalization_mixed(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("aApL")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping_spaces(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get(" AAPL ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_url_encoded(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = client.get("/api/fundamentals/%20MSFT%20")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "MSFT"

    def test_invalid_empty_string(self):
        """Empty symbol -> 404 because FastAPI route /{symbol} requires non-empty."""
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("")
        assert resp.status_code == 404

    def test_invalid_spaces_only(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("   ")
        assert resp.status_code == 400

    def test_invalid_special_chars_exclamation(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("!!!")
        assert resp.status_code == 400

    def test_invalid_special_chars_dollar(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("$AAPL")
        assert resp.status_code == 400

    def test_invalid_too_long_eleven_chars(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("ABCDEFGHIJK")
        assert resp.status_code == 400

    def test_400_body_has_error_detail(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("!!!")
        body = resp.json()
        assert body["error"] == "Invalid ticker symbol"


# ===================================================================
# 2. Non-Equity Rejection (14 tests)
# ===================================================================
class TestNonEquityRejection:
    """Verify that crypto symbols return 404."""

    @pytest.mark.parametrize(
        "symbol",
        ["BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD"],
        ids=["btc-usd", "eth-usd", "sol-usd", "doge-usd"],
    )
    def test_crypto_usd_suffix_rejected(self, symbol):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get(symbol)
        assert resp.status_code == 404

    def test_crypto_usdt_suffix_rejected(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("ETH-USDT")
        assert resp.status_code == 404

    def test_crypto_btc_suffix_rejected(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("DOGE-BTC")
        assert resp.status_code == 404

    def test_crypto_eth_suffix_rejected(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("SHIB-ETH")
        assert resp.status_code == 404

    def test_long_dash_symbol_rejected(self):
        """6+ char symbol with dash and len > 5 is treated as non-equity."""
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("DOGEEE-X")
        assert resp.status_code == 404

    def test_short_dash_symbol_accepted(self):
        """BF-B has a dash but len <= 5, so is allowed through."""
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("BF-B")
        assert resp.status_code == 200

    def test_rejection_error_detail_structure(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = _get("BTC-USD")
        body = resp.json()
        error = body.get("error", {})
        assert isinstance(error, dict)
        assert error["error"] == "Fundamental data not available for this asset type"
        assert error["symbol"] == "BTC-USD"


# ===================================================================
# 3. Response Structure (14 tests)
# ===================================================================
class TestResponseStructure:
    """Verify the shape and content of a successful response."""

    def _happy_response(self):
        income = _make_income_data(4)
        balance = _make_balance_data()
        cash_flow = _make_cash_flow_data()
        company = _make_company_info()
        market = _make_market_data()
        profile = _make_profile_data()
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, cash_flow=cash_flow,
            company=company, market=market, profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        return resp.json()

    def test_top_level_keys_present(self):
        body = self._happy_response()
        required = {"symbol", "company_name", "cik", "ttm", "quarterly",
                     "next_earnings_date", "data_sources", "data_timestamp"}
        assert required.issubset(set(body.keys()))

    def test_symbol_is_uppercase(self):
        body = self._happy_response()
        assert body["symbol"] == "AAPL"

    def test_company_name_present(self):
        body = self._happy_response()
        assert body["company_name"] == "Apple Inc."

    def test_cik_present(self):
        body = self._happy_response()
        assert body["cik"] == "0000320193"

    def test_ttm_is_dict(self):
        body = self._happy_response()
        assert isinstance(body["ttm"], dict)

    def test_quarterly_is_list(self):
        body = self._happy_response()
        assert isinstance(body["quarterly"], list)

    def test_data_sources_is_dict(self):
        body = self._happy_response()
        assert isinstance(body["data_sources"], dict)

    def test_data_sources_financials_key(self):
        body = self._happy_response()
        assert body["data_sources"]["financials"] == "edgar"

    def test_data_sources_market_data_key(self):
        body = self._happy_response()
        assert body["data_sources"]["market_data"] == "finnhub"

    def test_data_timestamp_is_string(self):
        body = self._happy_response()
        assert isinstance(body["data_timestamp"], str)
        assert "T" in body["data_timestamp"]

    def test_no_note_field_with_edgar_data(self):
        """When EDGAR data is present, no 'note' field in response."""
        body = self._happy_response()
        assert "note" not in body

    def test_ttm_has_all_expected_keys(self):
        body = self._happy_response()
        expected = {
            "revenue", "net_income", "eps_diluted", "gross_margin",
            "operating_margin", "net_margin", "pe_ratio", "market_cap",
            "shares_outstanding", "free_cash_flow", "debt_to_equity",
            "return_on_equity", "dividend_yield",
        }
        assert expected.issubset(set(body["ttm"].keys()))

    def test_quarterly_item_has_expected_keys(self):
        body = self._happy_response()
        assert len(body["quarterly"]) > 0
        item = body["quarterly"][0]
        expected = {
            "period", "filing_date", "filing_type", "revenue", "net_income",
            "eps_diluted", "gross_margin", "operating_margin", "net_margin",
            "revenue_growth_yoy", "eps_growth_yoy",
        }
        assert expected.issubset(set(item.keys()))

    def test_response_content_type_json(self):
        income = _make_income_data(4)
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=income, market=market)
        with ep, fp:
            resp = _get("AAPL")
        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 4. TTM Computation (18 tests)
# ===================================================================
class TestTTMComputation:
    """Verify trailing twelve months aggregation logic."""

    def _get_ttm(self, income=None, balance=None, cash_flow=None, market=None, profile=None):
        if income is None:
            income = _make_income_data(4)
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, cash_flow=cash_flow,
            market=market, profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        return resp.json()["ttm"]

    def test_revenue_is_sum_of_four_quarters(self):
        income = _make_income_data(4)
        expected_sum = sum(q["revenue"] for q in income[:4])
        ttm = self._get_ttm(income=income)
        assert ttm["revenue"] == int(expected_sum)

    def test_net_income_is_sum_of_four_quarters(self):
        income = _make_income_data(4)
        expected_sum = sum(q["net_income"] for q in income[:4])
        ttm = self._get_ttm(income=income)
        assert ttm["net_income"] == int(expected_sum)

    def test_eps_is_sum_of_four_quarters(self):
        income = _make_income_data(4)
        expected_sum = round(sum(q["eps_diluted"] for q in income[:4]), 2)
        ttm = self._get_ttm(income=income)
        assert ttm["eps_diluted"] == expected_sum

    def test_fcf_is_sum_of_four_quarters(self):
        income = _make_income_data(4)
        cash_flow = _make_cash_flow_data(4)
        expected_sum = sum(q["free_cash_flow"] for q in cash_flow[:4])
        ttm = self._get_ttm(income=income, cash_flow=cash_flow)
        assert ttm["free_cash_flow"] == int(expected_sum)

    def test_gross_margin_from_latest_quarter(self):
        income = _make_income_data(4)
        ttm = self._get_ttm(income=income)
        assert ttm["gross_margin"] == income[0]["gross_margin"]

    def test_operating_margin_from_latest_quarter(self):
        income = _make_income_data(4)
        ttm = self._get_ttm(income=income)
        assert ttm["operating_margin"] == income[0]["operating_margin"]

    def test_net_margin_from_latest_quarter(self):
        """net_margin comes from the latest quarter (point-in-time)."""
        income = _make_income_data(4)
        ttm = self._get_ttm(income=income)
        assert ttm["net_margin"] == income[0]["net_margin"]

    def test_pe_ratio_from_finnhub(self):
        market = _make_market_data(pe_ratio=30.0)
        ttm = self._get_ttm(market=market)
        assert ttm["pe_ratio"] == 30.0

    def test_market_cap_converted_from_millions(self):
        """Finnhub market_cap is in millions; TTM should be full value."""
        market = _make_market_data(market_cap=2900.0)
        ttm = self._get_ttm(market=market)
        assert ttm["market_cap"] == 2_900_000_000

    def test_dividend_yield_converted_from_percentage(self):
        """Finnhub dividend_yield is in percentage; TTM should be decimal."""
        market = _make_market_data(dividend_yield=2.5)
        ttm = self._get_ttm(market=market)
        assert ttm["dividend_yield"] == round(2.5 / 100, 6)

    def test_debt_to_equity_from_balance_sheet(self):
        balance = _make_balance_data(1)
        ttm = self._get_ttm(balance=balance)
        assert ttm["debt_to_equity"] == balance[0]["debt_to_equity"]

    def test_return_on_equity_computed(self):
        """ROE = TTM net_income / latest equity."""
        income = _make_income_data(4)
        balance = _make_balance_data(1)
        total_ni = sum(q["net_income"] for q in income[:4])
        equity = balance[0]["total_equity"]
        expected_roe = round(total_ni / equity, 6)
        ttm = self._get_ttm(income=income, balance=balance)
        assert ttm["return_on_equity"] == expected_roe

    def test_shares_outstanding_from_profile(self):
        """Shares come from Finnhub profile (shareOutstanding in millions)."""
        profile = _make_profile_data(shares_m=15_500.0)
        ttm = self._get_ttm(profile=profile, market=_make_market_data())
        assert ttm["shares_outstanding"] == int(15_500.0 * 1_000_000)

    def test_shares_outstanding_fallback_to_derivation(self):
        """Without profile, shares derived from net_income / eps."""
        income = _make_income_data(4)
        total_ni = sum(q["net_income"] for q in income[:4])
        total_eps = sum(q["eps_diluted"] for q in income[:4])
        ttm = self._get_ttm(income=income, profile=None)
        expected_shares = int(abs(total_ni / total_eps))
        assert ttm["shares_outstanding"] == expected_shares

    def test_no_market_data_pe_is_none(self):
        ttm = self._get_ttm(market=None)
        assert ttm["pe_ratio"] is None

    def test_no_market_data_market_cap_is_none(self):
        ttm = self._get_ttm(market=None)
        assert ttm["market_cap"] is None

    def test_no_market_data_dividend_yield_is_none(self):
        ttm = self._get_ttm(market=None)
        assert ttm["dividend_yield"] is None

    def test_no_balance_data_debt_to_equity_is_none(self):
        ttm = self._get_ttm(balance=None)
        assert ttm["debt_to_equity"] is None

    def test_no_balance_data_roe_is_none(self):
        ttm = self._get_ttm(balance=None)
        assert ttm["return_on_equity"] is None


# ===================================================================
# 5. Quarterly Array (12 tests)
# ===================================================================
class TestQuarterlyArray:
    """Verify quarterly array structure, count, ordering, and content."""

    def _get_quarterly(self, income=None, cash_flow=None, market=None):
        if income is None:
            income = _make_income_data(8)
        ep, fp = _patch_fundamentals(
            income=income, cash_flow=cash_flow, market=market,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        return resp.json()["quarterly"]

    def test_max_four_quarters(self):
        """Even if 12 quarters of income data, only 4 are returned."""
        income = _make_income_data(12)
        q = self._get_quarterly(income=income)
        assert len(q) == 4

    def test_count_with_fewer_quarters(self):
        income = _make_income_data(2)
        q = self._get_quarterly(income=income)
        assert len(q) == 2

    def test_count_with_single_quarter(self):
        income = _make_income_data(1)
        q = self._get_quarterly(income=income)
        assert len(q) == 1

    def test_ordering_most_recent_first(self):
        income = _make_income_data(4)
        q = self._get_quarterly(income=income)
        # Income data is already most-recent first, so order should match
        assert q[0]["period"] == income[0]["period"]
        assert q[-1]["period"] == income[3]["period"]

    def test_revenue_present_in_each_quarter(self):
        q = self._get_quarterly()
        for item in q:
            assert "revenue" in item

    def test_net_income_present_in_each_quarter(self):
        q = self._get_quarterly()
        for item in q:
            assert "net_income" in item

    def test_eps_diluted_present_in_each_quarter(self):
        q = self._get_quarterly()
        for item in q:
            assert "eps_diluted" in item

    def test_fcf_from_cash_flow(self):
        income = _make_income_data(4)
        cash_flow = _make_cash_flow_data(4)
        q = self._get_quarterly(income=income, cash_flow=cash_flow)
        for i, item in enumerate(q):
            assert item["free_cash_flow"] == cash_flow[i]["free_cash_flow"]

    def test_fcf_none_when_no_cash_flow(self):
        income = _make_income_data(4)
        q = self._get_quarterly(income=income, cash_flow=None)
        for item in q:
            assert "free_cash_flow" not in item or item.get("free_cash_flow") is None

    def test_yoy_growth_rates_present(self):
        income = _make_income_data(8)
        q = self._get_quarterly(income=income)
        # First quarter has yoy data since we have 8 quarters of income
        assert "revenue_growth_yoy" in q[0]
        assert "eps_growth_yoy" in q[0]

    def test_filing_type_is_10q(self):
        q = self._get_quarterly()
        for item in q:
            assert item["filing_type"] == "10-Q"

    def test_period_field_present(self):
        q = self._get_quarterly()
        for item in q:
            assert item["period"] is not None
            assert isinstance(item["period"], str)


# ===================================================================
# 6. Data Source Fallback (14 tests)
# ===================================================================
class TestDataSourceFallback:
    """Verify behavior with different data source combinations."""

    def test_edgar_only_200(self):
        """EDGAR data but no Finnhub returns 200."""
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, market=None, profile=None)
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["financials"] == "edgar"
        assert body["data_sources"]["market_data"] == "none"

    def test_finnhub_only_200(self):
        """No EDGAR data but Finnhub market data returns 200."""
        ep, fp = _patch_fundamentals(income=None, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["financials"] == "finnhub"
        assert body["data_sources"]["market_data"] == "finnhub"

    def test_both_sources_200(self):
        income = _make_income_data(4)
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=income, market=market)
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["financials"] == "edgar"
        assert body["data_sources"]["market_data"] == "finnhub"

    def test_neither_source_returns_404(self):
        ep, fp = _patch_fundamentals(income=None, market=None, profile=None)
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 404

    def test_404_error_detail_structure(self):
        ep, fp = _patch_fundamentals(income=None, market=None, profile=None)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        error = body.get("error", {})
        assert isinstance(error, dict)
        assert "No data available for symbol" in error.get("error", "")
        assert error.get("symbol") == "AAPL"

    def test_empty_income_list_treated_as_no_edgar(self):
        """Empty list from get_eps_history means no EDGAR data."""
        ep, fp = _patch_fundamentals(income=[], market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["financials"] == "finnhub"

    def test_edgar_raises_falls_back_to_finnhub(self):
        ep, fp = _patch_fundamentals(
            income_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["financials"] == "finnhub"

    def test_all_edgar_calls_raise_finnhub_fallback(self):
        ep, fp = _patch_fundamentals(
            income_raises=True, balance_raises=True,
            cash_flow_raises=True, company_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_finnhub_raises_edgar_only(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4),
            market_raises=True, profile_raises=True,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["market_data"] == "none"

    def test_profile_only_no_market_data_is_has_finnhub(self):
        """has_finnhub is True if profile_data is not None, even if market_data is None."""
        ep, fp = _patch_fundamentals(
            income=None, market=None, profile=_make_profile_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_all_sources_raise_returns_404(self):
        ep, fp = _patch_fundamentals(
            income_raises=True, balance_raises=True,
            cash_flow_raises=True, company_raises=True,
            market_raises=True, profile_raises=True,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 404

    def test_none_income_none_market_profile_only(self):
        """Profile-only (no market_data, no income) still returns 200."""
        ep, fp = _patch_fundamentals(income=None, market=None, profile=_make_profile_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_income_none_balance_only_no_finnhub_returns_404(self):
        """Balance data alone is not enough (has_edgar checks income)."""
        ep, fp = _patch_fundamentals(
            income=None, balance=_make_balance_data(),
            market=None, profile=None,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 404

    def test_income_empty_balance_present_no_finnhub_returns_404(self):
        """Empty income list with balance data but no Finnhub -> 404."""
        ep, fp = _patch_fundamentals(
            income=[], balance=_make_balance_data(),
            market=None, profile=None,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 404


# ===================================================================
# 7. Error Handling (12 tests)
# ===================================================================
class TestErrorHandling:
    """Verify that all exceptions are caught and don't crash the endpoint."""

    def test_edgar_income_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income_raises=True, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_edgar_balance_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), balance_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["debt_to_equity"] is None

    def test_edgar_cash_flow_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), cash_flow_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_edgar_company_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["company_name"] is None
        assert body["cik"] is None

    def test_finnhub_market_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), market_raises=True,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["pe_ratio"] is None
        assert body["ttm"]["market_cap"] is None

    def test_finnhub_profile_exception_handled(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), profile_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_all_edgar_exceptions_finnhub_ok(self):
        ep, fp = _patch_fundamentals(
            income_raises=True, balance_raises=True,
            cash_flow_raises=True, company_raises=True,
            market=_make_market_data(), profile=_make_profile_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_all_finnhub_exceptions_edgar_ok(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), balance=_make_balance_data(),
            cash_flow=_make_cash_flow_data(),
            company=_make_company_info(),
            market_raises=True, profile_raises=True,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_mixed_failures_edgar_income_and_finnhub_profile(self):
        ep, fp = _patch_fundamentals(
            income_raises=True, profile_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_balance_exception_does_not_affect_quarterly(self):
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(
            income=income, balance_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert len(body["quarterly"]) == 4

    def test_cash_flow_exception_quarterly_still_built(self):
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(
            income=income, cash_flow_raises=True,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert len(body["quarterly"]) == 4

    def test_company_exception_name_fallback_to_profile(self):
        """When EDGAR company raises, name falls back to Finnhub profile."""
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company_raises=True,
            market=_make_market_data(),
            profile=_make_profile_data(name="Apple Inc via Finnhub"),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Apple Inc via Finnhub"


# ===================================================================
# 8. Finnhub-Only Mode (12 tests)
# ===================================================================
class TestFinnhubOnlyMode:
    """Verify behavior when only Finnhub data is available (no EDGAR)."""

    def _finnhub_only_response(self, market=None, profile=None):
        if market is None:
            market = _make_market_data()
        ep, fp = _patch_fundamentals(income=None, market=market, profile=profile)
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        return resp.json()

    def test_note_field_present(self):
        body = self._finnhub_only_response()
        assert "note" in body
        assert "No SEC filings found" in body["note"]

    def test_quarterly_is_empty(self):
        body = self._finnhub_only_response()
        assert body["quarterly"] == []

    def test_data_sources_financials_is_finnhub(self):
        body = self._finnhub_only_response()
        assert body["data_sources"]["financials"] == "finnhub"

    def test_data_sources_market_data_is_finnhub(self):
        body = self._finnhub_only_response()
        assert body["data_sources"]["market_data"] == "finnhub"

    def test_ttm_pe_ratio_from_market(self):
        market = _make_market_data(pe_ratio=25.0)
        body = self._finnhub_only_response(market=market)
        assert body["ttm"]["pe_ratio"] == 25.0

    def test_ttm_eps_from_market(self):
        market = _make_market_data(eps=7.50)
        body = self._finnhub_only_response(market=market)
        assert body["ttm"]["eps_diluted"] == 7.50

    def test_ttm_market_cap_converted(self):
        market = _make_market_data(market_cap=3000.0)
        body = self._finnhub_only_response(market=market)
        assert body["ttm"]["market_cap"] == 3_000_000_000

    def test_ttm_dividend_yield_converted(self):
        market = _make_market_data(dividend_yield=1.5)
        body = self._finnhub_only_response(market=market)
        assert body["ttm"]["dividend_yield"] == round(1.5 / 100, 6)

    def test_ttm_revenue_is_none(self):
        body = self._finnhub_only_response()
        assert body["ttm"]["revenue"] is None

    def test_ttm_net_income_is_none(self):
        body = self._finnhub_only_response()
        assert body["ttm"]["net_income"] is None

    def test_ttm_fcf_is_none(self):
        body = self._finnhub_only_response()
        assert body["ttm"]["free_cash_flow"] is None

    def test_ttm_shares_outstanding_is_none(self):
        body = self._finnhub_only_response()
        assert body["ttm"]["shares_outstanding"] is None


# ===================================================================
# 9. Edge Cases (14 tests)
# ===================================================================
class TestEdgeCases:
    """Verify edge cases and boundary conditions."""

    def test_none_revenue_in_quarters(self):
        """If all quarter revenues are None, TTM revenue is None."""
        income = [{"period": f"Q{i}", "revenue": None, "net_income": None,
                    "eps_diluted": None, "gross_margin": None,
                    "operating_margin": None, "net_margin": None}
                   for i in range(4)]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["revenue"] is None

    def test_mixed_none_and_value_revenue(self):
        """If some quarters have None revenue, sum only non-None values."""
        income = [
            {"period": "Q4 2026", "revenue": 100_000, "net_income": 10_000,
             "eps_diluted": 1.0, "gross_margin": 0.5, "operating_margin": 0.3,
             "net_margin": 0.1},
            {"period": "Q3 2026", "revenue": None, "net_income": None,
             "eps_diluted": None, "gross_margin": None,
             "operating_margin": None, "net_margin": None},
            {"period": "Q2 2026", "revenue": 200_000, "net_income": 20_000,
             "eps_diluted": 2.0, "gross_margin": 0.4, "operating_margin": 0.2,
             "net_margin": 0.1},
            {"period": "Q1 2026", "revenue": None, "net_income": None,
             "eps_diluted": None, "gross_margin": None,
             "operating_margin": None, "net_margin": None},
        ]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        # _safe_sum should sum 100_000 + 200_000
        assert body["ttm"]["revenue"] == 300_000

    def test_zero_revenue_division_safe(self):
        """Zero total revenue should not crash net_margin calculation."""
        income = [
            {"period": f"Q{i}", "revenue": 0, "net_income": 0,
             "eps_diluted": 0, "gross_margin": 0, "operating_margin": 0,
             "net_margin": 0}
            for i in range(4)
        ]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        # net_margin is point-in-time from latest quarter (which has net_margin=0)
        assert body["ttm"]["net_margin"] == 0

    def test_zero_equity_roe_safe(self):
        """Zero equity should not crash ROE calculation."""
        income = _make_income_data(4)
        balance = [{"total_assets": 100, "total_liabilities": 100,
                     "total_equity": 0, "total_debt": 50, "debt_to_equity": None}]
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["return_on_equity"] is None

    def test_negative_margins(self):
        """Negative margins from a loss-making quarter are preserved."""
        income = [
            {"period": "Q4 2026", "revenue": 100_000, "net_income": -50_000,
             "eps_diluted": -0.50, "gross_margin": -0.10,
             "operating_margin": -0.25, "net_margin": -0.50,
             "revenue_growth_yoy": None, "eps_growth_yoy": None}
        ]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["gross_margin"] == -0.10
        assert body["quarterly"][0]["gross_margin"] == -0.10

    def test_zero_eps_shares_derivation_fallback(self):
        """Zero EPS with no profile should not crash shares derivation."""
        income = [
            {"period": f"Q{i}", "revenue": 100_000, "net_income": 0,
             "eps_diluted": 0, "gross_margin": 0.5, "operating_margin": 0.3,
             "net_margin": 0}
            for i in range(4)
        ]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data(), profile=None)
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        # eps == 0 prevents derivation; no profile -> shares = None
        assert body["ttm"]["shares_outstanding"] is None

    def test_single_quarter_ttm(self):
        """TTM with only 1 quarter still works."""
        income = _make_income_data(1)
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["revenue"] == int(income[0]["revenue"])

    def test_empty_cash_flow_list_quarterly_no_fcf(self):
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, cash_flow=[], market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200

    def test_empty_balance_list_no_debt_to_equity(self):
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, balance=[], market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["debt_to_equity"] is None

    def test_post_method_not_allowed(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = client.post("/api/fundamentals/AAPL")
        assert resp.status_code == 405

    def test_put_method_not_allowed(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = client.put("/api/fundamentals/AAPL")
        assert resp.status_code == 405

    def test_delete_method_not_allowed(self):
        ep, fp = _patch_fundamentals()
        with ep, fp:
            resp = client.delete("/api/fundamentals/AAPL")
        assert resp.status_code == 405

    def test_single_char_symbol(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("X")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "X"

    def test_numeric_only_symbol(self):
        ep, fp = _patch_fundamentals(income=_make_income_data(4), market=_make_market_data())
        with ep, fp:
            resp = _get("123")
        assert resp.status_code == 200


# ===================================================================
# 10. Company Info (10 tests)
# ===================================================================
class TestCompanyInfo:
    """Verify company name and CIK resolution from EDGAR and Finnhub."""

    def test_name_from_edgar_company(self):
        company = _make_company_info(name="Apple Inc.")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Apple Inc."

    def test_cik_from_edgar_company(self):
        company = _make_company_info(cik="0000320193")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["cik"] == "0000320193"

    def test_name_fallback_to_finnhub_profile(self):
        """If EDGAR company has no name, fall back to Finnhub profile name."""
        company = {"cik": "123", "name": None}
        profile = _make_profile_data(name="Apple via Finnhub")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company,
            market=_make_market_data(), profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Apple via Finnhub"

    def test_name_fallback_empty_string_from_edgar(self):
        """Empty string from EDGAR name is falsy, triggers fallback."""
        company = {"cik": "123", "name": ""}
        profile = _make_profile_data(name="Fallback Name")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company,
            market=_make_market_data(), profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Fallback Name"

    def test_no_company_info_no_profile_name_is_none(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=None, profile=None,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] is None

    def test_no_company_info_no_profile_cik_is_none(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=None, profile=None,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["cik"] is None

    def test_company_info_raises_name_from_profile(self):
        profile = _make_profile_data(name="Fallback via Profile")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company_raises=True,
            market=_make_market_data(), profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Fallback via Profile"
        assert body["cik"] is None

    def test_both_company_and_profile_none_name_is_none(self):
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=None, profile=None,
            market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] is None

    def test_edgar_name_takes_precedence_over_profile(self):
        """When both EDGAR and profile have names, EDGAR wins."""
        company = _make_company_info(name="Apple Inc. (EDGAR)")
        profile = _make_profile_data(name="Apple Inc. (Finnhub)")
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company,
            market=_make_market_data(), profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] == "Apple Inc. (EDGAR)"

    def test_profile_name_none_company_none_both_none(self):
        """Both sources return None for name."""
        company = {"cik": None, "name": None}
        profile = {"name": None, "shareOutstanding": 0}
        ep, fp = _patch_fundamentals(
            income=_make_income_data(4), company=company,
            market=_make_market_data(), profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["company_name"] is None
        assert body["cik"] is None


# ===================================================================
# 11. Finnhub-Only TTM Specifics (8 tests)
# ===================================================================
class TestFinnhubOnlyTTMSpecifics:
    """Detailed verification of TTM fields in Finnhub-only mode."""

    def test_zero_market_cap_from_finnhub(self):
        """market_cap=0 in Finnhub -> TTM market_cap should be 0."""
        market = _make_market_data(market_cap=0)
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["market_cap"] == 0

    def test_none_market_cap_from_finnhub(self):
        market = {"pe_ratio": 20.0, "market_cap": None, "dividend_yield": None, "eps": None}
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["market_cap"] is None

    def test_none_dividend_yield_from_finnhub(self):
        market = {"pe_ratio": 20.0, "market_cap": 100.0, "dividend_yield": None, "eps": None}
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["dividend_yield"] is None

    def test_zero_dividend_yield_from_finnhub(self):
        """dividend_yield=0 -> TTM dividend_yield should be 0.0 (no dividend)."""
        market = _make_market_data(dividend_yield=0)
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["dividend_yield"] == 0.0

    def test_ttm_gross_margin_none_in_finnhub_only(self):
        body_json = None
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body_json = resp.json()
        assert body_json["ttm"]["gross_margin"] is None

    def test_ttm_operating_margin_none_in_finnhub_only(self):
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["operating_margin"] is None

    def test_ttm_debt_to_equity_none_in_finnhub_only(self):
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["debt_to_equity"] is None

    def test_ttm_roe_none_in_finnhub_only(self):
        market = _make_market_data()
        ep, fp = _patch_fundamentals(income=None, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["return_on_equity"] is None


# ===================================================================
# 12. Combined / Integration-style Tests (10 tests)
# ===================================================================
class TestCombinedScenarios:
    """End-to-end style tests exercising multiple features together."""

    def test_full_happy_path(self):
        """All data sources return data successfully."""
        income = _make_income_data(8)
        balance = _make_balance_data()
        cash_flow = _make_cash_flow_data()
        company = _make_company_info()
        market = _make_market_data()
        profile = _make_profile_data()
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, cash_flow=cash_flow,
            company=company, market=market, profile=profile,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()

        # Top-level
        assert body["symbol"] == "AAPL"
        assert body["company_name"] == "Apple Inc."
        assert body["cik"] == "0000320193"
        assert "note" not in body

        # Quarterly
        assert len(body["quarterly"]) == 4
        for q in body["quarterly"]:
            assert q["revenue"] is not None
            assert q["free_cash_flow"] is not None

        # TTM
        assert body["ttm"]["revenue"] is not None
        assert body["ttm"]["pe_ratio"] == market["pe_ratio"]
        assert body["ttm"]["debt_to_equity"] == balance[0]["debt_to_equity"]

        # Data sources
        assert body["data_sources"]["financials"] == "edgar"
        assert body["data_sources"]["market_data"] == "finnhub"

    def test_edgar_only_no_finnhub(self):
        """Only EDGAR data, no Finnhub. Should still return 200."""
        income = _make_income_data(4)
        balance = _make_balance_data()
        company = _make_company_info()
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, company=company,
            market=None, profile=None,
        )
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data_sources"]["market_data"] == "none"
        assert body["ttm"]["pe_ratio"] is None
        assert body["ttm"]["market_cap"] is None
        assert body["company_name"] == "Apple Inc."

    def test_finnhub_only_degraded(self):
        """No EDGAR data, only Finnhub. Verify degraded response."""
        market = _make_market_data()
        profile = _make_profile_data()
        ep, fp = _patch_fundamentals(income=None, market=market, profile=profile)
        with ep, fp:
            resp = _get("MSFT")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "MSFT"
        assert body["quarterly"] == []
        assert "note" in body
        assert body["ttm"]["revenue"] is None
        assert body["ttm"]["pe_ratio"] == market["pe_ratio"]

    def test_ttm_and_quarterly_consistency(self):
        """TTM revenue should be sum of quarterly revenues."""
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        quarterly_sum = sum(q["revenue"] for q in body["quarterly"])
        assert body["ttm"]["revenue"] == int(quarterly_sum)

    def test_different_symbols_independent(self):
        """Two sequential requests with different symbols return different data."""
        ep1, fp1 = _patch_fundamentals(
            income=_make_income_data(4),
            company=_make_company_info(name="Company A"),
            market=_make_market_data(pe_ratio=20.0),
        )
        with ep1, fp1:
            resp1 = _get("CMPA")
        ep2, fp2 = _patch_fundamentals(
            income=_make_income_data(4),
            company=_make_company_info(name="Company B"),
            market=_make_market_data(pe_ratio=35.0),
        )
        with ep2, fp2:
            resp2 = _get("CMPB")
        assert resp1.json()["company_name"] == "Company A"
        assert resp2.json()["company_name"] == "Company B"
        assert resp1.json()["ttm"]["pe_ratio"] == 20.0
        assert resp2.json()["ttm"]["pe_ratio"] == 35.0

    def test_large_market_cap_precision(self):
        """Verify large market cap conversions don't lose precision."""
        market = _make_market_data(market_cap=3500.123)
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, market=market)
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        # 3500.123 * 1_000_000 = 3_500_123_000
        assert body["ttm"]["market_cap"] == int(3500.123 * 1_000_000)

    def test_filing_date_from_fetched_at(self):
        """filing_date should be the first 10 chars of _fetched_at."""
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        for q in body["quarterly"]:
            if q["filing_date"] is not None:
                assert len(q["filing_date"]) == 10
                assert q["filing_date"][4] == "-"

    def test_cash_flow_fewer_periods_than_income(self):
        """When cash flow has fewer periods than income, FCF is missing for later quarters."""
        income = _make_income_data(4)
        cash_flow = _make_cash_flow_data(2)
        ep, fp = _patch_fundamentals(
            income=income, cash_flow=cash_flow, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        # First 2 quarters should have FCF, rest should not
        assert body["quarterly"][0]["free_cash_flow"] == cash_flow[0]["free_cash_flow"]
        assert body["quarterly"][1]["free_cash_flow"] == cash_flow[1]["free_cash_flow"]

    def test_all_none_income_fields_still_200(self):
        """Income data with all None values still returns 200."""
        income = [
            {"period": "Q4 2026", "revenue": None, "net_income": None,
             "eps_diluted": None, "gross_margin": None, "operating_margin": None,
             "net_margin": None, "revenue_growth_yoy": None, "eps_growth_yoy": None,
             "_fetched_at": None}
        ]
        ep, fp = _patch_fundamentals(income=income, market=_make_market_data())
        with ep, fp:
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ttm"]["revenue"] is None
        assert body["quarterly"][0]["filing_date"] is None

    def test_balance_data_multiple_periods_uses_latest(self):
        """TTM uses the first (most recent) balance sheet record."""
        balance = _make_balance_data(4)
        income = _make_income_data(4)
        ep, fp = _patch_fundamentals(
            income=income, balance=balance, market=_make_market_data(),
        )
        with ep, fp:
            resp = _get("AAPL")
        body = resp.json()
        assert body["ttm"]["debt_to_equity"] == balance[0]["debt_to_equity"]
