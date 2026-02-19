"""MCP server for Market Terminal -- 19 tools over JSON-RPC/stdio.

REGION 1: Preamble & Imports  |  REGION 2: Shared Helpers
REGION 3: Data Retrieval (8)  |  REGION 4: Analysis (7)
REGION 5: Watchlist (3)  |  REGION 6: Scan (1)  |  REGION 7: Entrypoint
"""
from __future__ import annotations
import os, sys
from pathlib import Path
from typing import Any, TYPE_CHECKING

_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))
os.chdir(_BACKEND_DIR)

import asyncio, importlib, json, logging, re
import pandas as pd
from mcp.server import Server
from mcp.server.stdio import stdio_server

if TYPE_CHECKING:
    from app.analysis.base import BaseMethodology
    from app.data.cache import CacheManager
    from app.data.database import DatabaseManager

logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("mcp_server")
server = Server("market-terminal")

_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_MAX_RESPONSE_BYTES = 100_000
_MAX_WATCHLIST_SIZE = 50
_LOCK_TIMEOUT_SECONDS = 60
_METHODOLOGY_MODULES: dict[str, tuple[str, str]] = {
    "wyckoff": ("app.analysis.wyckoff", "WyckoffAnalyzer"),
    "elliott_wave": ("app.analysis.elliott_wave", "ElliottWaveAnalyzer"),
    "ict_smart_money": ("app.analysis.ict_smart_money", "ICTSmartMoneyAnalyzer"),
    "canslim": ("app.analysis.canslim", "CANSLIMAnalyzer"),
    "larry_williams": ("app.analysis.larry_williams", "LarryWilliamsAnalyzer"),
    "sentiment": ("app.analysis.sentiment", "SentimentAnalyzer"),
}
_analysis_locks: dict[str, asyncio.Lock] = {}
_analyzers: dict[str, BaseMethodology] = {}
_cache_manager: CacheManager | None = None
_database: DatabaseManager | None = None

def _validate_symbol(symbol: str) -> str:
    """Strip, uppercase, regex-validate.  Raises ValueError on failure."""
    cleaned = symbol.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise ValueError("Invalid ticker symbol")
    return cleaned

def _truncate_response(data: dict[str, Any], max_bytes: int = _MAX_RESPONSE_BYTES) -> dict[str, Any]:
    """Shrink largest list fields until JSON size fits *max_bytes*."""
    raw: str = json.dumps(data, default=str)
    if len(raw.encode()) <= max_bytes:
        return data
    data = dict(data); data["truncated"] = True
    for _ in range(20):
        if len(json.dumps(data, default=str).encode()) <= max_bytes:
            return data
        largest_key: str | None = None
        largest_len: int = 0
        for k, v in data.items():
            if isinstance(v, list) and len(v) > largest_len:
                largest_key, largest_len = k, len(v)
        if largest_key is None or largest_len <= 1:
            break
        data[largest_key] = data[largest_key][:largest_len // 2]
    return data

def _load_analyzer(methodology: str) -> BaseMethodology | None:
    """Lazily import, instantiate, and cache a methodology analyzer."""
    if methodology in _analyzers:
        return _analyzers[methodology]
    entry: tuple[str, str] | None = _METHODOLOGY_MODULES.get(methodology)
    if entry is None:
        return None
    mod_path, cls_name = entry
    try:
        inst: BaseMethodology = getattr(importlib.import_module(mod_path), cls_name)()
        _analyzers[methodology] = inst
        return inst
    except Exception:
        logger.warning("Failed to load methodology module: %s", methodology, exc_info=True)
        return None

def _build_dataframes(hist_data: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Convert OHLCV bar dicts to (price_df, volume_df) DataFrames."""
    if not hist_data:
        return pd.DataFrame(), pd.DataFrame()
    df = pd.DataFrame(hist_data)
    df.columns = [c.lower() for c in df.columns]
    if not {"date", "open", "high", "low", "close"}.issubset(set(df.columns)):
        return pd.DataFrame(), pd.DataFrame()
    df = df.sort_values("date").reset_index(drop=True)
    price_df = df[["date", "open", "high", "low", "close"]].copy()
    price_df = price_df.dropna(subset=["open", "high", "low", "close"])
    if "volume" in df.columns:
        volume_df = df[["date", "volume"]].copy().dropna(subset=["volume"])
    else:
        volume_df = price_df[["date"]].copy(); volume_df["volume"] = 0
    return price_df, volume_df

def _get_lock(symbol: str) -> asyncio.Lock:
    # Deliberately sync -- fast dict lookup in single-threaded event loop.
    if symbol not in _analysis_locks:
        _analysis_locks[symbol] = asyncio.Lock()
    return _analysis_locks[symbol]

async def _init_services() -> None:
    """Init CacheManager (SYNC) and DatabaseManager (ASYNC).  Graceful degradation."""
    global _cache_manager, _database
    try:
        from app.data.cache import get_cache_manager
        _cache_manager = get_cache_manager()
        logger.info("CacheManager ready")
    except Exception:
        logger.error("Failed to initialize CacheManager", exc_info=True)
    try:
        from app.data.database import get_database
        _database = await get_database()
        logger.info("DatabaseManager ready")
    except Exception:
        logger.error("Failed to initialize DatabaseManager", exc_info=True)

@server.tool()
async def get_price(symbol: str, timeframe: str = "1y") -> dict[str, Any]:
    """Fetch historical OHLCV price bars for a ticker."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch price data"}
        r = await _cache_manager.get_historical_prices(sym, period=timeframe)
        if r is None:
            return {"error": "Failed to fetch price data"}
        return _truncate_response({"symbol": sym, "timeframe": timeframe, "data": r.data})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_price failed", exc_info=True)
        return {"error": "Failed to fetch price data"}

@server.tool()
async def get_volume(symbol: str, period: str = "3m") -> dict[str, Any]:
    """Fetch volume analysis: average, trend, unusual days."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch volume data"}
        r = await _cache_manager.get_historical_prices(sym, period=period)
        if r is None or not isinstance(r.data, list) or not r.data:
            return {"error": "Failed to fetch volume data"}
        bars = r.data
        vols = [b.get("volume", 0) or 0 for b in bars if isinstance(b, dict)]
        if not vols:
            return {"error": "Failed to fetch volume data"}
        avg = sum(vols) / len(vols)
        first_5_avg = sum(vols[:5]) / max(len(vols[:5]), 1)
        last_5_avg = sum(vols[-5:]) / max(len(vols[-5:]), 1)
        trend = ("increasing" if first_5_avg > 0 and last_5_avg > first_5_avg * 1.1
                 else ("decreasing" if first_5_avg > 0 and last_5_avg < first_5_avg * 0.9
                       else "stable"))
        unusual = [b for b in bars if isinstance(b, dict) and (b.get("volume") or 0) > avg * 2]
        return _truncate_response({"symbol": sym, "period": period, "average_volume": round(avg),
                                   "volume_trend": trend, "unusual_volume_days": unusual,
                                   "bar_count": len(bars)})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_volume failed", exc_info=True)
        return {"error": "Failed to fetch volume data"}

@server.tool()
async def get_fundamentals(symbol: str) -> dict[str, Any]:
    """Fetch key fundamental metrics for a ticker."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch fundamentals data"}
        r = await _cache_manager.get_fundamentals(sym)
        if r is None:
            return {"error": "Failed to fetch fundamentals data"}
        return _truncate_response({"symbol": sym, "data": r.data})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_fundamentals failed", exc_info=True)
        return {"error": "Failed to fetch fundamentals data"}

@server.tool()
async def get_ownership(symbol: str) -> dict[str, Any]:
    """Fetch institutional ownership (13F) data for a ticker."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch ownership data"}
        r = await _cache_manager.get_institutional_holders(sym)
        if r is None:
            return {"error": "Failed to fetch ownership data"}
        return _truncate_response({"symbol": sym, "data": r.data})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_ownership failed", exc_info=True)
        return {"error": "Failed to fetch ownership data"}

@server.tool()
async def get_insider_activity(symbol: str, days: int = 90) -> dict[str, Any]:
    """Fetch Form 4 insider transaction data for a ticker."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch insider activity data"}
        r = await _cache_manager.get_insider_transactions(sym, days=days)
        if r is None:
            return {"error": "Failed to fetch insider activity data"}
        return _truncate_response({"symbol": sym, "days": days, "data": r.data})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_insider_activity failed", exc_info=True)
        return {"error": "Failed to fetch insider activity data"}

@server.tool()
async def get_news(symbol: str, limit: int = 20) -> dict[str, Any]:
    """Fetch recent news articles for a ticker."""
    try:
        sym = _validate_symbol(symbol)
        if _cache_manager is None:
            return {"error": "Failed to fetch news data"}
        r = await _cache_manager.get_news(sym)
        if r is None:
            return {"error": "Failed to fetch news data"}
        articles = r.data[:limit] if isinstance(r.data, list) else r.data
        return _truncate_response({"symbol": sym, "articles": articles})
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    except Exception:
        logger.error("get_news failed", exc_info=True)
        return {"error": "Failed to fetch news data"}

@server.tool()
async def get_macro_calendar(days: int = 30) -> dict[str, Any]:
    """Fetch the upcoming economic event calendar."""
    try:
        if _cache_manager is None:
            return {"error": "Failed to fetch calendar data"}
        r = await _cache_manager.get_macro_calendar()
        if r is None:
            return {"error": "Failed to fetch calendar data"}
        return _truncate_response({"days": days, "data": r.data})
    except Exception:
        logger.error("get_macro_calendar failed", exc_info=True)
        return {"error": "Failed to fetch calendar data"}

@server.tool()
async def get_macro_history(indicator: str, symbol: str = "SPY") -> dict[str, Any]:
    """Fetch historical data for a FRED macroeconomic indicator."""
    try:
        cleaned = indicator.strip().upper()
        if not cleaned or not re.match(r"^[A-Za-z0-9_]{1,30}$", cleaned):
            return {"error": "Invalid indicator"}
        if _cache_manager is None:
            return {"error": "Failed to fetch macro data"}
        r = await _cache_manager.get_macro_indicator(cleaned)
        if r is None:
            return {"error": "Failed to fetch macro data"}
        return _truncate_response({"indicator": cleaned, "symbol": symbol, "data": r.data})
    except Exception:
        logger.error("get_macro_history failed", exc_info=True)
        return {"error": "Failed to fetch macro data"}

async def _run_single_analysis(methodology: str, symbol: str) -> dict[str, Any]:
    """Shared lock-fetch-analyze-return logic for individual methodology tools."""
    sym = _validate_symbol(symbol)
    if _cache_manager is None:
        return {"error": "Price data unavailable"}
    lock = _get_lock(sym)
    try:
        await asyncio.wait_for(lock.acquire(), timeout=_LOCK_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return {"error": "Analysis in progress for this symbol"}
    try:
        hist = await _cache_manager.get_historical_prices(sym, period="1y")
        if hist is None or not isinstance(hist.data, list):
            return {"error": "Price data unavailable"}
        price_df, volume_df = _build_dataframes(hist.data)
        if price_df.empty:
            return {"error": "Price data unavailable"}
        analyzer = _load_analyzer(methodology)
        if analyzer is None:
            return {"error": "Analysis module unavailable"}
        kwargs: dict[str, Any] = {}
        fundamentals: dict[str, Any] | None = None
        if methodology == "canslim":
            fr = await _cache_manager.get_fundamentals(sym)
            if fr and isinstance(fr.data, dict):
                fundamentals = fr.data
            ow = await _cache_manager.get_institutional_holders(sym)
            if ow:
                kwargs["ownership_data"] = ow.data
        if methodology == "larry_williams":
            cr = await _cache_manager.get_cot_data(sym)
            kwargs["cot_data"] = cr.data if cr else None
        if methodology == "sentiment":
            nr = await _cache_manager.get_news(sym)
            kwargs["articles"] = nr.data if nr and isinstance(nr.data, list) else []
        signal = await analyzer.analyze(sym, price_data=price_df, volume_data=volume_df,
                                        fundamentals=fundamentals, **kwargs)
        return _truncate_response(signal.to_dict())
    except ValueError:
        return {"error": "Analysis failed"}
    except Exception:
        logger.error("Analysis failed for %s/%s", methodology, symbol, exc_info=True)
        return {"error": "Analysis failed"}
    finally:
        lock.release()

@server.tool()
async def run_wyckoff(symbol: str) -> dict[str, Any]:
    """Run Wyckoff Method analysis (phases, springs, volume-price spread)."""
    try: return await _run_single_analysis("wyckoff", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}
@server.tool()
async def run_elliott(symbol: str) -> dict[str, Any]:
    """Run Elliott Wave analysis (impulse and corrective wave patterns)."""
    try: return await _run_single_analysis("elliott_wave", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}
@server.tool()
async def run_ict(symbol: str) -> dict[str, Any]:
    """Run ICT Smart Money Concepts analysis (order blocks, FVGs, liquidity)."""
    try: return await _run_single_analysis("ict_smart_money", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}
@server.tool()
async def run_canslim(symbol: str) -> dict[str, Any]:
    """Run CANSLIM analysis (7 O'Neil criteria with fundamentals + ownership)."""
    try: return await _run_single_analysis("canslim", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}
@server.tool()
async def run_williams(symbol: str) -> dict[str, Any]:
    """Run Larry Williams indicators (Williams %%R, COT, seasonal, A/D)."""
    try: return await _run_single_analysis("larry_williams", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}
@server.tool()
async def run_sentiment(symbol: str) -> dict[str, Any]:
    """Run sentiment analysis on recent news (FinBERT/LM/VADER fallback)."""
    try: return await _run_single_analysis("sentiment", symbol)
    except ValueError: return {"error": "Invalid ticker symbol"}

@server.tool()
async def run_composite(symbol: str) -> dict[str, Any]:
    """Run all 6 methodologies and produce a weighted composite signal."""
    try:
        sym = _validate_symbol(symbol)
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    if _cache_manager is None:
        return {"error": "Price data unavailable"}
    lock = _get_lock(sym)
    try:
        await asyncio.wait_for(lock.acquire(), timeout=_LOCK_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return {"error": "Analysis in progress for this symbol"}
    try:
        hist = await _cache_manager.get_historical_prices(sym, period="1y")
        if hist is None or not isinstance(hist.data, list):
            return {"error": "Price data unavailable"}
        price_df, volume_df = _build_dataframes(hist.data)
        if price_df.empty:
            return {"error": "Price data unavailable"}
        fundamentals: dict[str, Any] | None = None
        fr = await _cache_manager.get_fundamentals(sym)
        if fr and isinstance(fr.data, dict):
            fundamentals = fr.data
        ow = await _cache_manager.get_institutional_holders(sym)
        ownership_data = ow.data if ow else None
        cr = await _cache_manager.get_cot_data(sym)
        cot_data = cr.data if cr else None
        nr = await _cache_manager.get_news(sym)
        news_articles = nr.data if nr and isinstance(nr.data, list) else []
        from app.analysis.base import MethodologySignal
        signals: list[MethodologySignal] = []
        for name in ("wyckoff", "elliott_wave", "ict_smart_money",
                     "canslim", "larry_williams", "sentiment"):
            a = _load_analyzer(name)
            if a is None:
                continue
            try:
                kw: dict[str, Any] = {}
                if name == "canslim":
                    kw["ownership_data"] = ownership_data
                elif name == "larry_williams":
                    kw["cot_data"] = cot_data
                elif name == "sentiment":
                    kw["articles"] = news_articles
                signals.append(await a.analyze(
                    sym, price_data=price_df, volume_data=volume_df,
                    fundamentals=fundamentals, **kw))
            except Exception:
                logger.warning("Methodology %s failed for %s", name, sym, exc_info=True)
        if not signals:
            return {"error": "All methodology analyses failed"}
        from app.analysis.composite import CompositeAggregator
        return _truncate_response(
            (await CompositeAggregator().aggregate(sym, signals)).to_dict())
    except Exception:
        logger.error("run_composite failed for %s", symbol, exc_info=True)
        return {"error": "Internal server error"}
    finally:
        lock.release()

@server.tool()
async def watchlist_list() -> dict[str, Any]:
    """List all watchlist tickers with latest price and analysis data."""
    try:
        db = _database
        if db is None:
            return {"error": "Database operation failed"}
        rows: list[dict[str, Any]] = await db.fetch_all(
            "SELECT symbol, group_name, sort_order, added_at, updated_at "
            "FROM watchlist ORDER BY sort_order ASC")
        tickers: list[dict[str, Any]] = []
        for row in rows:
            sym: str = row["symbol"]
            pr: dict[str, Any] | None = await db.fetch_one(
                "SELECT close, open FROM price_cache "
                "WHERE symbol = ? ORDER BY date DESC LIMIT 1", (sym,))
            lp: Any = None
            pcp: float | None = None
            if pr:
                lp = pr.get("close"); op = pr.get("open")
                if lp is not None and op is not None and op != 0:
                    pcp = round((lp - op) / op * 100, 3)
            sr: dict[str, Any] | None = await db.fetch_one(
                "SELECT direction, confidence FROM analysis_results "
                "WHERE symbol = ? ORDER BY analyzed_at DESC LIMIT 1", (sym,))
            tickers.append({
                "symbol": sym, "group": row.get("group_name", "default"),
                "added_at": row.get("added_at"), "position": row.get("sort_order", 0),
                "last_price": lp, "price_change_percent": pcp,
                "last_composite_signal": sr.get("direction") if sr else None,
                "last_composite_confidence": sr.get("confidence") if sr else None,
                "last_updated": row.get("updated_at")})
        groups: list[Any] = sorted({r.get("group_name", "default") for r in rows})
        return _truncate_response({"tickers": tickers, "count": len(tickers),
                                   "max_allowed": _MAX_WATCHLIST_SIZE, "groups": groups})
    except Exception:
        logger.error("watchlist_list failed", exc_info=True)
        return {"error": "Database operation failed"}

@server.tool()
async def watchlist_add(symbol: str, group: str = "default") -> dict[str, Any]:
    """Add a ticker to the watchlist (max 50)."""
    try:
        sym = _validate_symbol(symbol)
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    try:
        db = _database
        if db is None:
            return {"error": "Database operation failed"}
        cnt: dict[str, Any] | None = await db.fetch_one("SELECT COUNT(*) AS cnt FROM watchlist")
        if (cnt["cnt"] if cnt else 0) >= _MAX_WATCHLIST_SIZE:
            return {"error": "Watchlist is at maximum capacity (50 symbols)"}
        if await db.fetch_one("SELECT id FROM watchlist WHERE symbol = ?", (sym,)):
            return {"error": "Symbol already in watchlist"}
        mx: dict[str, Any] | None = await db.fetch_one("SELECT MAX(sort_order) AS max_pos FROM watchlist")
        nxt: int = (mx["max_pos"] + 1) if mx and mx["max_pos"] is not None else 0
        await db.execute(
            "INSERT INTO watchlist (symbol, group_name, sort_order) VALUES (?, ?, ?)",
            (sym, group, nxt))
        return {"added": sym, "group": group, "position": nxt}
    except Exception:
        logger.error("watchlist_add failed", exc_info=True)
        return {"error": "Database operation failed"}

@server.tool()
async def watchlist_remove(symbol: str) -> dict[str, Any]:
    """Remove a ticker from the watchlist."""
    try:
        sym = _validate_symbol(symbol)
    except ValueError:
        return {"error": "Invalid ticker symbol"}
    try:
        db = _database
        if db is None:
            return {"error": "Database operation failed"}
        if not await db.fetch_one("SELECT id FROM watchlist WHERE symbol = ?", (sym,)):
            return {"error": "Symbol not in watchlist"}
        await db.execute("DELETE FROM watchlist WHERE symbol = ?", (sym,))
        return {"removed": sym}
    except Exception:
        logger.error("watchlist_remove failed", exc_info=True)
        return {"error": "Database operation failed"}

@server.tool()
async def scan_watchlist(method: str | None = None, signal: str | None = None,
                         min_confidence: float = 0.0, limit: int = 50) -> dict[str, Any]:
    """Scan watchlist tickers by methodology signal filters (read-only)."""
    try:
        from app.api.routes.scan import _scan_impl
        return await _scan_impl(method=method, signal=signal,
                                min_confidence=min_confidence, limit=limit)
    except ValueError:
        return {"error": "Invalid scan parameters"}
    except Exception as exc:
        # _scan_impl raises FastAPI HTTPException for validation errors;
        # check by class name to avoid hard import-time dependency on FastAPI
        exc_cls = type(exc).__name__
        if exc_cls == "HTTPException" and getattr(exc, "status_code", 0) == 400:
            return {"error": "Invalid scan parameters"}
        logger.error("scan_watchlist failed", exc_info=True)
        return {"error": "Scan operation failed"}

async def main() -> None:
    """Initialize services and start the MCP stdio transport loop."""
    await _init_services()
    logger.info("MCP server starting on stdio transport")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
