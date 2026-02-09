"""Tests for TASK-API-005: Ownership and Insider endpoints.

Covers:
  /api/ownership/{symbol}  -- institutional holders from SEC 13F filings
  /api/insider/{symbol}    -- insider transactions from SEC Form 4 filings

Validates symbol validation, response structure, holder formatting/sorting,
QoQ computation, insider transaction formatting/filtering/summary, query
parameter validation, no-data responses, error handling, and edge cases.

Run with: ``pytest tests/test_ownership_endpoint.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Mock data factories
# ---------------------------------------------------------------------------


def _make_holder_data(
    holder_name: str = "Vanguard Group Inc.",
    shares: int = 1_200_000_000,
    value_usd: float = 210_000_000_000.0,
    change_shares: int = 5_000_000,
    change_percent: float = 0.42,
    filing_date: str = "2025-11-14",
    report_period: str = "2025-09-30",
    cik: int | None = None,
) -> dict:
    """Return a single raw holder dict as returned by EdgarOwnershipClient."""
    d: dict = {
        "holder_name": holder_name,
        "shares": shares,
        "value_usd": value_usd,
        "change_shares": change_shares,
        "change_percent": change_percent,
        "filing_date": filing_date,
        "report_period": report_period,
    }
    if cik is not None:
        d["cik"] = cik
    return d


def _make_insider_data(
    transactions: list[dict] | None = None,
    summary: dict | None = None,
) -> dict:
    """Return a raw insider-transactions dict as returned by EdgarOwnershipClient."""
    if transactions is None:
        transactions = [_make_insider_tx()]
    if summary is None:
        summary = {
            "total_transactions": len(transactions),
            "total_buys": 1,
            "total_sells": 0,
            "net_shares": 10000,
            "net_value": 500000,
        }
    return {"transactions": transactions, "summary": summary}


def _make_insider_tx(
    insider_name: str = "Tim Cook",
    insider_title: str = "CEO",
    transaction_type: str = "buy",
    shares: int = 10000,
    price_per_share: float = 175.50,
    total_value: int | float | None = 1_755_000,
    shares_owned_after: int = 350_000,
    transaction_date: str = "2025-12-01",
    filing_date: str = "2025-12-03",
) -> dict:
    """Return a single raw insider transaction dict."""
    return {
        "insider_name": insider_name,
        "insider_title": insider_title,
        "transaction_type": transaction_type,
        "shares": shares,
        "price_per_share": price_per_share,
        "total_value": total_value,
        "shares_owned_after": shares_owned_after,
        "transaction_date": transaction_date,
        "filing_date": filing_date,
    }


def _make_holders_response(
    holders: list[dict] | None = None,
    total_institutional_shares: int = 9_500_000_000,
    total_institutional_value: float = 1_650_000_000_000.0,
    num_holders: int = 5,
) -> dict:
    """Return a full ownership response dict from the client."""
    if holders is None:
        holders = [_make_holder_data()]
    return {
        "holders": holders,
        "total_institutional_shares": total_institutional_shares,
        "total_institutional_value": total_institutional_value,
        "num_holders": num_holders,
    }


# ---------------------------------------------------------------------------
# Patch helper
# ---------------------------------------------------------------------------

def _patch_ownership(
    holders_return=None,
    insider_return=None,
    holders_raises=False,
    insider_raises=False,
):
    """Return a context manager that mocks ``get_ownership_client``.

    The mock's ``get_institutional_holders`` and ``get_insider_transactions``
    are both ``AsyncMock`` instances.
    """
    mock_client = MagicMock()

    if holders_raises:
        mock_client.get_institutional_holders = AsyncMock(
            side_effect=Exception("EDGAR service error")
        )
    else:
        mock_client.get_institutional_holders = AsyncMock(
            return_value=holders_return
        )

    if insider_raises:
        mock_client.get_insider_transactions = AsyncMock(
            side_effect=Exception("EDGAR service error")
        )
    else:
        mock_client.get_insider_transactions = AsyncMock(
            return_value=insider_return
        )

    return patch(
        "app.api.routes.ownership.get_ownership_client",
        return_value=mock_client,
    )


# ---------------------------------------------------------------------------
# Shorthand helpers
# ---------------------------------------------------------------------------

def _get_ownership(symbol: str, **params) -> object:
    """Shorthand for GET /api/ownership/{symbol}."""
    return client.get(f"/api/ownership/{symbol}", params=params)


def _get_insider(symbol: str, **params) -> object:
    """Shorthand for GET /api/insider/{symbol}."""
    return client.get(f"/api/insider/{symbol}", params=params)


# ===================================================================
# 1. TestOwnershipSymbolValidation (12 tests)
# ===================================================================
class TestOwnershipSymbolValidation:
    """Verify symbol validation on /api/ownership/{symbol}."""

    @pytest.mark.parametrize(
        "symbol",
        ["AAPL", "MSFT", "GOOG", "X", "A"],
        ids=["aapl", "msft", "goog", "single-X", "single-A"],
    )
    def test_valid_simple_symbols_return_200(self, symbol):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership(symbol)
        assert resp.status_code == 200

    def test_valid_symbol_with_dot(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("BRK.B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.B"

    def test_valid_symbol_with_hyphen(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("BRK-A")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK-A"

    def test_valid_symbol_with_digits(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("BF2")
        assert resp.status_code == 200

    def test_valid_symbol_ten_chars_max(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("ABCDEFGHIJ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "ABCDEFGHIJ"

    def test_case_normalization_lowercase(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("aapl")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_case_normalization_mixed(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("aApL")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership(" AAPL ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_invalid_empty_string(self):
        """Empty symbol -> 404 because FastAPI route /{symbol} requires non-empty."""
        with _patch_ownership():
            resp = _get_ownership("")
        assert resp.status_code == 404

    def test_invalid_spaces_only(self):
        with _patch_ownership():
            resp = _get_ownership("   ")
        assert resp.status_code == 400

    def test_invalid_special_chars(self):
        with _patch_ownership():
            resp = _get_ownership("!!!")
        assert resp.status_code == 400

    def test_invalid_too_long(self):
        with _patch_ownership():
            resp = _get_ownership("ABCDEFGHIJK")  # 11 chars
        assert resp.status_code == 400

    def test_error_message_is_generic(self):
        """Error messages must not reflect user input (XSS prevention)."""
        with _patch_ownership():
            resp = _get_ownership("!!!EVIL!!!")
        assert resp.status_code == 400
        body = resp.json()
        assert "EVIL" not in str(body)
        assert "Invalid ticker symbol" in body.get("error", "")


# ===================================================================
# 2. TestOwnershipResponseStructure (10 tests)
# ===================================================================
class TestOwnershipResponseStructure:
    """Verify all required fields are present in ownership responses."""

    def _get_ok_response(self):
        holders = [_make_holder_data()]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200
        return resp.json()

    def test_top_level_symbol(self):
        body = self._get_ok_response()
        assert body["symbol"] == "AAPL"

    def test_top_level_filing_period(self):
        body = self._get_ok_response()
        assert "filing_period" in body

    def test_top_level_total_institutional_shares(self):
        body = self._get_ok_response()
        assert "total_institutional_shares" in body
        assert isinstance(body["total_institutional_shares"], int)

    def test_top_level_total_institutional_value(self):
        body = self._get_ok_response()
        assert "total_institutional_value" in body
        assert isinstance(body["total_institutional_value"], int)

    def test_top_level_holders_is_list(self):
        body = self._get_ok_response()
        assert isinstance(body["holders"], list)

    def test_top_level_quarter_over_quarter(self):
        body = self._get_ok_response()
        assert "quarter_over_quarter" in body
        qoq = body["quarter_over_quarter"]
        assert "new_positions" in qoq
        assert "increased_positions" in qoq
        assert "decreased_positions" in qoq
        assert "closed_positions" in qoq
        assert "net_shares_change" in qoq

    def test_top_level_data_source(self):
        body = self._get_ok_response()
        assert body["data_source"] == "edgar_13f"

    def test_top_level_data_timestamp(self):
        body = self._get_ok_response()
        assert "data_timestamp" in body
        # Should be ISO format
        assert "T" in body["data_timestamp"]

    def test_top_level_note(self):
        body = self._get_ok_response()
        assert "note" in body

    def test_holder_item_structure(self):
        body = self._get_ok_response()
        holder = body["holders"][0]
        assert "holder_name" in holder
        assert "shares" in holder
        assert "value" in holder
        assert "percent_of_outstanding" in holder
        assert "change_shares" in holder
        assert "change_percent" in holder
        assert "filing_date" in holder


# ===================================================================
# 3. TestOwnershipHolders (12 tests)
# ===================================================================
class TestOwnershipHolders:
    """Verify holder formatting, sorting, and limiting."""

    def test_holder_name_from_raw(self):
        holders = [_make_holder_data(holder_name="BlackRock Inc.")]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["holder_name"] == "BlackRock Inc."

    def test_holder_name_defaults_to_unknown(self):
        raw = {"shares": 100, "value_usd": 100}  # no holder_name
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["holder_name"] == "Unknown"

    def test_holder_shares_integer(self):
        holders = [_make_holder_data(shares=5_000_000)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["shares"] == 5_000_000

    def test_holder_value_is_integer(self):
        holders = [_make_holder_data(value_usd=1_500_000_000.99)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        val = resp.json()["holders"][0]["value"]
        assert isinstance(val, int)

    def test_sort_by_value_default(self):
        h1 = _make_holder_data(holder_name="Small", value_usd=100.0, shares=5)
        h2 = _make_holder_data(holder_name="Large", value_usd=999.0, shares=3)
        h3 = _make_holder_data(holder_name="Medium", value_usd=500.0, shares=1)
        data = _make_holders_response(holders=[h1, h2, h3])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        assert names == ["Large", "Medium", "Small"]

    def test_sort_by_shares(self):
        h1 = _make_holder_data(holder_name="Few", shares=10, value_usd=999.0)
        h2 = _make_holder_data(holder_name="Many", shares=1000, value_usd=1.0)
        h3 = _make_holder_data(holder_name="Some", shares=500, value_usd=2.0)
        data = _make_holders_response(holders=[h1, h2, h3])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="shares")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        assert names == ["Many", "Some", "Few"]

    def test_sort_by_change(self):
        h1 = _make_holder_data(holder_name="NoChange", change_shares=0)
        h2 = _make_holder_data(holder_name="BigIncrease", change_shares=1_000_000)
        h3 = _make_holder_data(holder_name="BigDecrease", change_shares=-500_000)
        data = _make_holders_response(holders=[h1, h2, h3])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="change")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        # Sort by abs(change) descending
        assert names == ["BigIncrease", "BigDecrease", "NoChange"]

    def test_limit_default_25(self):
        holders = [_make_holder_data(holder_name=f"H{i}", value_usd=float(100 - i)) for i in range(30)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert len(resp.json()["holders"]) == 25

    def test_limit_custom(self):
        holders = [_make_holder_data(holder_name=f"H{i}", value_usd=float(100 - i)) for i in range(30)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", limit=5)
        assert len(resp.json()["holders"]) == 5

    def test_limit_larger_than_data(self):
        holders = [_make_holder_data()]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", limit=50)
        assert len(resp.json()["holders"]) == 1

    def test_filing_date_passed_through(self):
        holders = [_make_holder_data(filing_date="2025-11-14")]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["filing_date"] == "2025-11-14"

    def test_change_shares_passed_through(self):
        holders = [_make_holder_data(change_shares=-100_000)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["change_shares"] == -100_000


# ===================================================================
# 4. TestOwnershipQoQ (9 tests)
# ===================================================================
class TestOwnershipQoQ:
    """Verify quarter-over-quarter computation."""

    def test_qoq_all_increased(self):
        holders = [
            _make_holder_data(change_shares=100),
            _make_holder_data(change_shares=200),
        ]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 2
        assert qoq["decreased_positions"] == 0
        assert qoq["net_shares_change"] == 300

    def test_qoq_all_decreased(self):
        holders = [
            _make_holder_data(change_shares=-50),
            _make_holder_data(change_shares=-150),
        ]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 0
        assert qoq["decreased_positions"] == 2
        assert qoq["net_shares_change"] == -200

    def test_qoq_mixed_changes(self):
        holders = [
            _make_holder_data(change_shares=500),
            _make_holder_data(change_shares=-200),
            _make_holder_data(change_shares=0),
        ]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 1
        assert qoq["decreased_positions"] == 1
        assert qoq["net_shares_change"] == 300

    def test_qoq_none_change_ignored(self):
        holders = [
            _make_holder_data(change_shares=100),
            {"holder_name": "New Fund", "shares": 50, "value_usd": 100},
        ]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 1
        assert qoq["net_shares_change"] == 100

    def test_qoq_zero_change_not_counted(self):
        holders = [_make_holder_data(change_shares=0)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 0
        assert qoq["decreased_positions"] == 0
        assert qoq["net_shares_change"] == 0

    def test_qoq_new_positions_always_zero(self):
        """Current implementation always returns 0 for new_positions."""
        holders = [_make_holder_data()]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["quarter_over_quarter"]["new_positions"] == 0

    def test_qoq_closed_positions_always_zero(self):
        """Current implementation always returns 0 for closed_positions."""
        holders = [_make_holder_data()]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["quarter_over_quarter"]["closed_positions"] == 0

    def test_qoq_no_holders(self):
        data = _make_holders_response(holders=[])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["increased_positions"] == 0
        assert qoq["decreased_positions"] == 0
        assert qoq["net_shares_change"] == 0

    def test_qoq_float_change_treated_as_int(self):
        holders = [_make_holder_data(change_shares=99)]
        # Inject a float change_shares directly
        holders[0]["change_shares"] = 99.7
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["net_shares_change"] == 99  # int() truncates


# ===================================================================
# 5. TestOwnershipQueryParams (11 tests)
# ===================================================================
class TestOwnershipQueryParams:
    """Verify query parameter validation for /api/ownership/{symbol}."""

    def test_limit_min_1(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", limit=1)
        assert resp.status_code == 200

    def test_limit_max_100(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", limit=100)
        assert resp.status_code == 200

    def test_limit_zero_rejected(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", limit=0)
        assert resp.status_code == 422  # FastAPI validation

    def test_limit_exceeds_max_rejected(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", limit=101)
        assert resp.status_code == 422

    def test_limit_negative_rejected(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", limit=-1)
        assert resp.status_code == 422

    def test_sort_value_accepted(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", sort="value")
        assert resp.status_code == 200

    def test_sort_shares_accepted(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", sort="shares")
        assert resp.status_code == 200

    def test_sort_change_accepted(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", sort="change")
        assert resp.status_code == 200

    def test_sort_invalid_returns_400(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", sort="name")
        assert resp.status_code == 400
        body = resp.json()
        assert "Invalid sort field" in body.get("error", "")

    def test_quarter_valid_pattern(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", quarter="2025-Q3")
        assert resp.status_code == 200

    def test_quarter_invalid_pattern_rejected(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", quarter="Q3-2025")
        assert resp.status_code == 422  # FastAPI pattern validation


# ===================================================================
# 6. TestOwnershipNoData (7 tests)
# ===================================================================
class TestOwnershipNoData:
    """Verify behavior when no institutional filings found (client returns None)."""

    def test_returns_200_not_404(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200

    def test_empty_holders_list(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"] == []

    def test_zeroed_totals(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        body = resp.json()
        assert body["total_institutional_shares"] == 0
        assert body["total_institutional_value"] == 0

    def test_zeroed_qoq(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        qoq = resp.json()["quarter_over_quarter"]
        assert qoq["new_positions"] == 0
        assert qoq["increased_positions"] == 0
        assert qoq["decreased_positions"] == 0
        assert qoq["closed_positions"] == 0
        assert qoq["net_shares_change"] == 0

    def test_note_about_no_filings(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        body = resp.json()
        assert "No institutional ownership filings found" in body.get("note", "")

    def test_data_source_still_present(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        assert resp.json()["data_source"] == "edgar_13f"

    def test_data_timestamp_still_present(self):
        with _patch_ownership(holders_return=None):
            resp = _get_ownership("AAPL")
        assert "data_timestamp" in resp.json()


# ===================================================================
# 7. TestOwnershipErrors (6 tests)
# ===================================================================
class TestOwnershipErrors:
    """Verify EDGAR service failure handling (502)."""

    def test_service_error_returns_502(self):
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 502

    def test_service_error_message_is_generic(self):
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("AAPL")
        body = resp.json()
        assert "EDGAR service unavailable" in body.get("error", "")

    def test_service_error_no_stack_trace(self):
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("AAPL")
        body_str = str(resp.json())
        assert "Traceback" not in body_str
        assert "EDGAR service error" not in body_str

    def test_symbol_validated_before_service_call(self):
        """Invalid symbol should return 400 even if service would also fail."""
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("!!!")
        assert resp.status_code == 400

    def test_invalid_sort_before_service_call(self):
        """Invalid sort should return 400 without hitting the service."""
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("AAPL", sort="invalid")
        assert resp.status_code == 400

    def test_service_error_does_not_reflect_symbol(self):
        with _patch_ownership(holders_raises=True):
            resp = _get_ownership("AAPL")
        body = resp.json()
        assert "AAPL" not in body.get("error", "")


# ===================================================================
# 8. TestInsiderSymbolValidation (10 tests)
# ===================================================================
class TestInsiderSymbolValidation:
    """Verify symbol validation on /api/insider/{symbol}."""

    @pytest.mark.parametrize(
        "symbol",
        ["AAPL", "MSFT", "X", "A"],
        ids=["aapl", "msft", "single-X", "single-A"],
    )
    def test_valid_symbols_return_200(self, symbol):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider(symbol)
        assert resp.status_code == 200

    def test_case_normalization(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("aapl")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider(" MSFT ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "MSFT"

    def test_invalid_empty(self):
        with _patch_ownership():
            resp = _get_insider("")
        assert resp.status_code == 404

    def test_invalid_spaces_only(self):
        with _patch_ownership():
            resp = _get_insider("   ")
        assert resp.status_code == 400

    def test_invalid_special_chars(self):
        with _patch_ownership():
            resp = _get_insider("@#$")
        assert resp.status_code == 400

    def test_invalid_too_long(self):
        with _patch_ownership():
            resp = _get_insider("ABCDEFGHIJK")
        assert resp.status_code == 400

    def test_error_message_generic(self):
        with _patch_ownership():
            resp = _get_insider("<script>")
        assert resp.status_code == 400
        body = resp.json()
        assert "<script>" not in str(body)
        assert "Invalid ticker symbol" in body.get("error", "")

    def test_symbol_with_dot(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("BRK.B")
        assert resp.status_code == 200

    def test_symbol_with_hyphen(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("BRK-A")
        assert resp.status_code == 200


# ===================================================================
# 9. TestInsiderResponseStructure (8 tests)
# ===================================================================
class TestInsiderResponseStructure:
    """Verify all required fields are present in insider responses."""

    def _get_ok_response(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL")
        assert resp.status_code == 200
        return resp.json()

    def test_top_level_symbol(self):
        body = self._get_ok_response()
        assert body["symbol"] == "AAPL"

    def test_top_level_transactions_is_list(self):
        body = self._get_ok_response()
        assert isinstance(body["transactions"], list)

    def test_top_level_summary(self):
        body = self._get_ok_response()
        assert "summary" in body
        summary = body["summary"]
        assert "period_days" in summary
        assert "total_insider_buys" in summary
        assert "total_insider_sells" in summary
        assert "total_buy_value" in summary
        assert "total_sell_value" in summary
        assert "net_activity" in summary
        assert "buy_sell_ratio" in summary

    def test_top_level_data_source(self):
        body = self._get_ok_response()
        assert body["data_source"] == "edgar_form4"

    def test_top_level_data_timestamp(self):
        body = self._get_ok_response()
        assert "data_timestamp" in body
        assert "T" in body["data_timestamp"]

    def test_transaction_item_structure(self):
        body = self._get_ok_response()
        tx = body["transactions"][0]
        assert "insider_name" in tx
        assert "title" in tx
        assert "transaction_type" in tx
        assert "transaction_date" in tx
        assert "shares" in tx
        assert "price_per_share" in tx
        assert "total_value" in tx
        assert "shares_remaining" in tx
        assert "filing_date" in tx
        assert "filing_url" in tx

    def test_filing_url_is_none(self):
        body = self._get_ok_response()
        tx = body["transactions"][0]
        assert tx["filing_url"] is None

    def test_summary_period_days_matches_default(self):
        body = self._get_ok_response()
        assert body["summary"]["period_days"] == 90


# ===================================================================
# 10. TestInsiderTransactions (14 tests)
# ===================================================================
class TestInsiderTransactions:
    """Verify transaction formatting, type filtering, and date sorting."""

    def test_insider_name_from_raw(self):
        tx = _make_insider_tx(insider_name="Elon Musk")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("TSLA")
        assert resp.json()["transactions"][0]["insider_name"] == "Elon Musk"

    def test_insider_name_defaults_to_unknown(self):
        tx = {"shares": 100, "transaction_type": "buy", "transaction_date": "2025-01-01"}
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["insider_name"] == "Unknown"

    def test_transaction_type_buy_mapped(self):
        tx = _make_insider_tx(transaction_type="buy")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == "P-Purchase"

    def test_transaction_type_sell_mapped(self):
        tx = _make_insider_tx(transaction_type="sell")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == "S-Sale"

    def test_transaction_type_exercise_mapped(self):
        tx = _make_insider_tx(transaction_type="exercise")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == "M-Exercise"

    def test_transaction_type_gift_mapped(self):
        tx = _make_insider_tx(transaction_type="gift")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == "G-Gift"

    def test_shares_are_absolute(self):
        tx = _make_insider_tx(shares=-5000)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["shares"] == 5000

    def test_total_value_computed_when_missing(self):
        tx = _make_insider_tx(total_value=None, shares=100, price_per_share=50.0)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["total_value"] == 5000

    def test_filter_type_buy(self):
        txns = [
            _make_insider_tx(insider_name="Buyer", transaction_type="buy"),
            _make_insider_tx(insider_name="Seller", transaction_type="sell"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", type="buy")
        body = resp.json()
        assert len(body["transactions"]) == 1
        assert body["transactions"][0]["insider_name"] == "Buyer"

    def test_filter_type_sell(self):
        txns = [
            _make_insider_tx(insider_name="Buyer", transaction_type="buy"),
            _make_insider_tx(insider_name="Seller", transaction_type="sell"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", type="sell")
        body = resp.json()
        assert len(body["transactions"]) == 1
        assert body["transactions"][0]["insider_name"] == "Seller"

    def test_filter_type_all_returns_everything(self):
        txns = [
            _make_insider_tx(transaction_type="buy"),
            _make_insider_tx(transaction_type="sell"),
            _make_insider_tx(transaction_type="exercise"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", type="all")
        assert len(resp.json()["transactions"]) == 3

    def test_sorted_by_date_descending(self):
        txns = [
            _make_insider_tx(insider_name="Early", transaction_date="2025-01-01"),
            _make_insider_tx(insider_name="Late", transaction_date="2025-12-01"),
            _make_insider_tx(insider_name="Mid", transaction_date="2025-06-15"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        names = [t["insider_name"] for t in resp.json()["transactions"]]
        assert names == ["Late", "Mid", "Early"]

    def test_limit_applied(self):
        txns = [_make_insider_tx(transaction_date=f"2025-{i+1:02d}-01") for i in range(10)]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", limit=3)
        assert len(resp.json()["transactions"]) == 3

    def test_shares_remaining_passed_through(self):
        tx = _make_insider_tx(shares_owned_after=500_000)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["shares_remaining"] == 500_000


# ===================================================================
# 11. TestInsiderSummary (12 tests)
# ===================================================================
class TestInsiderSummary:
    """Verify insider summary computation (net_activity, buy_sell_ratio)."""

    def test_net_buying_when_only_buys(self):
        txns = [_make_insider_tx(transaction_type="buy", total_value=100_000)]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "net_buying"

    def test_net_selling_when_only_sells(self):
        txns = [_make_insider_tx(transaction_type="sell", total_value=100_000)]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "net_selling"

    def test_neutral_when_no_transactions(self):
        with _patch_ownership(insider_return=_make_insider_data(transactions=[])):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "neutral"

    def test_neutral_when_buy_sell_ratio_near_1(self):
        txns = [
            _make_insider_tx(transaction_type="buy", total_value=100_000),
            _make_insider_tx(transaction_type="sell", total_value=100_000),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "neutral"

    def test_net_buying_when_ratio_above_1_1(self):
        txns = [
            _make_insider_tx(transaction_type="buy", total_value=200_000),
            _make_insider_tx(transaction_type="sell", total_value=100_000),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "net_buying"

    def test_net_selling_when_ratio_below_0_9(self):
        txns = [
            _make_insider_tx(transaction_type="buy", total_value=50_000),
            _make_insider_tx(transaction_type="sell", total_value=200_000),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["net_activity"] == "net_selling"

    def test_buy_sell_ratio_zero_when_no_sells(self):
        txns = [_make_insider_tx(transaction_type="buy", total_value=100_000)]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["buy_sell_ratio"] == 0.0

    def test_buy_sell_ratio_computed(self):
        txns = [
            _make_insider_tx(transaction_type="buy", total_value=300_000),
            _make_insider_tx(transaction_type="sell", total_value=100_000),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["buy_sell_ratio"] == 3.0

    def test_total_insider_buys_count(self):
        txns = [
            _make_insider_tx(transaction_type="buy"),
            _make_insider_tx(transaction_type="buy"),
            _make_insider_tx(transaction_type="sell"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["total_insider_buys"] == 2

    def test_total_insider_sells_count(self):
        txns = [
            _make_insider_tx(transaction_type="buy"),
            _make_insider_tx(transaction_type="sell"),
            _make_insider_tx(transaction_type="sell"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["total_insider_sells"] == 2

    def test_summary_uses_all_before_limit(self):
        """Summary should be computed from all matching transactions, not just the limited set."""
        txns = [
            _make_insider_tx(transaction_type="buy", total_value=100_000, transaction_date=f"2025-{i+1:02d}-01")
            for i in range(10)
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", limit=3)
        body = resp.json()
        assert len(body["transactions"]) == 3
        # Summary should reflect all 10 buys, not just 3
        assert body["summary"]["total_insider_buys"] == 10

    def test_summary_period_days_matches_param(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", days=180)
        assert resp.json()["summary"]["period_days"] == 180


# ===================================================================
# 12. TestInsiderQueryParams (10 tests)
# ===================================================================
class TestInsiderQueryParams:
    """Verify query parameter validation for /api/insider/{symbol}."""

    def test_days_default_90(self):
        mock_client = MagicMock()
        mock_client.get_insider_transactions = AsyncMock(
            return_value=_make_insider_data()
        )
        with patch("app.api.routes.ownership.get_ownership_client", return_value=mock_client):
            resp = _get_insider("AAPL")
        assert resp.status_code == 200
        # Verify the client was called with days=90
        mock_client.get_insider_transactions.assert_called_once()
        _, kwargs = mock_client.get_insider_transactions.call_args
        assert kwargs.get("days") == 90

    def test_days_min_1(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", days=1)
        assert resp.status_code == 200

    def test_days_max_365(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", days=365)
        assert resp.status_code == 200

    def test_days_zero_rejected(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", days=0)
        assert resp.status_code == 422

    def test_days_exceeds_max_rejected(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", days=366)
        assert resp.status_code == 422

    def test_type_buy_accepted(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", type="buy")
        assert resp.status_code == 200

    def test_type_sell_accepted(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", type="sell")
        assert resp.status_code == 200

    def test_type_all_accepted(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", type="all")
        assert resp.status_code == 200

    def test_type_invalid_returns_400(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", type="exercise")
        assert resp.status_code == 400
        assert "Invalid type filter" in resp.json().get("error", "")

    def test_limit_default_50(self):
        txns = [_make_insider_tx(transaction_date=f"2025-01-{i+1:02d}") for i in range(60)]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL")
        assert len(resp.json()["transactions"]) == 50

    def test_limit_max_200(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", limit=200)
        assert resp.status_code == 200

    def test_limit_exceeds_max_rejected(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL", limit=201)
        assert resp.status_code == 422


# ===================================================================
# 13. TestInsiderNoData (6 tests)
# ===================================================================
class TestInsiderNoData:
    """Verify behavior when no insider filings found (client returns None)."""

    def test_returns_200_not_404(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        assert resp.status_code == 200

    def test_empty_transactions_list(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"] == []

    def test_zeroed_summary(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        summary = resp.json()["summary"]
        assert summary["total_insider_buys"] == 0
        assert summary["total_insider_sells"] == 0
        assert summary["total_buy_value"] == 0
        assert summary["total_sell_value"] == 0
        assert summary["buy_sell_ratio"] == 0.0

    def test_neutral_activity_when_no_data(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        assert resp.json()["summary"]["net_activity"] == "neutral"

    def test_data_source_still_present(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        assert resp.json()["data_source"] == "edgar_form4"

    def test_data_timestamp_still_present(self):
        with _patch_ownership(insider_return=None):
            resp = _get_insider("AAPL")
        assert "data_timestamp" in resp.json()


# ===================================================================
# 14. TestInsiderErrors (6 tests)
# ===================================================================
class TestInsiderErrors:
    """Verify EDGAR service failure handling for insider endpoint (502)."""

    def test_service_error_returns_502(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("AAPL")
        assert resp.status_code == 502

    def test_service_error_message_is_generic(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("AAPL")
        body = resp.json()
        assert "EDGAR service unavailable" in body.get("error", "")

    def test_service_error_no_stack_trace(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("AAPL")
        body_str = str(resp.json())
        assert "Traceback" not in body_str

    def test_symbol_validated_before_service_call(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("!!!")
        assert resp.status_code == 400

    def test_type_validated_before_service_call(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("AAPL", type="invalid")
        assert resp.status_code == 400

    def test_service_error_does_not_reflect_symbol(self):
        with _patch_ownership(insider_raises=True):
            resp = _get_insider("AAPL")
        body = resp.json()
        assert "AAPL" not in body.get("error", "")


# ===================================================================
# 15. TestOwnershipInsiderEdgeCases (22 tests)
# ===================================================================
class TestOwnershipInsiderEdgeCases:
    """Edge cases: zero values, None values, mixed data, boundary conditions."""

    # --- Ownership edge cases ---

    def test_holder_zero_shares_valid(self):
        holders = [_make_holder_data(shares=0)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200
        assert resp.json()["holders"][0]["shares"] == 0

    def test_holder_zero_value_valid(self):
        holders = [_make_holder_data(value_usd=0.0)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200
        assert resp.json()["holders"][0]["value"] == 0

    def test_holder_none_shares_becomes_zero(self):
        raw = {"holder_name": "TestFund", "value_usd": 100}  # no shares key
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["shares"] == 0

    def test_holder_none_value_becomes_zero(self):
        raw = {"holder_name": "TestFund", "shares": 100}  # no value_usd key
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["value"] == 0

    def test_holder_none_change_shares(self):
        raw = {"holder_name": "TestFund", "shares": 100, "value_usd": 100}
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["change_shares"] is None

    def test_holder_none_change_percent(self):
        raw = {"holder_name": "TestFund", "shares": 100, "value_usd": 100}
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["change_percent"] is None

    def test_holder_percent_of_outstanding_is_none(self):
        """Since shares_outstanding is not passed, percent is always None."""
        holders = [_make_holder_data(shares=1_000_000)]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["percent_of_outstanding"] is None

    def test_institutional_ownership_percent_is_none(self):
        holders = [_make_holder_data()]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["institutional_ownership_percent"] is None

    def test_total_institutional_value_is_int(self):
        data = _make_holders_response(total_institutional_value=1_234_567.89)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        val = resp.json()["total_institutional_value"]
        assert isinstance(val, int)
        assert val == 1_234_567

    def test_filing_period_from_report_period(self):
        holders = [_make_holder_data(report_period="2025-09-30")]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["filing_period"] == "2025-09-30"

    def test_filing_period_from_quarter_param_when_no_report_period(self):
        raw = {"holder_name": "TestFund", "shares": 100, "value_usd": 100}
        data = _make_holders_response(holders=[raw])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", quarter="2025-Q3")
        assert resp.json()["filing_period"] == "2025-Q3"

    def test_empty_holders_list_in_data(self):
        data = _make_holders_response(holders=[])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200
        assert resp.json()["holders"] == []

    # --- Insider edge cases ---

    def test_insider_zero_shares_valid(self):
        tx = _make_insider_tx(shares=0)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.status_code == 200
        assert resp.json()["transactions"][0]["shares"] == 0

    def test_insider_none_total_value_none_price(self):
        tx = _make_insider_tx(total_value=None, price_per_share=None)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["total_value"] is None

    def test_insider_negative_shares_abs(self):
        tx = _make_insider_tx(shares=-999)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["shares"] == 999

    def test_insider_none_shares_becomes_zero(self):
        raw_tx = {"insider_name": "Test", "transaction_type": "buy"}
        with _patch_ownership(insider_return=_make_insider_data(transactions=[raw_tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["shares"] == 0

    def test_insider_none_title(self):
        raw_tx = {"insider_name": "Test", "transaction_type": "buy", "shares": 100}
        with _patch_ownership(insider_return=_make_insider_data(transactions=[raw_tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["title"] is None

    def test_insider_unknown_tx_type_passthrough(self):
        tx = _make_insider_tx(transaction_type="custom_type")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == "custom_type"

    def test_insider_empty_transactions_list_in_data(self):
        data = {"transactions": [], "summary": {}}
        with _patch_ownership(insider_return=data):
            resp = _get_insider("AAPL")
        assert resp.status_code == 200
        assert resp.json()["transactions"] == []

    def test_mixed_tx_types_with_filter(self):
        txns = [
            _make_insider_tx(insider_name="A", transaction_type="buy"),
            _make_insider_tx(insider_name="B", transaction_type="sell"),
            _make_insider_tx(insider_name="C", transaction_type="exercise"),
            _make_insider_tx(insider_name="D", transaction_type="gift"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", type="buy")
        body = resp.json()
        # Only P-Purchase matches the "Purchase" filter
        assert len(body["transactions"]) == 1
        assert body["transactions"][0]["insider_name"] == "A"

    def test_sell_filter_excludes_exercise(self):
        txns = [
            _make_insider_tx(insider_name="Seller", transaction_type="sell"),
            _make_insider_tx(insider_name="Exerciser", transaction_type="exercise"),
        ]
        with _patch_ownership(insider_return=_make_insider_data(transactions=txns)):
            resp = _get_insider("AAPL", type="sell")
        body = resp.json()
        assert len(body["transactions"]) == 1
        assert body["transactions"][0]["insider_name"] == "Seller"


# ===================================================================
# 16. TestOwnershipQuarterParam (5 tests)
# ===================================================================
class TestOwnershipQuarterParam:
    """Verify the quarter query parameter affects the client call."""

    def test_quarter_none_uses_4_quarters(self):
        mock_client = MagicMock()
        mock_client.get_institutional_holders = AsyncMock(
            return_value=_make_holders_response()
        )
        with patch("app.api.routes.ownership.get_ownership_client", return_value=mock_client):
            resp = _get_ownership("AAPL")
        assert resp.status_code == 200
        mock_client.get_institutional_holders.assert_called_once()
        _, kwargs = mock_client.get_institutional_holders.call_args
        assert kwargs.get("quarters") == 4

    def test_quarter_specified_uses_1(self):
        mock_client = MagicMock()
        mock_client.get_institutional_holders = AsyncMock(
            return_value=_make_holders_response()
        )
        with patch("app.api.routes.ownership.get_ownership_client", return_value=mock_client):
            resp = _get_ownership("AAPL", quarter="2025-Q3")
        assert resp.status_code == 200
        _, kwargs = mock_client.get_institutional_holders.call_args
        assert kwargs.get("quarters") == 1

    def test_quarter_q1_accepted(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", quarter="2025-Q1")
        assert resp.status_code == 200

    def test_quarter_q4_accepted(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", quarter="2025-Q4")
        assert resp.status_code == 200

    def test_quarter_q5_rejected(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", quarter="2025-Q5")
        assert resp.status_code == 422


# ===================================================================
# 17. TestOwnershipSortEdgeCases (5 tests)
# ===================================================================
class TestOwnershipSortEdgeCases:
    """Edge cases in sorting: None values, identical values."""

    def test_sort_by_shares_none_change_treated_as_zero(self):
        h1 = _make_holder_data(holder_name="WithShares", shares=100)
        h2 = {"holder_name": "NoShares", "value_usd": 50}  # shares is missing
        data = _make_holders_response(holders=[h1, h2])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="shares")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        assert names[0] == "WithShares"

    def test_sort_by_change_none_treated_as_zero(self):
        h1 = _make_holder_data(holder_name="Changed", change_shares=1000)
        h2 = {"holder_name": "NoChange", "shares": 100, "value_usd": 100}
        data = _make_holders_response(holders=[h1, h2])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="change")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        assert names[0] == "Changed"

    def test_sort_by_value_none_treated_as_zero(self):
        h1 = _make_holder_data(holder_name="Valued", value_usd=1000.0)
        h2 = {"holder_name": "NoValue", "shares": 100}
        data = _make_holders_response(holders=[h1, h2])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="value")
        names = [h["holder_name"] for h in resp.json()["holders"]]
        assert names[0] == "Valued"

    def test_sort_stability_with_equal_values(self):
        h1 = _make_holder_data(holder_name="Alpha", value_usd=100.0)
        h2 = _make_holder_data(holder_name="Beta", value_usd=100.0)
        data = _make_holders_response(holders=[h1, h2])
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL", sort="value")
        holders = resp.json()["holders"]
        assert len(holders) == 2
        # Both should be present
        names = {h["holder_name"] for h in holders}
        assert names == {"Alpha", "Beta"}

    def test_sort_invalid_case_sensitive(self):
        """Sort field is case-sensitive; 'Value' != 'value'."""
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL", sort="Value")
        assert resp.status_code == 400


# ===================================================================
# 18. TestInsiderTxTypeMapping (6 tests)
# ===================================================================
class TestInsiderTxTypeMapping:
    """Verify all known transaction type mappings."""

    @pytest.mark.parametrize(
        "raw_type,expected",
        [
            ("buy", "P-Purchase"),
            ("sell", "S-Sale"),
            ("exercise", "M-Exercise"),
            ("gift", "G-Gift"),
            ("grant", "A-Grant"),
            ("tax_withholding", "F-Tax"),
        ],
        ids=["buy", "sell", "exercise", "gift", "grant", "tax_withholding"],
    )
    def test_mapped_type(self, raw_type, expected):
        tx = _make_insider_tx(transaction_type=raw_type)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["transaction_type"] == expected


# ===================================================================
# 19. TestInsiderTotalValueComputation (5 tests)
# ===================================================================
class TestInsiderTotalValueComputation:
    """Verify total_value auto-computation from shares * price."""

    def test_total_value_from_shares_times_price(self):
        tx = _make_insider_tx(total_value=None, shares=200, price_per_share=25.0)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["total_value"] == 5000

    def test_total_value_not_overwritten_when_present(self):
        tx = _make_insider_tx(total_value=99999, shares=200, price_per_share=25.0)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["total_value"] == 99999

    def test_total_value_none_when_price_none(self):
        tx = _make_insider_tx(total_value=None, price_per_share=None, shares=100)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["total_value"] is None

    def test_total_value_abs_for_negative_shares(self):
        tx = _make_insider_tx(total_value=None, shares=-500, price_per_share=10.0)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        val = resp.json()["transactions"][0]["total_value"]
        assert val == 5000

    def test_total_value_is_int(self):
        tx = _make_insider_tx(total_value=None, shares=100, price_per_share=33.33)
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        val = resp.json()["transactions"][0]["total_value"]
        assert isinstance(val, int)


# ===================================================================
# 20. TestCrossConcerns (5 tests)
# ===================================================================
class TestCrossConcerns:
    """Cross-cutting concerns: CORS, content-type, encoding."""

    def test_ownership_content_type_json(self):
        with _patch_ownership(holders_return=_make_holders_response()):
            resp = _get_ownership("AAPL")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_insider_content_type_json(self):
        with _patch_ownership(insider_return=_make_insider_data()):
            resp = _get_insider("AAPL")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_ownership_unicode_holder_name(self):
        holders = [_make_holder_data(holder_name="Societe Generale")]
        data = _make_holders_response(holders=holders)
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        assert resp.json()["holders"][0]["holder_name"] == "Societe Generale"

    def test_insider_unicode_insider_name(self):
        tx = _make_insider_tx(insider_name="Carlos Slim Helu")
        with _patch_ownership(insider_return=_make_insider_data(transactions=[tx])):
            resp = _get_insider("AAPL")
        assert resp.json()["transactions"][0]["insider_name"] == "Carlos Slim Helu"

    def test_ownership_note_in_normal_response(self):
        data = _make_holders_response()
        with _patch_ownership(holders_return=data):
            resp = _get_ownership("AAPL")
        body = resp.json()
        assert "note" in body
        assert "13F data" in body["note"]
