"""Economic Calendar API endpoints.

Provides REST endpoints for weekly/daily economic events, historical releases,
and ML predictions, leveraging data from ForexFactory, Finnhub, and JBlanked.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from app.data.cache import CacheManager
from app.data.cache_types import CachedResult

router = APIRouter(prefix="/api/economic-calendar", tags=["economic-calendar"])
_cache_mgr = CacheManager()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class EconomicEventResponse(BaseModel):
    event_name: str
    country: str | None
    event_date: str
    event_time: str | None
    impact: str | None
    impact_color: str | None
    forecast: str | None
    forecast_display: str | None
    previous: str | None
    actual: str | None
    comparison: str | None
    comparison_color: str | None
    event_type: str | None
    is_released: bool | None
    source: str


class CalendarWeekResponse(BaseModel):
    week_start: str
    week_end: str
    event_count: int
    events: list[EconomicEventResponse]


class CalendarTodayResponse(BaseModel):
    date: str
    event_count: int
    events: list[EconomicEventResponse]


class EventReleaseItem(BaseModel):
    date: str
    actual: str | None
    forecast: str | None
    previous: str | None
    outcome: str | None


class EventHistoryResponse(BaseModel):
    event_id: str
    event_name: str
    releases: list[EventReleaseItem]
    release_count: int


class PredictionItem(BaseModel):
    event_name: str
    event_date: str
    prediction_1min: dict | None
    prediction_30min: dict | None
    prediction_1hr: dict | None
    model_accuracy: float | None
    is_experimental: bool


class PredictionsResponse(BaseModel):
    predictions: list[PredictionItem]
    prediction_count: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

INVERTED_METRICS = ["unemployment", "jobless claims", "initial claims"]


def _compute_impact_color(impact: str | None) -> str | None:
    if not impact:
        return None
    imp = impact.lower()
    if imp == "high":
        return "red"
    if imp == "medium":
        return "orange"
    if imp == "low":
        return "yellow"
    return None


def _parse_float(val: str | None) -> float | None:
    if not val or val == "N/A":
        return None
    # Strip everything except digits, decimal point, and minus sign
    cln = re.sub(r"[^\d\.\-]", "", str(val))
    try:
        return float(cln)
    except ValueError:
        return None


def _is_inverted(event_name: str) -> bool:
    name_lower = event_name.lower()
    for metric in INVERTED_METRICS:
        if metric in name_lower:
            return True
    return False


def _compute_comparison(
    actual: str | None, forecast: str | None, event_name: str
) -> tuple[str | None, str | None]:
    if not actual or actual == "N/A" or not forecast or forecast == "N/A":
        return None, None

    act_val = _parse_float(actual)
    for_val = _parse_float(forecast)

    if act_val is None or for_val is None:
        return None, None

    inverted = _is_inverted(event_name)
    diff = act_val - for_val

    if abs(diff) < 0.001:
        return "inline", None

    better = (diff > 0 and not inverted) or (diff < 0 and inverted)
    if better:
        return "better", "green"
    return "worse", "red"


def _map_event(raw: dict, default_source: str) -> EconomicEventResponse:
    impact = raw.get("impact")
    forecast = raw.get("forecast")
    if forecast == "N/A":
        forecast = None

    act = raw.get("actual")
    if act == "N/A":
        act = None

    forecast_display = str(forecast) if forecast is not None else "N/A"
    event_type = raw.get("event_type", "indicator")
    event_name = raw.get("event_name", "")

    if event_type in ("speech", "hearing"):
        comparison, comparison_color = None, None
        forecast = None
        forecast_display = "N/A"
    else:
        comparison, comparison_color = _compute_comparison(act, forecast, event_name)

    is_released = act is not None
    source = raw.get("source", default_source)

    return EconomicEventResponse(
        event_name=event_name,
        country=raw.get("country"),
        event_date=raw.get("event_date", ""),
        event_time=raw.get("event_time"),
        impact=impact,
        impact_color=_compute_impact_color(impact),
        forecast=forecast,
        forecast_display=forecast_display,
        previous=raw.get("previous"),
        actual=act,
        comparison=comparison,
        comparison_color=comparison_color,
        event_type=event_type,
        is_released=is_released,
        source=source,
    )


def _handle_client_error(data: dict | None, is_jblanked: bool = False) -> None:
    if data is None:
        if is_jblanked:
            raise HTTPException(
                status_code=503, detail="Event history data source not available."
            )
        raise HTTPException(
            status_code=503, detail="Economic calendar data temporarily unavailable."
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/week", response_model=CachedResult)
async def get_weekly_calendar() -> CachedResult:
    """Get this week's economic events."""
    result = await _cache_mgr.get_or_fetch(
        "economic_calendar", "calendar", "weekly",
        source_override="forex_calendar"
    )

    _handle_client_error(result.data if result else None)
    assert result is not None

    data = result.data
    raw_events = data.get("events", [])
    source = data.get("_source", "forexfactory")

    mapped_events = [_map_event(e, source) for e in raw_events]

    response_data = CalendarWeekResponse(
        week_start=data.get("week_start", ""),
        week_end=data.get("week_end", ""),
        event_count=len(mapped_events),
        events=mapped_events,
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type=result.data_type,
        cache_key=result.cache_key,
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )


@router.get("/today", response_model=CachedResult)
async def get_today_events() -> CachedResult:
    """Get today's economic events."""
    result = await _cache_mgr.get_or_fetch(
        "economic_calendar", "calendar", "today",
        source_override="forex_calendar"
    )

    _handle_client_error(result.data if result else None)
    assert result is not None

    data = result.data
    raw_events = data.get("events", [])
    source = data.get("_source", "forexfactory")

    mapped_events = [_map_event(e, source) for e in raw_events]

    response_data = CalendarTodayResponse(
        date=data.get("date", ""),
        event_count=len(mapped_events),
        events=mapped_events,
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type=result.data_type,
        cache_key=result.cache_key,
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )


@router.get("/event/{event_id}/history", response_model=CachedResult)
async def get_event_history(
    event_id: str = Path(..., min_length=1, max_length=100),
) -> CachedResult:
    """Get history of an economic event via JBlanked."""
    event_id = event_id.strip()
    if not event_id:
        raise HTTPException(status_code=422, detail="event_id cannot be empty")

    result = await _cache_mgr.get_or_fetch(
        "economic_calendar", "calendar", "history",
        fetch_kwargs={"event_id": event_id},
        source_override="forex_calendar"
    )

    _handle_client_error(result.data if result else None, is_jblanked=True)
    assert result is not None

    data = result.data
    
    # Validation against reflection
    safe_event_id = data.get("event_id", "")
    
    releases = []
    for r in data.get("releases", []):
        releases.append(
            EventReleaseItem(
                date=r.get("date", ""),
                actual=str(r.get("actual")) if r.get("actual") is not None else None,
                forecast=str(r.get("forecast")) if r.get("forecast") is not None else None,
                previous=str(r.get("previous")) if r.get("previous") is not None else None,
                outcome=r.get("outcome") or r.get("comparison")
            )
        )

    response_data = EventHistoryResponse(
        event_id=safe_event_id,
        event_name=data.get("event_name", ""),
        releases=releases,
        release_count=len(releases)
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type=result.data_type,
        cache_key=result.cache_key,
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )


@router.get("/predictions", response_model=CachedResult)
async def get_predictions() -> CachedResult:
    """Get ML predictions for incoming events via JBlanked."""
    result = await _cache_mgr.get_or_fetch(
        "economic_calendar", "calendar", "predictions",
        source_override="forex_calendar"
    )

    # Empty array fallback instead of 503 for predictions
    raw_data = result.data if result else []
    
    # Result could be an empty dict due to cache structure or None
    if isinstance(raw_data, dict) and "predictions" in raw_data:
        preds_list = raw_data.get("predictions", [])
    elif isinstance(raw_data, list):
        preds_list = raw_data
    else:
        preds_list = []

    mapped_preds = []
    for p in preds_list:
        mapped_preds.append(
            PredictionItem(
                event_name=p.get("event_name", ""),
                event_date=p.get("event_date", ""),
                prediction_1min=p.get("prediction_1min"),
                prediction_30min=p.get("prediction_30min"),
                prediction_1hr=p.get("prediction_1hr"),
                model_accuracy=p.get("model_accuracy"),
                is_experimental=p.get("is_experimental", True),
            )
        )

    response_data = PredictionsResponse(
        predictions=mapped_preds,
        prediction_count=len(mapped_preds)
    )

    if result:
        return CachedResult(
            data=response_data.model_dump(),
            data_type=result.data_type,
            cache_key=result.cache_key,
            source=result.source,
            is_cached=result.is_cached,
            is_stale=result.is_stale,
            fetched_at=result.fetched_at,
            cache_age_seconds=result.cache_age_seconds,
            cache_age_human=result.cache_age_human,
            ttl_seconds=result.ttl_seconds,
            expires_at=result.expires_at,
        )
    else:
        # Fallback empty envelope
        now = datetime.now(timezone.utc).isoformat()
        return CachedResult(
            data=response_data.model_dump(),
            data_type="economic_calendar",
            cache_key="economic_calendar:calendar:predictions",
            source="jblanked",
            is_cached=False,
            is_stale=False,
            fetched_at=now,
            cache_age_seconds=0,
            cache_age_human="just now",
            ttl_seconds=43200,
            expires_at=now,
        )
