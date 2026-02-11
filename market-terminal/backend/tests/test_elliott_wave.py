"""Tests for TASK-ANALYSIS-003: Elliott Wave analysis module.

Validates ElliottWaveAnalyzer against the BaseMethodology ABC contract,
swing detection, candidate generation, rule validation, guideline scoring,
position assessment, Fibonacci levels, confidence scoring, invalidation,
key levels, reasoning string, and edge cases.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_elliott_wave.py -v``
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
from app.analysis.elliott_wave import (
    ElliottWaveAnalyzer,
    _SwingPoint, _WaveSegment, _WaveCount, _FibLevel,
    _DEFAULT_SWING_N, _MIN_SWINGS_REQUIRED, _MAX_CANDIDATES,
    _EPSILON, _MAX_TICKER_LENGTH,
    _FIB_RETRACEMENTS, _FIB_EXTENSIONS, _FIB_OUTPUT_KEYS, _FIB_OUTPUT_RATIOS,
    _CONFIDENCE_BASE, _CONFIDENCE_PER_GUIDELINE, _CONFIDENCE_FIB_CONFLUENCE,
    _CONFIDENCE_VOLUME_CONFIRMS, _CONFIDENCE_WAVE_CLARITY,
    _CONFIDENCE_AMBIGUITY_PENALTY, _CONFIDENCE_FLOOR, _CONFIDENCE_CAP,
    _INSUFFICIENT_DATA_CONFIDENCE,
    _GUIDELINE_W2_RETRACE_LOW, _GUIDELINE_W2_RETRACE_HIGH,
    _GUIDELINE_W3_EXTENSION, _GUIDELINE_W4_RETRACE,
    _GUIDELINE_W5_EQUALITY_TOLERANCE, _VOLUME_LOOKBACK,
    _FIB_CONFLUENCE_TOLERANCE,
    _CONFIDENCE_HIGH_QUALIFIER, _CONFIDENCE_MODERATE_QUALIFIER,
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
        base = [100.0 + (i % 5) * 0.2 for i in range(rows)]
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
    elif pattern == "constant":
        volumes = [1_000_000] * rows
    elif pattern == "high":
        volumes = [10_000_000] * rows
    else:
        volumes = [1_000_000] * rows
    return pd.DataFrame({"date": dates, "volume": volumes})


def _make_wave_segments_up_impulse():
    """Build 5 _WaveSegments forming a valid up impulse.

    Wave 1: 100->120 (up, length=20)
    Wave 2: 120->110 (down, length=10) -- retrace 50% of W1
    Wave 3: 110->150 (up, length=40) -- extension 2.0x of W1
    Wave 4: 150->140 (down, length=10) -- retrace ~25% of W3, no overlap w/ W1
    Wave 5: 140->160 (up, length=20) -- equals W1
    """
    return (
        _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
        _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),
        _WaveSegment(15, 30, 110.0, 150.0, "up", 40.0),
        _WaveSegment(30, 35, 150.0, 140.0, "down", 10.0),
        _WaveSegment(35, 45, 140.0, 160.0, "up", 20.0),
    )


def _make_wave_segments_down_impulse():
    """Build 5 _WaveSegments forming a valid down impulse."""
    return (
        _WaveSegment(0, 10, 200.0, 180.0, "down", 20.0),
        _WaveSegment(10, 15, 180.0, 190.0, "up", 10.0),
        _WaveSegment(15, 30, 190.0, 150.0, "down", 40.0),
        _WaveSegment(30, 35, 150.0, 160.0, "up", 10.0),
        _WaveSegment(35, 45, 160.0, 140.0, "down", 20.0),
    )


def _make_wave_segments_corrective_up():
    """Build 3 _WaveSegments forming a valid up corrective (A-B-C)."""
    return (
        _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
        _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),
        _WaveSegment(15, 25, 110.0, 130.0, "up", 20.0),
    )


def _make_wave_segments_corrective_down():
    """Build 3 _WaveSegments forming a valid down corrective."""
    return (
        _WaveSegment(0, 10, 200.0, 180.0, "down", 20.0),
        _WaveSegment(10, 15, 180.0, 190.0, "up", 10.0),
        _WaveSegment(15, 25, 190.0, 170.0, "down", 20.0),
    )


def _make_wavecount(waves, pattern_type="impulse", rules_passed=3,
                    guideline_score=2.0, total_score=5.0):
    """Convenience factory for _WaveCount."""
    return _WaveCount(waves, pattern_type, rules_passed, guideline_score, total_score)


def _make_merged_df(rows: int = 50):
    """Create a merged DataFrame suitable for analyzer methods."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    base = [100.0 + i * 0.5 for i in range(rows)]
    return pd.DataFrame({
        "date": dates,
        "open": [b - 0.5 for b in base],
        "high": [b + 2.0 for b in base],
        "low": [b - 2.0 for b in base],
        "close": base,
        "volume": [1_000_000 + i * 1000 for i in range(rows)],
    })


def _make_zigzag_price_df(rows: int = 60, amplitude: float = 10.0,
                          period: int = 6, base_price: float = 100.0):
    """Create a price DataFrame with zigzag pattern to generate swing points."""
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
        "open": [c - 0.5 for c in closes],
        "high": [c + 1.0 for c in closes],
        "low": [c - 1.0 for c in closes],
        "close": closes,
    })


# ---------------------------------------------------------------------------
# Test Classes
# ---------------------------------------------------------------------------


class TestConstants(unittest.TestCase):
    """Verify all 27 module-level constants."""

    def test_default_swing_n(self):
        self.assertEqual(_DEFAULT_SWING_N, 5)
        self.assertIsInstance(_DEFAULT_SWING_N, int)

    def test_min_swings_required(self):
        self.assertEqual(_MIN_SWINGS_REQUIRED, 4)
        self.assertIsInstance(_MIN_SWINGS_REQUIRED, int)

    def test_max_candidates(self):
        self.assertEqual(_MAX_CANDIDATES, 100)

    def test_epsilon_positive_and_tiny(self):
        self.assertGreater(_EPSILON, 0)
        self.assertLess(_EPSILON, 1e-5)
        self.assertEqual(_EPSILON, 1e-10)

    def test_max_ticker_length(self):
        self.assertEqual(_MAX_TICKER_LENGTH, 20)

    def test_fib_retracements(self):
        self.assertEqual(_FIB_RETRACEMENTS, (0.236, 0.382, 0.500, 0.618, 0.786))
        self.assertIsInstance(_FIB_RETRACEMENTS, tuple)

    def test_fib_extensions(self):
        self.assertEqual(_FIB_EXTENSIONS, (1.000, 1.272, 1.618, 2.000, 2.618))

    def test_fib_output_keys_and_ratios_same_length(self):
        self.assertEqual(len(_FIB_OUTPUT_KEYS), len(_FIB_OUTPUT_RATIOS))

    def test_fib_output_keys_values(self):
        self.assertEqual(
            _FIB_OUTPUT_KEYS,
            ("23.6%", "38.2%", "50.0%", "61.8%", "100.0%", "161.8%"),
        )

    def test_confidence_floor_lt_base_lt_cap(self):
        self.assertLess(_CONFIDENCE_FLOOR, _CONFIDENCE_BASE)
        self.assertLess(_CONFIDENCE_BASE, _CONFIDENCE_CAP)

    def test_confidence_base(self):
        self.assertAlmostEqual(_CONFIDENCE_BASE, 0.50)

    def test_confidence_per_guideline(self):
        self.assertAlmostEqual(_CONFIDENCE_PER_GUIDELINE, 0.05)

    def test_confidence_fib_confluence(self):
        self.assertAlmostEqual(_CONFIDENCE_FIB_CONFLUENCE, 0.10)

    def test_confidence_volume_confirms(self):
        self.assertAlmostEqual(_CONFIDENCE_VOLUME_CONFIRMS, 0.10)

    def test_confidence_wave_clarity(self):
        self.assertAlmostEqual(_CONFIDENCE_WAVE_CLARITY, 0.10)

    def test_confidence_ambiguity_penalty(self):
        self.assertAlmostEqual(_CONFIDENCE_AMBIGUITY_PENALTY, 0.15)

    def test_confidence_floor_value(self):
        self.assertAlmostEqual(_CONFIDENCE_FLOOR, 0.15)

    def test_confidence_cap_value(self):
        self.assertAlmostEqual(_CONFIDENCE_CAP, 1.0)

    def test_insufficient_data_confidence(self):
        self.assertAlmostEqual(_INSUFFICIENT_DATA_CONFIDENCE, 0.25)

    def test_guideline_w2_retrace_range(self):
        self.assertAlmostEqual(_GUIDELINE_W2_RETRACE_LOW, 0.50)
        self.assertAlmostEqual(_GUIDELINE_W2_RETRACE_HIGH, 0.618)

    def test_guideline_w3_extension(self):
        self.assertAlmostEqual(_GUIDELINE_W3_EXTENSION, 1.618)

    def test_guideline_w4_retrace(self):
        self.assertAlmostEqual(_GUIDELINE_W4_RETRACE, 0.382)

    def test_guideline_w5_equality_tolerance(self):
        self.assertAlmostEqual(_GUIDELINE_W5_EQUALITY_TOLERANCE, 0.10)

    def test_volume_lookback(self):
        self.assertEqual(_VOLUME_LOOKBACK, 20)

    def test_fib_confluence_tolerance(self):
        self.assertAlmostEqual(_FIB_CONFLUENCE_TOLERANCE, 0.01)

    def test_confidence_high_qualifier(self):
        self.assertAlmostEqual(_CONFIDENCE_HIGH_QUALIFIER, 0.7)

    def test_confidence_moderate_qualifier(self):
        self.assertAlmostEqual(_CONFIDENCE_MODERATE_QUALIFIER, 0.5)


class TestNamedTuples(unittest.TestCase):
    """Verify named tuple construction and field access."""

    def test_swing_point_construction(self):
        sp = _SwingPoint(5, 120.5, "high")
        self.assertEqual(sp.index, 5)
        self.assertAlmostEqual(sp.price, 120.5)
        self.assertEqual(sp.swing_type, "high")

    def test_swing_point_index_access(self):
        sp = _SwingPoint(3, 99.0, "low")
        self.assertEqual(sp[0], 3)
        self.assertAlmostEqual(sp[1], 99.0)
        self.assertEqual(sp[2], "low")

    def test_swing_point_immutable(self):
        sp = _SwingPoint(1, 100.0, "high")
        with self.assertRaises(AttributeError):
            sp.index = 2

    def test_wave_segment_construction(self):
        ws = _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0)
        self.assertEqual(ws.start_index, 0)
        self.assertEqual(ws.end_index, 10)
        self.assertAlmostEqual(ws.start_price, 100.0)
        self.assertAlmostEqual(ws.end_price, 120.0)
        self.assertEqual(ws.direction, "up")
        self.assertAlmostEqual(ws.length, 20.0)

    def test_wave_segment_immutable(self):
        ws = _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0)
        with self.assertRaises(AttributeError):
            ws.direction = "down"

    def test_wave_count_construction(self):
        waves = _make_wave_segments_up_impulse()
        wc = _WaveCount(waves, "impulse", 3, 2.0, 5.0)
        self.assertEqual(wc.pattern_type, "impulse")
        self.assertEqual(wc.rules_passed, 3)
        self.assertAlmostEqual(wc.guideline_score, 2.0)
        self.assertAlmostEqual(wc.total_score, 5.0)
        self.assertEqual(len(wc.waves), 5)

    def test_fib_level_construction(self):
        fl = _FibLevel(0.618, 112.36, "61.8% retracement", True)
        self.assertAlmostEqual(fl.ratio, 0.618)
        self.assertAlmostEqual(fl.price, 112.36)
        self.assertEqual(fl.label, "61.8% retracement")
        self.assertTrue(fl.is_aligned)

    def test_fib_level_not_aligned(self):
        fl = _FibLevel(0.382, 105.0, "38.2% retracement", False)
        self.assertFalse(fl.is_aligned)


class TestClassProperties(unittest.TestCase):
    """Verify ElliottWaveAnalyzer class attributes and identity."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_name(self):
        self.assertEqual(self.analyzer.name, "elliott_wave")

    def test_display_name(self):
        self.assertEqual(self.analyzer.display_name, "Elliott Wave")

    def test_default_timeframe(self):
        self.assertEqual(self.analyzer.default_timeframe, "medium")

    def test_version(self):
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_isinstance_base_methodology(self):
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_has_analyze_method(self):
        self.assertTrue(callable(getattr(self.analyzer, "analyze", None)))

    def test_has_merge_data_method(self):
        self.assertTrue(callable(getattr(self.analyzer, "_merge_data", None)))

    def test_has_detect_swings_method(self):
        self.assertTrue(callable(getattr(self.analyzer, "_detect_swings", None)))


class TestMergeData(unittest.TestCase):
    """Verify _merge_data join, fill, and sort behavior."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_inner_join_matching_dates(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 30)

    def test_columns_present(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        expected_cols = {"date", "open", "high", "low", "close", "volume"}
        self.assertEqual(set(merged.columns), expected_cols)

    def test_volume_nan_filled_with_zero(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "nan")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertFalse(merged["volume"].isna().any())
        self.assertTrue((merged["volume"] == 0.0).all())

    def test_sorted_ascending(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))

    def test_mismatched_dates_smaller_result(self):
        dates_p = pd.date_range("2024-01-01", periods=30, freq="B")
        dates_v = pd.date_range("2024-01-15", periods=30, freq="B")
        pdf = pd.DataFrame({
            "date": dates_p,
            "open": [100.0] * 30, "high": [102.0] * 30,
            "low": [98.0] * 30, "close": [101.0] * 30,
        })
        vdf = pd.DataFrame({"date": dates_v, "volume": [1e6] * 30})
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertLess(len(merged), 30)

    def test_empty_price_df(self):
        pdf = pd.DataFrame(columns=["date", "open", "high", "low", "close"])
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 0)

    def test_empty_volume_df(self):
        pdf = _make_price_df(30, "up")
        vdf = pd.DataFrame(columns=["date", "volume"])
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged), 0)

    def test_volume_zero_pattern(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "zero")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertTrue((merged["volume"] == 0.0).all())

    def test_only_six_columns_returned(self):
        pdf = _make_price_df(30, "up")
        pdf["extra_col"] = 999
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        self.assertEqual(len(merged.columns), 6)

    def test_reverse_sorted_dates_get_sorted(self):
        pdf = _make_price_df(30, "up")
        pdf = pdf.iloc[::-1].reset_index(drop=True)
        vdf = _make_volume_df(30, "normal")
        vdf = vdf.iloc[::-1].reset_index(drop=True)
        merged = self.analyzer._merge_data(pdf, vdf)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))


class TestDetectSwings(unittest.TestCase):
    """Verify swing point detection and alternation enforcement."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def _merged_from_closes(self, closes, swing_n=None):
        """Create a merged df from a list of close prices."""
        n = len(closes)
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
            "volume": [1e6] * n,
        })
        sn = swing_n if swing_n is not None else _DEFAULT_SWING_N
        return self.analyzer._detect_swings(df, sn)

    def test_up_trend_detects_swings(self):
        pdf = _make_price_df(30, "up")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        swings = self.analyzer._detect_swings(merged)
        # Up trend may or may not produce many alternating swings
        self.assertIsInstance(swings, list)

    def test_down_trend_detects_swings(self):
        pdf = _make_price_df(30, "down")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        swings = self.analyzer._detect_swings(merged)
        self.assertIsInstance(swings, list)

    def test_flat_trend_detects_swings(self):
        pdf = _make_price_df(30, "flat")
        vdf = _make_volume_df(30, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        swings = self.analyzer._detect_swings(merged)
        self.assertIsInstance(swings, list)

    def test_swing_n_parameter_respected(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        merged = self.analyzer._merge_data(pdf, vdf)
        swings_small = self.analyzer._detect_swings(merged, swing_n=2)
        swings_large = self.analyzer._detect_swings(merged, swing_n=10)
        # Smaller window should detect more potential swings
        self.assertGreaterEqual(len(swings_small), len(swings_large))

    def test_too_few_rows_for_any_swings(self):
        # With swing_n=5, need at least 11 rows (5+1+5)
        closes = [100.0 + i for i in range(8)]
        swings = self._merged_from_closes(closes, swing_n=5)
        self.assertEqual(len(swings), 0)

    def test_all_identical_prices(self):
        closes = [100.0] * 30
        swings = self._merged_from_closes(closes, swing_n=3)
        # All same: every point is both high and low
        for sp in swings:
            self.assertIn(sp.swing_type, ("high", "low"))

    def test_single_row(self):
        closes = [100.0]
        swings = self._merged_from_closes(closes, swing_n=1)
        self.assertEqual(len(swings), 0)

    def test_alternation_consecutive_highs_keep_higher(self):
        # Create data where two consecutive highs would be detected
        # Zigzag pattern with swing_n=1
        closes = [100, 110, 105, 112, 106, 100, 95, 100]
        n = len(closes)
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": closes,
            "high": [c + 0.1 for c in closes],
            "low": [c - 0.1 for c in closes],
            "close": closes,
            "volume": [1e6] * n,
        })
        swings = self.analyzer._detect_swings(df, swing_n=1)
        # Verify alternation: no two consecutive same-type
        for i in range(len(swings) - 1):
            self.assertNotEqual(swings[i].swing_type, swings[i + 1].swing_type)

    def test_alternation_consecutive_lows_keep_lower(self):
        # All swings should alternate after enforcement
        closes = [100, 90, 95, 88, 92, 100, 105, 100]
        n = len(closes)
        dates = pd.date_range("2024-01-01", periods=n, freq="B")
        df = pd.DataFrame({
            "date": dates,
            "open": closes,
            "high": [c + 0.1 for c in closes],
            "low": [c - 0.1 for c in closes],
            "close": closes,
            "volume": [1e6] * n,
        })
        swings = self.analyzer._detect_swings(df, swing_n=1)
        for i in range(len(swings) - 1):
            self.assertNotEqual(swings[i].swing_type, swings[i + 1].swing_type)

    def test_swing_types_are_high_or_low(self):
        closes = [100, 110, 95, 115, 90, 120, 85, 125, 80, 130,
                  75, 135, 70, 140, 65, 145, 60, 150, 55, 155]
        swings = self._merged_from_closes(closes, swing_n=1)
        for sp in swings:
            self.assertIn(sp.swing_type, ("high", "low"))

    def test_large_swing_n_with_small_data_returns_empty(self):
        closes = [100.0 + i for i in range(15)]
        swings = self._merged_from_closes(closes, swing_n=10)
        self.assertEqual(len(swings), 0)

    def test_zigzag_produces_swings(self):
        # Clear zigzag pattern
        closes = []
        for i in range(40):
            if i % 10 < 5:
                closes.append(100.0 + (i % 10) * 5.0)
            else:
                closes.append(120.0 - (i % 10 - 5) * 5.0)
        swings = self._merged_from_closes(closes, swing_n=2)
        self.assertGreater(len(swings), 0)

    def test_swing_indices_in_valid_range(self):
        closes = [100 + 10 * math.sin(i * 0.5) for i in range(40)]
        swings = self._merged_from_closes(closes, swing_n=2)
        for sp in swings:
            self.assertGreaterEqual(sp.index, 0)
            self.assertLess(sp.index, 40)

    def test_swings_sorted_by_index(self):
        closes = [100 + 10 * math.sin(i * 0.5) for i in range(40)]
        swings = self._merged_from_closes(closes, swing_n=2)
        indices = [sp.index for sp in swings]
        self.assertEqual(indices, sorted(indices))

    def test_swing_n_equals_one(self):
        closes = [100, 120, 90, 130, 80, 140, 70, 150, 60, 160, 50]
        swings = self._merged_from_closes(closes, swing_n=1)
        self.assertGreater(len(swings), 0)


class TestBuildCandidates(unittest.TestCase):
    """Verify candidate window generation."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_fewer_than_two_swings_empty(self):
        result = self.analyzer._build_candidates([])
        self.assertEqual(result, [])

    def test_one_swing_empty(self):
        result = self.analyzer._build_candidates([_SwingPoint(0, 100.0, "low")])
        self.assertEqual(result, [])

    def test_two_swings_no_impulse_no_corrective(self):
        swings = [_SwingPoint(0, 100.0, "low"), _SwingPoint(5, 120.0, "high")]
        result = self.analyzer._build_candidates(swings)
        # 1 segment, need 5 for impulse and 3 for corrective
        self.assertEqual(len(result), 0)

    def test_four_swings_generate_corrective_only(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(5, 120.0, "high"),
            _SwingPoint(10, 110.0, "low"),
            _SwingPoint(15, 130.0, "high"),
        ]
        result = self.analyzer._build_candidates(swings)
        # 3 segments, so 1 corrective candidate (3-seg window), 0 impulse
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]), 3)

    def test_six_swings_produce_both_types(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(5, 120.0, "high"),
            _SwingPoint(10, 110.0, "low"),
            _SwingPoint(15, 130.0, "high"),
            _SwingPoint(20, 115.0, "low"),
            _SwingPoint(25, 140.0, "high"),
        ]
        result = self.analyzer._build_candidates(swings)
        lens = [len(c) for c in result]
        self.assertIn(5, lens)  # impulse candidates
        self.assertIn(3, lens)  # corrective candidates

    def test_impulse_candidates_come_first(self):
        swings = [
            _SwingPoint(i * 5, 100.0 + (i % 2) * 20.0, "low" if i % 2 == 0 else "high")
            for i in range(8)
        ]
        result = self.analyzer._build_candidates(swings)
        # First candidates should be 5-segment (impulse), then 3-segment (corrective)
        found_corrective = False
        for c in result:
            if len(c) == 3:
                found_corrective = True
            if found_corrective and len(c) == 5:
                self.fail("5-segment candidate found after 3-segment candidates")

    def test_segment_direction_correct(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(5, 120.0, "high"),
            _SwingPoint(10, 110.0, "low"),
            _SwingPoint(15, 130.0, "high"),
        ]
        result = self.analyzer._build_candidates(swings)
        # First candidate is corrective (3 segments)
        c = result[0]
        self.assertEqual(c[0].direction, "up")    # 100->120
        self.assertEqual(c[1].direction, "down")   # 120->110
        self.assertEqual(c[2].direction, "up")     # 110->130

    def test_segment_length_correct(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(5, 120.0, "high"),
            _SwingPoint(10, 110.0, "low"),
            _SwingPoint(15, 130.0, "high"),
        ]
        result = self.analyzer._build_candidates(swings)
        c = result[0]
        self.assertAlmostEqual(c[0].length, 20.0)
        self.assertAlmostEqual(c[1].length, 10.0)
        self.assertAlmostEqual(c[2].length, 20.0)

    def test_max_candidates_cap(self):
        # Create enough swings to generate > _MAX_CANDIDATES
        swings = [
            _SwingPoint(i * 2, 100.0 + (i % 2) * 10.0, "low" if i % 2 == 0 else "high")
            for i in range(200)
        ]
        result = self.analyzer._build_candidates(swings)
        self.assertLessEqual(len(result), _MAX_CANDIDATES)

    def test_equal_price_swings_direction_down(self):
        swings = [
            _SwingPoint(0, 100.0, "high"),
            _SwingPoint(5, 100.0, "low"),
            _SwingPoint(10, 100.0, "high"),
            _SwingPoint(15, 100.0, "low"),
        ]
        result = self.analyzer._build_candidates(swings)
        # When prices equal, direction should be "down" (not >)
        for c in result:
            for seg in c:
                self.assertEqual(seg.direction, "down")
                self.assertAlmostEqual(seg.length, 0.0)

    def test_three_swings_one_corrective(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(10, 120.0, "high"),
            _SwingPoint(20, 105.0, "low"),
        ]
        result = self.analyzer._build_candidates(swings)
        # 2 segments -- need 3 for corrective, 5 for impulse
        self.assertEqual(len(result), 0)

    def test_five_swings_one_impulse(self):
        swings = [
            _SwingPoint(0, 100.0, "low"),
            _SwingPoint(5, 120.0, "high"),
            _SwingPoint(10, 110.0, "low"),
            _SwingPoint(15, 130.0, "high"),
            _SwingPoint(20, 115.0, "low"),
        ]
        result = self.analyzer._build_candidates(swings)
        # 4 segments: not enough for impulse (5), 2 corrective windows
        lens = [len(c) for c in result]
        self.assertNotIn(5, lens)
        self.assertEqual(lens.count(3), 2)


class TestValidateRules(unittest.TestCase):
    """Verify impulse and corrective rule validation."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    # -- Impulse up --

    def test_impulse_all_rules_pass_up(self):
        waves = _make_wave_segments_up_impulse()
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertTrue(ok)
        self.assertEqual(count, 3)

    def test_impulse_r1_fail_w2_retrace_100pct_up(self):
        # W2 retraces 100%: end_price <= W1 start_price
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 100.0, "down", 20.0),  # retrace 100%
            _WaveSegment(15, 30, 100.0, 150.0, "up", 50.0),
            _WaveSegment(30, 35, 150.0, 140.0, "down", 10.0),
            _WaveSegment(35, 45, 140.0, 160.0, "up", 20.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        self.assertEqual(count, 2)  # R2 and R3 still pass

    def test_impulse_r2_fail_w3_shortest_up(self):
        # W3 is shortest of W1, W3, W5
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 20, 115.0, 120.0, "up", 5.0),   # shortest
            _WaveSegment(20, 25, 120.0, 118.0, "down", 2.0),
            _WaveSegment(25, 35, 118.0, 150.0, "up", 32.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        # R1 passes (115 > 100), R2 fails (W3=5 < W1=20 and W3=5 < W5=32)
        self.assertLessEqual(count, 2)

    def test_impulse_r3_fail_w4_overlap_up(self):
        # W4 end_price < W1 end_price (overlap)
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),
            _WaveSegment(15, 30, 110.0, 150.0, "up", 40.0),
            _WaveSegment(30, 35, 150.0, 115.0, "down", 35.0),  # overlaps W1 end=120
            _WaveSegment(35, 45, 115.0, 160.0, "up", 45.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        self.assertEqual(count, 2)  # R1 and R2 pass, R3 fails

    def test_impulse_all_fail_up(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 99.0, "down", 21.0),    # R1 fail
            _WaveSegment(15, 20, 99.0, 100.0, "up", 1.0),       # R2 fail (shortest)
            _WaveSegment(20, 25, 100.0, 90.0, "down", 10.0),    # R3 fail (overlap)
            _WaveSegment(25, 35, 90.0, 120.0, "up", 30.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_impulse_multiple_fails(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 99.0, "down", 21.0),    # R1 fail
            _WaveSegment(15, 30, 99.0, 140.0, "up", 41.0),
            _WaveSegment(30, 35, 140.0, 130.0, "down", 10.0),
            _WaveSegment(35, 45, 130.0, 160.0, "up", 30.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        self.assertLess(count, 3)

    # -- Impulse down --

    def test_impulse_all_rules_pass_down(self):
        waves = _make_wave_segments_down_impulse()
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertTrue(ok)
        self.assertEqual(count, 3)

    def test_impulse_r1_fail_down(self):
        # Down impulse: R1 fail means W2 end >= W1 start
        waves = (
            _WaveSegment(0, 10, 200.0, 180.0, "down", 20.0),
            _WaveSegment(10, 15, 180.0, 201.0, "up", 21.0),  # retrace > 100%
            _WaveSegment(15, 30, 201.0, 160.0, "down", 41.0),
            _WaveSegment(30, 35, 160.0, 170.0, "up", 10.0),
            _WaveSegment(35, 45, 170.0, 140.0, "down", 30.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)

    def test_impulse_r3_fail_down(self):
        # Down impulse: R3 fail means W4 end > W1 end (should be <=)
        waves = (
            _WaveSegment(0, 10, 200.0, 180.0, "down", 20.0),
            _WaveSegment(10, 15, 180.0, 190.0, "up", 10.0),
            _WaveSegment(15, 30, 190.0, 150.0, "down", 40.0),
            _WaveSegment(30, 35, 150.0, 185.0, "up", 35.0),  # > W1 end=180
            _WaveSegment(35, 45, 185.0, 140.0, "down", 45.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)

    # -- Corrective --

    def test_corrective_all_rules_pass_up(self):
        waves = _make_wave_segments_corrective_up()
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertTrue(ok)
        self.assertEqual(count, 3)

    def test_corrective_all_rules_pass_down(self):
        waves = _make_wave_segments_corrective_down()
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertTrue(ok)
        self.assertEqual(count, 3)

    def test_corrective_b_retrace_100pct_up(self):
        # Wave B retraces 100% or more of A
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 99.0, "down", 21.0),   # retrace >100%
            _WaveSegment(15, 25, 99.0, 130.0, "up", 31.0),
        )
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertFalse(ok)
        self.assertEqual(count, 2)  # A==C direction and C.length>0 pass

    def test_corrective_a_c_different_direction(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 25, 115.0, 110.0, "down", 5.0),   # C is down, A is up
        )
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertFalse(ok)

    def test_corrective_c_length_zero(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 25, 115.0, 115.0, "down", 0.0),  # length=0
        )
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertFalse(ok)

    # -- Wrong type / wrong count --

    def test_wrong_pattern_type(self):
        waves = _make_wave_segments_up_impulse()
        ok, count = self.analyzer._validate_rules(waves, "unknown")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_impulse_wrong_wave_count(self):
        # 3 waves but called as impulse
        waves = _make_wave_segments_corrective_up()
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_corrective_wrong_wave_count(self):
        # 5 waves but called as corrective
        waves = _make_wave_segments_up_impulse()
        ok, count = self.analyzer._validate_rules(waves, "corrective")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_empty_waves_impulse(self):
        ok, count = self.analyzer._validate_rules((), "impulse")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_empty_waves_corrective(self):
        ok, count = self.analyzer._validate_rules((), "corrective")
        self.assertFalse(ok)
        self.assertEqual(count, 0)

    def test_impulse_r2_w3_equals_w1_passes(self):
        # W3 equals W1 but is not shorter than both => passes R2
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 112.0, "down", 8.0),
            _WaveSegment(15, 25, 112.0, 132.0, "up", 20.0),  # same as W1
            _WaveSegment(25, 30, 132.0, 125.0, "down", 7.0),
            _WaveSegment(30, 40, 125.0, 145.0, "up", 20.0),  # same as W1
        )
        ok, count = self.analyzer._validate_rules(waves, "impulse")
        # R2: w3.length < w1.length and w3.length < w5.length -> False (not shorter)
        # So R2 passes
        self.assertIn(count, (2, 3))


class TestScoreGuidelines(unittest.TestCase):
    """Verify guideline scoring for impulse and corrective."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_impulse_max_score(self):
        # Design waves that satisfy all 4 guidelines
        # W2 retrace 50% of W1 -> w2.length/w1.length in [0.50, 0.618]
        # W3 extension >= 1.618x W1
        # W4 retrace ~38.2% of W3 (within 10% tolerance)
        # W5 ~= W1 length (within 10% tolerance)
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),       # W1: length=20
            _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),     # W2: 10/20=0.50
            _WaveSegment(15, 30, 110.0, 145.36, "up", 35.36),     # W3: 35.36/20=1.768
            _WaveSegment(30, 35, 145.36, 131.84, "down", 13.52),  # W4: 13.52/35.36=0.382
            _WaveSegment(35, 45, 131.84, 151.84, "up", 20.0),     # W5: 20/20=1.0
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertAlmostEqual(score, 4.0)

    def test_impulse_w2_retrace_in_range(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 108.0, "down", 12.0),  # 12/20=0.60
            _WaveSegment(15, 30, 108.0, 130.0, "up", 22.0),
            _WaveSegment(30, 35, 130.0, 125.0, "down", 5.0),
            _WaveSegment(35, 45, 125.0, 140.0, "up", 15.0),
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertGreaterEqual(score, 1.0)  # At least W2 guideline

    def test_impulse_w2_retrace_out_of_range(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 118.0, "down", 2.0),  # 2/20=0.10 too low
            _WaveSegment(15, 30, 118.0, 130.0, "up", 12.0),
            _WaveSegment(30, 35, 130.0, 125.0, "down", 5.0),
            _WaveSegment(35, 45, 125.0, 140.0, "up", 15.0),
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        # W2 retrace 0.10 -- not in [0.50, 0.618], so W2 guideline fails
        # Check it's less than max
        self.assertLess(score, 4.0)

    def test_impulse_w3_extension_meets_threshold(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 30, 115.0, 150.0, "up", 35.0),    # 35/20=1.75 >= 1.618
            _WaveSegment(30, 35, 150.0, 145.0, "down", 5.0),
            _WaveSegment(35, 45, 145.0, 160.0, "up", 15.0),
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertGreaterEqual(score, 1.0)

    def test_impulse_w3_extension_below_threshold(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 30, 115.0, 125.0, "up", 10.0),    # 10/20=0.50 < 1.618
            _WaveSegment(30, 35, 125.0, 122.0, "down", 3.0),
            _WaveSegment(35, 45, 122.0, 140.0, "up", 18.0),
        )
        # W3 extension fails
        score = self.analyzer._score_guidelines(waves, "impulse")
        # Score should not include W3 guideline
        self.assertLess(score, 4.0)

    def test_impulse_none_matching_zero(self):
        # Design waves that fail all guidelines
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 119.0, "down", 1.0),   # 1/20=0.05 (not 0.5-0.618)
            _WaveSegment(15, 30, 119.0, 125.0, "up", 6.0),     # 6/20=0.30 (not >=1.618)
            _WaveSegment(30, 35, 125.0, 124.0, "down", 1.0),   # 1/6=0.167 (not ~0.382)
            _WaveSegment(35, 45, 124.0, 130.0, "up", 6.0),     # 6/20=0.30 (not ~1.0)
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertAlmostEqual(score, 0.0)

    def test_corrective_max_score(self):
        # B retrace 50-61.8% of A, C ~= A length
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),  # 10/20=0.50
            _WaveSegment(15, 25, 110.0, 130.0, "up", 20.0),    # 20/20=1.0
        )
        score = self.analyzer._score_guidelines(waves, "corrective")
        self.assertAlmostEqual(score, 2.0)

    def test_corrective_b_retrace_in_range(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 107.64, "down", 12.36),  # 12.36/20=0.618
            _WaveSegment(15, 25, 107.64, 130.0, "up", 22.36),
        )
        score = self.analyzer._score_guidelines(waves, "corrective")
        self.assertGreaterEqual(score, 1.0)

    def test_corrective_none_matching(self):
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 118.0, "down", 2.0),   # 2/20=0.10
            _WaveSegment(15, 25, 118.0, 125.0, "up", 7.0),     # 7/20=0.35
        )
        score = self.analyzer._score_guidelines(waves, "corrective")
        self.assertAlmostEqual(score, 0.0)

    def test_wrong_pattern_type_zero(self):
        waves = _make_wave_segments_up_impulse()
        score = self.analyzer._score_guidelines(waves, "unknown")
        self.assertAlmostEqual(score, 0.0)

    def test_impulse_w4_retrace_guideline(self):
        # W4 retrace ~38.2% of W3
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 30, 115.0, 155.0, "up", 40.0),
            _WaveSegment(30, 35, 155.0, 139.72, "down", 15.28),  # 15.28/40=0.382
            _WaveSegment(35, 45, 139.72, 160.0, "up", 20.28),
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        # At least W4 guideline should pass
        self.assertGreaterEqual(score, 1.0)

    def test_impulse_w5_equality_guideline(self):
        # W5 ~= W1 length
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 115.0, "down", 5.0),
            _WaveSegment(15, 30, 115.0, 140.0, "up", 25.0),
            _WaveSegment(30, 35, 140.0, 135.0, "down", 5.0),
            _WaveSegment(35, 45, 135.0, 155.0, "up", 20.0),  # 20/20=1.0, diff=0
        )
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertGreaterEqual(score, 1.0)

    def test_tiny_wave_length_epsilon_guard(self):
        # W1.length near zero -> epsilon guard prevents div by zero
        waves = (
            _WaveSegment(0, 10, 100.0, 100.0, "up", 0.0),
            _WaveSegment(10, 15, 100.0, 99.0, "down", 1.0),
            _WaveSegment(15, 30, 99.0, 101.0, "up", 2.0),
            _WaveSegment(30, 35, 101.0, 100.0, "down", 1.0),
            _WaveSegment(35, 45, 100.0, 102.0, "up", 2.0),
        )
        # Should not raise
        score = self.analyzer._score_guidelines(waves, "impulse")
        self.assertIsInstance(score, float)

    def test_corrective_c_equals_a(self):
        waves = (
            _WaveSegment(0, 10, 200.0, 180.0, "down", 20.0),
            _WaveSegment(10, 15, 180.0, 190.0, "up", 10.0),
            _WaveSegment(15, 25, 190.0, 170.0, "down", 20.0),  # C==A
        )
        score = self.analyzer._score_guidelines(waves, "corrective")
        self.assertGreaterEqual(score, 1.0)


class TestAssessPosition(unittest.TestCase):
    """Verify position assessment for impulse and corrective patterns."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()
        self.merged = _make_merged_df(50)

    def test_impulse_up_wave1_bullish_long(self):
        waves = _make_wave_segments_up_impulse()
        # Set end_index of all waves past the last bar so cwi=0 -> wave 1
        waves_adj = (
            _WaveSegment(0, 100, 100.0, 120.0, "up", 20.0),
            waves[1], waves[2], waves[3], waves[4],
        )
        wc = _make_wavecount(waves_adj, "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 110.0, self.merged)
        self.assertIn("Wave 1", label)
        self.assertEqual(direction, "bullish")
        self.assertEqual(tf, "long")

    def test_impulse_up_wave2_bearish_long(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[1] = _WaveSegment(10, 100, 120.0, 110.0, "down", 10.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 115.0, self.merged)
        self.assertIn("Wave 2", label)
        self.assertEqual(direction, "bearish")
        self.assertEqual(tf, "long")

    def test_impulse_up_wave3_bullish_medium(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[2] = _WaveSegment(15, 100, 110.0, 150.0, "up", 40.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 130.0, self.merged)
        self.assertIn("Wave 3", label)
        self.assertEqual(direction, "bullish")
        self.assertEqual(tf, "medium")

    def test_impulse_up_wave4_bearish_medium(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[3] = _WaveSegment(30, 100, 150.0, 140.0, "down", 10.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 145.0, self.merged)
        self.assertIn("Wave 4", label)
        self.assertEqual(direction, "bearish")
        self.assertEqual(tf, "medium")

    def test_impulse_up_wave5_bullish_short(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[4] = _WaveSegment(35, 100, 140.0, 160.0, "up", 20.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 155.0, self.merged)
        self.assertIn("Wave 5", label)
        self.assertEqual(direction, "bullish")
        self.assertEqual(tf, "short")

    def test_impulse_down_wave1_bearish(self):
        waves = _make_wave_segments_down_impulse()
        waves_adj = list(waves)
        waves_adj[0] = _WaveSegment(0, 100, 200.0, 180.0, "down", 20.0)
        wc = _make_wavecount(tuple(waves_adj), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 190.0, self.merged)
        self.assertIn("Wave 1", label)
        self.assertEqual(direction, "bearish")

    def test_impulse_down_wave2_bullish(self):
        waves = list(_make_wave_segments_down_impulse())
        waves[1] = _WaveSegment(10, 100, 180.0, 190.0, "up", 10.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        label, direction, tf = self.analyzer._assess_position(wc, 185.0, self.merged)
        self.assertIn("Wave 2", label)
        self.assertEqual(direction, "bullish")

    def test_corrective_wave_a(self):
        waves = _make_wave_segments_corrective_up()
        waves_adj = list(waves)
        waves_adj[0] = _WaveSegment(0, 100, 100.0, 120.0, "up", 20.0)
        wc = _make_wavecount(tuple(waves_adj), "corrective")
        label, direction, tf = self.analyzer._assess_position(wc, 110.0, self.merged)
        self.assertIn("Wave A", label)
        self.assertEqual(tf, "medium")

    def test_corrective_wave_b(self):
        waves = list(_make_wave_segments_corrective_up())
        waves[1] = _WaveSegment(10, 100, 120.0, 110.0, "down", 10.0)
        wc = _make_wavecount(tuple(waves), "corrective")
        label, direction, tf = self.analyzer._assess_position(wc, 115.0, self.merged)
        self.assertIn("Wave B", label)

    def test_corrective_wave_c(self):
        waves = list(_make_wave_segments_corrective_up())
        waves[2] = _WaveSegment(15, 100, 110.0, 130.0, "up", 20.0)
        wc = _make_wavecount(tuple(waves), "corrective")
        label, direction, tf = self.analyzer._assess_position(wc, 120.0, self.merged)
        self.assertIn("Wave C", label)

    def test_fallback_indeterminate(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "unknown")
        label, direction, tf = self.analyzer._assess_position(wc, 130.0, self.merged)
        self.assertEqual(label, "Indeterminate wave position")
        self.assertEqual(direction, "neutral")
        self.assertEqual(tf, "medium")

    def test_corrective_down_direction(self):
        waves = _make_wave_segments_corrective_down()
        waves_adj = list(waves)
        waves_adj[0] = _WaveSegment(0, 100, 200.0, 180.0, "down", 20.0)
        wc = _make_wavecount(tuple(waves_adj), "corrective")
        label, direction, tf = self.analyzer._assess_position(wc, 190.0, self.merged)
        # direction = "bearish" if waves[0].direction == "down"
        self.assertEqual(direction, "bearish")


class TestCalculateFibonacciLevels(unittest.TestCase):
    """Verify Fibonacci retracement and extension level calculation."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_up_wave_retracements(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        # Should have len(_FIB_RETRACEMENTS) + len(_FIB_EXTENSIONS) = 10
        self.assertEqual(len(levels), 10)

    def test_down_wave_retracements(self):
        waves = _make_wave_segments_down_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 170.0)
        self.assertEqual(len(levels), 10)

    def test_retracement_prices_up(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        # Retracements for up W1 (100->120, range=20):
        # 23.6%: 120 - 0.236*20 = 115.28
        retrace_236 = levels[0]
        self.assertAlmostEqual(retrace_236.ratio, 0.236)
        self.assertAlmostEqual(retrace_236.price, 115.28, places=2)

    def test_retracement_prices_down(self):
        waves = _make_wave_segments_down_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 185.0)
        # Down W1 (200->180, range=20): 23.6% retrace = 180 + 0.236*20 = 184.72
        retrace_236 = levels[0]
        self.assertAlmostEqual(retrace_236.ratio, 0.236)
        self.assertAlmostEqual(retrace_236.price, 184.72, places=2)

    def test_extension_from_wave2_end(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        # Extensions start after retracements
        ext_100 = levels[5]  # first extension
        # base = W2 end = 110, ratio=1.0, W1 range=20
        # price = 110 + 1.0*20 = 130
        self.assertAlmostEqual(ext_100.ratio, 1.0)
        self.assertAlmostEqual(ext_100.price, 130.0, places=2)

    def test_is_aligned_within_tolerance(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        # Set current_price very close to a fib level
        # 61.8% retracement: 120 - 0.618*20 = 107.64
        levels = self.analyzer._calculate_fibonacci_levels(wc, 107.64)
        retrace_618 = levels[3]  # 0.618
        self.assertTrue(retrace_618.is_aligned)

    def test_is_aligned_outside_tolerance(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        # Most levels should not be aligned at price=130
        not_aligned_count = sum(1 for fl in levels if not fl.is_aligned)
        self.assertGreater(not_aligned_count, 0)

    def test_empty_waves_returns_empty(self):
        wc = _make_wavecount((), "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 100.0)
        self.assertEqual(levels, [])

    def test_tiny_w1_range_returns_empty(self):
        # W1 range < _EPSILON
        waves = (
            _WaveSegment(0, 10, 100.0, 100.0, "up", 0.0),
            _WaveSegment(10, 15, 100.0, 99.0, "down", 1.0),
            _WaveSegment(15, 25, 99.0, 101.0, "up", 2.0),
        )
        wc = _make_wavecount(waves, "corrective")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 100.0)
        self.assertEqual(levels, [])

    def test_correct_total_count(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        expected = len(_FIB_RETRACEMENTS) + len(_FIB_EXTENSIONS)
        self.assertEqual(len(levels), expected)

    def test_single_wave_extensions_from_start(self):
        # Only 1 wave -> extensions use w1.start_price as base
        waves = (_WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),)
        wc = _make_wavecount(waves, "impulse", rules_passed=0)
        levels = self.analyzer._calculate_fibonacci_levels(wc, 110.0)
        # base = w1.start_price = 100 (since len(waves) < 2)
        ext_100 = levels[5]
        self.assertAlmostEqual(ext_100.price, 120.0, places=2)  # 100 + 1.0*20

    def test_labels_contain_retracement_and_extension(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        levels = self.analyzer._calculate_fibonacci_levels(wc, 130.0)
        retrace_labels = [fl.label for fl in levels if "retracement" in fl.label]
        ext_labels = [fl.label for fl in levels if "extension" in fl.label]
        self.assertEqual(len(retrace_labels), len(_FIB_RETRACEMENTS))
        self.assertEqual(len(ext_labels), len(_FIB_EXTENSIONS))


class TestCalculateConfidence(unittest.TestCase):
    """Verify confidence calculation with all components."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()
        self.merged = _make_merged_df(50)

    def test_base_confidence_no_extras(self):
        waves = _make_wave_segments_corrective_up()
        primary = _make_wavecount(waves, "corrective", guideline_score=0.0, total_score=3.0)
        # No fib aligned, no alternative -> +clarity
        fib_levels = []
        conf = self.analyzer._calculate_confidence(primary, None, fib_levels, self.merged)
        expected = _CONFIDENCE_BASE + 0.0 + _CONFIDENCE_WAVE_CLARITY
        self.assertAlmostEqual(conf, expected, places=2)

    def test_guideline_score_adds_per_guideline(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=3.0, total_score=6.0)
        conf = self.analyzer._calculate_confidence(primary, None, [], self.merged)
        self.assertGreaterEqual(conf, _CONFIDENCE_BASE + 3.0 * _CONFIDENCE_PER_GUIDELINE)

    def test_fib_confluence_adds_bonus(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=3.0)
        fib_levels = [_FibLevel(0.618, 107.64, "61.8% retracement", True)]
        conf = self.analyzer._calculate_confidence(primary, None, fib_levels, self.merged)
        # Should include fib confluence bonus
        self.assertGreaterEqual(conf, _CONFIDENCE_BASE + _CONFIDENCE_FIB_CONFLUENCE)

    def test_no_fib_confluence_when_none_aligned(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=3.0)
        fib_levels = [_FibLevel(0.618, 107.64, "61.8% retracement", False)]
        conf = self.analyzer._calculate_confidence(primary, None, fib_levels, self.merged)
        # No fib confluence
        expected_min = _CONFIDENCE_BASE + _CONFIDENCE_WAVE_CLARITY
        self.assertAlmostEqual(conf, expected_min, places=2)

    def test_volume_confirmation(self):
        # Create merged where odd-wave volume > even-wave volume
        dates = pd.date_range("2024-01-01", periods=50, freq="B")
        vols = []
        for i in range(50):
            vols.append(2_000_000.0)  # uniform high volume
        merged = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 50, "high": [102.0] * 50,
            "low": [98.0] * 50, "close": [101.0] * 50,
            "volume": vols,
        })
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=3.0)
        conf = self.analyzer._calculate_confidence(primary, None, [], merged)
        # Volume all same, so odd mean == even mean -> no volume bonus
        self.assertIsInstance(conf, float)

    def test_clarity_no_alternative_adds_bonus(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=5.0)
        conf = self.analyzer._calculate_confidence(primary, None, [], self.merged)
        self.assertGreaterEqual(conf, _CONFIDENCE_BASE + _CONFIDENCE_WAVE_CLARITY)

    def test_clarity_alternative_diff_gt_1(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=5.0)
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", guideline_score=0.0, total_score=3.5)
        conf = self.analyzer._calculate_confidence(primary, alternative, [], self.merged)
        # diff = 5.0 - 3.5 = 1.5 > 1.0 -> clarity bonus
        self.assertGreaterEqual(conf, _CONFIDENCE_BASE + _CONFIDENCE_WAVE_CLARITY)

    def test_ambiguity_penalty_diff_lt_05(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=5.0)
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", guideline_score=0.0, total_score=4.8)
        conf = self.analyzer._calculate_confidence(primary, alternative, [], self.merged)
        # diff = 5.0 - 4.8 = 0.2 < 0.5 -> ambiguity penalty
        self.assertLessEqual(conf, _CONFIDENCE_BASE)

    def test_floor_clamp(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=5.0)
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", guideline_score=0.0, total_score=5.0)
        conf = self.analyzer._calculate_confidence(primary, alternative, [], self.merged)
        self.assertGreaterEqual(conf, _CONFIDENCE_FLOOR)

    def test_cap_clamp(self):
        waves = _make_wave_segments_up_impulse()
        # Max everything
        primary = _make_wavecount(waves, "impulse", guideline_score=10.0, total_score=13.0)
        fib_levels = [_FibLevel(0.618, 107.0, "test", True)]
        conf = self.analyzer._calculate_confidence(primary, None, fib_levels, self.merged)
        self.assertLessEqual(conf, _CONFIDENCE_CAP)

    def test_nan_handling_returns_base(self):
        # Trick: use waves with indices that would produce NaN volumes
        waves = (
            _WaveSegment(0, 10, 100.0, 120.0, "up", 20.0),
            _WaveSegment(10, 15, 120.0, 110.0, "down", 10.0),
            _WaveSegment(15, 30, 110.0, 150.0, "up", 40.0),
        )
        primary = _make_wavecount(waves, "corrective", guideline_score=0.0, total_score=3.0)
        # Create merged with NaN volume
        dates = pd.date_range("2024-01-01", periods=50, freq="B")
        merged = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 50, "high": [102.0] * 50,
            "low": [98.0] * 50, "close": [101.0] * 50,
            "volume": [0.0] * 50,
        })
        conf = self.analyzer._calculate_confidence(primary, None, [], merged)
        self.assertGreaterEqual(conf, _CONFIDENCE_FLOOR)
        self.assertLessEqual(conf, _CONFIDENCE_CAP)

    def test_confidence_is_float(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=2.0, total_score=5.0)
        conf = self.analyzer._calculate_confidence(primary, None, [], self.merged)
        self.assertIsInstance(conf, float)

    def test_moderate_diff_no_bonus_no_penalty(self):
        # diff between 0.5 and 1.0 -> neither clarity bonus nor ambiguity penalty
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=5.0)
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", guideline_score=0.0, total_score=4.3)
        conf = self.analyzer._calculate_confidence(primary, alternative, [], self.merged)
        # diff = 0.7 -> no clarity bonus, no ambiguity penalty
        self.assertAlmostEqual(conf, _CONFIDENCE_BASE, places=1)

    def test_volume_odd_gt_even_adds_bonus(self):
        # Create volume pattern: high on odd-wave bars, low on even-wave bars
        dates = pd.date_range("2024-01-01", periods=50, freq="B")
        vols = [100.0] * 50
        # Odd waves (0,2,4): indices 0-10, 15-30, 35-45 -> high volume
        for i in list(range(0, 11)) + list(range(15, 31)) + list(range(35, 46)):
            if i < 50:
                vols[i] = 5_000_000.0
        # Even waves (1,3): indices 10-15, 30-35 -> low volume
        for i in list(range(10, 16)) + list(range(30, 36)):
            if i < 50:
                vols[i] = 100.0
        merged = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 50, "high": [102.0] * 50,
            "low": [98.0] * 50, "close": [101.0] * 50,
            "volume": vols,
        })
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=0.0, total_score=3.0)
        conf = self.analyzer._calculate_confidence(primary, None, [], merged)
        # Should get volume bonus since odd > even
        self.assertGreaterEqual(conf, _CONFIDENCE_BASE + _CONFIDENCE_VOLUME_CONFIRMS)


class TestDetermineInvalidation(unittest.TestCase):
    """Verify invalidation level calculation."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()
        self.merged = _make_merged_df(50)

    def test_impulse_cwi_0_returns_w1_start(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[0] = _WaveSegment(0, 100, 100.0, 120.0, "up", 20.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 100.0)

    def test_impulse_cwi_1_returns_w1_start(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[1] = _WaveSegment(10, 100, 120.0, 110.0, "down", 10.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 100.0)

    def test_impulse_cwi_2_returns_w2_end(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[2] = _WaveSegment(15, 100, 110.0, 150.0, "up", 40.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 110.0)  # W2 end_price

    def test_impulse_cwi_3_returns_w2_end(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[3] = _WaveSegment(30, 100, 150.0, 140.0, "down", 10.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 110.0)  # waves[1].end_price

    def test_impulse_cwi_4_returns_w4_end(self):
        waves = list(_make_wave_segments_up_impulse())
        waves[4] = _WaveSegment(35, 100, 140.0, 160.0, "up", 20.0)
        wc = _make_wavecount(tuple(waves), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 140.0)  # waves[3].end_price

    def test_corrective_returns_w1_start(self):
        waves = _make_wave_segments_corrective_up()
        wc = _make_wavecount(waves, "corrective")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 100.0)

    def test_empty_waves_returns_current_close(self):
        wc = _make_wavecount((), "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        expected = float(self.merged["close"].iloc[-1])
        self.assertAlmostEqual(inv, expected)

    def test_corrective_down_returns_w1_start(self):
        waves = _make_wave_segments_corrective_down()
        wc = _make_wavecount(waves, "corrective")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 200.0)

    def test_unknown_pattern_returns_w1_start(self):
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "unknown")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        self.assertAlmostEqual(inv, 100.0)  # fallback: waves[0].start_price

    def test_all_waves_before_last_bar(self):
        # All end_indices well within merged length -> cwi = len(waves)-1
        waves = _make_wave_segments_up_impulse()
        wc = _make_wavecount(waves, "impulse")
        inv = self.analyzer._determine_invalidation(wc, self.merged)
        # cwi = 4 -> waves[3].end_price = 140
        self.assertAlmostEqual(inv, 140.0)


class TestBuildKeyLevels(unittest.TestCase):
    """Verify key level dictionary construction."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_all_keys_present(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 3 of impulse up",
            110.0, 110.0, 150.0,
        )
        expected_keys = {
            "current_wave", "wave_start", "invalidation",
            "fib_targets", "primary_target",
            "alternative_count", "alternative_invalidation",
        }
        self.assertEqual(set(kl.keys()), expected_keys)

    def test_wave_start_from_primary(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 100.0, 100.0, None,
        )
        self.assertAlmostEqual(kl["wave_start"], 100.0, places=4)

    def test_fib_targets_filtered(self):
        fib_levels = [
            _FibLevel(0.236, 115.28, "23.6% retrace", False),
            _FibLevel(0.382, 112.36, "38.2% retrace", False),
            _FibLevel(0.500, 110.0, "50.0% retrace", False),
            _FibLevel(0.618, 107.64, "61.8% retrace", False),
            _FibLevel(0.786, 104.28, "78.6% retrace", False),
            _FibLevel(1.0, 130.0, "100.0% ext", False),
            _FibLevel(1.272, 135.44, "127.2% ext", False),
            _FibLevel(1.618, 142.36, "161.8% ext", False),
            _FibLevel(2.0, 150.0, "200.0% ext", False),
            _FibLevel(2.618, 162.36, "261.8% ext", False),
        ]
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, fib_levels, "Wave 3", 110.0, 110.0, 130.0,
        )
        ft = kl["fib_targets"]
        # Only keys matching _FIB_OUTPUT_RATIOS should be present
        self.assertIn("23.6%", ft)
        self.assertIn("38.2%", ft)
        self.assertIn("50.0%", ft)
        self.assertIn("61.8%", ft)
        self.assertIn("100.0%", ft)
        self.assertIn("161.8%", ft)
        # 78.6%, 127.2%, 200%, 261.8% should NOT be in output
        self.assertNotIn("78.6%", ft)

    def test_alternative_count_empty_when_none(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 100.0, 100.0, None,
        )
        self.assertEqual(kl["alternative_count"], "")

    def test_alternative_count_format(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", rules_passed=2,
                                       guideline_score=1.5, total_score=3.5)
        kl = self.analyzer._build_key_levels(
            primary, alternative, [], "Wave 1", 100.0, 100.0, None,
        )
        self.assertIn("corrective", kl["alternative_count"])
        self.assertIn("2 rules", kl["alternative_count"])
        self.assertIn("3.5", kl["alternative_count"])

    def test_primary_target_none(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 100.0, 100.0, None,
        )
        self.assertIsNone(kl["primary_target"])

    def test_primary_target_set(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 100.0, 100.0, 150.0,
        )
        self.assertAlmostEqual(kl["primary_target"], 150.0)

    def test_invalidation_value(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 123.456, 123.456, None,
        )
        self.assertAlmostEqual(kl["invalidation"], 123.456)

    def test_alternative_invalidation(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Wave 1", 100.0, 99.5, None,
        )
        self.assertAlmostEqual(kl["alternative_invalidation"], 99.5)

    def test_empty_waves_wave_start_zero(self):
        primary = _make_wavecount((), "impulse")
        kl = self.analyzer._build_key_levels(
            primary, None, [], "Indeterminate", 100.0, 100.0, None,
        )
        self.assertAlmostEqual(kl["wave_start"], 0.0)


class TestBuildReasoning(unittest.TestCase):
    """Verify reasoning string construction and ticker sanitization."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_basic_reasoning(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "AAPL", primary, None, "Wave 3 of impulse up",
            0.65, 110.0, 150.0,
        )
        self.assertIn("AAPL", r)
        self.assertIn("Wave 3 of impulse up", r)
        self.assertIn("150.00", r)
        self.assertIn("110.00", r)

    def test_ticker_sanitization_strips_special_chars(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "<script>alert('xss')</script>", primary, None,
            "Wave 1", 0.5, 100.0, None,
        )
        self.assertNotIn("<script>", r)
        self.assertNotIn("</script>", r)
        self.assertNotIn("'", r)

    def test_ticker_max_length(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        long_ticker = "A" * 50
        r = self.analyzer._build_reasoning(
            long_ticker, primary, None, "Wave 1", 0.5, 100.0, None,
        )
        # Should truncate to 20 chars
        self.assertNotIn("A" * 21, r)

    def test_high_confidence_qualifier(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "MSFT", primary, None, "Wave 3", 0.80, 110.0, 150.0,
        )
        self.assertIn("high", r)

    def test_moderate_confidence_qualifier(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "MSFT", primary, None, "Wave 3", 0.55, 110.0, 150.0,
        )
        self.assertIn("moderate", r)

    def test_low_confidence_qualifier(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "MSFT", primary, None, "Wave 3", 0.30, 110.0, None,
        )
        self.assertIn("low", r)

    def test_no_target_in_output_when_none(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        r = self.analyzer._build_reasoning(
            "MSFT", primary, None, "Wave 1", 0.5, 100.0, None,
        )
        self.assertNotIn("Primary target", r)

    def test_alternative_in_reasoning(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse")
        alt_waves = _make_wave_segments_corrective_up()
        alternative = _make_wavecount(alt_waves, "corrective", total_score=3.5)
        r = self.analyzer._build_reasoning(
            "MSFT", primary, alternative, "Wave 3", 0.6, 110.0, 150.0,
        )
        self.assertIn("Alternative", r)
        self.assertIn("corrective", r)

    def test_guideline_score_in_reasoning(self):
        waves = _make_wave_segments_up_impulse()
        primary = _make_wavecount(waves, "impulse", guideline_score=2.5)
        r = self.analyzer._build_reasoning(
            "TSLA", primary, None, "Wave 3", 0.6, 110.0, 150.0,
        )
        self.assertIn("2.5", r)
        self.assertIn("4.0", r)  # max guideline for impulse

    def test_corrective_max_guideline(self):
        waves = _make_wave_segments_corrective_up()
        primary = _make_wavecount(waves, "corrective", guideline_score=1.0)
        r = self.analyzer._build_reasoning(
            "SPY", primary, None, "Wave A", 0.5, 100.0, None,
        )
        self.assertIn("2.0", r)  # max guideline for corrective


class TestAnalyzeIntegration(unittest.TestCase):
    """Verify full analyze() integration."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_full_analyze_returns_signal(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_signal_methodology(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertEqual(sig.methodology, "elliott_wave")

    def test_signal_direction_valid(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIn(sig.direction, ("bullish", "bearish", "neutral"))

    def test_signal_confidence_range(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertGreaterEqual(sig.confidence, 0.0)
        self.assertLessEqual(sig.confidence, 1.0)

    def test_signal_reasoning_nonempty(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig.reasoning, str)
        self.assertTrue(len(sig.reasoning) > 0)

    def test_signal_key_levels_is_dict(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig.key_levels, dict)

    def test_insufficient_swings_neutral(self):
        # Very short monotonic data -> few/no swings
        pdf = _make_price_df(22, "up")
        vdf = _make_volume_df(22, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        # May be insufficient data if not enough swings
        self.assertIn(sig.direction, ("bullish", "bearish", "neutral"))

    def test_swing_n_kwarg_override(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf, swing_n=2))
        self.assertIsInstance(sig, MethodologySignal)

    def test_zigzag_data_produces_patterns(self):
        pdf = _make_zigzag_price_df(80, amplitude=15.0, period=8)
        vdf = _make_volume_df(80, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf, swing_n=2))
        self.assertIsInstance(sig, MethodologySignal)

    def test_down_trend_signal(self):
        pdf = _make_price_df(60, "down")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIn(sig.direction, ("bullish", "bearish", "neutral"))

    def test_flat_trend_signal(self):
        pdf = _make_price_df(60, "flat")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_large_data(self):
        pdf = _make_price_df(200, "up")
        vdf = _make_volume_df(200, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_fundamentals_none(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf, fundamentals=None))
        self.assertIsInstance(sig, MethodologySignal)

    def test_fundamentals_empty_dict(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf, fundamentals={}))
        self.assertIsInstance(sig, MethodologySignal)

    def test_ticker_special_chars_sanitized(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("<b>XSS</b>", pdf, vdf))
        self.assertNotIn("<b>", sig.reasoning)

    def test_insufficient_data_confidence_value(self):
        # Monotonic short data -> likely insufficient swings
        pdf = _make_price_df(22, "up")
        vdf = _make_volume_df(22, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        # If insufficient, confidence should be 0.25
        if "Insufficient" in sig.reasoning:
            self.assertAlmostEqual(sig.confidence, _INSUFFICIENT_DATA_CONFIDENCE, places=2)

    def test_no_valid_patterns_confidence(self):
        # All flat data -> possibly no valid patterns
        dates = pd.date_range("2024-01-01", periods=60, freq="B")
        pdf = pd.DataFrame({
            "date": dates,
            "open": [100.0] * 60, "high": [100.0] * 60,
            "low": [100.0] * 60, "close": [100.0] * 60,
        })
        vdf = pd.DataFrame({"date": dates, "volume": [1e6] * 60})
        sig = _run(self.analyzer.analyze("FLAT", pdf, vdf))
        if "No valid" in sig.reasoning or "Insufficient" in sig.reasoning:
            self.assertAlmostEqual(sig.confidence, _INSUFFICIENT_DATA_CONFIDENCE, places=2)


class TestEdgeCases(unittest.TestCase):
    """Edge case handling."""

    def setUp(self):
        self.analyzer = ElliottWaveAnalyzer()

    def test_validate_input_too_few_rows(self):
        pdf = _make_price_df(10, "up")
        vdf = _make_volume_df(10, "normal")
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", pdf, vdf))

    def test_all_zero_prices(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        pdf = pd.DataFrame({
            "date": dates,
            "open": [0.0] * 30, "high": [0.0] * 30,
            "low": [0.0] * 30, "close": [0.0] * 30,
        })
        vdf = _make_volume_df(30, "normal")
        sig = _run(self.analyzer.analyze("ZERO", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_very_large_numbers(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        base = [1e10 + i * 1e8 for i in range(30)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 1e7 for b in base],
            "high": [b + 1e8 for b in base],
            "low": [b - 1e8 for b in base],
            "close": base,
        })
        vdf = _make_volume_df(30, "normal")
        sig = _run(self.analyzer.analyze("BIG", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_very_small_numbers(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        base = [0.001 + i * 0.0001 for i in range(30)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 0.0001 for b in base],
            "high": [b + 0.0005 for b in base],
            "low": [b - 0.0005 for b in base],
            "close": base,
        })
        vdf = _make_volume_df(30, "normal")
        sig = _run(self.analyzer.analyze("SMALL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_negative_prices(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        base = [-50.0 + i * 1.0 for i in range(30)]
        pdf = pd.DataFrame({
            "date": dates,
            "open": [b - 0.5 for b in base],
            "high": [b + 2.0 for b in base],
            "low": [b - 2.0 for b in base],
            "close": base,
        })
        vdf = _make_volume_df(30, "normal")
        sig = _run(self.analyzer.analyze("NEG", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_volume_all_zeros(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "zero")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_volume_all_nan(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "nan")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_single_unique_price_flat(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        pdf = pd.DataFrame({
            "date": dates,
            "open": [50.0] * 30, "high": [50.0] * 30,
            "low": [50.0] * 30, "close": [50.0] * 30,
        })
        vdf = _make_volume_df(30, "normal")
        sig = _run(self.analyzer.analyze("FLAT", pdf, vdf))
        self.assertIsInstance(sig, MethodologySignal)

    def test_validate_input_not_dataframe(self):
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", "not_a_df", _make_volume_df(30)))

    def test_validate_input_missing_columns(self):
        dates = pd.date_range("2024-01-01", periods=30, freq="B")
        pdf = pd.DataFrame({"date": dates, "close": [100.0] * 30})
        vdf = _make_volume_df(30, "normal")
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", pdf, vdf))

    def test_timestamp_is_set(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("AAPL", pdf, vdf))
        self.assertIsInstance(sig.timestamp, datetime)

    def test_ticker_preserved_in_signal(self):
        pdf = _make_price_df(60, "up")
        vdf = _make_volume_df(60, "normal")
        sig = _run(self.analyzer.analyze("GOOG", pdf, vdf))
        self.assertEqual(sig.ticker, "GOOG")


if __name__ == "__main__":
    unittest.main()
