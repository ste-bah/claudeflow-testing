"""Cache layer types and constants for Market Terminal.

Defines the :class:`CachedResult` dataclass returned by all
:class:`~app.data.cache.CacheManager` methods, TTL-related constants,
fallback-chain mappings, and the :func:`format_age` utility.

Part of: TASK-DATA-008
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# ---------------------------------------------------------------------------
# Data types served by CacheManager
# ---------------------------------------------------------------------------
DATA_TYPES: list[str] = [
    "price",
    "fundamentals",
    "news",
    "macro",
    "cot",
    "ownership",
    "insider",
    "analysis",
    "options",
    "economic_calendar",
]


# ---------------------------------------------------------------------------
# Fallback chains -- ordered list of sources to try per data type.
# ---------------------------------------------------------------------------
FALLBACK_CHAINS: dict[str, list[str]] = {
    "price":        ["finnhub", "yfinance"],
    "fundamentals": ["edgar"],
    "news":         ["finnhub"],
    "macro":        ["fred"],
    "cot":          ["cftc"],
    "ownership":    ["edgar"],
    "insider":      ["edgar"],
    "analysis":     [],
    "options":      ["massive"],
    "economic_calendar": ["forex_calendar", "finnhub"],
}


# ---------------------------------------------------------------------------
# CachedResult
# ---------------------------------------------------------------------------
@dataclass(slots=True, frozen=True)
class CachedResult:
    """Immutable response envelope for all CacheManager methods.

    Carries the data payload alongside freshness metadata so callers
    can make informed decisions about staleness without knowing cache
    internals.
    """

    data: Any
    data_type: str
    cache_key: str
    source: str
    is_cached: bool
    is_stale: bool
    fetched_at: str
    cache_age_seconds: float
    cache_age_human: str
    ttl_seconds: int
    expires_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def format_age(seconds: float) -> str:
    """Convert *seconds* to a human-readable age string.

    Examples::

        format_age(5)      -> "5s ago"
        format_age(125)    -> "2m ago"
        format_age(7200)   -> "2h ago"
        format_age(90000)  -> "1d ago"
        format_age(0.3)    -> "just now"
    """
    if seconds < 1:
        return "just now"
    s = int(seconds)
    if s < 60:
        return f"{s}s ago"
    if s < 3600:
        return f"{s // 60}m ago"
    if s < 86400:
        return f"{s // 3600}h ago"
    return f"{s // 86400}d ago"
