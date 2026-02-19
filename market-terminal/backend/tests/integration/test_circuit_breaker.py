"""Integration tests for circuit breaker / graceful degradation (Flow 5).

Validates that the Market Terminal degrades gracefully when upstream data
sources fail: fallback chains, rate-limit handling, partial analysis
failures, and structured error responses.

Depends on conftest.py fixtures: client, _reset_singletons, and
factory functions make_analysis_mocks, make_signal, make_composite.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.exceptions import DataSourceError, RateLimitError

from .conftest import (
    METHODOLOGY_NAMES,
    SAMPLE_QUOTE,
    make_analysis_mocks,
    make_signal,
)


def _ticker_patches(mock_cm, mock_fh=None):
    """Return (patch_cm, patch_fh) context managers for the ticker route."""
    if mock_fh is None:
        mock_fh = MagicMock()
        mock_fh.is_enabled = False
    return (
        patch("app.api.routes.ticker.get_cache_manager", return_value=mock_cm),
        patch("app.api.routes.ticker.get_finnhub_client", return_value=mock_fh),
    )


def _make_price_result(*, source="yfinance", data=None, is_cached=False):
    """Build a MagicMock mimicking a CachedResult for price data."""
    return MagicMock(
        data=data or SAMPLE_QUOTE,
        source=source,
        fetched_at="2026-02-16T10:00:00Z",
        cache_age_seconds=5.0,
        is_cached=is_cached,
    )


def _analysis_patches(mock_cm, mock_agg, loader, mock_broadcast=None):
    """Return a tuple of patches for the analysis route."""
    if mock_broadcast is None:
        mock_broadcast = AsyncMock()
    return (
        patch("app.api.routes.analysis.get_cache_manager", return_value=mock_cm),
        patch("app.api.routes.analysis.CompositeAggregator", return_value=mock_agg),
        patch("app.api.routes.analysis._load_analyzer", side_effect=loader),
        patch("app.api.routes.analysis._broadcast_progress", mock_broadcast),
    )


def _make_analyzer_loader(succeed_names=None, fail_names=None):
    """Build a _load_analyzer side_effect function.

    Analyzers in *succeed_names* return a valid signal.
    Analyzers in *fail_names* raise RuntimeError on .analyze().
    """
    if succeed_names is None:
        succeed_names = set(METHODOLOGY_NAMES)
    if fail_names is None:
        fail_names = set()

    def loader(name):
        if name in fail_names:
            analyzer = MagicMock()
            analyzer.analyze = AsyncMock(side_effect=RuntimeError(f"{name} failed"))
            return analyzer
        if name in succeed_names:
            signal = MagicMock()
            signal.to_dict = lambda _n=name: make_signal(methodology=_n)
            analyzer = MagicMock()
            analyzer.analyze = AsyncMock(return_value=signal)
            return analyzer
        return None

    return loader


class TestCircuitBreaker:
    """Circuit breaker / graceful degradation behaviour."""

    def test_finnhub_failure_falls_back_to_yfinance(self, client):
        """When finnhub is unavailable, yfinance fallback provides price data.

        The cache layer walks the fallback chain (finnhub -> yfinance).
        Here we mock get_cache_manager().get_price to return a CachedResult
        whose source is "yfinance", simulating a successful fallback.
        """
        mock_cm = MagicMock()
        mock_cm.get_price = AsyncMock(
            return_value=_make_price_result(source="yfinance"),
        )

        p_cm, p_fh = _ticker_patches(mock_cm)
        with p_cm, p_fh:
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert data["data_source"] == "yfinance"
        assert data["price"]["current"] == SAMPLE_QUOTE["current_price"]

    def test_all_price_sources_fail_returns_error(self, client):
        """When get_price returns None, the ticker route returns a 404 error.

        The cache manager exhausts its fallback chain and returns None.
        The route interprets this as "no data" and raises HTTPException(404).
        """
        mock_cm = MagicMock()
        mock_cm.get_price = AsyncMock(return_value=None)

        p_cm, p_fh = _ticker_patches(mock_cm)
        with p_cm, p_fh:
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        # The HTTPException handler wraps the detail dict
        assert data["error"]["error"] == "No data available for symbol"
        assert data["error"]["symbol"] == "AAPL"

    def test_rate_limit_returns_429_with_retry_after(self, client):
        """RateLimitError propagating past route code produces 429 + Retry-After.

        When get_cache_manager() itself raises RateLimitError (e.g. during
        client initialisation), it bypasses the route's try/except and
        reaches the global exception handler which returns 429.
        """
        with patch(
            "app.api.routes.ticker.get_cache_manager",
            side_effect=RateLimitError("finnhub", retry_after=60),
        ):
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 429
        assert resp.headers["Retry-After"] == "60"
        data = resp.json()
        assert data["error"] == "Rate limited"
        assert data["source"] == "finnhub"
        assert data["retry_after"] == 60

    def test_sec_edgar_no_filings_returns_empty_not_crash(self, client):
        """When EDGAR returns no filings and Finnhub has no data, return 404.

        The fundamentals route catches all upstream exceptions and falls
        back gracefully.  If both EDGAR and Finnhub return nothing, the
        route returns a 404 with a structured error -- never a 500 crash.
        """
        mock_edgar = AsyncMock()
        mock_edgar.get_eps_history = AsyncMock(return_value=None)
        mock_edgar.get_balance_sheet = AsyncMock(return_value=None)
        mock_edgar.get_cash_flow = AsyncMock(return_value=None)
        mock_edgar.get_company = AsyncMock(return_value=None)

        mock_fh = AsyncMock()
        mock_fh.get_basic_financials = AsyncMock(return_value=None)
        mock_fh.get_company_profile = AsyncMock(return_value=None)

        with (
            patch("app.api.routes.fundamentals.get_edgar_client", return_value=mock_edgar),
            patch("app.api.routes.fundamentals.get_finnhub_client", return_value=mock_fh),
        ):
            resp = client.get("/api/fundamentals/AAPL")

        # Graceful degradation: 404 with structured body, NOT a 500 crash
        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data
        # The detail is a dict with "error" and "symbol"
        assert data["error"]["symbol"] == "AAPL"

    def test_partial_data_source_failure_still_succeeds(self, client):
        """When some methodology analyzers fail, analysis returns partial results.

        2 of 6 analyzers raise exceptions; the remaining 4 produce valid
        signals.  The response must include metadata showing both completed
        and failed counts.
        """
        mock_cm, mock_agg = make_analysis_mocks()
        mock_agg.get_cached_result = AsyncMock(return_value=None)

        succeed = set(METHODOLOGY_NAMES) - {"wyckoff", "sentiment"}
        fail = {"wyckoff", "sentiment"}
        loader = _make_analyzer_loader(succeed_names=succeed, fail_names=fail)

        p_cm, p_agg, p_load, p_bc = _analysis_patches(
            mock_cm, mock_agg, loader,
        )
        with p_cm, p_agg, p_load, p_bc:
            resp = client.post("/api/analyze/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        meta = data["metadata"]
        assert meta["methodologies_completed"] == 4
        assert meta["methodologies_failed"] == 2
        assert set(meta["failed_methodologies"]) == {"wyckoff", "sentiment"}
        # Partial results: signals list has 4 entries, not 6
        assert len(data["signals"]) == 4
        assert "composite" in data

    def test_data_source_error_includes_source_in_response(self, client):
        """DataSourceError carries the source name through to the 502 response.

        When get_cache_manager() raises DataSourceError (bypassing the
        route-level try/except), the global handler returns 502 with the
        source field so the frontend knows which provider failed.
        """
        with patch(
            "app.api.routes.ticker.get_cache_manager",
            side_effect=DataSourceError("finnhub", "Connection timeout"),
        ):
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 502
        data = resp.json()
        assert data["source"] == "finnhub"
        assert data["error"] == "Data source unavailable"
