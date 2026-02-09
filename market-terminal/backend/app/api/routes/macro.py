"""Macro economic routes -- calendar, event history, price reactions.

GET /api/macro/calendar              returns upcoming economic events (Finnhub).
GET /api/macro/event/{event_type}    returns historical indicator data (FRED).
GET /api/macro/reaction/{symbol}/{event_type}
                                     returns historical price reactions.

Full implementation: TASK-API-006
"""
from __future__ import annotations

import logging
import re
from bisect import bisect_left
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.finnhub_client import get_finnhub_client
from app.data.fred_client import get_fred_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/macro", tags=["macro"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_MAX_CALENDAR_RANGE_DAYS = 90
_MAX_EVENT_PERIODS = 60
_DEFAULT_EVENT_PERIODS = 12
_MAX_REACTION_PERIODS = 36
_DEFAULT_REACTION_PERIODS = 12

# Event type → metadata (name, FRED series ID, FredClient indicator key)
_EVENT_TYPES: dict[str, dict[str, Any]] = {
    "cpi": {"name": "Consumer Price Index (YoY)", "fred_id": "CPIAUCSL", "fred_indicator": "cpi_headline", "unit": "percent"},
    "core_cpi": {"name": "Core CPI (YoY)", "fred_id": "CPILFESL", "fred_indicator": "cpi_core", "unit": "percent"},
    "ism_manufacturing": {"name": "ISM Manufacturing Index", "fred_id": "MANEMP", "fred_indicator": "manufacturing_employment", "unit": "index"},
    "ism_services": {"name": "ISM Services Index", "fred_id": "NMFCI", "fred_indicator": "ism_services", "unit": "index"},
    "nfp": {"name": "Non-Farm Payrolls", "fred_id": "PAYEMS", "fred_indicator": "nonfarm_payrolls", "unit": "thousands"},
    "unemployment": {"name": "Unemployment Rate", "fred_id": "UNRATE", "fred_indicator": "unemployment_rate", "unit": "percent"},
    "fomc": {"name": "FOMC Rate Decision", "fred_id": None, "fred_indicator": None, "unit": "percent"},
    "gdp": {"name": "Gross Domestic Product", "fred_id": "GDP", "fred_indicator": "gdp", "unit": "billions_usd"},
    "ppi": {"name": "Producer Price Index", "fred_id": "PPIACO", "fred_indicator": "ppi", "unit": "index"},
    "retail_sales": {"name": "Retail Sales", "fred_id": "RSAFS", "fred_indicator": "retail_sales", "unit": "millions_usd"},
    "housing_starts": {"name": "Housing Starts", "fred_id": "HOUST", "fred_indicator": "housing_starts", "unit": "thousands"},
    "building_permits": {"name": "Building Permits", "fred_id": "PERMIT", "fred_indicator": "building_permits", "unit": "thousands"},
    "consumer_confidence": {"name": "U of M Consumer Sentiment", "fred_id": "UMCSENT", "fred_indicator": "consumer_confidence", "unit": "index"},
    "durable_goods": {"name": "Durable Goods Orders", "fred_id": "DGORDER", "fred_indicator": "durable_goods", "unit": "millions_usd"},
    "fed_funds_rate": {"name": "Federal Funds Rate", "fred_id": "FEDFUNDS", "fred_indicator": "fed_funds_rate", "unit": "percent"},
}

_VALID_IMPORTANCE = {"high", "medium", "low", "all"}

# Finnhub event name patterns → our event_type slugs.
# Longer/more-specific patterns MUST come before shorter ones so that
# e.g. "Core CPI" matches "core_cpi" before the generic "cpi" pattern.
_FINNHUB_EVENT_MAP: dict[str, str] = {
    "core cpi": "core_cpi",
    "consumer price": "cpi",
    "cpi": "cpi",
    "ism non-manufacturing": "ism_services",
    "ism services": "ism_services",
    "ism manufacturing": "ism_manufacturing",
    "nonfarm payrolls": "nfp",
    "non-farm payrolls": "nfp",
    "nonfarm payroll": "nfp",
    "unemployment rate": "unemployment",
    "fed interest rate": "fomc",
    "federal funds": "fed_funds_rate",
    "fed funds": "fed_funds_rate",
    "fomc": "fomc",
    "gross domestic": "gdp",
    "gdp": "gdp",
    "producer price": "ppi",
    "retail sales": "retail_sales",
    "housing starts": "housing_starts",
    "building permits": "building_permits",
    "michigan consumer": "consumer_confidence",
    "consumer confidence": "consumer_confidence",
    "consumer sentiment": "consumer_confidence",
    "durable goods": "durable_goods",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_symbol(symbol: str) -> str:
    """Strip, upper-case, and validate *symbol*.  Raises 400 on failure."""
    cleaned = symbol.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")
    return cleaned


def _validate_date(date_str: str) -> str:
    """Validate date string as YYYY-MM-DD.  Raises 400 on bad format."""
    if not _DATE_RE.match(date_str):
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Expected YYYY-MM-DD",
        )
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Expected YYYY-MM-DD",
        )
    return date_str


def _classify_finnhub_event(event_name: str) -> str | None:
    """Map a Finnhub event name to our event_type slug, or None."""
    lower = event_name.lower()
    for pattern, event_type in _FINNHUB_EVENT_MAP.items():
        if pattern in lower:
            return event_type
    return None


def _map_importance(impact: str | None) -> str:
    """Map Finnhub impact string to our importance level."""
    if impact is None:
        return "low"
    mapping = {"high": "high", "medium": "medium", "low": "low"}
    return mapping.get(impact.lower(), "low")


def _format_calendar_event(raw: dict[str, Any]) -> dict[str, Any]:
    """Format a Finnhub calendar event to our API response format."""
    event_name = raw.get("event", "")
    event_type = _classify_finnhub_event(event_name)

    actual = raw.get("actual")
    estimate = raw.get("estimate")
    prev = raw.get("prev")

    return {
        "event_name": event_name,
        "event_type": event_type,
        "date": raw.get("date"),
        "time": raw.get("time"),
        "country": raw.get("country", "US"),
        "expected": estimate,
        "previous": prev,
        "actual": actual,
        "unit": raw.get("unit", ""),
        "importance": _map_importance(raw.get("impact")),
        "description": (
            _EVENT_TYPES[event_type]["name"]
            if event_type and event_type in _EVENT_TYPES
            else event_name
        ),
    }


def _compute_trend(history: list[dict[str, Any]]) -> str:
    """Compute trend from recent values: rising, falling, stable."""
    values = [h["value"] for h in history if h.get("value") is not None]
    if len(values) < 3:
        return "insufficient_data"

    recent = values[-3:]
    diffs = [recent[i + 1] - recent[i] for i in range(len(recent) - 1)]
    avg_diff = sum(diffs) / len(diffs)

    mean_val = sum(abs(v) for v in recent) / len(recent) if recent else 1
    threshold = mean_val * 0.005 if mean_val != 0 else 0.01

    if avg_diff > threshold:
        return "rising"
    elif avg_diff < -threshold:
        return "falling"
    return "stable"


# ---------------------------------------------------------------------------
# Price-lookup helpers for reaction endpoint
# ---------------------------------------------------------------------------
def _build_price_lookup(candles: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Build date → {close, volume} lookup from candle data."""
    lookup: dict[str, dict[str, Any]] = {}
    for candle in candles:
        ts = candle.get("timestamp")
        if ts is None:
            continue
        try:
            if isinstance(ts, str):
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            else:
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            date_str = dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError, OSError):
            continue
        lookup[date_str] = {
            "close": candle.get("close"),
            "volume": candle.get("volume"),
        }
    return lookup


def _get_price_before(
    event_date: str,
    sorted_dates: list[str],
    lookup: dict[str, dict[str, Any]],
) -> float | None:
    """Get closing price the trading day before *event_date*."""
    idx = bisect_left(sorted_dates, event_date)
    if idx > 0:
        return lookup[sorted_dates[idx - 1]].get("close")
    return None


def _get_price_after(
    event_date: str,
    sorted_dates: list[str],
    lookup: dict[str, dict[str, Any]],
    days: int,
) -> float | None:
    """Get closing price *days* trading days after *event_date*.

    Handles both trading-day and non-trading-day events consistently
    by normalizing the base index to the first trading day after the event.
    """
    idx = bisect_left(sorted_dates, event_date)
    # If event_date is in sorted_dates, skip it (base = first day AFTER event)
    if idx < len(sorted_dates) and sorted_dates[idx] == event_date:
        base = idx + 1
    else:
        # event_date is not a trading day; idx already points to next trading day
        base = idx
    target_idx = base + (days - 1)
    if target_idx < len(sorted_dates):
        return lookup[sorted_dates[target_idx]].get("close")
    return None


def _compute_volume_ratio(
    event_date: str,
    sorted_dates: list[str],
    lookup: dict[str, dict[str, Any]],
) -> float | None:
    """Compute event-day volume / 10-day average volume."""
    idx = bisect_left(sorted_dates, event_date)

    # Resolve event-day index (exact match or next trading day)
    event_idx = idx
    if idx >= len(sorted_dates):
        return None

    event_vol = lookup[sorted_dates[event_idx]].get("volume")
    if event_vol is None or event_vol == 0:
        return None

    volumes: list[float] = []
    start = max(0, event_idx - 10)
    for i in range(start, event_idx):
        vol = lookup[sorted_dates[i]].get("volume")
        if vol is not None and vol > 0:
            volumes.append(vol)

    if not volumes:
        return None

    avg_vol = sum(volumes) / len(volumes)
    if avg_vol == 0:
        return None

    return round(event_vol / avg_vol, 2)


def _empty_averages() -> dict[str, Any]:
    """Return empty averages structure."""
    return {
        "avg_return_1d_on_beat": None,
        "avg_return_1d_on_miss": None,
        "avg_return_5d_on_beat": None,
        "avg_return_5d_on_miss": None,
        "avg_volume_ratio": None,
    }


def _compute_averages(reactions: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute average returns split by beat/miss."""
    beats_1d: list[float] = []
    misses_1d: list[float] = []
    beats_5d: list[float] = []
    misses_5d: list[float] = []
    vol_ratios: list[float] = []

    for r in reactions:
        surprise = r.get("surprise")
        ret_1d = r.get("return_1d_percent")
        ret_5d = r.get("return_5d_percent")
        vol = r.get("volume_ratio")

        if vol is not None:
            vol_ratios.append(vol)

        if surprise == "above":
            if ret_1d is not None:
                beats_1d.append(ret_1d)
            if ret_5d is not None:
                beats_5d.append(ret_5d)
        elif surprise == "below":
            if ret_1d is not None:
                misses_1d.append(ret_1d)
            if ret_5d is not None:
                misses_5d.append(ret_5d)

    def _avg(lst: list[float]) -> float | None:
        return round(sum(lst) / len(lst), 2) if lst else None

    return {
        "avg_return_1d_on_beat": _avg(beats_1d),
        "avg_return_1d_on_miss": _avg(misses_1d),
        "avg_return_5d_on_beat": _avg(beats_5d),
        "avg_return_5d_on_miss": _avg(misses_5d),
        "avg_volume_ratio": _avg(vol_ratios),
    }


# ---------------------------------------------------------------------------
# Calendar endpoint
# ---------------------------------------------------------------------------
@router.get("/calendar")
async def get_calendar(
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    importance: str = Query(default="all"),
    event_type: str = Query(default="all"),
) -> dict[str, Any]:
    """Return upcoming economic events from Finnhub."""
    now = datetime.now(timezone.utc)

    if from_date is None:
        from_date = now.strftime("%Y-%m-%d")
    else:
        from_date = _validate_date(from_date)

    if to_date is None:
        to_date = (now + timedelta(days=14)).strftime("%Y-%m-%d")
    else:
        to_date = _validate_date(to_date)

    # Validate date range ordering and maximum span
    from_dt = datetime.strptime(from_date, "%Y-%m-%d")
    to_dt = datetime.strptime(to_date, "%Y-%m-%d")
    if to_dt < from_dt:
        raise HTTPException(
            status_code=400,
            detail="to_date must be on or after from_date",
        )
    if (to_dt - from_dt).days > _MAX_CALENDAR_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Date range exceeds maximum of {_MAX_CALENDAR_RANGE_DAYS} days",
        )

    if importance not in _VALID_IMPORTANCE:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid importance. Must be one of: {', '.join(sorted(_VALID_IMPORTANCE))}",
        )

    valid_event_types = set(_EVENT_TYPES.keys()) | {"all"}
    if event_type not in valid_event_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type. Must be one of: {', '.join(sorted(valid_event_types))}",
        )

    finnhub = get_finnhub_client()
    try:
        raw_events = await finnhub.get_economic_calendar(from_date, to_date)
    except Exception:
        logger.warning("Calendar fetch error", exc_info=True)
        raise HTTPException(status_code=502, detail="Calendar service unavailable")

    if raw_events is None:
        raw_events = []

    events = [_format_calendar_event(e) for e in raw_events]

    # Filter by importance
    if importance != "all":
        events = [e for e in events if e["importance"] == importance]

    # Filter by event_type
    if event_type != "all":
        events = [e for e in events if e["event_type"] == event_type]

    # Sort by date
    events.sort(key=lambda e: e.get("date") or "")

    return {
        "events": events,
        "date_range": {"from": from_date, "to": to_date},
        "data_source": "finnhub",
        "data_timestamp": now.isoformat(),
    }


# ---------------------------------------------------------------------------
# Event history endpoint
# ---------------------------------------------------------------------------
@router.get("/event/{event_type}")
async def get_event(
    event_type: str,
    periods: int = Query(default=_DEFAULT_EVENT_PERIODS, ge=1, le=_MAX_EVENT_PERIODS),
    include_revisions: bool = Query(default=False),
) -> dict[str, Any]:
    """Return historical data for a specific economic indicator from FRED."""
    if event_type not in _EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown event type. Valid types: {', '.join(sorted(_EVENT_TYPES.keys()))}",
        )

    now = datetime.now(timezone.utc)
    meta = _EVENT_TYPES[event_type]

    # FOMC has no FRED series
    if meta["fred_indicator"] is None:
        return {
            "event_type": event_type,
            "event_name": meta["name"],
            "fred_series_id": None,
            "history": [],
            "current_trend": "insufficient_data",
            "data_source": "finnhub",
            "data_timestamp": now.isoformat(),
            "note": "FOMC decisions are available via calendar only",
        }

    fred = get_fred_client()
    try:
        records = await fred.get_series(meta["fred_indicator"])
    except Exception:
        logger.warning("FRED fetch error for %s", event_type, exc_info=True)
        raise HTTPException(status_code=502, detail="FRED service unavailable")

    if records is None:
        return {
            "event_type": event_type,
            "event_name": meta["name"],
            "fred_series_id": meta["fred_id"],
            "history": [],
            "current_trend": "insufficient_data",
            "data_source": "fred",
            "data_timestamp": now.isoformat(),
        }

    # Take last N records
    recent = records[-periods:] if len(records) > periods else records

    # Build history with surprise relative to previous observation
    history: list[dict[str, Any]] = []
    for i, rec in enumerate(recent):
        value = rec.get("value")
        expected = None
        surprise = None
        surprise_direction = None

        if i > 0 and recent[i - 1].get("value") is not None and value is not None:
            expected = recent[i - 1]["value"]
            surprise = round(value - expected, 4)
            if surprise > 0:
                surprise_direction = "above"
            elif surprise < 0:
                surprise_direction = "below"
            else:
                surprise_direction = "inline"

        history.append({
            "date": rec.get("date"),
            "value": value,
            "expected": expected,
            "surprise": surprise,
            "surprise_direction": surprise_direction,
        })

    trend = _compute_trend(history)

    return {
        "event_type": event_type,
        "event_name": meta["name"],
        "fred_series_id": meta["fred_id"],
        "history": history,
        "current_trend": trend,
        "data_source": "fred",
        "data_timestamp": now.isoformat(),
    }


# ---------------------------------------------------------------------------
# Reaction endpoint
# ---------------------------------------------------------------------------
@router.get("/reaction/{symbol}/{event_type}")
async def get_reaction(
    symbol: str,
    event_type: str,
    periods: int = Query(default=_DEFAULT_REACTION_PERIODS, ge=1, le=_MAX_REACTION_PERIODS),
) -> dict[str, Any]:
    """Return historical price reactions to economic events."""
    symbol = _validate_symbol(symbol)

    if event_type not in _EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown event type. Valid types: {', '.join(sorted(_EVENT_TYPES.keys()))}",
        )

    now = datetime.now(timezone.utc)
    meta = _EVENT_TYPES[event_type]

    if meta["fred_indicator"] is None:
        return {
            "symbol": symbol,
            "event_type": event_type,
            "reactions": [],
            "averages": _empty_averages(),
            "sample_size": 0,
            "data_sources": ["fred", "finnhub"],
            "data_timestamp": now.isoformat(),
            "note": "FOMC reaction analysis requires calendar dates",
        }

    # Get FRED history
    fred = get_fred_client()
    try:
        records = await fred.get_series(meta["fred_indicator"])
    except Exception:
        logger.warning("FRED fetch error for reaction %s", event_type, exc_info=True)
        raise HTTPException(status_code=502, detail="FRED service unavailable")

    if records is None or len(records) < 2:
        return {
            "symbol": symbol,
            "event_type": event_type,
            "reactions": [],
            "averages": _empty_averages(),
            "sample_size": 0,
            "data_sources": ["fred", "finnhub"],
            "data_timestamp": now.isoformat(),
        }

    # Take last N+1 records (need previous for expected)
    recent = records[-(periods + 1):] if len(records) > periods + 1 else records

    if len(recent) < 2:
        return {
            "symbol": symbol,
            "event_type": event_type,
            "reactions": [],
            "averages": _empty_averages(),
            "sample_size": 0,
            "data_sources": ["fred", "finnhub"],
            "data_timestamp": now.isoformat(),
        }

    # Fetch candle data covering the entire date range with buffer
    first_date = recent[0].get("date", "")
    last_date = recent[-1].get("date", "")

    try:
        first_dt = datetime.strptime(first_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        last_dt = datetime.strptime(last_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        from_ts = int((first_dt - timedelta(days=20)).timestamp())
        to_ts = int((last_dt + timedelta(days=15)).timestamp())
    except (ValueError, TypeError):
        return {
            "symbol": symbol,
            "event_type": event_type,
            "reactions": [],
            "averages": _empty_averages(),
            "sample_size": 0,
            "data_sources": ["fred", "finnhub"],
            "data_timestamp": now.isoformat(),
        }

    finnhub = get_finnhub_client()
    try:
        candles = await finnhub.get_candles(symbol, "D", from_ts, to_ts)
    except Exception:
        logger.warning("Candle fetch error for %s", symbol, exc_info=True)
        raise HTTPException(status_code=502, detail="Price data unavailable")

    if candles is None or not candles:
        return {
            "symbol": symbol,
            "event_type": event_type,
            "reactions": [],
            "averages": _empty_averages(),
            "sample_size": 0,
            "data_sources": ["fred", "finnhub"],
            "data_timestamp": now.isoformat(),
        }

    # Build price lookup and compute reactions
    price_by_date = _build_price_lookup(candles)
    sorted_dates = sorted(price_by_date.keys())

    reactions: list[dict[str, Any]] = []
    for i in range(1, len(recent)):
        rec = recent[i]
        event_date = rec.get("date")
        value = rec.get("value")
        prev_value = recent[i - 1].get("value")

        if event_date is None or value is None:
            continue

        surprise = "inline"
        if prev_value is not None:
            if value > prev_value:
                surprise = "above"
            elif value < prev_value:
                surprise = "below"

        price_before = _get_price_before(event_date, sorted_dates, price_by_date)
        price_after_1d = _get_price_after(event_date, sorted_dates, price_by_date, days=1)
        price_after_5d = _get_price_after(event_date, sorted_dates, price_by_date, days=5)
        volume_ratio = _compute_volume_ratio(event_date, sorted_dates, price_by_date)

        return_1d = None
        return_5d = None
        if price_before is not None and price_before > 0:
            if price_after_1d is not None:
                return_1d = round((price_after_1d - price_before) / price_before * 100, 2)
            if price_after_5d is not None:
                return_5d = round((price_after_5d - price_before) / price_before * 100, 2)

        reactions.append({
            "event_date": event_date,
            "event_value": value,
            "expected": prev_value,
            "surprise": surprise,
            "price_before": price_before,
            "price_after_1d": price_after_1d,
            "price_after_5d": price_after_5d,
            "return_1d_percent": return_1d,
            "return_5d_percent": return_5d,
            "volume_ratio": volume_ratio,
        })

    averages = _compute_averages(reactions)

    return {
        "symbol": symbol,
        "event_type": event_type,
        "reactions": reactions,
        "averages": averages,
        "sample_size": len(reactions),
        "data_sources": ["fred", "finnhub"],
        "data_timestamp": now.isoformat(),
    }
