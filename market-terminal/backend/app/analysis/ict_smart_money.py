"""ICT Smart Money Concepts analysis module.

Implements Inner Circle Trader (ICT) institutional analysis including:
- Market structure identification (HH/HL/LH/LL swing classification)
- Market structure shift (MSS) detection
- Order block detection (bullish/bearish with mitigation tracking)
- Fair value gap (FVG) detection with partial fill tracking
- Liquidity sweep detection (buy-side and sell-side)
- Breaker block identification (failed order blocks)
- Higher timeframe premium/discount zone analysis
- Entry zone and stop loss calculation with risk-reward ratio

The analyzer produces a :class:`~app.analysis.base.MethodologySignal` with
direction, confidence, key levels, and human-readable reasoning.

Full implementation: TASK-ANALYSIS-004
"""

from __future__ import annotations

import math
from typing import Any, NamedTuple

import numpy as np
import pandas as pd

from app.analysis.base import BaseMethodology, Direction, MethodologySignal

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

_EPSILON: float = 1e-10
_SWING_WINDOW: int = 3
_STRUCTURE_LOOKBACK: int = 60
_HTF_RANGE_LOOKBACK: int = 120
_SWEEP_LOOKBACK: int = 20
_MAX_ORDER_BLOCKS: int = 5
_MAX_FVGS: int = 5
_MAX_BREAKER_BLOCKS: int = 3
_SWEEP_MAX_BARS: int = 3

# Confidence weights
_CONF_CLEAR_STRUCTURE: float = 0.4
_CONF_MIXED_STRUCTURE: float = 0.2
_CONF_ORDER_BLOCK: float = 0.15
_CONF_FVG: float = 0.10
_CONF_SWEEP: float = 0.15
_CONF_HTF_ALIGNS: float = 0.10
_CONF_BREAKER: float = 0.05
_CONF_MULTI_CONFLUENCE: float = 0.05

# Proximity thresholds (fraction of current price)
_OB_PROXIMITY_PCT: float = 0.05
_FVG_PROXIMITY_PCT: float = 0.05
_STOP_LOSS_BUFFER_PCT: float = 0.002

# Ticker sanitization
_MAX_TICKER_LENGTH: int = 20

# Confidence qualifier thresholds for reasoning text
_CONFIDENCE_HIGH_QUALIFIER: float = 0.7
_CONFIDENCE_MODERATE_QUALIFIER: float = 0.5


# ---------------------------------------------------------------------------
# Internal NamedTuples
# ---------------------------------------------------------------------------


class _SwingPoint(NamedTuple):
    """A detected swing high or swing low."""

    index: int
    price: float
    date: str
    swing_type: str  # "high" or "low"


class _StructurePoint(NamedTuple):
    """A classified structure point (HH, HL, LH, LL)."""

    index: int
    price: float
    date: str
    label: str  # "HH", "HL", "LH", "LL"


class _OrderBlock(NamedTuple):
    """An order block zone with mitigation status."""

    ob_type: str  # "bullish" or "bearish"
    high: float
    low: float
    date: str
    index: int
    mitigated: bool


class _FairValueGap(NamedTuple):
    """A fair value gap with fill tracking."""

    fvg_type: str  # "bullish" or "bearish"
    high: float
    low: float
    date: str
    index: int
    fill_percent: float  # 0.0 to 1.0


class _LiquiditySweep(NamedTuple):
    """A detected liquidity sweep event."""

    sweep_type: str  # "buy_side" or "sell_side"
    level: float
    date: str
    index: int


class _BreakerBlock(NamedTuple):
    """A breaker block (failed order block acting as S/R)."""

    breaker_type: str  # "bullish" or "bearish"
    high: float
    low: float
    date: str
    index: int


class _PremiumDiscountInfo(NamedTuple):
    """Higher timeframe premium/discount zone analysis."""

    equilibrium: float
    premium_zone_start: float
    discount_zone_start: float
    current_position: str  # "premium", "discount", or "equilibrium"


class _EntryZoneInfo(NamedTuple):
    """Calculated entry zone with stop loss and risk-reward."""

    high: float
    low: float
    stop_loss: float
    risk_reward_ratio: float


# ---------------------------------------------------------------------------
# ICTSmartMoneyAnalyzer
# ---------------------------------------------------------------------------


class ICTSmartMoneyAnalyzer(BaseMethodology):
    """ICT Smart Money Concepts institutional analysis.

    Identifies order blocks, fair value gaps, liquidity sweeps, breaker
    blocks, and market structure shifts.  Analyses higher timeframe
    structure to determine institutional bias and provides precise entry
    zones with stop loss levels.
    """

    name: str = "ict_smart_money"
    display_name: str = "ICT Smart Money Concepts"
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
        """Run ICT Smart Money analysis on the supplied data.

        Args:
            ticker: Stock/ETF symbol (e.g. ``"AAPL"``).
            price_data: DataFrame with columns ``[date, open, high, low, close]``.
            volume_data: DataFrame with columns ``[date, volume]``.
            fundamentals: Not used by ICT (ignored).
            **kwargs: Reserved for future extension.

        Returns:
            A :class:`MethodologySignal` populated with ICT-specific
            direction, confidence, key levels, and reasoning.

        Raises:
            ValueError: If input data fails validation.
        """
        self.validate_input(price_data, volume_data)

        df = self._merge_data(price_data, volume_data)
        swings = self._detect_swings(df)

        # If no swings, return early with neutral signal
        if not swings:
            return self._neutral_signal(ticker, df)

        structure_points = self._classify_structure(swings)
        market_structure, shift_bar = self._detect_structure_shift(
            structure_points,
        )
        order_blocks = self._detect_order_blocks(df, swings)
        fvgs = self._detect_fair_value_gaps(df)
        sweeps = self._detect_liquidity_sweeps(df, swings)
        breakers = self._detect_breaker_blocks(order_blocks)
        pd_info = self._calculate_premium_discount(df)

        direction = self._determine_direction(
            market_structure, order_blocks, fvgs, sweeps, pd_info,
        )
        entry_info = self._calculate_entry_zone(
            order_blocks, fvgs, direction, df,
        )
        confidence = self._calculate_confidence(
            market_structure, order_blocks, fvgs, sweeps,
            breakers, pd_info, direction, df,
        )
        key_levels = self._build_key_levels(
            market_structure, shift_bar, order_blocks, fvgs,
            sweeps, breakers, pd_info, entry_info,
        )
        reasoning = self._build_reasoning(
            ticker, market_structure, order_blocks, fvgs,
            sweeps, pd_info, entry_info, df,
        )

        return self.create_signal(
            ticker=ticker,
            direction=direction,
            confidence=confidence,
            timeframe=self.default_timeframe,
            reasoning=reasoning,
            key_levels=key_levels,
        )

    # ------------------------------------------------------------------
    # Data preparation
    # ------------------------------------------------------------------

    def _merge_data(
        self,
        price_data: pd.DataFrame,
        volume_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Merge price and volume DataFrames on the ``date`` column.

        Returns a single DataFrame with columns
        ``[date, open, high, low, close, volume]`` sorted by date ascending.
        """
        merged = pd.merge(price_data, volume_data, on="date", how="inner")
        merged["volume"] = merged["volume"].fillna(0.0)
        merged = merged.sort_values("date", ascending=True).reset_index(drop=True)
        return merged[["date", "open", "high", "low", "close", "volume"]]

    # ------------------------------------------------------------------
    # Swing detection
    # ------------------------------------------------------------------

    def _detect_swings(self, df: pd.DataFrame) -> list[_SwingPoint]:
        """Detect swing highs and swing lows across the DataFrame.

        A swing high occurs when a bar's high is >= all highs within
        ``_SWING_WINDOW`` bars on each side.  A swing low occurs when a
        bar's low is <= all lows within the same window.  Results are
        returned sorted by index ascending.
        """
        highs = df["high"].values
        lows = df["low"].values
        n = len(df)
        swings: list[_SwingPoint] = []
        w = _SWING_WINDOW

        for i in range(w, n - w):
            left_start = i - w
            right_end = i + w + 1

            # Swing high: current high >= all highs in window on both sides
            is_swing_high = True
            for j in range(left_start, right_end):
                if j == i:
                    continue
                if highs[j] > highs[i]:
                    is_swing_high = False
                    break

            if is_swing_high:
                swings.append(_SwingPoint(
                    index=i,
                    price=float(highs[i]),
                    date=str(df.iloc[i]["date"]),
                    swing_type="high",
                ))

            # Swing low: current low <= all lows in window on both sides
            is_swing_low = True
            for j in range(left_start, right_end):
                if j == i:
                    continue
                if lows[j] < lows[i]:
                    is_swing_low = False
                    break

            if is_swing_low:
                swings.append(_SwingPoint(
                    index=i,
                    price=float(lows[i]),
                    date=str(df.iloc[i]["date"]),
                    swing_type="low",
                ))

        swings.sort(key=lambda s: s.index)
        return swings

    # ------------------------------------------------------------------
    # Structure classification
    # ------------------------------------------------------------------

    def _classify_structure(
        self,
        swings: list[_SwingPoint],
    ) -> list[_StructurePoint]:
        """Classify swing points as HH, HL, LH, or LL.

        Walks through swing highs and swing lows separately, comparing
        each consecutive pair to determine the label.  Returns all
        structure points merged and sorted by index.
        """
        swing_highs = [s for s in swings if s.swing_type == "high"]
        swing_lows = [s for s in swings if s.swing_type == "low"]

        points: list[_StructurePoint] = []

        # Classify consecutive swing highs
        for i in range(1, len(swing_highs)):
            prev = swing_highs[i - 1]
            curr = swing_highs[i]
            label = "HH" if curr.price > prev.price else "LH"
            points.append(_StructurePoint(
                index=curr.index,
                price=curr.price,
                date=curr.date,
                label=label,
            ))

        # Classify consecutive swing lows
        for i in range(1, len(swing_lows)):
            prev = swing_lows[i - 1]
            curr = swing_lows[i]
            label = "HL" if curr.price > prev.price else "LL"
            points.append(_StructurePoint(
                index=curr.index,
                price=curr.price,
                date=curr.date,
                label=label,
            ))

        points.sort(key=lambda p: p.index)

        # Limit to structure within the lookback window
        if len(points) > _STRUCTURE_LOOKBACK:
            points = points[-_STRUCTURE_LOOKBACK:]

        return points

    # ------------------------------------------------------------------
    # Market structure shift detection
    # ------------------------------------------------------------------

    def _detect_structure_shift(
        self,
        structure_points: list[_StructurePoint],
    ) -> tuple[str, str | None]:
        """Determine overall market structure and detect structure shifts.

        Counts HH+HL vs LH+LL among recent structure points.  If the
        last point breaks the prevailing pattern, a market structure
        shift (MSS) is recorded with its date.

        Returns:
            A tuple of (market_structure, shift_bar_date) where
            market_structure is ``"bullish"``, ``"bearish"``, or
            ``"ranging"`` and shift_bar_date is the date string of the
            most recent MSS (or ``None``).
        """
        if not structure_points:
            return "ranging", None

        # Count bullish vs bearish structure points
        bullish_labels = {"HH", "HL"}
        bearish_labels = {"LH", "LL"}

        bullish_count = sum(1 for p in structure_points if p.label in bullish_labels)
        bearish_count = sum(1 for p in structure_points if p.label in bearish_labels)

        total = bullish_count + bearish_count
        if total == 0:
            return "ranging", None

        if bullish_count > bearish_count:
            market_structure = "bullish"
        elif bearish_count > bullish_count:
            market_structure = "bearish"
        else:
            market_structure = "ranging"

        # Detect MSS: check if the last structure point opposes the prior trend
        shift_bar: str | None = None
        if len(structure_points) >= 2:
            last = structure_points[-1]
            # Determine prior trend from all points except the last
            prior = structure_points[:-1]
            prior_bull = sum(1 for p in prior if p.label in bullish_labels)
            prior_bear = sum(1 for p in prior if p.label in bearish_labels)

            if prior_bull > prior_bear and last.label in bearish_labels:
                # Was bullish, last point is bearish -> bearish MSS
                shift_bar = last.date
            elif prior_bear > prior_bull and last.label in bullish_labels:
                # Was bearish, last point is bullish -> bullish MSS
                shift_bar = last.date

        return market_structure, shift_bar

    # ------------------------------------------------------------------
    # Order block detection
    # ------------------------------------------------------------------

    def _detect_order_blocks(
        self,
        df: pd.DataFrame,
        swings: list[_SwingPoint],
    ) -> list[_OrderBlock]:
        """Detect bullish and bearish order blocks.

        A bullish OB is the last bearish candle (close < open) before a
        move that breaks a prior swing high.  A bearish OB is the last
        bullish candle (close > open) before a move that breaks a prior
        swing low.  Mitigation status is tracked for all detected OBs.

        Returns all OBs (mitigated and unmitigated) sorted by index
        descending (most recent first).
        """
        n = len(df)
        opens = df["open"].values
        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values

        order_blocks: list[_OrderBlock] = []
        seen_indices: set[int] = set()

        swing_highs = [s for s in swings if s.swing_type == "high"]
        swing_lows = [s for s in swings if s.swing_type == "low"]

        # Bullish OBs: find bearish candle before move that breaks swing high
        for sh in swing_highs:
            target_level = sh.price
            # Look for bars after the swing high that break above it
            for i in range(sh.index + 1, n):
                if highs[i] > target_level:
                    # Found the break bar. Walk backward to find last bearish candle
                    ob_idx: int | None = None
                    for j in range(i - 1, max(sh.index - 1, -1), -1):
                        if closes[j] < opens[j]:
                            ob_idx = j
                            break

                    if ob_idx is not None and ob_idx not in seen_indices:
                        seen_indices.add(ob_idx)
                        ob_high = float(max(opens[ob_idx], closes[ob_idx]))
                        ob_low = float(lows[ob_idx])

                        # Check mitigation: any bar after OB trades through zone
                        mitigated = False
                        for k in range(ob_idx + 1, n):
                            if lows[k] <= ob_low:
                                mitigated = True
                                break

                        order_blocks.append(_OrderBlock(
                            ob_type="bullish",
                            high=ob_high,
                            low=ob_low,
                            date=str(df.iloc[ob_idx]["date"]),
                            index=ob_idx,
                            mitigated=mitigated,
                        ))
                    break  # Only use the first break of this swing

        # Bearish OBs: find bullish candle before move that breaks swing low
        for sl in swing_lows:
            target_level = sl.price
            for i in range(sl.index + 1, n):
                if lows[i] < target_level:
                    ob_idx = None
                    for j in range(i - 1, max(sl.index - 1, -1), -1):
                        if closes[j] > opens[j]:
                            ob_idx = j
                            break

                    if ob_idx is not None and ob_idx not in seen_indices:
                        seen_indices.add(ob_idx)
                        ob_high = float(highs[ob_idx])
                        ob_low = float(min(opens[ob_idx], closes[ob_idx]))

                        mitigated = False
                        for k in range(ob_idx + 1, n):
                            if highs[k] >= ob_high:
                                mitigated = True
                                break

                        order_blocks.append(_OrderBlock(
                            ob_type="bearish",
                            high=ob_high,
                            low=ob_low,
                            date=str(df.iloc[ob_idx]["date"]),
                            index=ob_idx,
                            mitigated=mitigated,
                        ))
                    break

        order_blocks.sort(key=lambda ob: ob.index, reverse=True)
        return order_blocks

    # ------------------------------------------------------------------
    # Fair value gap detection
    # ------------------------------------------------------------------

    def _detect_fair_value_gaps(self, df: pd.DataFrame) -> list[_FairValueGap]:
        """Detect bullish and bearish fair value gaps (FVGs).

        A bullish FVG appears when candle 1's high < candle 3's low,
        creating an imbalance zone.  A bearish FVG appears when candle
        1's low > candle 3's high.  Partially filled FVGs track the
        percentage of the gap that has been retraced.  Fully filled FVGs
        (fill_percent >= 1.0) are excluded.

        Returns unfilled/partially filled FVGs sorted by index descending,
        limited to ``_MAX_FVGS`` most recent.
        """
        n = len(df)
        highs = df["high"].values
        lows = df["low"].values

        fvgs: list[_FairValueGap] = []

        for i in range(2, n):
            c1_high = float(highs[i - 2])
            c1_low = float(lows[i - 2])
            c3_high = float(highs[i])
            c3_low = float(lows[i])

            # Bullish FVG: candle 1 high < candle 3 low
            if c1_high < c3_low:
                fvg_low = c1_high
                fvg_high = c3_low
                gap_size = fvg_high - fvg_low

                if gap_size < _EPSILON:
                    continue

                # Calculate fill from subsequent bars
                max_penetration = 0.0
                for k in range(i + 1, n):
                    pen = fvg_high - float(lows[k])
                    if pen > max_penetration:
                        max_penetration = pen

                fill_pct = max_penetration / gap_size
                fill_pct = max(0.0, min(1.0, fill_pct))

                if fill_pct >= 1.0:
                    continue

                fvgs.append(_FairValueGap(
                    fvg_type="bullish",
                    high=fvg_high,
                    low=fvg_low,
                    date=str(df.iloc[i - 1]["date"]),  # middle candle date
                    index=i - 1,
                    fill_percent=fill_pct,
                ))

            # Bearish FVG: candle 1 low > candle 3 high
            if c1_low > c3_high:
                fvg_high = c1_low
                fvg_low = c3_high
                gap_size = fvg_high - fvg_low

                if gap_size < _EPSILON:
                    continue

                max_penetration = 0.0
                for k in range(i + 1, n):
                    pen = float(highs[k]) - fvg_low
                    if pen > max_penetration:
                        max_penetration = pen

                fill_pct = max_penetration / gap_size
                fill_pct = max(0.0, min(1.0, fill_pct))

                if fill_pct >= 1.0:
                    continue

                fvgs.append(_FairValueGap(
                    fvg_type="bearish",
                    high=fvg_high,
                    low=fvg_low,
                    date=str(df.iloc[i - 1]["date"]),
                    index=i - 1,
                    fill_percent=fill_pct,
                ))

        fvgs.sort(key=lambda f: f.index, reverse=True)
        return fvgs[:_MAX_FVGS]

    # ------------------------------------------------------------------
    # Liquidity sweep detection
    # ------------------------------------------------------------------

    def _detect_liquidity_sweeps(
        self,
        df: pd.DataFrame,
        swings: list[_SwingPoint],
    ) -> list[_LiquiditySweep]:
        """Detect buy-side and sell-side liquidity sweeps.

        A buy-side sweep occurs when price wicks above a prior swing
        high and reverses back below within ``_SWEEP_MAX_BARS`` bars
        (bearish implication).  A sell-side sweep occurs when price
        wicks below a prior swing low and reverses back above (bullish
        implication).

        Scans the last ``_SWEEP_LOOKBACK`` bars.

        Returns sweeps sorted by index descending.
        """
        n = len(df)
        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values

        sweep_start = max(0, n - _SWEEP_LOOKBACK)
        sweeps: list[_LiquiditySweep] = []
        used_swings: set[int] = set()

        swing_highs = [s for s in swings if s.swing_type == "high" and s.index < sweep_start]
        swing_lows = [s for s in swings if s.swing_type == "low" and s.index < sweep_start]

        # Also include swings within the sweep window that occurred before
        # the bar being tested
        all_swing_highs = [s for s in swings if s.swing_type == "high"]
        all_swing_lows = [s for s in swings if s.swing_type == "low"]

        for i in range(sweep_start, n):
            # Buy-side sweep: bar high exceeds a prior swing high
            for sh in all_swing_highs:
                if sh.index >= i or sh.index in used_swings:
                    continue
                if highs[i] > sh.price:
                    # Check reversal: close of this bar or within next bars
                    # falls back below the swing high
                    reversed_below = False
                    check_end = min(i + _SWEEP_MAX_BARS + 1, n)
                    for j in range(i, check_end):
                        if closes[j] < sh.price:
                            reversed_below = True
                            break

                    if reversed_below:
                        used_swings.add(sh.index)
                        sweeps.append(_LiquiditySweep(
                            sweep_type="buy_side",
                            level=sh.price,
                            date=str(df.iloc[i]["date"]),
                            index=i,
                        ))

            # Sell-side sweep: bar low goes below a prior swing low
            for sl in all_swing_lows:
                if sl.index >= i or sl.index in used_swings:
                    continue
                if lows[i] < sl.price:
                    reversed_above = False
                    check_end = min(i + _SWEEP_MAX_BARS + 1, n)
                    for j in range(i, check_end):
                        if closes[j] > sl.price:
                            reversed_above = True
                            break

                    if reversed_above:
                        used_swings.add(sl.index)
                        sweeps.append(_LiquiditySweep(
                            sweep_type="sell_side",
                            level=sl.price,
                            date=str(df.iloc[i]["date"]),
                            index=i,
                        ))

        sweeps.sort(key=lambda s: s.index, reverse=True)
        return sweeps

    # ------------------------------------------------------------------
    # Breaker block detection
    # ------------------------------------------------------------------

    def _detect_breaker_blocks(
        self,
        order_blocks: list[_OrderBlock],
    ) -> list[_BreakerBlock]:
        """Identify breaker blocks from mitigated order blocks.

        A mitigated bearish OB becomes a bullish breaker (support).
        A mitigated bullish OB becomes a bearish breaker (resistance).

        Returns the most recent ``_MAX_BREAKER_BLOCKS`` breaker blocks,
        sorted by index descending.
        """
        breakers: list[_BreakerBlock] = []

        for ob in order_blocks:
            if not ob.mitigated:
                continue

            if ob.ob_type == "bearish":
                breaker_type = "bullish"
            else:
                breaker_type = "bearish"

            breakers.append(_BreakerBlock(
                breaker_type=breaker_type,
                high=ob.high,
                low=ob.low,
                date=ob.date,
                index=ob.index,
            ))

        breakers.sort(key=lambda b: b.index, reverse=True)
        return breakers[:_MAX_BREAKER_BLOCKS]

    # ------------------------------------------------------------------
    # Premium / discount analysis
    # ------------------------------------------------------------------

    def _calculate_premium_discount(
        self,
        df: pd.DataFrame,
    ) -> _PremiumDiscountInfo:
        """Calculate higher timeframe premium/discount zones.

        Uses the last ``_HTF_RANGE_LOOKBACK`` bars to find the overall
        range.  Everything above the equilibrium (midpoint) is premium;
        everything below is discount.
        """
        lookback = min(_HTF_RANGE_LOOKBACK, len(df))
        window = df.tail(lookback)

        range_high = float(window["high"].max())
        range_low = float(window["low"].min())
        equilibrium = (range_high + range_low) / 2.0

        current_price = float(df["close"].iloc[-1])

        if current_price > equilibrium + _EPSILON:
            position = "premium"
        elif current_price < equilibrium - _EPSILON:
            position = "discount"
        else:
            position = "equilibrium"

        return _PremiumDiscountInfo(
            equilibrium=equilibrium,
            premium_zone_start=equilibrium,
            discount_zone_start=equilibrium,
            current_position=position,
        )

    # ------------------------------------------------------------------
    # Direction determination
    # ------------------------------------------------------------------

    def _determine_direction(
        self,
        market_structure: str,
        order_blocks: list[_OrderBlock],
        fvgs: list[_FairValueGap],
        sweeps: list[_LiquiditySweep],
        pd_info: _PremiumDiscountInfo,
    ) -> str:
        """Map market structure and confluences to a direction string.

        Returns one of ``"bullish"``, ``"bearish"``, or ``"neutral"``.
        """
        if market_structure == "bullish":
            return Direction.BULLISH.value
        if market_structure == "bearish":
            return Direction.BEARISH.value

        # Ranging -- use sweeps and premium/discount as tie-breakers
        sell_side_sweeps = sum(1 for s in sweeps if s.sweep_type == "sell_side")
        buy_side_sweeps = sum(1 for s in sweeps if s.sweep_type == "buy_side")

        if sell_side_sweeps > buy_side_sweeps:
            return Direction.BULLISH.value
        if buy_side_sweeps > sell_side_sweeps:
            return Direction.BEARISH.value

        # Use premium/discount as final tie-breaker
        if pd_info.current_position == "discount":
            return Direction.BULLISH.value
        if pd_info.current_position == "premium":
            return Direction.BEARISH.value

        return Direction.NEUTRAL.value

    # ------------------------------------------------------------------
    # Entry zone calculation
    # ------------------------------------------------------------------

    def _calculate_entry_zone(
        self,
        order_blocks: list[_OrderBlock],
        fvgs: list[_FairValueGap],
        direction: str,
        df: pd.DataFrame,
    ) -> _EntryZoneInfo | None:
        """Calculate optimal entry zone from OB/FVG confluence.

        For bullish setups, uses bullish OBs and FVGs.  For bearish,
        uses bearish OBs and FVGs.  Looks for zone overlap first; falls
        back to the most recent aligned OB if no overlap exists.

        Returns ``None`` if no aligned unmitigated OBs exist.
        """
        if direction == Direction.NEUTRAL.value:
            return None

        is_bullish = direction == Direction.BULLISH.value
        target_ob_type = "bullish" if is_bullish else "bearish"
        target_fvg_type = "bullish" if is_bullish else "bearish"

        aligned_obs = [
            ob for ob in order_blocks
            if not ob.mitigated and ob.ob_type == target_ob_type
        ]
        aligned_fvgs = [
            fvg for fvg in fvgs
            if fvg.fvg_type == target_fvg_type and fvg.fill_percent < 1.0
        ]

        if not aligned_obs:
            return None

        entry_high: float | None = None
        entry_low: float | None = None
        used_ob: _OrderBlock | None = None

        # Try to find OB/FVG overlap
        for ob in aligned_obs:
            for fvg in aligned_fvgs:
                # Check overlap between OB zone and FVG zone
                overlap_low = max(ob.low, fvg.low)
                overlap_high = min(ob.high, fvg.high)
                if overlap_low < overlap_high:
                    entry_high = overlap_high
                    entry_low = overlap_low
                    used_ob = ob
                    break
            if entry_high is not None:
                break

        # Fallback: use most recent aligned OB
        if entry_high is None:
            used_ob = aligned_obs[0]
            entry_high = used_ob.high
            entry_low = used_ob.low

        entry_mid = (entry_high + entry_low) / 2.0

        # Stop loss
        if is_bullish:
            stop_loss = used_ob.low * (1.0 - _STOP_LOSS_BUFFER_PCT)
        else:
            stop_loss = used_ob.high * (1.0 + _STOP_LOSS_BUFFER_PCT)

        # Target: use HTF range boundary as estimate
        current_price = float(df["close"].iloc[-1])
        lookback = min(_HTF_RANGE_LOOKBACK, len(df))
        window = df.tail(lookback)
        range_high = float(window["high"].max())
        range_low = float(window["low"].min())

        if is_bullish:
            target = range_high
        else:
            target = range_low

        # Risk-reward ratio
        risk = abs(entry_mid - stop_loss)
        reward = abs(target - entry_mid)

        if risk < _EPSILON:
            rr_ratio = 0.0
        else:
            rr_ratio = reward / risk

        # Guard NaN/Inf
        if math.isnan(rr_ratio) or math.isinf(rr_ratio):
            rr_ratio = 0.0

        return _EntryZoneInfo(
            high=entry_high,
            low=entry_low,
            stop_loss=stop_loss,
            risk_reward_ratio=rr_ratio,
        )

    # ------------------------------------------------------------------
    # Confidence scoring
    # ------------------------------------------------------------------

    def _calculate_confidence(
        self,
        market_structure: str,
        order_blocks: list[_OrderBlock],
        fvgs: list[_FairValueGap],
        sweeps: list[_LiquiditySweep],
        breakers: list[_BreakerBlock],
        pd_info: _PremiumDiscountInfo,
        direction: str,
        df: pd.DataFrame,
    ) -> float:
        """Compute confidence score in ``[0.0, 1.0]``.

        Starts from a structure base score, then adds bonuses for
        order blocks, FVGs, liquidity sweeps, HTF alignment, breaker
        blocks, and multi-confluence setups.
        """
        # Base: clear structure vs mixed
        if market_structure in ("bullish", "bearish"):
            confidence = _CONF_CLEAR_STRUCTURE
        else:
            confidence = _CONF_MIXED_STRUCTURE

        current_price = float(df["close"].iloc[-1])
        proximity_threshold_ob = current_price * _OB_PROXIMITY_PCT
        proximity_threshold_fvg = current_price * _FVG_PROXIMITY_PCT

        # Order block near current price
        ob_near = False
        unmitigated_obs = [ob for ob in order_blocks if not ob.mitigated]
        for ob in unmitigated_obs:
            ob_mid = (ob.high + ob.low) / 2.0
            if abs(current_price - ob_mid) <= proximity_threshold_ob:
                ob_near = True
                break
        if ob_near:
            confidence += _CONF_ORDER_BLOCK

        # FVG near current price
        fvg_near = False
        for fvg in fvgs:
            fvg_mid = (fvg.high + fvg.low) / 2.0
            if abs(current_price - fvg_mid) <= proximity_threshold_fvg:
                fvg_near = True
                break
        if fvg_near:
            confidence += _CONF_FVG

        # Liquidity sweep detected
        sweep_present = len(sweeps) > 0
        if sweep_present:
            confidence += _CONF_SWEEP

        # HTF alignment
        htf_aligns = (
            (direction == Direction.BULLISH.value
             and pd_info.current_position == "discount")
            or (direction == Direction.BEARISH.value
                and pd_info.current_position == "premium")
        )
        if htf_aligns:
            confidence += _CONF_HTF_ALIGNS

        # Breaker block confirms direction
        breaker_confirms = False
        for b in breakers:
            if b.breaker_type == direction:
                breaker_confirms = True
                break
        if breaker_confirms:
            confidence += _CONF_BREAKER

        # Multiple confluences (OB + FVG + sweep all present)
        if ob_near and fvg_near and sweep_present:
            confidence += _CONF_MULTI_CONFLUENCE

        # Guard NaN/Inf before clamping
        if math.isnan(confidence) or math.isinf(confidence):
            confidence = 0.0

        confidence = max(0.0, min(1.0, confidence))
        return confidence

    # ------------------------------------------------------------------
    # Key levels construction
    # ------------------------------------------------------------------

    def _build_key_levels(
        self,
        market_structure: str,
        shift_bar: str | None,
        order_blocks: list[_OrderBlock],
        fvgs: list[_FairValueGap],
        sweeps: list[_LiquiditySweep],
        breakers: list[_BreakerBlock],
        pd_info: _PremiumDiscountInfo,
        entry_info: _EntryZoneInfo | None,
    ) -> dict[str, Any]:
        """Construct the ``key_levels`` dict for the output signal."""
        return {
            "market_structure": market_structure,
            "structure_shift_bar": shift_bar,
            "order_blocks": [
                {
                    "type": ob.ob_type,
                    "high": round(ob.high, 4),
                    "low": round(ob.low, 4),
                    "date": ob.date,
                }
                for ob in order_blocks if not ob.mitigated
            ][:_MAX_ORDER_BLOCKS],
            "fair_value_gaps": [
                {
                    "type": fvg.fvg_type,
                    "high": round(fvg.high, 4),
                    "low": round(fvg.low, 4),
                    "date": fvg.date,
                    "fill_percent": round(fvg.fill_percent, 4),
                }
                for fvg in fvgs
            ][:_MAX_FVGS],
            "liquidity_sweeps": [
                {
                    "type": s.sweep_type,
                    "level": round(s.level, 4),
                    "date": s.date,
                }
                for s in sweeps
            ],
            "breaker_blocks": [
                {
                    "type": b.breaker_type,
                    "high": round(b.high, 4),
                    "low": round(b.low, 4),
                    "date": b.date,
                }
                for b in breakers
            ][:_MAX_BREAKER_BLOCKS],
            "premium_discount": {
                "equilibrium": round(pd_info.equilibrium, 4),
                "premium_zone_start": round(pd_info.premium_zone_start, 4),
                "discount_zone_start": round(pd_info.discount_zone_start, 4),
                "current_position": pd_info.current_position,
            },
            "entry_zone": (
                {
                    "high": round(entry_info.high, 4),
                    "low": round(entry_info.low, 4),
                }
                if entry_info
                else None
            ),
            "stop_loss": round(entry_info.stop_loss, 4) if entry_info else None,
            "risk_reward_ratio": (
                round(entry_info.risk_reward_ratio, 2) if entry_info else None
            ),
        }

    # ------------------------------------------------------------------
    # Reasoning construction
    # ------------------------------------------------------------------

    def _build_reasoning(
        self,
        ticker: str,
        market_structure: str,
        order_blocks: list[_OrderBlock],
        fvgs: list[_FairValueGap],
        sweeps: list[_LiquiditySweep],
        pd_info: _PremiumDiscountInfo,
        entry_info: _EntryZoneInfo | None,
        df: pd.DataFrame,
    ) -> str:
        """Generate a human-readable reasoning summary.

        Describes the market structure, notable confluences, entry zone,
        and stop loss setup.  Never includes raw user input.
        """
        safe_ticker = "".join(
            ch for ch in str(ticker).strip().upper()
            if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        parts: list[str] = []

        # Market structure
        if market_structure == "bullish":
            parts.append(
                f"{safe_ticker} shows bullish market structure "
                f"with HH/HL pattern."
            )
        elif market_structure == "bearish":
            parts.append(
                f"{safe_ticker} shows bearish market structure "
                f"with LH/LL pattern."
            )
        else:
            parts.append(
                f"{safe_ticker} shows ranging market structure "
                f"with mixed swing points."
            )

        # Unmitigated order blocks
        unmitigated = [ob for ob in order_blocks if not ob.mitigated]
        if unmitigated:
            ob = unmitigated[0]
            parts.append(
                f"A {ob.ob_type} order block at "
                f"${ob.low:.2f}-${ob.high:.2f} on {ob.date} "
                f"remains unmitigated."
            )

        # Fair value gaps
        if fvgs:
            fvg = fvgs[0]
            parts.append(
                f"An unfilled {fvg.fvg_type} FVG exists at "
                f"${fvg.low:.2f}-${fvg.high:.2f} "
                f"({fvg.fill_percent:.0%} filled)."
            )

        # Liquidity sweeps
        sell_side = [s for s in sweeps if s.sweep_type == "sell_side"]
        buy_side = [s for s in sweeps if s.sweep_type == "buy_side"]
        if sell_side:
            s = sell_side[0]
            parts.append(
                f"A sell-side liquidity sweep occurred at "
                f"${s.level:.2f} on {s.date}."
            )
        if buy_side:
            s = buy_side[0]
            parts.append(
                f"A buy-side liquidity sweep occurred at "
                f"${s.level:.2f} on {s.date}."
            )

        # Premium/discount zone
        parts.append(
            f"Price is currently in the {pd_info.current_position} zone."
        )

        # Entry zone and stop loss
        if entry_info is not None:
            parts.append(
                f"Entry zone: ${entry_info.low:.2f}-${entry_info.high:.2f} "
                f"with stop at ${entry_info.stop_loss:.2f} "
                f"(R:R {entry_info.risk_reward_ratio:.1f}:1)."
            )

        # Confidence qualifier
        # (not directly passed here; use a generic wrap-up instead)
        current_price = float(df["close"].iloc[-1])
        parts.append(f"Current price: ${current_price:.2f}.")

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Neutral fallback signal
    # ------------------------------------------------------------------

    def _neutral_signal(
        self,
        ticker: str,
        df: pd.DataFrame,
    ) -> MethodologySignal:
        """Return a neutral signal when no swings are detected.

        This handles flat price data or datasets too short for
        meaningful swing detection.
        """
        safe_ticker = "".join(
            ch for ch in str(ticker).strip().upper()
            if ch.isalnum() or ch in (".", "-", "_", " ")
        )[:_MAX_TICKER_LENGTH]

        pd_info = self._calculate_premium_discount(df)

        key_levels: dict[str, Any] = {
            "market_structure": "ranging",
            "structure_shift_bar": None,
            "order_blocks": [],
            "fair_value_gaps": [],
            "liquidity_sweeps": [],
            "breaker_blocks": [],
            "premium_discount": {
                "equilibrium": round(pd_info.equilibrium, 4),
                "premium_zone_start": round(pd_info.premium_zone_start, 4),
                "discount_zone_start": round(pd_info.discount_zone_start, 4),
                "current_position": pd_info.current_position,
            },
            "entry_zone": None,
            "stop_loss": None,
            "risk_reward_ratio": None,
        }

        reasoning = (
            f"{safe_ticker} has insufficient swing structure for "
            f"ICT analysis. No clear market structure, order blocks, "
            f"or fair value gaps detected. Price is in the "
            f"{pd_info.current_position} zone."
        )

        return self.create_signal(
            ticker=ticker,
            direction=Direction.NEUTRAL.value,
            confidence=_CONF_MIXED_STRUCTURE,
            timeframe=self.default_timeframe,
            reasoning=reasoning,
            key_levels=key_levels,
        )
