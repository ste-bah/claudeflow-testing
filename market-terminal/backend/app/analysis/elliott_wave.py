"""Elliott Wave analysis module.

Implements Ralph Nelson Elliott's wave principle including:
- Swing point detection (local highs/lows with alternation enforcement)
- Impulse wave validation (5-wave patterns with 3 cardinal rules)
- Corrective wave validation (3-wave A-B-C patterns)
- Fibonacci retracement and extension level calculation
- Guideline scoring (Wave 2/3/4/5 proportional relationships)
- Confidence scoring with volume confirmation and ambiguity penalty

Full implementation: TASK-ANALYSIS-003
"""

from __future__ import annotations

import math
from typing import Any, NamedTuple

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, MethodologySignal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_SWING_N: int = 5
_MIN_SWINGS_REQUIRED: int = 4
_MAX_CANDIDATES: int = 100
_EPSILON: float = 1e-10
_MAX_TICKER_LENGTH: int = 20

# ZigZag pivot detection — defaults (1D)
_ZIGZAG_ATR_MULTIPLIER: float = 1.5
_ZIGZAG_MIN_PCT: float = 0.04   # 4% minimum swing on daily bars

# Per chart-timeframe ZigZag parameters: (atr_multiplier, min_pct_swing)
# Higher timeframes need wider pivots to capture macro wave structure;
# lower timeframes need tighter pivots for short-term price action.
_TIMEFRAME_ZIGZAG: dict[str, tuple[float, float]] = {
    "1h":   (1.0, 0.015),   # Minute/Minuette degree — 1.5% min swing
    "4h":   (1.2, 0.020),   # Minor degree — 2%
    "8h":   (1.3, 0.025),
    "12h":  (1.3, 0.025),
    "1d":   (1.5, 0.040),   # Intermediate degree — 4% (default)
    "1w":   (2.0, 0.060),   # Primary / Cycle degree — 6%
    "1m":   (2.5, 0.080),   # Supercycle — 8%
    "3m":   (2.5, 0.080),
    "6m":   (2.0, 0.070),
    "1y":   (2.0, 0.060),
    "5y":   (2.5, 0.080),
}

# Target sanity clamp
_MAX_TARGET_DEVIATION: float = 0.40  # never show target >40% from price

_FIB_RETRACEMENTS: tuple[float, ...] = (0.236, 0.382, 0.500, 0.618, 0.786)
_FIB_EXTENSIONS: tuple[float, ...] = (1.000, 1.272, 1.618, 2.000, 2.618)
_FIB_OUTPUT_KEYS: tuple[str, ...] = (
    "23.6%", "38.2%", "50.0%", "61.8%", "100.0%", "161.8%",
)
_FIB_OUTPUT_RATIOS: tuple[float, ...] = (0.236, 0.382, 0.500, 0.618, 1.000, 1.618)
_FIB_CONFLUENCE_TOLERANCE: float = 0.01

_CONFIDENCE_BASE: float = 0.50
_CONFIDENCE_PER_GUIDELINE: float = 0.05
_CONFIDENCE_FIB_CONFLUENCE: float = 0.10
_CONFIDENCE_VOLUME_CONFIRMS: float = 0.10
_CONFIDENCE_WAVE_CLARITY: float = 0.10
_CONFIDENCE_AMBIGUITY_PENALTY: float = 0.15
_CONFIDENCE_FLOOR: float = 0.15
_CONFIDENCE_CAP: float = 1.0
_INSUFFICIENT_DATA_CONFIDENCE: float = 0.25

_GUIDELINE_W2_RETRACE_LOW: float = 0.50
_GUIDELINE_W2_RETRACE_HIGH: float = 0.618
_GUIDELINE_W3_EXTENSION: float = 1.618
_GUIDELINE_W4_RETRACE: float = 0.382
_GUIDELINE_W5_EQUALITY_TOLERANCE: float = 0.10
_VOLUME_LOOKBACK: int = 20
_CONFIDENCE_HIGH_QUALIFIER: float = 0.7
_CONFIDENCE_MODERATE_QUALIFIER: float = 0.5

# ---------------------------------------------------------------------------
# NamedTuples
# ---------------------------------------------------------------------------


class _SwingPoint(NamedTuple):
    index: int
    price: float
    swing_type: str  # "high" | "low"


class _WaveSegment(NamedTuple):
    start_index: int
    end_index: int
    start_price: float
    end_price: float
    direction: str  # "up" | "down"
    length: float


class _WaveCount(NamedTuple):
    waves: tuple[_WaveSegment, ...]
    pattern_type: str  # "impulse" | "corrective"
    rules_passed: int
    guideline_score: float
    total_score: float


class _FibLevel(NamedTuple):
    ratio: float
    price: float
    label: str
    is_aligned: bool


# ---------------------------------------------------------------------------
# ElliottWaveAnalyzer
# ---------------------------------------------------------------------------


class ElliottWaveAnalyzer(BaseMethodology):
    """Elliott Wave pattern analysis."""

    name: str = "elliott_wave"
    display_name: str = "Elliott Wave"
    default_timeframe: str = "medium"
    version: str = "1.0.0"

    async def analyze(
        self,
        ticker: str,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
        fundamentals: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MethodologySignal:
        # Pull chart-level timeframe so we pick the right ZigZag sensitivity.
        chart_timeframe: str = str(kwargs.get("chart_timeframe", "1d")).lower()
        self.validate_input(price_data, volume_data)
        merged = self._merge_data(price_data, volume_data)
        current_price = float(merged["close"].iloc[-1])
        swings = self._detect_pivots_zigzag(merged, chart_timeframe)

        if len(swings) < _MIN_SWINGS_REQUIRED:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_INSUFFICIENT_DATA_CONFIDENCE,
                timeframe=self.default_timeframe,
                reasoning="Insufficient swing points for Elliott Wave analysis.",
                key_levels={"current_price": current_price},
            )

        # Only keep candidates that satisfy ALL cardinal EW rules.
        # Partial matches (1/3, 2/3 rules) are discarded — a structure that
        # violates Rule 3 (Wave 4 overlaps Wave 1) is NOT an impulse, period.
        candidates = self._build_candidates(swings)
        scored: list[_WaveCount] = []
        for waves, ptype in candidates:
            all_ok, rpassed = self._validate_rules(waves, ptype)
            if not all_ok:
                continue  # Hard reject — EW theory has no partial impulses
            gscore = self._score_guidelines(waves, ptype)
            scored.append(_WaveCount(waves, ptype, rpassed, gscore, 3.0 + gscore))

        if not scored:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_INSUFFICIENT_DATA_CONFIDENCE,
                timeframe=self.default_timeframe,
                reasoning="No valid Elliott Wave patterns detected.",
                key_levels={"current_price": current_price},
            )

        # Sort: prefer candidates whose pattern ends furthest right (most recent)
        # and highest score within same end position.
        scored.sort(key=lambda c: (c.waves[-1].end_index, c.total_score), reverse=True)

        # ── Invalidation filter ───────────────────────────────────────────────
        # Drop any candidate whose invalidation level is ALREADY breached by
        # the current price. E.g. a bullish impulse with invalidation at $20
        # when price is $4 is meaningless — that wave count collapsed long ago.
        def _already_invalidated(wc: _WaveCount) -> bool:
            inval = self._determine_invalidation(wc, merged)
            w0 = wc.waves[0]
            if w0.direction == "up":      # bullish count: invalid if below inval
                return current_price < inval * 0.995
            else:                          # bearish count: invalid if above inval
                return current_price > inval * 1.005

        valid_scored = [c for c in scored if not _already_invalidated(c)]

        # If everything is invalidated fall back gracefully to neutral signal
        if not valid_scored:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_INSUFFICIENT_DATA_CONFIDENCE,
                timeframe=self.default_timeframe,
                reasoning="All detected wave counts already invalidated by current price.",
                key_levels={"current_price": current_price},
            )

        primary = valid_scored[0]
        alternative = valid_scored[1] if len(valid_scored) > 1 else None

        wave_label, direction, timeframe = self._assess_position(
            primary, current_price, merged,
        )
        fib_levels = self._calculate_fibonacci_levels(primary, current_price)
        invalidation = self._determine_invalidation(primary, merged)
        alt_invalidation = (
            self._determine_invalidation(alternative, merged)
            if alternative is not None else invalidation
        )

        # Target: first extension that hasn't been hit, clamped to ±40% of price
        primary_target: float | None = None
        for fl in sorted(fib_levels, key=lambda f: abs(f.price - current_price)):
            if fl.ratio not in _FIB_EXTENSIONS:
                continue
            if direction == "bullish" and fl.price > current_price * 0.99:
                if fl.price <= current_price * (1 + _MAX_TARGET_DEVIATION):
                    primary_target = fl.price
                    break
            elif direction == "bearish" and fl.price < current_price * 1.01:
                if fl.price >= current_price * (1 - _MAX_TARGET_DEVIATION):
                    primary_target = fl.price
                    break

        confidence = self._calculate_confidence(
            primary, alternative, fib_levels, merged,
        )
        key_levels = self._build_key_levels(
            primary, alternative, fib_levels, wave_label,
            invalidation, alt_invalidation, primary_target, merged,
        )
        reasoning = self._build_reasoning(
            ticker, primary, alternative, wave_label,
            confidence, invalidation, primary_target,
        )
        return self.create_signal(
            ticker=ticker, direction=direction, confidence=confidence,
            timeframe=timeframe, reasoning=reasoning, key_levels=key_levels,
        )

    # -- data preparation --------------------------------------------------

    def _merge_data(
        self, price_data: pd.DataFrame, volume_data: pd.DataFrame,
    ) -> pd.DataFrame:
        merged = pd.merge(price_data, volume_data, on="date", how="inner")
        merged["volume"] = merged["volume"].fillna(0.0)
        merged = merged.sort_values("date", ascending=True).reset_index(drop=True)
        return merged[["date", "open", "high", "low", "close", "volume"]]

    # -- pivot detection (ZigZag) -------------------------------------------

    def _compute_atr(
        self, df: pd.DataFrame, chart_timeframe: str = "1d", period: int = 50,
    ) -> float:
        """Median ATR percentage threshold for ZigZag, scaled to `chart_timeframe`."""
        # Look up per-timeframe (atr_mult, min_pct) — fall back to 1d defaults.
        atr_mult, min_pct = _TIMEFRAME_ZIGZAG.get(
            chart_timeframe, (_ZIGZAG_ATR_MULTIPLIER, _ZIGZAG_MIN_PCT)
        )
        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values
        n = len(df)
        if n < 2:
            return min_pct
        lookback = min(n - 1, period)
        true_ranges: list[float] = []
        for i in range(n - lookback, n):
            hl = highs[i] - lows[i]
            hc = abs(highs[i] - closes[i - 1])
            lc = abs(lows[i] - closes[i - 1])
            true_ranges.append(max(hl, hc, lc))
        if not true_ranges:
            return min_pct
        true_ranges.sort()
        median_tr = true_ranges[len(true_ranges) // 2]
        current_close = float(closes[-1])
        if current_close <= 0:
            return min_pct
        pct = (median_tr / current_close) * atr_mult
        return max(min(pct, 0.25), min_pct)

    def _detect_pivots_zigzag(
        self, df: pd.DataFrame, chart_timeframe: str = "1d",
    ) -> list[_SwingPoint]:
        """Identify structural pivot highs/lows via ZigZag confirmation.

        A pivot high is CONFIRMED once price drops >= ATR threshold below it.
        A pivot low is CONFIRMED once price rallies >= ATR threshold above it.
        The threshold scales with `chart_timeframe`: 1H is tight (1.5%), 1W is
        wide (6%) to capture macro Elliott Wave structure across different degrees.
        """
        highs = df["high"].values
        lows = df["low"].values
        n = len(df)
        if n < 3:
            return []
        threshold = self._compute_atr(df, chart_timeframe)
        confirmed: list[_SwingPoint] = []
        direction: str = "up" if highs[-1] > highs[0] else "down"
        extreme_price: float = highs[0] if direction == "up" else lows[0]
        extreme_idx: int = 0
        for i in range(1, n):
            if direction == "up":
                if highs[i] > extreme_price:
                    extreme_price = float(highs[i])
                    extreme_idx = i
                elif lows[i] < extreme_price * (1.0 - threshold):
                    confirmed.append(_SwingPoint(extreme_idx, extreme_price, "high"))
                    direction = "down"
                    extreme_price = float(lows[i])
                    extreme_idx = i
            else:
                if lows[i] < extreme_price:
                    extreme_price = float(lows[i])
                    extreme_idx = i
                elif highs[i] > extreme_price * (1.0 + threshold):
                    confirmed.append(_SwingPoint(extreme_idx, extreme_price, "low"))
                    direction = "up"
                    extreme_price = float(highs[i])
                    extreme_idx = i
        if confirmed:
            last_type = "high" if direction == "up" else "low"
            if confirmed[-1].index != extreme_idx:
                confirmed.append(_SwingPoint(extreme_idx, extreme_price, last_type))
        return confirmed

    # -- candidate generation -----------------------------------------------

    def _build_candidates(
        self, swings: list[_SwingPoint],
    ) -> list[tuple[tuple[_WaveSegment, ...], str]]:
        """Build (waves, pattern_type) candidates. Corrective patterns are
        only proposed counter-trend (EW theory: corrections go against the trend)."""
        if len(swings) < 2:
            return []

        segments: list[_WaveSegment] = []
        for i in range(len(swings) - 1):
            s0, s1 = swings[i], swings[i + 1]
            d = "up" if s1.price > s0.price else "down"
            segments.append(_WaveSegment(
                s0.index, s1.index, s0.price, s1.price, d, abs(s1.price - s0.price),
            ))

        # Trend direction from overall swing sequence
        trend_up = swings[-1].price > swings[0].price
        # Corrective first wave goes AGAINST the trend
        corrective_first_dir = "down" if trend_up else "up"

        five_groups = [tuple(segments[i:i + 5]) for i in range(len(segments) - 4)][::-1]
        three_groups = [tuple(segments[i:i + 3]) for i in range(len(segments) - 2)][::-1]

        candidates: list[tuple[tuple[_WaveSegment, ...], str]] = []
        # Impulse: no trend-direction restriction
        for w5 in five_groups:
            candidates.append((w5, "impulse"))
        # Corrective: COUNTER-TREND only
        for w3 in three_groups:
            if w3[0].direction == corrective_first_dir:
                candidates.append((w3, "corrective"))
        if len(candidates) >= _MAX_CANDIDATES:
            return candidates[:_MAX_CANDIDATES]
        return candidates

    # -- rule validation ----------------------------------------------------

    def _validate_rules(
        self, waves: tuple[_WaveSegment, ...], pattern_type: str,
    ) -> tuple[bool, int]:
        if pattern_type == "impulse" and len(waves) == 5:
            w1, w2, w3, w4, w5 = waves
            passed = 0
            # R1: Wave 2 retrace < 100% of Wave 1
            if w1.direction == "up":
                r1 = w2.end_price > w1.start_price
            else:
                r1 = w2.end_price < w1.start_price
            passed += int(r1)
            # R2: Wave 3 NOT shortest of 1, 3, 5
            r2 = not (w3.length < w1.length and w3.length < w5.length)
            passed += int(r2)
            # R3: Wave 4 no overlap with Wave 1
            if w1.direction == "up":
                r3 = w4.end_price >= w1.end_price
            else:
                r3 = w4.end_price <= w1.end_price
            passed += int(r3)
            return (passed == 3, passed)

        if pattern_type == "corrective" and len(waves) == 3:
            wa, wb, wc = waves
            passed = 0
            if wa.direction == "up":
                passed += int(wb.end_price > wa.start_price)
            else:
                passed += int(wb.end_price < wa.start_price)
            passed += int(wa.direction == wc.direction)
            passed += int(wc.length > 0)
            return (passed == 3, passed)

        return (False, 0)

    # -- guideline scoring --------------------------------------------------

    def _score_guidelines(
        self, waves: tuple[_WaveSegment, ...], pattern_type: str,
    ) -> float:
        score = 0.0
        if pattern_type == "impulse" and len(waves) == 5:
            w1, w2, w3, w4, w5 = waves
            w2r = w2.length / max(w1.length, _EPSILON)
            if _GUIDELINE_W2_RETRACE_LOW <= w2r <= _GUIDELINE_W2_RETRACE_HIGH:
                score += 1.0
            if w3.length / max(w1.length, _EPSILON) >= _GUIDELINE_W3_EXTENSION:
                score += 1.0
            w4r = w4.length / max(w3.length, _EPSILON)
            if abs(w4r - _GUIDELINE_W4_RETRACE) <= _GUIDELINE_W5_EQUALITY_TOLERANCE:
                score += 1.0
            if abs(w5.length / max(w1.length, _EPSILON) - 1.0) <= _GUIDELINE_W5_EQUALITY_TOLERANCE:
                score += 1.0
        elif pattern_type == "corrective" and len(waves) == 3:
            wa, wb, wc = waves
            wbr = wb.length / max(wa.length, _EPSILON)
            if _GUIDELINE_W2_RETRACE_LOW <= wbr <= _GUIDELINE_W2_RETRACE_HIGH:
                score += 1.0
            if abs(wc.length / max(wa.length, _EPSILON) - 1.0) <= _GUIDELINE_W5_EQUALITY_TOLERANCE:
                score += 1.0
        return score

    # -- position assessment ------------------------------------------------

    def _assess_position(
        self, count: _WaveCount, current_price: float, merged: pd.DataFrame,
    ) -> tuple[str, str, str]:
        waves = count.waves
        last_bar = len(merged) - 1
        cwi = len(waves) - 1
        for i, w in enumerate(waves):
            if w.end_index >= last_bar:
                cwi = i
                break

        if count.pattern_type == "impulse" and len(waves) == 5:
            wn = cwi + 1
            up = waves[0].direction == "up"
            direction = ("bullish" if up else "bearish") if wn % 2 == 1 else ("bearish" if up else "bullish")
            wave_label = f"Wave {wn} of impulse {'up' if up else 'down'}"
            timeframe = "short" if wn == 5 else ("long" if wn <= 2 else "medium")
        elif count.pattern_type == "corrective" and len(waves) == 3:
            wave_label = f"Wave {('A', 'B', 'C')[min(cwi, 2)]} of corrective"
            direction = "bearish" if waves[0].direction == "down" else "bullish"
            timeframe = "medium"
        else:
            wave_label = "Indeterminate wave position"
            direction = "neutral"
            timeframe = self.default_timeframe
        return (wave_label, direction, timeframe)

    # -- fibonacci levels ---------------------------------------------------

    def _calculate_fibonacci_levels(
        self, count: _WaveCount, current_price: float,
    ) -> list[_FibLevel]:
        waves = count.waves
        if not waves:
            return []
        w1 = waves[0]
        w1r = abs(w1.end_price - w1.start_price)
        if w1r < _EPSILON:
            return []

        levels: list[_FibLevel] = []
        for ratio in _FIB_RETRACEMENTS:
            if w1.direction == "up":
                price = w1.end_price - ratio * w1r
            else:
                price = w1.end_price + ratio * w1r
            dist = abs(current_price - price) / max(current_price, _EPSILON)
            levels.append(_FibLevel(ratio, price, f"{ratio*100:.1f}% retracement", dist <= _FIB_CONFLUENCE_TOLERANCE))

        base = waves[1].end_price if len(waves) >= 2 else w1.start_price
        for ratio in _FIB_EXTENSIONS:
            price = (base + ratio * w1r) if w1.direction == "up" else (base - ratio * w1r)
            dist = abs(current_price - price) / max(current_price, _EPSILON)
            levels.append(_FibLevel(ratio, price, f"{ratio*100:.1f}% extension", dist <= _FIB_CONFLUENCE_TOLERANCE))
        return levels

    # -- confidence ---------------------------------------------------------

    def _calculate_confidence(
        self, primary: _WaveCount, alternative: _WaveCount | None,
        fib_levels: list[_FibLevel], merged: pd.DataFrame,
    ) -> float:
        conf = _CONFIDENCE_BASE
        conf += primary.guideline_score * _CONFIDENCE_PER_GUIDELINE

        if any(fl.is_aligned for fl in fib_levels):
            conf += _CONFIDENCE_FIB_CONFLUENCE

        # Volume: odd waves (1,3,5) vs even waves (2,4)
        waves = primary.waves
        if len(waves) >= 3 and len(merged) > 0:
            odd_v: list[float] = []
            even_v: list[float] = []
            vv = merged["volume"].values
            for i, w in enumerate(waves):
                s, e = max(0, w.start_index), min(len(vv), w.end_index + 1)
                if e > s:
                    mv = float(np.mean(vv[s:e]))
                    if not (math.isnan(mv) or math.isinf(mv)):
                        (odd_v if i % 2 == 0 else even_v).append(mv)
            if odd_v and even_v:
                if sum(odd_v) / len(odd_v) > sum(even_v) / len(even_v):
                    conf += _CONFIDENCE_VOLUME_CONFIRMS

        if alternative is None:
            conf += _CONFIDENCE_WAVE_CLARITY
        else:
            diff = primary.total_score - alternative.total_score
            if diff > 1.0:
                conf += _CONFIDENCE_WAVE_CLARITY
            elif diff < 0.5:
                conf -= _CONFIDENCE_AMBIGUITY_PENALTY

        if math.isnan(conf) or math.isinf(conf):
            conf = _CONFIDENCE_BASE
        return max(_CONFIDENCE_FLOOR, min(_CONFIDENCE_CAP, conf))

    # -- invalidation -------------------------------------------------------

    def _determine_invalidation(self, count: _WaveCount, merged: pd.DataFrame) -> float:
        waves = count.waves
        if not waves:
            return float(merged["close"].iloc[-1])

        last_bar = len(merged) - 1
        cwi = len(waves) - 1
        for i, w in enumerate(waves):
            if w.end_index >= last_bar:
                cwi = i
                break

        if count.pattern_type == "impulse" and len(waves) == 5:
            if cwi <= 1:
                return waves[0].start_price
            elif cwi <= 3:
                return waves[1].end_price
            else:
                return waves[3].end_price

        if count.pattern_type == "corrective" and len(waves) >= 1:
            return waves[0].start_price
        return waves[0].start_price

    # -- key levels ---------------------------------------------------------

    def _build_key_levels(
        self, primary: _WaveCount, alternative: _WaveCount | None,
        fib_levels: list[_FibLevel], wave_label: str,
        invalidation: float, alt_invalidation: float,
        primary_target: float | None,
        merged: pd.DataFrame | None = None,
    ) -> dict[str, Any]:
        fib_map: dict[float, float] = {fl.ratio: fl.price for fl in fib_levels}
        fib_targets: dict[str, float] = {}
        for key, ratio in zip(_FIB_OUTPUT_KEYS, _FIB_OUTPUT_RATIOS):
            if ratio in fib_map:
                fib_targets[key] = round(fib_map[ratio], 4)

        # Structured fib levels for chart overlay
        fib_levels_detailed = [
            {
                "ratio": fl.ratio,
                "price": round(fl.price, 4),
                "label": fl.label,
                "aligned": fl.is_aligned,
                "type": "extension" if fl.ratio >= 1.0 else "retracement",
            }
            for fl in fib_levels
        ]

        # Wave turning points for chart overlay zigzag
        wave_points: list[dict[str, Any]] = []
        if primary.waves and merged is not None and not merged.empty:
            ptype = primary.pattern_type
            if ptype == "impulse":
                labels = ["0", "1", "2", "3", "4", "5"]
            else:
                labels = ["0", "A", "B", "C"]

            def _safe_time(idx: int) -> str:
                idx = max(0, min(idx, len(merged) - 1))
                t = merged["date"].iloc[idx]
                return t.isoformat() if hasattr(t, "isoformat") else str(t)

            wave_points.append({
                "time": _safe_time(primary.waves[0].start_index),
                "price": round(primary.waves[0].start_price, 4),
                "label": labels[0],
            })
            for i, w in enumerate(primary.waves):
                lbl = labels[i + 1] if (i + 1) < len(labels) else str(i + 1)
                wave_points.append({
                    "time": _safe_time(w.end_index),
                    "price": round(w.end_price, 4),
                    "label": lbl,
                })

        alt_label = ""
        if alternative is not None:
            alt_label = (
                f"{alternative.pattern_type} "
                f"({alternative.rules_passed} rules, "
                f"score {alternative.total_score:.1f})"
            )
        wave_start = primary.waves[0].start_price if primary.waves else 0.0
        return {
            "current_wave": wave_label,
            "wave_start": round(wave_start, 4),
            "invalidation": invalidation,
            "fib_targets": fib_targets,
            "fib_levels_detailed": fib_levels_detailed,
            "wave_points": wave_points,
            "pattern_type": primary.pattern_type,
            "primary_target": primary_target,
            "alternative_count": alt_label,
            "alternative_invalidation": alt_invalidation,
        }

    # -- reasoning ----------------------------------------------------------

    def _build_reasoning(
        self, ticker: str, primary: _WaveCount, alternative: _WaveCount | None,
        wave_label: str, confidence: float, invalidation: float,
        primary_target: float | None,
    ) -> str:
        safe_ticker = "".join(
            ch for ch in str(ticker) if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = [
            f"{safe_ticker} is in {wave_label} "
            f"({primary.pattern_type}, {primary.rules_passed}/3 rules passed).",
        ]
        if primary_target is not None:
            parts.append(f"Primary target at {primary_target:.2f}.")
        parts.append(f"Invalidation at {invalidation:.2f}.")
        mg = 4.0 if primary.pattern_type == "impulse" else 2.0
        parts.append(f"Guideline score: {primary.guideline_score:.1f}/{mg:.1f}.")
        if alternative is not None:
            parts.append(
                f"Alternative: {alternative.pattern_type} "
                f"(score {alternative.total_score:.1f})."
            )
        if confidence >= _CONFIDENCE_HIGH_QUALIFIER:
            q = "high"
        elif confidence >= _CONFIDENCE_MODERATE_QUALIFIER:
            q = "moderate"
        else:
            q = "low"
        parts.append(f"Confidence: {q} ({confidence:.2f}).")
        return " ".join(parts)
