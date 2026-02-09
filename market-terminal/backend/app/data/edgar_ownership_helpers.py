"""Helper utilities for the EDGAR ownership client.

Contains cache helpers, response builders, Form 4 parsing, and constants
used by :mod:`app.data.edgar_ownership`.

Split from edgar_ownership.py to comply with the 500-line file limit.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
INSIDER_CACHE_TTL = 14400   # 4 hours for Form 4
HOLDER_CACHE_TTL = 86400    # 24 hours for 13F
MAX_EFTS_RESULTS = 50
MAX_FILINGS_PER_SEARCH = 30

# Transaction code to human-readable type mapping
TX_CODE_MAP: dict[str, str] = {
    "P": "buy",
    "S": "sell",
    "M": "exercise",
    "G": "gift",
    "F": "tax_withholding",
    "A": "grant",
    "D": "disposition_to_issuer",
    "C": "conversion",
}

# In-memory CUSIP cache (populated from EFTS results)
CUSIP_CACHE: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def tag(data: dict | list, cached: bool = False) -> dict | list:
    """Attach ``_source``, ``_fetched_at``, ``_cached`` metadata."""
    now = now_iso()
    items = [data] if isinstance(data, dict) else (data if isinstance(data, list) else [])
    for item in items:
        if isinstance(item, dict):
            item.update({"_source": "edgar", "_fetched_at": now, "_cached": cached})
    return data


def quarter_start(quarters_back: int) -> str:
    """Return ISO date string for the start of the quarter N quarters ago."""
    now = datetime.now(timezone.utc)
    month = now.month - 3 * quarters_back
    year = now.year
    while month <= 0:
        month += 12
        year -= 1
    q_month = ((month - 1) // 3) * 3 + 1
    return f"{year}-{q_month:02d}-01"


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------
async def get_cached_holders(symbol: str) -> list[dict[str, Any]] | None:
    """Return cached ownership_cache rows if fresh (within TTL)."""
    db = await get_database()
    rows = await db.fetch_all(
        "SELECT * FROM ownership_cache WHERE symbol = ? AND source = 'edgar_13f' "
        "ORDER BY report_period DESC, shares DESC",
        (symbol.upper(),),
    )
    if not rows:
        return None
    try:
        fetched_str = rows[0].get("fetched_at", "")
        fetched_dt = datetime.fromisoformat(fetched_str)
        if fetched_dt.tzinfo is None:
            fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
        if age > HOLDER_CACHE_TTL:
            return None
    except (ValueError, TypeError):
        return None
    return rows


async def store_holders(symbol: str, holders: list[dict[str, Any]]) -> None:
    """Upsert holders into ownership_cache."""
    if not holders:
        return
    db = await get_database()
    await db.executemany(
        "INSERT OR REPLACE INTO ownership_cache "
        "(symbol, holder_name, shares, value_usd, change_shares, "
        "change_percent, filing_date, report_period, source) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'edgar_13f')",
        [
            (
                symbol.upper(),
                h["holder_name"],
                h.get("shares"),
                h.get("value_usd"),
                h.get("change_shares"),
                h.get("change_percent"),
                h.get("filing_date", ""),
                h.get("report_period", ""),
            )
            for h in holders
        ],
    )


async def get_cached_insiders(
    symbol: str, days: int
) -> list[dict[str, Any]] | None:
    """Return cached insider_transactions if fresh (within TTL)."""
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=days)
    ).strftime("%Y-%m-%d")
    db = await get_database()
    rows = await db.fetch_all(
        "SELECT * FROM insider_transactions "
        "WHERE symbol = ? AND source = 'edgar_form4' "
        "AND transaction_date >= ? "
        "ORDER BY transaction_date DESC",
        (symbol.upper(), cutoff),
    )
    if not rows:
        return None
    try:
        fetched_str = rows[0].get("fetched_at", "")
        fetched_dt = datetime.fromisoformat(fetched_str)
        if fetched_dt.tzinfo is None:
            fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
        if age > INSIDER_CACHE_TTL:
            return None
    except (ValueError, TypeError):
        return None
    return rows


async def store_insiders(
    symbol: str, transactions: list[dict[str, Any]]
) -> None:
    """Upsert into insider_transactions."""
    if not transactions:
        return
    db = await get_database()
    await db.executemany(
        "INSERT OR REPLACE INTO insider_transactions "
        "(symbol, insider_name, insider_title, transaction_type, shares, "
        "price_per_share, total_value, shares_owned_after, "
        "transaction_date, filing_date, source) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'edgar_form4')",
        [
            (
                symbol.upper(),
                t["insider_name"],
                t.get("insider_title"),
                t["transaction_type"],
                t["shares"],
                t.get("price_per_share"),
                t.get("total_value"),
                t.get("shares_owned_after"),
                t["transaction_date"],
                t.get("filing_date", ""),
            )
            for t in transactions
        ],
    )


# ---------------------------------------------------------------------------
# Response builders
# ---------------------------------------------------------------------------
def build_holders_response(
    symbol: str, holders: list[dict[str, Any]]
) -> dict[str, Any]:
    """Build the structured response dict from a holders list."""
    holders_sorted = sorted(
        holders, key=lambda h: h.get("shares") or 0, reverse=True
    )
    total_shares = sum(h.get("shares") or 0 for h in holders_sorted)
    total_value = sum(h.get("value_usd") or 0 for h in holders_sorted)
    return {
        "symbol": symbol,
        "holders": holders_sorted,
        "total_institutional_shares": total_shares,
        "total_institutional_value": total_value,
        "num_holders": len(holders_sorted),
    }


def build_insider_response(
    symbol: str, transactions: list[dict[str, Any]]
) -> dict[str, Any]:
    """Build structured insider transaction response with summary."""
    buys = [t for t in transactions if t["transaction_type"] == "buy"]
    sells = [t for t in transactions if t["transaction_type"] == "sell"]

    total_buy_shares = sum(t.get("shares") or 0 for t in buys)
    total_sell_shares = sum(t.get("shares") or 0 for t in sells)
    total_buy_value = sum(t.get("total_value") or 0 for t in buys)
    total_sell_value = sum(t.get("total_value") or 0 for t in sells)
    net_shares = total_buy_shares - total_sell_shares
    net_value = total_buy_value - total_sell_value

    unique_buyers = {t["insider_name"] for t in buys}
    unique_sellers = {t["insider_name"] for t in sells}

    return {
        "symbol": symbol,
        "transactions": transactions,
        "summary": {
            "total_transactions": len(transactions),
            "total_buys": len(buys),
            "total_sells": len(sells),
            "total_buy_shares": total_buy_shares,
            "total_sell_shares": total_sell_shares,
            "total_buy_value": total_buy_value,
            "total_sell_value": total_sell_value,
            "net_shares": net_shares,
            "net_value": net_value,
            "unique_insiders_buying": len(unique_buyers),
            "unique_insiders_selling": len(unique_sellers),
        },
    }


# ---------------------------------------------------------------------------
# Form 4 parsing (sync, called via asyncio.to_thread)
# ---------------------------------------------------------------------------
def parse_form4_sync(filing: Any) -> dict[str, Any] | None:
    """Parse a single Form 4 filing into a structured dict (synchronous).

    Returns dict with insider_name, insider_title, and transactions list,
    or None on failure.
    """
    try:
        obj = filing.data_object()
    except Exception:
        return None
    if obj is None:
        return None

    insider_name = getattr(obj, "insider_name", None) or "Unknown"
    insider_title = None
    transactions: list[dict[str, Any]] = []

    # Get ownership summary for position info
    try:
        summary = obj.get_ownership_summary()
        if summary is not None:
            insider_title = getattr(summary, "position", None)
    except Exception:
        pass

    # Get transaction activities
    try:
        activities = obj.get_transaction_activities()
        if activities:
            for act in activities:
                code = getattr(act, "code", "") or ""
                tx_type = TX_CODE_MAP.get(
                    code.upper(), code.lower() or "unknown"
                )
                shares = _extract_shares(act)
                value = _extract_value(act)
                price = _extract_price(act)

                transactions.append({
                    "transaction_type": tx_type,
                    "code": code.upper(),
                    "shares": abs(shares) if shares else 0,
                    "total_value": abs(value) if value else None,
                    "price_per_share": price,
                    "security_title": getattr(act, "security_title", None),
                })
    except Exception as exc:
        logger.debug("Form4 activity parse error: %s", exc)

    if not transactions:
        return None

    return {
        "insider_name": insider_name,
        "insider_title": insider_title,
        "transactions": transactions,
    }


def _extract_shares(act: Any) -> int:
    """Extract share count from a TransactionActivity."""
    shares = getattr(act, "shares_numeric", None)
    if shares is None:
        shares = getattr(act, "shares", None)
        if shares is not None:
            try:
                shares = int(str(shares).replace(",", ""))
            except (ValueError, TypeError):
                shares = 0
    else:
        shares = int(shares)
    return shares or 0


def _extract_value(act: Any) -> float | None:
    """Extract dollar value from a TransactionActivity."""
    value = getattr(act, "value_numeric", None)
    if value is None:
        value = getattr(act, "value", None)
        if value is not None:
            try:
                value = float(str(value).replace(",", "").replace("$", ""))
            except (ValueError, TypeError):
                value = None
    return value


def _extract_price(act: Any) -> float | None:
    """Extract price per share from a TransactionActivity."""
    price = getattr(act, "price_numeric", None)
    if price is None:
        price = getattr(act, "price_per_share", None)
        if price is not None:
            try:
                price = float(str(price).replace(",", "").replace("$", ""))
            except (ValueError, TypeError):
                price = None
    return price
