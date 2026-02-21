from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

@pytest.fixture
def mock_settings():
    with patch("app.data.massive_client.get_settings") as mock:
        mock.return_value.massive_api_key = "test_key"
        mock.return_value.massive_options_tier = "advanced"
        yield mock

@pytest.mark.asyncio
async def test_get_short_interest_valid(mock_settings, monkeypatch):
    """Test 200 OK resolving valid metrics via short-interest map."""
    mock_payload = {
        "symbol": "AAPL",
        "shares_short": 50000000,
        "short_ratio": 2.5,
        "percent_of_float": 0.035,
        "settlement_date": "2024-02-15",
        "_fetched_at": "2026-02-20T12:00:00Z"
    }

    from app.data.massive_client import get_massive_client
    c = get_massive_client()
    monkeypatch.setattr(c, "get_short_interest", AsyncMock(return_value=mock_payload))

    response = client.get("/api/fundamentals/AAPL/short-interest")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["shares_short"] == 50000000
    assert data["fetched_at"] == "2026-02-20T12:00:00Z"

@pytest.mark.asyncio
async def test_get_short_interest_disabled(mock_settings, monkeypatch):
    """Test 503 Service Unavailable when _enabled falls back to False."""
    from app.data.massive_client import get_massive_client
    c = get_massive_client()
    monkeypatch.setattr(c, "_enabled", False)

    response = client.get("/api/fundamentals/AAPL/short-interest")
    assert response.status_code == 503
    data = response.json()
    assert "not configured" in data.get("error", "")

@pytest.mark.asyncio
async def test_get_analyst_ratings_valid(mock_settings, monkeypatch):
    """Test 200 OK mapping Analyst Ratings via consensus structure."""
    mock_payload = {
        "symbol": "AAPL",
        "buy": 20,
        "hold": 5,
        "sell": 0,
        "consensus": "strong_buy",
        "total_analysts": 25,
        "price_target_mean": 185.0,
        "price_target_high": 210.0,
        "price_target_low": 150.0,
        "_fetched_at": "2026-02-20T12:00:00Z"
    }

    from app.data.massive_client import get_massive_client
    c = get_massive_client()
    monkeypatch.setattr(c, "get_analyst_ratings", AsyncMock(return_value=mock_payload))

    response = client.get("/api/fundamentals/AAPL/analyst-ratings")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["consensus"] == "strong_buy"
    assert data["data"]["price_target_mean"] == 185.0

@pytest.mark.asyncio
async def test_get_analyst_ratings_tier_guard(mock_settings, monkeypatch):
    """Test Null Object returning on Tier downgrade bounds."""
    from app.data.massive_client import get_massive_client
    c = get_massive_client()
    
    # Internal MassiveClient will trip none-fallback natively on Starter ties
    monkeypatch.setattr(c, "get_analyst_ratings", AsyncMock(return_value=None))

    response = client.get("/api/fundamentals/AAPL/analyst-ratings")
    assert response.status_code == 200
    data = response.json()
    # Mapped graceful degrade per NFR standards
    assert data["data"] is None
