"""Composite signal aggregator for the analysis engine.

Combines signals from all 6 methodology modules into a single weighted
composite score with confluence analysis, timeframe breakdown, and trade
thesis generation. Supports configurable weights stored in SQLite.

Full implementation: TASK-ANALYSIS-008
"""
from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from app.analysis.base import (
    CompositeSignal, DEFAULT_WEIGHTS, Direction, METHODOLOGY_NAMES,
    MethodologySignal, OverallDirection, Timeframe,
)
from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_EPSILON: float = 1e-10
_MAX_TICKER_LEN: int = 10
_CONFLUENCE_BONUS_4: float = 1.2
_CONFLUENCE_BONUS_5: float = 1.4
_DIRECTION_SCORES: dict[str, float] = {
    Direction.BULLISH.value: 1.0, Direction.NEUTRAL.value: 0.0,
    Direction.BEARISH.value: -1.0,
}
_MISSING_METHODOLOGY_PENALTY: float = 0.9
_MIN_SIGNALS: int = 2
_DEFAULT_CACHE_TTL_MINUTES: int = 60
_STRONG_BULLISH_THRESHOLD: float = 0.5
_BULLISH_THRESHOLD: float = 0.15
_BEARISH_THRESHOLD: float = -0.15
_STRONG_BEARISH_THRESHOLD: float = -0.5

_CREATE_WEIGHTS_TABLE = (
    "CREATE TABLE IF NOT EXISTS methodology_weights ("
    "methodology TEXT PRIMARY KEY, weight REAL NOT NULL, "
    "updated_at TEXT NOT NULL DEFAULT (datetime('now')))")
_CREATE_CACHE_TABLE = (
    "CREATE TABLE IF NOT EXISTS analysis_cache ("
    "ticker TEXT NOT NULL, composite_json TEXT NOT NULL, "
    "signals_json TEXT NOT NULL, weights_json TEXT NOT NULL, "
    "created_at TEXT NOT NULL DEFAULT (datetime('now')), "
    "PRIMARY KEY (ticker, created_at))")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize_ticker(ticker: str) -> str:
    """Sanitize ticker: uppercase, alphanumeric + dot/dash only."""
    return re.sub(r"[^A-Z0-9.\-]", "", str(ticker)[:_MAX_TICKER_LEN].upper())

def _safe_float(value: float) -> float:
    """Return 0.0 if *value* is NaN or Inf."""
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return value

def _is_finite(value: Any) -> bool:
    """Return True if *value* is a finite number (not bool)."""
    if isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    return not (math.isnan(value) or math.isinf(value))

# ---------------------------------------------------------------------------
# CompositeAggregator
# ---------------------------------------------------------------------------

class CompositeAggregator:
    """Aggregates :class:`MethodologySignal` instances into a single
    :class:`CompositeSignal` using configurable weights.

    Weight priority: ``weights`` param > SQLite stored > DEFAULT_WEIGHTS.
    """

    def __init__(self, db_path: str | None = None) -> None:
        """Initialize with optional database path for loading user-configured weights.

        If db_path is None, uses the app's default database via get_database().
        If db_path is provided, creates an independent aiosqlite connection.
        """
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None
        self._tables_ensured: bool = False

    # -- Database lifecycle -------------------------------------------------

    async def _get_db(self) -> Any:
        """Return the database handle, initializing if needed."""
        if self._db_path is None:
            db = await get_database()
            if not self._tables_ensured:
                await db.execute(_CREATE_WEIGHTS_TABLE)
                await db.execute(_CREATE_CACHE_TABLE)
                self._tables_ensured = True
            return db
        if self._db is None:
            self._db = await aiosqlite.connect(self._db_path)
            self._db.row_factory = aiosqlite.Row
        if not self._tables_ensured:
            await self._db.execute(_CREATE_WEIGHTS_TABLE)
            await self._db.execute(_CREATE_CACHE_TABLE)
            await self._db.commit()
            self._tables_ensured = True
        return self._db

    async def close(self) -> None:
        """Close standalone database connection. No-op in app mode."""
        if self._db is not None:
            await self._db.close()
            self._db = None
        self._tables_ensured = False

    # -- Weight management --------------------------------------------------

    async def get_weights(self) -> dict[str, float]:
        """Return effective weight map (SQLite -> DEFAULT_WEIGHTS fallback)."""
        db = await self._get_db()
        weights = dict(DEFAULT_WEIGHTS)
        try:
            if self._db_path is None:
                rows = await db.fetch_all(
                    "SELECT methodology, weight FROM methodology_weights")
            else:
                cursor = await db.execute(
                    "SELECT methodology, weight FROM methodology_weights")
                raw_rows = await cursor.fetchall()
                rows = [{"methodology": r[0], "weight": r[1]} for r in raw_rows]
            for row in rows:
                name, w = row["methodology"], row["weight"]
                if name in weights and _is_finite(w):
                    weights[name] = float(w)
        except Exception:
            logger.debug("Could not load stored weights, using defaults")
        return self._normalize_weights(weights)

    async def set_weights(self, weights: dict[str, float]) -> None:
        """Persist custom weights. Normalized to sum to 1.0 before storage."""
        filtered = {
            k: float(v) for k, v in weights.items()
            if k in METHODOLOGY_NAMES and _is_finite(v) and float(v) >= 0
        }
        if not filtered:
            raise ValueError("No valid methodology weights provided")
        normalized = self._normalize_weights(filtered)
        now = datetime.now(tz=timezone.utc).isoformat()
        db = await self._get_db()
        sql = ("INSERT OR REPLACE INTO methodology_weights "
               "(methodology, weight, updated_at) VALUES (?, ?, ?)")
        for name, w in normalized.items():
            if self._db_path is None:
                await db.execute(sql, (name, w, now))
            else:
                await db.execute(sql, (name, w, now))
                await db.commit()

    async def reset_weights(self) -> None:
        """Delete all stored weights, reverting to DEFAULT_WEIGHTS."""
        db = await self._get_db()
        if self._db_path is None:
            await db.execute("DELETE FROM methodology_weights WHERE 1=1")
        else:
            await db.execute("DELETE FROM methodology_weights WHERE 1=1")
            await db.commit()

    @staticmethod
    def _normalize_weights(weights: dict[str, float]) -> dict[str, float]:
        """Normalize weights to sum to 1.0. Clamps negatives/non-finite to 0."""
        cleaned: dict[str, float] = {}
        for k, v in weights.items():
            fv = float(v)
            cleaned[k] = 0.0 if (math.isnan(fv) or math.isinf(fv) or fv < 0) else fv
        total = sum(cleaned.values())
        if total < _EPSILON:
            n = max(len(cleaned), 1)
            return {k: 1.0 / n for k in cleaned}
        return {k: v / total for k, v in cleaned.items()}

    # -- Core aggregation ---------------------------------------------------

    async def aggregate(
        self, ticker: str, signals: list[MethodologySignal],
        weights: dict[str, float] | None = None,
    ) -> CompositeSignal:
        """Combine methodology signals into a single composite."""
        safe_ticker = _sanitize_ticker(ticker)
        effective_weights = (self._normalize_weights(weights)
                             if weights is not None
                             else await self.get_weights())

        if len(signals) < _MIN_SIGNALS:
            return self._neutral_composite(safe_ticker, signals, effective_weights)

        # Compute weighted score
        present_names = {s.methodology for s in signals}
        active_weight_sum = 0.0
        weighted_score = 0.0
        for sig in signals:
            w = effective_weights.get(sig.methodology, 0.0)
            dir_score = _DIRECTION_SCORES.get(sig.direction, 0.0)
            weighted_score += _safe_float(dir_score * sig.confidence) * w
            active_weight_sum += w

        if active_weight_sum < _EPSILON:
            return self._neutral_composite(safe_ticker, signals, effective_weights)
        weighted_score = _safe_float(weighted_score / active_weight_sum)

        overall_direction = self._score_to_direction(weighted_score)

        # Confluence
        direction_counts = Counter(s.direction for s in signals)
        majority_direction = direction_counts.most_common(1)[0][0]
        confluence_count = direction_counts[majority_direction]
        if confluence_count >= 5:
            conf_mult = _CONFLUENCE_BONUS_5
        elif confluence_count >= 4:
            conf_mult = _CONFLUENCE_BONUS_4
        else:
            conf_mult = 1.0

        overall_confidence = _safe_float(abs(weighted_score) * conf_mult)
        missing_count = len(METHODOLOGY_NAMES) - len(present_names)
        for _ in range(missing_count):
            overall_confidence *= _MISSING_METHODOLOGY_PENALTY
        overall_confidence = max(0.0, min(1.0, _safe_float(overall_confidence)))

        timeframe_breakdown = self._build_timeframe_breakdown(signals)
        trade_thesis = self._build_trade_thesis(
            safe_ticker, overall_direction, overall_confidence,
            confluence_count, len(signals), majority_direction,
            timeframe_breakdown, signals)

        return CompositeSignal(
            ticker=safe_ticker, overall_direction=overall_direction,
            overall_confidence=overall_confidence, methodology_signals=signals,
            confluence_count=confluence_count,
            timeframe_breakdown=timeframe_breakdown,
            trade_thesis=trade_thesis,
            timestamp=datetime.now(tz=timezone.utc),
            weights_used=effective_weights)

    # -- Direction mapping --------------------------------------------------

    @staticmethod
    def _score_to_direction(score: float) -> str:
        """Map weighted score in [-1, 1] to 5-level direction string."""
        if score > _STRONG_BULLISH_THRESHOLD:
            return OverallDirection.STRONG_BULLISH.value
        if score > _BULLISH_THRESHOLD:
            return OverallDirection.BULLISH.value
        if score > _BEARISH_THRESHOLD:
            return OverallDirection.NEUTRAL.value
        if score > _STRONG_BEARISH_THRESHOLD:
            return OverallDirection.BEARISH.value
        return OverallDirection.STRONG_BEARISH.value

    # -- Timeframe breakdown ------------------------------------------------

    @staticmethod
    def _build_timeframe_breakdown(
        signals: list[MethodologySignal],
    ) -> dict[str, Any]:
        """Group signals by timeframe and compute per-group stats."""
        breakdown: dict[str, Any] = {}
        for tf in Timeframe:
            group = [s for s in signals if s.timeframe == tf.value]
            if not group:
                breakdown[tf.value] = {"direction": Direction.NEUTRAL.value,
                                       "confidence": 0.0, "methodologies": []}
                continue
            dir_counts = Counter(s.direction for s in group)
            majority = dir_counts.most_common(1)[0][0]
            avg_conf = _safe_float(
                sum(s.confidence for s in group) / max(len(group), 1))
            breakdown[tf.value] = {
                "direction": majority, "confidence": round(avg_conf, 4),
                "methodologies": [s.methodology for s in group]}
        return breakdown

    # -- Trade thesis -------------------------------------------------------

    def _build_trade_thesis(
        self, ticker: str, overall_direction: str,
        overall_confidence: float, confluence_count: int,
        total_signals: int, majority_direction: str,
        timeframe_breakdown: dict[str, Any],
        signals: list[MethodologySignal],
    ) -> str:
        """Generate a human-readable trade thesis string."""
        lines: list[str] = [
            f"{ticker} Composite Analysis: "
            f"{overall_direction} ({overall_confidence:.0%} confidence)",
            "",
            f"{confluence_count}/{total_signals} methodologies agree on "
            f"{majority_direction} direction.",
            "",
        ]
        for tf in Timeframe:
            td = timeframe_breakdown.get(tf.value, {})
            d = td.get("direction", Direction.NEUTRAL.value)
            c = td.get("confidence", 0.0)
            m = td.get("methodologies", [])
            ms = ", ".join(m) if m else "none"
            lines.append(f"{tf.value.capitalize()}-term ({d}, {c:.0%}): {ms}")
        lines.append("")

        support = self._extract_level(signals, "support")
        resistance = self._extract_level(signals, "resistance")
        sup_s = f"${support:.2f}" if support is not None else "N/A"
        res_s = f"${resistance:.2f}" if resistance is not None else "N/A"
        lines.append(f"Key support: {sup_s}  |  Key resistance: {res_s}")
        lines.append("")

        by_conf = sorted(signals, key=lambda s: s.confidence, reverse=True)
        top2 = by_conf[:2]
        bot2 = by_conf[-2:] if len(by_conf) >= 2 else by_conf
        lines.append(
            f"Strongest signals: "
            f"{', '.join(s.methodology for s in top2)} "
            f"({', '.join(f'{s.confidence:.0%}' for s in top2)})")
        lines.append(
            f"Weakest signals: "
            f"{', '.join(s.methodology for s in bot2)} "
            f"({', '.join(f'{s.confidence:.0%}' for s in bot2)})")

        present = {s.methodology for s in signals}
        missing = [m for m in METHODOLOGY_NAMES if m not in present]
        if missing:
            lines.append("")
            lines.append(
                f"Missing methodologies ({len(missing)}): {', '.join(missing)}")
        return "\n".join(lines)

    @staticmethod
    def _extract_level(
        signals: list[MethodologySignal], key: str,
    ) -> float | None:
        """Extract the most common support/resistance level from signals."""
        values: list[float] = []
        for sig in signals:
            val = sig.key_levels.get(key)
            if (val is not None and isinstance(val, (int, float))
                    and not isinstance(val, bool)):
                fv = float(val)
                if not (math.isnan(fv) or math.isinf(fv)):
                    values.append(round(fv, 2))
        if not values:
            return None
        return Counter(values).most_common(1)[0][0]

    # -- Neutral fallback ---------------------------------------------------

    @staticmethod
    def _neutral_composite(
        ticker: str, signals: list[MethodologySignal],
        weights: dict[str, float],
    ) -> CompositeSignal:
        """Return a neutral composite when insufficient signals exist."""
        breakdown: dict[str, Any] = {}
        for tf in Timeframe:
            breakdown[tf.value] = {"direction": Direction.NEUTRAL.value,
                                   "confidence": 0.0, "methodologies": []}
        thesis = (
            f"{ticker} Composite Analysis: neutral (10% confidence)\n"
            f"\nInsufficient signals ({len(signals)}) for composite analysis. "
            f"Minimum {_MIN_SIGNALS} required.")
        return CompositeSignal(
            ticker=ticker, overall_direction=OverallDirection.NEUTRAL.value,
            overall_confidence=0.1, methodology_signals=signals,
            confluence_count=0, timeframe_breakdown=breakdown,
            trade_thesis=thesis, timestamp=datetime.now(tz=timezone.utc),
            weights_used=weights)

    # -- Caching ------------------------------------------------------------

    async def cache_result(
        self, composite: CompositeSignal,
        signals: list[MethodologySignal], weights: dict[str, float],
    ) -> None:
        """Store composite result in the ``analysis_cache`` table."""
        db = await self._get_db()
        safe_ticker = _sanitize_ticker(composite.ticker)
        now = datetime.now(tz=timezone.utc).isoformat()
        sql = ("INSERT INTO analysis_cache "
               "(ticker, composite_json, signals_json, weights_json, created_at) "
               "VALUES (?, ?, ?, ?, ?)")
        params = (
            safe_ticker,
            json.dumps(composite.to_dict(), default=str),
            json.dumps([s.to_dict() for s in signals], default=str),
            json.dumps(weights, default=str),
            now)
        if self._db_path is None:
            await db.execute(sql, params)
        else:
            await db.execute(sql, params)
            await db.commit()

    async def get_cached_result(
        self, ticker: str, max_age_minutes: int = _DEFAULT_CACHE_TTL_MINUTES,
    ) -> CompositeSignal | None:
        """Retrieve most recent cached composite for *ticker* if fresh."""
        db = await self._get_db()
        safe_ticker = _sanitize_ticker(ticker)
        sql = ("SELECT composite_json, created_at FROM analysis_cache "
               "WHERE ticker = ? ORDER BY created_at DESC LIMIT 1")
        if self._db_path is None:
            row = await db.fetch_one(sql, (safe_ticker,))
        else:
            cursor = await db.execute(sql, (safe_ticker,))
            raw = await cursor.fetchone()
            row = ({"composite_json": raw[0], "created_at": raw[1]}
                   if raw else None)
        if row is None:
            return None
        try:
            created_at = datetime.fromisoformat(row["created_at"])
        except (TypeError, ValueError):
            return None
        now = datetime.now(tz=timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if (now - created_at).total_seconds() > max_age_minutes * 60:
            return None
        try:
            return CompositeSignal.from_dict(json.loads(row["composite_json"]))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            logger.debug("Failed to deserialize cached composite: %s", exc)
            return None
