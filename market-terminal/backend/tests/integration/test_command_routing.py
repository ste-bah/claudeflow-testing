"""Integration tests for Flow 3: Command Bar Routing.

Verifies that POST /api/query/ correctly parses structured commands and
natural-language text, dispatches to the appropriate handler, and returns
well-formed QueryResult responses.

Uses synchronous TestClient per ADR-003.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from .conftest import make_cached_result, SAMPLE_NEWS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _post_query(client: Any, text: str) -> Any:
    """POST to /api/query/ with the given text and return the response."""
    return client.post("/api/query/", json={"text": text})


def _mock_god_result(
    *,
    status: str = "success",
    response_text: str = "Analysis complete.",
    structured_data: dict[str, Any] | None = None,
    agent_count: int = 1,
    error_message: str | None = None,
    execution_time_ms: int = 100,
) -> AsyncMock:
    """Build a mock GodAgentResult-like object for invoke_claude_code."""
    mock = AsyncMock()
    mock.status = status
    mock.response_text = response_text
    mock.structured_data = structured_data or {}
    mock.agent_count = agent_count
    mock.error_message = error_message
    mock.execution_time_ms = execution_time_ms
    return mock


# ---------------------------------------------------------------------------
# TestCommandRouting
# ---------------------------------------------------------------------------

class TestCommandRouting:
    """POST /api/query/ -- command parsing and dispatch integration tests."""

    # ---- 1. analyze command ------------------------------------------------

    def test_analyze_command_routes_correctly(self, client: Any) -> None:
        """'analyze AAPL' dispatches to run_analysis and returns a command result."""
        fake_analysis = make_cached_result(symbol="AAPL")

        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value=fake_analysis,
        ) as mock_run:
            resp = _post_query(client, "analyze AAPL")

        assert resp.status_code == 200
        body = resp.json()

        assert body["query_type"] == "command"
        assert body["action"] == "analyze"
        assert body["success"] is True
        assert body["data"] is not None
        assert body["data"]["symbol"] == "AAPL"
        assert body["error"] is None
        assert body["source"] == "handler:analyze"

        mock_run.assert_awaited_once_with("AAPL")

    # ---- 2. scan command ---------------------------------------------------

    def test_scan_command_routes_correctly(self, client: Any) -> None:
        """'scan wyckoff bullish' dispatches to _scan_impl and returns results."""
        fake_scan = {
            "query": {
                "method": "wyckoff",
                "signal": "bullish",
                "confluence": None,
                "min_confidence": 0.0,
                "timeframe": None,
                "group": None,
            },
            "results": [],
            "total_matches": 0,
            "total_scanned": 5,
            "scan_duration_ms": 42,
            "note": "No tickers matched the scan criteria",
        }

        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=fake_scan,
        ) as mock_scan:
            resp = _post_query(client, "scan wyckoff bullish")

        assert resp.status_code == 200
        body = resp.json()

        assert body["query_type"] == "command"
        assert body["action"] == "scan"
        assert body["success"] is True
        assert body["data"] is not None
        assert "total_scanned" in body["data"]
        assert body["error"] is None

        mock_scan.assert_awaited_once_with(method="wyckoff", signal="bullish")

    # ---- 3. news command ---------------------------------------------------

    def test_news_command_routes_correctly(self, client: Any) -> None:
        """'news TSLA' dispatches to get_news and returns article data."""
        fake_news = {
            "symbol": "TSLA",
            "articles": SAMPLE_NEWS,
            "total_count": len(SAMPLE_NEWS),
            "limit": 20,
            "offset": 0,
            "data_source": "finnhub",
            "data_timestamp": "2026-02-16T10:00:00Z",
        }

        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value=fake_news,
        ) as mock_news:
            resp = _post_query(client, "news TSLA")

        assert resp.status_code == 200
        body = resp.json()

        assert body["query_type"] == "command"
        assert body["action"] == "news"
        assert body["success"] is True
        assert body["data"] is not None
        assert body["data"]["symbol"] == "TSLA"
        assert len(body["data"]["articles"]) == len(SAMPLE_NEWS)
        assert body["error"] is None

        mock_news.assert_awaited_once_with("TSLA")

    # ---- 4. natural language -----------------------------------------------

    def test_natural_language_routes_to_god_agent(self, client: Any) -> None:
        """Unrecognized text falls through to invoke_claude_code (god agent)."""
        god_result = _mock_god_result(
            response_text="Tech stocks showing accumulation include NVDA and AMD.",
            structured_data={"tickers": ["NVDA", "AMD"]},
            agent_count=3,
        )

        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=god_result,
        ) as mock_invoke:
            resp = _post_query(client, "what tech stocks show accumulation?")

        assert resp.status_code == 200
        body = resp.json()

        assert body["query_type"] == "natural_language"
        assert body["action"] == "natural_language"
        assert body["success"] is True
        assert body["source"] == "god_agent"
        assert body["data"] is not None
        assert "response_text" in body["data"]
        assert body["data"]["agent_count"] == 3
        assert body["error"] is None

        mock_invoke.assert_awaited_once()
        call_args = mock_invoke.call_args
        assert "accumulation" in call_args.args[0]

    # ---- 5. empty text validation ------------------------------------------

    def test_empty_text_returns_422(self, client: Any) -> None:
        """Empty text body triggers Pydantic validation and returns 422."""
        resp = _post_query(client, "")

        assert resp.status_code == 422

    # ---- 6. text over 500 chars validation ---------------------------------

    def test_text_over_500_chars_returns_422(self, client: Any) -> None:
        """Text exceeding 500 characters triggers Pydantic validation and returns 422."""
        long_text = "a" * 501
        resp = _post_query(client, long_text)

        assert resp.status_code == 422
