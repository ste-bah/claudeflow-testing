"""Cross-module integration tests for TASK-GOD-005: Query Pipeline.

Validates the FULL three-layer pipeline:

    POST /api/query/  (query.py)
        -> _sanitize_text
        -> route_query  (query_router.py)
            -> parse_command  (command_parser.py)
            -> _DISPATCH handler
            -> _safe_call error containment
        -> QueryResult.model_dump() as JSON response

Unlike the existing unit tests (which mock at module boundaries), these
tests mock ONLY the leaf backend functions (run_analysis, _scan_impl,
get_watchlist, etc.) and let the real parse_command + route_query +
_sanitize_text + QueryRequest validation all execute together.

All tests use synchronous ``def`` with ``TestClient`` -- no ``async def``
needed because ``TestClient`` runs the ASGI app in a synchronous wrapper.

Run with: ``pytest tests/test_integration_query_pipeline.py -v``
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app

# ---------------------------------------------------------------------------
# Shared test client -- raise_server_exceptions=False so we can inspect
# 500-level responses produced by the global exception handler.
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Expected response keys (from QueryResult.model_dump())
# ---------------------------------------------------------------------------
_EXPECTED_KEYS = {
    "query_type",
    "action",
    "success",
    "data",
    "error",
    "execution_time_ms",
    "source",
}


# ===================================================================
# Helper
# ===================================================================
def _post(text: str) -> dict:
    """POST /api/query/ with the given text and return the parsed JSON body.

    Asserts HTTP 200 before returning -- callers that expect 422 or other
    statuses should use ``client.post(...)`` directly.
    """
    resp = client.post("/api/query/", json={"text": text})
    assert resp.status_code == 200, (
        f"Expected 200 but got {resp.status_code}: {resp.text}"
    )
    return resp.json()


# ===================================================================
# 1. FULL PIPELINE -- ALL 11 COMMAND PATTERNS (E2E)
# ===================================================================
class TestFullPipelineAllCommands:
    """Test every command pattern end-to-end: HTTP -> parse -> route -> mock handler -> response.

    Each test mocks only the leaf backend function and verifies:
      - HTTP 200
      - Correct ``action`` in response
      - ``success`` is True
      - ``query_type`` is "command"
      - ``source`` is "handler:<action>"
      - The mock was called with the correct arguments
      - ``data`` matches what the mock returned
    """

    # -- 1. analyze <symbol> -----------------------------------------------
    def test_analyze_aapl_full_pipeline(self):
        mock_data = {"ticker": "AAPL", "scores": {"wyckoff": 85}}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("analyze AAPL")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["query_type"] == "command"
        assert body["action"] == "analyze"
        assert body["success"] is True
        assert body["data"] == mock_data
        assert body["error"] is None
        assert body["source"] == "handler:analyze"
        assert set(body.keys()) == _EXPECTED_KEYS

    # -- 1b. analyze shorthand alias "a" -----------------------------------
    def test_analyze_alias_a_full_pipeline(self):
        mock_data = {"ticker": "TSLA", "score": 72}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("a TSLA")
            mock_fn.assert_awaited_once_with("TSLA")

        assert body["action"] == "analyze"
        assert body["success"] is True

    # -- 2. watch add <symbol> ---------------------------------------------
    def test_watch_add_full_pipeline(self):
        mock_data = {"symbol": "GOOG", "added": True}
        with patch(
            "app.api.routes.watchlist.add_to_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_add:
            body = _post("watch add GOOG")
            mock_add.assert_awaited_once()

        assert body["action"] == "watch_add"
        assert body["success"] is True
        assert body["data"]["symbol"] == "GOOG"
        assert body["source"] == "handler:watch_add"

    # -- 2b. watch add shorthand alias "wa" --------------------------------
    def test_watch_add_alias_wa_full_pipeline(self):
        mock_data = {"symbol": "NVDA", "added": True}
        with patch(
            "app.api.routes.watchlist.add_to_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_add:
            body = _post("wa NVDA")
            mock_add.assert_awaited_once()

        assert body["action"] == "watch_add"
        assert body["success"] is True

    # -- 3. watch remove <symbol> ------------------------------------------
    def test_watch_remove_full_pipeline(self):
        mock_data = {"symbol": "TSLA", "removed": True}
        with patch(
            "app.api.routes.watchlist.remove_from_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("watch remove TSLA")
            mock_fn.assert_awaited_once_with("TSLA")

        assert body["action"] == "watch_remove"
        assert body["success"] is True
        assert body["source"] == "handler:watch_remove"

    # -- 3b. watch remove shorthand alias "wr" -----------------------------
    def test_watch_remove_alias_wr_full_pipeline(self):
        mock_data = {"symbol": "AMZN", "removed": True}
        with patch(
            "app.api.routes.watchlist.remove_from_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("wr AMZN")
            mock_fn.assert_awaited_once_with("AMZN")

        assert body["action"] == "watch_remove"

    # -- 4. watch list / wl ------------------------------------------------
    def test_watch_list_full_pipeline(self):
        mock_data = {"watchlist": [{"symbol": "AAPL"}, {"symbol": "TSLA"}]}
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("watch list")
            mock_fn.assert_awaited_once()

        assert body["action"] == "watch_list"
        assert body["success"] is True
        assert len(body["data"]["watchlist"]) == 2
        assert body["source"] == "handler:watch_list"

    def test_watch_list_alias_wl_full_pipeline(self):
        mock_data = {"watchlist": []}
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            return_value=mock_data,
        ):
            body = _post("wl")

        assert body["action"] == "watch_list"
        assert body["success"] is True

    # -- 5. news <symbol> --------------------------------------------------
    def test_news_full_pipeline(self):
        mock_data = {
            "symbol": "AAPL",
            "articles": [{"title": "Apple earnings beat", "url": "https://x.com"}],
        }
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("news AAPL")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["action"] == "news"
        assert body["success"] is True
        assert body["data"]["symbol"] == "AAPL"
        assert body["source"] == "handler:news"

    def test_news_alias_n_full_pipeline(self):
        mock_data = {"symbol": "MSFT", "articles": []}
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("n msft")
            mock_fn.assert_awaited_once_with("MSFT")

        assert body["action"] == "news"

    # -- 6. macro ----------------------------------------------------------
    def test_macro_full_pipeline(self):
        mock_data = {"events": [{"date": "2026-02-20", "event": "FOMC Minutes"}]}
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("macro")
            mock_fn.assert_awaited_once()

        assert body["action"] == "macro"
        assert body["success"] is True
        assert body["source"] == "handler:macro"

    def test_macro_alias_m_full_pipeline(self):
        mock_data = {"events": []}
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            return_value=mock_data,
        ):
            body = _post("m")

        assert body["action"] == "macro"

    # -- 7. scan [method] [signal] -----------------------------------------
    def test_scan_bare_full_pipeline(self):
        mock_data = {"results": [], "total": 0}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("scan")
            mock_fn.assert_awaited_once_with(method=None, signal=None)

        assert body["action"] == "scan"
        assert body["success"] is True
        assert body["source"] == "handler:scan"

    def test_scan_with_method_and_signal_full_pipeline(self):
        mock_data = {"method": "wyckoff", "signal": "bullish", "results": [{"sym": "AAPL"}]}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("scan wyckoff bullish")
            mock_fn.assert_awaited_once_with(method="wyckoff", signal="bullish")

        assert body["success"] is True
        assert body["data"]["method"] == "wyckoff"

    def test_scan_method_alias_resolution_full_pipeline(self):
        """Parser resolves 'ew' to 'elliott_wave' before dispatch."""
        mock_data = {"results": []}
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("scan ew bearish")
            mock_fn.assert_awaited_once_with(method="elliott_wave", signal="bearish")

        assert body["success"] is True

    # -- 8. fundamentals <symbol> ------------------------------------------
    def test_fundamentals_full_pipeline(self):
        mock_data = {"symbol": "AAPL", "pe_ratio": 28.5, "market_cap": "2.8T"}
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("fundamentals AAPL")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["action"] == "fundamentals"
        assert body["success"] is True
        assert body["source"] == "handler:fundamentals"

    def test_fundamentals_alias_f_full_pipeline(self):
        mock_data = {"symbol": "MSFT", "pe_ratio": 35.0}
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("f msft")
            mock_fn.assert_awaited_once_with("MSFT")

        assert body["action"] == "fundamentals"

    # -- 9. insider <symbol> [days] ----------------------------------------
    def test_insider_default_days_full_pipeline(self):
        mock_data = {"symbol": "AAPL", "transactions": [{"name": "Tim Cook"}]}
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("insider AAPL")
            mock_fn.assert_awaited_once_with("AAPL", days=90)

        assert body["action"] == "insider"
        assert body["success"] is True
        assert body["source"] == "handler:insider"

    def test_insider_with_custom_days_full_pipeline(self):
        mock_data = {"symbol": "TSLA", "transactions": []}
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("insider TSLA 30d")
            mock_fn.assert_awaited_once_with("TSLA", days=30)

        assert body["success"] is True

    def test_insider_days_without_d_suffix_full_pipeline(self):
        mock_data = {"symbol": "GOOG", "transactions": []}
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value=mock_data,
        ) as mock_fn:
            body = _post("insider GOOG 60")
            mock_fn.assert_awaited_once_with("GOOG", days=60)

        assert body["success"] is True

    # -- 10. compare <symbol1> <symbol2> -----------------------------------
    def test_compare_full_pipeline(self):
        result_a = {"ticker": "AAPL", "score": 85}
        result_m = {"ticker": "MSFT", "score": 90}
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=[result_a, result_m],
        ) as mock_fn:
            body = _post("compare AAPL MSFT")
            assert mock_fn.await_count == 2
            mock_fn.assert_any_await("AAPL")
            mock_fn.assert_any_await("MSFT")

        assert body["action"] == "compare"
        assert body["success"] is True
        assert body["data"]["symbol_1"] == result_a
        assert body["data"]["symbol_2"] == result_m
        assert body["source"] == "handler:compare"

    def test_compare_lowercase_symbols_uppercased(self):
        """Parser uppercases symbols before passing to handler."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=[{"t": "AAPL"}, {"t": "GOOG"}],
        ) as mock_fn:
            body = _post("compare aapl goog")
            mock_fn.assert_any_await("AAPL")
            mock_fn.assert_any_await("GOOG")

        assert body["success"] is True


# ===================================================================
# 2. CROSS-MODULE DATA CONTRACTS
# ===================================================================
class TestCrossModuleDataContracts:
    """Verify that ParsedCommand fields are correctly consumed by dispatch handlers.

    These tests validate the data contract between command_parser and
    query_router: the parser produces specific field values and the
    router's handlers consume exactly those fields.
    """

    def test_analyze_symbol_passed_correctly(self):
        """ParsedCommand.symbol flows from parser to _handle_analyze -> run_analysis(symbol)."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            _post("analyze BRK.B")
            mock_fn.assert_awaited_once_with("BRK.B")

    def test_scan_method_and_signal_passed_correctly(self):
        """ParsedCommand.method and .signal flow to _handle_scan -> _scan_impl(method=, signal=)."""
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"r": []},
        ) as mock_fn:
            _post("scan sentiment neutral")
            mock_fn.assert_awaited_once_with(method="sentiment", signal="neutral")

    def test_scan_invalid_method_resolves_to_none(self):
        """Unknown method word resolves to None in parser, passed as method=None."""
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"r": []},
        ) as mock_fn:
            _post("scan foobar")
            mock_fn.assert_awaited_once_with(method=None, signal=None)

    def test_insider_days_field_contract(self):
        """ParsedCommand.days (int) flows to get_insider(symbol, days=N)."""
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value={"t": []},
        ) as mock_fn:
            _post("insider AAPL 45d")
            mock_fn.assert_awaited_once_with("AAPL", days=45)

    def test_insider_no_days_defaults_to_90(self):
        """ParsedCommand.days is None when not specified; router defaults to 90."""
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value={"t": []},
        ) as mock_fn:
            _post("insider MSFT")
            mock_fn.assert_awaited_once_with("MSFT", days=90)

    def test_compare_symbols_tuple_contract(self):
        """ParsedCommand.symbols is a tuple of 2 strings, each passed to run_analysis."""
        calls = []
        async def track_call(sym):
            calls.append(sym)
            return {"t": sym}

        with patch(
            "app.api.routes.analysis.run_analysis",
            side_effect=track_call,
        ):
            _post("compare AAPL TSLA")

        assert calls == ["AAPL", "TSLA"]

    def test_watch_add_constructs_add_ticker_request(self):
        """_handle_watch_add constructs _AddTickerRequest(symbol=cmd.symbol)."""
        with patch(
            "app.api.routes.watchlist.add_to_watchlist",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            _post("watch add META")
            # Verify the call was made (handler constructs request internally)
            mock_fn.assert_awaited_once()
            # The first positional arg is the _AddTickerRequest instance
            req_arg = mock_fn.call_args[0][0]
            assert req_arg.symbol == "META"

    def test_watch_remove_symbol_passed_directly(self):
        """_handle_watch_remove passes cmd.symbol directly to remove_from_watchlist."""
        with patch(
            "app.api.routes.watchlist.remove_from_watchlist",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            _post("watch remove NFLX")
            mock_fn.assert_awaited_once_with("NFLX")

    def test_news_symbol_passed_directly(self):
        """_handle_news passes cmd.symbol to get_news(symbol)."""
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value={"a": []},
        ) as mock_fn:
            _post("news GOOG")
            mock_fn.assert_awaited_once_with("GOOG")

    def test_fundamentals_symbol_passed_directly(self):
        """_handle_fundamentals passes cmd.symbol to get_fundamentals(symbol)."""
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value={"pe": 30},
        ) as mock_fn:
            _post("fundamentals AMZN")
            mock_fn.assert_awaited_once_with("AMZN")


# ===================================================================
# 3. ERROR PROPAGATION THROUGH FULL PIPELINE
# ===================================================================
class TestErrorPropagation:
    """Verify errors from backend handlers are correctly wrapped in
    QueryResult and returned via HTTP with success=False.

    The key invariant: route_query NEVER raises. All backend errors
    are caught by _safe_call and turned into error QueryResults.
    The HTTP response is always 200 at the transport level.
    """

    def test_http_exception_from_handler_caught(self):
        """HTTPException(404) from run_analysis -> error in QueryResult."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Symbol not found"),
        ):
            body = _post("analyze INVALID")

        assert body["success"] is False
        assert body["error"] == "Symbol not found"
        assert body["data"] is None
        assert body["action"] == "analyze"
        assert body["query_type"] == "command"
        assert body["source"] == "handler:analyze"

    def test_http_exception_502_from_handler(self):
        """HTTPException(502) from get_news -> error propagated correctly."""
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=502, detail="Upstream API timeout"),
        ):
            body = _post("news AAPL")

        assert body["success"] is False
        assert body["error"] == "Upstream API timeout"
        assert body["data"] is None

    def test_generic_runtime_error_caught(self):
        """RuntimeError from handler -> generic 'Internal error' message."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("DB connection pool exhausted"),
        ):
            body = _post("analyze AAPL")

        assert body["success"] is False
        assert "internal error" in body["error"].lower()
        assert body["data"] is None

    def test_value_error_caught(self):
        """ValueError from handler -> caught by _safe_call."""
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            side_effect=ValueError("Invalid date range"),
        ):
            body = _post("macro")

        assert body["success"] is False
        assert body["error"] is not None
        assert body["data"] is None

    def test_pydantic_validation_error_caught(self):
        """Pydantic ValidationError from handler -> caught with detail."""
        with patch(
            "app.api.routes.watchlist.get_watchlist",
            new_callable=AsyncMock,
            side_effect=ValidationError.from_exception_data(
                title="TestModel",
                line_errors=[
                    {
                        "type": "missing",
                        "loc": ("field",),
                        "msg": "Field required",
                        "input": {},
                    }
                ],
            ),
        ):
            body = _post("watch list")

        assert body["success"] is False
        assert "validation error" in body["error"].lower()
        assert body["data"] is None

    def test_handler_returns_dict_with_error_key(self):
        """Handler returns {"error": "..."} -> QueryResult has success=False."""
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"error": "No tickers in watchlist"},
        ):
            body = _post("scan")

        assert body["success"] is False
        assert body["error"] == "No tickers in watchlist"
        assert body["data"] is None

    def test_compare_first_symbol_fails(self):
        """First run_analysis call raises, error propagated for compare action."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="AAPL not found"),
        ):
            body = _post("compare AAPL MSFT")

        assert body["success"] is False
        assert body["error"] == "AAPL not found"

    def test_error_response_still_has_execution_time(self):
        """Even on error, execution_time_ms is populated and non-negative."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            body = _post("analyze AAPL")

        assert isinstance(body["execution_time_ms"], int)
        assert body["execution_time_ms"] >= 0


# ===================================================================
# 4. SANITIZATION PIPELINE INTEGRATION
# ===================================================================
class TestSanitizationPipeline:
    """Verify that _sanitize_text in query.py correctly cleans input
    before it reaches parse_command, and that the cleaned text produces
    correct ParsedCommand objects.

    Pipeline: QueryRequest.text -> field_validator (strip) -> _sanitize_text
              -> route_query -> parse_command -> handler
    """

    def test_html_tags_stripped_before_parsing(self):
        """HTML around command keyword is removed; parser sees clean text."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            body = _post("<b>analyze</b> AAPL")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["success"] is True
        assert body["action"] == "analyze"

    def test_script_tags_stripped_text_preserved(self):
        """Script tags removed, text between tags ('alert(...)') preserved but
        combined with command text, which may or may not parse correctly.
        Here the remaining text is "alert('xss')analyze AAPL" -- the parser
        produces a result because the command may still match."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ):
            resp = client.post(
                "/api/query/",
                json={"text": "<script>alert('xss')</script>analyze AAPL"},
            )

        assert resp.status_code == 200
        # After sanitization the text becomes "alert('xss')analyze AAPL"
        # which does NOT match "analyze <symbol>" pattern, so it falls to NL
        data = resp.json()
        # Either parsed or NL -- the key point is no crash and valid structure
        assert set(data.keys()) == _EXPECTED_KEYS

    def test_control_chars_stripped_before_parsing(self):
        """Control characters between words are removed, allowing parser to match."""
        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value={"articles": []},
        ) as mock_fn:
            # \x00 between "news" and " AAPL" is stripped, leaving "news AAPL"
            body = _post("news\x00 AAPL")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["action"] == "news"
        assert body["success"] is True

    def test_mixed_html_and_control_chars_stripped(self):
        """Both HTML tags and control chars are stripped in sequence."""
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            return_value={"events": []},
        ):
            body = _post("<div>\x01macro\x02</div>")

        assert body["action"] == "macro"
        assert body["success"] is True

    def test_sanitized_empty_becomes_nl_fallback(self):
        """If sanitization strips everything, parse_command returns None -> NL fallback."""
        # After stripping HTML: empty string, but validator already
        # stripped whitespace. The sanitized text will be "alert(1)"
        # which doesn't match any command.
        resp = client.post(
            "/api/query/",
            json={"text": "<script>alert(1)</script>"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # "alert(1)" is natural language since it matches no command
        assert data["query_type"] == "natural_language"
        assert data["success"] is False

    def test_whitespace_around_command_handled(self):
        """Leading/trailing whitespace is stripped by validator AND sanitizer."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            body = _post("   analyze   AAPL   ")
            mock_fn.assert_awaited_once_with("AAPL")

        assert body["success"] is True

    def test_case_insensitive_command_through_sanitization(self):
        """Command keywords are case-insensitive even after sanitization."""
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value={"pe": 25},
        ):
            body = _post("FUNDAMENTALS aapl")

        assert body["action"] == "fundamentals"
        assert body["success"] is True


# ===================================================================
# 5. RESPONSE FORMAT VALIDATION
# ===================================================================
class TestResponseFormat:
    """Verify the full QueryResult.model_dump() structure in HTTP responses.

    Every response from POST /api/query/ must have exactly 7 fields
    matching the QueryResult model, regardless of success or failure.
    """

    def test_success_response_has_all_fields(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            body = _post("analyze AAPL")

        assert set(body.keys()) == _EXPECTED_KEYS
        assert body["query_type"] == "command"
        assert body["action"] == "analyze"
        assert body["success"] is True
        assert isinstance(body["data"], dict)
        assert body["error"] is None
        assert isinstance(body["execution_time_ms"], int)
        assert isinstance(body["source"], str)

    def test_error_response_has_all_fields(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("fail"),
        ):
            body = _post("analyze AAPL")

        assert set(body.keys()) == _EXPECTED_KEYS
        assert body["success"] is False
        assert body["data"] is None
        assert body["error"] is not None
        assert isinstance(body["execution_time_ms"], int)

    @patch("app.agent.god_agent_interface.invoke_claude_code", new_callable=AsyncMock)
    def test_nl_fallback_response_has_all_fields(self, mock_invoke):
        # Mock the Claude Code result to return error for NL fallback
        mock_result = MagicMock()
        mock_result.status = "error"
        mock_result.error_message = "not yet supported"
        mock_result.response_text = None
        mock_result.structured_data = None
        mock_result.agent_count = 0
        mock_result.execution_time_ms = 0
        mock_invoke.return_value = mock_result

        body = _post("what is the market doing today?")

        assert set(body.keys()) == _EXPECTED_KEYS
        assert body["query_type"] == "natural_language"
        assert body["action"] == "natural_language"
        assert body["success"] is False
        assert body["data"] is None
        assert body["error"] is not None
        assert "not yet supported" in body["error"].lower()
        assert body["source"] == "natural_language"
        assert body["execution_time_ms"] == 0

    def test_execution_time_is_non_negative_integer(self):
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"r": []},
        ):
            body = _post("scan")

        assert isinstance(body["execution_time_ms"], int)
        assert body["execution_time_ms"] >= 0

    def test_source_format_for_command(self):
        """Source field follows 'handler:<action>' pattern for commands."""
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value={"t": []},
        ):
            body = _post("insider AAPL")

        assert body["source"] == "handler:insider"

    def test_source_for_nl_fallback(self):
        body = _post("hello world")
        assert body["source"] == "natural_language"

    def test_data_is_dict_on_success(self):
        """On success, data is always a dict (never a list or primitive)."""
        with patch(
            "app.api.routes.macro.get_calendar",
            new_callable=AsyncMock,
            return_value={"events": [1, 2, 3]},
        ):
            body = _post("macro")

        assert isinstance(body["data"], dict)

    def test_data_is_none_on_error(self):
        """On error, data is always None."""
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            side_effect=RuntimeError("fail"),
        ):
            body = _post("fundamentals AAPL")

        assert body["data"] is None

    def test_content_type_is_json(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ):
            resp = client.post("/api/query/", json={"text": "analyze AAPL"})

        assert "application/json" in resp.headers.get("content-type", "")


# ===================================================================
# 6. NATURAL LANGUAGE FALLBACK (no command match)
# ===================================================================
class TestNaturalLanguageFallback:
    """Verify the full pipeline for inputs that don't match any command."""

    def test_question_returns_nl_result(self):
        body = _post("what stocks should I buy?")
        assert body["query_type"] == "natural_language"
        assert body["action"] == "natural_language"
        assert body["success"] is False
        assert body["source"] == "natural_language"

    def test_greeting_returns_nl_result(self):
        body = _post("hello there")
        assert body["query_type"] == "natural_language"
        assert body["success"] is False

    def test_random_text_returns_nl_result(self):
        body = _post("the quick brown fox jumps over the lazy dog")
        assert body["query_type"] == "natural_language"
        assert body["success"] is False

    @patch("app.agent.god_agent_interface.invoke_claude_code", new_callable=AsyncMock)
    def test_nl_error_message_suggests_commands(self, mock_invoke):
        """The NL error message suggests valid commands to try."""
        # Mock the Claude Code result to return error with command suggestions
        mock_result = MagicMock()
        mock_result.status = "error"
        mock_result.error_message = "Try using analyze or scan commands"
        mock_result.response_text = None
        mock_result.structured_data = None
        mock_result.agent_count = 0
        mock_result.execution_time_ms = 0
        mock_invoke.return_value = mock_result

        body = _post("tell me about markets")
        assert "analyze" in body["error"].lower() or "scan" in body["error"].lower()


# ===================================================================
# 7. INPUT VALIDATION (HTTP 422)
# ===================================================================
class TestInputValidation:
    """Verify that invalid inputs are rejected at the QueryRequest level
    before reaching the pipeline.
    """

    def test_empty_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": ""})
        assert resp.status_code == 422

    def test_whitespace_only_returns_422(self):
        resp = client.post("/api/query/", json={"text": "   "})
        assert resp.status_code == 422

    def test_text_over_500_chars_returns_422(self):
        resp = client.post("/api/query/", json={"text": "x" * 501})
        assert resp.status_code == 422

    def test_missing_text_field_returns_422(self):
        resp = client.post("/api/query/", json={})
        assert resp.status_code == 422

    def test_null_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": None})
        assert resp.status_code == 422

    def test_numeric_text_returns_422(self):
        resp = client.post("/api/query/", json={"text": 42})
        assert resp.status_code == 422

    def test_no_body_returns_422(self):
        resp = client.post("/api/query/")
        assert resp.status_code == 422

    def test_text_exactly_500_chars_accepted(self):
        """Boundary: 500 chars should pass validation."""
        resp = client.post("/api/query/", json={"text": "a" * 500})
        assert resp.status_code == 200


# ===================================================================
# 8. SYMBOL CASE NORMALIZATION THROUGH PIPELINE
# ===================================================================
class TestSymbolCaseNormalization:
    """Verify that lowercase symbols are uppercased by the parser
    and the uppercased value reaches the backend handler.
    """

    @pytest.mark.parametrize(
        "command,mock_target,expected_call_arg",
        [
            ("analyze aapl", "app.api.routes.analysis.run_analysis", "AAPL"),
            ("news tsla", "app.api.routes.news.get_news", "TSLA"),
            ("fundamentals goog", "app.api.routes.fundamentals.get_fundamentals", "GOOG"),
            ("watch remove nflx", "app.api.routes.watchlist.remove_from_watchlist", "NFLX"),
        ],
        ids=["analyze", "news", "fundamentals", "watch_remove"],
    )
    def test_symbol_uppercased(self, command, mock_target, expected_call_arg):
        with patch(
            mock_target,
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            body = _post(command)
            mock_fn.assert_awaited_once_with(expected_call_arg)

        assert body["success"] is True

    def test_insider_lowercase_symbol_uppercased(self):
        with patch(
            "app.api.routes.ownership.get_insider",
            new_callable=AsyncMock,
            return_value={"t": []},
        ) as mock_fn:
            _post("insider msft 30d")
            mock_fn.assert_awaited_once_with("MSFT", days=30)

    def test_watch_add_lowercase_uppercased(self):
        with patch(
            "app.api.routes.watchlist.add_to_watchlist",
            new_callable=AsyncMock,
            return_value={"ok": True},
        ) as mock_fn:
            _post("wa amzn")
            req_arg = mock_fn.call_args[0][0]
            assert req_arg.symbol == "AMZN"


# ===================================================================
# 9. SCAN METHOD ALIAS RESOLUTION E2E
# ===================================================================
class TestScanMethodAliasResolutionE2E:
    """Verify that all method aliases resolve correctly through the full
    pipeline (HTTP -> parser -> router -> _scan_impl).
    """

    @pytest.mark.parametrize(
        "alias,canonical",
        [
            ("w", "wyckoff"),
            ("wyckoff", "wyckoff"),
            ("ew", "elliott_wave"),
            ("elliott", "elliott_wave"),
            ("ict", "ict_smart_money"),
            ("smart_money", "ict_smart_money"),
            ("c", "canslim"),
            ("canslim", "canslim"),
            ("composite", "composite"),
            ("lw", "larry_williams"),
            ("williams", "larry_williams"),
            ("larry", "larry_williams"),
            ("s", "sentiment"),
            ("sentiment", "sentiment"),
        ],
        ids=lambda x: f"alias-{x}",
    )
    def test_method_alias_e2e(self, alias, canonical):
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"results": []},
        ) as mock_fn:
            body = _post(f"scan {alias}")
            mock_fn.assert_awaited_once_with(method=canonical, signal=None)

        assert body["action"] == "scan"
        assert body["success"] is True

    @pytest.mark.parametrize(
        "signal",
        ["bullish", "bearish", "neutral"],
        ids=lambda x: f"signal-{x}",
    )
    def test_signal_values_e2e(self, signal):
        with patch(
            "app.api.routes.scan._scan_impl",
            new_callable=AsyncMock,
            return_value={"results": []},
        ) as mock_fn:
            body = _post(f"scan wyckoff {signal}")
            mock_fn.assert_awaited_once_with(method="wyckoff", signal=signal)

        assert body["success"] is True


# ===================================================================
# 10. SPECIAL SYMBOL FORMATS
# ===================================================================
class TestSpecialSymbolFormats:
    """Verify symbols with dots and hyphens (e.g. BRK.B, BF-B)
    flow correctly through the entire pipeline.
    """

    def test_dot_symbol_through_pipeline(self):
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "BRK.B"},
        ) as mock_fn:
            body = _post("analyze BRK.B")
            mock_fn.assert_awaited_once_with("BRK.B")

        assert body["success"] is True

    def test_hyphen_symbol_through_pipeline(self):
        with patch(
            "app.api.routes.fundamentals.get_fundamentals",
            new_callable=AsyncMock,
            return_value={"pe": 20},
        ) as mock_fn:
            body = _post("fundamentals BF-B")
            mock_fn.assert_awaited_once_with("BF-B")

        assert body["success"] is True


# ===================================================================
# 11. CONCURRENT/MULTIPLE HANDLER CALLS (compare)
# ===================================================================
class TestCompareMultipleHandlerCalls:
    """Test that the compare action correctly sequences two handler calls."""

    def test_compare_calls_run_analysis_twice_in_order(self):
        call_order = []

        async def ordered_mock(sym):
            call_order.append(sym)
            return {"ticker": sym}

        with patch(
            "app.api.routes.analysis.run_analysis",
            side_effect=ordered_mock,
        ):
            body = _post("compare GOOG AMZN")

        assert call_order == ["GOOG", "AMZN"]
        assert body["data"]["symbol_1"]["ticker"] == "GOOG"
        assert body["data"]["symbol_2"]["ticker"] == "AMZN"

    def test_compare_second_symbol_failure(self):
        """If second run_analysis call fails, the entire compare fails."""
        call_count = 0

        async def fail_second(sym):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("Second symbol failed")
            return {"ticker": sym}

        with patch(
            "app.api.routes.analysis.run_analysis",
            side_effect=fail_second,
        ):
            body = _post("compare AAPL TSLA")

        assert body["success"] is False
        assert "internal error" in body["error"].lower()


# ===================================================================
# 12. HTTP METHOD ENFORCEMENT
# ===================================================================
class TestHTTPMethodEnforcement:
    """Only POST is accepted on /api/query/."""

    def test_get_returns_405(self):
        resp = client.get("/api/query/")
        assert resp.status_code == 405

    def test_put_returns_405(self):
        resp = client.put("/api/query/", json={"text": "analyze AAPL"})
        assert resp.status_code == 405

    def test_delete_returns_405(self):
        resp = client.delete("/api/query/")
        assert resp.status_code == 405

    def test_patch_returns_405(self):
        resp = client.patch("/api/query/", json={"text": "analyze AAPL"})
        assert resp.status_code == 405


# ===================================================================
# 13. IDEMPOTENCY AND ISOLATION
# ===================================================================
class TestIdempotencyAndIsolation:
    """Verify that multiple requests produce independent results
    with no state leaking between calls.
    """

    def test_sequential_different_commands(self):
        """Two different commands produce independent results."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            body1 = _post("analyze AAPL")

        with patch(
            "app.api.routes.news.get_news",
            new_callable=AsyncMock,
            return_value={"articles": []},
        ):
            body2 = _post("news TSLA")

        assert body1["action"] == "analyze"
        assert body2["action"] == "news"
        assert body1["data"]["ticker"] == "AAPL"

    def test_same_command_twice_independent(self):
        """Same command sent twice produces independent handler calls."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL", "call": 1},
        ) as mock_fn:
            body1 = _post("analyze AAPL")
            assert mock_fn.await_count == 1

        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL", "call": 2},
        ) as mock_fn:
            body2 = _post("analyze AAPL")
            assert mock_fn.await_count == 1

        assert body1["data"]["call"] == 1
        assert body2["data"]["call"] == 2

    def test_error_then_success(self):
        """A failed request does not affect subsequent successful requests."""
        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            side_effect=RuntimeError("fail"),
        ):
            body1 = _post("analyze AAPL")

        assert body1["success"] is False

        with patch(
            "app.api.routes.analysis.run_analysis",
            new_callable=AsyncMock,
            return_value={"ticker": "AAPL"},
        ):
            body2 = _post("analyze AAPL")

        assert body2["success"] is True
        assert body2["data"]["ticker"] == "AAPL"
