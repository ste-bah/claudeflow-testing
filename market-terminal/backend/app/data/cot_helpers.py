"""Helper utilities for the CFTC COT data client.

Contains constants, market mappings, CSV parsing functions, cache helpers,
Williams COT index calculation, and response builders used by
:mod:`app.data.cot_client`.

Split from cot_client.py to comply with the 500-line file limit.
"""
from __future__ import annotations

import io
import logging
import zipfile
from datetime import datetime, timezone
from typing import Any

from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CFTC_CURRENT_URL: str = "https://www.cftc.gov/dea/newcot/deafut.txt"
CFTC_HISTORICAL_URL_TEMPLATE: str = (
    "https://www.cftc.gov/files/dea/history/deacot{year}.zip"
)
COT_CACHE_SOURCE: str = "cftc"

# Signal thresholds
EXTREME_BULLISH_THRESHOLD: int = 80
EXTREME_BEARISH_THRESHOLD: int = 20
DEFAULT_LOOKBACK_WEEKS: int = 52

# ---------------------------------------------------------------------------
# Market name mapping -- CFTC names to common symbols
# ---------------------------------------------------------------------------
COT_MARKET_MAP: dict[str, dict[str, str]] = {
    # Metals
    "GOLD - COMEX": {"symbol": "GC", "display": "Gold", "asset_class": "commodity"},
    "SILVER - COMEX": {"symbol": "SI", "display": "Silver", "asset_class": "commodity"},
    "COPPER-GRADE #1 - COMEX": {"symbol": "HG", "display": "Copper", "asset_class": "commodity"},
    "PLATINUM - NYMEX": {"symbol": "PL", "display": "Platinum", "asset_class": "commodity"},
    # Energy
    "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE": {
        "symbol": "CL", "display": "Crude Oil (WTI)", "asset_class": "commodity",
    },
    "NATURAL GAS - NEW YORK MERCANTILE EXCHANGE": {
        "symbol": "NG", "display": "Natural Gas", "asset_class": "commodity",
    },
    # Agriculture
    "CORN - CHICAGO BOARD OF TRADE": {"symbol": "ZC", "display": "Corn", "asset_class": "commodity"},
    "SOYBEANS - CHICAGO BOARD OF TRADE": {"symbol": "ZS", "display": "Soybeans", "asset_class": "commodity"},
    "WHEAT-SRW - CHICAGO BOARD OF TRADE": {"symbol": "ZW", "display": "Wheat", "asset_class": "commodity"},
    # Currencies
    "EURO FX - CHICAGO MERCANTILE EXCHANGE": {"symbol": "6E", "display": "EUR/USD", "asset_class": "forex"},
    "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE": {"symbol": "6J", "display": "USD/JPY", "asset_class": "forex"},
    "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE": {"symbol": "6B", "display": "GBP/USD", "asset_class": "forex"},
    # Indices
    "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE": {"symbol": "ES", "display": "S&P 500", "asset_class": "index"},
    "NASDAQ-100 STOCK INDEX (MINI) - CHICAGO MERCANTILE EXCHANGE": {
        "symbol": "NQ", "display": "Nasdaq 100", "asset_class": "index",
    },
    "DJIA x $5 - CHICAGO BOARD OF TRADE": {"symbol": "YM", "display": "Dow Jones", "asset_class": "index"},
    # Bonds
    "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE": {
        "symbol": "ZN", "display": "10Y Treasury", "asset_class": "bond",
    },
    "U.S. TREASURY BONDS - CHICAGO BOARD OF TRADE": {
        "symbol": "ZB", "display": "30Y Treasury", "asset_class": "bond",
    },
}

# ---------------------------------------------------------------------------
# ETF to futures mapping
# ---------------------------------------------------------------------------
ETF_TO_FUTURES: dict[str, str] = {
    "GLD": "GOLD - COMEX",
    "SLV": "SILVER - COMEX",
    "USO": "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",
    "UNG": "NATURAL GAS - NEW YORK MERCANTILE EXCHANGE",
    "SPY": "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE",
    "QQQ": "NASDAQ-100 STOCK INDEX (MINI) - CHICAGO MERCANTILE EXCHANGE",
    "DIA": "DJIA x $5 - CHICAGO BOARD OF TRADE",
    "TLT": "U.S. TREASURY BONDS - CHICAGO BOARD OF TRADE",
    "FXE": "EURO FX - CHICAGO MERCANTILE EXCHANGE",
    "FXY": "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
    "FXB": "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
    "CORN": "CORN - CHICAGO BOARD OF TRADE",
    "WEAT": "WHEAT-SRW - CHICAGO BOARD OF TRADE",
    "SOYB": "SOYBEANS - CHICAGO BOARD OF TRADE",
    "CPER": "COPPER-GRADE #1 - COMEX",
    "PPLT": "PLATINUM - NYMEX",
}

# Reverse mapping: futures symbol -> CFTC market name
SYMBOL_TO_CFTC: dict[str, str] = {
    info["symbol"]: cftc_name
    for cftc_name, info in COT_MARKET_MAP.items()
}


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def tag(data: dict | list, *, cached: bool = False) -> dict | list:
    """Attach ``_source``, ``_fetched_at``, ``_cached`` metadata."""
    now = now_iso()
    items = [data] if isinstance(data, dict) else (data if isinstance(data, list) else [])
    for item in items:
        if isinstance(item, dict):
            item.update({"_source": "cftc", "_fetched_at": now, "_cached": cached})
    return data


def resolve_market_name(symbol: str) -> str | None:
    """Resolve a user-provided symbol to a CFTC market name.

    Checks: ETF_TO_FUTURES, SYMBOL_TO_CFTC, then direct COT_MARKET_MAP keys.
    """
    upper = symbol.upper().strip()
    # ETF mapping (GLD -> GOLD - COMEX)
    if upper in ETF_TO_FUTURES:
        return ETF_TO_FUTURES[upper]
    # Futures symbol (GC -> GOLD - COMEX)
    if upper in SYMBOL_TO_CFTC:
        return SYMBOL_TO_CFTC[upper]
    # Direct CFTC name match
    for key in COT_MARKET_MAP:
        if key.upper() == upper:
            return key
    return None


def get_market_info(market_name: str) -> dict[str, str] | None:
    """Return ``{symbol, display, asset_class}`` for a CFTC market name."""
    return COT_MARKET_MAP.get(market_name)


# ---------------------------------------------------------------------------
# Williams COT Index calculation
# ---------------------------------------------------------------------------
def calculate_cot_index(
    net_positions: list[int],
    lookback: int = DEFAULT_LOOKBACK_WEEKS,
) -> float:
    """Calculate the COT index (0-100) using Larry Williams' formula.

    ``((current - min) / (max - min)) * 100`` over the most recent
    *lookback* values.  Returns 50.0 on edge cases (empty, single value,
    or all-identical values to avoid division by zero).
    """
    if not net_positions:
        return 50.0
    window = net_positions[-lookback:]
    if len(window) < 2:
        return 50.0
    current = window[-1]
    lo = min(window)
    hi = max(window)
    if hi == lo:
        return 50.0
    raw = ((current - lo) / (hi - lo)) * 100.0
    return max(0.0, min(100.0, raw))


# ---------------------------------------------------------------------------
# CSV parsing (synchronous, for asyncio.to_thread)
# ---------------------------------------------------------------------------
def parse_cot_csv_sync(csv_text: str) -> list[dict[str, Any]]:
    """Parse CFTC legacy short-format futures-only CSV text.

    Returns list of dicts for markets found in COT_MARKET_MAP.
    Returns empty list on any parse failure.
    """
    try:
        import pandas as pd
    except ImportError:
        logger.warning("pandas not installed -- cannot parse COT CSV")
        return []
    try:
        df = pd.read_csv(io.StringIO(csv_text), low_memory=False)
    except Exception as exc:
        logger.warning("COT CSV parse error: %s", exc)
        return []
    # Normalize column names: strip whitespace
    df.columns = [c.strip() for c in df.columns]
    # Identify the market name column
    name_col = _find_column(df, ["Market_and_Exchange_Names", "Market and Exchange Names"])
    date_col = _find_column(df, ["As_of_Date_In_Form_YYMMDD", "As of Date in Form YYMMDD"])
    if name_col is None or date_col is None:
        logger.warning("COT CSV missing required columns (name=%s, date=%s)", name_col, date_col)
        return []
    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        market_raw = str(row[name_col]).strip()
        if market_raw not in COT_MARKET_MAP:
            continue
        report_date = _parse_cftc_date(row[date_col])
        if report_date is None:
            continue
        info = COT_MARKET_MAP[market_raw]
        comm_long = _safe_int(row, ["Comml_Positions_Long_All", "Commercial Positions-Long (All)"])
        comm_short = _safe_int(row, ["Comml_Positions_Short_All", "Commercial Positions-Short (All)"])
        spec_long = _safe_int(row, ["NonComml_Positions_Long_All", "Noncommercial Positions-Long (All)"])
        spec_short = _safe_int(row, ["NonComml_Positions_Short_All", "Noncommercial Positions-Short (All)"])
        small_long = _safe_int(row, ["NonRept_Positions_Long_All", "Nonreportable Positions-Long (All)"])
        small_short = _safe_int(row, ["NonRept_Positions_Short_All", "Nonreportable Positions-Short (All)"])
        oi = _safe_int(row, ["Open_Interest_All", "Open Interest (All)"])
        oi_change = _safe_int(row, ["Change_in_Open_Interest_All", "Change in Open Interest (All)"])
        comm_long_chg = _safe_int(row, ["Change_in_Comml_Long_All", "Change in Commercial-Long (All)"])
        comm_short_chg = _safe_int(row, ["Change_in_Comml_Short_All", "Change in Commercial-Short (All)"])
        spec_long_chg = _safe_int(row, ["Change_in_NonComml_Long_All", "Change in Noncommercial-Long (All)"])
        spec_short_chg = _safe_int(row, ["Change_in_NonComml_Short_All", "Change in Noncommercial-Short (All)"])
        records.append({
            "market_name": market_raw,
            "symbol": info["symbol"],
            "display_name": info["display"],
            "asset_class": info["asset_class"],
            "report_date": report_date,
            "commercial_long": comm_long,
            "commercial_short": comm_short,
            "commercial_net": comm_long - comm_short,
            "commercial_change": (comm_long_chg or 0) - (comm_short_chg or 0),
            "speculative_long": spec_long,
            "speculative_short": spec_short,
            "speculative_net": spec_long - spec_short,
            "speculative_change": (spec_long_chg or 0) - (spec_short_chg or 0),
            "small_trader_long": small_long,
            "small_trader_short": small_short,
            "small_trader_net": small_long - small_short,
            "open_interest": oi,
            "open_interest_change": oi_change or 0,
        })
    return records


def _find_column(df: Any, candidates: list[str]) -> str | None:
    """Return the first column name from *candidates* that exists in *df*."""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _parse_cftc_date(raw: Any) -> str | None:
    """Convert CFTC date (YYMMDD int or string) to YYYY-MM-DD."""
    try:
        import pandas as pd
        dt = pd.to_datetime(str(int(raw)), format="%y%m%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def _safe_int(row: Any, candidates: list[str]) -> int:
    """Extract an integer from *row* trying multiple column names."""
    import pandas as pd
    for col in candidates:
        try:
            val = row[col]
            if pd.notna(val):
                return int(val)
        except (KeyError, ValueError, TypeError):
            continue
    return 0


def extract_csv_from_zip_sync(zip_bytes: bytes) -> str | None:
    """Extract the first .txt/.csv from a CFTC historical ZIP archive."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in zf.namelist():
                if name.lower().endswith((".txt", ".csv")):
                    return zf.read(name).decode("utf-8", errors="replace")
    except (zipfile.BadZipFile, Exception) as exc:
        logger.warning("COT ZIP extraction error: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Cache helpers (cot_data table)
# ---------------------------------------------------------------------------
async def get_cached_cot_data(
    market_name: str, weeks: int, cache_ttl: int,
) -> list[dict[str, Any]] | None:
    """Return cached COT rows for *market_name* if fresh (within TTL)."""
    db = await get_database()
    rows = await db.fetch_all(
        "SELECT market_name, report_date, commercial_long, commercial_short, "
        "commercial_net, speculative_long, speculative_short, speculative_net, "
        "open_interest, fetched_at FROM cot_data "
        "WHERE market_name = ? AND source = 'cftc' "
        "ORDER BY report_date DESC LIMIT ?",
        (market_name, weeks),
    )
    if not rows:
        return None
    try:
        fetched_dt = datetime.fromisoformat(rows[0]["fetched_at"])
        if fetched_dt.tzinfo is None:
            fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
        if age > cache_ttl:
            return None
    except (ValueError, TypeError):
        return None
    return rows


async def get_cached_current_report(cache_ttl: int) -> list[dict[str, Any]] | None:
    """Return all cached rows for the most recent report_date if fresh."""
    db = await get_database()
    latest = await db.fetch_one(
        "SELECT report_date, fetched_at FROM cot_data "
        "WHERE source = 'cftc' ORDER BY report_date DESC LIMIT 1",
        (),
    )
    if latest is None:
        return None
    try:
        fetched_dt = datetime.fromisoformat(latest["fetched_at"])
        if fetched_dt.tzinfo is None:
            fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - fetched_dt).total_seconds()
        if age > cache_ttl:
            return None
    except (ValueError, TypeError):
        return None
    rows = await db.fetch_all(
        "SELECT market_name, report_date, commercial_long, commercial_short, "
        "commercial_net, speculative_long, speculative_short, speculative_net, "
        "open_interest, fetched_at FROM cot_data "
        "WHERE report_date = ? AND source = 'cftc'",
        (latest["report_date"],),
    )
    return rows if rows else None


async def store_cot_rows(rows: list[dict[str, Any]]) -> None:
    """Upsert parsed COT rows into ``cot_data``."""
    if not rows:
        return
    db = await get_database()
    now = now_iso()
    await db.executemany(
        "INSERT OR REPLACE INTO cot_data "
        "(market_name, report_date, commercial_long, commercial_short, "
        "commercial_net, speculative_long, speculative_short, speculative_net, "
        "open_interest, source, fetched_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cftc', ?)",
        [
            (
                r["market_name"], r["report_date"],
                r.get("commercial_long", 0), r.get("commercial_short", 0),
                r.get("commercial_net", 0),
                r.get("speculative_long", 0), r.get("speculative_short", 0),
                r.get("speculative_net", 0),
                r.get("open_interest", 0), now,
            )
            for r in rows
        ],
    )


# ---------------------------------------------------------------------------
# Response builders
# ---------------------------------------------------------------------------
def build_report_entry(
    row: dict[str, Any],
    *,
    commercial_index: float | None = None,
    speculative_index: float | None = None,
) -> dict[str, Any]:
    """Build a single COT report entry dict from a parsed/cached row."""
    info = get_market_info(row["market_name"])
    return {
        "market_name": row["market_name"],
        "symbol": info["symbol"] if info else None,
        "display_name": info["display"] if info else None,
        "asset_class": info["asset_class"] if info else None,
        "report_date": row["report_date"],
        "commercial_long": row.get("commercial_long", 0),
        "commercial_short": row.get("commercial_short", 0),
        "commercial_net": row.get("commercial_net", 0),
        "commercial_change": row.get("commercial_change", 0),
        "speculative_long": row.get("speculative_long", 0),
        "speculative_short": row.get("speculative_short", 0),
        "speculative_net": row.get("speculative_net", 0),
        "speculative_change": row.get("speculative_change", 0),
        "small_trader_long": row.get("small_trader_long", 0),
        "small_trader_short": row.get("small_trader_short", 0),
        "small_trader_net": row.get("small_trader_net", 0),
        "open_interest": row.get("open_interest", 0),
        "open_interest_change": row.get("open_interest_change", 0),
        "commercial_index": commercial_index,
        "speculative_index": speculative_index,
    }


def generate_signal(
    commercial_index: float, speculative_index: float,
) -> dict[str, str]:
    """Generate a directional signal from COT index values."""
    bullish = (
        commercial_index >= EXTREME_BULLISH_THRESHOLD
        or speculative_index <= EXTREME_BEARISH_THRESHOLD
    )
    bearish = (
        commercial_index <= EXTREME_BEARISH_THRESHOLD
        or speculative_index >= EXTREME_BULLISH_THRESHOLD
    )
    if bullish and not bearish:
        parts: list[str] = []
        if commercial_index >= EXTREME_BULLISH_THRESHOLD:
            parts.append(f"Commercials at {commercial_index:.0f}th percentile (net long)")
        if speculative_index <= EXTREME_BEARISH_THRESHOLD:
            parts.append(f"Speculators at {speculative_index:.0f}th percentile (net short)")
        return {"direction": "bullish", "reasoning": ", ".join(parts) + " - bullish divergence"}
    if bearish and not bullish:
        parts = []
        if commercial_index <= EXTREME_BEARISH_THRESHOLD:
            parts.append(f"Commercials at {commercial_index:.0f}th percentile (net short)")
        if speculative_index >= EXTREME_BULLISH_THRESHOLD:
            parts.append(f"Speculators at {speculative_index:.0f}th percentile (net long)")
        return {"direction": "bearish", "reasoning": ", ".join(parts) + " - bearish divergence"}
    return {
        "direction": "neutral",
        "reasoning": f"No extreme positioning (commercial: {commercial_index:.0f}, speculative: {speculative_index:.0f})",
    }


def build_market_summary(
    market_name: str, historical: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Build the full market summary response from historical COT rows.

    *historical* must be sorted by report_date descending (most recent first).
    """
    if not historical:
        return None
    info = get_market_info(market_name)
    latest = historical[0]
    # Compute indices from chronological net positions (oldest first)
    comm_nets = [r["commercial_net"] for r in reversed(historical)]
    spec_nets = [r["speculative_net"] for r in reversed(historical)]
    comm_idx = calculate_cot_index(comm_nets)
    spec_idx = calculate_cot_index(spec_nets)
    # Week-over-week changes
    comm_change_1w = _delta(historical, "commercial_net", 1)
    comm_change_4w = _delta(historical, "commercial_net", 4)
    spec_change_1w = _delta(historical, "speculative_net", 1)
    spec_change_4w = _delta(historical, "speculative_net", 4)
    oi_change_1w = _delta(historical, "open_interest", 1)
    oi_change_4w = _delta(historical, "open_interest", 4)
    signal = generate_signal(comm_idx, spec_idx)
    return {
        "market_name": market_name,
        "symbol": info["symbol"] if info else None,
        "display_name": info["display"] if info else None,
        "latest_report_date": latest["report_date"],
        "commercial": {
            "net": latest["commercial_net"],
            "index": round(comm_idx, 1),
            "direction": "long" if latest["commercial_net"] > 0 else "short",
            "change_1w": comm_change_1w,
            "change_4w": comm_change_4w,
        },
        "speculative": {
            "net": latest["speculative_net"],
            "index": round(spec_idx, 1),
            "direction": "long" if latest["speculative_net"] > 0 else "short",
            "change_1w": spec_change_1w,
            "change_4w": spec_change_4w,
        },
        "open_interest": {
            "current": latest["open_interest"],
            "change_1w": oi_change_1w,
            "change_4w": oi_change_4w,
        },
        "signal": signal,
    }


def _delta(rows: list[dict[str, Any]], key: str, offset: int) -> int | None:
    """Compute change between rows[0][key] and rows[offset][key]."""
    if len(rows) <= offset:
        return None
    current = rows[0].get(key)
    prev = rows[offset].get(key)
    if current is None or prev is None:
        return None
    return current - prev
