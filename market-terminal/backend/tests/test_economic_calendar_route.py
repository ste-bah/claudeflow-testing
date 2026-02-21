"""Tests for economic calendar REST endpoints.
TASK-UPDATE-004
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from app.data.cache_types import CachedResult

# Simple mock for cache envelope
def mock_get_or_fetch(data_type, symbol_or_domain, period, fetch_kwargs=None, source_override=None):
    if period == "weekly":
        return CachedResult(
            data={
                "events": [
                    {
                        "event_name": "Non-Farm Employment Change",
                        "country": "USD",
                        "event_date": "2026-03-20",
                        "event_time": "08:30:00-04:00",
                        "impact": "High",
                        "forecast": "200.0K",
                        "previous": "190.0K",
                        "actual": "250.0K",
                        "source": "forexfactory",
                        "event_type": "indicator"
                    },
                    {
                        "event_name": "Fed Chair Powell Speaks",
                        "country": "USD",
                        "event_date": "2026-03-21",
                        "event_time": "10:00:00-04:00",
                        "impact": "High",
                        "forecast": "N/A",
                        "previous": "N/A",
                        "actual": "N/A",
                        "source": "forexfactory",
                        "event_type": "speech"
                    },
                    {
                        "event_name": "Initial Jobless Claims",
                        "country": "USD",
                        "event_date": "2026-03-22",
                        "event_time": "08:30:00-04:00",
                        "impact": "Medium",
                        "forecast": "220K",
                        "previous": "210K",
                        "actual": "230K",
                        "source": "forexfactory",
                        "event_type": "indicator"
                    }
                ],
                "week_start": "2026-03-16",
                "week_end": "2026-03-22",
                "_source": "forexfactory"
            },
            data_type="economic_calendar",
            cache_key="economic_calendar:calendar:weekly",
            source="forexfactory",
            is_cached=False,
            is_stale=False,
            fetched_at="2026-03-19T00:00:00Z",
            cache_age_seconds=0,
            cache_age_human="just now",
            ttl_seconds=43200,
            expires_at="2026-03-19T12:00:00Z"
        )
    elif period == "today":
        return CachedResult(
            data={
                "events": [
                    {
                        "event_name": "CPI m/m",
                        "country": "USD",
                        "event_date": "2026-03-20",
                        "event_time": "08:30:00-04:00",
                        "impact": "High",
                        "forecast": "0.3%",
                        "previous": "0.4%",
                        "actual": "0.2%",
                        "source": "forexfactory"
                    }
                ],
                "date": "2026-03-20",
                "_source": "forexfactory"
            },
            data_type="economic_calendar",
            cache_key="economic_calendar:calendar:today",
            source="forexfactory",
            is_cached=False,
            is_stale=False,
            fetched_at="2026-03-20T00:00:00Z",
            cache_age_seconds=0,
            cache_age_human="just now",
            ttl_seconds=43200,
            expires_at="2026-03-20T12:00:00Z"
        )
    elif period == "history":
        return CachedResult(
            data={
                "event_id": fetch_kwargs["event_id"] if fetch_kwargs else "unknown",
                "event_name": "Test History",
                "releases": [
                    {
                        "date": "2026-02-01",
                        "actual": 1.1,
                        "forecast": 1.0,
                        "previous": 0.9,
                        "outcome": "better"
                    }
                ]
            },
            data_type="economic_calendar",
            cache_key="economic_calendar:calendar:history",
            source="jblanked",
            is_cached=False,
            is_stale=False,
            fetched_at="2026-03-19T00:00:00Z",
            cache_age_seconds=0,
            cache_age_human="just now",
            ttl_seconds=43200,
            expires_at="2026-03-19T12:00:00Z"
        )
    elif period == "predictions":
        return CachedResult(
            data={
                "predictions": [
                    {
                        "event_name": "NFP",
                        "event_date": "2026-03-20",
                        "prediction_1min": {"direction": "bullish", "confidence": 0.8},
                        "prediction_30min": {"direction": "bullish", "confidence": 0.7},
                        "prediction_1hr": {"direction": "neutral", "confidence": 0.5},
                        "model_accuracy": 0.75,
                        "is_experimental": True
                    }
                ]
            },
            data_type="economic_calendar",
            cache_key="economic_calendar:calendar:predictions",
            source="jblanked",
            is_cached=False,
            is_stale=False,
            fetched_at="2026-03-19T00:00:00Z",
            cache_age_seconds=0,
            cache_age_human="just now",
            ttl_seconds=43200,
            expires_at="2026-03-19T12:00:00Z"
        )
    return None


@pytest.fixture
def mock_cache_mgr():
    with patch("app.api.routes.economic_calendar._cache_mgr.get_or_fetch") as mock_fetch:
        mock_fetch.side_effect = mock_get_or_fetch
        yield mock_fetch


@pytest.mark.asyncio
async def test_get_weekly_calendar(mock_cache_mgr):
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/week")
        
    assert response.status_code == 200
    data = response.json()
    assert data["data_type"] == "economic_calendar"
    
    events = data["data"]["events"]
    assert len(events) == 3
    
    # Check impact color mapping
    nfp = events[0]
    assert nfp["impact_color"] == "red"
    assert nfp["comparison"] == "better"
    assert nfp["comparison_color"] == "green"
    
    # Check speech heuristic
    speech = events[1]
    assert speech["impact_color"] == "red"
    assert speech["forecast_display"] == "N/A"
    assert speech["comparison"] is None
    assert speech["comparison_color"] is None
    
    # Check inverted metric (Unemployment / Jobless Claims)
    # 230K actual > 220K forecast for jobless claims -> worse (lower is better)
    claims = events[2]
    assert claims["impact_color"] == "orange"
    assert claims["comparison"] == "worse"
    assert claims["comparison_color"] == "red"


@pytest.mark.asyncio
async def test_get_today_events(mock_cache_mgr):
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/today")
        
    assert response.status_code == 200
    data = response.json()
    
    events = data["data"]["events"]
    assert len(events) == 1
    
    cpi = events[0]
    # 0.2% actual < 0.3% forecast -> worse
    assert cpi["comparison"] == "worse"
    assert cpi["comparison_color"] == "red"


@pytest.mark.asyncio
async def test_get_event_history(mock_cache_mgr):
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/event/cpi/history")
        
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "jblanked"
    
    releases = data["data"]["releases"]
    assert len(releases) == 1
    assert releases[0]["actual"] == "1.1"


@pytest.mark.asyncio
async def test_get_event_history_empty(mock_cache_mgr):
    from app.main import app
    mock_cache_mgr.side_effect = lambda *a, **k: None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/event/cpi/history")
        
    assert response.status_code == 503
    assert "data source not available" in response.json()["error"]


@pytest.mark.asyncio
async def test_get_predictions(mock_cache_mgr):
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/predictions")
        
    assert response.status_code == 200
    data = response.json()
    
    preds = data["data"]["predictions"]
    assert len(preds) == 1
    assert preds[0]["event_name"] == "NFP"


@pytest.mark.asyncio
async def test_get_predictions_empty(mock_cache_mgr):
    from app.main import app
    mock_cache_mgr.side_effect = lambda *a, **k: None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/economic-calendar/predictions")
        
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["predictions"] == []
    assert data["data"]["prediction_count"] == 0
