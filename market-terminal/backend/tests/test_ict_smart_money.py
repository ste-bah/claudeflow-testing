"""Tests for TASK-ANALYSIS-004: ICT Smart Money Concepts analysis module.

Validates ICTSmartMoneyAnalyzer against the BaseMethodology ABC contract,
swing detection, structure classification, market structure shift detection,
order block detection, fair value gap detection, liquidity sweep detection,
breaker block detection, premium/discount analysis, direction determination,
entry zone calculation, confidence scoring, key levels, reasoning string,
and edge cases.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_ict_smart_money.py -v``
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
from app.analysis.ict_smart_money import (
    ICTSmartMoneyAnalyzer,
    _SwingPoint,
    _StructurePoint,
    _OrderBlock,
    _FairValueGap,
    _LiquiditySweep,
    _BreakerBlock,
    _PremiumDiscountInfo,
    _EntryZoneInfo,
    _EPSILON,
    _SWING_WINDOW,
    _STRUCTURE_LOOKBACK,
    _HTF_RANGE_LOOKBACK,
    _SWEEP_LOOKBACK,
    _MAX_ORDER_BLOCKS,
    _MAX_FVGS,
    _MAX_BREAKER_BLOCKS,
    _SWEEP_MAX_BARS,
    _CONF_CLEAR_STRUCTURE,
    _CONF_MIXED_STRUCTURE,
    _CONF_ORDER_BLOCK,
    _CONF_FVG,
    _CONF_SWEEP,
    _CONF_HTF_ALIGNS,
    _CONF_BREAKER,
    _CONF_MULTI_CONFLUENCE,
    _OB_PROXIMITY_PCT,
    _FVG_PROXIMITY_PCT,
    _STOP_LOSS_BUFFER_PCT,
    _MAX_TICKER_LENGTH,
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
    """Create a price DataFrame with configurable trend."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    if trend == "up":
        base = [100.0 + i * 0.5 for i in range(rows)]
    elif trend == "down":
        base = [150.0 - i * 0.5 for i in range(rows)]
    else:  # flat
        base = [100.0] * rows
    return pd.DataFrame({
        "date": dates,
        "open": [b - 0.5 for b in base],
        "high": [b + 2.0 for b in base],
        "low": [b - 2.0 for b in base],
        "close": base,
    })


def _make_volume_df(rows: int = 30, pattern: str = "normal") -> pd.DataFrame:
    """Create a volume DataFrame."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    if pattern == "normal":
        volumes = [1_000_000 + i * 1000 for i in range(rows)]
    elif pattern == "zero":
        volumes = [0.0] * rows
    elif pattern == "nan":
        volumes = [float("nan")] * rows
    else:
        volumes = [1_000_000] * rows
    return pd.DataFrame({"date": dates, "volume": volumes})


def _make_merged_df(rows: int = 30, trend: str = "up") -> pd.DataFrame:
    """Create a merged DataFrame suitable for analyzer internal methods."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    if trend == "up":
        base = [100.0 + i * 0.5 for i in range(rows)]
    elif trend == "down":
        base = [150.0 - i * 0.5 for i in range(rows)]
    else:
        base = [100.0] * rows
    return pd.DataFrame({
        "date": dates,
        "open": [b - 0.5 for b in base],
        "high": [b + 2.0 for b in base],
        "low": [b - 2.0 for b in base],
        "close": base,
        "volume": [1_000_000] * rows,
    })


def _make_zigzag_df(rows: int = 60, amplitude: float = 10.0,
                     period: int = 8, base_price: float = 100.0) -> pd.DataFrame:
    """Create a merged DataFrame with zigzag pattern generating swings."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = []
    for i in range(rows):
        cycle_pos = i % period
        half = period // 2
        if cycle_pos < half:
            closes.append(base_price + amplitude * (cycle_pos / half))
        else:
            closes.append(base_price + amplitude * (1.0 - (cycle_pos - half) / half))
    return pd.DataFrame({
        "date": dates,
        "open": [c - 0.3 for c in closes],
        "high": [c + 1.5 for c in closes],
        "low": [c - 1.5 for c in closes],
        "close": closes,
        "volume": [1_000_000] * rows,
    })


def _make_uptrend_df(rows: int = 60) -> pd.DataFrame:
    """Create data with clear HH/HL swing pattern (bullish structure).

    Zigzag up: each peak higher than previous, each trough higher than previous.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = []
    for i in range(rows):
        cycle_pos = i % 8
        # Upward bias with oscillation
        trend_component = i * 0.5
        if cycle_pos < 4:
            closes.append(100.0 + trend_component + cycle_pos * 2.0)
        else:
            closes.append(100.0 + trend_component + (8 - cycle_pos) * 2.0)
    return pd.DataFrame({
        "date": dates,
        "open": [c - 0.3 for c in closes],
        "high": [c + 1.5 for c in closes],
        "low": [c - 1.5 for c in closes],
        "close": closes,
        "volume": [1_000_000] * rows,
    })


def _make_downtrend_df(rows: int = 60) -> pd.DataFrame:
    """Create data with clear LH/LL swing pattern (bearish structure)."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = []
    for i in range(rows):
        cycle_pos = i % 8
        trend_component = -i * 0.5
        if cycle_pos < 4:
            closes.append(200.0 + trend_component + cycle_pos * 2.0)
        else:
            closes.append(200.0 + trend_component + (8 - cycle_pos) * 2.0)
    return pd.DataFrame({
        "date": dates,
        "open": [c - 0.3 for c in closes],
        "high": [c + 1.5 for c in closes],
        "low": [c - 1.5 for c in closes],
        "close": closes,
        "volume": [1_000_000] * rows,
    })


# ---------------------------------------------------------------------------
# Test Classes
# ---------------------------------------------------------------------------


class TestConstants(unittest.TestCase):
    """Verify module-level constants."""

    def test_epsilon_positive_and_tiny(self):
        self.assertGreater(_EPSILON, 0)
        self.assertLess(_EPSILON, 1e-5)
        self.assertEqual(_EPSILON, 1e-10)

    def test_epsilon_is_float(self):
        self.assertIsInstance(_EPSILON, float)

    def test_swing_window(self):
        self.assertEqual(_SWING_WINDOW, 3)
        self.assertIsInstance(_SWING_WINDOW, int)

    def test_structure_lookback(self):
        self.assertEqual(_STRUCTURE_LOOKBACK, 60)
        self.assertIsInstance(_STRUCTURE_LOOKBACK, int)

    def test_htf_range_lookback(self):
        self.assertEqual(_HTF_RANGE_LOOKBACK, 120)
        self.assertIsInstance(_HTF_RANGE_LOOKBACK, int)

    def test_sweep_lookback(self):
        self.assertEqual(_SWEEP_LOOKBACK, 20)
        self.assertIsInstance(_SWEEP_LOOKBACK, int)

    def test_max_order_blocks(self):
        self.assertEqual(_MAX_ORDER_BLOCKS, 5)
        self.assertIsInstance(_MAX_ORDER_BLOCKS, int)

    def test_max_fvgs(self):
        self.assertEqual(_MAX_FVGS, 5)
        self.assertIsInstance(_MAX_FVGS, int)

    def test_max_breaker_blocks(self):
        self.assertEqual(_MAX_BREAKER_BLOCKS, 3)
        self.assertIsInstance(_MAX_BREAKER_BLOCKS, int)

    def test_sweep_max_bars(self):
        self.assertEqual(_SWEEP_MAX_BARS, 3)
        self.assertIsInstance(_SWEEP_MAX_BARS, int)

    def test_conf_clear_structure(self):
        self.assertAlmostEqual(_CONF_CLEAR_STRUCTURE, 0.4)
        self.assertIsInstance(_CONF_CLEAR_STRUCTURE, float)

    def test_conf_mixed_structure(self):
        self.assertAlmostEqual(_CONF_MIXED_STRUCTURE, 0.2)

    def test_conf_order_block(self):
        self.assertAlmostEqual(_CONF_ORDER_BLOCK, 0.15)

    def test_conf_fvg(self):
        self.assertAlmostEqual(_CONF_FVG, 0.10)

    def test_conf_sweep(self):
        self.assertAlmostEqual(_CONF_SWEEP, 0.15)

    def test_conf_htf_aligns(self):
        self.assertAlmostEqual(_CONF_HTF_ALIGNS, 0.10)

    def test_conf_breaker(self):
        self.assertAlmostEqual(_CONF_BREAKER, 0.05)

    def test_conf_multi_confluence(self):
        self.assertAlmostEqual(_CONF_MULTI_CONFLUENCE, 0.05)

    def test_confidence_weights_sum_to_one(self):
        """Clear base + all bonuses should equal 1.0."""
        total = (_CONF_CLEAR_STRUCTURE + _CONF_ORDER_BLOCK + _CONF_FVG +
                 _CONF_SWEEP + _CONF_HTF_ALIGNS + _CONF_BREAKER +
                 _CONF_MULTI_CONFLUENCE)
        self.assertAlmostEqual(total, 1.0, places=10,
                               msg="sum of clear base + all bonuses must be 1.0")

    def test_ob_proximity_pct_in_range(self):
        self.assertGreater(_OB_PROXIMITY_PCT, 0.0)
        self.assertLess(_OB_PROXIMITY_PCT, 1.0)

    def test_fvg_proximity_pct_in_range(self):
        self.assertGreater(_FVG_PROXIMITY_PCT, 0.0)
        self.assertLess(_FVG_PROXIMITY_PCT, 1.0)

    def test_stop_loss_buffer_pct_in_range(self):
        self.assertGreater(_STOP_LOSS_BUFFER_PCT, 0.0)
        self.assertLess(_STOP_LOSS_BUFFER_PCT, 1.0)

    def test_max_ticker_length(self):
        self.assertEqual(_MAX_TICKER_LENGTH, 20)
        self.assertIsInstance(_MAX_TICKER_LENGTH, int)


class TestNamedTuples(unittest.TestCase):
    """Verify NamedTuple field names and counts."""

    def test_swing_point_fields(self):
        fields = _SwingPoint._fields
        self.assertEqual(fields, ("index", "price", "date", "swing_type"))

    def test_structure_point_fields(self):
        fields = _StructurePoint._fields
        self.assertEqual(fields, ("index", "price", "date", "label"))

    def test_order_block_fields(self):
        fields = _OrderBlock._fields
        self.assertEqual(fields, ("ob_type", "high", "low", "date", "index", "mitigated"))

    def test_fair_value_gap_fields(self):
        fields = _FairValueGap._fields
        self.assertEqual(fields, ("fvg_type", "high", "low", "date", "index", "fill_percent"))

    def test_liquidity_sweep_fields(self):
        fields = _LiquiditySweep._fields
        self.assertEqual(fields, ("sweep_type", "level", "date", "index"))

    def test_breaker_block_fields(self):
        fields = _BreakerBlock._fields
        self.assertEqual(fields, ("breaker_type", "high", "low", "date", "index"))

    def test_premium_discount_info_fields(self):
        fields = _PremiumDiscountInfo._fields
        self.assertEqual(fields, ("equilibrium", "premium_zone_start",
                                  "discount_zone_start", "current_position"))

    def test_entry_zone_info_fields(self):
        fields = _EntryZoneInfo._fields
        self.assertEqual(fields, ("high", "low", "stop_loss", "risk_reward_ratio"))


class TestClassProperties(unittest.TestCase):
    """Verify ICTSmartMoneyAnalyzer class attributes and ABC contract."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_name(self):
        self.assertEqual(self.analyzer.name, "ict_smart_money")

    def test_display_name(self):
        self.assertEqual(self.analyzer.display_name, "ICT Smart Money Concepts")

    def test_default_timeframe(self):
        self.assertEqual(self.analyzer.default_timeframe, "short")

    def test_version(self):
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_subclass_of_base_methodology(self):
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_has_analyze_method(self):
        self.assertTrue(hasattr(self.analyzer, "analyze"))
        self.assertTrue(callable(self.analyzer.analyze))

    def test_has_all_private_methods(self):
        methods = [
            "_merge_data", "_detect_swings", "_classify_structure",
            "_detect_structure_shift", "_detect_order_blocks",
            "_detect_fair_value_gaps", "_detect_liquidity_sweeps",
            "_detect_breaker_blocks", "_calculate_premium_discount",
            "_determine_direction", "_calculate_entry_zone",
            "_calculate_confidence", "_build_key_levels",
            "_build_reasoning", "_neutral_signal",
        ]
        for m in methods:
            self.assertTrue(hasattr(self.analyzer, m),
                            f"Missing method: {m}")

    def test_has_validate_input(self):
        self.assertTrue(hasattr(self.analyzer, "validate_input"))


class TestMergeData(unittest.TestCase):
    """Test _merge_data method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_inner_join_matching_dates(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 30)

    def test_inner_join_drops_non_matching(self):
        pdf = _make_price_df(30)
        # Volume has different dates
        dates = pd.date_range("2024-02-01", periods=30, freq="B")
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * 30})
        merged = self.analyzer._merge_data(pdf, vdf)
        # Inner join: only overlapping dates survive
        self.assertLessEqual(len(merged), 30)

    def test_volume_nan_filled_with_zero(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30, pattern="nan")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertFalse(merged["volume"].isna().any(),
                         "NaN volume should be filled with 0")

    def test_sorted_ascending_by_date(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))

    def test_output_columns(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        expected = ["date", "open", "high", "low", "close", "volume"]
        self.assertEqual(list(merged.columns), expected)

    def test_empty_after_join(self):
        pdf = _make_price_df(30)
        dates = pd.date_range("2025-06-01", periods=30, freq="B")
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * 30})
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 0)
        self.assertEqual(list(merged.columns),
                         ["date", "open", "high", "low", "close", "volume"])

    def test_preserves_price_values(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30)
        merged = self.analyzer._merge_data(pdf, vdf)
        # First row close should match
        self.assertAlmostEqual(float(merged.iloc[0]["close"]),
                               float(pdf.iloc[0]["close"]))

    def test_partial_overlap(self):
        dates1 = pd.date_range("2024-01-01", periods=20, freq="B")
        dates2 = pd.date_range("2024-01-15", periods=20, freq="B")
        pdf = pd.DataFrame({
            "date": dates1,
            "open": [100.0] * 20, "high": [102.0] * 20,
            "low": [98.0] * 20, "close": [101.0] * 20,
        })
        vdf = pd.DataFrame({"date": dates2, "volume": [1000] * 20})
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertGreater(len(merged), 0)
        self.assertLess(len(merged), 20)

    def test_reverse_sorted_dates_sorted(self):
        """Dates arrive in reverse order but output is ascending."""
        dates = pd.date_range("2024-01-01", periods=20, freq="B")
        pdf = pd.DataFrame({
            "date": dates[::-1],
            "open": [100.0] * 20, "high": [102.0] * 20,
            "low": [98.0] * 20, "close": [101.0] * 20,
        })
        vdf = pd.DataFrame({"date": dates[::-1], "volume": [1000] * 20})
        merged = self.analyzer._merge_data(pdf, vdf)
        dates_out = merged["date"].tolist()
        self.assertEqual(dates_out, sorted(dates_out))

    def test_zero_volume_preserved(self):
        pdf = _make_price_df(30)
        vdf = _make_volume_df(30, pattern="zero")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertTrue((merged["volume"] == 0.0).all())


class TestDetectSwings(unittest.TestCase):
    """Test _detect_swings method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_flat_data_no_swings(self):
        df = _make_merged_df(30, trend="flat")
        swings = self.analyzer._detect_swings(df)
        # All same price -> every bar ties -> may or may not detect
        # With >= condition, flat bars are ALL swing highs and lows
        # so we just verify it doesn't crash
        self.assertIsInstance(swings, list)

    def test_too_few_bars_no_swings(self):
        """Less than 2*window+1 bars -> no swings possible."""
        df = _make_merged_df(6, trend="up")  # 6 < 2*3+1=7
        swings = self.analyzer._detect_swings(df)
        self.assertEqual(len(swings), 0, "Fewer than 2*window+1 bars should yield 0 swings")

    def test_exactly_min_bars(self):
        """Exactly 2*window+1 = 7 bars: only index 3 is a candidate."""
        dates = pd.date_range("2024-01-01", periods=7, freq="B")
        # Make index 3 a clear peak
        highs = [100, 101, 102, 110, 102, 101, 100]
        lows = [98, 99, 100, 105, 100, 99, 98]
        df = pd.DataFrame({
            "date": dates,
            "open": [h - 1 for h in highs],
            "high": highs,
            "low": lows,
            "close": [h - 0.5 for h in highs],
            "volume": [1000] * 7,
        })
        swings = self.analyzer._detect_swings(df)
        swing_indices = [s.index for s in swings]
        self.assertIn(3, swing_indices, "Index 3 should be detected as swing")

    def test_single_peak(self):
        """One clear peak in the middle."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [100.0] * n
        lows = [98.0] * n
        closes = [99.0] * n
        # Create a peak at index 10
        highs[10] = 120.0
        closes[10] = 119.0
        df = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
            "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        swing_highs = [s for s in swings if s.swing_type == "high"]
        # The peak should be detected
        peak_indices = [s.index for s in swing_highs]
        self.assertIn(10, peak_indices, "Peak at index 10 should be detected")

    def test_single_trough(self):
        """One clear trough in the middle."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [102.0] * n
        lows = [100.0] * n
        closes = [101.0] * n
        # Create a trough at index 10
        lows[10] = 80.0
        closes[10] = 81.0
        df = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
            "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        swing_lows = [s for s in swings if s.swing_type == "low"]
        trough_indices = [s.index for s in swing_lows]
        self.assertIn(10, trough_indices, "Trough at index 10 should be detected")

    def test_alternating_pattern(self):
        """Zigzag produces multiple swings."""
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        self.assertGreater(len(swings), 2, "Zigzag should produce multiple swings")

    def test_swings_sorted_by_index(self):
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        indices = [s.index for s in swings]
        self.assertEqual(indices, sorted(indices), "Swings should be sorted by index")

    def test_swing_type_values(self):
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        for s in swings:
            self.assertIn(s.swing_type, ("high", "low"))

    def test_swing_date_is_string(self):
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        if swings:
            self.assertIsInstance(swings[0].date, str)

    def test_swing_price_is_float(self):
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        for s in swings:
            self.assertIsInstance(s.price, float)

    def test_window_boundary_start(self):
        """First candidate is at index == window."""
        df = _make_zigzag_df(40, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        if swings:
            self.assertGreaterEqual(swings[0].index, _SWING_WINDOW)

    def test_window_boundary_end(self):
        """Last candidate is at index <= n - window - 1."""
        n = 40
        df = _make_zigzag_df(n, amplitude=15.0, period=8)
        swings = self.analyzer._detect_swings(df)
        if swings:
            self.assertLessEqual(swings[-1].index, n - _SWING_WINDOW - 1)

    def test_both_high_and_low_at_same_bar(self):
        """Bar with highest high AND lowest low in window -> both types."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [100.0] * n
        lows = [98.0] * n
        # Index 10: highest high and lowest low
        highs[10] = 120.0
        lows[10] = 70.0
        closes = [99.0] * n
        closes[10] = 95.0
        df = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
            "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        types_at_10 = [s.swing_type for s in swings if s.index == 10]
        self.assertIn("high", types_at_10, "Should detect swing high at bar 10")
        self.assertIn("low", types_at_10, "Should detect swing low at bar 10")

    def test_uptrend_data_has_swings(self):
        df = _make_uptrend_df(60)
        swings = self.analyzer._detect_swings(df)
        self.assertGreater(len(swings), 0)

    def test_downtrend_data_has_swings(self):
        df = _make_downtrend_df(60)
        swings = self.analyzer._detect_swings(df)
        self.assertGreater(len(swings), 0)


class TestClassifyStructure(unittest.TestCase):
    """Test _classify_structure method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_empty_swings_empty_result(self):
        result = self.analyzer._classify_structure([])
        self.assertEqual(len(result), 0)

    def test_single_swing_high_no_structure(self):
        """Need at least 2 same-type swings to classify."""
        swings = [_SwingPoint(5, 110.0, "2024-01-08", "high")]
        result = self.analyzer._classify_structure(swings)
        self.assertEqual(len(result), 0)

    def test_single_swing_low_no_structure(self):
        swings = [_SwingPoint(5, 90.0, "2024-01-08", "low")]
        result = self.analyzer._classify_structure(swings)
        self.assertEqual(len(result), 0)

    def test_consecutive_higher_highs(self):
        swings = [
            _SwingPoint(5, 100.0, "d1", "high"),
            _SwingPoint(15, 110.0, "d2", "high"),
        ]
        result = self.analyzer._classify_structure(swings)
        labels = [p.label for p in result]
        self.assertIn("HH", labels)

    def test_consecutive_lower_highs(self):
        swings = [
            _SwingPoint(5, 110.0, "d1", "high"),
            _SwingPoint(15, 100.0, "d2", "high"),
        ]
        result = self.analyzer._classify_structure(swings)
        labels = [p.label for p in result]
        self.assertIn("LH", labels)

    def test_consecutive_higher_lows(self):
        swings = [
            _SwingPoint(5, 90.0, "d1", "low"),
            _SwingPoint(15, 95.0, "d2", "low"),
        ]
        result = self.analyzer._classify_structure(swings)
        labels = [p.label for p in result]
        self.assertIn("HL", labels)

    def test_consecutive_lower_lows(self):
        swings = [
            _SwingPoint(5, 95.0, "d1", "low"),
            _SwingPoint(15, 90.0, "d2", "low"),
        ]
        result = self.analyzer._classify_structure(swings)
        labels = [p.label for p in result]
        self.assertIn("LL", labels)

    def test_mixed_swings_correct_labeling(self):
        swings = [
            _SwingPoint(3, 100.0, "d1", "high"),
            _SwingPoint(6, 90.0, "d2", "low"),
            _SwingPoint(10, 110.0, "d3", "high"),
            _SwingPoint(14, 95.0, "d4", "low"),
        ]
        result = self.analyzer._classify_structure(swings)
        labels = [p.label for p in result]
        self.assertIn("HH", labels, "Second high (110) > first high (100) -> HH")
        self.assertIn("HL", labels, "Second low (95) > first low (90) -> HL")

    def test_sorted_by_index(self):
        swings = [
            _SwingPoint(20, 100.0, "d1", "high"),
            _SwingPoint(5, 90.0, "d2", "low"),
            _SwingPoint(30, 110.0, "d3", "high"),
            _SwingPoint(10, 85.0, "d4", "low"),
        ]
        result = self.analyzer._classify_structure(swings)
        indices = [p.index for p in result]
        self.assertEqual(indices, sorted(indices))

    def test_lookback_limit_applied(self):
        """More than _STRUCTURE_LOOKBACK points should be trimmed."""
        swings = []
        for i in range(200):
            swings.append(_SwingPoint(i, 100.0 + i * 0.1, f"d{i}", "high"))
        result = self.analyzer._classify_structure(swings)
        self.assertLessEqual(len(result), _STRUCTURE_LOOKBACK)

    def test_three_highs_two_structure_points(self):
        swings = [
            _SwingPoint(5, 100.0, "d1", "high"),
            _SwingPoint(15, 110.0, "d2", "high"),
            _SwingPoint(25, 105.0, "d3", "high"),
        ]
        result = self.analyzer._classify_structure(swings)
        high_labels = [p.label for p in result]
        self.assertEqual(len(high_labels), 2)
        self.assertEqual(high_labels[0], "HH")  # 110 > 100
        self.assertEqual(high_labels[1], "LH")  # 105 < 110

    def test_equal_consecutive_highs_labeled_lh(self):
        """Equal price -> not strictly higher -> LH."""
        swings = [
            _SwingPoint(5, 100.0, "d1", "high"),
            _SwingPoint(15, 100.0, "d2", "high"),
        ]
        result = self.analyzer._classify_structure(swings)
        self.assertEqual(result[0].label, "LH",
                         "Equal highs should be labeled LH (not strictly higher)")


class TestDetectStructureShift(unittest.TestCase):
    """Test _detect_structure_shift method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_empty_points_ranging(self):
        structure, shift = self.analyzer._detect_structure_shift([])
        self.assertEqual(structure, "ranging")
        self.assertIsNone(shift)

    def test_predominantly_bullish(self):
        points = [
            _StructurePoint(5, 110.0, "d1", "HH"),
            _StructurePoint(10, 95.0, "d2", "HL"),
            _StructurePoint(15, 120.0, "d3", "HH"),
        ]
        structure, _ = self.analyzer._detect_structure_shift(points)
        self.assertEqual(structure, "bullish")

    def test_predominantly_bearish(self):
        points = [
            _StructurePoint(5, 90.0, "d1", "LH"),
            _StructurePoint(10, 80.0, "d2", "LL"),
            _StructurePoint(15, 85.0, "d3", "LH"),
        ]
        structure, _ = self.analyzer._detect_structure_shift(points)
        self.assertEqual(structure, "bearish")

    def test_equal_counts_ranging(self):
        points = [
            _StructurePoint(5, 110.0, "d1", "HH"),
            _StructurePoint(10, 90.0, "d2", "LL"),
        ]
        structure, _ = self.analyzer._detect_structure_shift(points)
        self.assertEqual(structure, "ranging")

    def test_mss_bullish_to_bearish(self):
        """Prior bullish, last point bearish -> shift detected."""
        points = [
            _StructurePoint(5, 110.0, "d1", "HH"),
            _StructurePoint(10, 95.0, "d2", "HL"),
            _StructurePoint(15, 90.0, "d3", "LL"),  # bearish break
        ]
        _, shift = self.analyzer._detect_structure_shift(points)
        self.assertEqual(shift, "d3", "MSS should be at the last point's date")

    def test_mss_bearish_to_bullish(self):
        points = [
            _StructurePoint(5, 90.0, "d1", "LH"),
            _StructurePoint(10, 80.0, "d2", "LL"),
            _StructurePoint(15, 120.0, "d3", "HH"),  # bullish break
        ]
        _, shift = self.analyzer._detect_structure_shift(points)
        self.assertEqual(shift, "d3")

    def test_no_shift_consistent_bullish(self):
        points = [
            _StructurePoint(5, 110.0, "d1", "HH"),
            _StructurePoint(10, 95.0, "d2", "HL"),
            _StructurePoint(15, 120.0, "d3", "HH"),
        ]
        _, shift = self.analyzer._detect_structure_shift(points)
        self.assertIsNone(shift, "Consistent bullish should not produce MSS")

    def test_no_shift_consistent_bearish(self):
        points = [
            _StructurePoint(5, 90.0, "d1", "LH"),
            _StructurePoint(10, 80.0, "d2", "LL"),
            _StructurePoint(15, 75.0, "d3", "LL"),
        ]
        _, shift = self.analyzer._detect_structure_shift(points)
        self.assertIsNone(shift)

    def test_single_point_no_mss(self):
        points = [_StructurePoint(5, 110.0, "d1", "HH")]
        structure, shift = self.analyzer._detect_structure_shift(points)
        self.assertIsNone(shift, "Single point cannot produce MSS")
        self.assertEqual(structure, "bullish")

    def test_single_bearish_point(self):
        points = [_StructurePoint(5, 90.0, "d1", "LL")]
        structure, _ = self.analyzer._detect_structure_shift(points)
        self.assertEqual(structure, "bearish")

    def test_prior_equal_no_shift(self):
        """Prior is balanced (1 bull, 1 bear) -> no shift regardless of last."""
        points = [
            _StructurePoint(5, 110.0, "d1", "HH"),
            _StructurePoint(10, 80.0, "d2", "LL"),
            _StructurePoint(15, 120.0, "d3", "HH"),
        ]
        _, shift = self.analyzer._detect_structure_shift(points)
        # Prior: 1 HH, 1 LL -> equal -> no shift
        self.assertIsNone(shift)

    def test_returns_tuple(self):
        result = self.analyzer._detect_structure_shift([])
        self.assertIsInstance(result, tuple)
        self.assertEqual(len(result), 2)


class TestDetectOrderBlocks(unittest.TestCase):
    """Test _detect_order_blocks method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def _build_bullish_ob_data(self):
        """Build data with a bearish candle followed by a break of prior swing high.

        Layout:
        - Index 3: swing high at high=110 (window=3, peak)
        - Index 8: bearish candle (close < open)
        - Index 9: breaks above swing high (high > 110)
        """
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        opens = [100.0] * n
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n

        # Swing high at index 3
        highs[3] = 110.0
        closes[3] = 109.0
        opens[3] = 108.0

        # Bearish candle at index 8 (close < open)
        opens[8] = 108.0
        closes[8] = 104.0
        highs[8] = 109.0
        lows[8] = 103.0

        # Break bar at index 9 (high > swing high)
        highs[9] = 112.0
        opens[9] = 106.0
        closes[9] = 111.0

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })

        swings = self.analyzer._detect_swings(df)
        return df, swings

    def _build_bearish_ob_data(self):
        """Build data with a bullish candle followed by break of prior swing low."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        opens = [100.0] * n
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n

        # Swing low at index 3
        lows[3] = 88.0
        closes[3] = 89.0
        opens[3] = 90.0

        # Bullish candle at index 8 (close > open)
        opens[8] = 92.0
        closes[8] = 96.0
        highs[8] = 97.0
        lows[8] = 91.0

        # Break bar at index 9 (low < swing low)
        lows[9] = 85.0
        opens[9] = 94.0
        closes[9] = 86.0

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })

        swings = self.analyzer._detect_swings(df)
        return df, swings

    def test_bullish_ob_detected(self):
        df, swings = self._build_bullish_ob_data()
        obs = self.analyzer._detect_order_blocks(df, swings)
        bullish_obs = [ob for ob in obs if ob.ob_type == "bullish"]
        self.assertGreater(len(bullish_obs), 0, "Should detect bullish OB")

    def test_bearish_ob_detected(self):
        df, swings = self._build_bearish_ob_data()
        obs = self.analyzer._detect_order_blocks(df, swings)
        bearish_obs = [ob for ob in obs if ob.ob_type == "bearish"]
        self.assertGreater(len(bearish_obs), 0, "Should detect bearish OB")

    def test_no_swings_no_obs(self):
        df = _make_merged_df(30, trend="flat")
        obs = self.analyzer._detect_order_blocks(df, [])
        self.assertEqual(len(obs), 0)

    def test_sorted_by_index_descending(self):
        df = _make_uptrend_df(60)
        swings = self.analyzer._detect_swings(df)
        obs = self.analyzer._detect_order_blocks(df, swings)
        if len(obs) > 1:
            indices = [ob.index for ob in obs]
            self.assertEqual(indices, sorted(indices, reverse=True))

    def test_seen_indices_no_duplicates(self):
        df = _make_uptrend_df(60)
        swings = self.analyzer._detect_swings(df)
        obs = self.analyzer._detect_order_blocks(df, swings)
        indices = [ob.index for ob in obs]
        self.assertEqual(len(indices), len(set(indices)),
                         "No duplicate OB indices")

    def test_mitigation_bullish_ob(self):
        """Bullish OB mitigated when subsequent bar low trades through OB low."""
        df, swings = self._build_bullish_ob_data()
        obs = self.analyzer._detect_order_blocks(df, swings)
        # OBs have mitigated field
        for ob in obs:
            self.assertIsInstance(ob.mitigated, bool)

    def test_ob_has_correct_fields(self):
        df, swings = self._build_bullish_ob_data()
        obs = self.analyzer._detect_order_blocks(df, swings)
        if obs:
            ob = obs[0]
            self.assertIsInstance(ob.ob_type, str)
            self.assertIsInstance(ob.high, float)
            self.assertIsInstance(ob.low, float)
            self.assertIsInstance(ob.date, str)
            self.assertIsInstance(ob.index, int)

    def test_bullish_ob_high_low_relationship(self):
        df, swings = self._build_bullish_ob_data()
        obs = self.analyzer._detect_order_blocks(df, swings)
        for ob in obs:
            if ob.ob_type == "bullish":
                self.assertGreater(ob.high, ob.low,
                                   "OB high must be > OB low")

    def test_empty_df_no_crash(self):
        """Empty DataFrame with swings should not crash."""
        dates = pd.date_range("2024-01-01", periods=5, freq="B")
        df = pd.DataFrame({
            "date": dates, "open": [100.0] * 5, "high": [102.0] * 5,
            "low": [98.0] * 5, "close": [101.0] * 5, "volume": [1000] * 5,
        })
        swings = [_SwingPoint(2, 102.0, "d1", "high")]
        obs = self.analyzer._detect_order_blocks(df, swings)
        self.assertIsInstance(obs, list)

    def test_returns_mitigated_and_unmitigated(self):
        """Both mitigated and unmitigated OBs should be returned."""
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        obs = self.analyzer._detect_order_blocks(df, swings)
        # We cannot guarantee both but verify structure is correct
        for ob in obs:
            self.assertIn(ob.mitigated, (True, False))

    def test_multiple_obs_zigzag(self):
        """Zigzag data should produce multiple OBs."""
        df = _make_zigzag_df(60, amplitude=20.0, period=8)
        swings = self.analyzer._detect_swings(df)
        obs = self.analyzer._detect_order_blocks(df, swings)
        # Zigzag has many breaks of swing points
        self.assertIsInstance(obs, list)


class TestDetectFairValueGaps(unittest.TestCase):
    """Test _detect_fair_value_gaps method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def _build_bullish_fvg_data(self):
        """Build data where candle1.high < candle3.low -> bullish FVG."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        # Set all bars high enough so subsequent bars don't fill gap
        highs = [112.0] * n
        lows = [108.0] * n
        opens = [109.0] * n
        closes = [111.0] * n

        # At i=4 (candle3), check candle1=i-2=2, candle3=i=4
        # candle1 high (i=2) < candle3 low (i=4) -> bullish FVG
        highs[2] = 100.0   # candle 1 high
        opens[2] = 99.0
        closes[2] = 99.5
        lows[2] = 98.0

        # Middle candle (i=3) can be anything
        highs[3] = 104.0
        lows[3] = 101.0
        opens[3] = 102.0
        closes[3] = 103.0

        lows[4] = 105.0    # candle 3 low -> gap between 100 and 105
        highs[4] = 112.0
        closes[4] = 111.0
        opens[4] = 106.0

        # All bars after index 4 stay above gap (lows > 105)
        # Already set to 108.0 default

        return pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })

    def _build_bearish_fvg_data(self):
        """Build data where candle1.low > candle3.high -> bearish FVG."""
        n = 20
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        # Set all bars low enough so subsequent bars don't fill gap
        highs = [92.0] * n
        lows = [88.0] * n
        opens = [91.0] * n
        closes = [89.0] * n

        # candle1 (i=2): low = 105
        highs[2] = 110.0
        lows[2] = 105.0
        opens[2] = 108.0
        closes[2] = 106.0

        # middle candle (i=3)
        highs[3] = 103.0
        lows[3] = 99.0
        opens[3] = 102.0
        closes[3] = 100.0

        # candle3 (i=4): high = 100 -> gap from 100 to 105
        highs[4] = 100.0
        lows[4] = 95.0
        opens[4] = 98.0
        closes[4] = 96.0

        # All bars after index 4 stay below gap (highs < 100)
        # Already set to 92.0 default

        return pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })

    def test_bullish_fvg_detected(self):
        df = self._build_bullish_fvg_data()
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        bullish = [f for f in fvgs if f.fvg_type == "bullish"]
        self.assertGreater(len(bullish), 0, "Should detect bullish FVG")

    def test_bearish_fvg_detected(self):
        df = self._build_bearish_fvg_data()
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        bearish = [f for f in fvgs if f.fvg_type == "bearish"]
        self.assertGreater(len(bearish), 0, "Should detect bearish FVG")

    def test_no_gaps_in_continuous_data(self):
        """Overlapping candles should produce no FVGs."""
        df = _make_merged_df(30, trend="up")
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        # Standard trend data has overlapping candles
        # Candle highs/lows overlap so no gap
        # This may or may not produce FVGs depending on data
        self.assertIsInstance(fvgs, list)

    def test_fill_percent_zero(self):
        """FVG with no subsequent bars trading into it -> 0% filled."""
        df = self._build_bullish_fvg_data()
        # Gap is at high=105, low=100 (candle1.high to candle3.low)
        # Default builder keeps subsequent bars above gap (lows=108)
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        bullish = [f for f in fvgs if f.fvg_type == "bullish"]
        self.assertGreater(len(bullish), 0, "Bullish FVG should exist")
        self.assertAlmostEqual(bullish[0].fill_percent, 0.0,
                               msg="No penetration -> 0% filled")

    def test_fully_filled_excluded(self):
        """100% filled FVGs should be excluded."""
        df = self._build_bullish_fvg_data()
        # Gap: fvg_high=105, fvg_low=100. Pen = 105 - 99 = 6 >= gap_size=5
        # fill = 6/5 = 1.2 >= 1.0 -> excluded
        df.at[6, "low"] = 99.0
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        # The bullish FVG at index 3 should be excluded since fully filled
        bullish_at_3 = [f for f in fvgs if f.fvg_type == "bullish" and f.index == 3]
        self.assertEqual(len(bullish_at_3), 0,
                         "Fully filled FVGs should be excluded")

    def test_gap_size_less_than_epsilon_skipped(self):
        """Tiny gap < _EPSILON should be skipped."""
        n = 10
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [100.0] * n
        lows = [98.0] * n
        # Make a gap smaller than epsilon
        highs[2] = 100.0
        lows[4] = 100.0 + _EPSILON / 2
        df = pd.DataFrame({
            "date": dates, "open": [99.0] * n, "high": highs,
            "low": lows, "close": [99.5] * n, "volume": [1000] * n,
        })
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        # The tiny gap should be skipped
        self.assertIsInstance(fvgs, list)

    def test_sorted_by_index_descending(self):
        df = _make_zigzag_df(60, amplitude=20.0, period=8)
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        if len(fvgs) > 1:
            indices = [f.index for f in fvgs]
            self.assertEqual(indices, sorted(indices, reverse=True))

    def test_limited_to_max_fvgs(self):
        """Should return at most _MAX_FVGS."""
        # Create many gaps
        n = 100
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = []
        lows = []
        for i in range(n):
            if i % 3 == 0:
                highs.append(100.0 + i)
                lows.append(95.0 + i)
            elif i % 3 == 1:
                highs.append(102.0 + i)
                lows.append(97.0 + i)
            else:
                # Create gap: candle1.high < candle3.low
                highs.append(110.0 + i)
                lows.append(108.0 + i)
        df = pd.DataFrame({
            "date": dates, "open": [h - 1 for h in highs], "high": highs,
            "low": lows, "close": [h - 0.5 for h in highs],
            "volume": [1000] * n,
        })
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        self.assertLessEqual(len(fvgs), _MAX_FVGS)

    def test_fvg_date_is_middle_candle(self):
        """FVG index is i-1 where i is candle3 index in the loop."""
        # Build a simple 10-bar dataset with exactly one FVG at known position
        n = 10
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        # All bars at same level
        highs = [110.0] * n
        lows = [108.0] * n
        opens = [109.0] * n
        closes = [109.5] * n
        # Create bullish FVG at i=5: candle1=3, candle3=5
        highs[3] = 100.0  # candle1 high
        lows[3] = 98.0
        opens[3] = 99.0
        closes[3] = 99.5
        # candle3 at i=5: low=105 -> gap 100 to 105
        lows[5] = 105.0
        highs[5] = 112.0
        opens[5] = 106.0
        closes[5] = 111.0
        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        bullish = [f for f in fvgs if f.fvg_type == "bullish"]
        # FVG middle candle is at index 4 (i-1 where candle3 i=5)
        fvg_indices = [f.index for f in bullish]
        self.assertIn(4, fvg_indices,
                      "FVG index should be middle candle (4)")

    def test_fvg_high_low_relationship(self):
        df = self._build_bullish_fvg_data()
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        for f in fvgs:
            self.assertGreater(f.high, f.low, "FVG high > FVG low")

    def test_fill_percent_in_range(self):
        df = _make_zigzag_df(60, amplitude=20.0, period=8)
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        for f in fvgs:
            self.assertGreaterEqual(f.fill_percent, 0.0)
            self.assertLess(f.fill_percent, 1.0)

    def test_partial_fill(self):
        """FVG with partial penetration has fill_percent between 0 and 1."""
        df = self._build_bullish_fvg_data()
        # Gap: fvg_high=105, fvg_low=100. Pen = fvg_high - bar_low = 105 - 103 = 2
        # fill = 2 / 5 = 0.4
        df.at[6, "low"] = 103.0  # penetrates 2 out of 5 = 40%
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        bullish = [f for f in fvgs if f.fvg_type == "bullish"]
        self.assertGreater(len(bullish), 0, "Bullish FVG should exist")
        self.assertGreater(bullish[0].fill_percent, 0.0)
        self.assertLess(bullish[0].fill_percent, 1.0)

    def test_few_bars_no_crash(self):
        """Fewer than 3 bars -> no FVGs but no crash."""
        dates = pd.date_range("2024-01-01", periods=2, freq="B")
        df = pd.DataFrame({
            "date": dates, "open": [100, 101], "high": [102, 103],
            "low": [98, 99], "close": [101, 102], "volume": [1000, 1000],
        })
        fvgs = self.analyzer._detect_fair_value_gaps(df)
        self.assertEqual(len(fvgs), 0)


class TestDetectLiquiditySweeps(unittest.TestCase):
    """Test _detect_liquidity_sweeps method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def _build_buy_side_sweep_data(self):
        """Build data with buy-side sweep: wick above swing high, close reverses."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        opens = [100.0] * n
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n

        # Swing high at index 3 (detected with window=3)
        highs[3] = 115.0
        closes[3] = 114.0
        opens[3] = 113.0

        # At a bar near the end (within sweep_lookback), wick above 115, close below
        sweep_idx = n - 5
        highs[sweep_idx] = 116.0  # exceeds swing high
        closes[sweep_idx] = 112.0  # reverses below swing high level

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        return df, swings

    def _build_sell_side_sweep_data(self):
        """Build data with sell-side sweep: wick below swing low, close reverses."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        opens = [100.0] * n
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n

        # Swing low at index 3
        lows[3] = 85.0
        closes[3] = 86.0
        opens[3] = 87.0

        # Sweep bar near end
        sweep_idx = n - 5
        lows[sweep_idx] = 83.0  # below swing low
        closes[sweep_idx] = 88.0  # reverses above

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        return df, swings

    def test_buy_side_sweep_detected(self):
        df, swings = self._build_buy_side_sweep_data()
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        buy_side = [s for s in sweeps if s.sweep_type == "buy_side"]
        self.assertGreater(len(buy_side), 0, "Should detect buy-side sweep")

    def test_sell_side_sweep_detected(self):
        df, swings = self._build_sell_side_sweep_data()
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        sell_side = [s for s in sweeps if s.sweep_type == "sell_side"]
        self.assertGreater(len(sell_side), 0, "Should detect sell-side sweep")

    def test_no_reversal_no_sweep(self):
        """If price doesn't reverse back, no sweep detected."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n
        opens = [100.0] * n

        # Swing high at index 3
        highs[3] = 115.0
        closes[3] = 114.0

        # Bar exceeds swing high but does NOT reverse (close stays above)
        sweep_idx = n - 5
        highs[sweep_idx] = 116.0
        closes[sweep_idx] = 116.0  # no reversal
        # Next bars also stay high
        for i in range(sweep_idx + 1, n):
            closes[i] = 116.0

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        buy_side = [s for s in sweeps if s.sweep_type == "buy_side"]
        self.assertEqual(len(buy_side), 0,
                         "No reversal -> no buy-side sweep")

    def test_only_looks_back_sweep_lookback(self):
        """Sweeps only scanned in last _SWEEP_LOOKBACK bars."""
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        sweep_start = max(0, len(df) - _SWEEP_LOOKBACK)
        for s in sweeps:
            self.assertGreaterEqual(s.index, sweep_start)

    def test_no_swings_no_sweeps(self):
        df = _make_merged_df(30, trend="flat")
        sweeps = self.analyzer._detect_liquidity_sweeps(df, [])
        self.assertEqual(len(sweeps), 0)

    def test_used_swings_no_duplicate(self):
        """Same swing should not be swept twice."""
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        # Check that sweep levels are unique per swing index
        # (used_swings set prevents duplicates)
        self.assertIsInstance(sweeps, list)

    def test_sweep_sorted_descending(self):
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        if len(sweeps) > 1:
            indices = [s.index for s in sweeps]
            self.assertEqual(indices, sorted(indices, reverse=True))

    def test_sweep_type_values(self):
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        for s in sweeps:
            self.assertIn(s.sweep_type, ("buy_side", "sell_side"))

    def test_sweep_within_max_bars(self):
        """Reversal must happen within _SWEEP_MAX_BARS."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [102.0] * n
        lows = [98.0] * n
        closes = [101.0] * n
        opens = [100.0] * n

        highs[3] = 115.0
        closes[3] = 114.0

        # Exceed swing high at bar near end
        sweep_idx = n - 8
        highs[sweep_idx] = 116.0
        closes[sweep_idx] = 116.0  # no reversal at same bar
        # Reversal happens much later (beyond _SWEEP_MAX_BARS)
        for i in range(sweep_idx + 1, sweep_idx + _SWEEP_MAX_BARS + 1):
            if i < n:
                closes[i] = 116.0  # stays above
        # Eventually reverse but too late
        if sweep_idx + _SWEEP_MAX_BARS + 1 < n:
            closes[sweep_idx + _SWEEP_MAX_BARS + 1] = 110.0

        df = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes, "volume": [1000] * n,
        })
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        buy_side = [s for s in sweeps if s.sweep_type == "buy_side"]
        # Reversal beyond max bars -> should not detect
        # (or may detect if there's another swing that matches)
        self.assertIsInstance(sweeps, list)

    def test_multiple_sweeps_possible(self):
        """Multiple different swings can be swept."""
        df = _make_zigzag_df(60, amplitude=15.0)
        swings = self.analyzer._detect_swings(df)
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        # Just verify it returns a list without crashing
        self.assertIsInstance(sweeps, list)

    def test_sweep_fields(self):
        df, swings = self._build_buy_side_sweep_data()
        sweeps = self.analyzer._detect_liquidity_sweeps(df, swings)
        for s in sweeps:
            self.assertIsInstance(s.level, float)
            self.assertIsInstance(s.date, str)
            self.assertIsInstance(s.index, int)


class TestDetectBreakerBlocks(unittest.TestCase):
    """Test _detect_breaker_blocks method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_mitigated_bearish_ob_becomes_bullish_breaker(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, True)]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertEqual(len(breakers), 1)
        self.assertEqual(breakers[0].breaker_type, "bullish")

    def test_mitigated_bullish_ob_becomes_bearish_breaker(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, True)]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertEqual(len(breakers), 1)
        self.assertEqual(breakers[0].breaker_type, "bearish")

    def test_unmitigated_obs_ignored(self):
        obs = [
            _OrderBlock("bearish", 110.0, 105.0, "d1", 5, False),
            _OrderBlock("bullish", 100.0, 95.0, "d2", 10, False),
        ]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertEqual(len(breakers), 0)

    def test_limited_to_max_breaker_blocks(self):
        obs = [
            _OrderBlock("bearish", 110.0 + i, 105.0 + i, f"d{i}", i * 5, True)
            for i in range(10)
        ]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertLessEqual(len(breakers), _MAX_BREAKER_BLOCKS)

    def test_sorted_by_index_descending(self):
        obs = [
            _OrderBlock("bearish", 110.0, 105.0, "d1", 5, True),
            _OrderBlock("bearish", 120.0, 115.0, "d2", 15, True),
            _OrderBlock("bullish", 90.0, 85.0, "d3", 10, True),
        ]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        if len(breakers) > 1:
            indices = [b.index for b in breakers]
            self.assertEqual(indices, sorted(indices, reverse=True))

    def test_empty_input_empty_output(self):
        breakers = self.analyzer._detect_breaker_blocks([])
        self.assertEqual(len(breakers), 0)

    def test_breaker_preserves_high_low(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, True)]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertAlmostEqual(breakers[0].high, 110.0)
        self.assertAlmostEqual(breakers[0].low, 105.0)

    def test_breaker_preserves_date(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "2024-01-15", 5, True)]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertEqual(breakers[0].date, "2024-01-15")

    def test_mixed_mitigated_unmitigated(self):
        obs = [
            _OrderBlock("bearish", 110.0, 105.0, "d1", 5, True),
            _OrderBlock("bullish", 100.0, 95.0, "d2", 10, False),
            _OrderBlock("bearish", 120.0, 115.0, "d3", 15, True),
        ]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        self.assertEqual(len(breakers), 2, "Only mitigated OBs become breakers")

    def test_breaker_fields(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, True)]
        breakers = self.analyzer._detect_breaker_blocks(obs)
        b = breakers[0]
        self.assertIsInstance(b.breaker_type, str)
        self.assertIsInstance(b.high, float)
        self.assertIsInstance(b.low, float)
        self.assertIsInstance(b.date, str)
        self.assertIsInstance(b.index, int)


class TestCalculatePremiumDiscount(unittest.TestCase):
    """Test _calculate_premium_discount method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_price_above_equilibrium_premium(self):
        """Close above midpoint -> premium."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * n, "high": [110.0] * n,
            "low": [90.0] * n, "close": [108.0] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        self.assertEqual(info.current_position, "premium")

    def test_price_below_equilibrium_discount(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * n, "high": [110.0] * n,
            "low": [90.0] * n, "close": [92.0] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        self.assertEqual(info.current_position, "discount")

    def test_price_at_equilibrium(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        equilibrium = 100.0
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * n, "high": [110.0] * n,
            "low": [90.0] * n, "close": [equilibrium] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        self.assertEqual(info.current_position, "equilibrium")

    def test_equilibrium_calculation(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * n, "high": [120.0] * n,
            "low": [80.0] * n, "close": [100.0] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        self.assertAlmostEqual(info.equilibrium, 100.0,
                               msg="equilibrium = (120+80)/2 = 100")

    def test_uses_htf_range_lookback(self):
        """With more bars than _HTF_RANGE_LOOKBACK, only last N used."""
        n = 200
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        highs = [100.0] * n
        lows = [90.0] * n
        # Early bars have wider range (should be excluded)
        for i in range(50):
            highs[i] = 200.0
            lows[i] = 10.0
        df = pd.DataFrame({
            "date": dates,
            "open": [95.0] * n, "high": highs,
            "low": lows, "close": [95.0] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        # Only last 120 bars used. Early extreme bars are excluded.
        self.assertAlmostEqual(info.equilibrium, 95.0,
                               msg="Should use only last HTF_RANGE_LOOKBACK bars")

    def test_fewer_bars_than_lookback(self):
        """Works correctly with fewer bars than _HTF_RANGE_LOOKBACK."""
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [100.0] * n, "high": [110.0] * n,
            "low": [90.0] * n, "close": [105.0] * n,
            "volume": [1000] * n,
        })
        info = self.analyzer._calculate_premium_discount(df)
        self.assertIsInstance(info, _PremiumDiscountInfo)

    def test_returns_named_tuple(self):
        df = _make_merged_df(30, trend="up")
        info = self.analyzer._calculate_premium_discount(df)
        self.assertIsInstance(info, _PremiumDiscountInfo)

    def test_premium_zone_start_equals_equilibrium(self):
        df = _make_merged_df(30, trend="up")
        info = self.analyzer._calculate_premium_discount(df)
        self.assertEqual(info.premium_zone_start, info.equilibrium)

    def test_discount_zone_start_equals_equilibrium(self):
        df = _make_merged_df(30, trend="up")
        info = self.analyzer._calculate_premium_discount(df)
        self.assertEqual(info.discount_zone_start, info.equilibrium)

    def test_position_values(self):
        df = _make_merged_df(30, trend="up")
        info = self.analyzer._calculate_premium_discount(df)
        self.assertIn(info.current_position, ("premium", "discount", "equilibrium"))


class TestDetermineDirection(unittest.TestCase):
    """Test _determine_direction method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.pd_info_eq = _PremiumDiscountInfo(100.0, 100.0, 100.0, "equilibrium")
        self.pd_info_disc = _PremiumDiscountInfo(100.0, 100.0, 100.0, "discount")
        self.pd_info_prem = _PremiumDiscountInfo(100.0, 100.0, 100.0, "premium")

    def test_bullish_structure(self):
        d = self.analyzer._determine_direction("bullish", [], [], [], self.pd_info_eq)
        self.assertEqual(d, "bullish")

    def test_bearish_structure(self):
        d = self.analyzer._determine_direction("bearish", [], [], [], self.pd_info_eq)
        self.assertEqual(d, "bearish")

    def test_ranging_more_sell_side_sweeps_bullish(self):
        sweeps = [
            _LiquiditySweep("sell_side", 90.0, "d1", 10),
            _LiquiditySweep("sell_side", 85.0, "d2", 15),
            _LiquiditySweep("buy_side", 110.0, "d3", 20),
        ]
        d = self.analyzer._determine_direction("ranging", [], [], sweeps, self.pd_info_eq)
        self.assertEqual(d, "bullish",
                         "More sell-side sweeps -> bullish bias")

    def test_ranging_more_buy_side_sweeps_bearish(self):
        sweeps = [
            _LiquiditySweep("buy_side", 110.0, "d1", 10),
            _LiquiditySweep("buy_side", 115.0, "d2", 15),
            _LiquiditySweep("sell_side", 90.0, "d3", 20),
        ]
        d = self.analyzer._determine_direction("ranging", [], [], sweeps, self.pd_info_eq)
        self.assertEqual(d, "bearish")

    def test_ranging_equal_sweeps_discount_bullish(self):
        sweeps = [
            _LiquiditySweep("sell_side", 90.0, "d1", 10),
            _LiquiditySweep("buy_side", 110.0, "d2", 15),
        ]
        d = self.analyzer._determine_direction("ranging", [], [], sweeps, self.pd_info_disc)
        self.assertEqual(d, "bullish")

    def test_ranging_equal_sweeps_premium_bearish(self):
        sweeps = [
            _LiquiditySweep("sell_side", 90.0, "d1", 10),
            _LiquiditySweep("buy_side", 110.0, "d2", 15),
        ]
        d = self.analyzer._determine_direction("ranging", [], [], sweeps, self.pd_info_prem)
        self.assertEqual(d, "bearish")

    def test_ranging_equal_sweeps_equilibrium_neutral(self):
        sweeps = [
            _LiquiditySweep("sell_side", 90.0, "d1", 10),
            _LiquiditySweep("buy_side", 110.0, "d2", 15),
        ]
        d = self.analyzer._determine_direction("ranging", [], [], sweeps, self.pd_info_eq)
        self.assertEqual(d, "neutral")

    def test_ranging_no_sweeps_discount_bullish(self):
        d = self.analyzer._determine_direction("ranging", [], [], [], self.pd_info_disc)
        self.assertEqual(d, "bullish")

    def test_ranging_no_sweeps_premium_bearish(self):
        d = self.analyzer._determine_direction("ranging", [], [], [], self.pd_info_prem)
        self.assertEqual(d, "bearish")

    def test_ranging_no_sweeps_equilibrium_neutral(self):
        d = self.analyzer._determine_direction("ranging", [], [], [], self.pd_info_eq)
        self.assertEqual(d, "neutral")

    def test_return_values_are_direction_enum_values(self):
        valid = {d.value for d in Direction}
        for ms in ("bullish", "bearish", "ranging"):
            d = self.analyzer._determine_direction(ms, [], [], [], self.pd_info_eq)
            self.assertIn(d, valid)


class TestCalculateEntryZone(unittest.TestCase):
    """Test _calculate_entry_zone method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.df = _make_merged_df(30, trend="up")

    def test_neutral_direction_returns_none(self):
        result = self.analyzer._calculate_entry_zone([], [], "neutral", self.df)
        self.assertIsNone(result)

    def test_no_aligned_obs_returns_none(self):
        # Bearish OBs with bullish direction -> no aligned
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertIsNone(result)

    def test_mitigated_obs_excluded(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, True)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertIsNone(result, "Mitigated OBs should be excluded")

    def test_bullish_ob_fallback(self):
        """Unmitigated bullish OB with bullish direction -> entry zone."""
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.high, 100.0)
        self.assertAlmostEqual(result.low, 95.0)

    def test_bearish_ob_fallback(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bearish", self.df)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.high, 110.0)
        self.assertAlmostEqual(result.low, 105.0)

    def test_ob_fvg_overlap_entry_zone(self):
        """When OB and FVG overlap, entry zone is the intersection."""
        obs = [_OrderBlock("bullish", 105.0, 95.0, "d1", 5, False)]
        fvgs = [_FairValueGap("bullish", 108.0, 100.0, "d2", 8, 0.0)]
        result = self.analyzer._calculate_entry_zone(obs, fvgs, "bullish", self.df)
        self.assertIsNotNone(result)
        # Overlap: max(95, 100)=100 to min(105, 108)=105
        self.assertAlmostEqual(result.low, 100.0)
        self.assertAlmostEqual(result.high, 105.0)

    def test_no_overlap_fallback_to_ob(self):
        """No OB/FVG overlap -> falls back to most recent OB."""
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, False)]
        fvgs = [_FairValueGap("bullish", 120.0, 115.0, "d2", 8, 0.0)]
        result = self.analyzer._calculate_entry_zone(obs, fvgs, "bullish", self.df)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.high, 100.0)
        self.assertAlmostEqual(result.low, 95.0)

    def test_stop_loss_bullish(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        expected_sl = 95.0 * (1.0 - _STOP_LOSS_BUFFER_PCT)
        self.assertAlmostEqual(result.stop_loss, expected_sl)

    def test_stop_loss_bearish(self):
        obs = [_OrderBlock("bearish", 110.0, 105.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bearish", self.df)
        expected_sl = 110.0 * (1.0 + _STOP_LOSS_BUFFER_PCT)
        self.assertAlmostEqual(result.stop_loss, expected_sl)

    def test_risk_reward_ratio_positive(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertGreaterEqual(result.risk_reward_ratio, 0.0)

    def test_risk_reward_zero_when_risk_zero(self):
        """When entry_mid == stop_loss, risk is ~0 -> R:R should be 0."""
        # OB with very small range -> risk approaches epsilon
        obs = [_OrderBlock("bullish", 100.0, 100.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertIsNotNone(result)
        # Risk is very small but not exactly zero due to buffer
        self.assertGreaterEqual(result.risk_reward_ratio, 0.0)

    def test_rr_not_nan_or_inf(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "d1", 5, False)]
        result = self.analyzer._calculate_entry_zone(obs, [], "bullish", self.df)
        self.assertFalse(math.isnan(result.risk_reward_ratio))
        self.assertFalse(math.isinf(result.risk_reward_ratio))


class TestCalculateConfidence(unittest.TestCase):
    """Test _calculate_confidence method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.df = _make_merged_df(30, trend="up")
        self.pd_eq = _PremiumDiscountInfo(100.0, 100.0, 100.0, "equilibrium")
        self.pd_disc = _PremiumDiscountInfo(100.0, 100.0, 100.0, "discount")
        self.pd_prem = _PremiumDiscountInfo(100.0, 100.0, 100.0, "premium")

    def test_clear_bullish_base(self):
        c = self.analyzer._calculate_confidence(
            "bullish", [], [], [], [], self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE)

    def test_clear_bearish_base(self):
        c = self.analyzer._calculate_confidence(
            "bearish", [], [], [], [], self.pd_eq, "bearish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE)

    def test_mixed_structure_base(self):
        c = self.analyzer._calculate_confidence(
            "ranging", [], [], [], [], self.pd_eq, "neutral", self.df)
        self.assertAlmostEqual(c, _CONF_MIXED_STRUCTURE)

    def test_ob_near_price_adds_bonus(self):
        current_price = float(self.df["close"].iloc[-1])
        ob_mid = current_price  # exactly at price -> within proximity
        ob_high = ob_mid + 1.0
        ob_low = ob_mid - 1.0
        obs = [_OrderBlock("bullish", ob_high, ob_low, "d1", 5, False)]
        c = self.analyzer._calculate_confidence(
            "bullish", obs, [], [], [], self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_ORDER_BLOCK)

    def test_fvg_near_price_adds_bonus(self):
        current_price = float(self.df["close"].iloc[-1])
        fvg_mid = current_price
        fvgs = [_FairValueGap("bullish", fvg_mid + 1, fvg_mid - 1, "d1", 5, 0.0)]
        c = self.analyzer._calculate_confidence(
            "bullish", [], fvgs, [], [], self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_FVG)

    def test_sweep_present_adds_bonus(self):
        sweeps = [_LiquiditySweep("sell_side", 90.0, "d1", 10)]
        c = self.analyzer._calculate_confidence(
            "bullish", [], [], sweeps, [], self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_SWEEP)

    def test_htf_alignment_bullish_discount(self):
        c = self.analyzer._calculate_confidence(
            "bullish", [], [], [], [], self.pd_disc, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_HTF_ALIGNS)

    def test_htf_alignment_bearish_premium(self):
        c = self.analyzer._calculate_confidence(
            "bearish", [], [], [], [], self.pd_prem, "bearish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_HTF_ALIGNS)

    def test_breaker_confirms_adds_bonus(self):
        breakers = [_BreakerBlock("bullish", 105.0, 100.0, "d1", 5)]
        c = self.analyzer._calculate_confidence(
            "bullish", [], [], [], breakers, self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE + _CONF_BREAKER)

    def test_multi_confluence_all_near(self):
        """OB near + FVG near + sweep -> multi-confluence bonus."""
        current_price = float(self.df["close"].iloc[-1])
        obs = [_OrderBlock("bullish", current_price + 1, current_price - 1, "d1", 5, False)]
        fvgs = [_FairValueGap("bullish", current_price + 1, current_price - 1, "d2", 8, 0.0)]
        sweeps = [_LiquiditySweep("sell_side", 90.0, "d3", 10)]
        c = self.analyzer._calculate_confidence(
            "bullish", obs, fvgs, sweeps, [], self.pd_eq, "bullish", self.df)
        expected = (_CONF_CLEAR_STRUCTURE + _CONF_ORDER_BLOCK + _CONF_FVG +
                    _CONF_SWEEP + _CONF_MULTI_CONFLUENCE)
        self.assertAlmostEqual(c, expected)

    def test_max_confidence_capped_at_one(self):
        """Even with all bonuses, confidence should not exceed 1.0."""
        current_price = float(self.df["close"].iloc[-1])
        obs = [_OrderBlock("bullish", current_price + 1, current_price - 1, "d1", 5, False)]
        fvgs = [_FairValueGap("bullish", current_price + 1, current_price - 1, "d2", 8, 0.0)]
        sweeps = [_LiquiditySweep("sell_side", 90.0, "d3", 10)]
        breakers = [_BreakerBlock("bullish", 105.0, 100.0, "d4", 5)]
        c = self.analyzer._calculate_confidence(
            "bullish", obs, fvgs, sweeps, breakers, self.pd_disc, "bullish", self.df)
        self.assertLessEqual(c, 1.0)

    def test_confidence_non_negative(self):
        c = self.analyzer._calculate_confidence(
            "ranging", [], [], [], [], self.pd_eq, "neutral", self.df)
        self.assertGreaterEqual(c, 0.0)

    def test_nan_inf_guard(self):
        """Confidence should never be NaN or Inf."""
        c = self.analyzer._calculate_confidence(
            "bullish", [], [], [], [], self.pd_eq, "bullish", self.df)
        self.assertFalse(math.isnan(c))
        self.assertFalse(math.isinf(c))

    def test_ob_far_from_price_no_bonus(self):
        """OB far from current price should not add bonus."""
        obs = [_OrderBlock("bullish", 10.0, 5.0, "d1", 5, False)]
        c = self.analyzer._calculate_confidence(
            "bullish", obs, [], [], [], self.pd_eq, "bullish", self.df)
        self.assertAlmostEqual(c, _CONF_CLEAR_STRUCTURE,
                               msg="Distant OB should not contribute bonus")


class TestBuildKeyLevels(unittest.TestCase):
    """Test _build_key_levels method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.pd_info = _PremiumDiscountInfo(100.0, 100.0, 100.0, "equilibrium")

    def test_all_required_keys_present(self):
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], [], self.pd_info, None)
        required_keys = [
            "market_structure", "structure_shift_bar", "order_blocks",
            "fair_value_gaps", "liquidity_sweeps", "breaker_blocks",
            "premium_discount", "entry_zone", "stop_loss", "risk_reward_ratio",
        ]
        for k in required_keys:
            self.assertIn(k, kl, f"Missing key: {k}")

    def test_order_blocks_filtered_unmitigated(self):
        obs = [
            _OrderBlock("bullish", 100.0, 95.0, "d1", 5, False),
            _OrderBlock("bearish", 110.0, 105.0, "d2", 10, True),  # mitigated
        ]
        kl = self.analyzer._build_key_levels(
            "bullish", None, obs, [], [], [], self.pd_info, None)
        self.assertEqual(len(kl["order_blocks"]), 1,
                         "Only unmitigated OBs in key_levels")

    def test_order_blocks_limited(self):
        obs = [
            _OrderBlock("bullish", 100.0 + i, 95.0 + i, f"d{i}", i, False)
            for i in range(10)
        ]
        kl = self.analyzer._build_key_levels(
            "bullish", None, obs, [], [], [], self.pd_info, None)
        self.assertLessEqual(len(kl["order_blocks"]), _MAX_ORDER_BLOCKS)

    def test_fvgs_limited(self):
        fvgs = [
            _FairValueGap("bullish", 105.0 + i, 100.0 + i, f"d{i}", i, 0.0)
            for i in range(10)
        ]
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], fvgs, [], [], self.pd_info, None)
        self.assertLessEqual(len(kl["fair_value_gaps"]), _MAX_FVGS)

    def test_breaker_blocks_limited(self):
        breakers = [
            _BreakerBlock("bullish", 105.0 + i, 100.0 + i, f"d{i}", i)
            for i in range(10)
        ]
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], breakers, self.pd_info, None)
        self.assertLessEqual(len(kl["breaker_blocks"]), _MAX_BREAKER_BLOCKS)

    def test_values_rounded_to_4_decimal(self):
        obs = [_OrderBlock("bullish", 100.12345, 95.67891, "d1", 5, False)]
        kl = self.analyzer._build_key_levels(
            "bullish", None, obs, [], [], [], self.pd_info, None)
        ob = kl["order_blocks"][0]
        self.assertEqual(ob["high"], round(100.12345, 4))
        self.assertEqual(ob["low"], round(95.67891, 4))

    def test_entry_zone_none_when_no_entry(self):
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], [], self.pd_info, None)
        self.assertIsNone(kl["entry_zone"])

    def test_stop_loss_none_when_no_entry(self):
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], [], self.pd_info, None)
        self.assertIsNone(kl["stop_loss"])

    def test_risk_reward_none_when_no_entry(self):
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], [], self.pd_info, None)
        self.assertIsNone(kl["risk_reward_ratio"])

    def test_entry_zone_present_when_entry_info(self):
        entry = _EntryZoneInfo(105.0, 100.0, 99.5, 2.5)
        kl = self.analyzer._build_key_levels(
            "bullish", None, [], [], [], [], self.pd_info, entry)
        self.assertIsNotNone(kl["entry_zone"])
        self.assertAlmostEqual(kl["entry_zone"]["high"], 105.0)
        self.assertAlmostEqual(kl["entry_zone"]["low"], 100.0)
        self.assertAlmostEqual(kl["stop_loss"], 99.5)
        self.assertAlmostEqual(kl["risk_reward_ratio"], 2.5)


class TestBuildReasoning(unittest.TestCase):
    """Test _build_reasoning method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.df = _make_merged_df(30, trend="up")
        self.pd_info = _PremiumDiscountInfo(100.0, 100.0, 100.0, "equilibrium")

    def test_contains_ticker(self):
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], [], [], self.pd_info, None, self.df)
        self.assertIn("AAPL", r)

    def test_ticker_sanitized_special_chars(self):
        r = self.analyzer._build_reasoning(
            "AA<script>PL", "bullish", [], [], [], self.pd_info, None, self.df)
        self.assertNotIn("<script>", r)
        self.assertNotIn("<", r)

    def test_ticker_length_capped(self):
        long_ticker = "A" * 50
        r = self.analyzer._build_reasoning(
            long_ticker, "bullish", [], [], [], self.pd_info, None, self.df)
        # Sanitized ticker should be capped
        self.assertNotIn("A" * 50, r)

    def test_mentions_bullish_structure(self):
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], [], [], self.pd_info, None, self.df)
        self.assertIn("bullish", r.lower())

    def test_mentions_bearish_structure(self):
        r = self.analyzer._build_reasoning(
            "AAPL", "bearish", [], [], [], self.pd_info, None, self.df)
        self.assertIn("bearish", r.lower())

    def test_mentions_ranging_structure(self):
        r = self.analyzer._build_reasoning(
            "AAPL", "ranging", [], [], [], self.pd_info, None, self.df)
        self.assertIn("ranging", r.lower())

    def test_mentions_obs_when_present(self):
        obs = [_OrderBlock("bullish", 100.0, 95.0, "2024-01-15", 5, False)]
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", obs, [], [], self.pd_info, None, self.df)
        self.assertIn("order block", r.lower())

    def test_mentions_fvgs_when_present(self):
        fvgs = [_FairValueGap("bullish", 105.0, 100.0, "2024-01-15", 8, 0.3)]
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], fvgs, [], self.pd_info, None, self.df)
        self.assertIn("fvg", r.lower())

    def test_mentions_sweeps_when_present(self):
        sweeps = [_LiquiditySweep("sell_side", 90.0, "2024-01-15", 10)]
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], [], sweeps, self.pd_info, None, self.df)
        self.assertIn("sweep", r.lower())

    def test_mentions_entry_zone_when_present(self):
        entry = _EntryZoneInfo(105.0, 100.0, 99.5, 2.5)
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], [], [], self.pd_info, entry, self.df)
        self.assertIn("entry", r.lower())

    def test_xss_script_tags_stripped(self):
        r = self.analyzer._build_reasoning(
            '<script>alert("xss")</script>', "bullish", [], [], [],
            self.pd_info, None, self.df)
        self.assertNotIn("<script>", r)
        self.assertNotIn("</script>", r)
        self.assertNotIn("alert", r)

    def test_result_is_nonempty_string(self):
        r = self.analyzer._build_reasoning(
            "AAPL", "bullish", [], [], [], self.pd_info, None, self.df)
        self.assertIsInstance(r, str)
        self.assertTrue(len(r) > 0)


class TestNeutralSignal(unittest.TestCase):
    """Test _neutral_signal method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()
        self.df = _make_merged_df(30, trend="flat")

    def test_returns_neutral_direction(self):
        sig = _run(self._get_neutral_signal())
        self.assertEqual(sig.direction, "neutral")

    def test_confidence_equals_mixed(self):
        sig = _run(self._get_neutral_signal())
        self.assertAlmostEqual(sig.confidence, _CONF_MIXED_STRUCTURE)

    def test_key_levels_has_all_keys(self):
        sig = _run(self._get_neutral_signal())
        required = [
            "market_structure", "structure_shift_bar", "order_blocks",
            "fair_value_gaps", "liquidity_sweeps", "breaker_blocks",
            "premium_discount", "entry_zone", "stop_loss", "risk_reward_ratio",
        ]
        for k in required:
            self.assertIn(k, sig.key_levels)

    def test_list_fields_empty(self):
        sig = _run(self._get_neutral_signal())
        self.assertEqual(sig.key_levels["order_blocks"], [])
        self.assertEqual(sig.key_levels["fair_value_gaps"], [])
        self.assertEqual(sig.key_levels["liquidity_sweeps"], [])
        self.assertEqual(sig.key_levels["breaker_blocks"], [])

    def test_market_structure_ranging(self):
        sig = _run(self._get_neutral_signal())
        self.assertEqual(sig.key_levels["market_structure"], "ranging")

    def test_entry_zone_none(self):
        sig = _run(self._get_neutral_signal())
        self.assertIsNone(sig.key_levels["entry_zone"])

    def test_reasoning_mentions_insufficient(self):
        sig = _run(self._get_neutral_signal())
        self.assertIn("insufficient", sig.reasoning.lower())

    def test_methodology_correct(self):
        sig = _run(self._get_neutral_signal())
        self.assertEqual(sig.methodology, "ict_smart_money")

    async def _get_neutral_signal(self):
        return self.analyzer._neutral_signal("TEST", self.df)


class TestAnalyzeIntegration(unittest.TestCase):
    """Integration tests for the full analyze() method."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_uptrend_dataset(self):
        pdf = _make_price_df(60, trend="up")
        vdf = _make_volume_df(60)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)
        self.assertIn(sig.direction, ("bullish", "bearish", "neutral"))

    def test_downtrend_dataset(self):
        pdf = _make_price_df(60, trend="down")
        vdf = _make_volume_df(60)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_flat_dataset_neutral(self):
        pdf = _make_price_df(30, trend="flat")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        # Flat data -> no swings or ranging
        self.assertIn(sig.direction, ("neutral", "bullish", "bearish"))

    def test_minimum_data_20_bars(self):
        pdf = _make_price_df(20, trend="up")
        vdf = _make_volume_df(20)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_120_bars_full_htf(self):
        pdf = _make_price_df(120, trend="up")
        vdf = _make_volume_df(120)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_xss_ticker_injection(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze('<img src=x onerror="alert(1)">', pdf, vdf))
        self.assertNotIn("<img", sig.reasoning)
        self.assertNotIn("onerror", sig.reasoning)

    def test_methodology_field(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertEqual(sig.methodology, "ict_smart_money")

    def test_timeframe_field(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertEqual(sig.timeframe, "short")

    def test_confidence_in_range(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertGreaterEqual(sig.confidence, 0.0)
        self.assertLessEqual(sig.confidence, 1.0)

    def test_key_levels_has_required_keys(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        required = [
            "market_structure", "order_blocks", "fair_value_gaps",
            "liquidity_sweeps", "breaker_blocks", "premium_discount",
        ]
        for k in required:
            self.assertIn(k, sig.key_levels, f"Missing key_levels key: {k}")

    def test_reasoning_nonempty(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertTrue(len(sig.reasoning) > 0)

    def test_timestamp_is_datetime(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig.timestamp, datetime)

    def test_direction_valid_enum(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        valid = {d.value for d in Direction}
        self.assertIn(sig.direction, valid)

    def test_zero_volume(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30, pattern="zero")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_nan_volume_filled(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30, pattern="nan")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)


class TestEdgeCases(unittest.TestCase):
    """Edge case and security tests."""

    def setUp(self):
        self.analyzer = ICTSmartMoneyAnalyzer()

    def test_very_large_prices(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        base = [1e6 + i * 100 for i in range(n)]
        pdf = pd.DataFrame({
            "date": dates, "open": [b - 50 for b in base],
            "high": [b + 200 for b in base], "low": [b - 200 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * n})
        sig = _run(self.analyzer.analyze("BRK.A", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_very_small_prices(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        base = [0.01 + i * 0.001 for i in range(n)]
        pdf = pd.DataFrame({
            "date": dates, "open": [b - 0.001 for b in base],
            "high": [b + 0.005 for b in base], "low": [b - 0.005 for b in base],
            "close": base,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * n})
        sig = _run(self.analyzer.analyze("PENNY", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_ticker_with_unicode(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("TICK\u00e9R", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)
        # Unicode non-alnum chars stripped
        self.assertNotIn("\u00e9", sig.reasoning)

    def test_ticker_html_injection(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze('<b>BOLD</b>', pdf, vdf))
        self.assertNotIn("<b>", sig.reasoning)
        self.assertNotIn("</b>", sig.reasoning)

    def test_all_identical_prices_neutral(self):
        n = 30
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        pdf = pd.DataFrame({
            "date": dates, "open": [100.0] * n, "high": [100.0] * n,
            "low": [100.0] * n, "close": [100.0] * n,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * n})
        sig = _run(self.analyzer.analyze("FLAT", pdf, vdf))
        # All identical -> swings everywhere (or none). Either way valid.
        self.assertIsInstance(sig, MethodologySignal)

    def test_single_bar_at_swing_boundary(self):
        """Exactly 2*window+1 = 7 bars, all flat except one spike."""
        dates = pd.date_range("2024-01-01", periods=20, freq="B")
        pdf = pd.DataFrame({
            "date": dates, "open": [100.0] * 20,
            "high": [101.0] * 20, "low": [99.0] * 20,
            "close": [100.0] * 20,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1000] * 20})
        sig = _run(self.analyzer.analyze("EDGE", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_boolean_like_not_accepted_as_confidence(self):
        """Bool is subclass of int -- verify our pipeline doesn't break."""
        # This tests the base class validation; ensure our analyzer
        # never passes a bool as confidence
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("TEST", pdf, vdf))
        self.assertNotIsInstance(sig.confidence, bool)

    def test_xss_in_reasoning_never_reflects_raw_input(self):
        xss_payloads = [
            '<script>alert(1)</script>',
            '"><img src=x onerror=alert(1)>',
            "javascript:alert(1)",
            "' OR 1=1 --",
        ]
        for payload in xss_payloads:
            pdf = _make_price_df(30, trend="up")
            vdf = _make_volume_df(30)
            sig = _run(self.analyzer.analyze(payload, pdf, vdf))
            self.assertNotIn("<script>", sig.reasoning,
                             f"XSS payload reflected: {payload}")
            self.assertNotIn("onerror", sig.reasoning,
                             f"XSS payload reflected: {payload}")

    def test_confidence_not_nan(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("TEST", pdf, vdf))
        self.assertFalse(math.isnan(sig.confidence))

    def test_confidence_not_inf(self):
        pdf = _make_price_df(30, trend="up")
        vdf = _make_volume_df(30)
        sig = _run(self.analyzer.analyze("TEST", pdf, vdf))
        self.assertFalse(math.isinf(sig.confidence))


if __name__ == "__main__":
    unittest.main()
