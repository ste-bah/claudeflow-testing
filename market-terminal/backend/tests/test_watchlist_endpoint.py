"""Tests for TASK-API-007: Watchlist CRUD endpoints.

Covers five endpoints:
  GET    /api/watchlist/                -- list all tickers with cached market data
  POST   /api/watchlist/                -- add a ticker (201 success, 409 dup, 400 cap)
  DELETE /api/watchlist/{symbol}        -- remove a ticker (200 success, 404 not found)
  PUT    /api/watchlist/reorder         -- reorder tickers atomically
  PUT    /api/watchlist/{symbol}/group  -- change ticker group

Validates input validation, response structure, data enrichment, symbol
normalization, edge cases, and concurrent operation sequencing.

Run with: ``pytest tests/test_watchlist_endpoint.py -v``
"""
from __future__ import annotations

import unittest.mock
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Mock database
# ---------------------------------------------------------------------------

class MockDatabase:
    """Deterministic async database mock with sequential result queues."""

    def __init__(self, fetch_one_results=None, fetch_all_results=None):
        self._fetch_one_results = list(fetch_one_results or [])
        self._fetch_all_results = list(fetch_all_results or [])
        self._fetch_one_idx = 0
        self._fetch_all_idx = 0
        self.executed = []

    async def fetch_one(self, sql, params=()):
        self.executed.append(("fetch_one", sql, params))
        if self._fetch_one_idx < len(self._fetch_one_results):
            result = self._fetch_one_results[self._fetch_one_idx]
            self._fetch_one_idx += 1
            return result
        return None

    async def fetch_all(self, sql, params=()):
        self.executed.append(("fetch_all", sql, params))
        if self._fetch_all_idx < len(self._fetch_all_results):
            result = self._fetch_all_results[self._fetch_all_idx]
            self._fetch_all_idx += 1
            return result
        return []

    async def execute(self, sql, params=()):
        self.executed.append(("execute", sql, params))
        return None

    async def executemany(self, sql, params_seq):
        self.executed.append(("executemany", sql, list(params_seq)))
        return None


# ---------------------------------------------------------------------------
# Patch helper
# ---------------------------------------------------------------------------

@contextmanager
def _patch_db(mock_db):
    """Replace ``get_database`` in the watchlist route module."""
    async def _get_mock_db():
        return mock_db

    with unittest.mock.patch(
        "app.api.routes.watchlist.get_database",
        new=_get_mock_db,
    ):
        yield mock_db


# ---------------------------------------------------------------------------
# Data factories
# ---------------------------------------------------------------------------

def _make_watchlist_row(
    symbol="AAPL",
    group_name="default",
    sort_order=0,
    added_at="2026-01-15T10:30:00",
    updated_at="2026-02-07T15:45:00",
    row_id=1,
):
    return {
        "id": row_id,
        "symbol": symbol,
        "group_name": group_name,
        "sort_order": sort_order,
        "added_at": added_at,
        "updated_at": updated_at,
    }


def _make_price_row(close=185.42, open_val=184.25):
    return {"close": close, "open": open_val}


def _make_signal_row(direction="bullish", confidence=0.72):
    return {"direction": direction, "confidence": confidence}


def _enrichment_pair(price_row=None, signal_row=None):
    """Return a two-element list for one ticker's enrichment calls
    (price_cache fetch_one, analysis_results fetch_one).
    """
    return [price_row, signal_row]


# ===================================================================
# GET /api/watchlist/ -- EMPTY
# ===================================================================

class TestGetWatchlistEmpty:
    """Empty watchlist should return well-formed empty response."""

    def test_empty_returns_200(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            resp = client.get("/api/watchlist/")
        assert resp.status_code == 200

    def test_empty_tickers_list(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"] == []

    def test_empty_count_zero(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["count"] == 0

    def test_empty_max_allowed(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["max_allowed"] == 50

    def test_empty_groups(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["groups"] == []


# ===================================================================
# GET /api/watchlist/ -- WITH DATA
# ===================================================================

class TestGetWatchlistWithData:
    """Watchlist with tickers: enrichment, ordering, groups."""

    def _single_ticker_db(self, price=None, signal=None):
        """DB mock for one-ticker watchlist."""
        row = _make_watchlist_row()
        return MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, signal],
        )

    def test_single_ticker_returned(self):
        db = self._single_ticker_db()
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert len(body["tickers"]) == 1

    def test_ticker_symbol_preserved(self):
        db = self._single_ticker_db()
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["symbol"] == "AAPL"

    def test_ticker_group_from_row(self):
        row = _make_watchlist_row(group_name="tech")
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["group"] == "tech"

    def test_enrichment_last_price(self):
        price = _make_price_row(close=195.50)
        db = self._single_ticker_db(price=price)
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_price"] == 195.50

    def test_enrichment_price_change_pct(self):
        price = _make_price_row(close=110.0, open_val=100.0)
        db = self._single_ticker_db(price=price)
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] == 10.0

    def test_enrichment_composite_signal(self):
        signal = _make_signal_row(direction="bearish", confidence=0.85)
        db = self._single_ticker_db(signal=signal)
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_composite_signal"] == "bearish"

    def test_enrichment_composite_confidence(self):
        signal = _make_signal_row(confidence=0.91)
        db = self._single_ticker_db(signal=signal)
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_composite_confidence"] == 0.91

    def test_null_enrichment_no_cached_data(self):
        db = self._single_ticker_db(price=None, signal=None)
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        t = body["tickers"][0]
        assert t["last_price"] is None
        assert t["price_change_percent"] is None
        assert t["last_composite_signal"] is None
        assert t["last_composite_confidence"] is None

    def test_groups_extracted_from_rows(self):
        rows = [
            _make_watchlist_row(symbol="AAPL", group_name="tech", sort_order=0),
            _make_watchlist_row(symbol="XOM", group_name="energy", sort_order=1),
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None, None, None, None],  # 2 enrichment pairs
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert sorted(body["groups"]) == ["energy", "tech"]

    def test_multiple_groups_distinct(self):
        rows = [
            _make_watchlist_row(symbol="AAPL", group_name="tech", sort_order=0),
            _make_watchlist_row(symbol="MSFT", group_name="tech", sort_order=1),
            _make_watchlist_row(symbol="XOM", group_name="energy", sort_order=2),
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 6,
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert len(body["groups"]) == 2

    def test_count_matches_tickers_length(self):
        rows = [
            _make_watchlist_row(symbol="AAPL", sort_order=0),
            _make_watchlist_row(symbol="MSFT", sort_order=1),
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 4,
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["count"] == len(body["tickers"])

    def test_tickers_sorted_by_sort_order(self):
        rows = [
            _make_watchlist_row(symbol="MSFT", sort_order=0),
            _make_watchlist_row(symbol="AAPL", sort_order=1),
            _make_watchlist_row(symbol="GOOG", sort_order=2),
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 6,
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        symbols = [t["symbol"] for t in body["tickers"]]
        assert symbols == ["MSFT", "AAPL", "GOOG"]

    def test_position_field_from_sort_order(self):
        row = _make_watchlist_row(sort_order=7)
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["position"] == 7


# ===================================================================
# POST /api/watchlist/ -- ADD TICKER
# ===================================================================

class TestAddTicker:
    """Add ticker: success, duplicates, capacity, sort_order logic."""

    def _add_success_db(self, existing_count=0, max_sort=None, group="default"):
        """Mock DB for a successful add.

        fetch_one sequence for POST handler:
          1. COUNT(*) -- capacity
          2. SELECT id WHERE symbol -- duplicate check (None = no dup)
          3. MAX(sort_order) -- next position
          4. (execute INSERT -- no return)
          5. SELECT inserted row -- for enriched response
          6. price_cache enrichment
          7. analysis_results enrichment
        """
        count_row = {"cnt": existing_count}
        dup_row = None  # no duplicate
        max_row = {"max_pos": max_sort}
        next_pos = (max_sort + 1) if max_sort is not None else 0
        inserted_row = _make_watchlist_row(
            symbol="AAPL", group_name=group, sort_order=next_pos,
        )
        return MockDatabase(
            fetch_one_results=[
                count_row, dup_row, max_row, inserted_row,
                None, None,  # enrichment: price, signal
            ],
        )

    def test_successful_add_returns_201(self):
        db = self._add_success_db()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_successful_add_returns_symbol(self):
        db = self._add_success_db()
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["symbol"] == "AAPL"

    def test_default_group_is_default(self):
        db = self._add_success_db(group="default")
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["group"] == "default"

    def test_custom_group_preserved(self):
        count_row = {"cnt": 0}
        max_row = {"max_pos": None}
        inserted_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        db = MockDatabase(
            fetch_one_results=[
                count_row, None, max_row, inserted_row,
                None, None,
            ],
        )
        with _patch_db(db):
            body = client.post(
                "/api/watchlist/", json={"symbol": "AAPL", "group": "tech"}
            ).json()
        assert body["group"] == "tech"

    def test_duplicate_returns_409(self):
        count_row = {"cnt": 5}
        dup_row = {"id": 1}  # exists
        db = MockDatabase(fetch_one_results=[count_row, dup_row])
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 409

    def test_duplicate_error_message(self):
        count_row = {"cnt": 5}
        dup_row = {"id": 1}
        db = MockDatabase(fetch_one_results=[count_row, dup_row])
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert "already" in body["error"].lower()

    def test_capacity_at_50_returns_400(self):
        count_row = {"cnt": 50}
        db = MockDatabase(fetch_one_results=[count_row])
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 400

    def test_capacity_error_message(self):
        count_row = {"cnt": 50}
        db = MockDatabase(fetch_one_results=[count_row])
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert "capacity" in body["error"].lower() or "maximum" in body["error"].lower()

    def test_next_sort_order_from_max_plus_one(self):
        db = self._add_success_db(existing_count=3, max_sort=5)
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["position"] == 6

    def test_first_ticker_sort_order_zero(self):
        db = self._add_success_db(existing_count=0, max_sort=None)
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["position"] == 0

    def test_add_enrichment_price(self):
        count_row = {"cnt": 0}
        max_row = {"max_pos": None}
        inserted_row = _make_watchlist_row(symbol="AAPL")
        price = _make_price_row(close=200.0, open_val=195.0)
        db = MockDatabase(
            fetch_one_results=[
                count_row, None, max_row, inserted_row,
                price, None,
            ],
        )
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["last_price"] == 200.0

    def test_add_enrichment_signal(self):
        count_row = {"cnt": 0}
        max_row = {"max_pos": None}
        inserted_row = _make_watchlist_row(symbol="AAPL")
        signal = _make_signal_row(direction="bullish", confidence=0.88)
        db = MockDatabase(
            fetch_one_results=[
                count_row, None, max_row, inserted_row,
                None, signal,
            ],
        )
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body["last_composite_signal"] == "bullish"
        assert body["last_composite_confidence"] == 0.88

    def test_capacity_at_49_still_allows_add(self):
        db = self._add_success_db(existing_count=49, max_sort=48)
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_capacity_above_50_returns_400(self):
        count_row = {"cnt": 100}
        db = MockDatabase(fetch_one_results=[count_row])
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 400

    def test_insert_execute_called(self):
        db = self._add_success_db()
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "AAPL"})
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert len(insert_calls) == 1

    def test_inserted_symbol_uppercased(self):
        db = self._add_success_db()
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "aapl"})
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert len(insert_calls) == 1
        assert insert_calls[0][2][0] == "AAPL"

    def test_add_returns_last_updated(self):
        db = self._add_success_db()
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert "last_updated" in body

    def test_add_returns_added_at(self):
        db = self._add_success_db()
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert "added_at" in body


# ===================================================================
# POST /api/watchlist/ -- VALIDATION
# ===================================================================

class TestAddTickerValidation:
    """Pydantic model validation for _AddTickerRequest."""

    def test_empty_symbol_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": ""})
        assert resp.status_code == 422

    def test_spaces_only_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "   "})
        assert resp.status_code == 422

    def test_special_chars_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "!!!!"})
        assert resp.status_code == 422

    def test_too_long_symbol_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "A" * 11})
        assert resp.status_code == 422

    def test_at_sign_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "A@B"})
        assert resp.status_code == 422

    def test_dollar_sign_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "$AAPL"})
        assert resp.status_code == 422

    def test_slash_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "A/B"})
        assert resp.status_code == 422

    def test_xss_attempt_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post(
                "/api/watchlist/", json={"symbol": "<script>alert(1)</script>"}
            )
        assert resp.status_code == 422

    def test_valid_symbol_aapl(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_valid_symbol_brk_dot_b(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="BRK.B"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "BRK.B"})
        assert resp.status_code == 201

    def test_valid_symbol_bf_hyphen_b(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="BF-B"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "BF-B"})
        assert resp.status_code == 201

    def test_valid_symbol_single_char(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="X"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "X"})
        assert resp.status_code == 201

    def test_group_whitespace_stripped(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name="tech"),
                None, None,
            ],
        )
        with _patch_db(db):
            client.post(
                "/api/watchlist/", json={"symbol": "AAPL", "group": "  tech  "}
            )
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert len(insert_calls) == 1
        assert insert_calls[0][2][1] == "tech"

    def test_empty_group_defaults_to_default(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name="default"),
                None, None,
            ],
        )
        with _patch_db(db):
            client.post(
                "/api/watchlist/", json={"symbol": "AAPL", "group": ""}
            )
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert len(insert_calls) == 1
        assert insert_calls[0][2][1] == "default"

    def test_missing_symbol_field_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={})
        assert resp.status_code == 422

    def test_numeric_symbol_accepted(self):
        """Pure digits like '1234567890' should be valid (10 chars, all alphanumeric)."""
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="1234567890"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "1234567890"})
        assert resp.status_code == 201


# ===================================================================
# DELETE /api/watchlist/{symbol}
# ===================================================================

class TestDeleteTicker:
    """Remove ticker: success, not found, normalization."""

    def test_successful_delete_returns_200(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            resp = client.delete("/api/watchlist/AAPL")
        assert resp.status_code == 200

    def test_successful_delete_body(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AAPL").json()
        assert body == {"removed": "AAPL"}

    def test_not_found_returns_404(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            resp = client.delete("/api/watchlist/ZZZZ")
        assert resp.status_code == 404

    def test_not_found_error_message(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            body = client.delete("/api/watchlist/ZZZZ").json()
        assert "not in watchlist" in body["error"].lower()

    def test_symbol_uppercased_in_response(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/aapl").json()
        assert body["removed"] == "AAPL"

    def test_lowercase_input_normalised(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            client.delete("/api/watchlist/msft")
        select_calls = [c for c in db.executed if c[0] == "fetch_one"]
        assert select_calls[0][2] == ("MSFT",)

    def test_delete_execute_called(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            client.delete("/api/watchlist/AAPL")
        delete_calls = [c for c in db.executed if c[0] == "execute" and "DELETE" in c[1]]
        assert len(delete_calls) == 1

    def test_invalid_symbol_returns_400(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.delete("/api/watchlist/!@#$")
        assert resp.status_code == 400

    def test_too_long_symbol_returns_400(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.delete("/api/watchlist/" + "A" * 11)
        assert resp.status_code == 400

    def test_dot_symbol_accepted(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            resp = client.delete("/api/watchlist/BRK.B")
        assert resp.status_code == 200

    def test_hyphen_symbol_accepted(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            resp = client.delete("/api/watchlist/BF-B")
        assert resp.status_code == 200


# ===================================================================
# PUT /api/watchlist/reorder
# ===================================================================

class TestReorderWatchlist:
    """Reorder: success, mismatches, duplicates, edge cases."""

    def _reorder_db(self, current_symbols, price_signal_pairs=None):
        """Build DB mock for reorder tests.

        fetch_all call 1: current watchlist (for match check)
        Then the reorder returns get_watchlist() which does:
          fetch_all call 2: full watchlist rows (for response)
          + enrichment fetch_one pairs per ticker
        """
        current_rows = [{"symbol": s} for s in current_symbols]
        full_rows = [
            _make_watchlist_row(symbol=s, sort_order=i)
            for i, s in enumerate(current_symbols)
        ]
        enrichment = price_signal_pairs or [None, None] * len(current_symbols)
        return MockDatabase(
            fetch_all_results=[current_rows, full_rows],
            fetch_one_results=enrichment,
        )

    def test_successful_reorder_returns_200(self):
        db = self._reorder_db(["AAPL", "MSFT"])
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder", json={"order": ["MSFT", "AAPL"]}
            )
        assert resp.status_code == 200

    def test_reorder_returns_tickers(self):
        db = self._reorder_db(["AAPL", "MSFT"])
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["MSFT", "AAPL"]}
            ).json()
        assert "tickers" in body

    def test_reorder_returns_count(self):
        db = self._reorder_db(["AAPL", "MSFT"])
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["MSFT", "AAPL"]}
            ).json()
        assert body["count"] == 2

    def test_executemany_called_with_positions(self):
        db = self._reorder_db(["AAPL", "MSFT", "GOOG"])
        with _patch_db(db):
            client.put(
                "/api/watchlist/reorder",
                json={"order": ["GOOG", "AAPL", "MSFT"]},
            )
        em_calls = [c for c in db.executed if c[0] == "executemany"]
        assert len(em_calls) == 1
        params = em_calls[0][2]
        assert (0, "GOOG") in params
        assert (1, "AAPL") in params
        assert (2, "MSFT") in params

    def test_extra_symbols_returns_400(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}]],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL", "MSFT"]}
            )
        assert resp.status_code == 400

    def test_extra_symbols_error_message(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}]],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL", "MSFT"]}
            ).json()
        assert "does not match" in body["error"].lower()

    def test_missing_symbols_returns_400(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}, {"symbol": "MSFT"}]],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL"]}
            )
        assert resp.status_code == 400

    def test_missing_symbols_error_message(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}, {"symbol": "MSFT"}]],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL"]}
            ).json()
        assert "does not match" in body["error"].lower()

    def test_empty_order_with_items_returns_400(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}]],
        )
        with _patch_db(db):
            resp = client.put("/api/watchlist/reorder", json={"order": []})
        assert resp.status_code == 400

    def test_duplicates_in_order_returns_400(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}, {"symbol": "MSFT"}]],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder",
                json={"order": ["AAPL", "AAPL", "MSFT"]},
            )
        assert resp.status_code == 400

    def test_duplicates_error_message(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}, {"symbol": "MSFT"}]],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder",
                json={"order": ["AAPL", "AAPL", "MSFT"]},
            ).json()
        assert "duplicate" in body["error"].lower()

    def test_empty_watchlist_empty_order_succeeds(self):
        db = MockDatabase(
            fetch_all_results=[[], []],
        )
        with _patch_db(db):
            resp = client.put("/api/watchlist/reorder", json={"order": []})
        assert resp.status_code == 200

    def test_single_ticker_reorder(self):
        db = self._reorder_db(["AAPL"])
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL"]}
            )
        assert resp.status_code == 200

    def test_reorder_lowercase_normalised_to_upper(self):
        db = self._reorder_db(["AAPL", "MSFT"])
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder", json={"order": ["msft", "aapl"]}
            )
        assert resp.status_code == 200

    def test_reorder_preserves_enrichment(self):
        rows = [
            _make_watchlist_row(symbol="AAPL", sort_order=0),
            _make_watchlist_row(symbol="MSFT", sort_order=1),
        ]
        current_rows = [{"symbol": "AAPL"}, {"symbol": "MSFT"}]
        price = _make_price_row(close=300.0, open_val=295.0)
        db = MockDatabase(
            fetch_all_results=[current_rows, rows],
            fetch_one_results=[price, None, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL", "MSFT"]}
            ).json()
        assert body["tickers"][0]["last_price"] == 300.0

    def test_reorder_max_allowed_in_response(self):
        db = self._reorder_db(["AAPL"])
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["AAPL"]}
            ).json()
        assert body["max_allowed"] == 50

    def test_reorder_groups_in_response(self):
        rows = [
            _make_watchlist_row(symbol="AAPL", group_name="tech", sort_order=0),
            _make_watchlist_row(symbol="XOM", group_name="energy", sort_order=1),
        ]
        current_rows = [{"symbol": "AAPL"}, {"symbol": "XOM"}]
        db = MockDatabase(
            fetch_all_results=[current_rows, rows],
            fetch_one_results=[None, None, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": ["XOM", "AAPL"]}
            ).json()
        assert "groups" in body
        assert sorted(body["groups"]) == ["energy", "tech"]


# ===================================================================
# PUT /api/watchlist/{symbol}/group
# ===================================================================

class TestChangeGroup:
    """Change group: success, not found, validation."""

    def _group_change_db(self, exists=True, group="tech"):
        """Mock DB for group change.

        fetch_one sequence:
          1. SELECT id WHERE symbol -- existence check
          2. (execute UPDATE -- no return)
          3. SELECT updated row -- for enriched response
          4. price_cache enrichment
          5. analysis_results enrichment
        """
        exist_row = {"id": 1} if exists else None
        updated_row = _make_watchlist_row(symbol="AAPL", group_name=group)
        if exists:
            return MockDatabase(
                fetch_one_results=[exist_row, updated_row, None, None],
            )
        return MockDatabase(fetch_one_results=[exist_row])

    def test_successful_group_change_returns_200(self):
        db = self._group_change_db(exists=True, group="tech")
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            )
        assert resp.status_code == 200

    def test_successful_group_change_body(self):
        db = self._group_change_db(exists=True, group="tech")
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            ).json()
        assert body["group"] == "tech"

    def test_group_change_returns_symbol(self):
        db = self._group_change_db(exists=True)
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            ).json()
        assert body["symbol"] == "AAPL"

    def test_not_found_returns_404(self):
        db = self._group_change_db(exists=False)
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/ZZZZ/group", json={"group": "tech"}
            )
        assert resp.status_code == 404

    def test_not_found_error_message(self):
        db = self._group_change_db(exists=False)
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/ZZZZ/group", json={"group": "tech"}
            ).json()
        assert "not in watchlist" in body["error"].lower()

    def test_group_name_preserved(self):
        db = self._group_change_db(exists=True, group="my-portfolio")
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "my-portfolio"}
            ).json()
        assert body["group"] == "my-portfolio"

    def test_invalid_symbol_returns_400(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/AAAAAAAAAAA/group", json={"group": "tech"}
            )
        assert resp.status_code == 400

    def test_empty_group_name_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/AAPL/group", json={"group": ""}
            )
        assert resp.status_code == 422

    def test_whitespace_group_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/AAPL/group", json={"group": "   "}
            )
        assert resp.status_code == 422

    def test_missing_group_field_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put("/api/watchlist/AAPL/group", json={})
        assert resp.status_code == 422

    def test_group_change_enrichment_price(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        price = _make_price_row(close=220.0, open_val=215.0)
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, price, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            ).json()
        assert body["last_price"] == 220.0

    def test_group_change_enrichment_signal(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        signal = _make_signal_row(direction="neutral", confidence=0.5)
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, signal],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            ).json()
        assert body["last_composite_signal"] == "neutral"
        assert body["last_composite_confidence"] == 0.5

    def test_lowercase_symbol_normalised(self):
        db = self._group_change_db(exists=True, group="tech")
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/aapl/group", json={"group": "tech"}
            )
        assert resp.status_code == 200

    def test_group_name_whitespace_stripped(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            client.put(
                "/api/watchlist/AAPL/group", json={"group": "  tech  "}
            )
        update_calls = [
            c for c in db.executed if c[0] == "execute" and "UPDATE" in c[1]
        ]
        assert len(update_calls) == 1
        assert update_calls[0][2][0] == "tech"


# ===================================================================
# SYMBOL NORMALIZATION (CROSS-ENDPOINT)
# ===================================================================

class TestSymbolNormalization:
    """Lowercase, whitespace, and casing across all endpoints."""

    def test_post_lowercase_normalised(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="MSFT"), None, None,
            ],
        )
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "msft"}).json()
        assert body["symbol"] == "MSFT"

    def test_post_whitespace_trimmed(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            body = client.post(
                "/api/watchlist/", json={"symbol": "  aapl  "}
            ).json()
        assert body["symbol"] == "AAPL"

    def test_delete_lowercase_normalised(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/aapl").json()
        assert body["removed"] == "AAPL"

    def test_delete_mixed_case_normalised(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AaPl").json()
        assert body["removed"] == "AAPL"

    def test_group_change_lowercase_symbol(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/aapl/group", json={"group": "tech"}
            )
        assert resp.status_code == 200

    def test_reorder_mixed_case_normalised(self):
        current_rows = [{"symbol": "AAPL"}, {"symbol": "MSFT"}]
        full_rows = [
            _make_watchlist_row(symbol="AAPL", sort_order=0),
            _make_watchlist_row(symbol="MSFT", sort_order=1),
        ]
        db = MockDatabase(
            fetch_all_results=[current_rows, full_rows],
            fetch_one_results=[None, None, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder",
                json={"order": ["Msft", "Aapl"]},
            )
        assert resp.status_code == 200

    def test_post_symbol_with_leading_trailing_spaces(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="GOOG"), None, None,
            ],
        )
        with _patch_db(db):
            body = client.post(
                "/api/watchlist/", json={"symbol": "   goog   "}
            ).json()
        assert body["symbol"] == "GOOG"

    def test_delete_symbol_query_uses_cleaned(self):
        """The DB query should use the cleaned (uppercased) symbol."""
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            client.delete("/api/watchlist/msft")
        fetch_calls = [c for c in db.executed if c[0] == "fetch_one"]
        assert fetch_calls[0][2] == ("MSFT",)

    def test_post_db_insert_uses_cleaned_symbol(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="TSLA"), None, None,
            ],
        )
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "  tsla  "})
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert insert_calls[0][2][0] == "TSLA"


# ===================================================================
# CONCURRENT OPERATIONS
# ===================================================================

class TestConcurrentOperations:
    """Multi-step operational sequences."""

    def test_add_then_list_shows_ticker(self):
        # Add: success
        add_db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(add_db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

        # List: shows the ticker
        list_db = MockDatabase(
            fetch_all_results=[[_make_watchlist_row(symbol="AAPL")]],
            fetch_one_results=[None, None],
        )
        with _patch_db(list_db):
            body = client.get("/api/watchlist/").json()
        assert len(body["tickers"]) == 1
        assert body["tickers"][0]["symbol"] == "AAPL"

    def test_add_then_delete_then_list_empty(self):
        # Add
        add_db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(add_db):
            client.post("/api/watchlist/", json={"symbol": "AAPL"})

        # Delete
        del_db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(del_db):
            client.delete("/api/watchlist/AAPL")

        # List: empty
        list_db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(list_db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"] == []

    def test_multiple_adds_increment_sort_order(self):
        # First add: sort_order=0
        db1 = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", sort_order=0),
                None, None,
            ],
        )
        with _patch_db(db1):
            body1 = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert body1["position"] == 0

        # Second add: sort_order=1
        db2 = MockDatabase(
            fetch_one_results=[
                {"cnt": 1}, None, {"max_pos": 0},
                _make_watchlist_row(symbol="MSFT", sort_order=1),
                None, None,
            ],
        )
        with _patch_db(db2):
            body2 = client.post("/api/watchlist/", json={"symbol": "MSFT"}).json()
        assert body2["position"] == 1

        # Third add: sort_order=2
        db3 = MockDatabase(
            fetch_one_results=[
                {"cnt": 2}, None, {"max_pos": 1},
                _make_watchlist_row(symbol="GOOG", sort_order=2),
                None, None,
            ],
        )
        with _patch_db(db3):
            body3 = client.post("/api/watchlist/", json={"symbol": "GOOG"}).json()
        assert body3["position"] == 2

    def test_add_duplicate_after_initial_add(self):
        # First add succeeds
        db1 = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db1):
            resp1 = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp1.status_code == 201

        # Second add of same symbol: duplicate
        db2 = MockDatabase(
            fetch_one_results=[{"cnt": 1}, {"id": 1}],
        )
        with _patch_db(db2):
            resp2 = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp2.status_code == 409

    def test_delete_then_re_add(self):
        # Delete existing
        del_db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(del_db):
            resp = client.delete("/api/watchlist/AAPL")
        assert resp.status_code == 200

        # Re-add
        add_db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(add_db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_reorder_then_list_matches(self):
        rows = [
            _make_watchlist_row(symbol="MSFT", sort_order=0),
            _make_watchlist_row(symbol="AAPL", sort_order=1),
        ]
        current_rows = [{"symbol": "AAPL"}, {"symbol": "MSFT"}]
        db = MockDatabase(
            fetch_all_results=[current_rows, rows],
            fetch_one_results=[None, None, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder",
                json={"order": ["MSFT", "AAPL"]},
            ).json()
        assert body["count"] == 2

    def test_change_group_then_list_shows_new_group(self):
        # Change group
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="new-group")
        db1 = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db1):
            resp = client.put(
                "/api/watchlist/AAPL/group", json={"group": "new-group"}
            )
        assert resp.status_code == 200

        # List shows new group
        list_db = MockDatabase(
            fetch_all_results=[[_make_watchlist_row(symbol="AAPL", group_name="new-group")]],
            fetch_one_results=[None, None],
        )
        with _patch_db(list_db):
            body = client.get("/api/watchlist/").json()
        assert "new-group" in body["groups"]


# ===================================================================
# EDGE CASES
# ===================================================================

class TestEdgeCases:
    """Boundary conditions and unusual inputs."""

    def test_very_long_group_name_rejected(self):
        long_name = "a" * 200
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post(
                "/api/watchlist/",
                json={"symbol": "AAPL", "group": long_name},
            )
        assert resp.status_code == 422

    def test_max_length_group_name_accepted(self):
        max_name = "a" * 100
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name=max_name),
                None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post(
                "/api/watchlist/",
                json={"symbol": "AAPL", "group": max_name},
            )
        assert resp.status_code == 201

    def test_group_name_with_special_characters(self):
        special = "my-portfolio_2026 (tech)"
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name=special),
                None, None,
            ],
        )
        with _patch_db(db):
            body = client.post(
                "/api/watchlist/",
                json={"symbol": "AAPL", "group": special},
            ).json()
        assert body["group"] == special

    def test_group_name_with_unicode(self):
        unicode_name = "portfolio-\u00e9\u00e8\u00ea"
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name=unicode_name),
                None, None,
            ],
        )
        with _patch_db(db):
            body = client.post(
                "/api/watchlist/",
                json={"symbol": "AAPL", "group": unicode_name},
            ).json()
        assert body["group"] == unicode_name

    def test_symbol_with_dots_brk_b(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="BRK.B"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "BRK.B"})
        assert resp.status_code == 201

    def test_symbol_with_hyphens_bf_b(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="BF-B"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "BF-B"})
        assert resp.status_code == 201

    def test_49th_symbol_succeeds(self):
        """Adding 49th symbol (count=48) should succeed."""
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 48}, None, {"max_pos": 47},
                _make_watchlist_row(symbol="AAPL", sort_order=48),
                None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_50th_symbol_succeeds(self):
        """Adding 50th symbol (count=49) should still succeed."""
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 49}, None, {"max_pos": 48},
                _make_watchlist_row(symbol="AAPL", sort_order=49),
                None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 201

    def test_51st_symbol_fails(self):
        """Adding 51st symbol (count=50) should fail with 400."""
        db = MockDatabase(
            fetch_one_results=[{"cnt": 50}],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AAPL"})
        assert resp.status_code == 400

    def test_price_change_pct_open_zero(self):
        """Division by zero: open=0 should yield None for price_change_percent."""
        price = _make_price_row(close=100.0, open_val=0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] is None

    def test_price_change_pct_open_none(self):
        """open=None should yield None for price_change_percent."""
        price = {"close": 100.0, "open": None}
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] is None

    def test_price_change_pct_close_none(self):
        """close=None should yield None for last_price and price_change_percent."""
        price = {"close": None, "open": 100.0}
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        t = body["tickers"][0]
        assert t["last_price"] is None
        assert t["price_change_percent"] is None

    def test_price_change_pct_zero_close_zero_open(self):
        """Both close=0 and open=0: open=0 triggers division guard."""
        price = _make_price_row(close=0, open_val=0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        # open=0 means we skip the division, so pct is None
        assert body["tickers"][0]["price_change_percent"] is None

    def test_price_zero_close_nonzero_open(self):
        """close=0 but open is nonzero: price_change_percent should compute as -100."""
        price = _make_price_row(close=0.0, open_val=100.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        # (0 - 100) / 100 * 100 = -100.0
        assert body["tickers"][0]["price_change_percent"] == -100.0

    def test_reorder_same_order_no_op(self):
        """Reorder with current order should succeed (no-op)."""
        db = MockDatabase(
            fetch_all_results=[
                [{"symbol": "AAPL"}, {"symbol": "MSFT"}],
                [
                    _make_watchlist_row(symbol="AAPL", sort_order=0),
                    _make_watchlist_row(symbol="MSFT", sort_order=1),
                ],
            ],
            fetch_one_results=[None, None, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder",
                json={"order": ["AAPL", "MSFT"]},
            )
        assert resp.status_code == 200

    def test_price_change_pct_positive_rounding(self):
        """Verify rounding to 3 decimal places."""
        # (185.42 - 184.25) / 184.25 * 100 = 0.634877...
        price = _make_price_row(close=185.42, open_val=184.25)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        pct = body["tickers"][0]["price_change_percent"]
        assert pct is not None
        # Check it's rounded to at most 3 decimal places
        assert pct == round(pct, 3)

    def test_enrichment_with_zero_close_is_not_none(self):
        """close=0 is falsy but should still be returned as last_price (using is not None)."""
        price = _make_price_row(close=0.0, open_val=50.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        # close=0.0 should still be returned (not treated as None)
        # The implementation uses `if last_price is not None` so 0.0 passes
        assert body["tickers"][0]["last_price"] is not None
        assert body["tickers"][0]["last_price"] == 0.0

    def test_enrichment_with_zero_confidence(self):
        """confidence=0.0 is falsy but should still be returned."""
        signal = _make_signal_row(direction="neutral", confidence=0.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, signal],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_composite_confidence"] == 0.0

    def test_ten_char_symbol_accepted(self):
        """Maximum length symbol (10 chars) should be accepted."""
        sym = "ABCDEFGHIJ"
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol=sym), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": sym})
        assert resp.status_code == 201

    def test_eleven_char_symbol_rejected(self):
        """11-char symbol should be rejected."""
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "ABCDEFGHIJK"})
        assert resp.status_code == 422


# ===================================================================
# RESPONSE SHAPE
# ===================================================================

class TestResponseShape:
    """Validate exact response field names and structure."""

    _GET_TOP_KEYS = {"tickers", "count", "max_allowed", "groups"}
    _TICKER_KEYS = {
        "symbol", "group", "added_at", "position",
        "last_price", "price_change_percent",
        "last_composite_signal", "last_composite_confidence",
        "last_updated",
    }

    def test_get_response_top_level_keys(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert set(body.keys()) == self._GET_TOP_KEYS

    def test_get_ticker_keys(self):
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert set(body["tickers"][0].keys()) == self._TICKER_KEYS

    def test_post_response_keys(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        assert set(body.keys()) == self._TICKER_KEYS

    def test_delete_response_keys(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AAPL").json()
        assert set(body.keys()) == {"removed"}

    def test_put_group_response_keys(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "tech"}
            ).json()
        assert set(body.keys()) == self._TICKER_KEYS

    def test_reorder_response_top_level_keys(self):
        db = MockDatabase(
            fetch_all_results=[[], []],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder", json={"order": []}
            ).json()
        assert set(body.keys()) == self._GET_TOP_KEYS

    def test_get_tickers_is_list(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert isinstance(body["tickers"], list)

    def test_get_groups_is_list(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert isinstance(body["groups"], list)

    def test_get_count_is_integer(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert isinstance(body["count"], int)

    def test_get_max_allowed_is_integer(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert isinstance(body["max_allowed"], int)

    def test_delete_removed_is_string(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AAPL").json()
        assert isinstance(body["removed"], str)

    def test_error_response_has_error_key(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AAPL").json()
        assert "error" in body

    def test_error_response_has_status_code_key(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            body = client.delete("/api/watchlist/AAPL").json()
        assert "status_code" in body


# ===================================================================
# ERROR MESSAGES DO NOT REFLECT INPUT (XSS PREVENTION)
# ===================================================================

class TestXssPrevention:
    """Error messages must NEVER echo user input."""

    def test_delete_404_does_not_echo_symbol(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            body = client.delete("/api/watchlist/NONEXIST").json()
        # Should NOT contain the actual symbol in the error
        assert "NONEXIST" not in body["error"]

    def test_duplicate_409_does_not_echo_symbol(self):
        db = MockDatabase(
            fetch_one_results=[{"cnt": 5}, {"id": 1}],
        )
        with _patch_db(db):
            body = client.post("/api/watchlist/", json={"symbol": "AAPL"}).json()
        # The detail says "Symbol already in watchlist" -- generic, no echo of "AAPL"
        assert "AAPL" not in body["error"]

    def test_group_change_404_does_not_echo_symbol(self):
        db = MockDatabase(fetch_one_results=[None])
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/BADTICKER/group", json={"group": "tech"}
            ).json()
        assert "BADTICKER" not in body["error"]


# ===================================================================
# ADDITIONAL ENRICHMENT EDGE CASES
# ===================================================================

class TestEnrichmentEdgeCases:
    """Fine-grained enrichment logic for price and signal data."""

    def test_price_row_missing_close_key(self):
        """Price row without 'close' key should yield None."""
        price = {"open": 100.0}  # no 'close' key
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_price"] is None

    def test_price_row_missing_open_key(self):
        """Price row without 'open' key should still return close."""
        price = {"close": 150.0}  # no 'open' key
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_price"] == 150.0
        assert body["tickers"][0]["price_change_percent"] is None

    def test_signal_row_missing_direction(self):
        """Signal row without 'direction' key should yield None."""
        signal = {"confidence": 0.8}
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, signal],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_composite_signal"] is None

    def test_signal_row_missing_confidence(self):
        """Signal row without 'confidence' key should yield None."""
        signal = {"direction": "bullish"}
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, signal],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["last_composite_confidence"] is None

    def test_negative_price_change(self):
        """Price drop should yield negative percentage."""
        price = _make_price_row(close=90.0, open_val=100.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] == -10.0

    def test_no_price_change(self):
        """Same open and close should yield 0.0 percent."""
        price = _make_price_row(close=100.0, open_val=100.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] == 0.0

    def test_large_price_change(self):
        """Very large swing should compute correctly."""
        price = _make_price_row(close=500.0, open_val=100.0)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["price_change_percent"] == 400.0

    def test_enrichment_both_present(self):
        """Both price and signal present simultaneously."""
        price = _make_price_row(close=200.0, open_val=190.0)
        signal = _make_signal_row(direction="bullish", confidence=0.95)
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[price, signal],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        t = body["tickers"][0]
        assert t["last_price"] == 200.0
        assert t["last_composite_signal"] == "bullish"
        assert t["last_composite_confidence"] == 0.95
        pct = t["price_change_percent"]
        assert pct is not None
        expected = round((200.0 - 190.0) / 190.0 * 100, 3)
        assert pct == expected

    def test_enrichment_multiple_tickers_independent(self):
        """Each ticker gets its own enrichment data independently."""
        rows = [
            _make_watchlist_row(symbol="AAPL", sort_order=0),
            _make_watchlist_row(symbol="MSFT", sort_order=1),
        ]
        price_aapl = _make_price_row(close=150.0, open_val=145.0)
        signal_msft = _make_signal_row(direction="bearish", confidence=0.65)
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[
                price_aapl, None,    # AAPL: price yes, signal no
                None, signal_msft,   # MSFT: price no, signal yes
            ],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        aapl = body["tickers"][0]
        msft = body["tickers"][1]
        assert aapl["last_price"] == 150.0
        assert aapl["last_composite_signal"] is None
        assert msft["last_price"] is None
        assert msft["last_composite_signal"] == "bearish"


# ===================================================================
# ADDITIONAL REORDER EDGE CASES
# ===================================================================

class TestReorderEdgeCases:
    """Additional reorder boundary conditions."""

    def test_reorder_three_items_all_shuffled(self):
        current_rows = [{"symbol": "A"}, {"symbol": "B"}, {"symbol": "C"}]
        full_rows = [
            _make_watchlist_row(symbol="C", sort_order=0),
            _make_watchlist_row(symbol="A", sort_order=1),
            _make_watchlist_row(symbol="B", sort_order=2),
        ]
        db = MockDatabase(
            fetch_all_results=[current_rows, full_rows],
            fetch_one_results=[None, None, None, None, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder",
                json={"order": ["C", "A", "B"]},
            )
        assert resp.status_code == 200

    def test_reorder_swapped_pair(self):
        current_rows = [{"symbol": "X"}, {"symbol": "Y"}]
        full_rows = [
            _make_watchlist_row(symbol="Y", sort_order=0),
            _make_watchlist_row(symbol="X", sort_order=1),
        ]
        db = MockDatabase(
            fetch_all_results=[current_rows, full_rows],
            fetch_one_results=[None, None, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder",
                json={"order": ["Y", "X"]},
            ).json()
        assert body["tickers"][0]["symbol"] == "Y"
        assert body["tickers"][1]["symbol"] == "X"

    def test_reorder_with_completely_new_symbol_returns_400(self):
        """Order includes a symbol not in watchlist."""
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}]],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/reorder",
                json={"order": ["NEWONE"]},
            )
        assert resp.status_code == 400

    def test_reorder_with_both_missing_and_extra(self):
        db = MockDatabase(
            fetch_all_results=[[{"symbol": "AAPL"}, {"symbol": "MSFT"}]],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/reorder",
                json={"order": ["AAPL", "GOOG"]},
            ).json()
        assert "does not match" in body["error"].lower()

    def test_reorder_missing_order_field_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put("/api/watchlist/reorder", json={})
        assert resp.status_code == 422


# ===================================================================
# ADDITIONAL DELETE EDGE CASES
# ===================================================================

class TestDeleteEdgeCases:
    """More delete boundary conditions."""

    def test_delete_single_char_symbol(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/X").json()
        assert body["removed"] == "X"

    def test_delete_dot_symbol(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/BRK.B").json()
        assert body["removed"] == "BRK.B"

    def test_delete_hyphen_symbol(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/BF-B").json()
        assert body["removed"] == "BF-B"

    def test_delete_ten_char_symbol(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/ABCDEFGHIJ").json()
        assert body["removed"] == "ABCDEFGHIJ"

    def test_delete_numeric_symbol(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            body = client.delete("/api/watchlist/1234").json()
        assert body["removed"] == "1234"


# ===================================================================
# ADDITIONAL GROUP CHANGE EDGE CASES
# ===================================================================

class TestGroupChangeEdgeCases:
    """More group-change boundary conditions."""

    def test_change_group_dot_symbol(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="BRK.B", group_name="value")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/BRK.B/group", json={"group": "value"}
            )
        assert resp.status_code == 200

    def test_change_group_hyphen_symbol(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="BF-B", group_name="spirits")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/BF-B/group", json={"group": "spirits"}
            )
        assert resp.status_code == 200

    def test_change_group_very_long_name_rejected(self):
        long_name = "g" * 300
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/AAPL/group", json={"group": long_name}
            )
        assert resp.status_code == 422

    def test_change_group_max_length_name_accepted(self):
        max_name = "g" * 100
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name=max_name)
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": max_name}
            ).json()
        assert body["group"] == max_name

    def test_change_group_unicode(self):
        unicode_name = "\u6280\u672f\u80a1"
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name=unicode_name)
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": unicode_name}
            ).json()
        assert body["group"] == unicode_name

    def test_change_group_numeric_name(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="2026")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            body = client.put(
                "/api/watchlist/AAPL/group", json={"group": "2026"}
            ).json()
        assert body["group"] == "2026"

    def test_change_group_too_long_symbol_returns_400(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.put(
                "/api/watchlist/" + "A" * 11 + "/group", json={"group": "tech"}
            )
        assert resp.status_code == 400


# ===================================================================
# ADDITIONAL ADD TICKER EDGE CASES
# ===================================================================

class TestAddTickerEdgeCases:
    """More boundary conditions for adding tickers."""

    def test_add_ticker_json_content_type_required(self):
        """Sending non-JSON body should fail."""
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", data="symbol=AAPL")
        assert resp.status_code == 422

    def test_add_ticker_extra_fields_ignored(self):
        """Extra fields in request body should be ignored by Pydantic."""
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            resp = client.post(
                "/api/watchlist/",
                json={"symbol": "AAPL", "extra_field": "ignored"},
            )
        assert resp.status_code == 201

    def test_add_ticker_null_symbol_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": None})
        assert resp.status_code == 422

    def test_add_ticker_numeric_symbol_field_returns_422(self):
        """symbol must be a string, not an integer."""
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": 12345})
        assert resp.status_code == 422

    def test_add_ticker_symbol_with_space_in_middle_returns_422(self):
        """Spaces in middle of symbol should fail: 'AA PL' stripped to 'AA PL', regex fails."""
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "AA PL"})
        assert resp.status_code == 422

    def test_add_ticker_tab_only_symbol_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "\t"})
        assert resp.status_code == 422

    def test_add_ticker_newline_only_symbol_returns_422(self):
        db = MockDatabase()
        with _patch_db(db):
            resp = client.post("/api/watchlist/", json={"symbol": "\n"})
        assert resp.status_code == 422


# ===================================================================
# MANY TICKERS - GET PERFORMANCE/SCALE
# ===================================================================

class TestManyTickers:
    """Verify GET works with many tickers."""

    def test_get_with_ten_tickers(self):
        symbols = [f"SYM{i}" for i in range(10)]
        rows = [
            _make_watchlist_row(symbol=s, sort_order=i, row_id=i + 1)
            for i, s in enumerate(symbols)
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 20,  # 10 tickers * 2 enrichment calls
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["count"] == 10
        assert len(body["tickers"]) == 10

    def test_get_with_fifty_tickers(self):
        symbols = [f"S{i:02d}" for i in range(50)]
        rows = [
            _make_watchlist_row(symbol=s, sort_order=i, row_id=i + 1)
            for i, s in enumerate(symbols)
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 100,  # 50 * 2
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["count"] == 50
        assert body["max_allowed"] == 50

    def test_get_with_multiple_groups_many_tickers(self):
        groups = ["tech", "energy", "finance", "health"]
        rows = [
            _make_watchlist_row(
                symbol=f"S{i}", sort_order=i, group_name=groups[i % 4], row_id=i + 1
            )
            for i in range(20)
        ]
        db = MockDatabase(
            fetch_all_results=[rows],
            fetch_one_results=[None] * 40,
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert len(body["groups"]) == 4
        assert sorted(body["groups"]) == sorted(groups)


# ===================================================================
# SQL TRACKING (VERIFY CORRECT QUERIES)
# ===================================================================

class TestSqlTracking:
    """Verify the correct SQL queries are issued."""

    def test_get_issues_watchlist_select(self):
        db = MockDatabase(fetch_all_results=[[]])
        with _patch_db(db):
            client.get("/api/watchlist/")
        fetch_all_calls = [c for c in db.executed if c[0] == "fetch_all"]
        assert len(fetch_all_calls) >= 1
        assert "watchlist" in fetch_all_calls[0][1].lower()

    def test_get_issues_price_cache_select_per_ticker(self):
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            client.get("/api/watchlist/")
        price_calls = [
            c for c in db.executed
            if c[0] == "fetch_one" and "price_cache" in c[1].lower()
        ]
        assert len(price_calls) == 1

    def test_get_issues_analysis_results_select_per_ticker(self):
        row = _make_watchlist_row()
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            client.get("/api/watchlist/")
        signal_calls = [
            c for c in db.executed
            if c[0] == "fetch_one" and "analysis_results" in c[1].lower()
        ]
        assert len(signal_calls) == 1

    def test_post_issues_count_check(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "AAPL"})
        count_calls = [
            c for c in db.executed
            if c[0] == "fetch_one" and "count" in c[1].lower()
        ]
        assert len(count_calls) == 1

    def test_post_issues_duplicate_check(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL"), None, None,
            ],
        )
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "AAPL"})
        dup_calls = [
            c for c in db.executed
            if c[0] == "fetch_one" and "symbol" in c[1].lower() and "select" in c[1].lower()
            and "count" not in c[1].lower() and "max" not in c[1].lower()
        ]
        assert len(dup_calls) >= 1

    def test_delete_issues_existence_check(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            client.delete("/api/watchlist/AAPL")
        select_calls = [c for c in db.executed if c[0] == "fetch_one"]
        assert len(select_calls) >= 1

    def test_delete_issues_delete_statement(self):
        db = MockDatabase(fetch_one_results=[{"id": 1}])
        with _patch_db(db):
            client.delete("/api/watchlist/AAPL")
        del_calls = [c for c in db.executed if c[0] == "execute" and "DELETE" in c[1]]
        assert len(del_calls) == 1

    def test_reorder_issues_executemany(self):
        db = MockDatabase(
            fetch_all_results=[
                [{"symbol": "A"}],
                [_make_watchlist_row(symbol="A")],
            ],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            client.put("/api/watchlist/reorder", json={"order": ["A"]})
        em_calls = [c for c in db.executed if c[0] == "executemany"]
        assert len(em_calls) == 1

    def test_group_change_issues_update(self):
        exist_row = {"id": 1}
        updated_row = _make_watchlist_row(symbol="AAPL", group_name="tech")
        db = MockDatabase(
            fetch_one_results=[exist_row, updated_row, None, None],
        )
        with _patch_db(db):
            client.put("/api/watchlist/AAPL/group", json={"group": "tech"})
        update_calls = [c for c in db.executed if c[0] == "execute" and "UPDATE" in c[1]]
        assert len(update_calls) == 1


# ===================================================================
# DEFAULT VALUES
# ===================================================================

class TestDefaultValues:
    """Verify default field values when data is partial."""

    def test_default_group_in_get_response(self):
        row = _make_watchlist_row(group_name="default")
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["group"] == "default"

    def test_row_missing_group_name_defaults(self):
        """Row without group_name key should default to 'default'."""
        row = {
            "id": 1, "symbol": "AAPL", "sort_order": 0,
            "added_at": "2026-01-01", "updated_at": "2026-01-01",
        }
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["group"] == "default"

    def test_row_missing_sort_order_defaults_to_zero(self):
        """Row without sort_order key should default to 0."""
        row = {
            "id": 1, "symbol": "AAPL", "group_name": "default",
            "added_at": "2026-01-01", "updated_at": "2026-01-01",
        }
        db = MockDatabase(
            fetch_all_results=[[row]],
            fetch_one_results=[None, None],
        )
        with _patch_db(db):
            body = client.get("/api/watchlist/").json()
        assert body["tickers"][0]["position"] == 0

    def test_post_without_group_uses_default(self):
        db = MockDatabase(
            fetch_one_results=[
                {"cnt": 0}, None, {"max_pos": None},
                _make_watchlist_row(symbol="AAPL", group_name="default"),
                None, None,
            ],
        )
        with _patch_db(db):
            client.post("/api/watchlist/", json={"symbol": "AAPL"})
        insert_calls = [c for c in db.executed if c[0] == "execute" and "INSERT" in c[1]]
        assert insert_calls[0][2][1] == "default"
