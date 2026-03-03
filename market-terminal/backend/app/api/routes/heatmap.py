"""Heatmap route -- stock universe with sector/index filtering and price data.

GET /api/heatmap   returns full heatmap dataset with optional filters.

Query parameters:
  index  -- filter by index: "all" (default), "sp500", "nasdaq100"
  sector -- filter by GICS sector: "all" (default) or a sector name

Full implementation: heatmap backend feature
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.data.heatmap_service import get_heatmap_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_VALID_INDICES = {"all", "sp500", "nasdaq100"}

_VALID_SECTORS = {
    "all",
    "Technology",
    "Healthcare",
    "Financials",
    "Consumer Discretionary",
    "Consumer Staples",
    "Energy",
    "Industrials",
    "Communication Services",
    "Materials",
    "Utilities",
    "Real Estate",
    "Other",
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("")
async def get_heatmap(
    index: str = Query("all", description="Index filter: all, sp500, nasdaq100"),
    sector: str = Query("all", description="GICS sector filter"),
) -> dict:
    """Return heatmap data for all stocks with optional index and sector filters.

    Stocks include current price, daily change percent, market cap,
    sector, and index membership.  Data is cached: universe refreshes
    every 24 h, prices every 60 s.
    """
    if index not in _VALID_INDICES:
        raise HTTPException(status_code=400, detail="Invalid index filter")

    if sector not in _VALID_SECTORS:
        raise HTTPException(status_code=400, detail="Invalid sector filter")

    try:
        data = await get_heatmap_data(index_filter=index, sector_filter=sector)
    except Exception as exc:
        logger.error("Heatmap service error: %s", exc)
        raise HTTPException(status_code=503, detail="Heatmap data temporarily unavailable")

    return data
