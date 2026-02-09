# ICT Smart Money Concepts & Larry Williams Trading Methods

## Research Summary

This document provides comprehensive algorithmic trading specifications for two complementary methodologies:
1. **ICT (Inner Circle Trader) Smart Money Concepts** - Institutional order flow analysis
2. **Larry Williams Trading Methods** - Momentum indicators and seasonal patterns

Both approaches focus on understanding institutional behavior and can be integrated with Elliott Wave, Wyckoff, and Livermore/O'Neil methods.

---

# PART 1: ICT SMART MONEY CONCEPTS

## 1.1 Overview

ICT (Inner Circle Trader) methodology was developed by Michael J. Huddleston to help traders understand how institutional players move markets. The core premise is that institutional traders (banks, hedge funds) control market movements and intentionally sweep retail liquidity at extremes.

### Core Philosophy
- **Smart Money** controls significant capital and drives price movements
- Markets move to **sweep liquidity** where retail stops cluster
- Price returns to **fill inefficiencies** (gaps and imbalances)
- Specific **time windows** offer highest probability setups

---

## 1.2 Market Structure Analysis

### 1.2.1 Break of Structure (BOS)

**Definition**: Trend continuation signal when price breaks beyond established support/resistance.

**Bullish BOS Detection Algorithm**:
```python
def detect_bullish_bos(highs, lows, lookback=5):
    """
    Bullish BOS: Price makes higher low (HL) followed by higher high (HH)

    Parameters:
    - highs: array of high prices
    - lows: array of low prices
    - lookback: swing detection period

    Returns:
    - bos_signals: list of (index, level) tuples
    """
    swing_highs = find_swing_highs(highs, lookback)
    swing_lows = find_swing_lows(lows, lookback)

    bos_signals = []
    for i, (sh_idx, sh_level) in enumerate(swing_highs[1:], 1):
        prev_sh_idx, prev_sh_level = swing_highs[i-1]

        # Check for higher low between swing highs
        intermediate_lows = [sl for sl_idx, sl in swing_lows
                           if prev_sh_idx < sl_idx < sh_idx]

        if intermediate_lows and sh_level > prev_sh_level:
            # Bullish BOS confirmed
            bos_signals.append((sh_idx, prev_sh_level))

    return bos_signals
```

**Bearish BOS Detection**:
```python
def detect_bearish_bos(highs, lows, lookback=5):
    """
    Bearish BOS: Price makes lower high (LH) followed by lower low (LL)
    """
    swing_highs = find_swing_highs(highs, lookback)
    swing_lows = find_swing_lows(lows, lookback)

    bos_signals = []
    for i, (sl_idx, sl_level) in enumerate(swing_lows[1:], 1):
        prev_sl_idx, prev_sl_level = swing_lows[i-1]

        # Check for lower high between swing lows
        intermediate_highs = [sh for sh_idx, sh in swing_highs
                            if prev_sl_idx < sh_idx < sl_idx]

        if intermediate_highs and sl_level < prev_sl_level:
            # Bearish BOS confirmed
            bos_signals.append((sl_idx, prev_sl_level))

    return bos_signals
```

### 1.2.2 Change of Character (CHoCH)

**Definition**: Potential trend reversal signal when price breaks against the prevailing trend.

**Detection Rules**:
- In **uptrend**: CHoCH occurs when price breaks below a significant swing low
- In **downtrend**: CHoCH occurs when price breaks above a significant swing high
- Must wait for **candle close** to confirm CHoCH

```python
def detect_choch(highs, lows, closes, lookback=5):
    """
    Change of Character: Break against prevailing trend

    Returns:
    - choch_signals: list of (index, direction, level) tuples
      direction: 1 = bullish CHoCH (downtrend ending)
                -1 = bearish CHoCH (uptrend ending)
    """
    swing_highs = find_swing_highs(highs, lookback)
    swing_lows = find_swing_lows(lows, lookback)
    trend = determine_trend(highs, lows, lookback)

    choch_signals = []

    for i in range(len(closes)):
        if trend[i] == 1:  # Uptrend
            # Check for break below recent swing low
            recent_sl = get_most_recent_swing_low(swing_lows, i)
            if recent_sl and closes[i] < recent_sl[1]:
                choch_signals.append((i, -1, recent_sl[1]))

        elif trend[i] == -1:  # Downtrend
            # Check for break above recent swing high
            recent_sh = get_most_recent_swing_high(swing_highs, i)
            if recent_sh and closes[i] > recent_sh[1]:
                choch_signals.append((i, 1, recent_sh[1]))

    return choch_signals
```

### 1.2.3 Market Structure Shift (MSS)

**Definition**: More significant than CHoCH - includes displacement (strong impulsive move) after the break.

**MSS Confirmation Criteria**:
1. Failure to make new high (uptrend) or new low (downtrend)
2. Break of significant swing point
3. **Displacement** - strong impulsive move through the level (not just a slight breach)

```python
def detect_mss(ohlc, lookback=5, displacement_multiplier=1.5):
    """
    Market Structure Shift with displacement confirmation

    Parameters:
    - displacement_multiplier: minimum move size relative to ATR
    """
    atr = calculate_atr(ohlc, period=14)
    choch_signals = detect_choch(ohlc['high'], ohlc['low'],
                                  ohlc['close'], lookback)

    mss_signals = []
    for idx, direction, level in choch_signals:
        # Check for displacement
        candle_range = abs(ohlc['close'].iloc[idx] - ohlc['open'].iloc[idx])

        if candle_range > atr.iloc[idx] * displacement_multiplier:
            mss_signals.append((idx, direction, level, candle_range))

    return mss_signals
```

---

## 1.3 Order Blocks (OB)

### 1.3.1 Definition

**Order Block**: The last candle before an impulsive move where institutions placed large orders. Acts as future support/resistance.

- **Bullish OB**: Last bearish (down) candle before a strong bullish move
- **Bearish OB**: Last bullish (up) candle before a strong bearish move

### 1.3.2 Detection Algorithm

```python
def detect_order_blocks(ohlc, lookback=10, impulse_strength=2.0):
    """
    Detect ICT Order Blocks

    Bullish OB: Last down candle before up move
    Bearish OB: Last up candle before down move

    Parameters:
    - impulse_strength: minimum impulse move in ATR units

    Returns:
    - order_blocks: list of {
        'type': 'bullish' or 'bearish',
        'index': formation index,
        'top': upper boundary,
        'bottom': lower boundary,
        'mitigated': bool,
        'mitigation_index': index where mitigated (if any)
      }
    """
    atr = calculate_atr(ohlc, period=14)
    order_blocks = []

    for i in range(lookback, len(ohlc) - 1):
        current_close = ohlc['close'].iloc[i]
        current_open = ohlc['open'].iloc[i]
        next_close = ohlc['close'].iloc[i + 1]
        next_open = ohlc['open'].iloc[i + 1]

        # Bullish Order Block Detection
        if current_close < current_open:  # Current is bearish candle
            if next_close > next_open:  # Next is bullish candle
                # Check for impulsive move
                impulse = next_close - current_low
                if impulse > atr.iloc[i] * impulse_strength:
                    # Validate: second candle engulfs first
                    if (next_close > current_open and
                        next_low < current_low):
                        order_blocks.append({
                            'type': 'bullish',
                            'index': i,
                            'top': current_open,
                            'bottom': current_low,
                            'mitigated': False,
                            'mitigation_index': None
                        })

        # Bearish Order Block Detection
        if current_close > current_open:  # Current is bullish candle
            if next_close < next_open:  # Next is bearish candle
                # Check for impulsive move
                impulse = current_high - next_close
                if impulse > atr.iloc[i] * impulse_strength:
                    # Validate: second candle engulfs first
                    if (next_close < current_open and
                        next_high > current_high):
                        order_blocks.append({
                            'type': 'bearish',
                            'index': i,
                            'top': current_high,
                            'bottom': current_open,
                            'mitigated': False,
                            'mitigation_index': None
                        })

    return order_blocks

def check_order_block_mitigation(order_blocks, ohlc):
    """
    Check if price has returned to and mitigated order blocks

    Mitigation = price touches the order block zone
    """
    for ob in order_blocks:
        for i in range(ob['index'] + 1, len(ohlc)):
            if ob['type'] == 'bullish':
                # Price returns to bullish OB (support)
                if ohlc['low'].iloc[i] <= ob['top']:
                    ob['mitigated'] = True
                    ob['mitigation_index'] = i
                    break
            else:
                # Price returns to bearish OB (resistance)
                if ohlc['high'].iloc[i] >= ob['bottom']:
                    ob['mitigated'] = True
                    ob['mitigation_index'] = i
                    break

    return order_blocks
```

### 1.3.3 Order Block Validation Criteria

1. **Engulfment**: Second candle should completely engulf first (body to body, wick to wick)
2. **Imbalance**: Lower timeframe should show FVG within the OB zone
3. **Structure**: Should occur with BOS or MSS event
4. **Timeframe**: Higher timeframes (daily/weekly) have higher probability

---

## 1.4 Fair Value Gaps (FVG)

### 1.4.1 Definition

**Fair Value Gap**: A three-candle pattern with an imbalance (gap) between candles 1 and 3 where no trading occurred. Price often returns to fill this inefficiency.

### 1.4.2 FVG Detection Algorithm

```python
def detect_fair_value_gaps(ohlc, min_gap_atr=0.5):
    """
    Detect Fair Value Gaps (3-candle imbalance pattern)

    Bullish FVG: Gap below price (high[0] < low[2])
    Bearish FVG: Gap above price (low[0] > high[2])

    Parameters:
    - min_gap_atr: minimum gap size in ATR units

    Returns:
    - fvgs: list of {
        'type': 'bullish' or 'bearish',
        'index': middle candle index,
        'top': upper boundary of gap,
        'bottom': lower boundary of gap,
        'midpoint': consequent encroachment level,
        'filled': bool,
        'fill_index': index where filled (if any)
      }
    """
    atr = calculate_atr(ohlc, period=14)
    fvgs = []

    for i in range(2, len(ohlc)):
        candle_0_high = ohlc['high'].iloc[i - 2]  # First candle
        candle_0_low = ohlc['low'].iloc[i - 2]
        candle_1_high = ohlc['high'].iloc[i - 1]  # Middle (impulsive) candle
        candle_1_low = ohlc['low'].iloc[i - 1]
        candle_2_high = ohlc['high'].iloc[i]      # Third candle
        candle_2_low = ohlc['low'].iloc[i]

        # Bullish FVG: Gap between candle 0 high and candle 2 low
        if candle_2_low > candle_0_high:
            gap_size = candle_2_low - candle_0_high
            if gap_size > atr.iloc[i] * min_gap_atr:
                fvgs.append({
                    'type': 'bullish',
                    'index': i - 1,
                    'top': candle_2_low,
                    'bottom': candle_0_high,
                    'midpoint': (candle_2_low + candle_0_high) / 2,
                    'filled': False,
                    'fill_index': None
                })

        # Bearish FVG: Gap between candle 0 low and candle 2 high
        if candle_2_high < candle_0_low:
            gap_size = candle_0_low - candle_2_high
            if gap_size > atr.iloc[i] * min_gap_atr:
                fvgs.append({
                    'type': 'bearish',
                    'index': i - 1,
                    'top': candle_0_low,
                    'bottom': candle_2_high,
                    'midpoint': (candle_0_low + candle_2_high) / 2,
                    'filled': False,
                    'fill_index': None
                })

    return fvgs

def track_fvg_fill(fvgs, ohlc):
    """
    Track if FVGs have been filled by subsequent price action
    """
    for fvg in fvgs:
        for i in range(fvg['index'] + 2, len(ohlc)):
            if fvg['type'] == 'bullish':
                # Bullish FVG filled when price drops into gap
                if ohlc['low'].iloc[i] <= fvg['top']:
                    fvg['filled'] = True
                    fvg['fill_index'] = i
                    # Check if respected (bounced) or invalidated (closed through)
                    if ohlc['close'].iloc[i] < fvg['bottom']:
                        fvg['status'] = 'invalidated'
                    else:
                        fvg['status'] = 'respected'
                    break
            else:
                # Bearish FVG filled when price rises into gap
                if ohlc['high'].iloc[i] >= fvg['bottom']:
                    fvg['filled'] = True
                    fvg['fill_index'] = i
                    if ohlc['close'].iloc[i] > fvg['top']:
                        fvg['status'] = 'invalidated'
                    else:
                        fvg['status'] = 'respected'
                    break

    return fvgs
```

### 1.4.3 FVG Trading Rules

**Entry Conditions**:
1. Identify FVG after BOS or MSS
2. Wait for price to retrace into the gap zone
3. Enter at FVG touch with bullish/bearish confirmation
4. Alternative: Enter at **Consequent Encroachment** (50% midpoint)

**FVG Inversion**:
- If price breaks through an FVG, it becomes inverted
- Former support FVG becomes resistance and vice versa

---

## 1.5 Liquidity Concepts

### 1.5.1 Buy Side Liquidity (BSL)

**Definition**: Buy stop orders placed above key resistance/swing highs where short sellers have stops.

```python
def identify_buy_side_liquidity(ohlc, swing_lookback=5):
    """
    Identify Buy Side Liquidity zones (above swing highs)

    BSL = areas where buy stops cluster (short sellers' stops)
    """
    swing_highs = find_swing_highs(ohlc['high'], swing_lookback)

    bsl_zones = []
    for sh_idx, sh_level in swing_highs:
        # Look for multiple equal highs (stronger liquidity)
        equal_highs = find_equal_highs(ohlc['high'], sh_level,
                                       tolerance=0.0001, lookback=20)

        bsl_zones.append({
            'level': sh_level,
            'index': sh_idx,
            'strength': len(equal_highs),
            'swept': False,
            'sweep_index': None
        })

    return bsl_zones
```

### 1.5.2 Sell Side Liquidity (SSL)

**Definition**: Sell stop orders placed below key support/swing lows where long traders have stops.

```python
def identify_sell_side_liquidity(ohlc, swing_lookback=5):
    """
    Identify Sell Side Liquidity zones (below swing lows)

    SSL = areas where sell stops cluster (long traders' stops)
    """
    swing_lows = find_swing_lows(ohlc['low'], swing_lookback)

    ssl_zones = []
    for sl_idx, sl_level in swing_lows:
        equal_lows = find_equal_lows(ohlc['low'], sl_level,
                                     tolerance=0.0001, lookback=20)

        ssl_zones.append({
            'level': sl_level,
            'index': sl_idx,
            'strength': len(equal_lows),
            'swept': False,
            'sweep_index': None
        })

    return ssl_zones

def detect_liquidity_sweep(liquidity_zones, ohlc, zone_type='BSL'):
    """
    Detect when liquidity has been swept (hunted)

    Sweep = price briefly exceeds level then reverses
    """
    for zone in liquidity_zones:
        for i in range(zone['index'] + 1, len(ohlc)):
            if zone_type == 'BSL':
                # BSL swept when price goes above then closes below
                if ohlc['high'].iloc[i] > zone['level']:
                    if ohlc['close'].iloc[i] < zone['level']:
                        zone['swept'] = True
                        zone['sweep_index'] = i
                        break
            else:  # SSL
                # SSL swept when price goes below then closes above
                if ohlc['low'].iloc[i] < zone['level']:
                    if ohlc['close'].iloc[i] > zone['level']:
                        zone['swept'] = True
                        zone['sweep_index'] = i
                        break

    return liquidity_zones
```

### 1.5.3 Liquidity Sweep Trading

**Trading After Sweep**:
1. Wait for liquidity sweep (false breakout)
2. Look for displacement (strong reversal candle)
3. Identify FVG or OB formed during reversal
4. Enter on retracement to FVG/OB

---

## 1.6 Premium and Discount Zones

### 1.6.1 Concept

Using Fibonacci retracement to divide a price range:
- **Premium Zone**: Above 50% (0.5) - expensive, ideal for selling
- **Discount Zone**: Below 50% (0.5) - cheap, ideal for buying
- **Equilibrium**: The 50% midpoint (fair value)

### 1.6.2 Implementation

```python
def calculate_premium_discount_zones(ohlc, swing_lookback=20):
    """
    Calculate Premium/Discount zones for current dealing range

    Returns:
    - zones: {
        'range_high': swing high level,
        'range_low': swing low level,
        'equilibrium': 50% level,
        'premium_start': 50% level,
        'deep_premium': 70.5% level,
        'discount_start': 50% level,
        'deep_discount': 29.5% level
      }
    """
    recent_high = ohlc['high'].rolling(swing_lookback).max().iloc[-1]
    recent_low = ohlc['low'].rolling(swing_lookback).min().iloc[-1]

    range_size = recent_high - recent_low

    zones = {
        'range_high': recent_high,
        'range_low': recent_low,
        'equilibrium': recent_low + (range_size * 0.5),
        'premium_zone': {
            'start': recent_low + (range_size * 0.5),
            'ote': recent_low + (range_size * 0.705),  # Optimal entry
            'deep': recent_low + (range_size * 0.79)
        },
        'discount_zone': {
            'start': recent_low + (range_size * 0.5),
            'ote': recent_low + (range_size * 0.295),  # Optimal entry
            'deep': recent_low + (range_size * 0.21)
        }
    }

    return zones

def get_zone_bias(current_price, zones):
    """
    Determine trading bias based on current price position
    """
    if current_price > zones['equilibrium']:
        return 'SELL_ZONE'  # Look for shorts in premium
    else:
        return 'BUY_ZONE'   # Look for longs in discount
```

---

## 1.7 Optimal Trade Entry (OTE)

### 1.7.1 Definition

OTE is the Fibonacci retracement zone (62%-79%) where best risk/reward entries occur.

**Key Fibonacci Levels**:
- 62% (0.618) - Start of OTE zone
- 70.5% (0.705) - Precise OTE level
- 79% (0.79) - End of OTE zone

### 1.7.2 OTE Detection

```python
def find_ote_zone(ohlc, swing_high_idx, swing_low_idx, direction='bullish'):
    """
    Calculate OTE zone for a dealing range

    Parameters:
    - direction: 'bullish' (buy in OTE) or 'bearish' (sell in OTE)
    """
    if direction == 'bullish':
        # For bullish OTE: measure from low to high
        range_low = ohlc['low'].iloc[swing_low_idx]
        range_high = ohlc['high'].iloc[swing_high_idx]
    else:
        # For bearish OTE: measure from high to low
        range_high = ohlc['high'].iloc[swing_high_idx]
        range_low = ohlc['low'].iloc[swing_low_idx]

    range_size = range_high - range_low

    ote_zone = {
        'direction': direction,
        'fib_618': range_low + (range_size * (1 - 0.618)) if direction == 'bullish'
                   else range_high - (range_size * (1 - 0.618)),
        'fib_705': range_low + (range_size * (1 - 0.705)) if direction == 'bullish'
                   else range_high - (range_size * (1 - 0.705)),
        'fib_79': range_low + (range_size * (1 - 0.79)) if direction == 'bullish'
                  else range_high - (range_size * (1 - 0.79)),
        'stop_loss': range_low if direction == 'bullish' else range_high
    }

    return ote_zone

def check_price_in_ote(current_price, ote_zone):
    """
    Check if current price is within OTE zone
    """
    if ote_zone['direction'] == 'bullish':
        return ote_zone['fib_79'] <= current_price <= ote_zone['fib_618']
    else:
        return ote_zone['fib_618'] <= current_price <= ote_zone['fib_79']
```

---

## 1.8 Breaker and Mitigation Blocks

### 1.8.1 Breaker Block

**Definition**: A failed order block that causes a market structure shift. Acts as support/resistance on the opposite side.

```python
def detect_breaker_blocks(order_blocks, ohlc):
    """
    Detect Breaker Blocks (failed order blocks)

    Breaker = OB that gets broken through, then price returns
    """
    breaker_blocks = []

    for ob in order_blocks:
        # Check if OB was broken (invalidated)
        for i in range(ob['index'] + 1, len(ohlc)):
            if ob['type'] == 'bullish':
                # Bullish OB broken when price closes below bottom
                if ohlc['close'].iloc[i] < ob['bottom']:
                    breaker_blocks.append({
                        'type': 'bearish',  # Becomes resistance
                        'original_ob': ob,
                        'break_index': i,
                        'top': ob['top'],
                        'bottom': ob['bottom']
                    })
                    break
            else:
                # Bearish OB broken when price closes above top
                if ohlc['close'].iloc[i] > ob['top']:
                    breaker_blocks.append({
                        'type': 'bullish',  # Becomes support
                        'original_ob': ob,
                        'break_index': i,
                        'top': ob['top'],
                        'bottom': ob['bottom']
                    })
                    break

    return breaker_blocks
```

### 1.8.2 Mitigation Block

**Definition**: A price zone where smart money needs to return to reconcile unfilled orders. Does NOT involve a structural break first.

```python
def detect_mitigation_blocks(ohlc, lookback=20):
    """
    Detect Mitigation Blocks

    Key difference from Breaker:
    - Mitigation does NOT break structure first
    - It fails to make new high/low before reversing
    """
    mitigation_blocks = []
    swing_highs = find_swing_highs(ohlc['high'], lookback=5)
    swing_lows = find_swing_lows(ohlc['low'], lookback=5)

    for i in range(lookback, len(ohlc)):
        # Check for failed higher high (bearish mitigation)
        recent_sh = get_recent_swing_highs(swing_highs, i, count=2)
        if len(recent_sh) >= 2:
            if recent_sh[0][1] < recent_sh[1][1]:  # Lower high
                # Mark the previous swing high candle as mitigation block
                mitigation_blocks.append({
                    'type': 'bearish',
                    'index': recent_sh[1][0],
                    'top': ohlc['high'].iloc[recent_sh[1][0]],
                    'bottom': ohlc['low'].iloc[recent_sh[1][0]]
                })

        # Check for failed lower low (bullish mitigation)
        recent_sl = get_recent_swing_lows(swing_lows, i, count=2)
        if len(recent_sl) >= 2:
            if recent_sl[0][1] > recent_sl[1][1]:  # Higher low
                mitigation_blocks.append({
                    'type': 'bullish',
                    'index': recent_sl[1][0],
                    'top': ohlc['high'].iloc[recent_sl[1][0]],
                    'bottom': ohlc['low'].iloc[recent_sl[1][0]]
                })

    return mitigation_blocks
```

---

## 1.9 Kill Zones (Trading Sessions)

### 1.9.1 Session Times (Eastern Time / New York)

| Kill Zone | Start | End | Characteristics |
|-----------|-------|-----|-----------------|
| **Asian** | 7:00 PM | 10:00 PM | Low volume, range formation |
| **London** | 2:00 AM | 5:00 AM | Highest volume, creates daily high/low |
| **New York AM** | 7:00 AM | 10:00 AM | Volatile, London overlap |
| **New York PM** | 1:00 PM | 3:00 PM | Afternoon reversals |
| **London Close** | 10:00 AM | 12:00 PM | Retracements, consolidation |

### 1.9.2 Kill Zone Implementation

```python
from datetime import datetime, time
import pytz

def get_kill_zone(timestamp, timezone='America/New_York'):
    """
    Determine which ICT Kill Zone a timestamp falls into

    Returns kill zone name or None if outside kill zones
    """
    tz = pytz.timezone(timezone)
    if timestamp.tzinfo is None:
        timestamp = tz.localize(timestamp)
    else:
        timestamp = timestamp.astimezone(tz)

    current_time = timestamp.time()

    kill_zones = {
        'asian': (time(19, 0), time(22, 0)),
        'london': (time(2, 0), time(5, 0)),
        'new_york_am': (time(7, 0), time(10, 0)),
        'new_york_pm': (time(13, 0), time(15, 0)),
        'london_close': (time(10, 0), time(12, 0))
    }

    for zone_name, (start, end) in kill_zones.items():
        if start <= current_time <= end:
            return zone_name

    return None

def is_optimal_trading_time(timestamp):
    """
    Check if current time is within any ICT Kill Zone
    """
    return get_kill_zone(timestamp) is not None
```

### 1.9.3 Silver Bullet Strategy

**Time Windows**:
- London Open: 3:00 AM - 4:00 AM EST
- New York AM: 10:00 AM - 11:00 AM EST
- New York PM: 2:00 PM - 3:00 PM EST

**Entry Rules**:
1. Mark Asian session range (high/low from 7 PM - 3 AM)
2. Wait for liquidity sweep of Asian range during Silver Bullet window
3. Look for FVG formation after sweep
4. Enter on FVG retracement
5. Target: 15-40 pips (forex) or 10-40 points (indices)

```python
def silver_bullet_setup(ohlc, timestamp):
    """
    Detect Silver Bullet trading setup
    """
    # Get Asian range
    asian_range = get_session_range(ohlc, session='asian')

    current_zone = get_kill_zone(timestamp)
    silver_bullet_zones = ['london_open', 'new_york_am', 'new_york_pm']

    if current_zone not in silver_bullet_zones:
        return None

    setup = {
        'asian_high': asian_range['high'],
        'asian_low': asian_range['low'],
        'current_zone': current_zone,
        'signal': None
    }

    # Check for liquidity sweep
    current_price = ohlc['close'].iloc[-1]
    current_high = ohlc['high'].iloc[-1]
    current_low = ohlc['low'].iloc[-1]

    # Sweep of SSL (below Asian low) - look for longs
    if current_low < asian_range['low'] and current_price > asian_range['low']:
        # Look for bullish FVG
        fvgs = detect_fair_value_gaps(ohlc.tail(10))
        bullish_fvgs = [f for f in fvgs if f['type'] == 'bullish']
        if bullish_fvgs:
            setup['signal'] = 'LONG'
            setup['entry_zone'] = bullish_fvgs[-1]

    # Sweep of BSL (above Asian high) - look for shorts
    if current_high > asian_range['high'] and current_price < asian_range['high']:
        fvgs = detect_fair_value_gaps(ohlc.tail(10))
        bearish_fvgs = [f for f in fvgs if f['type'] == 'bearish']
        if bearish_fvgs:
            setup['signal'] = 'SHORT'
            setup['entry_zone'] = bearish_fvgs[-1]

    return setup
```

---

## 1.10 Power of Three (AMD)

### 1.10.1 Concept

Daily price movement follows three phases:
1. **Accumulation**: Smart money builds positions (often during Asian session)
2. **Manipulation**: False move to trap retail traders (stop hunt)
3. **Distribution**: True directional move begins

```python
def identify_power_of_three(ohlc, date):
    """
    Identify Power of Three phases for a trading day
    """
    # Filter data for specific date
    day_data = ohlc[ohlc.index.date == date]

    # Asian session (accumulation)
    asian_data = filter_session(day_data, 'asian')
    asian_range = {
        'high': asian_data['high'].max(),
        'low': asian_data['low'].min()
    }

    # London session (manipulation usually occurs here)
    london_data = filter_session(day_data, 'london')

    # Detect manipulation (break of Asian range that reverses)
    manipulation = None
    if london_data['high'].max() > asian_range['high']:
        if london_data['close'].iloc[-1] < asian_range['high']:
            manipulation = {
                'type': 'bull_trap',
                'sweep_level': london_data['high'].max(),
                'direction': 'bearish'
            }
    elif london_data['low'].min() < asian_range['low']:
        if london_data['close'].iloc[-1] > asian_range['low']:
            manipulation = {
                'type': 'bear_trap',
                'sweep_level': london_data['low'].min(),
                'direction': 'bullish'
            }

    return {
        'accumulation': asian_range,
        'manipulation': manipulation,
        'distribution_bias': manipulation['direction'] if manipulation else None
    }
```

---

# PART 2: LARRY WILLIAMS TRADING METHODS

## 2.1 Overview

Larry Williams is a legendary trader who turned $10,000 into $1,137,600 (11,376% return) in the 1987 World Cup Trading Championship. His approach combines:
- Technical indicators (Williams %R, Ultimate Oscillator)
- COT (Commitment of Traders) analysis
- Seasonal/cyclical patterns
- Aggressive money management

---

## 2.2 Williams %R Indicator

### 2.2.1 Formula

```python
def williams_percent_r(high, low, close, period=14):
    """
    Williams %R - Momentum oscillator (inverse of Fast Stochastic)

    Formula: %R = (Highest High - Close) / (Highest High - Lowest Low) * -100

    Range: 0 to -100
    Overbought: -20 to 0
    Oversold: -100 to -80
    """
    highest_high = high.rolling(period).max()
    lowest_low = low.rolling(period).min()

    percent_r = ((highest_high - close) / (highest_high - lowest_low)) * -100

    return percent_r

def williams_r_signals(percent_r, overbought=-20, oversold=-80):
    """
    Generate trading signals from Williams %R

    Note: Overbought readings are NOT necessarily bearish in strong uptrends
    Oversold readings are NOT necessarily bullish in strong downtrends
    """
    signals = pd.Series(index=percent_r.index, data=0)

    # Basic signals
    signals[percent_r > overbought] = -1  # Overbought (potential sell)
    signals[percent_r < oversold] = 1      # Oversold (potential buy)

    return signals
```

### 2.2.2 Trading Strategy

```python
def williams_r_crossover_strategy(ohlc, period=14):
    """
    Williams %R Crossover Strategy

    Buy: %R crosses above -80 from oversold
    Sell: %R crosses below -20 from overbought
    """
    percent_r = williams_percent_r(ohlc['high'], ohlc['low'],
                                   ohlc['close'], period)

    signals = []
    for i in range(1, len(percent_r)):
        # Buy signal: Cross above -80
        if percent_r.iloc[i-1] < -80 and percent_r.iloc[i] >= -80:
            signals.append((percent_r.index[i], 'BUY'))

        # Sell signal: Cross below -20
        if percent_r.iloc[i-1] > -20 and percent_r.iloc[i] <= -20:
            signals.append((percent_r.index[i], 'SELL'))

    return signals
```

---

## 2.3 Williams Accumulation/Distribution (WAD)

### 2.3.1 Formula

```python
def williams_accumulation_distribution(high, low, close):
    """
    Williams Accumulation/Distribution

    Note: Does NOT use volume (unlike traditional A/D)

    Algorithm:
    1. Calculate True Range High (TRH) = max(yesterday's close, today's high)
    2. Calculate True Range Low (TRL) = min(yesterday's close, today's low)
    3. If close > previous close: WAD += (close - TRL)
    4. If close < previous close: WAD += (close - TRH)
    5. If close == previous close: WAD unchanged
    """
    wad = pd.Series(index=close.index, data=0.0)

    for i in range(1, len(close)):
        prev_close = close.iloc[i-1]
        curr_close = close.iloc[i]
        curr_high = high.iloc[i]
        curr_low = low.iloc[i]

        # True Range High/Low
        trh = max(prev_close, curr_high)
        trl = min(prev_close, curr_low)

        if curr_close > prev_close:
            wad.iloc[i] = wad.iloc[i-1] + (curr_close - trl)
        elif curr_close < prev_close:
            wad.iloc[i] = wad.iloc[i-1] + (curr_close - trh)
        else:
            wad.iloc[i] = wad.iloc[i-1]

    return wad

def wad_divergence_signals(ohlc, wad_period=14):
    """
    Detect divergences between price and WAD

    Bullish divergence: Price makes lower low, WAD makes higher low
    Bearish divergence: Price makes higher high, WAD makes lower high
    """
    wad = williams_accumulation_distribution(ohlc['high'], ohlc['low'],
                                             ohlc['close'])

    signals = []
    swing_lows_price = find_swing_lows(ohlc['low'], lookback=5)
    swing_lows_wad = find_swing_lows(wad, lookback=5)
    swing_highs_price = find_swing_highs(ohlc['high'], lookback=5)
    swing_highs_wad = find_swing_highs(wad, lookback=5)

    # Check for bullish divergence
    for i in range(1, len(swing_lows_price)):
        price_lower = swing_lows_price[i][1] < swing_lows_price[i-1][1]
        wad_higher = swing_lows_wad[i][1] > swing_lows_wad[i-1][1]

        if price_lower and wad_higher:
            signals.append((swing_lows_price[i][0], 'BULLISH_DIVERGENCE'))

    # Check for bearish divergence
    for i in range(1, len(swing_highs_price)):
        price_higher = swing_highs_price[i][1] > swing_highs_price[i-1][1]
        wad_lower = swing_highs_wad[i][1] < swing_highs_wad[i-1][1]

        if price_higher and wad_lower:
            signals.append((swing_highs_price[i][0], 'BEARISH_DIVERGENCE'))

    return signals
```

---

## 2.4 Ultimate Oscillator

### 2.4.1 Formula

Combines three timeframes (7, 14, 28) with weighted average:

```python
def ultimate_oscillator(high, low, close, period1=7, period2=14, period3=28):
    """
    Ultimate Oscillator - Multi-timeframe momentum

    Created by Larry Williams in 1976
    Combines short, medium, long timeframes to reduce false divergences

    Formula:
    1. Buying Pressure (BP) = Close - True Low
    2. True Range (TR) = True High - True Low
    3. Average = Sum(BP) / Sum(TR) for each period
    4. UO = 100 * (4*avg1 + 2*avg2 + avg3) / (4+2+1)
    """
    # True High = max(high, previous close)
    # True Low = min(low, previous close)
    prev_close = close.shift(1)
    true_high = pd.concat([high, prev_close], axis=1).max(axis=1)
    true_low = pd.concat([low, prev_close], axis=1).min(axis=1)

    # Buying Pressure
    bp = close - true_low

    # True Range
    tr = true_high - true_low

    # Calculate averages for each period
    avg1 = bp.rolling(period1).sum() / tr.rolling(period1).sum()
    avg2 = bp.rolling(period2).sum() / tr.rolling(period2).sum()
    avg3 = bp.rolling(period3).sum() / tr.rolling(period3).sum()

    # Weighted average
    uo = 100 * ((4 * avg1) + (2 * avg2) + avg3) / 7

    return uo

def ultimate_oscillator_signals(uo, ohlc, overbought=70, oversold=30):
    """
    Ultimate Oscillator Trading Signals

    Buy Signal Requirements:
    1. Bullish divergence (price lower low, UO higher low)
    2. Divergence low below 30 (oversold)
    3. UO rises above the divergence high

    Sell Signal Requirements:
    1. Bearish divergence (price higher high, UO lower high)
    2. Divergence high above 70 (overbought)
    3. UO falls below the divergence low
    """
    signals = []

    # Find divergences
    price_lows = find_swing_lows(ohlc['low'], lookback=5)
    uo_lows = find_swing_lows(uo, lookback=5)
    price_highs = find_swing_highs(ohlc['high'], lookback=5)
    uo_highs = find_swing_highs(uo, lookback=5)

    # Buy signals
    for i in range(1, min(len(price_lows), len(uo_lows))):
        # Bullish divergence
        if (price_lows[i][1] < price_lows[i-1][1] and
            uo_lows[i][1] > uo_lows[i-1][1]):
            # Check if divergence low was below oversold
            if uo_lows[i-1][1] < oversold:
                # Look for UO to rise above divergence high
                div_high = max(uo.iloc[uo_lows[i-1][0]:uo_lows[i][0]])
                for j in range(uo_lows[i][0], min(uo_lows[i][0]+20, len(uo))):
                    if uo.iloc[j] > div_high:
                        signals.append((uo.index[j], 'BUY'))
                        break

    # Sell signals (similar logic for bearish divergence)
    for i in range(1, min(len(price_highs), len(uo_highs))):
        if (price_highs[i][1] > price_highs[i-1][1] and
            uo_highs[i][1] < uo_highs[i-1][1]):
            if uo_highs[i-1][1] > overbought:
                div_low = min(uo.iloc[uo_highs[i-1][0]:uo_highs[i][0]])
                for j in range(uo_highs[i][0], min(uo_highs[i][0]+20, len(uo))):
                    if uo.iloc[j] < div_low:
                        signals.append((uo.index[j], 'SELL'))
                        break

    return signals
```

---

## 2.5 Volatility Breakout System

### 2.5.1 Core Concept

Sustained price moves are born from moments of extreme volatility when price expands beyond recent normal range.

### 2.5.2 Implementation

```python
def volatility_breakout(ohlc, k_factor=0.25):
    """
    Larry Williams Volatility Breakout Strategy

    Entry Rules:
    - Long: Open + (Previous Range * k_factor)
    - Short: Open - (Previous Range * k_factor)

    Parameters:
    - k_factor: Multiplier for breakout range (default 0.25)
    """
    # Previous day's range
    prev_range = (ohlc['high'].shift(1) - ohlc['low'].shift(1))

    # Breakout levels
    long_entry = ohlc['open'] + (prev_range * k_factor)
    short_entry = ohlc['open'] - (prev_range * k_factor)

    return {
        'long_entry': long_entry,
        'short_entry': short_entry,
        'range': prev_range
    }

def volatility_breakout_signals(ohlc, k_factor=0.25, profit_mult=2, stop_mult=2):
    """
    Generate complete trading signals with stops and targets

    Default: Profit target and stop loss at 2x the breakout spread
    """
    breakout = volatility_breakout(ohlc, k_factor)

    signals = []
    position = None

    for i in range(1, len(ohlc)):
        current_high = ohlc['high'].iloc[i]
        current_low = ohlc['low'].iloc[i]

        if position is None:
            # Check for long entry
            if current_high >= breakout['long_entry'].iloc[i]:
                entry_price = breakout['long_entry'].iloc[i]
                spread = breakout['range'].iloc[i] * k_factor

                position = {
                    'type': 'LONG',
                    'entry_price': entry_price,
                    'stop_loss': entry_price - (spread * stop_mult),
                    'profit_target': entry_price + (spread * profit_mult),
                    'entry_index': i
                }
                signals.append((ohlc.index[i], 'LONG_ENTRY', position))

            # Check for short entry
            elif current_low <= breakout['short_entry'].iloc[i]:
                entry_price = breakout['short_entry'].iloc[i]
                spread = breakout['range'].iloc[i] * k_factor

                position = {
                    'type': 'SHORT',
                    'entry_price': entry_price,
                    'stop_loss': entry_price + (spread * stop_mult),
                    'profit_target': entry_price - (spread * profit_mult),
                    'entry_index': i
                }
                signals.append((ohlc.index[i], 'SHORT_ENTRY', position))

        else:
            # Manage existing position
            if position['type'] == 'LONG':
                if current_low <= position['stop_loss']:
                    signals.append((ohlc.index[i], 'STOP_LOSS', position))
                    position = None
                elif current_high >= position['profit_target']:
                    signals.append((ohlc.index[i], 'PROFIT_TARGET', position))
                    position = None

            elif position['type'] == 'SHORT':
                if current_high >= position['stop_loss']:
                    signals.append((ohlc.index[i], 'STOP_LOSS', position))
                    position = None
                elif current_low <= position['profit_target']:
                    signals.append((ohlc.index[i], 'PROFIT_TARGET', position))
                    position = None

    return signals
```

---

## 2.6 OOPS Pattern

### 2.6.1 Definition

Gap reversal pattern that fades the opening gap direction.

**Buy OOPS**:
- Market gaps down (opens below previous day's low)
- Price reverses and rises back to previous day's low
- Enter long at previous day's low

**Sell OOPS**:
- Market gaps up (opens above previous day's high)
- Price reverses and falls back to previous day's high
- Enter short at previous day's high

### 2.6.2 Implementation

```python
def detect_oops_pattern(ohlc):
    """
    Larry Williams OOPS Pattern Detection

    Approximately 93% of the time, price reverses to close the gap
    Works best on markets with overnight gaps (futures, European indices)

    Best days (S&P 500): Monday, Tuesday, Friday
    Avoid: Wednesday, Thursday
    """
    signals = []

    for i in range(1, len(ohlc)):
        prev_high = ohlc['high'].iloc[i-1]
        prev_low = ohlc['low'].iloc[i-1]
        curr_open = ohlc['open'].iloc[i]
        curr_high = ohlc['high'].iloc[i]
        curr_low = ohlc['low'].iloc[i]

        # Buy OOPS: Gap down below previous low
        if curr_open < prev_low:
            # Check if price returned to previous low
            if curr_high >= prev_low:
                signals.append({
                    'index': i,
                    'date': ohlc.index[i],
                    'type': 'BUY_OOPS',
                    'entry': prev_low,
                    'gap_size': prev_low - curr_open
                })

        # Sell OOPS: Gap up above previous high
        elif curr_open > prev_high:
            # Check if price returned to previous high
            if curr_low <= prev_high:
                signals.append({
                    'index': i,
                    'date': ohlc.index[i],
                    'type': 'SELL_OOPS',
                    'entry': prev_high,
                    'gap_size': curr_open - prev_high
                })

    return signals

def filter_oops_by_day(signals, preferred_days=['Monday', 'Tuesday', 'Friday']):
    """
    Filter OOPS signals by day of week (per Larry Williams' research)
    """
    return [s for s in signals
            if s['date'].day_name() in preferred_days]
```

---

## 2.7 COT (Commitment of Traders) Analysis

### 2.7.1 COT Index

```python
def cot_index(commercial_positions, lookback=26):
    """
    Larry Williams COT Index

    Normalizes commercial net position to 0-100 scale

    Interpretation:
    - Above 80%: Commercials heavily long (bullish)
    - Below 20%: Commercials heavily short (bearish)
    """
    max_pos = commercial_positions.rolling(lookback).max()
    min_pos = commercial_positions.rolling(lookback).min()

    cot_idx = ((commercial_positions - min_pos) / (max_pos - min_pos)) * 100

    return cot_idx

def cot_proxy(ohlc, period=14):
    """
    Larry Williams COT Proxy (no COT data needed)

    Formula: (SMA(Open-Close, period) / SMA(Range, period)) * 50 + 50

    Approximates commercial positioning from price action
    """
    open_close_diff = ohlc['open'] - ohlc['close']
    price_range = ohlc['high'] - ohlc['low']

    sma_oc = open_close_diff.rolling(period).mean()
    sma_range = price_range.rolling(period).mean()

    cot_proxy = (sma_oc / sma_range) * 50 + 50

    return cot_proxy

def cot_trading_signals(cot_index, threshold_high=80, threshold_low=20):
    """
    Generate trading signals from COT Index
    """
    signals = pd.Series(index=cot_index.index, data=0)

    # Commercials heavily long (bullish signal)
    signals[cot_index > threshold_high] = 1

    # Commercials heavily short (bearish signal)
    signals[cot_index < threshold_low] = -1

    return signals
```

### 2.7.2 Large Trade Index (LWTI)

```python
def large_trade_index(volume, close, period=14):
    """
    Larry Williams Large Trade Index

    Tracks institutional activity through volume analysis
    """
    # Calculate price direction
    price_change = close.diff()

    # Volume on up days vs down days
    up_volume = volume.where(price_change > 0, 0)
    down_volume = volume.where(price_change < 0, 0)

    # Ratio
    up_sum = up_volume.rolling(period).sum()
    down_sum = down_volume.rolling(period).sum()

    lwti = (up_sum / (up_sum + down_sum)) * 100

    return lwti
```

---

## 2.8 Seasonal Patterns

### 2.8.1 Day of Week Effects

```python
def day_of_week_analysis(ohlc):
    """
    Analyze returns by day of week (Larry Williams' research)

    Typical findings:
    - Monday: Often continuation of Friday's trend
    - Tuesday-Wednesday: Mid-week strength/weakness
    - Thursday: Often reversal day
    - Friday: Strong trending, position squaring
    """
    ohlc = ohlc.copy()
    ohlc['return'] = ohlc['close'].pct_change()
    ohlc['day_name'] = ohlc.index.day_name()

    day_stats = ohlc.groupby('day_name')['return'].agg([
        'mean', 'std', 'count',
        ('win_rate', lambda x: (x > 0).mean())
    ])

    return day_stats

def optimal_trading_days(ohlc, strategy='long'):
    """
    Identify optimal trading days based on historical performance
    """
    day_stats = day_of_week_analysis(ohlc)

    if strategy == 'long':
        # Days with positive mean return and high win rate
        optimal = day_stats[(day_stats['mean'] > 0) &
                           (day_stats['win_rate'] > 0.5)]
    else:
        # Days with negative mean return
        optimal = day_stats[(day_stats['mean'] < 0) &
                           (day_stats['win_rate'] < 0.5)]

    return optimal.index.tolist()
```

### 2.8.2 Monthly Patterns

```python
def monthly_seasonality(ohlc):
    """
    Analyze monthly seasonal patterns

    Common patterns:
    - January Effect: Small caps outperform
    - Sell in May: Summer weakness
    - September: Historically weak
    - November-December: Year-end rally
    """
    ohlc = ohlc.copy()
    ohlc['return'] = ohlc['close'].pct_change()
    ohlc['month'] = ohlc.index.month

    monthly_stats = ohlc.groupby('month')['return'].agg([
        'mean', 'std', 'count',
        ('win_rate', lambda x: (x > 0).mean())
    ])

    return monthly_stats

def end_of_month_pattern(ohlc, days_before=3, days_after=3):
    """
    Analyze end-of-month and beginning-of-month effects

    Larry Williams found enhanced patterns at month transitions
    due to institutional money flows
    """
    ohlc = ohlc.copy()
    ohlc['return'] = ohlc['close'].pct_change()
    ohlc['day_of_month'] = ohlc.index.day
    ohlc['days_in_month'] = ohlc.index.days_in_month

    # End of month (last N days)
    eom_mask = (ohlc['days_in_month'] - ohlc['day_of_month']) < days_before

    # Beginning of month (first N days)
    bom_mask = ohlc['day_of_month'] <= days_after

    eom_returns = ohlc[eom_mask]['return'].mean()
    bom_returns = ohlc[bom_mask]['return'].mean()
    mid_returns = ohlc[~eom_mask & ~bom_mask]['return'].mean()

    return {
        'end_of_month': eom_returns,
        'beginning_of_month': bom_returns,
        'mid_month': mid_returns
    }
```

---

## 2.9 Money Management

### 2.9.1 Larry Williams Position Sizing Formula

```python
def larry_williams_position_size(account_balance, risk_percent, largest_loss):
    """
    Larry Williams Money Management Formula

    Formula: (Account Balance * Risk Percent) / Largest Loss = Contracts

    From "Long-Term Secrets to Short-Term Trading" (1999), page 183

    Risk Percent Guidelines:
    - Conservative: 5%
    - Normal: 10%
    - Aggressive: 15%
    - Maximum: >15% (high drawdown risk)

    Note: 91% of Williams' 1987 profits came from money management,
    only 9% from the trading system itself
    """
    contracts = (account_balance * risk_percent) / abs(largest_loss)
    return int(contracts)

def position_size_with_drawdown(capital, risk_percent, max_drawdown):
    """
    Alternative Williams formula using max drawdown

    Formula: Risk% * Capital / (-Max_Drawdown) / 100
    """
    contracts = (risk_percent * capital) / abs(max_drawdown) / 100
    return int(contracts)

class WilliamsMoneyManager:
    """
    Complete money management system based on Larry Williams' principles
    """

    def __init__(self, initial_capital, risk_percent=0.10):
        self.capital = initial_capital
        self.risk_percent = risk_percent
        self.trades = []
        self.largest_loss = 0
        self.max_drawdown = 0
        self.peak_capital = initial_capital

    def update_trade(self, pnl):
        """Update after a trade"""
        self.trades.append(pnl)
        self.capital += pnl

        # Track largest loss
        if pnl < self.largest_loss:
            self.largest_loss = pnl

        # Track peak and drawdown
        if self.capital > self.peak_capital:
            self.peak_capital = self.capital

        current_drawdown = (self.peak_capital - self.capital) / self.peak_capital
        if current_drawdown > self.max_drawdown:
            self.max_drawdown = current_drawdown

    def get_position_size(self, trade_risk):
        """
        Calculate position size for next trade

        Parameters:
        - trade_risk: Dollar risk per contract/share for this trade
        """
        if abs(self.largest_loss) > 0:
            # Use historical largest loss
            risk_reference = abs(self.largest_loss)
        else:
            # No history yet, use trade risk
            risk_reference = abs(trade_risk)

        dollar_risk = self.capital * self.risk_percent
        position_size = dollar_risk / risk_reference

        return max(1, int(position_size))

    def get_stats(self):
        """Return performance statistics"""
        if not self.trades:
            return {}

        wins = [t for t in self.trades if t > 0]
        losses = [t for t in self.trades if t < 0]

        return {
            'total_trades': len(self.trades),
            'win_rate': len(wins) / len(self.trades) if self.trades else 0,
            'avg_win': sum(wins) / len(wins) if wins else 0,
            'avg_loss': sum(losses) / len(losses) if losses else 0,
            'largest_loss': self.largest_loss,
            'max_drawdown': self.max_drawdown,
            'current_capital': self.capital,
            'total_return': (self.capital - self.peak_capital) / self.peak_capital
        }
```

---

## 2.10 3-Bar Reversal (Smash Day)

### 2.10.1 Pattern Definition

Outside day (range expansion) followed by reversal:
- High > previous high AND Low < previous low
- Close below previous low (for buy setup) or above previous high (for sell setup)
- Next day opens in reversal direction

```python
def smash_day_pattern(ohlc):
    """
    Larry Williams 3-Bar Reversal / Smash Day Pattern

    Buy Setup:
    1. Outside bar (high > prev high, low < prev low)
    2. Close below previous low
    3. Next day opens lower than outside day's close
    4. Buy on next day's open

    Sell Setup:
    1. Outside bar
    2. Close above previous high
    3. Next day opens higher than outside day's close
    4. Sell on next day's open
    """
    signals = []

    for i in range(2, len(ohlc) - 1):
        prev_high = ohlc['high'].iloc[i-1]
        prev_low = ohlc['low'].iloc[i-1]
        curr_high = ohlc['high'].iloc[i]
        curr_low = ohlc['low'].iloc[i]
        curr_close = ohlc['close'].iloc[i]
        next_open = ohlc['open'].iloc[i+1]

        # Check for outside bar
        is_outside_bar = (curr_high > prev_high) and (curr_low < prev_low)

        if is_outside_bar:
            # Buy setup: close below previous low, next opens lower
            if curr_close < prev_low and next_open < curr_close:
                signals.append({
                    'index': i + 1,
                    'date': ohlc.index[i+1],
                    'type': 'BUY_SMASH',
                    'entry': next_open,
                    'stop': curr_low,
                    'pattern_bar': i
                })

            # Sell setup: close above previous high, next opens higher
            elif curr_close > prev_high and next_open > curr_close:
                signals.append({
                    'index': i + 1,
                    'date': ohlc.index[i+1],
                    'type': 'SELL_SMASH',
                    'entry': next_open,
                    'stop': curr_high,
                    'pattern_bar': i
                })

    return signals
```

---

# PART 3: INTEGRATION FRAMEWORK

## 3.1 ICT + Elliott Wave Integration

ICT concepts enhance Elliott Wave analysis:

| Elliott Wave Phase | ICT Concept | Application |
|-------------------|-------------|-------------|
| Wave 2 | OTE Zone (61.8-79%) | Entry for Wave 3 |
| Wave 4 | Premium Zone | Entry for Wave 5 |
| Wave B | Liquidity Sweep | Trap before Wave C |
| Wave 5 | FVG/Order Block | Momentum exhaustion |

```python
def ict_elliott_confluence(ohlc, wave_count):
    """
    Find confluence between ICT zones and Elliott Wave levels
    """
    # Get Elliott Wave retracement levels
    if wave_count['current_wave'] == 2:
        # Looking for Wave 3 entry
        wave_1_low = wave_count['wave_1']['low']
        wave_1_high = wave_count['wave_1']['high']

        # ICT OTE zone
        ote = find_ote_zone(ohlc, wave_1_high, wave_1_low, 'bullish')

        # Look for order blocks within OTE
        obs = detect_order_blocks(ohlc)
        bullish_obs_in_ote = [ob for ob in obs
                              if ob['type'] == 'bullish'
                              and ote['fib_79'] <= ob['top'] <= ote['fib_618']]

        return {
            'wave': 2,
            'ote_zone': ote,
            'order_blocks': bullish_obs_in_ote,
            'bias': 'LONG'
        }

    return None
```

## 3.2 ICT + Wyckoff Integration

| Wyckoff Phase | ICT Concept | Signal |
|--------------|-------------|--------|
| Accumulation | Order Block formation | Support zones |
| Spring | SSL Sweep | Long entry |
| Markup | BOS Confirmation | Trend continuation |
| Distribution | Bearish OB formation | Resistance zones |
| UTAD | BSL Sweep | Short entry |
| Markdown | CHoCH/MSS | Trend reversal |

```python
def ict_wyckoff_confluence(ohlc, wyckoff_phase):
    """
    Integrate ICT concepts with Wyckoff phases
    """
    if wyckoff_phase == 'spring':
        # Look for SSL sweep + bullish MSS
        ssl_zones = identify_sell_side_liquidity(ohlc)
        swept_ssl = [z for z in ssl_zones if z['swept']]

        if swept_ssl:
            # Look for bullish MSS after sweep
            mss = detect_mss(ohlc)
            bullish_mss = [m for m in mss if m[1] == 1]  # direction = 1

            if bullish_mss:
                return {
                    'phase': 'spring',
                    'ssl_swept': swept_ssl[-1],
                    'mss': bullish_mss[-1],
                    'signal': 'STRONG_BUY'
                }

    elif wyckoff_phase == 'utad':
        # Look for BSL sweep + bearish MSS
        bsl_zones = identify_buy_side_liquidity(ohlc)
        swept_bsl = [z for z in bsl_zones if z['swept']]

        if swept_bsl:
            mss = detect_mss(ohlc)
            bearish_mss = [m for m in mss if m[1] == -1]

            if bearish_mss:
                return {
                    'phase': 'utad',
                    'bsl_swept': swept_bsl[-1],
                    'mss': bearish_mss[-1],
                    'signal': 'STRONG_SELL'
                }

    return None
```

## 3.3 Larry Williams + ICT Integration

Combining Williams' indicators with ICT structure:

```python
def williams_ict_system(ohlc):
    """
    Combined Larry Williams + ICT Trading System

    Entry: ICT structure (OB, FVG, OTE)
    Confirmation: Williams indicators (%R, Ultimate Oscillator)
    Filter: COT positioning, seasonality
    Money Management: Williams position sizing
    """
    signals = []

    # ICT Analysis
    market_structure = detect_bos_choch(ohlc)
    order_blocks = detect_order_blocks(ohlc)
    fvgs = detect_fair_value_gaps(ohlc)
    pd_zones = calculate_premium_discount_zones(ohlc)

    # Williams Indicators
    percent_r = williams_percent_r(ohlc['high'], ohlc['low'], ohlc['close'])
    uo = ultimate_oscillator(ohlc['high'], ohlc['low'], ohlc['close'])
    cot = cot_proxy(ohlc)

    # Current state
    current_price = ohlc['close'].iloc[-1]
    current_r = percent_r.iloc[-1]
    current_uo = uo.iloc[-1]
    current_cot = cot.iloc[-1]
    current_zone = get_zone_bias(current_price, pd_zones)

    # Long Setup
    if current_zone == 'BUY_ZONE':  # In discount
        # Look for unmitigated bullish OB or FVG
        bullish_entries = [ob for ob in order_blocks
                          if ob['type'] == 'bullish' and not ob['mitigated']]
        bullish_entries += [fvg for fvg in fvgs
                           if fvg['type'] == 'bullish' and not fvg['filled']]

        if bullish_entries:
            # Williams confirmation
            r_oversold = current_r < -80
            uo_oversold = current_uo < 30
            cot_bullish = current_cot > 80

            confirmation_score = sum([r_oversold, uo_oversold, cot_bullish])

            if confirmation_score >= 2:
                signals.append({
                    'type': 'LONG',
                    'entry_zone': bullish_entries[0],
                    'williams_r': current_r,
                    'ultimate_osc': current_uo,
                    'cot_index': current_cot,
                    'confidence': confirmation_score / 3
                })

    # Short Setup
    elif current_zone == 'SELL_ZONE':  # In premium
        bearish_entries = [ob for ob in order_blocks
                          if ob['type'] == 'bearish' and not ob['mitigated']]
        bearish_entries += [fvg for fvg in fvgs
                           if fvg['type'] == 'bearish' and not fvg['filled']]

        if bearish_entries:
            r_overbought = current_r > -20
            uo_overbought = current_uo > 70
            cot_bearish = current_cot < 20

            confirmation_score = sum([r_overbought, uo_overbought, cot_bearish])

            if confirmation_score >= 2:
                signals.append({
                    'type': 'SHORT',
                    'entry_zone': bearish_entries[0],
                    'williams_r': current_r,
                    'ultimate_osc': current_uo,
                    'cot_index': current_cot,
                    'confidence': confirmation_score / 3
                })

    return signals
```

---

# PART 4: GITHUB IMPLEMENTATIONS

## 4.1 ICT Smart Money Concepts Libraries

### Primary Python Package

**[joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts)**
- **Stars**: 1,089+ (highly popular)
- **Features**: Order blocks, FVG, BOS/CHoCH, Liquidity, Swing highs/lows
- **Installation**: `pip install smartmoneyconcepts`

```python
# Usage example
import smartmoneyconcepts as smc

# Detect order blocks
order_blocks = smc.ob(ohlc)

# Detect fair value gaps
fvgs = smc.fvg(ohlc)

# Detect market structure
structure = smc.bos_choch(ohlc)

# Detect liquidity zones
liquidity = smc.liquidity(ohlc)
```

### Additional Repositories

| Repository | Platform | Features |
|------------|----------|----------|
| [smtlab/smartmoneyconcepts](https://github.com/smtlab/smartmoneyconcepts) | Python | FVG, OB, Liquidity, Highs/Lows |
| [tpwilo/smc](https://github.com/tpwilo/smc) | Python | Fork with enhancements |
| [sailoo121/ss_smc](https://github.com/sailoo121/ss_smc) | Python | ICT methods integration |
| [rpanchyk/mt5-fvg-ind](https://github.com/rpanchyk/mt5-fvg-ind) | MetaTrader 5 | FVG indicator |
| [sonnyparlin/fvg_pinescript](https://github.com/sonnyparlin/fvg_pinescript) | Pine Script | TradingView FVG |
| [manyavangimalla/Trading-Indicator](https://github.com/manyavangimalla/Trading-Indicator) | Pine Script/Chrome | BOS, CHoCH, FVG, Fibonacci |

## 4.2 Larry Williams Implementations

### Williams %R in Backtrader

**[mementum/backtrader](https://github.com/mementum/backtrader)**
- File: `backtrader/indicators/williams.py`
- Built-in Williams %R implementation

```python
# Backtrader Williams %R
import backtrader as bt

class WilliamsRStrategy(bt.Strategy):
    params = (('period', 14),)

    def __init__(self):
        self.williams_r = bt.indicators.WilliamsR(period=self.p.period)
```

### GitHub Topics

- **[larry-williams](https://github.com/topics/larry-williams)**: Technical indicators including %R, Momentum, CCI, RSI
- **[williams-r](https://github.com/topics/williams-r)**: Specific implementations of Williams %R

## 4.3 TradingView Indicators

**LuxAlgo Tools**:
- [Buyside & Sellside Liquidity](https://www.tradingview.com/script/Qk4vBbfL-Buyside-Sellside-Liquidity-LuxAlgo/)
- [Market Structure CHoCH/BOS](https://www.tradingview.com/script/ZpHqSrBK-Market-Structure-CHoCH-BOS-Fractal-LuxAlgo/)
- [ICT Premium & Discount](https://www.tradingview.com/script/omnLTn3f-TehThomas-ICT-Premium-Discount/)

---

# PART 5: COMPLETE TRADING SYSTEM

## 5.1 Full Implementation Example

```python
class ICTWilliamsTradingSystem:
    """
    Complete algorithmic trading system combining:
    - ICT Smart Money Concepts
    - Larry Williams indicators
    - Multi-timeframe analysis
    - Position sizing
    """

    def __init__(self, initial_capital=100000, risk_percent=0.10):
        self.money_manager = WilliamsMoneyManager(initial_capital, risk_percent)
        self.positions = []
        self.trade_history = []

    def analyze(self, ohlc, htf_ohlc=None):
        """
        Complete market analysis

        Parameters:
        - ohlc: Primary timeframe OHLC data
        - htf_ohlc: Higher timeframe for bias (optional)
        """
        analysis = {
            'timestamp': ohlc.index[-1],
            'price': ohlc['close'].iloc[-1]
        }

        # ICT Market Structure
        analysis['market_structure'] = {
            'bos': detect_bullish_bos(ohlc['high'], ohlc['low']),
            'choch': detect_choch(ohlc['high'], ohlc['low'], ohlc['close']),
            'mss': detect_mss(ohlc)
        }

        # ICT Zones
        analysis['order_blocks'] = detect_order_blocks(ohlc)
        analysis['fvgs'] = detect_fair_value_gaps(ohlc)
        analysis['liquidity'] = {
            'bsl': identify_buy_side_liquidity(ohlc),
            'ssl': identify_sell_side_liquidity(ohlc)
        }
        analysis['pd_zones'] = calculate_premium_discount_zones(ohlc)

        # Williams Indicators
        analysis['williams'] = {
            'percent_r': williams_percent_r(ohlc['high'], ohlc['low'],
                                           ohlc['close']).iloc[-1],
            'ultimate_osc': ultimate_oscillator(ohlc['high'], ohlc['low'],
                                               ohlc['close']).iloc[-1],
            'wad': williams_accumulation_distribution(ohlc['high'], ohlc['low'],
                                                     ohlc['close']).iloc[-1],
            'cot_proxy': cot_proxy(ohlc).iloc[-1]
        }

        # Kill Zone
        analysis['kill_zone'] = get_kill_zone(analysis['timestamp'])

        # Higher timeframe bias
        if htf_ohlc is not None:
            htf_structure = detect_bos_choch(htf_ohlc)
            analysis['htf_bias'] = 'BULLISH' if htf_structure['trend'] == 1 else 'BEARISH'

        return analysis

    def generate_signal(self, analysis):
        """
        Generate trading signal from analysis
        """
        signal = None

        # Check if in optimal trading time
        if analysis['kill_zone'] is None:
            return None

        current_price = analysis['price']
        pd_zones = analysis['pd_zones']
        williams = analysis['williams']

        # Determine zone
        is_discount = current_price < pd_zones['equilibrium']
        is_premium = current_price > pd_zones['equilibrium']

        # Long signal conditions
        if is_discount:
            # ICT: Look for unmitigated bullish OB or FVG
            bullish_zones = [ob for ob in analysis['order_blocks']
                           if ob['type'] == 'bullish' and not ob['mitigated']]
            bullish_zones += [fvg for fvg in analysis['fvgs']
                            if fvg['type'] == 'bullish' and not fvg['filled']]

            # Williams: Oversold confirmation
            williams_bullish = (
                williams['percent_r'] < -80 or
                williams['ultimate_osc'] < 30 or
                williams['cot_proxy'] > 80
            )

            if bullish_zones and williams_bullish:
                entry_zone = bullish_zones[0]
                signal = {
                    'type': 'LONG',
                    'entry': entry_zone.get('top', entry_zone.get('bottom')),
                    'stop_loss': entry_zone.get('bottom', entry_zone.get('top')) * 0.99,
                    'take_profit': pd_zones['equilibrium'],
                    'zone': entry_zone,
                    'kill_zone': analysis['kill_zone'],
                    'confidence': self._calculate_confidence(analysis, 'LONG')
                }

        # Short signal conditions
        elif is_premium:
            bearish_zones = [ob for ob in analysis['order_blocks']
                           if ob['type'] == 'bearish' and not ob['mitigated']]
            bearish_zones += [fvg for fvg in analysis['fvgs']
                            if fvg['type'] == 'bearish' and not fvg['filled']]

            williams_bearish = (
                williams['percent_r'] > -20 or
                williams['ultimate_osc'] > 70 or
                williams['cot_proxy'] < 20
            )

            if bearish_zones and williams_bearish:
                entry_zone = bearish_zones[0]
                signal = {
                    'type': 'SHORT',
                    'entry': entry_zone.get('bottom', entry_zone.get('top')),
                    'stop_loss': entry_zone.get('top', entry_zone.get('bottom')) * 1.01,
                    'take_profit': pd_zones['equilibrium'],
                    'zone': entry_zone,
                    'kill_zone': analysis['kill_zone'],
                    'confidence': self._calculate_confidence(analysis, 'SHORT')
                }

        return signal

    def _calculate_confidence(self, analysis, direction):
        """
        Calculate confidence score (0-1) based on confluence
        """
        score = 0
        max_score = 5

        williams = analysis['williams']

        if direction == 'LONG':
            if williams['percent_r'] < -80: score += 1
            if williams['ultimate_osc'] < 30: score += 1
            if williams['cot_proxy'] > 80: score += 1
            if analysis['kill_zone'] in ['london', 'new_york_am']: score += 1
            if analysis.get('htf_bias') == 'BULLISH': score += 1
        else:
            if williams['percent_r'] > -20: score += 1
            if williams['ultimate_osc'] > 70: score += 1
            if williams['cot_proxy'] < 20: score += 1
            if analysis['kill_zone'] in ['london', 'new_york_am']: score += 1
            if analysis.get('htf_bias') == 'BEARISH': score += 1

        return score / max_score

    def execute_signal(self, signal, current_price):
        """
        Execute trading signal with position sizing
        """
        if signal is None or signal['confidence'] < 0.4:
            return None

        # Calculate position size
        trade_risk = abs(signal['entry'] - signal['stop_loss'])
        position_size = self.money_manager.get_position_size(trade_risk)

        position = {
            'type': signal['type'],
            'entry_price': signal['entry'],
            'stop_loss': signal['stop_loss'],
            'take_profit': signal['take_profit'],
            'size': position_size,
            'entry_time': signal.get('timestamp'),
            'confidence': signal['confidence']
        }

        self.positions.append(position)
        return position
```

---

## Summary

This research document provides comprehensive algorithmic specifications for:

**ICT Smart Money Concepts**:
- Market structure analysis (BOS, CHoCH, MSS)
- Order blocks and fair value gaps
- Liquidity concepts (BSL, SSL)
- Premium/discount zones and OTE
- Breaker and mitigation blocks
- Kill zones and Silver Bullet strategy

**Larry Williams Methods**:
- Williams %R indicator
- Ultimate Oscillator
- Williams Accumulation/Distribution
- Volatility breakout system
- OOPS pattern and Smash Day
- COT analysis and seasonal patterns
- Position sizing formula

**GitHub Resources**:
- Primary: [joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts) (1,089+ stars)
- Multiple Python, Pine Script, and MetaTrader implementations

**Integration**: Complete framework for combining ICT and Williams methods with Elliott Wave, Wyckoff, and Livermore/O'Neil approaches.

---

## Sources

### ICT Smart Money Concepts
- [ICT Trading: The Ultimate Guide](https://eplanetbrokers.com/en-US/training/ict-trading-strategy-explained)
- [FXOpen: Inner Circle Trading Concepts](https://fxopen.com/blog/en/what-are-the-inner-circle-trading-concepts/)
- [LuxAlgo: ICT Order Blocks](https://www.luxalgo.com/blog/ict-trader-concepts-order-blocks-unpacked/)
- [Equiti: Fair Value Gap Guide](https://www.equiti.com/sc-en/news/trading-ideas/fair-value-gap-fvg-the-complete-guide-for-ict-traders/)
- [Inner Circle Trader: Kill Zones](https://innercircletrader.net/tutorials/master-ict-kill-zones/)
- [WritoFinance: Premium and Discount Zones](https://www.writofinance.com/premium-and-discount-zone/)
- [Inner Circle Trader: OTE](https://innercircletrader.net/tutorials/ict-optimal-trade-entry-ote-pattern/)
- [FXOpen: Silver Bullet Strategy](https://fxopen.com/blog/en/what-is-the-ict-silver-bullet-strategy-and-how-does-it-work/)

### Larry Williams
- [Wikipedia: Larry R. Williams](https://en.wikipedia.org/wiki/Larry_R._Williams)
- [I Really Trade: COT Report](https://www.ireallytrade.com/cotreport/)
- [StockCharts: Williams %R](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/williams-r)
- [StockCharts: Ultimate Oscillator](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/ultimate-oscillator)
- [WH SelfInvest: Volatility Breakout](https://www.whselfinvest.com/en-lu/trading-platform/free-trading-strategies/tradingsystem/56-volatility-break-out-larry-williams-free)
- [Unger Academy: OOPS Pattern](https://ungeracademy.com/blog/we-tested-larry-williams-oops-pattern-the-results-might-surprise-you)
- [QuantifiedStrategies: Larry Williams Strategies](https://www.quantifiedstrategies.com/larry-williams-trading-strategies/)
- [NinjaTrader: Williams on Seasonality](https://ninjatrader.com/futures/blogs/larry-williams-on-the-seasonality-of-the-futures-markets/)

### GitHub Repositories
- [joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts)
- [smtlab/smartmoneyconcepts](https://github.com/smtlab/smartmoneyconcepts)
- [mementum/backtrader](https://github.com/mementum/backtrader)
- [manyavangimalla/Trading-Indicator](https://github.com/manyavangimalla/Trading-Indicator)
