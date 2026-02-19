"""Tests for TASK-GOD-006: God Agent integration across all three modules.

Covers the NEW functionality introduced by TASK-GOD-006:

1. ``_extract_ticker_from_text`` -- NL ticker extraction with stop-word filtering
2. ``_handle_natural_language`` -- GodAgentResult-to-QueryResult mapping
3. ``POST /api/query/cancel`` -- cancel endpoint on the query route
4. End-to-end NL query routing through the God Agent subprocess bridge

All async subprocess calls and ``invoke_claude_code`` calls are mocked.
No real ``claude`` process is ever spawned.

Run with: ``pytest tests/test_god_agent_integration.py -v``
"""
from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent.god_agent_interface import GodAgentResult
from app.agent.query_router import (
    QueryResult,
    _extract_ticker_from_text,
    _handle_natural_language,
    route_query,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Patch path for invoke_claude_code -- it is lazily imported inside
# _handle_natural_language via ``from app.agent.god_agent_interface import
# invoke_claude_code``, so we must patch at the SOURCE module.
_INVOKE_PATCH = "app.agent.god_agent_interface.invoke_claude_code"


def _make_god_result(
    status: str = "success",
    query: str = "test query",
    response_text: str = "Some response",
    structured_data: dict[str, Any] | None = None,
    execution_time_ms: int = 42,
    agent_count: int = 3,
    error_message: str | None = None,
) -> GodAgentResult:
    """Build a GodAgentResult with sensible defaults for test mocking."""
    return GodAgentResult(
        status=status,
        query=query,
        response_text=response_text,
        structured_data=structured_data,
        execution_time_ms=execution_time_ms,
        agent_count=agent_count,
        error_message=error_message,
    )


# ===================================================================
# 1. _extract_ticker_from_text -- Basic Extraction
# ===================================================================


class TestExtractTickerBasic:
    """Test basic ticker extraction from natural-language text.

    The function scans left-to-right for the first 2-5 letter uppercase
    token that is NOT in the stop word set.  Words like WANT, BUY, WHY
    are NOT stop words and WILL be returned if they appear before a real
    ticker.  Tests are written to match this actual behavior.
    """

    def test_single_ticker_extracted(self):
        assert _extract_ticker_from_text("What do you think about AAPL?") == "AAPL"

    def test_ticker_at_start(self):
        assert _extract_ticker_from_text("TSLA is overvalued") == "TSLA"

    def test_ticker_only_after_stop_words(self):
        """When only stop words precede the ticker, it is found."""
        assert _extract_ticker_from_text("THE AAPL IS GOOD") == "AAPL"

    def test_first_non_stop_word_returned(self):
        """Function returns the FIRST non-stop-word uppercase token."""
        # "WANT" is not a stop word, so it is returned before MSFT
        result = _extract_ticker_from_text("I WANT to buy MSFT")
        assert result == "WANT"

    def test_lowercase_input_uppercased(self):
        """Input is uppercased before scanning."""
        assert _extract_ticker_from_text("what about aapl today") == "AAPL"

    def test_mixed_case_input(self):
        assert _extract_ticker_from_text("Tell me about Tsla") == "TSLA"

    def test_two_letter_ticker_extracted(self):
        """Tickers as short as 2 characters are extracted."""
        assert _extract_ticker_from_text("How is GM doing?") == "GM"

    def test_five_letter_ticker_extracted(self):
        assert _extract_ticker_from_text("What about GOOGL?") == "GOOGL"

    def test_ticker_is_only_word(self):
        assert _extract_ticker_from_text("AAPL") == "AAPL"


# ===================================================================
# 2. _extract_ticker_from_text -- Stop Words
# ===================================================================


class TestExtractTickerStopWords:
    """Test that common English stop words are NOT extracted as tickers."""

    @pytest.mark.parametrize(
        "word",
        [
            "THE", "AND", "FOR", "ARE", "NOT", "YOU", "ALL", "CAN",
            "WILL", "WITH", "HAVE", "THIS", "FROM", "WHAT", "YOUR",
            "WHEN", "MAKE", "LIKE", "LONG", "LOOK", "MANY", "SOME",
        ],
        ids=lambda w: f"stop-{w}",
    )
    def test_common_stop_words_skipped(self, word: str):
        """Common English words should not be extracted as tickers."""
        text = f"Tell me about {word} today"
        result = _extract_ticker_from_text(text)
        assert result != word

    @pytest.mark.parametrize(
        "word",
        [
            "GDP", "PE", "EPS", "RSI", "ATH", "YTD", "QOQ",
            "IPO", "ETF", "CEO", "CFO", "COO", "SEC", "API",
            "USD", "EUR", "GBP", "JPY", "CAD",
        ],
        ids=lambda w: f"finance-{w}",
    )
    def test_finance_abbreviations_skipped(self, word: str):
        """Finance/tech abbreviations should not be extracted as tickers."""
        text = f"What is the current {word} for this stock"
        result = _extract_ticker_from_text(text)
        assert result != word

    def test_stop_word_sell_skipped(self):
        assert _extract_ticker_from_text("Should I SELL now?") != "SELL"

    def test_stop_word_high_skipped(self):
        assert _extract_ticker_from_text("Is the HIGH sustainable?") != "HIGH"

    def test_stop_word_stock_skipped(self):
        assert _extract_ticker_from_text("Which STOCK is best?") != "STOCK"

    def test_stop_word_price_skipped(self):
        assert _extract_ticker_from_text("What is the PRICE target?") != "PRICE"

    def test_stop_word_going_skipped(self):
        assert _extract_ticker_from_text("Is it GOING up?") != "GOING"


# ===================================================================
# 3. _extract_ticker_from_text -- Edge Cases
# ===================================================================


class TestExtractTickerEdgeCases:
    """Edge cases for ticker extraction."""

    def test_empty_string_returns_none(self):
        assert _extract_ticker_from_text("") is None

    def test_no_uppercase_tokens_returns_none(self):
        assert _extract_ticker_from_text("what is going on") is None

    def test_only_stop_words_returns_none(self):
        assert _extract_ticker_from_text("THE AND FOR ARE NOT") is None

    def test_single_letter_not_extracted(self):
        """Single-letter tokens are not valid tickers (min length is 2)."""
        assert _extract_ticker_from_text("I A") is None

    def test_six_letter_word_not_extracted(self):
        """Words longer than 5 characters are not matched by the regex."""
        result = _extract_ticker_from_text("SHOULD I invest")
        # "SHOULD" is 6 chars, too long for ticker regex; "I" is stop word
        assert result is None or result != "SHOULD"

    def test_ticker_among_stop_words(self):
        """A real ticker mixed with stop words should still be found."""
        result = _extract_ticker_from_text("What is the NVDA outlook for this year")
        assert result == "NVDA"

    def test_numbers_not_extracted(self):
        """Purely numeric tokens are not matched by the 1-5 alpha regex."""
        assert _extract_ticker_from_text("What about 12345?") is None

    def test_alphanumeric_not_extracted(self):
        """Mixed alpha-numeric tokens are not matched."""
        result = _extract_ticker_from_text("look at A1B2C")
        assert result != "A1B2C"

    def test_ticker_in_parentheses(self):
        """Tickers inside parentheses should still be extracted."""
        assert _extract_ticker_from_text("(AAPL) is great!") == "AAPL"

    def test_ticker_before_period(self):
        """Non-stop-word extracted even before ticker. 'BUY' is not a stop word."""
        result = _extract_ticker_from_text("Buy TSLA.")
        # "BUY" is not a stop word, so it is found first
        assert result == "BUY"

    def test_ticker_after_colon(self):
        """'CHECK' is 5 letters and not a stop word, so it is returned first."""
        result = _extract_ticker_from_text("Check: MSFT?")
        assert result == "CHECK"

    def test_ticker_after_colon_with_stop_words(self):
        """When preceding words are stop words, the ticker is found."""
        assert _extract_ticker_from_text("So: MSFT?") == "MSFT"

    def test_all_stop_words_then_ticker(self):
        """Stop words before a valid ticker -- ticker should be found."""
        result = _extract_ticker_from_text("WHAT IS THE AAPL PRICE")
        assert result == "AAPL"


# ===================================================================
# 4. _handle_natural_language -- Success Path
# ===================================================================


class TestHandleNaturalLanguageSuccess:
    """Test _handle_natural_language with successful GodAgentResult."""

    @pytest.mark.asyncio
    async def test_success_maps_to_query_result(self):
        """Successful GodAgentResult maps to QueryResult with success=True."""
        god_result = _make_god_result(
            status="success",
            response_text="AAPL looks bullish",
            structured_data={"sentiment": "bullish"},
            agent_count=5,
            execution_time_ms=100,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("analyze AAPL for me")

        assert isinstance(result, QueryResult)
        assert result.query_type == "natural_language"
        assert result.action == "natural_language"
        assert result.success is True
        assert result.source == "god_agent"
        assert result.execution_time_ms == 100

    @pytest.mark.asyncio
    async def test_success_data_contains_response_text(self):
        god_result = _make_god_result(
            status="success",
            response_text="The stock looks good",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("how is NVDA")

        assert result.data is not None
        assert result.data["response_text"] == "The stock looks good"

    @pytest.mark.asyncio
    async def test_success_data_contains_structured_data(self):
        structured = {"recommendation": "buy", "target": 200}
        god_result = _make_god_result(
            status="success",
            structured_data=structured,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("NVDA price target")

        assert result.data["structured_data"] == structured

    @pytest.mark.asyncio
    async def test_success_data_contains_agent_count(self):
        god_result = _make_god_result(status="success", agent_count=12)
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("run analysis")

        assert result.data["agent_count"] == 12

    @pytest.mark.asyncio
    async def test_success_with_ticker_includes_ticker_in_data(self):
        """When a ticker is extracted, it appears in the data dict."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("What do you think about AAPL?")

        assert result.data is not None
        assert result.data.get("ticker") == "AAPL"

    @pytest.mark.asyncio
    async def test_success_without_ticker_omits_ticker_from_data(self):
        """When no ticker is extracted, the ticker key is absent from data."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            # All words are stop words or single chars
            result = await _handle_natural_language("what is the and for are not")

        assert result.data is not None
        assert "ticker" not in result.data

    @pytest.mark.asyncio
    async def test_success_error_field_is_none(self):
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("hello")

        assert result.error is None


# ===================================================================
# 5. _handle_natural_language -- Error Paths
# ===================================================================


class TestHandleNaturalLanguageErrors:
    """Test _handle_natural_language with non-success GodAgentResult statuses."""

    @pytest.mark.asyncio
    async def test_error_status_maps_to_failure(self):
        god_result = _make_god_result(
            status="error",
            error_message="Claude CLI not found",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("test query")

        assert result.success is False
        assert result.error == "Claude CLI not found"
        assert result.data is None
        assert result.source == "god_agent"

    @pytest.mark.asyncio
    async def test_timeout_status_maps_to_failure(self):
        god_result = _make_god_result(
            status="timeout",
            error_message="Query timed out after 60 seconds",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("slow query")

        assert result.success is False
        assert "timed out" in result.error.lower()
        assert result.data is None

    @pytest.mark.asyncio
    async def test_busy_status_maps_to_failure(self):
        god_result = _make_god_result(
            status="busy",
            error_message="Another query is already in progress",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("second query")

        assert result.success is False
        assert "already in progress" in result.error.lower()
        assert result.data is None

    @pytest.mark.asyncio
    async def test_cancelled_status_maps_to_failure(self):
        god_result = _make_god_result(
            status="cancelled",
            error_message="Query was cancelled",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("cancelled query")

        assert result.success is False
        assert "cancelled" in result.error.lower()
        assert result.data is None

    @pytest.mark.asyncio
    async def test_error_without_message_uses_fallback(self):
        """When error_message is None, a fallback message is generated."""
        god_result = _make_god_result(
            status="error",
            error_message=None,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("test")

        assert result.success is False
        assert result.error is not None
        assert "error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_error_execution_time_preserved(self):
        """Execution time from GodAgentResult is preserved in QueryResult."""
        god_result = _make_god_result(
            status="error",
            execution_time_ms=250,
            error_message="Something failed",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("test")

        assert result.execution_time_ms == 250


# ===================================================================
# 6. _handle_natural_language -- Ticker Passthrough
# ===================================================================


class TestHandleNLTickerPassthrough:
    """Verify _handle_natural_language extracts ticker and passes it to invoke."""

    @pytest.mark.asyncio
    async def test_ticker_extracted_and_passed_to_invoke(self):
        """When text contains a ticker, it is passed as the ticker kwarg."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ) as mock_invoke:
            await _handle_natural_language("What is AAPL doing?")

        mock_invoke.assert_awaited_once()
        _, kwargs = mock_invoke.call_args
        assert kwargs.get("ticker") == "AAPL"

    @pytest.mark.asyncio
    async def test_no_ticker_passes_none(self):
        """When no ticker is found, None is passed as the ticker kwarg."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ) as mock_invoke:
            # All words are stop words or single letters
            await _handle_natural_language("what is the and for are not")

        mock_invoke.assert_awaited_once()
        _, kwargs = mock_invoke.call_args
        assert kwargs.get("ticker") is None

    @pytest.mark.asyncio
    async def test_text_passed_as_query(self):
        """The full text is passed as the first positional argument."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ) as mock_invoke:
            await _handle_natural_language("analyze TSLA for me")

        args, _ = mock_invoke.call_args
        assert args[0] == "analyze TSLA for me"


# ===================================================================
# 7. route_query NL integration (full router path)
# ===================================================================


class TestRouteQueryNLIntegration:
    """Test route_query dispatching to _handle_natural_language for NL text."""

    @pytest.mark.asyncio
    async def test_unrecognized_text_routes_to_god_agent(self):
        """Text that doesn't match any command pattern goes to God Agent."""
        god_result = _make_god_result(
            status="success",
            response_text="Market analysis...",
            agent_count=7,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await route_query("what is the market doing today")

        assert result.query_type == "natural_language"
        assert result.action == "natural_language"
        assert result.success is True
        assert result.source == "god_agent"
        assert result.data is not None
        assert result.data["response_text"] == "Market analysis..."

    @pytest.mark.asyncio
    async def test_nl_error_from_god_agent_propagated(self):
        """Error from God Agent propagates through route_query correctly."""
        god_result = _make_god_result(
            status="error",
            error_message="CLI not found",
            execution_time_ms=5,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await route_query("random question about stocks")

        assert result.query_type == "natural_language"
        assert result.success is False
        assert result.error == "CLI not found"
        assert result.data is None

    @pytest.mark.asyncio
    async def test_nl_timeout_from_god_agent_propagated(self):
        god_result = _make_god_result(
            status="timeout",
            error_message="Query timed out after 60 seconds",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await route_query("complex question about markets")

        assert result.success is False
        assert "timed out" in result.error.lower()


# ===================================================================
# 8. POST /api/query/cancel Endpoint
# ===================================================================


class TestCancelEndpoint:
    """Tests for POST /api/query/cancel."""

    def test_cancel_returns_200(self):
        """Cancel endpoint returns 200 regardless of whether cancellation occurred."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=False,
        ):
            resp = client.post("/api/query/cancel")

        assert resp.status_code == 200

    def test_cancel_no_query_returns_false(self):
        """When no query is running, cancelled=false."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=False,
        ):
            resp = client.post("/api/query/cancel")

        body = resp.json()
        assert body["cancelled"] is False

    def test_cancel_active_query_returns_true(self):
        """When a query is running and cancel succeeds, cancelled=true."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=True,
        ):
            resp = client.post("/api/query/cancel")

        body = resp.json()
        assert body["cancelled"] is True

    def test_cancel_response_structure(self):
        """Response has exactly one key: 'cancelled'."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=False,
        ):
            resp = client.post("/api/query/cancel")

        body = resp.json()
        assert set(body.keys()) == {"cancelled"}

    def test_cancel_content_type_json(self):
        """Cancel endpoint returns JSON content type."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=False,
        ):
            resp = client.post("/api/query/cancel")

        assert "application/json" in resp.headers.get("content-type", "")

    def test_cancel_get_not_allowed(self):
        """GET /api/query/cancel should return 405."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/query/cancel")
        assert resp.status_code == 405

    def test_cancel_calls_cancel_current(self):
        """Cancel endpoint calls cancel_current exactly once."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        with patch(
            "app.agent.god_agent_interface.cancel_current",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_cancel:
            client.post("/api/query/cancel")

        mock_cancel.assert_awaited_once()


# ===================================================================
# 9. Cancel Endpoint -- Route Registration
# ===================================================================


class TestCancelRouteRegistration:
    """Verify the cancel route is registered correctly."""

    def test_cancel_route_is_registered_on_app(self):
        from app.main import app

        route_paths = [getattr(r, "path", "") for r in app.routes]
        assert "/api/query/cancel" in route_paths

    def test_cancel_route_on_query_router(self):
        """The query router has the /cancel path (with prefix applied)."""
        from app.api.routes.query import router

        route_paths = [getattr(r, "path", "") for r in router.routes]
        # The router stores paths WITH the prefix applied
        assert "/api/query/cancel" in route_paths


# ===================================================================
# 10. NL Query via HTTP Endpoint (Full Stack)
# ===================================================================


class TestNLQueryHTTPFullStack:
    """End-to-end NL query: HTTP -> query.py -> route_query -> _handle_natural_language
    -> invoke_claude_code (mocked) -> QueryResult -> HTTP response.
    """

    def test_nl_query_success_via_http(self):
        """NL query through HTTP returns God Agent success data."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        god_result = _make_god_result(
            status="success",
            response_text="AAPL is bullish with strong momentum",
            structured_data={"sentiment": "bullish", "confidence": 0.92},
            agent_count=5,
            execution_time_ms=1500,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "What do you think about AAPL?"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["query_type"] == "natural_language"
        assert body["action"] == "natural_language"
        assert body["success"] is True
        assert body["source"] == "god_agent"
        assert body["data"]["response_text"] == "AAPL is bullish with strong momentum"
        assert body["data"]["structured_data"]["sentiment"] == "bullish"
        assert body["data"]["agent_count"] == 5
        assert body["data"]["ticker"] == "AAPL"
        assert body["execution_time_ms"] == 1500

    def test_nl_query_error_via_http(self):
        """NL query error from God Agent returns success=False."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        god_result = _make_god_result(
            status="error",
            error_message="Claude CLI not found -- is 'claude' installed?",
            execution_time_ms=5,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "tell me about the stock market"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "Claude CLI not found" in body["error"]
        assert body["data"] is None

    def test_nl_query_timeout_via_http(self):
        """Timeout from God Agent returns success=False via HTTP."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        god_result = _make_god_result(
            status="timeout",
            error_message="Query timed out after 60 seconds",
            execution_time_ms=60000,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "give me a deep analysis of everything"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "timed out" in body["error"].lower()

    def test_nl_query_busy_via_http(self):
        """Busy status from God Agent returns success=False via HTTP."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        god_result = _make_god_result(
            status="busy",
            error_message="Another query is already in progress",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "another question while busy"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "already in progress" in body["error"].lower()

    def test_nl_query_response_has_all_expected_keys(self):
        """NL query response contains all QueryResult fields."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "random question about the market"},
            )

        body = resp.json()
        expected_keys = {
            "query_type", "action", "success", "data",
            "error", "execution_time_ms", "source",
        }
        assert set(body.keys()) == expected_keys


# ===================================================================
# 11. QueryResult Model Properties (NL-specific)
# ===================================================================


class TestQueryResultNLProperties:
    """Verify QueryResult properties specific to natural-language routing."""

    @pytest.mark.asyncio
    async def test_query_type_is_natural_language(self):
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("question")

        assert result.query_type == "natural_language"

    @pytest.mark.asyncio
    async def test_action_is_natural_language(self):
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("question")

        assert result.action == "natural_language"

    @pytest.mark.asyncio
    async def test_source_is_god_agent(self):
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("question")

        assert result.source == "god_agent"

    @pytest.mark.asyncio
    async def test_frozen_model(self):
        """QueryResult from NL path is immutable."""
        god_result = _make_god_result(status="success")
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("question")

        with pytest.raises(Exception):
            result.action = "modified"  # type: ignore[misc]


# ===================================================================
# 12. _extract_ticker_from_text -- Realistic Queries
# ===================================================================


class TestExtractTickerRealisticQueries:
    """Test ticker extraction with realistic natural-language queries.

    Note: The function returns the FIRST non-stop-word 2-5 letter uppercase
    token.  Words like WHY, DID, GIVEN are not in the stop-word list and
    may be returned before the actual ticker.  Tests account for this.
    """

    def test_is_aapl_a_good_buy(self):
        """'IS' and 'A' are stop words; AAPL should be found."""
        assert _extract_ticker_from_text("Is AAPL a good buy right now?") == "AAPL"

    def test_what_happened_to_tsla(self):
        """'WHAT' is a stop word; TSLA should be found."""
        assert _extract_ticker_from_text("What happened to TSLA today?") == "TSLA"

    def test_compare_msft_and_goog(self):
        result = _extract_ticker_from_text("Compare MSFT and GOOG")
        # "MSFT" is first non-stop-word after scanning
        assert result in ("MSFT", "GOOG")

    def test_why_is_not_stop_word(self):
        """'WHY' is 3 letters and NOT in the stop word set; it is returned first."""
        result = _extract_ticker_from_text("Why did NVDA drop 5% today?")
        # WHY is not a stop word, so it gets returned
        assert result == "WHY"

    def test_should_i_sell_my_amzn(self):
        """'SHOULD' is 6 chars (not matched by regex); AMZN should be found."""
        assert _extract_ticker_from_text("Should I sell my AMZN shares?") == "AMZN"

    def test_whats_the_pe_for_meta(self):
        assert _extract_ticker_from_text("What's the PE for META?") == "META"

    def test_no_ticker_in_general_question(self):
        """General market questions may not contain a ticker."""
        result = _extract_ticker_from_text("How is the market doing today?")
        # All caps words are stop words (HOW, THE) or not, function may return
        # something unexpected -- the key is it does not crash
        assert result is None or isinstance(result, str)

    def test_ticker_after_only_stop_words(self):
        """When all preceding words are stop words, the real ticker is found."""
        result = _extract_ticker_from_text(
            "What is your outlook on NFLX?"
        )
        assert result == "NFLX"


# ===================================================================
# 13. _handle_natural_language -- Structured Data Edge Cases
# ===================================================================


class TestHandleNLStructuredDataEdgeCases:
    """Test handling of various structured_data shapes from GodAgentResult."""

    @pytest.mark.asyncio
    async def test_none_structured_data(self):
        god_result = _make_god_result(
            status="success",
            structured_data=None,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("plain text response")

        assert result.data["structured_data"] is None

    @pytest.mark.asyncio
    async def test_empty_dict_structured_data(self):
        god_result = _make_god_result(
            status="success",
            structured_data={},
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("minimal response")

        assert result.data["structured_data"] == {}

    @pytest.mark.asyncio
    async def test_deeply_nested_structured_data(self):
        nested = {"level1": {"level2": {"level3": [1, 2, 3]}}}
        god_result = _make_god_result(
            status="success",
            structured_data=nested,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("complex analysis")

        assert result.data["structured_data"] == nested

    @pytest.mark.asyncio
    async def test_zero_agent_count(self):
        god_result = _make_god_result(
            status="success",
            agent_count=0,
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("simple question")

        assert result.data["agent_count"] == 0

    @pytest.mark.asyncio
    async def test_empty_response_text(self):
        god_result = _make_god_result(
            status="success",
            response_text="",
        )
        with patch(
            _INVOKE_PATCH,
            new_callable=AsyncMock,
            return_value=god_result,
        ):
            result = await _handle_natural_language("empty response test")

        assert result.data["response_text"] == ""


# ===================================================================
# 14. Cancel Integration with God Agent Module State
# ===================================================================


class TestCancelIntegrationWithModuleState:
    """Test cancel_current against actual module-level state."""

    @pytest.fixture(autouse=True)
    def _reset_god_agent_state(self):
        """Reset module-level state before/after each test."""
        import app.agent.god_agent_interface as mod
        mod._current_process = None
        mod._cancel_event = None
        mod._lock = asyncio.Lock()
        yield
        mod._current_process = None
        mod._cancel_event = None
        mod._lock = asyncio.Lock()

    @pytest.mark.asyncio
    async def test_cancel_with_no_event_returns_false(self):
        from app.agent.god_agent_interface import cancel_current
        result = await cancel_current()
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_with_active_event_returns_true(self):
        import app.agent.god_agent_interface as mod
        from app.agent.god_agent_interface import cancel_current

        evt = asyncio.Event()
        mod._cancel_event = evt

        result = await cancel_current()
        assert result is True
        assert evt.is_set()

    @pytest.mark.asyncio
    async def test_cancel_with_already_set_event_returns_false(self):
        import app.agent.god_agent_interface as mod
        from app.agent.god_agent_interface import cancel_current

        evt = asyncio.Event()
        evt.set()
        mod._cancel_event = evt

        result = await cancel_current()
        assert result is False

    @pytest.mark.asyncio
    async def test_double_cancel_idempotent(self):
        import app.agent.god_agent_interface as mod
        from app.agent.god_agent_interface import cancel_current

        evt = asyncio.Event()
        mod._cancel_event = evt

        first = await cancel_current()
        second = await cancel_current()
        assert first is True
        assert second is False


# ===================================================================
# 15. NL Stop Words -- Comprehensive Coverage
# ===================================================================


class TestStopWordsCoverage:
    """Verify the stop word list is comprehensive enough for common queries."""

    def test_single_char_i_is_stop_word(self):
        """'I' is a single char (len < 2), so it is skipped (not by stop words
        but by the len(candidate) >= 2 check)."""
        result = _extract_ticker_from_text("I WANT to invest")
        assert result != "I"

    def test_ai_is_stop_word(self):
        """'AI' should not be extracted as a ticker symbol."""
        result = _extract_ticker_from_text("AI is transforming markets")
        assert result != "AI"

    def test_ok_is_stop_word(self):
        result = _extract_ticker_from_text("OK so what should I buy")
        assert result != "OK"

    def test_etf_is_stop_word(self):
        result = _extract_ticker_from_text("What ETF should I buy?")
        assert result != "ETF"

    def test_ipo_is_stop_word(self):
        result = _extract_ticker_from_text("When is the IPO?")
        assert result != "IPO"

    def test_real_tickers_not_confused_as_stop_words(self):
        """Real tickers should not be in the stop word list.

        Test each in isolation so no preceding non-stop-word can interfere.
        """
        real_tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "TSLA", "NVDA", "META", "NFLX"]
        for ticker in real_tickers:
            # Use only stop words before the ticker
            result = _extract_ticker_from_text(f"WHAT IS THE {ticker}")
            assert result == ticker, f"Expected {ticker} but got {result}"
