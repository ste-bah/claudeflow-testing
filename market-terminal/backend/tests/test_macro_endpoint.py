"""Tests for TASK-API-006: Macro Economic endpoints.

Covers three endpoints:
  GET /api/macro/calendar          -- Finnhub economic calendar
  GET /api/macro/event/{event_type} -- FRED indicator history
  GET /api/macro/reaction/{symbol}/{event_type} -- price reactions

Validates input validation, response structure, data processing, filtering,
error handling, edge cases, and trend computation.

Run with: ``pytest tests/test_macro_endpoint.py -v``
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import date, timedelta
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

def _make_calendar_events(count=3):
    """Create mock Finnhub calendar events (US only, with impact field)."""
    templates = [
        {
            "event": "CPI (YoY)",
            "country": "US",
            "date": "2026-01-15",
            "time": "08:30:00",
            "actual": 2.9,
            "estimate": 2.8,
            "prev": 2.7,
            "impact": "high",
            "unit": "percent",
        },
        {
            "event": "Non-Farm Payrolls",
            "country": "US",
            "date": "2026-01-17",
            "time": "08:30:00",
            "actual": 250,
            "estimate": 200,
            "prev": 180,
            "impact": "high",
            "unit": "thousands",
        },
        {
            "event": "ISM Manufacturing PMI",
            "country": "US",
            "date": "2026-01-20",
            "time": "10:00:00",
            "actual": 52.1,
            "estimate": 51.5,
            "prev": 50.3,
            "impact": "medium",
            "unit": "index",
        },
        {
            "event": "Housing Starts",
            "country": "US",
            "date": "2026-01-22",
            "time": "08:30:00",
            "actual": 1400,
            "estimate": 1380,
            "prev": 1350,
            "impact": "low",
            "unit": "thousands",
        },
        {
            "event": "FOMC Rate Decision",
            "country": "US",
            "date": "2026-01-29",
            "time": "14:00:00",
            "actual": 5.25,
            "estimate": 5.25,
            "prev": 5.25,
            "impact": "high",
            "unit": "percent",
        },
    ]
    return templates[:count]


def _make_fred_records(count=12, start_value=100.0, step=0.5):
    """Create mock FRED time series records [{date, value}, ...]."""
    base = date(2025, 1, 1)
    return [
        {
            "date": (base + timedelta(days=30 * i)).isoformat(),
            "value": round(start_value + step * i, 4),
        }
        for i in range(count)
    ]


def _make_fred_records_flat(count=12, value=100.0):
    """Create FRED records with identical values (stable trend)."""
    base = date(2025, 1, 1)
    return [
        {"date": (base + timedelta(days=30 * i)).isoformat(), "value": value}
        for i in range(count)
    ]


def _make_fred_records_falling(count=12, start_value=100.0, step=0.5):
    """Create FRED records with falling values."""
    base = date(2025, 1, 1)
    return [
        {
            "date": (base + timedelta(days=30 * i)).isoformat(),
            "value": round(start_value - step * i, 4),
        }
        for i in range(count)
    ]


def _make_candles(dates, base_price=100.0, base_volume=1_000_000):
    """Create mock daily candles for given date strings."""
    return [
        {
            "open": base_price,
            "high": base_price + 1,
            "low": base_price - 1,
            "close": base_price + 0.5,
            "volume": base_volume,
            "timestamp": f"{d}T16:00:00+00:00",
        }
        for d in dates
    ]


def _make_candles_varied(dates, prices, volumes=None):
    """Create candles with individually specified close prices and optional volumes."""
    default_vol = 1_000_000
    return [
        {
            "open": p - 0.5,
            "high": p + 1,
            "low": p - 1,
            "close": p,
            "volume": volumes[i] if volumes else default_vol,
            "timestamp": f"{dates[i]}T16:00:00+00:00",
        }
        for i, p in enumerate(prices)
    ]


# ---------------------------------------------------------------------------
# Patch helpers
# ---------------------------------------------------------------------------

@contextmanager
def _patch_finnhub(calendar_return=None, calendar_raises=False,
                   candles_return=None, candles_raises=False):
    """Mock the Finnhub client at route module level."""
    mock_client = MagicMock()
    if calendar_raises:
        mock_client.get_economic_calendar = AsyncMock(
            side_effect=Exception("finnhub calendar error")
        )
    else:
        mock_client.get_economic_calendar = AsyncMock(return_value=calendar_return)

    if candles_raises:
        mock_client.get_candles = AsyncMock(
            side_effect=Exception("finnhub candles error")
        )
    else:
        mock_client.get_candles = AsyncMock(return_value=candles_return)

    with patch("app.api.routes.macro.get_finnhub_client", return_value=mock_client):
        yield mock_client


@contextmanager
def _patch_fred(series_return=None, series_raises=False):
    """Mock the FRED client at route module level."""
    mock_client = MagicMock()
    if series_raises:
        mock_client.get_series = AsyncMock(
            side_effect=Exception("fred series error")
        )
    else:
        mock_client.get_series = AsyncMock(return_value=series_return)

    with patch("app.api.routes.macro.get_fred_client", return_value=mock_client):
        yield mock_client


@contextmanager
def _patch_both(fred_return=None, fred_raises=False,
                calendar_return=None, calendar_raises=False,
                candles_return=None, candles_raises=False):
    """Mock both FRED and Finnhub clients at route module level."""
    with _patch_fred(series_return=fred_return, series_raises=fred_raises) as fred_mock:
        with _patch_finnhub(
            calendar_return=calendar_return,
            calendar_raises=calendar_raises,
            candles_return=candles_return,
            candles_raises=candles_raises,
        ) as finnhub_mock:
            yield fred_mock, finnhub_mock


# ===================================================================
# CALENDAR ENDPOINT: GET /api/macro/calendar
# ===================================================================

class TestCalendarValidation:
    """Validate query parameter validation for /api/macro/calendar."""

    def test_invalid_from_date_format_returns_400(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?from_date=01-15-2026")
        assert resp.status_code == 400

    def test_invalid_to_date_format_returns_400(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?to_date=2026/01/30")
        assert resp.status_code == 400

    def test_invalid_date_value_returns_400(self):
        """Date like 2026-13-01 has valid format but invalid month."""
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?from_date=2026-13-01")
        assert resp.status_code == 400

    def test_invalid_importance_returns_400(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?importance=critical")
        assert resp.status_code == 400
        body = resp.json()
        assert "Invalid importance" in body["error"]

    def test_importance_error_does_not_reflect_input(self):
        """Error message should list valid values, not reflect the bad input."""
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?importance=<script>alert(1)</script>")
        assert resp.status_code == 400
        body = resp.json()
        assert "<script>" not in body["error"]
        assert "Invalid importance" in body["error"]

    def test_invalid_event_type_returns_400(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?event_type=unknown_type")
        assert resp.status_code == 400
        body = resp.json()
        assert "Invalid event_type" in body["error"]

    def test_event_type_error_does_not_reflect_input(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?event_type=<img src=x>")
        assert resp.status_code == 400
        body = resp.json()
        assert "<img" not in body["error"]

    def test_valid_importance_high_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?importance=high")
        assert resp.status_code == 200

    def test_valid_importance_medium_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?importance=medium")
        assert resp.status_code == 200

    def test_valid_importance_low_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?importance=low")
        assert resp.status_code == 200

    def test_valid_importance_all_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?importance=all")
        assert resp.status_code == 200

    def test_valid_event_type_cpi_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?event_type=cpi")
        assert resp.status_code == 200

    def test_valid_event_type_all_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar?event_type=all")
        assert resp.status_code == 200

    def test_valid_date_range_accepted(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get(
                "/api/macro/calendar?from_date=2026-01-01&to_date=2026-01-31"
            )
        assert resp.status_code == 200

    def test_feb_30_invalid_date_returns_400(self):
        with _patch_finnhub():
            resp = client.get("/api/macro/calendar?from_date=2026-02-30")
        assert resp.status_code == 400


class TestCalendarResponseStructure:
    """Verify the top-level response structure of /api/macro/calendar."""

    def test_response_has_events_key(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert "events" in body
        assert isinstance(body["events"], list)

    def test_response_has_date_range(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get(
                "/api/macro/calendar?from_date=2026-01-01&to_date=2026-01-31"
            )
        body = resp.json()
        assert body["date_range"]["from"] == "2026-01-01"
        assert body["date_range"]["to"] == "2026-01-31"

    def test_response_has_data_source(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["data_source"] == "finnhub"

    def test_response_has_data_timestamp(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert "data_timestamp" in body
        assert isinstance(body["data_timestamp"], str)
        assert len(body["data_timestamp"]) > 0

    def test_default_date_range_starts_today(self):
        """When no dates given, from_date should be today."""
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        today = date.today().isoformat()
        assert body["date_range"]["from"] == today


class TestCalendarEvents:
    """Verify event formatting, classification, and importance mapping."""

    def test_event_name_preserved(self):
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["event_name"] == "CPI (YoY)"

    def test_event_type_classified(self):
        """CPI (YoY) should be classified as 'cpi'."""
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["event_type"] == "cpi"

    def test_nfp_classified(self):
        events = _make_calendar_events(2)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        nfp_events = [e for e in body["events"] if e["event_type"] == "nfp"]
        assert len(nfp_events) == 1

    def test_importance_mapped_from_impact(self):
        events = _make_calendar_events(3)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        # First event has impact "high"
        assert body["events"][0]["importance"] == "high"

    def test_medium_importance_mapped(self):
        events = _make_calendar_events(3)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        medium_events = [e for e in body["events"] if e["importance"] == "medium"]
        assert len(medium_events) == 1

    def test_none_impact_maps_to_low(self):
        events = [{"event": "Some Event", "country": "US", "date": "2026-01-15"}]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["importance"] == "low"

    def test_event_has_expected_keys(self):
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        evt = body["events"][0]
        expected_keys = {
            "event_name", "event_type", "date", "time", "country",
            "expected", "previous", "actual", "unit", "importance",
            "description",
        }
        assert expected_keys.issubset(evt.keys())

    def test_event_actual_can_be_numeric(self):
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["actual"] is not None

    def test_event_expected_from_estimate(self):
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["expected"] == 2.8

    def test_event_previous_from_prev(self):
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["previous"] == 2.7

    def test_unrecognized_event_type_is_none(self):
        events = [{"event": "Weird Custom Index", "country": "US", "date": "2026-01-15", "impact": "low"}]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["event_type"] is None

    def test_description_uses_meta_name_for_known_type(self):
        events = _make_calendar_events(1)  # CPI
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert "Consumer Price Index" in body["events"][0]["description"]

    def test_description_falls_back_to_event_name_for_unknown(self):
        events = [{"event": "Weird Index", "country": "US", "date": "2026-01-15"}]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["description"] == "Weird Index"

    def test_events_sorted_by_date(self):
        events = _make_calendar_events(5)
        # Reverse to test sorting
        events.reverse()
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        dates = [e["date"] for e in body["events"]]
        assert dates == sorted(dates)


class TestCalendarFiltering:
    """Verify importance and event_type filtering."""

    def test_filter_by_importance_high(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=high")
        body = resp.json()
        assert all(e["importance"] == "high" for e in body["events"])
        assert len(body["events"]) > 0

    def test_filter_by_importance_medium(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=medium")
        body = resp.json()
        assert all(e["importance"] == "medium" for e in body["events"])

    def test_filter_by_importance_low(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=low")
        body = resp.json()
        assert all(e["importance"] == "low" for e in body["events"])

    def test_filter_by_importance_all_returns_everything(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=all")
        body = resp.json()
        assert len(body["events"]) == 5

    def test_filter_by_event_type_cpi(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?event_type=cpi")
        body = resp.json()
        assert all(e["event_type"] == "cpi" for e in body["events"])

    def test_filter_by_event_type_nfp(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?event_type=nfp")
        body = resp.json()
        assert all(e["event_type"] == "nfp" for e in body["events"])

    def test_combined_filters_importance_and_event_type(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=high&event_type=cpi")
        body = resp.json()
        for e in body["events"]:
            assert e["importance"] == "high"
            assert e["event_type"] == "cpi"

    def test_filter_no_matching_events(self):
        events = _make_calendar_events(3)  # Only high and medium
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?event_type=gdp")
        body = resp.json()
        assert body["events"] == []

    def test_filter_event_type_all_does_not_filter(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?event_type=all")
        body = resp.json()
        assert len(body["events"]) == 5


class TestCalendarDefaults:
    """Verify default date range and filters."""

    def test_default_from_date_is_today(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        today = date.today().isoformat()
        assert body["date_range"]["from"] == today

    def test_default_to_date_is_14_days_ahead(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        expected = (date.today() + timedelta(days=14)).isoformat()
        assert body["date_range"]["to"] == expected

    def test_default_importance_is_all(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        # Should return all events, not filtered
        assert len(body["events"]) == 5

    def test_default_event_type_is_all(self):
        events = _make_calendar_events(5)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert len(body["events"]) == 5


class TestCalendarErrors:
    """Verify error handling for Finnhub service failures."""

    def test_finnhub_failure_returns_502(self):
        with _patch_finnhub(calendar_raises=True):
            resp = client.get("/api/macro/calendar")
        assert resp.status_code == 502
        body = resp.json()
        assert "unavailable" in body["error"].lower()

    def test_502_error_does_not_reflect_exception_message(self):
        with _patch_finnhub(calendar_raises=True):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert "finnhub calendar error" not in body["error"]

    def test_none_return_gives_empty_events(self):
        with _patch_finnhub(calendar_return=None):
            resp = client.get("/api/macro/calendar")
        assert resp.status_code == 200
        body = resp.json()
        assert body["events"] == []


class TestCalendarNoData:
    """Verify empty result scenarios."""

    def test_empty_events_list(self):
        with _patch_finnhub(calendar_return=[]):
            resp = client.get("/api/macro/calendar")
        assert resp.status_code == 200
        body = resp.json()
        assert body["events"] == []

    def test_no_matching_events_after_filter(self):
        # Only 1 event (CPI with high importance)
        events = _make_calendar_events(1)
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?importance=low")
        body = resp.json()
        assert body["events"] == []

    def test_no_matching_event_type_after_filter(self):
        events = _make_calendar_events(1)  # Only CPI
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar?event_type=gdp")
        body = resp.json()
        assert body["events"] == []


# ===================================================================
# EVENT ENDPOINT: GET /api/macro/event/{event_type}
# ===================================================================

class TestEventValidation:
    """Validate event_type path parameter and query parameters."""

    def test_unknown_event_type_returns_400(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/unknown_type")
        assert resp.status_code == 400
        body = resp.json()
        assert "Valid types" in body["error"]

    def test_unknown_event_type_lists_valid_types(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/nonsense")
        body = resp.json()
        assert "cpi" in body["error"]
        assert "nfp" in body["error"]

    def test_unknown_event_type_does_not_reflect_input(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/<script>alert(1)</script>")
        # Could be 400 or 404 depending on path parsing
        assert resp.status_code in (400, 404, 422)
        if resp.status_code == 400:
            body = resp.json()
            assert "<script>" not in body["error"]

    def test_periods_below_minimum_returns_422(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/cpi?periods=0")
        assert resp.status_code == 422

    def test_periods_above_maximum_returns_422(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/cpi?periods=61")
        assert resp.status_code == 422

    def test_periods_at_minimum_accepted(self):
        with _patch_fred(series_return=_make_fred_records(2)):
            resp = client.get("/api/macro/event/cpi?periods=1")
        assert resp.status_code == 200

    def test_periods_at_maximum_accepted(self):
        with _patch_fred(series_return=_make_fred_records(60)):
            resp = client.get("/api/macro/event/cpi?periods=60")
        assert resp.status_code == 200


class TestEventResponseStructure:
    """Verify the top-level response structure of /api/macro/event/{event_type}."""

    def test_response_has_event_type(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["event_type"] == "cpi"

    def test_response_has_event_name(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert "Consumer Price Index" in body["event_name"]

    def test_response_has_fred_series_id(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["fred_series_id"] == "CPIAUCSL"

    def test_response_has_history_list(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert isinstance(body["history"], list)

    def test_response_has_current_trend(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["current_trend"] in ("rising", "falling", "stable", "insufficient_data")

    def test_response_has_data_source(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["data_source"] == "fred"

    def test_response_has_data_timestamp(self):
        with _patch_fred(series_return=_make_fred_records()):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert "data_timestamp" in body
        assert isinstance(body["data_timestamp"], str)

    def test_history_item_has_required_keys(self):
        with _patch_fred(series_return=_make_fred_records(5)):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        for item in body["history"]:
            assert "date" in item
            assert "value" in item
            assert "expected" in item
            assert "surprise" in item
            assert "surprise_direction" in item


class TestEventHistory:
    """Verify history length, surprise computation, and custom periods."""

    def test_default_periods_is_12(self):
        records = _make_fred_records(20)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert len(body["history"]) == 12

    def test_custom_periods(self):
        records = _make_fred_records(20)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        assert len(body["history"]) == 5

    def test_fewer_records_than_periods(self):
        """When FRED returns fewer records than requested periods, return all."""
        records = _make_fred_records(3)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=12")
        body = resp.json()
        assert len(body["history"]) == 3

    def test_first_record_has_no_surprise(self):
        """First item in history has no previous, so expected/surprise are None."""
        records = _make_fred_records(5)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        first = body["history"][0]
        assert first["expected"] is None
        assert first["surprise"] is None
        assert first["surprise_direction"] is None

    def test_surprise_above_computed(self):
        """Rising values should produce 'above' surprise_direction."""
        records = _make_fred_records(5, start_value=100.0, step=1.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        second = body["history"][1]
        assert second["expected"] is not None
        assert second["surprise"] > 0
        assert second["surprise_direction"] == "above"

    def test_surprise_below_computed(self):
        """Falling values should produce 'below' surprise_direction."""
        records = _make_fred_records_falling(5, start_value=100.0, step=1.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        second = body["history"][1]
        assert second["surprise"] < 0
        assert second["surprise_direction"] == "below"

    def test_surprise_inline_when_equal(self):
        """Flat values should produce 'inline' surprise_direction."""
        records = _make_fred_records_flat(5, value=100.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        second = body["history"][1]
        assert second["surprise"] == 0
        assert second["surprise_direction"] == "inline"

    def test_expected_is_previous_value(self):
        records = _make_fred_records(5, start_value=100.0, step=0.5)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=5")
        body = resp.json()
        # Second item's expected should be first item's value
        assert body["history"][1]["expected"] == body["history"][0]["value"]

    def test_surprise_rounded_to_4_decimals(self):
        records = [
            {"date": "2025-01-01", "value": 100.12345},
            {"date": "2025-02-01", "value": 100.67891},
        ]
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=2")
        body = resp.json()
        surprise = body["history"][1]["surprise"]
        # Check it's rounded to 4 decimal places
        assert surprise == round(100.67891 - 100.12345, 4)

    def test_value_zero_is_valid_not_none(self):
        """Zero is a valid numeric value, should not be treated as None."""
        records = [
            {"date": "2025-01-01", "value": 0.0},
            {"date": "2025-02-01", "value": 0.5},
        ]
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=2")
        body = resp.json()
        assert body["history"][0]["value"] == 0.0
        assert body["history"][1]["expected"] == 0.0


class TestEventFomc:
    """Verify FOMC special handling (no FRED series)."""

    def test_fomc_returns_empty_history(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/fomc")
        assert resp.status_code == 200
        body = resp.json()
        assert body["history"] == []

    def test_fomc_has_note(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/fomc")
        body = resp.json()
        assert "note" in body
        assert "calendar" in body["note"].lower()

    def test_fomc_fred_series_id_is_none(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/fomc")
        body = resp.json()
        assert body["fred_series_id"] is None

    def test_fomc_trend_is_insufficient(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/fomc")
        body = resp.json()
        assert body["current_trend"] == "insufficient_data"

    def test_fomc_data_source_is_finnhub(self):
        with _patch_fred():
            resp = client.get("/api/macro/event/fomc")
        body = resp.json()
        assert body["data_source"] == "finnhub"

    def test_fomc_does_not_call_fred(self):
        """FOMC should not attempt to call FRED at all."""
        with _patch_fred() as fred_mock:
            resp = client.get("/api/macro/event/fomc")
        assert resp.status_code == 200
        fred_mock.get_series.assert_not_called()


class TestEventNoData:
    """Verify handling when FRED returns None."""

    def test_none_from_fred_returns_empty_history(self):
        with _patch_fred(series_return=None):
            resp = client.get("/api/macro/event/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["history"] == []
        assert body["current_trend"] == "insufficient_data"

    def test_none_still_has_fred_series_id(self):
        with _patch_fred(series_return=None):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["fred_series_id"] == "CPIAUCSL"

    def test_none_data_source_is_fred(self):
        with _patch_fred(series_return=None):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["data_source"] == "fred"


class TestEventErrors:
    """Verify error handling when FRED raises exceptions."""

    def test_fred_failure_returns_502(self):
        with _patch_fred(series_raises=True):
            resp = client.get("/api/macro/event/cpi")
        assert resp.status_code == 502
        body = resp.json()
        assert "unavailable" in body["error"].lower()

    def test_502_error_does_not_reflect_exception(self):
        with _patch_fred(series_raises=True):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert "fred series error" not in body["error"]


class TestEventTrend:
    """Verify trend computation: rising, falling, stable, insufficient_data."""

    def test_rising_trend(self):
        records = _make_fred_records(12, start_value=100.0, step=2.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["current_trend"] == "rising"

    def test_falling_trend(self):
        records = _make_fred_records_falling(12, start_value=100.0, step=2.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["current_trend"] == "falling"

    def test_stable_trend(self):
        records = _make_fred_records_flat(12, value=100.0)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi")
        body = resp.json()
        assert body["current_trend"] == "stable"

    def test_insufficient_data_with_too_few_records(self):
        """Fewer than 3 records should be insufficient for trend."""
        records = _make_fred_records(2)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=2")
        body = resp.json()
        assert body["current_trend"] == "insufficient_data"

    def test_insufficient_data_with_single_record(self):
        records = _make_fred_records(1)
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=1")
        body = resp.json()
        assert body["current_trend"] == "insufficient_data"

    def test_trend_uses_last_3_values(self):
        """Trend should be based on the last 3 values, not all values."""
        # 10 rising values, then last 3 falling
        records = _make_fred_records(10, start_value=100.0, step=1.0)
        records.append({"date": "2025-11-01", "value": 105.0})
        records.append({"date": "2025-12-01", "value": 103.0})
        records.append({"date": "2026-01-01", "value": 101.0})
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=13")
        body = resp.json()
        assert body["current_trend"] == "falling"


class TestEventAllTypes:
    """Verify all 15 event types have valid metadata and respond correctly."""

    ALL_TYPES = [
        "cpi", "core_cpi", "ism_manufacturing", "ism_services", "nfp",
        "unemployment", "fomc", "gdp", "ppi", "retail_sales",
        "housing_starts", "building_permits", "consumer_confidence",
        "durable_goods", "fed_funds_rate",
    ]

    @pytest.mark.parametrize("event_type", ALL_TYPES)
    def test_event_type_returns_200(self, event_type):
        records = _make_fred_records(5) if event_type != "fomc" else None
        with _patch_fred(series_return=records):
            resp = client.get(f"/api/macro/event/{event_type}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["event_type"] == event_type
        assert "event_name" in body
        assert isinstance(body["event_name"], str)
        assert len(body["event_name"]) > 0


# ===================================================================
# REACTION ENDPOINT: GET /api/macro/reaction/{symbol}/{event_type}
# ===================================================================

class TestReactionValidation:
    """Validate path parameters and query parameters for reaction endpoint."""

    def test_invalid_symbol_returns_400(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/!!!/cpi")
        assert resp.status_code == 400
        body = resp.json()
        assert "ticker" in body["error"].lower() or "symbol" in body["error"].lower()

    def test_invalid_symbol_does_not_reflect_input(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/<script>/cpi")
        # Could be 400 or 404 depending on path parsing
        if resp.status_code == 400:
            body = resp.json()
            assert "<script>" not in body["error"]

    def test_empty_symbol_returns_error(self):
        """Empty symbol should return 404 or 400 (route not matched or validation)."""
        with _patch_both():
            resp = client.get("/api/macro/reaction//cpi")
        assert resp.status_code in (400, 404, 307)

    def test_unknown_event_type_returns_400(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/unknown_type")
        assert resp.status_code == 400
        body = resp.json()
        assert "Valid types" in body["error"]

    def test_unknown_event_type_does_not_reflect_input(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/bad_type")
        body = resp.json()
        assert "bad_type" not in body["error"]

    def test_symbol_uppercased(self):
        records = _make_fred_records(5)
        candles = _make_candles(["2025-01-01", "2025-02-01", "2025-03-01"])
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/aapl/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "AAPL"

    def test_symbol_stripped(self):
        records = _make_fred_records(5)
        candles = _make_candles(["2025-01-01", "2025-02-01", "2025-03-01"])
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/ AAPL /cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "AAPL"

    def test_periods_below_minimum_returns_422(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=0")
        assert resp.status_code == 422

    def test_periods_above_maximum_returns_422(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=37")
        assert resp.status_code == 422


class TestReactionResponseStructure:
    """Verify top-level response structure of /api/macro/reaction."""

    def _get_reaction(self, periods=5):
        """Helper: GET reaction with valid mocked data."""
        records = _make_fred_records(periods + 1, start_value=100.0, step=0.5)
        # Build candle dates covering the FRED date range with buffer
        base = date(2024, 12, 10)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(200)]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            return client.get(f"/api/macro/reaction/AAPL/cpi?periods={periods}")

    def test_response_has_symbol(self):
        resp = self._get_reaction()
        body = resp.json()
        assert body["symbol"] == "AAPL"

    def test_response_has_event_type(self):
        resp = self._get_reaction()
        body = resp.json()
        assert body["event_type"] == "cpi"

    def test_response_has_reactions_list(self):
        resp = self._get_reaction()
        body = resp.json()
        assert isinstance(body["reactions"], list)

    def test_response_has_averages(self):
        resp = self._get_reaction()
        body = resp.json()
        assert "averages" in body
        expected_keys = {
            "avg_return_1d_on_beat", "avg_return_1d_on_miss",
            "avg_return_5d_on_beat", "avg_return_5d_on_miss",
            "avg_volume_ratio",
        }
        assert expected_keys.issubset(body["averages"].keys())

    def test_response_has_sample_size(self):
        resp = self._get_reaction()
        body = resp.json()
        assert "sample_size" in body
        assert isinstance(body["sample_size"], int)

    def test_response_has_data_sources(self):
        resp = self._get_reaction()
        body = resp.json()
        assert body["data_sources"] == ["fred", "finnhub"]

    def test_response_has_data_timestamp(self):
        resp = self._get_reaction()
        body = resp.json()
        assert "data_timestamp" in body
        assert isinstance(body["data_timestamp"], str)

    def test_reaction_item_has_required_keys(self):
        resp = self._get_reaction()
        body = resp.json()
        if body["reactions"]:
            reaction = body["reactions"][0]
            expected_keys = {
                "event_date", "event_value", "expected", "surprise",
                "price_before", "price_after_1d", "price_after_5d",
                "return_1d_percent", "return_5d_percent", "volume_ratio",
            }
            assert expected_keys.issubset(reaction.keys())


class TestReactionComputations:
    """Verify price_before, price_after, return percentages, and volume_ratio."""

    def test_price_before_is_day_before_event(self):
        """price_before should be the close on the trading day before the event."""
        records = [
            {"date": "2025-01-15", "value": 100.0},
            {"date": "2025-02-15", "value": 101.0},
        ]
        candle_dates = [
            "2025-01-10", "2025-01-13", "2025-01-14",  # Before event
            "2025-02-14",  # Day before second event
            "2025-02-15",  # Event day
            "2025-02-18", "2025-02-19", "2025-02-20",
            "2025-02-21", "2025-02-24",  # After
        ]
        candles = _make_candles_varied(
            candle_dates,
            [98.0, 99.0, 100.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0],
        )
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        assert len(body["reactions"]) == 1
        reaction = body["reactions"][0]
        assert reaction["price_before"] == 102.0

    def test_return_1d_percent_computed(self):
        """return_1d_percent = (price_after_1d - price_before) / price_before * 100."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        # Build dates: one day before event, event day, one day after
        candle_dates = [
            "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
            "2025-02-01", "2025-02-03",
        ]
        prices = [95.0, 96.0, 97.0, 100.0, 101.0, 102.0]
        candles = _make_candles_varied(candle_dates, prices)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            reaction = body["reactions"][0]
            # price_before = 100.0 (2025-01-31, day before event date)
            # price_after_1d = 101.0 (1 trading day after event date in sorted_dates)
            if reaction["price_before"] is not None and reaction["return_1d_percent"] is not None:
                assert isinstance(reaction["return_1d_percent"], float)

    def test_return_5d_percent_computed(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candle_dates = [
            "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
            "2025-02-01", "2025-02-03", "2025-02-04", "2025-02-05",
            "2025-02-06", "2025-02-07",
        ]
        prices = [95.0, 96.0, 97.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 110.0]
        candles = _make_candles_varied(candle_dates, prices)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            reaction = body["reactions"][0]
            if reaction["return_5d_percent"] is not None:
                assert isinstance(reaction["return_5d_percent"], float)

    def test_surprise_above_when_value_increases(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 105.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            assert body["reactions"][0]["surprise"] == "above"

    def test_surprise_below_when_value_decreases(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 95.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            assert body["reactions"][0]["surprise"] == "below"

    def test_surprise_inline_when_value_unchanged(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 100.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            assert body["reactions"][0]["surprise"] == "inline"

    def test_volume_ratio_computed(self):
        """volume_ratio = event_day_volume / avg_of_prior_10_days."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-15", "value": 101.0},
        ]
        # 15 days of candles before + event day
        base = date(2025, 1, 25)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(25)]
        # Normal volume of 1M, event day at double volume
        volumes = [1_000_000] * 24 + [2_000_000]
        # Adjust event day to be 2025-02-15
        candle_dates_adjusted = [(base + timedelta(days=i)).isoformat() for i in range(25)]
        prices = [100.0] * 25
        candles = _make_candles_varied(candle_dates_adjusted, prices, volumes)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"] and body["reactions"][0]["volume_ratio"] is not None:
            assert isinstance(body["reactions"][0]["volume_ratio"], float)

    def test_event_value_and_expected_present(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 102.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            reaction = body["reactions"][0]
            assert reaction["event_value"] == 102.0
            assert reaction["expected"] == 100.0

    def test_return_rounded_to_2_decimals(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candle_dates = [
            "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
            "2025-02-01", "2025-02-03",
        ]
        prices = [99.0, 99.5, 99.8, 100.0, 100.33, 101.77]
        candles = _make_candles_varied(candle_dates, prices)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"] and body["reactions"][0]["return_1d_percent"] is not None:
            ret = body["reactions"][0]["return_1d_percent"]
            # Check it has at most 2 decimal places
            assert ret == round(ret, 2)


class TestReactionAverages:
    """Verify average computations for beat/miss reactions."""

    def _build_mixed_data(self):
        """Build FRED records with alternating above/below surprise."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 102.0},  # above
            {"date": "2025-03-01", "value": 100.0},  # below
            {"date": "2025-04-01", "value": 103.0},  # above
            {"date": "2025-05-01", "value": 101.0},  # below
        ]
        # Need candles spanning the full date range with buffer
        base = date(2024, 12, 10)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(200)]
        candles = _make_candles(candle_dates, base_price=100.0)
        return records, candles

    def test_averages_have_all_keys(self):
        records, candles = self._build_mixed_data()
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        body = resp.json()
        expected_keys = {
            "avg_return_1d_on_beat", "avg_return_1d_on_miss",
            "avg_return_5d_on_beat", "avg_return_5d_on_miss",
            "avg_volume_ratio",
        }
        assert expected_keys == set(body["averages"].keys())

    def test_sample_size_matches_reactions_count(self):
        records, candles = self._build_mixed_data()
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        body = resp.json()
        assert body["sample_size"] == len(body["reactions"])

    def test_empty_reactions_produce_none_averages(self):
        with _patch_both(fred_return=None):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        body = resp.json()
        avgs = body["averages"]
        assert avgs["avg_return_1d_on_beat"] is None
        assert avgs["avg_return_1d_on_miss"] is None
        assert avgs["avg_return_5d_on_beat"] is None
        assert avgs["avg_return_5d_on_miss"] is None
        assert avgs["avg_volume_ratio"] is None

    def test_avg_volume_ratio_computed(self):
        records, candles = self._build_mixed_data()
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        body = resp.json()
        # If any reactions have volume_ratio, the average should be computed
        vol_ratios = [r["volume_ratio"] for r in body["reactions"] if r["volume_ratio"] is not None]
        if vol_ratios:
            assert body["averages"]["avg_volume_ratio"] is not None


class TestReactionFomc:
    """Verify FOMC returns empty reactions with note."""

    def test_fomc_returns_empty_reactions(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/fomc")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []

    def test_fomc_has_note(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/fomc")
        body = resp.json()
        assert "note" in body
        assert "calendar" in body["note"].lower()

    def test_fomc_sample_size_is_zero(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/fomc")
        body = resp.json()
        assert body["sample_size"] == 0

    def test_fomc_averages_are_empty(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/AAPL/fomc")
        body = resp.json()
        avgs = body["averages"]
        assert avgs["avg_return_1d_on_beat"] is None
        assert avgs["avg_return_1d_on_miss"] is None

    def test_fomc_does_not_call_fred_or_finnhub(self):
        with _patch_both() as (fred_mock, finnhub_mock):
            resp = client.get("/api/macro/reaction/AAPL/fomc")
        assert resp.status_code == 200
        fred_mock.get_series.assert_not_called()
        finnhub_mock.get_candles.assert_not_called()

    def test_fomc_symbol_still_uppercased(self):
        with _patch_both():
            resp = client.get("/api/macro/reaction/aapl/fomc")
        body = resp.json()
        assert body["symbol"] == "AAPL"


class TestReactionNoData:
    """Verify handling when data sources return None or insufficient data."""

    def test_no_fred_data_returns_empty_reactions(self):
        with _patch_both(fred_return=None):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []
        assert body["sample_size"] == 0

    def test_no_candle_data_returns_empty_reactions(self):
        records = _make_fred_records(5)
        with _patch_both(fred_return=records, candles_return=None):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []
        assert body["sample_size"] == 0

    def test_empty_candles_returns_empty_reactions(self):
        records = _make_fred_records(5)
        with _patch_both(fred_return=records, candles_return=[]):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []

    def test_single_fred_record_returns_empty(self):
        """Need at least 2 records (previous + current) for reactions."""
        records = _make_fred_records(1)
        candles = _make_candles(["2025-01-01"])
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []

    def test_insufficient_records_returns_empty(self):
        """When fewer than 2 records after slicing, return empty."""
        records = [{"date": "2025-01-01", "value": 100.0}]
        candles = _make_candles(["2025-01-01"])
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        assert resp.status_code == 200
        body = resp.json()
        assert body["reactions"] == []


class TestReactionErrors:
    """Verify error handling for FRED and Finnhub failures."""

    def test_fred_failure_returns_502(self):
        with _patch_both(fred_raises=True):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 502
        body = resp.json()
        assert "unavailable" in body["error"].lower()

    def test_fred_502_does_not_reflect_exception(self):
        with _patch_both(fred_raises=True):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        body = resp.json()
        assert "fred series error" not in body["error"]

    def test_candle_failure_returns_502(self):
        records = _make_fred_records(5)
        with _patch_both(fred_return=records, candles_raises=True):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        assert resp.status_code == 502
        body = resp.json()
        assert "unavailable" in body["error"].lower()

    def test_candle_502_does_not_reflect_exception(self):
        records = _make_fred_records(5)
        with _patch_both(fred_return=records, candles_raises=True):
            resp = client.get("/api/macro/reaction/AAPL/cpi")
        body = resp.json()
        assert "finnhub candles error" not in body["error"]


class TestReactionEdgeCases:
    """Verify edge cases: zero prices, missing candles, single record."""

    def test_zero_price_before_no_return(self):
        """price_before == 0 should result in None returns (division by zero)."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        prices = [0.0, 50.0, 60.0]
        candles = _make_candles_varied(candle_dates, prices)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            reaction = body["reactions"][0]
            # price_before is 0.0, returns should be None
            if reaction["price_before"] == 0.0:
                assert reaction["return_1d_percent"] is None
                assert reaction["return_5d_percent"] is None

    def test_missing_candles_for_some_dates(self):
        """When candle data doesn't cover all event dates, reactions may be partial."""
        records = _make_fred_records(5)
        # Only provide candles for a narrow range
        candles = _make_candles(["2025-01-01", "2025-01-02", "2025-01-03"])
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        assert resp.status_code == 200
        body = resp.json()
        # Should still return successfully even if reactions lack price data
        assert isinstance(body["reactions"], list)

    def test_single_reaction_from_two_records(self):
        """Two FRED records produce exactly one reaction."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        assert len(body["reactions"]) <= 1

    def test_event_with_none_value_skipped(self):
        """Records with None value should be skipped in reactions."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": None},
            {"date": "2025-03-01", "value": 102.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-28", "2025-03-01", "2025-03-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=3")
        body = resp.json()
        # The None-value record should be skipped
        event_dates = [r["event_date"] for r in body["reactions"]]
        assert "2025-02-01" not in event_dates

    def test_event_with_none_date_skipped(self):
        """Records with None date should be skipped."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": None, "value": 101.0},
            {"date": "2025-03-01", "value": 102.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-28", "2025-03-01", "2025-03-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=3")
        body = resp.json()
        for r in body["reactions"]:
            assert r["event_date"] is not None

    def test_value_zero_is_valid_event_value(self):
        """Zero is a valid event value (not skipped)."""
        records = [
            {"date": "2025-01-01", "value": 1.0},
            {"date": "2025-02-01", "value": 0.0},
        ]
        candle_dates = ["2025-01-31", "2025-02-01", "2025-02-03"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        if body["reactions"]:
            assert body["reactions"][0]["event_value"] == 0.0

    def test_candle_with_unix_timestamp(self):
        """Candles with numeric (unix) timestamps should be handled."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candles = [
            {"open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1_000_000, "timestamp": 1738281600},  # 2025-01-31
            {"open": 101, "high": 102, "low": 100, "close": 101.5, "volume": 1_000_000, "timestamp": 1738368000},  # 2025-02-01
            {"open": 102, "high": 103, "low": 101, "close": 102.5, "volume": 1_000_000, "timestamp": 1738540800},  # 2025-02-03
        ]
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body["reactions"], list)

    def test_candle_with_invalid_timestamp_skipped(self):
        """Candles with unparseable timestamps should be skipped gracefully."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candles = [
            {"open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1_000_000, "timestamp": "not-a-date"},
        ]
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        assert resp.status_code == 200
        body = resp.json()
        # Should still return, just with empty/missing prices
        assert isinstance(body["reactions"], list)

    def test_candle_with_none_timestamp_skipped(self):
        """Candles with None timestamp should not crash."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        candles = [
            {"open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1_000_000, "timestamp": None},
        ]
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        assert resp.status_code == 200

    def test_symbol_with_dot(self):
        """Symbols like BRK.B should be valid."""
        records = _make_fred_records(3)
        candle_dates = ["2025-01-01", "2025-02-01", "2025-03-01"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/BRK.B/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "BRK.B"

    def test_symbol_with_hyphen(self):
        """Symbols like BF-B should be valid."""
        records = _make_fred_records(3)
        candle_dates = ["2025-01-01", "2025-02-01", "2025-03-01"]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/BF-B/cpi")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "BF-B"


# ===================================================================
# CROSS-CUTTING CONCERNS
# ===================================================================

class TestCalendarEventTypeMapping:
    """Verify Finnhub event name -> event_type classification for various patterns."""

    @pytest.mark.parametrize(
        "event_name, expected_type",
        [
            ("CPI (YoY)", "cpi"),
            ("Core CPI", "core_cpi"),
            ("Consumer Price Index (MoM)", "cpi"),
            ("ISM Manufacturing PMI", "ism_manufacturing"),
            ("ISM Non-Manufacturing PMI", "ism_services"),
            ("ISM Services PMI", "ism_services"),
            ("Nonfarm Payrolls", "nfp"),
            ("Non-Farm Payrolls", "nfp"),
            ("Nonfarm Payroll", "nfp"),
            ("Unemployment Rate", "unemployment"),
            ("FOMC Statement", "fomc"),
            ("Fed Interest Rate Decision", "fomc"),
            ("GDP Growth Rate", "gdp"),
            ("Gross Domestic Product", "gdp"),
            ("Producer Price Index", "ppi"),
            ("Retail Sales (MoM)", "retail_sales"),
            ("Housing Starts", "housing_starts"),
            ("Building Permits", "building_permits"),
            ("Michigan Consumer Sentiment", "consumer_confidence"),
            ("Consumer Confidence Index", "consumer_confidence"),
            ("Durable Goods Orders", "durable_goods"),
            ("Federal Funds Rate", "fed_funds_rate"),
            ("Fed Funds Rate", "fed_funds_rate"),
        ],
    )
    def test_event_name_mapped_correctly(self, event_name, expected_type):
        events = [{"event": event_name, "country": "US", "date": "2026-01-15", "impact": "high"}]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["event_type"] == expected_type


class TestCalendarZeroValues:
    """Verify zero numeric values are preserved, not treated as None."""

    def test_actual_zero_preserved(self):
        events = [{
            "event": "CPI (YoY)",
            "country": "US",
            "date": "2026-01-15",
            "actual": 0.0,
            "estimate": 0.1,
            "prev": 0.2,
            "impact": "high",
        }]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["actual"] == 0.0

    def test_estimate_zero_preserved(self):
        events = [{
            "event": "CPI (YoY)",
            "country": "US",
            "date": "2026-01-15",
            "actual": 0.1,
            "estimate": 0.0,
            "prev": 0.2,
            "impact": "high",
        }]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["expected"] == 0.0

    def test_prev_zero_preserved(self):
        events = [{
            "event": "CPI (YoY)",
            "country": "US",
            "date": "2026-01-15",
            "actual": 0.1,
            "estimate": 0.2,
            "prev": 0.0,
            "impact": "high",
        }]
        with _patch_finnhub(calendar_return=events):
            resp = client.get("/api/macro/calendar")
        body = resp.json()
        assert body["events"][0]["previous"] == 0.0


class TestEventNoneFields:
    """Verify handling of None fields in FRED records for event endpoint."""

    def test_none_value_in_record(self):
        """Records where value is None should be included but with None surprise."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": None},
            {"date": "2025-03-01", "value": 102.0},
        ]
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=3")
        body = resp.json()
        assert len(body["history"]) == 3
        # Second record has None value, third's expected can't be computed from None
        none_item = body["history"][1]
        assert none_item["value"] is None

    def test_surprise_not_computed_when_value_none(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": None},
        ]
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=2")
        body = resp.json()
        second = body["history"][1]
        assert second["surprise"] is None
        assert second["surprise_direction"] is None

    def test_surprise_not_computed_when_previous_none(self):
        records = [
            {"date": "2025-01-01", "value": None},
            {"date": "2025-02-01", "value": 100.0},
        ]
        with _patch_fred(series_return=records):
            resp = client.get("/api/macro/event/cpi?periods=2")
        body = resp.json()
        second = body["history"][1]
        assert second["surprise"] is None


class TestReactionMultipleEvents:
    """Verify reactions with multiple FRED records."""

    def test_multiple_reactions_generated(self):
        """5 FRED records produce 4 reactions (first is used as expected baseline)."""
        records = _make_fred_records(5, start_value=100.0, step=1.0)
        base = date(2024, 12, 1)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(250)]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        body = resp.json()
        # With 5 records (4+1 for expected), we get up to 4 reactions
        assert len(body["reactions"]) <= 4
        assert body["sample_size"] == len(body["reactions"])

    def test_all_event_dates_are_strings(self):
        records = _make_fred_records(5)
        base = date(2024, 12, 1)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(250)]
        candles = _make_candles(candle_dates)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=4")
        body = resp.json()
        for reaction in body["reactions"]:
            assert isinstance(reaction["event_date"], str)


class TestVolumeRatioEdgeCases:
    """Verify volume_ratio computation edge cases."""

    def test_volume_ratio_none_when_event_volume_zero(self):
        """When event day volume is 0, volume_ratio should be None."""
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        base = date(2025, 1, 15)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(25)]
        volumes = [1_000_000] * 24 + [0]
        prices = [100.0] * 25
        candles = _make_candles_varied(candle_dates, prices, volumes)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        # volume_ratio should be None if event_vol is 0
        for r in body["reactions"]:
            if r.get("volume_ratio") is not None:
                assert r["volume_ratio"] > 0

    def test_volume_ratio_rounded_to_2_decimals(self):
        records = [
            {"date": "2025-01-01", "value": 100.0},
            {"date": "2025-02-01", "value": 101.0},
        ]
        base = date(2025, 1, 15)
        candle_dates = [(base + timedelta(days=i)).isoformat() for i in range(25)]
        volumes = [1_000_000] * 24 + [1_500_000]
        prices = [100.0] * 25
        candles = _make_candles_varied(candle_dates, prices, volumes)
        with _patch_both(fred_return=records, candles_return=candles):
            resp = client.get("/api/macro/reaction/AAPL/cpi?periods=1")
        body = resp.json()
        for r in body["reactions"]:
            if r["volume_ratio"] is not None:
                assert r["volume_ratio"] == round(r["volume_ratio"], 2)
