"""Tests for TASK-API-003: News endpoint at /api/news/{symbol}.

Validates symbol validation, response structure, pagination, date filtering,
category filtering, deduplication, article normalization, error handling,
and edge cases.

Run with: ``pytest tests/test_news_endpoint.py -v``
"""
from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.data.cache_types import CachedResult
from app.main import app

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_FETCHED_AT = "2026-02-07T16:00:00+00:00"


def _make_cached_result(data, source="finnhub", **overrides):
    """Build a CachedResult with sensible defaults for news."""
    defaults = dict(
        data=data,
        data_type="news",
        cache_key="news:AAPL:latest",
        source=source,
        is_cached=True,
        is_stale=False,
        fetched_at=_FETCHED_AT,
        cache_age_seconds=42.0,
        cache_age_human="42s ago",
        ttl_seconds=3600,
        expires_at="2026-02-07T17:00:00+00:00",
    )
    defaults.update(overrides)
    return CachedResult(**defaults)


def _sample_article(**overrides):
    """Build a sample raw article dict as returned by the cache (Finnhub shape)."""
    defaults = dict(
        headline="Apple Reports Record Revenue",
        summary="Apple Inc. reported quarterly revenue of $124B, beating estimates.",
        source="Reuters",
        url="https://example.com/article1",
        image="https://example.com/image1.jpg",
        published_at="2026-02-07T14:30:00+00:00",
        category="company",
        related="AAPL,MSFT",
        _source="finnhub",
        _fetched_at="2026-02-07T16:00:00+00:00",
    )
    defaults.update(overrides)
    return defaults


def _make_articles(count, **overrides):
    """Build a list of *count* unique articles."""
    articles = []
    for i in range(count):
        articles.append(
            _sample_article(
                headline=f"Article headline number {i}",
                url=f"https://example.com/article{i}",
                published_at=f"2026-02-{7 - (i % 7):02d}T14:30:00+00:00",
                **overrides,
            )
        )
    return articles


def _patch_news(articles=None, source="finnhub", result=None, raises=False):
    """Return a context-manager patch for get_cache_manager.

    If *result* is provided, it is used directly.
    If *raises* is True, get_news raises an exception.
    Otherwise, builds a CachedResult wrapping *articles*.
    """
    cache_mock = MagicMock()

    if raises:
        cache_mock.get_news = AsyncMock(side_effect=Exception("cache exploded"))
    elif result is not None:
        cache_mock.get_news = AsyncMock(return_value=result)
    elif articles is not None:
        cr = _make_cached_result(articles, source=source)
        cache_mock.get_news = AsyncMock(return_value=cr)
    else:
        cache_mock.get_news = AsyncMock(return_value=None)

    return patch("app.api.routes.news.get_cache_manager", return_value=cache_mock)


def _get(symbol, **params):
    """Shorthand for GET /api/news/{symbol}."""
    return client.get(f"/api/news/{symbol}", params=params)


def _expected_article_id(article):
    """Reproduce _article_id logic for verification."""
    key = f"{article.get('source', '')}:{article.get('headline', '')}:{article.get('published_at', '')}"
    return hashlib.sha256(key.encode()).hexdigest()[:12]


# ===================================================================
# 1. Symbol Validation (12 tests)
# ===================================================================
class TestSymbolValidation:
    """Verify symbol validation: stripping, uppercasing, regex, 400 errors."""

    @pytest.mark.parametrize(
        "symbol",
        ["AAPL", "MSFT", "GOOG", "X", "A", "Z"],
        ids=["aapl", "msft", "goog", "single-X", "single-A", "single-Z"],
    )
    def test_valid_simple_symbols_return_200(self, symbol):
        with _patch_news(articles=[_sample_article()]):
            resp = _get(symbol)
        assert resp.status_code == 200

    def test_valid_symbol_brk_dot_b(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("BRK.B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.B"

    def test_valid_symbol_bf_dash_b(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("BF-B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BF-B"

    def test_valid_symbol_ten_chars_max(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("ABCDEFGHIJ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "ABCDEFGHIJ"

    def test_case_normalization_lowercase(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("aapl")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_case_normalization_mixed(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("aApL")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_whitespace_stripping(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get(" AAPL ")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "AAPL"

    def test_invalid_empty_string(self):
        """Empty symbol does not match /{symbol} route -- returns 404."""
        with _patch_news():
            resp = _get("")
        assert resp.status_code == 404

    def test_invalid_spaces_only(self):
        """Symbol of only spaces: stripped to empty, 400."""
        with _patch_news():
            resp = _get("   ")
        assert resp.status_code == 400

    def test_invalid_special_chars_exclamation(self):
        with _patch_news():
            resp = _get("!!!")
        assert resp.status_code == 400

    def test_invalid_too_long_eleven_chars(self):
        with _patch_news():
            resp = _get("ABCDEFGHIJK")
        assert resp.status_code == 400

    def test_invalid_at_sign(self):
        with _patch_news():
            resp = _get("AA@L")
        assert resp.status_code == 400

    def test_400_body_has_error_key(self):
        with _patch_news():
            resp = _get("!!!")
        body = resp.json()
        assert "error" in body


# ===================================================================
# 2. Response Structure (13 tests)
# ===================================================================
class TestResponseStructure:
    """Verify the shape and content of a successful news response."""

    def test_top_level_keys_present(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        body = resp.json()
        required = {"symbol", "articles", "total_count", "limit", "offset",
                     "data_source", "data_timestamp"}
        assert required.issubset(set(body.keys()))

    def test_symbol_is_uppercase(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("aapl")
        assert resp.json()["symbol"] == "AAPL"

    def test_articles_is_list(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        assert isinstance(resp.json()["articles"], list)

    def test_article_shape_all_keys(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        article = resp.json()["articles"][0]
        expected_keys = {"id", "headline", "summary", "source", "url",
                         "image_url", "published_at", "category",
                         "related_tickers", "sentiment"}
        assert expected_keys == set(article.keys())

    def test_article_headline_matches(self):
        with _patch_news(articles=[_sample_article(headline="Test Headline")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["headline"] == "Test Headline"

    def test_article_source_matches(self):
        with _patch_news(articles=[_sample_article(source="Bloomberg")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["source"] == "Bloomberg"

    def test_article_url_matches(self):
        with _patch_news(articles=[_sample_article(url="https://test.com/a")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["url"] == "https://test.com/a"

    def test_article_published_at_matches(self):
        with _patch_news(articles=[_sample_article(published_at="2026-02-07T14:30:00+00:00")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["published_at"] == "2026-02-07T14:30:00+00:00"

    def test_article_category_matches(self):
        with _patch_news(articles=[_sample_article(category="market")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["category"] == "market"

    def test_sentiment_is_null(self):
        """No sentiment pipeline yet; sentiment should always be null."""
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["sentiment"] is None

    def test_data_source_matches_cached_result_source(self):
        with _patch_news(articles=[_sample_article()], source="finnhub"):
            resp = _get("AAPL")
        assert resp.json()["data_source"] == "finnhub"

    def test_data_source_custom_source(self):
        with _patch_news(articles=[_sample_article()], source="yfinance"):
            resp = _get("AAPL")
        assert resp.json()["data_source"] == "yfinance"

    def test_data_timestamp_matches_cached_result(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        assert resp.json()["data_timestamp"] == _FETCHED_AT


# ===================================================================
# 3. Pagination (18 tests)
# ===================================================================
class TestPagination:
    """Verify limit, offset, total_count pagination behaviour."""

    def test_default_limit_is_20(self):
        with _patch_news(articles=_make_articles(25)):
            resp = _get("AAPL")
        body = resp.json()
        assert body["limit"] == 20
        assert len(body["articles"]) == 20

    def test_default_offset_is_0(self):
        with _patch_news(articles=_make_articles(5)):
            resp = _get("AAPL")
        assert resp.json()["offset"] == 0

    def test_custom_limit(self):
        with _patch_news(articles=_make_articles(10)):
            resp = _get("AAPL", limit=5)
        body = resp.json()
        assert body["limit"] == 5
        assert len(body["articles"]) == 5

    def test_custom_offset(self):
        with _patch_news(articles=_make_articles(10)):
            resp = _get("AAPL", limit=5, offset=3)
        body = resp.json()
        assert body["offset"] == 3
        assert len(body["articles"]) == 5

    def test_offset_beyond_total_returns_empty(self):
        with _patch_news(articles=_make_articles(5)):
            resp = _get("AAPL", offset=100)
        body = resp.json()
        assert body["articles"] == []
        assert body["total_count"] == 5

    def test_total_count_reflects_all_matching_not_page_size(self):
        with _patch_news(articles=_make_articles(30)):
            resp = _get("AAPL", limit=10)
        body = resp.json()
        assert body["total_count"] == 30
        assert len(body["articles"]) == 10

    def test_limit_1_returns_exactly_1(self):
        with _patch_news(articles=_make_articles(5)):
            resp = _get("AAPL", limit=1)
        assert len(resp.json()["articles"]) == 1

    def test_limit_100_max(self):
        with _patch_news(articles=_make_articles(150)):
            resp = _get("AAPL", limit=100)
        body = resp.json()
        assert body["limit"] == 100
        assert len(body["articles"]) == 100

    def test_limit_0_returns_422(self):
        """limit=0 violates ge=1 constraint."""
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", limit=0)
        assert resp.status_code == 422

    def test_limit_101_returns_422(self):
        """limit=101 violates le=100 constraint."""
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", limit=101)
        assert resp.status_code == 422

    def test_negative_limit_returns_422(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", limit=-1)
        assert resp.status_code == 422

    def test_negative_offset_returns_422(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", offset=-1)
        assert resp.status_code == 422

    def test_offset_0_same_as_default(self):
        articles = _make_articles(5)
        with _patch_news(articles=articles):
            resp_default = _get("AAPL")
        with _patch_news(articles=articles):
            resp_explicit = _get("AAPL", offset=0)
        assert resp_default.json()["articles"] == resp_explicit.json()["articles"]

    def test_pagination_second_page(self):
        """Second page starts at offset=limit."""
        articles = _make_articles(10)
        with _patch_news(articles=articles):
            page1 = _get("AAPL", limit=5, offset=0).json()
        with _patch_news(articles=articles):
            page2 = _get("AAPL", limit=5, offset=5).json()
        # Pages should not overlap
        ids1 = {a["id"] for a in page1["articles"]}
        ids2 = {a["id"] for a in page2["articles"]}
        assert ids1.isdisjoint(ids2)

    def test_pagination_last_partial_page(self):
        """Last page may have fewer items than limit."""
        with _patch_news(articles=_make_articles(7)):
            resp = _get("AAPL", limit=5, offset=5)
        body = resp.json()
        assert len(body["articles"]) == 2
        assert body["total_count"] == 7

    def test_limit_larger_than_total(self):
        """Limit larger than total articles returns all articles."""
        with _patch_news(articles=_make_articles(3)):
            resp = _get("AAPL", limit=50)
        body = resp.json()
        assert len(body["articles"]) == 3
        assert body["total_count"] == 3

    def test_total_count_with_zero_articles(self):
        with _patch_news(articles=[]):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 0

    def test_limit_string_non_numeric_returns_422(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", limit="abc")
        assert resp.status_code == 422


# ===================================================================
# 4. Date Filtering (12 tests)
# ===================================================================
class TestDateFiltering:
    """Verify from_date and to_date query parameter filtering."""

    def _articles_with_dates(self, dates):
        """Build articles with specific published_at dates."""
        return [
            _sample_article(
                headline=f"Article on {d}",
                published_at=f"{d}T14:30:00+00:00",
            )
            for d in dates
        ]

    def test_from_date_filters_old_articles(self):
        articles = self._articles_with_dates(
            ["2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-06")
        body = resp.json()
        assert body["total_count"] == 2
        for a in body["articles"]:
            assert a["published_at"][:10] >= "2026-02-06"

    def test_to_date_filters_newer_articles(self):
        articles = self._articles_with_dates(
            ["2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL", to_date="2026-02-06")
        body = resp.json()
        assert body["total_count"] == 2
        for a in body["articles"]:
            assert a["published_at"][:10] <= "2026-02-06"

    def test_from_and_to_date_range(self):
        articles = self._articles_with_dates(
            ["2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-05", to_date="2026-02-06")
        body = resp.json()
        assert body["total_count"] == 2

    def test_no_dates_returns_all_articles(self):
        articles = self._articles_with_dates(
            ["2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 3

    def test_from_date_invalid_format_returns_400(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", from_date="02-07-2026")
        assert resp.status_code == 400

    def test_to_date_invalid_format_returns_400(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", to_date="2026/02/07")
        assert resp.status_code == 400

    def test_from_date_invalid_value_returns_400(self):
        """2026-02-30 is not a real date."""
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", from_date="2026-02-30")
        assert resp.status_code == 400

    def test_to_date_invalid_value_returns_400(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", to_date="2026-13-01")
        assert resp.status_code == 400

    def test_from_date_error_body_mentions_param(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", from_date="bad")
        body = resp.json()
        assert "from_date" in body.get("error", "")

    def test_to_date_error_body_mentions_param(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", to_date="bad")
        body = resp.json()
        assert "to_date" in body.get("error", "")

    def test_from_date_equals_to_date_single_day(self):
        articles = self._articles_with_dates(
            ["2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-06", to_date="2026-02-06")
        body = resp.json()
        assert body["total_count"] == 1
        assert body["articles"][0]["published_at"][:10] == "2026-02-06"

    def test_from_date_after_to_date_returns_empty(self):
        """When from_date > to_date, no articles match."""
        articles = self._articles_with_dates(
            ["2026-02-05", "2026-02-06", "2026-02-07"]
        )
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-08", to_date="2026-02-04")
        body = resp.json()
        assert body["total_count"] == 0
        assert body["articles"] == []


# ===================================================================
# 5. Category Filtering (9 tests)
# ===================================================================
class TestCategoryFiltering:
    """Verify the category query parameter."""

    def _mixed_category_articles(self):
        return [
            _sample_article(headline="Company news 1", category="company"),
            _sample_article(headline="Market news 1", category="market"),
            _sample_article(headline="Company news 2", category="company"),
            _sample_article(headline="Market news 2", category="market"),
            _sample_article(headline="Company news 3", category="company"),
        ]

    def test_category_company_filters(self):
        with _patch_news(articles=self._mixed_category_articles()):
            resp = _get("AAPL", category="company")
        body = resp.json()
        assert body["total_count"] == 3
        assert all(a["category"] == "company" for a in body["articles"])

    def test_category_market_filters(self):
        with _patch_news(articles=self._mixed_category_articles()):
            resp = _get("AAPL", category="market")
        body = resp.json()
        assert body["total_count"] == 2
        assert all(a["category"] == "market" for a in body["articles"])

    def test_category_all_returns_everything(self):
        with _patch_news(articles=self._mixed_category_articles()):
            resp = _get("AAPL", category="all")
        assert resp.json()["total_count"] == 5

    def test_default_category_is_all(self):
        """Without specifying category, all articles are returned."""
        with _patch_news(articles=self._mixed_category_articles()):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 5

    def test_invalid_category_returns_422(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", category="invalid")
        assert resp.status_code == 422

    def test_invalid_category_technology_returns_422(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL", category="technology")
        assert resp.status_code == 422

    def test_category_company_with_no_matching_articles(self):
        articles = [
            _sample_article(headline="Market only 1", category="market"),
            _sample_article(headline="Market only 2", category="market"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company")
        assert resp.json()["total_count"] == 0
        assert resp.json()["articles"] == []

    def test_category_combined_with_date_filter(self):
        """Category and date filters work together."""
        articles = [
            _sample_article(headline="Company old", category="company",
                            published_at="2026-02-05T10:00:00+00:00"),
            _sample_article(headline="Company new", category="company",
                            published_at="2026-02-07T10:00:00+00:00"),
            _sample_article(headline="Market new", category="market",
                            published_at="2026-02-07T10:00:00+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company", from_date="2026-02-06")
        body = resp.json()
        assert body["total_count"] == 1
        assert body["articles"][0]["headline"] == "Company new"

    def test_category_combined_with_pagination(self):
        """Category filter is applied before pagination."""
        articles = [
            _sample_article(headline=f"Company {i}", category="company")
            for i in range(10)
        ] + [
            _sample_article(headline=f"Market {i}", category="market")
            for i in range(5)
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company", limit=3)
        body = resp.json()
        assert body["total_count"] == 10
        assert len(body["articles"]) == 3
        assert all(a["category"] == "company" for a in body["articles"])


# ===================================================================
# 6. Deduplication (10 tests)
# ===================================================================
class TestDeduplication:
    """Verify deduplication by normalized headline."""

    def test_duplicate_headlines_removed(self):
        articles = [
            _sample_article(headline="Apple Record Revenue", source="Reuters"),
            _sample_article(headline="Apple Record Revenue", source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_case_insensitive_dedup(self):
        """Dedup is case-insensitive."""
        articles = [
            _sample_article(headline="Record Revenue", source="Reuters"),
            _sample_article(headline="record revenue", source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_case_insensitive_dedup_mixed_case(self):
        articles = [
            _sample_article(headline="Record Revenue", source="Reuters"),
            _sample_article(headline="RECORD REVENUE", source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_different_sources_same_headline_deduped(self):
        articles = [
            _sample_article(headline="Breaking News", source="Reuters"),
            _sample_article(headline="Breaking News", source="Bloomberg"),
            _sample_article(headline="Breaking News", source="CNBC"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_unique_headlines_all_kept(self):
        articles = [
            _sample_article(headline="First Article"),
            _sample_article(headline="Second Article"),
            _sample_article(headline="Third Article"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 3

    def test_first_occurrence_kept(self):
        """The first article with a given headline is the one kept."""
        articles = [
            _sample_article(headline="Same Headline", source="First"),
            _sample_article(headline="Same Headline", source="Second"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["source"] == "First"

    def test_whitespace_in_headline_normalized(self):
        """Headline leading/trailing whitespace is stripped during dedup."""
        articles = [
            _sample_article(headline="  Apple News  ", source="Reuters"),
            _sample_article(headline="Apple News", source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_empty_headline_articles_not_deduped(self):
        """Articles with empty headlines are all kept (empty headline skips dedup)."""
        articles = [
            _sample_article(headline="", source="Reuters"),
            _sample_article(headline="", source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        # Empty headline stripped/lowered = "" which is falsy, so dedup skips
        assert resp.json()["total_count"] == 2

    def test_none_headline_articles_not_deduped(self):
        """Articles with None headlines are all kept."""
        articles = [
            _sample_article(headline=None, source="Reuters"),
            _sample_article(headline=None, source="Bloomberg"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        # (None or "").strip().lower() == "" which is falsy -> skips dedup
        assert resp.json()["total_count"] == 2

    def test_dedup_affects_total_count(self):
        """total_count reflects deduplicated count, not raw count."""
        articles = [
            _sample_article(headline="Dupe A"),
            _sample_article(headline="Dupe A"),
            _sample_article(headline="Unique B"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 2


# ===================================================================
# 7. Article Normalization (14 tests)
# ===================================================================
class TestArticleNormalization:
    """Verify normalization: ID generation, summary truncation,
    image->image_url mapping, related parsing."""

    def test_id_is_deterministic_hash(self):
        article = _sample_article()
        expected_id = _expected_article_id(article)
        with _patch_news(articles=[article]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["id"] == expected_id

    def test_id_is_12_char_hex(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        article_id = resp.json()["articles"][0]["id"]
        assert len(article_id) == 12
        assert all(c in "0123456789abcdef" for c in article_id)

    def test_id_different_for_different_articles(self):
        articles = [
            _sample_article(headline="Article A"),
            _sample_article(headline="Article B"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        ids = [a["id"] for a in resp.json()["articles"]]
        assert ids[0] != ids[1]

    def test_summary_truncated_at_500_chars(self):
        long_summary = "x" * 600
        with _patch_news(articles=[_sample_article(summary=long_summary)]):
            resp = _get("AAPL")
        result_summary = resp.json()["articles"][0]["summary"]
        assert len(result_summary) == 500

    def test_summary_under_500_not_truncated(self):
        short_summary = "Short summary."
        with _patch_news(articles=[_sample_article(summary=short_summary)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["summary"] == short_summary

    def test_summary_exactly_500_not_truncated(self):
        summary = "y" * 500
        with _patch_news(articles=[_sample_article(summary=summary)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["summary"] == summary
        assert len(resp.json()["articles"][0]["summary"]) == 500

    def test_summary_501_truncated_to_500(self):
        summary = "z" * 501
        with _patch_news(articles=[_sample_article(summary=summary)]):
            resp = _get("AAPL")
        assert len(resp.json()["articles"][0]["summary"]) == 500

    def test_image_field_mapped_to_image_url(self):
        with _patch_news(articles=[_sample_article(image="https://img.com/pic.jpg")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["image_url"] == "https://img.com/pic.jpg"

    def test_related_string_parsed_to_list(self):
        with _patch_news(articles=[_sample_article(related="AAPL,MSFT,GOOG")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == ["AAPL", "MSFT", "GOOG"]

    def test_related_list_passed_through(self):
        with _patch_news(articles=[_sample_article(related=["AAPL", "TSLA"])]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == ["AAPL", "TSLA"]

    def test_related_none_returns_empty_list(self):
        with _patch_news(articles=[_sample_article(related=None)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == []

    def test_related_empty_string_returns_empty_list(self):
        with _patch_news(articles=[_sample_article(related="")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == []

    def test_related_string_with_spaces_trimmed(self):
        with _patch_news(articles=[_sample_article(related=" AAPL , MSFT , GOOG ")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == ["AAPL", "MSFT", "GOOG"]

    def test_missing_fields_return_none(self):
        """An article missing optional fields gets None values."""
        minimal = {"headline": "Minimal Article"}
        with _patch_news(articles=[minimal]):
            resp = _get("AAPL")
        article = resp.json()["articles"][0]
        assert article["source"] is None
        assert article["url"] is None
        assert article["image_url"] is None
        assert article["published_at"] is None
        assert article["category"] is None
        assert article["related_tickers"] == []


# ===================================================================
# 8. Error Handling (12 tests)
# ===================================================================
class TestErrorHandling:
    """Verify graceful handling of cache failures and unexpected data."""

    def test_cache_returns_none_empty_articles_200(self):
        with _patch_news():  # default: returns None
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["articles"] == []
        assert body["total_count"] == 0

    def test_cache_returns_none_data_source_none(self):
        with _patch_news():
            resp = _get("AAPL")
        assert resp.json()["data_source"] == "none"

    def test_cache_raises_exception_returns_200(self):
        with _patch_news(raises=True):
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["articles"] == []
        assert body["data_source"] == "none"

    def test_cache_returns_non_list_data(self):
        """CachedResult.data is a dict instead of list."""
        cr = _make_cached_result({"error": "unexpected"})
        with _patch_news(result=cr):
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["articles"] == []
        assert body["data_source"] == "none"

    def test_cache_returns_string_data(self):
        cr = _make_cached_result("not a list")
        with _patch_news(result=cr):
            resp = _get("AAPL")
        assert resp.status_code == 200
        assert resp.json()["articles"] == []

    def test_cache_returns_integer_data(self):
        cr = _make_cached_result(42)
        with _patch_news(result=cr):
            resp = _get("AAPL")
        assert resp.status_code == 200
        assert resp.json()["articles"] == []

    def test_cache_returns_none_data_in_result(self):
        cr = _make_cached_result(None)
        with _patch_news(result=cr):
            resp = _get("AAPL")
        assert resp.status_code == 200
        assert resp.json()["articles"] == []

    def test_cache_returns_empty_list(self):
        with _patch_news(articles=[]):
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["articles"] == []
        assert body["total_count"] == 0
        assert body["data_source"] == "finnhub"

    def test_data_source_none_when_no_result(self):
        with _patch_news():
            resp = _get("AAPL")
        assert resp.json()["data_source"] == "none"

    def test_data_timestamp_set_when_no_result(self):
        """When no cache result, data_timestamp is still present (generated)."""
        with _patch_news():
            resp = _get("AAPL")
        ts = resp.json()["data_timestamp"]
        assert ts is not None
        assert isinstance(ts, str)
        assert len(ts) > 0

    def test_article_with_missing_headline_still_normalized(self):
        """Article lacking 'headline' key is still processed."""
        article = {"source": "Reuters", "url": "https://test.com"}
        with _patch_news(articles=[article]):
            resp = _get("AAPL")
        assert resp.status_code == 200
        assert resp.json()["articles"][0]["headline"] is None

    def test_article_completely_empty_dict(self):
        """An empty article dict is still returned (with None/empty values)."""
        with _patch_news(articles=[{}]):
            resp = _get("AAPL")
        assert resp.status_code == 200
        article = resp.json()["articles"][0]
        assert article["headline"] is None
        assert article["summary"] == ""
        assert article["related_tickers"] == []


# ===================================================================
# 9. Edge Cases (11 tests)
# ===================================================================
class TestEdgeCases:
    """Verify edge cases and boundary conditions."""

    def test_post_method_not_allowed(self):
        with _patch_news(articles=[_sample_article()]):
            resp = client.post("/api/news/AAPL")
        assert resp.status_code == 405

    def test_put_method_not_allowed(self):
        with _patch_news(articles=[_sample_article()]):
            resp = client.put("/api/news/AAPL")
        assert resp.status_code == 405

    def test_delete_method_not_allowed(self):
        with _patch_news(articles=[_sample_article()]):
            resp = client.delete("/api/news/AAPL")
        assert resp.status_code == 405

    def test_very_long_summary_truncation(self):
        long = "A" * 10_000
        with _patch_news(articles=[_sample_article(summary=long)]):
            resp = _get("AAPL")
        assert len(resp.json()["articles"][0]["summary"]) == 500

    def test_symbol_with_dot(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("BRK.A")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BRK.A"

    def test_symbol_with_dash(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("BF-B")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "BF-B"

    def test_zero_matching_articles_after_category_filter(self):
        articles = [_sample_article(category="market")]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company")
        body = resp.json()
        assert body["total_count"] == 0
        assert body["articles"] == []

    def test_zero_matching_articles_after_date_filter(self):
        articles = [_sample_article(published_at="2026-02-07T10:00:00+00:00")]
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-03-01")
        assert resp.json()["total_count"] == 0

    def test_response_content_type_json(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("AAPL")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_single_char_symbol(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("X")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "X"

    def test_numeric_only_symbol(self):
        with _patch_news(articles=[_sample_article()]):
            resp = _get("1234567890")
        assert resp.status_code == 200


# ===================================================================
# 10. Combined / Integration-style tests (11 tests)
# ===================================================================
class TestCombinedScenarios:
    """End-to-end style tests exercising multiple features together."""

    def test_full_happy_path(self):
        """Full happy path: valid symbol, articles, default pagination."""
        articles = _make_articles(5)
        with _patch_news(articles=articles, source="finnhub"):
            resp = _get("AAPL")
        assert resp.status_code == 200
        body = resp.json()
        assert body["symbol"] == "AAPL"
        assert body["total_count"] == 5
        assert len(body["articles"]) == 5
        assert body["data_source"] == "finnhub"
        assert body["limit"] == 20
        assert body["offset"] == 0

    def test_pagination_with_date_filter(self):
        """Date filter reduces count, pagination slices from that."""
        articles = [
            _sample_article(headline=f"Old {i}", published_at="2026-02-01T10:00:00+00:00")
            for i in range(5)
        ] + [
            _sample_article(headline=f"New {i}", published_at="2026-02-07T10:00:00+00:00")
            for i in range(5)
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-06", limit=3)
        body = resp.json()
        assert body["total_count"] == 5
        assert len(body["articles"]) == 3

    def test_dedup_then_pagination(self):
        """Dedup happens before pagination; total_count reflects deduplicated count."""
        articles = [
            _sample_article(headline="Dupe", source="A"),
            _sample_article(headline="Dupe", source="B"),
            _sample_article(headline="Unique 1"),
            _sample_article(headline="Unique 2"),
            _sample_article(headline="Unique 3"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", limit=2)
        body = resp.json()
        assert body["total_count"] == 4  # 1 dupe + 3 unique
        assert len(body["articles"]) == 2

    def test_category_filter_then_date_filter_then_pagination(self):
        """All filters stack: category -> date -> pagination."""
        articles = [
            _sample_article(headline="C old", category="company",
                            published_at="2026-02-01T10:00:00+00:00"),
            _sample_article(headline="C new", category="company",
                            published_at="2026-02-07T10:00:00+00:00"),
            _sample_article(headline="M new", category="market",
                            published_at="2026-02-07T10:00:00+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company", from_date="2026-02-06", limit=10)
        body = resp.json()
        assert body["total_count"] == 1
        assert body["articles"][0]["headline"] == "C new"

    def test_empty_cache_with_all_params(self):
        """All params provided but cache is empty."""
        with _patch_news(articles=[]):
            resp = _get("AAPL", limit=10, offset=0, from_date="2026-02-01",
                         to_date="2026-02-07", category="company")
        body = resp.json()
        assert body["total_count"] == 0
        assert body["articles"] == []
        assert body["limit"] == 10

    def test_cache_none_with_all_params(self):
        """All params provided but cache returns None."""
        with _patch_news():  # returns None
            resp = _get("AAPL", limit=10, offset=0, from_date="2026-02-01",
                         to_date="2026-02-07", category="all")
        assert resp.status_code == 200
        assert resp.json()["data_source"] == "none"

    def test_large_dataset_pagination(self):
        """Test with a larger dataset to verify pagination integrity."""
        articles = _make_articles(50)
        with _patch_news(articles=articles):
            resp = _get("AAPL", limit=10, offset=20)
        body = resp.json()
        assert body["total_count"] == 50
        assert len(body["articles"]) == 10
        assert body["offset"] == 20

    def test_multiple_requests_independent(self):
        """Two sequential requests return independent results."""
        with _patch_news(articles=[_sample_article(headline="First")]):
            resp1 = _get("AAPL")
        with _patch_news(articles=[_sample_article(headline="Second")]):
            resp2 = _get("MSFT")
        assert resp1.json()["symbol"] == "AAPL"
        assert resp1.json()["articles"][0]["headline"] == "First"
        assert resp2.json()["symbol"] == "MSFT"
        assert resp2.json()["articles"][0]["headline"] == "Second"

    def test_dedup_with_category_filter(self):
        """Dedup and category filter work together."""
        articles = [
            _sample_article(headline="Same", category="company", source="A"),
            _sample_article(headline="Same", category="company", source="B"),
            _sample_article(headline="Market news", category="market"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", category="company")
        body = resp.json()
        # After dedup: "Same" (1 copy), "Market news" (1) = 2 total
        # After category=company: only "Same" = 1
        assert body["total_count"] == 1

    def test_summary_null_becomes_empty_string(self):
        """An article with summary=None should have empty string summary."""
        with _patch_news(articles=[_sample_article(summary=None)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["summary"] == ""

    def test_ordering_preserved(self):
        """Articles maintain their input order from the cache."""
        articles = [
            _sample_article(headline="First"),
            _sample_article(headline="Second"),
            _sample_article(headline="Third"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        headlines = [a["headline"] for a in resp.json()["articles"]]
        assert headlines == ["First", "Second", "Third"]


# ===================================================================
# 11. ID Determinism (4 tests)
# ===================================================================
class TestIdDeterminism:
    """Verify that article IDs are deterministic and stable."""

    def test_same_article_same_id_across_requests(self):
        article = _sample_article()
        with _patch_news(articles=[article]):
            id1 = _get("AAPL").json()["articles"][0]["id"]
        with _patch_news(articles=[article]):
            id2 = _get("AAPL").json()["articles"][0]["id"]
        assert id1 == id2

    def test_id_based_on_source_headline_published_at(self):
        """ID changes when any of source, headline, or published_at changes."""
        base = _sample_article()
        diff_source = _sample_article(source="DifferentSource")
        diff_headline = _sample_article(headline="Different Headline")
        diff_date = _sample_article(published_at="2026-01-01T00:00:00+00:00")

        with _patch_news(articles=[base]):
            id_base = _get("AAPL").json()["articles"][0]["id"]
        with _patch_news(articles=[diff_source]):
            id_source = _get("AAPL").json()["articles"][0]["id"]
        with _patch_news(articles=[diff_headline]):
            id_headline = _get("AAPL").json()["articles"][0]["id"]
        with _patch_news(articles=[diff_date]):
            id_date = _get("AAPL").json()["articles"][0]["id"]

        assert len({id_base, id_source, id_headline, id_date}) == 4

    def test_id_not_affected_by_non_key_fields(self):
        """Changing summary or url does not change the ID."""
        a1 = _sample_article(summary="Summary 1", url="https://a.com")
        a2 = _sample_article(summary="Summary 2", url="https://b.com")
        with _patch_news(articles=[a1]):
            id1 = _get("AAPL").json()["articles"][0]["id"]
        with _patch_news(articles=[a2]):
            id2 = _get("AAPL").json()["articles"][0]["id"]
        assert id1 == id2

    def test_id_matches_sha256_prefix(self):
        """Verify ID matches expected sha256 computation."""
        article = _sample_article(
            source="Reuters",
            headline="Test",
            published_at="2026-02-07T14:30:00+00:00",
        )
        key = "Reuters:Test:2026-02-07T14:30:00+00:00"
        expected = hashlib.sha256(key.encode()).hexdigest()[:12]
        with _patch_news(articles=[article]):
            result_id = _get("AAPL").json()["articles"][0]["id"]
        assert result_id == expected


# ===================================================================
# 12. Date Filtering Edge Cases (5 tests)
# ===================================================================
class TestDateFilteringEdgeCases:
    """Additional date filtering edge cases."""

    def test_article_without_published_at_excluded_by_from_date(self):
        """Article with no published_at has pub_date '' which is < any from_date."""
        articles = [
            _sample_article(headline="No date", published_at=None),
            _sample_article(headline="Has date", published_at="2026-02-07T10:00:00+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-01")
        body = resp.json()
        # pub_date for None published_at = "" which is < "2026-02-01"
        assert body["total_count"] == 1
        assert body["articles"][0]["headline"] == "Has date"

    def test_article_without_published_at_included_without_filters(self):
        articles = [_sample_article(headline="No date", published_at=None)]
        with _patch_news(articles=articles):
            resp = _get("AAPL")
        assert resp.json()["total_count"] == 1

    def test_article_short_published_at_excluded_by_from_date(self):
        """Article with published_at shorter than 10 chars gets empty pub_date."""
        articles = [
            _sample_article(headline="Short date", published_at="2026"),
            _sample_article(headline="Full date", published_at="2026-02-07T10:00:00+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-01-01")
        body = resp.json()
        # "2026" has len < 10, so pub_date = "" which is < "2026-01-01"
        assert body["total_count"] == 1

    def test_from_date_boundary_inclusive(self):
        """from_date is inclusive (pub_date >= from_date)."""
        articles = [
            _sample_article(headline="On boundary", published_at="2026-02-05T10:00:00+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", from_date="2026-02-05")
        assert resp.json()["total_count"] == 1

    def test_to_date_boundary_inclusive(self):
        """to_date is inclusive (pub_date <= to_date)."""
        articles = [
            _sample_article(headline="On boundary", published_at="2026-02-07T23:59:59+00:00"),
        ]
        with _patch_news(articles=articles):
            resp = _get("AAPL", to_date="2026-02-07")
        assert resp.json()["total_count"] == 1


# ===================================================================
# 13. Normalization Edge Cases (5 tests)
# ===================================================================
class TestNormalizationEdgeCases:
    """Additional normalization edge cases."""

    def test_related_integer_returns_empty_list(self):
        """related field as int (not str or list) returns empty list."""
        with _patch_news(articles=[_sample_article(related=42)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == []

    def test_related_single_ticker_string(self):
        with _patch_news(articles=[_sample_article(related="AAPL")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["related_tickers"] == ["AAPL"]

    def test_summary_empty_string_stays_empty(self):
        with _patch_news(articles=[_sample_article(summary="")]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["summary"] == ""

    def test_image_none_maps_to_null(self):
        with _patch_news(articles=[_sample_article(image=None)]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["image_url"] is None

    def test_image_missing_key_maps_to_null(self):
        article = {
            "headline": "No image",
            "source": "Test",
            "published_at": "2026-02-07T10:00:00+00:00",
        }
        with _patch_news(articles=[article]):
            resp = _get("AAPL")
        assert resp.json()["articles"][0]["image_url"] is None
