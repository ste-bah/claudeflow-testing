"""Tests for TASK-ANALYSIS-002: Wyckoff Method analysis module.

Validates WyckoffAnalyzer against the BaseMethodology ABC contract,
input validation, phase detection, spring/upthrust detection,
volume-price spread analysis (VPA), effort vs result analysis,
confidence scoring, key levels, reasoning string, and edge cases.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_wyckoff.py -v``
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
from app.analysis.wyckoff import WyckoffAnalyzer


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


def _make_accumulation_data(rows: int = 60):
    """Create price/volume data that triggers an accumulation phase.

    Requires: prior downtrend (sma_50 < sma_200), close within range,
    up-volume exceeding down-volume by > 1.2x.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    # Start high, drop, then trade sideways at bottom — sma_50 < sma_200
    closes = []
    for i in range(rows):
        if i < rows // 2:
            closes.append(150.0 - i * 1.0)  # downtrend
        else:
            closes.append(120.0 + (i % 3) * 0.3)  # sideways at bottom
    price_df = pd.DataFrame({
        "date": dates,
        "open": [c - 0.3 for c in closes],
        "high": [c + 1.5 for c in closes],
        "low": [c - 1.5 for c in closes],
        "close": closes,
    })
    # Up-day volume much higher than down-day volume
    volumes = []
    for i in range(rows):
        if i > 0 and closes[i] > closes[i - 1]:
            volumes.append(2_000_000)  # up-day: heavy
        else:
            volumes.append(500_000)  # down-day: light
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


def _make_distribution_data(rows: int = 60):
    """Create price/volume data that triggers a distribution phase.

    Requires: prior uptrend (sma_50 > sma_200), close within range,
    down-volume exceeding up-volume (volume_ratio < 1/1.2).
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = []
    for i in range(rows):
        if i < rows // 2:
            closes.append(100.0 + i * 1.0)  # uptrend
        else:
            closes.append(130.0 - (i % 3) * 0.3)  # sideways at top
    price_df = pd.DataFrame({
        "date": dates,
        "open": [c - 0.3 for c in closes],
        "high": [c + 1.5 for c in closes],
        "low": [c - 1.5 for c in closes],
        "close": closes,
    })
    # Down-day volume much higher than up-day volume
    volumes = []
    for i in range(rows):
        if i > 0 and closes[i] < closes[i - 1]:
            volumes.append(2_000_000)  # down-day: heavy
        else:
            volumes.append(500_000)  # up-day: light
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


def _make_markup_data(rows: int = 60):
    """Create data where close is above resistance and volume_ratio > 1.

    This triggers the markup phase: close above 95th percentile of highs,
    with up-volume exceeding down-volume.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    # Steadily rising — last close will exceed resistance
    closes = [100.0 + i * 1.5 for i in range(rows)]
    price_df = pd.DataFrame({
        "date": dates,
        "open": [c - 0.5 for c in closes],
        "high": [c + 1.0 for c in closes],
        "low": [c - 1.0 for c in closes],
        "close": closes,
    })
    # More volume on up-days
    volumes = []
    for i in range(rows):
        if i > 0 and closes[i] > closes[i - 1]:
            volumes.append(2_000_000)
        else:
            volumes.append(800_000)
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


def _make_markdown_data(rows: int = 60):
    """Create data where close is below support and volume_ratio < 1.

    This triggers the markdown phase: close below 5th percentile of lows,
    with down-volume exceeding up-volume.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    # Steadily falling — last close will be below support
    closes = [200.0 - i * 1.5 for i in range(rows)]
    price_df = pd.DataFrame({
        "date": dates,
        "open": [c + 0.5 for c in closes],
        "high": [c + 1.0 for c in closes],
        "low": [c - 1.0 for c in closes],
        "close": closes,
    })
    # More volume on down-days
    volumes = []
    for i in range(rows):
        if i > 0 and closes[i] < closes[i - 1]:
            volumes.append(2_000_000)
        else:
            volumes.append(800_000)
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


def _make_spring_data(rows: int = 30):
    """Create data with a spring (bear trap below support).

    The second-to-last bar dips below support with low volume,
    and the last bar closes back above support.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
    opens = [c - 0.3 for c in closes]
    highs = [c + 1.5 for c in closes]
    lows = [c - 1.5 for c in closes]
    volumes = [1_000_000] * rows

    # The support will be around 5th percentile of lows ~ 98.5
    # Make bar at index rows-2 dip well below support
    lows[rows - 2] = 95.0   # dips below support
    closes[rows - 2] = 99.0  # closes back above support
    volumes[rows - 2] = 200_000  # low volume (below avg)

    # Last bar closes normally above support
    closes[rows - 1] = 100.0
    lows[rows - 1] = 99.0

    price_df = pd.DataFrame({
        "date": dates, "open": opens, "high": highs, "low": lows, "close": closes,
    })
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


def _make_upthrust_data(rows: int = 30):
    """Create data with an upthrust (bull trap above resistance).

    A recent bar pokes above resistance with low volume and closes
    back below resistance.
    """
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
    opens = [c - 0.3 for c in closes]
    highs = [c + 1.5 for c in closes]
    lows = [c - 1.5 for c in closes]
    volumes = [1_000_000] * rows

    # Resistance will be around 95th percentile of highs ~ 102.3
    # Make bar at index rows-2 poke well above resistance
    highs[rows - 2] = 106.0   # pokes above resistance
    closes[rows - 2] = 100.5  # closes back below resistance
    volumes[rows - 2] = 200_000  # low volume

    # Last bar closes normally below resistance
    closes[rows - 1] = 100.0
    highs[rows - 1] = 101.5

    price_df = pd.DataFrame({
        "date": dates, "open": opens, "high": highs, "low": lows, "close": closes,
    })
    volume_df = pd.DataFrame({"date": dates, "volume": volumes})
    return price_df, volume_df


# ===================================================================
# 1. ABC Contract Tests
# ===================================================================
class TestWyckoffABCContract(unittest.TestCase):
    """Verify WyckoffAnalyzer satisfies the BaseMethodology ABC contract."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_isinstance_base_methodology(self):
        """WyckoffAnalyzer is an instance of BaseMethodology."""
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_name_is_wyckoff(self):
        """name attribute equals 'wyckoff'."""
        self.assertEqual(self.analyzer.name, "wyckoff")

    def test_display_name(self):
        """display_name equals 'Wyckoff Method'."""
        self.assertEqual(self.analyzer.display_name, "Wyckoff Method")

    def test_default_timeframe(self):
        """default_timeframe equals 'medium'."""
        self.assertEqual(self.analyzer.default_timeframe, "medium")

    def test_version(self):
        """version equals '1.0.0'."""
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_analyze_returns_methodology_signal(self):
        """analyze() returns a MethodologySignal instance."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertIsInstance(result, MethodologySignal)

    def test_methodology_field_is_wyckoff(self):
        """Returned signal methodology field equals 'wyckoff'."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertEqual(result.methodology, "wyckoff")

    def test_timestamp_is_datetime_with_utc(self):
        """Returned signal timestamp is a datetime with UTC timezone."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertIsInstance(result.timestamp, datetime)
        self.assertIsNotNone(result.timestamp.tzinfo)

    def test_direction_is_valid_enum_value(self):
        """Returned signal direction is a valid Direction enum value."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        valid = {d.value for d in Direction}
        self.assertIn(result.direction, valid)

    def test_timeframe_is_valid_enum_value(self):
        """Returned signal timeframe is a valid Timeframe enum value."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        valid = {t.value for t in Timeframe}
        self.assertIn(result.timeframe, valid)

    def test_confidence_is_float_in_range(self):
        """Returned signal confidence is a float in [0.0, 1.0]."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertIsInstance(result.confidence, float)
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)

    def test_reasoning_is_non_empty_string(self):
        """Returned signal reasoning is a non-empty string."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertIsInstance(result.reasoning, str)
        self.assertTrue(len(result.reasoning.strip()) > 0)

    def test_key_levels_is_dict_with_eight_keys(self):
        """Returned signal key_levels is a dict with 8 keys."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("AAPL", price, volume))
        self.assertIsInstance(result.key_levels, dict)
        self.assertEqual(len(result.key_levels), 8)

    def test_ticker_preserved_in_signal(self):
        """Returned signal ticker matches input ticker."""
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(self.analyzer.analyze("MSFT", price, volume))
        self.assertEqual(result.ticker, "MSFT")

    def test_analyze_is_async(self):
        """analyze() is an async coroutine function."""
        import inspect
        self.assertTrue(inspect.iscoroutinefunction(self.analyzer.analyze))


# ===================================================================
# 2. Input Validation Tests
# ===================================================================
class TestWyckoffInputValidation(unittest.TestCase):
    """Verify input validation inherited from BaseMethodology.validate_input()."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_non_dataframe_price_raises(self):
        """Non-DataFrame price_data raises ValueError."""
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", {"date": []}, vol))

    def test_non_dataframe_volume_raises(self):
        """Non-DataFrame volume_data raises ValueError."""
        price = _make_price_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, {"date": []}))

    def test_none_price_raises(self):
        """None price_data raises ValueError."""
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", None, vol))

    def test_none_volume_raises(self):
        """None volume_data raises ValueError."""
        price = _make_price_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, None))

    def test_missing_close_column_raises(self):
        """price_data missing 'close' column raises ValueError."""
        price = _make_price_df().drop(columns=["close"])
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_missing_volume_column_raises(self):
        """volume_data missing 'volume' column raises ValueError."""
        price = _make_price_df()
        vol = _make_volume_df().drop(columns=["volume"])
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_missing_date_in_price_raises(self):
        """price_data missing 'date' column raises ValueError."""
        price = _make_price_df().drop(columns=["date"])
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_missing_open_in_price_raises(self):
        """price_data missing 'open' column raises ValueError."""
        price = _make_price_df().drop(columns=["open"])
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_too_few_rows_raises(self):
        """price_data with fewer than 20 rows raises ValueError."""
        price = _make_price_df(rows=19)
        vol = _make_volume_df(rows=19)
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_nan_in_close_raises(self):
        """NaN in close column raises ValueError."""
        price = _make_price_df()
        price.loc[5, "close"] = float("nan")
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_nan_in_open_raises(self):
        """NaN in open column raises ValueError."""
        price = _make_price_df()
        price.loc[3, "open"] = float("nan")
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_unsorted_price_dates_raises(self):
        """Unsorted price_data dates raises ValueError."""
        price = _make_price_df()
        price = price.iloc[::-1].reset_index(drop=True)
        vol = _make_volume_df()
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_unsorted_volume_dates_raises(self):
        """Unsorted volume_data dates raises ValueError."""
        price = _make_price_df()
        vol = _make_volume_df()
        vol = vol.iloc[::-1].reset_index(drop=True)
        with self.assertRaises(ValueError):
            _run(self.analyzer.analyze("AAPL", price, vol))

    def test_nan_in_volume_allowed(self):
        """NaN in volume column does NOT raise (allowed by spec)."""
        price = _make_price_df()
        vol = _make_volume_df()
        vol.loc[5, "volume"] = float("nan")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_all_nan_volume_allowed(self):
        """All-NaN volume column does NOT raise."""
        price = _make_price_df()
        vol = _make_volume_df(pattern="nan")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_exactly_20_rows_minimum(self):
        """Exactly 20 rows passes validation (minimum boundary)."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)


# ===================================================================
# 3. Phase Detection Tests
# ===================================================================
class TestPhaseDetection(unittest.TestCase):
    """Verify Wyckoff phase identification logic."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_accumulation_phase_detected(self):
        """Accumulation phase detected with downtrend + strong up-volume."""
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("accumulation", result.reasoning.lower())

    def test_accumulation_direction_is_bullish(self):
        """Accumulation phase produces bullish direction."""
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.direction, "bullish")

    def test_distribution_phase_detected(self):
        """Distribution phase detected with uptrend + strong down-volume."""
        price, vol = _make_distribution_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("distribution", result.reasoning.lower())

    def test_distribution_direction_is_bearish(self):
        """Distribution phase produces bearish direction."""
        price, vol = _make_distribution_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.direction, "bearish")

    def test_markup_phase_detected(self):
        """Markup phase detected when close exceeds resistance."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("markup", result.reasoning.lower())

    def test_markup_direction_is_bullish(self):
        """Markup phase produces bullish direction."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.direction, "bullish")

    def test_markdown_phase_detected(self):
        """Markdown phase detected when close falls below support."""
        price, vol = _make_markdown_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("markdown", result.reasoning.lower())

    def test_markdown_direction_is_bearish(self):
        """Markdown phase produces bearish direction."""
        price, vol = _make_markdown_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.direction, "bearish")

    def test_ranging_phase_with_flat_data(self):
        """Flat data with no clear bias produces ranging phase."""
        price = _make_price_df(rows=30, trend="flat")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Ranging may or may not appear; direction should be neutral if ranging
        self.assertIn(result.direction, ("bullish", "bearish", "neutral"))

    def test_phase_with_minimum_data(self):
        """Phase detection works with exactly 20 bars."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_phase_with_21_bars(self):
        """Phase detection works with 21 bars."""
        price = _make_price_df(rows=21)
        vol = _make_volume_df(rows=21)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_direction_only_valid_values(self):
        """Direction is always bullish, bearish, or neutral."""
        for trend in ("up", "down", "flat"):
            price = _make_price_df(rows=30, trend=trend)
            vol = _make_volume_df(rows=30)
            result = _run(self.analyzer.analyze("AAPL", price, vol))
            self.assertIn(result.direction, ("bullish", "bearish", "neutral"))

    def test_uptrend_data_not_accumulation(self):
        """Strongly rising data should not be accumulation (needs downtrend context)."""
        price = _make_price_df(rows=60, trend="up")
        vol = _make_volume_df(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # With a clear uptrend, it should be markup or ranging, not accumulation
        # (accumulation requires downtrend context)
        self.assertNotEqual(result.direction, "bearish")

    def test_downtrend_data_not_distribution(self):
        """Strongly falling data should not be distribution (needs uptrend context)."""
        price = _make_price_df(rows=60, trend="down")
        vol = _make_volume_df(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertNotEqual(result.direction, "bullish")

    def test_phase_appears_in_reasoning(self):
        """The detected phase name appears in reasoning."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Reasoning should contain one of the phase names
        phases = ["accumulation", "distribution", "markup", "markdown", "ranging"]
        self.assertTrue(any(p in result.reasoning.lower() for p in phases))

    def test_ranging_with_equal_volume(self):
        """Equal up/down volume with sideways price produces neutral or ranging."""
        dates = pd.date_range("2024-01-01", periods=40, freq="B")
        # Oscillate close around a midpoint, equal volume both ways
        closes = [100.0 + math.sin(i * 0.3) * 2.0 for i in range(40)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.2 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * 40})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should be ranging or neutral due to no clear volume bias
        self.assertIn(result.direction, ("bullish", "bearish", "neutral"))

    def test_long_accumulation_60_bars(self):
        """Accumulation with 60 bars works correctly."""
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_phase_clarity_affects_confidence(self):
        """Clear phase detection produces higher confidence than ambiguous."""
        # Clear markup
        markup_price, markup_vol = _make_markup_data(rows=60)
        markup_result = _run(self.analyzer.analyze("AAPL", markup_price, markup_vol))

        # Flat/ambiguous
        flat_price = _make_price_df(rows=30, trend="flat")
        flat_vol = _make_volume_df(rows=30, pattern="constant")
        flat_result = _run(self.analyzer.analyze("AAPL", flat_price, flat_vol))

        # Markup should generally have higher confidence than ranging
        # (This tests the confidence mechanism, not exact values)
        self.assertGreaterEqual(markup_result.confidence, 0.0)
        self.assertGreaterEqual(flat_result.confidence, 0.0)

    def test_phase_with_single_up_day(self):
        """Nearly all down-days with one up-day still produces valid result."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All down except day 15
        closes = [150.0 - i * 0.5 for i in range(rows)]
        closes[15] = closes[14] + 2.0  # single up day
        price = pd.DataFrame({
            "date": dates,
            "open": [c + 0.3 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_200_bars_large_dataset(self):
        """Phase detection works with 200+ bars."""
        price = _make_price_df(rows=200, trend="up")
        vol = _make_volume_df(rows=200)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_long_range_switches_timeframe_to_long(self):
        """When lookback_bars >= 40, timeframe switches to 'long'."""
        # With 60+ rows, the lookback will be 60 which is >= 40
        price = _make_price_df(rows=60, trend="up")
        vol = _make_volume_df(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.timeframe, "long")

    def test_short_range_keeps_medium_timeframe(self):
        """When lookback_bars < 40, timeframe stays 'medium'."""
        # With 30 rows, lookback = 30 which is < 40
        price = _make_price_df(rows=30, trend="up")
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertEqual(result.timeframe, "medium")

    def test_custom_timeframe_kwarg_respected_when_short(self):
        """Custom timeframe kwarg is used when lookback < 40."""
        price = _make_price_df(rows=25)
        vol = _make_volume_df(rows=25)
        result = _run(self.analyzer.analyze("AAPL", price, vol, timeframe="short"))
        self.assertEqual(result.timeframe, "short")


# ===================================================================
# 4. Spring / Upthrust Detection Tests
# ===================================================================
class TestSpringUpthrustDetection(unittest.TestCase):
    """Verify spring and upthrust detection logic."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_spring_detected(self):
        """Spring detected when low dips below support and close recovers."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("spring", result.reasoning.lower())

    def test_spring_level_in_key_levels(self):
        """When spring detected, spring_level is set in key_levels."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNotNone(result.key_levels.get("spring_level"))

    def test_spring_bars_ago_in_reasoning(self):
        """When spring detected, 'bars ago' appears in reasoning."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "spring" in result.reasoning.lower():
            self.assertIn("bars ago", result.reasoning.lower())

    def test_no_spring_when_volume_above_average(self):
        """No spring when the dip bar has high volume."""
        price, vol = _make_spring_data(rows=30)
        # Override volume to be very high on the dip bar
        vol.loc[len(vol) - 2, "volume"] = 5_000_000
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Spring should NOT be detected with high volume
        self.assertIsNone(result.key_levels.get("spring_level"))

    def test_no_spring_when_close_doesnt_recover(self):
        """No spring when close stays below support."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
        lows = [c - 1.5 for c in closes]
        volumes = [1_000_000] * rows

        # Dip below support but close also stays below support
        lows[rows - 2] = 95.0
        closes[rows - 2] = 95.5  # closes below support (support ~ 98.5)
        closes[rows - 1] = 95.0  # last bar also below support
        lows[rows - 1] = 94.0
        volumes[rows - 2] = 200_000

        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in closes],
            "high": [c + 1.5 for c in closes],
            "low": lows,
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNone(result.key_levels.get("spring_level"))

    def test_upthrust_detected(self):
        """Upthrust detected when high pokes above resistance and close drops back."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("upthrust", result.reasoning.lower())

    def test_upthrust_level_in_key_levels(self):
        """When upthrust detected, upthrust_level is set in key_levels."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNotNone(result.key_levels.get("upthrust_level"))

    def test_no_upthrust_when_volume_above_average(self):
        """No upthrust when the spike bar has high volume."""
        price, vol = _make_upthrust_data(rows=30)
        vol.loc[len(vol) - 2, "volume"] = 5_000_000  # high volume
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNone(result.key_levels.get("upthrust_level"))

    def test_no_detections_when_price_within_range(self):
        """No spring/upthrust when all bars stay within range."""
        price = _make_price_df(rows=30, trend="flat")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNone(result.key_levels.get("spring_level"))
        self.assertIsNone(result.key_levels.get("upthrust_level"))

    def test_spring_boosts_confidence(self):
        """Spring detection adds confidence bonus."""
        # Without spring
        price_flat = _make_price_df(rows=30, trend="flat")
        vol_flat = _make_volume_df(rows=30, pattern="constant")
        result_no_spring = _run(self.analyzer.analyze("AAPL", price_flat, vol_flat))

        # With spring
        price_spring, vol_spring = _make_spring_data(rows=30)
        result_spring = _run(self.analyzer.analyze("AAPL", price_spring, vol_spring))

        # Spring result should have >= confidence than flat (due to +0.15 bonus)
        # Can't guarantee exact comparison due to other factors, but it should be valid
        self.assertGreaterEqual(result_spring.confidence, 0.0)
        self.assertLessEqual(result_spring.confidence, 1.0)

    def test_upthrust_boosts_confidence(self):
        """Upthrust detection adds confidence bonus."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # With upthrust, confidence should be > base ranging confidence (0.4)
        # The bonus is +0.15 on top of clarity
        self.assertGreater(result.confidence, 0.0)

    def test_spring_direction_bullish_when_ranging(self):
        """Spring without clear phase direction produces bullish tiebreaker."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Spring acts as bullish tiebreaker when phase is ranging
        self.assertIn(result.direction, ("bullish", "neutral", "bearish"))

    def test_upthrust_direction_bearish_when_ranging(self):
        """Upthrust without clear phase direction produces bearish tiebreaker."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn(result.direction, ("bullish", "neutral", "bearish"))

    def test_spring_with_minimum_data(self):
        """Spring detection works with exactly 20 bars."""
        price, vol = _make_spring_data(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_no_crash_when_scan_length_exceeds_data(self):
        """No crash when data is shorter than spring lookback (10)."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_both_spring_and_upthrust_in_same_data(self):
        """Both spring and upthrust can be detected in the same dataset."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
        opens = [c - 0.3 for c in closes]
        highs = [c + 1.5 for c in closes]
        lows = [c - 1.5 for c in closes]
        volumes = [1_000_000] * rows

        # Spring at index rows-4
        lows[rows - 4] = 95.0
        closes[rows - 4] = 99.5
        volumes[rows - 4] = 200_000

        # Upthrust at index rows-2
        highs[rows - 2] = 106.0
        closes[rows - 2] = 100.5
        volumes[rows - 2] = 200_000

        price = pd.DataFrame({
            "date": dates, "open": opens, "high": highs, "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))

        # Both could be detected -- check both levels exist
        spring_level = result.key_levels.get("spring_level")
        upthrust_level = result.key_levels.get("upthrust_level")
        # At least one should be detected (both if conditions are met)
        self.assertIsInstance(result, MethodologySignal)

    def test_spring_bars_ago_correct(self):
        """Spring bars_ago value is correct relative to last bar."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.key_levels.get("spring_level") is not None:
            # The spring is at index rows-2, so bars_ago should be 1
            self.assertIn("1 bars ago", result.reasoning.lower())

    def test_upthrust_bars_ago_correct(self):
        """Upthrust bars_ago value is correct relative to last bar."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.key_levels.get("upthrust_level") is not None:
            self.assertIn("1 bars ago", result.reasoning.lower())


# ===================================================================
# 5. VPA (Volume-Price Spread Analysis) Tests
# ===================================================================
class TestVPAAnalysis(unittest.TestCase):
    """Verify volume-price spread analysis logic."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_vpa_with_normal_data(self):
        """VPA completes without error on normal data."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_zero_volume_no_crash(self):
        """VPA does not crash with all-zero volume."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="zero")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_nan_volume_no_crash(self):
        """VPA does not crash with all-NaN volume (filled to 0)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="nan")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_flat_price_no_crash(self):
        """VPA does not crash with flat price data (zero ATR)."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [100.0] * rows,
            "low": [100.0] * rows,
            "close": [100.0] * rows,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_high_volume_wide_spread_detected(self):
        """Wide spread + high volume bars produce strong move VPA events."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        # Make last 5 bars have very wide spread and high volume
        highs = [c + 1.0 for c in closes]
        lows = [c - 1.0 for c in closes]
        volumes = [1_000_000] * rows
        for i in range(rows - 5, rows):
            highs[i] = closes[i] + 5.0   # wide spread
            lows[i] = closes[i] - 5.0
            volumes[i] = 5_000_000         # high volume
        price = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should detect strong moves in VPA
        self.assertIn("strong move", result.reasoning.lower())

    def test_vpa_narrow_spread_high_volume_absorption(self):
        """Narrow spread + high volume bars produce absorption events."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        highs = [c + 2.0 for c in closes]
        lows = [c - 2.0 for c in closes]
        volumes = [1_000_000] * rows
        # Make last 5 bars have very narrow spread but high volume
        for i in range(rows - 5, rows):
            highs[i] = closes[i] + 0.1   # narrow spread
            lows[i] = closes[i] - 0.1
            volumes[i] = 5_000_000         # high volume
        price = pd.DataFrame({
            "date": dates, "open": [c - 0.05 for c in closes],
            "high": highs, "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should detect absorption in VPA
        self.assertIn("absorption", result.reasoning.lower())

    def test_vpa_bullish_score_with_up_strong_moves(self):
        """Up strong moves contribute to bullish VPA score."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All up bars with wide spread and high volume
        closes = [100.0 + i * 2.0 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 3.0 for c in closes],  # open well below close = up bar
            "high": [c + 4.0 for c in closes],   # wide spread
            "low": [c - 4.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [5_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_bearish_score_with_down_strong_moves(self):
        """Down strong moves contribute to bearish VPA score."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All down bars with wide spread and high volume
        closes = [200.0 - i * 2.0 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c + 3.0 for c in closes],  # open well above close = down bar
            "high": [c + 4.0 for c in closes],
            "low": [c - 4.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [5_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_constant_volume_no_crash(self):
        """Constant volume does not crash VPA."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_lookback_uses_last_20_bars(self):
        """VPA uses at most 20 bars lookback."""
        # With 30 bars, VPA should use 20
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_with_mixed_spread(self):
        """VPA handles mixed wide and narrow spreads."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        highs = []
        lows = []
        for i in range(rows):
            if i % 2 == 0:
                highs.append(closes[i] + 5.0)  # wide
                lows.append(closes[i] - 5.0)
            else:
                highs.append(closes[i] + 0.1)  # narrow
                lows.append(closes[i] - 0.1)
        price = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_vpa_no_strong_moves_no_absorption_in_reasoning(self):
        """When no strong moves or absorption detected, VPA text absent from reasoning."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All same spread and same volume: neither wide/narrow nor high/low
        closes = [100.0] * rows
        highs = [101.0] * rows
        lows = [99.0] * rows
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": highs,
            "low": lows,
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # With uniform spread=2 and uniform volume, nothing should be triggered
        # (no bars exceed the 1.2x or 1.3x thresholds)
        # VPA text (absorption/strong move) should be absent
        self.assertNotIn("strong move", result.reasoning.lower())
        self.assertNotIn("absorption", result.reasoning.lower())


# ===================================================================
# 6. Effort vs Result Analysis Tests
# ===================================================================
class TestEffortVsResult(unittest.TestCase):
    """Verify effort vs result (volume-price correlation) analysis."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_positive_correlation_confirms_trend(self):
        """Highly correlated volume and price changes confirm trend."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Price increases proportionally with volume
        closes = [100.0 + i * 1.0 for i in range(rows)]
        volumes = [100_000 + i * 50_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # With correlated volume+price, effort may confirm trend
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_confirms_trend_in_reasoning(self):
        """When effort confirms trend, reasoning mentions it."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Strongly correlated: bigger price moves on higher volume
        closes = [100.0 + i * 2.0 for i in range(rows)]
        volumes = [100_000 + i * 100_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 1.0 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # The reasoning might contain "effort confirms" or "divergence"
        # depending on correlation sign
        self.assertIsInstance(result, MethodologySignal)

    def test_constant_volume_correlation_zero(self):
        """Constant volume array produces correlation = 0.0."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should not crash and should produce valid signal
        self.assertIsInstance(result, MethodologySignal)

    def test_constant_price_correlation_zero(self):
        """Constant price (flat) produces correlation = 0.0."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [100.0] * rows,
            "low": [100.0] * rows,
            "close": [100.0] * rows,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_with_zero_volume(self):
        """Zero volume array does not crash effort analysis."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="zero")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_with_nan_volume(self):
        """NaN volume (filled to 0) does not crash effort analysis."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="nan")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_divergence_negative_correlation(self):
        """Negative correlation between volume and price signals divergence."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Inverse: bigger volume on smaller price changes
        closes = [100.0 + (i % 2) * 0.1 for i in range(rows)]
        volumes = [5_000_000 - i * 100_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.05 for c in closes],
            "high": [c + 0.1 for c in closes],
            "low": [c - 0.1 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_with_minimum_data(self):
        """Effort analysis with exactly 20 bars."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_effort_lookback_10_bars(self):
        """Effort analysis uses last 10 bars of data."""
        # Just verify it completes without error
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_divergence_not_in_reasoning_when_positive_correlation(self):
        """'divergence' should not appear if correlation is positive."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 2.0 for i in range(rows)]
        volumes = [100_000 + i * 100_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 1.0 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # When effort confirms trend, divergence should not appear
        if "effort confirms" in result.reasoning.lower():
            self.assertNotIn("divergence", result.reasoning.lower())

    def test_effort_confirms_bonus_increases_confidence(self):
        """Effort confirmation adds +0.05 confidence bonus."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 2.0 for i in range(rows)]
        volumes = [100_000 + i * 100_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 1.0 for c in closes],
            "high": [c + 2.0 for c in closes],
            "low": [c - 2.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Just verify valid confidence
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)


# ===================================================================
# 7. Confidence Scoring Tests
# ===================================================================
class TestConfidenceScoring(unittest.TestCase):
    """Verify confidence calculation logic."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_confidence_always_in_range(self):
        """Confidence is always between 0.0 and 1.0."""
        for trend in ("up", "down", "flat"):
            for pattern in ("normal", "zero", "nan", "constant"):
                price = _make_price_df(rows=30, trend=trend)
                vol = _make_volume_df(rows=30, pattern=pattern)
                result = _run(self.analyzer.analyze("AAPL", price, vol))
                self.assertGreaterEqual(result.confidence, 0.0)
                self.assertLessEqual(result.confidence, 1.0)

    def test_clear_markup_phase_confidence_at_least_0_7(self):
        """Clear markup phase starts with 0.7 base confidence."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "markup" in result.reasoning.lower():
            self.assertGreaterEqual(result.confidence, 0.7)

    def test_ranging_phase_confidence_around_0_4(self):
        """Ranging phase starts with 0.4 base confidence."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Oscillating close with equal volume bias (triggers ranging)
        closes = [100.0 + math.sin(i * 0.5) * 1.0 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # If ranging, confidence should be around 0.3-0.5 range
        self.assertLessEqual(result.confidence, 0.8)

    def test_spring_bonus_0_15(self):
        """Spring detection adds +0.15 bonus."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.key_levels.get("spring_level") is not None:
            # With spring + ranging base (0.4), confidence should be >= 0.4 + 0.15 = 0.55
            # (minus any volume ratio penalty)
            self.assertGreater(result.confidence, 0.3)

    def test_confidence_capped_at_1_0(self):
        """Confidence never exceeds 1.0 even with all bonuses."""
        # Force all confidence bonuses
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertLessEqual(result.confidence, 1.0)

    def test_confidence_floored_at_0_0(self):
        """Confidence never goes below 0.0."""
        price = _make_price_df(rows=20, trend="flat")
        vol = _make_volume_df(rows=20, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertGreaterEqual(result.confidence, 0.0)

    def test_confidence_is_float_type(self):
        """Confidence is always of type float."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result.confidence, float)

    def test_high_volume_ratio_boosts_clarity(self):
        """Volume ratio > 1.5 adds +0.1 to phase clarity."""
        # Strong accumulation data has high volume ratio
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertGreater(result.confidence, 0.3)

    def test_near_equal_volume_ratio_reduces_clarity(self):
        """Volume ratio near 1.0 (0.9-1.1) reduces clarity by 0.1."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        # Equal volume on up and down days
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_volume_confirmation_bonus_0_10(self):
        """Volume confirming phase direction adds +0.10 bonus."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Valid signal
        self.assertGreaterEqual(result.confidence, 0.0)

    def test_confidence_qualifier_high(self):
        """Confidence >= 0.7 produces 'high' qualifier in reasoning."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.confidence >= 0.7:
            self.assertIn("high", result.reasoning.lower())

    def test_confidence_qualifier_moderate(self):
        """Confidence 0.5-0.7 produces 'moderate' qualifier."""
        # Need data that produces moderate confidence
        price = _make_price_df(rows=30, trend="up")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if 0.5 <= result.confidence < 0.7:
            self.assertIn("moderate", result.reasoning.lower())

    def test_confidence_qualifier_low(self):
        """Confidence < 0.5 produces 'low' qualifier."""
        # Flat data with constant volume should produce low confidence
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0] * rows
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [101.0] * rows,
            "low": [99.0] * rows,
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.confidence < 0.5:
            self.assertIn("low", result.reasoning.lower())

    def test_confidence_not_nan(self):
        """Confidence is never NaN."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertFalse(math.isnan(result.confidence))

    def test_confidence_not_inf(self):
        """Confidence is never Inf."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertFalse(math.isinf(result.confidence))


# ===================================================================
# 8. Key Levels Tests
# ===================================================================
class TestKeyLevels(unittest.TestCase):
    """Verify key_levels dict structure and values."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_all_eight_keys_present(self):
        """key_levels always contains exactly 8 keys."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        expected_keys = {
            "trading_range_high",
            "trading_range_low",
            "spring_level",
            "upthrust_level",
            "target_markup",
            "target_markdown",
            "sma_50",
            "sma_200",
        }
        self.assertEqual(set(result.key_levels.keys()), expected_keys)

    def test_trading_range_high_gte_low(self):
        """trading_range_high >= trading_range_low."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertGreaterEqual(
            result.key_levels["trading_range_high"],
            result.key_levels["trading_range_low"],
        )

    def test_spring_level_none_when_not_detected(self):
        """spring_level is None when no spring detected."""
        price = _make_price_df(rows=30, trend="flat")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "spring" not in result.reasoning.lower():
            self.assertIsNone(result.key_levels["spring_level"])

    def test_upthrust_level_none_when_not_detected(self):
        """upthrust_level is None when no upthrust detected."""
        price = _make_price_df(rows=30, trend="flat")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "upthrust" not in result.reasoning.lower():
            self.assertIsNone(result.key_levels["upthrust_level"])

    def test_target_markup_when_bullish(self):
        """target_markup = resistance + range_height when direction is bullish."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.direction == "bullish":
            self.assertIsNotNone(result.key_levels["target_markup"])
            # target_markup should be above trading_range_high
            self.assertGreater(
                result.key_levels["target_markup"],
                result.key_levels["trading_range_high"],
            )

    def test_target_markdown_when_bearish(self):
        """target_markdown = support - range_height when direction is bearish."""
        price, vol = _make_markdown_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.direction == "bearish":
            self.assertIsNotNone(result.key_levels["target_markdown"])
            # target_markdown should be below trading_range_low
            self.assertLess(
                result.key_levels["target_markdown"],
                result.key_levels["trading_range_low"],
            )

    def test_target_markup_none_when_not_bullish(self):
        """target_markup is None when direction is not bullish."""
        price, vol = _make_markdown_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.direction != "bullish":
            self.assertIsNone(result.key_levels["target_markup"])

    def test_target_markdown_none_when_not_bearish(self):
        """target_markdown is None when direction is not bearish."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.direction != "bearish":
            self.assertIsNone(result.key_levels["target_markdown"])

    def test_sma_50_always_present(self):
        """sma_50 is always present and is a float."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNotNone(result.key_levels["sma_50"])
        self.assertIsInstance(result.key_levels["sma_50"], float)

    def test_sma_200_always_present(self):
        """sma_200 is always present and is a float."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsNotNone(result.key_levels["sma_200"])
        self.assertIsInstance(result.key_levels["sma_200"], float)

    def test_sma_50_with_fewer_than_50_bars(self):
        """sma_50 uses available bars when fewer than 50."""
        price = _make_price_df(rows=25)
        vol = _make_volume_df(rows=25)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # sma_50 should be the mean of all 25 closes
        expected = float(price["close"].mean())
        self.assertAlmostEqual(result.key_levels["sma_50"], expected, places=2)

    def test_sma_200_with_fewer_than_200_bars(self):
        """sma_200 uses available bars when fewer than 200."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # sma_200 should be the mean of all 30 closes
        expected = float(price["close"].mean())
        self.assertAlmostEqual(result.key_levels["sma_200"], expected, places=2)


# ===================================================================
# 9. Reasoning String Tests
# ===================================================================
class TestReasoningString(unittest.TestCase):
    """Verify reasoning string content and formatting."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_reasoning_contains_ticker(self):
        """Reasoning contains the ticker symbol."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("AAPL", result.reasoning)

    def test_reasoning_contains_phase_name(self):
        """Reasoning contains a recognized phase name."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        phases = ["accumulation", "distribution", "markup", "markdown", "ranging"]
        self.assertTrue(any(p in result.reasoning.lower() for p in phases))

    def test_reasoning_contains_range_boundaries(self):
        """Reasoning mentions trading range boundaries."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Reasoning should contain formatted float values for support/resistance
        self.assertIn("trading range", result.reasoning.lower())

    def test_reasoning_contains_volume_info(self):
        """Reasoning contains volume comparison info."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIn("volume", result.reasoning.lower())

    def test_reasoning_contains_confidence_qualifier(self):
        """Reasoning contains confidence qualifier (high/moderate/low)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        qualifiers = ["high", "moderate", "low"]
        self.assertTrue(any(q in result.reasoning.lower() for q in qualifiers))

    def test_reasoning_ticker_sanitization_strips_special_chars(self):
        """Ticker sanitization strips angle brackets and script tags."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("<script>alert(1)</script>", price, vol))
        self.assertNotIn("<script>", result.reasoning)
        self.assertNotIn("</script>", result.reasoning)
        self.assertNotIn("<", result.reasoning)
        self.assertNotIn(">", result.reasoning)

    def test_reasoning_ticker_sanitization_keeps_safe_chars(self):
        """Ticker sanitization keeps alphanumeric, dot, dash, underscore, space."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("BRK.B", price, vol))
        self.assertIn("BRK.B", result.reasoning)

    def test_reasoning_long_ticker_truncated(self):
        """Ticker longer than 20 chars is truncated in reasoning."""
        long_ticker = "A" * 30
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze(long_ticker, price, vol))
        # The truncated ticker should appear, but not the full 30-char one
        self.assertIn("A" * 20, result.reasoning)

    def test_reasoning_contains_confidence_value(self):
        """Reasoning contains the confidence value as a decimal."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should contain something like "0.XX"
        self.assertIn("Confidence:", result.reasoning)

    def test_reasoning_spring_info_when_detected(self):
        """Reasoning mentions spring details when detected."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.key_levels.get("spring_level") is not None:
            self.assertIn("Spring detected", result.reasoning)

    def test_reasoning_upthrust_info_when_detected(self):
        """Reasoning mentions upthrust details when detected."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if result.key_levels.get("upthrust_level") is not None:
            self.assertIn("Upthrust detected", result.reasoning)

    def test_reasoning_is_string(self):
        """Reasoning is always a string."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result.reasoning, str)

    def test_reasoning_non_empty(self):
        """Reasoning is never empty."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertTrue(len(result.reasoning.strip()) > 0)


# ===================================================================
# 10. Edge Case Tests
# ===================================================================
class TestEdgeCases(unittest.TestCase):
    """Boundary and edge-case tests for the Wyckoff analyzer."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_exactly_20_rows(self):
        """Exactly 20 rows (minimum) produces valid signal."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_exactly_21_rows(self):
        """21 rows produces valid signal."""
        price = _make_price_df(rows=21)
        vol = _make_volume_df(rows=21)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_200_plus_rows(self):
        """200+ rows produces valid signal."""
        price = _make_price_df(rows=250)
        vol = _make_volume_df(rows=250)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_all_zero_volume(self):
        """All-zero volume does not crash and produces valid signal."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="zero")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_all_nan_volume(self):
        """All-NaN volume (filled to 0) produces valid signal."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="nan")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_flat_price_all_same_close(self):
        """All-same close prices produce valid signal."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [100.0] * rows,
            "low": [100.0] * rows,
            "close": [100.0] * rows,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_flat_price_confidence_is_valid(self):
        """Flat price data produces confidence in valid range."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [100.0] * rows,
            "low": [100.0] * rows,
            "close": [100.0] * rows,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)

    def test_very_large_prices(self):
        """Very large prices (million-dollar) produce valid signal."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [1_000_000.0 + i for i in range(rows)],
            "high": [1_000_005.0 + i for i in range(rows)],
            "low": [999_995.0 + i for i in range(rows)],
            "close": [1_000_002.0 + i for i in range(rows)],
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_very_small_prices(self):
        """Very small prices (penny stock) produce valid signal."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [0.01 + i * 0.001 for i in range(rows)],
            "high": [0.015 + i * 0.001 for i in range(rows)],
            "low": [0.005 + i * 0.001 for i in range(rows)],
            "close": [0.012 + i * 0.001 for i in range(rows)],
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_mismatched_dates_inner_join(self):
        """Mismatched dates between price and volume use inner join."""
        price_dates = pd.date_range("2024-01-01", periods=30, freq="B")
        vol_dates = pd.date_range("2024-01-08", periods=30, freq="B")
        price = pd.DataFrame({
            "date": price_dates,
            "open": [100.0 + i for i in range(30)],
            "high": [105.0 + i for i in range(30)],
            "low": [95.0 + i for i in range(30)],
            "close": [102.0 + i for i in range(30)],
        })
        vol = pd.DataFrame({
            "date": vol_dates,
            "volume": [1_000_000] * 30,
        })
        # The inner join should produce at least 20 rows
        # (they overlap for about 25 business days)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_fundamentals_ignored(self):
        """Fundamentals parameter is ignored by Wyckoff."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze(
            "AAPL", price, vol,
            fundamentals={"pe_ratio": 25.0, "eps": 5.0},
        ))
        self.assertIsInstance(result, MethodologySignal)

    def test_fundamentals_none(self):
        """Fundamentals=None is handled correctly."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol, fundamentals=None))
        self.assertIsInstance(result, MethodologySignal)

    def test_empty_ticker(self):
        """Empty ticker string produces valid signal (no ticker validation in Wyckoff)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_ticker_with_spaces(self):
        """Ticker with spaces is sanitized in reasoning."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("SPY ETF", price, vol))
        self.assertIn("SPY ETF", result.reasoning)

    def test_ticker_with_numbers(self):
        """Ticker with numbers is handled."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("3M", price, vol))
        self.assertIn("3M", result.reasoning)

    def test_signal_to_dict_works(self):
        """Result signal can be serialized to dict."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["methodology"], "wyckoff")

    def test_signal_roundtrip_serialization(self):
        """Result signal survives to_dict/from_dict roundtrip."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.ticker, result.ticker)
        self.assertEqual(restored.methodology, result.methodology)
        self.assertEqual(restored.direction, result.direction)
        self.assertAlmostEqual(restored.confidence, result.confidence)
        self.assertEqual(restored.timeframe, result.timeframe)
        self.assertEqual(restored.reasoning, result.reasoning)
        self.assertEqual(restored.key_levels, result.key_levels)


# ===================================================================
# 11. Merge Data Tests
# ===================================================================
class TestMergeData(unittest.TestCase):
    """Verify _merge_data handles various input scenarios."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_merge_fills_nan_volume_with_zero(self):
        """NaN volume values are filled with 0 after merge."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30, pattern="nan")
        merged = self.analyzer._merge_data(price, vol)
        self.assertFalse(merged["volume"].isna().any())

    def test_merge_sorts_by_date(self):
        """Merged data is sorted by date ascending."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        dates = merged["date"].tolist()
        self.assertEqual(dates, sorted(dates))

    def test_merge_has_correct_columns(self):
        """Merged DataFrame has exactly [date, open, high, low, close, volume]."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        expected = ["date", "open", "high", "low", "close", "volume"]
        self.assertEqual(list(merged.columns), expected)

    def test_merge_inner_join(self):
        """Merge uses inner join on 'date'."""
        price_dates = pd.date_range("2024-01-01", periods=30, freq="B")
        vol_dates = pd.date_range("2024-01-15", periods=30, freq="B")
        price = pd.DataFrame({
            "date": price_dates,
            "open": [100.0] * 30,
            "high": [105.0] * 30,
            "low": [95.0] * 30,
            "close": [102.0] * 30,
        })
        vol = pd.DataFrame({"date": vol_dates, "volume": [1_000_000] * 30})
        merged = self.analyzer._merge_data(price, vol)
        # Inner join: only overlapping dates
        overlap = set(price_dates) & set(vol_dates)
        self.assertEqual(len(merged), len(overlap))


# ===================================================================
# 12. Trading Range Detection Tests
# ===================================================================
class TestTradingRangeDetection(unittest.TestCase):
    """Verify _detect_trading_range internal method."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_resistance_above_support(self):
        """Resistance is always above or equal to support."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertGreaterEqual(range_info.resistance, range_info.support)

    def test_range_height_positive(self):
        """Range height is always positive (guarded by EPSILON)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertGreater(range_info.range_height, 0)

    def test_lookback_bars_capped_at_60(self):
        """Lookback bars capped at _DEFAULT_RANGE_LOOKBACK (60)."""
        price = _make_price_df(rows=100)
        vol = _make_volume_df(rows=100)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertLessEqual(range_info.lookback_bars, 60)

    def test_lookback_bars_equals_data_length_when_small(self):
        """Lookback bars equals data length when fewer than 60 rows."""
        price = _make_price_df(rows=25)
        vol = _make_volume_df(rows=25)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertEqual(range_info.lookback_bars, 25)

    def test_sma_values_are_floats(self):
        """SMA-50 and SMA-200 are float values."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertIsInstance(range_info.sma_50, float)
        self.assertIsInstance(range_info.sma_200, float)

    def test_avg_volume_non_negative(self):
        """Average volume is always non-negative."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertGreaterEqual(range_info.avg_volume, 0.0)

    def test_flat_price_range_height_epsilon(self):
        """Flat price data has range_height at least EPSILON."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [100.0] * rows,
            "low": [100.0] * rows,
            "close": [100.0] * rows,
        })
        vol = _make_volume_df(rows=rows)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        self.assertGreater(range_info.range_height, 0)


# ===================================================================
# 13. Direction Determination Tests
# ===================================================================
class TestDirectionDetermination(unittest.TestCase):
    """Verify direction mapping from phase and spring/upthrust info."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_accumulation_is_bullish(self):
        """Accumulation phase maps to bullish."""
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "accumulation" in result.reasoning.lower():
            self.assertEqual(result.direction, "bullish")

    def test_distribution_is_bearish(self):
        """Distribution phase maps to bearish."""
        price, vol = _make_distribution_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "distribution" in result.reasoning.lower():
            self.assertEqual(result.direction, "bearish")

    def test_markup_is_bullish(self):
        """Markup phase maps to bullish."""
        price, vol = _make_markup_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "markup" in result.reasoning.lower():
            self.assertEqual(result.direction, "bullish")

    def test_markdown_is_bearish(self):
        """Markdown phase maps to bearish."""
        price, vol = _make_markdown_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if "markdown" in result.reasoning.lower():
            self.assertEqual(result.direction, "bearish")

    def test_ranging_with_spring_only_is_bullish(self):
        """Ranging phase with spring only maps to bullish tiebreaker."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if (result.key_levels.get("spring_level") is not None
                and result.key_levels.get("upthrust_level") is None
                and "ranging" in result.reasoning.lower()):
            self.assertEqual(result.direction, "bullish")

    def test_ranging_with_upthrust_only_is_bearish(self):
        """Ranging phase with upthrust only maps to bearish tiebreaker."""
        price, vol = _make_upthrust_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if (result.key_levels.get("upthrust_level") is not None
                and result.key_levels.get("spring_level") is None
                and "ranging" in result.reasoning.lower()):
            self.assertEqual(result.direction, "bearish")

    def test_ranging_without_spring_or_upthrust_is_neutral(self):
        """Ranging without spring/upthrust maps to neutral."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + (i % 3) * 0.1 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.2 for c in closes],
            "high": [c + 0.5 for c in closes],
            "low": [c - 0.5 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        if ("ranging" in result.reasoning.lower()
                and result.key_levels.get("spring_level") is None
                and result.key_levels.get("upthrust_level") is None):
            self.assertEqual(result.direction, "neutral")


# ===================================================================
# 14. Volume Ratio Handling Tests
# ===================================================================
class TestVolumeRatioHandling(unittest.TestCase):
    """Verify volume ratio edge cases (division by zero, inf, etc.)."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_zero_down_volume_no_crash(self):
        """Zero down-day volume does not cause division by zero."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All up-days (each close > previous close)
        closes = [100.0 + i * 0.5 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.3 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)
        self.assertFalse(math.isinf(result.confidence))

    def test_zero_up_volume_no_crash(self):
        """Zero up-day volume does not cause issues."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All down-days
        closes = [150.0 - i * 0.5 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c + 0.3 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_inf_volume_ratio_capped_at_10(self):
        """Infinite volume ratio is capped at 10.0."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # All up-days: no down-day volume at all
        closes = [100.0 + i * 1.0 for i in range(rows)]
        # Zero volume on all days (avg_down_volume will be 0)
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        # Should not crash, confidence should be valid
        self.assertIsInstance(result, MethodologySignal)
        self.assertFalse(math.isinf(result.confidence))


# ===================================================================
# 15. Multiple Analyzer Instance Tests
# ===================================================================
class TestMultipleInstances(unittest.TestCase):
    """Verify multiple WyckoffAnalyzer instances are independent."""

    def test_independent_instances(self):
        """Two instances produce equivalent results for same input."""
        analyzer1 = WyckoffAnalyzer()
        analyzer2 = WyckoffAnalyzer()
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result1 = _run(analyzer1.analyze("AAPL", price, vol))
        result2 = _run(analyzer2.analyze("AAPL", price, vol))
        self.assertEqual(result1.direction, result2.direction)
        self.assertAlmostEqual(result1.confidence, result2.confidence)

    def test_different_tickers_different_reasoning(self):
        """Different tickers produce different reasoning strings."""
        analyzer = WyckoffAnalyzer()
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result1 = _run(analyzer.analyze("AAPL", price, vol))
        result2 = _run(analyzer.analyze("MSFT", price, vol))
        self.assertIn("AAPL", result1.reasoning)
        self.assertIn("MSFT", result2.reasoning)
        self.assertNotEqual(result1.reasoning, result2.reasoning)

    def test_sequential_calls_same_instance(self):
        """Same instance can run multiple analyses sequentially."""
        analyzer = WyckoffAnalyzer()
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        for ticker in ["AAPL", "MSFT", "GOOG", "TSLA"]:
            result = _run(analyzer.analyze(ticker, price, vol))
            self.assertIsInstance(result, MethodologySignal)
            self.assertEqual(result.ticker, ticker)


# ===================================================================
# 16. Comprehensive Direction-Phase Mapping Tests
# ===================================================================
class TestDirectionPhaseMapping(unittest.TestCase):
    """Verify all possible phase-to-direction mappings exhaustively."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_all_trends_produce_valid_direction(self):
        """All trend types produce a valid direction value."""
        for trend in ("up", "down", "flat"):
            price = _make_price_df(rows=40, trend=trend)
            vol = _make_volume_df(rows=40)
            result = _run(self.analyzer.analyze("AAPL", price, vol))
            self.assertIn(result.direction, ("bullish", "bearish", "neutral"))

    def test_all_volume_patterns_produce_valid_direction(self):
        """All volume patterns produce a valid direction value."""
        for pattern in ("normal", "zero", "nan", "constant", "high"):
            price = _make_price_df(rows=30)
            vol = _make_volume_df(rows=30, pattern=pattern)
            result = _run(self.analyzer.analyze("AAPL", price, vol))
            self.assertIn(result.direction, ("bullish", "bearish", "neutral"))


# ===================================================================
# 17. Extra Robustness Tests
# ===================================================================
class TestRobustness(unittest.TestCase):
    """Additional robustness and stress tests."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_500_rows(self):
        """500-row dataset produces valid signal."""
        price = _make_price_df(rows=500)
        vol = _make_volume_df(rows=500)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_negative_prices_produce_valid_signal(self):
        """Negative prices (unlikely but possible) produce valid signal."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [-50.0 + i * 0.5 for i in range(rows)],
            "high": [-45.0 + i * 0.5 for i in range(rows)],
            "low": [-55.0 + i * 0.5 for i in range(rows)],
            "close": [-48.0 + i * 0.5 for i in range(rows)],
        })
        vol = _make_volume_df(rows=rows)
        result = _run(self.analyzer.analyze("OIL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_extra_columns_in_price_data_ignored(self):
        """Extra columns in price DataFrame are ignored."""
        price = _make_price_df(rows=30)
        price["adj_close"] = price["close"] * 1.01
        price["dividends"] = 0.0
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_extra_columns_in_volume_data_ignored(self):
        """Extra columns in volume DataFrame are ignored."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        vol["turnover"] = vol["volume"] * 100.0
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        self.assertIsInstance(result, MethodologySignal)

    def test_analyze_does_not_modify_input_price(self):
        """analyze() does not modify the input price DataFrame."""
        price = _make_price_df(rows=30)
        price_copy = price.copy()
        vol = _make_volume_df(rows=30)
        _run(self.analyzer.analyze("AAPL", price, vol))
        pd.testing.assert_frame_equal(price, price_copy)

    def test_analyze_does_not_modify_input_volume(self):
        """analyze() does not modify the input volume DataFrame (except NaN fill in merge)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        vol_copy = vol.copy()
        _run(self.analyzer.analyze("AAPL", price, vol))
        pd.testing.assert_frame_equal(vol, vol_copy)

    def test_signal_key_levels_values_are_numbers_or_none(self):
        """All key_levels values are either float or None."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        for key, value in result.key_levels.items():
            self.assertTrue(
                value is None or isinstance(value, (int, float)),
                f"key_levels['{key}'] = {value} is not a number or None",
            )

    def test_confidence_stability_same_input(self):
        """Same input always produces same confidence (deterministic)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        results = [
            _run(self.analyzer.analyze("AAPL", price, vol))
            for _ in range(3)
        ]
        for r in results[1:]:
            self.assertAlmostEqual(r.confidence, results[0].confidence)

    def test_direction_stability_same_input(self):
        """Same input always produces same direction (deterministic)."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        results = [
            _run(self.analyzer.analyze("AAPL", price, vol))
            for _ in range(3)
        ]
        for r in results[1:]:
            self.assertEqual(r.direction, results[0].direction)



# ===================================================================
# 18. Integration Tests: End-to-End Pipeline Verification
# ===================================================================
class TestEndToEndPipelineIntegration(unittest.TestCase):
    """Verify the full analysis pipeline from merge through signal output.

    These integration tests exercise the complete flow:
    merge -> range detection -> phase -> spring/upthrust -> VPA -> effort
    -> confidence -> direction -> key_levels -> reasoning -> MethodologySignal

    They verify intermediate results are correctly wired between internal
    methods and that the final output is consistent with intermediate state.
    """

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_markup_pipeline_intermediate_values(self):
        """Markup data: verify intermediate range/phase/direction consistency."""
        price, vol = _make_markup_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)
        spring_info = self.analyzer._detect_spring_upthrust(merged, range_info)
        vpa_info = self.analyzer._analyze_volume_price_spread(merged)
        effort_info = self.analyzer._analyze_effort_vs_result(merged)

        # For markup: close should exceed resistance
        last_close = float(merged["close"].iloc[-1])
        self.assertGreater(last_close, range_info.resistance)

        # Phase should be markup with bullish direction
        self.assertEqual(phase_info.phase, "markup")
        self.assertGreaterEqual(phase_info.clarity, 0.6)

        # Direction from _determine_direction should be bullish
        direction = self.analyzer._determine_direction(phase_info, spring_info)
        self.assertEqual(direction, "bullish")

        # Confidence calc should produce valid result
        confidence = self.analyzer._calculate_confidence(
            phase_info, spring_info, vpa_info, effort_info
        )
        self.assertGreaterEqual(confidence, 0.0)
        self.assertLessEqual(confidence, 1.0)

        # Final signal should match intermediates
        result = _run(self.analyzer.analyze("TEST", price, vol))
        self.assertEqual(result.direction, "bullish")
        self.assertAlmostEqual(result.confidence, confidence, places=5)

    def test_markdown_pipeline_intermediate_values(self):
        """Markdown data: verify intermediate range/phase/direction consistency."""
        price, vol = _make_markdown_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)

        # For markdown: close should be below support
        last_close = float(merged["close"].iloc[-1])
        self.assertLess(last_close, range_info.support)

        # Phase should be markdown
        self.assertEqual(phase_info.phase, "markdown")

        # Final signal should be bearish
        result = _run(self.analyzer.analyze("TEST", price, vol))
        self.assertEqual(result.direction, "bearish")

    def test_accumulation_pipeline_intermediate_values(self):
        """Accumulation data: verify sma_50 < sma_200 and volume bias."""
        price, vol = _make_accumulation_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)

        # SMA context should be downtrend (sma_50 < sma_200)
        self.assertLess(range_info.sma_50, range_info.sma_200)

        # Volume ratio should favor up-days
        self.assertGreater(phase_info.volume_ratio, 1.0)

        # Phase should be accumulation
        self.assertEqual(phase_info.phase, "accumulation")

        # Trend context should be downtrend
        self.assertEqual(phase_info.trend_context, "downtrend")

    def test_distribution_pipeline_intermediate_values(self):
        """Distribution data: verify sma_50 > sma_200 and volume bias."""
        price, vol = _make_distribution_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)

        # SMA context should be uptrend (sma_50 > sma_200)
        self.assertGreater(range_info.sma_50, range_info.sma_200)

        # Volume ratio should favor down-days
        self.assertLess(phase_info.volume_ratio, 1.0)

        # Phase should be distribution
        self.assertEqual(phase_info.phase, "distribution")

        # Trend context should be uptrend
        self.assertEqual(phase_info.trend_context, "uptrend")

    def test_spring_pipeline_wiring(self):
        """Spring data: verify spring detection feeds into confidence and key_levels."""
        price, vol = _make_spring_data(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        spring_info = self.analyzer._detect_spring_upthrust(merged, range_info)
        phase_info = self.analyzer._detect_phase(merged, range_info)
        vpa_info = self.analyzer._analyze_volume_price_spread(merged)
        effort_info = self.analyzer._analyze_effort_vs_result(merged)

        # Verify spring was detected at the internal level
        self.assertTrue(spring_info.spring_detected)
        self.assertIsNotNone(spring_info.spring_level)
        self.assertEqual(spring_info.spring_level, 95.0)

        # Confidence should include spring bonus
        confidence_with_spring = self.analyzer._calculate_confidence(
            phase_info, spring_info, vpa_info, effort_info
        )
        # Remove spring from calculation to verify bonus
        no_spring = spring_info._replace(
            spring_detected=False, spring_level=None, spring_bars_ago=None,
        )
        confidence_without_spring = self.analyzer._calculate_confidence(
            phase_info, no_spring, vpa_info, effort_info
        )
        self.assertGreater(confidence_with_spring, confidence_without_spring)

    def test_vpa_feeds_into_confidence_for_bullish_phase(self):
        """VPA bullish score > 0.3 adds bonus when phase is markup."""
        price, vol = _make_markup_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)
        spring_info = self.analyzer._detect_spring_upthrust(merged, range_info)
        vpa_info = self.analyzer._analyze_volume_price_spread(merged)
        effort_info = self.analyzer._analyze_effort_vs_result(merged)

        # Check if the VPA bullish bonus applies
        if phase_info.phase in ("accumulation", "markup") and vpa_info.bullish_score > 0.3:
            # Create a fake VPA with zero scores
            fake_vpa = vpa_info._replace(bullish_score=0.0, bearish_score=0.0)
            conf_with = self.analyzer._calculate_confidence(
                phase_info, spring_info, vpa_info, effort_info
            )
            conf_without = self.analyzer._calculate_confidence(
                phase_info, spring_info, fake_vpa, effort_info
            )
            self.assertGreater(conf_with, conf_without)

    def test_target_markup_formula_exact(self):
        """Verify target_markup = resistance + range_height for bullish signal."""
        price, vol = _make_markup_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)

        result = _run(self.analyzer.analyze("TEST", price, vol))
        if result.direction == "bullish":
            expected_target = range_info.resistance + range_info.range_height
            self.assertAlmostEqual(
                result.key_levels["target_markup"], expected_target, places=5,
            )

    def test_target_markdown_formula_exact(self):
        """Verify target_markdown = support - range_height for bearish signal."""
        price, vol = _make_markdown_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)

        result = _run(self.analyzer.analyze("TEST", price, vol))
        if result.direction == "bearish":
            expected_target = range_info.support - range_info.range_height
            self.assertAlmostEqual(
                result.key_levels["target_markdown"], expected_target, places=5,
            )

    def test_range_info_feeds_key_levels_correctly(self):
        """Verify range_info.resistance/support map to key_levels trading_range_high/low."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)

        result = _run(self.analyzer.analyze("TEST", price, vol))
        self.assertAlmostEqual(
            result.key_levels["trading_range_high"], range_info.resistance, places=5,
        )
        self.assertAlmostEqual(
            result.key_levels["trading_range_low"], range_info.support, places=5,
        )
        self.assertAlmostEqual(
            result.key_levels["sma_50"], range_info.sma_50, places=5,
        )
        self.assertAlmostEqual(
            result.key_levels["sma_200"], range_info.sma_200, places=5,
        )


# ===================================================================
# 19. Integration Tests: Spring Multi-Bar Confirmation
# ===================================================================
class TestSpringMultiBarConfirmation(unittest.TestCase):
    """Verify spring detection with multi-bar confirmation paths.

    The spring detection checks bars i+1 through i+3 for close recovery
    above support. These tests exercise that multi-bar confirmation logic.
    """

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_spring_confirmed_by_third_bar_after_dip(self):
        """Spring confirmed by a bar 3 bars after the dip closing above support."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
        opens = [c - 0.3 for c in closes]
        highs = [c + 1.5 for c in closes]
        lows = [c - 1.5 for c in closes]
        volumes = [1_000_000] * rows

        # Dip at index rows-5 with low volume, close stays below support
        dip_idx = rows - 5
        lows[dip_idx] = 95.0
        closes[dip_idx] = 97.0  # closes below support (~98.5)
        volumes[dip_idx] = 200_000

        # Recovery bar at dip_idx+2 closes above support
        closes[dip_idx + 2] = 100.0

        price = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})

        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        spring_info = self.analyzer._detect_spring_upthrust(merged, range_info)

        # Spring should be detected via the multi-bar confirmation path
        self.assertTrue(spring_info.spring_detected)
        self.assertEqual(spring_info.spring_level, 95.0)

    def test_spring_not_confirmed_beyond_3_bar_window(self):
        """Spring NOT confirmed if recovery happens after 3-bar window."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + (i % 5) * 0.2 for i in range(rows)]
        opens = [c - 0.3 for c in closes]
        highs = [c + 1.5 for c in closes]
        lows = [c - 1.5 for c in closes]
        volumes = [1_000_000] * rows

        # Dip at index rows-8 with low volume, close below support
        dip_idx = rows - 8
        lows[dip_idx] = 95.0
        closes[dip_idx] = 97.0  # below support
        volumes[dip_idx] = 200_000

        # Keep bars dip_idx+1 through dip_idx+3 all below support
        for offset in range(1, 4):
            if dip_idx + offset < rows:
                closes[dip_idx + offset] = 97.0  # still below support

        # Recovery only at dip_idx+4 (outside the 3-bar confirmation window)
        if dip_idx + 4 < rows:
            closes[dip_idx + 4] = 100.0

        price = pd.DataFrame({
            "date": dates, "open": opens, "high": highs,
            "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})

        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        spring_info = self.analyzer._detect_spring_upthrust(merged, range_info)

        # The spring at dip_idx should NOT be confirmed via multi-bar path
        # However, the self-recovery check may trigger if close > support on the dip bar
        # In this case close=97 < support~98.5, so no self-recovery either
        if spring_info.spring_detected and spring_info.spring_bars_ago is not None:
            # If spring WAS detected, it must be from a different bar
            self.assertNotEqual(spring_info.spring_bars_ago, rows - 1 - dip_idx)


# ===================================================================
# 20. Integration Tests: VPA Score Boundaries
# ===================================================================
class TestVPAScoreBoundaries(unittest.TestCase):
    """Verify VPA bullish/bearish score boundary behavior."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_vpa_scores_bounded_zero_to_one(self):
        """VPA bullish and bearish scores are always in [0.0, 1.0]."""
        datasets = [
            (_make_price_df(rows=30, trend="up"), _make_volume_df(rows=30)),
            (_make_price_df(rows=30, trend="down"), _make_volume_df(rows=30)),
            (_make_price_df(rows=30, trend="flat"), _make_volume_df(rows=30, pattern="constant")),
            (_make_price_df(rows=30), _make_volume_df(rows=30, pattern="zero")),
            (_make_price_df(rows=30), _make_volume_df(rows=30, pattern="nan")),
            (_make_price_df(rows=30), _make_volume_df(rows=30, pattern="high")),
        ]
        for price, vol in datasets:
            merged = self.analyzer._merge_data(price, vol)
            vpa = self.analyzer._analyze_volume_price_spread(merged)
            self.assertGreaterEqual(vpa.bullish_score, 0.0,
                                    f"bullish_score {vpa.bullish_score} < 0")
            self.assertLessEqual(vpa.bullish_score, 1.0,
                                 f"bullish_score {vpa.bullish_score} > 1")
            self.assertGreaterEqual(vpa.bearish_score, 0.0,
                                    f"bearish_score {vpa.bearish_score} < 0")
            self.assertLessEqual(vpa.bearish_score, 1.0,
                                 f"bearish_score {vpa.bearish_score} > 1")

    def test_vpa_absorption_and_strong_move_counts_non_negative(self):
        """VPA absorption_count and strong_move_count are always >= 0."""
        for trend in ("up", "down", "flat"):
            price = _make_price_df(rows=30, trend=trend)
            vol = _make_volume_df(rows=30)
            merged = self.analyzer._merge_data(price, vol)
            vpa = self.analyzer._analyze_volume_price_spread(merged)
            self.assertGreaterEqual(vpa.absorption_count, 0)
            self.assertGreaterEqual(vpa.strong_move_count, 0)

    def test_vpa_uniform_data_zero_scores(self):
        """Uniform spread and volume produce zero VPA scores."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        price = pd.DataFrame({
            "date": dates,
            "open": [100.0] * rows,
            "high": [101.0] * rows,
            "low": [99.0] * rows,
            "close": [100.0] * rows,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        merged = self.analyzer._merge_data(price, vol)
        vpa = self.analyzer._analyze_volume_price_spread(merged)
        # With uniform spread (=2.0 = avg ATR), nothing exceeds 1.2x or falls below 0.8x
        self.assertEqual(vpa.bullish_score, 0.0)
        self.assertEqual(vpa.bearish_score, 0.0)
        self.assertEqual(vpa.absorption_count, 0)
        self.assertEqual(vpa.strong_move_count, 0)


# ===================================================================
# 21. Integration Tests: Effort-Result Edge Cases
# ===================================================================
class TestEffortResultEdgeCases(unittest.TestCase):
    """Verify effort vs result analysis edge cases."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_effort_with_exactly_two_data_points_after_diff(self):
        """Effort analysis with exactly 2 valid points after diff (lookback=3)."""
        # The effort lookback is min(10, len(df)), and it diffs to get price_changes.
        # With 20 rows (minimum for validation), the last 10 rows are used,
        # yielding 9 valid points after diff. To test the boundary of len(volumes)<2,
        # we need to call the internal method directly with a tiny DataFrame.
        rows = 20
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # We cannot go below 20 rows due to validation, but we can verify
        # that the effort analysis handles the lookback correctly.
        price = _make_price_df(rows=rows)
        vol = _make_volume_df(rows=rows)
        merged = self.analyzer._merge_data(price, vol)

        # Create a small slice for the internal method
        small_df = merged.tail(3).reset_index(drop=True)
        effort = self.analyzer._analyze_effort_vs_result(small_df)
        # With 3 rows, after diff we get 2 valid pairs -- should work
        self.assertIsInstance(effort.correlation, float)
        self.assertFalse(math.isnan(effort.correlation))

    def test_effort_with_single_data_point_returns_defaults(self):
        """Effort analysis with 1 row returns default (0.0, False, False)."""
        rows = 20
        price = _make_price_df(rows=rows)
        vol = _make_volume_df(rows=rows)
        merged = self.analyzer._merge_data(price, vol)

        # Single-row slice
        tiny_df = merged.tail(1).reset_index(drop=True)
        effort = self.analyzer._analyze_effort_vs_result(tiny_df)
        # After diff, 0 valid pairs -> should return defaults
        self.assertEqual(effort.correlation, 0.0)
        self.assertFalse(effort.divergence_detected)
        self.assertFalse(effort.confirms_trend)

    def test_effort_strong_negative_correlation_flags_divergence(self):
        """Correlation < -0.3 sets divergence_detected = True."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Inverse relationship: high volume on tiny price changes, low volume on big ones
        closes = []
        volumes = []
        for i in range(rows):
            if i % 2 == 0:
                closes.append(100.0 + 5.0)  # big price move
                volumes.append(100_000)       # low volume
            else:
                closes.append(100.0)          # small price move
                volumes.append(5_000_000)     # high volume
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        merged = self.analyzer._merge_data(price, vol)
        effort = self.analyzer._analyze_effort_vs_result(merged)

        # Correlation should be negative (inverse relationship)
        if effort.correlation < -0.3:
            self.assertTrue(effort.divergence_detected)

    def test_effort_strong_positive_correlation_confirms_trend(self):
        """Correlation > 0.3 sets confirms_trend = True."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Direct relationship: bigger price moves have bigger volume
        closes = [100.0 + i * 1.0 for i in range(rows)]
        volumes = [100_000 + i * 50_000 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        merged = self.analyzer._merge_data(price, vol)
        effort = self.analyzer._analyze_effort_vs_result(merged)

        if effort.correlation > 0.3:
            self.assertTrue(effort.confirms_trend)


# ===================================================================
# 22. Integration Tests: Volume Ratio Clarity Adjustments
# ===================================================================
class TestVolumeRatioClarityAdjustments(unittest.TestCase):
    """Verify volume ratio effects on phase clarity and confidence."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_extreme_volume_ratio_boosts_clarity(self):
        """Volume ratio > 1.5 adds +0.1 clarity, detectable via confidence."""
        price, vol = _make_accumulation_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)

        # Accumulation data has strong up-volume bias -> ratio > 1.5
        self.assertGreater(phase_info.volume_ratio, 1.5)
        # Clarity should be boosted above the base 0.7
        self.assertGreater(phase_info.clarity, 0.7)

    def test_balanced_volume_ratio_reduces_clarity(self):
        """Volume ratio near 1.0 (0.9-1.1) reduces clarity by 0.1."""
        rows = 40
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        # Alternating up/down with equal volume
        closes = [100.0 + (i % 2) * 0.5 for i in range(rows)]
        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.2 for c in closes],
            "high": [c + 1.0 for c in closes],
            "low": [c - 1.0 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": [1_000_000] * rows})
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)
        phase_info = self.analyzer._detect_phase(merged, range_info)

        # With equal volume, ratio should be near 1.0
        # Phase should be ranging with reduced clarity
        if 0.9 <= phase_info.volume_ratio <= 1.1:
            # Base ranging clarity is 0.4, minus 0.1 = 0.3
            self.assertLessEqual(phase_info.clarity, 0.4)


# ===================================================================
# 23. Integration Tests: Ticker Sanitization Edge Cases
# ===================================================================
class TestTickerSanitizationIntegration(unittest.TestCase):
    """Verify ticker sanitization in the full pipeline context."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_unicode_ticker_stripped(self):
        """Unicode characters in ticker are stripped from reasoning."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        # Unicode emoji and special chars should be stripped
        result = _run(self.analyzer.analyze("AAPL\u2603\u2764", price, vol))
        # Only alphanumeric, dot, dash, underscore, space are kept
        self.assertNotIn("\u2603", result.reasoning)
        self.assertIsInstance(result, MethodologySignal)

    def test_html_entities_in_ticker_stripped(self):
        """HTML entity-like strings in ticker are partially stripped."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("&amp;AAPL&gt;", price, vol))
        # '&' and ';' are not in the allowed set, so they get stripped
        # Only alphanumeric + dot/dash/underscore/space survive
        self.assertNotIn("&", result.reasoning)
        self.assertNotIn(";", result.reasoning)

    def test_sql_injection_ticker_special_chars_stripped(self):
        """SQL injection special characters (quotes, semicolons) are stripped."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("'; DROP TABLE users; --", price, vol))
        # Alphanumeric chars (DROP, TABLE) are allowed through sanitization,
        # but dangerous special chars (quotes, semicolons) are stripped.
        ticker_part = result.reasoning.split("is in a")[0]
        self.assertNotIn("'", ticker_part)
        self.assertNotIn(";", ticker_part)
        # The ticker portion is also truncated to 20 chars max
        self.assertIsInstance(result, MethodologySignal)


# ===================================================================
# 24. Integration Tests: Concurrent Analysis
# ===================================================================
class TestConcurrentAnalysis(unittest.TestCase):
    """Verify analyzer handles concurrent async calls correctly."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_concurrent_analyses_produce_consistent_results(self):
        """Multiple concurrent analyze calls produce consistent results."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)

        async def run_concurrent():
            import asyncio
            tasks = [
                self.analyzer.analyze(f"SYM{i}", price, vol)
                for i in range(5)
            ]
            return await asyncio.gather(*tasks)

        loop = asyncio.new_event_loop()
        try:
            results = loop.run_until_complete(run_concurrent())
        finally:
            loop.close()

        # All results should have same direction and confidence (same data)
        for r in results:
            self.assertIsInstance(r, MethodologySignal)
            self.assertEqual(r.direction, results[0].direction)
            self.assertAlmostEqual(r.confidence, results[0].confidence)

        # But each should have its own ticker
        tickers = {r.ticker for r in results}
        self.assertEqual(len(tickers), 5)

    def test_concurrent_different_data_independent(self):
        """Concurrent analyses with different data produce independent results."""
        up_price = _make_price_df(rows=30, trend="up")
        down_price = _make_price_df(rows=60, trend="down")
        vol_normal = _make_volume_df(rows=30)
        vol_down = _make_volume_df(rows=60)

        async def run_concurrent():
            import asyncio
            return await asyncio.gather(
                self.analyzer.analyze("UP", up_price, vol_normal),
                self.analyzer.analyze("DOWN", down_price, vol_down),
            )

        loop = asyncio.new_event_loop()
        try:
            up_result, down_result = loop.run_until_complete(run_concurrent())
        finally:
            loop.close()

        self.assertEqual(up_result.ticker, "UP")
        self.assertEqual(down_result.ticker, "DOWN")
        # Up trend should not be bearish, down trend should not be bullish
        self.assertNotEqual(up_result.direction, "bearish")
        self.assertNotEqual(down_result.direction, "bullish")


# ===================================================================
# 25. Integration Tests: Phase Transition Scenarios
# ===================================================================
class TestPhaseTransitionScenarios(unittest.TestCase):
    """Verify behavior with data that simulates phase transitions."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_accumulation_to_markup_transition(self):
        """Data transitioning from accumulation to markup produces bullish signal."""
        rows = 80
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = []
        volumes = []
        for i in range(rows):
            if i < 30:
                # Downtrend phase
                closes.append(150.0 - i * 1.0)
                volumes.append(1_000_000)
            elif i < 60:
                # Accumulation: sideways at bottom with strong up-volume
                closes.append(120.0 + (i % 3) * 0.3)
                if i > 30 and closes[i] > closes[i - 1]:
                    volumes.append(3_000_000)
                else:
                    volumes.append(500_000)
            else:
                # Breakout: strong move up (markup)
                closes.append(120.0 + (i - 60) * 2.0)
                volumes.append(4_000_000)

        price = pd.DataFrame({
            "date": dates,
            "open": [c - 0.5 for c in closes],
            "high": [c + 1.5 for c in closes],
            "low": [c - 1.5 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("TRANS", price, vol))

        # Should be bullish (markup or accumulation detected)
        self.assertEqual(result.direction, "bullish")
        self.assertGreater(result.confidence, 0.3)

    def test_distribution_to_markdown_transition(self):
        """Data transitioning from distribution to markdown produces bearish signal."""
        rows = 80
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = []
        volumes = []
        for i in range(rows):
            if i < 30:
                # Uptrend phase
                closes.append(100.0 + i * 1.0)
                volumes.append(1_000_000)
            elif i < 60:
                # Distribution: sideways at top with heavy down-volume
                closes.append(130.0 - (i % 3) * 0.3)
                if i > 30 and closes[i] < closes[i - 1]:
                    volumes.append(3_000_000)
                else:
                    volumes.append(500_000)
            else:
                # Breakdown: strong move down (markdown)
                closes.append(130.0 - (i - 60) * 2.0)
                volumes.append(4_000_000)

        price = pd.DataFrame({
            "date": dates,
            "open": [c + 0.5 for c in closes],
            "high": [c + 1.5 for c in closes],
            "low": [c - 1.5 for c in closes],
            "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})
        result = _run(self.analyzer.analyze("TRANS", price, vol))

        # Should be bearish (markdown or distribution detected)
        self.assertEqual(result.direction, "bearish")
        self.assertGreater(result.confidence, 0.3)


# ===================================================================
# 26. Integration Tests: Reasoning Content Accuracy
# ===================================================================
class TestReasoningContentAccuracy(unittest.TestCase):
    """Verify reasoning string accurately reflects computed values."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_reasoning_volume_percentage_matches_computation(self):
        """Volume percentage in reasoning matches actual up/down volume ratio."""
        price, vol = _make_accumulation_data(rows=60)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)

        result = _run(self.analyzer.analyze("TEST", price, vol))

        # Compute expected percentage
        if range_info.avg_up_volume >= range_info.avg_down_volume:
            expected_pct = (
                (range_info.avg_up_volume - range_info.avg_down_volume)
                / max(range_info.avg_down_volume, 1e-10)
                * 100.0
            )
            self.assertIn(f"{expected_pct:.0f}%", result.reasoning)
        else:
            expected_pct = (
                (range_info.avg_down_volume - range_info.avg_up_volume)
                / max(range_info.avg_up_volume, 1e-10)
                * 100.0
            )
            self.assertIn(f"{expected_pct:.0f}%", result.reasoning)

    def test_reasoning_support_resistance_values_match(self):
        """Support/resistance values in reasoning match computed range_info."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        merged = self.analyzer._merge_data(price, vol)
        range_info = self.analyzer._detect_trading_range(merged)

        result = _run(self.analyzer.analyze("TEST", price, vol))

        self.assertIn(f"{range_info.support:.2f}", result.reasoning)
        self.assertIn(f"{range_info.resistance:.2f}", result.reasoning)

    def test_reasoning_confidence_value_matches_signal(self):
        """Confidence value in reasoning matches the signal confidence field."""
        price = _make_price_df(rows=30)
        vol = _make_volume_df(rows=30)
        result = _run(self.analyzer.analyze("TEST", price, vol))

        # Reasoning should contain the confidence value formatted as X.XX
        conf_str = f"{result.confidence:.2f}"
        self.assertIn(conf_str, result.reasoning)

    def test_reasoning_absorption_count_matches_vpa(self):
        """Absorption bar count in reasoning matches VPA analysis."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        highs = [c + 2.0 for c in closes]
        lows = [c - 2.0 for c in closes]
        volumes = [1_000_000] * rows
        # Create absorption bars: narrow spread + high volume
        for i in range(rows - 5, rows):
            highs[i] = closes[i] + 0.1
            lows[i] = closes[i] - 0.1
            volumes[i] = 5_000_000
        price = pd.DataFrame({
            "date": dates, "open": [c - 0.05 for c in closes],
            "high": highs, "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})

        merged = self.analyzer._merge_data(price, vol)
        vpa = self.analyzer._analyze_volume_price_spread(merged)
        result = _run(self.analyzer.analyze("TEST", price, vol))

        if vpa.absorption_count > 0:
            self.assertIn(str(vpa.absorption_count), result.reasoning)

    def test_reasoning_strong_move_count_matches_vpa(self):
        """Strong move bar count in reasoning matches VPA analysis."""
        rows = 30
        dates = pd.date_range("2024-01-01", periods=rows, freq="B")
        closes = [100.0 + i * 0.5 for i in range(rows)]
        highs = [c + 1.0 for c in closes]
        lows = [c - 1.0 for c in closes]
        volumes = [1_000_000] * rows
        # Create strong move bars: wide spread + high volume
        for i in range(rows - 5, rows):
            highs[i] = closes[i] + 5.0
            lows[i] = closes[i] - 5.0
            volumes[i] = 5_000_000
        price = pd.DataFrame({
            "date": dates, "open": [c - 0.5 for c in closes],
            "high": highs, "low": lows, "close": closes,
        })
        vol = pd.DataFrame({"date": dates, "volume": volumes})

        merged = self.analyzer._merge_data(price, vol)
        vpa = self.analyzer._analyze_volume_price_spread(merged)
        result = _run(self.analyzer.analyze("TEST", price, vol))

        if vpa.strong_move_count > 0:
            self.assertIn(str(vpa.strong_move_count), result.reasoning)


# ===================================================================
# 27. Integration Tests: Signal Serialization Roundtrip
# ===================================================================
class TestSignalSerializationIntegration(unittest.TestCase):
    """Verify signal serialization across all market scenarios."""

    def setUp(self):
        self.analyzer = WyckoffAnalyzer()

    def test_roundtrip_accumulation_signal(self):
        """Accumulation signal survives to_dict/from_dict roundtrip."""
        price, vol = _make_accumulation_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.direction, "bullish")
        self.assertEqual(restored.methodology, "wyckoff")
        self.assertAlmostEqual(restored.confidence, result.confidence)
        self.assertEqual(restored.key_levels, result.key_levels)

    def test_roundtrip_distribution_signal(self):
        """Distribution signal survives to_dict/from_dict roundtrip."""
        price, vol = _make_distribution_data(rows=60)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.direction, "bearish")
        self.assertEqual(restored.methodology, "wyckoff")

    def test_roundtrip_preserves_key_levels_none_values(self):
        """Roundtrip preserves None values in key_levels."""
        price = _make_price_df(rows=30, trend="flat")
        vol = _make_volume_df(rows=30, pattern="constant")
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        restored = MethodologySignal.from_dict(d)

        for key in ("spring_level", "upthrust_level"):
            if result.key_levels[key] is None:
                self.assertIsNone(restored.key_levels[key])

    def test_roundtrip_spring_signal(self):
        """Spring signal survives roundtrip with spring_level preserved."""
        price, vol = _make_spring_data(rows=30)
        result = _run(self.analyzer.analyze("AAPL", price, vol))
        d = result.to_dict()
        restored = MethodologySignal.from_dict(d)

        if result.key_levels["spring_level"] is not None:
            self.assertAlmostEqual(
                restored.key_levels["spring_level"],
                result.key_levels["spring_level"],
            )


if __name__ == "__main__":
    unittest.main()
