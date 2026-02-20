"""Fundamentals route -- financial statements, ratios, and key metrics.

GET /api/fundamentals/{symbol}  returns TTM aggregation and the last 4
quarters of financial data from SEC EDGAR, supplemented by market-derived
metrics from Finnhub (P/E, market cap, dividend yield).

Full implementation: TASK-API-004
"""
from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException

from app.data.fundamentals_service import get_fundamentals_data
from app.data.massive_client import get_massive_client
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ShortInterestResponse(BaseModel):
    symbol: str
    shares_short: int | None
    short_ratio: float | None
    percent_of_float: float | None
    settlement_date: str | None

class AnalystRatingsResponse(BaseModel):
    symbol: str
    buy: int
    hold: int
    sell: int
    consensus: str
    total_analysts: int
    price_target_mean: float | None
    price_target_high: float | None
    price_target_low: float | None

class CachedResultSub(BaseModel):
    """Envelope for advanced sub-endpoints"""
    data: Any
    fetched_at: str | None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_symbol(symbol: str) -> str:
    """Strip, upper-case, and validate *symbol*.  Raises 400 on failure."""
    cleaned = symbol.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid ticker symbol",
        )
    return cleaned

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{symbol}")
async def get_fundamentals(symbol: str) -> dict[str, Any]:
    """Return fundamental financial data for *symbol*.

    Combines SEC EDGAR filings (revenue, EPS, margins, balance sheet) with
    Finnhub/YFinance market-derived metrics (P/E, market cap, dividend yield).
    """
    symbol = _validate_symbol(symbol)
    return await get_fundamentals_data(symbol)


@router.get("/{symbol}/short-interest", response_model=CachedResultSub)
async def get_short_interest(symbol: str) -> dict[str, Any]:
    """Return short interest data for *symbol*.
    
    Returns 503 if data source is disabled. Returns `data: null` if 
    unavailable upstream but the service itself is active.
    """
    symbol = _validate_symbol(symbol)
    client = get_massive_client()

    if not client._enabled:
        raise HTTPException(
            status_code=503,
            detail="Short interest data source not configured."
        )

    res = await client.get_short_interest(symbol)
    if not res:
        return {"data": None, "fetched_at": None}

    return {"data": res, "fetched_at": res.get("_fetched_at")}


@router.get("/{symbol}/analyst-ratings", response_model=CachedResultSub)
async def get_analyst_ratings(symbol: str) -> dict[str, Any]:
    """Return analyst consensus data for *symbol*.
    
    Returns 503 if data source is disabled. Returns `data: null` if 
    unavailable upstream but the service itself is active.
    """
    symbol = _validate_symbol(symbol)
    client = get_massive_client()

    if not client._enabled:
        raise HTTPException(
            status_code=503,
            detail="Analyst ratings data source not configured."
        )

    res = await client.get_analyst_ratings(symbol)
    if not res:
        return {"data": None, "fetched_at": None}

    return {"data": res, "fetched_at": res.get("_fetched_at")}
