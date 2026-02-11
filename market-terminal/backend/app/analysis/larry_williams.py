"""Larry Williams Indicators analysis module.

Implements Larry Williams' trading methodology including:
- Williams %R oscillator (14 and 28 period) with zone/crossover/divergence
- Commitment of Traders (COT) commercial index with extreme readings
- Seasonal pattern analysis based on monthly average returns
- Williams Accumulation/Distribution line with divergence detection

Full implementation: TASK-ANALYSIS-006
"""

from __future__ import annotations

import math
from typing import Any, NamedTuple

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, Direction, Timeframe, MethodologySignal

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

_EPSILON: float = 1e-10
_MAX_TICKER_LENGTH: int = 20

# Williams %R
_WR_PERIOD_SHORT: int = 14
_WR_PERIOD_LONG: int = 28
_WR_OVERBOUGHT: float = -20.0
_WR_OVERSOLD: float = -80.0
_WR_CROSSOVER_LOOKBACK: int = 5
_WR_DIVERGENCE_LOOKBACK: int = 20

# COT analysis
_COT_INDEX_PERIOD: int = 26
_COT_EXTREME_BULLISH: float = 80.0
_COT_EXTREME_BEARISH: float = 20.0

# Seasonal
_SEASONAL_MIN_YEARS: int = 2
_SEASONAL_BULLISH_THRESHOLD: float = 0.01
_SEASONAL_BEARISH_THRESHOLD: float = -0.01

# Accumulation/Distribution
_AD_SLOPE_LOOKBACK: int = 20

# Weights (when COT available)
_WEIGHT_WR: float = 0.30
_WEIGHT_COT: float = 0.25
_WEIGHT_SEASONAL: float = 0.15
_WEIGHT_AD: float = 0.30

# Weights (when COT NOT available)
_WEIGHT_WR_NO_COT: float = 0.425
_WEIGHT_AD_NO_COT: float = 0.425
_WEIGHT_SEASONAL_NO_COT: float = 0.15

# Direction thresholds
_BULLISH_THRESHOLD: float = 0.3
_BEARISH_THRESHOLD: float = -0.3

# Confidence components
_CONF_BASE: float = 0.30
_CONF_AGREEMENT: float = 0.25
_CONF_WR_DIVERGENCE: float = 0.15
_CONF_COT_EXTREME: float = 0.15
_CONF_SEASONAL_ALIGNS: float = 0.10
_CONF_AD_DIVERGENCE: float = 0.10

# ---------------------------------------------------------------------------
# Internal NamedTuples
# ---------------------------------------------------------------------------


class _WilliamsRResult(NamedTuple):
    wr_14: float
    wr_28: float
    zone: str       # "overbought" | "oversold" | "neutral"
    signal: str     # "bullish_crossover" | "bearish_crossover" | "divergence_bullish" | "divergence_bearish" | "none"
    score: float    # -1 to +1


class _COTResult(NamedTuple):
    available: bool
    commercial_index: float | None
    commercial_net: int | None
    speculator_net: int | None
    signal: str | None  # "bullish" | "bearish" | "neutral"
    score: float        # -1 to +1


class _SeasonalResult(NamedTuple):
    bias: str                       # "bullish" | "bearish" | "neutral"
    current_month_avg_return: float | None
    score: float                    # -1 to +1
    data_sufficient: bool


class _ADResult(NamedTuple):
    ad_line_slope: float
    divergence: str   # "bullish_divergence" | "bearish_divergence" | "confirming" | "none"
    score: float      # -1 to +1


# ---------------------------------------------------------------------------
# LarryWilliamsAnalyzer
# ---------------------------------------------------------------------------


class LarryWilliamsAnalyzer(BaseMethodology):
    """Larry Williams Indicators analysis."""

    name: str = "larry_williams"
    display_name: str = "Larry Williams Indicators"
    default_timeframe: str = "short"
    version: str = "1.0.0"

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

        df = self._merge_data(price_data, volume_data)
        cot_data = kwargs.get("cot_data")

        wr_result = self._analyze_williams_r(df)
        cot_result = self._analyze_cot(cot_data)
        seasonal_result = self._analyze_seasonal(df)
        ad_result = self._analyze_accumulation_distribution(df)

        composite = self._calculate_composite(
            wr_result, cot_result, seasonal_result, ad_result,
        )
        direction = self._composite_to_direction(composite)
        confidence = self._calculate_confidence(
            wr_result, cot_result, seasonal_result, ad_result, direction,
        )

        timeframe_str = (
            Timeframe.MEDIUM.value
            if cot_result.available and cot_result.score != 0.0
            else Timeframe.SHORT.value
        )

        key_levels = self._build_key_levels(
            wr_result, cot_result, seasonal_result, ad_result,
        )
        reasoning = self._build_reasoning(
            ticker, wr_result, cot_result, seasonal_result,
            ad_result, direction, composite,
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
        self, price_data: pd.DataFrame, volume_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Inner-join price and volume on ``date``; fill missing volume with 0."""
        merged = pd.merge(price_data, volume_data, on="date", how="inner")
        merged["volume"] = merged["volume"].fillna(0.0)
        merged = merged.sort_values("date", ascending=True).reset_index(drop=True)
        return merged[["date", "open", "high", "low", "close", "volume"]]

    # ------------------------------------------------------------------
    # Williams %R
    # ------------------------------------------------------------------

    def _analyze_williams_r(self, df: pd.DataFrame) -> _WilliamsRResult:
        """Calculate Williams %R (14/28) with crossover and divergence signals."""
        n = len(df)
        closes = df["close"].values
        highs = df["high"].values
        lows = df["low"].values

        wr_14 = self._compute_wr(highs, lows, closes, _WR_PERIOD_SHORT) if n >= _WR_PERIOD_SHORT else 0.0
        wr_28 = self._compute_wr(highs, lows, closes, _WR_PERIOD_LONG) if n >= _WR_PERIOD_LONG else wr_14

        if n < _WR_PERIOD_SHORT:
            zone = "neutral"
        elif wr_14 > _WR_OVERBOUGHT:
            zone = "overbought"
        elif wr_14 < _WR_OVERSOLD:
            zone = "oversold"
        else:
            zone = "neutral"

        signal = "none"
        if n >= _WR_PERIOD_SHORT + _WR_CROSSOVER_LOOKBACK:
            signal = self._detect_wr_crossover(highs, lows, closes, wr_14)
        if signal == "none" and n >= _WR_PERIOD_SHORT + _WR_DIVERGENCE_LOOKBACK:
            signal = self._detect_wr_divergence(highs, lows, closes)

        score = self._wr_score(wr_14, zone, signal)
        return _WilliamsRResult(wr_14=wr_14, wr_28=wr_28, zone=zone, signal=signal, score=score)

    def _compute_wr(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int) -> float:
        """Williams %R = (HH - close) / (HH - LL) * -100."""
        highest_high = float(np.max(highs[-period:]))
        lowest_low = float(np.min(lows[-period:]))
        current_close = float(closes[-1])
        hl_range = highest_high - lowest_low
        if hl_range < _EPSILON:
            return -50.0
        wr = (highest_high - current_close) / hl_range * -100.0
        if math.isnan(wr) or math.isinf(wr):
            return -50.0
        return max(-100.0, min(0.0, wr))

    def _detect_wr_crossover(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, current_wr: float) -> str:
        """Bullish: was <= -80, now > -80.  Bearish: was >= -20, now < -20."""
        n = len(closes)
        for offset in range(1, _WR_CROSSOVER_LOOKBACK + 1):
            idx = n - 1 - offset
            if idx < _WR_PERIOD_SHORT - 1:
                break
            prev_wr = self._compute_wr(highs[:idx + 1], lows[:idx + 1], closes[:idx + 1], _WR_PERIOD_SHORT)
            if prev_wr <= _WR_OVERSOLD and current_wr > _WR_OVERSOLD:
                return "bullish_crossover"
            if prev_wr >= _WR_OVERBOUGHT and current_wr < _WR_OVERBOUGHT:
                return "bearish_crossover"
        return "none"

    def _detect_wr_divergence(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray) -> str:
        """Bullish div: lower price lows + higher %R lows.  Bearish: opposite."""
        n = len(closes)
        lookback = min(_WR_DIVERGENCE_LOOKBACK, n - _WR_PERIOD_SHORT)
        if lookback < 2:
            return "none"

        wr_values: list[float] = []
        for i in range(n - lookback, n):
            if i < _WR_PERIOD_SHORT - 1:
                continue
            wr_values.append(self._compute_wr(highs[:i + 1], lows[:i + 1], closes[:i + 1], _WR_PERIOD_SHORT))

        if len(wr_values) < 2:
            return "none"

        price_window = closes[n - len(wr_values):n]
        half = len(wr_values) // 2
        if half < 1:
            return "none"

        price_low_1 = float(np.min(price_window[:half]))
        price_low_2 = float(np.min(price_window[half:]))
        wr_low_1 = min(wr_values[:half])
        wr_low_2 = min(wr_values[half:])

        price_high_1 = float(np.max(price_window[:half]))
        price_high_2 = float(np.max(price_window[half:]))
        wr_high_1 = max(wr_values[:half])
        wr_high_2 = max(wr_values[half:])

        if price_low_2 < price_low_1 and wr_low_2 > wr_low_1:
            return "divergence_bullish"
        if price_high_2 > price_high_1 and wr_high_2 < wr_high_1:
            return "divergence_bearish"
        return "none"

    @staticmethod
    def _wr_score(wr_14: float, zone: str, signal: str) -> float:
        if signal in ("bullish_crossover", "divergence_bullish"):
            return 0.8
        if signal in ("bearish_crossover", "divergence_bearish"):
            return -0.8
        if zone == "oversold":
            return 0.5
        if zone == "overbought":
            return -0.5
        return (wr_14 + 50.0) / -50.0 * 0.3

    # ------------------------------------------------------------------
    # COT analysis
    # ------------------------------------------------------------------

    def _analyze_cot(self, cot_data: Any) -> _COTResult:
        """Analyze COT data.  Returns unavailable result when data is missing."""
        _unavailable = _COTResult(False, None, None, None, None, 0.0)

        if cot_data is None or not isinstance(cot_data, pd.DataFrame) or cot_data.empty:
            return _unavailable
        if not {"commercial_long", "commercial_short"}.issubset(set(cot_data.columns)):
            return _unavailable

        commercial_net_series = cot_data["commercial_long"] - cot_data["commercial_short"]
        if commercial_net_series.isna().iloc[-1]:
            return _unavailable

        current_net = int(commercial_net_series.iloc[-1])

        speculator_net: int | None = None
        if "speculator_long" in cot_data.columns and "speculator_short" in cot_data.columns:
            spec_series = cot_data["speculator_long"] - cot_data["speculator_short"]
            if not spec_series.isna().iloc[-1]:
                speculator_net = int(spec_series.iloc[-1])

        lookback = min(_COT_INDEX_PERIOD, len(commercial_net_series))
        window = commercial_net_series.tail(lookback)
        net_high = float(window.max())
        net_low = float(window.min())
        hl_range = net_high - net_low

        if abs(hl_range) < _EPSILON:
            commercial_index = 50.0
        else:
            commercial_index = (float(current_net) - net_low) / hl_range * 100.0
        if math.isnan(commercial_index) or math.isinf(commercial_index):
            commercial_index = 50.0
        commercial_index = max(0.0, min(100.0, commercial_index))

        if commercial_index > _COT_EXTREME_BULLISH:
            signal: str = "bullish"
        elif commercial_index < _COT_EXTREME_BEARISH:
            signal = "bearish"
        else:
            signal = "neutral"

        score = (commercial_index - 50.0) / 50.0
        if math.isnan(score) or math.isinf(score):
            score = 0.0
        score = max(-1.0, min(1.0, score))

        return _COTResult(True, commercial_index, current_net, speculator_net, signal, score)

    # ------------------------------------------------------------------
    # Seasonal analysis
    # ------------------------------------------------------------------

    def _analyze_seasonal(self, df: pd.DataFrame) -> _SeasonalResult:
        """Seasonal monthly-return analysis.  Needs >= 2 years of data."""
        _insuf = _SeasonalResult("neutral", None, 0.0, False)

        try:
            dt_series = pd.to_datetime(df["date"])
        except (ValueError, TypeError):
            return _insuf

        if dt_series.empty:
            return _insuf

        num_years = int(dt_series.iloc[-1].year) - int(dt_series.iloc[0].year)
        if num_years < _SEASONAL_MIN_YEARS:
            return _insuf

        closes = df["close"].values.astype(float)
        returns = np.diff(closes) / np.maximum(np.abs(closes[:-1]), _EPSILON)
        returns = np.where(np.isfinite(returns), returns, 0.0)
        months = dt_series.iloc[1:].dt.month.values

        monthly_avg: dict[int, float] = {}
        for m in range(1, 13):
            mask = months == m
            if np.any(mask):
                avg = float(np.mean(returns[mask]))
                monthly_avg[m] = 0.0 if (math.isnan(avg) or math.isinf(avg)) else avg

        current_month = int(dt_series.iloc[-1].month)
        current_month_avg = monthly_avg.get(current_month)
        if current_month_avg is None:
            return _SeasonalResult("neutral", None, 0.0, True)

        if current_month_avg > _SEASONAL_BULLISH_THRESHOLD:
            bias = "bullish"
        elif current_month_avg < _SEASONAL_BEARISH_THRESHOLD:
            bias = "bearish"
        else:
            bias = "neutral"

        score = max(-1.0, min(1.0, current_month_avg * 100.0))
        if math.isnan(score) or math.isinf(score):
            score = 0.0

        return _SeasonalResult(bias, current_month_avg, score, True)

    # ------------------------------------------------------------------
    # Williams Accumulation/Distribution
    # ------------------------------------------------------------------

    def _analyze_accumulation_distribution(self, df: pd.DataFrame) -> _ADResult:
        """Williams A/D with slope-based divergence detection."""
        n = len(df)
        closes = df["close"].values.astype(float)
        highs = df["high"].values.astype(float)
        lows = df["low"].values.astype(float)

        ad_values = np.zeros(n, dtype=float)
        for i in range(1, n):
            c, pc, lo, hi = closes[i], closes[i - 1], lows[i], highs[i]
            if c > pc:
                ad_values[i] = c - min(lo, pc)
            elif c < pc:
                ad_values[i] = c - max(hi, pc)

        ad_line = np.cumsum(ad_values)

        lookback = min(_AD_SLOPE_LOOKBACK, n - 1)
        if lookback < 2:
            return _ADResult(0.0, "none", 0.0)

        ad_window = ad_line[-lookback:]
        price_window = closes[-lookback:]
        x = np.arange(lookback, dtype=float)

        ad_slope = self._safe_slope(x, ad_window)
        price_slope = self._safe_slope(x, price_window)

        ad_range = float(np.max(ad_window) - np.min(ad_window))
        price_range = float(np.max(price_window) - np.min(price_window))

        nad = ad_slope / max(ad_range, _EPSILON)
        npr = price_slope / max(price_range, _EPSILON)
        if math.isnan(nad) or math.isinf(nad):
            nad = 0.0
        if math.isnan(npr) or math.isinf(npr):
            npr = 0.0

        if nad > _EPSILON and npr < -_EPSILON:
            divergence = "bullish_divergence"
        elif nad < -_EPSILON and npr > _EPSILON:
            divergence = "bearish_divergence"
        elif (nad > _EPSILON and npr > _EPSILON) or (nad < -_EPSILON and npr < -_EPSILON):
            divergence = "confirming"
        else:
            divergence = "none"

        if divergence == "bullish_divergence":
            score = 0.7
        elif divergence == "bearish_divergence":
            score = -0.7
        elif divergence == "confirming":
            score = 0.3 if nad > 0 else -0.3
        else:
            score = 0.0

        return _ADResult(ad_slope, divergence, score)

    @staticmethod
    def _safe_slope(x: np.ndarray, y: np.ndarray) -> float:
        if len(x) < 2 or np.all(y == y[0]):
            return 0.0
        try:
            slope = float(np.polyfit(x, y, 1)[0])
        except (np.linalg.LinAlgError, ValueError):
            return 0.0
        return 0.0 if (math.isnan(slope) or math.isinf(slope)) else slope

    # ------------------------------------------------------------------
    # Composite calculation
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_composite(wr: _WilliamsRResult, cot: _COTResult, seasonal: _SeasonalResult, ad: _ADResult) -> float:
        if cot.available:
            composite = _WEIGHT_WR * wr.score + _WEIGHT_COT * cot.score + _WEIGHT_SEASONAL * seasonal.score + _WEIGHT_AD * ad.score
        else:
            composite = _WEIGHT_WR_NO_COT * wr.score + _WEIGHT_SEASONAL_NO_COT * seasonal.score + _WEIGHT_AD_NO_COT * ad.score
        if math.isnan(composite) or math.isinf(composite):
            composite = 0.0
        return max(-1.0, min(1.0, composite))

    # ------------------------------------------------------------------
    # Direction from composite
    # ------------------------------------------------------------------

    @staticmethod
    def _composite_to_direction(composite: float) -> str:
        if composite > _BULLISH_THRESHOLD:
            return Direction.BULLISH.value
        if composite < _BEARISH_THRESHOLD:
            return Direction.BEARISH.value
        return Direction.NEUTRAL.value

    # ------------------------------------------------------------------
    # Confidence calculation
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_confidence(
        wr: _WilliamsRResult, cot: _COTResult, seasonal: _SeasonalResult,
        ad: _ADResult, direction: str,
    ) -> float:
        confidence = _CONF_BASE
        bullish = direction == Direction.BULLISH.value
        bearish = direction == Direction.BEARISH.value

        agreements = 0
        available_count = 0

        wr_agrees = (bullish and wr.score > 0) or (bearish and wr.score < 0)
        agreements += int(wr_agrees)
        available_count += 1

        if cot.available:
            cot_agrees = (bullish and cot.score > 0) or (bearish and cot.score < 0)
            agreements += int(cot_agrees)
            available_count += 1

        seasonal_agrees = (bullish and seasonal.score > 0) or (bearish and seasonal.score < 0)
        agreements += int(seasonal_agrees)
        available_count += 1

        ad_agrees = (bullish and ad.score > 0) or (bearish and ad.score < 0)
        agreements += int(ad_agrees)
        available_count += 1

        if available_count > 0 and agreements == available_count:
            confidence += _CONF_AGREEMENT
        if wr.signal in ("divergence_bullish", "divergence_bearish"):
            confidence += _CONF_WR_DIVERGENCE
        if cot.available and cot.commercial_index is not None:
            if cot.commercial_index > _COT_EXTREME_BULLISH or cot.commercial_index < _COT_EXTREME_BEARISH:
                confidence += _CONF_COT_EXTREME
        if seasonal.data_sufficient and seasonal_agrees:
            confidence += _CONF_SEASONAL_ALIGNS
        if ad.divergence in ("bullish_divergence", "bearish_divergence"):
            confidence += _CONF_AD_DIVERGENCE

        if math.isnan(confidence) or math.isinf(confidence):
            confidence = _CONF_BASE
        return max(0.0, min(1.0, confidence))

    # ------------------------------------------------------------------
    # Key levels construction
    # ------------------------------------------------------------------

    @staticmethod
    def _build_key_levels(
        wr: _WilliamsRResult, cot: _COTResult,
        seasonal: _SeasonalResult, ad: _ADResult,
    ) -> dict[str, Any]:
        return {
            "williams_r_14": round(wr.wr_14, 4),
            "williams_r_28": round(wr.wr_28, 4),
            "williams_r_zone": wr.zone,
            "williams_r_signal": wr.signal,
            "cot_available": cot.available,
            "cot_commercial_index": (
                round(cot.commercial_index, 4)
                if cot.commercial_index is not None else None
            ),
            "cot_commercial_net": cot.commercial_net,
            "cot_speculator_net": cot.speculator_net,
            "cot_signal": cot.signal,
            "seasonal_bias": seasonal.bias,
            "seasonal_current_month_avg_return": (
                round(seasonal.current_month_avg_return, 6)
                if seasonal.current_month_avg_return is not None else None
            ),
            "ad_line_slope": round(ad.ad_line_slope, 6),
            "ad_divergence": ad.divergence,
            "sub_indicator_scores": {
                "williams_r": round(wr.score, 4),
                "cot": round(cot.score, 4) if cot.available else None,
                "seasonal": round(seasonal.score, 4),
                "accumulation_distribution": round(ad.score, 4),
            },
        }

    # ------------------------------------------------------------------
    # Reasoning construction
    # ------------------------------------------------------------------

    def _build_reasoning(
        self, ticker: str, wr: _WilliamsRResult, cot: _COTResult,
        seasonal: _SeasonalResult, ad: _ADResult, direction: str, composite: float,
    ) -> str:
        safe_ticker = "".join(
            ch for ch in str(ticker).strip().upper()
            if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = []
        parts.append(f"Larry Williams analysis for {safe_ticker}: composite {composite:+.2f}, direction {direction}.")
        parts.append(f"Williams %%R(14)={wr.wr_14:.1f}, %%R(28)={wr.wr_28:.1f}, zone={wr.zone}.")
        if wr.signal != "none":
            parts.append(f"%%R signal: {wr.signal.replace('_', ' ')}.")

        if cot.available:
            parts.append(f"COT commercial index={cot.commercial_index:.1f}, signal={cot.signal}.")
            if cot.commercial_net is not None:
                parts.append(f"Commercial net={cot.commercial_net}.")
        else:
            parts.append("COT data not available; weights redistributed to Williams %%R and A/D.")

        if seasonal.data_sufficient:
            if seasonal.current_month_avg_return is not None:
                parts.append(f"Seasonal bias={seasonal.bias} (month avg return {seasonal.current_month_avg_return * 100.0:.2f}%).")
            else:
                parts.append(f"Seasonal bias={seasonal.bias}.")
        else:
            parts.append("Insufficient data for seasonal analysis.")

        if ad.divergence != "none":
            parts.append(f"A/D line: {ad.divergence.replace('_', ' ')}.")
        else:
            parts.append(f"A/D line: {'rising' if ad.ad_line_slope > 0 else 'falling'}, no divergence.")

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _is_finite_number(value: Any) -> bool:
        """Return True if value is a finite int or float (not bool)."""
        if isinstance(value, bool):
            return False
        if not isinstance(value, (int, float)):
            return False
        return not (math.isnan(value) or math.isinf(value))
