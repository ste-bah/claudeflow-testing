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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])

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
