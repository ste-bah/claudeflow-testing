"""Fundamentals route -- financial statements, ratios, and key metrics.

GET /api/fundamentals/{symbol}  returns TTM aggregation and the last 4
quarters of financial data from SEC EDGAR, supplemented by market-derived
metrics from Finnhub (P/E, market cap, dividend yield).

Full implementation: TASK-API-004
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.data.edgar_client import get_edgar_client
from app.data.finnhub_client import get_finnhub_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fundamentals", tags=["fundamentals"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_CRYPTO_SUFFIXES = ("-USD", "-USDT", "-BTC", "-ETH")
_QUARTERLY_COUNT = 4


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


def _is_non_equity(symbol: str) -> bool:
    """Return *True* if *symbol* looks like a crypto asset.

    Only rejects crypto suffixes (-USD, -USDT, -BTC, -ETH) and long
    dash-containing symbols (likely crypto pairs).  Does NOT reject
    commodity futures tickers or short forex-like symbols — those are
    better handled by upstream 404 when no data is found.
    """
    if any(symbol.endswith(s) for s in _CRYPTO_SUFFIXES):
        return True
    if "-" in symbol and len(symbol) > 5:
        return True
    return False


def _safe_sum(values: list[float | None]) -> float | None:
    """Sum non-None values; return None if all are None."""
    nums = [v for v in values if v is not None]
    return sum(nums) if nums else None


def _safe_div(num: float | None, den: float | None) -> float | None:
    """Divide safely; return None on bad inputs."""
    if num is None or den is None or den == 0:
        return None
    try:
        return round(num / den, 6)
    except (TypeError, ZeroDivisionError):
        return None


def _to_int(val: float | None) -> int | None:
    """Convert to int for large monetary values; None passthrough."""
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _convert_market_cap(raw: float | None) -> int | None:
    """Convert Finnhub market cap (in millions) to full value."""
    if raw is None:
        return None
    return int(raw * 1_000_000)


def _convert_dividend_yield(raw: float | None) -> float | None:
    """Convert Finnhub dividend yield (percentage) to decimal."""
    if raw is None:
        return None
    return round(raw / 100, 6)


def _build_quarterly(
    income_data: list[dict[str, Any]] | None,
    cash_flow_data: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Build the quarterly array from EDGAR income + cash-flow statements.

    Returns up to ``_QUARTERLY_COUNT`` quarters, most-recent first.
    Each quarter includes revenue, net_income, eps_diluted, margins, and
    YoY growth rates (if the income data provides them).
    """
    if not income_data:
        return []

    quarters: list[dict[str, Any]] = []
    for i, row in enumerate(income_data[:_QUARTERLY_COUNT]):
        period = row.get("period", "")
        q: dict[str, Any] = {
            "period": period,
            "filing_date": row.get("_fetched_at", "")[:10] if row.get("_fetched_at") else None,
            "filing_type": "10-Q",
            "revenue": row.get("revenue"),
            "net_income": row.get("net_income"),
            "eps_diluted": row.get("eps_diluted"),
            "gross_margin": row.get("gross_margin"),
            "operating_margin": row.get("operating_margin"),
            "net_margin": row.get("net_margin"),
            "revenue_growth_yoy": row.get("revenue_growth_yoy"),
            "eps_growth_yoy": row.get("eps_growth_yoy"),
        }
        # Attach FCF from cash flow if available
        if cash_flow_data and i < len(cash_flow_data):
            q["free_cash_flow"] = cash_flow_data[i].get("free_cash_flow")
        quarters.append(q)

    return quarters


def _build_ttm(
    quarterly: list[dict[str, Any]],
    balance_data: list[dict[str, Any]] | None,
    market_data: dict[str, Any] | None,
    profile_data: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Compute trailing twelve months from the last 4 quarters.

    Flow metrics (revenue, net_income, EPS, FCF) are summed across quarters.
    Point-in-time metrics (margins) come from the most recent quarter.
    Market-derived metrics (P/E, market cap, dividend yield) from Finnhub.
    """
    if not quarterly:
        return None

    # Flow metrics: sum across available quarters
    revenue = _safe_sum([q.get("revenue") for q in quarterly])
    net_income = _safe_sum([q.get("net_income") for q in quarterly])
    fcf = _safe_sum([q.get("free_cash_flow") for q in quarterly])
    eps = _safe_sum([q.get("eps_diluted") for q in quarterly])

    # Point-in-time from most recent quarter (all margins consistent)
    latest = quarterly[0]

    # Market-derived from Finnhub
    pe = market_data.get("pe_ratio") if market_data else None
    market_cap = _convert_market_cap(
        market_data.get("market_cap") if market_data else None,
    )
    dividend_yield = _convert_dividend_yield(
        market_data.get("dividend_yield") if market_data else None,
    )

    # Shares outstanding: prefer Finnhub profile, fall back to derivation
    shares = None
    if profile_data and profile_data.get("shareOutstanding") is not None:
        shares = int(profile_data["shareOutstanding"] * 1_000_000)
    elif net_income is not None and eps is not None and eps != 0:
        shares = int(abs(net_income / eps))

    # Balance sheet ratios from latest
    debt_to_equity = None
    return_on_equity = None
    if balance_data:
        latest_bs = balance_data[0]
        debt_to_equity = latest_bs.get("debt_to_equity")
        equity = latest_bs.get("total_equity")
        if net_income is not None and equity is not None and equity != 0:
            return_on_equity = round(net_income / equity, 6)

    ttm: dict[str, Any] = {
        "revenue": _to_int(revenue),
        "net_income": _to_int(net_income),
        "eps_diluted": round(eps, 2) if eps is not None else None,
        "gross_margin": latest.get("gross_margin"),
        "operating_margin": latest.get("operating_margin"),
        "net_margin": latest.get("net_margin"),
        "pe_ratio": pe,
        "market_cap": market_cap,
        "shares_outstanding": shares,
        "free_cash_flow": _to_int(fcf),
        "debt_to_equity": debt_to_equity,
        "return_on_equity": return_on_equity,
        "dividend_yield": dividend_yield,
    }
    return ttm


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{symbol}")
async def get_fundamentals(symbol: str) -> dict[str, Any]:
    """Return fundamental financial data for *symbol*.

    Combines SEC EDGAR filings (revenue, EPS, margins, balance sheet) with
    Finnhub market-derived metrics (P/E, market cap, dividend yield).
    """
    symbol = _validate_symbol(symbol)

    # Reject non-equity asset types (crypto)
    if _is_non_equity(symbol):
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Fundamental data not available for this asset type",
                "symbol": symbol,
            },
        )

    edgar = get_edgar_client()
    finnhub = get_finnhub_client()

    # Fetch data from all sources (best-effort for each)
    income_data: list[dict[str, Any]] | None = None
    balance_data: list[dict[str, Any]] | None = None
    cash_flow_data: list[dict[str, Any]] | None = None
    company_info: dict[str, Any] | None = None
    market_data: dict[str, Any] | None = None
    profile_data: dict[str, Any] | None = None

    # EDGAR: income statement (quarterly)
    try:
        income_data = await edgar.get_eps_history(symbol, quarters=12)
    except Exception:
        logger.warning("EDGAR income fetch error for %s", symbol, exc_info=True)

    # EDGAR: balance sheet
    try:
        balance_data = await edgar.get_balance_sheet(symbol, periods=4)
    except Exception:
        logger.warning("EDGAR balance sheet fetch error for %s", symbol, exc_info=True)

    # EDGAR: cash flow
    try:
        cash_flow_data = await edgar.get_cash_flow(symbol, periods=4)
    except Exception:
        logger.warning("EDGAR cash flow fetch error for %s", symbol, exc_info=True)

    # EDGAR: company info (CIK, name)
    try:
        company_info = await edgar.get_company(symbol)
    except Exception:
        logger.warning("EDGAR company fetch error for %s", symbol, exc_info=True)

    # Finnhub: market-derived metrics
    try:
        market_data = await finnhub.get_basic_financials(symbol)
    except Exception:
        logger.warning("Finnhub financials fetch error for %s", symbol, exc_info=True)

    # Finnhub: company profile (name fallback, shares outstanding)
    try:
        profile_data = await finnhub.get_company_profile(symbol)
    except Exception:
        logger.warning("Finnhub profile fetch error for %s", symbol, exc_info=True)

    # Determine company name and CIK
    company_name = None
    cik = None
    if company_info:
        company_name = company_info.get("name")
        cik = company_info.get("cik")
    if not company_name and profile_data:
        company_name = profile_data.get("name")

    # If no data from any source, 404
    has_edgar = income_data is not None and len(income_data) > 0
    has_finnhub = market_data is not None or profile_data is not None
    if not has_edgar and not has_finnhub:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "No data available for symbol",
                "symbol": symbol,
            },
        )

    # Determine data sources
    financials_source = "edgar" if has_edgar else "finnhub"
    market_source = "finnhub" if has_finnhub else "none"

    # Build quarterly array
    quarterly = _build_quarterly(income_data, cash_flow_data)

    # Build TTM
    ttm = _build_ttm(quarterly, balance_data, market_data, profile_data)

    # If no EDGAR data, build TTM from Finnhub only
    if not has_edgar and market_data:
        ttm = {
            "revenue": None,
            "net_income": None,
            "eps_diluted": market_data.get("eps"),
            "gross_margin": None,
            "operating_margin": None,
            "net_margin": None,
            "pe_ratio": market_data.get("pe_ratio"),
            "market_cap": _convert_market_cap(market_data.get("market_cap")),
            "shares_outstanding": None,
            "free_cash_flow": None,
            "debt_to_equity": None,
            "return_on_equity": None,
            "dividend_yield": _convert_dividend_yield(market_data.get("dividend_yield")),
        }

    # Build response
    now = datetime.now(timezone.utc).isoformat()
    response: dict[str, Any] = {
        "symbol": symbol,
        "company_name": company_name,
        "cik": cik,
        "ttm": ttm,
        "quarterly": quarterly,
        "next_earnings_date": None,
        "data_sources": {
            "financials": financials_source,
            "market_data": market_source,
        },
        "data_timestamp": now,
    }

    # Add note if no EDGAR filings
    if not has_edgar:
        response["note"] = "No SEC filings found for this symbol. Showing market data only."

    logger.info(
        "Fundamentals %s: %d quarters, edgar=%s, finnhub=%s",
        symbol, len(quarterly), has_edgar, has_finnhub,
    )

    return response
