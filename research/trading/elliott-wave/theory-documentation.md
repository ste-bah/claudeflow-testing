# Elliott Wave Theory: Complete Documentation for Algorithmic Implementation

## Executive Summary

This document provides comprehensive documentation of Elliott Wave Theory for algorithmic trading implementation, including core rules, pattern structures, Fibonacci relationships, AI/ML approaches, and pseudocode for automated wave detection.

**Key Findings:**
- Elliott Wave has 3 inviolable rules and numerous guidelines
- AI-enhanced systems (ElliottAgents) achieved 73.68% accuracy with backtesting vs 57.89% without
- Multiple Python implementations exist on GitHub with varying levels of maturity
- Pattern recognition requires swing/pivot detection + rule validation + Fibonacci confirmation

---

## Table of Contents

1. [Core Theory and Rules](#section-1-core-theory-and-rules)
2. [Wave Patterns](#section-2-wave-patterns)
3. [Fibonacci Relationships](#section-3-fibonacci-relationships)
4. [Algorithmic Implementation](#section-4-algorithmic-implementation)
5. [Existing AI Implementations](#section-5-existing-ai-implementations)
6. [Pseudocode](#section-6-pseudocode)
7. [Implementation Recommendations](#section-7-implementation-recommendations)

---

## Section 1: Core Theory and Rules

### 1.1 Historical Background

Elliott Wave Theory was developed by Ralph Nelson Elliott in the 1930s. It posits that market prices unfold in specific patterns driven by mass investor psychology. The theory suggests that:
- Movement in the direction of the trend unfolds in 5 waves (motive waves)
- Movement against the trend unfolds in 3 waves (corrective waves)
- Patterns are fractal - they repeat at all degrees/timeframes

### 1.2 The Three Cardinal Rules (MUST NEVER BE VIOLATED)

These rules are **absolute** - if any are violated, the wave count is invalid:

| Rule # | Rule | Description | Invalidation Condition |
|--------|------|-------------|------------------------|
| **1** | Wave 2 cannot retrace more than 100% of Wave 1 | The bottom of Wave 2 can never go below the starting point of Wave 1 | If Wave 2 breaks the origin of Wave 1, restart count |
| **2** | Wave 3 cannot be the shortest impulse wave | Wave 3 must be longer than either Wave 1 or Wave 5 (or both) | If Wave 3 < Wave 1 AND Wave 3 < Wave 5, invalid |
| **3** | Wave 4 cannot overlap Wave 1 price territory | Wave 4's low cannot enter the price range of Wave 1 | If Wave 4 low < Wave 1 high (in uptrend), invalid |

**Exception to Rule 3:** In diagonal patterns (ending and leading diagonals), Wave 4 *does* overlap Wave 1. This is the defining characteristic of diagonals.

### 1.3 Guidelines (Commonly Observed but Can Be Violated)

Unlike rules, guidelines indicate probability, not certainty:

#### 1.3.1 Guideline of Alternation
- If Wave 2 is a **sharp correction** (zigzag), Wave 4 will likely be a **sideways correction** (flat/triangle)
- If Wave 2 is a **sideways correction**, Wave 4 will likely be **sharp**
- Statistical note: Rich Swannell's research found alternation occurs ~61.8% of the time
- Exception: Diagonals do not display alternation; both W2 and W4 are typically zigzags

**Sharp Corrections:** Zigzags (single, double, triple) - never include a new price extreme
**Sideways Corrections:** Flats, triangles, combinations - usually include a new price extreme

#### 1.3.2 Wave Extension Guideline
- One of Waves 1, 3, or 5 will typically extend substantially
- In stock markets, Wave 3 most commonly extends
- In commodities/crypto, Wave 5 more commonly extends
- If neither Wave 1 nor 3 is extended, expect Wave 5 to extend

#### 1.3.3 Equality Guideline
- If Wave 3 extends, Waves 1 and 5 tend toward equality
- If Wave 5 extends, Waves 1 and 3 tend toward equality

#### 1.3.4 Channel Guideline
- Impulse waves tend to stay within parallel channels
- Wave 5 often ends at or near the upper channel line
- Breaking the channel often signals the wave is complete

### 1.4 Wave Degree Hierarchy

Elliott identified 9 degrees of waves, from largest to smallest:

| Degree | Notation (Up) | Notation (Down) | Typical Duration |
|--------|---------------|-----------------|------------------|
| Grand Supercycle | [I] [II] [III] | [A] [B] [C] | Multi-century |
| Supercycle | (I) (II) (III) | (A) (B) (C) | 40-70 years |
| Cycle | I II III | A B C | 1-several years |
| Primary | 1 2 3 4 5 | A B C | Few months - 2 years |
| Intermediate | (1) (2) (3) | (a) (b) (c) | Weeks - months |
| Minor | 1 2 3 4 5 | a b c | Weeks |
| Minute | i ii iii | a b c | Days |
| Minuette | (i) (ii) | (a) (b) | Hours |
| Subminuette | i ii iii | a b c | Minutes |

**Fractal Nature:** Each wave subdivides into waves of the next smaller degree. A Cycle wave contains Primary waves, which contain Intermediate waves, etc.

---

## Section 2: Wave Patterns

### 2.1 Impulse Waves (Motive - 5-3-5-3-5)

Standard impulse is the most common motive pattern:

```
        5
       /\
      /  \
     /    \
    3      \
   /\       \
  /  \       \
 /    \       \
1      \4      \
        \______/
         2
```

**Internal Structure:** 5-3-5-3-5
- Waves 1, 3, 5 are motive (5 subwaves each)
- Waves 2, 4 are corrective (3 subwaves each)

**Rules for Impulse:**
1. Wave 2 cannot retrace > 100% of Wave 1
2. Wave 3 cannot be shortest of 1, 3, 5
3. Wave 4 cannot overlap Wave 1

**Extensions:**
- One motive wave will often extend (subdivisions visible at same scale)
- Extended Wave 1: Strong start, often in new bull markets
- Extended Wave 3: Most common in stocks (strongest momentum)
- Extended Wave 5: Common in commodities, can signal exhaustion

**Truncation (Failure):**
- Wave 5 fails to exceed Wave 3's extreme
- Occurs after especially powerful Wave 3
- Wave 5 must still have 5 internal waves
- Prices must reach 70% of Wave 4 before truncation can occur
- Signals potential trend reversal

### 2.2 Diagonal Patterns

#### 2.2.1 Ending Diagonal (3-3-3-3-3)

Occurs in Wave 5 or Wave C position when preceding move was "too far too fast."

```
        5
       /\
      /  \3
     /\  /
    /  \/
   /   4\
  /      \
 1        \
  \      /
   \2   /
```

**Rules:**
- Internal structure: 3-3-3-3-3 (all waves are zigzags)
- Wave 1 and Wave 4 MUST overlap
- Wave 4 must not go beyond origin of Wave 3
- Wave 2 must not go beyond origin of Wave 1
- Wave 3 cannot be shortest
- Converging or expanding trendlines

**Contracting Ending Diagonal:**
- Wave 1 > Wave 3 > Wave 5
- Most common type
- Wave 5 can be truncated

**Expanding Ending Diagonal:**
- Wave 1 < Wave 3 < Wave 5
- Less common
- Also allows truncation

#### 2.2.2 Leading Diagonal (5-3-5-3-5 or 3-3-3-3-3)

Occurs in Wave 1 or Wave A position only.

**Rules:**
- Internal structure: 5-3-5-3-5 (more common) or 3-3-3-3-3
- Wave 4 and Wave 1 overlap
- Wave 2 retraces 61.8%-99% of Wave 1 but not beyond origin
- Wave 3 cannot be shortest
- Wave 5 CANNOT be truncated
- Often followed by deep retracement

### 2.3 Corrective Patterns

#### 2.3.1 Zigzag (5-3-5) - Sharp Correction

```
    B
   /\
  /  \
A/    \
       \
        \C
```

**Structure:**
- Wave A: 5-wave impulse or leading diagonal
- Wave B: Any corrective pattern (typically 38-79% of A)
- Wave C: 5-wave impulse or ending diagonal

**Rules:**
- Wave B shorter than Wave A
- Wave C longer than Wave B
- C typically equals A (100%) or 61.8%/161.8% of A

**Variations:**
- Single Zigzag: 5-3-5
- Double Zigzag (WXY): 5-3-5-3-5-3-5
- Triple Zigzag (WXYXZ): 5-3-5-3-5-3-5-3-5-3-5

#### 2.3.2 Flat (3-3-5) - Sideways Correction

**Regular Flat:**
- Wave B: 90-105% of Wave A
- Wave C: 100-105% of Wave A
- Relatively equal in length

**Expanded Flat:**
- Wave B: 105-138% of Wave A (exceeds start of A)
- Wave C: extends beyond end of A
- Most common flat type

**Running Flat:**
- Wave B: exceeds start of Wave A
- Wave C: fails to reach end of Wave A
- Indicates strong underlying trend

#### 2.3.3 Triangle (3-3-3-3-3) - ABCDE

```
    B
   /\
  /  \D
A/    \/\
  \  /E
   \/
    C
```

**Structure:** Five waves (A-B-C-D-E), each subdivides into 3
**Position:** ONLY appears before final wave (Wave 4 in impulse, Wave B in zigzag)

**Types:**
| Type | Characteristics |
|------|-----------------|
| Contracting | Most common; converging trendlines |
| Barrier | One trendline horizontal |
| Expanding | Rare; diverging trendlines |
| Ascending | Flat top, rising bottom |
| Descending | Flat bottom, declining top |

**Key Rules:**
- At least 4 of 5 waves must be zigzags or zigzag combinations
- Wave C never goes beyond end of Wave A
- Wave D never goes beyond end of Wave B
- Wave E never goes beyond end of Wave C

#### 2.3.4 Combinations (Double/Triple Three)

**Double Three (WXY):**
- Structure: 3-3-3 (corrective-corrective-corrective)
- W, X, Y can each be zigzag, flat, or triangle (Y only)
- Creates 7-swing pattern
- No more than one zigzag in combination
- No more than one triangle (must be last)

**Triple Three (WXYXZ):**
- Structure: 3-3-3-3-3
- 11-swing pattern
- Same rules as double three
- Rare

---

## Section 3: Fibonacci Relationships

### 3.1 Complete Fibonacci Ratio Tables

#### 3.1.1 Impulse Wave Relationships

**Wave 2 Retracements (of Wave 1):**
| Retracement | Probability | Notes |
|-------------|-------------|-------|
| 38.2% | Low | Shallow - strong trend |
| 50.0% | High | Most common |
| 61.8% | High | Golden ratio - very common |
| 78.6% | Medium | Deep retracement |
| 85.4% | Low | Near maximum |

*Statistical finding: ~73% of Wave 2 retracements fall between 50% and 61.8%*

**Wave 3 Extensions (of Wave 1):**
| Extension | Probability | Notes |
|-----------|-------------|-------|
| 100% | Low | Equal to Wave 1 |
| 161.8% | Very High | Most common target |
| 200% | Medium | Strong trend |
| 261.8% | Medium | Extended Wave 3 |
| 323.6% | Low | Very extended |
| 423.6% | Rare | Extreme extension |

**Wave 4 Retracements (of Wave 3):**
| Retracement | Probability | Notes |
|-------------|-------------|-------|
| 14.6% | Low | Very shallow |
| 23.6% | High | Common in strong trends |
| 38.2% | Very High | Most common |
| 50.0% | Low | Deep - check alternation |

**Wave 5 Projections:**
| Relationship | Formula | Notes |
|--------------|---------|-------|
| Equal to W1 | W5 = W1 | When W3 is extended |
| 61.8% of W1 | W5 = 0.618 * W1 | Common |
| 61.8% of W1-W3 | W5 = 0.618 * (W1 + W3) | Net travel |
| 161.8% of W1 | W5 = 1.618 * W1 | Extended W5 |
| 261.8% of W1 | W5 = 2.618 * W1 | Highly extended W5 |

#### 3.1.2 Corrective Wave Relationships

**Zigzag (A-B-C):**
| Relationship | Ratio | Notes |
|--------------|-------|-------|
| B retracement of A | 38.2% - 78.6% | 50-79% if B is zigzag |
| C = A | 100% | Most common |
| C = 61.8% * A | 61.8% | Truncated C |
| C = 161.8% * A | 161.8% | Extended C |

**Flat (A-B-C):**
| Type | B of A | C of A |
|------|--------|--------|
| Regular | 90-105% | 100-105% |
| Expanded | 105-138% | 100-165% |
| Running | >100% | <100% |

**Triangle (A-B-C-D-E):**
| Relationship | Typical Ratio |
|--------------|---------------|
| Each wave | 61.8% of prior wave |
| B of A | 61.8-78.6% |
| C of B | 61.8-78.6% |
| D of C | 61.8-78.6% |
| E of D | 61.8-78.6% |

### 3.2 Channel Projection Technique

**Step 1 - After Wave 2:**
1. Draw line from Wave 1 start through Wave 2 end
2. Draw parallel through Wave 1 end
3. Upper parallel = Wave 3 initial target

**Step 2 - After Wave 3:**
1. Draw line through Wave 1 and Wave 3 tops
2. Draw parallel through Wave 2 bottom
3. Lower parallel = Wave 4 target

**Step 3 - After Wave 4:**
1. Draw line from Wave 2 end through Wave 4 end
2. Draw parallel through Wave 3 end
3. Upper parallel = Wave 5 target (normal)
4. 1.618x projection for extended Wave 5

---

## Section 4: Algorithmic Implementation

### 4.1 Data Structures

```python
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from datetime import datetime

class WaveType(Enum):
    IMPULSE = "impulse"
    CORRECTIVE = "corrective"
    DIAGONAL_LEADING = "leading_diagonal"
    DIAGONAL_ENDING = "ending_diagonal"
    ZIGZAG = "zigzag"
    FLAT = "flat"
    TRIANGLE = "triangle"
    COMBINATION = "combination"

class WaveDegree(Enum):
    GRAND_SUPERCYCLE = 9
    SUPERCYCLE = 8
    CYCLE = 7
    PRIMARY = 6
    INTERMEDIATE = 5
    MINOR = 4
    MINUTE = 3
    MINUETTE = 2
    SUBMINUETTE = 1

class WaveDirection(Enum):
    UP = 1
    DOWN = -1

@dataclass
class PricePoint:
    timestamp: datetime
    price: float
    index: int  # Bar index

@dataclass
class Wave:
    start: PricePoint
    end: PricePoint
    label: str  # "1", "2", "3", "4", "5", "A", "B", "C", etc.
    degree: WaveDegree
    wave_type: WaveType
    direction: WaveDirection
    subwaves: Optional[List['Wave']] = None
    confidence: float = 0.0  # 0-1 confidence score

    @property
    def length(self) -> float:
        return abs(self.end.price - self.start.price)

    @property
    def retracement_of(self, reference_wave: 'Wave') -> float:
        return self.length / reference_wave.length

@dataclass
class WaveCount:
    waves: List[Wave]
    pattern_type: WaveType
    degree: WaveDegree
    confidence: float
    alternative_counts: List['WaveCount'] = None
    invalidation_level: float = None
```

### 4.2 Pattern Matching Algorithm Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRICE DATA (OHLCV)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               SWING DETECTION / PIVOT FINDER                     │
│   - ZigZag indicator (percentage-based)                         │
│   - Fractal pivots (Williams)                                   │
│   - Volatility-adjusted pivots                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MONOWAVE IDENTIFICATION                         │
│   - Identify all potential monowaves                            │
│   - Calculate wave properties (length, duration, retracement)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              COMBINATION GENERATOR                               │
│   - Generate all possible wave groupings                        │
│   - Create candidate patterns (impulse, zigzag, flat, etc.)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               RULE VALIDATOR                                     │
│   - Check 3 cardinal rules                                      │
│   - Validate pattern-specific rules                             │
│   - Eliminate invalid counts                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FIBONACCI VALIDATOR                                 │
│   - Check Fibonacci relationships                               │
│   - Score guideline adherence                                   │
│   - Rank patterns by probability                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              MULTI-TIMEFRAME ANALYZER                            │
│   - Correlate counts across timeframes                          │
│   - Ensure fractal consistency                                  │
│   - Adjust degree labels                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              CONFIDENCE SCORING                                  │
│   - Rule compliance score                                       │
│   - Guideline adherence score                                   │
│   - Fibonacci accuracy score                                    │
│   - Historical pattern success rate                             │
│   - Multi-timeframe agreement score                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              OUTPUT: RANKED WAVE COUNTS                          │
│   - Primary count (highest confidence)                          │
│   - Alternative counts                                          │
│   - Invalidation levels                                         │
│   - Price targets                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Confidence Scoring Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Rule Compliance | 40% | Must pass all 3 rules (binary) |
| Fibonacci Alignment | 25% | How closely waves match Fibonacci ratios |
| Guideline Adherence | 15% | Alternation, extension, channel fit |
| Volume Confirmation | 10% | Volume patterns support wave structure |
| Timeframe Agreement | 10% | Count agrees across multiple timeframes |

### 4.4 Handling Alternative Counts

Elliott Wave analysis often produces multiple valid interpretations. Best practices:

1. **Rank by Probability:** Use confidence scoring
2. **Track Invalidation:** Each count has a price level that invalidates it
3. **Update Dynamically:** As price moves, some counts become invalid
4. **Display Top 3:** Show primary + 2 alternatives to user
5. **Log History:** Track which counts succeeded for ML training

---

## Section 5: Existing AI Implementations

### 5.1 Academic Research

#### 5.1.1 ElliottAgents (2024) - Most Significant
**Source:** [MDPI Applied Sciences](https://www.mdpi.com/2076-3417/14/24/11897)

- **Architecture:** Multi-agent system with LLM + DRL + RAG
- **Results:** 73.68% accuracy with backtesting vs 57.89% without
- **Key Innovation:** Natural language dialogue between specialized agents
- **Components:**
  - Pattern Recognition Agent (CNN-based)
  - Wave Labeling Agent
  - Investment Strategy Agent
  - Backtesting Agent (DRL)
- **Dataset:** Bitcoin/USD Oct 2022 - Sep 2024

#### 5.1.2 Neural Network Approaches
**Source:** [ResearchGate](https://www.researchgate.net/publication/268603064_Elliott_Waves_Recognition_Via_Neural_Networks)

- **Architecture:** Feed-forward neural network (10-10-11 or 20-16-12)
- **Input:** 10-20 features describing wave characteristics
- **Output:** Classification of 11-12 wave types
- **Limitation:** Requires pre-identified pivot points

#### 5.1.3 EWP-RNN (Elliott Wave Principle with RNN)
**Source:** [JATIT](http://www.jatit.org/volumes/Vol100No18/10Vol100No18.pdf)

- **Architecture:** Recurrent Neural Network
- **Purpose:** Identify impulse waves and predict trend continuation
- **Application:** Stock market trend prediction

#### 5.1.4 Multi-Classifier Approach
**Source:** [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0898122113000291)

- **Methods:** Random Forest + SVM
- **Results:** >70% trend prediction accuracy
- **Focus:** Incomplete wave pattern recognition

### 5.2 GitHub Repositories

| Repository | Stars | Language | Description | Link |
|------------|-------|----------|-------------|------|
| **ElliottWaveAnalyzer** | ~50+ | Python | Rule-based validation, impulse/ABC detection | [GitHub](https://github.com/btcorgtfo/ElliottWaveAnalyzer) |
| **PyBacktesting** | ~100+ | Python | Genetic algorithm optimization of Elliott Wave | [GitHub](https://github.com/philippe-ostiguy/PyBacktesting) |
| **ElliottWaves** | ~30+ | Python | Pattern recognition with matplotlib visualization | [GitHub](https://github.com/alessioricco/ElliottWaves) |
| **elliot-waves-auto** | New | Python | Web app with Fibonacci projections + trade setups | [GitHub](https://github.com/ESJavadex/elliot-waves-auto) |
| **python-taew** | ~20+ | Python | Based on academic paper, Fibonacci validation | [GitHub](https://github.com/DrEdwardPCB/python-taew) |
| **Quantdom** | ~500+ | Python | Backtesting framework with Elliott Wave features | [GitHub](https://github.com/constverum/Quantdom) |

### 5.3 Commercial Solutions

#### 5.3.1 WaveBasis (wavebasis.com)
**Key Features:**
- Proprietary V2 pattern detection engine
- Two-phase detection + analysis
- Smart Tools for trade setup identification
- Cloud-based, works in browser
- Wave Count Scanner across instruments
- Probability-based measurement methodology

#### 5.3.2 MotiveWave (motivewave.com)
**Key Features:**
- Auto Wave tool with proprietary algorithm
- Automatic decomposition (up to 2 levels)
- Real-time count updates
- All Elliott patterns + degrees supported
- Rule/guideline enforcement with alerts
- Genetic algorithm optimization for strategies
- Elliott Wave Scanner for multiple instruments
- Backtesting + walk-forward testing

### 5.4 What Has Worked / Failed

**Approaches That Show Promise:**
1. **Multi-agent systems** combining pattern recognition, validation, and strategy
2. **CNN for visual pattern matching** on price chart images
3. **LSTM for sequence prediction** of wave progression
4. **Genetic algorithms** for optimizing Fibonacci parameters
5. **Ensemble methods** combining multiple models

**Common Failure Modes:**
1. **Overfitting to historical patterns** - markets evolve
2. **Single timeframe analysis** - misses fractal structure
3. **Rigid rule application** - no handling of near-misses
4. **Ignoring alternative counts** - single "best" count often wrong
5. **No backtesting validation** - patterns look good but don't trade well

**Accuracy Caveats:**
- Traditional Elliott Wave: ~50% (equivalent to coin flip according to critics)
- AI-Enhanced (ElliottAgents): ~73% with backtesting
- Claims of 84.9% accuracy for specific projections exist but are disputed
- Subjectivity remains a fundamental challenge

---

## Section 6: Pseudocode

### 6.1 Swing/Pivot Detection

```python
def find_pivots(prices: List[float], threshold_pct: float = 5.0) -> List[PricePoint]:
    """
    ZigZag-based pivot detection

    Args:
        prices: List of closing prices
        threshold_pct: Minimum percentage move to qualify as swing

    Returns:
        List of PricePoint objects representing pivots
    """
    pivots = []

    if len(prices) < 3:
        return pivots

    # Initialize with first point
    last_pivot = PricePoint(index=0, price=prices[0])
    last_direction = None  # 1 for up, -1 for down
    pivots.append(last_pivot)

    for i in range(1, len(prices)):
        current_price = prices[i]
        change_pct = ((current_price - last_pivot.price) / last_pivot.price) * 100

        if last_direction is None:
            # Determine initial direction
            if abs(change_pct) >= threshold_pct:
                last_direction = 1 if change_pct > 0 else -1
                last_pivot = PricePoint(index=i, price=current_price)
                pivots.append(last_pivot)

        elif last_direction == 1:  # Was going up
            if current_price > last_pivot.price:
                # Continue up - update pivot
                last_pivot = PricePoint(index=i, price=current_price)
                pivots[-1] = last_pivot
            elif change_pct <= -threshold_pct:
                # Reversal down
                last_direction = -1
                last_pivot = PricePoint(index=i, price=current_price)
                pivots.append(last_pivot)

        else:  # Was going down
            if current_price < last_pivot.price:
                # Continue down - update pivot
                last_pivot = PricePoint(index=i, price=current_price)
                pivots[-1] = last_pivot
            elif change_pct >= threshold_pct:
                # Reversal up
                last_direction = 1
                last_pivot = PricePoint(index=i, price=current_price)
                pivots.append(last_pivot)

    return pivots
```

### 6.2 Wave Validation

```python
def validate_impulse_rules(waves: List[Wave]) -> Tuple[bool, str]:
    """
    Validate the 3 cardinal rules for impulse wave

    Args:
        waves: List of 5 Wave objects labeled 1-5

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(waves) != 5:
        return False, "Impulse must have exactly 5 waves"

    w1, w2, w3, w4, w5 = waves

    # Rule 1: Wave 2 cannot retrace more than 100% of Wave 1
    if w1.direction == WaveDirection.UP:
        # Uptrend: W2 low cannot go below W1 start
        if w2.end.price < w1.start.price:
            return False, "Rule 1 violated: Wave 2 retraced > 100% of Wave 1"
    else:
        # Downtrend: W2 high cannot go above W1 start
        if w2.end.price > w1.start.price:
            return False, "Rule 1 violated: Wave 2 retraced > 100% of Wave 1"

    # Rule 2: Wave 3 cannot be the shortest impulse wave
    len_w1 = w1.length
    len_w3 = w3.length
    len_w5 = w5.length

    if len_w3 < len_w1 and len_w3 < len_w5:
        return False, "Rule 2 violated: Wave 3 is shortest"

    # Rule 3: Wave 4 cannot overlap Wave 1 price territory
    if w1.direction == WaveDirection.UP:
        # Uptrend: W4 low cannot go into W1 price range
        w1_high = max(w1.start.price, w1.end.price)
        if w4.end.price < w1_high:
            return False, "Rule 3 violated: Wave 4 overlaps Wave 1"
    else:
        # Downtrend: W4 high cannot go into W1 price range
        w1_low = min(w1.start.price, w1.end.price)
        if w4.end.price > w1_low:
            return False, "Rule 3 violated: Wave 4 overlaps Wave 1"

    return True, "Valid impulse pattern"


def validate_zigzag_rules(waves: List[Wave]) -> Tuple[bool, str]:
    """
    Validate rules for zigzag corrective pattern (A-B-C)
    """
    if len(waves) != 3:
        return False, "Zigzag must have exactly 3 waves"

    wave_a, wave_b, wave_c = waves

    # Wave B must be shorter than Wave A
    if wave_b.length >= wave_a.length:
        return False, "Wave B must be shorter than Wave A"

    # Wave C must be longer than Wave B (typically)
    # This is a guideline, not a hard rule, but useful for validation

    # Wave A and C should be motive (5 waves internally)
    # Wave B should be corrective (3 waves internally)
    # These would be validated recursively

    return True, "Valid zigzag pattern"
```

### 6.3 Fibonacci Level Calculator

```python
from typing import Dict, List

def calculate_fibonacci_levels(wave: Wave,
                               is_retracement: bool = True) -> Dict[str, float]:
    """
    Calculate Fibonacci retracement or extension levels for a wave

    Args:
        wave: The reference wave
        is_retracement: True for retracement, False for extension

    Returns:
        Dictionary of level_name -> price
    """
    wave_length = wave.length
    wave_start = wave.start.price
    wave_end = wave.end.price

    if is_retracement:
        # Retracement levels
        ratios = {
            '23.6%': 0.236,
            '38.2%': 0.382,
            '50.0%': 0.500,
            '61.8%': 0.618,
            '78.6%': 0.786,
            '85.4%': 0.854,
            '100%': 1.000
        }

        if wave.direction == WaveDirection.UP:
            return {name: wave_end - (wave_length * ratio)
                    for name, ratio in ratios.items()}
        else:
            return {name: wave_end + (wave_length * ratio)
                    for name, ratio in ratios.items()}
    else:
        # Extension levels
        ratios = {
            '100%': 1.000,
            '127.2%': 1.272,
            '161.8%': 1.618,
            '200%': 2.000,
            '261.8%': 2.618,
            '323.6%': 3.236,
            '423.6%': 4.236
        }

        if wave.direction == WaveDirection.UP:
            return {name: wave_start + (wave_length * ratio)
                    for name, ratio in ratios.items()}
        else:
            return {name: wave_start - (wave_length * ratio)
                    for name, ratio in ratios.items()}


def score_fibonacci_alignment(actual_wave: Wave,
                              reference_wave: Wave,
                              expected_ratios: List[float]) -> float:
    """
    Score how closely a wave aligns with expected Fibonacci ratios

    Args:
        actual_wave: The wave to score
        reference_wave: The wave to measure against
        expected_ratios: List of expected ratios (e.g., [0.382, 0.5, 0.618])

    Returns:
        Score from 0.0 to 1.0
    """
    if reference_wave.length == 0:
        return 0.0

    actual_ratio = actual_wave.length / reference_wave.length

    # Find closest expected ratio
    min_distance = min(abs(actual_ratio - r) for r in expected_ratios)

    # Convert distance to score (0 distance = 1.0 score)
    # Use tolerance of 0.05 (5%)
    tolerance = 0.05
    if min_distance <= tolerance:
        return 1.0 - (min_distance / tolerance)
    else:
        # Rapidly declining score beyond tolerance
        return max(0.0, 0.5 - (min_distance - tolerance))
```

### 6.4 Wave Pattern Finder

```python
def find_impulse_patterns(pivots: List[PricePoint],
                          direction: WaveDirection) -> List[WaveCount]:
    """
    Find all valid 5-wave impulse patterns in pivot data

    Args:
        pivots: List of swing high/low points
        direction: Overall trend direction

    Returns:
        List of valid WaveCount objects, sorted by confidence
    """
    valid_counts = []
    n = len(pivots)

    if n < 6:  # Need at least 6 pivots for 5 waves
        return valid_counts

    # Generate all possible 5-wave combinations
    # For 5 waves we need 6 pivots (start, end of each wave)
    for i in range(n - 5):
        for j in range(i + 1, n - 4):
            for k in range(j + 1, n - 3):
                for l in range(k + 1, n - 2):
                    for m in range(l + 1, n - 1):
                        for end in range(m + 1, n):

                            # Create wave candidates
                            w1 = Wave(start=pivots[i], end=pivots[j],
                                     label="1", direction=direction)
                            w2 = Wave(start=pivots[j], end=pivots[k],
                                     label="2", direction=opposite(direction))
                            w3 = Wave(start=pivots[k], end=pivots[l],
                                     label="3", direction=direction)
                            w4 = Wave(start=pivots[l], end=pivots[m],
                                     label="4", direction=opposite(direction))
                            w5 = Wave(start=pivots[m], end=pivots[end],
                                     label="5", direction=direction)

                            waves = [w1, w2, w3, w4, w5]

                            # Validate rules
                            is_valid, error = validate_impulse_rules(waves)
                            if not is_valid:
                                continue

                            # Calculate confidence score
                            confidence = calculate_impulse_confidence(waves)

                            # Create wave count
                            wave_count = WaveCount(
                                waves=waves,
                                pattern_type=WaveType.IMPULSE,
                                confidence=confidence,
                                invalidation_level=calculate_invalidation(waves)
                            )

                            valid_counts.append(wave_count)

    # Sort by confidence descending
    valid_counts.sort(key=lambda x: x.confidence, reverse=True)

    return valid_counts


def calculate_impulse_confidence(waves: List[Wave]) -> float:
    """
    Calculate confidence score for impulse wave pattern
    """
    score = 0.0

    w1, w2, w3, w4, w5 = waves

    # Rule compliance (40%) - already validated, so full marks
    score += 0.40

    # Fibonacci alignment (25%)
    fib_score = 0.0

    # W2 should retrace 50-61.8% of W1
    w2_ret = w2.length / w1.length
    if 0.50 <= w2_ret <= 0.618:
        fib_score += 0.5
    elif 0.382 <= w2_ret <= 0.786:
        fib_score += 0.25

    # W3 should be 161.8% of W1
    w3_ext = w3.length / w1.length
    if 1.5 <= w3_ext <= 1.75:
        fib_score += 0.3
    elif 1.0 <= w3_ext <= 2.618:
        fib_score += 0.15

    # W4 should retrace 23.6-38.2% of W3
    w4_ret = w4.length / w3.length
    if 0.236 <= w4_ret <= 0.382:
        fib_score += 0.2

    score += 0.25 * fib_score

    # Guideline adherence (15%)
    guideline_score = 0.0

    # Alternation check
    w2_type = classify_correction(w2)
    w4_type = classify_correction(w4)
    if w2_type != w4_type:  # Alternation present
        guideline_score += 0.5

    # Extension in one wave
    extensions = [w1.length, w3.length, w5.length]
    max_ext = max(extensions)
    if max_ext > 1.5 * min(extensions):
        guideline_score += 0.5

    score += 0.15 * guideline_score

    # Volume confirmation placeholder (10%)
    # Would need volume data
    score += 0.05  # Partial credit

    # Timeframe agreement placeholder (10%)
    # Would need multi-timeframe analysis
    score += 0.05  # Partial credit

    return min(1.0, score)
```

### 6.5 Multi-Timeframe Analyzer

```python
def analyze_multi_timeframe(price_data: Dict[str, List[float]],
                           timeframes: List[str]) -> Dict[str, WaveCount]:
    """
    Analyze Elliott Wave patterns across multiple timeframes

    Args:
        price_data: Dict mapping timeframe -> price list
        timeframes: List of timeframes in order (e.g., ['1D', '4H', '1H', '15M'])

    Returns:
        Dict mapping timeframe -> best WaveCount
    """
    results = {}

    # Analyze each timeframe independently
    for tf in timeframes:
        pivots = find_pivots(price_data[tf])

        # Try both directions
        up_counts = find_impulse_patterns(pivots, WaveDirection.UP)
        down_counts = find_impulse_patterns(pivots, WaveDirection.DOWN)

        all_counts = up_counts + down_counts

        if all_counts:
            results[tf] = all_counts[0]  # Best count
        else:
            results[tf] = None

    # Cross-validate between timeframes
    for i in range(len(timeframes) - 1):
        higher_tf = timeframes[i]
        lower_tf = timeframes[i + 1]

        if results[higher_tf] and results[lower_tf]:
            # Check if lower timeframe count is consistent
            # with higher timeframe structure
            higher_wave = get_current_wave(results[higher_tf])
            lower_count = results[lower_tf]

            # Boost confidence if counts align
            if counts_align(higher_wave, lower_count):
                lower_count.confidence *= 1.1  # 10% boost
            else:
                lower_count.confidence *= 0.9  # 10% penalty

    return results


def counts_align(higher_wave: Wave, lower_count: WaveCount) -> bool:
    """
    Check if lower timeframe count is consistent with higher timeframe wave

    E.g., if higher TF is in Wave 3, lower TF should show impulse in same direction
    """
    if higher_wave is None:
        return True  # No constraint

    # Wave 3 of higher TF should contain impulse on lower TF
    if higher_wave.label in ['3', '3', 'iii', 'III']:
        if lower_count.pattern_type == WaveType.IMPULSE:
            if lower_count.waves[0].direction == higher_wave.direction:
                return True

    # Wave 2 or 4 of higher TF should contain correction on lower TF
    if higher_wave.label in ['2', '4', 'ii', 'iv', 'II', 'IV']:
        if lower_count.pattern_type in [WaveType.ZIGZAG, WaveType.FLAT,
                                        WaveType.TRIANGLE]:
            return True

    return False
```

---

## Section 7: Implementation Recommendations

### 7.1 Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     ELLIOTT WAVE ANALYZER                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐             │
│  │   Data     │───▶│   Swing    │───▶│  Pattern   │             │
│  │  Ingestion │    │  Detector  │    │  Generator │             │
│  └────────────┘    └────────────┘    └────────────┘             │
│        │                                    │                    │
│        │          ┌────────────────────────┐│                    │
│        │          │                        ││                    │
│        │          ▼                        ▼│                    │
│        │    ┌────────────┐          ┌────────────┐              │
│        │    │   Rule     │          │ Fibonacci  │              │
│        │    │ Validator  │          │  Scorer    │              │
│        │    └────────────┘          └────────────┘              │
│        │          │                        │                    │
│        │          └─────────┬──────────────┘                    │
│        │                    │                                   │
│        │                    ▼                                   │
│        │          ┌────────────────┐                            │
│        │          │  Multi-TF      │                            │
│        │          │  Correlator    │                            │
│        │          └────────────────┘                            │
│        │                    │                                   │
│        │                    ▼                                   │
│        │          ┌────────────────┐                            │
│        │          │  ML Enhancer   │                            │
│        │          │  (Optional)    │                            │
│        │          └────────────────┘                            │
│        │                    │                                   │
│        ▼                    ▼                                   │
│  ┌─────────────────────────────────────────┐                    │
│  │           Output Manager                │                    │
│  │  - Ranked wave counts                   │                    │
│  │  - Confidence scores                    │                    │
│  │  - Invalidation levels                  │                    │
│  │  - Price targets                        │                    │
│  │  - Trading signals                      │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Technology Stack Recommendations

| Component | Recommended Technology | Reason |
|-----------|----------------------|--------|
| Language | Python 3.10+ | Ecosystem, libraries, ML support |
| Data Storage | TimescaleDB | Time-series optimized PostgreSQL |
| Computation | NumPy, Pandas | Fast array operations |
| ML Framework | PyTorch | Flexibility, research-friendly |
| Backtesting | Backtrader or custom | Established, well-documented |
| Visualization | Plotly/Dash | Interactive web charts |
| API | FastAPI | Modern, fast, async |

### 7.3 Best Practices

1. **Always Provide Alternative Counts**
   - Never present single "correct" count
   - Show top 3 counts with confidence scores
   - Display invalidation levels for each

2. **Use Multiple Timeframes**
   - Start analysis on highest timeframe
   - Work down to lower timeframes
   - Ensure fractal consistency

3. **Validate with Volume**
   - Wave 3 should have highest volume
   - Wave 5 often has declining volume
   - B waves in corrections often low volume

4. **Implement Proper Backtesting**
   - Walk-forward testing (not just historical)
   - Account for look-ahead bias
   - Test on multiple markets/instruments

5. **Handle Edge Cases**
   - Near-misses on rules (e.g., W4 almost overlaps W1)
   - Extended waves that subdivide visibly
   - Truncated 5th waves
   - Running corrections

### 7.4 Known Limitations

| Limitation | Mitigation |
|------------|------------|
| Subjectivity | Use quantitative scoring, multiple counts |
| Hindsight bias | Real-time testing, strict rule enforcement |
| Pattern completion uncertainty | Probabilistic targets, invalidation levels |
| Market regime changes | Adaptive parameters, ML retraining |
| Low accuracy alone | Combine with other indicators, strict risk management |

### 7.5 Future Enhancements

1. **CNN for Visual Pattern Recognition**
   - Train on chart images with labeled waves
   - Transfer learning from image classification

2. **LSTM for Sequence Prediction**
   - Predict next wave type given current sequence
   - Learn from successful historical counts

3. **Reinforcement Learning for Trading**
   - Agent learns when to enter/exit based on wave position
   - Reward function based on risk-adjusted returns

4. **LLM Integration**
   - Natural language wave count explanations
   - Multi-agent analysis (like ElliottAgents)
   - Combine with sentiment analysis

---

## Appendix A: Quick Reference Cheat Sheet

### Cardinal Rules
1. W2 < 100% of W1
2. W3 not shortest
3. W4 no overlap W1 (except diagonals)

### Common Fibonacci Levels
- W2: 50%, 61.8% of W1
- W3: 161.8%, 261.8% of W1
- W4: 38.2% of W3
- W5: 100% of W1 (if W3 extended)

### Pattern Structures
- Impulse: 5-3-5-3-5
- Ending Diagonal: 3-3-3-3-3
- Leading Diagonal: 5-3-5-3-5 or 3-3-3-3-3
- Zigzag: 5-3-5
- Flat: 3-3-5
- Triangle: 3-3-3-3-3

### Alternation
- If W2 sharp → W4 sideways
- If W2 sideways → W4 sharp

---

## Sources and References

### Theory Resources
- [BabyPips - 3 Cardinal Rules](https://www.babypips.com/learn/forex/the-3-cardinal-rules-and-some-guidelines)
- [Elliott Wave Forecast - Theory](https://elliottwave-forecast.com/elliott-wave-theory/)
- [Elliott Wave International - Waveopedia](https://www.elliottwave.com/waveopedia/)
- [StockCharts - Identifying Elliott Wave Patterns](https://chartschool.stockcharts.com/table-of-contents/market-analysis/elliott-wave-analysis-articles/identifying-elliott-wave-patterns)
- [LuxAlgo - Pattern Rules Simplified](https://www.luxalgo.com/blog/elliott-wave-theory-pattern-rules-simplified/)

### AI/ML Research
- [ElliottAgents - MDPI](https://www.mdpi.com/2076-3417/14/24/11897)
- [Neural Network Wave Recognition - ResearchGate](https://www.researchgate.net/publication/268603064_Elliott_Waves_Recognition_Via_Neural_Networks)
- [Multi-classifier - ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0898122113000291)
- [EWP-RNN - JATIT](http://www.jatit.org/volumes/Vol100No18/10Vol100No18.pdf)

### GitHub Repositories
- [ElliottWaveAnalyzer](https://github.com/btcorgtfo/ElliottWaveAnalyzer)
- [PyBacktesting](https://github.com/philippe-ostiguy/PyBacktesting)
- [ElliottWaves](https://github.com/alessioricco/ElliottWaves)
- [elliot-waves-auto](https://github.com/ESJavadex/elliot-waves-auto)
- [python-taew](https://github.com/DrEdwardPCB/python-taew)
- [Quantdom](https://github.com/constverum/Quantdom)

### Commercial Tools
- [WaveBasis](https://wavebasis.com/)
- [MotiveWave](https://www.motivewave.com/elliott_wave.htm)

---

*Document generated: January 2026*
*Agent: Research Agent #3 of 10*
*For use by: Next agents (Wyckoff Method, Famous Traders)*
