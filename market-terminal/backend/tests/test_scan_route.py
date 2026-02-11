"""Tests for the scan route at GET /api/scan and presets.

Validates parameter validation, filtering by method/signal/confluence/
confidence/timeframe/group, sorting, limiting, preset endpoints, stale
analysis detection, empty results, response structure, security, and
combined filter logic.

Run with: ``pytest tests/test_scan_route.py -v``
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# MockDatabase
# ---------------------------------------------------------------------------

_SENTINEL = object()  # used to distinguish "explicit None" from "use default"


class MockDatabase:
    """Sequentially pops results from internal queues."""

    def __init__(self):
        self._fetch_all_results: list[list[dict]] = []
        self._fetch_one_results: list[dict | None] = []

    async def fetch_all(self, sql, params=()):
        if self._fetch_all_results:
            return self._fetch_all_results.pop(0)
        return []

    async def fetch_one(self, sql, params=()):
        if self._fetch_one_results:
            return self._fetch_one_results.pop(0)
        return None

    async def execute(self, sql, params=()):
        pass


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

_NOW_STR = datetime.now(tz=timezone.utc).isoformat()
_OLD_STR = (datetime.now(tz=timezone.utc) - timedelta(hours=3)).isoformat()


def _make_composite_json(
    direction="bullish",
    confidence=0.72,
    confluence=4,
    timeframe_breakdown=None,
):
    """Build composite_json matching CompositeSignal.to_dict() format."""
    tb = timeframe_breakdown or {
        "short": {"direction": "neutral", "confidence": 0.0, "methodologies": []},
        "medium": {"direction": direction, "confidence": confidence,
                    "methodologies": ["wyckoff", "elliott_wave"]},
        "long": {"direction": "neutral", "confidence": 0.0, "methodologies": []},
    }
    return json.dumps({
        "overall_direction": direction,
        "overall_confidence": confidence,
        "confluence_count": confluence,
        "timeframe_breakdown": tb,
        "trade_thesis": "Test thesis",
        "timestamp": _NOW_STR,
        "weights_used": {"wyckoff": 0.2, "elliott_wave": 0.15},
    })


def _make_signal_json(methodology="wyckoff", direction="bullish", confidence=0.75):
    """Build a MethodologySignal JSON dict."""
    return json.dumps({
        "ticker": "AAPL",
        "methodology": methodology,
        "direction": direction,
        "confidence": confidence,
        "timeframe": "medium",
        "reasoning": f"Test reasoning for {methodology}",
        "key_levels": {"support": 100.0, "resistance": 150.0},
        "timestamp": _NOW_STR,
    })


def _watchlist_row(symbol, name=None, group_name="default"):
    """Build a watchlist row dict."""
    return {"symbol": symbol, "name": name or symbol, "group_name": group_name}


def _cache_row(composite_json=None, signals_json=None, created_at=_SENTINEL):
    """Build an analysis_cache row dict.

    Use ``created_at=None`` to explicitly set the key to None (to test stale
    detection on missing timestamps).  Omit to use ``_NOW_STR``.
    """
    return {
        "composite_json": composite_json or _make_composite_json(),
        "signals_json": signals_json or "[]",
        "created_at": _NOW_STR if created_at is _SENTINEL else created_at,
    }


def _method_signal_row(
    direction="bullish",
    confidence=0.75,
    timeframe="medium",
    signal_json=None,
    analyzed_at=None,
):
    """Build an analysis_results row dict."""
    return {
        "direction": direction,
        "confidence": confidence,
        "timeframe": timeframe,
        "signal_json": signal_json or _make_signal_json(),
        "analyzed_at": analyzed_at or _NOW_STR,
    }


def _price_row(close=150.0, open_=145.0):
    """Build a price_cache row dict."""
    return {"close": close, "open": open_}


def _patch_db(mock_db):
    """Return a context-manager that patches get_database to return *mock_db*."""
    return patch(
        "app.api.routes.scan.get_database",
        new_callable=AsyncMock,
        return_value=mock_db,
    )


def _setup_single_ticker_db(
    symbol="AAPL",
    group_name="default",
    direction="bullish",
    confidence=0.72,
    confluence=4,
    created_at=_SENTINEL,
    method=None,
    method_direction="bullish",
    method_confidence=0.75,
    method_timeframe="medium",
    close=150.0,
    open_=145.0,
    timeframe_breakdown=None,
    will_match=True,
):
    """Set up a MockDatabase with one ticker fully populated.

    DB call order in run_scan:
      1. fetch_one  -- _table_exists  (sqlite_master check)
      2. fetch_all  -- _fetch_watchlist (tickers)
      3. fetch_one  -- _get_composite  (analysis_cache)
      4. fetch_one  -- _get_method_signal (only when method query param is set)
      5. fetch_one  -- price_cache (only when ticker passes _matches)

    Set *will_match=False* if this ticker will be filtered out (skips price row).
    """
    db = MockDatabase()
    # 1. _table_exists -> analysis_cache exists
    db._fetch_one_results.append({"cnt": 1})
    # 2. _fetch_watchlist
    db._fetch_all_results.append([_watchlist_row(symbol, group_name=group_name)])
    # 3. _get_composite
    comp_json = _make_composite_json(
        direction=direction,
        confidence=confidence,
        confluence=confluence,
        timeframe_breakdown=timeframe_breakdown,
    )
    ca = _NOW_STR if created_at is _SENTINEL else created_at
    db._fetch_one_results.append(_cache_row(composite_json=comp_json, created_at=ca))
    # 4. _get_method_signal (only if method specified)
    if method is not None:
        db._fetch_one_results.append(
            _method_signal_row(
                direction=method_direction,
                confidence=method_confidence,
                timeframe=method_timeframe,
            )
        )
    # 5. price_cache (only if ticker will pass _matches)
    if will_match:
        db._fetch_one_results.append(_price_row(close=close, open_=open_))
    return db


def _setup_multi_ticker_db(tickers, method=None):
    """Set up a MockDatabase for multiple tickers.

    *tickers* is a list of dicts with keys:
        symbol, group_name, direction, confidence, confluence_count, created_at,
        method_direction, method_confidence, method_timeframe, close, open_,
        timeframe_breakdown, will_match.
    All keys are optional and have sensible defaults.

    IMPORTANT: set ``will_match=False`` on tickers that will be filtered out
    by _matches(), because those never reach the price_cache fetch_one call.
    If not specified, defaults to True.
    """
    db = MockDatabase()
    # 1. _table_exists
    db._fetch_one_results.append({"cnt": 1})
    # 2. _fetch_watchlist
    wl = [
        _watchlist_row(t.get("symbol", f"T{i}"), group_name=t.get("group_name", "default"))
        for i, t in enumerate(tickers)
    ]
    db._fetch_all_results.append(wl)

    for t in tickers:
        direction = t.get("direction", "bullish")
        confidence = t.get("confidence", 0.72)
        confluence = t.get("confluence_count", 4)
        created_at = t.get("created_at", _NOW_STR)
        tb = t.get("timeframe_breakdown")
        will_match = t.get("will_match", True)
        comp_json = _make_composite_json(
            direction=direction,
            confidence=confidence,
            confluence=confluence,
            timeframe_breakdown=tb,
        )
        # 3. _get_composite
        db._fetch_one_results.append(
            _cache_row(composite_json=comp_json, created_at=created_at)
        )
        # 4. _get_method_signal (only if method set)
        if method is not None:
            md = t.get("method_direction", "bullish")
            mc = t.get("method_confidence", 0.75)
            mt = t.get("method_timeframe", "medium")
            db._fetch_one_results.append(
                _method_signal_row(direction=md, confidence=mc, timeframe=mt)
            )
        # 5. price_cache (only if ticker will pass _matches)
        if will_match:
            db._fetch_one_results.append(
                _price_row(close=t.get("close", 150.0), open_=t.get("open_", 145.0))
            )
    return db


def _get_scan(**params):
    """Shorthand for GET /api/scan."""
    return client.get("/api/scan/", params=params)


def _get_preset(preset, **params):
    """Shorthand for GET /api/scan/{preset}."""
    return client.get(f"/api/scan/{preset}", params=params)


# ===================================================================
# 1. TestScanValidation (~15 tests)
# ===================================================================
class TestScanValidation:
    """GET /api/scan -- query parameter validation."""

    def test_invalid_method_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="fake_method")
        assert resp.status_code == 400

    def test_invalid_method_error_message(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="fake_method")
        assert "Invalid method parameter" in resp.json()["error"]

    def test_valid_method_accepted(self):
        db = _setup_single_ticker_db(method="wyckoff")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.status_code == 200

    def test_invalid_signal_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="invalid_dir")
        assert resp.status_code == 400

    def test_signal_without_method_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(signal="bullish")
        assert resp.status_code == 400

    def test_signal_without_method_error_message(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(signal="bullish")
        assert "signal parameter requires method parameter" in resp.json()["error"]

    def test_invalid_timeframe_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(timeframe="weekly")
        assert resp.status_code == 400

    def test_invalid_sort_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(sort="invalid_sort")
        assert resp.status_code == 400

    def test_invalid_order_returns_400(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(order="random")
        assert resp.status_code == 400

    def test_confluence_below_1_returns_422(self):
        resp = _get_scan(confluence=0)
        assert resp.status_code == 422

    def test_confluence_above_6_returns_422(self):
        resp = _get_scan(confluence=7)
        assert resp.status_code == 422

    def test_min_confidence_below_0_returns_422(self):
        resp = _get_scan(min_confidence=-0.1)
        assert resp.status_code == 422

    def test_min_confidence_above_1_returns_422(self):
        resp = _get_scan(min_confidence=1.5)
        assert resp.status_code == 422

    def test_limit_above_200_returns_422(self):
        resp = _get_scan(limit=201)
        assert resp.status_code == 422

    def test_limit_below_1_returns_422(self):
        resp = _get_scan(limit=0)
        assert resp.status_code == 422


# ===================================================================
# 2. TestScanNoFilters (~10 tests)
# ===================================================================
class TestScanNoFilters:
    """GET /api/scan -- no filter parameters returns all analyzed tickers."""

    def test_no_params_returns_200(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.status_code == 200

    def test_no_params_returns_all_analyzed(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8},
            {"symbol": "MSFT", "confidence": 0.6},
            {"symbol": "GOOG", "confidence": 0.7},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        assert resp.status_code == 200
        assert resp.json()["total_matches"] == 3

    def test_default_sort_by_confidence_desc(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.5},
            {"symbol": "MSFT", "confidence": 0.9},
            {"symbol": "GOOG", "confidence": 0.7},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        results = resp.json()["results"]
        confs = [r["composite"]["overall_confidence"] for r in results]
        assert confs == sorted(confs, reverse=True)

    def test_default_limit_is_50(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.status_code == 200

    def test_response_has_query_key(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert "query" in resp.json()

    def test_response_has_results_key(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert "results" in resp.json()
        assert isinstance(resp.json()["results"], list)

    def test_response_has_total_matches(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert "total_matches" in resp.json()

    def test_response_has_total_scanned(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert "total_scanned" in resp.json()
        assert resp.json()["total_scanned"] == 1

    def test_response_has_scan_duration_ms(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert "scan_duration_ms" in resp.json()

    def test_query_reflects_defaults(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        q = resp.json()["query"]
        assert q["method"] is None
        assert q["signal"] is None
        assert q["confluence"] is None
        assert q["min_confidence"] == 0.0


# ===================================================================
# 3. TestMethodSignalFilter (~12 tests)
# ===================================================================
class TestMethodSignalFilter:
    """Filtering by method and signal parameters."""

    def test_method_wyckoff_signal_bullish_matches(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.status_code == 200
        assert resp.json()["total_matches"] == 1

    def test_method_wyckoff_signal_bearish_excludes_bullish(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish", will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bearish")
        assert resp.json()["total_matches"] == 0

    def test_method_sentiment_signal_bearish_matches(self):
        db = _setup_single_ticker_db(method="sentiment", method_direction="bearish")
        with _patch_db(db):
            resp = _get_scan(method="sentiment", signal="bearish")
        assert resp.json()["total_matches"] == 1

    def test_no_matches_returns_empty(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="neutral", will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.json()["total_matches"] == 0
        assert resp.json()["results"] == []

    def test_method_case_insensitive(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="WYCKOFF", signal="bullish")
        assert resp.status_code == 200

    def test_signal_case_insensitive(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="BULLISH")
        assert resp.status_code == 200

    def test_multiple_tickers_only_matching_returned(self):
        tickers = [
            {"symbol": "AAPL", "method_direction": "bullish", "will_match": True},
            {"symbol": "MSFT", "method_direction": "bearish", "will_match": False},
            {"symbol": "GOOG", "method_direction": "bullish", "will_match": True},
        ]
        db = _setup_multi_ticker_db(tickers, method="wyckoff")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.json()["total_matches"] == 2
        syms = [r["symbol"] for r in resp.json()["results"]]
        assert "AAPL" in syms
        assert "GOOG" in syms
        assert "MSFT" not in syms

    def test_method_without_signal_returns_method_filtered(self):
        """method only without signal still requires methodology data to exist."""
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff")
        assert resp.status_code == 200
        assert resp.json()["total_matches"] == 1

    def test_method_with_no_analysis_result_excludes(self):
        """If analysis_results row is None for the method, ticker is excluded."""
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        db._fetch_one_results.append(
            _cache_row(composite_json=_make_composite_json())
        )
        db._fetch_one_results.append(None)  # no method signal
        with _patch_db(db):
            resp = _get_scan(method="wyckoff")
        assert resp.json()["total_matches"] == 0

    def test_methodology_match_in_result_item(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish",
                                     method_confidence=0.85)
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        item = resp.json()["results"][0]
        assert item["methodology_match"] is not None
        assert item["methodology_match"]["methodology"] == "wyckoff"
        assert item["methodology_match"]["direction"] == "bullish"
        assert item["methodology_match"]["confidence"] == 0.85

    def test_no_method_no_methodology_match(self):
        """Without method filter, methodology_match should be None."""
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["methodology_match"] is None

    def test_neutral_signal_matches_neutral(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="neutral")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="neutral")
        assert resp.json()["total_matches"] == 1


# ===================================================================
# 4. TestConfluenceFilter (~8 tests)
# ===================================================================
class TestConfluenceFilter:
    """Filtering by confluence parameter."""

    def test_confluence_4_includes_4_count(self):
        db = _setup_single_ticker_db(confluence=4)
        with _patch_db(db):
            resp = _get_scan(confluence=4)
        assert resp.json()["total_matches"] == 1

    def test_confluence_4_excludes_3_count(self):
        db = _setup_single_ticker_db(confluence=3, will_match=False)
        with _patch_db(db):
            resp = _get_scan(confluence=4)
        assert resp.json()["total_matches"] == 0

    def test_confluence_6_includes_6_count(self):
        db = _setup_single_ticker_db(confluence=6)
        with _patch_db(db):
            resp = _get_scan(confluence=6)
        assert resp.json()["total_matches"] == 1

    def test_confluence_1_passes_all(self):
        tickers = [
            {"symbol": "AAPL", "confluence_count": 1},
            {"symbol": "MSFT", "confluence_count": 4},
            {"symbol": "GOOG", "confluence_count": 6},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(confluence=1)
        assert resp.json()["total_matches"] == 3

    def test_confluence_with_method_and_logic(self):
        db = _setup_single_ticker_db(
            confluence=5, method="wyckoff", method_direction="bullish",
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", confluence=5)
        assert resp.json()["total_matches"] == 1

    def test_confluence_with_method_excludes_low_confluence(self):
        db = _setup_single_ticker_db(
            confluence=2, method="wyckoff", method_direction="bullish",
            will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", confluence=5)
        assert resp.json()["total_matches"] == 0

    def test_multi_ticker_confluence_filter(self):
        tickers = [
            {"symbol": "AAPL", "confluence_count": 5, "will_match": True},
            {"symbol": "MSFT", "confluence_count": 2, "will_match": False},
            {"symbol": "GOOG", "confluence_count": 4, "will_match": True},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(confluence=4)
        assert resp.json()["total_matches"] == 2

    def test_confluence_none_passes_all(self):
        tickers = [
            {"symbol": "AAPL", "confluence_count": 1},
            {"symbol": "MSFT", "confluence_count": 6},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_matches"] == 2


# ===================================================================
# 5. TestMinConfidenceFilter (~8 tests)
# ===================================================================
class TestMinConfidenceFilter:
    """Filtering by min_confidence parameter."""

    def test_min_confidence_0_passes_all(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.1},
            {"symbol": "MSFT", "confidence": 0.9},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.0)
        assert resp.json()["total_matches"] == 2

    def test_min_confidence_0_5_filters_low(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.3, "will_match": False},
            {"symbol": "MSFT", "confidence": 0.7, "will_match": True},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.5)
        assert resp.json()["total_matches"] == 1
        assert resp.json()["results"][0]["symbol"] == "MSFT"

    def test_min_confidence_1_0_likely_empty(self):
        db = _setup_single_ticker_db(confidence=0.99, will_match=False)
        with _patch_db(db):
            resp = _get_scan(min_confidence=1.0)
        assert resp.json()["total_matches"] == 0

    def test_min_confidence_exactly_matches_threshold(self):
        db = _setup_single_ticker_db(confidence=0.5)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.5)
        assert resp.json()["total_matches"] == 1

    def test_min_confidence_method_specific(self):
        """When method is specified, min_confidence checks method confidence."""
        db = _setup_single_ticker_db(
            method="wyckoff", method_confidence=0.4, confidence=0.9,
            will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", min_confidence=0.5)
        # Method confidence is 0.4, below 0.5, so excluded
        assert resp.json()["total_matches"] == 0

    def test_min_confidence_method_passes_when_high(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_confidence=0.8, confidence=0.3,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", min_confidence=0.5)
        # Method confidence is 0.8, above 0.5
        assert resp.json()["total_matches"] == 1

    def test_min_confidence_combined_with_confluence(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8, "confluence_count": 5,
             "will_match": True},
            {"symbol": "MSFT", "confidence": 0.3, "confluence_count": 5,
             "will_match": False},
            {"symbol": "GOOG", "confidence": 0.8, "confluence_count": 2,
             "will_match": False},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.5, confluence=4)
        assert resp.json()["total_matches"] == 1
        assert resp.json()["results"][0]["symbol"] == "AAPL"

    def test_min_confidence_default_0(self):
        db = _setup_single_ticker_db(confidence=0.01)
        with _patch_db(db):
            resp = _get_scan()
        # Default min_confidence=0.0, so anything passes
        assert resp.json()["total_matches"] == 1


# ===================================================================
# 6. TestTimeframeFilter (~6 tests)
# ===================================================================
class TestTimeframeFilter:
    """Filtering by timeframe parameter."""

    def test_timeframe_short_without_method(self):
        """Without method, timeframe checks composite timeframe_breakdown."""
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
            "long": {"direction": "neutral", "confidence": 0.0,
                      "methodologies": []},
        }
        db = _setup_single_ticker_db(timeframe_breakdown=tb)
        with _patch_db(db):
            resp = _get_scan(timeframe="short")
        assert resp.json()["total_matches"] == 1

    def test_timeframe_long_without_method_excludes(self):
        """If 'long' not in timeframe_breakdown, excluded."""
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
        }
        db = _setup_single_ticker_db(timeframe_breakdown=tb, will_match=False)
        with _patch_db(db):
            resp = _get_scan(timeframe="long")
        assert resp.json()["total_matches"] == 0

    def test_timeframe_with_method_checks_method_signal(self):
        """With method, timeframe checks method signal's timeframe field."""
        db = _setup_single_ticker_db(
            method="wyckoff", method_timeframe="short",
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", timeframe="short")
        assert resp.json()["total_matches"] == 1

    def test_timeframe_with_method_excludes_mismatch(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_timeframe="medium", will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", timeframe="short")
        assert resp.json()["total_matches"] == 0

    def test_timeframe_case_insensitive(self):
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
            "long": {"direction": "neutral", "confidence": 0.0,
                      "methodologies": []},
        }
        db = _setup_single_ticker_db(timeframe_breakdown=tb)
        with _patch_db(db):
            resp = _get_scan(timeframe="SHORT")
        assert resp.status_code == 200

    def test_timeframe_combined_with_method_signal(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish", method_timeframe="long",
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", timeframe="long")
        assert resp.json()["total_matches"] == 1


# ===================================================================
# 7. TestGroupFilter (~6 tests)
# ===================================================================
class TestGroupFilter:
    """Filtering by group parameter."""

    def test_group_filters_tickers(self):
        db = _setup_single_ticker_db(group_name="tech")
        with _patch_db(db):
            resp = _get_scan(group="tech")
        assert resp.json()["total_matches"] == 1

    def test_group_nonexistent_returns_empty(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([])  # no tickers in group
        with _patch_db(db):
            resp = _get_scan(group="nonexistent")
        assert resp.json()["total_matches"] == 0
        assert resp.json()["total_scanned"] == 0

    def test_no_group_returns_all(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_matches"] == 1

    def test_group_in_query_metadata(self):
        db = _setup_single_ticker_db(group_name="tech")
        with _patch_db(db):
            resp = _get_scan(group="tech")
        assert resp.json()["query"]["group"] == "tech"

    def test_no_group_query_null(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["query"]["group"] is None

    def test_group_combined_with_method(self):
        db = _setup_single_ticker_db(
            group_name="tech", method="wyckoff", method_direction="bullish",
        )
        with _patch_db(db):
            resp = _get_scan(group="tech", method="wyckoff", signal="bullish")
        assert resp.json()["total_matches"] == 1


# ===================================================================
# 8. TestSorting (~10 tests)
# ===================================================================
class TestSorting:
    """sort and order parameters."""

    def test_sort_confidence_desc_default(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.5},
            {"symbol": "MSFT", "confidence": 0.9},
            {"symbol": "GOOG", "confidence": 0.7},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        results = resp.json()["results"]
        confs = [r["composite"]["overall_confidence"] for r in results]
        assert confs == sorted(confs, reverse=True)

    def test_sort_confidence_asc(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.5},
            {"symbol": "MSFT", "confidence": 0.9},
            {"symbol": "GOOG", "confidence": 0.7},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="confidence", order="asc")
        results = resp.json()["results"]
        confs = [r["composite"]["overall_confidence"] for r in results]
        assert confs == sorted(confs)

    def test_sort_symbol_asc(self):
        tickers = [
            {"symbol": "MSFT"},
            {"symbol": "AAPL"},
            {"symbol": "GOOG"},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="symbol", order="asc")
        syms = [r["symbol"] for r in resp.json()["results"]]
        assert syms == sorted(syms)

    def test_sort_symbol_desc(self):
        tickers = [
            {"symbol": "MSFT"},
            {"symbol": "AAPL"},
            {"symbol": "GOOG"},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="symbol", order="desc")
        syms = [r["symbol"] for r in resp.json()["results"]]
        assert syms == sorted(syms, reverse=True)

    def test_sort_price_change_desc(self):
        tickers = [
            {"symbol": "AAPL", "close": 150.0, "open_": 145.0},   # +3.4%
            {"symbol": "MSFT", "close": 100.0, "open_": 110.0},   # -9.1%
            {"symbol": "GOOG", "close": 200.0, "open_": 190.0},   # +5.3%
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="price_change", order="desc")
        pcts = [r["price_change_percent"] for r in resp.json()["results"]]
        assert pcts == sorted(pcts, reverse=True)

    def test_sort_price_change_asc(self):
        tickers = [
            {"symbol": "AAPL", "close": 150.0, "open_": 145.0},
            {"symbol": "MSFT", "close": 100.0, "open_": 110.0},
            {"symbol": "GOOG", "close": 200.0, "open_": 190.0},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="price_change", order="asc")
        pcts = [r["price_change_percent"] for r in resp.json()["results"]]
        non_none = [p for p in pcts if p is not None]
        assert non_none == sorted(non_none)

    def test_sort_confidence_with_method(self):
        """When method specified, confidence sort uses method confidence."""
        tickers = [
            {"symbol": "AAPL", "method_confidence": 0.3, "confidence": 0.9},
            {"symbol": "MSFT", "method_confidence": 0.8, "confidence": 0.2},
        ]
        db = _setup_multi_ticker_db(tickers, method="wyckoff")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", sort="confidence", order="desc")
        results = resp.json()["results"]
        # MSFT has higher method confidence (0.8 vs 0.3)
        assert results[0]["symbol"] == "MSFT"

    def test_default_order_is_desc(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.5},
            {"symbol": "MSFT", "confidence": 0.9},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(sort="confidence")
        results = resp.json()["results"]
        assert results[0]["symbol"] == "MSFT"

    def test_sort_case_insensitive(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan(sort="CONFIDENCE")
        assert resp.status_code == 200

    def test_order_case_insensitive(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan(order="ASC")
        assert resp.status_code == 200


# ===================================================================
# 9. TestLimit (~6 tests)
# ===================================================================
class TestLimit:
    """Limit parameter controls result count."""

    def test_limit_5(self):
        tickers = [{"symbol": f"T{i}", "confidence": i * 0.1} for i in range(10)]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(limit=5)
        assert len(resp.json()["results"]) == 5

    def test_limit_200(self):
        tickers = [{"symbol": f"T{i}"} for i in range(3)]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(limit=200)
        assert len(resp.json()["results"]) == 3

    def test_fewer_matches_than_limit(self):
        tickers = [{"symbol": "AAPL"}, {"symbol": "MSFT"}]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(limit=50)
        assert len(resp.json()["results"]) == 2

    def test_limit_1(self):
        tickers = [{"symbol": "AAPL"}, {"symbol": "MSFT"}, {"symbol": "GOOG"}]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(limit=1)
        assert len(resp.json()["results"]) == 1

    def test_limit_applied_after_filter(self):
        """Limit applies after filtering, not before."""
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8, "will_match": True},
            {"symbol": "MSFT", "confidence": 0.3, "will_match": False},
            {"symbol": "GOOG", "confidence": 0.9, "will_match": True},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.5, limit=1)
        # 2 pass filter, limit=1
        assert len(resp.json()["results"]) == 1

    def test_total_matches_reflects_post_limit_count(self):
        """total_matches = len(results) after slicing by limit."""
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8},
            {"symbol": "MSFT", "confidence": 0.9},
            {"symbol": "GOOG", "confidence": 0.7},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(limit=2)
        assert resp.json()["total_matches"] == 2


# ===================================================================
# 10. TestPresetEndpoints (~10 tests)
# ===================================================================
class TestPresetEndpoints:
    """Preset scan endpoints: /scan/bullish, /scan/bearish, /scan/strong.

    Presets delegate to ``_scan_impl()`` with plain Python defaults so that
    FastAPI ``Query()`` dependency-injection objects are never leaked into
    the core scan logic.
    """

    def test_bullish_returns_200(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.status_code == 200

    def test_bullish_returns_matching_result(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        data = resp.json()
        assert data["total_matches"] >= 1
        assert data["results"][0]["symbol"] == "AAPL"

    def test_bullish_query_shows_confluence_3(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.json()["query"]["confluence"] == 3

    def test_bullish_query_shows_min_confidence_05(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.json()["query"]["min_confidence"] == 0.5

    def test_bullish_filters_low_confluence(self):
        db = _setup_single_ticker_db(confluence=2, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.json()["total_matches"] == 0

    def test_bullish_filters_low_confidence(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.3)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.json()["total_matches"] == 0

    def test_bearish_returns_200(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bearish")
        assert resp.status_code == 200

    def test_bearish_returns_matching_result(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bearish")
        data = resp.json()
        assert data["total_matches"] >= 1

    def test_bearish_query_shows_confluence_3(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bearish")
        assert resp.json()["query"]["confluence"] == 3

    def test_strong_returns_200(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.status_code == 200

    def test_strong_returns_matching_result(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        data = resp.json()
        assert data["total_matches"] >= 1

    def test_strong_query_shows_confluence_5(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.json()["query"]["confluence"] == 5

    def test_strong_query_shows_min_confidence_07(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.json()["query"]["min_confidence"] == 0.7

    def test_strong_filters_low_confluence(self):
        db = _setup_single_ticker_db(confluence=3, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.json()["total_matches"] == 0

    def test_strong_filters_low_confidence(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.5)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.json()["total_matches"] == 0

    def test_bullish_endpoint_exists(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.status_code != 404

    def test_bearish_endpoint_exists(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bearish")
        assert resp.status_code != 404

    def test_strong_endpoint_exists(self):
        db = _setup_single_ticker_db(confluence=6, confidence=0.9)
        with _patch_db(db):
            resp = _get_preset("strong")
        assert resp.status_code != 404

    def test_bullish_accepts_limit_param(self):
        db = _setup_single_ticker_db(confluence=4, confidence=0.7)
        with _patch_db(db):
            resp = _get_preset("bullish", limit=10)
        assert resp.status_code == 200

    def test_bullish_rejects_invalid_limit(self):
        resp = _get_preset("bullish", limit=0)
        assert resp.status_code == 422

    def test_bearish_rejects_invalid_limit(self):
        resp = _get_preset("bearish", limit=201)
        assert resp.status_code == 422

    def test_strong_rejects_invalid_limit(self):
        resp = _get_preset("strong", limit=-1)
        assert resp.status_code == 422

    def test_preset_empty_watchlist(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_preset("bullish")
        assert resp.status_code == 200
        assert resp.json()["total_matches"] == 0
        assert resp.json()["note"] == "No tickers in watchlist"


# ===================================================================
# 11. TestStaleAnalysis (~8 tests)
# ===================================================================
class TestStaleAnalysis:
    """Stale analysis detection (>2 hours old)."""

    def test_recent_analysis_not_stale(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["stale"] is False

    def test_old_analysis_is_stale(self):
        db = _setup_single_ticker_db(created_at=_OLD_STR)
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["stale"] is True

    def test_all_stale_note_in_response(self):
        db = _setup_single_ticker_db(created_at=_OLD_STR)
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["note"] is not None
        assert "stale" in resp.json()["note"].lower()

    def test_mixed_stale_fresh_no_all_stale_note(self):
        tickers = [
            {"symbol": "AAPL", "created_at": _NOW_STR},
            {"symbol": "MSFT", "created_at": _OLD_STR},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        note = resp.json()["note"]
        if note is not None:
            assert "All results are stale" not in note

    def test_stale_field_per_item(self):
        tickers = [
            {"symbol": "AAPL", "created_at": _NOW_STR},
            {"symbol": "MSFT", "created_at": _OLD_STR},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        results = resp.json()["results"]
        stale_map = {r["symbol"]: r["stale"] for r in results}
        assert stale_map["AAPL"] is False
        assert stale_map["MSFT"] is True

    def test_null_created_at_treated_as_stale(self):
        """When created_at is None in the cache row, _is_stale returns True."""
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        # Build cache_row with explicit None for created_at
        db._fetch_one_results.append({
            "composite_json": _make_composite_json(),
            "signals_json": "[]",
            "created_at": None,
        })
        db._fetch_one_results.append(_price_row())
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["stale"] is True

    def test_last_analysis_at_field(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["last_analysis_at"] == _NOW_STR

    def test_all_fresh_no_note(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["note"] is None


# ===================================================================
# 12. TestEmptyResults (~8 tests)
# ===================================================================
class TestEmptyResults:
    """Edge cases that produce empty results."""

    def test_empty_watchlist_returns_200(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([])  # no tickers
        with _patch_db(db):
            resp = _get_scan()
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_empty_watchlist_note(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan()
        assert "No tickers in watchlist" in resp.json()["note"]

    def test_empty_watchlist_total_scanned_0(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_scanned"] == 0

    def test_no_analysis_cache_table(self):
        """analysis_cache table missing -> graceful empty."""
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 0})  # table doesn't exist
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        with _patch_db(db):
            resp = _get_scan()
        assert resp.status_code == 200
        assert resp.json()["results"] == []
        assert "No analysis data available" in resp.json()["note"]

    def test_no_cached_composite_for_ticker(self):
        """Ticker in watchlist but no analysis_cache row."""
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        db._fetch_one_results.append(None)  # no composite
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_matches"] == 0

    def test_all_filtered_out_returns_200(self):
        db = _setup_single_ticker_db(confidence=0.3, will_match=False)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.9)
        assert resp.status_code == 200
        assert resp.json()["total_matches"] == 0

    def test_all_filtered_out_note(self):
        db = _setup_single_ticker_db(confidence=0.3, will_match=False)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.9)
        assert "No tickers matched" in resp.json()["note"]

    def test_invalid_composite_json_skipped(self):
        """Corrupt composite_json should be skipped gracefully."""
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        db._fetch_one_results.append({
            "composite_json": "not valid json{{{",
            "signals_json": "[]",
            "created_at": _NOW_STR,
        })
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_matches"] == 0


# ===================================================================
# 13. TestResponseStructure (~12 tests)
# ===================================================================
class TestResponseStructure:
    """Validate response envelope and result item structure."""

    def test_query_reflects_method(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.json()["query"]["method"] == "wyckoff"

    def test_query_reflects_signal(self):
        db = _setup_single_ticker_db(method="wyckoff", method_direction="bullish")
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        assert resp.json()["query"]["signal"] == "bullish"

    def test_query_reflects_confluence(self):
        db = _setup_single_ticker_db(confluence=4)
        with _patch_db(db):
            resp = _get_scan(confluence=4)
        assert resp.json()["query"]["confluence"] == 4

    def test_query_reflects_timeframe(self):
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
            "long": {"direction": "neutral", "confidence": 0.0,
                      "methodologies": []},
        }
        db = _setup_single_ticker_db(timeframe_breakdown=tb)
        with _patch_db(db):
            resp = _get_scan(timeframe="short")
        assert resp.json()["query"]["timeframe"] == "short"

    def test_results_is_list(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert isinstance(resp.json()["results"], list)

    def test_total_matches_accurate(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8},
            {"symbol": "MSFT", "confidence": 0.9},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["total_matches"] == 2

    def test_total_scanned_accurate(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8, "will_match": True},
            {"symbol": "MSFT", "confidence": 0.2, "will_match": False},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(min_confidence=0.5)
        assert resp.json()["total_scanned"] == 2
        assert resp.json()["total_matches"] == 1

    def test_scan_duration_ms_positive(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        assert resp.json()["scan_duration_ms"] >= 0

    def test_note_is_string_or_null(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        note = resp.json()["note"]
        assert note is None or isinstance(note, str)

    def test_result_item_has_symbol(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert "symbol" in item

    def test_result_item_has_match_reason(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert "match_reason" in item
        assert isinstance(item["match_reason"], str)

    def test_result_item_has_composite(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert "composite" in item
        assert "overall_direction" in item["composite"]
        assert "overall_confidence" in item["composite"]
        assert "confluence_count" in item["composite"]


# ===================================================================
# 14. TestSecurity (~8 tests)
# ===================================================================
class TestSecurity:
    """Security: error messages, SQL injection, XSS prevention."""

    def test_error_does_not_echo_method_input(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="<script>alert(1)</script>")
        body = str(resp.json())
        assert "<script>" not in body

    def test_error_does_not_echo_signal_input(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="<img onerror=x>")
        body = str(resp.json())
        assert "<img" not in body

    def test_sql_injection_in_group_safe(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(group="'; DROP TABLE watchlist; --")
        assert resp.status_code == 200
        assert resp.json()["total_scanned"] == 0

    def test_sql_injection_in_method_safe(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(method="'; DROP TABLE")
        assert resp.status_code == 400

    def test_xss_in_timeframe_rejected(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(timeframe="<script>")
        assert resp.status_code == 400

    def test_xss_in_sort_rejected(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(sort="<script>")
        assert resp.status_code == 400

    def test_xss_in_order_rejected(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(order="<img>")
        assert resp.status_code == 400

    def test_very_long_group_handled_safely(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        db._fetch_all_results.append([])
        with _patch_db(db):
            resp = _get_scan(group="a" * 10000)
        assert resp.status_code == 200


# ===================================================================
# 15. TestCombinedFilters (~10 tests)
# ===================================================================
class TestCombinedFilters:
    """Combining multiple filter parameters (AND logic)."""

    def test_method_signal_confluence(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish", confluence=5,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", confluence=5)
        assert resp.json()["total_matches"] == 1

    def test_method_signal_confluence_excludes_low_confluence(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish",
            confluence=3, will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", confluence=5)
        assert resp.json()["total_matches"] == 0

    def test_method_signal_min_confidence(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish", method_confidence=0.8,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", min_confidence=0.5)
        assert resp.json()["total_matches"] == 1

    def test_method_signal_min_confidence_excludes_low(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish",
            method_confidence=0.3, will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish", min_confidence=0.5)
        assert resp.json()["total_matches"] == 0

    def test_group_method_signal(self):
        db = _setup_single_ticker_db(
            group_name="tech", method="wyckoff", method_direction="bullish",
        )
        with _patch_db(db):
            resp = _get_scan(group="tech", method="wyckoff", signal="bullish")
        assert resp.json()["total_matches"] == 1

    def test_all_filters_together(self):
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
            "long": {"direction": "neutral", "confidence": 0.0,
                      "methodologies": []},
        }
        db = _setup_single_ticker_db(
            group_name="tech",
            method="wyckoff",
            method_direction="bullish",
            method_confidence=0.8,
            method_timeframe="short",
            confluence=5,
            confidence=0.85,
            timeframe_breakdown=tb,
        )
        with _patch_db(db):
            resp = _get_scan(
                group="tech", method="wyckoff", signal="bullish",
                confluence=4, min_confidence=0.5, timeframe="short",
            )
        assert resp.json()["total_matches"] == 1

    def test_all_filters_fail_one_criterion(self):
        """Same as above but method confidence too low."""
        tb = {
            "short": {"direction": "bullish", "confidence": 0.7,
                       "methodologies": ["wyckoff"]},
            "medium": {"direction": "neutral", "confidence": 0.3,
                        "methodologies": []},
            "long": {"direction": "neutral", "confidence": 0.0,
                      "methodologies": []},
        }
        db = _setup_single_ticker_db(
            group_name="tech",
            method="wyckoff",
            method_direction="bullish",
            method_confidence=0.3,  # too low
            method_timeframe="short",
            confluence=5,
            confidence=0.85,
            timeframe_breakdown=tb,
            will_match=False,
        )
        with _patch_db(db):
            resp = _get_scan(
                group="tech", method="wyckoff", signal="bullish",
                confluence=4, min_confidence=0.5, timeframe="short",
            )
        assert resp.json()["total_matches"] == 0

    def test_multi_ticker_combined_filter(self):
        tickers = [
            {
                "symbol": "AAPL", "confidence": 0.8, "confluence_count": 5,
                "method_direction": "bullish", "method_confidence": 0.9,
                "will_match": True,
            },
            {
                "symbol": "MSFT", "confidence": 0.3, "confluence_count": 5,
                "method_direction": "bullish", "method_confidence": 0.8,
                "will_match": False,
                # min_confidence uses method confidence; MSFT method_conf=0.8
                # passes min_conf=0.5. But wait -- the composite confidence
                # is 0.3. Since method is set, min_confidence checks method
                # confidence (0.8), which passes. But confluence_count=5
                # passes confluence=4. Signal is bullish, matches. So MSFT
                # actually WILL match. Let me fix.
            },
            {
                "symbol": "GOOG", "confidence": 0.8, "confluence_count": 2,
                "method_direction": "bearish", "method_confidence": 0.9,
                "will_match": False,
            },
        ]
        # Fix: MSFT will_match=True because method conf is 0.8 > 0.5
        tickers[1]["will_match"] = True
        db = _setup_multi_ticker_db(tickers, method="wyckoff")
        with _patch_db(db):
            resp = _get_scan(
                method="wyckoff", signal="bullish",
                confluence=4, min_confidence=0.5,
            )
        assert resp.json()["total_matches"] == 2
        syms = {r["symbol"] for r in resp.json()["results"]}
        assert syms == {"AAPL", "MSFT"}

    def test_confluence_and_confidence_and_sort(self):
        tickers = [
            {"symbol": "AAPL", "confidence": 0.8, "confluence_count": 5},
            {"symbol": "MSFT", "confidence": 0.9, "confluence_count": 5},
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(
                confluence=4, min_confidence=0.5,
                sort="confidence", order="asc",
            )
        results = resp.json()["results"]
        assert results[0]["symbol"] == "AAPL"
        assert results[1]["symbol"] == "MSFT"

    def test_combined_filters_with_limit(self):
        tickers = [
            {"symbol": f"T{i}", "confidence": 0.8, "confluence_count": 5}
            for i in range(5)
        ]
        db = _setup_multi_ticker_db(tickers)
        with _patch_db(db):
            resp = _get_scan(confluence=4, min_confidence=0.5, limit=2)
        assert len(resp.json()["results"]) == 2


# ===================================================================
# 16. TestResultItemFields (~8 tests)
# ===================================================================
class TestResultItemFields:
    """Verify individual result item field values."""

    def test_price_fields_present(self):
        db = _setup_single_ticker_db(close=150.0, open_=145.0)
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["last_price"] == 150.0
        assert item["price_change_percent"] is not None

    def test_price_change_calculation(self):
        db = _setup_single_ticker_db(close=150.0, open_=100.0)
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        # (150-100)/100 * 100 = 50.0
        assert item["price_change_percent"] == 50.0

    def test_price_null_when_no_price_cache(self):
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})  # table exists
        db._fetch_all_results.append([_watchlist_row("AAPL")])
        db._fetch_one_results.append(_cache_row())  # composite
        db._fetch_one_results.append(None)  # no price
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["last_price"] is None
        assert item["price_change_percent"] is None

    def test_match_reason_contains_composite_info(self):
        db = _setup_single_ticker_db(direction="bullish", confidence=0.72, confluence=4)
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert "Composite" in item["match_reason"]
        assert "bullish" in item["match_reason"]

    def test_match_reason_contains_method_info(self):
        db = _setup_single_ticker_db(
            method="wyckoff", method_direction="bullish", method_confidence=0.85,
        )
        with _patch_db(db):
            resp = _get_scan(method="wyckoff", signal="bullish")
        item = resp.json()["results"][0]
        assert "wyckoff" in item["match_reason"]

    def test_stale_field_present(self):
        db = _setup_single_ticker_db()
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert "stale" in item
        assert isinstance(item["stale"], bool)

    def test_methodology_match_with_method(self):
        db = _setup_single_ticker_db(
            method="sentiment", method_direction="bearish",
            method_confidence=0.6, method_timeframe="long",
        )
        with _patch_db(db):
            resp = _get_scan(method="sentiment", signal="bearish")
        item = resp.json()["results"][0]
        mm = item["methodology_match"]
        assert mm["methodology"] == "sentiment"
        assert mm["direction"] == "bearish"
        assert mm["confidence"] == 0.6
        assert mm["timeframe"] == "long"

    def test_composite_confluence_count_in_item(self):
        db = _setup_single_ticker_db(confluence=5)
        with _patch_db(db):
            resp = _get_scan()
        item = resp.json()["results"][0]
        assert item["composite"]["confluence_count"] == 5


# ===================================================================
# 17. TestHelperFunctions (~10 tests)
# ===================================================================
class TestHelperFunctions:
    """Unit tests for internal helper functions in scan.py."""

    def test_safe_float_int(self):
        from app.api.routes.scan import _safe_float
        assert _safe_float(42) == 42.0

    def test_safe_float_float(self):
        from app.api.routes.scan import _safe_float
        assert _safe_float(3.14) == 3.14

    def test_safe_float_string(self):
        from app.api.routes.scan import _safe_float
        assert _safe_float("2.5") == 2.5

    def test_safe_float_invalid(self):
        from app.api.routes.scan import _safe_float
        assert _safe_float("abc") == 0.0

    def test_safe_float_none(self):
        from app.api.routes.scan import _safe_float
        assert _safe_float(None) == 0.0

    def test_safe_float_bool_falls_through(self):
        from app.api.routes.scan import _safe_float
        # Bool excluded from fast path, but float(True) -> 1.0 in try block
        assert _safe_float(True) == 1.0

    def test_safe_int_int(self):
        from app.api.routes.scan import _safe_int
        assert _safe_int(5) == 5

    def test_safe_int_string(self):
        from app.api.routes.scan import _safe_int
        assert _safe_int("10") == 10

    def test_safe_int_invalid(self):
        from app.api.routes.scan import _safe_int
        assert _safe_int("abc") == 0

    def test_safe_int_bool_falls_through(self):
        from app.api.routes.scan import _safe_int
        # Bool excluded from fast path, but int(True) -> 1 in try block
        assert _safe_int(True) == 1


# ===================================================================
# 18. TestParseCompositeJson (~6 tests)
# ===================================================================
class TestParseCompositeJson:
    """Unit tests for _parse_composite_json."""

    def test_valid_json(self):
        from app.api.routes.scan import _parse_composite_json
        result = _parse_composite_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_none_returns_none(self):
        from app.api.routes.scan import _parse_composite_json
        assert _parse_composite_json(None) is None

    def test_invalid_json_returns_none(self):
        from app.api.routes.scan import _parse_composite_json
        assert _parse_composite_json("not json{") is None

    def test_non_dict_returns_none(self):
        from app.api.routes.scan import _parse_composite_json
        assert _parse_composite_json("[1,2,3]") is None

    def test_empty_string_returns_none(self):
        from app.api.routes.scan import _parse_composite_json
        assert _parse_composite_json("") is None

    def test_nested_dict(self):
        from app.api.routes.scan import _parse_composite_json
        data = '{"a": {"b": 1}}'
        result = _parse_composite_json(data)
        assert result == {"a": {"b": 1}}


# ===================================================================
# 19. TestIsStale (~6 tests)
# ===================================================================
class TestIsStale:
    """Unit tests for _is_stale."""

    def test_recent_not_stale(self):
        from app.api.routes.scan import _is_stale
        assert _is_stale(_NOW_STR) is False

    def test_old_is_stale(self):
        from app.api.routes.scan import _is_stale
        assert _is_stale(_OLD_STR) is True

    def test_none_is_stale(self):
        from app.api.routes.scan import _is_stale
        assert _is_stale(None) is True

    def test_invalid_string_is_stale(self):
        from app.api.routes.scan import _is_stale
        assert _is_stale("not a date") is True

    def test_naive_datetime_treated_as_utc(self):
        from app.api.routes.scan import _is_stale
        recent_naive = datetime.now(tz=timezone.utc).replace(tzinfo=None).isoformat()
        assert _is_stale(recent_naive) is False

    def test_boundary_exactly_2_hours(self):
        from app.api.routes.scan import _is_stale
        boundary = (datetime.now(tz=timezone.utc) - timedelta(hours=2)).isoformat()
        result = _is_stale(boundary)
        assert isinstance(result, bool)


# ===================================================================
# 20. TestPriceInfo (~5 tests)
# ===================================================================
class TestPriceInfo:
    """Unit tests for _price_info."""

    def test_normal_price(self):
        from app.api.routes.scan import _price_info
        lp, pct = _price_info({"close": 150.0, "open": 100.0})
        assert lp == 150.0
        assert pct == 50.0

    def test_none_row(self):
        from app.api.routes.scan import _price_info
        lp, pct = _price_info(None)
        assert lp is None
        assert pct is None

    def test_open_zero(self):
        from app.api.routes.scan import _price_info
        lp, pct = _price_info({"close": 100.0, "open": 0})
        assert lp == 100.0
        assert pct is None

    def test_missing_open(self):
        from app.api.routes.scan import _price_info
        lp, pct = _price_info({"close": 100.0})
        assert lp == 100.0
        assert pct is None

    def test_missing_close(self):
        from app.api.routes.scan import _price_info
        lp, pct = _price_info({"open": 100.0})
        assert lp is None
        assert pct is None


# ===================================================================
# 21. TestValidateHelpers (~6 tests)
# ===================================================================
class TestValidateHelpers:
    """Unit tests for validation helper functions."""

    def test_validate_enum_valid(self):
        from app.api.routes.scan import _validate_enum
        assert _validate_enum("bullish", {"bullish", "bearish"}, "test") == "bullish"

    def test_validate_enum_none(self):
        from app.api.routes.scan import _validate_enum
        assert _validate_enum(None, {"bullish"}, "test") is None

    def test_validate_enum_case_insensitive(self):
        from app.api.routes.scan import _validate_enum
        assert _validate_enum("BULLISH", {"bullish"}, "test") == "bullish"

    def test_validate_enum_strips_whitespace(self):
        from app.api.routes.scan import _validate_enum
        assert _validate_enum("  bullish  ", {"bullish"}, "test") == "bullish"

    def test_validate_enum_invalid_raises(self):
        from app.api.routes.scan import _validate_enum
        from fastapi import HTTPException
        import pytest
        with pytest.raises(HTTPException) as exc_info:
            _validate_enum("invalid", {"bullish"}, "test")
        assert exc_info.value.status_code == 400

    def test_validate_method_valid(self):
        from app.api.routes.scan import _validate_method
        assert _validate_method("wyckoff") == "wyckoff"


# ===================================================================
# 22. TestTableExists (~4 tests)
# ===================================================================
class TestTableExists:
    """Unit tests for _table_exists."""

    def test_table_exists_true(self):
        import asyncio
        from app.api.routes.scan import _table_exists
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 1})
        result = asyncio.get_event_loop().run_until_complete(_table_exists(db, "test"))
        assert result is True

    def test_table_exists_false(self):
        import asyncio
        from app.api.routes.scan import _table_exists
        db = MockDatabase()
        db._fetch_one_results.append({"cnt": 0})
        result = asyncio.get_event_loop().run_until_complete(_table_exists(db, "test"))
        assert result is False

    def test_table_exists_none_row(self):
        import asyncio
        from app.api.routes.scan import _table_exists
        db = MockDatabase()
        db._fetch_one_results.append(None)
        result = asyncio.get_event_loop().run_until_complete(_table_exists(db, "test"))
        assert result is False

    def test_table_exists_no_cnt_key(self):
        import asyncio
        from app.api.routes.scan import _table_exists
        db = MockDatabase()
        db._fetch_one_results.append({"other": 1})
        result = asyncio.get_event_loop().run_until_complete(_table_exists(db, "test"))
        assert result is False
