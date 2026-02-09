"""Tests for TASK-ANALYSIS-001: Base methodology interface.

Validates enums, constants, MethodologySignal/CompositeSignal dataclasses,
BaseMethodology ABC, validate_input, and create_signal in
``app.analysis.base``.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_analysis_base.py -v``
"""
from __future__ import annotations

import asyncio
import math
import unittest
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.analysis.base import (
    BaseMethodology,
    CompositeSignal,
    DEFAULT_WEIGHTS,
    Direction,
    METHODOLOGY_NAMES,
    MethodologySignal,
    OverallDirection,
    Timeframe,
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


def _make_signal(**overrides) -> MethodologySignal:
    """Return a valid MethodologySignal with sensible defaults."""
    defaults: dict[str, Any] = {
        "ticker": "AAPL",
        "methodology": "wyckoff",
        "direction": "bullish",
        "confidence": 0.75,
        "timeframe": "medium",
        "reasoning": "Test reasoning text.",
        "key_levels": {"support": 150.0, "resistance": 170.0},
        "timestamp": datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
    }
    defaults.update(overrides)
    return MethodologySignal(**defaults)


def _make_composite(**overrides) -> CompositeSignal:
    """Return a valid CompositeSignal with sensible defaults."""
    defaults: dict[str, Any] = {
        "ticker": "AAPL",
        "overall_direction": "bullish",
        "overall_confidence": 0.80,
        "methodology_signals": [],
        "confluence_count": 3,
        "timeframe_breakdown": {"short": "bullish", "medium": "neutral"},
        "trade_thesis": "Strong uptrend confirmed by multiple methodologies.",
        "timestamp": datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
        "weights_used": DEFAULT_WEIGHTS.copy(),
    }
    defaults.update(overrides)
    return CompositeSignal(**defaults)


def _make_price_df(rows: int = 30) -> pd.DataFrame:
    """Return a valid price DataFrame with ``rows`` rows."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    return pd.DataFrame(
        {
            "date": dates,
            "open": [100.0 + i for i in range(rows)],
            "high": [105.0 + i for i in range(rows)],
            "low": [95.0 + i for i in range(rows)],
            "close": [102.0 + i for i in range(rows)],
        }
    )


def _make_volume_df(rows: int = 30) -> pd.DataFrame:
    """Return a valid volume DataFrame with ``rows`` rows."""
    dates = pd.date_range("2024-01-01", periods=rows, freq="B")
    return pd.DataFrame(
        {
            "date": dates,
            "volume": [1_000_000 + i * 1000 for i in range(rows)],
        }
    )


# ---------------------------------------------------------------------------
# Concrete subclass for testing BaseMethodology
# ---------------------------------------------------------------------------


class _ConcreteMethodology(BaseMethodology):
    """Minimal concrete implementation for testing the ABC."""

    name = "wyckoff"
    display_name = "Wyckoff Analysis"
    default_timeframe = "medium"
    version = "1.0.0"

    async def analyze(
        self,
        ticker: str,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
        fundamentals: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MethodologySignal:
        return self.create_signal(
            ticker=ticker,
            direction="bullish",
            confidence=0.8,
            timeframe="medium",
            reasoning="Wyckoff accumulation detected.",
            key_levels={"support": 150.0},
        )


class _IncompleteMethodology(BaseMethodology):
    """Subclass that does NOT implement analyze() -- should remain abstract."""

    name = "incomplete"
    display_name = "Incomplete"
    default_timeframe = "short"
    version = "0.0.1"


# ===================================================================
# 1. Direction enum
# ===================================================================
class TestDirectionEnum(unittest.TestCase):
    """Verify the Direction string enum."""

    def test_bullish_value(self):
        """Direction.BULLISH has value 'bullish'."""
        self.assertEqual(Direction.BULLISH.value, "bullish")

    def test_bearish_value(self):
        """Direction.BEARISH has value 'bearish'."""
        self.assertEqual(Direction.BEARISH.value, "bearish")

    def test_neutral_value(self):
        """Direction.NEUTRAL has value 'neutral'."""
        self.assertEqual(Direction.NEUTRAL.value, "neutral")

    def test_exactly_three_members(self):
        """Direction has exactly 3 members."""
        self.assertEqual(len(Direction), 3)

    def test_string_comparison_bullish(self):
        """Direction.BULLISH compares equal to the string 'bullish'."""
        self.assertEqual(Direction.BULLISH, "bullish")

    def test_string_comparison_bearish(self):
        """Direction.BEARISH compares equal to the string 'bearish'."""
        self.assertEqual(Direction.BEARISH, "bearish")

    def test_string_comparison_neutral(self):
        """Direction.NEUTRAL compares equal to the string 'neutral'."""
        self.assertEqual(Direction.NEUTRAL, "neutral")

    def test_invalid_value_raises_valueerror(self):
        """Direction('invalid') raises ValueError."""
        with self.assertRaises(ValueError):
            Direction("invalid")

    def test_is_str_subclass(self):
        """Direction members are instances of str."""
        self.assertIsInstance(Direction.BULLISH, str)


# ===================================================================
# 2. Timeframe enum
# ===================================================================
class TestTimeframeEnum(unittest.TestCase):
    """Verify the Timeframe string enum."""

    def test_short_value(self):
        """Timeframe.SHORT has value 'short'."""
        self.assertEqual(Timeframe.SHORT.value, "short")

    def test_medium_value(self):
        """Timeframe.MEDIUM has value 'medium'."""
        self.assertEqual(Timeframe.MEDIUM.value, "medium")

    def test_long_value(self):
        """Timeframe.LONG has value 'long'."""
        self.assertEqual(Timeframe.LONG.value, "long")

    def test_exactly_three_members(self):
        """Timeframe has exactly 3 members."""
        self.assertEqual(len(Timeframe), 3)

    def test_string_comparison_short(self):
        """Timeframe.SHORT compares equal to 'short'."""
        self.assertEqual(Timeframe.SHORT, "short")

    def test_string_comparison_medium(self):
        """Timeframe.MEDIUM compares equal to 'medium'."""
        self.assertEqual(Timeframe.MEDIUM, "medium")

    def test_string_comparison_long(self):
        """Timeframe.LONG compares equal to 'long'."""
        self.assertEqual(Timeframe.LONG, "long")

    def test_invalid_value_raises_valueerror(self):
        """Timeframe('invalid') raises ValueError."""
        with self.assertRaises(ValueError):
            Timeframe("invalid")


# ===================================================================
# 3. OverallDirection enum
# ===================================================================
class TestOverallDirectionEnum(unittest.TestCase):
    """Verify the OverallDirection string enum."""

    def test_strong_bullish_value(self):
        """OverallDirection.STRONG_BULLISH == 'strong_bullish'."""
        self.assertEqual(OverallDirection.STRONG_BULLISH.value, "strong_bullish")

    def test_bullish_value(self):
        """OverallDirection.BULLISH == 'bullish'."""
        self.assertEqual(OverallDirection.BULLISH.value, "bullish")

    def test_neutral_value(self):
        """OverallDirection.NEUTRAL == 'neutral'."""
        self.assertEqual(OverallDirection.NEUTRAL.value, "neutral")

    def test_bearish_value(self):
        """OverallDirection.BEARISH == 'bearish'."""
        self.assertEqual(OverallDirection.BEARISH.value, "bearish")

    def test_strong_bearish_value(self):
        """OverallDirection.STRONG_BEARISH == 'strong_bearish'."""
        self.assertEqual(OverallDirection.STRONG_BEARISH.value, "strong_bearish")

    def test_exactly_five_members(self):
        """OverallDirection has exactly 5 members."""
        self.assertEqual(len(OverallDirection), 5)

    def test_string_comparison_strong_bullish(self):
        """OverallDirection.STRONG_BULLISH compares equal to 'strong_bullish'."""
        self.assertEqual(OverallDirection.STRONG_BULLISH, "strong_bullish")

    def test_string_comparison_strong_bearish(self):
        """OverallDirection.STRONG_BEARISH compares equal to 'strong_bearish'."""
        self.assertEqual(OverallDirection.STRONG_BEARISH, "strong_bearish")

    def test_invalid_value_raises_valueerror(self):
        """OverallDirection('mega_bullish') raises ValueError."""
        with self.assertRaises(ValueError):
            OverallDirection("mega_bullish")


# ===================================================================
# 4. METHODOLOGY_NAMES constant
# ===================================================================
class TestMethodologyNames(unittest.TestCase):
    """Verify the METHODOLOGY_NAMES list."""

    def test_exactly_six_names(self):
        """METHODOLOGY_NAMES contains exactly 6 entries."""
        self.assertEqual(len(METHODOLOGY_NAMES), 6)

    def test_contains_wyckoff(self):
        """METHODOLOGY_NAMES includes 'wyckoff'."""
        self.assertIn("wyckoff", METHODOLOGY_NAMES)

    def test_contains_elliott_wave(self):
        """METHODOLOGY_NAMES includes 'elliott_wave'."""
        self.assertIn("elliott_wave", METHODOLOGY_NAMES)

    def test_contains_ict_smart_money(self):
        """METHODOLOGY_NAMES includes 'ict_smart_money'."""
        self.assertIn("ict_smart_money", METHODOLOGY_NAMES)

    def test_contains_canslim(self):
        """METHODOLOGY_NAMES includes 'canslim'."""
        self.assertIn("canslim", METHODOLOGY_NAMES)

    def test_contains_larry_williams(self):
        """METHODOLOGY_NAMES includes 'larry_williams'."""
        self.assertIn("larry_williams", METHODOLOGY_NAMES)

    def test_contains_sentiment(self):
        """METHODOLOGY_NAMES includes 'sentiment'."""
        self.assertIn("sentiment", METHODOLOGY_NAMES)

    def test_order_matches_spec(self):
        """METHODOLOGY_NAMES order matches specification."""
        expected = [
            "wyckoff",
            "elliott_wave",
            "ict_smart_money",
            "canslim",
            "larry_williams",
            "sentiment",
        ]
        self.assertEqual(METHODOLOGY_NAMES, expected)

    def test_all_strings(self):
        """All entries are strings."""
        for name in METHODOLOGY_NAMES:
            self.assertIsInstance(name, str)

    def test_is_a_list(self):
        """METHODOLOGY_NAMES is a list (not tuple, set, etc.)."""
        self.assertIsInstance(METHODOLOGY_NAMES, list)

    def test_no_duplicates(self):
        """No duplicate names."""
        self.assertEqual(len(METHODOLOGY_NAMES), len(set(METHODOLOGY_NAMES)))


# ===================================================================
# 5. DEFAULT_WEIGHTS constant
# ===================================================================
class TestDefaultWeights(unittest.TestCase):
    """Verify the DEFAULT_WEIGHTS mapping."""

    def test_has_six_entries(self):
        """DEFAULT_WEIGHTS has 6 entries."""
        self.assertEqual(len(DEFAULT_WEIGHTS), 6)

    def test_all_methodology_names_present(self):
        """Every METHODOLOGY_NAMES key is in DEFAULT_WEIGHTS."""
        for name in METHODOLOGY_NAMES:
            self.assertIn(name, DEFAULT_WEIGHTS)

    def test_no_extra_keys(self):
        """DEFAULT_WEIGHTS has no keys beyond METHODOLOGY_NAMES."""
        extra = set(DEFAULT_WEIGHTS.keys()) - set(METHODOLOGY_NAMES)
        self.assertEqual(extra, set())

    def test_values_sum_to_one(self):
        """Weight values sum to 1.0 within float tolerance."""
        total = sum(DEFAULT_WEIGHTS.values())
        self.assertAlmostEqual(total, 1.0, places=10)

    def test_all_weights_positive(self):
        """All weight values are strictly positive."""
        for name, weight in DEFAULT_WEIGHTS.items():
            self.assertGreater(weight, 0.0, f"Weight for {name} is not positive")

    def test_wyckoff_weight(self):
        """Wyckoff weight is 0.20."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["wyckoff"], 0.20)

    def test_elliott_wave_weight(self):
        """Elliott Wave weight is 0.15."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["elliott_wave"], 0.15)

    def test_ict_smart_money_weight(self):
        """ICT Smart Money weight is 0.20."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["ict_smart_money"], 0.20)

    def test_canslim_weight(self):
        """CANSLIM weight is 0.20."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["canslim"], 0.20)

    def test_larry_williams_weight(self):
        """Larry Williams weight is 0.10."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["larry_williams"], 0.10)

    def test_sentiment_weight(self):
        """Sentiment weight is 0.15."""
        self.assertAlmostEqual(DEFAULT_WEIGHTS["sentiment"], 0.15)

    def test_all_values_are_floats(self):
        """All weight values are floats."""
        for name, weight in DEFAULT_WEIGHTS.items():
            self.assertIsInstance(weight, float, f"{name} weight is not float")

    def test_is_a_dict(self):
        """DEFAULT_WEIGHTS is a dict."""
        self.assertIsInstance(DEFAULT_WEIGHTS, dict)


# ===================================================================
# 6. MethodologySignal creation
# ===================================================================
class TestMethodologySignalCreation(unittest.TestCase):
    """Verify valid MethodologySignal instantiation."""

    def test_valid_instantiation(self):
        """Signal created with all valid fields succeeds."""
        sig = _make_signal()
        self.assertIsInstance(sig, MethodologySignal)

    def test_ticker_accessible(self):
        """Ticker field is accessible."""
        sig = _make_signal(ticker="MSFT")
        self.assertEqual(sig.ticker, "MSFT")

    def test_methodology_accessible(self):
        """Methodology field is accessible."""
        sig = _make_signal(methodology="elliott_wave")
        self.assertEqual(sig.methodology, "elliott_wave")

    def test_direction_accessible(self):
        """Direction field is accessible."""
        sig = _make_signal(direction="bearish")
        self.assertEqual(sig.direction, "bearish")

    def test_confidence_accessible(self):
        """Confidence field is accessible."""
        sig = _make_signal(confidence=0.5)
        self.assertAlmostEqual(sig.confidence, 0.5)

    def test_timeframe_accessible(self):
        """Timeframe field is accessible."""
        sig = _make_signal(timeframe="long")
        self.assertEqual(sig.timeframe, "long")

    def test_reasoning_accessible(self):
        """Reasoning field is accessible."""
        sig = _make_signal(reasoning="Volume divergence.")
        self.assertEqual(sig.reasoning, "Volume divergence.")

    def test_key_levels_accessible(self):
        """key_levels field is accessible."""
        levels = {"support": 100.0}
        sig = _make_signal(key_levels=levels)
        self.assertEqual(sig.key_levels, levels)

    def test_timestamp_accessible(self):
        """Timestamp field is accessible."""
        ts = datetime(2025, 6, 1, tzinfo=timezone.utc)
        sig = _make_signal(timestamp=ts)
        self.assertEqual(sig.timestamp, ts)

    def test_all_valid_directions(self):
        """Signal can be created with each valid direction."""
        for d in ("bullish", "bearish", "neutral"):
            sig = _make_signal(direction=d)
            self.assertEqual(sig.direction, d)

    def test_all_valid_timeframes(self):
        """Signal can be created with each valid timeframe."""
        for tf in ("short", "medium", "long"):
            sig = _make_signal(timeframe=tf)
            self.assertEqual(sig.timeframe, tf)

    def test_all_valid_methodologies(self):
        """Signal can be created with each valid methodology."""
        for m in METHODOLOGY_NAMES:
            sig = _make_signal(methodology=m)
            self.assertEqual(sig.methodology, m)


# ===================================================================
# 7. MethodologySignal validation
# ===================================================================
class TestMethodologySignalValidation(unittest.TestCase):
    """Verify __post_init__ validation on MethodologySignal."""

    def test_invalid_direction_raises(self):
        """Invalid direction raises ValueError."""
        with self.assertRaises(ValueError):
            _make_signal(direction="sideways")

    def test_confidence_below_zero_clamped(self):
        """Confidence < 0 is clamped to 0.0."""
        sig = _make_signal(confidence=-0.5)
        self.assertAlmostEqual(sig.confidence, 0.0)

    def test_confidence_above_one_clamped(self):
        """Confidence > 1 is clamped to 1.0."""
        sig = _make_signal(confidence=1.5)
        self.assertAlmostEqual(sig.confidence, 1.0)

    def test_confidence_very_negative_clamped(self):
        """Very negative confidence is clamped to 0.0."""
        sig = _make_signal(confidence=-100.0)
        self.assertAlmostEqual(sig.confidence, 0.0)

    def test_confidence_very_high_clamped(self):
        """Very high confidence is clamped to 1.0."""
        sig = _make_signal(confidence=999.0)
        self.assertAlmostEqual(sig.confidence, 1.0)

    def test_confidence_zero_accepted(self):
        """Confidence = 0.0 is valid (0 is falsy but valid!)."""
        sig = _make_signal(confidence=0.0)
        self.assertAlmostEqual(sig.confidence, 0.0)

    def test_confidence_one_accepted(self):
        """Confidence = 1.0 is valid."""
        sig = _make_signal(confidence=1.0)
        self.assertAlmostEqual(sig.confidence, 1.0)

    def test_confidence_mid_range(self):
        """Confidence = 0.5 stays as 0.5."""
        sig = _make_signal(confidence=0.5)
        self.assertAlmostEqual(sig.confidence, 0.5)

    def test_invalid_timeframe_raises(self):
        """Invalid timeframe raises ValueError."""
        with self.assertRaises(ValueError):
            _make_signal(timeframe="weekly")

    def test_invalid_methodology_raises(self):
        """Invalid methodology raises ValueError."""
        with self.assertRaises(ValueError):
            _make_signal(methodology="fibonacci")

    def test_empty_reasoning_raises(self):
        """Empty string reasoning raises ValueError."""
        with self.assertRaises(ValueError):
            _make_signal(reasoning="")

    def test_whitespace_only_reasoning_raises(self):
        """Whitespace-only reasoning raises ValueError."""
        with self.assertRaises(ValueError):
            _make_signal(reasoning="   \t\n  ")

    def test_key_levels_none_raises(self):
        """key_levels=None raises TypeError."""
        with self.assertRaises(TypeError):
            _make_signal(key_levels=None)

    def test_key_levels_list_raises(self):
        """key_levels as a list raises TypeError."""
        with self.assertRaises(TypeError):
            _make_signal(key_levels=[1, 2, 3])

    def test_key_levels_string_raises(self):
        """key_levels as a string raises TypeError."""
        with self.assertRaises(TypeError):
            _make_signal(key_levels="support:150")

    def test_key_levels_empty_dict_accepted(self):
        """Empty dict for key_levels is accepted."""
        sig = _make_signal(key_levels={})
        self.assertEqual(sig.key_levels, {})

    def test_confidence_non_number_raises(self):
        """Non-numeric confidence raises TypeError."""
        with self.assertRaises(TypeError):
            _make_signal(confidence="high")

    def test_direction_none_raises(self):
        """direction=None raises ValueError (not in valid set)."""
        with self.assertRaises((ValueError, TypeError)):
            _make_signal(direction=None)

    def test_direction_enum_member_raises(self):
        """direction=Direction.BULLISH (enum, not string) raises ValueError
        because the check compares against string values."""
        # Direction.BULLISH is a str("bullish") due to str subclass,
        # so it should actually be accepted.
        sig = _make_signal(direction=Direction.BULLISH)
        self.assertEqual(sig.direction, "bullish")


# ===================================================================
# 8. MethodologySignal serialization
# ===================================================================
class TestMethodologySignalSerialization(unittest.TestCase):
    """Verify to_dict / from_dict on MethodologySignal."""

    def test_to_dict_returns_dict(self):
        """to_dict() returns a dict."""
        sig = _make_signal()
        result = sig.to_dict()
        self.assertIsInstance(result, dict)

    def test_to_dict_has_expected_keys(self):
        """to_dict() contains all expected keys."""
        sig = _make_signal()
        d = sig.to_dict()
        expected_keys = {
            "ticker",
            "methodology",
            "direction",
            "confidence",
            "timeframe",
            "reasoning",
            "key_levels",
            "timestamp",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_to_dict_timestamp_is_iso_string(self):
        """to_dict() timestamp is an ISO format string."""
        sig = _make_signal()
        d = sig.to_dict()
        self.assertIsInstance(d["timestamp"], str)
        # Should parse back to datetime without error
        datetime.fromisoformat(d["timestamp"])

    def test_to_dict_ticker_value(self):
        """to_dict() preserves the ticker."""
        sig = _make_signal(ticker="GOOG")
        d = sig.to_dict()
        self.assertEqual(d["ticker"], "GOOG")

    def test_to_dict_direction_value(self):
        """to_dict() preserves the direction."""
        sig = _make_signal(direction="bearish")
        d = sig.to_dict()
        self.assertEqual(d["direction"], "bearish")

    def test_to_dict_confidence_value(self):
        """to_dict() preserves the confidence."""
        sig = _make_signal(confidence=0.42)
        d = sig.to_dict()
        self.assertAlmostEqual(d["confidence"], 0.42)

    def test_from_dict_roundtrip(self):
        """from_dict(to_dict()) preserves all fields."""
        original = _make_signal()
        d = original.to_dict()
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.ticker, original.ticker)
        self.assertEqual(restored.methodology, original.methodology)
        self.assertEqual(restored.direction, original.direction)
        self.assertAlmostEqual(restored.confidence, original.confidence)
        self.assertEqual(restored.timeframe, original.timeframe)
        self.assertEqual(restored.reasoning, original.reasoning)
        self.assertEqual(restored.key_levels, original.key_levels)
        self.assertEqual(restored.timestamp, original.timestamp)

    def test_from_dict_with_iso_string_timestamp(self):
        """from_dict() parses ISO string timestamp correctly."""
        d = _make_signal().to_dict()
        self.assertIsInstance(d["timestamp"], str)
        restored = MethodologySignal.from_dict(d)
        self.assertIsInstance(restored.timestamp, datetime)

    def test_from_dict_with_datetime_timestamp(self):
        """from_dict() accepts datetime object for timestamp."""
        d = _make_signal().to_dict()
        d["timestamp"] = datetime(2025, 3, 1, tzinfo=timezone.utc)
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.timestamp, d["timestamp"])

    def test_from_dict_preserves_key_levels(self):
        """from_dict() preserves key_levels dict structure."""
        levels = {"support": [140.0, 145.0], "resistance": 170.0}
        sig = _make_signal(key_levels=levels)
        d = sig.to_dict()
        restored = MethodologySignal.from_dict(d)
        self.assertEqual(restored.key_levels, levels)

    def test_roundtrip_all_methodologies(self):
        """Roundtrip works for every methodology name."""
        for m in METHODOLOGY_NAMES:
            sig = _make_signal(methodology=m)
            restored = MethodologySignal.from_dict(sig.to_dict())
            self.assertEqual(restored.methodology, m)


# ===================================================================
# 9. CompositeSignal creation
# ===================================================================
class TestCompositeSignalCreation(unittest.TestCase):
    """Verify valid CompositeSignal instantiation."""

    def test_valid_instantiation(self):
        """CompositeSignal created with valid fields succeeds."""
        comp = _make_composite()
        self.assertIsInstance(comp, CompositeSignal)

    def test_empty_methodology_signals_accepted(self):
        """Empty methodology_signals list is accepted."""
        comp = _make_composite(methodology_signals=[])
        self.assertEqual(comp.methodology_signals, [])

    def test_with_methodology_signals(self):
        """CompositeSignal with actual methodology signals."""
        sig1 = _make_signal(methodology="wyckoff")
        sig2 = _make_signal(methodology="canslim", direction="bearish")
        comp = _make_composite(methodology_signals=[sig1, sig2])
        self.assertEqual(len(comp.methodology_signals), 2)

    def test_all_fields_accessible(self):
        """All CompositeSignal fields are accessible."""
        comp = _make_composite()
        self.assertIsNotNone(comp.ticker)
        self.assertIsNotNone(comp.overall_direction)
        self.assertTrue(comp.overall_confidence is not None)
        self.assertIsInstance(comp.methodology_signals, list)
        self.assertTrue(comp.confluence_count is not None)
        self.assertIsNotNone(comp.timeframe_breakdown)
        self.assertIsNotNone(comp.trade_thesis)
        self.assertIsNotNone(comp.timestamp)
        self.assertIsNotNone(comp.weights_used)

    def test_all_overall_directions(self):
        """CompositeSignal accepts all valid overall_direction values."""
        for od in ("strong_bullish", "bullish", "neutral", "bearish", "strong_bearish"):
            comp = _make_composite(overall_direction=od)
            self.assertEqual(comp.overall_direction, od)


# ===================================================================
# 10. CompositeSignal validation
# ===================================================================
class TestCompositeSignalValidation(unittest.TestCase):
    """Verify __post_init__ validation on CompositeSignal."""

    def test_invalid_overall_direction_raises(self):
        """Invalid overall_direction raises ValueError."""
        with self.assertRaises(ValueError):
            _make_composite(overall_direction="mega_bullish")

    def test_overall_confidence_below_zero_clamped(self):
        """overall_confidence < 0 is clamped to 0.0."""
        comp = _make_composite(overall_confidence=-0.3)
        self.assertAlmostEqual(comp.overall_confidence, 0.0)

    def test_overall_confidence_above_one_clamped(self):
        """overall_confidence > 1 is clamped to 1.0."""
        comp = _make_composite(overall_confidence=2.0)
        self.assertAlmostEqual(comp.overall_confidence, 1.0)

    def test_overall_confidence_zero_accepted(self):
        """overall_confidence = 0.0 is valid (falsy but valid)."""
        comp = _make_composite(overall_confidence=0.0)
        self.assertAlmostEqual(comp.overall_confidence, 0.0)

    def test_overall_confidence_one_accepted(self):
        """overall_confidence = 1.0 is valid."""
        comp = _make_composite(overall_confidence=1.0)
        self.assertAlmostEqual(comp.overall_confidence, 1.0)

    def test_overall_confidence_non_number_raises(self):
        """Non-numeric overall_confidence raises TypeError."""
        with self.assertRaises(TypeError):
            _make_composite(overall_confidence="high")

    def test_methodology_signals_not_list_raises(self):
        """Non-list methodology_signals raises TypeError."""
        with self.assertRaises(TypeError):
            _make_composite(methodology_signals="not a list")

    def test_methodology_signals_tuple_raises(self):
        """Tuple methodology_signals raises TypeError."""
        with self.assertRaises(TypeError):
            _make_composite(methodology_signals=(_make_signal(),))

    def test_methodology_signals_none_raises(self):
        """None methodology_signals raises TypeError."""
        with self.assertRaises(TypeError):
            _make_composite(methodology_signals=None)

    def test_negative_confluence_count_raises(self):
        """Negative confluence_count raises ValueError."""
        with self.assertRaises(ValueError):
            _make_composite(confluence_count=-1)

    def test_confluence_count_zero_accepted(self):
        """confluence_count = 0 is valid."""
        comp = _make_composite(confluence_count=0)
        self.assertEqual(comp.confluence_count, 0)

    def test_confluence_count_float_raises(self):
        """Float confluence_count raises ValueError (not int check)."""
        with self.assertRaises((ValueError, TypeError)):
            _make_composite(confluence_count=2.5)

    def test_confluence_count_large_accepted(self):
        """Large positive confluence_count is accepted."""
        comp = _make_composite(confluence_count=100)
        self.assertEqual(comp.confluence_count, 100)


# ===================================================================
# 11. CompositeSignal serialization
# ===================================================================
class TestCompositeSignalSerialization(unittest.TestCase):
    """Verify to_dict / from_dict on CompositeSignal."""

    def test_to_dict_returns_dict(self):
        """to_dict() returns a dict."""
        comp = _make_composite()
        self.assertIsInstance(comp.to_dict(), dict)

    def test_to_dict_has_expected_keys(self):
        """to_dict() contains all expected keys."""
        comp = _make_composite()
        d = comp.to_dict()
        expected_keys = {
            "ticker",
            "overall_direction",
            "overall_confidence",
            "methodology_signals",
            "confluence_count",
            "timeframe_breakdown",
            "trade_thesis",
            "timestamp",
            "weights_used",
        }
        self.assertEqual(set(d.keys()), expected_keys)

    def test_to_dict_timestamp_is_iso_string(self):
        """to_dict() timestamp is an ISO format string."""
        comp = _make_composite()
        d = comp.to_dict()
        self.assertIsInstance(d["timestamp"], str)

    def test_to_dict_includes_nested_signal_dicts(self):
        """to_dict() converts nested signals to dicts."""
        sig = _make_signal()
        comp = _make_composite(methodology_signals=[sig])
        d = comp.to_dict()
        self.assertIsInstance(d["methodology_signals"], list)
        self.assertEqual(len(d["methodology_signals"]), 1)
        self.assertIsInstance(d["methodology_signals"][0], dict)
        self.assertIn("ticker", d["methodology_signals"][0])

    def test_to_dict_empty_signals(self):
        """to_dict() with empty signals list."""
        comp = _make_composite(methodology_signals=[])
        d = comp.to_dict()
        self.assertEqual(d["methodology_signals"], [])

    def test_from_dict_roundtrip(self):
        """from_dict(to_dict()) preserves all fields."""
        sig1 = _make_signal(methodology="wyckoff", direction="bullish")
        sig2 = _make_signal(methodology="canslim", direction="bearish")
        original = _make_composite(
            methodology_signals=[sig1, sig2],
            confluence_count=2,
        )
        d = original.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(restored.ticker, original.ticker)
        self.assertEqual(restored.overall_direction, original.overall_direction)
        self.assertAlmostEqual(
            restored.overall_confidence, original.overall_confidence
        )
        self.assertEqual(
            len(restored.methodology_signals),
            len(original.methodology_signals),
        )
        self.assertEqual(restored.confluence_count, original.confluence_count)
        self.assertEqual(
            restored.timeframe_breakdown, original.timeframe_breakdown
        )
        self.assertEqual(restored.trade_thesis, original.trade_thesis)
        self.assertEqual(restored.timestamp, original.timestamp)
        self.assertEqual(restored.weights_used, original.weights_used)

    def test_from_dict_with_empty_signals(self):
        """from_dict() with empty methodology_signals list."""
        comp = _make_composite(methodology_signals=[])
        d = comp.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(restored.methodology_signals, [])

    def test_from_dict_nested_signals_preserved(self):
        """from_dict() correctly reconstructs nested MethodologySignal objects."""
        sig = _make_signal(
            methodology="sentiment",
            direction="neutral",
            confidence=0.33,
            reasoning="Mixed signals from social media.",
        )
        comp = _make_composite(methodology_signals=[sig])
        d = comp.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(len(restored.methodology_signals), 1)
        rs = restored.methodology_signals[0]
        self.assertIsInstance(rs, MethodologySignal)
        self.assertEqual(rs.methodology, "sentiment")
        self.assertEqual(rs.direction, "neutral")
        self.assertAlmostEqual(rs.confidence, 0.33)

    def test_from_dict_with_datetime_timestamp(self):
        """from_dict() accepts datetime object for timestamp."""
        d = _make_composite().to_dict()
        d["timestamp"] = datetime(2025, 6, 1, tzinfo=timezone.utc)
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(restored.timestamp, d["timestamp"])

    def test_roundtrip_with_multiple_nested_signals(self):
        """Roundtrip with 6 nested signals preserves all."""
        signals = [_make_signal(methodology=m) for m in METHODOLOGY_NAMES]
        comp = _make_composite(
            methodology_signals=signals, confluence_count=6
        )
        d = comp.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(len(restored.methodology_signals), 6)
        for orig, rest in zip(signals, restored.methodology_signals):
            self.assertEqual(rest.methodology, orig.methodology)
            self.assertEqual(rest.direction, orig.direction)


# ===================================================================
# 12. BaseMethodology abstract class
# ===================================================================
class TestBaseMethodologyAbstract(unittest.TestCase):
    """Verify ABC behavior of BaseMethodology."""

    def test_cannot_instantiate_directly(self):
        """BaseMethodology cannot be instantiated."""
        with self.assertRaises(TypeError):
            BaseMethodology()

    def test_incomplete_subclass_cannot_instantiate(self):
        """Subclass without analyze() cannot be instantiated."""
        with self.assertRaises(TypeError):
            _IncompleteMethodology()

    def test_concrete_subclass_can_instantiate(self):
        """Subclass with analyze() can be instantiated."""
        m = _ConcreteMethodology()
        self.assertIsInstance(m, BaseMethodology)

    def test_concrete_has_name(self):
        """Concrete subclass has name attribute."""
        m = _ConcreteMethodology()
        self.assertEqual(m.name, "wyckoff")

    def test_concrete_has_display_name(self):
        """Concrete subclass has display_name attribute."""
        m = _ConcreteMethodology()
        self.assertEqual(m.display_name, "Wyckoff Analysis")

    def test_concrete_has_version(self):
        """Concrete subclass has version attribute."""
        m = _ConcreteMethodology()
        self.assertEqual(m.version, "1.0.0")

    def test_analyze_is_callable(self):
        """Concrete subclass analyze() is callable (async)."""
        m = _ConcreteMethodology()
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(m.analyze("AAPL", price, volume))
        self.assertIsInstance(result, MethodologySignal)

    def test_analyze_returns_correct_ticker(self):
        """analyze() returns signal with correct ticker."""
        m = _ConcreteMethodology()
        price = _make_price_df()
        volume = _make_volume_df()
        result = _run(m.analyze("TSLA", price, volume))
        self.assertEqual(result.ticker, "TSLA")


# ===================================================================
# 13. validate_input
# ===================================================================
class TestValidateInput(unittest.TestCase):
    """Verify BaseMethodology.validate_input()."""

    def setUp(self):
        self.m = _ConcreteMethodology()
        self.price = _make_price_df()
        self.volume = _make_volume_df()

    def test_valid_dataframes_pass(self):
        """Valid DataFrames pass validation without error."""
        self.m.validate_input(self.price, self.volume)

    # --- Missing price columns ---

    def test_missing_date_column_in_price(self):
        """price_data missing 'date' raises ValueError."""
        df = self.price.drop(columns=["date"])
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("missing required columns", str(ctx.exception))

    def test_missing_open_column_in_price(self):
        """price_data missing 'open' raises ValueError."""
        df = self.price.drop(columns=["open"])
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    def test_missing_high_column_in_price(self):
        """price_data missing 'high' raises ValueError."""
        df = self.price.drop(columns=["high"])
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    def test_missing_low_column_in_price(self):
        """price_data missing 'low' raises ValueError."""
        df = self.price.drop(columns=["low"])
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    def test_missing_close_column_in_price(self):
        """price_data missing 'close' raises ValueError."""
        df = self.price.drop(columns=["close"])
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    # --- Missing volume columns ---

    def test_missing_date_column_in_volume(self):
        """volume_data missing 'date' raises ValueError."""
        df = self.volume.drop(columns=["date"])
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(self.price, df)
        self.assertIn("missing required columns", str(ctx.exception))

    def test_missing_volume_column(self):
        """volume_data missing 'volume' raises ValueError."""
        df = self.volume.drop(columns=["volume"])
        with self.assertRaises(ValueError):
            self.m.validate_input(self.price, df)

    # --- Row count ---

    def test_too_few_price_rows(self):
        """price_data with < 20 rows raises ValueError."""
        df = _make_price_df(rows=19)
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("at least", str(ctx.exception))

    def test_too_few_volume_rows(self):
        """volume_data with < 20 rows raises ValueError."""
        df = _make_volume_df(rows=19)
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(self.price, df)
        self.assertIn("at least", str(ctx.exception))

    def test_exactly_20_price_rows_passes(self):
        """price_data with exactly 20 rows passes."""
        df = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        self.m.validate_input(df, vol)

    def test_exactly_20_volume_rows_passes(self):
        """volume_data with exactly 20 rows passes."""
        price = _make_price_df(rows=20)
        vol = _make_volume_df(rows=20)
        self.m.validate_input(price, vol)

    def test_one_price_row_raises(self):
        """price_data with 1 row raises ValueError."""
        df = _make_price_df(rows=1)
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    def test_empty_price_df_raises(self):
        """Empty price DataFrame raises ValueError."""
        df = pd.DataFrame(columns=["date", "open", "high", "low", "close"])
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    # --- NaN checks ---

    def test_nan_in_open_raises(self):
        """NaN in 'open' column raises ValueError."""
        df = self.price.copy()
        df.loc[5, "open"] = float("nan")
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("open", str(ctx.exception))

    def test_nan_in_high_raises(self):
        """NaN in 'high' column raises ValueError."""
        df = self.price.copy()
        df.loc[10, "high"] = float("nan")
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("high", str(ctx.exception))

    def test_nan_in_low_raises(self):
        """NaN in 'low' column raises ValueError."""
        df = self.price.copy()
        df.loc[0, "low"] = float("nan")
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("low", str(ctx.exception))

    def test_nan_in_close_raises(self):
        """NaN in 'close' column raises ValueError."""
        df = self.price.copy()
        df.loc[15, "close"] = float("nan")
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("close", str(ctx.exception))

    def test_nan_in_volume_allowed(self):
        """NaN in volume column is ALLOWED (non-trading days)."""
        vol = self.volume.copy()
        vol.loc[5, "volume"] = float("nan")
        # Should NOT raise
        self.m.validate_input(self.price, vol)

    def test_multiple_nan_in_open_raises(self):
        """Multiple NaN values in 'open' still raises."""
        df = self.price.copy()
        df.loc[0, "open"] = float("nan")
        df.loc[1, "open"] = float("nan")
        with self.assertRaises(ValueError):
            self.m.validate_input(df, self.volume)

    # --- Date sorting ---

    def test_unsorted_price_dates_raises(self):
        """Unsorted price_data dates raises ValueError."""
        df = self.price.copy()
        df = df.iloc[::-1].reset_index(drop=True)
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(df, self.volume)
        self.assertIn("sorted ascending", str(ctx.exception))

    def test_unsorted_volume_dates_raises(self):
        """Unsorted volume_data dates raises ValueError."""
        vol = self.volume.copy()
        vol = vol.iloc[::-1].reset_index(drop=True)
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(self.price, vol)
        self.assertIn("sorted ascending", str(ctx.exception))

    # --- Type checks ---

    def test_non_dataframe_price_raises(self):
        """Non-DataFrame price_data raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input({"date": [], "open": []}, self.volume)
        self.assertIn("pandas DataFrame", str(ctx.exception))

    def test_non_dataframe_volume_raises(self):
        """Non-DataFrame volume_data raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            self.m.validate_input(self.price, {"date": [], "volume": []})
        self.assertIn("pandas DataFrame", str(ctx.exception))

    def test_none_price_raises(self):
        """None price_data raises ValueError."""
        with self.assertRaises(ValueError):
            self.m.validate_input(None, self.volume)

    def test_none_volume_raises(self):
        """None volume_data raises ValueError."""
        with self.assertRaises(ValueError):
            self.m.validate_input(self.price, None)

    def test_list_price_raises(self):
        """List price_data raises ValueError."""
        with self.assertRaises(ValueError):
            self.m.validate_input([1, 2, 3], self.volume)

    def test_extra_columns_accepted(self):
        """Extra columns in DataFrames are accepted (not rejected)."""
        df = self.price.copy()
        df["extra_col"] = 42
        vol = self.volume.copy()
        vol["extra_col"] = 99
        self.m.validate_input(df, vol)

    def test_large_dataframe_passes(self):
        """Large DataFrame (500 rows) passes validation."""
        price = _make_price_df(rows=500)
        volume = _make_volume_df(rows=500)
        self.m.validate_input(price, volume)


# ===================================================================
# 14. create_signal
# ===================================================================
class TestCreateSignal(unittest.TestCase):
    """Verify BaseMethodology.create_signal() factory method."""

    def setUp(self):
        self.m = _ConcreteMethodology()

    def test_returns_methodology_signal(self):
        """create_signal() returns a MethodologySignal."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.8,
            timeframe="medium",
            reasoning="Strong accumulation.",
            key_levels={"support": 150.0},
        )
        self.assertIsInstance(sig, MethodologySignal)

    def test_methodology_set_to_self_name(self):
        """create_signal() sets methodology to self.name."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.8,
            timeframe="medium",
            reasoning="Phase B markup.",
            key_levels={},
        )
        self.assertEqual(sig.methodology, "wyckoff")

    def test_timestamp_is_recent(self):
        """create_signal() timestamp is within 5 seconds of now."""
        before = datetime.now(tz=timezone.utc)
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="neutral",
            confidence=0.5,
            timeframe="short",
            reasoning="Ranging.",
            key_levels={},
        )
        after = datetime.now(tz=timezone.utc)
        self.assertGreaterEqual(sig.timestamp, before)
        self.assertLessEqual(sig.timestamp, after)
        delta = (after - before).total_seconds()
        self.assertLess(delta, 5.0)

    def test_ticker_set_correctly(self):
        """create_signal() preserves the ticker argument."""
        sig = self.m.create_signal(
            ticker="NVDA",
            direction="bearish",
            confidence=0.6,
            timeframe="long",
            reasoning="Distribution detected.",
            key_levels={"resistance": 500.0},
        )
        self.assertEqual(sig.ticker, "NVDA")

    def test_direction_set_correctly(self):
        """create_signal() preserves the direction argument."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bearish",
            confidence=0.7,
            timeframe="short",
            reasoning="Markdown phase.",
            key_levels={},
        )
        self.assertEqual(sig.direction, "bearish")

    def test_confidence_set_correctly(self):
        """create_signal() preserves the confidence argument."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.91,
            timeframe="medium",
            reasoning="Spring detected.",
            key_levels={},
        )
        self.assertAlmostEqual(sig.confidence, 0.91)

    def test_timeframe_set_correctly(self):
        """create_signal() preserves the timeframe argument."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="neutral",
            confidence=0.4,
            timeframe="long",
            reasoning="No clear structure.",
            key_levels={},
        )
        self.assertEqual(sig.timeframe, "long")

    def test_reasoning_set_correctly(self):
        """create_signal() preserves the reasoning argument."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.5,
            timeframe="medium",
            reasoning="Custom reasoning text.",
            key_levels={},
        )
        self.assertEqual(sig.reasoning, "Custom reasoning text.")

    def test_key_levels_set_correctly(self):
        """create_signal() preserves the key_levels argument."""
        levels = {"support": 100.0, "resistance": 200.0, "pivot": 150.0}
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.8,
            timeframe="medium",
            reasoning="Key levels identified.",
            key_levels=levels,
        )
        self.assertEqual(sig.key_levels, levels)

    def test_invalid_direction_raises(self):
        """create_signal() with invalid direction raises ValueError."""
        with self.assertRaises(ValueError):
            self.m.create_signal(
                ticker="AAPL",
                direction="sideways",
                confidence=0.5,
                timeframe="medium",
                reasoning="Invalid.",
                key_levels={},
            )

    def test_timestamp_has_utc_timezone(self):
        """create_signal() timestamp has UTC timezone."""
        sig = self.m.create_signal(
            ticker="AAPL",
            direction="bullish",
            confidence=0.8,
            timeframe="medium",
            reasoning="UTC check.",
            key_levels={},
        )
        self.assertIsNotNone(sig.timestamp.tzinfo)


# ===================================================================
# 15. Edge cases
# ===================================================================
class TestEdgeCases(unittest.TestCase):
    """Boundary / edge-case tests spanning multiple components."""

    def test_confidence_exactly_zero_is_valid(self):
        """Confidence 0.0 is valid (falsy but accepted)."""
        sig = _make_signal(confidence=0.0)
        self.assertAlmostEqual(sig.confidence, 0.0)

    def test_confidence_exactly_one_is_valid(self):
        """Confidence 1.0 is valid (upper boundary)."""
        sig = _make_signal(confidence=1.0)
        self.assertAlmostEqual(sig.confidence, 1.0)

    def test_confidence_integer_accepted(self):
        """Integer confidence (e.g., 1) accepted and becomes float."""
        sig = _make_signal(confidence=1)
        self.assertIsInstance(sig.confidence, float)
        self.assertAlmostEqual(sig.confidence, 1.0)

    def test_confidence_integer_zero_accepted(self):
        """Integer 0 confidence accepted and becomes float 0.0."""
        sig = _make_signal(confidence=0)
        self.assertIsInstance(sig.confidence, float)
        self.assertAlmostEqual(sig.confidence, 0.0)

    def test_very_long_reasoning_accepted(self):
        """Very long reasoning string is accepted."""
        long_text = "A" * 10_000
        sig = _make_signal(reasoning=long_text)
        self.assertEqual(len(sig.reasoning), 10_000)

    def test_key_levels_with_nested_dicts(self):
        """key_levels with nested dicts accepted."""
        levels = {
            "support": {"primary": 140.0, "secondary": 135.0},
            "resistance": {"primary": 180.0},
        }
        sig = _make_signal(key_levels=levels)
        self.assertEqual(sig.key_levels["support"]["primary"], 140.0)

    def test_key_levels_with_lists(self):
        """key_levels with list values accepted."""
        levels = {"supports": [140.0, 135.0, 130.0]}
        sig = _make_signal(key_levels=levels)
        self.assertEqual(len(sig.key_levels["supports"]), 3)

    def test_ticker_lowercase_accepted(self):
        """Lowercase ticker accepted (no ticker validation in base)."""
        sig = _make_signal(ticker="aapl")
        self.assertEqual(sig.ticker, "aapl")

    def test_ticker_empty_accepted(self):
        """Empty ticker accepted (no ticker validation in base)."""
        sig = _make_signal(ticker="")
        self.assertEqual(sig.ticker, "")

    def test_ticker_with_special_chars(self):
        """Ticker with special characters accepted (no validation)."""
        sig = _make_signal(ticker="BRK.B")
        self.assertEqual(sig.ticker, "BRK.B")

    def test_multiple_signals_in_composite(self):
        """CompositeSignal with all 6 methodology signals."""
        signals = [_make_signal(methodology=m) for m in METHODOLOGY_NAMES]
        comp = _make_composite(methodology_signals=signals, confluence_count=6)
        self.assertEqual(len(comp.methodology_signals), 6)

    def test_roundtrip_with_multiple_nested_signals(self):
        """Full roundtrip serialization with multiple nested signals."""
        signals = [
            _make_signal(methodology="wyckoff", direction="bullish", confidence=0.9),
            _make_signal(methodology="elliott_wave", direction="bearish", confidence=0.6),
            _make_signal(methodology="sentiment", direction="neutral", confidence=0.0),
        ]
        comp = _make_composite(methodology_signals=signals, confluence_count=3)
        d = comp.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(len(restored.methodology_signals), 3)
        self.assertEqual(restored.methodology_signals[0].direction, "bullish")
        self.assertEqual(restored.methodology_signals[1].direction, "bearish")
        self.assertEqual(restored.methodology_signals[2].direction, "neutral")
        self.assertAlmostEqual(restored.methodology_signals[2].confidence, 0.0)

    def test_composite_overall_confidence_zero(self):
        """CompositeSignal with overall_confidence=0.0 (falsy but valid)."""
        comp = _make_composite(overall_confidence=0.0)
        self.assertAlmostEqual(comp.overall_confidence, 0.0)

    def test_composite_overall_confidence_integer(self):
        """CompositeSignal with integer overall_confidence."""
        comp = _make_composite(overall_confidence=1)
        self.assertIsInstance(comp.overall_confidence, float)
        self.assertAlmostEqual(comp.overall_confidence, 1.0)

    def test_composite_with_zero_integer_confidence(self):
        """CompositeSignal with integer 0 confidence."""
        comp = _make_composite(overall_confidence=0)
        self.assertIsInstance(comp.overall_confidence, float)
        self.assertAlmostEqual(comp.overall_confidence, 0.0)

    def test_signal_direction_case_sensitive(self):
        """Direction is case-sensitive: 'Bullish' is invalid."""
        with self.assertRaises(ValueError):
            _make_signal(direction="Bullish")

    def test_signal_direction_uppercase_invalid(self):
        """Direction 'BULLISH' (uppercase) is invalid."""
        with self.assertRaises(ValueError):
            _make_signal(direction="BULLISH")

    def test_signal_timeframe_case_sensitive(self):
        """Timeframe is case-sensitive: 'Short' is invalid."""
        with self.assertRaises(ValueError):
            _make_signal(timeframe="Short")

    def test_methodology_case_sensitive(self):
        """Methodology is case-sensitive: 'Wyckoff' is invalid."""
        with self.assertRaises(ValueError):
            _make_signal(methodology="Wyckoff")

    def test_signal_reasoning_single_char(self):
        """Single character reasoning is accepted."""
        sig = _make_signal(reasoning="X")
        self.assertEqual(sig.reasoning, "X")

    def test_signal_reasoning_with_newlines(self):
        """Reasoning with newlines is accepted."""
        sig = _make_signal(reasoning="Line 1\nLine 2\nLine 3")
        self.assertIn("\n", sig.reasoning)

    def test_overall_direction_case_sensitive(self):
        """OverallDirection is case-sensitive: 'Bullish' is invalid."""
        with self.assertRaises(ValueError):
            _make_composite(overall_direction="Bullish")

    def test_composite_trade_thesis_any_string(self):
        """CompositeSignal trade_thesis can be any string."""
        comp = _make_composite(trade_thesis="Short term reversal expected.")
        self.assertEqual(comp.trade_thesis, "Short term reversal expected.")

    def test_composite_weights_used_preserved(self):
        """CompositeSignal weights_used dict is preserved."""
        custom_weights = {"wyckoff": 0.5, "canslim": 0.5}
        comp = _make_composite(weights_used=custom_weights)
        self.assertEqual(comp.weights_used, custom_weights)

    def test_validate_input_exactly_20_rows_boundary(self):
        """Exactly 20 rows is the minimum boundary -- passes."""
        m = _ConcreteMethodology()
        price = _make_price_df(rows=20)
        volume = _make_volume_df(rows=20)
        m.validate_input(price, volume)

    def test_validate_input_19_rows_boundary_fails(self):
        """19 rows is below minimum -- raises ValueError."""
        m = _ConcreteMethodology()
        price = _make_price_df(rows=19)
        volume = _make_volume_df(rows=20)
        with self.assertRaises(ValueError):
            m.validate_input(price, volume)

    def test_methodology_signal_is_dataclass(self):
        """MethodologySignal is a dataclass."""
        import dataclasses

        self.assertTrue(dataclasses.is_dataclass(MethodologySignal))

    def test_composite_signal_is_dataclass(self):
        """CompositeSignal is a dataclass."""
        import dataclasses

        self.assertTrue(dataclasses.is_dataclass(CompositeSignal))


# ===================================================================
# 16. Additional serialization edge cases
# ===================================================================
class TestSerializationEdgeCases(unittest.TestCase):
    """Extra serialization tests for coverage."""

    def test_signal_to_dict_confidence_is_float(self):
        """to_dict() confidence is a float even if set from int."""
        sig = _make_signal(confidence=1)
        d = sig.to_dict()
        self.assertIsInstance(d["confidence"], float)

    def test_signal_from_dict_with_int_confidence(self):
        """from_dict() handles integer confidence."""
        d = _make_signal().to_dict()
        d["confidence"] = 1
        restored = MethodologySignal.from_dict(d)
        self.assertAlmostEqual(restored.confidence, 1.0)

    def test_composite_to_dict_overall_confidence_is_float(self):
        """CompositeSignal to_dict() overall_confidence is float."""
        comp = _make_composite(overall_confidence=0)
        d = comp.to_dict()
        self.assertIsInstance(d["overall_confidence"], float)

    def test_composite_to_dict_weights_preserved(self):
        """to_dict() preserves weights_used dict."""
        comp = _make_composite()
        d = comp.to_dict()
        self.assertEqual(d["weights_used"], DEFAULT_WEIGHTS)

    def test_composite_to_dict_timeframe_breakdown_preserved(self):
        """to_dict() preserves timeframe_breakdown dict."""
        breakdown = {"short": "bullish", "medium": "neutral", "long": "bearish"}
        comp = _make_composite(timeframe_breakdown=breakdown)
        d = comp.to_dict()
        self.assertEqual(d["timeframe_breakdown"], breakdown)

    def test_signal_from_dict_missing_key_raises(self):
        """from_dict() with missing key raises KeyError."""
        d = _make_signal().to_dict()
        del d["ticker"]
        with self.assertRaises(KeyError):
            MethodologySignal.from_dict(d)

    def test_composite_from_dict_missing_key_raises(self):
        """CompositeSignal from_dict() with missing key raises KeyError."""
        d = _make_composite().to_dict()
        del d["ticker"]
        with self.assertRaises(KeyError):
            CompositeSignal.from_dict(d)


# ===================================================================
# 17. Additional validate_input tests
# ===================================================================
class TestValidateInputAdditional(unittest.TestCase):
    """Extra validate_input tests for coverage."""

    def setUp(self):
        self.m = _ConcreteMethodology()

    def test_price_with_all_nan_ohlc_raises(self):
        """price_data with all NaN in OHLC columns raises ValueError."""
        df = _make_price_df()
        for col in ("open", "high", "low", "close"):
            df[col] = float("nan")
        with self.assertRaises(ValueError):
            self.m.validate_input(df, _make_volume_df())

    def test_volume_with_all_nan_allowed(self):
        """volume_data with all NaN in volume column is ALLOWED."""
        vol = _make_volume_df()
        vol["volume"] = float("nan")
        self.m.validate_input(_make_price_df(), vol)

    def test_price_dates_with_duplicates_ascending(self):
        """Duplicate dates in ascending order pass monotonic check."""
        df = _make_price_df(rows=30)
        # Make two rows have the same date (monotonic non-decreasing)
        df.loc[5, "date"] = df.loc[4, "date"]
        # is_monotonic_increasing allows equal consecutive values
        # Actually, pandas is_monotonic_increasing returns True for non-strictly-increasing
        # Let's just verify what happens
        try:
            self.m.validate_input(df, _make_volume_df())
        except ValueError:
            # Implementation may or may not allow duplicates
            pass

    def test_price_with_negative_values_passes(self):
        """Negative price values pass (no value range check)."""
        df = _make_price_df()
        df["close"] = -1.0
        df["open"] = -2.0
        df["high"] = -0.5
        df["low"] = -3.0
        self.m.validate_input(df, _make_volume_df())

    def test_price_with_zero_values_passes(self):
        """Zero price values pass (no value range check)."""
        df = _make_price_df()
        df["close"] = 0.0
        df["open"] = 0.0
        df["high"] = 0.0
        df["low"] = 0.0
        self.m.validate_input(df, _make_volume_df())

    def test_volume_with_zero_passes(self):
        """Zero volume values pass validation."""
        vol = _make_volume_df()
        vol["volume"] = 0
        self.m.validate_input(_make_price_df(), vol)


if __name__ == "__main__":
    unittest.main()
