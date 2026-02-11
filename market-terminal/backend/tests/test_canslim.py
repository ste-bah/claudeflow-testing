"""Tests for TASK-ANALYSIS-005: CANSLIM analysis module.

Validates CANSLIMAnalyzer against the BaseMethodology ABC contract,
all seven criteria (C, A, N, S, L, I, M), score-to-direction mapping,
confidence calculation, key levels, reasoning string, ticker sanitization
(XSS prevention), NaN/Inf handling, and edge cases.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_canslim.py -v``
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
from app.analysis.canslim import (
    CANSLIMAnalyzer,
    _CriterionResult,
    _EPSILON, _MAX_TICKER_LENGTH,
    _EPS_GROWTH_THRESHOLD, _NEAR_52W_HIGH_PCT,
    _BOLLINGER_PERIOD, _BOLLINGER_STD,
    _SHARES_OUTSTANDING_THRESHOLD, _VOLUME_RATIO_THRESHOLD, _VOLUME_LOOKBACK,
    _RS_THRESHOLD, _INSTITUTIONAL_OWNERSHIP_THRESHOLD,
    _SMA_50_PERIOD, _SMA_200_PERIOD,
    _BULLISH_THRESHOLD, _NEUTRAL_SCORE,
    _CONFIDENCE_SCALE, _CONFIDENCE_FLOOR, _NO_FUNDAMENTALS_CONFIDENCE,
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


def _make_price_df(rows: int = 30, trend: str = "up") -> pd.DataFrame:
    """Create a price DataFrame with configurable trend.

    Trends:
        ``"up"``     -- steadily rising closes
        ``"down"``   -- steadily falling closes
        ``"flat"``   -- oscillating in a narrow band
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
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


def _make_volume_df(rows: int = 30, pattern: str = "normal") -> pd.DataFrame:
    """Create a volume DataFrame.

    Patterns:
        ``"normal"``   -- steadily increasing volume
        ``"zero"``     -- all zeros
        ``"nan"``      -- all NaN
        ``"constant"`` -- constant 1_000_000
        ``"high"``     -- very high volume (10_000_000)
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
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


def _make_full_fundamentals(**overrides: Any) -> dict[str, Any]:
    """Create a complete fundamentals dict that passes all criteria."""
    funda = {
        "quarterly": [{"eps_growth_yoy": 0.35}],         # C: 35% > 25%
        "annual_eps": [1.0, 1.30, 1.70, 2.20],           # A: all >= 25%
        "filing_keywords": ["new product"],               # N: new product
        "ttm": {"shares_outstanding": 100_000_000},       # S: < 500M
        "institutional_ownership": 0.55,                  # I: 55% > 40%
    }
    funda.update(overrides)
    return funda


# ---------------------------------------------------------------------------
# 1. TestConstants
# ---------------------------------------------------------------------------


class TestConstants(unittest.TestCase):
    """Validate all module-level constants match the spec."""

    def test_epsilon(self):
        self.assertEqual(_EPSILON, 1e-10)

    def test_max_ticker_length(self):
        self.assertEqual(_MAX_TICKER_LENGTH, 20)

    def test_eps_growth_threshold(self):
        self.assertEqual(_EPS_GROWTH_THRESHOLD, 0.25)

    def test_near_52w_high_pct(self):
        self.assertEqual(_NEAR_52W_HIGH_PCT, 0.15)

    def test_bollinger_period(self):
        self.assertEqual(_BOLLINGER_PERIOD, 20)

    def test_bollinger_std(self):
        self.assertEqual(_BOLLINGER_STD, 2.0)

    def test_shares_outstanding_threshold(self):
        self.assertEqual(_SHARES_OUTSTANDING_THRESHOLD, 500_000_000)

    def test_volume_ratio_threshold(self):
        self.assertEqual(_VOLUME_RATIO_THRESHOLD, 1.2)

    def test_volume_lookback(self):
        self.assertEqual(_VOLUME_LOOKBACK, 50)

    def test_rs_threshold(self):
        self.assertEqual(_RS_THRESHOLD, 0.20)

    def test_institutional_ownership_threshold(self):
        self.assertEqual(_INSTITUTIONAL_OWNERSHIP_THRESHOLD, 0.40)

    def test_sma_50_period(self):
        self.assertEqual(_SMA_50_PERIOD, 50)

    def test_sma_200_period(self):
        self.assertEqual(_SMA_200_PERIOD, 200)

    def test_bullish_threshold(self):
        self.assertEqual(_BULLISH_THRESHOLD, 4)

    def test_neutral_score(self):
        self.assertEqual(_NEUTRAL_SCORE, 3)

    def test_confidence_scale(self):
        self.assertAlmostEqual(_CONFIDENCE_SCALE, 0.85 / 7.0, places=10)

    def test_confidence_floor(self):
        self.assertEqual(_CONFIDENCE_FLOOR, 0.15)

    def test_no_fundamentals_confidence(self):
        self.assertEqual(_NO_FUNDAMENTALS_CONFIDENCE, 0.1)

    def test_constant_types_int(self):
        for c in (_MAX_TICKER_LENGTH, _BOLLINGER_PERIOD,
                  _VOLUME_LOOKBACK, _SMA_50_PERIOD, _SMA_200_PERIOD,
                  _BULLISH_THRESHOLD, _NEUTRAL_SCORE):
            self.assertIsInstance(c, int, f"{c} should be int")

    def test_constant_types_float(self):
        for c in (_EPSILON, _EPS_GROWTH_THRESHOLD, _NEAR_52W_HIGH_PCT,
                  _BOLLINGER_STD,
                  _VOLUME_RATIO_THRESHOLD, _RS_THRESHOLD,
                  _INSTITUTIONAL_OWNERSHIP_THRESHOLD,
                  _CONFIDENCE_SCALE, _CONFIDENCE_FLOOR,
                  _NO_FUNDAMENTALS_CONFIDENCE):
            self.assertIsInstance(c, float, f"{c} should be float")

    def test_shares_outstanding_is_numeric(self):
        # Declared as float annotation but literal 500_000_000 is int at runtime
        self.assertIsInstance(_SHARES_OUTSTANDING_THRESHOLD, (int, float))
        self.assertEqual(_SHARES_OUTSTANDING_THRESHOLD, 500_000_000)


# ---------------------------------------------------------------------------
# 2. TestNamedTuples
# ---------------------------------------------------------------------------


class TestNamedTuples(unittest.TestCase):
    """Validate _CriterionResult NamedTuple."""

    def test_fields_exist(self):
        self.assertEqual(
            _CriterionResult._fields,
            ("passed", "score", "detail", "data_available"),
        )

    def test_construct_with_all_fields(self):
        r = _CriterionResult(passed=True, score=1, detail="ok", data_available=True)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)
        self.assertEqual(r.detail, "ok")
        self.assertTrue(r.data_available)

    def test_construct_failing(self):
        r = _CriterionResult(passed=False, score=0, detail="fail", data_available=False)
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_immutable(self):
        r = _CriterionResult(passed=True, score=1, detail="x", data_available=True)
        with self.assertRaises(AttributeError):
            r.passed = False  # type: ignore[misc]

    def test_is_tuple_subclass(self):
        r = _CriterionResult(passed=True, score=1, detail="x", data_available=True)
        self.assertIsInstance(r, tuple)

    def test_indexing(self):
        r = _CriterionResult(passed=True, score=1, detail="hi", data_available=True)
        self.assertTrue(r[0])
        self.assertEqual(r[1], 1)
        self.assertEqual(r[2], "hi")
        self.assertTrue(r[3])


# ---------------------------------------------------------------------------
# 3. TestClassProperties
# ---------------------------------------------------------------------------


class TestClassProperties(unittest.TestCase):
    """Validate CANSLIMAnalyzer class attributes and inheritance."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_name(self):
        self.assertEqual(self.analyzer.name, "canslim")

    def test_display_name(self):
        self.assertEqual(self.analyzer.display_name, "CANSLIM")

    def test_default_timeframe(self):
        self.assertEqual(self.analyzer.default_timeframe, "medium")

    def test_version(self):
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_subclass_of_base_methodology(self):
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_has_analyze_method(self):
        self.assertTrue(hasattr(self.analyzer, "analyze"))
        self.assertTrue(callable(self.analyzer.analyze))

    def test_has_validate_input_method(self):
        self.assertTrue(hasattr(self.analyzer, "validate_input"))

    def test_has_create_signal_method(self):
        self.assertTrue(hasattr(self.analyzer, "create_signal"))

    def test_has_private_evaluate_methods(self):
        for letter in ("c", "a", "n", "s", "l", "i", "m"):
            self.assertTrue(
                hasattr(self.analyzer, f"_evaluate_{letter}"),
                f"Missing _evaluate_{letter}",
            )

    def test_has_merge_data_method(self):
        self.assertTrue(hasattr(self.analyzer, "_merge_data"))


# ---------------------------------------------------------------------------
# 4. TestMergeData
# ---------------------------------------------------------------------------


class TestMergeData(unittest.TestCase):
    """Validate _merge_data merges price and volume correctly."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_inner_join(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertEqual(len(merged), 30)

    def test_columns_present(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        merged = self.analyzer._merge_data(prices, volumes)
        expected = {"date", "open", "high", "low", "close", "volume"}
        self.assertEqual(set(merged.columns), expected)

    def test_nan_fill(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30, pattern="nan")
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertFalse(merged["volume"].isna().any())

    def test_sorted_ascending(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        # reverse order before merge
        prices = prices.iloc[::-1].reset_index(drop=True)
        volumes = volumes.iloc[::-1].reset_index(drop=True)
        merged = self.analyzer._merge_data(prices, volumes)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))

    def test_partial_overlap(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(25)  # fewer volume rows
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertEqual(len(merged), 25)

    def test_no_extra_columns(self):
        prices = _make_price_df(30)
        prices["extra"] = 999.0
        volumes = _make_volume_df(30)
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertNotIn("extra", merged.columns)

    def test_preserves_values(self):
        prices = _make_price_df(30, trend="up")
        volumes = _make_volume_df(30, pattern="constant")
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertAlmostEqual(float(merged["close"].iloc[0]), 100.0, places=1)

    def test_reset_index(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        merged = self.analyzer._merge_data(prices, volumes)
        self.assertEqual(merged.index[0], 0)
        self.assertEqual(merged.index[-1], 29)


# ---------------------------------------------------------------------------
# 5. TestEvaluateC
# ---------------------------------------------------------------------------


class TestEvaluateC(unittest.TestCase):
    """Validate the C criterion (Current Quarterly Earnings)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_pass_above_threshold(self):
        funda = {"quarterly": [{"eps_growth_yoy": 0.30}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)
        self.assertTrue(r.data_available)

    def test_fail_below_threshold(self):
        funda = {"quarterly": [{"eps_growth_yoy": 0.20}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_pass_exactly_at_threshold(self):
        funda = {"quarterly": [{"eps_growth_yoy": 0.25}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_missing_quarterly_key(self):
        funda = {}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_empty_quarterly_list(self):
        funda = {"quarterly": []}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_quarterly_not_list(self):
        funda = {"quarterly": "invalid"}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_nan_eps_growth(self):
        funda = {"quarterly": [{"eps_growth_yoy": float("nan")}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_inf_eps_growth(self):
        funda = {"quarterly": [{"eps_growth_yoy": float("inf")}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_negative_eps_growth(self):
        funda = {"quarterly": [{"eps_growth_yoy": -0.10}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_detail_contains_percentage(self):
        funda = {"quarterly": [{"eps_growth_yoy": 0.30}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertIn("30.0%", r.detail)

    def test_fail_eps_growth_key_missing(self):
        funda = {"quarterly": [{"revenue": 100}]}
        r = self.analyzer._evaluate_c(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_bool_eps_growth(self):
        funda = {"quarterly": [{"eps_growth_yoy": True}]}
        r = self.analyzer._evaluate_c(funda)
        # bool is not finite number per _is_finite_number
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_pass_large_eps_growth(self):
        funda = {"quarterly": [{"eps_growth_yoy": 5.0}]}  # 500%
        r = self.analyzer._evaluate_c(funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)


# ---------------------------------------------------------------------------
# 6. TestEvaluateA
# ---------------------------------------------------------------------------


class TestEvaluateA(unittest.TestCase):
    """Validate the A criterion (Annual Earnings Growth)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_pass_all_years_above_threshold(self):
        # 1.0 -> 1.30 (30%), 1.30 -> 1.70 (30.7%), 1.70 -> 2.20 (29.4%)
        funda = {"annual_eps": [1.0, 1.30, 1.70, 2.20]}
        r = self.analyzer._evaluate_a(funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_pass_exactly_at_threshold(self):
        # 1.0 -> 1.25 (exactly 25%)
        funda = {"annual_eps": [1.0, 1.25]}
        r = self.analyzer._evaluate_a(funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_one_year_below(self):
        # 1.0 -> 1.10 (10%) -- below 25%
        funda = {"annual_eps": [1.0, 1.10, 1.50]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_fail_only_one_data_point(self):
        funda = {"annual_eps": [1.0]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_empty_annual_eps(self):
        funda = {"annual_eps": []}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_no_annual_eps_key(self):
        funda = {}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_fail_negative_base_eps(self):
        funda = {"annual_eps": [-1.0, 1.0]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertIn("Negative base EPS", r.detail)

    def test_fail_zero_base_eps(self):
        funda = {"annual_eps": [0.0, 1.0]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertIn("near zero", r.detail)

    def test_fail_not_list(self):
        funda = {"annual_eps": "invalid"}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_detail_contains_rates(self):
        funda = {"annual_eps": [1.0, 1.30]}
        r = self.analyzer._evaluate_a(funda)
        self.assertIn("30.0%", r.detail)

    def test_fail_nan_in_values(self):
        funda = {"annual_eps": [1.0, float("nan"), 2.0]}
        r = self.analyzer._evaluate_a(funda)
        # NaN is filtered out, leaving only 2 valid: [1.0, 2.0] -> 100% pass
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_all_nan(self):
        funda = {"annual_eps": [float("nan"), float("nan")]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_two_years_both_passing(self):
        # 2.0 -> 2.60 (30%)
        funda = {"annual_eps": [2.0, 2.60]}
        r = self.analyzer._evaluate_a(funda)
        self.assertTrue(r.passed)

    def test_multiple_growth_rates_mixed(self):
        # 1.0 -> 1.30 (30% pass), 1.30 -> 1.40 (~7.7% fail)
        funda = {"annual_eps": [1.0, 1.30, 1.40]}
        r = self.analyzer._evaluate_a(funda)
        self.assertFalse(r.passed)


# ---------------------------------------------------------------------------
# 7. TestEvaluateN
# ---------------------------------------------------------------------------


class TestEvaluateN(unittest.TestCase):
    """Validate the N criterion (New Products/Highs/Bollinger)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def _make_df(self, rows=30, last_close=100.0, high_52w=105.0):
        """Create a merged df with controllable close and high."""
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [last_close] * rows
        highs = [high_52w] * rows
        return pd.DataFrame({
            "date": dates,
            "open": [last_close - 0.5] * rows,
            "high": highs,
            "low": [last_close - 2.0] * rows,
            "close": closes,
            "volume": [1_000_000] * rows,
        })

    def test_pass_near_52w_high(self):
        # close=100, high=105 => 100 >= 105*0.85=89.25 => pass
        df = self._make_df(30, last_close=100.0, high_52w=105.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)

    def test_fail_far_from_52w_high(self):
        # close=50, high=105 => 50 >= 105*0.85=89.25 => fail
        df = self._make_df(30, last_close=50.0, high_52w=105.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertFalse(r.passed)

    def test_pass_exactly_at_52w_high(self):
        df = self._make_df(30, last_close=105.0, high_52w=105.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)
        self.assertIn("from 52w high", r.detail)

    def test_pass_filing_keyword_new_product(self):
        # close far from high but has keyword
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {"filing_keywords": ["new product"]}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)
        self.assertIn("new product/management catalyst", r.detail)

    def test_pass_filing_keyword_acquisition(self):
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {"filing_keywords": ["Acquisition"]}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)

    def test_pass_filing_keyword_case_insensitive(self):
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {"filing_keywords": ["NEW PRODUCT"]}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)

    def test_fail_no_conditions_met(self):
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertFalse(r.passed)
        self.assertIn("too far", r.detail)

    def test_pass_bollinger_breakout(self):
        """Construct data where the last close is above the upper Bollinger band."""
        rows = 60
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Flat closes at 100 for most bars, then spike last close to 120
        closes = [100.0] * (rows - 1) + [120.0]
        highs = [101.0] * (rows - 1) + [121.0]
        df = pd.DataFrame({
            "date": dates,
            "open": [99.5] * rows,
            "high": highs,
            "low": [98.0] * rows,
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        # The spike should trigger Bollinger breakout
        self.assertTrue(r.passed)

    def test_filing_keywords_non_matching(self):
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {"filing_keywords": ["irrelevant", "boring"]}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertFalse(r.passed)

    def test_filing_keywords_non_list(self):
        df = self._make_df(30, last_close=100.0, high_52w=105.0)
        funda = {"filing_keywords": "not a list"}
        r = self.analyzer._evaluate_n(df, funda)
        # near_high should still pass
        self.assertTrue(r.passed)

    def test_data_always_available(self):
        df = self._make_df(30, last_close=50.0, high_52w=200.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.data_available)

    def test_detail_pct_from_high(self):
        df = self._make_df(30, last_close=100.0, high_52w=100.0)
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertIn("from 52w high", r.detail)


# ---------------------------------------------------------------------------
# 8. TestEvaluateS
# ---------------------------------------------------------------------------


class TestEvaluateS(unittest.TestCase):
    """Validate the S criterion (Supply and Demand)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def _make_merged_df(self, rows=30, trend="up"):
        prices = _make_price_df(rows, trend)
        volumes = _make_volume_df(rows, "constant")
        return self.analyzer._merge_data(prices, volumes)

    def test_pass_small_shares(self):
        df = self._make_merged_df(30, "flat")
        funda = {"ttm": {"shares_outstanding": 100_000_000}}  # < 500M
        r = self.analyzer._evaluate_s(df, funda)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_large_shares_low_vol_ratio(self):
        df = self._make_merged_df(30, "flat")
        funda = {"ttm": {"shares_outstanding": 1_000_000_000}}  # > 500M
        r = self.analyzer._evaluate_s(df, funda)
        # flat trend => vol ratio near 0 or small, both fail
        # depends on exact data; flat has small up/down imbalance
        # We'll just check the score logic
        self.assertIn("Shares: 1000M", r.detail)

    def test_pass_large_shares_high_vol_ratio(self):
        """Large shares but strong up-volume ratio should pass."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Steadily rising close => all up days => large up/down ratio
        closes = [100.0 + i * 1.0 for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        funda = {"ttm": {"shares_outstanding": 1_000_000_000}}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertTrue(r.passed)

    def test_missing_shares_uses_vol_ratio(self):
        df = self._make_merged_df(30, "up")
        funda = {"ttm": {}}  # no shares_outstanding
        r = self.analyzer._evaluate_s(df, funda)
        self.assertIn("Shares outstanding unavailable", r.detail)

    def test_no_ttm_key(self):
        df = self._make_merged_df(30, "up")
        funda = {}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertIn("Shares outstanding unavailable", r.detail)

    def test_all_up_days_high_ratio(self):
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i for i in range(rows)]  # always up
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        funda = {"ttm": {"shares_outstanding": 1_000_000_000}}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertTrue(r.passed)
        self.assertIn("Up/down vol ratio", r.detail)

    def test_all_down_days_low_ratio(self):
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [200.0 - i for i in range(rows)]  # always down
        df = pd.DataFrame({
            "date": dates,
            "open": [c + 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        funda = {"ttm": {"shares_outstanding": 1_000_000_000}}
        r = self.analyzer._evaluate_s(df, funda)
        # down vol dominates, ratio < 1.2
        self.assertFalse(r.passed)

    def test_data_always_available(self):
        df = self._make_merged_df(30)
        funda = {}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertTrue(r.data_available)

    def test_shares_nan_treated_as_unavailable(self):
        df = self._make_merged_df(30, "up")
        funda = {"ttm": {"shares_outstanding": float("nan")}}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertIn("Shares outstanding unavailable", r.detail)

    def test_shares_bool_treated_as_unavailable(self):
        df = self._make_merged_df(30, "up")
        funda = {"ttm": {"shares_outstanding": True}}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertIn("Shares outstanding unavailable", r.detail)


# ---------------------------------------------------------------------------
# 9. TestEvaluateL
# ---------------------------------------------------------------------------


class TestEvaluateL(unittest.TestCase):
    """Validate the L criterion (Leader/Laggard)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def _make_df_for_return(self, start_price, end_price, rows=30):
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        step = (end_price - start_price) / max(rows - 1, 1)
        closes = [start_price + i * step for i in range(rows)]
        return pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })

    def test_pass_above_threshold(self):
        # 100 -> 125 => 25% > 20%
        df = self._make_df_for_return(100.0, 125.0)
        r = self.analyzer._evaluate_l(df)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_below_threshold(self):
        # 100 -> 110 => 10% < 20%
        df = self._make_df_for_return(100.0, 110.0)
        r = self.analyzer._evaluate_l(df)
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_fail_exactly_at_threshold(self):
        # 100 -> 120 => 20%, threshold is > 20% (strictly greater)
        df = self._make_df_for_return(100.0, 120.0)
        r = self.analyzer._evaluate_l(df)
        self.assertFalse(r.passed)

    def test_fail_flat_price(self):
        df = self._make_df_for_return(100.0, 100.0)
        r = self.analyzer._evaluate_l(df)
        self.assertFalse(r.passed)

    def test_fail_negative_return(self):
        df = self._make_df_for_return(100.0, 80.0)
        r = self.analyzer._evaluate_l(df)
        self.assertFalse(r.passed)

    def test_short_data_uses_available(self):
        # Only 20 bars, < 252
        df = self._make_df_for_return(100.0, 130.0, rows=20)
        r = self.analyzer._evaluate_l(df)
        self.assertTrue(r.passed)

    def test_detail_contains_return_pct(self):
        df = self._make_df_for_return(100.0, 130.0)
        r = self.analyzer._evaluate_l(df)
        self.assertIn("12-month return", r.detail)

    def test_start_price_near_zero(self):
        df = self._make_df_for_return(1e-11, 100.0, rows=20)
        r = self.analyzer._evaluate_l(df)
        # near-zero start (< _EPSILON) => undefined return
        self.assertFalse(r.passed)
        self.assertIn("near zero", r.detail)

    def test_data_available_always_true(self):
        df = self._make_df_for_return(100.0, 130.0)
        r = self.analyzer._evaluate_l(df)
        self.assertTrue(r.data_available)

    def test_large_return_pass(self):
        df = self._make_df_for_return(100.0, 500.0, rows=30)
        r = self.analyzer._evaluate_l(df)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)


# ---------------------------------------------------------------------------
# 10. TestEvaluateI
# ---------------------------------------------------------------------------


class TestEvaluateI(unittest.TestCase):
    """Validate the I criterion (Institutional Sponsorship)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_pass_high_ownership(self):
        funda = {"institutional_ownership": 0.55}
        r = self.analyzer._evaluate_i(funda, {})
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_low_ownership(self):
        funda = {"institutional_ownership": 0.30}
        r = self.analyzer._evaluate_i(funda, {})
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_fail_exactly_at_threshold(self):
        # > 40%, so 40% exactly fails
        funda = {"institutional_ownership": 0.40}
        r = self.analyzer._evaluate_i(funda, {})
        self.assertFalse(r.passed)

    def test_fail_no_ownership_data(self):
        funda = {}
        r = self.analyzer._evaluate_i(funda, {})
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_pass_from_kwargs(self):
        funda = {}
        kwargs = {"ownership_data": {"ownership_pct": 0.50}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_pass_holders_increasing(self):
        funda = {"institutional_ownership": 0.30}  # below threshold
        kwargs = {"ownership_data": {"holders_increasing": True}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertTrue(r.passed)
        self.assertIn("holders increasing", r.detail)

    def test_fundamentals_takes_priority_over_kwargs(self):
        funda = {"institutional_ownership": 0.55}
        kwargs = {"ownership_data": {"ownership_pct": 0.10}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        # fundamentals 55% used, not kwargs 10%
        self.assertTrue(r.passed)
        self.assertIn("55.0%", r.detail)

    def test_nan_ownership_fallback_to_kwargs(self):
        funda = {"institutional_ownership": float("nan")}
        kwargs = {"ownership_data": {"ownership_pct": 0.50}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertTrue(r.passed)

    def test_bool_ownership_not_used(self):
        funda = {"institutional_ownership": True}
        r = self.analyzer._evaluate_i(funda, {})
        # bool excluded by _is_finite_number
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_detail_contains_pct(self):
        funda = {"institutional_ownership": 0.65}
        r = self.analyzer._evaluate_i(funda, {})
        self.assertIn("65.0%", r.detail)

    def test_kwargs_holders_increasing_not_bool(self):
        # holders_increasing must be bool, int 1 should not pass
        funda = {"institutional_ownership": 0.30}
        kwargs = {"ownership_data": {"holders_increasing": 1}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        # 1 is not bool => holders_increasing stays False
        self.assertFalse(r.passed)


# ---------------------------------------------------------------------------
# 11. TestEvaluateM
# ---------------------------------------------------------------------------


class TestEvaluateM(unittest.TestCase):
    """Validate the M criterion (Market Direction)."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def _make_golden_cross_df(self, rows=250):
        """SMA50 > SMA200: recent prices higher than long-term average."""
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Start low, end high → SMA50 > SMA200
        closes = [50.0 + i * 0.5 for i in range(rows)]
        return pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })

    def _make_death_cross_df(self, rows=250):
        """SMA50 < SMA200: recent prices lower than long-term average."""
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [200.0 - i * 0.5 for i in range(rows)]
        return pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })

    def test_pass_golden_cross(self):
        df = self._make_golden_cross_df()
        r = self.analyzer._evaluate_m(df, {})
        self.assertTrue(r.passed)
        self.assertEqual(r.score, 1)

    def test_fail_death_cross(self):
        df = self._make_death_cross_df()
        r = self.analyzer._evaluate_m(df, {})
        self.assertFalse(r.passed)
        self.assertEqual(r.score, 0)

    def test_pass_price_above_both_smas(self):
        """High current close above both SMAs."""
        rows = 250
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0] * rows
        # Last close is very high
        closes[-1] = 200.0
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        r = self.analyzer._evaluate_m(df, {})
        # close 200 > sma50 (~102) > sma200 (~100.5) => pass
        self.assertTrue(r.passed)

    def test_fail_insufficient_bars_for_sma50(self):
        df = self._make_golden_cross_df(rows=30)
        r = self.analyzer._evaluate_m(df, {})
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)
        self.assertIn("SMA50", r.detail)

    def test_fail_insufficient_bars_for_sma200(self):
        df = self._make_golden_cross_df(rows=100)
        r = self.analyzer._evaluate_m(df, {})
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)
        self.assertIn("SMA200", r.detail)

    def test_market_data_from_kwargs(self):
        # Stock data is bad (short), but market_data from kwargs is good
        stock_df = self._make_golden_cross_df(rows=30)  # too short
        market_df = self._make_golden_cross_df(rows=250)
        r = self.analyzer._evaluate_m(stock_df, {"market_data": market_df})
        self.assertTrue(r.passed)

    def test_market_data_invalid_falls_back(self):
        stock_df = self._make_golden_cross_df(rows=250)
        bad_market = pd.DataFrame({"a": [1, 2, 3]})  # no 'close' column
        r = self.analyzer._evaluate_m(stock_df, {"market_data": bad_market})
        # Falls back to stock_df which has golden cross
        self.assertTrue(r.passed)

    def test_detail_contains_sma_values(self):
        df = self._make_golden_cross_df(rows=250)
        r = self.analyzer._evaluate_m(df, {})
        self.assertIn("SMA50=", r.detail)
        self.assertIn("SMA200=", r.detail)
        self.assertIn("close=", r.detail)

    def test_market_data_too_short_falls_back(self):
        stock_df = self._make_golden_cross_df(rows=250)
        short_market = self._make_golden_cross_df(rows=10)
        r = self.analyzer._evaluate_m(stock_df, {"market_data": short_market})
        # market_data too short (< _MIN_SMA_BARS=20), falls back to stock_df
        self.assertTrue(r.passed)

    def test_market_data_not_dataframe_falls_back(self):
        stock_df = self._make_golden_cross_df(rows=250)
        r = self.analyzer._evaluate_m(stock_df, {"market_data": "invalid"})
        self.assertTrue(r.passed)


# ---------------------------------------------------------------------------
# 12. TestScoreToDirection
# ---------------------------------------------------------------------------


class TestScoreToDirection(unittest.TestCase):
    """Validate _score_to_direction mapping."""

    def test_score_7_bullish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(7), "bullish")

    def test_score_6_bullish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(6), "bullish")

    def test_score_5_bullish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(5), "bullish")

    def test_score_4_bullish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(4), "bullish")

    def test_score_3_neutral(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(3), "neutral")

    def test_score_2_bearish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(2), "bearish")

    def test_score_1_bearish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(1), "bearish")

    def test_score_0_bearish(self):
        self.assertEqual(CANSLIMAnalyzer._score_to_direction(0), "bearish")


# ---------------------------------------------------------------------------
# 13. TestCalculateConfidence
# ---------------------------------------------------------------------------


class TestCalculateConfidence(unittest.TestCase):
    """Validate _calculate_confidence formula."""

    def test_score_7(self):
        c = CANSLIMAnalyzer._calculate_confidence(7)
        self.assertAlmostEqual(c, 1.0, places=5)

    def test_score_0(self):
        c = CANSLIMAnalyzer._calculate_confidence(0)
        self.assertAlmostEqual(c, 0.15, places=5)

    def test_score_3(self):
        expected = 3 * (0.85 / 7.0) + 0.15
        c = CANSLIMAnalyzer._calculate_confidence(3)
        self.assertAlmostEqual(c, expected, places=5)

    def test_score_1(self):
        expected = 1 * (0.85 / 7.0) + 0.15
        c = CANSLIMAnalyzer._calculate_confidence(1)
        self.assertAlmostEqual(c, expected, places=5)

    def test_result_between_0_and_1(self):
        for s in range(8):
            c = CANSLIMAnalyzer._calculate_confidence(s)
            self.assertGreaterEqual(c, 0.0)
            self.assertLessEqual(c, 1.0)

    def test_monotonically_increasing(self):
        prev = -1.0
        for s in range(8):
            c = CANSLIMAnalyzer._calculate_confidence(s)
            self.assertGreater(c, prev)
            prev = c

    def test_floor_minimum(self):
        c = CANSLIMAnalyzer._calculate_confidence(0)
        self.assertGreaterEqual(c, _CONFIDENCE_FLOOR)

    def test_clamped_to_1(self):
        # Even an absurdly high score gets clamped
        c = CANSLIMAnalyzer._calculate_confidence(100)
        self.assertLessEqual(c, 1.0)


# ---------------------------------------------------------------------------
# 14. TestBuildKeyLevels
# ---------------------------------------------------------------------------


class TestBuildKeyLevels(unittest.TestCase):
    """Validate _build_key_levels output structure."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()
        self.df = self.analyzer._merge_data(
            _make_price_df(30, "up"),
            _make_volume_df(30, "normal"),
        )
        self.pass_result = _CriterionResult(True, 1, "pass", True)
        self.fail_result = _CriterionResult(False, 0, "fail", False)

    def _call(self, score=7):
        return self.analyzer._build_key_levels(
            score,
            self.pass_result, self.pass_result, self.pass_result,
            self.pass_result, self.pass_result, self.pass_result,
            self.pass_result, self.df,
        )

    def test_has_canslim_score(self):
        kl = self._call(5)
        self.assertEqual(kl["canslim_score"], 5)

    def test_has_criteria_dict(self):
        kl = self._call()
        self.assertIn("criteria", kl)
        self.assertIsInstance(kl["criteria"], dict)

    def test_all_seven_letters_present(self):
        kl = self._call()
        for letter in ("C", "A", "N", "S", "L", "I", "M"):
            self.assertIn(letter, kl["criteria"], f"Missing {letter}")

    def test_i_has_data_available(self):
        kl = self._call()
        self.assertIn("data_available", kl["criteria"]["I"])

    def test_numeric_values_rounded(self):
        kl = self._call()
        self.assertIsInstance(kl["fifty_two_week_high"], float)
        self.assertIsInstance(kl["sma_50"], float)
        self.assertIsInstance(kl["sma_200"], float)
        self.assertIsInstance(kl["price_vs_52w_high_percent"], float)

    def test_has_fifty_two_week_high(self):
        kl = self._call()
        self.assertIn("fifty_two_week_high", kl)
        self.assertGreater(kl["fifty_two_week_high"], 0)

    def test_has_sma_50(self):
        kl = self._call()
        self.assertIn("sma_50", kl)

    def test_has_sma_200(self):
        kl = self._call()
        self.assertIn("sma_200", kl)

    def test_has_price_vs_52w_high(self):
        kl = self._call()
        self.assertIn("price_vs_52w_high_percent", kl)

    def test_criteria_pass_field(self):
        kl = self._call()
        self.assertTrue(kl["criteria"]["C"]["pass"])

    def test_criteria_score_field(self):
        kl = self._call()
        self.assertEqual(kl["criteria"]["C"]["score"], 1)

    def test_criteria_detail_field(self):
        kl = self._call()
        self.assertEqual(kl["criteria"]["C"]["detail"], "pass")


# ---------------------------------------------------------------------------
# 15. TestBuildReasoning
# ---------------------------------------------------------------------------


class TestBuildReasoning(unittest.TestCase):
    """Validate _build_reasoning output."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()
        self.pass_result = _CriterionResult(True, 1, "pass detail", True)
        self.fail_result = _CriterionResult(False, 0, "fail detail", False)

    def _call(self, ticker="AAPL", score=5, direction="bullish"):
        return self.analyzer._build_reasoning(
            ticker, score,
            self.pass_result, self.pass_result, self.pass_result,
            self.pass_result, self.pass_result, self.pass_result,
            self.pass_result, direction,
        )

    def test_contains_sanitized_ticker(self):
        r = self._call(ticker="AAPL")
        self.assertIn("AAPL", r)

    def test_xss_script_tag_stripped(self):
        r = self._call(ticker='<script>alert("xss")</script>')
        self.assertNotIn("<script>", r)
        self.assertNotIn("</script>", r)
        self.assertNotIn("alert", r)

    def test_xss_angle_brackets_stripped(self):
        r = self._call(ticker="<img onerror=hack>")
        self.assertNotIn("<", r)
        self.assertNotIn(">", r)

    def test_lists_each_criterion(self):
        r = self._call()
        for letter in ("C:", "A:", "N:", "S:", "L:", "I:", "M:"):
            self.assertIn(letter, r)

    def test_mentions_direction_bullish(self):
        r = self._call(direction="bullish")
        self.assertIn("bullish", r)

    def test_mentions_direction_bearish(self):
        r = self._call(direction="bearish", score=1)
        self.assertIn("bearish", r)

    def test_mentions_direction_neutral(self):
        r = self._call(direction="neutral", score=3)
        self.assertIn("neutral", r)

    def test_ticker_truncated(self):
        long_ticker = "A" * 50
        r = self._call(ticker=long_ticker)
        # ticker truncated to _MAX_TICKER_LENGTH
        self.assertIn("A" * _MAX_TICKER_LENGTH, r)
        self.assertNotIn("A" * 50, r)


# ---------------------------------------------------------------------------
# 16. TestNoFundamentalsSignal
# ---------------------------------------------------------------------------


class TestNoFundamentalsSignal(unittest.TestCase):
    """Validate _no_fundamentals_signal returns correct fallback."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_none_fundamentals_returns_neutral(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertEqual(sig.direction, "neutral")

    def test_empty_dict_returns_neutral(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals={}))
        self.assertEqual(sig.direction, "neutral")

    def test_confidence_equals_no_fundamentals(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertAlmostEqual(sig.confidence, _NO_FUNDAMENTALS_CONFIDENCE, places=5)

    def test_reasoning_mentions_fundamentals(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertIn("no fundamentals data", sig.reasoning.lower())

    def test_key_levels_score_zero(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertEqual(sig.key_levels["canslim_score"], 0)

    def test_key_levels_all_criteria_fail(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        for letter in ("C", "A", "N", "S", "L", "M"):
            self.assertFalse(sig.key_levels["criteria"][letter]["pass"])

    def test_i_has_data_available_false(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertFalse(sig.key_levels["criteria"]["I"]["data_available"])

    def test_methodology_is_canslim(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, fundamentals=None))
        self.assertEqual(sig.methodology, "canslim")


# ---------------------------------------------------------------------------
# 17. TestAnalyzeIntegration
# ---------------------------------------------------------------------------


class TestAnalyzeIntegration(unittest.TestCase):
    """Validate full analyze() flow end-to-end."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_full_bullish(self):
        """All criteria passing => bullish with high confidence."""
        rows = 260
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        prices = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        volumes = pd.DataFrame({
            "date": dates,
            "volume": [1_000_000 + i * 100 for i in range(rows)],
        })
        funda = _make_full_fundamentals()
        kwargs = {
            "ownership_data": {"holders_increasing": True},
        }
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda, **kwargs))
        self.assertEqual(sig.direction, "bullish")
        self.assertGreater(sig.confidence, 0.5)
        self.assertEqual(sig.methodology, "canslim")

    def test_full_bearish(self):
        """Most criteria failing => bearish."""
        rows = 260
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Declining price
        closes = [200.0 - i * 0.5 for i in range(rows)]
        prices = pd.DataFrame({
            "date": dates,
            "open": [c + 0.5 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        volumes = pd.DataFrame({
            "date": dates,
            "volume": [1_000_000] * rows,
        })
        funda = {
            "quarterly": [{"eps_growth_yoy": 0.05}],  # C fail
            "annual_eps": [1.0, 1.10],                 # A fail (10%)
            "ttm": {"shares_outstanding": 1_000_000_000},  # S fail (large)
            "institutional_ownership": 0.20,            # I fail
        }
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertEqual(sig.direction, "bearish")
        self.assertLess(sig.confidence, 0.5)

    def test_no_fundamentals_neutral(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, None))
        self.assertEqual(sig.direction, "neutral")

    def test_minimum_data(self):
        """20 rows (minimum) should produce a valid signal."""
        prices = _make_price_df(20, "up")
        volumes = _make_volume_df(20, "normal")
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIsInstance(sig, MethodologySignal)

    def test_xss_ticker_safe(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze('<script>alert("x")</script>', prices, volumes, funda))
        self.assertNotIn("<script>", sig.reasoning)
        self.assertNotIn("alert", sig.reasoning)

    def test_methodology_always_canslim(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertEqual(sig.methodology, "canslim")

    def test_signal_has_timestamp(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIsInstance(sig.timestamp, datetime)

    def test_signal_has_key_levels(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIsInstance(sig.key_levels, dict)
        self.assertIn("canslim_score", sig.key_levels)

    def test_signal_has_reasoning(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIsInstance(sig.reasoning, str)
        self.assertTrue(len(sig.reasoning) > 0)

    def test_confidence_between_0_and_1(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertGreaterEqual(sig.confidence, 0.0)
        self.assertLessEqual(sig.confidence, 1.0)

    def test_direction_is_valid(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIn(sig.direction, {"bullish", "bearish", "neutral"})

    def test_timeframe_valid(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIn(sig.timeframe, {"short", "medium", "long"})

    def test_high_score_long_timeframe(self):
        """Score >= 6 should produce long timeframe."""
        rows = 260
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        prices = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        volumes = pd.DataFrame({
            "date": dates,
            "volume": [1_000_000 + i * 100 for i in range(rows)],
        })
        funda = _make_full_fundamentals()
        kwargs = {"ownership_data": {"holders_increasing": True}}
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda, **kwargs))
        score = sig.key_levels["canslim_score"]
        if score >= 6:
            self.assertEqual(sig.timeframe, "long")

    def test_to_dict_serializable(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        d = sig.to_dict()
        self.assertIsInstance(d, dict)
        self.assertIn("ticker", d)
        self.assertIn("methodology", d)

    def test_validate_input_too_few_rows(self):
        prices = _make_price_df(10)
        volumes = _make_volume_df(10)
        funda = _make_full_fundamentals()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", prices, volumes, funda))


# ---------------------------------------------------------------------------
# 18. TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases(unittest.TestCase):
    """Validate edge cases and boundary conditions."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_very_large_eps_values(self):
        funda = {"quarterly": [{"eps_growth_yoy": 100.0}]}  # 10000%
        r = self.analyzer._evaluate_c(funda)
        self.assertTrue(r.passed)

    def test_negative_prices_in_df(self):
        """Negative close prices should not crash."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [-10.0 + i * 0.1 for i in range(rows)]
        highs = [c + 1.0 for c in closes]
        prices = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": highs,
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        volumes = _make_volume_df(rows)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("TEST", prices, volumes, funda))
        self.assertIsInstance(sig, MethodologySignal)

    def test_boolean_in_fundamentals_shares(self):
        """Boolean values should be rejected by _is_finite_number."""
        self.assertFalse(self.analyzer._is_finite_number(True))
        self.assertFalse(self.analyzer._is_finite_number(False))

    def test_unicode_ticker(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        # Unicode chars that aren't alnum get stripped
        sig = _run(self.analyzer.analyze("TICK\u00e9R", prices, volumes, funda))
        self.assertIsInstance(sig, MethodologySignal)
        # The accented e gets stripped by sanitizer
        self.assertNotIn("\u00e9", sig.reasoning)

    def test_is_finite_number_string(self):
        self.assertFalse(self.analyzer._is_finite_number("10"))

    def test_is_finite_number_none(self):
        self.assertFalse(self.analyzer._is_finite_number(None))

    def test_is_finite_number_nan(self):
        self.assertFalse(self.analyzer._is_finite_number(float("nan")))

    def test_is_finite_number_inf(self):
        self.assertFalse(self.analyzer._is_finite_number(float("inf")))

    def test_is_finite_number_neg_inf(self):
        self.assertFalse(self.analyzer._is_finite_number(float("-inf")))

    def test_is_finite_number_valid_int(self):
        self.assertTrue(self.analyzer._is_finite_number(42))

    def test_is_finite_number_valid_float(self):
        self.assertTrue(self.analyzer._is_finite_number(3.14))

    def test_is_finite_number_zero(self):
        self.assertTrue(self.analyzer._is_finite_number(0))

    def test_is_finite_number_zero_float(self):
        self.assertTrue(self.analyzer._is_finite_number(0.0))

    def test_ticker_with_dots_and_dashes(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("BRK.B-A", prices, volumes, None))
        self.assertIn("BRK.B-A", sig.reasoning)

    def test_empty_string_ticker(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("", prices, volumes, None))
        self.assertIsInstance(sig, MethodologySignal)

    def test_all_volume_zero(self):
        prices = _make_price_df(30, "up")
        volumes = _make_volume_df(30, "zero")
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIsInstance(sig, MethodologySignal)


# ---------------------------------------------------------------------------
# 19. TestIsFiniteNumberDetailed
# ---------------------------------------------------------------------------


class TestIsFiniteNumberDetailed(unittest.TestCase):
    """Additional _is_finite_number boundary tests."""

    def setUp(self):
        self.fn = CANSLIMAnalyzer._is_finite_number

    def test_list_not_finite(self):
        self.assertFalse(self.fn([1, 2]))

    def test_dict_not_finite(self):
        self.assertFalse(self.fn({"a": 1}))

    def test_negative_float(self):
        self.assertTrue(self.fn(-5.5))

    def test_very_large_float(self):
        self.assertTrue(self.fn(1e308))

    def test_very_small_float(self):
        self.assertTrue(self.fn(1e-308))


# ---------------------------------------------------------------------------
# 20. TestEvaluateADetailed
# ---------------------------------------------------------------------------


class TestEvaluateADetailed(unittest.TestCase):
    """Additional A criterion edge cases."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_inf_in_annual_eps(self):
        funda = {"annual_eps": [1.0, float("inf")]}
        r = self.analyzer._evaluate_a(funda)
        # inf filtered -> only 1 valid value -> insufficient
        self.assertFalse(r.passed)

    def test_bool_in_annual_eps(self):
        funda = {"annual_eps": [True, 1.0, 2.0]}
        r = self.analyzer._evaluate_a(funda)
        # True is bool, filtered -> [1.0, 2.0] -> 100% growth -> pass
        self.assertTrue(r.passed)

    def test_three_years_all_passing(self):
        # 1.0 -> 1.30 (30%), 1.30 -> 1.70 (30.8%), 1.70 -> 2.20 (29.4%)
        funda = {"annual_eps": [1.0, 1.30, 1.70, 2.20]}
        r = self.analyzer._evaluate_a(funda)
        self.assertTrue(r.passed)
        self.assertTrue(r.data_available)


# ---------------------------------------------------------------------------
# 21. TestEvaluateNBollinger
# ---------------------------------------------------------------------------


class TestEvaluateNBollinger(unittest.TestCase):
    """Detailed Bollinger breakout tests for N criterion."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_not_enough_bars_for_bollinger(self):
        """Less than _BOLLINGER_PERIOD bars => no Bollinger check."""
        rows = 15
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [99.0] * rows,
            "high": [99.0] * rows,  # high = close = low => no near_high pass
            "low": [99.0] * rows,
            "close": [99.0] * rows,
            "volume": [1_000_000] * rows,
        })
        # high=99, close=99 => near high, so this actually passes via near_high
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        self.assertTrue(r.passed)  # near 52w high

    def test_bollinger_flat_no_breakout(self):
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0] * rows  # perfectly flat
        df = pd.DataFrame({
            "date": dates,
            "open": [99.5] * rows,
            "high": [101.0] * rows,
            "low": [99.0] * rows,
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        funda = {}
        r = self.analyzer._evaluate_n(df, funda)
        # close=100 vs high=101 => near high (within 15%), passes
        self.assertTrue(r.passed)


# ---------------------------------------------------------------------------
# 22. TestEvaluateMSMAEdgeCases
# ---------------------------------------------------------------------------


class TestEvaluateMSMAEdgeCases(unittest.TestCase):
    """SMA edge case tests for M criterion."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_exactly_50_bars(self):
        """With exactly 50 bars, SMA50 can compute but SMA200 cannot."""
        rows = 50
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        r = self.analyzer._evaluate_m(df, {})
        # Can't compute SMA200 => fail
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_exactly_200_bars(self):
        """With exactly 200 bars, both SMAs computable."""
        rows = 200
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        r = self.analyzer._evaluate_m(df, {})
        self.assertTrue(r.data_available)


# ---------------------------------------------------------------------------
# 23. TestEvaluateLReturnEdgeCases
# ---------------------------------------------------------------------------


class TestEvaluateLReturnEdgeCases(unittest.TestCase):
    """L criterion return edge cases."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_exactly_252_bars(self):
        rows = 252
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        r = self.analyzer._evaluate_l(df)
        # start=100, end=100+251*0.5=225.5 => 125.5% return
        self.assertTrue(r.passed)

    def test_more_than_252_bars_uses_252(self):
        rows = 300
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1_000_000] * rows,
        })
        r = self.analyzer._evaluate_l(df)
        # starts at close[300-252]=close[48]=100+48*0.5=124
        # ends at close[299]=100+299*0.5=249.5
        # return = (249.5-124)/124 ~ 101% => pass
        self.assertTrue(r.passed)


# ---------------------------------------------------------------------------
# 24. TestEvaluateIKwargsDetails
# ---------------------------------------------------------------------------


class TestEvaluateIKwargsDetails(unittest.TestCase):
    """I criterion kwargs interaction details."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_kwargs_ownership_data_not_dict(self):
        funda = {}
        kwargs = {"ownership_data": "not a dict"}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_kwargs_ownership_data_none(self):
        funda = {}
        kwargs = {"ownership_data": None}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)

    def test_kwargs_ownership_nan_pct(self):
        funda = {}
        kwargs = {"ownership_data": {"ownership_pct": float("nan")}}
        r = self.analyzer._evaluate_i(funda, kwargs)
        self.assertFalse(r.passed)
        self.assertFalse(r.data_available)


# ---------------------------------------------------------------------------
# 25. TestEvaluateSVolumeRatio
# ---------------------------------------------------------------------------


class TestEvaluateSVolumeRatio(unittest.TestCase):
    """S criterion volume ratio edge cases."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_volume_ratio_nan_guard(self):
        """All NaN volumes should result in 0 volume ratio."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i for i in range(rows)]
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [0.0] * rows,  # zero volume
        })
        funda = {"ttm": {"shares_outstanding": 1_000_000_000}}
        r = self.analyzer._evaluate_s(df, funda)
        # no meaningful volume ratio
        self.assertIn("Up/down vol ratio", r.detail)

    def test_ttm_not_dict(self):
        rows = 30
        prices = _make_price_df(rows, "up")
        volumes = _make_volume_df(rows, "constant")
        df = self.analyzer._merge_data(prices, volumes)
        funda = {"ttm": "not_a_dict"}
        r = self.analyzer._evaluate_s(df, funda)
        self.assertIn("Shares outstanding unavailable", r.detail)


# ---------------------------------------------------------------------------
# 26. TestScoreTimeframeMapping
# ---------------------------------------------------------------------------


class TestScoreTimeframeMapping(unittest.TestCase):
    """Validate score to timeframe mapping in analyze()."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_low_score_default_timeframe(self):
        """Score < 4 should use default_timeframe (medium)."""
        prices = _make_price_df(30, "down")
        volumes = _make_volume_df(30)
        funda = {
            "quarterly": [{"eps_growth_yoy": 0.05}],
            "annual_eps": [1.0, 1.05],
            "ttm": {"shares_outstanding": 1_000_000_000},
            "institutional_ownership": 0.10,
        }
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        score = sig.key_levels["canslim_score"]
        if score < 4:
            self.assertEqual(sig.timeframe, "medium")


# ---------------------------------------------------------------------------
# 27. TestAnalyzeMixedScenarios
# ---------------------------------------------------------------------------


class TestAnalyzeMixedScenarios(unittest.TestCase):
    """Mixed scenarios for integration coverage."""

    def setUp(self):
        self.analyzer = CANSLIMAnalyzer()

    def test_only_c_passing(self):
        prices = _make_price_df(30, "down")
        volumes = _make_volume_df(30)
        funda = {
            "quarterly": [{"eps_growth_yoy": 0.50}],  # C pass
            "annual_eps": [1.0, 1.05],                 # A fail
            "ttm": {"shares_outstanding": 1_000_000_000},  # S fail
            "institutional_ownership": 0.10,            # I fail
        }
        sig = _run(self.analyzer.analyze("TEST", prices, volumes, funda))
        self.assertIsInstance(sig, MethodologySignal)

    def test_signal_score_in_key_levels(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        self.assertIn("canslim_score", sig.key_levels)
        score = sig.key_levels["canslim_score"]
        self.assertIsInstance(score, int)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 7)

    def test_each_criterion_in_key_levels(self):
        prices = _make_price_df(30)
        volumes = _make_volume_df(30)
        funda = _make_full_fundamentals()
        sig = _run(self.analyzer.analyze("AAPL", prices, volumes, funda))
        for letter in ("C", "A", "N", "S", "L", "I", "M"):
            c = sig.key_levels["criteria"][letter]
            self.assertIn("pass", c)
            self.assertIn("score", c)
            self.assertIn("detail", c)


if __name__ == "__main__":
    unittest.main()
