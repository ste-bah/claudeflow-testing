"""News route -- aggregated financial news with sentiment and pagination.

GET /api/news/{symbol}  returns paginated news articles for a symbol,
each with an optional sentiment score.  Uses the CacheManager (Finnhub
fallback chain) for article data.

Full implementation: TASK-API-003
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.cache import get_cache_manager
from app.analysis.sentiment import SentimentAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,10}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MAX_SUMMARY_LEN = 500
# Timeout for the cache/Finnhub fetch. If Finnhub is slow on cold cache,
# we return empty and the background task warms the cache for the retry.
_NEWS_FETCH_TIMEOUT: float = 12.0


class Category(str, Enum):
    """Allowed values for the ``category`` query parameter."""
    company = "company"
    market = "market"
    all = "all"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_symbol(symbol: str) -> str:
    """Strip, upper-case, and validate *symbol*.  Raises 400 on failure."""
    cleaned = symbol.strip().upper()
    if not cleaned or not _SYMBOL_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid ticker symbol",
        )
    return cleaned


def _validate_date(value: str | None, param_name: str) -> str | None:
    """Validate an optional date string.  Returns the string or raises 400."""
    if value is None:
        return None
    if not _DATE_RE.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {param_name}: expected YYYY-MM-DD format",
        )
    try:
        date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {param_name}: not a valid calendar date",
        )
    return value


def _article_id(article: dict[str, Any]) -> str:
    """Generate a deterministic short ID for an article."""
    key = f"{article.get('source', '')}:{article.get('headline', '')}:{article.get('published_at', '')}"
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def _normalize_article(article: dict[str, Any], sentiment_data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Normalize a raw article from the cache into the API response shape."""
    summary = article.get("summary") or ""
    if len(summary) > _MAX_SUMMARY_LEN:
        summary = summary[:_MAX_SUMMARY_LEN]

    return {
        "id": _article_id(article),
        "headline": article.get("headline"),
        "summary": summary,
        "source": article.get("source"),
        "url": article.get("url"),
        "image_url": article.get("image"),
        "published_at": article.get("published_at"),
        "category": article.get("category"),
        "related_tickers": _parse_related(article.get("related")),
        "sentiment": sentiment_data.get("label") if sentiment_data else None,
        "sentiment_score": sentiment_data.get("score") if sentiment_data else None,
    }


def _parse_related(related: Any) -> list[str]:
    """Parse the ``related`` field into a list of ticker symbols."""
    if isinstance(related, list):
        return related
    if isinstance(related, str) and related:
        return [s.strip() for s in related.split(",") if s.strip()]
    return []


def _filter_by_dates(
    articles: list[dict[str, Any]],
    from_date: str | None,
    to_date: str | None,
) -> list[dict[str, Any]]:
    """Filter articles by published_at date range."""
    if not from_date and not to_date:
        return articles
    result = []
    for a in articles:
        pub = a.get("published_at") or ""
        pub_date = pub[:10] if len(pub) >= 10 else ""
        if from_date and pub_date < from_date:
            continue
        if to_date and pub_date > to_date:
            continue
        result.append(a)
    return result


def _filter_by_category(
    articles: list[dict[str, Any]],
    category: Category,
) -> list[dict[str, Any]]:
    """Filter articles by category."""
    if category == Category.all:
        return articles
    return [a for a in articles if a.get("category") == category.value]


def _deduplicate(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate articles by normalized headline."""
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for a in articles:
        headline = (a.get("headline") or "").strip().lower()
        if headline and headline in seen:
            continue
        seen.add(headline)
        unique.append(a)
    return unique


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{symbol}")
async def get_news(
    symbol: str,
    limit: int = Query(20, ge=1, le=100, description="Number of articles"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    from_date: str | None = Query(None, description="From date (YYYY-MM-DD)"),
    to_date: str | None = Query(None, description="To date (YYYY-MM-DD)"),
    category: Category = Query(Category.all, description="News category filter"),
    force_refresh: bool = Query(False, description="Bypass cache and force fresh fetch"),
) -> dict[str, Any]:
    """Return paginated news articles for *symbol* with optional sentiment."""
    symbol = _validate_symbol(symbol)
    from_date = _validate_date(from_date, "from_date")
    to_date = _validate_date(to_date, "to_date")

    cache = get_cache_manager()

    # Fetch news through cache (finnhub fallback chain).
    # We cap at _NEWS_FETCH_TIMEOUT seconds — Finnhub can be slow on cold cache miss.
    # On timeout we return empty immediately and schedule a background warm-up;
    # the frontend's auto-retry (5 s) will pick up the warmed cache.
    news_result = None
    try:
        news_result = await asyncio.wait_for(
            cache.get_news(symbol, force_refresh=force_refresh),
            timeout=_NEWS_FETCH_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "News fetch timed out for %s (%.0fs) — scheduling background warm-up",
            symbol, _NEWS_FETCH_TIMEOUT,
        )
        # Fire-and-forget background warm-up so the *next* request hits the cache.
        async def _bg_warmup(sym: str) -> None:
            try:
                await cache.get_news(sym, force_refresh=True)
                logger.info("Background news warm-up complete for %s", sym)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Background news warm-up failed for %s: %s", sym, exc)
        asyncio.create_task(_bg_warmup(symbol))
    except Exception:
        logger.warning("Cache fetch error for news:%s", symbol, exc_info=True)

    # Determine data source and raw articles
    if news_result is not None and isinstance(news_result.data, list):
        raw_articles = news_result.data
        data_source = news_result.source
        data_timestamp = news_result.fetched_at
    else:
        raw_articles = []
        data_source = "none"
        data_timestamp = datetime.now(timezone.utc).isoformat()

    # Normalize, deduplicate, and filter
    articles = [_normalize_article(a) for a in raw_articles]
    articles = _deduplicate(articles)
    articles = _filter_by_dates(articles, from_date, to_date)
    articles = _filter_by_category(articles, category)

    total_count = len(articles)

    # Paginate
    page = articles[offset:offset + limit]

    # -- Sentiment Analysis Integration --------------------------------------
    # If we have a page of articles, run them through the SentimentAnalyzer.
    if page:
        analyzer = SentimentAnalyzer()
        try:
            now_utc = datetime.now(timezone.utc)
            # Prepare articles for analyzer format
            to_parse = []
            for a in page:
                to_parse.append({
                    "headline": a["headline"],
                    "summary": a["summary"],
                    "published_at": a["published_at"],
                    "source": a["source"],
                })
            
            # Parse articles (converts timestamps to datetimes)
            parsed = analyzer._parse_articles(to_parse, now_utc)
            
            # Run batch sentiment analysis
            scored_results = await analyzer._score_all_articles(parsed, now_utc)
            
            # Map results back to the page
            for i, res in enumerate(scored_results):
                if i < len(page):
                    page[i]["sentiment"] = res["label"]
                    page[i]["sentiment_score"] = res["score"]
        except Exception:
            logger.warning("Sentiment analysis failed for news page:%s", symbol, exc_info=True)

    logger.info(
        "News %s: %d articles, page %d-%d of %d, source=%s",
        symbol, total_count, offset, offset + len(page), total_count, data_source,
    )

    return {
        "symbol": symbol,
        "articles": page,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "data_source": data_source,
        "data_timestamp": data_timestamp,
    }
