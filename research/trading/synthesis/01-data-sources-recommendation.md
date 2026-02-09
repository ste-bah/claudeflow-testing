# Data Sources Recommendation

## Agent 10/10 Final Synthesis - Market Prediction God Agent

---

## Executive Recommendation

### Primary Data Stack (Recommended)

| Layer | Provider | Purpose | Rate Limit | Cost |
|-------|----------|---------|------------|------|
| **Market Data** | Finnhub | Real-time quotes, sentiment, fundamentals | 60/min | Free tier available |
| **Historical** | Alpha Vantage | 20+ years depth, technicals | 5/min (free) | Free/Premium |
| **Economic** | FRED | Macro indicators, unlimited | Unlimited | Free |
| **Aggregation** | OpenBB | 100+ providers unified API | Varies | Open source |
| **Execution** | Alpaca Markets | Paper + live trading | Unlimited | Commission-free |

---

## Tier 1: Core Data Sources

### 1. Finnhub (Primary Real-Time)

**Strengths:**
- 60 calls/minute free tier
- Built-in sentiment analysis
- Company news aggregation
- Real-time WebSocket support

**Implementation:**
```python
import finnhub

class FinnhubDataCollector:
    def __init__(self, api_key: str):
        self.client = finnhub.Client(api_key=api_key)

    def get_quote(self, symbol: str) -> dict:
        return self.client.quote(symbol)

    def get_sentiment(self, symbol: str) -> dict:
        return self.client.news_sentiment(symbol)

    def get_candles(self, symbol: str, resolution: str,
                    from_ts: int, to_ts: int) -> dict:
        return self.client.stock_candles(symbol, resolution, from_ts, to_ts)
```

**Rate Limit Strategy:**
- Queue requests with 1-second spacing
- Cache responses for 30 seconds
- Use WebSocket for real-time data

### 2. Alpha Vantage (Historical Depth)

**Strengths:**
- 20+ years historical data
- 50+ technical indicators built-in
- Adjusted close prices
- Intraday to monthly resolutions

**Implementation:**
```python
from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.techindicators import TechIndicators

class AlphaVantageCollector:
    def __init__(self, api_key: str):
        self.ts = TimeSeries(key=api_key, output_format='pandas')
        self.ti = TechIndicators(key=api_key, output_format='pandas')

    def get_daily(self, symbol: str, outputsize: str = 'full'):
        data, meta = self.ts.get_daily_adjusted(symbol, outputsize=outputsize)
        return data

    def get_rsi(self, symbol: str, interval: str = 'daily', period: int = 14):
        data, meta = self.ti.get_rsi(symbol, interval=interval, time_period=period)
        return data
```

### 3. FRED (Economic Indicators)

**Strengths:**
- Unlimited API calls
- 800,000+ economic time series
- Fed rates, GDP, unemployment, inflation
- No rate limiting

**Critical Indicators for Trading:**
| Indicator | Series ID | Update Frequency | Relevance |
|-----------|-----------|------------------|-----------|
| Fed Funds Rate | FEDFUNDS | Monthly | Interest rate sensitivity |
| 10Y Treasury | DGS10 | Daily | Risk-free rate |
| VIX | VIXCLS | Daily | Market fear gauge |
| Unemployment | UNRATE | Monthly | Economic health |
| CPI | CPIAUCSL | Monthly | Inflation |
| M2 Money Supply | M2SL | Weekly | Liquidity |

**Implementation:**
```python
from fredapi import Fred

class FREDCollector:
    def __init__(self, api_key: str):
        self.fred = Fred(api_key=api_key)

    def get_indicator(self, series_id: str, start_date: str = None):
        return self.fred.get_series(series_id, start_date)

    def get_macro_dashboard(self):
        indicators = {
            'fed_rate': self.get_indicator('FEDFUNDS'),
            'treasury_10y': self.get_indicator('DGS10'),
            'vix': self.get_indicator('VIXCLS'),
            'unemployment': self.get_indicator('UNRATE'),
            'cpi': self.get_indicator('CPIAUCSL')
        }
        return indicators
```

---

## Tier 2: Sentiment Data Sources

### News Sentiment

| Source | Type | Coverage | Integration |
|--------|------|----------|-------------|
| **Finnhub News** | Financial news | Major outlets | REST API |
| **NewsAPI** | General news | 80,000+ sources | REST API |
| **Benzinga** | Market-focused | Real-time alerts | Premium |

### Social Sentiment

| Source | Type | Volume | Latency |
|--------|------|--------|---------|
| **StockTwits** | Retail sentiment | High volume | Real-time |
| **Reddit (PRAW)** | Community analysis | r/wallstreetbets, r/stocks | Near real-time |
| **Twitter/X API** | Broad sentiment | Cashtags ($AAPL) | Real-time |

### Alternative Data

| Source | Data Type | Unique Value |
|--------|-----------|--------------|
| **SEC EDGAR** | Insider transactions | Form 4 filings |
| **Quiver Quantitative** | Congress trades, lobbying | Political alpha |
| **Unusual Whales** | Options flow | Smart money tracking |

---

## Tier 3: Aggregation Layer

### OpenBB Platform (Recommended Aggregator)

**Why OpenBB:**
- 100+ data providers unified
- Open source, MIT licensed
- Python-native integration
- Community-maintained extensions

**Installation:**
```bash
pip install openbb
```

**Unified Access:**
```python
from openbb import obb

class UnifiedDataCollector:
    def __init__(self):
        # Configure providers
        obb.user.preferences.output_type = "dataframe"

    def get_stock_data(self, symbol: str, provider: str = "fmp"):
        return obb.equity.price.historical(symbol, provider=provider)

    def get_options_chain(self, symbol: str):
        return obb.derivatives.options.chains(symbol)

    def get_news(self, symbols: list):
        return obb.news.company(symbols)
```

---

## Data Quality Framework

### Validation Pipeline

```python
from dataclasses import dataclass
from typing import Optional
import pandas as pd

@dataclass
class DataQualityMetrics:
    completeness: float  # % non-null values
    freshness: float     # seconds since last update
    accuracy: float      # % within expected range
    consistency: float   # % matching cross-source

class DataValidator:
    def __init__(self):
        self.quality_threshold = 0.95

    def validate_ohlcv(self, df: pd.DataFrame) -> DataQualityMetrics:
        # Completeness check
        completeness = 1 - (df.isnull().sum().sum() / df.size)

        # Range validation
        valid_prices = (df['high'] >= df['low']).all()
        valid_volume = (df['volume'] >= 0).all()
        accuracy = 1.0 if valid_prices and valid_volume else 0.5

        return DataQualityMetrics(
            completeness=completeness,
            freshness=0,  # Calculate based on timestamp
            accuracy=accuracy,
            consistency=1.0  # Cross-validate with second source
        )
```

### Cross-Source Validation

```python
class CrossSourceValidator:
    def __init__(self, primary_source, secondary_source):
        self.primary = primary_source
        self.secondary = secondary_source

    def validate_price(self, symbol: str, tolerance: float = 0.01) -> bool:
        """Validate price within 1% tolerance across sources"""
        primary_price = self.primary.get_quote(symbol)['c']
        secondary_price = self.secondary.get_quote(symbol)['c']

        diff = abs(primary_price - secondary_price) / primary_price
        return diff <= tolerance
```

---

## Rate Limit Management

### Intelligent Request Scheduler

```python
import asyncio
from collections import defaultdict
import time

class RateLimitManager:
    def __init__(self):
        self.limits = {
            'finnhub': {'calls': 60, 'period': 60},
            'alpha_vantage': {'calls': 5, 'period': 60},
            'polygon': {'calls': 5, 'period': 60},
            'fred': {'calls': float('inf'), 'period': 1}
        }
        self.call_history = defaultdict(list)

    async def wait_if_needed(self, provider: str):
        limit = self.limits[provider]
        history = self.call_history[provider]

        # Clean old entries
        current_time = time.time()
        history[:] = [t for t in history if current_time - t < limit['period']]

        # Wait if at limit
        if len(history) >= limit['calls']:
            wait_time = limit['period'] - (current_time - history[0])
            await asyncio.sleep(wait_time)

        history.append(time.time())

    async def execute_with_limit(self, provider: str, func, *args):
        await self.wait_if_needed(provider)
        return await func(*args)
```

---

## Recommended Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Data Orchestrator           │
                    │    (Rate Limit + Quality Control)   │
                    └───────────────┬─────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Finnhub     │         │ Alpha Vantage │         │     FRED      │
│  (Real-time)  │         │ (Historical)  │         │  (Economic)   │
│   60/min      │         │   5/min       │         │   Unlimited   │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │       Data Quality Layer        │
                    │  (Validation + Normalization)   │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │        Unified Data Store       │
                    │   (TimescaleDB / InfluxDB)      │
                    └─────────────────────────────────┘
```

---

## Cost Analysis

### Free Tier Capabilities

| Provider | Free Tier | Sufficient For |
|----------|-----------|----------------|
| Finnhub | 60 calls/min | 100 symbols, 1-min refresh |
| Alpha Vantage | 5 calls/min | Daily historical, 25 symbols |
| FRED | Unlimited | All economic indicators |
| Yahoo Finance | Unlimited | Backup data source |
| OpenBB | Open source | Aggregation layer |

### Premium Upgrades (When Needed)

| Provider | Premium Cost | Benefit |
|----------|--------------|---------|
| Polygon.io | $29/mo | Unlimited real-time |
| Finnhub Premium | $50/mo | 300 calls/min |
| Alpha Vantage Premium | $50/mo | 75 calls/min |

**Recommendation:** Start with free tiers. Upgrade to Polygon.io first when scaling beyond 100 symbols.

---

## Implementation Priority

### Phase 1 (Week 1-2)
1. Set up Finnhub for real-time quotes
2. Configure Alpha Vantage for historical data
3. Implement FRED for economic indicators
4. Build rate limit manager

### Phase 2 (Week 3-4)
1. Add OpenBB aggregation layer
2. Implement data quality validation
3. Set up TimescaleDB for storage
4. Cross-source validation

### Phase 3 (Month 2)
1. Add sentiment data sources
2. Implement WebSocket streaming
3. Build caching layer (Redis)
4. Performance optimization

---

## Key Metrics Summary

| Metric | Value | Source |
|--------|-------|--------|
| Real-time latency | <100ms | Finnhub WebSocket |
| Historical depth | 20+ years | Alpha Vantage |
| Economic indicators | 800,000+ | FRED |
| Provider coverage | 100+ | OpenBB |
| Free tier symbols | 100+ | Combined stack |

---

*Document 1 of 7 - Market Prediction God Agent Final Synthesis*
