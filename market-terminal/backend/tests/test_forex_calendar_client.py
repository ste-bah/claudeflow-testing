"""Tests for the ForexCalendarClient.

TASK-UPDATE-003
Verifies rate limiters, circuit breakers, JSON fetching, merge fallback,
JBlanked lazy loading, and data sanitization routines.
"""
import pytest
import time
import asyncio
import httpx
from httpx import Response
from app.data.forex_calendar_client import get_forex_calendar_client, CircuitBreakerState

@pytest.fixture(autouse=True)
def reset_client_singletons():
    # Make sure we start with a fresh client each test
    client = get_forex_calendar_client()
    client._ff_rate_limiter.clear()
    client._ff_cb_failures.clear()
    client._ff_cb_state = CircuitBreakerState.CLOSED
    client._jb_cb_failures.clear()
    client._jb_cb_state = CircuitBreakerState.CLOSED
    yield


@pytest.mark.asyncio
async def test_singleton_pattern():
    c1 = get_forex_calendar_client()
    c2 = get_forex_calendar_client()
    assert c1 is c2

@pytest.mark.asyncio
async def test_ff_rate_limiter():
    client = get_forex_calendar_client()
    
    # Can do 2 in rapid succession
    assert await client._check_ff_rate_limit() is True
    assert await client._check_ff_rate_limit() is True
    
    # Third fails
    assert await client._check_ff_rate_limit() is False
    
    # Fake time passing
    client._ff_rate_limiter[0] -= 400
    assert await client._check_ff_rate_limit() is True

@pytest.mark.asyncio
async def test_ff_circuit_breaker(monkeypatch):
    client = get_forex_calendar_client()
    assert await client._check_ff_cb() is True

    # Force 3 failures
    await client._ff_record_failure()
    await client._ff_record_failure()
    await client._ff_record_failure()

    assert client._ff_cb_state == CircuitBreakerState.OPEN
    assert await client._check_ff_cb() is False

    # Fake cooldown
    client._ff_cb_open_time -= 1000
    assert await client._check_ff_cb() is True
    assert client._ff_cb_state == CircuitBreakerState.HALF_OPEN


@pytest.mark.asyncio
async def test_ff_fetch_success(monkeypatch):
    client = get_forex_calendar_client()

    async def mock_get(url):
        return Response(200, json=[
            {
                "title": "Unemployment Rate",
                "country": "USD",
                "date": "2026-03-20T08:30:00-04:00",
                "impact": "High",
                "forecast": "3.8%",
                "previous": "3.9%"
            }
        ], request=httpx.Request("GET", url))

    class MockHttp:
        async def get(self, url): return await mock_get(url)

    client._http = MockHttp()
    res = await client._fetch_ff()
    assert type(res) is list
    assert res[0]["title"] == "Unemployment Rate"


@pytest.mark.asyncio
async def test_ff_fetch_429(monkeypatch):
    client = get_forex_calendar_client()

    async def mock_get(url):
        return Response(429, request=httpx.Request("GET", url))

    class MockHttp:
        async def get(self, url): return await mock_get(url)

    client._http = MockHttp()
    res = await client._fetch_ff()
    assert res is None
    assert len(client._ff_cb_failures) == 1


@pytest.mark.asyncio
async def test_ff_fetch_schema_invalid(monkeypatch):
    client = get_forex_calendar_client()

    async def mock_get(url):
        # Missing impact
        return Response(200, json=[{"title": "Fail", "date": "2026"}], request=httpx.Request("GET", url))

    class MockHttp:
        async def get(self, url): return await mock_get(url)

    client._http = MockHttp()
    res = await client._fetch_ff()
    assert res is None


@pytest.mark.asyncio
async def test_get_weekly_calendar_merge_success(monkeypatch):
    client = get_forex_calendar_client()
    
    # Mock FF
    async def mock_fetch_ff():
        return [
            {
                "title": "Non-Farm Employment Change",
                "country": "USD",
                "date": "2026-03-20T08:30:00-04:00",
                "impact": "High",
                "forecast": "200K",
                "previous": "190K",
                "currency": "USD"
            },
            {
                "title": "Fed Chair Powell Speaks",
                "country": "USD",
                "date": "2026-03-21T10:00:00-04:00",
                "impact": "High",
                "forecast": "",
                "previous": "",
                "currency": "USD"
            }
        ]
    client._fetch_ff = mock_fetch_ff
    
    # Mock Finnhub
    class MockFinnhub:
        async def get_economic_calendar(self):
            return {
                "economicCalendar": [
                    {
                        "event": "Non-Farm Employment Change",  # Fuzzy match check
                        "country": "US",
                        "time": "2026-03-20 08:30:00",
                        "estimate": 210,
                        "actual": 250,
                        "previous": 190,
                        "impact": "high"
                    }
                ]
            }
    
    import app.data.finnhub_client
    monkeypatch.setattr(app.data.finnhub_client, "get_finnhub_client", MockFinnhub)

    res = await client.get_weekly_calendar()
    assert res is not None
    assert res["_source"] == "forexfactory"
    assert res["event_count"] == 2
    
    ev_nfp = res["events"][0]
    ev_speech = res["events"][1]
    
    # Assert NFP
    assert ev_nfp["event_name"] == "Non-Farm Employment Change"
    assert ev_nfp["impact"] == "High"
    assert ev_nfp["actual"] == "250" # from finnhub
    assert ev_nfp["forecast"] == "200K" # from FF
    
    # Assert Speech
    assert ev_speech["event_name"] == "Fed Chair Powell Speaks"
    assert ev_speech["event_type"] == "speech"
    assert ev_speech["forecast"] == "N/A"
    assert ev_speech["actual"] == "N/A"

@pytest.mark.asyncio
async def test_get_weekly_calendar_ff_down_fallback(monkeypatch):
    client = get_forex_calendar_client()
    
    # Mock FF down
    async def mock_fetch_ff():
        return None
    client._fetch_ff = mock_fetch_ff
    
    # Mock Finnhub
    class MockFinnhub:
        async def get_economic_calendar(self):
            return {
                "economicCalendar": [
                    {
                        "event": "Retail Sales",
                        "country": "US",
                        "time": "2026-03-20 08:30:00",
                        "estimate": 0.5,
                        "actual": 0.6,
                        "previous": 0.4
                    }
                ]
            }
    
    import app.data.finnhub_client
    monkeypatch.setattr(app.data.finnhub_client, "get_finnhub_client", MockFinnhub)

    res = await client.get_weekly_calendar()
    assert res is not None
    assert res["_source"] == "finnhub"
    assert res["event_count"] == 1
    
    ev = res["events"][0]
    assert ev["event_name"] == "Retail Sales"
    assert ev["impact"] == "unknown" # Fallback impact
    assert ev["actual"] == "0.6"


@pytest.mark.asyncio
async def test_jblanked_integration():
    client = get_forex_calendar_client()
    
    class MockJBClient:
        def get_event_history(self, ev_id):
            if ev_id == "error":
                raise ValueError("Oops")
            return {"event_name": "Test", "releases": [{"actual": 1}]}
        def get_predictions(self):
            return [{"event_name": "Test", "prediction_1min": "up"}]

    client._jb_client = MockJBClient()
    
    # History
    hist = await client.get_event_history("NFP")
    assert hist is not None
    assert hist["event_name"] == "Test"
    assert hist["_source"] == "jblanked"
    
    # History CB trip
    await client.get_event_history("error")
    await client.get_event_history("error")
    await client.get_event_history("error")
    assert client._jb_cb_state == CircuitBreakerState.OPEN
    
    # Predictions
    preds = await client.get_predictions()
    assert preds == [] # Because CB is open
