"""Ticker route -- real-time and historical price data.

GET /api/ticker/{symbol}  returns current price, company metadata,
data freshness info, and optional OHLCV history.

Uses the CacheManager (Finnhub → yfinance fallback chain) for price
data, plus direct FinnhubClient calls for supplementary company
profile and basic financials.

Full implementation: TASK-API-002
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from enum import Enum
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from app.data.cache import get_cache_manager
from app.data.finnhub_client import get_finnhub_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ticker", tags=["ticker"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_ET = ZoneInfo("America/New_York")

# Map user-facing period values to yfinance period strings
_PERIOD_MAP: dict[str, str] = {
    "1d": "1d",
    "1w": "5d",
    "1m": "1mo",
    "3m": "3mo",
    "6m": "6mo",
    "1y": "1y",
    "5y": "5y",
}


class Period(str, Enum):
    """Allowed values for the ``period`` query parameter."""
    d1 = "1d"
    w1 = "1w"
    m1 = "1m"
    m3 = "3m"
    m6 = "6m"
    y1 = "1y"
    y5 = "5y"


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


def _is_market_open() -> bool:
    """Return *True* if US equities market is currently open (simple heuristic).

    Checks weekday (Mon-Fri) and 9:30-16:00 ET.  Does **not** account for
    holidays -- that would require a holiday calendar (deferred).
    """
    now = datetime.now(_ET)
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now < market_close


def _extract_price_block(
    quote: dict[str, Any],
    financials: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the ``price`` sub-object from quote + financials data."""
    price: dict[str, Any] = {
        "current": quote.get("current_price"),
        "open": quote.get("open"),
        "high": quote.get("high"),
        "low": quote.get("low"),
        "previous_close": quote.get("previous_close"),
        "change": quote.get("change"),
        "change_percent": quote.get("percent_change"),
    }
    # volume may come from yfinance quote (has it) or be absent from finnhub
    price["volume"] = quote.get("volume")

    # Supplementary fields from basic_financials
    if financials:
        price["avg_volume_10d"] = financials.get("avg_volume_10d")
        price["fifty_two_week_high"] = financials.get("week_52_high")
        price["fifty_two_week_low"] = financials.get("week_52_low")
        price["market_cap"] = financials.get("market_cap")
    else:
        # Try to pull market_cap from yfinance quote (it includes it)
        price["avg_volume_10d"] = None
        price["fifty_two_week_high"] = None
        price["fifty_two_week_low"] = None
        price["market_cap"] = quote.get("market_cap")

    return price


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{symbol}")
async def get_ticker(
    symbol: str,
    period: Period = Query(Period.d1, description="OHLCV history period"),
    include_history: bool = Query(False, description="Include OHLCV array"),
) -> dict[str, Any]:
    """Return price data and basic info for *symbol*.

    Always includes ``data_timestamp``, ``data_age_seconds``, and
    ``is_market_open`` so the UI never silently shows stale data.
    """
    symbol = _validate_symbol(symbol)
    cache = get_cache_manager()

    # -- 1. Price quote via cache (finnhub → yfinance fallback) -------------
    try:
        price_result = await cache.get_price(symbol)
    except Exception:
        logger.warning("Cache fetch error for %s", symbol, exc_info=True)
        price_result = None

    if price_result is None:
        logger.warning("All sources failed for %s, no cached data", symbol)
        raise HTTPException(
            status_code=404,
            detail={"error": "No data available for symbol", "symbol": symbol},
        )

    quote: dict[str, Any] = price_result.data

    # -- 2. Supplementary data (company profile + financials) ---------------
    #    These are best-effort; failures do not block the response.
    finnhub = get_finnhub_client()
    profile: dict[str, Any] | None = None
    financials: dict[str, Any] | None = None

    if finnhub.is_enabled:
        try:
            profile = await finnhub.get_company_profile(symbol)
        except Exception:
            logger.debug("Company profile fetch failed for %s", symbol, exc_info=True)
        try:
            financials = await finnhub.get_basic_financials(symbol)
        except Exception:
            logger.debug("Basic financials fetch failed for %s", symbol, exc_info=True)

    # -- 3. Build response --------------------------------------------------
    response: dict[str, Any] = {
        "symbol": symbol,
        "name": (profile or {}).get("name"),
        "exchange": (profile or {}).get("exchange"),
        "currency": (profile or {}).get("currency", "USD"),
        "asset_type": _infer_asset_type(symbol, profile),
        "price": _extract_price_block(quote, financials),
        "data_source": price_result.source,
        "data_timestamp": price_result.fetched_at,
        "data_age_seconds": price_result.cache_age_seconds,
        "is_market_open": _is_market_open(),
        "cache_hit": price_result.is_cached,
    }

    # -- 4. Optional OHLCV history ------------------------------------------
    if include_history:
        yf_period = _PERIOD_MAP[period.value]
        try:
            hist_result = await cache.get_historical_prices(
                symbol, period=yf_period, interval="1d",
            )
        except Exception:
            logger.debug("Historical prices fetch failed for %s", symbol, exc_info=True)
            hist_result = None
        if hist_result is not None and isinstance(hist_result.data, list):
            response["ohlcv"] = [
                {
                    "date": bar.get("date"),
                    "open": bar.get("open"),
                    "high": bar.get("high"),
                    "low": bar.get("low"),
                    "close": bar.get("close"),
                    "volume": bar.get("volume"),
                }
                for bar in hist_result.data
            ]
        else:
            response["ohlcv"] = []

    logger.info(
        "Ticker %s: source=%s cache_hit=%s age=%.0fs",
        symbol, price_result.source, price_result.is_cached,
        price_result.cache_age_seconds,
    )
    return response


# ---------------------------------------------------------------------------
# Asset-type inference
# ---------------------------------------------------------------------------

def _infer_asset_type(symbol: str, profile: dict[str, Any] | None) -> str:
    """Best-effort asset type from profile or symbol heuristics."""
    if profile:
        # Finnhub profile may have exchange info suggesting type
        exchange = (profile.get("exchange") or "").upper()
        if "CRYPTO" in exchange:
            return "crypto"
        industry = (profile.get("industry") or "").lower()
        if industry:
            return "stock"

    # Simple heuristic: crypto pairs typically contain a dash or USD suffix
    if "-USD" in symbol or ("-" in symbol and len(symbol) > 5):
        return "crypto"
    return "stock"
