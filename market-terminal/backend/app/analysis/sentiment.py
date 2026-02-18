"""Sentiment analysis pipeline for the analysis engine.

Scores financial news articles using a three-tier fallback chain:
FinBERT (primary) -> Loughran-McDonald dictionary (secondary) -> VADER (tertiary).
Returns a MethodologySignal with sentiment score, trend, and key themes.

Full implementation: TASK-ANALYSIS-007
"""

from __future__ import annotations

import asyncio
import json
import math
import re
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.analysis.base import BaseMethodology, Direction, MethodologySignal

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

_EPSILON: float = 1e-10
_BULLISH_THRESHOLD: float = 0.2
_BEARISH_THRESHOLD: float = -0.2
_RECENCY_HALF_LIFE_DAYS: float = 7.0
_MIN_RECENCY_WEIGHT: float = 0.01
_TREND_THRESHOLD: float = 0.1
_BATCH_THRESHOLD: int = 20
_BATCH_OLD_ARTICLE_DAYS: int = 7
_MAX_THEMES: int = 5
_MIN_THEME_WORD_LEN: int = 4
_MAX_TICKER_LEN: int = 10
_FINBERT_MAX_TOKENS: int = 512
_NO_ARTICLES_CONFIDENCE: float = 0.1

# ---------------------------------------------------------------------------
# Stopwords (common English, ~150 words)
# ---------------------------------------------------------------------------

_STOPWORDS: set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "also", "am",
    "an", "and", "any", "are", "aren", "arent", "as", "at", "be", "because",
    "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "cannot", "could", "couldn", "couldnt", "did", "didn", "didnt", "do",
    "does", "doesn", "doesnt", "doing", "don", "dont", "down", "during",
    "each", "even", "every", "few", "for", "from", "further", "get", "gets",
    "getting", "got", "had", "hadn", "hadnt", "has", "hasn", "hasnt", "have",
    "haven", "havent", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "however", "i", "if", "in", "into", "is",
    "isn", "isnt", "it", "its", "itself", "just", "ll", "m", "may", "me",
    "might", "mightn", "more", "most", "much", "must", "mustn", "my",
    "myself", "need", "needn", "no", "nor", "not", "now", "o", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
    "over", "own", "re", "s", "same", "shan", "she", "should", "shouldn",
    "shouldnt", "so", "some", "such", "t", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "upon", "us",
    "ve", "very", "was", "wasn", "wasnt", "we", "were", "weren", "werent",
    "what", "when", "where", "which", "while", "who", "whom", "why", "will",
    "with", "won", "would", "wouldn", "wouldnt", "you", "your", "yours",
    "yourself", "yourselves", "said", "says", "like", "also", "well", "back",
    "still", "many", "made", "make", "take", "took", "come", "came", "went",
    "going", "gone", "been", "being", "does", "done", "will", "would",
    "shall", "should", "could", "might", "must", "year", "years", "company",
    "market", "stock", "share", "shares", "percent", "quarter", "report",
    "reported", "analyst", "analysts", "according", "expected", "million",
    "billion", "trading", "last", "first", "next", "week", "month", "day",
    "today", "yesterday", "new", "news",
}

# ---------------------------------------------------------------------------
# FinBERT singleton (lazy-loaded)
# ---------------------------------------------------------------------------

_finbert_model: Any = None
_finbert_tokenizer: Any = None


def get_finbert() -> tuple[Any, Any]:
    """Lazily load the ProsusAI/finbert model and tokenizer.

    Returns:
        A tuple of (model, tokenizer).  Loads from HuggingFace Hub on first
        call; subsequent calls return the cached instances.
    """
    global _finbert_model, _finbert_tokenizer  # noqa: PLW0603
    if _finbert_model is None:
        from transformers import (  # type: ignore[import-untyped]
            AutoModelForSequenceClassification,
            AutoTokenizer,
        )
        _finbert_tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        _finbert_model = AutoModelForSequenceClassification.from_pretrained(
            "ProsusAI/finbert",
        )
    return _finbert_model, _finbert_tokenizer


# ---------------------------------------------------------------------------
# Loughran-McDonald dictionary (lazy-loaded)
# ---------------------------------------------------------------------------

_lm_dict: dict[str, set[str]] | None = None


def _load_lm_dict() -> dict[str, set[str]]:
    """Load the Loughran-McDonald word lists from the bundled JSON file.

    Returns:
        A dict mapping category names to sets of uppercase words.
    """
    global _lm_dict  # noqa: PLW0603
    if _lm_dict is not None:
        return _lm_dict

    data_path = Path(__file__).resolve().parent / "data" / "loughran_mcdonald.json"
    with open(data_path, "r", encoding="utf-8") as fh:
        raw: dict[str, list[str]] = json.load(fh)

    _lm_dict = {
        category: {w.upper() for w in words}
        for category, words in raw.items()
    }
    return _lm_dict


# ---------------------------------------------------------------------------
# SentimentAnalyzer
# ---------------------------------------------------------------------------


class SentimentAnalyzer(BaseMethodology):
    """Sentiment analysis pipeline for financial news articles.

    Evaluates sentiment across a collection of articles using a three-tier
    model fallback chain (FinBERT -> Loughran-McDonald -> VADER), then
    aggregates results into a recency-weighted composite score with trend
    analysis and theme extraction.
    """

    name: str = "sentiment"
    display_name: str = "Sentiment Analysis"
    default_timeframe: str = "short"
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
        """Run sentiment analysis on supplied articles.

        Articles are passed via ``kwargs["articles"]`` as a list of dicts,
        each containing ``headline``, ``summary``, ``published_at`` (ISO
        string), and ``source``.

        Args:
            ticker: Stock/ETF symbol.
            price_data: DataFrame with columns [date, open, high, low, close].
            volume_data: DataFrame with columns [date, volume].
            fundamentals: Optional fundamental data (unused by sentiment).
            **kwargs: Must contain ``articles`` (list of article dicts).

        Returns:
            A :class:`MethodologySignal` with sentiment results.
        """
        safe_ticker = re.sub(r"[^A-Z0-9.\-]", "", ticker[:_MAX_TICKER_LEN].upper())

        articles: list[dict[str, Any]] = kwargs.get("articles") or []

        if not isinstance(articles, list) or len(articles) == 0:
            return self._no_articles_signal(safe_ticker)

        # Parse and validate articles
        now = datetime.now(tz=timezone.utc)
        parsed = self._parse_articles(articles, now)

        if not parsed:
            return self._no_articles_signal(safe_ticker)

        # Sort by recency (newest first)
        parsed.sort(key=lambda a: a["published_at"], reverse=True)

        # Score all articles
        scored = await self._score_all_articles(parsed, now)

        if not scored:
            return self._no_articles_signal(safe_ticker)

        # Aggregate
        aggregate = self._aggregate_scores(scored, now)

        # Build signal
        direction = self._score_to_direction(aggregate["overall_score"])
        confidence = self._calculate_confidence(
            aggregate["overall_score"],
            len(scored),
            aggregate["bullish_count"],
            aggregate["bearish_count"],
            aggregate["neutral_count"],
            aggregate["trend"],
            direction,
        )

        key_levels = self._build_key_levels(aggregate, scored)
        reasoning = self._build_reasoning(safe_ticker, aggregate, direction)

        return self.create_signal(
            ticker=safe_ticker,
            direction=direction,
            confidence=confidence,
            timeframe=self.default_timeframe,
            reasoning=reasoning,
            key_levels=key_levels,
        )

    # ------------------------------------------------------------------
    # Article parsing
    # ------------------------------------------------------------------

    def _parse_articles(
        self,
        articles: list[dict[str, Any]],
        now: datetime,
    ) -> list[dict[str, Any]]:
        """Parse and validate article dicts, skipping invalid entries.

        Returns a list of validated article dicts with ``published_at``
        converted to a datetime object.
        """
        parsed: list[dict[str, Any]] = []

        for article in articles:
            if not isinstance(article, dict):
                continue

            headline = article.get("headline")
            summary = article.get("summary")

            if not isinstance(headline, str) or not headline.strip():
                continue
            if not isinstance(summary, str):
                summary = ""

            # Parse published_at
            published_at_raw = article.get("published_at")
            pub_dt: datetime
            if isinstance(published_at_raw, str) and published_at_raw.strip():
                try:
                    pub_dt = datetime.fromisoformat(published_at_raw)
                    if pub_dt.tzinfo is None:
                        pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pub_dt = now
            elif isinstance(published_at_raw, datetime):
                pub_dt = published_at_raw
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            else:
                pub_dt = now

            source = article.get("source", "")
            if not isinstance(source, str):
                source = ""

            parsed.append({
                "headline": headline.strip(),
                "summary": summary.strip(),
                "published_at": pub_dt,
                "source": source.strip(),
            })

        return parsed

    # ------------------------------------------------------------------
    # Scoring: FinBERT
    # ------------------------------------------------------------------

    async def _score_finbert(self, text: str) -> tuple[float, str]:
        """Score text using the FinBERT model.

        Runs model inference in an executor to avoid blocking the event loop.

        Returns:
            A tuple of (score, label) where score is in [-1.0, 1.0].
        """
        import torch  # type: ignore[import-untyped]

        model, tokenizer = get_finbert()

        def _infer() -> tuple[float, str]:
            inputs = tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=_FINBERT_MAX_TOKENS,
                padding=True,
            )
            with torch.no_grad():
                outputs = model(**inputs)
            logits = outputs.logits[0]
            probs = torch.softmax(logits, dim=0)
            # FinBERT label order: positive=0, negative=1, neutral=2
            pos_prob = float(probs[0])
            neg_prob = float(probs[1])
            score = pos_prob - neg_prob
            # Guard NaN/Inf
            if math.isnan(score) or math.isinf(score):
                score = 0.0
            score = max(-1.0, min(1.0, score))
            label = self._score_to_label(score)
            return score, label

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _infer)

    # ------------------------------------------------------------------
    # Scoring: Loughran-McDonald
    # ------------------------------------------------------------------

    def _score_loughran_mcdonald(self, text: str) -> tuple[float, str]:
        """Score text using the Loughran-McDonald financial dictionary.

        Returns:
            A tuple of (score, label) where score is in [-1.0, 1.0].
        """
        lm = _load_lm_dict()
        positive_words = lm.get("positive", set())
        negative_words = lm.get("negative", set())

        words = re.findall(r"[A-Za-z]+", text)
        total = len(words)
        if total == 0:
            return 0.0, "neutral"

        upper_words = [w.upper() for w in words]
        pos_count = sum(1 for w in upper_words if w in positive_words)
        neg_count = sum(1 for w in upper_words if w in negative_words)

        score = (pos_count - neg_count) / max(total, 1)

        if math.isnan(score) or math.isinf(score):
            score = 0.0
        score = max(-1.0, min(1.0, score))

        label = self._score_to_label(score)
        return score, label

    # ------------------------------------------------------------------
    # Scoring: VADER
    # ------------------------------------------------------------------

    def _score_vader(self, text: str) -> tuple[float, str]:
        """Score text using VADER sentiment analysis.

        Returns:
            A tuple of (score, label) where score is in [-1.0, 1.0].
        """
        from vaderSentiment.vaderSentiment import (  # type: ignore[import-untyped]
            SentimentIntensityAnalyzer,
        )
        analyzer = SentimentIntensityAnalyzer()
        scores = analyzer.polarity_scores(text)
        compound = scores["compound"]

        if math.isnan(compound) or math.isinf(compound):
            compound = 0.0
        compound = max(-1.0, min(1.0, compound))

        label = self._score_to_label(compound)
        return compound, label

    # ------------------------------------------------------------------
    # Model selection (fallback chain)
    # ------------------------------------------------------------------

    async def score_article(self, text: str) -> dict[str, Any]:
        """Score a single article text using the three-tier fallback chain.

        FinBERT (primary) -> Loughran-McDonald (secondary) -> VADER (tertiary).

        Returns:
            A dict with keys: score, label, model.
        """
        # Primary: FinBERT
        try:
            score, label = await self._score_finbert(text)
            return {"score": score, "label": label, "model": "finbert"}
        except Exception:
            pass

        # Secondary: Loughran-McDonald
        try:
            score, label = self._score_loughran_mcdonald(text)
            return {"score": score, "label": label, "model": "loughran_mcdonald"}
        except Exception:
            pass

        # Tertiary: VADER (should not fail, but guard anyway)
        score, label = self._score_vader(text)
        return {"score": score, "label": label, "model": "vader"}

    # ------------------------------------------------------------------
    # Batch scoring
    # ------------------------------------------------------------------

    async def _score_all_articles(
        self,
        parsed: list[dict[str, Any]],
        now: datetime,
    ) -> list[dict[str, Any]]:
        """Score all parsed articles with batch optimization.

        When > BATCH_THRESHOLD articles, articles older than
        BATCH_OLD_ARTICLE_DAYS skip FinBERT and use Loughran-McDonald
        directly for performance.

        Returns:
            A list of scored article dicts.
        """
        scored: list[dict[str, Any]] = []
        use_batch_opt = len(parsed) > _BATCH_THRESHOLD

        for article in parsed:
            text = article["headline"]
            if article["summary"]:
                text = text + " " + article["summary"]

            days_old = (now - article["published_at"]).total_seconds() / 86400.0
            if math.isnan(days_old) or math.isinf(days_old) or days_old < 0:
                days_old = 0.0

            if use_batch_opt and days_old > _BATCH_OLD_ARTICLE_DAYS:
                # Skip FinBERT for older articles in batch mode
                try:
                    score, label = self._score_loughran_mcdonald(text)
                    result = {"score": score, "label": label, "model": "loughran_mcdonald"}
                except Exception:
                    score, label = self._score_vader(text)
                    result = {"score": score, "label": label, "model": "vader"}
            else:
                result = await self.score_article(text)

            scored.append({
                "headline": article["headline"],
                "summary": article["summary"],
                "score": result["score"],
                "label": result["label"],
                "model": result["model"],
                "published_at": article["published_at"],
                "source": article["source"],
                "days_old": days_old,
            })

        return scored

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------

    def _aggregate_scores(
        self,
        scored: list[dict[str, Any]],
        now: datetime,
    ) -> dict[str, Any]:
        """Aggregate individual article scores into composite metrics.

        Uses exponential recency weighting: weight = exp(-days_old / 7).

        Returns:
            A dict with overall_score, trend, counts, themes, and model info.
        """
        # Recency-weighted average
        weighted_sum = 0.0
        weight_total = 0.0
        bullish_count = 0
        bearish_count = 0
        neutral_count = 0

        # For trend: recent (0-3d) vs older (4-7d)
        recent_scores: list[float] = []
        older_scores: list[float] = []

        # For themes
        bullish_words: list[str] = []
        bearish_words: list[str] = []

        # Track primary model
        model_counts: Counter[str] = Counter()

        for item in scored:
            days_old = item["days_old"]
            score = item["score"]
            label = item["label"]
            model = item["model"]

            if math.isnan(score) or math.isinf(score):
                score = 0.0
                item["score"] = 0.0

            # Recency weight
            weight = math.exp(-days_old / _RECENCY_HALF_LIFE_DAYS)
            weight = max(_MIN_RECENCY_WEIGHT, weight)
            if math.isnan(weight) or math.isinf(weight):
                weight = _MIN_RECENCY_WEIGHT

            weighted_sum += score * weight
            weight_total += weight

            # Counts
            if label == "bullish":
                bullish_count += 1
            elif label == "bearish":
                bearish_count += 1
            else:
                neutral_count += 1

            # Trend buckets
            if days_old <= 3.0:
                recent_scores.append(score)
            elif days_old <= 7.0:
                older_scores.append(score)

            # Theme word extraction
            text = item["headline"]
            if item.get("summary"):
                text = text + " " + item["summary"]
            words = re.findall(r"[a-z]+", text.lower())
            filtered = [
                w for w in words
                if len(w) >= _MIN_THEME_WORD_LEN and w not in _STOPWORDS
            ]
            if label == "bullish":
                bullish_words.extend(filtered)
            elif label == "bearish":
                bearish_words.extend(filtered)

            model_counts[model] += 1

        # Overall score
        overall_score = weighted_sum / max(weight_total, _EPSILON)
        if math.isnan(overall_score) or math.isinf(overall_score):
            overall_score = 0.0
        overall_score = max(-1.0, min(1.0, overall_score))

        # Trend
        avg_recent = (
            sum(recent_scores) / max(len(recent_scores), 1)
            if recent_scores else 0.0
        )
        avg_older = (
            sum(older_scores) / max(len(older_scores), 1)
            if older_scores else 0.0
        )
        if math.isnan(avg_recent) or math.isinf(avg_recent):
            avg_recent = 0.0
        if math.isnan(avg_older) or math.isinf(avg_older):
            avg_older = 0.0

        diff = avg_recent - avg_older
        if diff > _TREND_THRESHOLD:
            trend = "improving"
        elif diff < -_TREND_THRESHOLD:
            trend = "deteriorating"
        else:
            trend = "stable"

        # Themes
        bullish_themes = [
            w for w, _ in Counter(bullish_words).most_common(_MAX_THEMES)
        ]
        bearish_themes = [
            w for w, _ in Counter(bearish_words).most_common(_MAX_THEMES)
        ]

        # Primary model
        primary_model = model_counts.most_common(1)[0][0] if model_counts else "vader"

        return {
            "overall_score": overall_score,
            "trend": trend,
            "bullish_count": bullish_count,
            "bearish_count": bearish_count,
            "neutral_count": neutral_count,
            "bullish_themes": bullish_themes,
            "bearish_themes": bearish_themes,
            "primary_model": primary_model,
            "avg_recent": avg_recent,
            "avg_older": avg_older,
        }

    # ------------------------------------------------------------------
    # Direction and confidence
    # ------------------------------------------------------------------

    @staticmethod
    def _score_to_direction(score: float) -> str:
        """Map an overall sentiment score to a direction string."""
        if score > _BULLISH_THRESHOLD:
            return Direction.BULLISH.value
        if score < _BEARISH_THRESHOLD:
            return Direction.BEARISH.value
        return Direction.NEUTRAL.value

    @staticmethod
    def _score_to_label(score: float) -> str:
        """Map an individual article score to a label string."""
        if score > _BULLISH_THRESHOLD:
            return "bullish"
        if score < _BEARISH_THRESHOLD:
            return "bearish"
        return "neutral"

    @staticmethod
    def _calculate_confidence(
        overall_score: float,
        article_count: int,
        bullish_count: int,
        bearish_count: int,
        neutral_count: int,
        trend: str,
        direction: str,
    ) -> float:
        """Calculate confidence level based on score strength and agreement.

        Base confidence is abs(overall_score), with bonuses for article
        count, directional agreement, and trend confirmation.
        """
        base = abs(overall_score)
        if math.isnan(base) or math.isinf(base):
            base = 0.0

        # Article count bonus
        if article_count >= 20:
            base += 0.15
        elif article_count >= 10:
            base += 0.10

        # Directional agreement bonus
        total = bullish_count + bearish_count + neutral_count
        if total > 0:
            if direction == Direction.BULLISH.value:
                agreement = bullish_count / total
            elif direction == Direction.BEARISH.value:
                agreement = bearish_count / total
            else:
                agreement = neutral_count / total

            if agreement > 0.70:
                base += 0.10

        # Trend matches direction bonus
        if (
            (direction == Direction.BULLISH.value and trend == "improving")
            or (direction == Direction.BEARISH.value and trend == "deteriorating")
        ):
            base += 0.05

        # Guard and clamp
        if math.isnan(base) or math.isinf(base):
            base = _NO_ARTICLES_CONFIDENCE
        return max(_NO_ARTICLES_CONFIDENCE, min(1.0, base))

    # ------------------------------------------------------------------
    # Key levels construction
    # ------------------------------------------------------------------

    def _build_key_levels(
        self,
        aggregate: dict[str, Any],
        scored: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Construct the ``key_levels`` dict for the output signal."""
        article_scores: list[dict[str, Any]] = []
        for item in scored:
            pub_dt = item["published_at"]
            pub_str = pub_dt.isoformat() if isinstance(pub_dt, datetime) else str(pub_dt)
            article_scores.append({
                "headline": item["headline"],
                "score": round(item["score"], 4),
                "label": item["label"],
                "model": item["model"],
                "published_at": pub_str,
            })

        return {
            "overall_sentiment_score": round(aggregate["overall_score"], 4),
            "sentiment_trend": aggregate["trend"],
            "article_count": len(scored),
            "bullish_count": aggregate["bullish_count"],
            "bearish_count": aggregate["bearish_count"],
            "neutral_count": aggregate["neutral_count"],
            "key_themes_bullish": aggregate["bullish_themes"],
            "key_themes_bearish": aggregate["bearish_themes"],
            "model_used": aggregate["primary_model"],
            "avg_score_last_3d": round(aggregate["avg_recent"], 4),
            "avg_score_4_7d": round(aggregate["avg_older"], 4),
            "article_scores": article_scores,
        }

    # ------------------------------------------------------------------
    # Reasoning construction
    # ------------------------------------------------------------------

    def _build_reasoning(
        self,
        safe_ticker: str,
        aggregate: dict[str, Any],
        direction: str,
    ) -> str:
        """Generate a human-readable reasoning summary."""
        n = (
            aggregate["bullish_count"]
            + aggregate["bearish_count"]
            + aggregate["neutral_count"]
        )
        overall = aggregate["overall_score"]
        trend = aggregate["trend"]
        avg_3d = aggregate["avg_recent"]
        avg_7d = aggregate["avg_older"]
        bullish_c = aggregate["bullish_count"]
        bearish_c = aggregate["bearish_count"]
        neutral_c = aggregate["neutral_count"]
        model = aggregate["primary_model"]

        bull_themes = ", ".join(aggregate["bullish_themes"]) if aggregate["bullish_themes"] else "none"
        bear_themes = ", ".join(aggregate["bearish_themes"]) if aggregate["bearish_themes"] else "none"

        return (
            f"{safe_ticker} sentiment analysis across {n} articles: "
            f"Overall score {overall:.2f} ({direction}). "
            f"{bullish_c} bullish, {bearish_c} bearish, {neutral_c} neutral articles. "
            f"Sentiment is {trend} "
            f"(3-day avg {avg_3d:.2f} vs 7-day avg {avg_7d:.2f}). "
            f"Key bullish themes: {bull_themes}. "
            f"Key bearish themes: {bear_themes}. "
            f"Model: {model}."
        )

    # ------------------------------------------------------------------
    # No-articles fallback signal
    # ------------------------------------------------------------------

    def _no_articles_signal(self, safe_ticker: str) -> MethodologySignal:
        """Return a neutral signal when no articles are available."""
        key_levels: dict[str, Any] = {
            "overall_sentiment_score": 0.0,
            "sentiment_trend": "stable",
            "article_count": 0,
            "bullish_count": 0,
            "bearish_count": 0,
            "neutral_count": 0,
            "key_themes_bullish": [],
            "key_themes_bearish": [],
            "model_used": "none",
            "avg_score_last_3d": 0.0,
            "avg_score_4_7d": 0.0,
            "article_scores": [],
        }
        reasoning = (
            f"{safe_ticker} sentiment analysis: "
            f"no articles provided. Returning neutral signal."
        )
        return self.create_signal(
            ticker=safe_ticker,
            direction=Direction.NEUTRAL.value,
            confidence=_NO_ARTICLES_CONFIDENCE,
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
