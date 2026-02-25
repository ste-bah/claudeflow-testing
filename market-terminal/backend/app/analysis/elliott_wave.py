"""Elliott Wave analysis module — Neely Method, Multi-Degree Implementation.

Simultaneously detects wave structure at five hierarchical degrees:

  Supercycle → Cycle → Primary → Intermediate → Minor

Each degree uses an independently calibrated ATR threshold to build its own
monowave sequence, then validates Neely's strict impulse and corrective rules
independently at that degree. All degrees are returned in a tree so the UI can
show: "Cycle: Wave 3 of impulse up → Primary: Wave A of zigzag corrective → ..."

Neely Rules Enforced (per degree):
  Impulse:
    R1  Wave 2 cannot retrace > 99% of Wave 1.
    R2  Wave 3 cannot be the shortest of W1, W3, W5 (by price).
    R3  Wave 4 cannot overlap Wave 1 territory.
    R4  Alternation: W2 and W4 must differ in Price, Time, or Severity.
  Corrective:
    Zigzag  B retraces < 61.8% of A; C extends beyond A's end.
    Flat    B retraces ≥ 61.8% of A; C ≈ equal to A.

Full implementation: TASK-NEELY-005
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, NamedTuple

logger = logging.getLogger(__name__)

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, MethodologySignal

# ---------------------------------------------------------------------------
# Degree registry — (name, min_pct_swing, atr_multiplier, target_bars, max_bars)
_DEGREES: list[tuple[str, float, float, int, int]] = [
    ("supercycle",    0.35, 4.0, 500, 5000),
    ("cycle",         0.20, 3.0, 300, 2000),
    ("primary",       0.10, 2.2, 150, 800),
    ("intermediate",  0.05, 1.6, 60,  300),
    ("minor",         0.015, 1.2, 20,  120), # Tightened for better micro-analysis
]

# Minimum bars of price data to sensibly run each degree
_DEGREE_MIN_BARS: dict[str, int] = {
    "supercycle":   400,
    "cycle":        200,
    "primary":      80,
    "intermediate": 30,
    "minor":        15,
}

# Labels for each degree in reasoning text
_DEGREE_LABEL: dict[str, str] = {
    "supercycle":   "SC",
    "cycle":        "CY",
    "primary":      "P",
    "intermediate": "I",
    "minor":        "m",
}

# Timeframe → preferred degrees (most relevant first).
# Used by _choose_primary_degree() to bias selection toward the degree that
# makes sense for the user's current chart resolution.
_TIMEFRAME_PREFERRED_DEGREES: dict[str, list[str]] = {
    "1m":  ["minor", "minuet", "intermediate"],
    "1w":  ["cycle", "primary", "intermediate"],
    "1d":  ["primary", "intermediate", "cycle"],
    "4h":  ["intermediate", "minor", "primary"],
    "1h":  ["minor", "intermediate", "primary"],
    "15m": ["minor", "intermediate"],
    "5m":  ["minor"],
}

# Per-degree "live" bar thresholds — how many bars back a wave-end may sit and
# still be considered "active" (not stale) for scoring purposes.
# Larger degrees span many more bars so their recency window must be wider.
_live_thresholds: dict[str, int] = {
    "supercycle":   200,
    "cycle":        150,
    "primary":      100,
    "intermediate":  50,
    "minor":         25,
}

# Per-degree span range (bars).  A candidate whose total bar-span falls outside
# [min_bars, max_bars] is silently skipped — preventing supercycle from winning
# on a 7-bar window and minuet from claiming a 1000-bar structure.
_DEGREE_SPAN_BARS: dict[str, tuple[int, int]] = {
    "supercycle":   (500,  99999),
    "cycle":        (200,  3000),
    "primary":      (60,   200),   # upper = cycle lower → non-overlapping
    "intermediate": (15,   60),    # upper = primary lower → non-overlapping
    "minor":        (5,    15),    # upper = intermediate lower → non-overlapping
    "minuet":       (2,    5),     # upper = minor lower → non-overlapping
}

# ---------------------------------------------------------------------------
# Core constants
# ---------------------------------------------------------------------------

_EPSILON: float = 1e-10
_MAX_TICKER_LENGTH: int = 20
_MAX_CANDIDATES: int = 100

_W2_MAX_RETRACE: float = 0.990
_W3_EXTENSION_THRESHOLD: float = 1.618
_FLAT_B_MIN_RETRACE: float = 0.618
_EQUALITY_TOLERANCE: float = 0.10

_FIB_RETRACEMENTS: tuple[float, ...] = (0.236, 0.382, 0.500, 0.618, 0.786)
_FIB_EXTENSIONS: tuple[float, ...] = (1.000, 1.272, 1.618, 2.000, 2.618)
_FIB_OUTPUT_KEYS: tuple[str, ...] = (
    "23.6%", "38.2%", "50.0%", "61.8%", "100.0%", "161.8%",
)
_FIB_OUTPUT_RATIOS: tuple[float, ...] = (0.236, 0.382, 0.500, 0.618, 1.000, 1.618)
_FIB_CONFLUENCE_TOLERANCE: float = 0.012
_MAX_TARGET_DEVIATION: float = 0.60

_CONF_BASE: float = 0.40
_CONF_FLOOR: float = 0.15
_CONF_CAP: float = 1.00
_CONF_NO_PATTERN: float = 0.15
_CONFIDENCE_HIGH: float = 0.70
_CONFIDENCE_MODERATE: float = 0.50


# ---------------------------------------------------------------------------
# NamedTuples / Dataclasses
# ---------------------------------------------------------------------------


class _WaveSegment(NamedTuple):
    start_index: int
    end_index:   int
    start_price: float
    end_price:   float
    direction:   str    # "up" | "down"
    length:      float  # absolute price distance


class _WaveCount(NamedTuple):
    waves:            tuple[_WaveSegment, ...]
    pattern_type:     str    # "impulse" | "corrective"
    corrective_sub:   str    # "" | "zigzag" | "flat"
    rules_passed:     int
    guideline_score:  float
    total_score:      float


class _FibLevel(NamedTuple):
    ratio:      float
    price:      float
    label:      str
    is_aligned: bool


@dataclass
class _DegreeResult:
    """Best wave count found at a given Elliott Wave degree."""
    degree:        str
    count:         _WaveCount | None = None
    wave_label:    str = ""           # e.g. "Wave 3 of Cycle impulse up"
    current_wave:  int = 0            # 1-5 for impulse, 1-3 for corrective
    direction:     str = "neutral"
    invalidation:  float = 0.0
    target:        float | None = None
    confidence:    float = 0.0
    is_live:          bool = False       # True if pattern ends near current bar
    end_offset:       int = 999          # Bars from chart end
    pattern_complete: bool = False       # True if entire pattern ended before current bar
    wave_points:      list[dict[str, Any]] = field(default_factory=list)
    fib_levels:       list[_FibLevel] = field(default_factory=list)


# ---------------------------------------------------------------------------
# ElliottWaveAnalyzer — Multi-Degree Neely Engine
# ---------------------------------------------------------------------------


class ElliottWaveAnalyzer(BaseMethodology):
    """Multi-degree Elliott Wave analysis using Glenn Neely's objective rules.

    Simultaneously detects wave structure at Supercycle, Cycle, Primary,
    Intermediate, and Minor degrees across the full price history.
    """

    name:             str = "elliott_wave"
    display_name:     str = "Elliott Wave"
    default_timeframe: str = "medium"
    version:          str = "3.0.0"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

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
        n_bars = len(merged)

        # ---- Data quality gate (broken / flat symbols) -------------------
        if n_bars < 10:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_CONF_NO_PATTERN,
                timeframe=self.default_timeframe,
                reasoning="Insufficient data: fewer than 10 bars available.",
                key_levels={"current_price": current_price},
            )
        close_range = float(merged["close"].max() - merged["close"].min())
        if close_range <= 0.0:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_CONF_NO_PATTERN,
                timeframe=self.default_timeframe,
                reasoning="Insufficient data: flat price series (zero price range).",
                key_levels={"current_price": current_price},
            )
        if merged["close"].nunique() < 3:
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_CONF_NO_PATTERN,
                timeframe=self.default_timeframe,
                reasoning="Insufficient data: fewer than 3 unique close prices.",
                key_levels={"current_price": current_price},
            )

        # ---- Restrict degrees to those appropriate for this timeframe ----
        chart_timeframe: str = str(kwargs.get("chart_timeframe", "1d"))
        allowed_degrees: set[str] = set(
            _TIMEFRAME_PREFERRED_DEGREES.get(chart_timeframe, [d[0] for d in _DEGREES])
        )

        # ---- Run analysis at each degree --------------------------------
        degree_results: list[_DegreeResult] = []
        for name, min_pct, atr_mult, target_bars, max_bars in _DEGREES:
            if name not in allowed_degrees:
                continue
            min_bars = _DEGREE_MIN_BARS[name]
            if n_bars < min_bars:
                continue
            result = self._analyze_degree(
                name, min_pct, atr_mult, target_bars, max_bars, merged, current_price
            )
            degree_results.append(result)

        if not degree_results or all(r.count is None for r in degree_results):
            return self.create_signal(
                ticker=ticker, direction="neutral",
                confidence=_CONF_NO_PATTERN,
                timeframe=self.default_timeframe,
                reasoning="No valid wave structures detected at any degree.",
                key_levels={"current_price": current_price},
            )

        # ---- Choose primary degree for signal ---------------------------
        best = self._choose_primary_degree(degree_results, chart_timeframe)
        primary_result = best

        # ---- Build output -----------------------------------------------
        confidence = self._aggregate_confidence(degree_results, primary_result)
        key_levels = self._build_key_levels(
            degree_results, primary_result, current_price, merged,
        )
        reasoning = self._build_reasoning(ticker, degree_results, primary_result, confidence)

        return self.create_signal(
            ticker=ticker,
            direction=primary_result.direction,
            confidence=confidence,
            timeframe=self._timeframe_for_degree(primary_result.degree, primary_result.current_wave),
            reasoning=reasoning,
            key_levels=key_levels,
        )

    # ------------------------------------------------------------------
    # Per-degree analysis
    # ------------------------------------------------------------------

    def _analyze_degree(
        self,
        degree: str,
        min_pct: float,
        atr_mult: float,
        target_bars: int,
        max_bars: int,
        merged: pd.DataFrame,
        current_price: float,
    ) -> _DegreeResult:
        result = _DegreeResult(degree=degree)
        segments = self._construct_segments(merged, min_pct, atr_mult)
        if len(segments) < 3:
            return result

        candidates = self._build_candidates(segments)

        # --- span gate: only score candidates appropriate for this degree ---
        min_span, max_span = _DEGREE_SPAN_BARS.get(degree, (2, 99999))
        candidates = [
            (waves, ptype) for (waves, ptype) in candidates
            if min_span <= (waves[-1].end_index - waves[0].start_index) <= max_span
        ]
        if not candidates:
            return result

        scored: list[_WaveCount] = []
        last_bar_idx = len(merged) - 1

        for waves, ptype in candidates:
            # 1. Neely Proportion Check
            if not self._check_proportion(waves, ptype):
                continue

            # 2. Rule Validation
            ok, rp = self._validate_rules(waves, ptype)
            if not ok:
                continue

            # 3. Guideline Scoring
            gscore, subtype = self._score_guidelines(waves, ptype)

            # 4. Duration/Recency Scoring (Degree-Aware)
            duration_bars = waves[-1].end_index - waves[0].start_index

            # Penalize patterns exceeding degree max_bars
            if duration_bars > max_bars:
                continue

            # Duration bonus: prefer patterns near target_bars
            # Linear ramp to 1.0 at target, then degrades if too long
            if duration_bars <= target_bars:
                duration_score = duration_bars / target_bars
            else:
                # Slow decay if exceeding target but under max
                over = duration_bars - target_bars
                duration_score = max(0.0, 1.0 - (over / (max_bars - target_bars)))

            # Recency bonus: tiebreaker only — must not dominate structural scoring
            # rp max≈4, gscore max≈5.5 — keep bonus << 0.3 so it never overrides quality
            recency_bonus = 0.0
            gap = last_bar_idx - waves[-1].end_index
            if gap <= 5:
                recency_bonus = 0.2 if degree in ["minor", "intermediate"] else 0.1
            elif gap <= 15:
                recency_bonus = 0.1 if degree in ["minor", "intermediate"] else 0.05

            total_score = float(rp) + gscore + duration_score + recency_bonus
            scored.append(_WaveCount(waves, ptype, subtype, rp, gscore, total_score))

        if not scored:
            return result

        scored.sort(key=lambda c: c.total_score, reverse=True)

        # Drop wave counts already invalidated by current price
        valid: list[_WaveCount] = []
        for c in scored:
            inval = self._determine_invalidation(c, merged)
            if c.waves[0].direction == "up" and current_price >= inval * 0.995:
                valid.append(c)
            elif c.waves[0].direction == "down" and current_price <= inval * 1.005:
                valid.append(c)

        if not valid:
            return result

        best = valid[0]
        result.count = best
        result.wave_label, result.direction, cwi, result.pattern_complete = self._assess_position(best, merged)
        wave_max = 5 if (best.pattern_type == "impulse") else 3
        result.current_wave = min(cwi + 1, wave_max)
        result.invalidation = self._determine_invalidation(best, merged)
        result.fib_levels = self._calculate_fibonacci_levels(best, current_price)
        result.target = self._calculate_target(result.fib_levels, current_price, result.direction)
        result.confidence = self._calculate_confidence_for_count(
            best, valid[1] if len(valid) > 1 else None, result.fib_levels, merged,
        )
        result.wave_points = self._build_wave_points(best, merged)

        # Liveness check: Is this count current or historically "stale"?
        # Threshold is degree-aware: supercycle waves ending 150 bars ago are still
        # live; minuet waves are stale after just 25 bars.
        last_wave_end = best.waves[-1].end_index
        n_bars = len(merged)
        result.end_offset = n_bars - 1 - last_wave_end
        live_threshold = _live_thresholds.get(degree, 25)
        result.is_live = (result.end_offset <= live_threshold)

        return result

    # ------------------------------------------------------------------
    # Pivot / Monowave construction
    # ------------------------------------------------------------------

    def _merge_data(
        self, price_data: pd.DataFrame, volume_data: pd.DataFrame,
    ) -> pd.DataFrame:
        merged = pd.merge(price_data, volume_data, on="date", how="inner")
        merged["volume"] = merged["volume"].fillna(0.0)
        merged = merged.sort_values("date", ascending=True).reset_index(drop=True)
        return merged[["date", "open", "high", "low", "close", "volume"]]

    def _construct_segments(
        self,
        df: pd.DataFrame,
        min_pct: float,
        atr_mult: float,
        pivot_period: int = 50,
    ) -> list[_WaveSegment]:
        """Build wave segments for a given degree using ATR-scaled ZigZag."""
        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values
        n = len(df)
        if n < 3:
            return []

        # Compute ATR-based threshold
        lookback = min(n - 1, pivot_period)
        true_ranges: list[float] = []
        for i in range(n - lookback, n):
            hl = highs[i] - lows[i]
            hc = abs(highs[i] - closes[i - 1])
            lc = abs(lows[i] - closes[i - 1])
            true_ranges.append(max(hl, hc, lc))
        if true_ranges:
            true_ranges.sort()
            median_tr = true_ranges[len(true_ranges) // 2]
            current_close = float(closes[-1])
            if current_close > 0:
                atr_pct = (median_tr / current_close) * atr_mult
                threshold = max(atr_pct, min_pct)
            else:
                threshold = min_pct
        else:
            threshold = min_pct

        # ZigZag pivot detection
        pivots: list[tuple[int, float, str]] = []
        direction = "up" if highs[-1] > highs[0] else "down"
        extreme_price = highs[0] if direction == "up" else lows[0]
        extreme_idx = 0

        for i in range(1, n):
            if direction == "up":
                if highs[i] > extreme_price:
                    extreme_price = float(highs[i])
                    extreme_idx = i
                elif lows[i] < extreme_price * (1.0 - threshold):
                    pivots.append((extreme_idx, extreme_price, "high"))
                    direction = "down"
                    extreme_price = float(lows[i])
                    extreme_idx = i
            else:
                if lows[i] < extreme_price:
                    extreme_price = float(lows[i])
                    extreme_idx = i
                elif highs[i] > extreme_price * (1.0 + threshold):
                    pivots.append((extreme_idx, extreme_price, "low"))
                    direction = "up"
                    extreme_price = float(highs[i])
                    extreme_idx = i

        if pivots:
            last_type = "high" if direction == "up" else "low"
            if pivots[-1][0] != extreme_idx:
                pivots.append((extreme_idx, extreme_price, last_type))

        if len(pivots) < 2:
            return []

        segments: list[_WaveSegment] = []
        for i in range(len(pivots) - 1):
            idx0, price0, _ = pivots[i]
            idx1, price1, _ = pivots[i + 1]
            d = "up" if price1 > price0 else "down"
            segments.append(_WaveSegment(idx0, idx1, price0, price1, d, abs(price1 - price0)))
        return segments

    # ------------------------------------------------------------------
    # Candidate generation
    # ------------------------------------------------------------------

    def _build_candidates(
        self, segments: list[_WaveSegment],
    ) -> list[tuple[tuple[_WaveSegment, ...], str]]:
        if len(segments) < 2:
            return []
        trend_up = segments[-1].end_price > segments[0].start_price
        corrective_first_dir = "down" if trend_up else "up"

        five = [(tuple(segments[i:i + 5]), "impulse")
                for i in range(len(segments) - 4)][::-1]
        three = [(tuple(segments[i:i + 3]), "corrective")
                 for i in range(len(segments) - 2)
                 if segments[i].direction == corrective_first_dir][::-1]
        # Interleave to guarantee correctives always reach the scoring stage.
        # Without this, 70+ impulse candidates consume the full [:100] limit on
        # large-cap daily charts, leaving correctives permanently unscored.
        return (five[:50] + three[:50])[:_MAX_CANDIDATES]

    # ------------------------------------------------------------------
    # Rule validation — strict Neely
    # ------------------------------------------------------------------

    def _validate_rules(
        self, waves: tuple[_WaveSegment, ...], ptype: str,
    ) -> tuple[bool, int]:
        if ptype == "impulse" and len(waves) == 5:
            return self._validate_impulse(waves)
        if ptype == "corrective" and len(waves) == 3:
            return self._validate_corrective(waves)
        return (False, 0)

    def _validate_impulse(self, waves: tuple[_WaveSegment, ...]) -> tuple[bool, int]:
        w1, w2, w3, w4, w5 = waves
        up = w1.direction == "up"
        # Direction alternation check
        exp = ["up", "down", "up", "down", "up"] if up else ["down", "up", "down", "up", "down"]
        if [w.direction for w in waves] != exp:
            return (False, 0)

        passed = 0
        # R1: W2 < 99% retrace of W1
        passed += int(w2.length / max(w1.length, _EPSILON) < _W2_MAX_RETRACE)
        # R2: W3 not shortest
        passed += int(not (w3.length < w1.length and w3.length < w5.length))
        # R3: W4 no overlap W1 — HARD FAIL per Frost & Prechter (only exception:
        # diagonal triangles, which are not modelled here).
        if up:
            r3_ok = (w4.end_price >= w1.end_price)
        else:
            r3_ok = (w4.end_price <= w1.end_price)
        if not r3_ok:
            return (False, passed)   # W4-W1 overlap is fatal — reject immediately
        passed += 1   # R3 passed
        # R5: W5 endpoint must be the absolute extreme of the entire 5-wave sequence
        all_prices = [
            w1.start_price, w1.end_price, w2.end_price,
            w3.end_price, w4.end_price, w5.end_price,
        ]
        if up:
            passed += int(w5.end_price >= max(all_prices) - _EPSILON)
        else:
            passed += int(w5.end_price <= min(all_prices) + _EPSILON)

        return (passed >= 3, passed)  # >= 3 allows developing waves where W5 hasn't reached extreme yet

    def _validate_corrective(self, waves: tuple[_WaveSegment, ...]) -> tuple[bool, int]:
        wa, wb, wc = waves
        passed = 0
        # B does not go beyond A's origin
        if wa.direction == "up":
            passed += int(wb.end_price > wa.start_price)
        else:
            passed += int(wb.end_price < wa.start_price)
        # C same direction as A
        passed += int(wc.direction == wa.direction)
        # C has length
        passed += int(wc.length > _EPSILON)
        return (passed == 3, passed)

    # ------------------------------------------------------------------
    # Guideline scoring
    # ------------------------------------------------------------------

    def _score_guidelines(
        self, waves: tuple[_WaveSegment, ...], ptype: str,
    ) -> tuple[float, str]:
        score = 0.0
        subtype = ""

        if ptype == "impulse" and len(waves) == 5:
            w1, w2, w3, w4, w5 = waves
            w2r = w2.length / max(w1.length, _EPSILON)
            if 0.50 <= w2r <= 0.786:
                score += 1.0
            w3r = w3.length / max(w1.length, _EPSILON)
            if w3r >= _W3_EXTENSION_THRESHOLD:
                score += 1.5
            w4r = w4.length / max(w3.length, _EPSILON)
            if 0.28 <= w4r <= 0.50:
                score += 1.0
            if self._check_alternation(w1, w2, w3, w4):
                score += 1.5
            if w3r >= _W3_EXTENSION_THRESHOLD:
                w5r = w5.length / max(w1.length, _EPSILON)
                if abs(w5r - 1.0) <= _EQUALITY_TOLERANCE or abs(w5r - 0.618) <= _EQUALITY_TOLERANCE:
                    score += 1.0

        elif ptype == "corrective" and len(waves) == 3:
            wa, wb, wc = waves
            wbr = wb.length / max(wa.length, _EPSILON)
            if wbr < _FLAT_B_MIN_RETRACE:
                subtype = "zigzag"
                score += 1.0
                # C extends beyond A's end (C goes further than A end in same direction)
                if wa.direction == "up":
                    if wc.end_price < wa.end_price:
                        score += 1.0
                else:
                    if wc.end_price > wa.end_price:
                        score += 1.0
                wcr = wc.length / max(wa.length, _EPSILON)
                if 0.85 <= wcr <= 1.15:
                    score += 0.5
            else:
                subtype = "flat"
                score += 1.0
                wcr = wc.length / max(wa.length, _EPSILON)
                if abs(wcr - 1.0) <= 0.20:
                    score += 1.0
                if 0.80 <= wbr <= 1.10:
                    score += 0.5

        return (score, subtype)

    def _check_alternation(
        self,
        w1: _WaveSegment, w2: _WaveSegment,
        w3: _WaveSegment, w4: _WaveSegment,
    ) -> bool:
        w2r = w2.length / max(w1.length, _EPSILON)
        w4r = w4.length / max(w3.length, _EPSILON)
        price_alt = abs(w2r - w4r) > 0.10
        w2t = w2.end_index - w2.start_index
        w4t = w4.end_index - w4.start_index
        avg_t = (w2t + w4t) / 2.0
        time_alt = avg_t > 0 and abs(w2t - w4t) / avg_t > 0.25
        severity_alt = (w2r > 0.618) != (w4r > 0.618)
        # Neely Method: valid alternation requires ≥2 of the 3 variables to differ
        alt_count = int(price_alt) + int(time_alt) + int(severity_alt)
        return alt_count >= 2

    # ------------------------------------------------------------------
    # Proportion check
    # ------------------------------------------------------------------

    def _check_proportion(self, waves: tuple[_WaveSegment, ...], ptype: str) -> bool:
        """Neely's Rule of Proportion: waves must have comparable complexity/duration."""
        if len(waves) < 3:
            return True

        # Duration comparison
        durations = [w.end_index - w.start_index for w in waves]
        max_d = max(durations)
        min_d = max(min(durations), 1)
        
        # Rule of thumb: extreme disproportion (e.g. > 25x) invalidates the pattern at this degree.
        # Weekly/monthly higher-degree waves naturally have unequal durations (e.g. a 5-week
        # crash vs. an 80-week rally), so a tight 10x threshold falsely rejects valid structures.
        if max_d / min_d > 25.0:
            return False

        # Price comparison
        lengths = [w.length for w in waves]
        max_l = max(lengths)
        min_l = max(min(lengths), _EPSILON)
        if max_l / min_l > 20.0:
            return False

        return True

    # ------------------------------------------------------------------
    # Position assessment
    # ------------------------------------------------------------------

    def _assess_position(
        self, count: _WaveCount, merged: pd.DataFrame,
    ) -> tuple[str, str, int, bool]:  # (label, direction, current_wave_index_0based, pattern_complete)
        waves = count.waves
        last_bar = len(merged) - 1
        cwi = len(waves) - 1
        for i, w in enumerate(waves):
            if w.end_index >= last_bar:
                cwi = i
                break

        # Detect whether the entire pattern ended before the current bar
        pattern_complete = all(w.end_index < last_bar for w in waves)

        if count.pattern_type == "impulse" and len(waves) == 5:
            up = waves[0].direction == "up"
            if pattern_complete:
                # All 5 waves finished historically — label as completed, expect reversal
                label = f"Completed impulse {'up' if up else 'down'} \u2014 expect correction"
                direction = "down" if up else "up"
                return (label, direction, len(waves) - 1, True)
            wn = cwi + 1
            direction = ("bullish" if up else "bearish") if wn % 2 == 1 else ("bearish" if up else "bullish")
            label = f"Wave {wn} of impulse {'up' if up else 'down'}"
            return (label, direction, cwi, False)

        if count.pattern_type == "corrective" and len(waves) == 3:
            lm = {0: "A", 1: "B", 2: "C"}
            sub = f" ({count.corrective_sub})" if count.corrective_sub else ""
            direction = "bearish" if waves[0].direction == "down" else "bullish"
            if pattern_complete:
                label = f"Completed corrective{sub} \u2014 expect reversal"
                return (label, direction, len(waves) - 1, True)
            label = f"Wave {lm.get(cwi, 'C')} of corrective{sub}"
            return (label, direction, cwi, False)

        return ("Indeterminate", "neutral", cwi, False)

    # ------------------------------------------------------------------
    # Fibonacci and targets
    # ------------------------------------------------------------------

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
            price = (w1.end_price - ratio * w1r) if w1.direction == "up" else (w1.end_price + ratio * w1r)
            d = abs(current_price - price) / max(current_price, _EPSILON)
            levels.append(_FibLevel(ratio, price, f"{ratio*100:.1f}% retracement", d <= _FIB_CONFLUENCE_TOLERANCE))
        base = waves[1].end_price if len(waves) >= 2 else w1.start_price
        for ratio in _FIB_EXTENSIONS:
            price = (base + ratio * w1r) if w1.direction == "up" else (base - ratio * w1r)
            d = abs(current_price - price) / max(current_price, _EPSILON)
            levels.append(_FibLevel(ratio, price, f"{ratio*100:.1f}% extension", d <= _FIB_CONFLUENCE_TOLERANCE))
        return levels

    def _calculate_target(
        self, fib_levels: list[_FibLevel], current_price: float, direction: str,
    ) -> float | None:
        for fl in sorted(fib_levels, key=lambda f: abs(f.price - current_price)):
            if fl.ratio not in _FIB_EXTENSIONS:
                continue
            if direction == "bullish" and fl.price > current_price * 0.99:
                if fl.price <= current_price * (1 + _MAX_TARGET_DEVIATION):
                    return fl.price
            elif direction == "bearish" and fl.price < current_price * 1.01:
                if fl.price >= current_price * (1 - _MAX_TARGET_DEVIATION):
                    return fl.price
        return None

    # ------------------------------------------------------------------
    # Confidence
    # ------------------------------------------------------------------

    def _calculate_confidence_for_count(
        self,
        primary: _WaveCount,
        alternative: _WaveCount | None,
        fib_levels: list[_FibLevel],
        merged: pd.DataFrame,
    ) -> float:
        conf = _CONF_BASE
        conf += min(primary.guideline_score * 0.04, 0.25)
        if any(fl.is_aligned for fl in fib_levels):
            conf += 0.06
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
            if odd_v and even_v and sum(odd_v) / len(odd_v) > sum(even_v) / len(even_v):
                conf += 0.07
        if alternative is None:
            conf += 0.08
        else:
            diff = primary.total_score - alternative.total_score
            if diff > 1.5:
                conf += 0.06
            elif diff < 0.5:
                conf -= 0.10
        if math.isnan(conf) or math.isinf(conf):
            conf = _CONF_BASE
        return max(_CONF_FLOOR, min(_CONF_CAP, conf))

    def _aggregate_confidence(
        self,
        degree_results: list[_DegreeResult],
        primary_result: _DegreeResult,
    ) -> float:
        """Blend primary degree confidence with direction agreement across degrees."""
        base = primary_result.confidence
        valid = [r for r in degree_results if r.count is not None]
        if len(valid) <= 1:
            return base
        primary_dir = primary_result.direction
        agreeing = sum(1 for r in valid if r.direction == primary_dir and r != primary_result)
        total_others = len(valid) - 1
        if total_others > 0:
            agreement_ratio = agreeing / total_others
            base += agreement_ratio * 0.08  # up to +0.08 for full cross-degree agreement
        return max(_CONF_FLOOR, min(_CONF_CAP, base))

    # ------------------------------------------------------------------
    # Invalidation
    # ------------------------------------------------------------------

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
        return waves[0].start_price

    # ------------------------------------------------------------------
    # Output helpers
    # ------------------------------------------------------------------

    def _choose_primary_degree(
        self, results: list[_DegreeResult], chart_timeframe: str = "1d",
    ) -> _DegreeResult:
        """Pick the most actionable degree with a valid count.

        Rules:
        1. Prioritize 'live' results (ending within _live_thresholds[degree] bars of now).
        2. If any live result is in the timeframe-preferred list for chart_timeframe,
           restrict candidates to those preferred degrees (timeframe bias).
        3. Among (filtered) live results, pick the one with the HIGHEST CONFIDENCE,
           breaking ties by preferred-degree order.
        4. If no live results, fallback to stale results, again by confidence.
        """
        valid = [r for r in results if r.count is not None]
        if not valid:
            return results[-1]

        live = [r for r in valid if r.is_live]

        if live:
            # Apply timeframe bias: if any live result is in the preferred list,
            # restrict to preferred degrees only before sorting.
            preferred = _TIMEFRAME_PREFERRED_DEGREES.get(chart_timeframe, [])
            preferred_live = [r for r in live if r.degree in preferred]
            candidates = preferred_live if preferred_live else live

            # Sort by confidence descending, then by preferred-degree order (or fallback priority)
            fallback_priority = ["intermediate", "primary", "minor", "cycle", "supercycle"]
            order = preferred if preferred else fallback_priority

            def sort_key(r: _DegreeResult) -> tuple[float, int]:
                try:
                    p_idx = -order.index(r.degree)
                except ValueError:
                    p_idx = -10
                return (r.confidence, p_idx)

            candidates.sort(key=sort_key, reverse=True)
            return candidates[0]

        # Stale fallback: pick highest confidence among primary/intermediate/minor
        fallbacks = [r for r in valid if r.degree in ("intermediate", "primary", "minor")]
        if fallbacks:
            return max(fallbacks, key=lambda r: r.confidence)

        return max(valid, key=lambda r: r.confidence)

    def _timeframe_for_degree(self, degree: str, current_wave: int) -> str:
        if degree in ("supercycle", "cycle"):
            return "long"
        if degree == "primary":
            return "medium"
        return "short"

    def _build_wave_points(
        self, count: _WaveCount, merged: pd.DataFrame,
    ) -> list[dict[str, Any]]:
        waves = count.waves
        if not waves or merged.empty:
            return []
        if count.pattern_type == "impulse":
            labels = ["0", "1", "2", "3", "4", "5"]
        else:
            labels = ["0", "A", "B", "C"]

        def _safe_time(idx: int) -> str:
            clamped = max(0, min(idx, len(merged) - 1))
            try:
                return str(merged.iloc[clamped]["date"])
            except Exception:
                return ""

        pts = [{"label": labels[0], "price": round(waves[0].start_price, 4), "time": _safe_time(waves[0].start_index)}]
        for i, w in enumerate(waves):
            lbl = labels[i + 1] if (i + 1) < len(labels) else str(i + 1)
            pts.append({"label": lbl, "price": round(w.end_price, 4), "time": _safe_time(w.end_index)})
        return pts

    def _build_key_levels(
        self,
        degree_results: list[_DegreeResult],
        primary: _DegreeResult,
        current_price: float,
        merged: pd.DataFrame,
    ) -> dict[str, Any]:
        # Build degree summary tree
        wave_counts_by_degree: dict[str, Any] = {}
        for r in degree_results:
            if r.count is not None:
                wave_counts_by_degree[r.degree] = {
                    "label": r.wave_label,
                    "degree_abbr": _DEGREE_LABEL.get(r.degree, r.degree),
                    "current_wave": r.current_wave,
                    "pattern_type": r.count.pattern_type,
                    "corrective_subtype": r.count.corrective_sub,
                    "direction": r.direction,
                    "invalidation": round(r.invalidation, 4),
                    "target": round(r.target, 4) if r.target is not None else None,
                    "confidence": round(r.confidence, 3),
                    "pattern_complete": r.pattern_complete,
                }

        fib_map: dict[float, float] = {fl.ratio: fl.price for fl in primary.fib_levels}
        fib_targets: dict[str, float] = {}
        for key, ratio in zip(_FIB_OUTPUT_KEYS, _FIB_OUTPUT_RATIOS):
            if ratio in fib_map:
                fib_targets[key] = round(fib_map[ratio], 4)

        fib_levels_detailed = [
            {
                "ratio": fl.ratio,
                "price": round(fl.price, 4),
                "label": fl.label,
                "aligned": fl.is_aligned,
                "type": "extension" if fl.ratio >= 1.0 else "retracement",
            }
            for fl in primary.fib_levels
        ]

        # Collect sub-degree wave points for multi-degree rendering.
        # Include any live, non-primary degree that has wave_points, tagging
        # each point with its degree so the frontend can render separate line series.
        nested_wave_points: list[dict[str, Any]] = []
        for r in degree_results:
            if r.degree == primary.degree:
                continue
            if not r.is_live or not r.wave_points:
                continue
            degree_abbr = _DEGREE_LABEL.get(r.degree, r.degree)
            for pt in r.wave_points:
                nested_wave_points.append({**pt, "degree": r.degree, "degreeAbbr": degree_abbr})

        return {
            "wave_counts_by_degree": wave_counts_by_degree,
            "primary_degree": primary.degree,
            "wave_label": primary.wave_label,
            "pattern_type": primary.count.pattern_type if primary.count else "",
            "corrective_subtype": primary.count.corrective_sub if primary.count else "",
            "invalidation": round(primary.invalidation, 4),
            "primary_target": round(primary.target, 4) if primary.target is not None else None,
            "fib_targets": fib_targets,
            "fib_levels": fib_levels_detailed,
            "wave_points": primary.wave_points,
            "nested_wave_points": nested_wave_points,
            "alternative_pattern": None,
        }

    def _build_reasoning(
        self,
        ticker: str,
        degree_results: list[_DegreeResult],
        primary: _DegreeResult,
        confidence: float,
    ) -> str:
        safe_ticker = "".join(
            ch for ch in str(ticker) if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = []

        # Multi-degree summary — from broadest to tightest
        valid = [r for r in degree_results if r.count is not None]
        for r in valid:
            abbr = _DEGREE_LABEL.get(r.degree, r.degree)
            sub = f" ({r.count.corrective_sub})" if r.count and r.count.corrective_sub else ""
            parts.append(f"[{abbr}] {r.wave_label}{sub}.")

        if not parts:
            parts.append(f"{safe_ticker}: No valid wave structures found.")
        else:
            parts.insert(0, f"{safe_ticker} multi-degree structure:")

        # Primary degree detail
        if primary.count:
            parts.append(
                f"Primary analysis at {primary.degree} degree: "
                f"{primary.wave_label}. "
                f"Invalidation: {primary.invalidation:.2f}."
            )
            if primary.target is not None:
                parts.append(f"Target: {primary.target:.2f}.")

            # Neely alternation if impulse
            if primary.count.pattern_type == "impulse" and len(primary.count.waves) == 5:
                w1, w2, w3, w4, _ = primary.count.waves
                w3r = w3.length / max(w1.length, _EPSILON)
                if w3r >= _W3_EXTENSION_THRESHOLD:
                    parts.append(f"Wave 3 extended ({w3r:.2f}x Wave 1).")
                if self._check_alternation(w1, w2, w3, w4):
                    parts.append("Neely alternation confirmed (W2/W4).")

        # Confidence
        if confidence >= _CONFIDENCE_HIGH:
            qual = "high"
        elif confidence >= _CONFIDENCE_MODERATE:
            qual = "moderate"
        else:
            qual = "low"
        parts.append(f"Confidence: {qual} ({confidence:.2f}).")

        return " ".join(parts)
