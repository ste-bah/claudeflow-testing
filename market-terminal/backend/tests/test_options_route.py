from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.data.massive_client import get_massive_client
from app.data.cache import CacheManager

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_massive_client(monkeypatch):
    mock = get_massive_client()
    mock._enabled = True
    
    async def mock_fetch(url, params=None):
        if not mock._enabled:
            return None
        if "expirations" in url:
            return {"expirations": ["2026-03-20"]}
        if "O:AAPL" in url:
            if "INVALID" in url:
                return None
            return {
                "strike": 185.0,
                "expiration": "2026-03-20",
                "contract_type": "call",
                "option_ticker": url.split("/")[-1],
                "bid": 6.20,
                "ask": 6.35
            }
        return {
            "underlying_symbol": "AAPL",
            "underlying_price": 189.45,
            "chain": [{
                "strike": 185.0,
                "expiration": "2026-03-20",
                "contract_type": "call",
                "bid": 6.20,
                "ask": 6.35,
                "option_ticker": "O:AAPL260320C00185000",
                "implied_volatility": None
            }]
        }
    mock._fetch = mock_fetch
    return mock

@pytest.fixture(autouse=True)
def mock_cache(monkeypatch):
    """Instead of clearing a real DB, patch cache manager to always miss"""
    async def mock_read(*args, **kwargs):
        return None
    async def mock_write(*args, **kwargs):
        pass
    monkeypatch.setattr(CacheManager, "_read_cache", mock_read)
    monkeypatch.setattr(CacheManager, "_write_cache", mock_write)
    monkeypatch.setattr(CacheManager, "_schedule_bg_refresh", lambda *a, **kw: False)
    

def test_get_options_chain():
    resp = client.get("/api/options/chain/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "massive"
    assert data["data"]["underlying_symbol"] == "AAPL"
    assert len(data["data"]["chain"]) == 1

def test_get_options_chain_invalid_combo():
    resp = client.get("/api/options/chain/AAPL?strike_gte=200&strike_lte=100")
    assert resp.status_code == 422
    assert "strike_gte cannot be strictly greater" in resp.json()["error"]
    
def test_get_expirations():
    resp = client.get("/api/options/expirations/AAPL")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_expirations"] == 1
    assert data["expirations"][0]["expiration_date"] == "2026-03-20"

def test_get_greeks():
    resp = client.get("/api/options/greeks/AAPL")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "expirations" in data
    assert len(data["expirations"]) == 1

def test_get_single_contract():
    resp = client.get("/api/options/contract/AAPL/O:AAPL260320C00185000")
    if resp.status_code != 200:
        print(resp.json())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["contract"]["option_ticker"] == "O:AAPL260320C00185000"
    assert data["contract"]["fair_market_value"] == 6.275 # Mock avg of 6.20 and 6.35

def test_get_single_contract_invalid():
    resp = client.get("/api/options/contract/AAPL/INVALID")
    assert resp.status_code == 422

def test_disabled_client(monkeypatch):
    mock = get_massive_client()
    mock._enabled = False
    
    resp = client.get("/api/options/chain/AAPL")
    # Will hit a 503 instead of 404 because CacheManager returns None if custom fetch fails entirely or dispatch returns None securely.
    assert resp.status_code == 503
    assert "Options data source not configured" in resp.json()["error"]
