"""Tests for TASK-GOD-005: query_router module.

Validates the ``route_query`` async dispatcher and ``QueryResult`` model.
All backend handler calls are mocked at their *source* modules because the
query router uses deferred (in-function) imports.  No real DB/API calls.

Natural-language tests mock ``invoke_claude_code`` since the real Claude CLI
cannot run inside the test environment (TASK-GOD-006 integration).

Run with: ``pytest tests/test_query_router.py -v``
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.agent.god_agent_interface import GodAgentResult
from app.agent.query_router import QueryResult, route_query


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    """Run an async coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_god_result(
    *,
    status: str = "success",
    query: str = "test",
    response_text: str = "Mock response from God Agent",
    structured_data: dict | None = None,
    execution_time_ms: int = 42,
    agent_count: int = 1,
    error_message: str | None = None,
) -> GodAgentResult:
    """Build a ``GodAgentResult`` with sensible defaults for testing."""
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
# 1. Analyze Command Dispatch
# ===================================================================
class TestAnalyzeDispatch:
    """``analyze AAPL`` dispatches to ``run_analysis``."""

    def test_analyze_calls_run_analysis(self):
        mock_result = {"ticker": "AAPL", "analysis": "done"}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("analyze AAPL"))
            mock_fn.assert_awaited_once_with("AAPL")

        assert result.query_type == "command"
        assert result.action == "analyze"
        assert result.success is True
        assert result.data == mock_result

    def test_analyze_shorthand(self):
        mock_result = {"ticker": "MSFT"}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("a MSFT"))
            mock_fn.assert_awaited_once_with("MSFT")

        assert result.success is True
        assert result.action == "analyze"


# ===================================================================
# 2. Scan Command Dispatch
# ===================================================================
class TestScanDispatch:
    """``scan`` dispatches to ``_scan_impl``."""

    def test_scan_wyckoff_bullish(self):
        mock_result = {"results": [], "total_matches": 0}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("scan wyckoff bullish"))
            mock_fn.assert_awaited_once_with(method="wyckoff", signal="bullish")

        assert result.success is True
        assert result.action == "scan"

    def test_scan_bare(self):
        mock_result = {"results": []}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("scan"))
            mock_fn.assert_awaited_once_with(method=None, signal=None)

        assert result.success is True


# ===================================================================
# 3. Watch Add Command Dispatch
# ===================================================================
class TestWatchAddDispatch:
    """``watch add`` dispatches to ``add_to_watchlist``."""

    def test_watch_add_tsla(self):
        mock_result = {"symbol": "TSLA", "added": True}
        with patch(
            "app.api.routes.watchlist.add_to_watchlist",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_add, patch(
            "app.api.routes.watchlist._AddTickerRequest",
        ) as mock_req_cls:
            mock_req_instance = MagicMock()
            mock_req_cls.return_value = mock_req_instance
            result = _run(route_query("watch add TSLA"))

        assert result.success is True
        assert result.action == "watch_add"


# ===================================================================
# 4. Watch Remove Command Dispatch
# ===================================================================
class TestWatchRemoveDispatch:
    """``watch remove`` dispatches to ``remove_from_watchlist``."""

    def test_watch_remove_tsla(self):
        mock_result = {"symbol": "TSLA", "removed": True}
        with patch(
            "app.api.routes.watchlist.remove_from_watchlist",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("watch remove TSLA"))
            mock_fn.assert_awaited_once_with("TSLA")

        assert result.success is True
        assert result.action == "watch_remove"


# ===================================================================
# 5. Watch List Command Dispatch
# ===================================================================
class TestWatchListDispatch:
    """``watch list`` dispatches to ``get_watchlist``."""

    def test_watch_list(self):
        mock_result = {"tickers": ["AAPL", "MSFT"]}
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("watch list"))
            mock_fn.assert_awaited_once()

        assert result.success is True
        assert result.action == "watch_list"

    def test_wl_shorthand(self):
        mock_result = {"tickers": []}
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            result = _run(route_query("wl"))

        assert result.success is True
        assert result.action == "watch_list"


# ===================================================================
# 6. News Command Dispatch
# ===================================================================
class TestNewsDispatch:
    """``news`` dispatches to ``get_news``."""

    def test_news_aapl(self):
        mock_result = {"articles": []}
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("news AAPL"))
            mock_fn.assert_awaited_once_with("AAPL")

        assert result.success is True
        assert result.action == "news"


# ===================================================================
# 7. Macro Command Dispatch
# ===================================================================
class TestMacroDispatch:
    """``macro`` dispatches to ``get_calendar``."""

    def test_macro(self):
        mock_result = {"events": []}
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("macro"))
            mock_fn.assert_awaited_once()

        assert result.success is True
        assert result.action == "macro"


# ===================================================================
# 8. Fundamentals Command Dispatch
# ===================================================================
class TestFundamentalsDispatch:
    """``fundamentals`` dispatches to ``get_fundamentals``."""

    def test_fundamentals_aapl(self):
        mock_result = {"pe_ratio": 25.0}
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("fundamentals AAPL"))
            mock_fn.assert_awaited_once_with("AAPL")

        assert result.success is True
        assert result.action == "fundamentals"


# ===================================================================
# 9. Insider Command Dispatch
# ===================================================================
class TestInsiderDispatch:
    """``insider`` dispatches to ``get_insider``."""

    def test_insider_aapl_default_days(self):
        mock_result = {"transactions": []}
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("insider AAPL"))
            mock_fn.assert_awaited_once_with("AAPL", days=90)

        assert result.success is True
        assert result.action == "insider"

    def test_insider_aapl_30d(self):
        mock_result = {"transactions": []}
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value=mock_result,
        ) as mock_fn:
            result = _run(route_query("insider AAPL 30d"))
            mock_fn.assert_awaited_once_with("AAPL", days=30)

        assert result.success is True


# ===================================================================
# 10. Compare Command Dispatch
# ===================================================================
class TestCompareDispatch:
    """``compare`` calls ``run_analysis`` for both symbols."""

    def test_compare_aapl_msft(self):
        mock_result_1 = {"ticker": "AAPL"}
        mock_result_2 = {"ticker": "MSFT"}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=[mock_result_1, mock_result_2],
        ) as mock_fn:
            result = _run(route_query("compare AAPL MSFT"))
            assert mock_fn.await_count == 2
            mock_fn.assert_any_await("AAPL")
            mock_fn.assert_any_await("MSFT")

        assert result.success is True
        assert result.action == "compare"
        assert result.data["symbol_1"] == mock_result_1
        assert result.data["symbol_2"] == mock_result_2


# ===================================================================
# 11. Natural Language -- God Agent Routing
# ===================================================================
class TestNaturalLanguageFallback:
    """Unrecognised text routes through the God Agent via invoke_claude_code."""

    def test_natural_language_question(self):
        """NL query dispatches to god_agent and returns structured result."""
        mock_god = _make_god_result(
            status="success",
            query="what is the best stock",
            response_text="Based on current analysis, AAPL leads.",
            execution_time_ms=150,
            agent_count=3,
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ) as mock_invoke:
            result = _run(route_query("what is the best stock?"))
            mock_invoke.assert_awaited_once()

        assert result.query_type == "natural_language"
        assert result.action == "natural_language"
        assert result.success is True
        assert result.data is not None
        assert result.data["response_text"] == "Based on current analysis, AAPL leads."
        assert result.data["agent_count"] == 3
        assert result.source == "god_agent"
        assert result.error is None

    def test_natural_language_greeting(self):
        """Greeting text routes through god_agent; result reflects its status."""
        mock_god = _make_god_result(status="error", error_message="No actionable query")
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("hello there"))

        assert result.query_type == "natural_language"
        assert result.success is False

    def test_natural_language_empty_error_not_none(self):
        """When god_agent returns error status, QueryResult.error is populated."""
        mock_god = _make_god_result(
            status="error",
            error_message="Unable to process market query",
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("tell me about the market"))

        assert result.error is not None

    def test_natural_language_extracts_ticker(self):
        """Ticker extraction from NL text is passed to invoke_claude_code."""
        mock_god = _make_god_result(
            status="success",
            response_text="AAPL analysis complete.",
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ) as mock_invoke:
            # "is" is a stop word, so AAPL is the first extracted ticker
            result = _run(route_query("is AAPL a good stock?"))
            # Verify ticker was extracted and passed
            call_kwargs = mock_invoke.call_args
            assert call_kwargs[1]["ticker"] == "AAPL"

        assert result.success is True
        assert result.data["ticker"] == "AAPL"

    def test_natural_language_god_agent_error_propagates(self):
        """God Agent error status maps to QueryResult.success=False."""
        mock_god = _make_god_result(
            status="timeout",
            error_message="Query timed out after 60 seconds",
            execution_time_ms=60000,
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("explain the entire market"))

        assert result.success is False
        assert result.error is not None
        assert "timed out" in result.error.lower()
        assert result.source == "god_agent"


# ===================================================================
# 12. Error Containment -- HTTPException
# ===================================================================
class TestErrorContainmentHTTPException:
    """HTTPException raised by backend handlers is caught by _safe_call."""

    def test_http_exception_400(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=400, detail="bad request"),
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.success is False
        assert result.error == "bad request"
        assert result.data is None
        assert result.query_type == "command"
        assert result.action == "analyze"

    def test_http_exception_502(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=502, detail="Price data unavailable"),
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.success is False
        assert result.error == "Price data unavailable"

    def test_http_exception_404(self):
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Symbol not found"),
        ):
            result = _run(route_query("news INVALID"))

        assert result.success is False
        assert result.error == "Symbol not found"


# ===================================================================
# 13. Error Containment -- Generic Exception
# ===================================================================
class TestErrorContainmentGeneric:
    """Generic exceptions are caught and return Internal error."""

    def test_runtime_error_caught(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Unexpected crash"),
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.success is False
        assert result.error is not None
        assert "internal error" in result.error.lower()
        assert result.data is None

    def test_value_error_caught(self):
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            side_effect=ValueError("bad data"),
        ):
            result = _run(route_query("watch list"))

        assert result.success is False
        assert result.error is not None

    def test_type_error_caught(self):
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            side_effect=TypeError("wrong type"),
        ):
            result = _run(route_query("macro"))

        assert result.success is False
        assert result.error is not None


# ===================================================================
# 14. Execution Timing
# ===================================================================
class TestExecutionTiming:
    """execution_time_ms is populated and non-negative."""

    def test_execution_time_non_negative_on_success(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.execution_time_ms >= 0

    def test_execution_time_non_negative_on_error(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.execution_time_ms >= 0

    def test_execution_time_is_integer(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            result = _run(route_query("analyze AAPL"))

        assert isinstance(result.execution_time_ms, int)

    def test_natural_language_execution_time_from_god_agent(self):
        """NL path delegates timing to the God Agent; execution_time_ms >= 0."""
        mock_god = _make_god_result(execution_time_ms=85)
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("random gibberish text"))

        assert result.execution_time_ms >= 0
        assert result.execution_time_ms == 85


# ===================================================================
# 15. QueryResult Model
# ===================================================================
class TestQueryResultModel:
    """Validate QueryResult model properties."""

    def test_frozen_model(self):
        """QueryResult is frozen -- attribute assignment should raise."""
        mock_god = _make_god_result(status="error", error_message="test error")
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("what is this?"))
        with pytest.raises(Exception):
            result.action = "something"  # type: ignore[misc]

    def test_source_field_on_command(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.source == "handler:analyze"

    def test_source_field_on_natural_language(self):
        """NL queries are routed through god_agent; source reflects this."""
        mock_god = _make_god_result(status="success")
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("tell me about stocks"))

        assert result.source == "god_agent"

    def test_source_field_none_default(self):
        """QueryResult default source is 'none'."""
        qr = QueryResult(
            query_type="test",
            action="test",
            success=True,
        )
        assert qr.source == "none"


# ===================================================================
# 16. Dispatch Coverage -- All Actions
# ===================================================================
class TestDispatchCoverageAllActions:
    """Verify every CommandAction has a handler in the dispatch table."""

    def test_all_actions_have_handlers(self):
        from app.agent.command_parser import CommandAction
        from app.agent.query_router import _DISPATCH

        for action in CommandAction:
            assert action in _DISPATCH, f"No handler for {action.value}"

    def test_dispatch_table_size_matches_enum(self):
        from app.agent.command_parser import CommandAction
        from app.agent.query_router import _DISPATCH

        assert len(_DISPATCH) == len(CommandAction)


# ===================================================================
# 17. Error Response Structure
# ===================================================================
class TestErrorResponseStructure:
    """Verify error responses have correct field values."""

    def test_error_has_data_none(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=500, detail="Server error"),
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.data is None
        assert result.error is not None

    def test_success_has_error_none(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.error is None
        assert result.data is not None

    def test_error_from_data_dict_with_error_key(self):
        """If backend returns a dict with 'error' key, success is False."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"error": "Something went wrong"},
        ):
            result = _run(route_query("analyze AAPL"))

        assert result.success is False
        assert result.error == "Something went wrong"
        assert result.data is None

    def test_source_on_error(self):
        """Even on error, source reflects the handler prefix."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=500, detail="fail"),
        ):
            result = _run(route_query("analyze AAPL"))

        # Source is set from _safe_call which includes "error" in data dict
        assert result.source == "handler:analyze"


# ===================================================================
# 18. End-to-End NL Integration Flow
# ===================================================================
class TestNLIntegrationFlow:
    """Verify the full NL integration path: text -> route_query ->
    _handle_natural_language -> invoke_claude_code (mocked) -> QueryResult.
    """

    def test_e2e_success_flow(self):
        """Full success path: NL text -> god_agent -> structured QueryResult."""
        mock_god = _make_god_result(
            status="success",
            query="is TSLA a good stock",
            response_text="TSLA is declining due to margin compression.",
            structured_data={"sentiment": "bearish", "confidence": 0.85},
            execution_time_ms=200,
            agent_count=5,
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ) as mock_invoke:
            # "is" and "a" are stop words; TSLA is extracted as the ticker
            result = _run(route_query("is TSLA a good stock?"))

            # Verify invoke_claude_code was called with the right args
            args, kwargs = mock_invoke.call_args
            assert args[0] == "is TSLA a good stock?"
            assert kwargs["ticker"] == "TSLA"

        # Verify QueryResult structure
        assert result.query_type == "natural_language"
        assert result.action == "natural_language"
        assert result.success is True
        assert result.source == "god_agent"
        assert result.execution_time_ms == 200
        assert result.data["response_text"] == "TSLA is declining due to margin compression."
        assert result.data["structured_data"] == {"sentiment": "bearish", "confidence": 0.85}
        assert result.data["agent_count"] == 5
        assert result.data["ticker"] == "TSLA"
        assert result.error is None

    def test_e2e_error_flow(self):
        """Full error path: NL text -> god_agent error -> QueryResult with error."""
        mock_god = _make_god_result(
            status="error",
            query="some bad query",
            response_text="",
            error_message="Claude CLI not found",
            execution_time_ms=5,
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("some bad query"))

        assert result.query_type == "natural_language"
        assert result.action == "natural_language"
        assert result.success is False
        assert result.source == "god_agent"
        assert result.error == "Claude CLI not found"
        assert result.data is None
        assert result.execution_time_ms == 5

    def test_e2e_no_ticker_extracted(self):
        """NL text without a ticker passes ticker=None to invoke_claude_code."""
        mock_god = _make_god_result(status="success", response_text="Market overview.")
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ) as mock_invoke:
            # All words are either stop words or > 5 chars (no ticker match)
            result = _run(route_query("what about the overall situation?"))
            _, kwargs = mock_invoke.call_args
            assert kwargs["ticker"] is None

        assert result.success is True
        assert "ticker" not in result.data  # no ticker when none extracted

    def test_e2e_busy_status(self):
        """God Agent busy status maps to QueryResult error."""
        mock_god = _make_god_result(
            status="busy",
            error_message="Another query is already in progress",
        )
        with patch(
            "app.agent.god_agent_interface.invoke_claude_code",
            new_callable=AsyncMock,
            return_value=mock_god,
        ):
            result = _run(route_query("anything"))

        assert result.success is False
        assert "already in progress" in result.error.lower()
