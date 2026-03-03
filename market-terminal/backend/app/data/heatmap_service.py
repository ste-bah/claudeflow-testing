"""Heatmap data service -- stock universe and price data for the heatmap view.

Provides two-tier caching:
- Universe cache (24h TTL): symbol list with sector, name, indices, market_cap
- Price cache (60s TTL): current price and daily change_pct for each symbol

Full implementation: heatmap backend feature
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any
from urllib import request as urllib_request
from urllib.error import URLError

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_UNIVERSE_TTL = 24 * 60 * 60  # 24 hours
_PRICE_TTL = 60  # 60 seconds

_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
_NASDAQ100_URL = "https://en.wikipedia.org/wiki/Nasdaq-100"

# Normalize Wikipedia GICS names → frontend-friendly names
_SECTOR_NORMALIZATION: dict[str, str] = {
    "Information Technology": "Technology",
    "Health Care": "Healthcare",
}

_USER_AGENT = "Mozilla/5.0 (compatible; MarketTerminalBot/1.0)"
_FETCH_TIMEOUT = 15

# ---------------------------------------------------------------------------
# Module-level cache state
# ---------------------------------------------------------------------------
_universe_cache: dict[str, Any] = {}
_universe_fetched_at: float = 0.0

_price_cache: dict[str, Any] = {}
_price_fetched_at: float = 0.0
_universe_lock: asyncio.Lock = asyncio.Lock()
_price_lock: asyncio.Lock = asyncio.Lock()
_background_tasks: set["asyncio.Task[None]"] = set()  # prevent GC of background refresh tasks


# ---------------------------------------------------------------------------
# Wikipedia table parser
# ---------------------------------------------------------------------------

class _TableParser(HTMLParser):
    """Minimal HTML parser that extracts one table (by id) as list-of-rows."""

    def __init__(self, table_id: str) -> None:
        super().__init__()
        self._target_id = table_id
        self._in_target = False
        self._depth = 0
        self._in_cell = False
        self._current_row: list[str] = []
        self._current_text: list[str] = []
        self.rows: list[list[str]] = []
        self._header_done = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "table":
            table_id = attrs_dict.get("id", "")
            if table_id == self._target_id:
                self._in_target = True
                self._depth = 1
            elif self._in_target:
                self._depth += 1
        elif self._in_target and tag == "table":
            self._depth += 1
        elif self._in_target and tag == "tr":
            self._current_row = []
        elif self._in_target and tag in ("td", "th"):
            self._in_cell = True
            self._current_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._in_target:
            self._depth -= 1
            if self._depth == 0:
                self._in_target = False
        elif self._in_target and tag == "tr":
            if self._current_row and any(c.strip() for c in self._current_row):
                self.rows.append(self._current_row)
        elif self._in_target and tag in ("td", "th"):
            self._in_cell = False
            text = " ".join(self._current_text).strip()
            # Collapse internal whitespace
            import re
            text = re.sub(r"\s+", " ", text).strip()
            self._current_row.append(text)

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_text.append(data)


def _fetch_wikipedia_table(url: str, table_id: str) -> list[list[str]]:
    """Fetch a Wikipedia page and extract table rows by id.

    Returns rows as list-of-lists (strings).  First row is the header.
    Returns empty list on any error.
    """
    try:
        req = urllib_request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib_request.urlopen(req, timeout=_FETCH_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        parser = _TableParser(table_id)
        parser.feed(html)
        return parser.rows
    except (URLError, Exception) as exc:
        logger.warning("Failed to fetch Wikipedia table %s: %s", url, exc)
        return []


# ---------------------------------------------------------------------------
# Universe fetching helpers
# ---------------------------------------------------------------------------

def _parse_sp500_rows(rows: list[list[str]]) -> dict[str, dict[str, Any]]:
    """Parse S&P 500 table rows into a symbol dict.

    Expected columns (header row):
      Symbol, Security, GICS Sector, GICS Sub-Industry, ...
    """
    if not rows:
        return {}

    header = [h.lower() for h in rows[0]]
    try:
        sym_idx = next(i for i, h in enumerate(header) if "symbol" in h)
        name_idx = next(i for i, h in enumerate(header) if "security" in h or "company" in h)
        sector_idx = next(i for i, h in enumerate(header) if "gics sector" in h)
    except StopIteration:
        logger.warning("S&P 500 table columns not found in header: %s", rows[0])
        return {}

    result: dict[str, dict[str, Any]] = {}
    for row in rows[1:]:
        if len(row) <= max(sym_idx, name_idx, sector_idx):
            continue
        sym = row[sym_idx].strip().upper().replace(".", "-")
        name = row[name_idx].strip()
        raw_sector = row[sector_idx].strip() or "Other"
        sector = _SECTOR_NORMALIZATION.get(raw_sector, raw_sector)
        if sym:
            result[sym] = {"name": name, "sector": sector, "indices": ["sp500"]}
    return result


def _parse_nasdaq100_rows(rows: list[list[str]]) -> dict[str, dict[str, Any]]:
    """Parse NASDAQ-100 table rows into a symbol dict.

    Expected columns (header row):
      Company, Ticker, GICS Sector, GICS Sub-Industry
    """
    if not rows:
        return {}

    header = [h.lower() for h in rows[0]]
    try:
        ticker_idx = next(i for i, h in enumerate(header) if "ticker" in h or "symbol" in h)
        name_idx = next(i for i, h in enumerate(header) if "company" in h or "security" in h)
        sector_idx = next(i for i, h in enumerate(header) if "gics sector" in h or "icb industry" in h or "icb" in h)
    except StopIteration:
        logger.warning("NASDAQ-100 table columns not found in header: %s", rows[0])
        return {}

    result: dict[str, dict[str, Any]] = {}
    for row in rows[1:]:
        if len(row) <= max(ticker_idx, name_idx, sector_idx):
            continue
        sym = row[ticker_idx].strip().upper().replace(".", "-")
        name = row[name_idx].strip()
        raw_sector = row[sector_idx].strip() or "Other"
        sector = _SECTOR_NORMALIZATION.get(raw_sector, raw_sector)
        if sym:
            result[sym] = {"name": name, "sector": sector, "indices": ["nasdaq100"]}
    return result


def _fetch_symbol_market_cap(sym: str) -> tuple[str, float]:
    """Fetch market cap for a single symbol via yfinance fast_info."""
    try:
        import yfinance as yf
        mc = yf.Ticker(sym).fast_info.market_cap
        return sym, float(mc) if mc is not None else 0.0
    except Exception:
        return sym, 0.0


def _build_universe() -> dict[str, dict[str, Any]]:
    """Scrape Wikipedia for S&P 500 and NASDAQ-100, merge, fetch market caps."""
    sp500_rows = _fetch_wikipedia_table(_SP500_URL, "constituents")
    nasdaq100_rows = _fetch_wikipedia_table(_NASDAQ100_URL, "constituents")

    sp500 = _parse_sp500_rows(sp500_rows)
    nasdaq100 = _parse_nasdaq100_rows(nasdaq100_rows)

    # Merge: S&P 500 takes priority for sector; shared stocks get both indices
    universe: dict[str, dict[str, Any]] = {}
    for sym, info in sp500.items():
        universe[sym] = {
            "symbol": sym,
            "name": info["name"],
            "sector": info["sector"],
            "indices": ["sp500"],
            "market_cap": 0,
        }
    for sym, info in nasdaq100.items():
        if sym in universe:
            # Already from S&P 500 — add nasdaq100 to indices, keep S&P sector
            if "nasdaq100" not in universe[sym]["indices"]:
                universe[sym]["indices"].append("nasdaq100")
        else:
            universe[sym] = {
                "symbol": sym,
                "name": info["name"],
                "sector": info["sector"],
                "indices": ["nasdaq100"],
                "market_cap": 0,
            }

    if not universe:
        logger.warning("Universe is empty after Wikipedia scraping")
        return {}

    # Fetch market caps in parallel
    symbols = list(universe.keys())
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(_fetch_symbol_market_cap, sym): sym for sym in symbols}
        for future in concurrent.futures.as_completed(futures):
            sym, mc = future.result()
            if sym in universe:
                universe[sym]["market_cap"] = mc

    logger.info("Universe built: %d symbols", len(universe))
    return universe


# ---------------------------------------------------------------------------
# Price fetching helpers
# ---------------------------------------------------------------------------

def _fetch_symbol_price_data(sym: str) -> "tuple[str, dict[str, float] | None]":
    """Fetch current price and daily change% for one symbol via yfinance fast_info.

    When markets are open, uses last_price vs previous_close for change%.
    When markets are closed (last_price is None), falls back to previous_close
    so cells show real prices rather than $0.00.
    Returns (sym, None) on any failure.
    """
    try:
        import yfinance as yf
        fi = yf.Ticker(sym).fast_info
        last = fi.last_price
        prev = fi.previous_close

        # Pick the best available price
        price = last if last is not None else prev
        if price is not None:
            price_f = float(price)
            change_pct = 0.0
            # Only compute change when we have both live price and a prior close
            if last is not None and prev is not None and float(prev) != 0.0:
                change_pct = round((float(last) - float(prev)) / float(prev) * 100, 2)
            return sym, {"price": round(price_f, 2), "change_pct": change_pct}
    except Exception:
        pass
    return sym, None


def _fetch_prices_sync(symbols: list[str]) -> dict[str, dict[str, float]]:
    """Fetch current price and change% for all symbols using fast_info in parallel.

    Uses the same per-symbol fast_info strategy as _fetch_symbol_market_cap, which
    is proven reliable.  yf.download() batch requests are avoided here because
    Yahoo Finance silently drops tickers from large batches causing missing data.
    """
    if not symbols:
        return {}

    prices: dict[str, dict[str, float]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(_fetch_symbol_price_data, sym): sym for sym in symbols}
        for future in concurrent.futures.as_completed(futures):
            sym, data = future.result()
            if data is not None:
                prices[sym] = data

    logger.info("Prices fetched: %d / %d symbols", len(prices), len(symbols))
    return prices


# ---------------------------------------------------------------------------
# Background refresh helper
# ---------------------------------------------------------------------------

async def _refresh_prices_bg(all_symbols: list[str]) -> None:
    """Background price-cache refresh (stale-while-revalidate).

    Acquires _price_lock so only one refresh runs at a time, then
    re-checks the TTL inside the lock (another task may have finished first).
    """
    global _price_cache, _price_fetched_at
    async with _price_lock:
        # Double-check: a prior task may have already refreshed while we waited.
        if (time.time() - _price_fetched_at) <= _PRICE_TTL:
            return
        logger.debug("Background price refresh for %d symbols", len(all_symbols))
        loop = asyncio.get_running_loop()
        new_cache = await loop.run_in_executor(None, _fetch_prices_sync, all_symbols)
        _price_cache = new_cache
        _price_fetched_at = time.time()
        logger.info("Background price refresh complete: %d symbols", len(new_cache))


# ---------------------------------------------------------------------------
# Main async service function
# ---------------------------------------------------------------------------

async def get_heatmap_data(
    index_filter: str = "all",
    sector_filter: str = "all",
) -> dict[str, Any]:
    """Return heatmap data with optional index and sector filtering.

    Uses two-tier caching:
    - Universe (24h): symbol list with metadata and market caps
    - Prices (60s): current price and daily change_pct

    Args:
        index_filter: "all", "sp500", or "nasdaq100"
        sector_filter: "all" or a GICS sector name

    Returns:
        Dict with stocks list and metadata.
    """
    global _universe_cache, _universe_fetched_at, _price_cache, _price_fetched_at

    now = time.time()

    # --- Universe cache (double-checked locking — same pattern as database.py) ---
    if not _universe_cache or (now - _universe_fetched_at) > _UNIVERSE_TTL:
        async with _universe_lock:
            # Re-read time: another coroutine may have refreshed while we waited.
            now = time.time()
            if not _universe_cache or (now - _universe_fetched_at) > _UNIVERSE_TTL:
                logger.info("Refreshing universe cache")
                loop = asyncio.get_running_loop()
                _universe_cache = await loop.run_in_executor(None, _build_universe)
                _universe_fetched_at = time.time()

    # --- Apply filters to determine which symbols we need prices for ---
    filtered_universe: list[dict[str, Any]] = []
    for sym, info in _universe_cache.items():
        if index_filter != "all" and index_filter not in info["indices"]:
            continue
        if sector_filter != "all" and info["sector"] != sector_filter:
            continue
        filtered_universe.append(info)

    filtered_symbols = [s["symbol"] for s in filtered_universe]

    # --- Price cache (always background — never block the request coroutine) ---
    # Re-read now: universe refresh above may have taken significant time.
    now = time.time()
    price_stale = not _price_cache or (now - _price_fetched_at) > _PRICE_TTL
    if price_stale and not _price_lock.locked():
        all_symbols = list(_universe_cache.keys())
        task = asyncio.create_task(_refresh_prices_bg(all_symbols))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

    # --- Merge and build response ---
    stocks: list[dict[str, Any]] = []
    for info in filtered_universe:
        sym = info["symbol"]
        price_data = _price_cache.get(sym, {})
        stocks.append({
            "symbol": sym,
            "name": info["name"],
            "sector": info["sector"],
            "indices": info["indices"],
            "change_pct": price_data.get("change_pct", 0.0),
            "market_cap": info["market_cap"],
            "price": price_data.get("price", 0.0),
        })

    refreshed_at = datetime.fromtimestamp(_price_fetched_at, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    elapsed = time.time() - _price_fetched_at
    next_refresh_in = max(0, int(_PRICE_TTL - elapsed))

    return {
        "stocks": stocks,
        "refreshed_at": refreshed_at,
        "next_refresh_in": next_refresh_in,
        "total_count": len(_universe_cache),
        "filtered_count": len(stocks),
        "prices_ready": _price_fetched_at > 0.0,
    }
