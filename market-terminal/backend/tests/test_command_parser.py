"""Tests for TASK-GOD-005: command_parser module.

Validates the ``parse_command`` function, ``ParsedCommand`` model, and
``CommandAction`` enum.  Covers all 11 command patterns, natural-language
fallback, edge cases, and model immutability.

Run with: ``pytest tests/test_command_parser.py -v``
"""
from __future__ import annotations

import pytest

from app.agent.command_parser import CommandAction, ParsedCommand, parse_command


# ===================================================================
# 1. Analyze Command
# ===================================================================
class TestAnalyzeCommand:
    """Pattern: ``analyze <symbol>`` or ``a <symbol>``."""

    def test_analyze_aapl(self):
        result = parse_command("analyze AAPL")
        assert result is not None
        assert result.action == CommandAction.ANALYZE
        assert result.symbol == "AAPL"

    def test_shorthand_a_msft(self):
        result = parse_command("a msft")
        assert result is not None
        assert result.action == CommandAction.ANALYZE
        assert result.symbol == "MSFT"

    def test_analyze_uppercase_command(self):
        result = parse_command("ANALYZE AAPL")
        assert result is not None
        assert result.action == CommandAction.ANALYZE
        assert result.symbol == "AAPL"

    def test_analyze_mixed_case_symbol(self):
        result = parse_command("analyze AaPl")
        assert result is not None
        assert result.symbol == "AAPL"

    def test_analyze_leading_trailing_whitespace(self):
        result = parse_command("  analyze  AAPL  ")
        assert result is not None
        assert result.action == CommandAction.ANALYZE
        assert result.symbol == "AAPL"


# ===================================================================
# 2. Watch Add Command
# ===================================================================
class TestWatchAddCommand:
    """Pattern: ``watch add <symbol>`` or ``wa <symbol>``."""

    def test_watch_add_tsla(self):
        result = parse_command("watch add TSLA")
        assert result is not None
        assert result.action == CommandAction.WATCH_ADD
        assert result.symbol == "TSLA"

    def test_shorthand_wa_goog(self):
        result = parse_command("wa goog")
        assert result is not None
        assert result.action == CommandAction.WATCH_ADD
        assert result.symbol == "GOOG"

    def test_watch_add_case_insensitive(self):
        result = parse_command("WATCH ADD tsla")
        assert result is not None
        assert result.action == CommandAction.WATCH_ADD
        assert result.symbol == "TSLA"


# ===================================================================
# 3. Watch Remove Command
# ===================================================================
class TestWatchRemoveCommand:
    """Pattern: ``watch remove <symbol>`` or ``wr <symbol>``."""

    def test_watch_remove_tsla(self):
        result = parse_command("watch remove TSLA")
        assert result is not None
        assert result.action == CommandAction.WATCH_REMOVE
        assert result.symbol == "TSLA"

    def test_shorthand_wr_tsla(self):
        result = parse_command("wr tsla")
        assert result is not None
        assert result.action == CommandAction.WATCH_REMOVE
        assert result.symbol == "TSLA"


# ===================================================================
# 4. Watch List Command
# ===================================================================
class TestWatchListCommand:
    """Pattern: ``watch list`` or ``wl``."""

    def test_watch_list(self):
        result = parse_command("watch list")
        assert result is not None
        assert result.action == CommandAction.WATCH_LIST
        assert result.symbol is None

    def test_shorthand_wl(self):
        result = parse_command("wl")
        assert result is not None
        assert result.action == CommandAction.WATCH_LIST


# ===================================================================
# 5. News Command
# ===================================================================
class TestNewsCommand:
    """Pattern: ``news <symbol>`` or ``n <symbol>``."""

    def test_news_aapl(self):
        result = parse_command("news AAPL")
        assert result is not None
        assert result.action == CommandAction.NEWS
        assert result.symbol == "AAPL"

    def test_shorthand_n_aapl(self):
        result = parse_command("n aapl")
        assert result is not None
        assert result.action == CommandAction.NEWS
        assert result.symbol == "AAPL"


# ===================================================================
# 6. Macro Command
# ===================================================================
class TestMacroCommand:
    """Pattern: ``macro`` or ``m``."""

    def test_macro(self):
        result = parse_command("macro")
        assert result is not None
        assert result.action == CommandAction.MACRO
        assert result.symbol is None

    def test_shorthand_m(self):
        result = parse_command("m")
        assert result is not None
        assert result.action == CommandAction.MACRO


# ===================================================================
# 7. Scan Command
# ===================================================================
class TestScanCommand:
    """Pattern: ``scan [method] [signal]``."""

    def test_scan_bare(self):
        result = parse_command("scan")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method is None
        assert result.signal is None

    def test_scan_wyckoff_bullish(self):
        result = parse_command("scan wyckoff bullish")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method == "wyckoff"
        assert result.signal == "bullish"

    def test_scan_elliott_alias_bearish(self):
        result = parse_command("scan elliott bearish")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method == "elliott_wave"
        assert result.signal == "bearish"

    def test_scan_ict_alias_no_signal(self):
        result = parse_command("scan ict")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method == "ict_smart_money"
        assert result.signal is None

    def test_scan_williams_neutral(self):
        result = parse_command("scan williams neutral")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method == "larry_williams"
        assert result.signal == "neutral"

    def test_scan_invalid_method_returns_none_method(self):
        """Unknown method word is not resolved; method becomes None."""
        result = parse_command("scan invalidmethod")
        assert result is not None
        assert result.action == CommandAction.SCAN
        assert result.method is None

    def test_scan_canslim_alias(self):
        result = parse_command("scan canslim")
        assert result is not None
        assert result.method == "canslim"

    def test_scan_sentiment_alias(self):
        result = parse_command("scan sentiment bullish")
        assert result is not None
        assert result.method == "sentiment"
        assert result.signal == "bullish"

    def test_scan_case_insensitive(self):
        result = parse_command("SCAN WYCKOFF BULLISH")
        assert result is not None
        assert result.method == "wyckoff"
        assert result.signal == "bullish"


# ===================================================================
# 8. Fundamentals Command
# ===================================================================
class TestFundamentalsCommand:
    """Pattern: ``fundamentals <symbol>`` or ``f <symbol>``."""

    def test_fundamentals_aapl(self):
        result = parse_command("fundamentals AAPL")
        assert result is not None
        assert result.action == CommandAction.FUNDAMENTALS
        assert result.symbol == "AAPL"

    def test_shorthand_f_msft(self):
        result = parse_command("f msft")
        assert result is not None
        assert result.action == CommandAction.FUNDAMENTALS
        assert result.symbol == "MSFT"


# ===================================================================
# 9. Insider Command
# ===================================================================
class TestInsiderCommand:
    """Pattern: ``insider <symbol> [days]``."""

    def test_insider_aapl(self):
        result = parse_command("insider AAPL")
        assert result is not None
        assert result.action == CommandAction.INSIDER
        assert result.symbol == "AAPL"
        assert result.days is None

    def test_insider_aapl_30d(self):
        result = parse_command("insider AAPL 30d")
        assert result is not None
        assert result.action == CommandAction.INSIDER
        assert result.symbol == "AAPL"
        assert result.days == 30

    def test_insider_lowercase_90d(self):
        result = parse_command("insider aapl 90d")
        assert result is not None
        assert result.symbol == "AAPL"
        assert result.days == 90

    def test_insider_0d(self):
        result = parse_command("insider AAPL 0d")
        assert result is not None
        assert result.symbol == "AAPL"
        assert result.days == 0

    def test_insider_days_without_d_suffix(self):
        """The regex expects ``\\d+d?`` so ``30`` without ``d`` should also work."""
        result = parse_command("insider AAPL 30")
        assert result is not None
        assert result.days == 30


# ===================================================================
# 10. Compare Command
# ===================================================================
class TestCompareCommand:
    """Pattern: ``compare <symbol1> <symbol2>``."""

    def test_compare_aapl_msft(self):
        result = parse_command("compare AAPL MSFT")
        assert result is not None
        assert result.action == CommandAction.COMPARE
        assert result.symbols == ("AAPL", "MSFT")

    def test_compare_auto_uppercase(self):
        result = parse_command("compare aapl msft")
        assert result is not None
        assert result.symbols == ("AAPL", "MSFT")


# ===================================================================
# 11. Natural Language / No Match (returns None)
# ===================================================================
class TestNaturalLanguageFallback:
    """Inputs that do not match any known command pattern return None."""

    def test_question_returns_none(self):
        assert parse_command("what stocks should I buy?") is None

    def test_freetext_returns_none(self):
        assert parse_command("tell me about inflation") is None

    def test_greeting_returns_none(self):
        assert parse_command("hello") is None

    def test_empty_string_returns_none(self):
        assert parse_command("") is None

    def test_whitespace_only_returns_none(self):
        assert parse_command("   ") is None

    def test_random_sentence_returns_none(self):
        assert parse_command("the quick brown fox jumps over the lazy dog") is None


# ===================================================================
# 12. Edge Cases
# ===================================================================
class TestEdgeCases:
    """Edge cases for the parser."""

    def test_leading_trailing_whitespace_stripped(self):
        result = parse_command("  analyze  AAPL  ")
        assert result is not None
        assert result.symbol == "AAPL"

    def test_all_caps_command(self):
        result = parse_command("ANALYZE AAPL")
        assert result is not None
        assert result.action == CommandAction.ANALYZE

    def test_scan_invalid_method_gives_none_method(self):
        result = parse_command("scan invalidmethod")
        assert result is not None
        assert result.method is None

    def test_frozen_model_immutability(self):
        """ParsedCommand is frozen -- attribute assignment should raise."""
        result = parse_command("analyze AAPL")
        assert result is not None
        with pytest.raises(Exception):
            result.symbol = "MSFT"  # type: ignore[misc]

    def test_dot_in_symbol(self):
        """Symbols like BRK.B should be valid."""
        result = parse_command("analyze BRK.B")
        assert result is not None
        assert result.symbol == "BRK.B"

    def test_hyphen_in_symbol(self):
        """Symbols like BF-B should be valid."""
        result = parse_command("analyze BF-B")
        assert result is not None
        assert result.symbol == "BF-B"


# ===================================================================
# 13. ParsedCommand Model Properties
# ===================================================================
class TestParsedCommandModel:
    """Validate ParsedCommand defaults and structure."""

    def test_default_symbols_is_empty_tuple(self):
        result = parse_command("analyze AAPL")
        assert result is not None
        assert result.symbols == ()

    def test_default_method_is_none(self):
        result = parse_command("analyze AAPL")
        assert result is not None
        assert result.method is None

    def test_default_signal_is_none(self):
        result = parse_command("analyze AAPL")
        assert result is not None
        assert result.signal is None

    def test_default_days_is_none(self):
        result = parse_command("news AAPL")
        assert result is not None
        assert result.days is None

    def test_compare_has_two_symbols(self):
        result = parse_command("compare AAPL GOOG")
        assert result is not None
        assert len(result.symbols) == 2

    def test_action_value_matches_enum(self):
        result = parse_command("analyze AAPL")
        assert result is not None
        assert result.action.value == "analyze"


# ===================================================================
# 14. CommandAction Enum
# ===================================================================
class TestCommandActionEnum:
    """Verify all expected enum members exist."""

    @pytest.mark.parametrize(
        "member,value",
        [
            ("ANALYZE", "analyze"),
            ("WATCH_ADD", "watch_add"),
            ("WATCH_REMOVE", "watch_remove"),
            ("WATCH_LIST", "watch_list"),
            ("NEWS", "news"),
            ("MACRO", "macro"),
            ("SCAN", "scan"),
            ("FUNDAMENTALS", "fundamentals"),
            ("INSIDER", "insider"),
            ("COMPARE", "compare"),
        ],
        ids=lambda x: str(x),
    )
    def test_enum_member_value(self, member, value):
        assert getattr(CommandAction, member).value == value

    def test_enum_member_count(self):
        assert len(CommandAction) == 10


# ===================================================================
# 15. Parametrized Positive Tests
# ===================================================================
class TestParametrizedPositiveMatches:
    """Comprehensive parametrized positive-match tests."""

    @pytest.mark.parametrize(
        "text,expected_action,expected_symbol,expected_method,expected_signal,expected_days,expected_symbols",
        [
            ("analyze AAPL", "analyze", "AAPL", None, None, None, ()),
            ("a msft", "analyze", "MSFT", None, None, None, ()),
            ("watch add TSLA", "watch_add", "TSLA", None, None, None, ()),
            ("wa goog", "watch_add", "GOOG", None, None, None, ()),
            ("watch remove TSLA", "watch_remove", "TSLA", None, None, None, ()),
            ("wr tsla", "watch_remove", "TSLA", None, None, None, ()),
            ("watch list", "watch_list", None, None, None, None, ()),
            ("wl", "watch_list", None, None, None, None, ()),
            ("news AAPL", "news", "AAPL", None, None, None, ()),
            ("n aapl", "news", "AAPL", None, None, None, ()),
            ("macro", "macro", None, None, None, None, ()),
            ("m", "macro", None, None, None, None, ()),
            ("scan", "scan", None, None, None, None, ()),
            ("scan wyckoff bullish", "scan", None, "wyckoff", "bullish", None, ()),
            ("scan elliott bearish", "scan", None, "elliott_wave", "bearish", None, ()),
            ("scan ict", "scan", None, "ict_smart_money", None, None, ()),
            ("scan williams neutral", "scan", None, "larry_williams", "neutral", None, ()),
            ("fundamentals AAPL", "fundamentals", "AAPL", None, None, None, ()),
            ("f msft", "fundamentals", "MSFT", None, None, None, ()),
            ("insider AAPL", "insider", "AAPL", None, None, None, ()),
            ("insider AAPL 30d", "insider", "AAPL", None, None, 30, ()),
            ("insider aapl 90d", "insider", "AAPL", None, None, 90, ()),
            ("compare AAPL MSFT", "compare", None, None, None, None, ("AAPL", "MSFT")),
        ],
        ids=[
            "analyze-AAPL",
            "a-msft",
            "watch-add-TSLA",
            "wa-goog",
            "watch-remove-TSLA",
            "wr-tsla",
            "watch-list",
            "wl",
            "news-AAPL",
            "n-aapl",
            "macro",
            "m",
            "scan-bare",
            "scan-wyckoff-bullish",
            "scan-elliott-bearish",
            "scan-ict",
            "scan-williams-neutral",
            "fundamentals-AAPL",
            "f-msft",
            "insider-AAPL",
            "insider-AAPL-30d",
            "insider-aapl-90d",
            "compare-AAPL-MSFT",
        ],
    )
    def test_positive_match(
        self,
        text,
        expected_action,
        expected_symbol,
        expected_method,
        expected_signal,
        expected_days,
        expected_symbols,
    ):
        result = parse_command(text)
        assert result is not None, f"Expected match for: {text!r}"
        assert result.action.value == expected_action
        assert result.symbol == expected_symbol
        assert result.method == expected_method
        assert result.signal == expected_signal
        assert result.days == expected_days
        assert result.symbols == expected_symbols


# ===================================================================
# 16. Method Alias Coverage
# ===================================================================
class TestMethodAliases:
    """All method aliases resolve correctly."""

    @pytest.mark.parametrize(
        "alias,canonical",
        [
            ("w", "wyckoff"),
            ("wyckoff", "wyckoff"),
            ("ew", "elliott_wave"),
            ("elliott", "elliott_wave"),
            ("elliott_wave", "elliott_wave"),
            ("ict", "ict_smart_money"),
            ("smart_money", "ict_smart_money"),
            ("ict_smart_money", "ict_smart_money"),
            ("c", "canslim"),
            ("canslim", "canslim"),
            ("composite", "composite"),
            ("lw", "larry_williams"),
            ("williams", "larry_williams"),
            ("larry", "larry_williams"),
            ("larry_williams", "larry_williams"),
            ("s", "sentiment"),
            ("sentiment", "sentiment"),
        ],
        ids=lambda x: f"alias-{x}",
    )
    def test_method_alias_resolves(self, alias, canonical):
        result = parse_command(f"scan {alias}")
        assert result is not None
        assert result.method == canonical
