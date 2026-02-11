"""Scan route -- filter watchlist tickers by methodology signals.

GET /api/scan  filters watchlist tickers by method, signal, confluence, etc.
GET /api/scan/bullish  preset: bullish with 3+ confluence, 50%+ confidence
GET /api/scan/bearish  preset: bearish with 3+ confluence, 50%+ confidence
GET /api/scan/strong   preset: 5+ confluence, 70%+ confidence

Full implementation: TASK-ANALYSIS-010
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.analysis.base import METHODOLOGY_NAMES
from app.data.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["scan"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_VALID_SIGNALS = {"bullish", "bearish", "neutral"}
_VALID_TIMEFRAMES = {"short", "medium", "long"}
_VALID_SORT_FIELDS = {"confidence", "symbol", "price_change"}
_VALID_ORDERS = {"desc", "asc"}
_STALE_SECONDS = 2 * 60 * 60  # 2 hours


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_enum(value: str | None, allowed: set[str], name: str) -> str | None:
    """Validate *value* against *allowed* set.  Returns cleaned or raises 400."""
    if value is None:
        return None
    cleaned = value.strip().lower()
    if cleaned not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {name} parameter. Must be one of: {sorted(allowed)}",
        )
    return cleaned


def _validate_method(method: str | None) -> str | None:
    """Validate methodology name against the canonical list."""
    if method is None:
        return None
    cleaned = method.strip().lower()
    if cleaned not in METHODOLOGY_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid method parameter. Must be one of: {METHODOLOGY_NAMES}",
        )
    return cleaned


def _validate_signal(signal: str | None, method: str | None) -> str | None:
    """Validate signal direction; requires method to be set."""
    cleaned = _validate_enum(signal, _VALID_SIGNALS, "signal")
    if cleaned is not None and method is None:
        raise HTTPException(
            status_code=400, detail="signal parameter requires method parameter",
        )
    return cleaned


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Coerce *val* to float, returning *default* on failure."""
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    """Coerce *val* to int, returning *default* on failure."""
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Data access helpers
# ---------------------------------------------------------------------------

def _parse_composite_json(raw: str | None) -> dict[str, Any] | None:
    """Safely parse a composite_json string into a dict."""
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _is_stale(created_at_str: str | None) -> bool:
    """Return True if the analysis timestamp is more than 2 hours old."""
    if created_at_str is None:
        return True
    try:
        created_at = datetime.fromisoformat(created_at_str)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return (datetime.now(tz=timezone.utc) - created_at).total_seconds() > _STALE_SECONDS
    except (TypeError, ValueError):
        return True


async def _table_exists(db: Any, table_name: str) -> bool:
    """Check whether *table_name* exists in the SQLite database."""
    row = await db.fetch_one(
        "SELECT COUNT(*) AS cnt FROM sqlite_master "
        "WHERE type='table' AND name=?", (table_name,),
    )
    return row is not None and row.get("cnt", 0) > 0


async def _fetch_watchlist(db: Any, group: str | None) -> list[dict[str, Any]]:
    """Return watchlist rows, optionally filtered by group."""
    if group is not None:
        return await db.fetch_all(
            "SELECT symbol, name, group_name FROM watchlist "
            "WHERE group_name = ? ORDER BY sort_order ASC", (group,),
        )
    return await db.fetch_all(
        "SELECT symbol, name, group_name FROM watchlist ORDER BY sort_order ASC",
    )


async def _get_composite(db: Any, symbol: str) -> dict[str, Any] | None:
    """Get the most recent composite cache entry for *symbol*."""
    row = await db.fetch_one(
        "SELECT composite_json, signals_json, created_at "
        "FROM analysis_cache WHERE ticker = ? "
        "ORDER BY created_at DESC LIMIT 1", (symbol,),
    )
    if row is None:
        return None
    composite = _parse_composite_json(row.get("composite_json"))
    if composite is None:
        return None
    composite["_created_at"] = row.get("created_at")
    composite["_signals_json"] = row.get("signals_json")
    return composite


async def _get_method_signal(
    db: Any, symbol: str, methodology: str,
) -> dict[str, Any] | None:
    """Get the most recent analysis_results row for a specific methodology."""
    return await db.fetch_one(
        "SELECT direction, confidence, timeframe, signal_json, analyzed_at "
        "FROM analysis_results WHERE symbol = ? AND methodology = ? "
        "ORDER BY analyzed_at DESC LIMIT 1", (symbol, methodology),
    )


# ---------------------------------------------------------------------------
# Filtering, sorting, building
# ---------------------------------------------------------------------------

def _matches(
    comp: dict[str, Any], msig: dict[str, Any] | None,
    method: str | None, signal: str | None,
    confluence: int | None, min_conf: float, timeframe: str | None,
) -> bool:
    """Return True if composite+method_signal passes all filter criteria."""
    # Method filter: methodology must exist in analysis_results
    if method is not None and msig is None:
        return False
    # Signal filter (requires method already validated)
    if method is not None and signal is not None:
        if (msig.get("direction") or "").lower() != signal:
            return False
    # Confluence filter
    if confluence is not None and _safe_int(comp.get("confluence_count")) < confluence:
        return False
    # Confidence filter (method-specific when method given)
    if method is not None and msig is not None:
        if _safe_float(msig.get("confidence")) < min_conf:
            return False
    elif _safe_float(comp.get("overall_confidence")) < min_conf:
        return False
    # Timeframe filter
    if timeframe is not None:
        if msig is not None:
            if (msig.get("timeframe") or "").lower() != timeframe:
                return False
        else:
            tb = comp.get("timeframe_breakdown", {})
            if isinstance(tb, dict) and timeframe not in tb:
                return False
    return True


def _build_item(
    symbol: str, comp: dict[str, Any], method: str | None,
    msig: dict[str, Any] | None,
    last_price: float | None, price_change_pct: float | None,
) -> dict[str, Any]:
    """Assemble a single scan result item."""
    created_at = comp.get("_created_at")
    direction = comp.get("overall_direction", "neutral")
    confidence = comp.get("overall_confidence", 0.0)
    confluence_n = comp.get("confluence_count", 0)

    # Match reason
    parts: list[str] = []
    if method is not None and msig is not None:
        parts.append(
            f"{method}: {msig.get('direction', 'unknown')} "
            f"({_safe_float(msig.get('confidence')):.0%} confidence)"
        )
    parts.append(
        f"Composite: {direction} ({_safe_float(confidence):.0%} confidence, "
        f"{confluence_n} methodologies agree)"
    )

    methodology_match = None
    if method is not None and msig is not None:
        methodology_match = {
            "methodology": method,
            "direction": msig.get("direction"),
            "confidence": msig.get("confidence"),
            "timeframe": msig.get("timeframe"),
        }

    return {
        "symbol": symbol,
        "match_reason": "; ".join(parts),
        "methodology_match": methodology_match,
        "composite": {
            "overall_direction": direction,
            "overall_confidence": _safe_float(confidence),
            "confluence_count": _safe_int(confluence_n),
        },
        "last_price": last_price,
        "price_change_percent": price_change_pct,
        "last_analysis_at": created_at,
        "stale": _is_stale(created_at),
    }


def _sort_results(
    results: list[dict[str, Any]], sort: str, order: str, method: str | None,
) -> list[dict[str, Any]]:
    """Sort result items by the requested field."""
    reverse = order == "desc"
    if sort == "symbol":
        results.sort(key=lambda r: r["symbol"], reverse=reverse)
    elif sort == "price_change":
        results.sort(
            key=lambda r: (r["price_change_percent"] is None,
                           r.get("price_change_percent") or 0.0),
            reverse=reverse,
        )
    else:  # confidence
        def _ck(r: dict[str, Any]) -> float:
            if method and r.get("methodology_match"):
                return _safe_float(r["methodology_match"].get("confidence"))
            return r.get("composite", {}).get("overall_confidence", 0.0)
        results.sort(key=_ck, reverse=reverse)
    return results


# ---------------------------------------------------------------------------
# Response envelope
# ---------------------------------------------------------------------------

def _envelope(
    *, method: str | None, signal: str | None, confluence: int | None,
    min_confidence: float, timeframe: str | None, group: str | None,
    results: list[dict[str, Any]], total_scanned: int,
    duration_ms: int, note: str | None,
) -> dict[str, Any]:
    return {
        "query": {
            "method": method, "signal": signal, "confluence": confluence,
            "min_confidence": min_confidence, "timeframe": timeframe,
            "group": group,
        },
        "results": results,
        "total_matches": len(results),
        "total_scanned": total_scanned,
        "scan_duration_ms": duration_ms,
        "note": note,
    }


def _elapsed_ms(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


def _price_info(row: dict[str, Any] | None) -> tuple[float | None, float | None]:
    """Extract last_price and price_change_percent from a price_cache row."""
    if row is None:
        return None, None
    last = row.get("close")
    opn = row.get("open")
    pct: float | None = None
    if last is not None and opn is not None and opn != 0:
        pct = round((last - opn) / opn * 100, 3)
    return last, pct


# ---------------------------------------------------------------------------
# Core scan logic (plain Python args -- callable from presets & endpoint)
# ---------------------------------------------------------------------------

async def _scan_impl(
    *,
    method: str | None = None,
    signal: str | None = None,
    confluence: int | None = None,
    min_confidence: float = 0.0,
    timeframe: str | None = None,
    group: str | None = None,
    sort: str = "confidence",
    order: str = "desc",
    limit: int = 50,
) -> dict[str, Any]:
    """Internal scan logic with plain Python defaults."""
    t0 = time.monotonic()

    # -- Validate params ------------------------------------------------------
    method = _validate_method(method)
    signal = _validate_signal(signal, method)
    timeframe = _validate_enum(timeframe, _VALID_TIMEFRAMES, "timeframe")
    sort = _validate_enum(sort, _VALID_SORT_FIELDS, "sort") or "confidence"
    order = _validate_enum(order, _VALID_ORDERS, "order") or "desc"

    db = await get_database()
    cache_ok = await _table_exists(db, "analysis_cache")
    tickers = await _fetch_watchlist(db, group)
    total_scanned = len(tickers)

    env = dict(method=method, signal=signal, confluence=confluence,
               min_confidence=min_confidence, timeframe=timeframe, group=group)

    if total_scanned == 0:
        return _envelope(**env, results=[], total_scanned=0,
                         duration_ms=_elapsed_ms(t0), note="No tickers in watchlist")
    if not cache_ok:
        return _envelope(**env, results=[], total_scanned=total_scanned,
                         duration_ms=_elapsed_ms(t0),
                         note="No analysis data available yet. Run analysis first.")

    # -- Scan each ticker -----------------------------------------------------
    results: list[dict[str, Any]] = []
    all_stale = True

    for row in tickers:
        sym = row["symbol"]
        comp = await _get_composite(db, sym)
        if comp is None:
            continue
        msig = await _get_method_signal(db, sym, method) if method else None
        if not _matches(comp, msig, method, signal,
                        confluence, min_confidence, timeframe):
            continue
        price_row = await db.fetch_one(
            "SELECT close, open FROM price_cache "
            "WHERE symbol = ? ORDER BY date DESC LIMIT 1", (sym,),
        )
        lp, pcp = _price_info(price_row)
        item = _build_item(sym, comp, method, msig, lp, pcp)
        if not item["stale"]:
            all_stale = False
        results.append(item)

    # -- Sort, limit, respond -------------------------------------------------
    results = _sort_results(results, sort, order, method)[:limit]

    note: str | None = None
    if not results:
        note = "No tickers matched the scan criteria"
    elif all_stale:
        note = "All results are stale (>2 hours old). Consider re-running analysis."

    duration_ms = _elapsed_ms(t0)
    logger.info("Scan: %d/%d matches in %dms", len(results), total_scanned, duration_ms)

    return _envelope(**env, results=results, total_scanned=total_scanned,
                     duration_ms=duration_ms, note=note)


# ---------------------------------------------------------------------------
# Endpoints -- presets BEFORE the general scan to avoid path conflicts
# ---------------------------------------------------------------------------

@router.get("/bullish")
async def scan_bullish(
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Preset: bullish signals with 3+ confluence and 50%+ confidence."""
    return await _scan_impl(confluence=3, min_confidence=0.5, limit=limit)


@router.get("/bearish")
async def scan_bearish(
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Preset: bearish signals with 3+ confluence and 50%+ confidence."""
    return await _scan_impl(confluence=3, min_confidence=0.5, limit=limit)


@router.get("/strong")
async def scan_strong(
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Preset: strong signals with 5+ confluence and 70%+ confidence."""
    return await _scan_impl(confluence=5, min_confidence=0.7, limit=limit)


@router.get("/")
async def run_scan(
    method: str | None = Query(default=None, description="Filter by methodology"),
    signal: str | None = Query(default=None, description="Filter by direction"),
    confluence: int | None = Query(default=None, ge=1, le=6),
    min_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
    timeframe: str | None = Query(default=None),
    group: str | None = Query(default=None),
    sort: str = Query(default="confidence"),
    order: str = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Filter watchlist tickers by methodology signals.

    Reads cached analysis results from SQLite -- never triggers new analysis.
    """
    return await _scan_impl(
        method=method, signal=signal, confluence=confluence,
        min_confidence=min_confidence, timeframe=timeframe,
        group=group, sort=sort, order=order, limit=limit,
    )
