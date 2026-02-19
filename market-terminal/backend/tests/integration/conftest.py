"""Shared fixtures for Market Terminal integration tests.

Provides MockDatabase, singleton cleanup, test data constants,
and factory functions for all backend integration test files.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Test Data Constants
# ---------------------------------------------------------------------------

SAMPLE_OHLCV = [
    {"date": "2026-02-10", "open": 182.00, "high": 185.50, "low": 181.00, "close": 184.25, "volume": 5_200_000},
    {"date": "2026-02-11", "open": 184.25, "high": 186.00, "low": 183.50, "close": 185.75, "volume": 4_800_000},
    {"date": "2026-02-12", "open": 185.75, "high": 188.00, "low": 185.00, "close": 187.50, "volume": 6_100_000},
    {"date": "2026-02-13", "open": 187.50, "high": 189.25, "low": 186.50, "close": 188.00, "volume": 5_500_000},
    {"date": "2026-02-14", "open": 188.00, "high": 190.00, "low": 187.00, "close": 189.50, "volume": 5_900_000},
]

SAMPLE_QUOTE = {
    "current_price": 189.50, "open": 188.00, "high": 190.00, "low": 187.00,
    "previous_close": 188.00, "change": 1.50, "percent_change": 0.798,
    "volume": 5_900_000, "market_cap": 2_950_000_000_000,
}

SAMPLE_NEWS = [
    {
        "headline": "Apple Reports Record Q1 Revenue",
        "summary": "Apple Inc. reported record quarterly revenue of $120B.",
        "source": "Reuters",
        "url": "https://example.com/article1",
        "image": "https://example.com/img1.jpg",
        "published_at": "2026-02-16T09:30:00Z",
        "category": "company",
        "related": "AAPL,MSFT",
    },
    {
        "headline": "Tech Sector Leads Market Rally",
        "summary": "Major tech stocks rose 2% on strong earnings outlook.",
        "source": "Bloomberg",
        "url": "https://example.com/article2",
        "image": None,
        "published_at": "2026-02-15T14:00:00Z",
        "category": "market",
        "related": "AAPL",
    },
]

SAMPLE_FUNDAMENTALS = {
    "eps": 6.42, "pe_ratio": 29.5, "revenue": 120_000_000_000,
    "net_income": 30_000_000_000, "market_cap": 2950,
    "dividend_yield": 0.55, "debt_to_equity": 1.87,
}

SAMPLE_WATCHLIST_ENTRY = {
    "id": 1, "symbol": "AAPL", "name": "Apple Inc.", "asset_type": "stock",
    "group_name": "default", "sort_order": 0,
    "added_at": "2026-02-01T10:00:00", "updated_at": "2026-02-16T08:00:00",
}

METHODOLOGY_NAMES = [
    "wyckoff", "elliott_wave", "ict_smart_money",
    "canslim", "larry_williams", "sentiment",
]

DEFAULT_WEIGHTS = {
    "wyckoff": 0.20, "elliott_wave": 0.15, "ict_smart_money": 0.20,
    "canslim": 0.20, "larry_williams": 0.10, "sentiment": 0.15,
}


# ---------------------------------------------------------------------------
# MockDatabase
# ---------------------------------------------------------------------------

class MockDatabase:
    """Queue-based mock replacing DatabaseManager.

    Pre-load _fetch_one_results and _fetch_all_results before calling
    the route. Results are consumed sequentially via pop(0), matching
    the exact SQL call order in production code.
    """

    def __init__(self) -> None:
        self._fetch_one_results: list[dict[str, Any] | None] = []
        self._fetch_all_results: list[list[dict[str, Any]]] = []
        self.executed: list[tuple[str, tuple]] = []

    async def fetch_one(self, sql: str, params: tuple = ()) -> dict[str, Any] | None:
        if self._fetch_one_results:
            return self._fetch_one_results.pop(0)
        return None

    async def fetch_all(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        if self._fetch_all_results:
            return self._fetch_all_results.pop(0)
        return []

    async def execute(self, sql: str, params: tuple = ()) -> MagicMock:
        self.executed.append((sql, params))
        return MagicMock(rowcount=1)

    async def executemany(self, sql: str, params_seq: Any = ()) -> None:
        pass


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_singletons():
    """Reset all 7 module-level singletons after each test."""
    yield
    import app.api.routes.analysis as analysis_mod
    analysis_mod._analysis_locks.clear()

    from app.api.routes.websocket import ws_manager
    ws_manager._connections.clear()

    import app.data.database as db_mod
    db_mod._manager = None

    import app.data.cache as cache_mod
    cache_mod._manager = None
    cache_mod._ttl_map = None

    from app.config import get_settings
    get_settings.cache_clear()

    import app.data.finnhub_client as fh_mod
    fh_mod._client = None


@pytest.fixture()
def client() -> TestClient:
    """Synchronous FastAPI TestClient (ADR-003)."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def mock_db() -> MockDatabase:
    """Fresh MockDatabase instance per test."""
    return MockDatabase()


# ---------------------------------------------------------------------------
# Factory Functions
# ---------------------------------------------------------------------------

def make_signal(
    *,
    ticker: str = "AAPL",
    methodology: str = "wyckoff",
    direction: str = "bullish",
    confidence: float = 0.75,
    timeframe: str = "medium",
    reasoning: str = "Test signal",
    key_levels: dict | None = None,
) -> dict[str, Any]:
    """Build a MethodologySignal.to_dict() compatible dict."""
    return {
        "ticker": ticker,
        "methodology": methodology,
        "direction": direction,
        "confidence": confidence,
        "timeframe": timeframe,
        "reasoning": reasoning,
        "key_levels": key_levels or {},
        "timestamp": "2026-02-16T10:00:00Z",
    }


def make_composite(
    *,
    direction: str = "bullish",
    confidence: float = 0.75,
    confluence_count: int = 4,
    timeframe_breakdown: dict | None = None,
    trade_thesis: str = "Test thesis",
    weights_used: dict | None = None,
) -> dict[str, Any]:
    """Build the 'composite' sub-object of the analysis API response."""
    return {
        "overall_direction": direction,
        "overall_confidence": confidence,
        "confluence_count": confluence_count,
        "timeframe_breakdown": timeframe_breakdown or {
            "short": {"direction": "bullish", "confidence": 0.7, "methodologies": ["ict_smart_money"]},
            "medium": {"direction": "bullish", "confidence": 0.8, "methodologies": ["wyckoff", "canslim"]},
            "long": {"direction": "neutral", "confidence": 0.5, "methodologies": ["elliott_wave"]},
        },
        "trade_thesis": trade_thesis,
        "weights_used": weights_used or DEFAULT_WEIGHTS,
        "timestamp": "2026-02-16T10:00:00Z",
    }


def make_cached_result(
    *,
    symbol: str = "AAPL",
    direction: str = "bullish",
    confidence: float = 0.75,
    confluence: int = 4,
    cached: bool = False,
    duration_ms: int = 1234,
    methodologies_completed: int = 6,
    methodologies_failed: int = 0,
    failed_methodologies: list[str] | None = None,
    data_sources_used: list[str] | None = None,
) -> dict[str, Any]:
    """Build a complete POST /api/analyze/{symbol} response dict."""
    signals = [
        make_signal(ticker=symbol, methodology=m, direction=direction, confidence=confidence)
        for m in METHODOLOGY_NAMES[:methodologies_completed]
    ]
    return {
        "symbol": symbol,
        "composite": make_composite(
            direction=direction, confidence=confidence, confluence_count=confluence,
        ),
        "signals": signals,
        "metadata": {
            "analysis_duration_ms": duration_ms,
            "methodologies_requested": 6,
            "methodologies_completed": methodologies_completed,
            "methodologies_failed": methodologies_failed,
            "failed_methodologies": failed_methodologies or [],
            "cached": cached,
            "data_sources_used": data_sources_used or ["ohlcv:yfinance"],
        },
    }


def make_analysis_mocks(
    *,
    symbol: str = "AAPL",
    direction: str = "bullish",
    confidence: float = 0.75,
) -> tuple[AsyncMock, AsyncMock, MagicMock]:
    """Build paired CacheManager and CompositeAggregator mocks.

    Returns (mock_cache_manager, mock_aggregator, mock_loader).
    """
    mock_cm = AsyncMock()
    mock_cm.get_price = AsyncMock(return_value=MagicMock(data=SAMPLE_QUOTE))
    mock_cm.get_historical_prices = AsyncMock(return_value=MagicMock(data=SAMPLE_OHLCV))
    mock_cm.get_fundamentals = AsyncMock(return_value=MagicMock(data=SAMPLE_FUNDAMENTALS))
    mock_cm.get_news = AsyncMock(return_value=MagicMock(data=SAMPLE_NEWS))

    mock_agg = AsyncMock()
    mock_agg.get_cached_result = AsyncMock(return_value=None)
    mock_agg.aggregate = AsyncMock(return_value=MagicMock(
        to_dict=lambda: make_composite(direction=direction, confidence=confidence),
    ))
    mock_agg.cache_result = AsyncMock()

    # Mock loader function that returns analyzers with async analyze method
    # Use side_effect to return different analyzers for different methodology calls
    def make_analyzer(methodology: str):
        """Factory function to create analyzer mocks for different methodologies."""
        mock = MagicMock()
        mock_signal = {
            "ticker": symbol,
            "methodology": methodology,
            "direction": direction,
            "confidence": confidence,
            "timeframe": "medium",
            "reasoning": f"Test signal for {methodology}",
            "key_levels": {},
        }
        mock.analyze = AsyncMock(return_value=mock_signal)
        return mock

    mock_loader = MagicMock(side_effect=make_analyzer)

    return mock_cm, mock_agg, mock_loader


def make_watchlist_row(
    *,
    symbol: str = "AAPL",
    name: str = "Apple Inc.",
    group_name: str = "default",
    sort_order: int = 0,
) -> dict[str, Any]:
    """Build watchlist DB row with exact column names from SELECT queries."""
    return {
        "id": 1,
        "symbol": symbol,
        "name": name,
        "asset_type": "stock",
        "group_name": group_name,
        "sort_order": sort_order,
        "added_at": "2026-02-01T10:00:00",
        "updated_at": "2026-02-16T08:00:00",
    }
