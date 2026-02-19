"""Query router -- async dispatch layer for parsed commands.

Routes ``ParsedCommand`` objects to the appropriate backend handler and
returns structured ``QueryResult`` objects.  No HTTP endpoints -- this
module sits between the FastAPI route layer and the backend services.

Full implementation: TASK-GOD-005
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, ConfigDict, ValidationError

from app.agent.command_parser import CommandAction, ParsedCommand, parse_command

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------


class QueryResult(BaseModel):
    """Immutable structured result from query routing."""

    model_config = ConfigDict(frozen=True)

    query_type: str  # "command" or "natural_language"
    action: str
    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None
    execution_time_ms: int = 0
    source: str = "none"


# ---------------------------------------------------------------------------
# Safe call wrapper
# ---------------------------------------------------------------------------


async def _safe_call(
    action: str,
    action_desc: str,
    coro: Awaitable[dict[str, Any]],
) -> dict[str, Any]:
    """Await *coro* and catch all exceptions so the router never raises.

    Returns the handler result dict on success, or an error dict on failure.
    """
    try:
        from fastapi import HTTPException
    except ImportError:  # pragma: no cover
        HTTPException = None  # type: ignore[misc,assignment]

    try:
        return await coro
    except Exception as exc:
        # HTTPException from FastAPI handlers
        if HTTPException is not None and isinstance(exc, HTTPException):
            logger.warning(
                "Handler %s raised HTTPException %d: %s",
                action_desc, exc.status_code, exc.detail,
            )
            return {"error": exc.detail, "status_code": exc.status_code}

        # Pydantic validation errors
        if isinstance(exc, ValidationError):
            logger.warning(
                "Handler %s raised ValidationError: %s", action_desc, exc,
            )
            return {"error": f"Validation error: {exc}"}

        # Generic
        logger.exception("Handler %s failed unexpectedly", action_desc)
        return {"error": "Internal error processing request"}


# ---------------------------------------------------------------------------
# Handlers -- each receives a ParsedCommand, returns dict[str, Any]
# ---------------------------------------------------------------------------


async def _handle_analyze(cmd: ParsedCommand) -> dict[str, Any]:
    """Run full multi-methodology analysis for a symbol."""
    from app.api.routes.analysis import run_analysis

    return await run_analysis(cmd.symbol)


async def _handle_scan(cmd: ParsedCommand) -> dict[str, Any]:
    """Scan watchlist tickers with optional method/signal filters."""
    from app.api.routes.scan import _scan_impl

    return await _scan_impl(method=cmd.method, signal=cmd.signal)


async def _handle_watch_add(cmd: ParsedCommand) -> dict[str, Any]:
    """Add a symbol to the watchlist."""
    from app.api.routes.watchlist import add_to_watchlist, _AddTickerRequest

    return await add_to_watchlist(_AddTickerRequest(symbol=cmd.symbol))


async def _handle_watch_remove(cmd: ParsedCommand) -> dict[str, Any]:
    """Remove a symbol from the watchlist."""
    from app.api.routes.watchlist import remove_from_watchlist

    return await remove_from_watchlist(cmd.symbol)


async def _handle_watch_list(cmd: ParsedCommand) -> dict[str, Any]:
    """List all watchlist entries."""
    from app.api.routes.watchlist import get_watchlist

    return await get_watchlist()


async def _handle_news(cmd: ParsedCommand) -> dict[str, Any]:
    """Fetch news articles for a symbol."""
    from app.api.routes.news import get_news

    return await get_news(cmd.symbol)


async def _handle_macro(cmd: ParsedCommand) -> dict[str, Any]:
    """Fetch the macro economic calendar."""
    from app.api.routes.macro import get_calendar

    return await get_calendar()


async def _handle_fundamentals(cmd: ParsedCommand) -> dict[str, Any]:
    """Fetch fundamental financial data for a symbol."""
    from app.api.routes.fundamentals import get_fundamentals

    return await get_fundamentals(cmd.symbol)


async def _handle_insider(cmd: ParsedCommand) -> dict[str, Any]:
    """Fetch insider transactions for a symbol."""
    from app.api.routes.ownership import get_insider

    return await get_insider(cmd.symbol, days=cmd.days or 90)


async def _handle_compare(cmd: ParsedCommand) -> dict[str, Any]:
    """Run analysis on two symbols and return side-by-side results."""
    from app.api.routes.analysis import run_analysis

    result_1 = await run_analysis(cmd.symbols[0])
    result_2 = await run_analysis(cmd.symbols[1])
    return {"symbol_1": result_1, "symbol_2": result_2}


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_DISPATCH: dict[
    CommandAction,
    Callable[[ParsedCommand], Awaitable[dict[str, Any]]],
] = {
    CommandAction.ANALYZE: _handle_analyze,
    CommandAction.SCAN: _handle_scan,
    CommandAction.WATCH_ADD: _handle_watch_add,
    CommandAction.WATCH_REMOVE: _handle_watch_remove,
    CommandAction.WATCH_LIST: _handle_watch_list,
    CommandAction.NEWS: _handle_news,
    CommandAction.MACRO: _handle_macro,
    CommandAction.FUNDAMENTALS: _handle_fundamentals,
    CommandAction.INSIDER: _handle_insider,
    CommandAction.COMPARE: _handle_compare,
}


# ---------------------------------------------------------------------------
# Natural-language helpers
# ---------------------------------------------------------------------------

_NL_TICKER_RE: re.Pattern[str] = re.compile(r"\b([A-Z]{1,5})\b")

_NL_STOP_WORDS: frozenset[str] = frozenset({
    "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE",
    "IF", "IN", "IS", "IT", "ME", "MY", "NO", "OF", "ON", "OR", "SO",
    "TO", "UP", "US", "WE", "AI", "OK", "HI", "GDP", "PE", "EPS",
    "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN",
    "HER", "WAS", "ONE", "OUR", "OUT", "HOW", "HAS", "WHO", "DID",
    "GET", "HAS", "HIM", "HIS", "ITS", "LET", "MAY", "NEW", "NOW",
    "OLD", "SEE", "WAY", "DAY", "HAD", "HAS", "HOT", "OIL", "SIT",
    "TOP", "TWO", "WAR", "FAR", "RUN", "RED", "BIG", "RSI", "ATH",
    "YTD", "QOQ", "IPO", "ETF", "CEO", "CFO", "COO", "LLC", "SEC",
    "API", "URL", "USD", "EUR", "GBP", "JPY", "CAD",
    "WILL", "WITH", "HAVE", "THIS", "FROM", "THAT", "WHAT", "YOUR",
    "WHEN", "MAKE", "LIKE", "LONG", "LOOK", "MANY", "SOME", "THEM",
    "THAN", "EACH", "TELL", "DOES", "SHOW", "MUCH", "GOOD", "WELL",
    "ALSO", "JUST", "OVER", "SUCH", "TAKE", "BEEN", "COME", "FIND",
    "GIVE", "MORE", "MOST", "VERY", "SELL", "HIGH",
    "ABOUT", "WOULD", "THERE", "THEIR", "WHICH", "COULD", "OTHER",
    "THINK", "STOCK", "PRICE", "GOING", "SHOULD", "THESE",
})


def _extract_ticker_from_text(text: str) -> str | None:
    """Extract the most likely ticker symbol from free-form text.

    Scans for 1-5 uppercase letter tokens that are not common English stop
    words or finance abbreviations.  Returns the first plausible ticker, or
    ``None`` if nothing is found.  Pure function -- no I/O.
    """
    for m in _NL_TICKER_RE.finditer(text.upper()):
        candidate = m.group(1)
        if candidate not in _NL_STOP_WORDS and len(candidate) >= 2:
            return candidate
    return None


async def _handle_natural_language(text: str) -> QueryResult:
    """Route a natural-language query through the God Agent interface.

    Attempts to extract a ticker from the text for WebSocket context.
    Delegates to :func:`invoke_claude_code` and wraps the result as a
    ``QueryResult``.  Never raises.
    """
    ticker = _extract_ticker_from_text(text)

    from app.agent.god_agent_interface import invoke_claude_code

    god_result = await invoke_claude_code(text, ticker=ticker)

    success = god_result.status == "success"
    data: dict[str, Any] | None = None
    error: str | None = None

    if success:
        data = {
            "response_text": god_result.response_text,
            "structured_data": god_result.structured_data,
            "agent_count": god_result.agent_count,
        }
        if ticker is not None:
            data["ticker"] = ticker
    else:
        error = god_result.error_message or f"God Agent returned status: {god_result.status}"

    return QueryResult(
        query_type="natural_language",
        action="natural_language",
        success=success,
        data=data,
        error=error,
        execution_time_ms=god_result.execution_time_ms,
        source="natural_language",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def route_query(text: str) -> QueryResult:
    """Parse and dispatch a user query string.

    Returns a ``QueryResult`` -- never raises.

    * If the text matches a known command pattern, dispatches to the
      appropriate backend handler and measures execution time.
    * If no pattern matches, returns a natural-language fallback result.
    """
    t0 = time.monotonic()

    cmd = parse_command(text)

    # -- Natural language fallback (no pattern matched) ---------------------
    if cmd is None:
        return await _handle_natural_language(text)

    # -- Dispatch to handler -----------------------------------------------
    handler = _DISPATCH.get(cmd.action)
    if handler is None:
        elapsed = int((time.monotonic() - t0) * 1000)
        return QueryResult(
            query_type="command",
            action=cmd.action.value,
            success=False,
            error=f"No handler for action: {cmd.action.value}",
            execution_time_ms=elapsed,
            source="none",
        )

    data = await _safe_call(cmd.action.value, cmd.action.value, handler(cmd))
    elapsed = int((time.monotonic() - t0) * 1000)

    has_error = "error" in data
    return QueryResult(
        query_type="command",
        action=cmd.action.value,
        success=not has_error,
        data=data if not has_error else None,
        error=data.get("error") if has_error else None,
        execution_time_ms=elapsed,
        source=f"handler:{cmd.action.value}",
    )


__all__ = ["QueryResult", "route_query"]
