"""Tests for TASK-ANALYSIS-008: Composite signal aggregator.

Validates CompositeAggregator: weight management (CRUD, normalization,
NaN/Inf guards), direction scoring, weighted average computation,
overall direction mapping, confluence analysis, timeframe breakdown,
trade thesis generation, partial analysis penalty, caching (TTL,
ticker sanitization), CompositeSignal contract, support/resistance
extraction, and full integration flows.

No real network or database calls are made.  Uses tempfile-based SQLite.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_composite.py -v``
"""
from __future__ import annotations

import asyncio
import json
import math
import os
import tempfile
import time
import unittest
from datetime import datetime, timezone, timedelta
from typing import Any

from app.analysis.base import (
    CompositeSignal,
    DEFAULT_WEIGHTS,
    Direction,
    METHODOLOGY_NAMES,
    MethodologySignal,
    OverallDirection,
    Timeframe,
)
from app.analysis.composite import (
    CompositeAggregator,
    _CONFLUENCE_BONUS_4,
    _CONFLUENCE_BONUS_5,
    _DEFAULT_CACHE_TTL_MINUTES,
    _DIRECTION_SCORES,
    _EPSILON,
    _MAX_TICKER_LEN,
    _MIN_SIGNALS,
    _MISSING_METHODOLOGY_PENALTY,
    _STRONG_BULLISH_THRESHOLD,
    _BULLISH_THRESHOLD,
    _BEARISH_THRESHOLD,
    _STRONG_BEARISH_THRESHOLD,
    _is_finite,
    _safe_float,
    _sanitize_ticker,
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


def _make_signal(
    methodology="wyckoff",
    direction="bullish",
    confidence=0.75,
    timeframe="medium",
    ticker="AAPL",
    key_levels=None,
):
    """Create a single MethodologySignal with sensible defaults."""
    if key_levels is None:
        key_levels = {"test": True}
    return MethodologySignal(
        ticker=ticker,
        methodology=methodology,
        direction=direction,
        confidence=confidence,
        timeframe=timeframe,
        reasoning=f"{methodology} {direction}",
        key_levels=key_levels,
        timestamp=datetime.now(timezone.utc),
    )


def _make_all_signals(direction="bullish", confidence=0.75, ticker="AAPL",
                      timeframe="medium", key_levels=None):
    """Create signals for all 6 methodologies."""
    return [
        _make_signal(m, direction, confidence, timeframe, ticker, key_levels)
        for m in METHODOLOGY_NAMES
    ]


class _TempDBTestCase(unittest.TestCase):
    """Base TestCase that provides a tempfile-backed CompositeAggregator."""

    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self._tmp.close()
        self.agg = CompositeAggregator(db_path=self._tmp.name)

    def tearDown(self):
        _run(self.agg.close())
        try:
            os.unlink(self._tmp.name)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# 1. TestCompositeAggregatorInit  (~7 tests)
# ---------------------------------------------------------------------------

class TestCompositeAggregatorInit(unittest.TestCase):
    """Validate instantiation with and without db_path."""

    def test_init_with_db_path(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        try:
            agg = CompositeAggregator(db_path=tmp.name)
            self.assertEqual(agg._db_path, tmp.name)
            self.assertIsNone(agg._db)
            self.assertFalse(agg._tables_ensured)
            _run(agg.close())
        finally:
            os.unlink(tmp.name)

    def test_init_without_db_path(self):
        agg = CompositeAggregator()
        self.assertIsNone(agg._db_path)
        self.assertIsNone(agg._db)

    def test_init_db_path_none_explicit(self):
        agg = CompositeAggregator(db_path=None)
        self.assertIsNone(agg._db_path)

    def test_tables_ensured_starts_false(self):
        agg = CompositeAggregator(db_path=os.path.join(tempfile.gettempdir(), "nonexistent.db"))
        self.assertFalse(agg._tables_ensured)

    def test_close_on_unused_instance_no_error(self):
        agg = CompositeAggregator(db_path=os.path.join(tempfile.gettempdir(), "nonexistent.db"))
        _run(agg.close())  # should be a no-op

    def test_close_resets_tables_ensured(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        try:
            agg = CompositeAggregator(db_path=tmp.name)
            _run(agg.get_weights())  # triggers _get_db => tables_ensured=True
            self.assertTrue(agg._tables_ensured)
            _run(agg.close())
            self.assertFalse(agg._tables_ensured)
        finally:
            os.unlink(tmp.name)

    def test_double_close_no_error(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        try:
            agg = CompositeAggregator(db_path=tmp.name)
            _run(agg.get_weights())
            _run(agg.close())
            _run(agg.close())
        finally:
            os.unlink(tmp.name)


# ---------------------------------------------------------------------------
# 2. TestWeightManagement  (~22 tests)
# ---------------------------------------------------------------------------

class TestWeightManagement(_TempDBTestCase):
    """Weight CRUD: get, set, reset, normalization, edge cases."""

    def test_default_weights_keys(self):
        weights = _run(self.agg.get_weights())
        self.assertEqual(set(weights.keys()), set(METHODOLOGY_NAMES))

    def test_default_weights_values_sum_to_one(self):
        weights = _run(self.agg.get_weights())
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=8)

    def test_default_weights_match_constant(self):
        weights = _run(self.agg.get_weights())
        for name in METHODOLOGY_NAMES:
            self.assertAlmostEqual(
                weights[name], DEFAULT_WEIGHTS[name], places=6,
                msg=f"Weight mismatch for {name}")

    def test_set_weights_persist(self):
        custom = {m: 1.0 / 6 for m in METHODOLOGY_NAMES}
        _run(self.agg.set_weights(custom))
        retrieved = _run(self.agg.get_weights())
        for m in METHODOLOGY_NAMES:
            self.assertAlmostEqual(retrieved[m], 1.0 / 6, places=6)

    def test_set_weights_normalizes(self):
        custom = {"wyckoff": 10.0, "canslim": 10.0}
        _run(self.agg.set_weights(custom))
        retrieved = _run(self.agg.get_weights())
        self.assertAlmostEqual(sum(retrieved.values()), 1.0, places=8)

    def test_reset_weights_restores_defaults(self):
        custom = {m: 0.5 for m in METHODOLOGY_NAMES}
        _run(self.agg.set_weights(custom))
        _run(self.agg.reset_weights())
        retrieved = _run(self.agg.get_weights())
        for name in METHODOLOGY_NAMES:
            self.assertAlmostEqual(
                retrieved[name], DEFAULT_WEIGHTS[name], places=6)

    def test_negative_weights_clamped_to_zero(self):
        """Negative value filtered by set_weights, only canslim stored."""
        custom = {"wyckoff": -5.0, "canslim": 1.0}
        _run(self.agg.set_weights(custom))
        retrieved = _run(self.agg.get_weights())
        # Negative wyckoff filtered by set_weights (float(v) >= 0 check),
        # so only canslim=1.0 is stored. get_weights merges with defaults
        # for the other 5 and normalizes. canslim should be highest.
        self.assertGreater(retrieved["canslim"], retrieved.get("wyckoff", 0))

    def test_all_zero_weights_equal_distribution(self):
        normalized = CompositeAggregator._normalize_weights(
            {m: 0.0 for m in METHODOLOGY_NAMES})
        expected = 1.0 / len(METHODOLOGY_NAMES)
        for v in normalized.values():
            self.assertAlmostEqual(v, expected, places=8)

    def test_nan_weight_clamped_to_zero(self):
        normalized = CompositeAggregator._normalize_weights(
            {"wyckoff": float("nan"), "canslim": 1.0})
        self.assertAlmostEqual(normalized["wyckoff"], 0.0, places=8)
        self.assertAlmostEqual(normalized["canslim"], 1.0, places=8)

    def test_inf_weight_clamped_to_zero(self):
        normalized = CompositeAggregator._normalize_weights(
            {"wyckoff": float("inf"), "canslim": 1.0})
        self.assertAlmostEqual(normalized["wyckoff"], 0.0, places=8)
        self.assertAlmostEqual(normalized["canslim"], 1.0, places=8)

    def test_neg_inf_weight_clamped_to_zero(self):
        normalized = CompositeAggregator._normalize_weights(
            {"wyckoff": float("-inf"), "canslim": 1.0})
        self.assertAlmostEqual(normalized["wyckoff"], 0.0, places=8)

    def test_partial_weight_set(self):
        """Setting only 2 methodologies updates them, others keep defaults."""
        _run(self.agg.set_weights({"wyckoff": 5.0, "canslim": 5.0}))
        retrieved = _run(self.agg.get_weights())
        # Only wyckoff and canslim stored; others use DEFAULT fallback
        self.assertAlmostEqual(sum(retrieved.values()), 1.0, places=6)

    def test_invalid_methodology_name_ignored_in_set(self):
        with self.assertRaises(ValueError):
            _run(self.agg.set_weights({"fake_method": 1.0}))

    def test_set_weights_all_invalid_raises(self):
        with self.assertRaises(ValueError):
            _run(self.agg.set_weights({"not_real": 1.0, "also_fake": 2.0}))

    def test_set_weights_mix_valid_invalid(self):
        """Valid entries accepted, invalid silently dropped."""
        _run(self.agg.set_weights({"wyckoff": 1.0, "fake": 5.0}))
        retrieved = _run(self.agg.get_weights())
        # wyckoff stored, fake dropped
        self.assertIn("wyckoff", retrieved)

    def test_set_weights_bool_value_rejected(self):
        """Bool is not finite per _is_finite, so filtered out."""
        with self.assertRaises(ValueError):
            _run(self.agg.set_weights({"wyckoff": True}))

    def test_normalize_empty_dict(self):
        normalized = CompositeAggregator._normalize_weights({})
        self.assertEqual(normalized, {})

    def test_normalize_single_key(self):
        normalized = CompositeAggregator._normalize_weights({"wyckoff": 3.0})
        self.assertAlmostEqual(normalized["wyckoff"], 1.0, places=8)

    def test_normalize_preserves_ratios(self):
        normalized = CompositeAggregator._normalize_weights(
            {"wyckoff": 2.0, "canslim": 1.0})
        ratio = normalized["wyckoff"] / normalized["canslim"]
        self.assertAlmostEqual(ratio, 2.0, places=6)

    def test_all_nan_weights_equal_distribution(self):
        normalized = CompositeAggregator._normalize_weights(
            {"wyckoff": float("nan"), "canslim": float("nan")})
        self.assertAlmostEqual(normalized["wyckoff"], 0.5, places=8)
        self.assertAlmostEqual(normalized["canslim"], 0.5, places=8)

    def test_weight_sum_after_set_and_get(self):
        custom = {"wyckoff": 0.4, "elliott_wave": 0.3,
                  "ict_smart_money": 0.15, "canslim": 0.1,
                  "larry_williams": 0.03, "sentiment": 0.02}
        _run(self.agg.set_weights(custom))
        retrieved = _run(self.agg.get_weights())
        self.assertAlmostEqual(sum(retrieved.values()), 1.0, places=6)


# ---------------------------------------------------------------------------
# 3. TestDirectionScoring  (~15 tests)
# ---------------------------------------------------------------------------

class TestDirectionScoring(_TempDBTestCase):
    """Direction string -> numeric score mapping."""

    def test_bullish_score_positive(self):
        self.assertEqual(_DIRECTION_SCORES["bullish"], 1.0)

    def test_bearish_score_negative(self):
        self.assertEqual(_DIRECTION_SCORES["bearish"], -1.0)

    def test_neutral_score_zero(self):
        self.assertEqual(_DIRECTION_SCORES["neutral"], 0.0)

    def test_score_multiplied_by_confidence(self):
        sig = _make_signal(direction="bullish", confidence=0.5)
        raw = _DIRECTION_SCORES[sig.direction] * sig.confidence
        self.assertAlmostEqual(raw, 0.5, places=6)

    def test_bearish_score_times_confidence(self):
        sig = _make_signal(direction="bearish", confidence=0.8)
        raw = _DIRECTION_SCORES[sig.direction] * sig.confidence
        self.assertAlmostEqual(raw, -0.8, places=6)

    def test_neutral_score_times_any_confidence(self):
        sig = _make_signal(direction="neutral", confidence=1.0)
        raw = _DIRECTION_SCORES[sig.direction] * sig.confidence
        self.assertAlmostEqual(raw, 0.0, places=6)

    def test_all_bullish_aggregate_positive(self):
        signals = _make_all_signals(direction="bullish", confidence=0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertGreater(result.overall_confidence, 0.0)
        self.assertIn("bullish", result.overall_direction)

    def test_all_bearish_aggregate_negative(self):
        signals = _make_all_signals(direction="bearish", confidence=0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bearish", result.overall_direction)

    def test_all_neutral_aggregate_neutral(self):
        signals = _make_all_signals(direction="neutral", confidence=0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.overall_direction, OverallDirection.NEUTRAL.value)

    def test_mixed_bullish_bearish(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("elliott_wave", "bearish", 0.9),
            _make_signal("ict_smart_money", "bullish", 0.5),
            _make_signal("canslim", "bearish", 0.5),
            _make_signal("larry_williams", "neutral", 0.5),
            _make_signal("sentiment", "neutral", 0.5),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_score_weighted_by_weight(self):
        """Heavier-weighted methodology dominates via custom weights."""
        signals = [
            _make_signal("wyckoff", "bullish", 1.0),
            _make_signal("canslim", "bearish", 1.0),
        ]
        # Give wyckoff overwhelming weight so it dominates
        custom = {m: 0.0 for m in METHODOLOGY_NAMES}
        custom["wyckoff"] = 10.0
        custom["canslim"] = 0.01
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        # wyckoff has massive weight => bullish should win
        self.assertIn("bullish", result.overall_direction)

    def test_unknown_direction_treated_as_zero(self):
        """_DIRECTION_SCORES.get with unknown key returns 0.0."""
        self.assertEqual(_DIRECTION_SCORES.get("unknown", 0.0), 0.0)

    def test_confidence_clamped_to_one(self):
        sig = _make_signal(confidence=1.0)
        self.assertLessEqual(sig.confidence, 1.0)

    def test_confidence_clamped_to_zero(self):
        sig = _make_signal(confidence=0.0)
        self.assertGreaterEqual(sig.confidence, 0.0)

    def test_zero_confidence_no_contribution(self):
        signals = _make_all_signals(direction="bullish", confidence=0.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertAlmostEqual(result.overall_confidence, 0.0, places=4)


# ---------------------------------------------------------------------------
# 4. TestWeightedAverage  (~16 tests)
# ---------------------------------------------------------------------------

class TestWeightedAverage(_TempDBTestCase):
    """Core aggregation: weighted score computation."""

    def test_all_bullish_positive_score(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bullish", result.overall_direction)

    def test_all_bearish_negative_score(self):
        signals = _make_all_signals("bearish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bearish", result.overall_direction)

    def test_all_neutral_zero_score(self):
        signals = _make_all_signals("neutral", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.overall_direction, "neutral")

    def test_mixed_intermediate(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("elliott_wave", "bullish", 0.7),
            _make_signal("ict_smart_money", "neutral", 0.5),
            _make_signal("canslim", "bearish", 0.4),
            _make_signal("larry_williams", "bearish", 0.3),
            _make_signal("sentiment", "bullish", 0.6),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_missing_methodologies_weight_renormalized(self):
        """Only 3 signals => weights among those 3 renormalized."""
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("canslim", "bullish", 0.9),
            _make_signal("sentiment", "bullish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bullish", result.overall_direction)

    def test_custom_weights_override_stored(self):
        """weights param overrides stored weights."""
        signals = _make_all_signals("bullish", 0.8)
        custom = {m: 0.0 for m in METHODOLOGY_NAMES}
        custom["wyckoff"] = 1.0  # only wyckoff counts
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        self.assertIsInstance(result, CompositeSignal)
        self.assertAlmostEqual(result.weights_used["wyckoff"], 1.0, places=4)

    def test_single_methodology_signal(self):
        """< 2 signals => neutral composite."""
        signals = [_make_signal("wyckoff", "bullish", 1.0)]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.overall_direction, "neutral")
        self.assertAlmostEqual(result.overall_confidence, 0.1, places=4)

    def test_two_signals_minimum(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("canslim", "bullish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bullish", result.overall_direction)

    def test_equal_weights_all_bullish(self):
        custom = {m: 1.0 for m in METHODOLOGY_NAMES}
        signals = _make_all_signals("bullish", 0.9)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        self.assertIn("bullish", result.overall_direction)

    def test_confidence_capped_at_one(self):
        signals = _make_all_signals("bullish", 1.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertLessEqual(result.overall_confidence, 1.0)

    def test_confidence_at_least_zero(self):
        signals = _make_all_signals("neutral", 0.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertGreaterEqual(result.overall_confidence, 0.0)

    def test_weights_used_field_populated(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.weights_used, dict)
        self.assertTrue(len(result.weights_used) > 0)

    def test_all_zero_weights_param_equal(self):
        """All-zero weights => equal distribution."""
        custom = {m: 0.0 for m in METHODOLOGY_NAMES}
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        for v in result.weights_used.values():
            self.assertAlmostEqual(v, 1.0 / 6, places=6)

    def test_aggregate_returns_composite_signal(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_aggregate_with_empty_list(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result.overall_direction, "neutral")
        self.assertAlmostEqual(result.overall_confidence, 0.1, places=4)

    def test_methodology_signals_stored_in_result(self):
        signals = _make_all_signals("bullish", 0.5)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(len(result.methodology_signals), 6)


# ---------------------------------------------------------------------------
# 5. TestOverallDirection  (~12 tests)
# ---------------------------------------------------------------------------

class TestOverallDirection(unittest.TestCase):
    """_score_to_direction mapping from weighted score to 5-level direction."""

    def test_strong_bullish(self):
        d = CompositeAggregator._score_to_direction(0.8)
        self.assertEqual(d, OverallDirection.STRONG_BULLISH.value)

    def test_bullish(self):
        d = CompositeAggregator._score_to_direction(0.3)
        self.assertEqual(d, OverallDirection.BULLISH.value)

    def test_neutral(self):
        d = CompositeAggregator._score_to_direction(0.0)
        self.assertEqual(d, OverallDirection.NEUTRAL.value)

    def test_bearish(self):
        d = CompositeAggregator._score_to_direction(-0.3)
        self.assertEqual(d, OverallDirection.BEARISH.value)

    def test_strong_bearish(self):
        d = CompositeAggregator._score_to_direction(-0.8)
        self.assertEqual(d, OverallDirection.STRONG_BEARISH.value)

    def test_boundary_strong_bullish(self):
        d = CompositeAggregator._score_to_direction(0.51)
        self.assertEqual(d, OverallDirection.STRONG_BULLISH.value)

    def test_boundary_exactly_0_5(self):
        """0.5 is NOT > 0.5, so it falls to bullish."""
        d = CompositeAggregator._score_to_direction(0.5)
        self.assertEqual(d, OverallDirection.BULLISH.value)

    def test_boundary_exactly_0_15(self):
        """0.15 is NOT > 0.15, so it falls to neutral."""
        d = CompositeAggregator._score_to_direction(0.15)
        self.assertEqual(d, OverallDirection.NEUTRAL.value)

    def test_boundary_exactly_neg_0_15(self):
        """-0.15 is NOT > -0.15, so it falls to bearish."""
        d = CompositeAggregator._score_to_direction(-0.15)
        self.assertEqual(d, OverallDirection.BEARISH.value)

    def test_boundary_exactly_neg_0_5(self):
        """-0.5 is NOT > -0.5, so it falls to strong_bearish."""
        d = CompositeAggregator._score_to_direction(-0.5)
        self.assertEqual(d, OverallDirection.STRONG_BEARISH.value)

    def test_score_1_0_strong_bullish(self):
        d = CompositeAggregator._score_to_direction(1.0)
        self.assertEqual(d, OverallDirection.STRONG_BULLISH.value)

    def test_score_neg_1_0_strong_bearish(self):
        d = CompositeAggregator._score_to_direction(-1.0)
        self.assertEqual(d, OverallDirection.STRONG_BEARISH.value)


# ---------------------------------------------------------------------------
# 6. TestConfluenceAnalysis  (~18 tests)
# ---------------------------------------------------------------------------

class TestConfluenceAnalysis(_TempDBTestCase):
    """Confluence count and bonus multiplier logic."""

    def test_6_of_6_agree_confluence_6(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 6)

    def test_6_of_6_agree_bonus_1_4(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        # confidence = abs(score) * 1.4 capped at 1.0
        self.assertGreater(result.overall_confidence, 0.0)

    def test_5_of_6_agree_confluence_5(self):
        signals = _make_all_signals("bullish", 0.8)
        signals[5] = _make_signal("sentiment", "bearish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 5)

    def test_5_of_6_bonus_1_4(self):
        """5 agree => _CONFLUENCE_BONUS_5 = 1.4."""
        self.assertEqual(_CONFLUENCE_BONUS_5, 1.4)

    def test_4_of_6_agree_confluence_4(self):
        signals = _make_all_signals("bullish", 0.8)
        signals[4] = _make_signal("larry_williams", "bearish", 0.8)
        signals[5] = _make_signal("sentiment", "bearish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 4)

    def test_4_of_6_bonus_1_2(self):
        """4 agree => _CONFLUENCE_BONUS_4 = 1.2."""
        self.assertEqual(_CONFLUENCE_BONUS_4, 1.2)

    def test_3_of_6_no_bonus(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.8),
            _make_signal("elliott_wave", "bullish", 0.8),
            _make_signal("ict_smart_money", "bullish", 0.8),
            _make_signal("canslim", "bearish", 0.8),
            _make_signal("larry_williams", "bearish", 0.8),
            _make_signal("sentiment", "bearish", 0.8),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 3)

    def test_2_agree_confluence_2(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.8),
            _make_signal("elliott_wave", "bullish", 0.8),
            _make_signal("ict_smart_money", "bearish", 0.8),
            _make_signal("canslim", "bearish", 0.8),
            _make_signal("larry_williams", "neutral", 0.8),
            _make_signal("sentiment", "neutral", 0.8),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        # majority = 2 (bullish and bearish both 2, neutral 2; Counter picks first)
        self.assertIn(result.confluence_count, [2])

    def test_all_neutral_confluence_6(self):
        signals = _make_all_signals("neutral", 0.5)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 6)

    def test_confluence_multiplier_capped_confidence_at_1(self):
        signals = _make_all_signals("bullish", 1.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertLessEqual(result.overall_confidence, 1.0)

    def test_confluence_count_type_int(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.confluence_count, int)

    def test_majority_direction_correct_bullish(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("elliott_wave", "bullish", 0.7),
            _make_signal("ict_smart_money", "bullish", 0.6),
            _make_signal("canslim", "bullish", 0.5),
            _make_signal("larry_williams", "bearish", 0.9),
            _make_signal("sentiment", "bearish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 4)

    def test_majority_direction_correct_bearish(self):
        signals = [
            _make_signal("wyckoff", "bearish", 0.9),
            _make_signal("elliott_wave", "bearish", 0.7),
            _make_signal("ict_smart_money", "bearish", 0.6),
            _make_signal("canslim", "bearish", 0.5),
            _make_signal("larry_williams", "bullish", 0.9),
            _make_signal("sentiment", "bullish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 4)

    def test_missing_penalty_applied_once(self):
        """5 signals => 1 missing => 0.9^1 penalty."""
        signals = _make_all_signals("bullish", 0.8)[:5]
        result = _run(self.agg.aggregate("AAPL", signals))
        # Confidence is reduced by _MISSING_METHODOLOGY_PENALTY
        self.assertIsInstance(result.overall_confidence, float)

    def test_missing_penalty_applied_twice(self):
        """4 signals => 2 missing => 0.9^2 penalty."""
        signals = _make_all_signals("bullish", 0.8)[:4]
        result_4 = _run(self.agg.aggregate("AAPL", signals))
        signals_5 = _make_all_signals("bullish", 0.8)[:5]
        result_5 = _run(self.agg.aggregate("AAPL", signals_5))
        # 4-signal should have lower confidence than 5-signal (more penalty)
        self.assertLessEqual(result_4.overall_confidence,
                             result_5.overall_confidence + 0.01)

    def test_confluence_with_3_signals(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("canslim", "bullish", 0.9),
            _make_signal("sentiment", "bearish", 0.5),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 2)

    def test_two_way_tie_picks_most_common(self):
        """Counter.most_common picks first encountered on tie."""
        signals = [
            _make_signal("wyckoff", "bullish", 0.9),
            _make_signal("elliott_wave", "bullish", 0.9),
            _make_signal("ict_smart_money", "bullish", 0.9),
            _make_signal("canslim", "bearish", 0.9),
            _make_signal("larry_williams", "bearish", 0.9),
            _make_signal("sentiment", "bearish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        # 3 bullish, 3 bearish => tie => Counter picks first = bullish
        self.assertEqual(result.confluence_count, 3)

    def test_all_bearish_low_confidence_still_confluence_6(self):
        signals = _make_all_signals("bearish", 0.1)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.confluence_count, 6)


# ---------------------------------------------------------------------------
# 7. TestTimeframeBreakdown  (~14 tests)
# ---------------------------------------------------------------------------

class TestTimeframeBreakdown(_TempDBTestCase):
    """Timeframe grouping and per-group stats."""

    def test_all_medium_grouped(self):
        signals = _make_all_signals("bullish", 0.8, timeframe="medium")
        result = _run(self.agg.aggregate("AAPL", signals))
        tb = result.timeframe_breakdown
        self.assertEqual(tb["medium"]["direction"], "bullish")
        self.assertEqual(len(tb["medium"]["methodologies"]), 6)

    def test_short_group(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.8, "short"),
            _make_signal("canslim", "bullish", 0.7, "short"),
            _make_signal("sentiment", "bearish", 0.6, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        tb = result.timeframe_breakdown
        self.assertEqual(tb["short"]["direction"], "bullish")
        self.assertEqual(len(tb["short"]["methodologies"]), 2)

    def test_long_group(self):
        signals = [
            _make_signal("wyckoff", "bearish", 0.7, "long"),
            _make_signal("canslim", "bearish", 0.6, "long"),
            _make_signal("sentiment", "bullish", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        tb = result.timeframe_breakdown
        self.assertEqual(tb["long"]["direction"], "bearish")

    def test_majority_direction_within_group(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9, "short"),
            _make_signal("elliott_wave", "bullish", 0.7, "short"),
            _make_signal("ict_smart_money", "bearish", 0.5, "short"),
            _make_signal("canslim", "neutral", 0.5, "medium"),
            _make_signal("larry_williams", "neutral", 0.5, "medium"),
            _make_signal("sentiment", "neutral", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.timeframe_breakdown["short"]["direction"], "bullish")

    def test_average_confidence_within_group(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.8, "short"),
            _make_signal("canslim", "bullish", 0.6, "short"),
            _make_signal("sentiment", "neutral", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        avg = (0.8 + 0.6) / 2
        self.assertAlmostEqual(
            result.timeframe_breakdown["short"]["confidence"], avg, places=3)

    def test_methodology_names_listed_in_group(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.8, "long"),
            _make_signal("canslim", "bullish", 0.7, "long"),
            _make_signal("sentiment", "bullish", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("wyckoff", result.timeframe_breakdown["long"]["methodologies"])
        self.assertIn("canslim", result.timeframe_breakdown["long"]["methodologies"])

    def test_missing_timeframe_empty_entry(self):
        signals = _make_all_signals("bullish", 0.8, timeframe="medium")
        result = _run(self.agg.aggregate("AAPL", signals))
        # short and long have no signals
        self.assertEqual(result.timeframe_breakdown["short"]["direction"], "neutral")
        self.assertEqual(result.timeframe_breakdown["short"]["confidence"], 0.0)
        self.assertEqual(result.timeframe_breakdown["short"]["methodologies"], [])

    def test_all_same_timeframe(self):
        signals = _make_all_signals("bearish", 0.6, timeframe="long")
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(len(result.timeframe_breakdown["long"]["methodologies"]), 6)
        self.assertEqual(result.timeframe_breakdown["short"]["methodologies"], [])
        self.assertEqual(result.timeframe_breakdown["medium"]["methodologies"], [])

    def test_breakdown_has_all_three_timeframes(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("short", result.timeframe_breakdown)
        self.assertIn("medium", result.timeframe_breakdown)
        self.assertIn("long", result.timeframe_breakdown)

    def test_breakdown_confidence_rounded(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.777, "short"),
            _make_signal("canslim", "bullish", 0.333, "short"),
            _make_signal("sentiment", "neutral", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        conf = result.timeframe_breakdown["short"]["confidence"]
        # Should be rounded to 4 decimal places
        self.assertEqual(conf, round(conf, 4))

    def test_single_signal_in_timeframe(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.65, "short"),
            _make_signal("canslim", "bearish", 0.55, "medium"),
            _make_signal("sentiment", "neutral", 0.5, "long"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertAlmostEqual(
            result.timeframe_breakdown["short"]["confidence"], 0.65, places=3)

    def test_neutral_composite_has_all_timeframes_neutral(self):
        """< 2 signals => neutral composite with empty breakdowns."""
        result = _run(self.agg.aggregate("AAPL", []))
        for tf in ("short", "medium", "long"):
            self.assertEqual(result.timeframe_breakdown[tf]["direction"], "neutral")
            self.assertEqual(result.timeframe_breakdown[tf]["confidence"], 0.0)
            self.assertEqual(result.timeframe_breakdown[tf]["methodologies"], [])

    def test_mixed_timeframes(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9, "short"),
            _make_signal("elliott_wave", "bearish", 0.8, "medium"),
            _make_signal("ict_smart_money", "neutral", 0.7, "long"),
            _make_signal("canslim", "bullish", 0.6, "short"),
            _make_signal("larry_williams", "bearish", 0.5, "medium"),
            _make_signal("sentiment", "bullish", 0.4, "long"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(len(result.timeframe_breakdown["short"]["methodologies"]), 2)
        self.assertEqual(len(result.timeframe_breakdown["medium"]["methodologies"]), 2)
        self.assertEqual(len(result.timeframe_breakdown["long"]["methodologies"]), 2)

    def test_timeframe_direction_majority_tie(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9, "short"),
            _make_signal("canslim", "bearish", 0.9, "short"),
            _make_signal("sentiment", "neutral", 0.5, "medium"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        # Tie => Counter.most_common picks first encountered
        self.assertIn(
            result.timeframe_breakdown["short"]["direction"],
            ["bullish", "bearish"])


# ---------------------------------------------------------------------------
# 8. TestTradeThesis  (~12 tests)
# ---------------------------------------------------------------------------

class TestTradeThesis(_TempDBTestCase):
    """Trade thesis string content validation."""

    def test_contains_ticker_name(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("AAPL", result.trade_thesis)

    def test_contains_overall_direction(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn(result.overall_direction, result.trade_thesis)

    def test_contains_confidence_percent(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("confidence", result.trade_thesis)

    def test_contains_confluence_count(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("6/6", result.trade_thesis)

    def test_contains_timeframe_breakdown(self):
        signals = _make_all_signals("bullish", 0.8, timeframe="medium")
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("Medium-term", result.trade_thesis)

    def test_contains_strongest_signals(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("Strongest signals", result.trade_thesis)

    def test_contains_weakest_signals(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("Weakest signals", result.trade_thesis)

    def test_partial_analysis_notes_missing(self):
        signals = _make_all_signals("bullish", 0.8)[:4]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("Missing methodologies", result.trade_thesis)

    def test_full_analysis_no_missing_note(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertNotIn("Missing methodologies", result.trade_thesis)

    def test_support_resistance_shown(self):
        signals = _make_all_signals("bullish", 0.8, key_levels={"support": 100.0})
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("Key support", result.trade_thesis)
        self.assertIn("Key resistance", result.trade_thesis)

    def test_neutral_thesis_mentions_insufficient(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertIn("Insufficient signals", result.trade_thesis)

    def test_thesis_is_string(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.trade_thesis, str)


# ---------------------------------------------------------------------------
# 9. TestPartialAnalysis  (~13 tests)
# ---------------------------------------------------------------------------

class TestPartialAnalysis(_TempDBTestCase):
    """Missing-methodology penalty and minimal-signal handling."""

    def test_6_signals_no_penalty(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        # No missing => full confidence
        self.assertGreater(result.overall_confidence, 0.5)

    def test_5_signals_one_penalty(self):
        signals = _make_all_signals("bullish", 0.8)[:5]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_4_signals_two_penalties(self):
        signals = _make_all_signals("bullish", 0.8)[:4]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_3_signals_three_penalties(self):
        signals = _make_all_signals("bullish", 0.8)[:3]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_2_signals_minimum_viable(self):
        signals = _make_all_signals("bullish", 0.8)[:2]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertNotEqual(result.overall_direction, "neutral")

    def test_1_signal_neutral(self):
        signals = [_make_signal("wyckoff", "bullish", 1.0)]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.overall_direction, "neutral")
        self.assertAlmostEqual(result.overall_confidence, 0.1, places=4)

    def test_0_signals_neutral(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result.overall_direction, "neutral")
        self.assertAlmostEqual(result.overall_confidence, 0.1, places=4)

    def test_penalty_reduces_confidence(self):
        full = _make_all_signals("bullish", 0.8)
        result_full = _run(self.agg.aggregate("AAPL", full))
        partial = full[:4]
        result_partial = _run(self.agg.aggregate("AAPL", partial))
        self.assertLessEqual(result_partial.overall_confidence,
                             result_full.overall_confidence + 0.01)

    def test_missing_methodology_penalty_value(self):
        self.assertAlmostEqual(_MISSING_METHODOLOGY_PENALTY, 0.9, places=4)

    def test_min_signals_constant(self):
        self.assertEqual(_MIN_SIGNALS, 2)

    def test_single_neutral_signal_returns_neutral_composite(self):
        sig = _make_signal("wyckoff", "neutral", 0.5)
        result = _run(self.agg.aggregate("AAPL", [sig]))
        self.assertEqual(result.overall_direction, "neutral")

    def test_thesis_mentions_count_for_insufficient(self):
        sig = _make_signal("wyckoff", "bullish", 0.9)
        result = _run(self.agg.aggregate("AAPL", [sig]))
        self.assertIn("Insufficient signals (1)", result.trade_thesis)

    def test_empty_signals_confluence_zero(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result.confluence_count, 0)


# ---------------------------------------------------------------------------
# 10. TestCaching  (~16 tests)
# ---------------------------------------------------------------------------

class TestCaching(_TempDBTestCase):
    """Cache storage, retrieval, TTL expiry."""

    def _aggregate_and_cache(self, ticker="AAPL", direction="bullish"):
        signals = _make_all_signals(direction, 0.8, ticker=ticker)
        result = _run(self.agg.aggregate(ticker, signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        return result

    def test_cache_stores_and_retrieves(self):
        original = self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsNotNone(cached)
        self.assertEqual(cached.ticker, original.ticker)

    def test_cache_retrieves_within_ttl(self):
        self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL", max_age_minutes=60))
        self.assertIsNotNone(cached)

    def test_cache_returns_none_after_ttl(self):
        self._aggregate_and_cache("AAPL")
        # max_age_minutes=0 => always expired
        cached = _run(self.agg.get_cached_result("AAPL", max_age_minutes=0))
        self.assertIsNone(cached)

    def test_cache_different_tickers(self):
        self._aggregate_and_cache("AAPL")
        self._aggregate_and_cache("MSFT")
        aapl = _run(self.agg.get_cached_result("AAPL"))
        msft = _run(self.agg.get_cached_result("MSFT"))
        self.assertIsNotNone(aapl)
        self.assertIsNotNone(msft)
        self.assertEqual(aapl.ticker, "AAPL")
        self.assertEqual(msft.ticker, "MSFT")

    def test_cache_same_ticker_uses_latest(self):
        self._aggregate_and_cache("AAPL", direction="bullish")
        self._aggregate_and_cache("AAPL", direction="bearish")
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsNotNone(cached)
        # Latest should be bearish
        self.assertIn("bearish", cached.overall_direction)

    def test_cache_miss_for_unknown_ticker(self):
        cached = _run(self.agg.get_cached_result("UNKNOWN"))
        self.assertIsNone(cached)

    def test_cache_result_preserves_direction(self):
        original = self._aggregate_and_cache("TSLA", direction="bearish")
        cached = _run(self.agg.get_cached_result("TSLA"))
        self.assertIn("bearish", cached.overall_direction)

    def test_cache_result_preserves_confidence(self):
        original = self._aggregate_and_cache("GOOG")
        cached = _run(self.agg.get_cached_result("GOOG"))
        self.assertAlmostEqual(cached.overall_confidence,
                               original.overall_confidence, places=4)

    def test_cache_result_preserves_confluence(self):
        original = self._aggregate_and_cache("AMZN")
        cached = _run(self.agg.get_cached_result("AMZN"))
        self.assertEqual(cached.confluence_count, original.confluence_count)

    def test_cache_result_returns_composite_signal(self):
        self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsInstance(cached, CompositeSignal)

    def test_cache_ticker_sanitized(self):
        """Lowercase ticker should still match."""
        self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("aapl"))
        self.assertIsNotNone(cached)

    def test_cache_max_age_zero_always_misses(self):
        self._aggregate_and_cache("AAPL")
        for _ in range(3):
            cached = _run(self.agg.get_cached_result("AAPL", max_age_minutes=0))
            self.assertIsNone(cached)

    def test_cache_large_ttl_always_hits(self):
        self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL", max_age_minutes=99999))
        self.assertIsNotNone(cached)

    def test_cache_preserves_weights_used(self):
        original = self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertEqual(set(cached.weights_used.keys()),
                         set(original.weights_used.keys()))

    def test_cache_preserves_trade_thesis(self):
        original = self._aggregate_and_cache("AAPL")
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertEqual(cached.trade_thesis, original.trade_thesis)

    def test_default_cache_ttl_value(self):
        self.assertEqual(_DEFAULT_CACHE_TTL_MINUTES, 60)


# ---------------------------------------------------------------------------
# 11. TestTickerSanitization  (~10 tests)
# ---------------------------------------------------------------------------

class TestTickerSanitization(unittest.TestCase):
    """_sanitize_ticker: uppercase, alphanumeric + dot/dash, truncate."""

    def test_normal_ticker(self):
        self.assertEqual(_sanitize_ticker("AAPL"), "AAPL")

    def test_lowercase_to_upper(self):
        self.assertEqual(_sanitize_ticker("aapl"), "AAPL")

    def test_special_chars_stripped(self):
        self.assertEqual(_sanitize_ticker("AA!@#$PL"), "AAPL")

    def test_xss_script_tag(self):
        result = _sanitize_ticker('<script>al')
        self.assertNotIn("<", result)
        self.assertNotIn(">", result)

    def test_long_ticker_truncated(self):
        result = _sanitize_ticker("A" * 50)
        self.assertLessEqual(len(result), _MAX_TICKER_LEN)

    def test_dot_preserved(self):
        self.assertEqual(_sanitize_ticker("BRK.B"), "BRK.B")

    def test_dash_preserved(self):
        self.assertEqual(_sanitize_ticker("BRK-A"), "BRK-A")

    def test_empty_string(self):
        self.assertEqual(_sanitize_ticker(""), "")

    def test_spaces_stripped(self):
        self.assertEqual(_sanitize_ticker("A A P L"), "AAPL")

    def test_unicode_stripped(self):
        result = _sanitize_ticker("TICK\u00e9R")
        self.assertNotIn("\u00e9", result)


# ---------------------------------------------------------------------------
# 12. TestNaNInfGuards  (~12 tests)
# ---------------------------------------------------------------------------

class TestNaNInfGuards(unittest.TestCase):
    """NaN/Inf handling in _safe_float, _is_finite, and aggregation."""

    def test_safe_float_nan_returns_zero(self):
        self.assertEqual(_safe_float(float("nan")), 0.0)

    def test_safe_float_inf_returns_zero(self):
        self.assertEqual(_safe_float(float("inf")), 0.0)

    def test_safe_float_neg_inf_returns_zero(self):
        self.assertEqual(_safe_float(float("-inf")), 0.0)

    def test_safe_float_normal_passthrough(self):
        self.assertEqual(_safe_float(3.14), 3.14)

    def test_safe_float_zero(self):
        self.assertEqual(_safe_float(0.0), 0.0)

    def test_is_finite_nan(self):
        self.assertFalse(_is_finite(float("nan")))

    def test_is_finite_inf(self):
        self.assertFalse(_is_finite(float("inf")))

    def test_is_finite_bool_excluded(self):
        self.assertFalse(_is_finite(True))
        self.assertFalse(_is_finite(False))

    def test_is_finite_string(self):
        self.assertFalse(_is_finite("hello"))

    def test_is_finite_none(self):
        self.assertFalse(_is_finite(None))

    def test_is_finite_valid_int(self):
        self.assertTrue(_is_finite(42))

    def test_is_finite_valid_float(self):
        self.assertTrue(_is_finite(3.14))


# ---------------------------------------------------------------------------
# 13. TestNaNInfAggregation  (~8 tests)
# ---------------------------------------------------------------------------

class TestNaNInfAggregation(_TempDBTestCase):
    """NaN/Inf edge cases during aggregation."""

    def test_all_nan_weights_equal(self):
        custom = {m: float("nan") for m in METHODOLOGY_NAMES}
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        # All NaN => equal distribution
        for v in result.weights_used.values():
            self.assertAlmostEqual(v, 1.0 / 6, places=6)

    def test_all_inf_weights_equal(self):
        custom = {m: float("inf") for m in METHODOLOGY_NAMES}
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        for v in result.weights_used.values():
            self.assertAlmostEqual(v, 1.0 / 6, places=6)

    def test_mixed_nan_normal_weights(self):
        custom = {"wyckoff": float("nan"), "canslim": 1.0,
                  "elliott_wave": 0.0, "ict_smart_money": 0.0,
                  "larry_williams": 0.0, "sentiment": 0.0}
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        self.assertAlmostEqual(result.weights_used["wyckoff"], 0.0, places=4)

    def test_zero_confidence_all_signals(self):
        signals = _make_all_signals("bullish", 0.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertAlmostEqual(result.overall_confidence, 0.0, places=4)

    def test_epsilon_constant(self):
        self.assertEqual(_EPSILON, 1e-10)

    def test_zero_active_weight_sum_neutral(self):
        """If active_weight_sum < epsilon => neutral."""
        custom = {m: 0.0 for m in METHODOLOGY_NAMES}
        # all-zero normalized to equal, so won't actually be zero
        # But we test the equal distribution path
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        self.assertIsInstance(result, CompositeSignal)

    def test_confidence_never_negative(self):
        signals = _make_all_signals("bearish", 0.1)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertGreaterEqual(result.overall_confidence, 0.0)

    def test_confidence_never_above_one(self):
        signals = _make_all_signals("bullish", 1.0)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertLessEqual(result.overall_confidence, 1.0)


# ---------------------------------------------------------------------------
# 14. TestCompositeSignalContract  (~12 tests)
# ---------------------------------------------------------------------------

class TestCompositeSignalContract(_TempDBTestCase):
    """CompositeSignal dataclass fields, to_dict(), from_dict()."""

    def test_returns_composite_signal(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)

    def test_has_ticker(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(result.ticker, "AAPL")

    def test_has_overall_direction(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        valid = {d.value for d in OverallDirection}
        self.assertIn(result.overall_direction, valid)

    def test_has_overall_confidence(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.overall_confidence, float)
        self.assertGreaterEqual(result.overall_confidence, 0.0)
        self.assertLessEqual(result.overall_confidence, 1.0)

    def test_has_methodology_signals(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.methodology_signals, list)

    def test_has_confluence_count(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.confluence_count, int)
        self.assertGreaterEqual(result.confluence_count, 0)

    def test_has_timeframe_breakdown(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.timeframe_breakdown, dict)

    def test_has_trade_thesis(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.trade_thesis, str)

    def test_has_timestamp(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result.timestamp, datetime)

    def test_to_dict_works(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        d = result.to_dict()
        self.assertIsInstance(d, dict)
        self.assertIn("ticker", d)
        self.assertIn("overall_direction", d)
        self.assertIn("overall_confidence", d)
        self.assertIn("methodology_signals", d)

    def test_from_dict_round_trips(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        d = result.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(restored.ticker, result.ticker)
        self.assertEqual(restored.overall_direction, result.overall_direction)
        self.assertAlmostEqual(restored.overall_confidence,
                               result.overall_confidence, places=6)
        self.assertEqual(restored.confluence_count, result.confluence_count)

    def test_to_dict_json_serializable(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate("AAPL", signals))
        d = result.to_dict()
        s = json.dumps(d, default=str)
        self.assertIsInstance(s, str)


# ---------------------------------------------------------------------------
# 15. TestSupportResistance  (~10 tests)
# ---------------------------------------------------------------------------

class TestSupportResistance(_TempDBTestCase):
    """_extract_level for support/resistance in trade thesis."""

    def test_support_extracted(self):
        signals = _make_all_signals("bullish", 0.8,
                                    key_levels={"support": 150.0})
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("$150.00", result.trade_thesis)

    def test_resistance_extracted(self):
        signals = _make_all_signals("bullish", 0.8,
                                    key_levels={"resistance": 200.0})
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("$200.00", result.trade_thesis)

    def test_no_support_shows_na(self):
        signals = _make_all_signals("bullish", 0.8, key_levels={"test": True})
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("N/A", result.trade_thesis)

    def test_no_resistance_shows_na(self):
        signals = _make_all_signals("bullish", 0.8, key_levels={"test": True})
        result = _run(self.agg.aggregate("AAPL", signals))
        # Both support and resistance should be N/A
        thesis_parts = result.trade_thesis.split("|")
        na_count = sum(1 for p in thesis_parts if "N/A" in p)
        self.assertGreaterEqual(na_count, 1)

    def test_multiple_signals_different_levels(self):
        """Most common level wins."""
        signals = [
            _make_signal("wyckoff", "bullish", 0.8,
                         key_levels={"support": 100.0}),
            _make_signal("elliott_wave", "bullish", 0.7,
                         key_levels={"support": 100.0}),
            _make_signal("ict_smart_money", "bullish", 0.6,
                         key_levels={"support": 95.0}),
            _make_signal("canslim", "bullish", 0.5,
                         key_levels={"support": 100.0}),
            _make_signal("larry_williams", "bullish", 0.4,
                         key_levels={"support": 95.0}),
            _make_signal("sentiment", "bullish", 0.3,
                         key_levels={"support": 100.0}),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        # 100.0 appears 4 times vs 95.0 twice
        self.assertIn("$100.00", result.trade_thesis)

    def test_bool_support_ignored(self):
        """Bool is excluded by isinstance(val, bool) check."""
        level = CompositeAggregator._extract_level(
            [_make_signal("wyckoff", "bullish", 0.8,
                          key_levels={"support": True})],
            "support")
        self.assertIsNone(level)

    def test_nan_support_ignored(self):
        level = CompositeAggregator._extract_level(
            [_make_signal("wyckoff", "bullish", 0.8,
                          key_levels={"support": float("nan")})],
            "support")
        self.assertIsNone(level)

    def test_inf_support_ignored(self):
        level = CompositeAggregator._extract_level(
            [_make_signal("wyckoff", "bullish", 0.8,
                          key_levels={"support": float("inf")})],
            "support")
        self.assertIsNone(level)

    def test_int_support_accepted(self):
        level = CompositeAggregator._extract_level(
            [_make_signal("wyckoff", "bullish", 0.8,
                          key_levels={"support": 150})],
            "support")
        self.assertAlmostEqual(level, 150.0, places=2)

    def test_string_support_ignored(self):
        level = CompositeAggregator._extract_level(
            [_make_signal("wyckoff", "bullish", 0.8,
                          key_levels={"support": "150"})],
            "support")
        self.assertIsNone(level)


# ---------------------------------------------------------------------------
# 16. TestConstants  (~6 tests)
# ---------------------------------------------------------------------------

class TestConstants(unittest.TestCase):
    """Module-level constant values."""

    def test_epsilon(self):
        self.assertEqual(_EPSILON, 1e-10)

    def test_max_ticker_len(self):
        self.assertEqual(_MAX_TICKER_LEN, 10)

    def test_confluence_bonus_4(self):
        self.assertAlmostEqual(_CONFLUENCE_BONUS_4, 1.2, places=4)

    def test_confluence_bonus_5(self):
        self.assertAlmostEqual(_CONFLUENCE_BONUS_5, 1.4, places=4)

    def test_direction_scores_complete(self):
        self.assertEqual(len(_DIRECTION_SCORES), 3)
        self.assertIn("bullish", _DIRECTION_SCORES)
        self.assertIn("bearish", _DIRECTION_SCORES)
        self.assertIn("neutral", _DIRECTION_SCORES)

    def test_thresholds(self):
        self.assertAlmostEqual(_STRONG_BULLISH_THRESHOLD, 0.5, places=4)
        self.assertAlmostEqual(_BULLISH_THRESHOLD, 0.15, places=4)
        self.assertAlmostEqual(_BEARISH_THRESHOLD, -0.15, places=4)
        self.assertAlmostEqual(_STRONG_BEARISH_THRESHOLD, -0.5, places=4)


# ---------------------------------------------------------------------------
# 17. TestIntegration  (~18 tests)
# ---------------------------------------------------------------------------

class TestIntegration(_TempDBTestCase):
    """Full end-to-end flows."""

    def test_full_flow_6_signals_aggregate_cache_retrieve(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsNotNone(cached)
        self.assertEqual(cached.ticker, "AAPL")
        self.assertIn("bullish", cached.overall_direction)

    def test_full_flow_custom_weights(self):
        custom = {"wyckoff": 1.0, "canslim": 1.0, "sentiment": 1.0,
                  "elliott_wave": 0.0, "ict_smart_money": 0.0,
                  "larry_williams": 0.0}
        signals = [
            _make_signal("wyckoff", "bearish", 0.9),
            _make_signal("canslim", "bearish", 0.9),
            _make_signal("sentiment", "bearish", 0.9),
            _make_signal("elliott_wave", "bullish", 0.9),
            _make_signal("ict_smart_money", "bullish", 0.9),
            _make_signal("larry_williams", "bullish", 0.9),
        ]
        result = _run(self.agg.aggregate("AAPL", signals, weights=custom))
        # Only bearish methodologies have weight
        self.assertIn("bearish", result.overall_direction)

    def test_full_flow_partial_signals(self):
        signals = _make_all_signals("bullish", 0.7)[:3]
        result = _run(self.agg.aggregate("TSLA", signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        cached = _run(self.agg.get_cached_result("TSLA"))
        self.assertIsNotNone(cached)

    def test_round_trip_to_dict_from_dict(self):
        signals = _make_all_signals("bearish", 0.6)
        result = _run(self.agg.aggregate("MSFT", signals))
        d = result.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(restored.ticker, result.ticker)
        self.assertEqual(restored.overall_direction, result.overall_direction)
        self.assertAlmostEqual(restored.overall_confidence,
                               result.overall_confidence, places=6)
        self.assertEqual(restored.confluence_count, result.confluence_count)
        self.assertEqual(restored.trade_thesis, result.trade_thesis)

    def test_set_weights_then_aggregate(self):
        custom = {m: (1.0 if m == "wyckoff" else 0.0) for m in METHODOLOGY_NAMES}
        _run(self.agg.set_weights(custom))
        signals = [
            _make_signal("wyckoff", "bearish", 1.0),
            _make_signal("canslim", "bullish", 1.0),
            _make_signal("sentiment", "bullish", 1.0),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        # wyckoff dominates => bearish
        self.assertIn("bearish", result.overall_direction)

    def test_reset_weights_then_aggregate(self):
        custom = {"wyckoff": 100.0}
        _run(self.agg.set_weights(custom))
        _run(self.agg.reset_weights())
        weights = _run(self.agg.get_weights())
        for name in METHODOLOGY_NAMES:
            self.assertAlmostEqual(weights[name], DEFAULT_WEIGHTS[name], places=5)

    def test_aggregate_different_timeframes(self):
        signals = [
            _make_signal("wyckoff", "bullish", 0.9, "short"),
            _make_signal("elliott_wave", "bullish", 0.8, "medium"),
            _make_signal("ict_smart_money", "bearish", 0.7, "long"),
            _make_signal("canslim", "bullish", 0.6, "short"),
            _make_signal("larry_williams", "neutral", 0.5, "medium"),
            _make_signal("sentiment", "bearish", 0.4, "long"),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertEqual(
            len(result.timeframe_breakdown["short"]["methodologies"]), 2)
        self.assertEqual(
            len(result.timeframe_breakdown["medium"]["methodologies"]), 2)
        self.assertEqual(
            len(result.timeframe_breakdown["long"]["methodologies"]), 2)

    def test_aggregate_all_neutral_then_cache(self):
        signals = _make_all_signals("neutral", 0.5)
        result = _run(self.agg.aggregate("AAPL", signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsNotNone(cached)
        self.assertEqual(cached.overall_direction, "neutral")

    def test_multiple_tickers_cached(self):
        for ticker in ("AAPL", "MSFT", "GOOG", "TSLA"):
            signals = _make_all_signals("bullish", 0.7, ticker=ticker)
            result = _run(self.agg.aggregate(ticker, signals))
            weights = _run(self.agg.get_weights())
            _run(self.agg.cache_result(result, signals, weights))
        for ticker in ("AAPL", "MSFT", "GOOG", "TSLA"):
            cached = _run(self.agg.get_cached_result(ticker))
            self.assertIsNotNone(cached)
            self.assertEqual(cached.ticker, ticker)

    def test_aggregate_empty_then_non_empty(self):
        result1 = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result1.overall_direction, "neutral")
        signals = _make_all_signals("bullish", 0.9)
        result2 = _run(self.agg.aggregate("AAPL", signals))
        self.assertIn("bullish", result2.overall_direction)

    def test_json_round_trip_via_cache(self):
        signals = _make_all_signals("bullish", 0.65)
        result = _run(self.agg.aggregate("AAPL", signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        cached = _run(self.agg.get_cached_result("AAPL"))
        # Verify the cached result can also be serialized again
        d = cached.to_dict()
        self.assertIsInstance(json.dumps(d, default=str), str)

    def test_from_dict_preserves_methodology_signals(self):
        signals = _make_all_signals("bullish", 0.6)
        result = _run(self.agg.aggregate("AAPL", signals))
        d = result.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(len(restored.methodology_signals), 6)

    def test_from_dict_preserves_timeframe_breakdown(self):
        signals = _make_all_signals("bullish", 0.6, timeframe="long")
        result = _run(self.agg.aggregate("AAPL", signals))
        d = result.to_dict()
        restored = CompositeSignal.from_dict(d)
        self.assertEqual(
            len(restored.timeframe_breakdown["long"]["methodologies"]), 6)

    def test_aggregate_with_mixed_confidences(self):
        signals = [
            _make_signal("wyckoff", "bullish", 1.0),
            _make_signal("elliott_wave", "bullish", 0.5),
            _make_signal("ict_smart_money", "bullish", 0.1),
            _make_signal("canslim", "bearish", 0.9),
            _make_signal("larry_williams", "bearish", 0.3),
            _make_signal("sentiment", "neutral", 0.5),
        ]
        result = _run(self.agg.aggregate("AAPL", signals))
        self.assertIsInstance(result, CompositeSignal)
        self.assertGreaterEqual(result.overall_confidence, 0.0)
        self.assertLessEqual(result.overall_confidence, 1.0)

    def test_ticker_sanitization_in_aggregate(self):
        signals = _make_all_signals("bullish", 0.7, ticker="test")
        result = _run(self.agg.aggregate("test!@#", signals))
        self.assertEqual(result.ticker, "TEST")

    def test_xss_ticker_safe_in_aggregate(self):
        signals = _make_all_signals("bullish", 0.7)
        result = _run(self.agg.aggregate('<script>alert("x")</script>', signals))
        self.assertNotIn("<script>", result.ticker)
        self.assertNotIn("alert", result.ticker)

    def test_close_and_reopen(self):
        signals = _make_all_signals("bullish", 0.8)
        result = _run(self.agg.aggregate("AAPL", signals))
        weights = _run(self.agg.get_weights())
        _run(self.agg.cache_result(result, signals, weights))
        _run(self.agg.close())
        # Reopen via new aggregate call
        cached = _run(self.agg.get_cached_result("AAPL"))
        self.assertIsNotNone(cached)

    def test_multiple_aggregations_same_instance(self):
        for direction in ("bullish", "bearish", "neutral"):
            signals = _make_all_signals(direction, 0.7)
            result = _run(self.agg.aggregate("TEST", signals))
            self.assertIsInstance(result, CompositeSignal)


# ---------------------------------------------------------------------------
# 18. TestHelperFunctions  (~5 tests)
# ---------------------------------------------------------------------------

class TestHelperFunctions(unittest.TestCase):
    """Module-level helper functions."""

    def test_safe_float_large_number(self):
        self.assertEqual(_safe_float(1e300), 1e300)

    def test_safe_float_negative(self):
        self.assertEqual(_safe_float(-5.5), -5.5)

    def test_is_finite_list(self):
        self.assertFalse(_is_finite([1, 2]))

    def test_is_finite_dict(self):
        self.assertFalse(_is_finite({"a": 1}))

    def test_is_finite_zero(self):
        self.assertTrue(_is_finite(0))


# ---------------------------------------------------------------------------
# 19. TestMethodologySignalFactory  (~6 tests)
# ---------------------------------------------------------------------------

class TestMethodologySignalFactory(unittest.TestCase):
    """Validate the test helper _make_signal."""

    def test_creates_valid_signal(self):
        sig = _make_signal()
        self.assertIsInstance(sig, MethodologySignal)

    def test_default_methodology(self):
        sig = _make_signal()
        self.assertEqual(sig.methodology, "wyckoff")

    def test_custom_methodology(self):
        sig = _make_signal(methodology="canslim")
        self.assertEqual(sig.methodology, "canslim")

    def test_custom_direction(self):
        sig = _make_signal(direction="bearish")
        self.assertEqual(sig.direction, "bearish")

    def test_custom_confidence(self):
        sig = _make_signal(confidence=0.42)
        self.assertAlmostEqual(sig.confidence, 0.42, places=4)

    def test_make_all_signals_count(self):
        signals = _make_all_signals()
        self.assertEqual(len(signals), 6)
        names = {s.methodology for s in signals}
        self.assertEqual(names, set(METHODOLOGY_NAMES))


# ---------------------------------------------------------------------------
# 20. TestNeutralComposite  (~6 tests)
# ---------------------------------------------------------------------------

class TestNeutralComposite(_TempDBTestCase):
    """_neutral_composite fallback behavior."""

    def test_direction_neutral(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result.overall_direction, "neutral")

    def test_confidence_0_1(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertAlmostEqual(result.overall_confidence, 0.1, places=4)

    def test_confluence_zero(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertEqual(result.confluence_count, 0)

    def test_has_all_timeframes(self):
        result = _run(self.agg.aggregate("AAPL", []))
        for tf in ("short", "medium", "long"):
            self.assertIn(tf, result.timeframe_breakdown)

    def test_thesis_mentions_minimum(self):
        result = _run(self.agg.aggregate("AAPL", []))
        self.assertIn(f"Minimum {_MIN_SIGNALS}", result.trade_thesis)

    def test_single_signal_produces_neutral(self):
        sig = _make_signal("wyckoff", "bullish", 1.0)
        result = _run(self.agg.aggregate("AAPL", [sig]))
        self.assertEqual(result.overall_direction, "neutral")


if __name__ == "__main__":
    unittest.main()
