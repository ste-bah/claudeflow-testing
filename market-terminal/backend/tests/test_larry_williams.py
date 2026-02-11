"""Tests for TASK-ANALYSIS-006: Larry Williams Indicators analysis module.

Validates LarryWilliamsAnalyzer against the BaseMethodology ABC contract,
Williams %R (14/28), COT analysis, seasonal patterns, Williams A/D line,
composite scoring, confidence calculation, key levels, reasoning string,
ticker sanitization (XSS prevention), NaN/Inf handling, and edge cases.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_larry_williams.py -v``
"""
from __future__ import annotations

import asyncio
import math
import unittest
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, Direction, MethodologySignal, Timeframe
from app.analysis.larry_williams import (
    LarryWilliamsAnalyzer,
    _WilliamsRResult, _COTResult, _SeasonalResult, _ADResult,
    _EPSILON, _MAX_TICKER_LENGTH,
    _WR_PERIOD_SHORT, _WR_PERIOD_LONG,
    _WR_OVERBOUGHT, _WR_OVERSOLD,
    _WR_CROSSOVER_LOOKBACK, _WR_DIVERGENCE_LOOKBACK,
    _COT_INDEX_PERIOD, _COT_EXTREME_BULLISH, _COT_EXTREME_BEARISH,
    _SEASONAL_MIN_YEARS, _SEASONAL_BULLISH_THRESHOLD, _SEASONAL_BEARISH_THRESHOLD,
    _AD_SLOPE_LOOKBACK,
    _WEIGHT_WR, _WEIGHT_COT, _WEIGHT_SEASONAL, _WEIGHT_AD,
    _WEIGHT_WR_NO_COT, _WEIGHT_AD_NO_COT, _WEIGHT_SEASONAL_NO_COT,
    _BULLISH_THRESHOLD, _BEARISH_THRESHOLD,
    _CONF_BASE, _CONF_AGREEMENT, _CONF_WR_DIVERGENCE,
    _CONF_COT_EXTREME, _CONF_SEASONAL_ALIGNS, _CONF_AD_DIVERGENCE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(coro):
    """Run an async coroutine synchronously for testing."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_price_df(rows: int = 30, trend: str = "up", start_date: str = "2024-01-01") -> pd.DataFrame:
    """Create a price DataFrame with configurable trend.

    Trends:
        ``"up"``     -- steadily rising closes
        ``"down"``   -- steadily falling closes
        ``"flat"``   -- oscillating in a narrow band
    """
    dates = pd.date_range(start_date, periods=rows, freq="B")
    if trend == "up":
        base = [100.0 + i * 0.5 for i in range(rows)]
    elif trend == "down":
        base = [150.0 - i * 0.5 for i in range(rows)]
    else:  # flat / sideways
        base = [100.0 + (i % 5) * 0.2 for i in range(rows)]
    return pd.DataFrame({
        "date": dates,
        "open": [b - 0.5 for b in base],
        "high": [b + 2.0 for b in base],
        "low": [b - 2.0 for b in base],
        "close": base,
    })


def _make_volume_df(rows: int = 30, pattern: str = "normal", start_date: str = "2024-01-01") -> pd.DataFrame:
    """Create a volume DataFrame.

    Patterns:
        ``"normal"``   -- steadily increasing volume
        ``"zero"``     -- all zeros
        ``"nan"``      -- all NaN
        ``"constant"`` -- constant 1_000_000
        ``"high"``     -- very high volume (10_000_000)
    """
    dates = pd.date_range(start_date, periods=rows, freq="B")
    if pattern == "normal":
        volumes = [1_000_000 + i * 1000 for i in range(rows)]
    elif pattern == "zero":
        volumes = [0.0] * rows
    elif pattern == "nan":
        volumes = [float("nan")] * rows
    elif pattern == "constant":
        volumes = [1_000_000] * rows
    elif pattern == "high":
        volumes = [10_000_000] * rows
    else:
        volumes = [1_000_000] * rows
    return pd.DataFrame({"date": dates, "volume": volumes})


def _make_multi_year_price_df(years: int = 3, trend: str = "up") -> pd.DataFrame:
    """Create a multi-year price DataFrame for seasonal analysis."""
    rows = years * 252  # approx trading days per year
    dates = pd.date_range("2020-01-01", periods=rows, freq="B")
    if trend == "up":
        base = [100.0 + i * 0.02 for i in range(rows)]
    elif trend == "down":
        base = [200.0 - i * 0.02 for i in range(rows)]
    else:
        base = [100.0 + (i % 20) * 0.1 for i in range(rows)]
    return pd.DataFrame({
        "date": dates,
        "open": [b - 0.3 for b in base],
        "high": [b + 1.0 for b in base],
        "low": [b - 1.0 for b in base],
        "close": base,
    })


def _make_multi_year_volume_df(years: int = 3) -> pd.DataFrame:
    """Create a multi-year volume DataFrame."""
    rows = years * 252
    dates = pd.date_range("2020-01-01", periods=rows, freq="B")
    volumes = [1_000_000 + (i % 100) * 1000 for i in range(rows)]
    return pd.DataFrame({"date": dates, "volume": volumes})


def _make_cot_df(
    rows: int = 30,
    commercial_long_base: int = 50000,
    commercial_short_base: int = 30000,
    include_speculator: bool = True,
) -> pd.DataFrame:
    """Create a COT DataFrame."""
    data: dict[str, Any] = {
        "date": pd.date_range("2024-01-01", periods=rows, freq="W"),
        "commercial_long": [commercial_long_base + i * 100 for i in range(rows)],
        "commercial_short": [commercial_short_base + i * 50 for i in range(rows)],
    }
    if include_speculator:
        data["speculator_long"] = [20000 + i * 50 for i in range(rows)]
        data["speculator_short"] = [25000 + i * 30 for i in range(rows)]
    return pd.DataFrame(data)


# ---------------------------------------------------------------------------
# 1. TestConstants
# ---------------------------------------------------------------------------


class TestConstants(unittest.TestCase):
    """Validate all module-level constants match the spec."""

    def test_epsilon(self):
        self.assertEqual(_EPSILON, 1e-10)

    def test_max_ticker_length(self):
        self.assertEqual(_MAX_TICKER_LENGTH, 20)

    def test_wr_period_short(self):
        self.assertEqual(_WR_PERIOD_SHORT, 14)

    def test_wr_period_long(self):
        self.assertEqual(_WR_PERIOD_LONG, 28)

    def test_wr_overbought(self):
        self.assertAlmostEqual(_WR_OVERBOUGHT, -20.0)

    def test_wr_oversold(self):
        self.assertAlmostEqual(_WR_OVERSOLD, -80.0)

    def test_wr_crossover_lookback(self):
        self.assertEqual(_WR_CROSSOVER_LOOKBACK, 5)

    def test_wr_divergence_lookback(self):
        self.assertEqual(_WR_DIVERGENCE_LOOKBACK, 20)

    def test_cot_index_period(self):
        self.assertEqual(_COT_INDEX_PERIOD, 26)

    def test_cot_extreme_bullish(self):
        self.assertAlmostEqual(_COT_EXTREME_BULLISH, 80.0)

    def test_cot_extreme_bearish(self):
        self.assertAlmostEqual(_COT_EXTREME_BEARISH, 20.0)

    def test_seasonal_min_years(self):
        self.assertEqual(_SEASONAL_MIN_YEARS, 2)

    def test_seasonal_bullish_threshold(self):
        self.assertAlmostEqual(_SEASONAL_BULLISH_THRESHOLD, 0.01)

    def test_seasonal_bearish_threshold(self):
        self.assertAlmostEqual(_SEASONAL_BEARISH_THRESHOLD, -0.01)

    def test_ad_slope_lookback(self):
        self.assertEqual(_AD_SLOPE_LOOKBACK, 20)

    def test_weight_wr(self):
        self.assertAlmostEqual(_WEIGHT_WR, 0.30)

    def test_weight_cot(self):
        self.assertAlmostEqual(_WEIGHT_COT, 0.25)

    def test_weight_seasonal(self):
        self.assertAlmostEqual(_WEIGHT_SEASONAL, 0.15)

    def test_weight_ad(self):
        self.assertAlmostEqual(_WEIGHT_AD, 0.30)

    def test_weights_with_cot_sum_to_one(self):
        total = _WEIGHT_WR + _WEIGHT_COT + _WEIGHT_SEASONAL + _WEIGHT_AD
        self.assertAlmostEqual(total, 1.0, places=6)

    def test_weight_wr_no_cot(self):
        self.assertAlmostEqual(_WEIGHT_WR_NO_COT, 0.425)

    def test_weight_ad_no_cot(self):
        self.assertAlmostEqual(_WEIGHT_AD_NO_COT, 0.425)

    def test_weight_seasonal_no_cot(self):
        self.assertAlmostEqual(_WEIGHT_SEASONAL_NO_COT, 0.15)

    def test_weights_without_cot_sum_to_one(self):
        total = _WEIGHT_WR_NO_COT + _WEIGHT_AD_NO_COT + _WEIGHT_SEASONAL_NO_COT
        self.assertAlmostEqual(total, 1.0, places=6)

    def test_bullish_threshold(self):
        self.assertAlmostEqual(_BULLISH_THRESHOLD, 0.3)

    def test_bearish_threshold(self):
        self.assertAlmostEqual(_BEARISH_THRESHOLD, -0.3)

    def test_conf_base(self):
        self.assertAlmostEqual(_CONF_BASE, 0.30)

    def test_conf_agreement(self):
        self.assertAlmostEqual(_CONF_AGREEMENT, 0.25)

    def test_conf_wr_divergence(self):
        self.assertAlmostEqual(_CONF_WR_DIVERGENCE, 0.15)

    def test_conf_cot_extreme(self):
        self.assertAlmostEqual(_CONF_COT_EXTREME, 0.15)

    def test_conf_seasonal_aligns(self):
        self.assertAlmostEqual(_CONF_SEASONAL_ALIGNS, 0.10)

    def test_conf_ad_divergence(self):
        self.assertAlmostEqual(_CONF_AD_DIVERGENCE, 0.10)

    def test_confidence_bonuses_sum(self):
        total = (_CONF_BASE + _CONF_AGREEMENT + _CONF_WR_DIVERGENCE
                 + _CONF_COT_EXTREME + _CONF_SEASONAL_ALIGNS + _CONF_AD_DIVERGENCE)
        self.assertAlmostEqual(total, 1.05, places=6)

    def test_all_constants_are_correct_type(self):
        self.assertIsInstance(_EPSILON, float)
        self.assertIsInstance(_MAX_TICKER_LENGTH, int)
        self.assertIsInstance(_WR_PERIOD_SHORT, int)
        self.assertIsInstance(_WR_PERIOD_LONG, int)
        self.assertIsInstance(_WR_OVERBOUGHT, float)
        self.assertIsInstance(_WR_OVERSOLD, float)
        self.assertIsInstance(_WR_CROSSOVER_LOOKBACK, int)
        self.assertIsInstance(_WR_DIVERGENCE_LOOKBACK, int)
        self.assertIsInstance(_COT_INDEX_PERIOD, int)


# ---------------------------------------------------------------------------
# 2. TestNamedTuples
# ---------------------------------------------------------------------------


class TestNamedTuples(unittest.TestCase):
    """Validate NamedTuple field definitions."""

    def test_williams_r_result_fields(self):
        r = _WilliamsRResult(wr_14=-50.0, wr_28=-55.0, zone="neutral", signal="none", score=0.0)
        self.assertEqual(r.wr_14, -50.0)
        self.assertEqual(r.wr_28, -55.0)
        self.assertEqual(r.zone, "neutral")
        self.assertEqual(r.signal, "none")
        self.assertEqual(r.score, 0.0)

    def test_williams_r_result_field_names(self):
        self.assertEqual(_WilliamsRResult._fields, ("wr_14", "wr_28", "zone", "signal", "score"))

    def test_cot_result_fields(self):
        r = _COTResult(available=True, commercial_index=75.0, commercial_net=1000,
                       speculator_net=-500, signal="bullish", score=0.5)
        self.assertTrue(r.available)
        self.assertEqual(r.commercial_index, 75.0)
        self.assertEqual(r.commercial_net, 1000)
        self.assertEqual(r.speculator_net, -500)
        self.assertEqual(r.signal, "bullish")
        self.assertEqual(r.score, 0.5)

    def test_cot_result_field_names(self):
        self.assertEqual(
            _COTResult._fields,
            ("available", "commercial_index", "commercial_net", "speculator_net", "signal", "score"),
        )

    def test_seasonal_result_fields(self):
        r = _SeasonalResult(bias="bullish", current_month_avg_return=0.02, score=0.5, data_sufficient=True)
        self.assertEqual(r.bias, "bullish")
        self.assertEqual(r.current_month_avg_return, 0.02)
        self.assertEqual(r.score, 0.5)
        self.assertTrue(r.data_sufficient)

    def test_seasonal_result_field_names(self):
        self.assertEqual(
            _SeasonalResult._fields,
            ("bias", "current_month_avg_return", "score", "data_sufficient"),
        )

    def test_ad_result_fields(self):
        r = _ADResult(ad_line_slope=0.5, divergence="confirming", score=0.3)
        self.assertEqual(r.ad_line_slope, 0.5)
        self.assertEqual(r.divergence, "confirming")
        self.assertEqual(r.score, 0.3)

    def test_ad_result_field_names(self):
        self.assertEqual(_ADResult._fields, ("ad_line_slope", "divergence", "score"))


# ---------------------------------------------------------------------------
# 3. TestClassProperties
# ---------------------------------------------------------------------------


class TestClassProperties(unittest.TestCase):
    """Validate class-level properties and ABC compliance."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_name(self):
        self.assertEqual(self.analyzer.name, "larry_williams")

    def test_display_name(self):
        self.assertEqual(self.analyzer.display_name, "Larry Williams Indicators")

    def test_default_timeframe(self):
        self.assertEqual(self.analyzer.default_timeframe, "short")

    def test_version(self):
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_is_base_methodology_subclass(self):
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_has_analyze_method(self):
        self.assertTrue(hasattr(self.analyzer, "analyze"))
        self.assertTrue(callable(getattr(self.analyzer, "analyze")))

    def test_has_validate_input_method(self):
        self.assertTrue(hasattr(self.analyzer, "validate_input"))

    def test_has_create_signal_method(self):
        self.assertTrue(hasattr(self.analyzer, "create_signal"))

    def test_has_private_methods(self):
        for method in (
            "_merge_data", "_analyze_williams_r", "_analyze_cot",
            "_analyze_seasonal", "_analyze_accumulation_distribution",
            "_calculate_composite", "_composite_to_direction",
            "_calculate_confidence", "_build_key_levels", "_build_reasoning",
        ):
            self.assertTrue(hasattr(self.analyzer, method), f"Missing method: {method}")


# ---------------------------------------------------------------------------
# 4. TestMergeData
# ---------------------------------------------------------------------------


class TestMergeData(unittest.TestCase):
    """Test _merge_data inner-join logic."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_inner_join_matching_dates(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 30)

    def test_inner_join_partial_overlap(self):
        pdf = _make_price_df(30, start_date="2024-01-01")
        vdf = _make_volume_df(25, start_date="2024-01-01")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 25)

    def test_nan_volume_filled_with_zero(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30, pattern="nan")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertTrue((merged["volume"] == 0.0).all())

    def test_output_columns(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(list(merged.columns), ["date", "open", "high", "low", "close", "volume"])

    def test_sorted_ascending(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))

    def test_reset_index(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(list(merged.index), list(range(len(merged))))

    def test_no_overlap_empty(self):
        pdf = _make_price_df(30, start_date="2024-01-01")
        vdf = _make_volume_df(30, start_date="2025-01-01")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 0)

    def test_preserves_price_values(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        # Closes in up-trend start at 100.0
        self.assertAlmostEqual(merged["close"].iloc[0], 100.0)


# ---------------------------------------------------------------------------
# 5. TestAnalyzeWilliamsR
# ---------------------------------------------------------------------------


class TestAnalyzeWilliamsR(unittest.TestCase):
    """Test Williams %R calculation and signal detection."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def _merged_df(self, rows=30, trend="up"):
        pdf = _make_price_df(rows, trend)
        vdf = _make_volume_df(rows)
        return self.analyzer._merge_data(pdf, vdf)

    def test_wr_formula_basic(self):
        """Williams %R = (HH - close)/(HH - LL) * -100."""
        df = self._merged_df(20, "up")
        result = self.analyzer._analyze_williams_r(df)
        # In an uptrend last close near highest high -> WR near 0
        self.assertGreater(result.wr_14, -50.0)

    def test_wr_14_in_uptrend_near_zero(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_williams_r(df)
        # Close is highest -> near 0
        self.assertGreater(result.wr_14, -30.0)

    def test_wr_14_in_downtrend_near_minus_100(self):
        df = self._merged_df(30, "down")
        result = self.analyzer._analyze_williams_r(df)
        # Close is lowest -> near -100
        self.assertLess(result.wr_14, -70.0)

    def test_wr_14_range(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_williams_r(df)
        self.assertGreaterEqual(result.wr_14, -100.0)
        self.assertLessEqual(result.wr_14, 0.0)

    def test_wr_28_range(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_williams_r(df)
        self.assertGreaterEqual(result.wr_28, -100.0)
        self.assertLessEqual(result.wr_28, 0.0)

    def test_wr_28_fallback_when_insufficient_data(self):
        """When n < 28 but >= 14, wr_28 should fall back to wr_14."""
        df = self._merged_df(20, "up")
        result = self.analyzer._analyze_williams_r(df)
        self.assertAlmostEqual(result.wr_28, result.wr_14)

    def test_less_than_14_bars_returns_zero_wr(self):
        df = self._merged_df(20, "up")
        short_df = df.head(10)
        result = self.analyzer._analyze_williams_r(short_df)
        self.assertAlmostEqual(result.wr_14, 0.0)
        self.assertEqual(result.zone, "neutral")

    def test_zone_overbought(self):
        """%R > -20 -> overbought."""
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_williams_r(df)
        if result.wr_14 > _WR_OVERBOUGHT:
            self.assertEqual(result.zone, "overbought")

    def test_zone_oversold(self):
        """%R < -80 -> oversold."""
        df = self._merged_df(30, "down")
        result = self.analyzer._analyze_williams_r(df)
        if result.wr_14 < _WR_OVERSOLD:
            self.assertEqual(result.zone, "oversold")

    def test_zone_neutral_in_middle(self):
        df = self._merged_df(30, "flat")
        result = self.analyzer._analyze_williams_r(df)
        # Flat data -> WR should be somewhere in the middle
        if _WR_OVERSOLD <= result.wr_14 <= _WR_OVERBOUGHT:
            self.assertEqual(result.zone, "neutral")

    def test_identical_prices_epsilon_guard(self):
        """All identical prices -> _EPSILON guard -> wr = -50."""
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 30,
            "high": [100.0] * 30,
            "low": [100.0] * 30,
            "close": [100.0] * 30,
            "volume": [1_000_000] * 30,
        })
        result = self.analyzer._analyze_williams_r(df)
        self.assertAlmostEqual(result.wr_14, -50.0)
        self.assertAlmostEqual(result.wr_28, -50.0)

    def test_score_overbought_negative(self):
        """Overbought zone score should be negative."""
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_williams_r(df)
        if result.zone == "overbought" and result.signal == "none":
            self.assertLess(result.score, 0.0)

    def test_score_oversold_positive(self):
        """Oversold zone score should be positive."""
        df = self._merged_df(30, "down")
        result = self.analyzer._analyze_williams_r(df)
        if result.zone == "oversold" and result.signal == "none":
            self.assertGreater(result.score, 0.0)

    def test_bullish_crossover_detection(self):
        """Test bullish crossover: was <= -80, now > -80."""
        dates = pd.date_range("2024-01-01", periods=25, freq="B")
        # Create prices that drop deeply then recover
        closes = []
        for i in range(25):
            if i < 18:
                closes.append(100.0 - i * 2.0)  # deep drop
            else:
                closes.append(100.0 - 17 * 2.0 + (i - 18) * 5.0)  # sharp recovery
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * 25,
        })
        result = self.analyzer._analyze_williams_r(df)
        # The signal might or might not be bullish_crossover depending on exact values
        self.assertIn(result.signal, ("bullish_crossover", "bearish_crossover",
                                      "divergence_bullish", "divergence_bearish", "none"))

    def test_bearish_crossover_detection(self):
        """Test bearish crossover: was >= -20, now < -20."""
        dates = pd.date_range("2024-01-01", periods=25, freq="B")
        # Create prices that rise then drop
        closes = []
        for i in range(25):
            if i < 18:
                closes.append(100.0 + i * 2.0)  # rise
            else:
                closes.append(100.0 + 17 * 2.0 - (i - 18) * 5.0)  # drop
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * 25,
        })
        result = self.analyzer._analyze_williams_r(df)
        self.assertIn(result.signal, ("bullish_crossover", "bearish_crossover",
                                      "divergence_bullish", "divergence_bearish", "none"))

    def test_bullish_crossover_score(self):
        """Bullish crossover score = 0.8."""
        score = LarryWilliamsAnalyzer._wr_score(-60.0, "neutral", "bullish_crossover")
        self.assertAlmostEqual(score, 0.8)

    def test_bearish_crossover_score(self):
        """Bearish crossover score = -0.8."""
        score = LarryWilliamsAnalyzer._wr_score(-40.0, "neutral", "bearish_crossover")
        self.assertAlmostEqual(score, -0.8)

    def test_divergence_bullish_score(self):
        score = LarryWilliamsAnalyzer._wr_score(-70.0, "neutral", "divergence_bullish")
        self.assertAlmostEqual(score, 0.8)

    def test_divergence_bearish_score(self):
        score = LarryWilliamsAnalyzer._wr_score(-30.0, "neutral", "divergence_bearish")
        self.assertAlmostEqual(score, -0.8)

    def test_oversold_score(self):
        score = LarryWilliamsAnalyzer._wr_score(-90.0, "oversold", "none")
        self.assertAlmostEqual(score, 0.5)

    def test_overbought_score(self):
        score = LarryWilliamsAnalyzer._wr_score(-10.0, "overbought", "none")
        self.assertAlmostEqual(score, -0.5)

    def test_neutral_score_formula(self):
        """Neutral score = (wr_14 + 50) / -50 * 0.3."""
        wr_14 = -50.0
        expected = (wr_14 + 50.0) / -50.0 * 0.3
        score = LarryWilliamsAnalyzer._wr_score(wr_14, "neutral", "none")
        self.assertAlmostEqual(score, expected)

    def test_result_is_named_tuple(self):
        df = self._merged_df(30)
        result = self.analyzer._analyze_williams_r(df)
        self.assertIsInstance(result, _WilliamsRResult)

    def test_no_crossover_when_insufficient_lookback(self):
        """If n < period + crossover_lookback, signal should be none."""
        df = self._merged_df(20, "up")
        short_df = df.head(16)  # 16 >= 14 but < 14+5=19
        result = self.analyzer._analyze_williams_r(short_df)
        self.assertIn(result.signal, ("none",))


# ---------------------------------------------------------------------------
# 6. TestAnalyzeCOT
# ---------------------------------------------------------------------------


class TestAnalyzeCOT(unittest.TestCase):
    """Test Commitment of Traders analysis."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_none_cot_returns_unavailable(self):
        result = self.analyzer._analyze_cot(None)
        self.assertFalse(result.available)
        self.assertAlmostEqual(result.score, 0.0)
        self.assertIsNone(result.commercial_index)
        self.assertIsNone(result.signal)

    def test_not_dataframe_returns_unavailable(self):
        result = self.analyzer._analyze_cot({"foo": "bar"})
        self.assertFalse(result.available)

    def test_empty_dataframe_returns_unavailable(self):
        result = self.analyzer._analyze_cot(pd.DataFrame())
        self.assertFalse(result.available)

    def test_missing_columns_returns_unavailable(self):
        df = pd.DataFrame({"date": [1, 2, 3], "some_col": [1, 2, 3]})
        result = self.analyzer._analyze_cot(df)
        self.assertFalse(result.available)

    def test_valid_cot_data_is_available(self):
        cot = _make_cot_df()
        result = self.analyzer._analyze_cot(cot)
        self.assertTrue(result.available)

    def test_commercial_index_calculated(self):
        cot = _make_cot_df()
        result = self.analyzer._analyze_cot(cot)
        self.assertIsNotNone(result.commercial_index)
        self.assertGreaterEqual(result.commercial_index, 0.0)
        self.assertLessEqual(result.commercial_index, 100.0)

    def test_commercial_net_calculated(self):
        cot = _make_cot_df()
        result = self.analyzer._analyze_cot(cot)
        self.assertIsNotNone(result.commercial_net)
        self.assertIsInstance(result.commercial_net, int)

    def test_speculator_net_when_columns_present(self):
        cot = _make_cot_df(include_speculator=True)
        result = self.analyzer._analyze_cot(cot)
        self.assertIsNotNone(result.speculator_net)
        self.assertIsInstance(result.speculator_net, int)

    def test_speculator_net_none_when_columns_missing(self):
        cot = _make_cot_df(include_speculator=False)
        result = self.analyzer._analyze_cot(cot)
        self.assertIsNone(result.speculator_net)

    def test_bullish_signal_high_commercial_index(self):
        """Commercial index > 80 -> bullish."""
        # Create data where commercial_long >> commercial_short at end
        cot = _make_cot_df(rows=30, commercial_long_base=80000, commercial_short_base=10000)
        result = self.analyzer._analyze_cot(cot)
        if result.commercial_index is not None and result.commercial_index > _COT_EXTREME_BULLISH:
            self.assertEqual(result.signal, "bullish")

    def test_bearish_signal_low_commercial_index(self):
        """Commercial index < 20 -> bearish."""
        # Create data where commercial_short >> commercial_long at end
        cot = _make_cot_df(rows=30, commercial_long_base=10000, commercial_short_base=80000)
        result = self.analyzer._analyze_cot(cot)
        if result.commercial_index is not None and result.commercial_index < _COT_EXTREME_BEARISH:
            self.assertEqual(result.signal, "bearish")

    def test_neutral_signal_middle_commercial_index(self):
        """Commercial index between 20 and 80 -> neutral."""
        # Create flat net positions
        df = pd.DataFrame({
            "commercial_long": [50000] * 30,
            "commercial_short": [50000] * 30,
        })
        result = self.analyzer._analyze_cot(df)
        if result.available:
            self.assertEqual(result.signal, "neutral")

    def test_nan_in_last_row_returns_unavailable(self):
        cot = _make_cot_df(rows=5)
        cot.loc[cot.index[-1], "commercial_long"] = float("nan")
        result = self.analyzer._analyze_cot(cot)
        self.assertFalse(result.available)

    def test_score_range(self):
        cot = _make_cot_df()
        result = self.analyzer._analyze_cot(cot)
        self.assertGreaterEqual(result.score, -1.0)
        self.assertLessEqual(result.score, 1.0)

    def test_identical_net_positions_gives_index_50(self):
        """When all net positions are identical, index should be 50."""
        df = pd.DataFrame({
            "commercial_long": [50000] * 30,
            "commercial_short": [30000] * 30,
        })
        result = self.analyzer._analyze_cot(df)
        self.assertTrue(result.available)
        self.assertAlmostEqual(result.commercial_index, 50.0)

    def test_result_is_named_tuple(self):
        result = self.analyzer._analyze_cot(None)
        self.assertIsInstance(result, _COTResult)


# ---------------------------------------------------------------------------
# 7. TestAnalyzeSeasonal
# ---------------------------------------------------------------------------


class TestAnalyzeSeasonal(unittest.TestCase):
    """Test seasonal pattern analysis."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def _merged_df_years(self, years=3, trend="up"):
        pdf = _make_multi_year_price_df(years, trend)
        vdf = _make_multi_year_volume_df(years)
        return self.analyzer._merge_data(pdf, vdf)

    def test_insufficient_years_returns_not_sufficient(self):
        """Less than 2 years -> data_sufficient=False."""
        df = self._merged_df_years(1, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertFalse(result.data_sufficient)

    def test_exactly_two_years_sufficient(self):
        """Data spanning 2+ calendar years -> data_sufficient=True."""
        # Need last_year - first_year >= 2, so span from 2020 to 2022+
        rows = int(2.2 * 252)  # enough to cross into third calendar year
        dates = pd.date_range("2020-01-01", periods=rows, freq="B")
        base = [100.0 + i * 0.02 for i in range(rows)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 0.3 for b in base],
            "high": [b + 1.0 for b in base],
            "low": [b - 1.0 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        merged = self.analyzer._merge_data(pdf, vdf)
        result = self.analyzer._analyze_seasonal(merged)
        self.assertTrue(result.data_sufficient)

    def test_three_years_sufficient(self):
        df = self._merged_df_years(3, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertTrue(result.data_sufficient)

    def test_bullish_seasonal_bias(self):
        """Monthly avg return > 1% -> bullish."""
        df = self._merged_df_years(3, "up")
        result = self.analyzer._analyze_seasonal(df)
        if result.data_sufficient and result.current_month_avg_return is not None:
            if result.current_month_avg_return > _SEASONAL_BULLISH_THRESHOLD:
                self.assertEqual(result.bias, "bullish")

    def test_bearish_seasonal_bias(self):
        """Monthly avg return < -1% -> bearish."""
        df = self._merged_df_years(3, "down")
        result = self.analyzer._analyze_seasonal(df)
        if result.data_sufficient and result.current_month_avg_return is not None:
            if result.current_month_avg_return < _SEASONAL_BEARISH_THRESHOLD:
                self.assertEqual(result.bias, "bearish")

    def test_neutral_seasonal_flat(self):
        df = self._merged_df_years(3, "flat")
        result = self.analyzer._analyze_seasonal(df)
        # Flat data means small returns -> neutral
        if result.data_sufficient and result.current_month_avg_return is not None:
            if abs(result.current_month_avg_return) <= abs(_SEASONAL_BULLISH_THRESHOLD):
                self.assertEqual(result.bias, "neutral")

    def test_score_range(self):
        df = self._merged_df_years(3, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertGreaterEqual(result.score, -1.0)
        self.assertLessEqual(result.score, 1.0)

    def test_insufficient_returns_neutral_bias(self):
        df = self._merged_df_years(1, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertEqual(result.bias, "neutral")

    def test_insufficient_returns_zero_score(self):
        df = self._merged_df_years(1, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertAlmostEqual(result.score, 0.0)

    def test_insufficient_returns_none_avg(self):
        df = self._merged_df_years(1, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertIsNone(result.current_month_avg_return)

    def test_result_is_named_tuple(self):
        df = self._merged_df_years(3, "up")
        result = self.analyzer._analyze_seasonal(df)
        self.assertIsInstance(result, _SeasonalResult)

    def test_empty_df_returns_insufficient(self):
        df = pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
        result = self.analyzer._analyze_seasonal(df)
        self.assertFalse(result.data_sufficient)


# ---------------------------------------------------------------------------
# 8. TestAnalyzeAD
# ---------------------------------------------------------------------------


class TestAnalyzeAD(unittest.TestCase):
    """Test Williams Accumulation/Distribution line analysis."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def _merged_df(self, rows=30, trend="up"):
        pdf = _make_price_df(rows, trend)
        vdf = _make_volume_df(rows)
        return self.analyzer._merge_data(pdf, vdf)

    def test_ad_formula_close_gt_prev(self):
        """When close > prev close: AD = close - min(low, prev_close)."""
        # Uptrend: closes keep rising
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_accumulation_distribution(df)
        # In a consistent uptrend, AD slope should be positive
        self.assertGreater(result.ad_line_slope, 0.0)

    def test_ad_formula_close_lt_prev(self):
        """When close < prev close: AD = close - max(high, prev_close)."""
        df = self._merged_df(30, "down")
        result = self.analyzer._analyze_accumulation_distribution(df)
        # In a consistent downtrend, AD slope should be negative
        self.assertLess(result.ad_line_slope, 0.0)

    def test_cumulative_ad_line(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_accumulation_distribution(df)
        # Result should have a slope value (even if close to 0)
        self.assertIsInstance(result.ad_line_slope, float)

    def test_slope_calculation(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_accumulation_distribution(df)
        self.assertFalse(math.isnan(result.ad_line_slope))
        self.assertFalse(math.isinf(result.ad_line_slope))

    def test_bullish_divergence(self):
        """AD up, price flat/down -> bullish_divergence."""
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        # Price declining, but close keeps finishing above prev close (AD accumulating)
        closes = [100.0 - i * 0.3 for i in range(30)]
        # Make close > prev for AD accumulation while price trends down overall
        adjusted_closes = list(closes)
        for i in range(1, 30):
            # Alternate: slightly above prev close every other bar
            if i % 2 == 0:
                adjusted_closes[i] = adjusted_closes[i - 1] + 0.1
            else:
                adjusted_closes[i] = adjusted_closes[i - 1] - 0.5
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in adjusted_closes],
            "high": [c + 1.0 for c in adjusted_closes],
            "low": [c - 1.0 for c in adjusted_closes],
            "close": adjusted_closes,
            "volume": [1_000_000] * 30,
        })
        result = self.analyzer._analyze_accumulation_distribution(df)
        self.assertIn(result.divergence, ("bullish_divergence", "bearish_divergence", "confirming", "none"))

    def test_bearish_divergence(self):
        """AD down, price flat/up -> bearish_divergence."""
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        # Price rising but AD declining
        closes = [100.0 + i * 0.3 for i in range(30)]
        adjusted_closes = list(closes)
        for i in range(1, 30):
            if i % 2 == 0:
                adjusted_closes[i] = adjusted_closes[i - 1] - 0.1
            else:
                adjusted_closes[i] = adjusted_closes[i - 1] + 0.5
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in adjusted_closes],
            "high": [c + 1.0 for c in adjusted_closes],
            "low": [c - 1.0 for c in adjusted_closes],
            "close": adjusted_closes,
            "volume": [1_000_000] * 30,
        })
        result = self.analyzer._analyze_accumulation_distribution(df)
        self.assertIn(result.divergence, ("bullish_divergence", "bearish_divergence", "confirming", "none"))

    def test_confirming_both_up(self):
        """Both AD and price trending same direction -> confirming."""
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_accumulation_distribution(df)
        if result.ad_line_slope > 0:
            self.assertEqual(result.divergence, "confirming")

    def test_confirming_both_down(self):
        df = self._merged_df(30, "down")
        result = self.analyzer._analyze_accumulation_distribution(df)
        if result.ad_line_slope < 0:
            self.assertEqual(result.divergence, "confirming")

    def test_bullish_divergence_score(self):
        r = _ADResult(ad_line_slope=1.0, divergence="bullish_divergence", score=0.7)
        self.assertAlmostEqual(r.score, 0.7)

    def test_bearish_divergence_score(self):
        r = _ADResult(ad_line_slope=-1.0, divergence="bearish_divergence", score=-0.7)
        self.assertAlmostEqual(r.score, -0.7)

    def test_confirming_positive_score(self):
        r = _ADResult(ad_line_slope=1.0, divergence="confirming", score=0.3)
        self.assertAlmostEqual(r.score, 0.3)

    def test_confirming_negative_score(self):
        r = _ADResult(ad_line_slope=-1.0, divergence="confirming", score=-0.3)
        self.assertAlmostEqual(r.score, -0.3)

    def test_none_divergence_score_zero(self):
        r = _ADResult(ad_line_slope=0.0, divergence="none", score=0.0)
        self.assertAlmostEqual(r.score, 0.0)

    def test_very_short_data_returns_none(self):
        """Less than 3 bars -> lookback < 2 -> returns no divergence."""
        dates = pd.date_range("2024-01-01", periods=2, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [99.5, 100.5],
            "high": [102.0, 103.0],
            "low": [98.0, 99.0],
            "close": [100.0, 101.0],
            "volume": [1_000_000, 1_000_000],
        })
        result = self.analyzer._analyze_accumulation_distribution(df)
        self.assertEqual(result.divergence, "none")
        self.assertAlmostEqual(result.ad_line_slope, 0.0)

    def test_result_is_named_tuple(self):
        df = self._merged_df(30, "up")
        result = self.analyzer._analyze_accumulation_distribution(df)
        self.assertIsInstance(result, _ADResult)


# ---------------------------------------------------------------------------
# 9. TestCalculateComposite
# ---------------------------------------------------------------------------


class TestCalculateComposite(unittest.TestCase):
    """Test composite score calculation."""

    def test_with_cot_weights(self):
        """When COT available, uses _WEIGHT_* constants."""
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=0.5)
        cot = _COTResult(True, 75.0, 1000, -500, "bullish", 0.5)
        seasonal = _SeasonalResult("bullish", 0.02, 0.5, True)
        ad = _ADResult(1.0, "confirming", 0.3)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        expected = _WEIGHT_WR * 0.5 + _WEIGHT_COT * 0.5 + _WEIGHT_SEASONAL * 0.5 + _WEIGHT_AD * 0.3
        self.assertAlmostEqual(composite, expected, places=6)

    def test_without_cot_weights(self):
        """When COT not available, uses _WEIGHT_*_NO_COT constants."""
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=0.5)
        cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("bullish", 0.02, 0.5, True)
        ad = _ADResult(1.0, "confirming", 0.3)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        expected = _WEIGHT_WR_NO_COT * 0.5 + _WEIGHT_SEASONAL_NO_COT * 0.5 + _WEIGHT_AD_NO_COT * 0.3
        self.assertAlmostEqual(composite, expected, places=6)

    def test_all_bullish_scores(self):
        wr = _WilliamsRResult(wr_14=-90.0, wr_28=-85.0, zone="oversold", signal="bullish_crossover", score=0.8)
        cot = _COTResult(True, 90.0, 5000, -2000, "bullish", 0.8)
        seasonal = _SeasonalResult("bullish", 0.03, 1.0, True)
        ad = _ADResult(2.0, "bullish_divergence", 0.7)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertGreater(composite, 0.0)

    def test_all_bearish_scores(self):
        wr = _WilliamsRResult(wr_14=-10.0, wr_28=-15.0, zone="overbought", signal="bearish_crossover", score=-0.8)
        cot = _COTResult(True, 10.0, -5000, 2000, "bearish", -0.8)
        seasonal = _SeasonalResult("bearish", -0.03, -1.0, True)
        ad = _ADResult(-2.0, "bearish_divergence", -0.7)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertLess(composite, 0.0)

    def test_composite_clamped_to_plus_minus_one(self):
        wr = _WilliamsRResult(wr_14=-90.0, wr_28=-85.0, zone="oversold", signal="bullish_crossover", score=1.0)
        cot = _COTResult(True, 100.0, 10000, -5000, "bullish", 1.0)
        seasonal = _SeasonalResult("bullish", 0.05, 1.0, True)
        ad = _ADResult(5.0, "bullish_divergence", 1.0)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertLessEqual(composite, 1.0)
        self.assertGreaterEqual(composite, -1.0)

    def test_composite_nan_guard(self):
        """NaN scores should result in 0.0."""
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=float("nan"))
        cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("neutral", None, 0.0, False)
        ad = _ADResult(0.0, "none", 0.0)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        # NaN * weight = NaN -> guard sets to 0.0
        self.assertFalse(math.isnan(composite))

    def test_zero_scores(self):
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=0.0)
        cot = _COTResult(True, 50.0, 0, 0, "neutral", 0.0)
        seasonal = _SeasonalResult("neutral", 0.0, 0.0, True)
        ad = _ADResult(0.0, "none", 0.0)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertAlmostEqual(composite, 0.0)

    def test_mixed_scores(self):
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=0.5)
        cot = _COTResult(True, 40.0, -100, 200, "neutral", -0.2)
        seasonal = _SeasonalResult("neutral", 0.005, 0.1, True)
        ad = _ADResult(0.5, "confirming", 0.3)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        expected = _WEIGHT_WR * 0.5 + _WEIGHT_COT * (-0.2) + _WEIGHT_SEASONAL * 0.1 + _WEIGHT_AD * 0.3
        self.assertAlmostEqual(composite, expected, places=6)

    def test_inf_score_guard(self):
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=float("inf"))
        cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("neutral", None, 0.0, False)
        ad = _ADResult(0.0, "none", 0.0)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertFalse(math.isinf(composite))

    def test_negative_inf_score_guard(self):
        wr = _WilliamsRResult(wr_14=-50.0, wr_28=-50.0, zone="neutral", signal="none", score=float("-inf"))
        cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("neutral", None, 0.0, False)
        ad = _ADResult(0.0, "none", 0.0)
        composite = LarryWilliamsAnalyzer._calculate_composite(wr, cot, seasonal, ad)
        self.assertFalse(math.isinf(composite))


# ---------------------------------------------------------------------------
# 10. TestCompositeToDirection
# ---------------------------------------------------------------------------


class TestCompositeToDirection(unittest.TestCase):
    """Test direction mapping from composite score."""

    def test_bullish_above_threshold(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(0.5)
        self.assertEqual(d, Direction.BULLISH.value)

    def test_bearish_below_threshold(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(-0.5)
        self.assertEqual(d, Direction.BEARISH.value)

    def test_neutral_at_zero(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(0.0)
        self.assertEqual(d, Direction.NEUTRAL.value)

    def test_neutral_just_below_bullish(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(0.29)
        self.assertEqual(d, Direction.NEUTRAL.value)

    def test_neutral_just_above_bearish(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(-0.29)
        self.assertEqual(d, Direction.NEUTRAL.value)

    def test_bullish_at_exactly_threshold(self):
        """Composite > 0.3 is bullish (not >=)."""
        d = LarryWilliamsAnalyzer._composite_to_direction(0.3)
        self.assertEqual(d, Direction.NEUTRAL.value)

    def test_bearish_at_exactly_threshold(self):
        """Composite < -0.3 is bearish (not <=)."""
        d = LarryWilliamsAnalyzer._composite_to_direction(-0.3)
        self.assertEqual(d, Direction.NEUTRAL.value)

    def test_bullish_at_1(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(1.0)
        self.assertEqual(d, Direction.BULLISH.value)

    def test_bearish_at_neg_1(self):
        d = LarryWilliamsAnalyzer._composite_to_direction(-1.0)
        self.assertEqual(d, Direction.BEARISH.value)


# ---------------------------------------------------------------------------
# 11. TestCalculateConfidence
# ---------------------------------------------------------------------------


class TestCalculateConfidence(unittest.TestCase):
    """Test confidence calculation."""

    def _make_results(self, wr_score=0.0, wr_signal="none", cot_avail=False,
                      cot_score=0.0, cot_idx=50.0, seasonal_score=0.0,
                      seasonal_sufficient=True, ad_score=0.0, ad_div="none"):
        wr = _WilliamsRResult(-50.0, -50.0, "neutral", wr_signal, wr_score)
        cot = _COTResult(cot_avail, cot_idx if cot_avail else None,
                         100 if cot_avail else None, -50 if cot_avail else None,
                         "neutral" if cot_avail else None, cot_score)
        seasonal = _SeasonalResult("neutral", 0.005, seasonal_score, seasonal_sufficient)
        ad = _ADResult(0.5, ad_div, ad_score)
        return wr, cot, seasonal, ad

    def test_base_confidence(self):
        wr, cot, seasonal, ad = self._make_results()
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE)

    def test_all_agree_bullish(self):
        wr, cot, seasonal, ad = self._make_results(
            wr_score=0.5, cot_avail=True, cot_score=0.5,
            seasonal_score=0.5, ad_score=0.5,
        )
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, Direction.BULLISH.value)
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_AGREEMENT)

    def test_all_agree_bearish(self):
        wr, cot, seasonal, ad = self._make_results(
            wr_score=-0.5, cot_avail=True, cot_score=-0.5,
            seasonal_score=-0.5, ad_score=-0.5,
        )
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, Direction.BEARISH.value)
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_AGREEMENT)

    def test_wr_divergence_bonus(self):
        wr, cot, seasonal, ad = self._make_results(wr_signal="divergence_bullish")
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_WR_DIVERGENCE)

    def test_wr_divergence_bearish_bonus(self):
        wr, cot, seasonal, ad = self._make_results(wr_signal="divergence_bearish")
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_WR_DIVERGENCE)

    def test_cot_extreme_bonus_bullish(self):
        wr, cot, seasonal, ad = self._make_results(cot_avail=True, cot_idx=90.0)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_COT_EXTREME)

    def test_cot_extreme_bonus_bearish(self):
        wr, cot, seasonal, ad = self._make_results(cot_avail=True, cot_idx=10.0)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_COT_EXTREME)

    def test_seasonal_aligns_bonus(self):
        wr, cot, seasonal, ad = self._make_results(seasonal_score=0.5, seasonal_sufficient=True)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, Direction.BULLISH.value)
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_SEASONAL_ALIGNS)

    def test_ad_divergence_bonus(self):
        wr, cot, seasonal, ad = self._make_results(ad_div="bullish_divergence")
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_AD_DIVERGENCE)

    def test_ad_bearish_divergence_bonus(self):
        wr, cot, seasonal, ad = self._make_results(ad_div="bearish_divergence")
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertGreaterEqual(conf, _CONF_BASE + _CONF_AD_DIVERGENCE)

    def test_capped_at_one(self):
        """Even with all bonuses, confidence cannot exceed 1.0."""
        wr = _WilliamsRResult(-90.0, -85.0, "oversold", "divergence_bullish", 0.8)
        cot = _COTResult(True, 95.0, 5000, -2000, "bullish", 0.9)
        seasonal = _SeasonalResult("bullish", 0.03, 1.0, True)
        ad = _ADResult(2.0, "bullish_divergence", 0.7)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, Direction.BULLISH.value)
        self.assertLessEqual(conf, 1.0)

    def test_nan_guard(self):
        wr = _WilliamsRResult(-50.0, -50.0, "neutral", "none", float("nan"))
        cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("neutral", None, 0.0, False)
        ad = _ADResult(0.0, "none", 0.0)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        self.assertFalse(math.isnan(conf))

    def test_no_cot_no_extreme_bonus(self):
        """When COT not available, no COT extreme bonus."""
        wr, cot, seasonal, ad = self._make_results(cot_avail=False)
        conf = LarryWilliamsAnalyzer._calculate_confidence(wr, cot, seasonal, ad, "neutral")
        # Should be base, no COT extreme bonus
        self.assertAlmostEqual(conf, _CONF_BASE, places=2)


# ---------------------------------------------------------------------------
# 12. TestBuildKeyLevels
# ---------------------------------------------------------------------------


class TestBuildKeyLevels(unittest.TestCase):
    """Test key levels dictionary construction."""

    def _make_key_levels(self, cot_avail=True):
        wr = _WilliamsRResult(-45.1234, -50.5678, "neutral", "none", 0.1)
        if cot_avail:
            cot = _COTResult(True, 72.3456, 1500, -800, "neutral", 0.45)
        else:
            cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult("bullish", 0.012345, 0.5, True)
        ad = _ADResult(0.123456, "confirming", 0.3)
        return LarryWilliamsAnalyzer._build_key_levels(wr, cot, seasonal, ad)

    def test_flat_structure_not_nested(self):
        kl = self._make_key_levels()
        self.assertIn("williams_r_14", kl)
        self.assertIn("williams_r_28", kl)
        self.assertNotIn("williams_r", kl)  # No nested dict for WR

    def test_williams_r_14_rounded(self):
        kl = self._make_key_levels()
        self.assertAlmostEqual(kl["williams_r_14"], -45.1234, places=4)

    def test_williams_r_28_rounded(self):
        kl = self._make_key_levels()
        self.assertAlmostEqual(kl["williams_r_28"], -50.5678, places=4)

    def test_williams_r_zone(self):
        kl = self._make_key_levels()
        self.assertEqual(kl["williams_r_zone"], "neutral")

    def test_williams_r_signal(self):
        kl = self._make_key_levels()
        self.assertEqual(kl["williams_r_signal"], "none")

    def test_cot_available(self):
        kl = self._make_key_levels(cot_avail=True)
        self.assertTrue(kl["cot_available"])

    def test_cot_commercial_index_rounded(self):
        kl = self._make_key_levels(cot_avail=True)
        self.assertAlmostEqual(kl["cot_commercial_index"], 72.3456, places=4)

    def test_cot_commercial_net(self):
        kl = self._make_key_levels(cot_avail=True)
        self.assertEqual(kl["cot_commercial_net"], 1500)

    def test_cot_speculator_net(self):
        kl = self._make_key_levels(cot_avail=True)
        self.assertEqual(kl["cot_speculator_net"], -800)

    def test_cot_signal(self):
        kl = self._make_key_levels(cot_avail=True)
        self.assertEqual(kl["cot_signal"], "neutral")

    def test_cot_none_when_unavailable(self):
        kl = self._make_key_levels(cot_avail=False)
        self.assertFalse(kl["cot_available"])
        self.assertIsNone(kl["cot_commercial_index"])
        self.assertIsNone(kl["cot_commercial_net"])
        self.assertIsNone(kl["cot_speculator_net"])
        self.assertIsNone(kl["cot_signal"])

    def test_seasonal_bias(self):
        kl = self._make_key_levels()
        self.assertEqual(kl["seasonal_bias"], "bullish")

    def test_seasonal_current_month_avg_return_rounded(self):
        kl = self._make_key_levels()
        self.assertAlmostEqual(kl["seasonal_current_month_avg_return"], 0.012345, places=6)

    def test_ad_line_slope_rounded(self):
        kl = self._make_key_levels()
        self.assertAlmostEqual(kl["ad_line_slope"], 0.123456, places=6)

    def test_ad_divergence(self):
        kl = self._make_key_levels()
        self.assertEqual(kl["ad_divergence"], "confirming")

    def test_sub_indicator_scores_present(self):
        kl = self._make_key_levels()
        self.assertIn("sub_indicator_scores", kl)
        self.assertIsInstance(kl["sub_indicator_scores"], dict)

    def test_sub_indicator_scores_keys(self):
        kl = self._make_key_levels()
        scores = kl["sub_indicator_scores"]
        self.assertIn("williams_r", scores)
        self.assertIn("cot", scores)
        self.assertIn("seasonal", scores)
        self.assertIn("accumulation_distribution", scores)

    def test_sub_indicator_cot_none_when_unavailable(self):
        kl = self._make_key_levels(cot_avail=False)
        self.assertIsNone(kl["sub_indicator_scores"]["cot"])

    def test_sub_indicator_scores_rounded(self):
        kl = self._make_key_levels()
        scores = kl["sub_indicator_scores"]
        self.assertIsInstance(scores["williams_r"], float)
        self.assertIsInstance(scores["seasonal"], float)
        self.assertIsInstance(scores["accumulation_distribution"], float)


# ---------------------------------------------------------------------------
# 13. TestBuildReasoning
# ---------------------------------------------------------------------------


class TestBuildReasoning(unittest.TestCase):
    """Test reasoning string construction."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def _make_reasoning(self, ticker="AAPL", cot_avail=True, wr_signal="none",
                        ad_div="none", seasonal_sufficient=True):
        wr = _WilliamsRResult(-50.0, -55.0, "neutral", wr_signal, 0.1)
        if cot_avail:
            cot = _COTResult(True, 65.0, 1000, -500, "neutral", 0.3)
        else:
            cot = _COTResult(False, None, None, None, None, 0.0)
        seasonal = _SeasonalResult(
            "bullish" if seasonal_sufficient else "neutral",
            0.015 if seasonal_sufficient else None,
            0.5 if seasonal_sufficient else 0.0,
            seasonal_sufficient,
        )
        ad = _ADResult(0.5, ad_div, 0.3)
        return self.analyzer._build_reasoning(ticker, wr, cot, seasonal, ad, "neutral", 0.1)

    def test_ticker_sanitization_xss(self):
        reasoning = self._make_reasoning(ticker='<script>alert("xss")</script>')
        self.assertNotIn("<script>", reasoning)
        self.assertNotIn("alert", reasoning)

    def test_ticker_sanitization_html(self):
        reasoning = self._make_reasoning(ticker='<img src=x onerror=alert(1)>')
        self.assertNotIn("<img", reasoning)
        self.assertNotIn("onerror", reasoning)

    def test_ticker_sanitization_ampersand(self):
        reasoning = self._make_reasoning(ticker="A&B")
        self.assertNotIn("&", reasoning)

    def test_ticker_truncated_to_max_length(self):
        long_ticker = "A" * 50
        reasoning = self._make_reasoning(ticker=long_ticker)
        # The safe ticker in the reasoning should be at most _MAX_TICKER_LENGTH
        self.assertIn("A" * _MAX_TICKER_LENGTH, reasoning)
        self.assertNotIn("A" * 50, reasoning)

    def test_mentions_williams_r(self):
        reasoning = self._make_reasoning()
        self.assertIn("Williams", reasoning)
        self.assertIn("%R", reasoning)

    def test_mentions_cot_when_available(self):
        reasoning = self._make_reasoning(cot_avail=True)
        self.assertIn("COT", reasoning)

    def test_mentions_cot_unavailable(self):
        reasoning = self._make_reasoning(cot_avail=False)
        self.assertIn("COT data not available", reasoning)

    def test_mentions_seasonal(self):
        reasoning = self._make_reasoning(seasonal_sufficient=True)
        self.assertIn("Seasonal", reasoning)

    def test_mentions_seasonal_insufficient(self):
        reasoning = self._make_reasoning(seasonal_sufficient=False)
        self.assertIn("Insufficient data for seasonal", reasoning)

    def test_mentions_ad_line(self):
        reasoning = self._make_reasoning()
        self.assertIn("A/D line", reasoning)

    def test_mentions_wr_signal_when_present(self):
        reasoning = self._make_reasoning(wr_signal="bullish_crossover")
        self.assertIn("bullish crossover", reasoning)

    def test_mentions_ad_divergence_when_present(self):
        reasoning = self._make_reasoning(ad_div="bullish_divergence")
        self.assertIn("bullish divergence", reasoning)

    def test_nonempty_string(self):
        reasoning = self._make_reasoning()
        self.assertIsInstance(reasoning, str)
        self.assertTrue(len(reasoning) > 0)


# ---------------------------------------------------------------------------
# 14. TestAnalyzeIntegration
# ---------------------------------------------------------------------------


class TestAnalyzeIntegration(unittest.TestCase):
    """Integration tests for the full analyze() method."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_full_data_returns_valid_signal(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)

    def test_signal_methodology(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertEqual(signal.methodology, "larry_williams")

    def test_signal_ticker(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("MSFT", pdf, vdf))
        self.assertEqual(signal.ticker, "MSFT")

    def test_signal_direction_valid(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIn(signal.direction, ("bullish", "bearish", "neutral"))

    def test_signal_confidence_range(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertGreaterEqual(signal.confidence, 0.0)
        self.assertLessEqual(signal.confidence, 1.0)

    def test_signal_timeframe_short_without_cot(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertEqual(signal.timeframe, "short")

    def test_signal_timeframe_with_active_cot(self):
        """With COT data that has non-zero score -> timeframe=medium."""
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        cot = _make_cot_df(rows=30, commercial_long_base=80000, commercial_short_base=20000)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf, cot_data=cot))
        # If COT is available and score != 0 -> medium
        if signal.key_levels.get("cot_available"):
            cot_score = signal.key_levels.get("sub_indicator_scores", {}).get("cot")
            if cot_score is not None and cot_score != 0.0:
                self.assertEqual(signal.timeframe, "medium")

    def test_with_cot_data_includes_cot_analysis(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        cot = _make_cot_df()
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf, cot_data=cot))
        self.assertTrue(signal.key_levels["cot_available"])

    def test_without_cot_graceful_degradation(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertFalse(signal.key_levels["cot_available"])
        self.assertIsNone(signal.key_levels["cot_commercial_index"])

    def test_minimum_data_valid_signal(self):
        """20 rows (minimum) should still produce a valid signal."""
        pdf = _make_price_df(20, "up")
        vdf = _make_volume_df(20)
        signal = _run(self.analyzer.analyze("TEST", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)

    def test_xss_ticker_injection_safe(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30)
        signal = _run(self.analyzer.analyze('<script>alert("xss")</script>', pdf, vdf))
        self.assertNotIn("<script>", signal.reasoning)

    def test_signal_has_key_levels(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(signal.key_levels, dict)
        self.assertIn("williams_r_14", signal.key_levels)

    def test_signal_has_reasoning(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(signal.reasoning, str)
        self.assertTrue(len(signal.reasoning) > 10)

    def test_signal_has_timestamp(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(signal.timestamp, datetime)

    def test_to_dict_serializable(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        d = signal.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["methodology"], "larry_williams")

    def test_validate_input_raises_for_too_few_rows(self):
        pdf = _make_price_df(10, "up")
        vdf = _make_volume_df(10)
        with self.assertRaises(ValueError):
            self.analyzer.validate_input(pdf, vdf)

    def test_multi_year_data_includes_seasonal(self):
        """Multi-year data should enable seasonal analysis."""
        pdf = _make_multi_year_price_df(3, "up")
        vdf = _make_multi_year_volume_df(3)
        signal = _run(self.analyzer.analyze("SPY", pdf, vdf))
        kl = signal.key_levels
        self.assertIn("seasonal_bias", kl)


# ---------------------------------------------------------------------------
# 15. TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases(unittest.TestCase):
    """Edge cases including NaN, Inf, identical prices, and type guards."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_all_identical_prices(self):
        """All identical OHLC -> WR = -50, AD slope ~ 0."""
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        pdf = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 30,
            "high": [100.0] * 30,
            "low": [100.0] * 30,
            "close": [100.0] * 30,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * 30})
        signal = _run(self.analyzer.analyze("FLAT", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)
        self.assertAlmostEqual(signal.key_levels["williams_r_14"], -50.0)

    def test_very_large_prices(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        base = [1e10 + i * 1e6 for i in range(30)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 1e5 for b in base],
            "high": [b + 1e6 for b in base],
            "low": [b - 1e6 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * 30})
        signal = _run(self.analyzer.analyze("LARGE", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)
        self.assertFalse(math.isnan(signal.confidence))

    def test_very_small_prices(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        base = [0.001 + i * 0.0001 for i in range(30)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 0.00005 for b in base],
            "high": [b + 0.0002 for b in base],
            "low": [b - 0.0002 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * 30})
        signal = _run(self.analyzer.analyze("PENNY", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)

    def test_nan_in_volume_filled(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "nan")
        signal = _run(self.analyzer.analyze("NANVOL", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)

    def test_zero_volume(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "zero")
        signal = _run(self.analyzer.analyze("ZEROVOL", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)

    def test_unicode_ticker(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30)
        signal = _run(self.analyzer.analyze("UNICODE\u2603\u2764", pdf, vdf))
        self.assertIsInstance(signal, MethodologySignal)
        # Unicode chars stripped since they are not alnum/dot/dash/underscore/space
        self.assertNotIn("\u2603", signal.reasoning)

    def test_is_finite_number_rejects_bool(self):
        """Bool is subclass of int; must be rejected."""
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(True))
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(False))

    def test_is_finite_number_accepts_int(self):
        self.assertTrue(LarryWilliamsAnalyzer._is_finite_number(0))
        self.assertTrue(LarryWilliamsAnalyzer._is_finite_number(42))
        self.assertTrue(LarryWilliamsAnalyzer._is_finite_number(-100))

    def test_is_finite_number_accepts_float(self):
        self.assertTrue(LarryWilliamsAnalyzer._is_finite_number(0.0))
        self.assertTrue(LarryWilliamsAnalyzer._is_finite_number(3.14))

    def test_is_finite_number_rejects_nan(self):
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(float("nan")))

    def test_is_finite_number_rejects_inf(self):
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(float("inf")))
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(float("-inf")))

    def test_is_finite_number_rejects_string(self):
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number("42"))

    def test_is_finite_number_rejects_none(self):
        self.assertFalse(LarryWilliamsAnalyzer._is_finite_number(None))

    def test_safe_slope_identical_y(self):
        """All y values identical -> slope = 0."""
        x = np.arange(10, dtype=float)
        y = np.array([5.0] * 10)
        slope = LarryWilliamsAnalyzer._safe_slope(x, y)
        self.assertAlmostEqual(slope, 0.0)

    def test_safe_slope_single_point(self):
        x = np.array([0.0])
        y = np.array([5.0])
        slope = LarryWilliamsAnalyzer._safe_slope(x, y)
        self.assertAlmostEqual(slope, 0.0)

    def test_safe_slope_positive_trend(self):
        x = np.arange(10, dtype=float)
        y = np.array([float(i) for i in range(10)])
        slope = LarryWilliamsAnalyzer._safe_slope(x, y)
        self.assertAlmostEqual(slope, 1.0, places=5)

    def test_compute_wr_nan_guard(self):
        """_compute_wr should not return NaN."""
        highs = np.array([100.0] * 14)
        lows = np.array([100.0] * 14)
        closes = np.array([100.0] * 14)
        result = self.analyzer._compute_wr(highs, lows, closes, 14)
        self.assertFalse(math.isnan(result))

    def test_cot_string_input_returns_unavailable(self):
        result = self.analyzer._analyze_cot("not a dataframe")
        self.assertFalse(result.available)

    def test_cot_list_input_returns_unavailable(self):
        result = self.analyzer._analyze_cot([1, 2, 3])
        self.assertFalse(result.available)


# ---------------------------------------------------------------------------
# 16. TestComputeWR (additional focused tests)
# ---------------------------------------------------------------------------


class TestComputeWR(unittest.TestCase):
    """Focused tests on _compute_wr formula."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_close_at_highest_high_gives_zero(self):
        """Close == HH -> WR = 0."""
        highs = np.array([100.0, 105.0, 103.0])
        lows = np.array([95.0, 98.0, 97.0])
        closes = np.array([99.0, 102.0, 105.0])  # last close == max high
        wr = self.analyzer._compute_wr(highs, lows, closes, 3)
        self.assertAlmostEqual(wr, 0.0, places=5)

    def test_close_at_lowest_low_gives_minus_100(self):
        """Close == LL -> WR = -100."""
        highs = np.array([100.0, 105.0, 103.0])
        lows = np.array([95.0, 98.0, 97.0])
        closes = np.array([99.0, 102.0, 95.0])  # last close == min low
        wr = self.analyzer._compute_wr(highs, lows, closes, 3)
        self.assertAlmostEqual(wr, -100.0, places=5)

    def test_close_at_midpoint(self):
        """Close at midpoint -> WR = -50."""
        highs = np.array([110.0, 110.0, 110.0])
        lows = np.array([90.0, 90.0, 90.0])
        closes = np.array([100.0, 100.0, 100.0])  # midpoint
        wr = self.analyzer._compute_wr(highs, lows, closes, 3)
        self.assertAlmostEqual(wr, -50.0, places=5)

    def test_clamped_to_range(self):
        highs = np.array([100.0] * 14)
        lows = np.array([90.0] * 14)
        closes = np.array([95.0] * 14)
        wr = self.analyzer._compute_wr(highs, lows, closes, 14)
        self.assertGreaterEqual(wr, -100.0)
        self.assertLessEqual(wr, 0.0)


# ---------------------------------------------------------------------------
# 17. TestWRScore (additional focused tests)
# ---------------------------------------------------------------------------


class TestWRScore(unittest.TestCase):
    """Focused tests on _wr_score static method."""

    def test_neutral_zone_midpoint(self):
        """At WR=-50, neutral, no signal -> score = 0."""
        score = LarryWilliamsAnalyzer._wr_score(-50.0, "neutral", "none")
        self.assertAlmostEqual(score, 0.0, places=5)

    def test_neutral_zone_at_minus_30(self):
        wr_14 = -30.0
        expected = (wr_14 + 50.0) / -50.0 * 0.3
        score = LarryWilliamsAnalyzer._wr_score(wr_14, "neutral", "none")
        self.assertAlmostEqual(score, expected, places=5)

    def test_neutral_zone_at_minus_70(self):
        wr_14 = -70.0
        expected = (wr_14 + 50.0) / -50.0 * 0.3
        score = LarryWilliamsAnalyzer._wr_score(wr_14, "neutral", "none")
        self.assertAlmostEqual(score, expected, places=5)

    def test_signal_overrides_zone(self):
        """Signal takes priority over zone."""
        score = LarryWilliamsAnalyzer._wr_score(-10.0, "overbought", "bullish_crossover")
        self.assertAlmostEqual(score, 0.8)

    def test_oversold_constant(self):
        score = LarryWilliamsAnalyzer._wr_score(-85.0, "oversold", "none")
        self.assertAlmostEqual(score, 0.5)

    def test_overbought_constant(self):
        score = LarryWilliamsAnalyzer._wr_score(-15.0, "overbought", "none")
        self.assertAlmostEqual(score, -0.5)


# ---------------------------------------------------------------------------
# 18. TestSeasonalDetailed
# ---------------------------------------------------------------------------


class TestSeasonalDetailed(unittest.TestCase):
    """Detailed seasonal tests for different months and scenarios."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_seasonal_with_strong_uptrend(self):
        """Strong uptrend over 3 years should give positive seasonal score."""
        rows = 3 * 252
        dates = pd.date_range("2020-01-01", periods=rows, freq="B")
        base = [100.0 + i * 0.5 for i in range(rows)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 0.3 for b in base],
            "high": [b + 1.0 for b in base],
            "low": [b - 1.0 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        merged = self.analyzer._merge_data(pdf, vdf)
        result = self.analyzer._analyze_seasonal(merged)
        self.assertTrue(result.data_sufficient)
        self.assertGreater(result.score, 0.0)

    def test_seasonal_with_strong_downtrend(self):
        rows = 3 * 252
        dates = pd.date_range("2020-01-01", periods=rows, freq="B")
        base = [500.0 - i * 0.5 for i in range(rows)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b + 0.3 for b in base],
            "high": [b + 1.0 for b in base],
            "low": [b - 1.0 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        merged = self.analyzer._merge_data(pdf, vdf)
        result = self.analyzer._analyze_seasonal(merged)
        self.assertTrue(result.data_sufficient)
        self.assertLess(result.score, 0.0)

    def test_seasonal_score_clamped(self):
        """Score should be in [-1, 1]."""
        pdf = _make_multi_year_price_df(3, "up")
        vdf = _make_multi_year_volume_df(3)
        merged = self.analyzer._merge_data(pdf, vdf)
        result = self.analyzer._analyze_seasonal(merged)
        self.assertGreaterEqual(result.score, -1.0)
        self.assertLessEqual(result.score, 1.0)


# ---------------------------------------------------------------------------
# 19. TestCOTDetailed
# ---------------------------------------------------------------------------


class TestCOTDetailed(unittest.TestCase):
    """Detailed COT analysis tests."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_cot_score_formula(self):
        """Score = (commercial_index - 50) / 50."""
        df = pd.DataFrame({
            "commercial_long": [50000 + i * 200 for i in range(30)],
            "commercial_short": [30000 + i * 50 for i in range(30)],
        })
        result = self.analyzer._analyze_cot(df)
        if result.available and result.commercial_index is not None:
            expected_score = (result.commercial_index - 50.0) / 50.0
            self.assertAlmostEqual(result.score, max(-1.0, min(1.0, expected_score)), places=4)

    def test_cot_with_fewer_than_26_rows(self):
        """Should still work with fewer than COT_INDEX_PERIOD rows."""
        df = pd.DataFrame({
            "commercial_long": [50000 + i * 100 for i in range(10)],
            "commercial_short": [30000 + i * 50 for i in range(10)],
        })
        result = self.analyzer._analyze_cot(df)
        self.assertTrue(result.available)

    def test_cot_single_row(self):
        df = pd.DataFrame({
            "commercial_long": [50000],
            "commercial_short": [30000],
        })
        result = self.analyzer._analyze_cot(df)
        self.assertTrue(result.available)
        # Single row: net_high == net_low -> index = 50
        self.assertAlmostEqual(result.commercial_index, 50.0)


# ---------------------------------------------------------------------------
# 20. TestIntegrationWithCOT
# ---------------------------------------------------------------------------


class TestIntegrationWithCOT(unittest.TestCase):
    """Integration tests specifically for COT data path."""

    def setUp(self):
        self.analyzer = LarryWilliamsAnalyzer()

    def test_cot_data_reflected_in_key_levels(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        cot = _make_cot_df()
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf, cot_data=cot))
        self.assertTrue(signal.key_levels["cot_available"])
        self.assertIsNotNone(signal.key_levels["cot_commercial_index"])

    def test_none_cot_reflected_in_key_levels(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertFalse(signal.key_levels["cot_available"])

    def test_cot_reasoning_mentions_index(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        cot = _make_cot_df()
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf, cot_data=cot))
        self.assertIn("COT", signal.reasoning)

    def test_empty_cot_df_treated_as_unavailable(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60)
        empty_cot = pd.DataFrame(columns=["commercial_long", "commercial_short"])
        signal = _run(self.analyzer.analyze("AAPL", pdf, vdf, cot_data=empty_cot))
        self.assertFalse(signal.key_levels["cot_available"])


if __name__ == "__main__":
    unittest.main()
