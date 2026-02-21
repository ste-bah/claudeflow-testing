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
    y6 = "6mo" # Fix: yfinance uses "mo" for months
    y1 = "1y"
    y5 = "5y"
    h1 = "1h"
    h4 = "4h"
    h8 = "8h"
    h12 = "12h"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _aggregate_bars(bars: list[dict[str, Any]], hours: int) -> list[dict[str, Any]]:
    """Aggregate 1h bars into N-hour bars."""
    if not bars:
        return []
    
    aggregated = []
    current_batch = []
    batch_start_time = None
    
    # Simple aggregation: group by N entries since we expect continuous hourly data
    # A more robust approach would align to clock hours (e.g. 9:30, 13:30) but this suffices for now.
    
    for bar in bars:
        # Check for session breaks (large time gaps) to reset batch
        # For simplicity, we just group every 'hours' bars. 
        # Ideally we'd respect trading sessions.
        
        current_batch.append(bar)
        
        if len(current_batch) == hours:
            # Aggregate
            open_p = current_batch[0]["open"]
            close_p = current_batch[-1]["close"]
            high_p = max(b["high"] for b in current_batch)
            low_p = min(b["low"] for b in current_batch)
            volume = sum(b.get("volume", 0) or 0 for b in current_batch)
            date = current_batch[-1]["date"] # Use close time/date
            
            aggregated.append({
                "date": date,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": volume,
            })
            current_batch = []
            
    # Handle remaining partial batch
    if current_batch:
        open_p = current_batch[0]["open"]
        close_p = current_batch[-1]["close"]
        high_p = max(b["high"] for b in current_batch)
        low_p = min(b["low"] for b in current_batch)
        volume = sum(b.get("volume", 0) or 0 for b in current_batch)
        date = current_batch[-1]["date"]
        
        aggregated.append({
            "date": date,
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p,
            "volume": volume,
        })
        
    return aggregated

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
        "data_source": price_result.source if price_result else "none",
        "data_timestamp": price_result.fetched_at if price_result else "",
        "data_age_seconds": price_result.cache_age_seconds if price_result else 0.0,
        "is_market_open": _is_market_open(),
        "cache_hit": price_result.is_cached if price_result else False,
    }

    # -- 4. Optional OHLCV history ------------------------------------------
    if include_history:
        # Determine yfinance parameters based on requested period
        if period in (Period.h1, Period.h4, Period.h8, Period.h12):
            # Intraday: fetch 1h data for max available time (2y)
            yf_period = "2y"
            yf_interval = "1h"
        elif period == Period.d1:
            yf_period = "10y"
            yf_interval = "1d"
        elif period == Period.w1:
            yf_period = "10y"
            yf_interval = "1wk"
        elif period == Period.m1:
            yf_period = "10y"
            yf_interval = "1mo"
        elif period == Period.m3:
            yf_period = "10y"
            yf_interval = "3mo"
        elif period in (Period.y6, Period.y1, Period.y5):
            # Aggregate from 3mo data
            yf_period = "max"
            yf_interval = "3mo"
        else:
            # Fallback (should cover all enum cases already)
            yf_period = "max"
            yf_interval = "1d"

        try:
            hist_result = await cache.get_historical_prices(
                symbol, period=yf_period, interval=yf_interval,
            )
        except Exception:
            logger.debug("Historical prices fetch failed for %s", symbol, exc_info=True)
            hist_result = None

        if hist_result and hist_result.data is not None and isinstance(hist_result.data, list):
            bars = [
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
            
            # Aggregate if needed
            # Intraday Aggregation
            if period == Period.h4:
                bars = _aggregate_bars(bars, 4)
            elif period == Period.h8:
                bars = _aggregate_bars(bars, 8)
            elif period == Period.h12:
                bars = _aggregate_bars(bars, 12)
            
            # Long-term Aggregation (from 3mo bars)
            elif period == Period.y6:
                # 6 months = 2 * 3mo
                bars = _aggregate_bars(bars, 2)
            elif period == Period.y1:
                # 1 year = 4 * 3mo
                bars = _aggregate_bars(bars, 4)
            elif period == Period.y5:
                # 5 years = 20 * 3mo
                bars = _aggregate_bars(bars, 20)
                
            response["ohlcv"] = bars
        else:
            response["ohlcv"] = []



    logger.info(
        "Ticker %s: source=%s cache_hit=%s age=%.0fs",
        symbol, 
        price_result.source if price_result else "none", 
        price_result.is_cached if price_result else False,
        price_result.cache_age_seconds if price_result else 0.0,
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
