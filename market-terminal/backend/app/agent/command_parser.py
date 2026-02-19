"""Command parser -- pure-Python text-to-command translation.

Parses user input strings into structured ``ParsedCommand`` objects using
pattern matching.  No I/O, no async, no logging -- deterministic and
side-effect-free.

Full implementation: TASK-GOD-005
"""
from __future__ import annotations

import re
from enum import Enum
from typing import Callable

from pydantic import BaseModel, ConfigDict

from app.analysis.base import METHODOLOGY_NAMES


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class CommandAction(str, Enum):
    """Recognised command actions produced by the parser."""

    ANALYZE = "analyze"
    WATCH_ADD = "watch_add"
    WATCH_REMOVE = "watch_remove"
    WATCH_LIST = "watch_list"
    NEWS = "news"
    MACRO = "macro"
    SCAN = "scan"
    FUNDAMENTALS = "fundamentals"
    INSIDER = "insider"
    COMPARE = "compare"


# ---------------------------------------------------------------------------
# Parsed command model
# ---------------------------------------------------------------------------


class ParsedCommand(BaseModel):
    """Immutable structured representation of a recognised user command."""

    model_config = ConfigDict(frozen=True)

    action: CommandAction
    symbol: str | None = None
    symbols: tuple[str, ...] = ()
    method: str | None = None
    signal: str | None = None
    days: int | None = None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SYMBOL_RE: re.Pattern[str] = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")

_METHOD_ALIASES: dict[str, str] = {
    "w": "wyckoff",
    "wyckoff": "wyckoff",
    "ew": "elliott_wave",
    "elliott": "elliott_wave",
    "elliott_wave": "elliott_wave",
    "ict": "ict_smart_money",
    "smart_money": "ict_smart_money",
    "ict_smart_money": "ict_smart_money",
    "c": "canslim",
    "canslim": "canslim",
    "composite": "composite",
    "lw": "larry_williams",
    "williams": "larry_williams",
    "larry": "larry_williams",
    "larry_williams": "larry_williams",
    "s": "sentiment",
    "sentiment": "sentiment",
}

_VALID_SIGNALS: frozenset[str] = frozenset({"bullish", "bearish", "neutral"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_sym(raw: str) -> str | None:
    """Strip, uppercase, and validate a symbol string.

    Returns the cleaned symbol or ``None`` on failure.
    """
    cleaned = raw.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        return None
    return cleaned


def _resolve_method(raw: str | None) -> str | None:
    """Resolve a methodology name through aliases and validation.

    Returns the canonical method name or ``None`` if unrecognised.
    """
    if raw is None:
        return None
    lowered = raw.strip().lower()
    return _METHOD_ALIASES.get(lowered)


# ---------------------------------------------------------------------------
# Pattern extractors
# ---------------------------------------------------------------------------


def _ext_analyze(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.ANALYZE, symbol=sym)


def _ext_watch_add(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.WATCH_ADD, symbol=sym)


def _ext_watch_remove(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.WATCH_REMOVE, symbol=sym)


def _ext_watch_list(m: re.Match[str]) -> ParsedCommand | None:
    return ParsedCommand(action=CommandAction.WATCH_LIST)


def _ext_news(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.NEWS, symbol=sym)


def _ext_macro(m: re.Match[str]) -> ParsedCommand | None:
    return ParsedCommand(action=CommandAction.MACRO)


def _ext_scan(m: re.Match[str]) -> ParsedCommand | None:
    method = _resolve_method(m.group(1))
    raw_signal = m.group(2)
    signal = (
        raw_signal.lower()
        if raw_signal and raw_signal.lower() in _VALID_SIGNALS
        else None
    )
    return ParsedCommand(action=CommandAction.SCAN, method=method, signal=signal)


def _ext_fundamentals(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.FUNDAMENTALS, symbol=sym)


def _ext_insider_days(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(
        action=CommandAction.INSIDER, symbol=sym, days=int(m.group(2)),
    )


def _ext_insider(m: re.Match[str]) -> ParsedCommand | None:
    sym = _validate_sym(m.group(1))
    if sym is None:
        return None
    return ParsedCommand(action=CommandAction.INSIDER, symbol=sym)


def _ext_compare(m: re.Match[str]) -> ParsedCommand | None:
    sym1 = _validate_sym(m.group(1))
    sym2 = _validate_sym(m.group(2))
    if sym1 is None or sym2 is None:
        return None
    return ParsedCommand(action=CommandAction.COMPARE, symbols=(sym1, sym2))


# ---------------------------------------------------------------------------
# Command patterns (priority order -- first match wins)
# ---------------------------------------------------------------------------

_COMMAND_PATTERNS: list[
    tuple[re.Pattern[str], Callable[[re.Match[str]], ParsedCommand | None]]
] = [
    (re.compile(r"^(?:analyze|a)\s+(\S+)$", re.IGNORECASE), _ext_analyze),
    (re.compile(r"^(?:watch\s+add|wa)\s+(\S+)$", re.IGNORECASE), _ext_watch_add),
    (re.compile(r"^(?:watch\s+remove|wr)\s+(\S+)$", re.IGNORECASE), _ext_watch_remove),
    (re.compile(r"^(?:watch\s+list|wl)$", re.IGNORECASE), _ext_watch_list),
    (re.compile(r"^(?:news|n)\s+(\S+)$", re.IGNORECASE), _ext_news),
    (re.compile(r"^(?:macro|m)$", re.IGNORECASE), _ext_macro),
    (re.compile(r"^scan(?:\s+(\S+))?(?:\s+(bullish|bearish|neutral))?$", re.IGNORECASE), _ext_scan),
    (re.compile(r"^(?:fundamentals|f)\s+(\S+)$", re.IGNORECASE), _ext_fundamentals),
    (re.compile(r"^insider\s+(\S+)\s+(\d+)d?$", re.IGNORECASE), _ext_insider_days),
    (re.compile(r"^insider\s+(\S+)$", re.IGNORECASE), _ext_insider),
    (re.compile(r"^compare\s+(\S+)\s+(\S+)$", re.IGNORECASE), _ext_compare),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_command(text: str) -> ParsedCommand | None:
    """Parse a raw user input string into a structured command.

    Returns a ``ParsedCommand`` on successful match, or ``None`` if the
    input does not match any known command pattern.  Never raises.
    """
    stripped = text.strip()
    if not stripped:
        return None

    for pattern, extractor in _COMMAND_PATTERNS:
        match = pattern.match(stripped)
        if match is not None:
            result = extractor(match)
            if result is not None:
                return result

    return None


__all__ = ["CommandAction", "ParsedCommand", "parse_command"]
