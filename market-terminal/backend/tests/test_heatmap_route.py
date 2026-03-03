"""Tests for the heatmap endpoint at GET /api/heatmap.

Validates parameter validation, response structure, filtering, security
(no user input reflected in errors), and service error handling.

Run with: ``pytest tests/test_heatmap_route.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# ---------------------------------------------------------------------------
# Shared sample data
# ---------------------------------------------------------------------------

_SAMPLE_STOCKS = [
    {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "sector": "Technology",
        "indices": ["sp500", "nasdaq100"],
        "change_pct": 1.23,
        "market_cap": 3_100_000_000_000,
        "price": 195.40,
    },
    {
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "sector": "Technology",
        "indices": ["sp500", "nasdaq100"],
        "change_pct": -0.45,
        "market_cap": 2_900_000_000_000,
        "price": 415.20,
    },
    {
        "symbol": "JPM",
        "name": "JPMorgan Chase & Co.",
        "sector": "Financials",
        "indices": ["sp500"],
        "change_pct": 0.80,
        "market_cap": 580_000_000_000,
        "price": 195.10,
    },
    {
        "symbol": "AMZN",
        "name": "Amazon.com Inc.",
        "sector": "Consumer Discretionary",
        "indices": ["nasdaq100"],
        "change_pct": 2.10,
        "market_cap": 1_900_000_000_000,
        "price": 188.50,
    },
]

_SAMPLE_RESPONSE = {
    "stocks": _SAMPLE_STOCKS,
    "refreshed_at": "2026-03-02T14:30:00Z",
    "next_refresh_in": 58,
    "total_count": 523,
    "filtered_count": 4,
}


# ---------------------------------------------------------------------------
# Patch helper
# ---------------------------------------------------------------------------

def _patch_service(return_value=None, raises=False):
    """Context manager that patches get_heatmap_data at route module level."""
    mock = AsyncMock()
    if raises:
        mock.side_effect = Exception("service failure")
    else:
        mock.return_value = return_value if return_value is not None else _SAMPLE_RESPONSE
    return patch("app.api.routes.heatmap.get_heatmap_data", mock)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_heatmap_returns_200_with_stocks():
    """GET /api/heatmap with no filters returns 200 and a stocks list."""
    with _patch_service():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap")

    assert response.status_code == 200
    data = response.json()
    assert "stocks" in data
    assert isinstance(data["stocks"], list)
    assert len(data["stocks"]) == 4
    assert "refreshed_at" in data
    assert "next_refresh_in" in data
    assert "total_count" in data
    assert "filtered_count" in data


@pytest.mark.asyncio
async def test_get_heatmap_stock_fields():
    """Each stock in the response has the expected fields."""
    with _patch_service():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap")

    assert response.status_code == 200
    stock = response.json()["stocks"][0]
    assert "symbol" in stock
    assert "name" in stock
    assert "sector" in stock
    assert "indices" in stock
    assert "change_pct" in stock
    assert "market_cap" in stock
    assert "price" in stock


@pytest.mark.asyncio
async def test_get_heatmap_filter_sp500():
    """GET /api/heatmap?index=sp500 passes sp500 filter to service."""
    sp500_stocks = [s for s in _SAMPLE_STOCKS if "sp500" in s["indices"]]
    sp500_response = {**_SAMPLE_RESPONSE, "stocks": sp500_stocks, "filtered_count": len(sp500_stocks)}

    mock = AsyncMock(return_value=sp500_response)
    with patch("app.api.routes.heatmap.get_heatmap_data", mock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?index=sp500")

    assert response.status_code == 200
    mock.assert_awaited_once_with(index_filter="sp500", sector_filter="all")
    data = response.json()
    assert data["filtered_count"] == len(sp500_stocks)


@pytest.mark.asyncio
async def test_get_heatmap_filter_nasdaq100():
    """GET /api/heatmap?index=nasdaq100 passes nasdaq100 filter to service."""
    nasdaq_stocks = [s for s in _SAMPLE_STOCKS if "nasdaq100" in s["indices"]]
    nasdaq_response = {**_SAMPLE_RESPONSE, "stocks": nasdaq_stocks, "filtered_count": len(nasdaq_stocks)}

    mock = AsyncMock(return_value=nasdaq_response)
    with patch("app.api.routes.heatmap.get_heatmap_data", mock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?index=nasdaq100")

    assert response.status_code == 200
    mock.assert_awaited_once_with(index_filter="nasdaq100", sector_filter="all")


@pytest.mark.asyncio
async def test_get_heatmap_filter_sector():
    """GET /api/heatmap?sector=Technology passes sector filter to service."""
    tech_stocks = [s for s in _SAMPLE_STOCKS if s["sector"] == "Technology"]
    tech_response = {**_SAMPLE_RESPONSE, "stocks": tech_stocks, "filtered_count": len(tech_stocks)}

    mock = AsyncMock(return_value=tech_response)
    with patch("app.api.routes.heatmap.get_heatmap_data", mock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?sector=Technology")

    assert response.status_code == 200
    mock.assert_awaited_once_with(index_filter="all", sector_filter="Technology")
    assert response.json()["filtered_count"] == len(tech_stocks)


@pytest.mark.asyncio
async def test_get_heatmap_invalid_index_returns_400():
    """GET /api/heatmap?index=<invalid> returns 400 and does NOT echo user input."""
    with _patch_service():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?index=invalid_xss_value")

    assert response.status_code == 400
    body = response.text
    # Security: user-supplied value must NOT appear in the response
    assert "invalid_xss_value" not in body


@pytest.mark.asyncio
async def test_get_heatmap_invalid_sector_returns_400():
    """GET /api/heatmap?sector=<invalid> returns 400 and does NOT echo user input."""
    with _patch_service():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?sector=XSS<script>alert(1)</script>")

    assert response.status_code == 400
    body = response.text
    # Security: user-supplied value must NOT appear in the response
    assert "<script>" not in body
    assert "XSS" not in body


@pytest.mark.asyncio
async def test_get_heatmap_service_error_returns_503():
    """Service exceptions result in a 503 response."""
    with _patch_service(raises=True):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap")

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_get_heatmap_empty_universe():
    """When the service returns an empty stocks list, response is still valid."""
    empty_response = {
        "stocks": [],
        "refreshed_at": "2026-03-02T14:30:00Z",
        "next_refresh_in": 58,
        "total_count": 0,
        "filtered_count": 0,
    }
    with _patch_service(return_value=empty_response):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap")

    assert response.status_code == 200
    data = response.json()
    assert data["stocks"] == []
    assert data["total_count"] == 0
    assert data["filtered_count"] == 0


@pytest.mark.asyncio
async def test_get_heatmap_combined_filters():
    """GET /api/heatmap?index=sp500&sector=Technology passes both filters."""
    mock = AsyncMock(return_value={**_SAMPLE_RESPONSE, "stocks": [], "filtered_count": 0})
    with patch("app.api.routes.heatmap.get_heatmap_data", mock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?index=sp500&sector=Technology")

    assert response.status_code == 200
    mock.assert_awaited_once_with(index_filter="sp500", sector_filter="Technology")


@pytest.mark.asyncio
async def test_get_heatmap_valid_index_all():
    """GET /api/heatmap?index=all is valid and passes through correctly."""
    mock = AsyncMock(return_value=_SAMPLE_RESPONSE)
    with patch("app.api.routes.heatmap.get_heatmap_data", mock):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/heatmap?index=all")

    assert response.status_code == 200
    mock.assert_awaited_once_with(index_filter="all", sector_filter="all")
