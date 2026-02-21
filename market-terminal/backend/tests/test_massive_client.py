import asyncio
import math
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import Response

from app.data.massive_client import (
    CircuitBreakerState,
    MassiveClient,
    get_massive_client,
    _sanitize_float,
    _sanitize_dict,
    _to_snake_case
)


@pytest.fixture
def mock_settings():
    with patch("app.data.massive_client.get_settings") as mock:
        mock.return_value.massive_api_key = "test_key"
        mock.return_value.massive_options_tier = "free"
        yield mock


@pytest.mark.asyncio
async def test_massive_client_singleton(mock_settings):
    c1 = get_massive_client()
    c2 = get_massive_client()
    assert c1 is c2
    assert c1._api_key == "test_key"
    assert c1._tier == "free"
    assert c1._rate_limit == 5


@pytest.mark.asyncio
async def test_sanitize_float():
    assert _sanitize_float(1) == 1.0
    assert _sanitize_float(1.0) == 1.0
    assert _sanitize_float(None) is None
    assert _sanitize_float(math.nan) is None
    assert _sanitize_float(math.inf) is None
    assert _sanitize_float("1.23") == 1.23
    assert _sanitize_float("bad") is None
    assert _sanitize_float(False) is None
    assert _sanitize_float(True) is None


@pytest.mark.asyncio
async def test_to_snake_case():
    data = {"CamelCase": 1, "nestedData": {"InnerVal": "ok"}, "arrayData": [{"itemOne": 1}]}
    res = _to_snake_case(data)
    assert res == {"camel_case": 1, "nested_data": {"inner_val": "ok"}, "array_data": [{"item_one": 1}]}


@pytest.mark.asyncio
async def test_get_options_chain_pagination(mock_settings):
    client = MassiveClient()
    mock_http = AsyncMock()
    
    # Page 1
    mock_http.get.side_effect = [
        Response(200, json={
            "underlyingPrice": 150.0,
            "chain": [{
                "strike": 150, "expiration": "2024-01-01", "contractType": "call",
                "optionTicker": "O:AAPL240101C00150000"
            }],
            "nextUrl": "/v3/snapshot/options/AAPL?page=2"
        }, request=httpx.Request("GET", "https://api.massive.com")),
        Response(200, json={
            "underlyingPrice": 150.0,
            "chain": [{
                "strike": 155, "expiration": "2024-01-01", "contractType": "call",
                "optionTicker": "O:AAPL240101C00155000"
            }]
        }, request=httpx.Request("GET", "https://api.massive.com")),
    ]
    client._http = mock_http

    res = await client.get_options_chain("AAPL")
    assert res is not None
    assert res["underlying_symbol"] == "AAPL"
    assert len(res["chain"]) == 2
    assert res["chain"][0]["strike"] == 150.0
    assert res["chain"][1]["strike"] == 155.0


@pytest.mark.asyncio
async def test_get_options_chain_invalid_symbol(mock_settings):
    client = MassiveClient()
    mock_http = AsyncMock()
    mock_http.get.return_value = Response(200, json={
        "underlyingPrice": 150.0,
        "chain": [{
            "strike": 150, "expiration": "2024-01-01", "contractType": "call",
            "optionTicker": "O:AAPL240101C00150000"
        }]
    }, request=httpx.Request("GET", "https://api.massive.com"))
    client._http = mock_http
    
    # > 10 chars should be rejected by validation
    res = await client.get_options_chain("WAYTOOLONGSYMBOL")
    assert res is None


@pytest.mark.asyncio
async def test_circuit_breaker(mock_settings):
    client = MassiveClient()
    mock_http = AsyncMock()
    mock_http.get.return_value = Response(500, request=httpx.Request("GET", "https://api.massive.com"))
    client._http = mock_http
    
    # 5 failures should open it
    for _ in range(5):
        await client._fetch("/v3/snapshot/options/AAPL")
        
    assert client._cb_state == CircuitBreakerState.OPEN
    
    # Subsequent calls should return None immediately
    res = await client._fetch("/v3/snapshot/options/AAPL")
    assert res is None


@pytest.mark.asyncio
async def test_rate_limiter(mock_settings):
    client = MassiveClient()
    mock_http = AsyncMock()
    mock_http.get.return_value = Response(200, json={}, request=httpx.Request("GET", "https://api.massive.com"))
    client._http = mock_http
    
    # limit is 5. Calling 5 times works.
    for _ in range(5):
        await client._fetch("/dummy")
    
    assert client.calls_remaining == 0
    # 6th call should be blocked and log a warning
    res = await client._fetch("/dummy")
    assert res is None
    
@pytest.mark.asyncio
async def test_get_single_contract(mock_settings):
    client = MassiveClient()
    mock_http = AsyncMock()
    mock_http.get.return_value = Response(200, content=b'{"strike": 150, "expiration": "2024-01-01", "contractType": "call", "optionTicker": "O:AAPL240101C00150000", "impliedVolatility": NaN}', request=httpx.Request("GET", "https://api.massive.com"))
    client._http = mock_http
    
    res = await client.get_single_contract("AAPL", "O:AAPL240101C00150000")
    assert res is not None
    assert res["implied_volatility"] is None # NaN sanitized
    assert res["_source"] == "massive"
    
    # Bad request ticker
    res2 = await client.get_single_contract("AAPL", "INVALID")
    assert res2 is None


@pytest.mark.asyncio
async def test_get_short_interest_valid(mock_settings):
    """Test get_short_interest returns sanitized output."""
    client = get_massive_client()

    # Mock fetch response
    mock_response = {
        "results": {
            "symbol": "AAPL",
            "shares_short": 50000000,
            "short_ratio": "2.5",
            "percent_of_float": 0.035,
            "settlement_date": "2024-02-15"
        }
    }
    mock_fetch = AsyncMock(return_value=mock_response)
    client._fetch = mock_fetch

    res = await client.get_short_interest("AAPL")
    assert res is not None
    assert res["symbol"] == "AAPL"
    assert res["shares_short"] == 50000000
    assert res["short_ratio"] == 2.5
    assert res["percent_of_float"] == 0.035
    assert res["settlement_date"] == "2024-02-15"
    assert res["_source"] == "massive"


@pytest.mark.asyncio
async def test_get_short_interest_disabled(monkeypatch):
    """Test get_short_interest returns None if client is disabled."""
    client = get_massive_client()
    monkeypatch.setattr(client, "_enabled", False)
    
    assert await client.get_short_interest("AAPL") is None


@pytest.mark.asyncio
async def test_get_analyst_ratings_tier_check(monkeypatch):
    """Test get_analyst_ratings enforces Advanced tier logic."""
    client = get_massive_client()
    monkeypatch.setattr(client, "_tier", "starter")
    
    # Needs to silently return None
    assert await client.get_analyst_ratings("AAPL") is None


@pytest.mark.asyncio
async def test_get_analyst_ratings_consensus(monkeypatch):
    """Test get_analyst_ratings calculates consensus math."""
    client = get_massive_client()
    monkeypatch.setattr(client, "_tier", "advanced")

    # Mock payload for strong_buy (>66% buy, >10 analysts)
    mock_response = {
        "results": {
            "symbol": "AAPL",
            "buy": 20,
            "hold": 4,
            "sell": 1,
            "price_target_mean": 185.0,
            "price_target_high": 210.0,
            "price_target_low": 150.0
        }
    }
    mock_fetch = AsyncMock(return_value=mock_response)
    client._fetch = mock_fetch

    res = await client.get_analyst_ratings("AAPL")
    assert res is not None
    assert res["consensus"] == "strong_buy"
    assert res["total_analysts"] == 25
    assert res["price_target_mean"] == 185.0

