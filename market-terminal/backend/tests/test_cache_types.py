"""Tests for TASK-DATA-008: Cache layer types and constants.

Validates DATA_TYPES, FALLBACK_CHAINS, CachedResult dataclass, and
the format_age() utility in ``app.data.cache_types``.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_cache_types.py -v``
"""
from __future__ import annotations

import dataclasses

import pytest

from app.data.cache_types import (
    FALLBACK_CHAINS,
    DATA_TYPES,
    CachedResult,
    format_age,
)


# ===================================================================
# 1. DATA_TYPES constant
# ===================================================================
class TestDataTypes:
    """Verify the DATA_TYPES list has expected entries."""

    def test_data_types_has_exactly_8_entries(self):
        """DATA_TYPES should contain exactly 8 data type strings."""
        assert len(DATA_TYPES) == 8

    def test_data_types_all_strings(self):
        """Every entry in DATA_TYPES must be a str."""
        for dt in DATA_TYPES:
            assert isinstance(dt, str), f"Expected str, got {type(dt).__name__}: {dt!r}"

    def test_data_types_contains_price(self):
        """DATA_TYPES includes 'price'."""
        assert "price" in DATA_TYPES

    def test_data_types_contains_fundamentals(self):
        """DATA_TYPES includes 'fundamentals'."""
        assert "fundamentals" in DATA_TYPES

    def test_data_types_contains_news(self):
        """DATA_TYPES includes 'news'."""
        assert "news" in DATA_TYPES

    def test_data_types_contains_macro(self):
        """DATA_TYPES includes 'macro'."""
        assert "macro" in DATA_TYPES

    def test_data_types_contains_cot(self):
        """DATA_TYPES includes 'cot'."""
        assert "cot" in DATA_TYPES

    def test_data_types_contains_ownership(self):
        """DATA_TYPES includes 'ownership'."""
        assert "ownership" in DATA_TYPES

    def test_data_types_contains_insider(self):
        """DATA_TYPES includes 'insider'."""
        assert "insider" in DATA_TYPES

    def test_data_types_contains_analysis(self):
        """DATA_TYPES includes 'analysis'."""
        assert "analysis" in DATA_TYPES

    def test_data_types_no_duplicates(self):
        """DATA_TYPES has no duplicate entries."""
        assert len(DATA_TYPES) == len(set(DATA_TYPES))

    def test_data_types_is_list(self):
        """DATA_TYPES is a list (not tuple or set)."""
        assert isinstance(DATA_TYPES, list)


# ===================================================================
# 2. FALLBACK_CHAINS constant
# ===================================================================
class TestFallbackChains:
    """Verify the FALLBACK_CHAINS mapping has correct structure and values."""

    def test_fallback_chains_has_8_entries(self):
        """FALLBACK_CHAINS has one entry for each DATA_TYPE."""
        assert len(FALLBACK_CHAINS) == 8

    def test_fallback_chains_keys_match_data_types(self):
        """Every DATA_TYPE has a corresponding FALLBACK_CHAINS entry."""
        for dt in DATA_TYPES:
            assert dt in FALLBACK_CHAINS, f"Missing FALLBACK_CHAINS key: {dt!r}"

    def test_fallback_chains_no_extra_keys(self):
        """FALLBACK_CHAINS has no keys beyond those in DATA_TYPES."""
        extra = set(FALLBACK_CHAINS.keys()) - set(DATA_TYPES)
        assert extra == set(), f"Unexpected keys in FALLBACK_CHAINS: {extra}"

    def test_all_values_are_lists(self):
        """Every FALLBACK_CHAINS value is a list."""
        for key, chain in FALLBACK_CHAINS.items():
            assert isinstance(chain, list), f"FALLBACK_CHAINS[{key!r}] is {type(chain).__name__}"

    def test_all_sources_are_strings(self):
        """Every source in every chain is a str."""
        for key, chain in FALLBACK_CHAINS.items():
            for source in chain:
                assert isinstance(source, str), (
                    f"FALLBACK_CHAINS[{key!r}] contains non-str: {source!r}"
                )

    def test_price_chain(self):
        """Price fallback chain is ['finnhub', 'yfinance']."""
        assert FALLBACK_CHAINS["price"] == ["finnhub", "yfinance"]

    def test_fundamentals_chain(self):
        """Fundamentals fallback chain is ['edgar', 'yfinance']."""
        assert FALLBACK_CHAINS["fundamentals"] == ["edgar", "yfinance"]

    def test_news_chain(self):
        """News fallback chain is ['finnhub']."""
        assert FALLBACK_CHAINS["news"] == ["finnhub"]

    def test_macro_chain(self):
        """Macro fallback chain is ['fred']."""
        assert FALLBACK_CHAINS["macro"] == ["fred"]

    def test_cot_chain(self):
        """COT fallback chain is ['cftc']."""
        assert FALLBACK_CHAINS["cot"] == ["cftc"]

    def test_ownership_chain(self):
        """Ownership fallback chain is ['edgar']."""
        assert FALLBACK_CHAINS["ownership"] == ["edgar"]

    def test_insider_chain(self):
        """Insider fallback chain is ['edgar']."""
        assert FALLBACK_CHAINS["insider"] == ["edgar"]

    def test_analysis_chain_is_empty(self):
        """Analysis fallback chain is an empty list."""
        assert FALLBACK_CHAINS["analysis"] == []


# ===================================================================
# 3. CachedResult dataclass
# ===================================================================
class TestCachedResult:
    """Verify the CachedResult dataclass properties and field access."""

    def _make_result(self, **overrides) -> CachedResult:
        """Create a CachedResult with sensible defaults, applying overrides."""
        defaults = {
            "data": {"close": 150.0},
            "data_type": "price",
            "cache_key": "price:AAPL",
            "source": "finnhub",
            "is_cached": True,
            "is_stale": False,
            "fetched_at": "2026-02-08T12:00:00Z",
            "cache_age_seconds": 42.5,
            "cache_age_human": "42s ago",
            "ttl_seconds": 300,
            "expires_at": "2026-02-08T12:05:00Z",
        }
        defaults.update(overrides)
        return CachedResult(**defaults)

    def test_create_instance(self):
        """CachedResult can be created with all required fields."""
        result = self._make_result()
        assert result is not None

    def test_field_data(self):
        """data field is accessible and holds the provided value."""
        result = self._make_result(data={"open": 100})
        assert result.data == {"open": 100}

    def test_field_data_type(self):
        """data_type field is accessible."""
        result = self._make_result(data_type="fundamentals")
        assert result.data_type == "fundamentals"

    def test_field_cache_key(self):
        """cache_key field is accessible."""
        result = self._make_result(cache_key="news:TSLA")
        assert result.cache_key == "news:TSLA"

    def test_field_source(self):
        """source field is accessible."""
        result = self._make_result(source="yfinance")
        assert result.source == "yfinance"

    def test_field_is_cached(self):
        """is_cached field is accessible."""
        result = self._make_result(is_cached=False)
        assert result.is_cached is False

    def test_field_is_stale(self):
        """is_stale field is accessible."""
        result = self._make_result(is_stale=True)
        assert result.is_stale is True

    def test_field_fetched_at(self):
        """fetched_at field is accessible."""
        result = self._make_result(fetched_at="2026-01-01T00:00:00Z")
        assert result.fetched_at == "2026-01-01T00:00:00Z"

    def test_field_cache_age_seconds(self):
        """cache_age_seconds field is accessible."""
        result = self._make_result(cache_age_seconds=99.9)
        assert result.cache_age_seconds == 99.9

    def test_field_cache_age_human(self):
        """cache_age_human field is accessible."""
        result = self._make_result(cache_age_human="1m ago")
        assert result.cache_age_human == "1m ago"

    def test_field_ttl_seconds(self):
        """ttl_seconds field is accessible."""
        result = self._make_result(ttl_seconds=600)
        assert result.ttl_seconds == 600

    def test_field_expires_at(self):
        """expires_at field is accessible."""
        result = self._make_result(expires_at="2026-02-08T12:10:00Z")
        assert result.expires_at == "2026-02-08T12:10:00Z"

    def test_has_exactly_11_fields(self):
        """CachedResult has exactly 11 declared fields."""
        assert len(dataclasses.fields(CachedResult)) == 11

    def test_is_frozen_immutable(self):
        """CachedResult is frozen -- attribute assignment raises FrozenInstanceError."""
        result = self._make_result()
        with pytest.raises(dataclasses.FrozenInstanceError):
            result.data = "new_data"  # type: ignore[misc]

    def test_is_frozen_cannot_set_is_cached(self):
        """Cannot modify is_cached on a frozen instance."""
        result = self._make_result(is_cached=True)
        with pytest.raises(dataclasses.FrozenInstanceError):
            result.is_cached = False  # type: ignore[misc]

    def test_uses_slots(self):
        """CachedResult uses __slots__ (no __dict__)."""
        result = self._make_result()
        assert hasattr(result, "__slots__") or not hasattr(result, "__dict__")

    def test_equality_same_values(self):
        """Two CachedResult instances with identical fields are equal."""
        a = self._make_result()
        b = self._make_result()
        assert a == b

    def test_equality_different_values(self):
        """Two CachedResult instances with different fields are not equal."""
        a = self._make_result(source="finnhub")
        b = self._make_result(source="yfinance")
        assert a != b

    def test_data_can_be_none(self):
        """data field can hold None."""
        result = self._make_result(data=None)
        assert result.data is None

    def test_data_can_be_list(self):
        """data field can hold a list."""
        result = self._make_result(data=[1, 2, 3])
        assert result.data == [1, 2, 3]

    def test_data_can_be_string(self):
        """data field can hold a string."""
        result = self._make_result(data="raw text")
        assert result.data == "raw text"


# ===================================================================
# 4. format_age function
# ===================================================================
class TestFormatAge:
    """Verify all branches and edge cases of format_age()."""

    # --- Branch: seconds < 1 -> "just now" ---

    def test_zero_returns_just_now(self):
        """Exactly 0 seconds -> 'just now'."""
        assert format_age(0) == "just now"

    def test_zero_float_returns_just_now(self):
        """0.0 seconds -> 'just now'."""
        assert format_age(0.0) == "just now"

    def test_half_second_returns_just_now(self):
        """0.5 seconds -> 'just now'."""
        assert format_age(0.5) == "just now"

    def test_0_99_returns_just_now(self):
        """0.99 seconds -> 'just now'."""
        assert format_age(0.99) == "just now"

    def test_negative_returns_just_now(self):
        """Negative seconds -> 'just now' (below 1)."""
        assert format_age(-5) == "just now"

    # --- Branch: 1 <= seconds < 60 -> "Ns ago" ---

    def test_exactly_1_second(self):
        """Exactly 1 second -> '1s ago'."""
        assert format_age(1) == "1s ago"

    def test_1_float_returns_1s(self):
        """1.0 seconds -> '1s ago'."""
        assert format_age(1.0) == "1s ago"

    def test_30_seconds(self):
        """30 seconds -> '30s ago'."""
        assert format_age(30) == "30s ago"

    def test_59_seconds(self):
        """59 seconds -> '59s ago'."""
        assert format_age(59) == "59s ago"

    def test_59_9_seconds_truncates(self):
        """59.9 seconds -> int(59.9)=59 -> '59s ago'."""
        assert format_age(59.9) == "59s ago"

    def test_1_5_seconds_truncates(self):
        """1.5 seconds -> int(1.5)=1 -> '1s ago'."""
        assert format_age(1.5) == "1s ago"

    # --- Branch: 60 <= seconds < 3600 -> "Nm ago" ---

    def test_exactly_60_seconds(self):
        """Exactly 60 seconds -> '1m ago'."""
        assert format_age(60) == "1m ago"

    def test_90_seconds(self):
        """90 seconds -> 90//60=1 -> '1m ago'."""
        assert format_age(90) == "1m ago"

    def test_119_seconds(self):
        """119 seconds -> 119//60=1 -> '1m ago'."""
        assert format_age(119) == "1m ago"

    def test_120_seconds(self):
        """120 seconds -> 120//60=2 -> '2m ago'."""
        assert format_age(120) == "2m ago"

    def test_3599_seconds(self):
        """3599 seconds -> 3599//60=59 -> '59m ago'."""
        assert format_age(3599) == "59m ago"

    def test_60_5_seconds_truncates(self):
        """60.5 seconds -> int(60.5)=60 -> 60//60=1 -> '1m ago'."""
        assert format_age(60.5) == "1m ago"

    # --- Branch: 3600 <= seconds < 86400 -> "Nh ago" ---

    def test_exactly_3600_seconds(self):
        """Exactly 3600 seconds -> '1h ago'."""
        assert format_age(3600) == "1h ago"

    def test_7200_seconds(self):
        """7200 seconds -> 7200//3600=2 -> '2h ago'."""
        assert format_age(7200) == "2h ago"

    def test_86399_seconds(self):
        """86399 seconds -> 86399//3600=23 -> '23h ago'."""
        assert format_age(86399) == "23h ago"

    def test_5400_seconds(self):
        """5400 seconds (1.5h) -> 5400//3600=1 -> '1h ago'."""
        assert format_age(5400) == "1h ago"

    def test_3600_5_seconds_truncates(self):
        """3600.5 seconds -> int(3600.5)=3600 -> 3600//3600=1 -> '1h ago'."""
        assert format_age(3600.5) == "1h ago"

    # --- Branch: seconds >= 86400 -> "Nd ago" ---

    def test_exactly_86400_seconds(self):
        """Exactly 86400 seconds (1 day) -> '1d ago'."""
        assert format_age(86400) == "1d ago"

    def test_172800_seconds(self):
        """172800 seconds (2 days) -> '2d ago'."""
        assert format_age(172800) == "2d ago"

    def test_864000_seconds(self):
        """864000 seconds (10 days) -> '10d ago'."""
        assert format_age(864000) == "10d ago"

    def test_large_value_30_days(self):
        """2592000 seconds (30 days) -> '30d ago'."""
        assert format_age(2592000) == "30d ago"

    def test_very_large_value_365_days(self):
        """31536000 seconds (365 days) -> '365d ago'."""
        assert format_age(31536000) == "365d ago"

    def test_86400_5_seconds_truncates(self):
        """86400.5 seconds -> int(86400.5)=86400 -> 86400//86400=1 -> '1d ago'."""
        assert format_age(86400.5) == "1d ago"

    # --- Boundary transitions ---

    def test_boundary_just_below_1(self):
        """0.999 -> 'just now' (boundary just below seconds branch)."""
        assert format_age(0.999) == "just now"

    def test_boundary_at_1(self):
        """1 -> '1s ago' (boundary entering seconds branch)."""
        assert format_age(1) == "1s ago"

    def test_boundary_just_below_60(self):
        """59 -> '59s ago' (boundary just below minutes branch)."""
        assert format_age(59) == "59s ago"

    def test_boundary_at_60(self):
        """60 -> '1m ago' (boundary entering minutes branch)."""
        assert format_age(60) == "1m ago"

    def test_boundary_just_below_3600(self):
        """3599 -> '59m ago' (boundary just below hours branch)."""
        assert format_age(3599) == "59m ago"

    def test_boundary_at_3600(self):
        """3600 -> '1h ago' (boundary entering hours branch)."""
        assert format_age(3600) == "1h ago"

    def test_boundary_just_below_86400(self):
        """86399 -> '23h ago' (boundary just below days branch)."""
        assert format_age(86399) == "23h ago"

    def test_boundary_at_86400(self):
        """86400 -> '1d ago' (boundary entering days branch)."""
        assert format_age(86400) == "1d ago"

    # --- Return type ---

    def test_returns_string(self):
        """format_age always returns a str."""
        assert isinstance(format_age(0), str)
        assert isinstance(format_age(42), str)
        assert isinstance(format_age(500), str)
        assert isinstance(format_age(5000), str)
        assert isinstance(format_age(100000), str)
