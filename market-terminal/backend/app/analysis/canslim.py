"""CANSLIM analysis module.

Implements William O'Neil's CANSLIM investment methodology including:
- C: Current quarterly earnings per share (YoY EPS growth)
- A: Annual earnings growth (consecutive annual EPS growth)
- N: New highs, new products, new management (52-week high proximity,
     Bollinger breakout)
- S: Supply and demand (shares outstanding, up/down volume ratio)
- L: Leader or laggard (12-month relative strength / return)
- I: Institutional sponsorship (ownership percentage and holder trends)
- M: Market direction (SMA 50/200 golden/death cross analysis)

Each criterion scores 0 or 1.  The composite score (0-7) maps to a
direction (bullish / neutral / bearish) and confidence level.

The analyzer produces a :class:`~app.analysis.base.MethodologySignal` with
direction, confidence, key levels, and human-readable reasoning.

Full implementation: TASK-ANALYSIS-005
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

# Criterion thresholds
_EPS_GROWTH_THRESHOLD: float = 0.25          # 25% YoY EPS growth for C and A
_NEAR_52W_HIGH_PCT: float = 0.15             # Within 15% of 52-week high for N
_BOLLINGER_PERIOD: int = 20                  # Bollinger band period for N
_BOLLINGER_STD: float = 2.0                  # Standard deviations for Bollinger
_SHARES_OUTSTANDING_THRESHOLD: float = 500_000_000  # 500M for S
_VOLUME_RATIO_THRESHOLD: float = 1.2         # Up/down volume ratio for S
_VOLUME_LOOKBACK: int = 50                   # Bars for volume analysis
_RS_THRESHOLD: float = 0.20                  # 20% absolute 12-month return for L
_INSTITUTIONAL_OWNERSHIP_THRESHOLD: float = 0.40  # 40% for I
_SMA_50_PERIOD: int = 50
_SMA_200_PERIOD: int = 200
_MIN_SMA_BARS: int = 20                   # Minimum bars for M criterion fallback

# Direction mapping
_BULLISH_THRESHOLD: int = 4                  # Score >= 4 -> bullish
_NEUTRAL_SCORE: int = 3                      # Score == 3 -> neutral
# Score <= 2 -> bearish

# Confidence formula
_CONFIDENCE_SCALE: float = 0.85 / 7.0       # Per criterion contribution
_CONFIDENCE_FLOOR: float = 0.15             # Minimum confidence
_NO_FUNDAMENTALS_CONFIDENCE: float = 0.1

# Bars approximating 1 trading year
_TRADING_YEAR_BARS: int = 252


# ---------------------------------------------------------------------------
# Internal NamedTuples
# ---------------------------------------------------------------------------


class _CriterionResult(NamedTuple):
    """Result of evaluating a single CANSLIM criterion."""

    passed: bool
    score: int  # 0 or 1
    detail: str
    data_available: bool  # True unless data was missing


# ---------------------------------------------------------------------------
# CANSLIMAnalyzer
# ---------------------------------------------------------------------------


class CANSLIMAnalyzer(BaseMethodology):
    """CANSLIM fundamental-technical hybrid analysis.

    Evaluates seven criteria from William O'Neil's methodology to produce
    a composite score (0-7) that drives the directional signal and
    confidence level.  Requires ``fundamentals`` data for the C, A, N, S,
    and I criteria; technical criteria (N, L, M) are derived from price
    and volume data.
    """

    name: str = "canslim"
    display_name: str = "CANSLIM"
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
        """Run CANSLIM analysis on the supplied data.

        Args:
            ticker: Stock/ETF symbol (e.g. ``"AAPL"``).
            price_data: DataFrame with columns ``[date, open, high, low, close]``.
            volume_data: DataFrame with columns ``[date, volume]``.
            fundamentals: Fundamental data dict.  Required for full
                analysis; if ``None`` or empty, a neutral signal with
                low confidence is returned.
            **kwargs: Additional data (``ownership_data``, ``market_data``).

        Returns:
            A :class:`MethodologySignal` populated with CANSLIM-specific
            direction, confidence, key levels, and reasoning.

        Raises:
            ValueError: If input data fails validation.
        """
        self.validate_input(price_data, volume_data)

        # If no fundamentals, return early neutral signal
        if fundamentals is None or not fundamentals:
            return self._no_fundamentals_signal(ticker)

        df = self._merge_data(price_data, volume_data)

        # Evaluate all 7 criteria
        c_result = self._evaluate_c(fundamentals)
        a_result = self._evaluate_a(fundamentals)
        n_result = self._evaluate_n(df, fundamentals)
        s_result = self._evaluate_s(df, fundamentals)
        l_result = self._evaluate_l(df)
        i_result = self._evaluate_i(fundamentals, kwargs)
        m_result = self._evaluate_m(df, kwargs)

        total_score = (
            c_result.score
            + a_result.score
            + n_result.score
            + s_result.score
            + l_result.score
            + i_result.score
            + m_result.score
        )

        direction = self._score_to_direction(total_score)
        confidence = self._calculate_confidence(total_score)

        if total_score >= 6:
            timeframe_str = Timeframe.LONG.value
        elif total_score >= 4:
            timeframe_str = Timeframe.MEDIUM.value
        else:
            timeframe_str = self.default_timeframe

        key_levels = self._build_key_levels(
            total_score, c_result, a_result, n_result,
            s_result, l_result, i_result, m_result, df,
        )
        reasoning = self._build_reasoning(
            ticker, total_score, c_result, a_result, n_result,
            s_result, l_result, i_result, m_result, direction,
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
    # C - Current quarterly earnings
    # ------------------------------------------------------------------

    def _evaluate_c(self, fundamentals: dict[str, Any]) -> _CriterionResult:
        """Evaluate the C criterion: current quarterly EPS growth YoY.

        PASS if the most recent quarter's EPS growth >= 25%.
        """
        quarterly = fundamentals.get("quarterly", [{}])
        if not quarterly or not isinstance(quarterly, list):
            return _CriterionResult(
                passed=False, score=0,
                detail="No quarterly data available",
                data_available=False,
            )

        eps_growth = quarterly[0].get("eps_growth_yoy")

        if not self._is_finite_number(eps_growth):
            return _CriterionResult(
                passed=False, score=0,
                detail="EPS growth data unavailable or invalid",
                data_available=False,
            )

        eps_growth = float(eps_growth)
        passed = eps_growth >= _EPS_GROWTH_THRESHOLD
        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail=f"EPS growth {eps_growth * 100:.1f}% YoY",
            data_available=True,
        )

    # ------------------------------------------------------------------
    # A - Annual earnings growth
    # ------------------------------------------------------------------

    def _evaluate_a(self, fundamentals: dict[str, Any]) -> _CriterionResult:
        """Evaluate the A criterion: annual EPS growth consistency.

        Requires at least 2 annual EPS values.  PASS if every
        consecutive YoY growth rate >= 25%.
        """
        annual_eps = fundamentals.get("annual_eps", [])
        if not isinstance(annual_eps, list) or len(annual_eps) < 2:
            return _CriterionResult(
                passed=False, score=0,
                detail="Insufficient annual EPS data (need >= 2 years)",
                data_available=False,
            )

        # Validate all values are finite numbers
        valid_values: list[float] = []
        for val in annual_eps:
            if self._is_finite_number(val):
                valid_values.append(float(val))

        if len(valid_values) < 2:
            return _CriterionResult(
                passed=False, score=0,
                detail="Insufficient valid annual EPS values",
                data_available=False,
            )

        # Calculate YoY growth for each consecutive pair
        growth_rates: list[float] = []
        for i in range(1, len(valid_values)):
            base = valid_values[i - 1]
            if abs(base) < _EPSILON:
                # Cannot compute meaningful growth from near-zero base
                return _CriterionResult(
                    passed=False, score=0,
                    detail="Annual EPS base near zero, growth undefined",
                    data_available=True,
                )
            if base < 0:
                # Negative base EPS makes growth calculation unreliable
                return _CriterionResult(
                    passed=False, score=0,
                    detail="Negative base EPS, growth undefined",
                    data_available=True,
                )
            growth = (valid_values[i] - base) / base
            growth_rates.append(growth)

        all_pass = all(g >= _EPS_GROWTH_THRESHOLD for g in growth_rates)
        rates_str = ", ".join(f"{g * 100:.1f}%" for g in growth_rates)

        return _CriterionResult(
            passed=all_pass,
            score=1 if all_pass else 0,
            detail=f"Annual EPS growth rates: {rates_str}",
            data_available=True,
        )

    # ------------------------------------------------------------------
    # N - New highs / new products / Bollinger breakout
    # ------------------------------------------------------------------

    def _evaluate_n(
        self,
        df: pd.DataFrame,
        fundamentals: dict[str, Any],
    ) -> _CriterionResult:
        """Evaluate the N criterion: new highs, new products, Bollinger breakout.

        PASS if ANY of the following:
        1. Price within 15% of 52-week high
        2. 8-K filing keywords present in fundamentals
        3. Bollinger Band upper breakout
        """
        current_close = float(df["close"].iloc[-1])
        bars_for_52w = min(_TRADING_YEAR_BARS, len(df))
        high_52w = float(df["high"].tail(bars_for_52w).max())

        # Check 1: price near 52-week high
        near_high = current_close >= high_52w * (1.0 - _NEAR_52W_HIGH_PCT)

        # Check 2: 8-K filing keywords (optional)
        filing_keywords = fundamentals.get("filing_keywords", [])
        has_new_product = False
        if isinstance(filing_keywords, list):
            new_keywords = {"new product", "new management", "acquisition",
                            "merger", "innovation", "launch"}
            for kw in filing_keywords:
                if isinstance(kw, str) and kw.lower() in new_keywords:
                    has_new_product = True
                    break

        # Check 3: Bollinger band breakout
        bollinger_breakout = False
        if len(df) >= _BOLLINGER_PERIOD:
            closes = df["close"].values
            sma20 = float(np.mean(closes[-_BOLLINGER_PERIOD:]))
            std20 = float(np.std(closes[-_BOLLINGER_PERIOD:], ddof=0))
            upper_band = sma20 + _BOLLINGER_STD * std20

            if current_close > upper_band and std20 > _EPSILON:
                # Check if price was within bands for at least 20 bars before
                if len(df) > _BOLLINGER_PERIOD:
                    within_count = 0
                    lookback_start = max(0, len(df) - _BOLLINGER_PERIOD - _BOLLINGER_PERIOD)
                    lookback_end = len(df) - _BOLLINGER_PERIOD
                    for i in range(lookback_start, lookback_end):
                        window = closes[max(0, i - _BOLLINGER_PERIOD + 1):i + 1]
                        if len(window) >= _BOLLINGER_PERIOD:
                            local_sma = float(np.mean(window))
                            local_std = float(np.std(window, ddof=0))
                            local_upper = local_sma + _BOLLINGER_STD * local_std
                            if closes[i] <= local_upper:
                                within_count += 1
                    if within_count >= _BOLLINGER_PERIOD:
                        bollinger_breakout = True
                else:
                    bollinger_breakout = True

        passed = near_high or has_new_product or bollinger_breakout

        details: list[str] = []
        if near_high:
            pct_from_high = (1.0 - current_close / max(high_52w, _EPSILON)) * 100.0
            if math.isnan(pct_from_high) or math.isinf(pct_from_high):
                pct_from_high = 0.0
            details.append(f"{pct_from_high:.1f}% from 52w high")
        if has_new_product:
            details.append("new product/management catalyst")
        if bollinger_breakout:
            details.append("Bollinger upper breakout")
        if not details:
            pct_from_high = (1.0 - current_close / max(high_52w, _EPSILON)) * 100.0
            if math.isnan(pct_from_high) or math.isinf(pct_from_high):
                pct_from_high = 0.0
            details.append(f"{pct_from_high:.1f}% from 52w high (too far)")

        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail="; ".join(details),
            data_available=True,
        )

    # ------------------------------------------------------------------
    # S - Supply and demand
    # ------------------------------------------------------------------

    def _evaluate_s(
        self,
        df: pd.DataFrame,
        fundamentals: dict[str, Any],
    ) -> _CriterionResult:
        """Evaluate the S criterion: supply and demand dynamics.

        PASS if shares outstanding < 500M OR up/down volume ratio > 1.2.
        """
        ttm = fundamentals.get("ttm", {})
        shares_outstanding = None
        if isinstance(ttm, dict):
            shares_outstanding = ttm.get("shares_outstanding")

        # Volume ratio analysis
        lookback = min(_VOLUME_LOOKBACK, len(df))
        window = df.tail(lookback)
        close_shifted = window["close"].shift(1)
        up_mask = window["close"] > close_shifted
        down_mask = window["close"] < close_shifted

        up_volumes = window.loc[up_mask, "volume"]
        down_volumes = window.loc[down_mask, "volume"]

        avg_up_vol = float(up_volumes.mean()) if len(up_volumes) > 0 else 0.0
        avg_down_vol = float(down_volumes.mean()) if len(down_volumes) > 0 else 0.0

        volume_ratio = avg_up_vol / max(avg_down_vol, _EPSILON)
        if math.isnan(volume_ratio) or math.isinf(volume_ratio):
            volume_ratio = 0.0

        # Evaluate passes
        small_supply = False
        if self._is_finite_number(shares_outstanding):
            shares_outstanding = float(shares_outstanding)
            small_supply = shares_outstanding < _SHARES_OUTSTANDING_THRESHOLD

        demand_strong = volume_ratio > _VOLUME_RATIO_THRESHOLD
        passed = small_supply or demand_strong

        details: list[str] = []
        if self._is_finite_number(shares_outstanding):
            details.append(f"Shares: {shares_outstanding / 1e6:.0f}M")
        else:
            details.append("Shares outstanding unavailable")
        details.append(f"Up/down vol ratio: {volume_ratio:.2f}")

        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail="; ".join(details),
            data_available=True,
        )

    # ------------------------------------------------------------------
    # L - Leader or laggard
    # ------------------------------------------------------------------

    def _evaluate_l(self, df: pd.DataFrame) -> _CriterionResult:
        """Evaluate the L criterion: 12-month relative strength.

        PASS if the stock's 12-month return exceeds 20%.
        """
        bars_for_year = min(_TRADING_YEAR_BARS, len(df))
        start_close = float(df["close"].iloc[-bars_for_year])
        end_close = float(df["close"].iloc[-1])

        if abs(start_close) < _EPSILON:
            return _CriterionResult(
                passed=False, score=0,
                detail="Start price near zero, return undefined",
                data_available=True,
            )

        twelve_month_return = (end_close - start_close) / start_close

        if math.isnan(twelve_month_return) or math.isinf(twelve_month_return):
            return _CriterionResult(
                passed=False, score=0,
                detail="Return calculation produced invalid value",
                data_available=True,
            )

        passed = twelve_month_return > _RS_THRESHOLD

        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail=f"12-month return: {twelve_month_return * 100:.1f}%",
            data_available=True,
        )

    # ------------------------------------------------------------------
    # I - Institutional sponsorship
    # ------------------------------------------------------------------

    def _evaluate_i(
        self,
        fundamentals: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> _CriterionResult:
        """Evaluate the I criterion: institutional ownership.

        PASS if ownership > 40% OR institutional holders are increasing.
        Falls back to ``kwargs["ownership_data"]`` if fundamentals lack
        the field.
        """
        ownership_pct: float | None = None
        holders_increasing: bool = False

        # Try fundamentals first
        inst_own = fundamentals.get("institutional_ownership")
        if self._is_finite_number(inst_own):
            ownership_pct = float(inst_own)

        # Fallback to kwargs ownership_data
        ownership_data = kwargs.get("ownership_data")
        if ownership_data is not None and isinstance(ownership_data, dict):
            if ownership_pct is None:
                raw_pct = ownership_data.get("ownership_pct")
                if self._is_finite_number(raw_pct):
                    ownership_pct = float(raw_pct)
            raw_increasing = ownership_data.get("holders_increasing")
            if isinstance(raw_increasing, bool):
                holders_increasing = raw_increasing

        if ownership_pct is None:
            return _CriterionResult(
                passed=False, score=0,
                detail="Institutional ownership data unavailable",
                data_available=False,
            )

        high_ownership = ownership_pct > _INSTITUTIONAL_OWNERSHIP_THRESHOLD
        passed = high_ownership or holders_increasing

        details: list[str] = [f"Institutional ownership: {ownership_pct * 100:.1f}%"]
        if holders_increasing:
            details.append("holders increasing")

        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail="; ".join(details),
            data_available=True,
        )

    # ------------------------------------------------------------------
    # M - Market direction
    # ------------------------------------------------------------------

    def _evaluate_m(
        self,
        df: pd.DataFrame,
        kwargs: dict[str, Any],
    ) -> _CriterionResult:
        """Evaluate the M criterion: overall market direction.

        Uses market-level data from ``kwargs["market_data"]`` if available,
        otherwise falls back to the stock's own SMA 50/200 analysis.

        PASS if SMA50 > SMA200 OR price > both SMAs.
        """
        # Determine source data for SMA calculation
        market_data = kwargs.get("market_data")
        if market_data is not None and isinstance(market_data, pd.DataFrame):
            if "close" in market_data.columns and len(market_data) >= _MIN_SMA_BARS:
                source = market_data
            else:
                source = df
        else:
            source = df

        n = len(source)
        current_close = float(source["close"].iloc[-1])

        # SMA 50
        if n >= _SMA_50_PERIOD:
            sma_50 = float(source["close"].tail(_SMA_50_PERIOD).mean())
        else:
            # Not enough data for SMA50, fail criterion
            return _CriterionResult(
                passed=False, score=0,
                detail="Insufficient data for SMA50 calculation",
                data_available=False,
            )

        # SMA 200
        if n >= _SMA_200_PERIOD:
            sma_200 = float(source["close"].tail(_SMA_200_PERIOD).mean())
        else:
            # Not enough data for SMA200, fail criterion
            return _CriterionResult(
                passed=False, score=0,
                detail="Insufficient data for SMA200 calculation",
                data_available=False,
            )

        golden_cross = sma_50 > sma_200
        price_above_both = current_close > sma_50 and current_close > sma_200
        passed = golden_cross or price_above_both

        return _CriterionResult(
            passed=passed,
            score=1 if passed else 0,
            detail=(
                f"SMA50={sma_50:.2f}, SMA200={sma_200:.2f}, "
                f"close={current_close:.2f}"
            ),
            data_available=True,
        )

    # ------------------------------------------------------------------
    # Score-to-direction mapping
    # ------------------------------------------------------------------

    @staticmethod
    def _score_to_direction(score: int) -> str:
        """Map composite CANSLIM score to a direction string.

        4-7 -> bullish, 3 -> neutral, 0-2 -> bearish.
        """
        if score >= _BULLISH_THRESHOLD:
            return Direction.BULLISH.value
        if score == _NEUTRAL_SCORE:
            return Direction.NEUTRAL.value
        return Direction.BEARISH.value

    # ------------------------------------------------------------------
    # Confidence calculation
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_confidence(score: int) -> float:
        """Compute confidence from the composite score.

        confidence = score / 7.0 * 0.85 + 0.15, clamped to [0.0, 1.0].
        """
        raw = float(score) * _CONFIDENCE_SCALE + _CONFIDENCE_FLOOR

        if math.isnan(raw) or math.isinf(raw):
            raw = _CONFIDENCE_FLOOR

        return max(0.0, min(1.0, raw))

    # ------------------------------------------------------------------
    # Key levels construction
    # ------------------------------------------------------------------

    def _build_key_levels(
        self,
        score: int,
        c_result: _CriterionResult,
        a_result: _CriterionResult,
        n_result: _CriterionResult,
        s_result: _CriterionResult,
        l_result: _CriterionResult,
        i_result: _CriterionResult,
        m_result: _CriterionResult,
        df: pd.DataFrame,
    ) -> dict[str, Any]:
        """Construct the ``key_levels`` dict for the output signal."""
        bars_for_52w = min(_TRADING_YEAR_BARS, len(df))
        high_52w = float(df["high"].tail(bars_for_52w).max())
        current_close = float(df["close"].iloc[-1])

        pct_vs_52w = (current_close / max(high_52w, _EPSILON) - 1.0) * 100.0
        if math.isnan(pct_vs_52w) or math.isinf(pct_vs_52w):
            pct_vs_52w = 0.0

        # SMA values
        n = len(df)
        sma_50 = (
            float(df["close"].tail(_SMA_50_PERIOD).mean())
            if n >= _SMA_50_PERIOD
            else float(df["close"].mean())
        )
        sma_200 = (
            float(df["close"].tail(_SMA_200_PERIOD).mean())
            if n >= _SMA_200_PERIOD
            else float(df["close"].mean())
        )

        return {
            "canslim_score": score,
            "criteria": {
                "C": {
                    "pass": c_result.passed,
                    "score": c_result.score,
                    "detail": c_result.detail,
                },
                "A": {
                    "pass": a_result.passed,
                    "score": a_result.score,
                    "detail": a_result.detail,
                },
                "N": {
                    "pass": n_result.passed,
                    "score": n_result.score,
                    "detail": n_result.detail,
                },
                "S": {
                    "pass": s_result.passed,
                    "score": s_result.score,
                    "detail": s_result.detail,
                },
                "L": {
                    "pass": l_result.passed,
                    "score": l_result.score,
                    "detail": l_result.detail,
                },
                "I": {
                    "pass": i_result.passed,
                    "score": i_result.score,
                    "detail": i_result.detail,
                    "data_available": i_result.data_available,
                },
                "M": {
                    "pass": m_result.passed,
                    "score": m_result.score,
                    "detail": m_result.detail,
                },
            },
            "fifty_two_week_high": round(high_52w, 4),
            "price_vs_52w_high_percent": round(pct_vs_52w, 4),
            "sma_50": round(sma_50, 4),
            "sma_200": round(sma_200, 4),
        }

    # ------------------------------------------------------------------
    # Reasoning construction
    # ------------------------------------------------------------------

    def _build_reasoning(
        self,
        ticker: str,
        score: int,
        c_result: _CriterionResult,
        a_result: _CriterionResult,
        n_result: _CriterionResult,
        s_result: _CriterionResult,
        l_result: _CriterionResult,
        i_result: _CriterionResult,
        m_result: _CriterionResult,
        direction: str,
    ) -> str:
        """Generate a human-readable reasoning summary.

        Lists each criterion's pass/fail status with detail, then provides
        an overall summary with direction and score.
        """
        safe_ticker = "".join(
            ch for ch in str(ticker).strip().upper()
            if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = []
        parts.append(f"CANSLIM analysis for {safe_ticker}: score {score}/7.")

        criteria = [
            ("C", c_result),
            ("A", a_result),
            ("N", n_result),
            ("S", s_result),
            ("L", l_result),
            ("I", i_result),
            ("M", m_result),
        ]

        for label, result in criteria:
            status = "PASS" if result.passed else "FAIL"
            parts.append(f"{label}: {status} - {result.detail}.")

        # Overall summary
        if direction == Direction.BULLISH.value:
            parts.append(
                f"Overall: bullish with {score} of 7 criteria met."
            )
        elif direction == Direction.BEARISH.value:
            parts.append(
                f"Overall: bearish with only {score} of 7 criteria met."
            )
        else:
            parts.append(
                f"Overall: neutral with {score} of 7 criteria met."
            )

        return " ".join(parts)

    # ------------------------------------------------------------------
    # No-fundamentals fallback signal
    # ------------------------------------------------------------------

    def _no_fundamentals_signal(self, ticker: str) -> MethodologySignal:
        """Return a neutral signal when no fundamentals data is available."""
        safe_ticker = "".join(
            ch for ch in str(ticker).strip().upper()
            if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        key_levels: dict[str, Any] = {
            "canslim_score": 0,
            "criteria": {
                letter: {
                    "pass": False,
                    "score": 0,
                    "detail": "No fundamentals data provided",
                }
                for letter in ("C", "A", "N", "S", "L", "M")
            },
        }
        # I criterion has extra field
        key_levels["criteria"]["I"] = {
            "pass": False,
            "score": 0,
            "detail": "No fundamentals data provided",
            "data_available": False,
        }
        key_levels["fifty_two_week_high"] = 0.0
        key_levels["price_vs_52w_high_percent"] = 0.0
        key_levels["sma_50"] = 0.0
        key_levels["sma_200"] = 0.0

        reasoning = (
            f"CANSLIM analysis for {safe_ticker}: "
            f"no fundamentals data provided. "
            f"Unable to evaluate criteria. Returning neutral signal."
        )

        return self.create_signal(
            ticker=ticker,
            direction=Direction.NEUTRAL.value,
            confidence=_NO_FUNDAMENTALS_CONFIDENCE,
            timeframe=self.default_timeframe,
            reasoning=reasoning,
            key_levels=key_levels,
        )

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
        if math.isnan(value) or math.isinf(value):
            return False
        return True
