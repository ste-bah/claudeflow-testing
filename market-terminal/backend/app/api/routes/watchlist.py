"""Watchlist CRUD endpoints.

Manage the user's tracked-symbol watchlist: list, add, remove, reorder,
and change group assignment.  Data persists in SQLite with a maximum of
50 symbols.

Full implementation: TASK-API-007
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_MAX_WATCHLIST_SIZE = 50

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class _AddTickerRequest(BaseModel):
    symbol: str
    group: str = "default"

    @field_validator("symbol")
    @classmethod
    def _validate_symbol(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned or not _SYMBOL_RE.match(cleaned):
            raise ValueError("Invalid symbol format")
        return cleaned

    @field_validator("group")
    @classmethod
    def _validate_group(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            return "default"
        if len(cleaned) > 100:
            raise ValueError("Group name must not exceed 100 characters")
        return cleaned


_MAX_GROUP_LEN = 100


class _ReorderRequest(BaseModel):
    order: list[str]

    @field_validator("order")
    @classmethod
    def _validate_order(cls, v: list[str]) -> list[str]:
        result: list[str] = []
        for s in v:
            cleaned = s.strip().upper()
            if not cleaned or not _SYMBOL_RE.match(cleaned):
                raise ValueError("Invalid symbol format in order list")
            result.append(cleaned)
        return result


class _GroupChangeRequest(BaseModel):
    group: str

    @field_validator("group")
    @classmethod
    def _validate_group(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Group name must not be empty")
        if len(cleaned) > _MAX_GROUP_LEN:
            raise ValueError("Group name must not exceed 100 characters")
        return cleaned


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_symbol(raw: str) -> str:
    """Normalise and validate a path-parameter symbol."""
    cleaned = raw.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise HTTPException(status_code=400, detail="Invalid symbol format")
    return cleaned


async def _enrich_entry(row: dict[str, Any]) -> dict[str, Any]:
    """Map a watchlist DB row to the API response shape, enriched with
    cached market data when available.
    """
    symbol = row["symbol"]
    db = await get_database()

    # Latest price from price_cache (most recent date)
    price_row = await db.fetch_one(
        "SELECT close, open FROM price_cache "
        "WHERE symbol = ? ORDER BY date DESC LIMIT 1",
        (symbol,),
    )
    last_price: float | None = None
    price_change_pct: float | None = None
    if price_row is not None:
        last_price = price_row.get("close")
        open_val = price_row.get("open")
        if last_price is not None and open_val is not None and open_val != 0:
            price_change_pct = round((last_price - open_val) / open_val * 100, 3)

    # Latest composite signal from analysis_results
    signal_row = await db.fetch_one(
        "SELECT direction, confidence FROM analysis_results "
        "WHERE symbol = ? ORDER BY analyzed_at DESC LIMIT 1",
        (symbol,),
    )
    composite_signal: str | None = None
    composite_confidence: float | None = None
    if signal_row is not None:
        composite_signal = signal_row.get("direction")
        composite_confidence = signal_row.get("confidence")

    return {
        "symbol": symbol,
        "group": row.get("group_name", "default"),
        "added_at": row.get("added_at"),
        "position": row.get("sort_order", 0),
        "last_price": last_price,
        "price_change_percent": price_change_pct,
        "last_composite_signal": composite_signal,
        "last_composite_confidence": composite_confidence,
        "last_updated": row.get("updated_at"),
    }


_WATCHLIST_ENRICHED_SQL = """
WITH latest_price AS (
    SELECT a.symbol, a.close, a.open
    FROM price_cache a
    INNER JOIN (
        SELECT symbol, MAX(date) AS max_date
        FROM price_cache
        GROUP BY symbol
    ) m ON a.symbol = m.symbol AND a.date = m.max_date
    GROUP BY a.symbol
),
latest_signal AS (
    SELECT a.symbol, a.direction, a.confidence
    FROM analysis_results a
    INNER JOIN (
        SELECT symbol, MAX(analyzed_at) AS max_at
        FROM analysis_results
        GROUP BY symbol
    ) m ON a.symbol = m.symbol AND a.analyzed_at = m.max_at
    GROUP BY a.symbol
)
SELECT
    w.symbol,
    w.group_name,
    w.sort_order,
    w.added_at,
    w.updated_at,
    p.close      AS last_close,
    p.open       AS last_open,
    s.direction  AS signal_direction,
    s.confidence AS signal_confidence
FROM watchlist w
LEFT JOIN latest_price  p ON p.symbol = w.symbol
LEFT JOIN latest_signal s ON s.symbol = w.symbol
ORDER BY w.sort_order ASC
"""


def _row_to_ticker(row: dict[str, Any]) -> dict[str, Any]:
    """Map a single JOIN result row to the API ticker response shape."""
    last_price: float | None = row.get("last_close")
    price_change_pct: float | None = None
    open_val = row.get("last_open")
    if last_price is not None and open_val is not None and open_val != 0:
        price_change_pct = round((last_price - open_val) / open_val * 100, 3)
    return {
        "symbol": row["symbol"],
        "group": row.get("group_name", "default"),
        "added_at": row.get("added_at"),
        "position": row.get("sort_order", 0),
        "last_price": last_price,
        "price_change_percent": price_change_pct,
        "last_composite_signal": row.get("signal_direction"),
        "last_composite_confidence": row.get("signal_confidence"),
        "last_updated": row.get("updated_at"),
    }


# ---------------------------------------------------------------------------
# Background pre-warm helper
# ---------------------------------------------------------------------------
async def _warm_ticker_cache(symbol: str) -> None:
    """Pre-fetch price data and run analysis for a newly-added symbol.

    Runs in the background so the 201 response is not delayed.
    All errors are swallowed — this is best-effort only.
    """
    try:
        from app.api.routes.analysis import (  # lazy import avoids circular
            _fetch_data, _run_methodologies, METHODOLOGY_NAMES,
            _MAX_ANALYSIS_SECONDS,
        )
        price_df, volume_df, fundamentals, news_articles, _ = (
            await _fetch_data(symbol, timeframe="1d", force_refresh=False)
        )
        await asyncio.wait_for(
            _run_methodologies(
                symbol, price_df, volume_df, fundamentals,
                news_articles, list(METHODOLOGY_NAMES), None, False,
                timeframe="1d",
            ),
            timeout=_MAX_ANALYSIS_SECONDS,
        )
        logger.info("Background analysis pre-warm complete for %s", symbol)
    except Exception:
        logger.debug("Background pre-warm failed for %s", symbol, exc_info=True)


# ---------------------------------------------------------------------------
# GET /api/watchlist/
# ---------------------------------------------------------------------------
@router.get("/")
async def get_watchlist() -> dict[str, Any]:
    """Return the full watchlist with cached market data (single JOIN query)."""
    db = await get_database()
    rows = await db.fetch_all(_WATCHLIST_ENRICHED_SQL)
    tickers = [_row_to_ticker(r) for r in rows]
    groups = sorted({r.get("group_name", "default") for r in rows})
    return {
        "tickers": tickers,
        "count": len(tickers),
        "max_allowed": _MAX_WATCHLIST_SIZE,
        "groups": groups,
    }


# ---------------------------------------------------------------------------
# POST /api/watchlist/
# ---------------------------------------------------------------------------
@router.post("/", status_code=201)
async def add_to_watchlist(body: _AddTickerRequest) -> dict[str, Any]:
    """Add a ticker to the watchlist.

    Returns 201 on success, 409 if duplicate, 400 if at capacity.
    """
    db = await get_database()

    # Capacity check
    count_row = await db.fetch_one("SELECT COUNT(*) AS cnt FROM watchlist")
    current_count = count_row["cnt"] if count_row else 0
    if current_count >= _MAX_WATCHLIST_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Watchlist is at maximum capacity ({_MAX_WATCHLIST_SIZE} symbols)",
        )

    # Duplicate check
    existing = await db.fetch_one(
        "SELECT id FROM watchlist WHERE symbol = ?", (body.symbol,)
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Symbol already in watchlist",
        )

    # Determine next sort_order
    max_row = await db.fetch_one(
        "SELECT MAX(sort_order) AS max_pos FROM watchlist"
    )
    next_pos = (max_row["max_pos"] + 1) if max_row and max_row["max_pos"] is not None else 0

    await db.execute(
        "INSERT INTO watchlist (symbol, group_name, sort_order) VALUES (?, ?, ?)",
        (body.symbol, body.group, next_pos),
    )

    # Fetch the inserted row for enriched response
    inserted = await db.fetch_one(
        "SELECT symbol, group_name, sort_order, added_at, updated_at "
        "FROM watchlist WHERE symbol = ?",
        (body.symbol,),
    )

    # Fire background task to pre-warm analysis cache for instant first-click UX
    asyncio.create_task(_warm_ticker_cache(body.symbol))

    return await _enrich_entry(inserted)


# ---------------------------------------------------------------------------
# DELETE /api/watchlist/{symbol}
# ---------------------------------------------------------------------------
@router.delete("/{symbol}")
async def remove_from_watchlist(symbol: str) -> dict[str, str]:
    """Remove a ticker from the watchlist.

    Returns 200 with ``{"removed": "SYMBOL"}`` on success, 404 if not found.
    Cached data for the symbol is NOT deleted.
    """
    cleaned = _validate_symbol(symbol)
    db = await get_database()

    existing = await db.fetch_one(
        "SELECT id FROM watchlist WHERE symbol = ?", (cleaned,)
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Symbol not in watchlist")

    await db.execute("DELETE FROM watchlist WHERE symbol = ?", (cleaned,))

    return {"removed": cleaned}


# ---------------------------------------------------------------------------
# PUT /api/watchlist/reorder
# ---------------------------------------------------------------------------
@router.put("/reorder")
async def reorder_watchlist(body: _ReorderRequest) -> dict[str, Any]:
    """Reorder tickers by updating their positions atomically.

    The ``order`` list must contain exactly the same symbols currently in
    the watchlist (no additions, no omissions).
    """
    db = await get_database()

    # Fetch current symbols
    rows = await db.fetch_all("SELECT symbol FROM watchlist")
    current_symbols = {r["symbol"] for r in rows}
    requested_symbols = set(body.order)

    if current_symbols != requested_symbols:
        raise HTTPException(
            status_code=400,
            detail="Order list does not match current watchlist symbols",
        )

    # Check for duplicates in request
    if len(body.order) != len(requested_symbols):
        raise HTTPException(
            status_code=400,
            detail="Order list contains duplicate symbols",
        )

    # Atomic update: build params list and use executemany
    params = [(idx, sym) for idx, sym in enumerate(body.order)]
    await db.executemany(
        "UPDATE watchlist SET sort_order = ?, updated_at = datetime('now') "
        "WHERE symbol = ?",
        params,
    )

    return await get_watchlist()


# ---------------------------------------------------------------------------
# PUT /api/watchlist/{symbol}/group
# ---------------------------------------------------------------------------
@router.put("/{symbol}/group")
async def change_group(symbol: str, body: _GroupChangeRequest) -> dict[str, Any]:
    """Change the group assignment of a watchlist ticker.

    Returns 200 with updated entry, or 404 if not found.
    """
    cleaned = _validate_symbol(symbol)
    db = await get_database()

    existing = await db.fetch_one(
        "SELECT id FROM watchlist WHERE symbol = ?", (cleaned,)
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Symbol not in watchlist")

    await db.execute(
        "UPDATE watchlist SET group_name = ?, updated_at = datetime('now') "
        "WHERE symbol = ?",
        (body.group, cleaned),
    )

    updated = await db.fetch_one(
        "SELECT symbol, group_name, sort_order, added_at, updated_at "
        "FROM watchlist WHERE symbol = ?",
        (cleaned,),
    )

    return await _enrich_entry(updated)
