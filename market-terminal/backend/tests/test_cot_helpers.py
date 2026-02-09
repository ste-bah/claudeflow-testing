"""Tests for TASK-DATA-007: CFTC COT Helpers (pure functions).

Validates constants, market mappings, CSV parsing, ZIP extraction,
Williams COT index calculation, signal generation, response builders,
and all pure helper utilities in ``app.data.cot_helpers``.

No real network or database calls are made.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_cot_helpers.py -v``
"""
from __future__ import annotations

import io
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.data.cot_helpers import (
    COT_CACHE_SOURCE,
    COT_MARKET_MAP,
    DEFAULT_LOOKBACK_WEEKS,
    ETF_TO_FUTURES,
    EXTREME_BEARISH_THRESHOLD,
    EXTREME_BULLISH_THRESHOLD,
    SYMBOL_TO_CFTC,
    build_market_summary,
    build_report_entry,
    calculate_cot_index,
    extract_csv_from_zip_sync,
    generate_signal,
    get_market_info,
    now_iso,
    parse_cot_csv_sync,
    resolve_market_name,
    tag,
    _delta,
)

# ---------------------------------------------------------------------------
# Sample CSV for parse_cot_csv_sync tests
# ---------------------------------------------------------------------------
SAMPLE_COT_CSV = (
    "Market_and_Exchange_Names,As_of_Date_In_Form_YYMMDD,"
    "Open_Interest_All,NonComml_Positions_Long_All,NonComml_Positions_Short_All,"
    "Comml_Positions_Long_All,Comml_Positions_Short_All,"
    "NonRept_Positions_Long_All,NonRept_Positions_Short_All,"
    "Change_in_Open_Interest_All,"
    "Change_in_NonComml_Long_All,Change_in_NonComml_Short_All,"
    "Change_in_Comml_Long_All,Change_in_Comml_Short_All\n"
    "GOLD - COMEX,260204,500000,150000,80000,200000,250000,50000,70000,10000,5000,3000,2000,4000\n"
    "SILVER - COMEX,260204,100000,30000,20000,40000,50000,10000,10000,2000,1000,500,800,600\n"
    "UNKNOWN MARKET - NOWHERE,260204,1000,500,500,500,500,0,0,0,0,0,0,0\n"
)


def _make_test_zip(csv_text: str) -> bytes:
    """Create a valid ZIP archive containing a .txt file with the given CSV."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("annualof.txt", csv_text)
    return buf.getvalue()


# ===================================================================
# 1. Constants
# ===================================================================
class TestConstants:
    """Verify constant dicts have expected sizes and shapes."""

    def test_cot_market_map_has_17_entries(self):
        """COT_MARKET_MAP should contain exactly 17 market mappings."""
        assert len(COT_MARKET_MAP) == 17

    def test_etf_to_futures_has_16_entries(self):
        """ETF_TO_FUTURES should contain exactly 16 ETF mappings."""
        assert len(ETF_TO_FUTURES) == 16

    def test_symbol_to_cftc_is_correct_reverse_map(self):
        """SYMBOL_TO_CFTC should reverse-map every symbol in COT_MARKET_MAP."""
        for cftc_name, info in COT_MARKET_MAP.items():
            sym = info["symbol"]
            assert sym in SYMBOL_TO_CFTC, f"Symbol '{sym}' missing from SYMBOL_TO_CFTC"
            assert SYMBOL_TO_CFTC[sym] == cftc_name

    def test_symbol_to_cftc_same_length_as_market_map(self):
        """SYMBOL_TO_CFTC should have the same number of entries as COT_MARKET_MAP."""
        assert len(SYMBOL_TO_CFTC) == len(COT_MARKET_MAP)

    def test_all_market_map_entries_have_required_keys(self):
        """Every COT_MARKET_MAP entry has symbol, display, asset_class."""
        for name, info in COT_MARKET_MAP.items():
            assert "symbol" in info, f"Missing 'symbol' in {name}"
            assert "display" in info, f"Missing 'display' in {name}"
            assert "asset_class" in info, f"Missing 'asset_class' in {name}"

    def test_all_etf_to_futures_values_exist_in_market_map(self):
        """Every ETF_TO_FUTURES value should be a valid COT_MARKET_MAP key."""
        for etf, cftc_name in ETF_TO_FUTURES.items():
            assert cftc_name in COT_MARKET_MAP, (
                f"ETF '{etf}' maps to '{cftc_name}' which is not in COT_MARKET_MAP"
            )

    def test_thresholds(self):
        """Signal thresholds are 80 and 20."""
        assert EXTREME_BULLISH_THRESHOLD == 80
        assert EXTREME_BEARISH_THRESHOLD == 20

    def test_default_lookback(self):
        """Default lookback is 52 weeks."""
        assert DEFAULT_LOOKBACK_WEEKS == 52

    def test_cache_source(self):
        """Cache source is 'cftc'."""
        assert COT_CACHE_SOURCE == "cftc"

    def test_expected_symbols_present(self):
        """Spot-check well-known futures symbols."""
        expected = ["GC", "SI", "CL", "ES", "NQ", "ZN", "ZB", "6E"]
        for sym in expected:
            assert sym in SYMBOL_TO_CFTC, f"Expected symbol '{sym}' missing"


# ===================================================================
# 2. now_iso
# ===================================================================
class TestNowIso:
    """The now_iso utility function."""

    def test_returns_string(self):
        result = now_iso()
        assert isinstance(result, str)

    def test_contains_t_separator(self):
        result = now_iso()
        assert "T" in result

    def test_parseable_as_datetime(self):
        from datetime import datetime
        result = now_iso()
        dt = datetime.fromisoformat(result)
        assert dt.tzinfo is not None


# ===================================================================
# 3. tag
# ===================================================================
class TestTag:
    """The tag() metadata decorator function."""

    def test_tag_dict(self):
        """Adds _source, _fetched_at, _cached to a single dict."""
        data = {"value": 42}
        result = tag(data)
        assert result is data
        assert result["_source"] == "cftc"
        assert "_fetched_at" in result
        assert result["_cached"] is False

    def test_tag_dict_cached_true(self):
        """cached=True sets _cached=True."""
        data = {"value": 42}
        result = tag(data, cached=True)
        assert result["_cached"] is True

    def test_tag_dict_cached_false(self):
        """Default cached=False sets _cached=False."""
        data = {"value": 42}
        result = tag(data, cached=False)
        assert result["_cached"] is False

    def test_tag_list(self):
        """Tags each dict in a list."""
        data = [{"a": 1}, {"b": 2}, {"c": 3}]
        result = tag(data)
        assert isinstance(result, list)
        assert len(result) == 3
        for item in result:
            assert item["_source"] == "cftc"
            assert "_fetched_at" in item
            assert item["_cached"] is False

    def test_tag_list_cached_true(self):
        """cached=True applies to all items in a list."""
        data = [{"a": 1}, {"b": 2}]
        result = tag(data, cached=True)
        for item in result:
            assert item["_cached"] is True

    def test_tag_preserves_existing_keys(self):
        """Does not remove existing keys."""
        data = {"market": "gold", "price": 2000}
        result = tag(data)
        assert result["market"] == "gold"
        assert result["price"] == 2000

    def test_tag_non_dict_non_list_returns_input(self):
        """A non-dict, non-list input is returned unchanged."""
        assert tag("string") == "string"
        assert tag(42) == 42
        assert tag(None) is None


# ===================================================================
# 4. resolve_market_name
# ===================================================================
class TestResolveMarketName:
    """The resolve_market_name() function."""

    def test_etf_mapping_gld(self):
        """GLD maps to GOLD - COMEX."""
        assert resolve_market_name("GLD") == "GOLD - COMEX"

    def test_etf_mapping_spy(self):
        """SPY maps to E-MINI S&P 500."""
        assert resolve_market_name("SPY") == "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE"

    def test_etf_mapping_qqq(self):
        """QQQ maps to NASDAQ-100."""
        assert resolve_market_name("QQQ") == "NASDAQ-100 STOCK INDEX (MINI) - CHICAGO MERCANTILE EXCHANGE"

    def test_etf_mapping_tlt(self):
        """TLT maps to U.S. TREASURY BONDS."""
        assert resolve_market_name("TLT") == "U.S. TREASURY BONDS - CHICAGO BOARD OF TRADE"

    def test_futures_symbol_gc(self):
        """GC (futures) maps to GOLD - COMEX."""
        assert resolve_market_name("GC") == "GOLD - COMEX"

    def test_futures_symbol_es(self):
        """ES (futures) maps to E-MINI S&P 500."""
        assert resolve_market_name("ES") == "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE"

    def test_futures_symbol_zn(self):
        """ZN (futures) maps to 10-YEAR U.S. TREASURY NOTES."""
        assert resolve_market_name("ZN") == "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE"

    def test_direct_cftc_name(self):
        """A direct CFTC name matches itself."""
        assert resolve_market_name("GOLD - COMEX") == "GOLD - COMEX"

    def test_unknown_returns_none(self):
        """Unknown symbol returns None."""
        assert resolve_market_name("ZZZZZ") is None

    def test_unknown_random_string(self):
        """Random string returns None."""
        assert resolve_market_name("FOOBAR123") is None

    def test_case_insensitive_etf(self):
        """ETF lookup is case insensitive."""
        assert resolve_market_name("gld") == "GOLD - COMEX"
        assert resolve_market_name("Gld") == "GOLD - COMEX"

    def test_case_insensitive_futures(self):
        """Futures symbol lookup is case insensitive."""
        assert resolve_market_name("gc") == "GOLD - COMEX"
        assert resolve_market_name("Gc") == "GOLD - COMEX"

    def test_whitespace_stripped(self):
        """Leading/trailing whitespace is stripped."""
        assert resolve_market_name("  GLD  ") == "GOLD - COMEX"

    def test_empty_string_returns_none(self):
        """Empty string returns None."""
        assert resolve_market_name("") is None


# ===================================================================
# 5. get_market_info
# ===================================================================
class TestGetMarketInfo:
    """The get_market_info() function."""

    def test_known_market(self):
        """Returns info dict for a known CFTC market name."""
        info = get_market_info("GOLD - COMEX")
        assert info is not None
        assert info["symbol"] == "GC"
        assert info["display"] == "Gold"
        assert info["asset_class"] == "commodity"

    def test_unknown_market_returns_none(self):
        """Returns None for an unknown market name."""
        assert get_market_info("NONEXISTENT MARKET") is None

    def test_returns_dict_with_all_keys(self):
        """Result dict has symbol, display, asset_class."""
        for name in COT_MARKET_MAP:
            info = get_market_info(name)
            assert "symbol" in info
            assert "display" in info
            assert "asset_class" in info


# ===================================================================
# 6. calculate_cot_index
# ===================================================================
class TestCalculateCotIndex:
    """The calculate_cot_index() Williams formula implementation."""

    def test_normal_case(self):
        """Normal case: index for a known sequence."""
        # [10, 20, 30, 40, 50] -> current=50, min=10, max=50
        # (50-10)/(50-10)*100 = 100.0
        assert calculate_cot_index([10, 20, 30, 40, 50]) == 100.0

    def test_normal_midpoint(self):
        """Midpoint should be 50."""
        # [0, 50, 100] -> current=100, min=0, max=100 -> 100.0
        # Actually let's pick a true midpoint:
        # [0, 100, 50] -> current=50, min=0, max=100 -> 50.0
        assert calculate_cot_index([0, 100, 50]) == 50.0

    def test_empty_list_returns_50(self):
        """Empty list returns default 50.0."""
        assert calculate_cot_index([]) == 50.0

    def test_single_value_returns_50(self):
        """Single value returns 50.0 (can't compute range)."""
        assert calculate_cot_index([42]) == 50.0

    def test_all_same_returns_50(self):
        """All identical values returns 50.0 (division by zero guard)."""
        assert calculate_cot_index([10, 10, 10, 10, 10]) == 50.0

    def test_boundary_zero(self):
        """When current equals min, index is 0."""
        # [50, 40, 30, 20, 10] -> current=10, min=10, max=50 -> 0.0
        assert calculate_cot_index([50, 40, 30, 20, 10]) == 0.0

    def test_boundary_hundred(self):
        """When current equals max, index is 100."""
        # [10, 20, 30, 40, 50] -> current=50, min=10, max=50 -> 100.0
        assert calculate_cot_index([10, 20, 30, 40, 50]) == 100.0

    def test_lookback_smaller_than_data(self):
        """Lookback window smaller than data length only considers the tail."""
        # Data: [100, 0, 25, 50, 75], lookback=3 -> window=[25, 50, 75]
        # current=75, min=25, max=75 -> (75-25)/(75-25)*100 = 100.0
        assert calculate_cot_index([100, 0, 25, 50, 75], lookback=3) == 100.0

    def test_lookback_larger_than_data(self):
        """Lookback larger than data uses all available data."""
        # Data: [10, 20, 30], lookback=100 -> window=[10, 20, 30]
        # current=30, min=10, max=30 -> 100.0
        assert calculate_cot_index([10, 20, 30], lookback=100) == 100.0

    def test_negative_positions(self):
        """Works with negative net position values."""
        # [-50, -30, -10] -> current=-10, min=-50, max=-10 -> 100.0
        assert calculate_cot_index([-50, -30, -10]) == 100.0

    def test_mixed_positive_negative(self):
        """Works with a mix of positive and negative values."""
        # [-100, 0, 100] -> current=100, min=-100, max=100 -> 100.0
        assert calculate_cot_index([-100, 0, 100]) == 100.0

    def test_result_clamped_between_0_and_100(self):
        """Result is always between 0 and 100."""
        result = calculate_cot_index([1, 2, 3, 4, 5])
        assert 0.0 <= result <= 100.0

    def test_two_values(self):
        """Two values: minimum valid input."""
        # [0, 100] -> current=100, min=0, max=100 -> 100.0
        assert calculate_cot_index([0, 100]) == 100.0
        # [100, 0] -> current=0, min=0, max=100 -> 0.0
        assert calculate_cot_index([100, 0]) == 0.0

    def test_default_lookback_is_52(self):
        """Default lookback parameter is DEFAULT_LOOKBACK_WEEKS (52)."""
        # Just verify it doesn't error with a long list
        data = list(range(100))
        result = calculate_cot_index(data)
        assert 0.0 <= result <= 100.0


# ===================================================================
# 7. parse_cot_csv_sync
# ===================================================================
class TestParseCotCsvSync:
    """The parse_cot_csv_sync() CSV parser."""

    def test_valid_csv_parses_known_markets(self):
        """Parses valid CSV and returns records for known markets only."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        # GOLD and SILVER are in COT_MARKET_MAP; UNKNOWN is not
        assert len(records) == 2

    def test_gold_record_fields(self):
        """GOLD record has correct field values."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        gold = [r for r in records if r["market_name"] == "GOLD - COMEX"][0]
        assert gold["symbol"] == "GC"
        assert gold["display_name"] == "Gold"
        assert gold["asset_class"] == "commodity"
        assert gold["report_date"] == "2026-02-04"
        assert gold["commercial_long"] == 200000
        assert gold["commercial_short"] == 250000
        assert gold["commercial_net"] == -50000  # 200000 - 250000
        assert gold["speculative_long"] == 150000
        assert gold["speculative_short"] == 80000
        assert gold["speculative_net"] == 70000  # 150000 - 80000
        assert gold["small_trader_long"] == 50000
        assert gold["small_trader_short"] == 70000
        assert gold["small_trader_net"] == -20000
        assert gold["open_interest"] == 500000
        assert gold["open_interest_change"] == 10000

    def test_silver_record_present(self):
        """SILVER record is parsed correctly."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        silver = [r for r in records if r["market_name"] == "SILVER - COMEX"][0]
        assert silver["symbol"] == "SI"
        assert silver["commercial_long"] == 40000
        assert silver["commercial_short"] == 50000

    def test_empty_csv_returns_empty(self):
        """Empty CSV text returns empty list."""
        assert parse_cot_csv_sync("") == []

    def test_missing_columns_returns_empty(self):
        """CSV with wrong column names returns empty list."""
        bad_csv = "col_a,col_b\n1,2\n"
        assert parse_cot_csv_sync(bad_csv) == []

    def test_unknown_market_filtered_out(self):
        """Markets not in COT_MARKET_MAP are filtered out."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        names = [r["market_name"] for r in records]
        assert "UNKNOWN MARKET - NOWHERE" not in names

    def test_header_only_csv(self):
        """CSV with only header returns empty list."""
        header_only = (
            "Market_and_Exchange_Names,As_of_Date_In_Form_YYMMDD,"
            "Open_Interest_All,NonComml_Positions_Long_All,NonComml_Positions_Short_All,"
            "Comml_Positions_Long_All,Comml_Positions_Short_All,"
            "NonRept_Positions_Long_All,NonRept_Positions_Short_All,"
            "Change_in_Open_Interest_All,"
            "Change_in_NonComml_Long_All,Change_in_NonComml_Short_All,"
            "Change_in_Comml_Long_All,Change_in_Comml_Short_All\n"
        )
        assert parse_cot_csv_sync(header_only) == []

    def test_commercial_change_calculated(self):
        """commercial_change is (comm_long_chg - comm_short_chg)."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        gold = [r for r in records if r["market_name"] == "GOLD - COMEX"][0]
        # comm_long_chg=2000, comm_short_chg=4000 -> 2000-4000 = -2000
        assert gold["commercial_change"] == -2000

    def test_speculative_change_calculated(self):
        """speculative_change is (spec_long_chg - spec_short_chg)."""
        records = parse_cot_csv_sync(SAMPLE_COT_CSV)
        gold = [r for r in records if r["market_name"] == "GOLD - COMEX"][0]
        # spec_long_chg=5000, spec_short_chg=3000 -> 5000-3000 = 2000
        assert gold["speculative_change"] == 2000


# ===================================================================
# 8. extract_csv_from_zip_sync
# ===================================================================
class TestExtractCsvFromZipSync:
    """The extract_csv_from_zip_sync() ZIP extraction function."""

    def test_valid_zip_with_txt(self):
        """Extracts .txt content from a valid ZIP."""
        zip_bytes = _make_test_zip(SAMPLE_COT_CSV)
        result = extract_csv_from_zip_sync(zip_bytes)
        assert result is not None
        assert "GOLD - COMEX" in result

    def test_valid_zip_with_csv_extension(self):
        """Extracts .csv content from a valid ZIP."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("data.csv", "hello,world\n1,2\n")
        result = extract_csv_from_zip_sync(buf.getvalue())
        assert result is not None
        assert "hello,world" in result

    def test_corrupt_zip_returns_none(self):
        """Corrupt ZIP data returns None."""
        assert extract_csv_from_zip_sync(b"this is not a zip") is None

    def test_empty_zip_returns_none(self):
        """Empty ZIP (no files) returns None."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            pass  # no files written
        result = extract_csv_from_zip_sync(buf.getvalue())
        assert result is None

    def test_zip_without_txt_or_csv_returns_none(self):
        """ZIP containing only non-txt/non-csv files returns None."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("data.json", '{"key": "value"}')
        result = extract_csv_from_zip_sync(buf.getvalue())
        assert result is None

    def test_empty_bytes_returns_none(self):
        """Empty bytes returns None."""
        assert extract_csv_from_zip_sync(b"") is None

    def test_extracts_first_matching_file(self):
        """Extracts the first .txt/.csv file found in the ZIP."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("first.txt", "first content")
            zf.writestr("second.txt", "second content")
        result = extract_csv_from_zip_sync(buf.getvalue())
        assert result is not None
        assert "first content" in result


# ===================================================================
# 9. build_report_entry
# ===================================================================
class TestBuildReportEntry:
    """The build_report_entry() response builder."""

    def test_with_indices(self):
        """Builds entry with commercial_index and speculative_index."""
        row = {
            "market_name": "GOLD - COMEX",
            "report_date": "2026-02-04",
            "commercial_long": 200000,
            "commercial_short": 250000,
            "commercial_net": -50000,
            "commercial_change": -2000,
            "speculative_long": 150000,
            "speculative_short": 80000,
            "speculative_net": 70000,
            "speculative_change": 2000,
            "small_trader_long": 50000,
            "small_trader_short": 70000,
            "small_trader_net": -20000,
            "open_interest": 500000,
            "open_interest_change": 10000,
        }
        entry = build_report_entry(row, commercial_index=75.5, speculative_index=62.3)
        assert entry["market_name"] == "GOLD - COMEX"
        assert entry["symbol"] == "GC"
        assert entry["display_name"] == "Gold"
        assert entry["asset_class"] == "commodity"
        assert entry["report_date"] == "2026-02-04"
        assert entry["commercial_index"] == 75.5
        assert entry["speculative_index"] == 62.3
        assert entry["commercial_long"] == 200000
        assert entry["commercial_short"] == 250000
        assert entry["commercial_net"] == -50000
        assert entry["open_interest"] == 500000

    def test_without_indices(self):
        """Builds entry with None indices when not provided."""
        row = {
            "market_name": "GOLD - COMEX",
            "report_date": "2026-02-04",
        }
        entry = build_report_entry(row)
        assert entry["commercial_index"] is None
        assert entry["speculative_index"] is None

    def test_with_market_info(self):
        """Known market populates symbol, display_name, asset_class."""
        row = {"market_name": "SILVER - COMEX", "report_date": "2026-02-04"}
        entry = build_report_entry(row)
        assert entry["symbol"] == "SI"
        assert entry["display_name"] == "Silver"
        assert entry["asset_class"] == "commodity"

    def test_unknown_market_sets_none(self):
        """Unknown market sets symbol/display_name/asset_class to None."""
        row = {"market_name": "NONEXISTENT MARKET", "report_date": "2026-02-04"}
        entry = build_report_entry(row)
        assert entry["symbol"] is None
        assert entry["display_name"] is None
        assert entry["asset_class"] is None

    def test_missing_keys_default_to_zero(self):
        """Missing optional keys default to 0."""
        row = {"market_name": "GOLD - COMEX", "report_date": "2026-02-04"}
        entry = build_report_entry(row)
        assert entry["commercial_long"] == 0
        assert entry["speculative_net"] == 0
        assert entry["open_interest"] == 0
        assert entry["open_interest_change"] == 0


# ===================================================================
# 10. generate_signal
# ===================================================================
class TestGenerateSignal:
    """The generate_signal() function."""

    def test_bullish_commercial_high(self):
        """Bullish when commercial_index >= 80."""
        signal = generate_signal(85.0, 50.0)
        assert signal["direction"] == "bullish"
        assert "bullish" in signal["reasoning"].lower()

    def test_bullish_speculative_low(self):
        """Bullish when speculative_index <= 20."""
        signal = generate_signal(50.0, 15.0)
        assert signal["direction"] == "bullish"

    def test_bearish_commercial_low(self):
        """Bearish when commercial_index <= 20."""
        signal = generate_signal(15.0, 50.0)
        assert signal["direction"] == "bearish"
        assert "bearish" in signal["reasoning"].lower()

    def test_bearish_speculative_high(self):
        """Bearish when speculative_index >= 80."""
        signal = generate_signal(50.0, 85.0)
        assert signal["direction"] == "bearish"

    def test_neutral_middle_values(self):
        """Neutral when both indices are in the middle range."""
        signal = generate_signal(50.0, 50.0)
        assert signal["direction"] == "neutral"

    def test_conflicting_signals_neutral(self):
        """Both bullish and bearish triggers -> neutral."""
        # commercial_index=85 (bullish trigger) AND speculative_index=85 (bearish trigger)
        signal = generate_signal(85.0, 85.0)
        assert signal["direction"] == "neutral"

    def test_conflicting_both_extreme_neutral(self):
        """commercial low AND speculative low -> neutral (both+bullish, both+bearish)."""
        # commercial_index=15 (bearish) and speculative_index=15 (bullish)
        # bullish: comm>=80 OR spec<=20 -> spec<=20 is True -> bullish=True
        # bearish: comm<=20 OR spec>=80 -> comm<=20 is True -> bearish=True
        # Both true -> neutral
        signal = generate_signal(15.0, 15.0)
        assert signal["direction"] == "neutral"

    def test_boundary_exactly_80_commercial(self):
        """Exactly 80 for commercial_index triggers bullish."""
        signal = generate_signal(80.0, 50.0)
        assert signal["direction"] == "bullish"

    def test_boundary_exactly_20_commercial(self):
        """Exactly 20 for commercial_index triggers bearish."""
        signal = generate_signal(20.0, 50.0)
        assert signal["direction"] == "bearish"

    def test_boundary_exactly_80_speculative(self):
        """Exactly 80 for speculative_index triggers bearish."""
        signal = generate_signal(50.0, 80.0)
        assert signal["direction"] == "bearish"

    def test_boundary_exactly_20_speculative(self):
        """Exactly 20 for speculative_index triggers bullish."""
        signal = generate_signal(50.0, 20.0)
        assert signal["direction"] == "bullish"

    def test_boundary_79_no_trigger(self):
        """79 for commercial_index does NOT trigger bullish on its own."""
        signal = generate_signal(79.0, 50.0)
        assert signal["direction"] == "neutral"

    def test_boundary_21_no_trigger(self):
        """21 for commercial_index does NOT trigger bearish on its own."""
        signal = generate_signal(21.0, 50.0)
        assert signal["direction"] == "neutral"

    def test_reasoning_contains_percentile(self):
        """Reasoning text includes percentile information."""
        signal = generate_signal(90.0, 50.0)
        assert "percentile" in signal["reasoning"].lower() or "90" in signal["reasoning"]


# ===================================================================
# 11. build_market_summary
# ===================================================================
class TestBuildMarketSummary:
    """The build_market_summary() response builder."""

    def _make_historical(self, count=10, base_net=50000):
        """Generate a historical data list (most recent first, descending)."""
        rows = []
        for i in range(count):
            rows.append({
                "report_date": f"2026-01-{28 - i:02d}",
                "commercial_net": base_net - (i * 1000),
                "speculative_net": -(base_net - (i * 1000)),
                "open_interest": 500000 + (i * 500),
            })
        return rows

    def test_normal_case(self):
        """Builds a summary with commercial, speculative, open_interest, signal."""
        historical = self._make_historical(10)
        summary = build_market_summary("GOLD - COMEX", historical)
        assert summary is not None
        assert summary["market_name"] == "GOLD - COMEX"
        assert summary["symbol"] == "GC"
        assert summary["display_name"] == "Gold"
        assert "commercial" in summary
        assert "speculative" in summary
        assert "open_interest" in summary
        assert "signal" in summary
        assert summary["latest_report_date"] == "2026-01-28"

    def test_empty_list_returns_none(self):
        """Empty historical list returns None."""
        assert build_market_summary("GOLD - COMEX", []) is None

    def test_single_row_no_changes(self):
        """Single row: indices are 50.0, changes are None."""
        rows = [{
            "report_date": "2026-02-04",
            "commercial_net": 10000,
            "speculative_net": -10000,
            "open_interest": 500000,
        }]
        summary = build_market_summary("GOLD - COMEX", rows)
        assert summary is not None
        # With single row, COT index returns 50.0
        assert summary["commercial"]["index"] == 50.0
        assert summary["speculative"]["index"] == 50.0
        # 1w/4w changes are None (not enough data)
        assert summary["commercial"]["change_1w"] is None
        assert summary["commercial"]["change_4w"] is None

    def test_multiple_rows_with_changes(self):
        """Multiple rows compute 1w and 4w changes."""
        historical = self._make_historical(10)
        summary = build_market_summary("GOLD - COMEX", historical)
        # 1w change: rows[0] - rows[1]
        assert summary["commercial"]["change_1w"] is not None
        assert summary["commercial"]["change_1w"] == 1000  # 50000 - 49000
        # 4w change: rows[0] - rows[4]
        assert summary["commercial"]["change_4w"] is not None
        assert summary["commercial"]["change_4w"] == 4000  # 50000 - 46000

    def test_direction_long(self):
        """Commercial direction is 'long' when net > 0."""
        rows = [{
            "report_date": "2026-02-04",
            "commercial_net": 10000,
            "speculative_net": -5000,
            "open_interest": 500000,
        }]
        summary = build_market_summary("GOLD - COMEX", rows)
        assert summary["commercial"]["direction"] == "long"

    def test_direction_short(self):
        """Commercial direction is 'short' when net <= 0."""
        rows = [{
            "report_date": "2026-02-04",
            "commercial_net": -10000,
            "speculative_net": 5000,
            "open_interest": 500000,
        }]
        summary = build_market_summary("GOLD - COMEX", rows)
        assert summary["commercial"]["direction"] == "short"

    def test_open_interest_changes(self):
        """Open interest 1w and 4w changes are computed."""
        historical = self._make_historical(10)
        summary = build_market_summary("GOLD - COMEX", historical)
        assert summary["open_interest"]["change_1w"] is not None
        assert summary["open_interest"]["change_4w"] is not None

    def test_unknown_market_still_builds(self):
        """Unknown market returns summary with None symbol/display_name."""
        rows = [{
            "report_date": "2026-02-04",
            "commercial_net": 10000,
            "speculative_net": -5000,
            "open_interest": 500000,
        }]
        summary = build_market_summary("NONEXISTENT", rows)
        assert summary is not None
        assert summary["symbol"] is None
        assert summary["display_name"] is None


# ===================================================================
# 12. _delta
# ===================================================================
class TestDelta:
    """The _delta() helper for week-over-week changes."""

    def test_normal_delta(self):
        """Computes difference between rows[0] and rows[offset]."""
        rows = [
            {"commercial_net": 50000},
            {"commercial_net": 48000},
            {"commercial_net": 45000},
        ]
        assert _delta(rows, "commercial_net", 1) == 2000
        assert _delta(rows, "commercial_net", 2) == 5000

    def test_insufficient_rows_returns_none(self):
        """Returns None when offset exceeds available rows."""
        rows = [{"commercial_net": 50000}]
        assert _delta(rows, "commercial_net", 1) is None
        assert _delta(rows, "commercial_net", 5) is None

    def test_empty_rows_returns_none(self):
        """Returns None for empty rows list."""
        assert _delta([], "commercial_net", 1) is None

    def test_none_current_returns_none(self):
        """Returns None when current value is None."""
        rows = [
            {"commercial_net": None},
            {"commercial_net": 48000},
        ]
        assert _delta(rows, "commercial_net", 1) is None

    def test_none_previous_returns_none(self):
        """Returns None when previous value is None."""
        rows = [
            {"commercial_net": 50000},
            {"commercial_net": None},
        ]
        assert _delta(rows, "commercial_net", 1) is None

    def test_missing_key_returns_none(self):
        """Returns None when key is missing from row dict."""
        rows = [{"other_key": 100}, {"other_key": 200}]
        assert _delta(rows, "commercial_net", 1) is None

    def test_negative_delta(self):
        """Handles negative deltas correctly."""
        rows = [
            {"value": 100},
            {"value": 200},
        ]
        assert _delta(rows, "value", 1) == -100

    def test_zero_delta(self):
        """Handles zero delta correctly."""
        rows = [
            {"value": 100},
            {"value": 100},
        ]
        assert _delta(rows, "value", 1) == 0


# ===================================================================
# 13. Cache helpers (async -- mocked DB)
# ===================================================================
class TestGetCachedCotData:
    """The get_cached_cot_data() async cache reader."""

    @pytest.mark.asyncio
    async def test_returns_rows_when_fresh(self):
        """Returns rows when data is within TTL."""
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).isoformat()
        rows = [
            {"market_name": "GOLD - COMEX", "report_date": "2026-02-04",
             "commercial_long": 200000, "commercial_short": 250000,
             "commercial_net": -50000, "speculative_long": 150000,
             "speculative_short": 80000, "speculative_net": 70000,
             "open_interest": 500000, "fetched_at": now_str},
        ]
        mock_db = AsyncMock()
        mock_db.fetch_all = AsyncMock(return_value=rows)
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_cot_data
            result = await get_cached_cot_data("GOLD - COMEX", 52, 604800)
        assert result is not None
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_none_when_expired(self):
        """Returns None when data is beyond TTL."""
        from datetime import datetime, timezone, timedelta
        old_str = (datetime.now(timezone.utc) - timedelta(seconds=700000)).isoformat()
        rows = [
            {"market_name": "GOLD - COMEX", "report_date": "2026-02-04",
             "commercial_long": 200000, "commercial_short": 250000,
             "commercial_net": -50000, "speculative_long": 150000,
             "speculative_short": 80000, "speculative_net": 70000,
             "open_interest": 500000, "fetched_at": old_str},
        ]
        mock_db = AsyncMock()
        mock_db.fetch_all = AsyncMock(return_value=rows)
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_cot_data
            result = await get_cached_cot_data("GOLD - COMEX", 52, 604800)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_rows(self):
        """Returns None when no cached rows exist."""
        mock_db = AsyncMock()
        mock_db.fetch_all = AsyncMock(return_value=[])
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_cot_data
            result = await get_cached_cot_data("GOLD - COMEX", 52, 604800)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_fetched_at(self):
        """Returns None when fetched_at is not parseable."""
        rows = [
            {"market_name": "GOLD - COMEX", "report_date": "2026-02-04",
             "commercial_long": 200000, "commercial_short": 250000,
             "commercial_net": -50000, "speculative_long": 150000,
             "speculative_short": 80000, "speculative_net": 70000,
             "open_interest": 500000, "fetched_at": "not-a-date"},
        ]
        mock_db = AsyncMock()
        mock_db.fetch_all = AsyncMock(return_value=rows)
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_cot_data
            result = await get_cached_cot_data("GOLD - COMEX", 52, 604800)
        assert result is None


class TestGetCachedCurrentReport:
    """The get_cached_current_report() async cache reader."""

    @pytest.mark.asyncio
    async def test_returns_rows_when_fresh(self):
        """Returns rows for the most recent report date when within TTL."""
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).isoformat()
        latest = {"report_date": "2026-02-04", "fetched_at": now_str}
        rows = [
            {"market_name": "GOLD - COMEX", "report_date": "2026-02-04",
             "commercial_long": 200000, "commercial_short": 250000,
             "commercial_net": -50000, "speculative_long": 150000,
             "speculative_short": 80000, "speculative_net": 70000,
             "open_interest": 500000, "fetched_at": now_str},
        ]
        mock_db = AsyncMock()
        mock_db.fetch_one = AsyncMock(return_value=latest)
        mock_db.fetch_all = AsyncMock(return_value=rows)
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_current_report
            result = await get_cached_current_report(604800)
        assert result is not None
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_none_when_no_data(self):
        """Returns None when no data in database."""
        mock_db = AsyncMock()
        mock_db.fetch_one = AsyncMock(return_value=None)
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import get_cached_current_report
            result = await get_cached_current_report(604800)
        assert result is None


class TestStoreCotRows:
    """The store_cot_rows() async cache writer."""

    @pytest.mark.asyncio
    async def test_stores_rows(self):
        """Calls executemany with correct parameters."""
        rows = [
            {"market_name": "GOLD - COMEX", "report_date": "2026-02-04",
             "commercial_long": 200000, "commercial_short": 250000,
             "commercial_net": -50000, "speculative_long": 150000,
             "speculative_short": 80000, "speculative_net": 70000,
             "open_interest": 500000},
        ]
        mock_db = AsyncMock()
        mock_db.executemany = AsyncMock()
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import store_cot_rows
            await store_cot_rows(rows)
        mock_db.executemany.assert_called_once()
        sql = mock_db.executemany.call_args[0][0]
        assert "INSERT OR REPLACE" in sql
        assert "cot_data" in sql

    @pytest.mark.asyncio
    async def test_empty_rows_no_op(self):
        """Empty rows list does not call the database."""
        mock_db = AsyncMock()
        mock_db.executemany = AsyncMock()
        with patch("app.data.cot_helpers.get_database", return_value=mock_db):
            from app.data.cot_helpers import store_cot_rows
            await store_cot_rows([])
        mock_db.executemany.assert_not_called()
