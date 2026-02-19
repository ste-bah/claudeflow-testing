"""Integration tests for TASK-GOD-005: Query Pipeline End-to-End.

Tests the REAL parsing + routing chain from HTTP POST /api/query/ through
command_parser → query_router → backend handlers.  Unlike unit tests, these
verify component interaction with only external handlers mocked.

Run with: ``pytest tests/test_query_integration.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.agent.query_router import QueryResult
from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Integration tests -- test REAL parse + route flow
# ---------------------------------------------------------------------------


class TestEndToEndStructuredCommands:
    """Test the full pipeline with real parse_command and route_query."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_analyze_command_full_chain(self, mock_run_analysis):
        """POST analyze AAPL → parse_command → route_query → handler."""
        # Mock only the final backend handler
        mock_run_analysis.return_value = {
            "ticker": "AAPL",
            "scores": {"wyckoff": 85, "canslim": 90},
        }

        # Make the HTTP request
        response = client.post("/api/query/", json={"text": "analyze AAPL"})

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["query_type"] == "command"
        assert data["action"] == "analyze"
        assert data["success"] is True
        assert data["data"]["ticker"] == "AAPL"
        assert "scores" in data["data"]

        # Verify the handler was called with correct symbol
        mock_run_analysis.assert_called_once_with("AAPL")

    @patch("app.api.routes.analysis.run_analysis")
    def test_analyze_lowercase_symbol(self, mock_run_analysis):
        """POST analyze aapl → parse_command uppercases → handler gets AAPL."""
        mock_run_analysis.return_value = {"ticker": "AAPL", "score": 75}

        response = client.post("/api/query/", json={"text": "analyze aapl"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["ticker"] == "AAPL"
        mock_run_analysis.assert_called_once_with("AAPL")

    @patch("app.api.routes.analysis.run_analysis")
    def test_analyze_alias_shorthand(self, mock_run_analysis):
        """POST a TSLA → parse_command recognizes alias → handler called."""
        mock_run_analysis.return_value = {"ticker": "TSLA", "score": 88}

        response = client.post("/api/query/", json={"text": "a TSLA"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "analyze"
        assert data["success"] is True
        mock_run_analysis.assert_called_once_with("TSLA")


class TestEndToEndScanCommand:
    """Test scan command with method and signal filters."""

    @patch("app.api.routes.scan._scan_impl")
    def test_scan_wyckoff_bullish_full_chain(self, mock_scan_impl):
        """POST scan wyckoff bullish → parse_command → route_query → _scan_impl."""
        mock_scan_impl.return_value = {
            "method": "wyckoff",
            "signal": "bullish",
            "results": [
                {"symbol": "AAPL", "score": 85},
                {"symbol": "MSFT", "score": 80},
            ],
        }

        response = client.post("/api/query/", json={"text": "scan wyckoff bullish"})

        assert response.status_code == 200
        data = response.json()
        assert data["query_type"] == "command"
        assert data["action"] == "scan"
        assert data["success"] is True
        assert data["data"]["method"] == "wyckoff"
        assert data["data"]["signal"] == "bullish"
        assert len(data["data"]["results"]) == 2

        # Verify handler called with correct args
        mock_scan_impl.assert_called_once_with(method="wyckoff", signal="bullish")

    @patch("app.api.routes.scan._scan_impl")
    def test_scan_no_filters_full_chain(self, mock_scan_impl):
        """POST scan → parse_command → route_query → _scan_impl with no filters."""
        mock_scan_impl.return_value = {
            "method": None,
            "signal": None,
            "results": [{"symbol": "AAPL"}, {"symbol": "TSLA"}],
        }

        response = client.post("/api/query/", json={"text": "scan"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        mock_scan_impl.assert_called_once_with(method=None, signal=None)

    @patch("app.api.routes.scan._scan_impl")
    def test_scan_method_alias_full_chain(self, mock_scan_impl):
        """POST scan w bearish → parse_command resolves alias → _scan_impl."""
        mock_scan_impl.return_value = {
            "method": "wyckoff",
            "signal": "bearish",
            "results": [],
        }

        response = client.post("/api/query/", json={"text": "scan w bearish"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Verify the alias was resolved to canonical name
        mock_scan_impl.assert_called_once_with(method="wyckoff", signal="bearish")


class TestEndToEndNaturalLanguageFallback:
    """Test NL fallback when command parsing fails."""

    @patch("app.agent.god_agent_interface.invoke_claude_code", new_callable=AsyncMock)
    def test_nl_query_full_chain(self, mock_invoke):
        """POST what stocks are trending? → parse_command returns None → NL fallback."""
        # Mock the Claude Code result to return error
        mock_result = MagicMock()
        mock_result.status = "error"
        mock_result.error_message = "not yet supported"
        mock_result.execution_time_ms = 0
        mock_invoke.return_value = mock_result

        response = client.post(
            "/api/query/", json={"text": "what stocks are trending?"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["query_type"] == "natural_language"
        assert data["action"] == "natural_language"
        assert data["success"] is False
        assert "not yet supported" in data["error"]
        assert data["source"] == "natural_language"

    def test_nl_empty_after_sanitize(self):
        """POST empty text → sanitize strips → validation error."""
        response = client.post("/api/query/", json={"text": "   "})

        assert response.status_code == 422
        assert "Query text must not be empty" in response.text

    def test_nl_gibberish_full_chain(self):
        """POST random gibberish → parse_command fails → NL fallback."""
        response = client.post("/api/query/", json={"text": "xyz abc 123 !@#"})

        assert response.status_code == 200
        data = response.json()
        assert data["query_type"] == "natural_language"
        assert data["success"] is False


class TestEndToEndSanitization:
    """Test HTML and control character sanitization in the full chain."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_html_stripped_before_parse(self, mock_run_analysis):
        """POST <b>analyze</b> AAPL → sanitize strips HTML → parse_command gets clean text."""
        mock_run_analysis.return_value = {"ticker": "AAPL", "score": 90}

        response = client.post("/api/query/", json={"text": "<b>analyze</b> AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "analyze"
        # Verify handler got clean symbol
        mock_run_analysis.assert_called_once_with("AAPL")

    @patch("app.api.routes.analysis.run_analysis")
    def test_script_tags_stripped(self, mock_run_analysis):
        """POST <b>analyze</b> AAPL → sanitize strips HTML tags → parse succeeds."""
        mock_run_analysis.return_value = {"ticker": "AAPL", "score": 85}

        response = client.post(
            "/api/query/", json={"text": "<b>analyze</b> AAPL"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        mock_run_analysis.assert_called_once_with("AAPL")

    @patch("app.api.routes.news.get_news")
    def test_control_chars_stripped(self, mock_get_news):
        """POST news \x00\x1f AAPL → sanitize strips control chars → parse_command succeeds."""
        mock_get_news.return_value = {
            "symbol": "AAPL",
            "articles": [{"title": "News", "url": "http://example.com"}],
        }

        response = client.post("/api/query/", json={"text": "news \x00\x1f AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "news"
        mock_get_news.assert_called_once_with("AAPL")


class TestEndToEndErrorPropagation:
    """Test error handling through the full chain."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_handler_raises_http_exception(self, mock_run_analysis):
        """Handler raises HTTPException → _safe_call catches → QueryResult has error."""
        mock_run_analysis.side_effect = HTTPException(
            status_code=404, detail="Symbol not found"
        )

        response = client.post("/api/query/", json={"text": "analyze INVALID"})

        assert response.status_code == 200  # route_query never raises
        data = response.json()
        assert data["success"] is False
        assert data["error"] == "Symbol not found"
        assert data["data"] is None

    @patch("app.api.routes.analysis.run_analysis")
    def test_handler_raises_generic_exception(self, mock_run_analysis):
        """Handler raises generic Exception → _safe_call catches → generic error."""
        mock_run_analysis.side_effect = RuntimeError("Database connection failed")

        response = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["error"] == "Internal error processing request"

    @patch("app.api.routes.watchlist.add_to_watchlist")
    def test_handler_returns_error_dict(self, mock_add):
        """Handler returns {"error": "..."} → QueryResult propagates error."""
        mock_add.return_value = {"error": "Watchlist full"}

        response = client.post("/api/query/", json={"text": "watch add AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["error"] == "Watchlist full"
        assert data["data"] is None


class TestEndToEndCompareCommand:
    """Test compare command that calls handler twice."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_compare_two_symbols_full_chain(self, mock_run_analysis):
        """POST compare AAPL MSFT → parse_command → route_query calls run_analysis twice."""
        # Mock run_analysis to return different results for each symbol
        def side_effect(symbol):
            if symbol == "AAPL":
                return {"ticker": "AAPL", "score": 85}
            elif symbol == "MSFT":
                return {"ticker": "MSFT", "score": 90}
            return {"ticker": symbol, "score": 0}

        mock_run_analysis.side_effect = side_effect

        response = client.post("/api/query/", json={"text": "compare AAPL MSFT"})

        assert response.status_code == 200
        data = response.json()
        assert data["query_type"] == "command"
        assert data["action"] == "compare"
        assert data["success"] is True

        # Verify both analyses are in the response
        assert "symbol_1" in data["data"]
        assert "symbol_2" in data["data"]
        assert data["data"]["symbol_1"]["ticker"] == "AAPL"
        assert data["data"]["symbol_2"]["ticker"] == "MSFT"

        # Verify run_analysis was called twice with correct args
        assert mock_run_analysis.call_count == 2
        mock_run_analysis.assert_any_call("AAPL")
        mock_run_analysis.assert_any_call("MSFT")

    @patch("app.api.routes.analysis.run_analysis")
    def test_compare_lowercase_symbols(self, mock_run_analysis):
        """POST compare aapl tsla → parse_command uppercases → handlers get uppercase."""

        def side_effect(symbol):
            return {"ticker": symbol, "score": 80}

        mock_run_analysis.side_effect = side_effect

        response = client.post("/api/query/", json={"text": "compare aapl tsla"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify uppercased symbols were passed
        mock_run_analysis.assert_any_call("AAPL")
        mock_run_analysis.assert_any_call("TSLA")


class TestEndToEndWatchlistCommands:
    """Test watchlist command chain."""

    @patch("app.api.routes.watchlist.add_to_watchlist")
    def test_watch_add_full_chain(self, mock_add):
        """POST watch add AAPL → parse_command → route_query → add_to_watchlist."""
        mock_add.return_value = {"symbol": "AAPL", "added": True}

        response = client.post("/api/query/", json={"text": "watch add AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "watch_add"
        assert data["success"] is True
        assert data["data"]["symbol"] == "AAPL"

        # Verify handler called
        mock_add.assert_called_once()

    @patch("app.api.routes.watchlist.remove_from_watchlist")
    def test_watch_remove_alias(self, mock_remove):
        """POST wr TSLA → parse_command recognizes alias → remove_from_watchlist."""
        mock_remove.return_value = {"symbol": "TSLA", "removed": True}

        response = client.post("/api/query/", json={"text": "wr TSLA"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "watch_remove"
        assert data["success"] is True
        mock_remove.assert_called_once_with("TSLA")

    @patch("app.api.routes.watchlist.get_watchlist")
    def test_watch_list_full_chain(self, mock_list):
        """POST watch list → parse_command → route_query → get_watchlist."""
        mock_list.return_value = {
            "watchlist": [{"symbol": "AAPL"}, {"symbol": "TSLA"}]
        }

        response = client.post("/api/query/", json={"text": "watch list"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "watch_list"
        assert data["success"] is True
        assert len(data["data"]["watchlist"]) == 2
        mock_list.assert_called_once()


class TestEndToEndOtherCommands:
    """Test remaining commands through full chain."""

    @patch("app.api.routes.news.get_news")
    def test_news_command_full_chain(self, mock_news):
        """POST news AAPL → parse_command → route_query → get_news."""
        mock_news.return_value = {
            "symbol": "AAPL",
            "articles": [{"title": "Apple News", "url": "http://example.com"}],
        }

        response = client.post("/api/query/", json={"text": "news AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "news"
        assert data["success"] is True
        assert data["data"]["symbol"] == "AAPL"
        mock_news.assert_called_once_with("AAPL")

    @patch("app.api.routes.macro.get_calendar")
    def test_macro_command_full_chain(self, mock_macro):
        """POST macro → parse_command → route_query → get_calendar."""
        mock_macro.return_value = {
            "events": [{"date": "2024-01-15", "description": "CPI Data"}]
        }

        response = client.post("/api/query/", json={"text": "macro"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "macro"
        assert data["success"] is True
        assert "events" in data["data"]
        mock_macro.assert_called_once()

    @patch("app.api.routes.fundamentals.get_fundamentals")
    def test_fundamentals_command_full_chain(self, mock_fund):
        """POST fundamentals AAPL → parse_command → route_query → get_fundamentals."""
        mock_fund.return_value = {
            "symbol": "AAPL",
            "pe_ratio": 28.5,
            "market_cap": "2.8T",
        }

        response = client.post("/api/query/", json={"text": "fundamentals AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "fundamentals"
        assert data["success"] is True
        assert data["data"]["symbol"] == "AAPL"
        mock_fund.assert_called_once_with("AAPL")

    @patch("app.api.routes.ownership.get_insider")
    def test_insider_command_full_chain(self, mock_insider):
        """POST insider AAPL → parse_command → route_query → get_insider."""
        mock_insider.return_value = {
            "symbol": "AAPL",
            "transactions": [
                {"name": "Tim Cook", "shares": 1000, "type": "purchase"}
            ],
        }

        response = client.post("/api/query/", json={"text": "insider AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "insider"
        assert data["success"] is True
        assert data["data"]["symbol"] == "AAPL"
        # Default days is 90
        mock_insider.assert_called_once_with("AAPL", days=90)

    @patch("app.api.routes.ownership.get_insider")
    def test_insider_with_days_full_chain(self, mock_insider):
        """POST insider AAPL 30 → parse_command → route_query → get_insider with days."""
        mock_insider.return_value = {"symbol": "AAPL", "transactions": []}

        response = client.post("/api/query/", json={"text": "insider AAPL 30"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Verify custom days parameter
        mock_insider.assert_called_once_with("AAPL", days=30)


class TestEndToEndExecutionTiming:
    """Test that execution_time_ms is populated correctly."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_execution_time_recorded(self, mock_run_analysis):
        """Verify execution_time_ms is measured and included in response."""
        mock_run_analysis.return_value = {"ticker": "AAPL", "score": 85}

        response = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Execution time should be a positive integer
        assert isinstance(data["execution_time_ms"], int)
        assert data["execution_time_ms"] >= 0


class TestEndToEndResponseStructure:
    """Test the complete QueryResult structure in HTTP responses."""

    @patch("app.api.routes.analysis.run_analysis")
    def test_successful_response_structure(self, mock_run_analysis):
        """Verify all QueryResult fields are present in successful response."""
        mock_run_analysis.return_value = {"ticker": "AAPL", "score": 85}

        response = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields
        assert "query_type" in data
        assert "action" in data
        assert "success" in data
        assert "data" in data
        assert "error" in data
        assert "execution_time_ms" in data
        assert "source" in data

        # Verify success case values
        assert data["query_type"] == "command"
        assert data["action"] == "analyze"
        assert data["success"] is True
        assert data["data"] is not None
        assert data["error"] is None
        assert data["source"] == "handler:analyze"

    def test_error_response_structure(self):
        """Verify QueryResult structure for NL fallback error."""
        response = client.post("/api/query/", json={"text": "random text"})

        assert response.status_code == 200
        data = response.json()

        # Verify all fields present
        assert "query_type" in data
        assert "action" in data
        assert "success" in data
        assert "data" in data
        assert "error" in data
        assert "execution_time_ms" in data
        assert "source" in data

        # Verify error case values
        assert data["query_type"] == "natural_language"
        assert data["success"] is False
        assert data["data"] is None
        assert data["error"] is not None
        assert data["source"] == "natural_language"
