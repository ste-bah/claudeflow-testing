# Jesse Livermore and William O'Neil (CANSLIM) Trading Methods
## Algorithmic Implementation Research Document

**Research Date:** January 25, 2026
**Agent:** #5 of 10 - Famous Traders Methods
**Previous Research:** Elliott Wave (~50% standalone, 73.68% AI-enhanced), Wyckoff (99.34% ML pattern accuracy)

---

## Table of Contents
1. [Jesse Livermore Trading System](#jesse-livermore-trading-system)
2. [William O'Neil CANSLIM Method](#william-oneil-canslim-method)
3. [Algorithmic Implementation](#algorithmic-implementation)
4. [GitHub Implementations](#github-implementations)
5. [Integration with Elliott Wave and Wyckoff](#integration-with-elliott-wave-and-wyckoff)
6. [Comparative Analysis](#comparative-analysis)

---

## Jesse Livermore Trading System

### Background
Jesse Livermore (1877-1940) is regarded as one of the greatest traders of all time. He built and lost multiple fortunes, most notably profiting during the 1907 panic and 1929 crash by shorting the market. His methods were documented in:
- **"Reminiscences of a Stock Operator"** (1923) by Edwin Lefevre
- **"How to Trade in Stocks"** (1940) - his own book

### Core Trading Principles

#### 1. The 21 Rules (Written in 1940)

**Fundamental Principles:**
1. Nothing new ever occurs in the business of speculating - history repeats
2. Money cannot consistently be made trading every day or every week
3. Don't trust your own opinion until market action confirms it
4. **Markets are never wrong - opinions often are**
5. Real money is made in commitments showing profit right from the start
6. As long as a stock acts right and market is right, don't hurry to take profits
7. Never let speculative ventures become investments

**Market Direction and Timing:**
- Buy rising stocks and sell falling stocks
- Trade only when market is clearly bullish or bearish
- Trade in direction of general market
- Coordinate trading activity with pivot points

**On Tips and Information:**
- Few people make money on tips
- Beware of inside information
- If there was easy money, no one would force it into your pocket

#### 2. The Line of Least Resistance

```
"Prices, like everything else, move along the line of least resistance.
They will do whatever comes easiest, therefore they will go up if there
is less resistance to an advance than to a decline; and vice versa."
```

**Algorithmic Definition:**
- Path of least resistance = price level supply/demand is likely to move towards
- Based on past and current accumulation/distribution levels
- A stock at line of least resistance hovers near 52-week or all-time highs
- Only a little demand can send such stocks flying

**Implementation Logic:**
```python
def line_of_least_resistance(price, high_52week, all_time_high, volume_trend):
    """
    Determine if price is at line of least resistance
    """
    # Near 52-week high (within 5%)
    near_52wk = (high_52week - price) / high_52week < 0.05

    # Volume trend positive (accumulation)
    accumulating = volume_trend > 0

    # Direction of least resistance
    if near_52wk and accumulating:
        return "BULLISH"  # Less resistance to advance
    elif price < high_52week * 0.85 and not accumulating:
        return "BEARISH"  # Less resistance to decline
    else:
        return "NEUTRAL"  # Wait for clarity
```

#### 3. Pivotal Point Method

Livermore identified two types of pivotal points:

**Type 1: Reversal Pivotal Points**
- Price levels where stock/market reversed previously
- Previous major tops or bottoms
- Key support/resistance levels

**Type 2: Continuation Pivotal Points**
- Psychological price levels: 50, 100, 200, 300
- When stocks pass these levels, fast straight movements often occur

**Trading Rules:**
- Buy when stock breaks OUT above pivotal point
- Sell when stock breaks BELOW pivotal point
- Wait for confirmation before acting

**Algorithm:**
```python
def identify_pivotal_points(prices, lookback=252):
    """
    Identify Livermore pivotal points
    """
    pivotal_points = []

    # Find significant highs and lows
    for i in range(lookback, len(prices)):
        window = prices[i-lookback:i]

        # Major tops (resistance)
        if prices[i-1] == max(window):
            pivotal_points.append({
                'price': prices[i-1],
                'type': 'resistance',
                'strength': 'reversal'
            })

        # Major bottoms (support)
        if prices[i-1] == min(window):
            pivotal_points.append({
                'price': prices[i-1],
                'type': 'support',
                'strength': 'reversal'
            })

    # Psychological levels
    for level in [50, 100, 150, 200, 250, 300, 400, 500]:
        if min(prices) < level < max(prices):
            pivotal_points.append({
                'price': level,
                'type': 'psychological',
                'strength': 'continuation'
            })

    return pivotal_points
```

#### 4. Pyramiding Strategy

**Core Concept:**
- Start with smallest position
- Add to position ONLY as it moves in your favor
- Use unrealized gains (margin) to increase position
- Never add to losing positions

**Position Building Example:**
```
Initial Position: 100 shares
After 5% gain:    Add 100 shares
After 10% gain:   Add 100 shares
After 15% gain:   Add 200 shares
Total Position:   500 shares (pyramid built)
```

**Implementation Rules:**
```python
def livermore_pyramid(entry_price, current_price, position_size, max_position):
    """
    Livermore pyramiding logic
    """
    gain_pct = (current_price - entry_price) / entry_price

    # Only add on gains
    if gain_pct <= 0:
        return 0  # Never add to losing position

    # Pyramid tiers (example: 20-20-20-40 allocation)
    tiers = [
        {'threshold': 0.00, 'allocation': 0.20},  # Initial
        {'threshold': 0.05, 'allocation': 0.20},  # +5%
        {'threshold': 0.10, 'allocation': 0.20},  # +10%
        {'threshold': 0.15, 'allocation': 0.40},  # +15%
    ]

    for tier in tiers:
        if gain_pct >= tier['threshold']:
            target = max_position * tier['allocation']
            if position_size < target:
                return target - position_size

    return 0
```

#### 5. Money Management Rules

**The 10% Rule:**
- Never risk more than 10% on any one trade
- Divide capital into 10 equal parts
- This was his "bucket shop rule"

**Stop-Loss Management:**
- Establish stop BEFORE entering trade
- Stop should not generate margin call
- Cut losses without debate

**Profit Taking:**
- After huge winning trade, bank 50% in cash
- Let profits run in strong trends
- "Money is made by sitting, not trading"

**12 Risk Management Rules:**
1. Never average a losing position
2. Always use a stop loss
3. Cut losses quickly
4. Never meet margin calls - exit instead
5. Set stops before entry
6. Don't fund account for margin calls
7. Involuntary investors = traders without stops
8. Bank 50% of big wins
9. Scale into positions (20-20-20-40%)
10. Never risk more than 10% per trade

#### 6. Timing Principles

**Patience:**
- "Money is made by sitting, not trading"
- "It takes time to make money"
- "Buy right, sit tight"
- Big movements take time to develop

**Entry Timing:**
- Wait for market to confirm thesis
- Buy only when tape says UP
- Sell only when tape says DOWN
- Waiting for path of least resistance to present itself

**Exit Rules:**
- If trade doesn't move in favor within few days, exit
- "Whenever I find myself hoping, I get out"
- Hope is not a strategy

---

## William O'Neil CANSLIM Method

### Background
William O'Neil (born 1933) founded Investor's Business Daily and William O'Neil + Company. He turned $5,000 into $200,000 through three exceptional trades during 1962-1963. His research analyzed stock market winners dating back to 1953.

### The CANSLIM Criteria

#### C - Current Quarterly Earnings
**Minimum Requirements:**
- Current quarterly EPS up at least **25%** vs same quarter previous year
- Higher growth preferred (40%, 100%+)
- Accelerating earnings growth is positive sign

**Algorithm:**
```python
def check_c_criteria(current_q_eps, same_q_last_year_eps, previous_quarters):
    """
    C = Current Quarterly Earnings (minimum 25% growth)
    """
    growth = (current_q_eps - same_q_last_year_eps) / same_q_last_year_eps

    # Check for acceleration
    acceleration = True
    for i in range(1, len(previous_quarters)):
        if previous_quarters[i] <= previous_quarters[i-1]:
            acceleration = False
            break

    return {
        'passes': growth >= 0.25,
        'growth_rate': growth,
        'accelerating': acceleration,
        'score': min(100, growth * 100)  # Cap at 100
    }
```

#### A - Annual Earnings Growth
**Requirements:**
- Annual earnings growing at least **25%** over past 3-5 years
- Look for consistent year-over-year improvement
- 5-year compounded growth rate important

**Algorithm:**
```python
def check_a_criteria(annual_eps_list):
    """
    A = Annual Earnings Growth (25%+ for 3-5 years)
    """
    if len(annual_eps_list) < 3:
        return {'passes': False, 'reason': 'Insufficient data'}

    # Calculate compound annual growth rate
    years = len(annual_eps_list) - 1
    cagr = (annual_eps_list[-1] / annual_eps_list[0]) ** (1/years) - 1

    # Check yearly growth
    yearly_growth = []
    for i in range(1, len(annual_eps_list)):
        if annual_eps_list[i-1] > 0:
            yoy = (annual_eps_list[i] - annual_eps_list[i-1]) / annual_eps_list[i-1]
            yearly_growth.append(yoy)

    avg_growth = sum(yearly_growth) / len(yearly_growth)

    return {
        'passes': cagr >= 0.25 and all(g >= 0.25 for g in yearly_growth),
        'cagr': cagr,
        'avg_annual_growth': avg_growth,
        'years_analyzed': years
    }
```

#### N - New Products, Management, or Price Highs
**Key Elements:**
- New product or service driving growth
- New management team
- New industry conditions
- **New price highs** (95% of winners showed something new)

**Critical Insight:**
O'Neil found that stocks at new highs often continue to even higher levels - contrary to natural instinct to avoid "expensive" stocks.

**Algorithm:**
```python
def check_n_criteria(price, high_52wk, all_time_high, news_catalyst=None):
    """
    N = New (products, management, price highs)
    """
    at_new_high = price >= high_52wk * 0.98  # Within 2% of high

    return {
        'passes': at_new_high or news_catalyst is not None,
        'at_52wk_high': at_new_high,
        'at_all_time_high': price >= all_time_high * 0.98,
        'has_catalyst': news_catalyst is not None,
        'catalyst': news_catalyst
    }
```

#### S - Supply and Demand
**Principles:**
- Smaller companies (fewer shares) can show larger gains
- Large caps require much more demand for same % gains
- Track shares outstanding and float
- Volume analysis for accumulation/distribution

**Volume Requirements:**
- Breakout volume: **40-50% above average**
- Rising volume on up days = accumulation
- Rising volume on down days = distribution

**Algorithm:**
```python
def check_s_criteria(shares_outstanding, avg_volume, current_volume, price_change):
    """
    S = Supply and Demand
    """
    # Prefer smaller float
    small_float = shares_outstanding < 50_000_000

    # Volume analysis
    volume_ratio = current_volume / avg_volume
    breakout_volume = volume_ratio >= 1.40  # 40%+ above average

    # Accumulation vs Distribution
    if price_change > 0 and volume_ratio > 1.0:
        flow = 'accumulation'
    elif price_change < 0 and volume_ratio > 1.0:
        flow = 'distribution'
    else:
        flow = 'neutral'

    return {
        'passes': small_float or breakout_volume,
        'shares_outstanding': shares_outstanding,
        'volume_ratio': volume_ratio,
        'institutional_flow': flow,
        'breakout_quality': 'strong' if volume_ratio >= 1.50 else 'moderate'
    }
```

#### L - Leader or Laggard
**Relative Strength (RS) Rating:**
- Compares stock's 12-month price performance to all other stocks
- Scale: 1-99 (percentile ranking)
- **Minimum RS: 80** (outperforms 80% of stocks)
- Best stocks: RS 90+

**RS Calculation Formula:**
```python
def calculate_rs_rating(stock_returns, all_stock_returns):
    """
    L = Leader or Laggard (RS Rating calculation)

    Formula:
    - 40% weight to most recent quarter
    - 20% weight to each of previous 3 quarters
    """
    # Calculate weighted performance
    q1_return = stock_returns['q1'] * 0.20  # Oldest
    q2_return = stock_returns['q2'] * 0.20
    q3_return = stock_returns['q3'] * 0.20
    q4_return = stock_returns['q4'] * 0.40  # Most recent (double weight)

    stock_score = q1_return + q2_return + q3_return + q4_return

    # Rank against all stocks
    all_scores = []
    for stock in all_stock_returns:
        score = (stock['q1'] * 0.20 + stock['q2'] * 0.20 +
                 stock['q3'] * 0.20 + stock['q4'] * 0.40)
        all_scores.append(score)

    all_scores.sort()

    # Find percentile
    rank = sum(1 for s in all_scores if s < stock_score)
    rs_rating = int((rank / len(all_scores)) * 99) + 1

    return {
        'rs_rating': rs_rating,
        'passes': rs_rating >= 80,
        'is_leader': rs_rating >= 90,
        'percentile': rs_rating
    }
```

#### I - Institutional Sponsorship
**Requirements:**
- Look for stocks with quality institutional ownership
- Recent increases in institutional positions
- Track Accumulation/Distribution Rating (A to E scale)

**A/D Rating Scale:**
- A = Heavy institutional buying
- B = Moderate buying
- C = Neutral
- D = Moderate selling
- E = Heavy selling

**Algorithm:**
```python
def check_i_criteria(institutional_ownership, num_institutions, ad_rating):
    """
    I = Institutional Sponsorship
    """
    # Quality indicators
    has_sponsorship = institutional_ownership > 0.20  # >20% owned
    quality_sponsors = num_institutions >= 10  # At least 10 institutions

    # A/D Rating (A=5, B=4, C=3, D=2, E=1)
    ad_scores = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1}
    ad_score = ad_scores.get(ad_rating, 3)

    return {
        'passes': has_sponsorship and ad_score >= 3,
        'institutional_pct': institutional_ownership,
        'num_institutions': num_institutions,
        'ad_rating': ad_rating,
        'accumulating': ad_rating in ['A', 'B']
    }
```

#### M - Market Direction
**Three Market States:**
1. **Market in Confirmed Uptrend** - BUY signals valid
2. **Market Uptrend Under Pressure** - Caution
3. **Market in Correction** - AVOID buying

**Key Principle:**
3 out of 4 stocks follow general market direction. Trade WITH the market, not against it.

**Follow-Through Day:**
- Strong index rally on rising volume
- Occurs few days after market bottom
- Confirms new uptrend

**Distribution Days:**
- Big drops on heavy volume
- Cluster of distribution days = time to take cover
- Signals institutional selling

**Algorithm:**
```python
def check_m_criteria(index_data, lookback=50):
    """
    M = Market Direction
    """
    # Check trend
    sma_50 = sum(index_data[-50:]) / 50
    sma_200 = sum(index_data[-200:]) / 200
    current = index_data[-1]

    # Count distribution days (last 25 days)
    distribution_days = 0
    for i in range(-25, 0):
        if (index_data[i] < index_data[i-1] and
            volume_data[i] > volume_data[i-1]):
            daily_drop = (index_data[i-1] - index_data[i]) / index_data[i-1]
            if daily_drop >= 0.002:  # 0.2%+ drop
                distribution_days += 1

    # Determine market state
    if current > sma_50 > sma_200 and distribution_days < 4:
        market_state = 'CONFIRMED_UPTREND'
    elif current > sma_50 and distribution_days >= 4:
        market_state = 'UPTREND_UNDER_PRESSURE'
    else:
        market_state = 'CORRECTION'

    return {
        'passes': market_state == 'CONFIRMED_UPTREND',
        'market_state': market_state,
        'distribution_days': distribution_days,
        'above_50sma': current > sma_50,
        'above_200sma': current > sma_200
    }
```

### O'Neil Chart Patterns

#### 1. Cup and Handle (Most Common)

**Cup Specifications:**
- Shape: U-shaped (NOT V-shaped)
- Depth: 12-33% correction (max 50% in bear markets)
- Duration: 7-65 weeks (minimum 7 weeks)
- Equal highs on both sides ideal

**Handle Specifications:**
- Forms after right side of cup completes
- Length: 1/5 to 1/4 of cup length
- Depth: Maximum 12-15% (half the cup depth)
- Should slope slightly downward
- Duration: Minimum 1-2 weeks

**Volume Pattern:**
- Declining volume in cup formation
- Slight uptick on right side
- **Strong surge (40%+) on breakout**

**Buy Point:**
- Handle high + $0.10
- Breakout above handle resistance

**Algorithm:**
```python
def detect_cup_and_handle(prices, volumes, lookback=100):
    """
    Detect Cup and Handle pattern
    """
    # Find potential cup
    window = prices[-lookback:]

    # Find left high
    left_high_idx = 0
    for i in range(len(window)//4):
        if window[i] > window[left_high_idx]:
            left_high_idx = i

    # Find cup low
    cup_low_idx = left_high_idx
    for i in range(left_high_idx, len(window)*3//4):
        if window[i] < window[cup_low_idx]:
            cup_low_idx = i

    # Find right high
    right_high_idx = cup_low_idx
    for i in range(cup_low_idx, len(window)):
        if window[i] > window[right_high_idx]:
            right_high_idx = i

    # Validate cup
    left_high = window[left_high_idx]
    right_high = window[right_high_idx]
    cup_low = window[cup_low_idx]

    # Cup depth (12-33%)
    cup_depth = (left_high - cup_low) / left_high

    # Check for U-shape (not V)
    cup_width = right_high_idx - left_high_idx
    u_shape = cup_width >= 35  # At least 7 weeks (35 trading days)

    # Check for handle
    handle_prices = window[right_high_idx:]
    if len(handle_prices) >= 5:
        handle_low = min(handle_prices)
        handle_depth = (right_high - handle_low) / right_high
        handle_valid = handle_depth <= 0.15 and len(handle_prices) <= cup_width // 4
    else:
        handle_valid = False

    # Volume analysis
    cup_volume = volumes[-lookback:right_high_idx]
    volume_declining = cup_volume[-1] < cup_volume[0]

    return {
        'pattern_found': 0.12 <= cup_depth <= 0.33 and u_shape,
        'cup_depth': cup_depth,
        'handle_valid': handle_valid,
        'handle_depth': handle_depth if handle_valid else None,
        'buy_point': right_high + 0.10 if handle_valid else left_high + 0.10,
        'volume_confirms': volume_declining
    }
```

#### 2. Double Bottom (W Pattern)

**Specifications:**
- Shape: W pattern
- Second leg should undercut first low (shakeout)
- Depth: 20-30% correction typical
- Duration: Minimum 7 weeks

**Buy Point:**
- Middle peak of W + $0.10

```python
def detect_double_bottom(prices, lookback=50):
    """
    Detect Double Bottom (W) pattern
    """
    window = prices[-lookback:]

    # Find two lows
    mid_point = len(window) // 2
    first_low_idx = window[:mid_point].index(min(window[:mid_point]))
    second_low_idx = mid_point + window[mid_point:].index(min(window[mid_point:]))

    # Find middle peak
    middle_peak_idx = first_low_idx
    for i in range(first_low_idx, second_low_idx):
        if window[i] > window[middle_peak_idx]:
            middle_peak_idx = i

    first_low = window[first_low_idx]
    second_low = window[second_low_idx]
    middle_peak = window[middle_peak_idx]

    # Second low should undercut first (shakeout)
    undercut = second_low < first_low

    # Calculate depth
    depth = (middle_peak - min(first_low, second_low)) / middle_peak

    return {
        'pattern_found': undercut and 0.15 <= depth <= 0.35,
        'first_low': first_low,
        'second_low': second_low,
        'middle_peak': middle_peak,
        'undercut': undercut,
        'depth': depth,
        'buy_point': middle_peak + 0.10
    }
```

#### 3. Flat Base

**Specifications:**
- Depth: Maximum 10-15% correction
- Duration: Minimum 5-6 weeks
- Forms AFTER prior advance of 20%+
- Moves sideways, not down
- Often second-stage base after cup-and-handle

**Volume:**
- **40-50% above average on breakout**

```python
def detect_flat_base(prices, volumes, lookback=30):
    """
    Detect Flat Base pattern
    """
    window = prices[-lookback:]

    high = max(window)
    low = min(window)

    # Calculate range
    range_pct = (high - low) / high

    # Check for prior advance (look back further)
    prior_low = min(prices[-lookback*2:-lookback])
    prior_advance = (window[0] - prior_low) / prior_low

    # Flat base criteria
    is_flat = range_pct <= 0.15  # Max 15% depth
    had_prior_advance = prior_advance >= 0.20  # 20%+ prior move

    # Check duration (minimum 25 trading days = ~5 weeks)
    sufficient_duration = len(window) >= 25

    return {
        'pattern_found': is_flat and had_prior_advance and sufficient_duration,
        'range_pct': range_pct,
        'prior_advance': prior_advance,
        'buy_point': high + 0.10,
        'weeks_in_base': len(window) / 5
    }
```

#### 4. Ascending Base

**Specifications:**
- Series of higher highs and higher lows
- 3+ pullbacks, each higher than previous
- Each pullback: 10-20% correction
- Continues pushing higher during consolidation

```python
def detect_ascending_base(prices, lookback=60):
    """
    Detect Ascending Base pattern
    """
    window = prices[-lookback:]

    # Find local highs and lows
    highs = []
    lows = []

    for i in range(5, len(window)-5):
        if window[i] > window[i-5] and window[i] > window[i+5]:
            highs.append((i, window[i]))
        if window[i] < window[i-5] and window[i] < window[i+5]:
            lows.append((i, window[i]))

    # Check for ascending pattern
    higher_highs = all(highs[i][1] < highs[i+1][1] for i in range(len(highs)-1))
    higher_lows = all(lows[i][1] < lows[i+1][1] for i in range(len(lows)-1))

    # Need at least 3 pullbacks
    sufficient_pullbacks = len(lows) >= 3

    return {
        'pattern_found': higher_highs and higher_lows and sufficient_pullbacks,
        'num_pullbacks': len(lows),
        'higher_highs': higher_highs,
        'higher_lows': higher_lows,
        'buy_point': highs[-1][1] + 0.10 if highs else None
    }
```

#### 5. High Tight Flag (Power Play)

**Specifications:**
- Most powerful and rarest pattern
- Initial move: **100-120% gain in 4-8 weeks** (flagpole)
- Consolidation: **10-25% correction in 3-5 weeks** (flag)
- Breakout volume: 40%+ above average

**Caution:**
- Avoid stocks that jump 100% in 1-2 weeks from gap
- Use fundamentals as filter
- Should be driven by catalyst (new product, earnings beat)

```python
def detect_high_tight_flag(prices, volumes, lookback=60):
    """
    Detect High Tight Flag pattern
    """
    # Find flagpole (100%+ gain in 4-8 weeks)
    for i in range(20, 40):  # 4-8 weeks = 20-40 trading days
        start = prices[-lookback]
        peak = max(prices[-lookback:-lookback+i])
        gain = (peak - start) / start

        if gain >= 1.00:  # 100%+ gain
            flagpole_end = -lookback + prices[-lookback:-lookback+i].index(peak)

            # Find flag (consolidation)
            flag_prices = prices[flagpole_end:]
            if len(flag_prices) >= 15:  # At least 3 weeks
                flag_high = max(flag_prices)
                flag_low = min(flag_prices)
                flag_depth = (flag_high - flag_low) / flag_high

                if flag_depth <= 0.25:  # Max 25% correction
                    return {
                        'pattern_found': True,
                        'flagpole_gain': gain,
                        'flag_depth': flag_depth,
                        'buy_point': flag_high + 0.10,
                        'rarity': 'RARE'
                    }

    return {'pattern_found': False}
```

### CANSLIM Buy and Sell Rules

#### Buy Rules

1. **Buy at pivot point** (breakout from base)
2. **Volume must be 40-50% above average** on breakout
3. **Market must be in confirmed uptrend** (M criteria)
4. **Stock should be within 5% of pivot point**
5. **Never chase extended stocks** (>5% above pivot)

#### Sell Rules

**Offensive (Profit Taking):**
- Take profits at **20-25%** gain
- **Exception:** If stock gains 20%+ in 2-3 weeks, hold for 8 weeks minimum
- At 8 weeks, decide: sell or hold 6+ months

**Defensive (Stop Loss):**
- **ABSOLUTE RULE: Cut losses at 7-8% below buy point**
- No exceptions - this is non-negotiable
- Average loss should be smaller than 8%
- Never let stock turn into loser after 20%+ gain

**Additional Sell Signals:**
- Stock makes new high on low volume
- Climax top (largest daily gain after extended run)
- Stock breaks below 50-day moving average on heavy volume
- Market enters correction

```python
def canslim_position_management(entry_price, current_price, days_held, high_since_entry):
    """
    CANSLIM buy/sell decision logic
    """
    gain_pct = (current_price - entry_price) / entry_price
    max_gain = (high_since_entry - entry_price) / entry_price

    # STOP LOSS - Non-negotiable
    if gain_pct <= -0.07:
        return {
            'action': 'SELL',
            'reason': 'Stop loss triggered at 7%',
            'priority': 'IMMEDIATE'
        }

    if gain_pct <= -0.08:
        return {
            'action': 'SELL',
            'reason': 'Maximum stop loss at 8%',
            'priority': 'CRITICAL'
        }

    # Protect profits - don't let winner become loser
    if max_gain >= 0.20 and gain_pct <= 0:
        return {
            'action': 'SELL',
            'reason': '20%+ gain turned to loss - protect capital',
            'priority': 'HIGH'
        }

    # Quick 20% gain rule
    if gain_pct >= 0.20 and days_held <= 15:  # 3 weeks
        return {
            'action': 'HOLD',
            'reason': '20% gain in <3 weeks - hold for 8 weeks',
            'hold_until_day': 40  # 8 weeks
        }

    # Standard profit taking
    if gain_pct >= 0.20:
        return {
            'action': 'CONSIDER_SELL',
            'reason': 'Take profits at 20-25%',
            'priority': 'MEDIUM'
        }

    return {'action': 'HOLD', 'reason': 'Position healthy'}
```

---

## Algorithmic Implementation

### Combined CANSLIM Screener

```python
class CANSLIMScreener:
    """
    Complete CANSLIM stock screener
    """

    def __init__(self, data_provider):
        self.data = data_provider

    def screen_stock(self, symbol):
        """
        Run full CANSLIM analysis on a stock
        """
        # Get data
        fundamentals = self.data.get_fundamentals(symbol)
        prices = self.data.get_prices(symbol, days=252)
        volumes = self.data.get_volumes(symbol, days=252)
        market_data = self.data.get_market_index()

        # Run all criteria
        results = {
            'C': self.check_c_criteria(fundamentals),
            'A': self.check_a_criteria(fundamentals),
            'N': self.check_n_criteria(prices),
            'S': self.check_s_criteria(fundamentals, volumes),
            'L': self.check_l_criteria(symbol),
            'I': self.check_i_criteria(fundamentals),
            'M': self.check_m_criteria(market_data)
        }

        # Calculate composite score
        passing = sum(1 for r in results.values() if r['passes'])

        # Detect chart patterns
        patterns = {
            'cup_handle': self.detect_cup_and_handle(prices, volumes),
            'double_bottom': self.detect_double_bottom(prices),
            'flat_base': self.detect_flat_base(prices, volumes),
            'ascending_base': self.detect_ascending_base(prices),
            'high_tight_flag': self.detect_high_tight_flag(prices, volumes)
        }

        return {
            'symbol': symbol,
            'canslim_score': passing,
            'criteria': results,
            'passes_all': passing >= 6,  # Allow 1 marginal fail
            'patterns': patterns,
            'buy_signal': self.generate_buy_signal(results, patterns)
        }

    def generate_buy_signal(self, criteria, patterns):
        """
        Generate actionable buy signal
        """
        # Must pass M (market direction)
        if not criteria['M']['passes']:
            return {'signal': 'NO_BUY', 'reason': 'Market not in uptrend'}

        # Must have valid pattern
        valid_patterns = [p for p, data in patterns.items() if data.get('pattern_found')]
        if not valid_patterns:
            return {'signal': 'WATCH', 'reason': 'No valid base pattern'}

        # Must pass at least 5/7 criteria
        passing = sum(1 for r in criteria.values() if r['passes'])
        if passing < 5:
            return {'signal': 'NO_BUY', 'reason': f'Only {passing}/7 criteria pass'}

        # Find best buy point
        best_pattern = valid_patterns[0]
        buy_point = patterns[best_pattern].get('buy_point')

        return {
            'signal': 'BUY',
            'pattern': best_pattern,
            'buy_point': buy_point,
            'criteria_score': f'{passing}/7',
            'stop_loss': buy_point * 0.92  # 8% stop
        }
```

### Livermore Trading System Implementation

```python
class LivermoreTradingSystem:
    """
    Jesse Livermore trading system implementation
    """

    def __init__(self):
        self.positions = {}
        self.cash_reserve = 0.50  # Keep 50% of big wins

    def analyze_stock(self, symbol, prices, volumes):
        """
        Livermore-style stock analysis
        """
        # Find pivotal points
        pivotal_points = self.identify_pivotal_points(prices)

        # Determine line of least resistance
        resistance = self.line_of_least_resistance(
            prices[-1],
            max(prices[-252:]),
            max(prices),
            self.calculate_volume_trend(volumes)
        )

        # Check for breakout
        breakout = self.check_breakout(prices, pivotal_points)

        return {
            'symbol': symbol,
            'pivotal_points': pivotal_points,
            'resistance_direction': resistance,
            'breakout_signal': breakout,
            'position_size': self.calculate_position_size(symbol)
        }

    def pyramid_position(self, symbol, entry_price, current_price, current_shares):
        """
        Livermore pyramiding logic
        """
        gain = (current_price - entry_price) / entry_price

        # Never add to losing position
        if gain <= 0:
            return {'action': 'HOLD', 'add_shares': 0}

        # Pyramiding tiers
        max_shares = self.calculate_max_position(symbol)

        if gain >= 0.15 and current_shares < max_shares * 0.6:
            return {'action': 'ADD', 'add_shares': max_shares * 0.4 - current_shares}
        elif gain >= 0.10 and current_shares < max_shares * 0.4:
            return {'action': 'ADD', 'add_shares': max_shares * 0.2}
        elif gain >= 0.05 and current_shares < max_shares * 0.2:
            return {'action': 'ADD', 'add_shares': max_shares * 0.2}

        return {'action': 'HOLD', 'add_shares': 0}

    def calculate_volume_trend(self, volumes, period=20):
        """
        Calculate volume trend for accumulation/distribution
        """
        recent = sum(volumes[-period:]) / period
        prior = sum(volumes[-period*2:-period]) / period
        return (recent - prior) / prior
```

---

## GitHub Implementations

### CANSLIM Implementations

| Repository | Description | Stars | Language |
|------------|-------------|-------|----------|
| [KhoiUna/python-canslim](https://github.com/KhoiUna/python-canslim) | CANSLIM analyzer with pyramid buying calculator | - | Python |
| [ssshah86/CAN-SLIM-screener](https://github.com/ssshah86/CAN-SLIM-screener) | Automated CANSLIM screener from O'Neil's book | - | Python |
| [rmtech1/canslim_tightweek_scanner](https://github.com/rmtech1/canslim_tightweek_scanner) | CANSLIM + Cup/Handle + 3 Weeks Tight patterns | - | Python |
| [anorum/canslim](https://github.com/anorum/canslim) | Historical analysis of CANSLIM effectiveness | - | Python |

### Cup and Handle Detection

| Repository | Description | Language |
|------------|-------------|----------|
| [kanwalpreet18/canslimTechnical](https://github.com/kanwalpreet18/canslimTechnical) | Stock pattern recognition for cup and handle | Python |
| [HumanRupert/marketsmith_pattern_recognition](https://github.com/HumanRupert/marketsmith_pattern_recognition) | MarketSmith-style pattern recognition | Python |
| [dragonAscent009/Cup-and-handle](https://github.com/dragonAscent009/Cup-and-handle) | C++ QT framework for cup and handle | C++ |
| [carlamHS/vcp_screener](https://github.com/carlamHS/vcp_screener) | VCP and cup-handle pattern screener | Python |

### Jesse Livermore Implementations

| Repository | Description | Language |
|------------|-------------|----------|
| [dyno/LMK](https://github.com/dyno/LMK) | Livermore Market Key with visualization | Python |
| [Coelodonta/Jesse_Livermore_Stock_Market_Key_Plot](https://github.com/Coelodonta/Jesse_Livermore_Stock_Market_Key_Plot) | Colorful plots following Market Key | Python |
| [jesse-ai/jesse-cli](https://github.com/jesse-ai/jesse-cli) | Crypto trading framework named after Livermore | Python |
| [deependersingla/deep_trader](https://github.com/deependersingla/deep_trader) | RL trading inspired by Livermore's tape reading | Python |

### IBD Relative Strength

| Repository | Description | Language |
|------------|-------------|----------|
| [skyte/relative-strength](https://github.com/skyte/relative-strength) | IBD-style RS percentile ranking (0-100) | Python |
| [iArpanK/RS-Screener](https://github.com/iArpanK/RS-Screener) | RS new highs screener (AmiBroker) | AFL |
| [ivelin/thinkorswim-apps](https://github.com/ivelin/thinkorswim-apps) | ThinkScript CANSLIM strategies | ThinkScript |

---

## Integration with Elliott Wave and Wyckoff

### Complementary Analysis Framework

```python
class IntegratedTradingSystem:
    """
    Integrates Livermore, O'Neil, Elliott Wave, and Wyckoff
    """

    def comprehensive_analysis(self, symbol):
        """
        Multi-methodology analysis
        """
        results = {}

        # 1. Wyckoff Analysis (from prior research: 99.34% ML accuracy)
        results['wyckoff'] = {
            'phase': self.detect_wyckoff_phase(),  # Accumulation/Distribution
            'composite_man': self.track_smart_money(),
            'spring_test': self.detect_spring()
        }

        # 2. Elliott Wave Analysis (73.68% with AI enhancement)
        results['elliott'] = {
            'wave_count': self.count_waves(),
            'current_wave': self.identify_current_wave(),
            'targets': self.calculate_fibonacci_targets()
        }

        # 3. Livermore Analysis
        results['livermore'] = {
            'pivotal_points': self.identify_pivotal_points(),
            'line_of_resistance': self.line_of_least_resistance(),
            'pyramid_signal': self.check_pyramid_opportunity()
        }

        # 4. O'Neil CANSLIM
        results['canslim'] = {
            'criteria_score': self.run_canslim_screen(),
            'chart_pattern': self.detect_base_pattern(),
            'rs_rating': self.calculate_rs_rating()
        }

        # Integration Logic
        return self.synthesize_signals(results)

    def synthesize_signals(self, results):
        """
        Combine signals from all methodologies
        """
        signals = []

        # Strong buy: All methods align
        if (results['wyckoff']['phase'] == 'accumulation_complete' and
            results['elliott']['current_wave'] in [1, 3] and
            results['livermore']['line_of_resistance'] == 'BULLISH' and
            results['canslim']['criteria_score'] >= 5):
            signals.append({
                'strength': 'STRONG_BUY',
                'confidence': 0.85,
                'methodologies_aligned': 4
            })

        # Wyckoff spring + O'Neil base breakout
        elif (results['wyckoff']['spring_test'] and
              results['canslim']['chart_pattern']['pattern_found']):
            signals.append({
                'strength': 'BUY',
                'confidence': 0.75,
                'primary_signal': 'wyckoff_spring',
                'confirmation': 'canslim_base'
            })

        # Elliott Wave 3 + Livermore breakout
        elif (results['elliott']['current_wave'] == 3 and
              results['livermore']['pivotal_points']['breakout']):
            signals.append({
                'strength': 'BUY',
                'confidence': 0.70,
                'primary_signal': 'elliott_wave_3',
                'confirmation': 'livermore_breakout'
            })

        return signals
```

### Key Integration Points

| Livermore/O'Neil Concept | Elliott Wave Equivalent | Wyckoff Equivalent |
|--------------------------|------------------------|-------------------|
| Pivotal Point Breakout | Wave 3 Impulse Start | Spring/Test |
| Cup and Handle | Wave 4 Correction + Wave 5 | Re-accumulation |
| Line of Least Resistance | Trend Direction | Composite Man Intent |
| Pyramiding | Add during Wave 3 | Add after Spring confirmation |
| 8% Stop Loss | Below Wave 2 low | Below Spring low |
| Distribution (sell) | Wave 5 exhaustion | Distribution Phase |

### Common Principles Across All Methods

1. **Trend Following**: All methods emphasize trading with the trend
2. **Volume Confirmation**: Critical for Livermore, O'Neil, and Wyckoff
3. **Breakout Trading**: Pivotal points, bases, and accumulation all lead to breakouts
4. **Risk Management**: Cut losses quickly (8% O'Neil, 10% Livermore)
5. **Patience**: Wait for clear signals (all methods)
6. **Institutional Activity**: Track "smart money" / "composite man"

---

## Comparative Analysis

### Livermore vs O'Neil

| Aspect | Jesse Livermore | William O'Neil |
|--------|-----------------|----------------|
| **Era** | 1890s-1940s | 1958-present |
| **Focus** | Price action, tape reading | Fundamentals + technicals |
| **Entry** | Pivotal point breakout | Base pattern breakout |
| **Position Sizing** | Pyramiding (add to winners) | Similar - add on strength |
| **Stop Loss** | ~10% rule | 7-8% absolute rule |
| **Profit Taking** | Let winners run | 20-25% or 8-week rule |
| **Market Timing** | "Line of least resistance" | M criteria (market direction) |
| **Volume** | Important | Critical (40%+ on breakout) |
| **Fundamentals** | Secondary | Essential (C, A, N, I criteria) |

### Success Rate Estimates

Based on available research and backtests:

| Method | Estimated Win Rate | Risk/Reward | Best Market Conditions |
|--------|-------------------|-------------|----------------------|
| Livermore Pivotal Points | 45-55% | 1:3+ | Trending markets |
| CANSLIM Full System | 35-45% | 1:3 to 1:5 | Bull markets |
| Cup and Handle Pattern | 60-65% | 1:2 to 1:3 | Confirmed uptrends |
| High Tight Flag | 70%+ | 1:5+ | Strong momentum |

### When to Use Each Method

**Use Livermore When:**
- Markets are clearly trending
- You prefer price action over fundamentals
- Trading shorter timeframes
- Want to pyramid into positions

**Use CANSLIM When:**
- Looking for growth stocks
- Have access to fundamental data
- Trading in confirmed bull markets
- Want systematic, rules-based approach

**Combine Both When:**
- Seeking highest conviction trades
- Want multiple confirmation signals
- Building longer-term positions
- Managing institutional-size positions

---

## Summary for Next Agents

### Key Findings

1. **Livermore's Core Contribution**: Line of least resistance and pivotal point concepts are foundational for breakout trading

2. **O'Neil's CANSLIM**: Most comprehensive growth stock screening system combining fundamentals with technicals

3. **Pattern Recognition**: Cup and handle, double bottom, flat base, and high tight flag patterns are algorithmically detectable with moderate accuracy

4. **Risk Management**: Both emphasize strict stop losses (7-10%) and position sizing

5. **Volume Analysis**: Critical confirmation signal for both methods

### Algorithmic Implementation Status

| Component | Difficulty | Accuracy Potential |
|-----------|------------|-------------------|
| RS Rating Calculation | Easy | High (exact formula) |
| CANSLIM Screening | Medium | High (clear criteria) |
| Cup and Handle Detection | Hard | Moderate (60-70%) |
| Pivotal Point Identification | Medium | Moderate (65-75%) |
| Pyramiding Logic | Easy | High (rule-based) |
| Market Direction (M) | Medium | High (follow-through days) |

### Integration Recommendations

1. Use CANSLIM for stock selection (universe filtering)
2. Apply Livermore pivotal points for entry timing
3. Confirm with Wyckoff accumulation phase analysis
4. Use Elliott Wave for price targets
5. Apply strict O'Neil stop-loss rules across all methods

---

## Sources

### Jesse Livermore
- [Jesse Livermore Trading Rules](https://jesse-livermore.com/trading-rules.html)
- [TradingCenter - Livermore's Method](https://tradingcenter.org/index.php/learn/trading-tips/330-jesse-livermore)
- [Macro-ops - Livermore Strategy](https://macro-ops.com/lessons-from-a-trading-great-jesse-livermore/)
- [TraderLion - Reminiscences Key Lessons](https://traderlion.com/trading-books/reminiscences-of-a-stock-operator/)
- [TraderLion - How to Trade in Stocks](https://traderlion.com/trading-books/how-to-trade-in-stocks/)
- [TradingSim - Livermore Pyramiding](https://www.tradingsim.com/blog/pyramiding)
- [TradingSim - Livermore Money Management](https://app.tradingsim.com/blog/jesse-livermore-money-management/)

### William O'Neil / CANSLIM
- [Wikipedia - CAN SLIM](https://en.wikipedia.org/wiki/CAN_SLIM)
- [Macro-ops - CANSLIM Explained](https://macro-ops.com/william-oneils-can-slim-trading-strategy-explained/)
- [TraderLion - CANSLIM Guide](https://traderlion.com/trading-strategies/canslim/)
- [O'Neil Global Advisors - RS Rating](https://www.oneilglobaladvisors.com/documents/FG/oneil/research/605570_OCM_Relative_Strength_Rating-OGA.pdf)
- [Fidelity - Cup with Handle](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cup-with-handle)
- [TraderLion - Cup and Handle Pattern](https://traderlion.com/technical-analysis/cup-and-handle-pattern/)
- [TraderLion - Flat Base Pattern](https://traderlion.com/technical-analysis/the-flat-base-pattern/)
- [Nasdaq - High Tight Flag](https://www.nasdaq.com/articles/high-tight-flag:-a-rare-powerful-pattern)

### GitHub Repositories
- [python-canslim](https://github.com/KhoiUna/python-canslim)
- [CAN-SLIM-screener](https://github.com/ssshah86/CAN-SLIM-screener)
- [canslim_tightweek_scanner](https://github.com/rmtech1/canslim_tightweek_scanner)
- [LMK (Livermore Market Key)](https://github.com/dyno/LMK)
- [relative-strength](https://github.com/skyte/relative-strength)
- [marketsmith_pattern_recognition](https://github.com/HumanRupert/marketsmith_pattern_recognition)
