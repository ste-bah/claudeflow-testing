"""Integration tests for ticker / data endpoints.

Tests the full request cycle through FastAPI routing, validation, and
error handling while mocking only at the data-layer boundary
(get_cache_manager, get_finnhub_client, get_edgar_client,
get_ownership_client, get_fred_client).

Depends on conftest.py fixtures: client, _reset_singletons, and
test data constants.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.exceptions import DataSourceError

from .conftest import (
    SAMPLE_FUNDAMENTALS,
    SAMPLE_NEWS,
    SAMPLE_OHLCV,
    SAMPLE_QUOTE,
)


class TestTickerFlow:
    """GET /api/ticker/{symbol} -- price quote and OHLCV history."""

    def test_quote_happy_path_returns_price_data(self, client):
        """Successful quote returns 200 with price block and metadata."""
        mock_cm = MagicMock()
        price_result = MagicMock(
            data=SAMPLE_QUOTE,
            source="yfinance",
            fetched_at="2026-02-16T10:00:00Z",
            cache_age_seconds=5.0,
            is_cached=False,
        )
        mock_cm.get_price = AsyncMock(return_value=price_result)

        mock_fh = MagicMock()
        mock_fh.is_enabled = False

        with (
            patch("app.api.routes.ticker.get_cache_manager", return_value=mock_cm),
            patch("app.api.routes.ticker.get_finnhub_client", return_value=mock_fh),
        ):
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert "price" in data
        assert data["price"]["current"] == SAMPLE_QUOTE["current_price"]
        assert data["price"]["change"] == SAMPLE_QUOTE["change"]
        assert data["price"]["change_percent"] == SAMPLE_QUOTE["percent_change"]
        assert data["data_source"] == "yfinance"
        assert data["cache_hit"] is False
        assert "data_timestamp" in data
        assert "data_age_seconds" in data
        assert "is_market_open" in data

    def test_history_returns_ohlcv_array(self, client):
        """include_history=true returns OHLCV bars alongside the quote."""
        mock_cm = MagicMock()
        price_result = MagicMock(
            data=SAMPLE_QUOTE,
            source="yfinance",
            fetched_at="2026-02-16T10:00:00Z",
            cache_age_seconds=3.0,
            is_cached=True,
        )
        hist_result = MagicMock(
            data=SAMPLE_OHLCV,
            source="yfinance",
        )
        mock_cm.get_price = AsyncMock(return_value=price_result)
        mock_cm.get_historical_prices = AsyncMock(return_value=hist_result)

        mock_fh = MagicMock()
        mock_fh.is_enabled = False

        with (
            patch("app.api.routes.ticker.get_cache_manager", return_value=mock_cm),
            patch("app.api.routes.ticker.get_finnhub_client", return_value=mock_fh),
        ):
            resp = client.get("/api/ticker/AAPL?include_history=true&period=1m")

        assert resp.status_code == 200
        data = resp.json()
        assert "ohlcv" in data
        assert len(data["ohlcv"]) == len(SAMPLE_OHLCV)
        first_bar = data["ohlcv"][0]
        assert set(first_bar.keys()) == {"date", "open", "high", "low", "close", "volume"}

    def test_ticker_all_sources_fail_returns_error(self, client):
        """When get_cache_manager raises DataSourceError, global handler returns 502."""
        with patch(
            "app.api.routes.ticker.get_cache_manager",
            side_effect=DataSourceError("cache", "all sources exhausted"),
        ):
            resp = client.get("/api/ticker/AAPL")

        assert resp.status_code == 502
        data = resp.json()
        assert "error" in data


class TestNewsFlow:
    """GET /api/news/{symbol} -- aggregated news articles."""

    def test_news_returns_articles(self, client):
        """Successful news fetch returns paginated article list."""
        mock_cm = MagicMock()
        news_result = MagicMock(
            data=SAMPLE_NEWS,
            source="finnhub",
            fetched_at="2026-02-16T09:00:00Z",
        )
        mock_cm.get_news = AsyncMock(return_value=news_result)

        with patch("app.api.routes.news.get_cache_manager", return_value=mock_cm):
            resp = client.get("/api/news/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert "articles" in data
        assert len(data["articles"]) == len(SAMPLE_NEWS)
        assert data["total_count"] == len(SAMPLE_NEWS)
        assert data["data_source"] == "finnhub"
        # Verify normalized article shape
        article = data["articles"][0]
        assert "id" in article
        assert "headline" in article
        assert "summary" in article
        assert "source" in article
        assert "url" in article
        assert "published_at" in article


class TestFundamentalsFlow:
    """GET /api/fundamentals/{symbol} -- financial data."""

    def test_fundamentals_returns_financial_data(self, client):
        """Successful fundamentals fetch returns TTM and quarterly data."""
        mock_edgar = AsyncMock()
        mock_edgar.get_eps_history = AsyncMock(return_value=[
            {
                "period": "2025-Q4", "revenue": 120_000_000_000,
                "net_income": 30_000_000_000, "eps_diluted": 1.60,
                "gross_margin": 0.46, "operating_margin": 0.33,
                "net_margin": 0.25, "revenue_growth_yoy": 0.08,
                "eps_growth_yoy": 0.10,
            },
        ])
        mock_edgar.get_balance_sheet = AsyncMock(return_value=[
            {"debt_to_equity": 1.87, "total_equity": 70_000_000_000},
        ])
        mock_edgar.get_cash_flow = AsyncMock(return_value=[
            {"free_cash_flow": 25_000_000_000},
        ])
        mock_edgar.get_company = AsyncMock(return_value={
            "name": "Apple Inc.", "cik": "0000320193",
        })

        mock_fh = AsyncMock()
        mock_fh.get_basic_financials = AsyncMock(return_value={
            "pe_ratio": 29.5, "market_cap": 2950,
            "dividend_yield": 0.55,
        })
        mock_fh.get_company_profile = AsyncMock(return_value={
            "name": "Apple Inc.", "shareOutstanding": 15400,
        })

        with (
            patch("app.api.routes.fundamentals.get_edgar_client", return_value=mock_edgar),
            patch("app.api.routes.fundamentals.get_finnhub_client", return_value=mock_fh),
        ):
            resp = client.get("/api/fundamentals/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert data["company_name"] == "Apple Inc."
        assert data["cik"] == "0000320193"
        assert "ttm" in data
        assert "quarterly" in data
        assert len(data["quarterly"]) >= 1
        assert data["ttm"]["pe_ratio"] == 29.5


class TestOwnershipFlow:
    """GET /api/ownership/{symbol} -- institutional holders."""

    def test_ownership_returns_holders(self, client):
        """Successful ownership fetch returns holders and QoQ changes."""
        mock_oc = AsyncMock()
        mock_oc.get_institutional_holders = AsyncMock(return_value={
            "holders": [
                {
                    "holder_name": "Vanguard Group",
                    "cik": "0000102909",
                    "shares": 1_300_000_000,
                    "value_usd": 246_000_000_000,
                    "change_shares": 5_000_000,
                    "change_percent": 0.39,
                    "filing_date": "2025-11-14",
                    "report_period": "2025-Q3",
                },
            ],
            "total_institutional_shares": 10_000_000_000,
            "total_institutional_value": 1_890_000_000_000,
        })

        with patch(
            "app.api.routes.ownership.get_ownership_client",
            return_value=mock_oc,
        ):
            resp = client.get("/api/ownership/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert "holders" in data
        assert len(data["holders"]) >= 1
        holder = data["holders"][0]
        assert holder["holder_name"] == "Vanguard Group"
        assert holder["shares"] == 1_300_000_000
        assert "quarter_over_quarter" in data
        assert data["data_source"] == "edgar_13f"


class TestInsiderFlow:
    """GET /api/insider/{symbol} -- insider transactions."""

    def test_insider_returns_transactions(self, client):
        """Successful insider fetch returns transactions and summary."""
        mock_oc = AsyncMock()
        mock_oc.get_insider_transactions = AsyncMock(return_value={
            "transactions": [
                {
                    "insider_name": "Tim Cook",
                    "insider_title": "CEO",
                    "transaction_type": "sell",
                    "transaction_date": "2026-02-10",
                    "shares": 50_000,
                    "price_per_share": 189.50,
                    "total_value": 9_475_000,
                    "shares_owned_after": 3_200_000,
                    "filing_date": "2026-02-12",
                },
            ],
        })

        with patch(
            "app.api.routes.ownership.get_ownership_client",
            return_value=mock_oc,
        ):
            resp = client.get("/api/insider/AAPL")

        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert "transactions" in data
        assert len(data["transactions"]) >= 1
        tx = data["transactions"][0]
        assert tx["insider_name"] == "Tim Cook"
        assert tx["transaction_type"] == "S-Sale"
        assert "summary" in data
        assert data["data_source"] == "edgar_form4"


class TestMacroFlow:
    """GET /api/macro/calendar -- economic calendar events."""

    def test_macro_returns_events(self, client):
        """Successful macro calendar returns formatted events."""
        mock_fh = AsyncMock()
        mock_fh.get_economic_calendar = AsyncMock(return_value=[
            {
                "event": "CPI (YoY)",
                "date": "2026-02-20",
                "time": "08:30",
                "country": "US",
                "actual": 3.1,
                "estimate": 3.0,
                "prev": 2.9,
                "impact": "high",
                "unit": "percent",
            },
            {
                "event": "Non-Farm Payrolls",
                "date": "2026-02-21",
                "time": "08:30",
                "country": "US",
                "actual": None,
                "estimate": 200,
                "prev": 187,
                "impact": "high",
                "unit": "thousands",
            },
        ])

        with patch(
            "app.api.routes.macro.get_finnhub_client",
            return_value=mock_fh,
        ):
            resp = client.get(
                "/api/macro/calendar?from_date=2026-02-20&to_date=2026-02-28"
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert len(data["events"]) == 2
        cpi_event = data["events"][0]
        assert cpi_event["event_name"] == "CPI (YoY)"
        assert cpi_event["importance"] == "high"
        assert cpi_event["actual"] == 3.1
        assert "date_range" in data
        assert data["data_source"] == "finnhub"
