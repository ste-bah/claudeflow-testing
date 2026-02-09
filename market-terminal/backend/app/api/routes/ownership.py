"""Ownership routes -- institutional holders (13F) and insider transactions (Form 4).

GET /api/ownership/{symbol}  returns top institutional holders from SEC 13F filings.
GET /api/insider/{symbol}    returns insider transactions from SEC Form 4 filings.

Both use SEC EDGAR as the data source via the EdgarOwnershipClient.

Full implementation: TASK-API-005
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.edgar_ownership import get_ownership_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ownership", tags=["ownership"])
insider_router = APIRouter(prefix="/api/insider", tags=["insider"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_VALID_SORT_FIELDS = {"shares", "value", "change"}
_MAX_HOLDER_LIMIT = 100
_DEFAULT_HOLDER_LIMIT = 25
_MAX_INSIDER_LIMIT = 200
_DEFAULT_INSIDER_LIMIT = 50
_MAX_INSIDER_DAYS = 365
_DEFAULT_INSIDER_DAYS = 90
_VALID_TX_TYPES = {"buy", "sell", "all"}


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


def _format_holder(raw: dict[str, Any], shares_outstanding: int | None) -> dict[str, Any]:
    """Normalize a raw holder dict into the API response format.

    Note: *shares_outstanding* is not yet wired to a data source;
    ``percent_of_outstanding`` will be ``None`` until it is.
    """
    raw_shares = raw.get("shares")
    shares = raw_shares if raw_shares is not None else 0
    raw_value = raw.get("value_usd")
    value = raw_value if raw_value is not None else 0
    pct = None
    if shares_outstanding is not None and shares_outstanding > 0:
        pct = round(shares / shares_outstanding * 100, 2)
    return {
        "holder_name": raw.get("holder_name", "Unknown"),
        "cik": raw.get("cik"),
        "shares": shares,
        "value": int(value),
        "percent_of_outstanding": pct,
        "change_shares": raw.get("change_shares"),
        "change_percent": raw.get("change_percent"),
        "filing_date": raw.get("filing_date"),
    }


def _compute_qoq(holders: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute quarter-over-quarter position changes from holder data."""
    new_positions = 0
    increased = 0
    decreased = 0
    closed = 0
    net_change = 0

    for h in holders:
        change = h.get("change_shares")
        if change is None:
            continue
        if isinstance(change, (int, float)):
            net_change += int(change)
            if change > 0:
                increased += 1
            elif change < 0:
                decreased += 1

    return {
        "new_positions": new_positions,
        "increased_positions": increased,
        "decreased_positions": decreased,
        "closed_positions": closed,
        "net_shares_change": net_change,
    }


def _format_insider_tx(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw insider transaction dict into the API response format."""
    raw_shares = raw.get("shares")
    shares = raw_shares if raw_shares is not None else 0
    price = raw.get("price_per_share")
    total_value = raw.get("total_value")
    if total_value is None and price is not None and shares is not None:
        total_value = int(abs(shares * price))
    return {
        "insider_name": raw.get("insider_name", "Unknown"),
        "title": raw.get("insider_title"),
        "transaction_type": _map_tx_type(raw.get("transaction_type", "")),
        "transaction_date": raw.get("transaction_date"),
        "shares": abs(shares),
        "price_per_share": price,
        "total_value": int(total_value) if total_value is not None else None,
        "shares_remaining": raw.get("shares_owned_after"),
        "filing_date": raw.get("filing_date"),
        "filing_url": None,
    }


def _map_tx_type(raw_type: str) -> str:
    """Map internal transaction type to spec format."""
    mapping = {
        "buy": "P-Purchase",
        "sell": "S-Sale",
        "exercise": "M-Exercise",
        "gift": "G-Gift",
        "grant": "A-Grant",
        "tax_withholding": "F-Tax",
    }
    return mapping.get(raw_type, raw_type)


def _compute_insider_summary(
    transactions: list[dict[str, Any]], days: int
) -> dict[str, Any]:
    """Compute the insider activity summary from formatted transactions."""
    buys = [t for t in transactions if "Purchase" in (t.get("transaction_type") or "")]
    sells = [t for t in transactions if "Sale" in (t.get("transaction_type") or "")]

    total_buy_value = sum(t.get("total_value") or 0 for t in buys)
    total_sell_value = sum(t.get("total_value") or 0 for t in sells)

    if total_sell_value == 0 and total_buy_value == 0:
        activity = "neutral"
    elif total_sell_value == 0:
        activity = "net_buying"
    elif total_buy_value == 0:
        activity = "net_selling"
    else:
        ratio = total_buy_value / total_sell_value
        if ratio > 1.1:
            activity = "net_buying"
        elif ratio < 0.9:
            activity = "net_selling"
        else:
            activity = "neutral"

    buy_sell_ratio = 0.0
    if total_sell_value > 0:
        buy_sell_ratio = round(total_buy_value / total_sell_value, 3)

    return {
        "period_days": days,
        "total_insider_buys": len(buys),
        "total_insider_sells": len(sells),
        "total_buy_value": total_buy_value,
        "total_sell_value": total_sell_value,
        "net_activity": activity,
        "buy_sell_ratio": buy_sell_ratio,
    }


# ---------------------------------------------------------------------------
# Ownership endpoint (13F institutional holders)
# ---------------------------------------------------------------------------

@router.get("/{symbol}")
async def get_ownership(
    symbol: str,
    limit: int = Query(default=_DEFAULT_HOLDER_LIMIT, ge=1, le=_MAX_HOLDER_LIMIT),
    quarter: str | None = Query(default=None, pattern=r"^\d{4}-Q[1-4]$"),
    sort: str = Query(default="value"),
) -> dict[str, Any]:
    """Return institutional holders for *symbol* from SEC 13F filings."""
    symbol = _validate_symbol(symbol)

    if sort not in _VALID_SORT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort field. Must be one of: {', '.join(sorted(_VALID_SORT_FIELDS))}",
        )

    ownership_client = get_ownership_client()

    # Determine quarters to search
    quarters = 4
    if quarter:
        quarters = 1  # specific quarter requested

    try:
        data = await ownership_client.get_institutional_holders(symbol, quarters=quarters)
    except Exception:
        logger.warning("Ownership fetch error for %s", symbol, exc_info=True)
        raise HTTPException(status_code=502, detail="EDGAR service unavailable")

    now = datetime.now(timezone.utc).isoformat()

    if data is None:
        # No data — return empty holders with note
        return {
            "symbol": symbol,
            "filing_period": quarter,
            "total_institutional_shares": 0,
            "total_institutional_value": 0,
            "institutional_ownership_percent": None,
            "holders": [],
            "quarter_over_quarter": {
                "new_positions": 0,
                "increased_positions": 0,
                "decreased_positions": 0,
                "closed_positions": 0,
                "net_shares_change": 0,
            },
            "data_source": "edgar_13f",
            "data_timestamp": now,
            "note": "No institutional ownership filings found",
        }

    raw_holders = data.get("holders", [])

    # Format holders
    holders = [_format_holder(h, shares_outstanding=None) for h in raw_holders]

    # Sort
    sort_key_map = {
        "shares": lambda h: h.get("shares") or 0,
        "value": lambda h: h.get("value") or 0,
        "change": lambda h: abs(h.get("change_shares") or 0),
    }
    holders.sort(key=sort_key_map[sort], reverse=True)

    # Limit
    holders = holders[:limit]

    # Aggregates
    total_shares = data.get("total_institutional_shares", 0)
    total_value = data.get("total_institutional_value", 0)

    # QoQ changes
    qoq = _compute_qoq(raw_holders)

    # Filing period (most recent report_period from holders)
    periods = [h.get("report_period") for h in raw_holders if h.get("report_period")]
    filing_period = max(periods) if periods else quarter

    return {
        "symbol": symbol,
        "filing_period": filing_period,
        "total_institutional_shares": total_shares,
        "total_institutional_value": int(total_value),
        "institutional_ownership_percent": None,
        "holders": holders,
        "quarter_over_quarter": qoq,
        "data_source": "edgar_13f",
        "data_timestamp": now,
        "note": "13F data is reported quarterly with a 45-day delay",
    }


# ---------------------------------------------------------------------------
# Insider endpoint (Form 4 transactions)
# ---------------------------------------------------------------------------

@insider_router.get("/{symbol}")
async def get_insider(
    symbol: str,
    days: int = Query(default=_DEFAULT_INSIDER_DAYS, ge=1, le=_MAX_INSIDER_DAYS),
    tx_type: str = Query(default="all", alias="type"),
    limit: int = Query(default=_DEFAULT_INSIDER_LIMIT, ge=1, le=_MAX_INSIDER_LIMIT),
) -> dict[str, Any]:
    """Return insider transactions for *symbol* from SEC Form 4 filings."""
    symbol = _validate_symbol(symbol)

    if tx_type not in _VALID_TX_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type filter. Must be one of: {', '.join(sorted(_VALID_TX_TYPES))}",
        )

    ownership_client = get_ownership_client()

    try:
        data = await ownership_client.get_insider_transactions(symbol, days=days)
    except Exception:
        logger.warning("Insider fetch error for %s", symbol, exc_info=True)
        raise HTTPException(status_code=502, detail="EDGAR service unavailable")

    now = datetime.now(timezone.utc).isoformat()

    if data is None:
        # No data — return empty transactions with zeroed summary
        return {
            "symbol": symbol,
            "transactions": [],
            "summary": _compute_insider_summary([], days),
            "data_source": "edgar_form4",
            "data_timestamp": now,
        }

    raw_txns = data.get("transactions", [])

    # Format transactions
    transactions = [_format_insider_tx(t) for t in raw_txns]

    # Filter by type
    if tx_type == "buy":
        transactions = [t for t in transactions if "Purchase" in (t.get("transaction_type") or "")]
    elif tx_type == "sell":
        transactions = [t for t in transactions if "Sale" in (t.get("transaction_type") or "")]

    # Sort by date descending
    transactions.sort(
        key=lambda t: t.get("transaction_date") or "", reverse=True
    )

    # Limit
    all_for_summary = list(transactions)  # summary uses all before limit
    transactions = transactions[:limit]

    # Summary
    summary = _compute_insider_summary(all_for_summary, days)

    return {
        "symbol": symbol,
        "transactions": transactions,
        "summary": summary,
        "data_source": "edgar_form4",
        "data_timestamp": now,
    }
