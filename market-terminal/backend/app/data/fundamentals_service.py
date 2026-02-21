"""Fundamentals Service -- processing and aggregation logic.

Refactored from app/api/routes/fundamentals.py to be shared by Analysis.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.data.edgar_client import get_edgar_client
from app.data.finnhub_client import get_finnhub_client
from app.data.yfinance_client import get_yfinance_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_CRYPTO_SUFFIXES = ("-USD", "-USDT", "-BTC", "-ETH")
_QUARTERLY_COUNT = 8  # Increased to ensure we have enough for annual calculation

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_non_equity(symbol: str) -> bool:
    """Return *True* if *symbol* looks like a crypto asset."""
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

def _adapt_yfinance_financials(yf_fins: dict[str, Any]) -> tuple[
    list[dict[str, Any]],  # income
    list[dict[str, Any]],  # balance
    list[dict[str, Any]],  # cash_flow
    list[dict[str, Any]],  # annual_income
    list[dict[str, Any]],  # annual_balance
    list[dict[str, Any]],  # annual_cash_flow
]:
    """Adapt YFinance financials to EDGAR-like format."""
    income: list[dict[str, Any]] = []
    balance: list[dict[str, Any]] = []
    cash_flow: list[dict[str, Any]] = []
    annual_income: list[dict[str, Any]] = []
    annual_balance: list[dict[str, Any]] = []
    annual_cash_flow: list[dict[str, Any]] = []

    # --- Quarterly Helpers ---
    def _process_income(raw: list[dict[str, Any]], is_annual: bool) -> list[dict[str, Any]]:
        out = []
        for i, row in enumerate(raw):
            period = row.get("period", "")
            adapted = {
                "period": period,
                "_fetched_at": row.get("_fetched_at"),
                "revenue": row.get("total_revenue"),
                "net_income": row.get("net_income"),
                "eps_diluted": row.get("diluted_eps"),
                "gross_margin": None, 
                "operating_margin": None,
                "net_margin": None,
                "revenue_growth_yoy": None,
                "eps_growth_yoy": None,
            }
            # PV margins
            rev = adapted["revenue"]
            if rev:
                if row.get("gross_profit"):
                     adapted["gross_margin"] = round(row["gross_profit"] / rev, 4)
                if row.get("operating_income"):
                     adapted["operating_margin"] = round(row["operating_income"] / rev, 4)
                if adapted["net_income"]:
                     adapted["net_margin"] = round(adapted["net_income"] / rev, 4)

            # Growth (YoY)
            # If annual, i+1 is prev year. If quarterly, i+4 is prev year (same quarter).
            offset = 1 if is_annual else 4
            if i + offset < len(raw):
                prev_row = raw[i + offset]
                prev_rev = prev_row.get("total_revenue")
                prev_eps = prev_row.get("diluted_eps")
                
                if rev and prev_rev:
                     adapted["revenue_growth_yoy"] = round((rev - prev_rev) / abs(prev_rev), 4)
                
                curr_eps = adapted["eps_diluted"]
                if curr_eps is not None and prev_eps is not None and prev_eps != 0:
                     adapted["eps_growth_yoy"] = round((curr_eps - prev_eps) / abs(prev_eps), 4)
            out.append(adapted)
        return out

    def _process_balance(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for row in raw:
            period = row.get("period", "")
            equity = row.get("stockholders_equity")
            debt = row.get("total_debt")
            shares = row.get("share_issued")
            debt_to_equity = None
            if debt is not None and equity is not None and equity != 0:
                debt_to_equity = round(debt / equity, 4)

            adapted = {
                "period": period,
                "total_assets": row.get("total_assets"),
                "total_equity": equity,
                "total_debt": debt,
                "debt_to_equity": debt_to_equity,
                "shares_outstanding": shares,
            }
            out.append(adapted)
        return out

    def _process_cash_flow(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for row in raw:
            period = row.get("period", "")
            adapted = {
                "period": period,
                "free_cash_flow": row.get("free_cash_flow"),
                "operating_cash_flow": row.get("operating_cash_flow"),
                "capital_expenditure": row.get("capital_expenditure"),
            }
            out.append(adapted)
        return out

    # 1. Process Quarterly
    income = _process_income(yf_fins.get("income_statement", []), is_annual=False)
    balance = _process_balance(yf_fins.get("balance_sheet", []))
    cash_flow = _process_cash_flow(yf_fins.get("cash_flow", []))

    # 2. Process Annual
    annual_income = _process_income(yf_fins.get("annual_income_statement", []), is_annual=True)
    annual_balance = _process_balance(yf_fins.get("annual_balance_sheet", []))
    annual_cash_flow = _process_cash_flow(yf_fins.get("annual_cash_flow", []))

    return income, balance, cash_flow, annual_income, annual_balance, annual_cash_flow

def _build_quarterly(
    income_data: list[dict[str, Any]] | None,
    cash_flow_data: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Build the quarterly array from EDGAR income + cash-flow statements."""
    if not income_data:
        return []

    quarters: list[dict[str, Any]] = []
    # Use larger slice to ensure we capture enough history if needed
    for i, row in enumerate(income_data[:12]):
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

def _build_annual_eps(quarterly: list[dict[str, Any]]) -> list[float]:
    """Construct annual EPS from quarterly data by summing 4-quarter blocks.
    
    Returns a list of annual EPS values [current_year, prev_year, ...]
    """
    if not quarterly or len(quarterly) < 4:
        return []

    annual_eps: list[float] = []
    
    logger.info(f"Building Annual EPS with {len(quarterly)} quarters")
    
    # Simple aggregation: sum every 4 quarters
    for i in range(0, len(quarterly), 4):
        # Ensure we have a full year block
        if i + 4 > len(quarterly):
            logger.info(f"Skipping block starting at {i}: not enough quarters")
            break
            
        block = quarterly[i:i+4]
        eps_vals = [q.get("eps_diluted") for q in block]
        logger.info(f"Block {i}: EPS values: {eps_vals}")
        
        # Only sum if we have all 4 quarters with valid EPS
        if all(v is not None for v in eps_vals):
            total = sum(v for v in eps_vals if v is not None)
            annual_eps.append(round(total, 2))
        else:
            logger.info(f"Block {i} skipped: missing EPS data")
            
    logger.info(f"Calculated Annual EPS: {annual_eps}")
    return annual_eps

def _build_ttm(
    quarterly: list[dict[str, Any]],
    balance_data: list[dict[str, Any]] | None,
    market_data: dict[str, Any] | None,
    profile_data: dict[str, Any] | None,
    quote_data: dict[str, Any] | None,
    yf_data: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Compute trailing twelve months from the last 4 quarters."""
    if not quarterly:
        return None

    # Flow metrics: sum across available quarters (up to 4)
    recent_quarters = quarterly[:4]
    
    revenue = _safe_sum([q.get("revenue") for q in recent_quarters])
    net_income = _safe_sum([q.get("net_income") for q in recent_quarters])
    fcf = _safe_sum([q.get("free_cash_flow") for q in recent_quarters])
    eps = _safe_sum([q.get("eps_diluted") for q in recent_quarters])

    # Point-in-time from most recent quarter
    latest = quarterly[0]

    # Balance sheet ratios from latest
    debt_to_equity = None
    return_on_equity = None
    latest_bs = balance_data[0] if balance_data else None
    
    if latest_bs:
        debt_to_equity = latest_bs.get("debt_to_equity")
        equity = latest_bs.get("total_equity")
        if net_income is not None and equity is not None and equity != 0:
            return_on_equity = round(net_income / equity, 6)

    # Market Data Fallbacks
    price = quote_data.get("current_price") if quote_data else None
    if price is None and yf_data:
        price = yf_data.get("current_price")

    # 1. Shares Outstanding
    shares = None
    if profile_data and profile_data.get("shareOutstanding"):
        shares = int(profile_data["shareOutstanding"] * 1_000_000)
    elif yf_data and yf_data.get("shares_outstanding"):
        shares = yf_data.get("shares_outstanding")
    elif latest_bs and latest_bs.get("shares_outstanding"):
        try:
            shares = int(latest_bs["shares_outstanding"])
        except (ValueError, TypeError):
            pass
    
    if shares is None and net_income is not None and eps is not None and eps != 0:
        shares = int(abs(net_income / eps))

    # 2. Market Cap
    market_cap = _convert_market_cap(market_data.get("market_cap") if market_data else None)
    if market_cap is None and profile_data and profile_data.get("market_cap"):
        market_cap = _convert_market_cap(profile_data.get("market_cap"))
    if market_cap is None and yf_data and yf_data.get("market_cap"):
        market_cap = yf_data.get("market_cap")
    if market_cap is None and price is not None and shares is not None:
        market_cap = int(price * shares)

    # 3. EPS (TTM) fallback
    if (eps is None or eps == 0) and yf_data and yf_data.get("eps"):
        eps = yf_data.get("eps")
    
    if (eps is None or eps == 0) and net_income is not None and shares is not None and shares > 0:
        eps = round(net_income / shares, 2)

    # 4. P/E Ratio
    pe = market_data.get("pe_ratio") if market_data else None
    if pe is None and yf_data and yf_data.get("pe_ratio"):
        pe = yf_data.get("pe_ratio")
    if pe is None and price is not None and eps is not None and eps > 0:
        pe = round(price / eps, 2)

    # 5. Dividend Yield
    dividend_yield = _convert_dividend_yield(
        market_data.get("dividend_yield") if market_data else None,
    )
    if dividend_yield is None and yf_data and yf_data.get("dividend_yield"):
        dividend_yield = yf_data.get("dividend_yield")
        
    # Institutional Ownership
    inst_own = None
    if yf_data:
        # Debug YF keys for ownership
        # logger.info(f"YF Data keys: {list(yf_data.keys())}")
        inst_own_raw = yf_data.get("heldPercentInstitutions")
        logger.info(f"YF heldPercentInstitutions: {inst_own_raw}")
        if inst_own_raw is not None:
             inst_own = inst_own_raw
    
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
        "institutional_ownership": inst_own,
    }
    return ttm

# ---------------------------------------------------------------------------
# Main Service Function
# ---------------------------------------------------------------------------

async def get_fundamentals_data(symbol: str) -> dict[str, Any]:
    """Return aggregated fundamental financial data for *symbol*.
    
    Orchestrates EDGAR, Finnhub, and YFinance to produce a composite view.
    Includes logic for fallbacks, missing data patching, and validity checks.
    """
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
    yfinance = get_yfinance_client()

    # Fetch data from all sources (best-effort for each)
    income_data: list[dict[str, Any]] | None = None
    balance_data: list[dict[str, Any]] | None = None
    cash_flow_data: list[dict[str, Any]] | None = None
    company_info: dict[str, Any] | None = None
    market_data: dict[str, Any] | None = None
    profile_data: dict[str, Any] | None = None
    quote_data: dict[str, Any] | None = None
    yf_data: dict[str, Any] | None = None

    # EDGAR: income statement (quarterly)
    try:
        # Increase quarters to support annual calculation
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
        
    # Finnhub: quote (price for fallback derivations)
    try:
        quote_data = await finnhub.get_quote(symbol)
    except Exception:
        logger.warning("Finnhub quote fetch error for %s", symbol, exc_info=True)
        
    # Check if we are missing critical data
    missing_price = not quote_data or not quote_data.get("current_price")
    missing_mcap = (not market_data or not market_data.get("market_cap")) and (not profile_data or not profile_data.get("market_cap"))
    missing_pe = not market_data or not market_data.get("pe_ratio")
    missing_shares = not profile_data or not profile_data.get("shareOutstanding")
    
    # YFinance Fallback and Supplemental Data
    # Fetch YF info if basic data is missing OR if we want rich data (e.g. ownership)
    if missing_price or missing_mcap or missing_pe or missing_shares or True:
        try:
            yf_data = await yfinance.get_info(symbol)
        except Exception:
            logger.warning("YFinance info fetch error for %s", symbol, exc_info=True)

    # Determine company name and CIK
    company_name = None
    cik = None
    if company_info:
        company_name = company_info.get("name")
        cik = company_info.get("cik")
    if not company_name and profile_data:
        company_name = profile_data.get("name")
    if not company_name and yf_data:
        company_name = yf_data.get("name")

    # If no data from any source, 404
    has_edgar = income_data is not None and len(income_data) > 0
    has_finnhub = market_data is not None or profile_data is not None
    has_yfinance = yf_data is not None
    
    if not has_edgar and not has_finnhub and not has_yfinance:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "No data available for symbol",
                "symbol": symbol,
            },
        )

    # Determine data sources
    financials_source = "edgar" if has_edgar else "finnhub"
    market_source = "finnhub" if has_finnhub else ("yfinance" if has_yfinance else "none")

    # YFinance Financials Fallback Logic
    latest_bs = balance_data[0] if balance_data else None
    has_valid_balance = latest_bs and latest_bs.get("total_equity") is not None and latest_bs.get("debt_to_equity") is not None
    
    has_valid_cash = cash_flow_data and len(cash_flow_data) > 0 and cash_flow_data[0].get("free_cash_flow") is not None
    
    has_valid_income = income_data and len(income_data) > 0 and income_data[0].get("eps_diluted") is not None and income_data[0].get("revenue") is not None

    # Calculate initial Annual EPS from available quarterly data
    quarterly_initial = _build_quarterly(income_data, cash_flow_data)
    annual_eps_initial = _build_annual_eps(quarterly_initial)
    
    # Check if we have enough annual data (at least 2 years) for CANSLIM
    has_sufficient_annual_eps = len(annual_eps_initial) >= 2

    needs_financials = (not has_edgar) or (not has_valid_income) or (not has_valid_balance) or (not has_valid_cash) or (not has_sufficient_annual_eps)
    
    aid_yf = None

    if needs_financials:
        try:
            yf_fins = await yfinance.get_financials(symbol)
            if yf_fins:
                id_yf, bd_yf, cfd_yf, aid_yf, _, _ = _adapt_yfinance_financials(yf_fins)
                
                # Backfill logic
                if (not has_valid_income) and id_yf:
                    income_data = id_yf
                    if income_data and income_data[0].get("revenue"):
                         has_edgar = True 
                         financials_source = "yfinance"
                
                if (not has_valid_balance) and bd_yf:
                     balance_data = bd_yf
                
                if (not has_valid_cash) and cfd_yf:
                     cash_flow_data = cfd_yf
        except Exception:
             logger.warning("YFinance financials fallback failed for %s", symbol, exc_info=True)

    # Build aggregates
    quarterly = _build_quarterly(income_data, cash_flow_data)
    ttm = _build_ttm(quarterly, balance_data, market_data, profile_data, quote_data, yf_data)
    annual_eps = _build_annual_eps(quarterly)

    # If using YFinance fallback OR if primary source yielded insufficient annual data
    # we try to use YF annuals if available and better.
    if aid_yf and (financials_source == "yfinance" or not has_sufficient_annual_eps):
        # aid_yf is list[dict] of ANNUAL reports from YFinance (see _adapt_yfinance_financials)
        # Extract eps_diluted directly from these annual reports
        y_eps = [x.get("eps_diluted") for x in aid_yf if x.get("eps_diluted") is not None]
        
        # Only override if we have meaningful data (at least 2 years) and it's better/longer than current
        # Or if current is insufficient (< 2 years) and YF has at least 2 years
        if len(y_eps) >= 2 and (len(y_eps) > len(annual_eps) or not has_sufficient_annual_eps):
             logger.info(f"Replacing insufficient EDGAR Annual EPS ({len(annual_eps)}) with YFinance data ({len(y_eps)})")
             annual_eps = y_eps

    # Final fallback if TTM missing entirely
    if ttm is None and not quarterly:
        # Construct basic TTM from market data if possible
        price = quote_data.get("current_price") if quote_data else None
        
        mcap = _convert_market_cap(market_data.get("market_cap") if market_data else None)
        if mcap is None and profile_data and profile_data.get("market_cap"):
             mcap = _convert_market_cap(profile_data.get("market_cap"))
        if mcap is None and yf_data and yf_data.get("market_cap"):
             mcap = yf_data.get("market_cap")

        pe = market_data.get("pe_ratio") if market_data else None
        eps = market_data.get("eps") if market_data else None
        
        if pe is None and price and eps and eps > 0:
            pe = round(price / eps, 2)
            
        ttm = {
            "revenue": None,
            "net_income": None,
            "eps_diluted": eps,
            "gross_margin": None,
            "operating_margin": None,
            "net_margin": None,
            "pe_ratio": pe,
            "market_cap": mcap,
            "shares_outstanding": None,
            "free_cash_flow": None,
            "debt_to_equity": None,
            "return_on_equity": None,
            "dividend_yield": _convert_dividend_yield(market_data.get("dividend_yield") if market_data else None),
            "institutional_ownership": None,
        }

    now = datetime.now(timezone.utc).isoformat()
    result: dict[str, Any] = {
        "symbol": symbol,
        "company_name": company_name,
        "cik": cik,
        "ttm": ttm,
        "quarterly": quarterly,
        "annual_eps": annual_eps, # Added for CANSLIM
        "institutional_ownership": ttm.get("institutional_ownership") if ttm else None,
        "next_earnings_date": None,
        "data_sources": {
            "financials": financials_source,
            "market_data": market_source,
        },
        "data_timestamp": now,
    }

    if not has_edgar:
        result["note"] = "No SEC filings found. Showing market data only."

    return result
