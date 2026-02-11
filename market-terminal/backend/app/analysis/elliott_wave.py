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
        self.validate_input(price_data, volume_data)
        merged = self._merge_data(price_data, volume_data)
        current_price = float(merged["close"].iloc[-1])
        swing_n = kwargs.get("swing_n", _DEFAULT_SWING_N)
        swings = self._detect_swings(merged, swing_n)

        if len(swings) < _MIN_SWINGS_REQUIRED:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_INSUFFICIENT_DATA_CONFIDENCE,
                timeframe=self.default_timeframe,
                reasoning="Insufficient swing points for Elliott Wave analysis.",
                key_levels={"current_price": current_price},
            )

        candidates = self._build_candidates(swings)
        scored: list[_WaveCount] = []
        for waves in candidates:
            ptype = "impulse" if len(waves) == 5 else "corrective"
            all_ok, rpassed = self._validate_rules(waves, ptype)
            gscore = self._score_guidelines(waves, ptype)
            rbonus = 3.0 if all_ok else float(rpassed)
            scored.append(_WaveCount(waves, ptype, rpassed, gscore, rbonus + gscore))

        if not scored:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_INSUFFICIENT_DATA_CONFIDENCE,
                timeframe=self.default_timeframe,
                reasoning="No valid Elliott Wave patterns detected.",
                key_levels={"current_price": current_price},
            )

        scored.sort(key=lambda c: c.total_score, reverse=True)
        primary = scored[0]
        alternative = scored[1] if len(scored) > 1 else None

        wave_label, direction, timeframe = self._assess_position(
            primary, current_price, merged,
        )
        fib_levels = self._calculate_fibonacci_levels(primary, current_price)
        invalidation = self._determine_invalidation(primary, merged)
        alt_invalidation = (
            self._determine_invalidation(alternative, merged)
            if alternative is not None else invalidation
        )

        primary_target: float | None = None
        for fl in fib_levels:
            if fl.ratio in _FIB_EXTENSIONS:
                primary_target = fl.price
                break

        confidence = self._calculate_confidence(
            primary, alternative, fib_levels, merged,
        )
        key_levels = self._build_key_levels(
            primary, alternative, fib_levels, wave_label,
            invalidation, alt_invalidation, primary_target,
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

    # -- swing detection ----------------------------------------------------

    def _detect_swings(
        self, df: pd.DataFrame, swing_n: int = _DEFAULT_SWING_N,
    ) -> list[_SwingPoint]:
        highs: np.ndarray = df["high"].values
        lows: np.ndarray = df["low"].values
        raw: list[_SwingPoint] = []

        for i in range(swing_n, len(df) - swing_n):
            ws = i - swing_n
            we = i + swing_n + 1
            if highs[i] >= np.max(highs[ws:we]):
                raw.append(_SwingPoint(i, float(highs[i]), "high"))
            if lows[i] <= np.min(lows[ws:we]):
                raw.append(_SwingPoint(i, float(lows[i]), "low"))

        raw.sort(key=lambda sp: (sp.index, sp.swing_type))

        # Enforce alternation: consecutive same-type -> keep more extreme
        result: list[_SwingPoint] = []
        for sp in raw:
            if not result or result[-1].swing_type != sp.swing_type:
                result.append(sp)
            else:
                prev = result[-1]
                if sp.swing_type == "high" and sp.price > prev.price:
                    result[-1] = sp
                elif sp.swing_type == "low" and sp.price < prev.price:
                    result[-1] = sp
        return result

    # -- candidate generation -----------------------------------------------

    def _build_candidates(
        self, swings: list[_SwingPoint],
    ) -> list[tuple[_WaveSegment, ...]]:
        if len(swings) < 2:
            return []

        segments: list[_WaveSegment] = []
        for i in range(len(swings) - 1):
            s0, s1 = swings[i], swings[i + 1]
            d = "up" if s1.price > s0.price else "down"
            segments.append(_WaveSegment(
                s0.index, s1.index, s0.price, s1.price, d, abs(s1.price - s0.price),
            ))

        candidates: list[tuple[_WaveSegment, ...]] = []
        for i in range(len(segments) - 4):
            candidates.append(tuple(segments[i:i + 5]))
            if len(candidates) >= _MAX_CANDIDATES:
                return candidates
        for i in range(len(segments) - 2):
            candidates.append(tuple(segments[i:i + 3]))
            if len(candidates) >= _MAX_CANDIDATES:
                return candidates
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
    ) -> dict[str, Any]:
        fib_map: dict[float, float] = {fl.ratio: fl.price for fl in fib_levels}
        fib_targets: dict[str, float] = {}
        for key, ratio in zip(_FIB_OUTPUT_KEYS, _FIB_OUTPUT_RATIOS):
            if ratio in fib_map:
                fib_targets[key] = round(fib_map[ratio], 4)

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
