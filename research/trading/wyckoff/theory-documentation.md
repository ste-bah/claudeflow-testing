# Wyckoff Method: Comprehensive Research for Algorithmic Implementation

## Research Metadata
- **Research Date**: 2025-01-25
- **Agent**: #4 of 10 (Research Agent)
- **Previous Research**: APIs, Sentiment, Elliott Wave (~50% standalone accuracy)
- **Purpose**: Document Wyckoff Method for algorithmic accumulation/distribution detection
- **Key Finding**: Wyckoff provides volume-price analysis complementary to Elliott Wave patterns

---

## Executive Summary

The Wyckoff Method, developed by Richard D. Wyckoff in the 1920s-1930s, is a comprehensive approach to market analysis that focuses on understanding institutional behavior through price-volume relationships. Unlike pattern-based methods, Wyckoff emphasizes the **cause-and-effect** relationship between accumulation/distribution phases and subsequent price movements.

**Key Algorithmic Value**:
- Volume-based confirmation (addresses Elliott Wave's weakness)
- Clear phase-based market structure
- Defined events with measurable characteristics
- ~65-70% success rate for distribution patterns
- 99.34% pattern recognition accuracy achieved with deep learning (LSTM/CNN)

---

## Section 1: The Three Fundamental Laws

### 1.1 Law of Supply and Demand

**Concept**: Price movement is determined by the relative balance between buying pressure (demand) and selling pressure (supply).

**Algorithmic Definition**:
```
IF demand > supply THEN price_direction = UP
IF supply > demand THEN price_direction = DOWN
IF supply ≈ demand THEN price_direction = SIDEWAYS (consolidation)
```

**Detection Metrics**:
- **Volume on up-moves vs down-moves**: Higher volume on advances = demand dominance
- **Spread analysis**: Wide spreads on advances with high volume = strong demand
- **Closing position**: Closes near highs = buyers in control; near lows = sellers in control

**Implementation**:
```python
def calculate_supply_demand_balance(candles, period=14):
    """
    Calculate supply/demand balance using volume and price action
    Returns: float between -1 (supply dominant) and +1 (demand dominant)
    """
    up_volume = 0
    down_volume = 0

    for candle in candles[-period:]:
        spread = candle.high - candle.low
        close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5

        if candle.close > candle.open:  # Up candle
            up_volume += candle.volume * close_position
        else:  # Down candle
            down_volume += candle.volume * (1 - close_position)

    total_volume = up_volume + down_volume
    if total_volume == 0:
        return 0

    return (up_volume - down_volume) / total_volume
```

### 1.2 Law of Cause and Effect

**Concept**: Every price movement (effect) is preceded by a period of preparation (cause). The magnitude of the cause determines the magnitude of the effect.

**Key Principle**: "The bigger the base, the bigger the rally"

**Algorithmic Definition**:
```
cause_magnitude = trading_range_width × trading_range_duration
expected_effect = cause_magnitude × multiplier_factor
```

**Point & Figure Price Target Calculation**:
```python
def calculate_pnf_price_target(
    box_size: float,
    reversal_size: int,  # Usually 3
    column_count: int,   # Horizontal count in trading range
    breakout_point: float,
    direction: str  # 'UP' or 'DOWN'
) -> float:
    """
    Calculate Wyckoff P&F price target
    """
    projected_move = column_count * box_size * reversal_size

    if direction == 'UP':
        return breakout_point + projected_move
    else:
        return breakout_point - projected_move

# Example: 20 columns × $10 box × 3 reversal = $600 projected move
```

### 1.3 Law of Effort vs Result

**Concept**: Volume (effort) should confirm price movement (result). Divergence between effort and result signals potential reversals.

**Harmony Conditions**:
| Volume | Price Move | Interpretation |
|--------|-----------|----------------|
| High | Large advance | Bullish continuation |
| High | Large decline | Bearish continuation |
| Low | Small move | Neutral/consolidation |

**Divergence Conditions (Reversal Signals)**:
| Volume | Price Move | Interpretation |
|--------|-----------|----------------|
| High | Small advance | Absorption/distribution |
| High | Small decline | Accumulation/support |
| Low | Large advance | Weak rally, likely to fail |
| Low | Large decline | Weak selloff, near support |

**Implementation**:
```python
def detect_effort_result_divergence(candles, lookback=5):
    """
    Detect divergence between volume (effort) and price (result)
    Returns: dict with divergence type and strength
    """
    recent = candles[-lookback:]

    # Calculate average volume and price change
    avg_volume = sum(c.volume for c in recent) / lookback
    price_change = recent[-1].close - recent[0].open
    avg_spread = sum(c.high - c.low for c in recent) / lookback

    # Normalize
    volume_factor = recent[-1].volume / avg_volume if avg_volume > 0 else 1
    result_factor = abs(price_change) / (avg_spread * lookback) if avg_spread > 0 else 0

    # Detect divergence
    effort_result_ratio = volume_factor / result_factor if result_factor > 0 else float('inf')

    divergence = {
        'type': None,
        'strength': 0,
        'volume_factor': volume_factor,
        'result_factor': result_factor
    }

    if effort_result_ratio > 2.0:  # High effort, low result
        divergence['type'] = 'ABSORPTION'
        divergence['strength'] = min((effort_result_ratio - 1) / 3, 1.0)
    elif effort_result_ratio < 0.5:  # Low effort, high result
        divergence['type'] = 'WEAK_MOVE'
        divergence['strength'] = min((1 - effort_result_ratio) / 0.5, 1.0)

    return divergence
```

---

## Section 2: The Four Market Phases

### 2.1 Phase Overview

```
    MARKUP
      ▲
      │
ACCUMULATION ────────► DISTRIBUTION
      │                     │
      ◄─────────────────────┘
           MARKDOWN
```

| Phase | Duration | Volume Characteristics | Composite Operator Action |
|-------|----------|----------------------|---------------------------|
| Accumulation | Weeks-Months | Declining overall, spikes on tests | Buying at low prices |
| Markup | Varies | Increasing on advances, low on pullbacks | Holding, adding positions |
| Distribution | Weeks-Months | High overall, spikes on rallies | Selling at high prices |
| Markdown | Varies | High on declines, low on rallies | Short selling or absent |

### 2.2 Phase Detection Algorithm

```python
class WyckoffPhaseDetector:
    def __init__(self, lookback_period=50):
        self.lookback = lookback_period

    def detect_phase(self, candles, volume_data):
        """
        Detect current Wyckoff market phase
        Returns: 'ACCUMULATION', 'MARKUP', 'DISTRIBUTION', 'MARKDOWN', or 'UNKNOWN'
        """
        # Calculate key metrics
        trend = self._calculate_trend(candles)
        volatility = self._calculate_volatility(candles)
        volume_trend = self._calculate_volume_trend(volume_data)
        range_bound = self._is_range_bound(candles)

        # Phase logic
        if range_bound:
            # In trading range - either accumulation or distribution
            if trend['prior'] == 'DOWN':
                return 'ACCUMULATION'
            elif trend['prior'] == 'UP':
                return 'DISTRIBUTION'
        else:
            # Trending - either markup or markdown
            if trend['current'] == 'UP' and volume_trend == 'INCREASING_ON_ADVANCES':
                return 'MARKUP'
            elif trend['current'] == 'DOWN' and volume_trend == 'INCREASING_ON_DECLINES':
                return 'MARKDOWN'

        return 'UNKNOWN'

    def _is_range_bound(self, candles, threshold=0.15):
        """Check if price is in a trading range"""
        highs = [c.high for c in candles[-self.lookback:]]
        lows = [c.low for c in candles[-self.lookback:]]

        range_size = max(highs) - min(lows)
        avg_price = sum(c.close for c in candles[-self.lookback:]) / self.lookback

        return (range_size / avg_price) < threshold
```

---

## Section 3: Accumulation Schematic (Complete)

### 3.1 ASCII Schematic

```
                                    ACCUMULATION SCHEMATIC

    Price
      │
      │    AR ─────────────────────────────────────────────── RESISTANCE (Creek)
      │   /│\                    ┌───────────┐
      │  / │ \      ST    ST    │   SOS     │    LPS    BU/JOC
      │ /  │  \    /  \  /  \  │  /    \   │   /  \   /
      │/   │   \  /    \/    \/│ /      \  │  /    \ /
    ──┼────│────\/──────────────┼──────────\─│───────\──────────────►
      │    │                    │           \│        \    MARKUP
      │    │   SC               │            │         \
      │    │  /                 │  Spring    │          └────────────
      │    │ /                  │    │       │
      │    │/                   └────┴───────┘
      │   SC ──────────────────────────────────────────── SUPPORT (Ice)
      │  /
      │ /  PS
      │/
    ──┴────────────────────────────────────────────────────────────────► Time

      │←─ Phase A ─→│←───── Phase B ─────→│← C →│←── Phase D ──→│← E →│
```

### 3.2 Accumulation Events Detail

#### Phase A: Stopping the Downtrend

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **PS** | Preliminary Support | Increasing | First pause in downtrend | Smart money starts buying |
| **SC** | Selling Climax | Spike (2-3x average) | Sharp drop, wide spread, long lower wick | Panic selling absorbed by institutions |
| **AR** | Automatic Rally | Moderate-High | Strong bounce (can be 50-100% of prior decline) | Short covering, buying pressure |
| **ST** | Secondary Test | Lower than SC | Revisits SC area, holds above | Confirms downtrend has stopped |

#### Phase B: Building the Cause

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **ST** | Secondary Tests | Decreasing trend | Tests support/resistance | Institutions accumulate on weakness |
| - | Range Trading | Variable | Price oscillates in range | Building cause for future markup |

#### Phase C: The Spring (Critical Event)

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **Spring** | Spring/Shakeout | LOW volume ideal | Breaks below support, quickly reverses | Bear trap, stops out weak holders |
| **Test** | Test of Spring | Very Low | Approaches spring low, holds higher | Confirms supply exhausted |

#### Phase D: Transition to Markup

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **SOS** | Sign of Strength | High, expanding | Strong advance, breaks above resistance | Demand takes control |
| **LPS** | Last Point of Support | Decreasing | Pullback holds at higher level | Final buying opportunity |
| **BU/JOC** | Backup/Jump Over Creek | Low on pullback | Retest of broken resistance as support | Confirmation of breakout |

#### Phase E: Markup Begins

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| - | Markup | High on advances, low on pullbacks | Higher highs, higher lows | Uptrend established |

### 3.3 Algorithmic Detection: Accumulation Events

```python
class AccumulationDetector:
    def __init__(self, config=None):
        self.config = config or {
            'sc_volume_multiplier': 2.0,      # SC volume should be 2x+ average
            'spring_max_volume_ratio': 0.8,   # Spring volume should be < 80% average
            'sos_min_volume_ratio': 1.5,      # SOS volume should be 150%+ average
            'range_atr_multiplier': 2.0,      # Trading range width in ATRs
        }

    def detect_selling_climax(self, candles, volume_data):
        """
        Detect Selling Climax (SC) event

        Criteria:
        1. After a downtrend
        2. Volume spike (2-3x average)
        3. Wide spread (large range candle)
        4. Close near low with long lower wick (panic selling absorbed)
        """
        lookback = 20
        recent = candles[-lookback:]

        # Check for prior downtrend
        if not self._is_downtrend(candles[:-lookback]):
            return None

        # Find potential SC candidates
        avg_volume = sum(volume_data[-lookback:-1]) / (lookback - 1)
        avg_spread = sum(c.high - c.low for c in recent[:-1]) / (lookback - 1)

        for i in range(-5, 0):  # Check last 5 candles
            candle = candles[i]
            volume = volume_data[i]
            spread = candle.high - candle.low

            # SC Criteria
            volume_ratio = volume / avg_volume if avg_volume > 0 else 0
            spread_ratio = spread / avg_spread if avg_spread > 0 else 0
            close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5
            lower_wick = candle.low - min(candle.open, candle.close)
            wick_ratio = lower_wick / spread if spread > 0 else 0

            if (volume_ratio >= self.config['sc_volume_multiplier'] and
                spread_ratio >= 1.5 and
                close_position < 0.4 and  # Close in lower 40%
                wick_ratio > 0.3):        # Significant lower wick

                return {
                    'event': 'SELLING_CLIMAX',
                    'candle_index': i,
                    'price_low': candle.low,
                    'volume_ratio': volume_ratio,
                    'spread_ratio': spread_ratio,
                    'confidence': min(volume_ratio / 3 * spread_ratio / 2, 1.0)
                }

        return None

    def detect_spring(self, candles, volume_data, support_level):
        """
        Detect Spring event

        Criteria:
        1. Price breaks below support level
        2. Volume should be LOW (ideally < average)
        3. Quick reversal back above support
        4. Subsequent test holds above spring low
        """
        lookback = 10
        avg_volume = sum(volume_data[-30:-lookback]) / 20

        for i in range(-lookback, 0):
            candle = candles[i]
            volume = volume_data[i]

            # Check for break below support
            if candle.low < support_level:
                # Check for reversal (close above support or back above)
                closed_above = candle.close > support_level
                next_candle_above = (i < -1 and candles[i+1].close > support_level)

                if closed_above or next_candle_above:
                    volume_ratio = volume / avg_volume if avg_volume > 0 else 1
                    penetration = (support_level - candle.low) / support_level

                    # Low volume spring is ideal
                    if volume_ratio < self.config['spring_max_volume_ratio']:
                        return {
                            'event': 'SPRING',
                            'candle_index': i,
                            'spring_low': candle.low,
                            'support_level': support_level,
                            'penetration_pct': penetration * 100,
                            'volume_ratio': volume_ratio,
                            'confidence': (1 - volume_ratio) * 0.5 + 0.5
                        }
                    else:
                        # High volume spring (shakeout) - less ideal but valid
                        return {
                            'event': 'SHAKEOUT',
                            'candle_index': i,
                            'spring_low': candle.low,
                            'support_level': support_level,
                            'penetration_pct': penetration * 100,
                            'volume_ratio': volume_ratio,
                            'confidence': 0.5
                        }

        return None

    def detect_sign_of_strength(self, candles, volume_data, resistance_level):
        """
        Detect Sign of Strength (SOS) event

        Criteria:
        1. Strong price advance
        2. High volume (expanding)
        3. Breaks above resistance
        4. Wide spread with close near high
        """
        lookback = 10
        avg_volume = sum(volume_data[-30:-lookback]) / 20
        avg_spread = sum(c.high - c.low for c in candles[-30:-lookback]) / 20

        for i in range(-lookback, 0):
            candle = candles[i]
            volume = volume_data[i]
            spread = candle.high - candle.low

            # Check for break above resistance
            if candle.high > resistance_level and candle.close > resistance_level:
                volume_ratio = volume / avg_volume if avg_volume > 0 else 0
                spread_ratio = spread / avg_spread if avg_spread > 0 else 0
                close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5

                if (volume_ratio >= self.config['sos_min_volume_ratio'] and
                    spread_ratio >= 1.2 and
                    close_position > 0.6):  # Close in upper 40%

                    return {
                        'event': 'SIGN_OF_STRENGTH',
                        'candle_index': i,
                        'breakout_price': candle.close,
                        'resistance_level': resistance_level,
                        'volume_ratio': volume_ratio,
                        'spread_ratio': spread_ratio,
                        'confidence': min(volume_ratio / 2 * spread_ratio, 1.0)
                    }

        return None

    def detect_last_point_of_support(self, candles, volume_data, sos_event):
        """
        Detect Last Point of Support (LPS) after SOS

        Criteria:
        1. Pullback after SOS
        2. Decreasing/low volume on pullback
        3. Holds above former resistance (now support)
        4. Narrow spread candles
        """
        if not sos_event:
            return None

        sos_index = sos_event['candle_index']
        support_level = sos_event['resistance_level']

        # Look for pullback after SOS
        for i in range(sos_index + 3, min(sos_index + 15, 0)):
            candle = candles[i]
            volume = volume_data[i]

            # Check if this is a low point in pullback
            is_local_low = (candle.low <= min(c.low for c in candles[i-2:i+1]))

            if is_local_low and candle.low > support_level * 0.98:  # Within 2% of support
                # Check volume is declining
                recent_volumes = volume_data[sos_index:i]
                volume_declining = all(
                    recent_volumes[j] >= recent_volumes[j+1]
                    for j in range(len(recent_volumes)-1)
                ) if len(recent_volumes) > 1 else True

                return {
                    'event': 'LAST_POINT_OF_SUPPORT',
                    'candle_index': i,
                    'lps_low': candle.low,
                    'support_level': support_level,
                    'volume_declining': volume_declining,
                    'confidence': 0.7 if volume_declining else 0.5
                }

        return None
```

---

## Section 4: Distribution Schematic (Complete)

### 4.1 ASCII Schematic

```
                                    DISTRIBUTION SCHEMATIC

    Price
      │                                     UTAD
      │                                    /    \
      │         BC ─────────────────────/───────\──────── RESISTANCE
      │        /│\         ┌───────┐  /          \
      │       / │ \   ST  │  SOW  │ /    LPSY    \
      │      /  │  \ /  \ │ /   \ │/    /   \    │
      │     /   │   \    \│/     \│    /     \   │
    ──┼────/────│────\────┼───────┼───/───────\──│─────────────────►
      │  /      │     \   │       │  /         \ │   MARKDOWN
      │ / PSY   │      \  │       │ /           \│
      │/        │       \ │       │/             \
      │         │        \│       │               \
      │        AR ────────┴───────┴──────────────── SUPPORT
      │                                              \
      │                                               \
      │                                                └──────────────
    ──┴───────────────────────────────────────────────────────────────► Time

      │←─ Phase A ─→│←───── Phase B ─────→│← C →│←── Phase D ──→│← E →│
```

### 4.2 Distribution Events Detail

#### Phase A: Stopping the Uptrend

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **PSY** | Preliminary Supply | Increasing | First pause in uptrend | Smart money starts selling |
| **BC** | Buying Climax | Spike (often with good news) | Sharp rally, wide spread, climactic buying | Public buying absorbed by institutions |
| **AR** | Automatic Reaction | Moderate | Decline that defines lower boundary | Profit taking, selling pressure |
| **ST** | Secondary Test | Lower than BC | Revisits BC area | Confirms uptrend momentum weakening |

#### Phase B: Building the Cause (Distribution)

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **ST** | Secondary Tests | Variable | Tests support/resistance | Institutions distribute to buyers |
| **UT** | Upthrust | High | Breaks above resistance, fails | Tests remaining demand |

#### Phase C: The UTAD (Critical Event)

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **UTAD** | Upthrust After Distribution | High | False breakout above BC, reverses | Bull trap, final distribution |

#### Phase D: Transition to Markdown

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| **SOW** | Sign of Weakness | High, expanding | Strong decline through support | Supply takes control |
| **LPSY** | Last Point of Supply | Decreasing | Weak rally fails at resistance | Final shorting opportunity |

#### Phase E: Markdown Begins

| Event | Full Name | Volume | Price Action | Purpose |
|-------|-----------|--------|--------------|---------|
| - | Markdown | High on declines, low on rallies | Lower highs, lower lows | Downtrend established |

### 4.3 Algorithmic Detection: Distribution Events

```python
class DistributionDetector:
    def __init__(self, config=None):
        self.config = config or {
            'bc_volume_multiplier': 2.0,
            'utad_min_penetration': 0.01,  # 1% above resistance
            'sow_volume_multiplier': 1.5,
        }

    def detect_buying_climax(self, candles, volume_data):
        """
        Detect Buying Climax (BC) event

        Criteria:
        1. After an uptrend
        2. Volume spike (often coincides with good news)
        3. Wide spread with climactic buying
        4. Close near high initially
        """
        lookback = 20

        # Check for prior uptrend
        if not self._is_uptrend(candles[:-lookback]):
            return None

        avg_volume = sum(volume_data[-lookback:-1]) / (lookback - 1)
        avg_spread = sum(c.high - c.low for c in candles[-lookback:-1]) / (lookback - 1)

        for i in range(-5, 0):
            candle = candles[i]
            volume = volume_data[i]
            spread = candle.high - candle.low

            volume_ratio = volume / avg_volume if avg_volume > 0 else 0
            spread_ratio = spread / avg_spread if avg_spread > 0 else 0
            close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5

            if (volume_ratio >= self.config['bc_volume_multiplier'] and
                spread_ratio >= 1.5 and
                candle.close > candle.open):  # Green candle

                return {
                    'event': 'BUYING_CLIMAX',
                    'candle_index': i,
                    'price_high': candle.high,
                    'volume_ratio': volume_ratio,
                    'spread_ratio': spread_ratio,
                    'confidence': min(volume_ratio / 3 * spread_ratio / 2, 1.0)
                }

        return None

    def detect_utad(self, candles, volume_data, resistance_level):
        """
        Detect Upthrust After Distribution (UTAD)

        Criteria:
        1. Price breaks above resistance
        2. High volume (bull trap)
        3. Quick reversal back below resistance
        4. Close below resistance
        """
        lookback = 10
        avg_volume = sum(volume_data[-30:-lookback]) / 20

        for i in range(-lookback, 0):
            candle = candles[i]
            volume = volume_data[i]

            # Check for break above resistance with reversal
            penetration = (candle.high - resistance_level) / resistance_level

            if (candle.high > resistance_level * (1 + self.config['utad_min_penetration']) and
                candle.close < resistance_level):

                volume_ratio = volume / avg_volume if avg_volume > 0 else 0

                # UTAD typically has high volume (bull trap)
                if volume_ratio >= 1.0:
                    return {
                        'event': 'UTAD',
                        'candle_index': i,
                        'high': candle.high,
                        'resistance_level': resistance_level,
                        'penetration_pct': penetration * 100,
                        'volume_ratio': volume_ratio,
                        'confidence': min(volume_ratio / 2 * penetration * 10, 1.0)
                    }

        return None

    def detect_sign_of_weakness(self, candles, volume_data, support_level):
        """
        Detect Sign of Weakness (SOW)

        Criteria:
        1. Strong decline
        2. High volume (expanding)
        3. Breaks below support or approaches it
        4. Wide spread with close near low
        """
        lookback = 10
        avg_volume = sum(volume_data[-30:-lookback]) / 20
        avg_spread = sum(c.high - c.low for c in candles[-30:-lookback]) / 20

        for i in range(-lookback, 0):
            candle = candles[i]
            volume = volume_data[i]
            spread = candle.high - candle.low

            if candle.low <= support_level * 1.02:  # At or below support
                volume_ratio = volume / avg_volume if avg_volume > 0 else 0
                spread_ratio = spread / avg_spread if avg_spread > 0 else 0
                close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5

                if (volume_ratio >= self.config['sow_volume_multiplier'] and
                    spread_ratio >= 1.2 and
                    close_position < 0.4 and  # Close in lower 40%
                    candle.close < candle.open):  # Red candle

                    return {
                        'event': 'SIGN_OF_WEAKNESS',
                        'candle_index': i,
                        'low': candle.low,
                        'support_level': support_level,
                        'volume_ratio': volume_ratio,
                        'confidence': min(volume_ratio / 2 * spread_ratio, 1.0)
                    }

        return None
```

---

## Section 5: Volume Analysis Techniques

### 5.1 Relative Volume Calculation

```python
def calculate_relative_volume(volume_data, period=20):
    """
    Calculate relative volume (RVOL)
    Compares current volume to historical average
    """
    if len(volume_data) < period + 1:
        return 1.0

    current_volume = volume_data[-1]
    avg_volume = sum(volume_data[-period-1:-1]) / period

    return current_volume / avg_volume if avg_volume > 0 else 1.0

def calculate_volume_moving_average(volume_data, period=20):
    """
    Simple moving average of volume
    """
    if len(volume_data) < period:
        return sum(volume_data) / len(volume_data)

    return sum(volume_data[-period:]) / period
```

### 5.2 Volume-Weighted Spread Analysis

```python
def analyze_volume_spread(candle, volume, avg_volume, avg_spread):
    """
    Tom Williams VSA bar-by-bar analysis

    Returns classification of the bar based on volume and spread
    """
    spread = candle.high - candle.low
    close_position = (candle.close - candle.low) / spread if spread > 0 else 0.5
    volume_ratio = volume / avg_volume if avg_volume > 0 else 1
    spread_ratio = spread / avg_spread if avg_spread > 0 else 1
    is_up_bar = candle.close > candle.open

    # VSA Classifications
    if volume_ratio < 0.5:  # Low volume
        if is_up_bar:
            return {'signal': 'NO_DEMAND', 'strength': 'WEAK', 'bias': 'BEARISH'}
        else:
            return {'signal': 'NO_SUPPLY', 'strength': 'WEAK', 'bias': 'BULLISH'}

    elif volume_ratio > 1.5:  # High volume
        if spread_ratio < 0.7:  # Narrow spread
            if is_up_bar:
                return {'signal': 'STOPPING_VOLUME', 'strength': 'STRONG', 'bias': 'BEARISH'}
            else:
                return {'signal': 'ABSORPTION', 'strength': 'STRONG', 'bias': 'BULLISH'}

        elif spread_ratio > 1.3:  # Wide spread
            if is_up_bar and close_position > 0.6:
                return {'signal': 'STRENGTH', 'strength': 'STRONG', 'bias': 'BULLISH'}
            elif not is_up_bar and close_position < 0.4:
                return {'signal': 'WEAKNESS', 'strength': 'STRONG', 'bias': 'BEARISH'}

    return {'signal': 'NEUTRAL', 'strength': 'NORMAL', 'bias': 'NEUTRAL'}
```

### 5.3 Climactic Volume Detection

```python
def detect_climactic_volume(volume_data, threshold_multiplier=2.5):
    """
    Detect climactic volume spikes

    Climactic volume often marks turning points (SC or BC)
    """
    if len(volume_data) < 21:
        return []

    avg_volume = sum(volume_data[-21:-1]) / 20
    threshold = avg_volume * threshold_multiplier

    climax_bars = []
    for i in range(-10, 0):
        if volume_data[i] >= threshold:
            # Check if it's a local maximum in volume
            is_local_max = True
            for j in range(-2, 3):
                if j != 0 and i + j >= -len(volume_data) and i + j < 0:
                    if volume_data[i + j] > volume_data[i]:
                        is_local_max = False
                        break

            if is_local_max:
                climax_bars.append({
                    'index': i,
                    'volume': volume_data[i],
                    'ratio': volume_data[i] / avg_volume
                })

    return climax_bars
```

### 5.4 Cumulative Volume Delta

```python
def calculate_volume_delta(candles, volume_data):
    """
    Calculate volume delta (buying vs selling pressure)
    Uses close position within bar to estimate
    """
    deltas = []
    cumulative_delta = 0

    for i, candle in enumerate(candles):
        spread = candle.high - candle.low
        if spread > 0:
            # Close position determines buy/sell ratio
            close_position = (candle.close - candle.low) / spread
            buy_volume = volume_data[i] * close_position
            sell_volume = volume_data[i] * (1 - close_position)
            delta = buy_volume - sell_volume
        else:
            delta = 0

        cumulative_delta += delta
        deltas.append({
            'bar_delta': delta,
            'cumulative_delta': cumulative_delta,
            'buy_volume': buy_volume if spread > 0 else 0,
            'sell_volume': sell_volume if spread > 0 else 0
        })

    return deltas
```

---

## Section 6: Complete Phase Detection Algorithm

### 6.1 Trading Range Detection

```python
class TradingRangeDetector:
    def __init__(self, min_bars=20, max_bars=200):
        self.min_bars = min_bars
        self.max_bars = max_bars

    def detect_trading_range(self, candles):
        """
        Detect if price is in a trading range (accumulation or distribution)

        Returns: dict with range boundaries and characteristics
        """
        if len(candles) < self.min_bars:
            return None

        # Look for consolidation pattern
        for lookback in range(self.min_bars, min(len(candles), self.max_bars)):
            recent = candles[-lookback:]

            highs = [c.high for c in recent]
            lows = [c.low for c in recent]
            closes = [c.close for c in recent]

            range_high = max(highs)
            range_low = min(lows)
            range_size = range_high - range_low
            avg_price = sum(closes) / len(closes)

            # Check if price stayed within bounds
            range_ratio = range_size / avg_price

            # Count touches of support/resistance
            resistance_touches = sum(1 for h in highs if h >= range_high * 0.98)
            support_touches = sum(1 for l in lows if l <= range_low * 1.02)

            # Validate trading range
            if (range_ratio < 0.20 and  # Range is less than 20% of price
                resistance_touches >= 2 and
                support_touches >= 2):

                return {
                    'is_trading_range': True,
                    'range_high': range_high,
                    'range_low': range_low,
                    'range_size': range_size,
                    'range_duration': lookback,
                    'resistance_touches': resistance_touches,
                    'support_touches': support_touches,
                    'midpoint': (range_high + range_low) / 2
                }

        return {'is_trading_range': False}
```

### 6.2 Integrated Wyckoff Analyzer

```python
class WyckoffAnalyzer:
    """
    Complete Wyckoff analysis system
    """

    def __init__(self):
        self.accumulation_detector = AccumulationDetector()
        self.distribution_detector = DistributionDetector()
        self.range_detector = TradingRangeDetector()
        self.phase_detector = WyckoffPhaseDetector()

    def analyze(self, candles, volume_data):
        """
        Perform complete Wyckoff analysis

        Returns comprehensive analysis with:
        - Current phase
        - Detected events
        - Trading signals
        - Confidence scores
        """
        analysis = {
            'timestamp': candles[-1].timestamp if hasattr(candles[-1], 'timestamp') else None,
            'phase': None,
            'events': [],
            'trading_range': None,
            'signals': [],
            'confidence': 0
        }

        # 1. Detect trading range
        trading_range = self.range_detector.detect_trading_range(candles)
        analysis['trading_range'] = trading_range

        if not trading_range or not trading_range.get('is_trading_range'):
            # Not in trading range - check for trend
            analysis['phase'] = self.phase_detector.detect_phase(candles, volume_data)
            return analysis

        # 2. Determine if accumulation or distribution
        prior_trend = self._determine_prior_trend(candles, trading_range['range_duration'])

        support = trading_range['range_low']
        resistance = trading_range['range_high']

        # 3. Detect phase-specific events
        if prior_trend == 'DOWN':
            # Likely accumulation
            analysis['phase'] = 'ACCUMULATION'

            # Check for accumulation events
            sc = self.accumulation_detector.detect_selling_climax(candles, volume_data)
            if sc:
                analysis['events'].append(sc)

            spring = self.accumulation_detector.detect_spring(candles, volume_data, support)
            if spring:
                analysis['events'].append(spring)
                # Spring is a buy signal
                analysis['signals'].append({
                    'type': 'BUY',
                    'event': 'SPRING',
                    'entry': spring['spring_low'] * 1.02,
                    'stop_loss': spring['spring_low'] * 0.98,
                    'target': resistance,
                    'confidence': spring['confidence']
                })

            sos = self.accumulation_detector.detect_sign_of_strength(candles, volume_data, resistance)
            if sos:
                analysis['events'].append(sos)

                lps = self.accumulation_detector.detect_last_point_of_support(candles, volume_data, sos)
                if lps:
                    analysis['events'].append(lps)
                    # LPS is a buy signal
                    analysis['signals'].append({
                        'type': 'BUY',
                        'event': 'LPS',
                        'entry': lps['lps_low'] * 1.01,
                        'stop_loss': spring['spring_low'] if spring else support * 0.98,
                        'confidence': lps['confidence']
                    })

        elif prior_trend == 'UP':
            # Likely distribution
            analysis['phase'] = 'DISTRIBUTION'

            bc = self.distribution_detector.detect_buying_climax(candles, volume_data)
            if bc:
                analysis['events'].append(bc)

            utad = self.distribution_detector.detect_utad(candles, volume_data, resistance)
            if utad:
                analysis['events'].append(utad)
                # UTAD is a sell signal
                analysis['signals'].append({
                    'type': 'SELL',
                    'event': 'UTAD',
                    'entry': utad['resistance_level'] * 0.99,
                    'stop_loss': utad['high'] * 1.02,
                    'target': support,
                    'confidence': utad['confidence']
                })

            sow = self.distribution_detector.detect_sign_of_weakness(candles, volume_data, support)
            if sow:
                analysis['events'].append(sow)
                # SOW confirms distribution
                analysis['signals'].append({
                    'type': 'SELL',
                    'event': 'SOW',
                    'entry': support,
                    'stop_loss': resistance,
                    'confidence': sow['confidence']
                })

        # 4. Calculate overall confidence
        if analysis['events']:
            analysis['confidence'] = sum(e.get('confidence', 0) for e in analysis['events']) / len(analysis['events'])

        return analysis

    def _determine_prior_trend(self, candles, range_start):
        """Determine the trend before the trading range"""
        if range_start >= len(candles):
            return 'UNKNOWN'

        prior_candles = candles[:-range_start]
        if len(prior_candles) < 20:
            return 'UNKNOWN'

        first_price = prior_candles[-20].close
        last_price = prior_candles[-1].close

        change_pct = (last_price - first_price) / first_price

        if change_pct < -0.10:
            return 'DOWN'
        elif change_pct > 0.10:
            return 'UP'
        else:
            return 'SIDEWAYS'
```

---

## Section 7: GitHub Implementations Catalogue

### 7.1 Wyckoff-Specific Repositories

| Repository | Stars | Language | Description | URL |
|------------|-------|----------|-------------|-----|
| **srl-python-indicators** | 20 | Python | Weis & Wyckoff System, Order Flow, Volume Profile | https://github.com/srlcarlg/srl-python-indicators |
| **Wyckoff-AI-Assistant** | - | Python | Transformer-based AI for Wyckoff analysis, Q-learning | https://github.com/Eesita/Wyckoff-AI-Assistant |
| **wyckoff** (abdstg) | - | Python | Multi-AI agents for Wyckoff trading signals | https://github.com/abdstg/wyckoff |
| **Wyckoff-Trader** | - | - | Forex charting with Wyckoff principles | https://github.com/MurrayBakerWebDeveloper/Wyckoff-Trader |

### 7.2 Volume Spread Analysis (VSA) Repositories

| Repository | Stars | Language | Description | URL |
|------------|-------|----------|-------------|-----|
| **Volume_Spread_Analysis** | 6 | Python | VSA implementation | https://github.com/Onuragdaci/Volume_Spread_Analysis |
| **VSA-indicator-MT5** | 4 | MQL5 | VSA for MetaTrader 5 | https://github.com/Andre-Luis-Lopes-da-Silva/Volume-Spread-Analysis-VSA-indicator-for-Metatrader-5 |
| **VSA-Advanced** | 1 | Pine Script | VSA with Wyckoff logic | https://github.com/Mihir-Cap/VSA-Advanced |
| **Trading-Bot-2** | 1 | Python | Day trading bot using VSA | https://github.com/TylerSafe/Trading-Bot-2 |

### 7.3 Smart Money Concepts (Related)

| Repository | Stars | Language | Description | URL |
|------------|-------|----------|-------------|-----|
| **smart-money-concepts** | 1089 | Python | ICT SMC indicators for algo trading | https://github.com/joshyattridge/smart-money-concepts |
| **MT5-SMC-trading-bot** | 26 | MQL5 | Order Blocks, FVGs, BOS detection | https://github.com/KVignesh122/MT5-SMC-trading-bot |
| **SMC-Algo-Trading** | 21 | Python | Library for SMC trading bots | https://github.com/vlex05/SMC-Algo-Trading |
| **smart-money-concept** | 20 | Python | Market structure, order blocks, FVG | https://github.com/Prasad1612/smart-money-concept |

### 7.4 General Trading/Volume Analysis

| Repository | Stars | Language | Description | URL |
|------------|-------|----------|-------------|-----|
| **tradecat** | 732 | Python | Full market quantitative trading platform | https://github.com/tukuaiai/tradecat |

---

## Section 8: Machine Learning Approaches

### 8.1 Deep Learning for Wyckoff Pattern Recognition

Based on academic research (arXiv:2403.18839), deep learning models achieve exceptional accuracy:

| Model | Test Accuracy | Test Loss | Best For |
|-------|--------------|-----------|----------|
| CNN | 98.2% | 0.0312 | Spatial pattern recognition |
| LSTM | 99.34% | 0.0207 | Temporal sequence analysis |
| Hybrid CNN-LSTM | 99.1% | 0.0245 | Combined approach |

**Implementation Approach**:
```python
# Simplified LSTM for Wyckoff phase detection
import tensorflow as tf

def create_wyckoff_lstm_model(sequence_length, n_features):
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(128, return_sequences=True,
                            input_shape=(sequence_length, n_features)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.LSTM(64, return_sequences=False),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dense(5, activation='softmax')  # 5 phases
    ])

    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    return model

# Features to use:
# - Price (OHLC normalized)
# - Volume (relative volume)
# - Spread (normalized)
# - Close position within bar
# - Price change %
# - Volume change %
```

### 8.2 Feature Engineering for ML Models

```python
def create_wyckoff_features(candles, volume_data, lookback=50):
    """
    Create feature vectors for ML-based Wyckoff detection
    """
    features = []

    for i in range(lookback, len(candles)):
        window = candles[i-lookback:i]
        vol_window = volume_data[i-lookback:i]

        # Price features
        prices = [c.close for c in window]
        price_mean = sum(prices) / len(prices)
        price_std = (sum((p - price_mean)**2 for p in prices) / len(prices))**0.5

        # Normalize current candle
        current = candles[i]
        spread = current.high - current.low

        feature_vector = {
            # Normalized price
            'price_norm': (current.close - price_mean) / price_std if price_std > 0 else 0,
            'high_norm': (current.high - price_mean) / price_std if price_std > 0 else 0,
            'low_norm': (current.low - price_mean) / price_std if price_std > 0 else 0,

            # Volume features
            'volume_ratio': volume_data[i] / (sum(vol_window) / len(vol_window)),
            'volume_trend': self._volume_trend_score(vol_window),

            # Spread analysis
            'spread_ratio': spread / (sum(c.high - c.low for c in window) / len(window)),
            'close_position': (current.close - current.low) / spread if spread > 0 else 0.5,

            # Range position
            'range_position': (current.close - min(c.low for c in window)) /
                            (max(c.high for c in window) - min(c.low for c in window)),

            # Momentum
            'price_change_5': (current.close - candles[i-5].close) / candles[i-5].close,
            'price_change_20': (current.close - candles[i-20].close) / candles[i-20].close,

            # Volatility
            'volatility': price_std / price_mean if price_mean > 0 else 0,
        }

        features.append(feature_vector)

    return features
```

---

## Section 9: Integration with Elliott Wave

### 9.1 Complementary Analysis

Wyckoff Method complements Elliott Wave Theory in key ways:

| Aspect | Elliott Wave | Wyckoff | Combined Value |
|--------|-------------|---------|----------------|
| **Basis** | Price patterns | Volume-price relationship | Multi-dimensional confirmation |
| **Timing** | Wave counts | Phase identification | Better entry precision |
| **Confirmation** | Wave structure | Volume validation | Higher confidence signals |
| **Weakness** | ~50% standalone accuracy | Requires volume data | Cross-validation |

### 9.2 Integration Points

```python
class ElliottWyckoffIntegration:
    """
    Combine Elliott Wave and Wyckoff analysis for higher accuracy
    """

    def analyze_combined(self, candles, volume_data, elliott_analysis, wyckoff_analysis):
        """
        Cross-reference Elliott and Wyckoff for confirmation
        """
        combined = {
            'elliott_phase': elliott_analysis.get('current_wave'),
            'wyckoff_phase': wyckoff_analysis.get('phase'),
            'alignment': False,
            'signal': None,
            'confidence': 0
        }

        # Check for alignment
        elliott_wave = elliott_analysis.get('current_wave')
        wyckoff_phase = wyckoff_analysis.get('phase')

        # Bullish alignment
        if elliott_wave in ['Wave 1', 'Wave 3', 'Wave 5'] and wyckoff_phase == 'MARKUP':
            combined['alignment'] = True
            combined['signal'] = 'BULLISH'
            combined['confidence'] = 0.8

        # Accumulation alignment (Wave 2 or A often coincides with accumulation)
        elif elliott_wave in ['Wave 2', 'Wave A'] and wyckoff_phase == 'ACCUMULATION':
            combined['alignment'] = True
            combined['signal'] = 'BULLISH_SETUP'
            combined['confidence'] = 0.75

        # Bearish alignment
        elif elliott_wave in ['Wave A', 'Wave C'] and wyckoff_phase == 'MARKDOWN':
            combined['alignment'] = True
            combined['signal'] = 'BEARISH'
            combined['confidence'] = 0.8

        # Distribution alignment (Wave 5 or B often coincides with distribution)
        elif elliott_wave in ['Wave 5', 'Wave B'] and wyckoff_phase == 'DISTRIBUTION':
            combined['alignment'] = True
            combined['signal'] = 'BEARISH_SETUP'
            combined['confidence'] = 0.75

        # Wyckoff events add to confidence
        wyckoff_events = wyckoff_analysis.get('events', [])
        if wyckoff_events:
            event_confidence = sum(e.get('confidence', 0) for e in wyckoff_events) / len(wyckoff_events)
            combined['confidence'] = (combined['confidence'] + event_confidence) / 2

        return combined
```

---

## Section 10: Summary and Next Agent Guidance

### 10.1 Key Findings

1. **Pattern Success Rate**: Wyckoff Distribution resolves downward 65-70% of the time
2. **ML Accuracy**: LSTM models achieve 99.34% accuracy on pattern recognition
3. **Volume Importance**: Low-volume springs and high-volume climaxes are most reliable signals
4. **Complementary Value**: Wyckoff's volume analysis addresses Elliott Wave's main weakness

### 10.2 Critical Implementation Notes

1. **Data Requirements**:
   - Accurate volume data essential
   - Minimum 50-200 bars for trading range detection
   - Historical data for climax volume thresholds

2. **Most Reliable Signals**:
   - Spring (low volume) followed by Test
   - UTAD (high volume) with reversal
   - SOS breaking resistance on high volume
   - SOW breaking support on high volume

3. **Avoid**:
   - Trading based on single events
   - Ignoring volume on key events
   - Assuming perfect schematic adherence

### 10.3 For Next Agents

**Famous Traders Agent (#5)**:
- Richard Wyckoff's principles documented here
- Tom Williams' VSA expansion covered
- David Weis' modern adaptations included

**NLP/Sentiment Agent (#7)**:
- Wyckoff BC often coincides with bullish news/sentiment
- SC often coincides with extreme fear
- Sentiment can help identify climactic events

**Backtesting Agent (#3)**:
- Use the AccumulationDetector and DistributionDetector classes
- Test on multiple timeframes (12H+ recommended)
- Validate with volume data quality checks

---

## References and Sources

### Primary Sources
- [StockCharts Wyckoff Tutorial](https://chartschool.stockcharts.com/table-of-contents/market-analysis/wyckoff-analysis-articles/the-wyckoff-method-a-tutorial)
- [Wyckoff Analytics Official](https://www.wyckoffanalytics.com/wyckoff-method/)
- [Binance Academy Wyckoff Explained](https://academy.binance.com/en/articles/the-wyckoff-method-explained)

### Modern Adaptations
- [David Weis - Trades About to Happen](https://weisonwyckoff.com/)
- [Weis Wave Plugin](https://weisonwyckoff.com/weis-wave/)
- [Tom Williams VSA - Tradeguider](https://www.tradeguider.com/)

### Academic Research
- [LSTM Pattern Recognition (arXiv:2403.18839)](https://arxiv.org/html/2403.18839v1)

### Educational Resources
- [TrendSpider Wyckoff Guide](https://trendspider.com/learning-center/chart-patterns-wyckoff-accumulation/)
- [LiteFinance Wyckoff Theory](https://www.litefinance.org/blog/for-professionals/wyckoff-method/)
- [FTMO Wyckoff Application](https://ftmo.com/en/the-wyckoff-theory-and-its-application-in-trading/)

### GitHub Repositories
- [smart-money-concepts (1089 stars)](https://github.com/joshyattridge/smart-money-concepts)
- [srl-python-indicators (20 stars)](https://github.com/srlcarlg/srl-python-indicators)
- [Wyckoff-AI-Assistant](https://github.com/Eesita/Wyckoff-AI-Assistant)
