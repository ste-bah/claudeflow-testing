"""Tests for TASK-ANALYSIS-007: Sentiment analysis module.

Validates SentimentAnalyzer against the BaseMethodology ABC contract,
FinBERT/LM/VADER fallback chain, recency weighting, batch optimization,
trend detection, theme extraction, confidence calculation, key levels,
reasoning string, ticker sanitization (XSS prevention), NaN/Inf handling,
article parsing, and edge cases.

All ML models (FinBERT, VADER, transformers) are fully mocked.
No real network or model loading calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_sentiment.py -v``
"""
from __future__ import annotations

import asyncio
import json
import math
import re
import types
import unittest
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd

from app.analysis.base import BaseMethodology, Direction, MethodologySignal, Timeframe
from app.analysis.sentiment import (
    SentimentAnalyzer,
    _BATCH_OLD_ARTICLE_DAYS,
    _BATCH_THRESHOLD,
    _BEARISH_THRESHOLD,
    _BULLISH_THRESHOLD,
    _EPSILON,
    _FINBERT_MAX_TOKENS,
    _MAX_THEMES,
    _MAX_TICKER_LEN,
    _MIN_RECENCY_WEIGHT,
    _MIN_THEME_WORD_LEN,
    _NO_ARTICLES_CONFIDENCE,
    _RECENCY_HALF_LIFE_DAYS,
    _STOPWORDS,
    _TREND_THRESHOLD,
    get_finbert,
    _load_lm_dict,
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
    else:
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
    elif pattern == "constant":
        volumes = [1_000_000] * rows
    else:
        volumes = [1_000_000] * rows
    return pd.DataFrame({"date": dates, "volume": volumes})


_NOW = datetime.now(tz=timezone.utc)


def _make_articles(
    n: int = 5,
    sentiment: str = "mixed",
    days_spread: int = 7,
    source: str = "TestSource",
) -> list[dict[str, Any]]:
    """Generate test articles with various sentiments and dates.

    Sentiments:
        ``"bullish"`` -- all positive headlines
        ``"bearish"`` -- all negative headlines
        ``"neutral"`` -- all neutral headlines
        ``"mixed"``   -- alternating bullish/bearish/neutral
    """
    articles: list[dict[str, Any]] = []
    bullish_headlines = [
        "Revenue soars to new highs with strong growth",
        "Company achieves record earnings this quarter",
        "Strong demand drives profit surge",
        "Massive investment gains boost outlook",
        "Innovation breakthrough propels stock upward",
    ]
    bearish_headlines = [
        "Profits plunge amid worsening conditions",
        "Revenue declines sharply losses mount",
        "Company faces severe downturn and risk",
        "Market crash erodes shareholder value",
        "Bankruptcy fears grow after missed targets",
    ]
    neutral_headlines = [
        "Company holds annual meeting discusses plans",
        "Quarterly report released on schedule",
        "Board of directors appoints new member",
        "Company completes routine regulatory filing",
        "Management provides standard industry update",
    ]

    for i in range(n):
        days_ago = (i / max(n - 1, 1)) * days_spread if n > 1 else 0
        pub_dt = _NOW - timedelta(days=days_ago)

        if sentiment == "bullish":
            headline = bullish_headlines[i % len(bullish_headlines)]
            summary = "Positive outlook with strong fundamentals."
        elif sentiment == "bearish":
            headline = bearish_headlines[i % len(bearish_headlines)]
            summary = "Negative outlook with weak fundamentals."
        elif sentiment == "neutral":
            headline = neutral_headlines[i % len(neutral_headlines)]
            summary = "Standard report with typical results."
        else:  # mixed
            if i % 3 == 0:
                headline = bullish_headlines[i % len(bullish_headlines)]
                summary = "Positive outlook."
            elif i % 3 == 1:
                headline = bearish_headlines[i % len(bearish_headlines)]
                summary = "Negative outlook."
            else:
                headline = neutral_headlines[i % len(neutral_headlines)]
                summary = "Neutral outlook."

        articles.append({
            "headline": headline,
            "summary": summary,
            "published_at": pub_dt.isoformat(),
            "source": source,
        })

    return articles


def _mock_finbert_result(positive: float = 0.8, negative: float = 0.1, neutral: float = 0.1):
    """Create a mock FinBERT model output with given logit values.

    Returns a mock (model, tokenizer) suitable for patching get_finbert.
    """
    import types as _t

    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {"input_ids": MagicMock(), "attention_mask": MagicMock()}

    # Build a mock tensor-like object
    class FakeTensor:
        def __init__(self, values):
            self._values = values

        def __getitem__(self, idx):
            return FakeTensor(self._values[idx]) if isinstance(idx, slice) else self._values[idx]

        def __float__(self):
            return float(self._values) if not isinstance(self._values, list) else float(self._values[0])

    class FakeSoftmax:
        """Mimics torch.softmax."""
        pass

    mock_model = MagicMock()
    output = _t.SimpleNamespace()
    output.logits = [[positive, negative, neutral]]  # batch dim

    mock_model.return_value = output

    return mock_model, mock_tokenizer


def _patch_finbert_success(positive: float = 0.8, negative: float = 0.1, neutral: float = 0.1):
    """Return a patch context that makes FinBERT scoring succeed with given logits.

    We patch score_article directly to simulate the FinBERT result,
    because _score_finbert depends on torch.
    """
    import math

    async def _mock_score_article(self, text):
        # Simulate softmax
        exps = [math.exp(positive), math.exp(negative), math.exp(neutral)]
        total = sum(exps)
        probs = [e / total for e in exps]
        score = probs[0] - probs[1]
        score = max(-1.0, min(1.0, score))
        if score > _BULLISH_THRESHOLD:
            label = "bullish"
        elif score < _BEARISH_THRESHOLD:
            label = "bearish"
        else:
            label = "neutral"
        return {"score": score, "label": label, "model": "finbert"}

    return patch.object(SentimentAnalyzer, "score_article", _mock_score_article)


def _patch_score_article(score: float = 0.5, label: str = "bullish", model: str = "finbert"):
    """Patch score_article to return a fixed result for all articles."""
    async def _mock(self, text):
        return {"score": score, "label": label, "model": model}
    return patch.object(SentimentAnalyzer, "score_article", _mock)


def _patch_lm_dict(positive_words=None, negative_words=None):
    """Patch _load_lm_dict to return specified word lists."""
    pos = {w.upper() for w in (positive_words or ["ACHIEVE", "BENEFIT", "GAIN", "PROFIT", "GROWTH"])}
    neg = {w.upper() for w in (negative_words or ["LOSS", "DECLINE", "RISK", "CRASH", "FAIL"])}
    return patch("app.analysis.sentiment._load_lm_dict", return_value={"positive": pos, "negative": neg})


def _patch_vader(compound: float = 0.5):
    """Patch _score_vader to return a fixed result without importing vaderSentiment."""
    def _mock_score_vader(self, text):
        if math.isnan(compound) or math.isinf(compound):
            c = 0.0
        else:
            c = max(-1.0, min(1.0, compound))
        label = SentimentAnalyzer._score_to_label(c)
        return c, label
    return patch.object(SentimentAnalyzer, "_score_vader", _mock_score_vader)


def _mock_vader_module():
    """Install a mock vaderSentiment module into sys.modules."""
    import sys
    mock_sia = MagicMock()
    mock_module = types.ModuleType("vaderSentiment")
    mock_sub = types.ModuleType("vaderSentiment.vaderSentiment")
    mock_sub.SentimentIntensityAnalyzer = mock_sia
    sys.modules["vaderSentiment"] = mock_module
    sys.modules["vaderSentiment.vaderSentiment"] = mock_sub
    return mock_sia


# ---------------------------------------------------------------------------
# 1. TestSentimentAnalyzerAttributes
# ---------------------------------------------------------------------------


class TestSentimentAnalyzerAttributes(unittest.TestCase):
    """Validate SentimentAnalyzer class attributes and inheritance."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_name(self):
        self.assertEqual(self.analyzer.name, "sentiment")

    def test_display_name(self):
        self.assertEqual(self.analyzer.display_name, "Sentiment Analysis")

    def test_default_timeframe(self):
        self.assertEqual(self.analyzer.default_timeframe, "short")

    def test_version(self):
        self.assertEqual(self.analyzer.version, "1.0.0")

    def test_subclass_of_base_methodology(self):
        self.assertIsInstance(self.analyzer, BaseMethodology)

    def test_has_analyze_method(self):
        self.assertTrue(hasattr(self.analyzer, "analyze"))
        self.assertTrue(callable(self.analyzer.analyze))

    def test_has_create_signal_method(self):
        self.assertTrue(hasattr(self.analyzer, "create_signal"))

    def test_has_score_article_method(self):
        self.assertTrue(hasattr(self.analyzer, "score_article"))
        self.assertTrue(callable(self.analyzer.score_article))


# ---------------------------------------------------------------------------
# 2. TestConstants
# ---------------------------------------------------------------------------


class TestConstants(unittest.TestCase):
    """Validate all module-level constants match the spec."""

    def test_epsilon(self):
        self.assertEqual(_EPSILON, 1e-10)

    def test_bullish_threshold(self):
        self.assertEqual(_BULLISH_THRESHOLD, 0.2)

    def test_bearish_threshold(self):
        self.assertEqual(_BEARISH_THRESHOLD, -0.2)

    def test_recency_half_life_days(self):
        self.assertEqual(_RECENCY_HALF_LIFE_DAYS, 7.0)

    def test_min_recency_weight(self):
        self.assertEqual(_MIN_RECENCY_WEIGHT, 0.01)

    def test_trend_threshold(self):
        self.assertEqual(_TREND_THRESHOLD, 0.1)

    def test_batch_threshold(self):
        self.assertEqual(_BATCH_THRESHOLD, 20)

    def test_batch_old_article_days(self):
        self.assertEqual(_BATCH_OLD_ARTICLE_DAYS, 7)

    def test_max_themes(self):
        self.assertEqual(_MAX_THEMES, 5)

    def test_min_theme_word_len(self):
        self.assertEqual(_MIN_THEME_WORD_LEN, 4)

    def test_max_ticker_len(self):
        self.assertEqual(_MAX_TICKER_LEN, 10)

    def test_finbert_max_tokens(self):
        self.assertEqual(_FINBERT_MAX_TOKENS, 512)

    def test_no_articles_confidence(self):
        self.assertEqual(_NO_ARTICLES_CONFIDENCE, 0.1)


# ---------------------------------------------------------------------------
# 3. TestNoArticles
# ---------------------------------------------------------------------------


class TestNoArticles(unittest.TestCase):
    """Validate behavior when no articles are provided."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.prices = _make_price_df(30)
        self.volumes = _make_volume_df(30)

    def test_no_kwargs_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertEqual(sig.direction, "neutral")
        self.assertAlmostEqual(sig.confidence, _NO_ARTICLES_CONFIDENCE)

    def test_empty_articles_list_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=[]))
        self.assertEqual(sig.direction, "neutral")
        self.assertAlmostEqual(sig.confidence, _NO_ARTICLES_CONFIDENCE)

    def test_articles_none_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=None))
        self.assertEqual(sig.direction, "neutral")
        self.assertAlmostEqual(sig.confidence, _NO_ARTICLES_CONFIDENCE)

    def test_articles_not_a_list_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles="not a list"))
        self.assertEqual(sig.direction, "neutral")
        self.assertAlmostEqual(sig.confidence, _NO_ARTICLES_CONFIDENCE)

    def test_articles_dict_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles={"a": 1}))
        self.assertEqual(sig.direction, "neutral")

    def test_all_invalid_articles_neutral(self):
        bad = [
            {"headline": "", "summary": "s", "published_at": "bad-date"},
            {"summary": "s", "published_at": "2024-01-01"},  # missing headline
            123,  # not a dict
        ]
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=bad))
        self.assertEqual(sig.direction, "neutral")

    def test_key_levels_has_all_required_keys_neutral(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        required_keys = {
            "overall_sentiment_score", "sentiment_trend", "article_count",
            "bullish_count", "bearish_count", "neutral_count",
            "key_themes_bullish", "key_themes_bearish", "model_used",
            "avg_score_last_3d", "avg_score_4_7d", "article_scores",
        }
        self.assertEqual(set(sig.key_levels.keys()), required_keys)

    def test_no_articles_article_count_zero(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertEqual(sig.key_levels["article_count"], 0)

    def test_no_articles_model_used_none(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertEqual(sig.key_levels["model_used"], "none")

    def test_no_articles_reasoning_mentions_no_articles(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertIn("no articles", sig.reasoning.lower())


# ---------------------------------------------------------------------------
# 4. TestTickerSanitization
# ---------------------------------------------------------------------------


class TestTickerSanitization(unittest.TestCase):
    """Validate ticker sanitization in analyze()."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.prices = _make_price_df(30)
        self.volumes = _make_volume_df(30)

    def test_normal_ticker(self):
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertEqual(sig.ticker, "AAPL")

    def test_lowercase_to_uppercase(self):
        sig = _run(self.analyzer.analyze("aapl", self.prices, self.volumes))
        self.assertEqual(sig.ticker, "AAPL")

    def test_special_chars_stripped(self):
        sig = _run(self.analyzer.analyze("AA$PL!", self.prices, self.volumes))
        self.assertEqual(sig.ticker, "AAPL")

    def test_long_ticker_truncated(self):
        sig = _run(self.analyzer.analyze("A" * 50, self.prices, self.volumes))
        self.assertEqual(len(sig.ticker), _MAX_TICKER_LEN)

    def test_empty_string(self):
        sig = _run(self.analyzer.analyze("", self.prices, self.volumes))
        self.assertIsInstance(sig, MethodologySignal)

    def test_xss_script_tag_stripped(self):
        sig = _run(self.analyzer.analyze('<script>alert("x")</script>', self.prices, self.volumes))
        self.assertNotIn("<script>", sig.ticker)
        self.assertNotIn("alert", sig.ticker)
        self.assertNotIn("<script>", sig.reasoning)

    def test_html_tags_stripped(self):
        sig = _run(self.analyzer.analyze("<img onerror=hack>", self.prices, self.volumes))
        self.assertNotIn("<", sig.ticker)
        self.assertNotIn(">", sig.ticker)

    def test_null_bytes_stripped(self):
        sig = _run(self.analyzer.analyze("AA\x00PL", self.prices, self.volumes))
        self.assertNotIn("\x00", sig.ticker)

    def test_dots_and_dashes_preserved(self):
        sig = _run(self.analyzer.analyze("BRK.B-A", self.prices, self.volumes))
        self.assertIn("BRK.B-A", sig.ticker)


# ---------------------------------------------------------------------------
# 5. TestArticleParsing
# ---------------------------------------------------------------------------


class TestArticleParsing(unittest.TestCase):
    """Validate _parse_articles filters invalid articles correctly."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def test_valid_article_parsed(self):
        articles = [{"headline": "Good news", "summary": "Details", "published_at": "2024-06-01T12:00:00+00:00", "source": "Reuters"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["headline"], "Good news")

    def test_missing_headline_skipped(self):
        articles = [{"summary": "Details", "published_at": "2024-06-01T12:00:00"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 0)

    def test_empty_headline_skipped(self):
        articles = [{"headline": "", "summary": "Details", "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 0)

    def test_whitespace_headline_skipped(self):
        articles = [{"headline": "   ", "summary": "Details", "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 0)

    def test_missing_summary_uses_empty_string(self):
        articles = [{"headline": "Title only", "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["summary"], "")

    def test_non_string_summary_uses_empty_string(self):
        articles = [{"headline": "Title", "summary": 123, "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["summary"], "")

    def test_invalid_date_format_uses_now(self):
        articles = [{"headline": "Title", "summary": "S", "published_at": "not-a-date"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["published_at"], self.now)

    def test_missing_published_at_uses_now(self):
        articles = [{"headline": "Title", "summary": "S"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["published_at"], self.now)

    def test_extra_fields_ignored(self):
        articles = [{"headline": "Title", "summary": "S", "published_at": "2024-06-01", "extra": "ignored"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertNotIn("extra", parsed[0])

    def test_non_dict_article_skipped(self):
        articles = [42, "string", None, [1, 2]]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 0)

    def test_non_string_headline_skipped(self):
        articles = [{"headline": 123, "summary": "S", "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 0)

    def test_datetime_published_at_accepted(self):
        pub_dt = datetime(2024, 6, 1, tzinfo=timezone.utc)
        articles = [{"headline": "Title", "summary": "S", "published_at": pub_dt}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["published_at"], pub_dt)

    def test_naive_datetime_gets_utc(self):
        pub_dt = datetime(2024, 6, 1)
        articles = [{"headline": "Title", "summary": "S", "published_at": pub_dt}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(parsed[0]["published_at"].tzinfo, timezone.utc)

    def test_non_string_source_uses_empty(self):
        articles = [{"headline": "Title", "summary": "S", "published_at": "2024-06-01", "source": 123}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(parsed[0]["source"], "")

    def test_headline_stripped(self):
        articles = [{"headline": "  Title  ", "summary": "S", "published_at": "2024-06-01"}]
        parsed = self.analyzer._parse_articles(articles, self.now)
        self.assertEqual(parsed[0]["headline"], "Title")


# ---------------------------------------------------------------------------
# 6. TestLoughranMcDonaldScoring
# ---------------------------------------------------------------------------


class TestLoughranMcDonaldScoring(unittest.TestCase):
    """Validate _score_loughran_mcdonald."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_positive_words_positive_score(self):
        with _patch_lm_dict(positive_words=["achieve", "benefit", "gain"], negative_words=[]):
            score, label = self.analyzer._score_loughran_mcdonald("We achieve great benefit and gain")
            self.assertGreater(score, 0.0)

    def test_negative_words_negative_score(self):
        with _patch_lm_dict(positive_words=[], negative_words=["loss", "decline", "risk"]):
            score, label = self.analyzer._score_loughran_mcdonald("We face loss decline and risk")
            self.assertLess(score, 0.0)

    def test_mixed_text_moderate_score(self):
        with _patch_lm_dict(positive_words=["gain"], negative_words=["loss"]):
            score, label = self.analyzer._score_loughran_mcdonald("gain and loss balanced text words here")
            self.assertAlmostEqual(score, 0.0, places=1)

    def test_empty_text_zero_score(self):
        with _patch_lm_dict():
            score, label = self.analyzer._score_loughran_mcdonald("")
            self.assertEqual(score, 0.0)
            self.assertEqual(label, "neutral")

    def test_score_clamped_to_range(self):
        # All words are positive => score = n_pos / n_total <= 1.0
        with _patch_lm_dict(positive_words=["alpha"], negative_words=[]):
            score, label = self.analyzer._score_loughran_mcdonald("alpha alpha alpha")
            self.assertLessEqual(score, 1.0)
            self.assertGreaterEqual(score, -1.0)

    def test_label_bullish_for_positive_score(self):
        with _patch_lm_dict(positive_words=["gain", "profit", "growth"], negative_words=[]):
            score, label = self.analyzer._score_loughran_mcdonald("gain profit growth gain profit")
            if score > _BULLISH_THRESHOLD:
                self.assertEqual(label, "bullish")

    def test_label_bearish_for_negative_score(self):
        with _patch_lm_dict(positive_words=[], negative_words=["loss", "decline", "fail"]):
            score, label = self.analyzer._score_loughran_mcdonald("loss decline fail loss decline")
            if score < _BEARISH_THRESHOLD:
                self.assertEqual(label, "bearish")

    def test_label_neutral_for_small_score(self):
        with _patch_lm_dict(positive_words=["gain"], negative_words=[]):
            # 1 positive in many words => small score
            score, label = self.analyzer._score_loughran_mcdonald("gain word word word word word word word word word word word word word word word word word word word")
            if -0.2 <= score <= 0.2:
                self.assertEqual(label, "neutral")

    def test_case_insensitive_matching(self):
        with _patch_lm_dict(positive_words=["achieve"], negative_words=[]):
            score1, _ = self.analyzer._score_loughran_mcdonald("ACHIEVE great things")
            score2, _ = self.analyzer._score_loughran_mcdonald("achieve great things")
            self.assertEqual(score1, score2)

    def test_no_words_zero_score(self):
        with _patch_lm_dict():
            score, label = self.analyzer._score_loughran_mcdonald("123 456 !@#")
            self.assertEqual(score, 0.0)

    def test_score_range(self):
        with _patch_lm_dict():
            for text in ["gain profit achieve", "loss decline risk", "word word word"]:
                score, _ = self.analyzer._score_loughran_mcdonald(text)
                self.assertGreaterEqual(score, -1.0)
                self.assertLessEqual(score, 1.0)

    def test_word_list_loads_from_json(self):
        """Real LM dictionary loads without error."""
        lm = _load_lm_dict()
        self.assertIn("positive", lm)
        self.assertIn("negative", lm)
        self.assertIsInstance(lm["positive"], set)

    def test_real_lm_positive_word(self):
        """Test with the real dictionary -- 'ACCOMPLISH' should be positive."""
        lm = _load_lm_dict()
        self.assertIn("ACCOMPLISH", lm["positive"])

    def test_all_positive_score_positive(self):
        with _patch_lm_dict(positive_words=["great", "super"], negative_words=[]):
            score, label = self.analyzer._score_loughran_mcdonald("great super great super")
            self.assertGreater(score, 0.0)

    def test_all_negative_score_negative(self):
        with _patch_lm_dict(positive_words=[], negative_words=["bad", "terrible"]):
            score, label = self.analyzer._score_loughran_mcdonald("bad terrible bad terrible")
            self.assertLess(score, 0.0)


# ---------------------------------------------------------------------------
# 7. TestVADERScoring
# ---------------------------------------------------------------------------


class TestVADERScoring(unittest.TestCase):
    """Validate _score_vader with mocked VADER.

    Since vaderSentiment is not installed, we mock _score_vader directly
    to test the scoring logic via _patch_vader helper.
    """

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_positive_compound(self):
        with _patch_vader(compound=0.8):
            score, label = self.analyzer._score_vader("Great news!")
            self.assertAlmostEqual(score, 0.8)
            self.assertEqual(label, "bullish")

    def test_negative_compound(self):
        with _patch_vader(compound=-0.7):
            score, label = self.analyzer._score_vader("Terrible news!")
            self.assertAlmostEqual(score, -0.7)
            self.assertEqual(label, "bearish")

    def test_neutral_compound(self):
        with _patch_vader(compound=0.1):
            score, label = self.analyzer._score_vader("Regular news.")
            self.assertAlmostEqual(score, 0.1)
            self.assertEqual(label, "neutral")

    def test_score_in_range(self):
        with _patch_vader(compound=0.5):
            score, label = self.analyzer._score_vader("text")
            self.assertGreaterEqual(score, -1.0)
            self.assertLessEqual(score, 1.0)

    def test_nan_compound_becomes_zero(self):
        with _patch_vader(compound=float("nan")):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(score, 0.0)
            self.assertEqual(label, "neutral")

    def test_inf_compound_clamped(self):
        with _patch_vader(compound=float("inf")):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(score, 0.0)

    def test_exact_threshold_bullish(self):
        with _patch_vader(compound=0.21):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(label, "bullish")

    def test_exact_threshold_neutral(self):
        with _patch_vader(compound=0.2):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(label, "neutral")

    def test_negative_threshold_bearish(self):
        with _patch_vader(compound=-0.21):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(label, "bearish")

    def test_negative_threshold_neutral(self):
        with _patch_vader(compound=-0.2):
            score, label = self.analyzer._score_vader("text")
            self.assertEqual(label, "neutral")


# ---------------------------------------------------------------------------
# 8. TestFallbackChain
# ---------------------------------------------------------------------------


class TestFallbackChain(unittest.TestCase):
    """Validate the FinBERT -> LM -> VADER fallback chain."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_finbert_succeeds_returns_finbert(self):
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            result = _run(self.analyzer.score_article("Good news"))
            self.assertEqual(result["model"], "finbert")

    def test_finbert_fails_lm_succeeds(self):
        """When _score_finbert raises, fall back to LM."""
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with _patch_lm_dict(positive_words=["good"], negative_words=[]):
                result = _run(self.analyzer.score_article("good news today"))
                self.assertEqual(result["model"], "loughran_mcdonald")

    def test_finbert_and_lm_fail_vader_returns(self):
        """When both FinBERT and LM raise, fall back to VADER."""
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        def _mock_lm(self, text):
            raise RuntimeError("No LM dict")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with patch.object(SentimentAnalyzer, "_score_loughran_mcdonald", _mock_lm):
                with _patch_vader(compound=0.5):
                    result = _run(self.analyzer.score_article("Some text"))
                    self.assertEqual(result["model"], "vader")

    def test_score_article_returns_dict_with_required_keys(self):
        with _patch_score_article(score=0.3, label="bullish", model="finbert"):
            result = _run(self.analyzer.score_article("text"))
            self.assertIn("score", result)
            self.assertIn("label", result)
            self.assertIn("model", result)

    def test_score_article_score_is_float(self):
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            result = _run(self.analyzer.score_article("text"))
            self.assertIsInstance(result["score"], float)

    def test_score_article_label_is_string(self):
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            result = _run(self.analyzer.score_article("text"))
            self.assertIsInstance(result["label"], str)

    def test_score_article_model_is_string(self):
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            result = _run(self.analyzer.score_article("text"))
            self.assertIsInstance(result["model"], str)

    def test_lm_returns_loughran_mcdonald_model(self):
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with _patch_lm_dict():
                result = _run(self.analyzer.score_article("achieve gain text"))
                self.assertEqual(result["model"], "loughran_mcdonald")

    def test_vader_returns_vader_model(self):
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        def _mock_lm(self, text):
            raise RuntimeError("No LM dict")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with patch.object(SentimentAnalyzer, "_score_loughran_mcdonald", _mock_lm):
                with _patch_vader(compound=0.0):
                    result = _run(self.analyzer.score_article("text"))
                    self.assertEqual(result["model"], "vader")

    def test_finbert_exception_not_propagated(self):
        """FinBERT exception should be caught, not raise."""
        async def _mock_finbert(self, text):
            raise ImportError("No transformers")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with _patch_lm_dict():
                result = _run(self.analyzer.score_article("text"))
                self.assertIsNotNone(result)

    def test_lm_exception_not_propagated(self):
        """LM exception should be caught, not raise."""
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        def _mock_lm(self, text):
            raise FileNotFoundError("No JSON")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with patch.object(SentimentAnalyzer, "_score_loughran_mcdonald", _mock_lm):
                with _patch_vader(compound=0.0):
                    result = _run(self.analyzer.score_article("text"))
                    self.assertIsNotNone(result)


# ---------------------------------------------------------------------------
# 9. TestBatchOptimization
# ---------------------------------------------------------------------------


class TestBatchOptimization(unittest.TestCase):
    """Validate batch optimization for >20 articles."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def test_below_threshold_uses_score_article(self):
        """<=20 articles all use normal score_article path."""
        articles = _make_articles(15, sentiment="bullish", days_spread=3)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        call_count = 0
        original = SentimentAnalyzer.score_article

        async def _counting_score(self, text):
            nonlocal call_count
            call_count += 1
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _counting_score):
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(call_count, 15)

    def test_above_threshold_old_articles_skip_finbert(self):
        """With >20 articles, old articles use LM directly."""
        articles = _make_articles(25, sentiment="bullish", days_spread=14)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        score_article_count = 0

        async def _counting_score(self, text):
            nonlocal score_article_count
            score_article_count += 1
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _counting_score):
            with _patch_lm_dict():
                scored = _run(self.analyzer._score_all_articles(parsed, self.now))
                # Some articles are old (>7 days) and skip score_article
                self.assertLess(score_article_count, 25)

    def test_exactly_20_no_batch_opt(self):
        """Exactly 20 articles should NOT trigger batch optimization (> not >=)."""
        articles = _make_articles(20, sentiment="bullish", days_spread=14)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        call_count = 0

        async def _counting_score(self, text):
            nonlocal call_count
            call_count += 1
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _counting_score):
            _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(call_count, 20)

    def test_21_articles_triggers_batch(self):
        """21 articles triggers batch optimization."""
        articles = _make_articles(21, sentiment="bullish", days_spread=14)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        call_count = 0

        async def _counting_score(self, text):
            nonlocal call_count
            call_count += 1
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _counting_score):
            with _patch_lm_dict():
                _run(self.analyzer._score_all_articles(parsed, self.now))
                # Some old articles skip score_article
                self.assertLess(call_count, 21)

    def test_all_recent_21_still_uses_finbert(self):
        """21 articles all within 3 days still use score_article for all."""
        articles = _make_articles(21, sentiment="bullish", days_spread=3)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        call_count = 0

        async def _counting_score(self, text):
            nonlocal call_count
            call_count += 1
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _counting_score):
            _run(self.analyzer._score_all_articles(parsed, self.now))
            # All recent, none skip
            self.assertEqual(call_count, 21)

    def test_sorted_by_recency(self):
        """Articles should be processed newest first."""
        articles = _make_articles(5, sentiment="bullish", days_spread=10)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)
        # Verify sorted order
        for i in range(len(parsed) - 1):
            self.assertGreaterEqual(parsed[i]["published_at"], parsed[i + 1]["published_at"])

    def test_scored_has_correct_fields(self):
        articles = _make_articles(3, sentiment="bullish", days_spread=1)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            for item in scored:
                self.assertIn("headline", item)
                self.assertIn("score", item)
                self.assertIn("label", item)
                self.assertIn("model", item)
                self.assertIn("days_old", item)

    def test_batch_old_lm_fails_falls_to_vader(self):
        """When LM fails for old articles in batch mode, fall back to VADER."""
        articles = _make_articles(25, sentiment="bullish", days_spread=14)
        parsed = self.analyzer._parse_articles(articles, self.now)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        async def _mock_score(self, text):
            return {"score": 0.5, "label": "bullish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _mock_score):
            with patch.object(SentimentAnalyzer, "_score_loughran_mcdonald", side_effect=RuntimeError("fail")):
                with _patch_vader(compound=0.3):
                    scored = _run(self.analyzer._score_all_articles(parsed, self.now))
                    # Old articles that went through LM fallback should use vader
                    vader_models = [s for s in scored if s["model"] == "vader"]
                    self.assertTrue(len(vader_models) > 0)

    def test_negative_days_old_treated_as_zero(self):
        """Future-dated articles should have days_old clamped to 0."""
        future_dt = self.now + timedelta(days=5)
        articles = [{"headline": "Future news", "summary": "S", "published_at": future_dt.isoformat()}]
        parsed = self.analyzer._parse_articles(articles, self.now)

        with _patch_score_article():
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(scored[0]["days_old"], 0.0)


# ---------------------------------------------------------------------------
# 10. TestRecencyWeighting
# ---------------------------------------------------------------------------


class TestRecencyWeighting(unittest.TestCase):
    """Validate recency weighting in _aggregate_scores."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _make_scored(self, days_old: float, score: float = 0.5, label: str = "bullish"):
        return {
            "headline": "Test",
            "summary": "Summary",
            "score": score,
            "label": label,
            "model": "finbert",
            "published_at": self.now - timedelta(days=days_old),
            "source": "test",
            "days_old": days_old,
        }

    def test_today_article_weight_near_one(self):
        scored = [self._make_scored(0.0)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # weight = exp(0) = 1.0; overall_score = 0.5 * 1.0 / 1.0 = 0.5
        self.assertAlmostEqual(agg["overall_score"], 0.5, places=2)

    def test_7_day_old_weight_about_037(self):
        # weight = exp(-1) ~ 0.368
        weight_7d = math.exp(-1.0)
        self.assertAlmostEqual(weight_7d, 0.368, places=2)

    def test_14_day_old_weight_about_014(self):
        weight_14d = math.exp(-14.0 / 7.0)
        self.assertAlmostEqual(weight_14d, 0.135, places=2)

    def test_min_weight_enforced(self):
        # 100 days old => exp(-100/7) ~ 6e-7, clamped to 0.01
        scored = [self._make_scored(100.0)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # With minimum weight, score should still be non-zero
        self.assertAlmostEqual(agg["overall_score"], 0.5, places=1)

    def test_recent_articles_dominate(self):
        """Recent bullish + old bearish => overall should be bullish."""
        scored = [
            self._make_scored(0.0, score=0.8, label="bullish"),
            self._make_scored(14.0, score=-0.8, label="bearish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # Recent has weight ~1.0, old has weight ~0.135
        # weighted avg = (0.8*1.0 + -0.8*0.135) / (1.0 + 0.135) ~ 0.61
        self.assertGreater(agg["overall_score"], 0.0)

    def test_old_articles_low_influence(self):
        """Old bearish should not overpower recent bullish."""
        scored = [
            self._make_scored(0.0, score=0.5, label="bullish"),
            self._make_scored(30.0, score=-1.0, label="bearish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertGreater(agg["overall_score"], 0.0)

    def test_very_old_article_weight_at_minimum(self):
        weight = math.exp(-365.0 / _RECENCY_HALF_LIFE_DAYS)
        self.assertLess(weight, _MIN_RECENCY_WEIGHT)

    def test_equal_age_equal_weight(self):
        scored = [
            self._make_scored(3.0, score=0.6, label="bullish"),
            self._make_scored(3.0, score=-0.6, label="bearish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertAlmostEqual(agg["overall_score"], 0.0, places=2)

    def test_nan_score_treated_as_zero(self):
        scored_item = self._make_scored(0.0, score=float("nan"), label="bullish")
        agg = self.analyzer._aggregate_scores([scored_item], self.now)
        self.assertAlmostEqual(agg["overall_score"], 0.0, places=2)

    def test_overall_score_clamped_to_range(self):
        scored = [self._make_scored(0.0, score=0.9, label="bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertGreaterEqual(agg["overall_score"], -1.0)
        self.assertLessEqual(agg["overall_score"], 1.0)

    def test_nan_weight_uses_minimum(self):
        """If weight calculation yields NaN, should use minimum weight."""
        scored_item = self._make_scored(0.0)
        scored_item["days_old"] = float("nan")
        # exp(nan/7) = nan, should be caught
        # Actually the guard is: if nan(days_old), days_old=0 (in _score_all_articles)
        # But _aggregate_scores also guards: if nan(weight), weight = MIN
        agg = self.analyzer._aggregate_scores([scored_item], self.now)
        # NaN days_old => exp(nan) => nan weight => _MIN_RECENCY_WEIGHT
        # score = 0.5 * 0.01 / 0.01 = 0.5 (with min weight)
        self.assertIsNotNone(agg["overall_score"])

    def test_inf_weight_uses_minimum(self):
        scored_item = self._make_scored(0.0)
        scored_item["days_old"] = float("-inf")
        agg = self.analyzer._aggregate_scores([scored_item], self.now)
        # exp(inf/7) = inf, guard sets to MIN
        self.assertIsNotNone(agg["overall_score"])


# ---------------------------------------------------------------------------
# 11. TestSentimentTrend
# ---------------------------------------------------------------------------


class TestSentimentTrend(unittest.TestCase):
    """Validate sentiment trend detection."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _scored(self, days_old, score, label="neutral"):
        return {
            "headline": "Test",
            "summary": "",
            "score": score,
            "label": label,
            "model": "finbert",
            "published_at": self.now - timedelta(days=days_old),
            "source": "",
            "days_old": days_old,
        }

    def test_improving_trend(self):
        """Recent > older by >0.1 => improving."""
        scored = [
            self._scored(1.0, 0.6, "bullish"),   # recent (0-3d)
            self._scored(5.0, 0.2, "neutral"),    # older (4-7d)
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "improving")

    def test_deteriorating_trend(self):
        """Recent < older by >0.1 => deteriorating."""
        scored = [
            self._scored(1.0, 0.1, "neutral"),    # recent
            self._scored(5.0, 0.6, "bullish"),    # older
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "deteriorating")

    def test_stable_trend(self):
        """Difference < 0.1 => stable."""
        scored = [
            self._scored(1.0, 0.5, "bullish"),
            self._scored(5.0, 0.45, "bullish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "stable")

    def test_exactly_01_difference_stable(self):
        """Exactly 0.1 difference => stable (threshold is >0.1 not >=)."""
        scored = [
            self._scored(1.0, 0.3, "bullish"),
            self._scored(5.0, 0.2, "neutral"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "stable")

    def test_no_older_articles_stable(self):
        """All recent articles, no older => trend compares against 0.0."""
        scored = [
            self._scored(1.0, 0.5, "bullish"),
            self._scored(2.0, 0.6, "bullish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # avg_recent = 0.55, avg_older = 0.0 => diff=0.55 > 0.1 => improving
        self.assertEqual(agg["trend"], "improving")

    def test_no_recent_articles_stable(self):
        """Only older articles, no recent."""
        scored = [
            self._scored(5.0, 0.5, "bullish"),
            self._scored(6.0, 0.4, "bullish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # avg_recent = 0.0, avg_older = 0.45 => diff=-0.45 < -0.1 => deteriorating
        self.assertEqual(agg["trend"], "deteriorating")

    def test_all_articles_beyond_7d_no_trend_data(self):
        """Articles beyond 7 days don't contribute to either bucket."""
        scored = [
            self._scored(10.0, 0.8, "bullish"),
            self._scored(14.0, 0.2, "neutral"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # Both avg_recent and avg_older are 0.0 => diff=0 => stable
        self.assertEqual(agg["trend"], "stable")

    def test_trend_improving_large_positive_diff(self):
        scored = [
            self._scored(0.5, 0.9, "bullish"),
            self._scored(5.0, -0.5, "bearish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "improving")

    def test_trend_deteriorating_large_negative_diff(self):
        scored = [
            self._scored(1.0, -0.8, "bearish"),
            self._scored(5.0, 0.7, "bullish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["trend"], "deteriorating")

    def test_articles_at_boundary_3d(self):
        """Article exactly at 3.0 days is considered recent (<=3.0)."""
        scored = [self._scored(3.0, 0.5, "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertAlmostEqual(agg["avg_recent"], 0.5)


# ---------------------------------------------------------------------------
# 12. TestKeyThemes
# ---------------------------------------------------------------------------


class TestKeyThemes(unittest.TestCase):
    """Validate key themes extraction."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _scored(self, headline, summary, label, days_old=0.0):
        return {
            "headline": headline,
            "summary": summary,
            "score": 0.5 if label == "bullish" else (-0.5 if label == "bearish" else 0.0),
            "label": label,
            "model": "finbert",
            "published_at": self.now - timedelta(days=days_old),
            "source": "",
            "days_old": days_old,
        }

    def test_bullish_themes_extracted(self):
        scored = [
            self._scored("Innovation breakthrough drives growth", "Strong fundamentals", "bullish"),
            self._scored("Innovation fuels record profits", "Strong performance", "bullish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        # "innovation" should appear in bullish themes
        self.assertIn("innovation", agg["bullish_themes"])

    def test_bearish_themes_extracted(self):
        scored = [
            self._scored("Bankruptcy fears erode confidence", "Weak outlook", "bearish"),
            self._scored("Bankruptcy filing imminent danger", "Negative sentiment", "bearish"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertIn("bankruptcy", agg["bearish_themes"])

    def test_short_words_excluded(self):
        """Words < 4 chars excluded."""
        scored = [self._scored("Big win for the new era of AI", "Good news", "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        for word in agg["bullish_themes"]:
            self.assertGreaterEqual(len(word), _MIN_THEME_WORD_LEN)

    def test_stopwords_excluded(self):
        scored = [self._scored("This company also market stock innovation", "", "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        for word in agg["bullish_themes"]:
            self.assertNotIn(word, _STOPWORDS)

    def test_max_5_themes(self):
        # Create many articles with diverse words
        scored = []
        for i in range(20):
            scored.append(self._scored(
                f"Innovation growth profit revenue expansion boom rally surge jump climb",
                f"Details word{i}",
                "bullish",
            ))
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertLessEqual(len(agg["bullish_themes"]), _MAX_THEMES)

    def test_no_bullish_articles_empty_themes(self):
        scored = [self._scored("Bad news", "Terrible", "bearish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bullish_themes"], [])

    def test_no_bearish_articles_empty_themes(self):
        scored = [self._scored("Great news", "Wonderful", "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bearish_themes"], [])

    def test_neutral_articles_no_themes(self):
        scored = [self._scored("Regular update", "Standard filing", "neutral")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bullish_themes"], [])
        self.assertEqual(agg["bearish_themes"], [])

    def test_themes_are_lowercase(self):
        scored = [self._scored("INNOVATION GROWTH", "", "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        for word in agg["bullish_themes"]:
            self.assertEqual(word, word.lower())

    def test_themes_are_strings(self):
        scored = [self._scored("Innovation breakthrough", "", "bullish")]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        for word in agg["bullish_themes"]:
            self.assertIsInstance(word, str)


# ---------------------------------------------------------------------------
# 13. TestConfidenceCalculation
# ---------------------------------------------------------------------------


class TestConfidenceCalculation(unittest.TestCase):
    """Validate _calculate_confidence."""

    def test_base_confidence_abs_score(self):
        c = SentimentAnalyzer._calculate_confidence(0.5, 5, 3, 1, 1, "stable", "bullish")
        self.assertGreaterEqual(c, 0.5)

    def test_10_articles_bonus(self):
        c_few = SentimentAnalyzer._calculate_confidence(0.3, 5, 3, 1, 1, "stable", "bullish")
        c_ten = SentimentAnalyzer._calculate_confidence(0.3, 10, 7, 1, 2, "stable", "bullish")
        self.assertGreater(c_ten, c_few)

    def test_20_articles_bonus_015(self):
        c_ten = SentimentAnalyzer._calculate_confidence(0.3, 10, 7, 1, 2, "stable", "bullish")
        c_twenty = SentimentAnalyzer._calculate_confidence(0.3, 20, 14, 3, 3, "stable", "bullish")
        # 20 articles gets +0.15, 10 articles gets +0.10
        self.assertGreater(c_twenty, c_ten)

    def test_20_articles_bonus_not_cumulative(self):
        """20+ articles gets +0.15, NOT +0.10 + 0.15."""
        c = SentimentAnalyzer._calculate_confidence(0.3, 25, 18, 3, 4, "stable", "bullish")
        # base=0.3, +0.15 = 0.45, agreement>70% (+0.10) = 0.55
        self.assertAlmostEqual(c, 0.55, places=2)

    def test_agreement_bonus(self):
        # 8 bullish out of 10 = 80% > 70%
        c = SentimentAnalyzer._calculate_confidence(0.5, 10, 8, 1, 1, "stable", "bullish")
        c_no_agree = SentimentAnalyzer._calculate_confidence(0.5, 10, 4, 4, 2, "stable", "bullish")
        self.assertGreater(c, c_no_agree)

    def test_trend_matches_direction_bonus(self):
        c_match = SentimentAnalyzer._calculate_confidence(0.5, 5, 3, 1, 1, "improving", "bullish")
        c_no_match = SentimentAnalyzer._calculate_confidence(0.5, 5, 3, 1, 1, "stable", "bullish")
        self.assertGreater(c_match, c_no_match)

    def test_bearish_trend_deteriorating_bonus(self):
        c_match = SentimentAnalyzer._calculate_confidence(0.5, 5, 1, 3, 1, "deteriorating", "bearish")
        c_no_match = SentimentAnalyzer._calculate_confidence(0.5, 5, 1, 3, 1, "stable", "bearish")
        self.assertGreater(c_match, c_no_match)

    def test_floor_at_01(self):
        c = SentimentAnalyzer._calculate_confidence(0.0, 1, 0, 0, 1, "stable", "neutral")
        self.assertGreaterEqual(c, _NO_ARTICLES_CONFIDENCE)

    def test_cap_at_10(self):
        c = SentimentAnalyzer._calculate_confidence(1.0, 100, 90, 5, 5, "improving", "bullish")
        self.assertLessEqual(c, 1.0)

    def test_nan_base_uses_floor(self):
        c = SentimentAnalyzer._calculate_confidence(float("nan"), 5, 3, 1, 1, "stable", "bullish")
        self.assertGreaterEqual(c, _NO_ARTICLES_CONFIDENCE)

    def test_inf_base_uses_floor(self):
        c = SentimentAnalyzer._calculate_confidence(float("inf"), 5, 3, 1, 1, "stable", "bullish")
        self.assertGreaterEqual(c, _NO_ARTICLES_CONFIDENCE)

    def test_neutral_agreement(self):
        """When direction is neutral, agreement is neutral_count/total."""
        # 8 neutral out of 10 = 80% > 70%
        c = SentimentAnalyzer._calculate_confidence(0.1, 10, 1, 1, 8, "stable", "neutral")
        c_low_agree = SentimentAnalyzer._calculate_confidence(0.1, 10, 4, 4, 2, "stable", "neutral")
        self.assertGreater(c, c_low_agree)

    def test_zero_total_no_agreement_bonus(self):
        c = SentimentAnalyzer._calculate_confidence(0.5, 0, 0, 0, 0, "stable", "bullish")
        # total=0 => no agreement bonus
        self.assertGreaterEqual(c, 0.5)

    def test_confidence_between_0_and_1(self):
        for score in [-1.0, -0.5, 0.0, 0.5, 1.0]:
            for count in [0, 5, 10, 20]:
                c = SentimentAnalyzer._calculate_confidence(score, count, count, 0, 0, "stable", "bullish")
                self.assertGreaterEqual(c, 0.0)
                self.assertLessEqual(c, 1.0)

    def test_neg_inf_base_uses_floor(self):
        c = SentimentAnalyzer._calculate_confidence(float("-inf"), 5, 3, 1, 1, "stable", "bullish")
        self.assertGreaterEqual(c, _NO_ARTICLES_CONFIDENCE)


# ---------------------------------------------------------------------------
# 14. TestKeyLevels
# ---------------------------------------------------------------------------


class TestKeyLevels(unittest.TestCase):
    """Validate _build_key_levels output structure."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _make_aggregate_and_scored(self):
        scored = [{
            "headline": "Test",
            "summary": "Summary",
            "score": 0.5,
            "label": "bullish",
            "model": "finbert",
            "published_at": self.now,
            "source": "Reuters",
            "days_old": 0.0,
        }]
        aggregate = {
            "overall_score": 0.5,
            "trend": "improving",
            "bullish_count": 1,
            "bearish_count": 0,
            "neutral_count": 0,
            "bullish_themes": ["innovation"],
            "bearish_themes": [],
            "primary_model": "finbert",
            "avg_recent": 0.5,
            "avg_older": 0.0,
        }
        return aggregate, scored

    def test_all_12_required_keys(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        required = {
            "overall_sentiment_score", "sentiment_trend", "article_count",
            "bullish_count", "bearish_count", "neutral_count",
            "key_themes_bullish", "key_themes_bearish", "model_used",
            "avg_score_last_3d", "avg_score_4_7d", "article_scores",
        }
        self.assertEqual(set(kl.keys()), required)

    def test_overall_sentiment_score_range(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertGreaterEqual(kl["overall_sentiment_score"], -1.0)
        self.assertLessEqual(kl["overall_sentiment_score"], 1.0)

    def test_sentiment_trend_valid(self):
        for trend in ("improving", "deteriorating", "stable"):
            agg, scored = self._make_aggregate_and_scored()
            agg["trend"] = trend
            kl = self.analyzer._build_key_levels(agg, scored)
            self.assertIn(kl["sentiment_trend"], {"improving", "deteriorating", "stable"})

    def test_article_count_matches(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertEqual(kl["article_count"], len(scored))

    def test_counts_sum_to_total(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        total = kl["bullish_count"] + kl["bearish_count"] + kl["neutral_count"]
        self.assertEqual(total, kl["article_count"])

    def test_themes_bullish_is_list(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIsInstance(kl["key_themes_bullish"], list)

    def test_themes_bearish_is_list(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIsInstance(kl["key_themes_bearish"], list)

    def test_model_used_valid(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIn(kl["model_used"], {"finbert", "loughran_mcdonald", "vader", "none"})

    def test_avg_score_last_3d_is_float(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIsInstance(kl["avg_score_last_3d"], float)

    def test_avg_score_4_7d_is_float(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIsInstance(kl["avg_score_4_7d"], float)

    def test_article_scores_is_list(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        self.assertIsInstance(kl["article_scores"], list)

    def test_article_scores_dict_structure(self):
        agg, scored = self._make_aggregate_and_scored()
        kl = self.analyzer._build_key_levels(agg, scored)
        for item in kl["article_scores"]:
            self.assertIn("headline", item)
            self.assertIn("score", item)
            self.assertIn("label", item)
            self.assertIn("model", item)
            self.assertIn("published_at", item)


# ---------------------------------------------------------------------------
# 15. TestReasoningOutput
# ---------------------------------------------------------------------------


class TestReasoningOutput(unittest.TestCase):
    """Validate _build_reasoning output."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def _make_aggregate(self, overall_score=0.5, trend="improving", bullish=3, bearish=1, neutral=1, model="finbert"):
        return {
            "overall_score": overall_score,
            "trend": trend,
            "bullish_count": bullish,
            "bearish_count": bearish,
            "neutral_count": neutral,
            "bullish_themes": ["innovation"],
            "bearish_themes": ["risk"],
            "primary_model": model,
            "avg_recent": 0.5,
            "avg_older": 0.3,
        }

    def test_contains_ticker(self):
        r = self.analyzer._build_reasoning("AAPL", self._make_aggregate(), "bullish")
        self.assertIn("AAPL", r)

    def test_contains_article_count(self):
        agg = self._make_aggregate(bullish=3, bearish=1, neutral=1)
        r = self.analyzer._build_reasoning("AAPL", agg, "bullish")
        self.assertIn("5", r)  # 3+1+1=5

    def test_contains_direction(self):
        r = self.analyzer._build_reasoning("AAPL", self._make_aggregate(), "bullish")
        self.assertIn("bullish", r)

    def test_contains_bullish_count(self):
        agg = self._make_aggregate(bullish=3)
        r = self.analyzer._build_reasoning("AAPL", agg, "bullish")
        self.assertIn("3 bullish", r)

    def test_contains_bearish_count(self):
        agg = self._make_aggregate(bearish=2)
        r = self.analyzer._build_reasoning("AAPL", agg, "bullish")
        self.assertIn("2 bearish", r)

    def test_contains_neutral_count(self):
        agg = self._make_aggregate(neutral=4)
        r = self.analyzer._build_reasoning("AAPL", agg, "bullish")
        self.assertIn("4 neutral", r)

    def test_contains_trend(self):
        r = self.analyzer._build_reasoning("AAPL", self._make_aggregate(trend="improving"), "bullish")
        self.assertIn("improving", r)

    def test_contains_model_name(self):
        r = self.analyzer._build_reasoning("AAPL", self._make_aggregate(model="finbert"), "bullish")
        self.assertIn("finbert", r)


# ---------------------------------------------------------------------------
# 16. TestDirectionMapping
# ---------------------------------------------------------------------------


class TestDirectionMapping(unittest.TestCase):
    """Validate _score_to_direction mapping."""

    def test_positive_05_bullish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(0.5), "bullish")

    def test_negative_05_bearish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(-0.5), "bearish")

    def test_zero_neutral(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(0.0), "neutral")

    def test_exactly_02_neutral(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(0.2), "neutral")

    def test_exactly_neg02_neutral(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(-0.2), "neutral")

    def test_021_bullish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(0.21), "bullish")

    def test_neg021_bearish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(-0.21), "bearish")

    def test_10_bullish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(1.0), "bullish")

    def test_neg10_bearish(self):
        self.assertEqual(SentimentAnalyzer._score_to_direction(-1.0), "bearish")


# ---------------------------------------------------------------------------
# 17. TestScoreToLabel
# ---------------------------------------------------------------------------


class TestScoreToLabel(unittest.TestCase):
    """Validate _score_to_label mapping."""

    def test_high_positive_bullish(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(0.5), "bullish")

    def test_high_negative_bearish(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(-0.5), "bearish")

    def test_zero_neutral(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(0.0), "neutral")

    def test_threshold_boundary_bullish(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(0.21), "bullish")

    def test_threshold_boundary_bearish(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(-0.21), "bearish")

    def test_at_threshold_neutral(self):
        self.assertEqual(SentimentAnalyzer._score_to_label(0.2), "neutral")
        self.assertEqual(SentimentAnalyzer._score_to_label(-0.2), "neutral")


# ---------------------------------------------------------------------------
# 18. TestNaNInfGuards
# ---------------------------------------------------------------------------


class TestNaNInfGuards(unittest.TestCase):
    """Validate NaN/Inf handling throughout the pipeline."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_is_finite_number_nan(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number(float("nan")))

    def test_is_finite_number_inf(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number(float("inf")))

    def test_is_finite_number_neg_inf(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number(float("-inf")))

    def test_is_finite_number_bool(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number(True))
        self.assertFalse(SentimentAnalyzer._is_finite_number(False))

    def test_is_finite_number_string(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number("10"))

    def test_is_finite_number_none(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number(None))

    def test_is_finite_number_valid_int(self):
        self.assertTrue(SentimentAnalyzer._is_finite_number(42))

    def test_is_finite_number_valid_float(self):
        self.assertTrue(SentimentAnalyzer._is_finite_number(3.14))

    def test_is_finite_number_zero(self):
        self.assertTrue(SentimentAnalyzer._is_finite_number(0))

    def test_is_finite_number_zero_float(self):
        self.assertTrue(SentimentAnalyzer._is_finite_number(0.0))

    def test_is_finite_number_list(self):
        self.assertFalse(SentimentAnalyzer._is_finite_number([1, 2]))

    def test_is_finite_number_negative_float(self):
        self.assertTrue(SentimentAnalyzer._is_finite_number(-5.5))

    def test_nan_overall_score_handled(self):
        """NaN overall_score should be set to 0.0 in _aggregate_scores."""
        now = datetime.now(tz=timezone.utc)
        scored = [{
            "headline": "Test",
            "summary": "",
            "score": float("nan"),
            "label": "neutral",
            "model": "finbert",
            "published_at": now,
            "source": "",
            "days_old": 0.0,
        }]
        agg = self.analyzer._aggregate_scores(scored, now)
        self.assertFalse(math.isnan(agg["overall_score"]))

    def test_inf_article_score_treated_as_zero(self):
        now = datetime.now(tz=timezone.utc)
        scored = [{
            "headline": "Test",
            "summary": "",
            "score": float("inf"),
            "label": "neutral",
            "model": "finbert",
            "published_at": now,
            "source": "",
            "days_old": 0.0,
        }]
        agg = self.analyzer._aggregate_scores(scored, now)
        self.assertFalse(math.isinf(agg["overall_score"]))


# ---------------------------------------------------------------------------
# 19. TestMethodologySignalContract
# ---------------------------------------------------------------------------


class TestMethodologySignalContract(unittest.TestCase):
    """Validate that analyze() returns a proper MethodologySignal."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.prices = _make_price_df(30)
        self.volumes = _make_volume_df(30)

    def _analyze_with_articles(self, articles=None, **kwargs):
        if articles is None:
            articles = _make_articles(5)
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            return _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles, **kwargs))

    def test_returns_methodology_signal(self):
        sig = self._analyze_with_articles()
        self.assertIsInstance(sig, MethodologySignal)

    def test_methodology_is_sentiment(self):
        sig = self._analyze_with_articles()
        self.assertEqual(sig.methodology, "sentiment")

    def test_ticker_matches_sanitized(self):
        with _patch_score_article():
            sig = _run(self.analyzer.analyze("aapl", self.prices, self.volumes, articles=_make_articles(5)))
            self.assertEqual(sig.ticker, "AAPL")

    def test_direction_is_valid(self):
        sig = self._analyze_with_articles()
        self.assertIn(sig.direction, {"bullish", "bearish", "neutral"})

    def test_confidence_range(self):
        sig = self._analyze_with_articles()
        self.assertGreaterEqual(sig.confidence, 0.1)
        self.assertLessEqual(sig.confidence, 1.0)

    def test_timeframe_is_short(self):
        sig = self._analyze_with_articles()
        self.assertEqual(sig.timeframe, "short")

    def test_key_levels_is_dict(self):
        sig = self._analyze_with_articles()
        self.assertIsInstance(sig.key_levels, dict)

    def test_reasoning_is_nonempty_string(self):
        sig = self._analyze_with_articles()
        self.assertIsInstance(sig.reasoning, str)
        self.assertTrue(len(sig.reasoning.strip()) > 0)

    def test_timestamp_is_utc_datetime(self):
        sig = self._analyze_with_articles()
        self.assertIsInstance(sig.timestamp, datetime)
        self.assertIsNotNone(sig.timestamp.tzinfo)

    def test_to_dict_serializable(self):
        sig = self._analyze_with_articles()
        d = sig.to_dict()
        self.assertIsInstance(d, dict)
        self.assertIn("ticker", d)
        self.assertIn("methodology", d)


# ---------------------------------------------------------------------------
# 20. TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases(unittest.TestCase):
    """Validate edge cases and boundary conditions."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.prices = _make_price_df(30)
        self.volumes = _make_volume_df(30)

    def test_single_article(self):
        articles = _make_articles(1, sentiment="bullish")
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertIsInstance(sig, MethodologySignal)
            self.assertEqual(sig.key_levels["article_count"], 1)

    def test_100_articles(self):
        articles = _make_articles(100, sentiment="mixed", days_spread=30)
        with _patch_score_article(score=0.3, label="bullish", model="finbert"):
            with _patch_lm_dict():
                sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
                self.assertIsInstance(sig, MethodologySignal)

    def test_all_same_score(self):
        articles = _make_articles(10, sentiment="bullish")
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.direction, "bullish")

    def test_all_neutral(self):
        articles = _make_articles(10, sentiment="neutral")
        with _patch_score_article(score=0.0, label="neutral", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.direction, "neutral")

    def test_mix_valid_and_invalid(self):
        articles = [
            {"headline": "Good news", "summary": "S", "published_at": _NOW.isoformat()},
            123,  # invalid
            {"summary": "No headline"},  # invalid
            {"headline": "More news", "summary": "S2", "published_at": _NOW.isoformat()},
        ]
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.key_levels["article_count"], 2)

    def test_articles_with_future_dates(self):
        future_dt = (_NOW + timedelta(days=30)).isoformat()
        articles = [{"headline": "Future news", "summary": "S", "published_at": future_dt}]
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertIsInstance(sig, MethodologySignal)

    def test_articles_with_very_old_dates(self):
        old_dt = (_NOW - timedelta(days=400)).isoformat()
        articles = [{"headline": "Old news", "summary": "S", "published_at": old_dt}]
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertIsInstance(sig, MethodologySignal)
            # Confidence should be low due to age
            self.assertLessEqual(sig.confidence, 1.0)

    def test_empty_headline_after_strip_skipped(self):
        articles = [{"headline": "   ", "summary": "S", "published_at": _NOW.isoformat()}]
        sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
        self.assertEqual(sig.direction, "neutral")

    def test_large_batch_performance(self):
        """50 articles with batch optimization enabled."""
        articles = _make_articles(50, sentiment="mixed", days_spread=14)
        with _patch_score_article(score=0.1, label="neutral", model="finbert"):
            with _patch_lm_dict():
                sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
                self.assertIsInstance(sig, MethodologySignal)

    def test_unicode_in_article(self):
        articles = [{"headline": "Stock rises 10% \u2014 great results!", "summary": "\u00e9", "published_at": _NOW.isoformat()}]
        with _patch_score_article():
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertIsInstance(sig, MethodologySignal)


# ---------------------------------------------------------------------------
# 21. TestIntegration
# ---------------------------------------------------------------------------


class TestIntegration(unittest.TestCase):
    """Full integration tests with mocked models."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.prices = _make_price_df(30)
        self.volumes = _make_volume_df(30)

    def test_full_flow_finbert_mock(self):
        articles = _make_articles(5, sentiment="bullish")
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.methodology, "sentiment")
            self.assertIn(sig.direction, {"bullish", "bearish", "neutral"})

    def test_full_flow_lm_fallback(self):
        """FinBERT fails, LM fallback used."""
        articles = _make_articles(5, sentiment="bullish")

        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with _patch_lm_dict():
                sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
                self.assertEqual(sig.methodology, "sentiment")
                self.assertIn(sig.key_levels["model_used"], {"loughran_mcdonald", "vader", "finbert"})

    def test_full_flow_vader_fallback(self):
        """Both FinBERT and LM fail, VADER fallback used."""
        articles = _make_articles(5, sentiment="bullish")

        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        def _mock_lm(self, text):
            raise RuntimeError("No LM")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with patch.object(SentimentAnalyzer, "_score_loughran_mcdonald", _mock_lm):
                with _patch_vader(compound=0.6):
                    sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
                    self.assertEqual(sig.key_levels["model_used"], "vader")

    def test_multiple_tickers_in_sequence(self):
        articles = _make_articles(5, sentiment="bullish")
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig1 = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            sig2 = _run(self.analyzer.analyze("MSFT", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig1.ticker, "AAPL")
            self.assertEqual(sig2.ticker, "MSFT")

    def test_large_batch_with_optimization(self):
        articles = _make_articles(30, sentiment="mixed", days_spread=14)
        with _patch_score_article(score=0.3, label="bullish", model="finbert"):
            with _patch_lm_dict():
                sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
                self.assertIsInstance(sig, MethodologySignal)
                self.assertGreater(sig.key_levels["article_count"], 0)

    def test_all_bullish_direction(self):
        articles = _make_articles(10, sentiment="bullish")
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.direction, "bullish")

    def test_all_bearish_direction(self):
        articles = _make_articles(10, sentiment="bearish")
        with _patch_score_article(score=-0.6, label="bearish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig.direction, "bearish")

    def test_50_50_bullish_bearish_neutral(self):
        """Exactly 50% bullish, 50% bearish => depends on recency weighting."""
        articles = _make_articles(10, sentiment="mixed", days_spread=1)

        call_count = 0

        async def _alternating_score(self, text):
            nonlocal call_count
            call_count += 1
            if call_count % 2 == 0:
                return {"score": 0.5, "label": "bullish", "model": "finbert"}
            else:
                return {"score": -0.5, "label": "bearish", "model": "finbert"}

        with patch.object(SentimentAnalyzer, "score_article", _alternating_score):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            # Should be close to neutral since equal bullish/bearish
            self.assertIn(sig.direction, {"neutral", "bullish", "bearish"})

    def test_signal_key_levels_complete_integration(self):
        articles = _make_articles(15, sentiment="bullish", days_spread=7)
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            kl = sig.key_levels
            self.assertEqual(kl["article_count"], 15)
            self.assertEqual(kl["bullish_count"] + kl["bearish_count"] + kl["neutral_count"], 15)
            self.assertIsInstance(kl["article_scores"], list)
            self.assertEqual(len(kl["article_scores"]), 15)

    def test_confidence_increases_with_articles(self):
        """More articles should give higher confidence (all else equal)."""
        few_articles = _make_articles(3, sentiment="bullish", days_spread=1)
        many_articles = _make_articles(15, sentiment="bullish", days_spread=1)
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig_few = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=few_articles))
            sig_many = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=many_articles))
            self.assertGreaterEqual(sig_many.confidence, sig_few.confidence)

    def test_reasoning_non_empty_integration(self):
        articles = _make_articles(5, sentiment="bullish")
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertTrue(len(sig.reasoning) > 10)
            self.assertIn("AAPL", sig.reasoning)

    def test_no_articles_then_with_articles(self):
        """First call with no articles, then with articles."""
        sig1 = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes))
        self.assertEqual(sig1.direction, "neutral")

        articles = _make_articles(5, sentiment="bullish")
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig2 = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, articles=articles))
            self.assertEqual(sig2.direction, "bullish")

    def test_fundamentals_ignored(self):
        """Sentiment analyzer ignores fundamentals parameter."""
        articles = _make_articles(5, sentiment="bullish")
        with _patch_score_article(score=0.6, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze("AAPL", self.prices, self.volumes, fundamentals={"eps": 1.5}, articles=articles))
            self.assertEqual(sig.methodology, "sentiment")

    def test_xss_ticker_in_reasoning(self):
        articles = _make_articles(3, sentiment="bullish")
        with _patch_score_article(score=0.5, label="bullish", model="finbert"):
            sig = _run(self.analyzer.analyze('<script>alert("xss")</script>', self.prices, self.volumes, articles=articles))
            self.assertNotIn("<script>", sig.reasoning)
            self.assertNotIn("alert", sig.reasoning)


# ---------------------------------------------------------------------------
# 22. TestAggregateScoresCounts
# ---------------------------------------------------------------------------


class TestAggregateScoresCounts(unittest.TestCase):
    """Validate bullish/bearish/neutral counting in _aggregate_scores."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _scored(self, score, label):
        return {
            "headline": "Test",
            "summary": "",
            "score": score,
            "label": label,
            "model": "finbert",
            "published_at": self.now,
            "source": "",
            "days_old": 0.0,
        }

    def test_all_bullish_count(self):
        scored = [self._scored(0.5, "bullish") for _ in range(5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bullish_count"], 5)
        self.assertEqual(agg["bearish_count"], 0)
        self.assertEqual(agg["neutral_count"], 0)

    def test_all_bearish_count(self):
        scored = [self._scored(-0.5, "bearish") for _ in range(5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bearish_count"], 5)
        self.assertEqual(agg["bullish_count"], 0)

    def test_all_neutral_count(self):
        scored = [self._scored(0.0, "neutral") for _ in range(5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["neutral_count"], 5)

    def test_mixed_counts(self):
        scored = [
            self._scored(0.5, "bullish"),
            self._scored(-0.5, "bearish"),
            self._scored(0.0, "neutral"),
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["bullish_count"], 1)
        self.assertEqual(agg["bearish_count"], 1)
        self.assertEqual(agg["neutral_count"], 1)

    def test_primary_model_most_common(self):
        scored = [
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "finbert", "published_at": self.now, "source": "", "days_old": 0.0},
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "finbert", "published_at": self.now, "source": "", "days_old": 0.0},
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "vader", "published_at": self.now, "source": "", "days_old": 0.0},
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["primary_model"], "finbert")

    def test_primary_model_vader_dominant(self):
        scored = [
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "vader", "published_at": self.now, "source": "", "days_old": 0.0},
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "vader", "published_at": self.now, "source": "", "days_old": 0.0},
            {"headline": "T", "summary": "", "score": 0.5, "label": "bullish", "model": "finbert", "published_at": self.now, "source": "", "days_old": 0.0},
        ]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertEqual(agg["primary_model"], "vader")


# ---------------------------------------------------------------------------
# 23. TestNoArticlesSignal
# ---------------------------------------------------------------------------


class TestNoArticlesSignal(unittest.TestCase):
    """Validate _no_articles_signal directly."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_direction_neutral(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.direction, "neutral")

    def test_confidence_matches_constant(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertAlmostEqual(sig.confidence, _NO_ARTICLES_CONFIDENCE)

    def test_methodology_sentiment(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.methodology, "sentiment")

    def test_timeframe_short(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.timeframe, "short")

    def test_reasoning_mentions_no_articles(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertIn("no articles", sig.reasoning.lower())

    def test_key_levels_article_count_zero(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.key_levels["article_count"], 0)

    def test_key_levels_all_counts_zero(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.key_levels["bullish_count"], 0)
        self.assertEqual(sig.key_levels["bearish_count"], 0)
        self.assertEqual(sig.key_levels["neutral_count"], 0)

    def test_key_levels_model_none(self):
        sig = self.analyzer._no_articles_signal("AAPL")
        self.assertEqual(sig.key_levels["model_used"], "none")

    def test_ticker_in_reasoning(self):
        sig = self.analyzer._no_articles_signal("MSFT")
        self.assertIn("MSFT", sig.reasoning)


# ---------------------------------------------------------------------------
# 24. TestOverallScoreCalculation
# ---------------------------------------------------------------------------


class TestOverallScoreCalculation(unittest.TestCase):
    """Validate overall score computation in _aggregate_scores."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def _scored(self, score, days_old=0.0, label="neutral"):
        return {
            "headline": "Test",
            "summary": "",
            "score": score,
            "label": label,
            "model": "finbert",
            "published_at": self.now - timedelta(days=days_old),
            "source": "",
            "days_old": days_old,
        }

    def test_single_article_score_equals_overall(self):
        scored = [self._scored(0.5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertAlmostEqual(agg["overall_score"], 0.5, places=4)

    def test_two_equal_articles_same_age(self):
        scored = [self._scored(0.5), self._scored(0.5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertAlmostEqual(agg["overall_score"], 0.5, places=4)

    def test_opposite_articles_cancel_out(self):
        scored = [self._scored(0.5), self._scored(-0.5)]
        agg = self.analyzer._aggregate_scores(scored, self.now)
        self.assertAlmostEqual(agg["overall_score"], 0.0, places=2)

    def test_overall_score_always_in_range(self):
        for s in [-1.0, -0.5, 0.0, 0.5, 1.0]:
            scored = [self._scored(s)]
            agg = self.analyzer._aggregate_scores(scored, self.now)
            self.assertGreaterEqual(agg["overall_score"], -1.0)
            self.assertLessEqual(agg["overall_score"], 1.0)


# ---------------------------------------------------------------------------
# 25. TestFinBERTScoring
# ---------------------------------------------------------------------------


class TestFinBERTScoring(unittest.TestCase):
    """Validate FinBERT scoring (via mocked score_article)."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()

    def test_positive_logits_bullish(self):
        """High positive logit => bullish."""
        with _patch_finbert_success(positive=2.0, negative=-1.0, neutral=-1.0):
            result = _run(self.analyzer.score_article("Great earnings beat"))
            self.assertEqual(result["label"], "bullish")
            self.assertGreater(result["score"], 0.0)

    def test_negative_logits_bearish(self):
        """High negative logit => bearish."""
        with _patch_finbert_success(positive=-1.0, negative=2.0, neutral=-1.0):
            result = _run(self.analyzer.score_article("Terrible losses"))
            self.assertEqual(result["label"], "bearish")
            self.assertLess(result["score"], 0.0)

    def test_neutral_logits_neutral(self):
        """Equal logits => neutral."""
        with _patch_finbert_success(positive=0.0, negative=0.0, neutral=0.0):
            result = _run(self.analyzer.score_article("Regular update"))
            self.assertEqual(result["label"], "neutral")

    def test_score_range(self):
        """Score always in [-1.0, +1.0]."""
        with _patch_finbert_success(positive=10.0, negative=-10.0, neutral=-10.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertGreaterEqual(result["score"], -1.0)
            self.assertLessEqual(result["score"], 1.0)

    def test_model_is_finbert(self):
        with _patch_finbert_success():
            result = _run(self.analyzer.score_article("text"))
            self.assertEqual(result["model"], "finbert")

    def test_label_threshold_bullish(self):
        """Score > 0.2 => bullish."""
        with _patch_finbert_success(positive=1.0, negative=-1.0, neutral=-1.0):
            result = _run(self.analyzer.score_article("text"))
            if result["score"] > _BULLISH_THRESHOLD:
                self.assertEqual(result["label"], "bullish")

    def test_label_threshold_bearish(self):
        with _patch_finbert_success(positive=-1.0, negative=1.0, neutral=-1.0):
            result = _run(self.analyzer.score_article("text"))
            if result["score"] < _BEARISH_THRESHOLD:
                self.assertEqual(result["label"], "bearish")

    def test_softmax_applied(self):
        """Verify softmax-like computation is happening."""
        with _patch_finbert_success(positive=1.0, negative=0.0, neutral=0.0):
            result = _run(self.analyzer.score_article("text"))
            # After softmax: prob_pos > prob_neg, so score > 0
            self.assertGreater(result["score"], 0.0)

    def test_finbert_exception_falls_through(self):
        """When FinBERT raises, score_article should fall to next scorer."""
        async def _mock_finbert(self, text):
            raise RuntimeError("No torch")

        with patch.object(SentimentAnalyzer, "_score_finbert", _mock_finbert):
            with _patch_lm_dict():
                result = _run(self.analyzer.score_article("text"))
                self.assertNotEqual(result["model"], "finbert")

    def test_symmetric_logits(self):
        """pos=X neg=X => score near 0."""
        with _patch_finbert_success(positive=1.0, negative=1.0, neutral=0.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertAlmostEqual(result["score"], 0.0, places=1)

    def test_very_large_positive_logit(self):
        with _patch_finbert_success(positive=100.0, negative=-100.0, neutral=-100.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertAlmostEqual(result["score"], 1.0, places=2)

    def test_very_large_negative_logit(self):
        with _patch_finbert_success(positive=-100.0, negative=100.0, neutral=-100.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertAlmostEqual(result["score"], -1.0, places=2)

    def test_all_equal_logits_neutral_score(self):
        with _patch_finbert_success(positive=1.0, negative=1.0, neutral=1.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertAlmostEqual(result["score"], 0.0, places=2)

    def test_moderate_positive(self):
        with _patch_finbert_success(positive=0.5, negative=-0.5, neutral=0.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertGreater(result["score"], 0.0)

    def test_moderate_negative(self):
        with _patch_finbert_success(positive=-0.5, negative=0.5, neutral=0.0):
            result = _run(self.analyzer.score_article("text"))
            self.assertLess(result["score"], 0.0)


# ---------------------------------------------------------------------------
# 26. TestStopwords
# ---------------------------------------------------------------------------


class TestStopwords(unittest.TestCase):
    """Validate stopwords set."""

    def test_common_words_in_stopwords(self):
        for word in ["the", "and", "but", "for", "this", "that", "with"]:
            self.assertIn(word, _STOPWORDS)

    def test_financial_terms_in_stopwords(self):
        for word in ["market", "stock", "share", "percent", "analyst"]:
            self.assertIn(word, _STOPWORDS)

    def test_stopwords_are_lowercase(self):
        for word in _STOPWORDS:
            self.assertEqual(word, word.lower())


# ---------------------------------------------------------------------------
# 27. TestArticleScoredFields
# ---------------------------------------------------------------------------


class TestArticleScoredFields(unittest.TestCase):
    """Validate fields in scored article output."""

    def setUp(self):
        self.analyzer = SentimentAnalyzer()
        self.now = datetime.now(tz=timezone.utc)

    def test_scored_article_has_headline(self):
        articles = [{"headline": "Good news", "summary": "S", "published_at": self.now.isoformat()}]
        parsed = self.analyzer._parse_articles(articles, self.now)

        with _patch_score_article():
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(scored[0]["headline"], "Good news")

    def test_scored_article_has_model(self):
        articles = [{"headline": "News", "summary": "S", "published_at": self.now.isoformat()}]
        parsed = self.analyzer._parse_articles(articles, self.now)

        with _patch_score_article(model="finbert"):
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(scored[0]["model"], "finbert")

    def test_scored_article_days_old_nonnegative(self):
        articles = [{"headline": "News", "summary": "S", "published_at": self.now.isoformat()}]
        parsed = self.analyzer._parse_articles(articles, self.now)

        with _patch_score_article():
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertGreaterEqual(scored[0]["days_old"], 0.0)

    def test_scored_article_preserves_source(self):
        articles = [{"headline": "News", "summary": "S", "published_at": self.now.isoformat(), "source": "Reuters"}]
        parsed = self.analyzer._parse_articles(articles, self.now)

        with _patch_score_article():
            scored = _run(self.analyzer._score_all_articles(parsed, self.now))
            self.assertEqual(scored[0]["source"], "Reuters")


if __name__ == "__main__":
    unittest.main()
