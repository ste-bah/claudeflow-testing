"""Analysis route -- full 6-methodology analysis pipeline.

POST /api/analyze/{symbol}  triggers analysis, returns composite + individual signals.
GET  /api/analyze/{symbol}  returns cached analysis without re-running.

Full implementation: TASK-ANALYSIS-009
"""
from __future__ import annotations

import asyncio
import importlib
import logging
import re
import time
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.analysis.base import METHODOLOGY_NAMES, MethodologySignal
from app.analysis.composite import CompositeAggregator
from app.data.cache import get_cache_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["analysis"])

_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_MAX_ANALYSIS_SECONDS = 30
_DEFAULT_CACHE_TTL_MINUTES = 60

_METHODOLOGY_MODULES: dict[str, tuple[str, str]] = {
    "wyckoff": ("app.analysis.wyckoff", "WyckoffAnalyzer"),
    "elliott_wave": ("app.analysis.elliott_wave", "ElliottWaveAnalyzer"),
    "ict_smart_money": ("app.analysis.ict_smart_money", "ICTSmartMoneyAnalyzer"),
    "canslim": ("app.analysis.canslim", "CANSLIMAnalyzer"),
    "larry_williams": ("app.analysis.larry_williams", "LarryWilliamsAnalyzer"),
    "sentiment": ("app.analysis.sentiment", "SentimentAnalyzer"),
}

# Per chart-timeframe data window: (yfinance period, yfinance interval)
# Higher timeframes need more history to capture macro wave structure.
_TIMEFRAME_DATA_MAP: dict[str, tuple[str, str]] = {
    "1h":  ("3mo",  "1h"),
    "4h":  ("6mo",  "1h"),   # aggregated from 1h bars
    "8h":  ("9mo",  "1h"),
    "12h": ("9mo",  "1h"),
    "1d":  ("2y",   "1d"),
    "1w":  ("10y",  "1wk"),
    "1m":  ("20y",  "1mo"),
    "3m":  ("20y",  "1mo"),
    "6m":  ("10y",  "1mo"),
    "1y":  ("10y",  "1d"),
    "5y":  ("20y",  "1wk"),
}

_DISPLAY_NAMES: dict[str, str] = {
    "wyckoff": "Wyckoff Method",
    "elliott_wave": "Elliott Wave",
    "ict_smart_money": "ICT Smart Money Concepts",
    "canslim": "CANSLIM",
    "larry_williams": "Larry Williams Indicators",
    "sentiment": "Sentiment Analysis",
}

# Per-symbol concurrency locks
_analysis_locks: dict[str, asyncio.Lock] = {}


async def _get_lock(symbol: str) -> asyncio.Lock:
    """Return (or create) a per-symbol asyncio.Lock."""
    if symbol not in _analysis_locks:
        _analysis_locks[symbol] = asyncio.Lock()
    return _analysis_locks[symbol]


def _validate_symbol(symbol: str) -> str:
    """Strip, upper-case, and validate *symbol*.  Raises 400 on failure."""
    cleaned = symbol.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")
    return cleaned


def _composite_response(composite_dict: dict[str, Any]) -> dict[str, Any]:
    """Extract the standard composite fields for the API response envelope."""
    return {
        k: composite_dict.get(k)
        for k in ("overall_direction", "overall_confidence",
                  "confluence_count", "timeframe_breakdown",
                  "trade_thesis", "weights_used", "timestamp")
    }


def _cached_response(
    symbol: str, cached: Any, num_requested: int,
) -> dict[str, Any]:
    """Build a full API response from a cached CompositeSignal."""
    return {
        "symbol": symbol,
        "composite": _composite_response(cached.to_dict()),
        "signals": [s.to_dict() for s in cached.methodology_signals],
        "metadata": {
            "analysis_duration_ms": 0,
            "methodologies_requested": num_requested,
            "methodologies_completed": len(cached.methodology_signals),
            "methodologies_failed": 0,
            "failed_methodologies": [],
            "cached": True,
            "data_sources_used": [],
        },
    }


def _build_dataframes(
    hist_data: list[dict[str, Any]],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Convert a list of OHLCV bar dicts into price and volume DataFrames.

    Returns ``(price_df, volume_df)`` with columns expected by
    :class:`~app.analysis.base.BaseMethodology`.
    """
    if not hist_data:
        return pd.DataFrame(), pd.DataFrame()

    df = pd.DataFrame(hist_data)

    # Normalize column names to lowercase
    df.columns = [c.lower() for c in df.columns]

    # Ensure required columns exist
    price_cols = {"date", "open", "high", "low", "close"}
    if not price_cols.issubset(set(df.columns)):
        return pd.DataFrame(), pd.DataFrame()

    # Sort by date ascending
    df = df.sort_values("date").reset_index(drop=True)

    price_df = df[["date", "open", "high", "low", "close"]].copy()
    price_df = price_df.dropna(subset=["open", "high", "low", "close"])

    vol_col = "volume" if "volume" in df.columns else None
    if vol_col is not None:
        volume_df = df[["date", "volume"]].copy()
        volume_df = volume_df.dropna(subset=["volume"])
    else:
        volume_df = price_df[["date"]].copy()
        volume_df["volume"] = 0

    return price_df, volume_df


def _load_analyzer(methodology: str) -> Any:
    """Lazily import and instantiate a methodology analyzer.

    Returns the analyzer instance, or *None* if the module is unavailable.
    """
    entry = _METHODOLOGY_MODULES.get(methodology)
    if entry is None:
        return None
    module_path, class_name = entry
    try:
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        return cls()
    except Exception:
        logger.warning("Failed to load methodology module: %s", methodology,
                       exc_info=True)
        return None


class AnalyzeRequest(BaseModel):
    """Optional request body for ``POST /api/analyze/{symbol}``."""

    methodologies: list[str] | None = None
    weights: dict[str, float] | None = None
    use_cache: bool = True
    stream_progress: bool = True

    @field_validator("methodologies")
    @classmethod
    def validate_methodologies(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            for m in v:
                if m not in METHODOLOGY_NAMES:
                    raise ValueError(
                        f"Invalid methodology: must be one of {METHODOLOGY_NAMES}"
                    )
        return v


async def _broadcast_progress(
    symbol: str,
    methodology_name: str,
    idx: int,
    total: int,
    status: str,
    message: str,
) -> None:
    """Send analysis progress via WebSocket (best-effort, never blocks)."""
    try:
        from app.api.routes.websocket import ws_manager

        await ws_manager.broadcast_to_subscribers(f"analysis:{symbol}", {
            "type": "analysis_progress",
            "symbol": symbol,
            "agent": methodology_name,
            "agent_number": idx + 1,
            "total_agents": total,
            "status": status,
            "message": message,
        })
    except Exception:
        pass  # WebSocket errors must never block analysis


async def _fetch_data(
    symbol: str,
    timeframe: str = "1d",
    force_refresh: bool = False,
) -> tuple[
    pd.DataFrame, pd.DataFrame,
    dict[str, Any] | None,
    list[dict[str, Any]],
    list[str],
]:
    """Fetch price, volume, fundamentals, and news for *symbol*.

    The OHLCV window is driven by *timeframe* via :data:`_TIMEFRAME_DATA_MAP`
    so that weekly analysis gets 10 years of data and hourly gets 3 months.
    Returns ``(price_df, volume_df, fundamentals, news_articles, sources)``.
    Raises :class:`HTTPException` (502) if price data is unavailable.
    """
    cm = get_cache_manager()
    sources: list[str] = []

    # -- Historical OHLCV (required) ----------------------------------------
    tf_period, tf_interval = _TIMEFRAME_DATA_MAP.get(timeframe, ("2y", "1d"))
    price_df = pd.DataFrame()
    volume_df = pd.DataFrame()
    try:
        hist_result = await cm.get_historical_prices(
            symbol, period=tf_period, interval=tf_interval,
        )
        if hist_result is not None and isinstance(hist_result.data, list):
            price_df, volume_df = _build_dataframes(hist_result.data)
            if not price_df.empty:
                sources.append(f"ohlcv:{hist_result.source}")
    except Exception:
        logger.warning("Historical price fetch failed for %s", symbol,
                       exc_info=True)

    if price_df.empty:
        raise HTTPException(
            status_code=502,
            detail="Price data unavailable for analysis",
        )

    # -- Fundamentals (optional) --------------------------------------------
    fundamentals: dict[str, Any] | None = None
    try:
        fund_result = await cm.get_fundamentals(symbol, force_refresh=force_refresh)
        if fund_result is not None and isinstance(fund_result.data, dict):
            fundamentals = fund_result.data
            sources.append(f"fundamentals:{fund_result.source}")
    except Exception:
        logger.debug("Fundamentals fetch failed for %s", symbol,
                      exc_info=True)

    # -- News (optional) ----------------------------------------------------
    news_articles: list[dict[str, Any]] = []
    try:
        news_result = await cm.get_news(symbol)
        if news_result is not None and isinstance(news_result.data, list):
            news_articles = news_result.data
            sources.append(f"news:{news_result.source}")
    except Exception:
        logger.debug("News fetch failed for %s", symbol, exc_info=True)

    return price_df, volume_df, fundamentals, news_articles, sources


async def _run_methodologies(
    symbol: str,
    price_df: pd.DataFrame,
    volume_df: pd.DataFrame,
    fundamentals: dict[str, Any] | None,
    news_articles: list[dict[str, Any]],
    requested: list[str],
    weights: dict[str, float] | None,
    stream_progress: bool,
    timeframe: str = "1d",
) -> dict[str, Any]:
    """Run requested methodology modules and aggregate results.

    Returns a dict with keys: ``composite``, ``signals``, ``metadata``.
    """
    total = len(requested)
    signals: list[MethodologySignal] = []
    failed: list[str] = []
    durations: dict[str, float] = {}

    for idx, name in enumerate(requested):
        display_name = _DISPLAY_NAMES.get(name, name)

        if stream_progress:
            await _broadcast_progress(
                symbol, name, idx, total, "running",
                f"Running {display_name}...",
            )

        analyzer = _load_analyzer(name)
        if analyzer is None:
            failed.append(name)
            logger.warning("Methodology %s not available", name)
            continue

        t0 = time.monotonic()
        try:
            kwargs: dict[str, Any] = {}
            if name == "sentiment":
                kwargs["articles"] = news_articles
            if name == "larry_williams":
                kwargs["cot_data"] = None
            if name == "elliott_wave":
                kwargs["chart_timeframe"] = timeframe

            signal = await analyzer.analyze(
                symbol,
                price_data=price_df,
                volume_data=volume_df,
                fundamentals=fundamentals,
                **kwargs,
            )
            signals.append(signal)
            durations[name] = time.monotonic() - t0

            if stream_progress:
                await _broadcast_progress(
                    symbol, name, idx, total, "completed",
                    f"{display_name} completed",
                )
        except Exception:
            durations[name] = time.monotonic() - t0
            failed.append(name)
            logger.warning("Methodology %s failed for %s", name, symbol,
                           exc_info=True)
            if stream_progress:
                await _broadcast_progress(
                    symbol, name, idx, total, "failed",
                    f"{display_name} failed",
                )

    # -- Aggregate ----------------------------------------------------------
    aggregator = CompositeAggregator()
    composite = await aggregator.aggregate(symbol, signals, weights=weights)

    # Cache the result
    effective_weights = (
        aggregator._normalize_weights(weights)
        if weights is not None
        else await aggregator.get_weights()
    )
    try:
        await aggregator.cache_result(composite, signals, effective_weights)
    except Exception:
        logger.debug("Failed to cache analysis result for %s", symbol,
                      exc_info=True)

    total_duration_ms = int(sum(durations.values()) * 1000)

    return {
        "composite": composite,
        "signals": signals,
        "metadata": {
            "analysis_duration_ms": total_duration_ms,
            "methodologies_requested": total,
            "methodologies_completed": len(signals),
            "methodologies_failed": len(failed),
            "failed_methodologies": failed,
        },
    }


@router.post("/{symbol}")
async def run_analysis(
    symbol: str,
    body: AnalyzeRequest | None = None,
    timeframe: str = Query(default="1d"),
) -> dict[str, Any]:
    """Trigger full analysis pipeline for *symbol*.

    Runs all (or a subset of) 6 methodology modules, aggregates via
    :class:`CompositeAggregator`, and returns the composite signal plus
    individual methodology signals.

    Query param ``timeframe`` drives the OHLCV data window and EW ZigZag
    sensitivity (e.g. ``?timeframe=1w`` fetches 10 years of weekly bars).
    """
    symbol = _validate_symbol(symbol)
    timeframe = timeframe.lower().strip()
    req = body or AnalyzeRequest()

    methodologies = req.methodologies or list(METHODOLOGY_NAMES)
    weights = req.weights
    use_cache = req.use_cache
    stream_progress = req.stream_progress

    # -- Check cache --------------------------------------------------------
    if use_cache:
        aggregator = CompositeAggregator()
        try:
            cached = await aggregator.get_cached_result(
                symbol, max_age_minutes=_DEFAULT_CACHE_TTL_MINUTES,
            )
            if cached is not None:
                return _cached_response(symbol, cached, len(methodologies))
        except Exception:
            logger.debug("Cache check failed for %s", symbol, exc_info=True)

    # -- Acquire per-symbol lock --------------------------------------------
    lock = await _get_lock(symbol)
    try:
        await asyncio.wait_for(lock.acquire(), timeout=60)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Analysis already in progress for this symbol",
        )

    try:
        # -- Fetch data -----------------------------------------------------
        t_start = time.monotonic()
        price_df, volume_df, fundamentals, news_articles, sources = (
            await _fetch_data(symbol, timeframe=timeframe,
                              force_refresh=not use_cache)
        )

        # -- Run with timeout -----------------------------------------------
        try:
            result = await asyncio.wait_for(
                _run_methodologies(
                    symbol, price_df, volume_df, fundamentals,
                    news_articles, methodologies, weights, stream_progress,
                    timeframe=timeframe,
                ),
                timeout=_MAX_ANALYSIS_SECONDS,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=500,
                detail="Analysis timed out",
            )

        composite = result["composite"]
        signals = result["signals"]
        metadata = result["metadata"]

        # All methodologies failed
        if not signals:
            raise HTTPException(
                status_code=500,
                detail="All methodology analyses failed",
            )

        # Rebuild metadata with total wall time and sources
        total_wall_ms = int((time.monotonic() - t_start) * 1000)
        metadata["analysis_duration_ms"] = total_wall_ms
        metadata["cached"] = False
        metadata["data_sources_used"] = sources

        # -- Build response -------------------------------------------------
        return {
            "symbol": symbol,
            "composite": _composite_response(composite.to_dict()),
            "signals": [s.to_dict() for s in signals],
            "metadata": metadata,
        }
    finally:
        lock.release()


@router.get("/{symbol}")
async def get_cached_analysis(
    symbol: str,
    max_age_minutes: int = Query(default=60, ge=1, le=1440),
    timeframe: str = Query(default="1d"),
) -> dict[str, Any]:
    """Return cached analysis for *symbol*, or 404 if none exists.

    Does **not** trigger a new analysis run.  Use ``POST`` for that.
    The ``timeframe`` param is forwarded so future cache versions can store
    per-timeframe results separately.
    """
    symbol = _validate_symbol(symbol)

    aggregator = CompositeAggregator()
    try:
        cached = await aggregator.get_cached_result(
            symbol, max_age_minutes=max_age_minutes,
        )
    except Exception:
        logger.debug("Cache retrieval failed for %s", symbol, exc_info=True)
        cached = None

    if cached is None:
        raise HTTPException(
            status_code=404,
            detail="No cached analysis available",
        )

    return _cached_response(symbol, cached, len(METHODOLOGY_NAMES))
