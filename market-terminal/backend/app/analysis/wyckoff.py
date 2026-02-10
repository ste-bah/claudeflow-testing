"""Wyckoff Method analysis module.

Implements Richard Wyckoff's price-volume analysis methodology including:
- Trading range detection (support/resistance via rolling extremes)
- Phase identification (accumulation, markup, distribution, markdown, ranging)
- Spring and upthrust detection (price traps beyond range boundaries)
- Volume-price spread analysis (VPA: absorption, strong moves)
- Effort vs result analysis (volume-price correlation and divergence)

The analyzer produces a :class:`~app.analysis.base.MethodologySignal` with
direction, confidence, key levels, and human-readable reasoning.

Full implementation: TASK-ANALYSIS-002
"""

from __future__ import annotations

import math
from typing import Any, NamedTuple

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, MethodologySignal

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

# Lookback windows (bar counts)
_DEFAULT_RANGE_LOOKBACK: int = 60
_SPRING_UPTHRUST_LOOKBACK: int = 10
_VPA_LOOKBACK: int = 20
_EFFORT_RESULT_LOOKBACK: int = 10

# Spread thresholds (multiples of average spread)
_WIDE_SPREAD_THRESHOLD: float = 1.2
_NARROW_SPREAD_THRESHOLD: float = 0.8

# Volume thresholds (multiples of average volume)
_HIGH_VOLUME_THRESHOLD: float = 1.3
_VOLUME_BIAS_THRESHOLD: float = 1.2

# Confidence adjustments
_CONFIDENCE_SPRING_UPTHRUST: float = 0.15
_CONFIDENCE_VOLUME_CONFIRMS: float = 0.10
_CONFIDENCE_EFFORT_CONFIRMS: float = 0.05
_CONFIDENCE_CLEAR_PHASE: float = 0.7
_CONFIDENCE_AMBIGUOUS_PHASE: float = 0.4

# Phase detection helpers
_LONG_RANGE_THRESHOLD: int = 40
_VOLUME_RATIO_EXTREME_HIGH: float = 1.5
_VOLUME_RATIO_EXTREME_LOW: float = 0.67
_VOLUME_RATIO_NEUTRAL_LOW: float = 0.9
_VOLUME_RATIO_NEUTRAL_HIGH: float = 1.1
_CLARITY_ADJUSTMENT: float = 0.1
_INF_VOLUME_RATIO_CAP: float = 10.0

# Correlation thresholds (effort vs result)
_CORRELATION_DIVERGENCE: float = -0.3
_CORRELATION_CONFIRMS: float = 0.3

# VPA score threshold for confidence bonus
_VPA_SCORE_THRESHOLD: float = 0.3

# Spring/upthrust confirmation window (bars to look ahead)
_SPRING_CONFIRM_BARS: int = 3

# Confidence qualifier thresholds for reasoning text
_CONFIDENCE_HIGH_QUALIFIER: float = 0.7
_CONFIDENCE_MODERATE_QUALIFIER: float = 0.5

# Ticker sanitization
_MAX_TICKER_LENGTH: int = 20

# Numerical guard
_EPSILON: float = 1e-10


# ---------------------------------------------------------------------------
# Internal NamedTuples
# ---------------------------------------------------------------------------


class _RangeInfo(NamedTuple):
    """Trading range boundaries and contextual metrics."""

    resistance: float
    support: float
    range_height: float
    lookback_bars: int
    avg_volume: float
    avg_up_volume: float
    avg_down_volume: float
    sma_50: float
    sma_200: float


class _PhaseInfo(NamedTuple):
    """Identified Wyckoff phase with supporting context."""

    phase: str  # "accumulation" | "markup" | "distribution" | "markdown" | "ranging"
    clarity: float  # 0.0 - 1.0
    volume_ratio: float
    trend_context: str  # "downtrend" | "uptrend" | "sideways"


class _SpringUpthrustInfo(NamedTuple):
    """Spring (bear trap) and upthrust (bull trap) detection results."""

    spring_detected: bool
    spring_level: float | None
    spring_bars_ago: int | None
    upthrust_detected: bool
    upthrust_level: float | None
    upthrust_bars_ago: int | None


class _VPAInfo(NamedTuple):
    """Volume-price spread analysis scores."""

    bullish_score: float  # 0.0 - 1.0
    bearish_score: float  # 0.0 - 1.0
    absorption_count: int
    strong_move_count: int


class _EffortResultInfo(NamedTuple):
    """Effort (volume) vs result (price movement) analysis."""

    correlation: float  # -1.0 to 1.0
    divergence_detected: bool
    confirms_trend: bool


# ---------------------------------------------------------------------------
# WyckoffAnalyzer
# ---------------------------------------------------------------------------


class WyckoffAnalyzer(BaseMethodology):
    """Wyckoff Method price-volume analysis.

    Detects accumulation/distribution phases, springs/upthrusts, and
    volume-price relationships to generate directional signals with
    confidence scores.
    """

    name: str = "wyckoff"
    display_name: str = "Wyckoff Method"
    default_timeframe: str = "medium"
    version: str = "1.0.0"

    # ------------------------------------------------------------------
    # Public API (BaseMethodology contract)
    # ------------------------------------------------------------------

    async def analyze(
        self,
        ticker: str,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
        fundamentals: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MethodologySignal:
        """Run Wyckoff analysis on the supplied price and volume data.

        Args:
            ticker: Stock/ETF symbol (e.g. ``"AAPL"``).
            price_data: DataFrame with columns ``[date, open, high, low, close]``.
            volume_data: DataFrame with columns ``[date, volume]``.
            fundamentals: Not used by Wyckoff (ignored).
            **kwargs: Reserved for future extension.

        Returns:
            A :class:`MethodologySignal` populated with Wyckoff-specific
            direction, confidence, key levels, and reasoning.

        Raises:
            ValueError: If input data fails validation.
        """
        self.validate_input(price_data, volume_data)

        merged = self._merge_data(price_data, volume_data)
        range_info = self._detect_trading_range(merged)
        phase_info = self._detect_phase(merged, range_info)
        spring_info = self._detect_spring_upthrust(merged, range_info)
        vpa_info = self._analyze_volume_price_spread(merged)
        effort_info = self._analyze_effort_vs_result(merged)

        confidence = self._calculate_confidence(
            phase_info, spring_info, vpa_info, effort_info,
        )
        direction = self._determine_direction(phase_info, spring_info)

        timeframe_str = kwargs.get("timeframe") or self.default_timeframe
        if range_info.lookback_bars >= _LONG_RANGE_THRESHOLD:
            timeframe_str = "long"

        key_levels = self._build_key_levels(range_info, spring_info, direction)
        reasoning = self._build_reasoning(
            ticker, phase_info, range_info, spring_info,
            vpa_info, effort_info, confidence,
        )

        return self.create_signal(
            ticker=ticker,
            direction=direction,
            confidence=confidence,
            timeframe=timeframe_str,
            reasoning=reasoning,
            key_levels=key_levels,
        )

    # ------------------------------------------------------------------
    # Data preparation
    # ------------------------------------------------------------------

    def _merge_data(
        self,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Merge price and volume DataFrames on the ``date`` column.

        Returns a single DataFrame with columns
        ``[date, open, high, low, close, volume]`` sorted by date ascending.
        """
        merged = pd.merge(price_data, volume_data, on="date", how="inner")
        merged["volume"] = merged["volume"].fillna(0.0)
        merged = merged.sort_values("date", ascending=True).reset_index(drop=True)
        return merged[["date", "open", "high", "low", "close", "volume"]]

    # ------------------------------------------------------------------
    # Trading range detection
    # ------------------------------------------------------------------

    def _detect_trading_range(self, df: pd.DataFrame) -> _RangeInfo:
        """Identify support/resistance boundaries and compute range metrics.

        Uses the last ``_DEFAULT_RANGE_LOOKBACK`` bars to find rolling
        highs/lows, average volumes (up vs down days), and SMA values.
        """
        lookback = min(_DEFAULT_RANGE_LOOKBACK, len(df))
        window = df.tail(lookback)

        resistance = float(np.percentile(window["high"].values, 95))
        support = float(np.percentile(window["low"].values, 5))
        range_height = max(resistance - support, _EPSILON)

        # Classify up/down days based on close vs previous close
        close_shifted = window["close"].shift(1)
        up_mask = window["close"] > close_shifted
        down_mask = window["close"] < close_shifted

        up_volumes = window.loc[up_mask, "volume"]
        down_volumes = window.loc[down_mask, "volume"]

        avg_up_volume = float(up_volumes.mean()) if len(up_volumes) > 0 else 0.0
        avg_down_volume = float(down_volumes.mean()) if len(down_volumes) > 0 else 0.0
        avg_volume = float(window["volume"].mean())

        sma_50 = float(df["close"].tail(min(50, len(df))).mean())
        sma_200 = float(df["close"].tail(min(200, len(df))).mean())

        return _RangeInfo(
            resistance=resistance,
            support=support,
            range_height=range_height,
            lookback_bars=lookback,
            avg_volume=avg_volume,
            avg_up_volume=avg_up_volume,
            avg_down_volume=avg_down_volume,
            sma_50=sma_50,
            sma_200=sma_200,
        )

    # ------------------------------------------------------------------
    # Phase identification
    # ------------------------------------------------------------------

    def _detect_phase(
        self,
        df: pd.DataFrame,
        range_info: _RangeInfo,
    ) -> _PhaseInfo:
        """Classify the current Wyckoff phase.

        Considers price position relative to the range, volume bias
        (up-volume vs down-volume), SMA alignment, and whether the
        instrument has been in the range for an extended period.
        """
        # Trend context from SMAs
        if range_info.sma_50 > range_info.sma_200:
            trend_context = "uptrend"
        elif range_info.sma_50 < range_info.sma_200:
            trend_context = "downtrend"
        else:
            trend_context = "sideways"

        volume_ratio = range_info.avg_up_volume / max(range_info.avg_down_volume, _EPSILON)
        if math.isinf(volume_ratio):
            volume_ratio = _INF_VOLUME_RATIO_CAP

        current_close = float(df["close"].iloc[-1])

        # Determine phase based on price position and volume
        if current_close > range_info.resistance and volume_ratio > 1.0:
            phase = "markup"
            clarity = _CONFIDENCE_CLEAR_PHASE
        elif current_close < range_info.support and volume_ratio < 1.0:
            phase = "markdown"
            clarity = _CONFIDENCE_CLEAR_PHASE
        elif (range_info.support <= current_close <= range_info.resistance
              and trend_context == "downtrend"
              and volume_ratio > _VOLUME_BIAS_THRESHOLD):
            phase = "accumulation"
            clarity = _CONFIDENCE_CLEAR_PHASE
        elif (range_info.support <= current_close <= range_info.resistance
              and trend_context == "uptrend"
              and volume_ratio < 1.0 / _VOLUME_BIAS_THRESHOLD):
            phase = "distribution"
            clarity = _CONFIDENCE_CLEAR_PHASE
        else:
            phase = "ranging"
            clarity = _CONFIDENCE_AMBIGUOUS_PHASE

        # Adjust clarity based on volume ratio extremity
        if volume_ratio > _VOLUME_RATIO_EXTREME_HIGH or volume_ratio < _VOLUME_RATIO_EXTREME_LOW:
            clarity += _CLARITY_ADJUSTMENT
        elif _VOLUME_RATIO_NEUTRAL_LOW <= volume_ratio <= _VOLUME_RATIO_NEUTRAL_HIGH:
            clarity -= _CLARITY_ADJUSTMENT

        clarity = max(0.0, min(1.0, clarity))

        return _PhaseInfo(
            phase=phase,
            clarity=clarity,
            volume_ratio=volume_ratio,
            trend_context=trend_context,
        )

    # ------------------------------------------------------------------
    # Spring / upthrust detection
    # ------------------------------------------------------------------

    def _detect_spring_upthrust(
        self,
        df: pd.DataFrame,
        range_info: _RangeInfo,
    ) -> _SpringUpthrustInfo:
        """Scan recent bars for springs (bear traps below support) and
        upthrusts (bull traps above resistance).

        A spring is a wick below support that closes back inside the range.
        An upthrust is a wick above resistance that closes back inside.
        """
        scan_len = min(_SPRING_UPTHRUST_LOOKBACK, len(df) - 1)
        last_idx = len(df) - 1

        spring_detected = False
        spring_level: float | None = None
        spring_bars_ago: int | None = None
        upthrust_detected = False
        upthrust_level: float | None = None
        upthrust_bars_ago: int | None = None

        support = range_info.support
        resistance = range_info.resistance
        avg_volume = range_info.avg_volume

        # Scan from most recent backward so we keep the most recent detection
        for offset in range(scan_len):
            i = last_idx - offset
            row = df.iloc[i]

            # Spring: low dips below support
            if not spring_detected and float(row["low"]) < support:
                # Check if within next 1-3 bars close recovers above support
                confirm_end = min(i + _SPRING_CONFIRM_BARS + 1, len(df))
                for j in range(i + 1, confirm_end):
                    if (float(df.iloc[j]["close"]) > support
                            and float(row["volume"]) < avg_volume):
                        spring_detected = True
                        spring_level = float(row["low"])
                        spring_bars_ago = last_idx - i
                        break
                # Also check the bar itself closes back above support
                if (not spring_detected
                        and float(row["close"]) > support
                        and float(row["volume"]) < avg_volume):
                    spring_detected = True
                    spring_level = float(row["low"])
                    spring_bars_ago = last_idx - i

            # Upthrust: high pokes above resistance
            if not upthrust_detected and float(row["high"]) > resistance:
                confirm_end = min(i + _SPRING_CONFIRM_BARS + 1, len(df))
                for j in range(i + 1, confirm_end):
                    if (float(df.iloc[j]["close"]) < resistance
                            and float(row["volume"]) < avg_volume):
                        upthrust_detected = True
                        upthrust_level = float(row["high"])
                        upthrust_bars_ago = last_idx - i
                        break
                if (not upthrust_detected
                        and float(row["close"]) < resistance
                        and float(row["volume"]) < avg_volume):
                    upthrust_detected = True
                    upthrust_level = float(row["high"])
                    upthrust_bars_ago = last_idx - i

            if spring_detected and upthrust_detected:
                break

        return _SpringUpthrustInfo(
            spring_detected=spring_detected,
            spring_level=spring_level,
            spring_bars_ago=spring_bars_ago,
            upthrust_detected=upthrust_detected,
            upthrust_level=upthrust_level,
            upthrust_bars_ago=upthrust_bars_ago,
        )

    # ------------------------------------------------------------------
    # Volume-price spread analysis (VPA)
    # ------------------------------------------------------------------

    def _analyze_volume_price_spread(self, df: pd.DataFrame) -> _VPAInfo:
        """Evaluate volume-price spread relationships over the VPA lookback.

        Identifies:
        - Absorption bars (high volume, narrow spread -- supply/demand absorbed)
        - Strong move bars (wide spread, high volume -- genuine breakouts)

        Produces bullish and bearish VPA scores between 0.0 and 1.0.
        """
        lookback = min(_VPA_LOOKBACK, len(df))
        window = df.tail(lookback).copy()

        # Compute ATR over the window
        prev_close = window["close"].shift(1)
        tr1 = window["high"] - window["low"]
        tr2 = (window["high"] - prev_close).abs()
        tr3 = (window["low"] - prev_close).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        avg_atr = max(float(true_range.mean()), _EPSILON)
        avg_vol = max(float(window["volume"].mean()), _EPSILON)

        # Classify each bar
        spreads = window["high"] - window["low"]
        spread_ratios = spreads / avg_atr
        vol_ratios = window["volume"] / avg_vol
        is_up = window["close"] > window["open"]
        is_down = window["close"] < window["open"]

        wide = spread_ratios > _WIDE_SPREAD_THRESHOLD
        narrow = spread_ratios < _NARROW_SPREAD_THRESHOLD
        high_vol = vol_ratios > _HIGH_VOLUME_THRESHOLD

        strong_move = wide & high_vol
        absorption = narrow & high_vol

        # Count by direction
        up_strong = int((strong_move & is_up).sum())
        down_strong = int((strong_move & is_down).sum())
        up_absorption = int((absorption & is_up).sum())
        down_absorption = int((absorption & is_down).sum())

        total_strong = int(strong_move.sum())
        total_absorption = int(absorption.sum())

        bullish_score = (up_strong + down_absorption) / max(lookback, 1)
        bearish_score = (down_strong + up_absorption) / max(lookback, 1)

        bullish_score = max(0.0, min(1.0, bullish_score))
        bearish_score = max(0.0, min(1.0, bearish_score))

        return _VPAInfo(
            bullish_score=bullish_score,
            bearish_score=bearish_score,
            absorption_count=total_absorption,
            strong_move_count=total_strong,
        )

    # ------------------------------------------------------------------
    # Effort vs result analysis
    # ------------------------------------------------------------------

    def _analyze_effort_vs_result(self, df: pd.DataFrame) -> _EffortResultInfo:
        """Compare volume (effort) against price movement (result).

        High volume with small price change = effort without result (divergence).
        High volume with large price change = effort with result (confirmation).
        """
        lookback = min(_EFFORT_RESULT_LOOKBACK, len(df))
        window = df.tail(lookback)

        volumes = window["volume"].values
        price_changes = window["close"].diff().abs().values

        # Skip the first element (NaN from diff) and align arrays
        volumes = volumes[1:]
        price_changes = price_changes[1:]

        if len(volumes) < 2:
            return _EffortResultInfo(
                correlation=0.0,
                divergence_detected=False,
                confirms_trend=False,
            )

        # If all values are the same, correlation is undefined
        if np.all(volumes == volumes[0]) or np.all(price_changes == price_changes[0]):
            correlation = 0.0
        else:
            corr_matrix = np.corrcoef(volumes, price_changes)
            correlation = float(corr_matrix[0, 1])

        # Guard NaN/Inf
        if math.isnan(correlation) or math.isinf(correlation):
            correlation = 0.0

        divergence_detected = correlation < _CORRELATION_DIVERGENCE
        confirms_trend = correlation > _CORRELATION_CONFIRMS

        return _EffortResultInfo(
            correlation=correlation,
            divergence_detected=divergence_detected,
            confirms_trend=confirms_trend,
        )

    # ------------------------------------------------------------------
    # Signal assembly
    # ------------------------------------------------------------------

    def _calculate_confidence(
        self,
        phase_info: _PhaseInfo,
        spring_info: _SpringUpthrustInfo,
        vpa_info: _VPAInfo,
        effort_info: _EffortResultInfo,
    ) -> float:
        """Compute final confidence score in ``[0.0, 1.0]``.

        Starts from phase clarity, then applies additive bonuses for
        spring/upthrust presence, confirming volume patterns, and
        effort-result alignment.
        """
        confidence = phase_info.clarity

        # Spring or upthrust detection bonus
        if spring_info.spring_detected or spring_info.upthrust_detected:
            confidence += _CONFIDENCE_SPRING_UPTHRUST

        # Volume confirms phase direction
        if (
            phase_info.phase in ("accumulation", "markup")
            and vpa_info.bullish_score > _VPA_SCORE_THRESHOLD
        ) or (
            phase_info.phase in ("distribution", "markdown")
            and vpa_info.bearish_score > _VPA_SCORE_THRESHOLD
        ):
            confidence += _CONFIDENCE_VOLUME_CONFIRMS

        # Effort-result alignment bonus
        if effort_info.confirms_trend:
            confidence += _CONFIDENCE_EFFORT_CONFIRMS

        return min(max(confidence, 0.0), 1.0)

    def _determine_direction(
        self,
        phase_info: _PhaseInfo,
        spring_info: _SpringUpthrustInfo,
    ) -> str:
        """Map Wyckoff phase and spring/upthrust signals to a direction string.

        Returns one of ``"bullish"``, ``"bearish"``, or ``"neutral"``.
        """
        if phase_info.phase in ("accumulation", "markup"):
            return "bullish"
        if phase_info.phase in ("distribution", "markdown"):
            return "bearish"

        # Ranging -- use spring/upthrust as tie-breaker
        if spring_info.spring_detected and not spring_info.upthrust_detected:
            return "bullish"
        if spring_info.upthrust_detected and not spring_info.spring_detected:
            return "bearish"

        return "neutral"

    def _build_key_levels(
        self,
        range_info: _RangeInfo,
        spring_info: _SpringUpthrustInfo,
        direction: str,
    ) -> dict[str, Any]:
        """Construct the ``key_levels`` dict for the output signal.

        Includes support, resistance, range height, spring/upthrust levels
        (when detected), and SMA values.
        """
        levels: dict[str, Any] = {
            "trading_range_high": range_info.resistance,
            "trading_range_low": range_info.support,
            "spring_level": spring_info.spring_level,
            "upthrust_level": spring_info.upthrust_level,
            "target_markup": (
                range_info.resistance + range_info.range_height
                if direction == "bullish"
                else None
            ),
            "target_markdown": (
                range_info.support - range_info.range_height
                if direction == "bearish"
                else None
            ),
            "sma_50": range_info.sma_50,
            "sma_200": range_info.sma_200,
        }
        return levels

    def _build_reasoning(
        self,
        ticker: str,
        phase_info: _PhaseInfo,
        range_info: _RangeInfo,
        spring_info: _SpringUpthrustInfo,
        vpa_info: _VPAInfo,
        effort_info: _EffortResultInfo,
        confidence: float,
    ) -> str:
        """Generate a human-readable reasoning summary.

        Describes the detected phase, range boundaries, spring/upthrust
        events, volume-price relationships, and effort-result analysis.
        """
        # Sanitize ticker for output (XSS prevention -- never echo raw input)
        safe_ticker = "".join(
            ch for ch in str(ticker) if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = []

        # Phase and range
        parts.append(
            f"{safe_ticker} is in a {phase_info.phase} phase "
            f"with a trading range of {range_info.support:.2f} "
            f"to {range_info.resistance:.2f}."
        )

        # Volume comparison
        total_avg = range_info.avg_up_volume + range_info.avg_down_volume
        if total_avg > _EPSILON:
            if range_info.avg_up_volume >= range_info.avg_down_volume:
                pct = (
                    (range_info.avg_up_volume - range_info.avg_down_volume)
                    / max(range_info.avg_down_volume, _EPSILON)
                    * 100.0
                )
                parts.append(
                    f"Up-day volume exceeds down-day volume by {pct:.0f}%."
                )
            else:
                pct = (
                    (range_info.avg_down_volume - range_info.avg_up_volume)
                    / max(range_info.avg_up_volume, _EPSILON)
                    * 100.0
                )
                parts.append(
                    f"Down-day volume exceeds up-day volume by {pct:.0f}%."
                )

        # Spring / upthrust details
        if spring_info.spring_detected and spring_info.spring_level is not None:
            bars_ago = spring_info.spring_bars_ago or 0
            parts.append(
                f"Spring detected at {spring_info.spring_level:.2f} "
                f"({bars_ago} bars ago)."
            )
        if spring_info.upthrust_detected and spring_info.upthrust_level is not None:
            bars_ago = spring_info.upthrust_bars_ago or 0
            parts.append(
                f"Upthrust detected at {spring_info.upthrust_level:.2f} "
                f"({bars_ago} bars ago)."
            )

        # VPA summary
        if vpa_info.absorption_count > 0:
            parts.append(
                f"VPA shows {vpa_info.absorption_count} absorption "
                f"bar{'s' if vpa_info.absorption_count != 1 else ''}."
            )
        if vpa_info.strong_move_count > 0:
            parts.append(
                f"VPA shows {vpa_info.strong_move_count} strong move "
                f"bar{'s' if vpa_info.strong_move_count != 1 else ''}."
            )

        # Effort vs result
        if effort_info.confirms_trend:
            parts.append("Effort confirms trend.")
        elif effort_info.divergence_detected:
            parts.append("Effort-result divergence detected.")

        # Confidence qualifier
        if confidence >= _CONFIDENCE_HIGH_QUALIFIER:
            qualifier = "high"
        elif confidence >= _CONFIDENCE_MODERATE_QUALIFIER:
            qualifier = "moderate"
        else:
            qualifier = "low"
        parts.append(f"Confidence: {qualifier} ({confidence:.2f}).")

        return " ".join(parts)
