# Financial Data APIs - Comprehensive Research Report

**Research Agent #1 of 10 | Market Prediction System**
**Date:** January 2026
**Purpose:** Identify and evaluate all viable open-source/free financial data APIs for market prediction system integration.

---

## Executive Summary

After extensive research across 15+ financial data APIs, the following three are recommended as the **top choices** for a market prediction system:

### Top 3 Recommendations

| Rank | API | Best For | Why |
|------|-----|----------|-----|
| **1** | **Finnhub** | General-purpose market data | Most generous free tier (60 calls/min), broad data coverage (stocks, forex, crypto, fundamentals, alternative data, sentiment), excellent reliability |
| **2** | **Alpha Vantage** | Historical data & technical analysis | 25 API requests/day free, 20+ years historical data, 50+ technical indicators, covers stocks/forex/crypto, extensive documentation |
| **3** | **Alpaca Markets** | Real-time streaming & trading | Free real-time WebSocket streaming, 7+ years historical data, 10,000 calls/min, paper trading included, commission-free trading API |

**Honorable Mentions:**
- **FRED** - Best for economic/macro indicators (completely free, unlimited)
- **CoinGecko** - Best for cryptocurrency data (30 calls/min free demo)
- **OpenBB Platform** - Best for aggregating multiple sources (open-source, free)

---

## Comprehensive API Comparison Table

### Overall Ratings (1-10 Scale)

| API | Data Coverage | Historical Depth | Rate Limits | Ease of Use | Reliability | Documentation | **Overall** |
|-----|---------------|------------------|-------------|-------------|-------------|---------------|-------------|
| **Finnhub** | 9 | 6 | 10 | 9 | 9 | 9 | **8.7** |
| **Alpha Vantage** | 8 | 9 | 5 | 9 | 8 | 9 | **8.0** |
| **Alpaca Markets** | 7 | 7 | 10 | 8 | 9 | 9 | **8.3** |
| **Twelve Data** | 8 | 8 | 5 | 9 | 8 | 9 | **7.8** |
| **Polygon.io** | 6 | 8 | 4 | 8 | 9 | 8 | **7.2** |
| **FRED** | 5 | 10 | 10 | 9 | 10 | 9 | **8.8** |
| **CoinGecko** | 6 | 7 | 6 | 9 | 8 | 8 | **7.3** |
| **Tiingo** | 7 | 9 | 6 | 8 | 8 | 8 | **7.7** |
| **Financial Modeling Prep** | 8 | 9 | 6 | 8 | 6 | 7 | **7.3** |
| **EODHD** | 8 | 9 | 3 | 7 | 8 | 7 | **7.0** |
| **Nasdaq Data Link** | 6 | 8 | 8 | 7 | 8 | 7 | **7.3** |
| **Marketstack** | 7 | 6 | 2 | 8 | 7 | 7 | **6.2** |
| **yfinance** | 8 | 9 | N/A | 10 | 4 | 6 | **6.2** |
| **OpenBB** | 10 | Varies | Varies | 7 | 7 | 8 | **7.5** |

---

## Detailed API Profiles

### 1. Finnhub

**Official URL:** https://finnhub.io/

**Overview:**
Finnhub provides institutional-grade financial data with the most generous free tier available. It offers comprehensive coverage across multiple asset classes and alternative data sources.

**Asset Classes:**
- Stocks (US & International)
- Forex
- Cryptocurrency (15+ exchanges)
- ETFs
- Indices
- Bonds

**Data Types:**
- Real-time quotes (15-min delay on free)
- OHLCV historical data
- Company fundamentals
- Earnings estimates
- News & sentiment
- Insider transactions
- Congressional trading
- Alternative data (social sentiment)

**Free Tier Specifications:**
- **Rate Limit:** 60 calls/minute
- **Historical Depth:** ~1 year per API call (more with lower resolution)
- **Real-time:** 15-minute delayed
- **Authentication:** API key (free registration)

**Limitations:**
- "Financials As Reported" not available on free tier
- Limited historical depth compared to some alternatives
- Some endpoints restricted to paid plans

**Python Library:** `finnhub-python` (official)

```python
import finnhub

# Setup client
finnhub_client = finnhub.Client(api_key="YOUR_API_KEY")

# Get stock quote
quote = finnhub_client.quote('AAPL')
print(f"Current price: ${quote['c']}")

# Get company profile
profile = finnhub_client.company_profile2(symbol='AAPL')

# Get stock candles (OHLCV)
import time
candles = finnhub_client.stock_candles('AAPL', 'D',
    int(time.time()) - 86400*365,
    int(time.time()))

# Get market news
news = finnhub_client.general_news('general', min_id=0)

# Get sentiment
sentiment = finnhub_client.news_sentiment('AAPL')
```

**Sources:**
- [Finnhub Documentation](https://finnhub.io/docs/api/rate-limit)
- [Finnhub Pricing](https://finnhub.io/pricing-stock-api-market-data)

---

### 2. Alpha Vantage

**Official URL:** https://www.alphavantage.co/

**Overview:**
Alpha Vantage is a well-established free financial data API widely used in financial analytics applications. It offers extensive historical data and 50+ technical indicators.

**Asset Classes:**
- Stocks (200,000+ tickers across 20+ exchanges)
- ETFs
- Mutual Funds
- Forex
- Cryptocurrency
- Commodities

**Data Types:**
- OHLCV (intraday, daily, weekly, monthly)
- Adjusted prices (splits/dividends)
- 50+ technical indicators
- Fundamental data (income statements, balance sheets)
- Earnings data
- Economic indicators

**Free Tier Specifications:**
- **Rate Limit:** 25 requests/day, 5 requests/minute
- **Historical Depth:** 20+ years for most data
- **Real-time:** Available (some datasets)
- **Authentication:** API key (free registration)
- **Data Format:** JSON, CSV

**Limitations:**
- Very restrictive daily limit (25/day)
- Real-time US market data requires premium
- Some advanced features premium-only

**Python Library:** `alpha_vantage` (official)

```python
from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.techindicators import TechIndicators

# Initialize
ts = TimeSeries(key='YOUR_API_KEY', output_format='pandas')
ti = TechIndicators(key='YOUR_API_KEY', output_format='pandas')

# Get daily prices (full history)
data, meta = ts.get_daily(symbol='AAPL', outputsize='full')
print(data.head())

# Get intraday data
intraday, meta = ts.get_intraday(symbol='AAPL',
                                  interval='5min',
                                  outputsize='full')

# Get RSI indicator
rsi, meta = ti.get_rsi(symbol='AAPL',
                        interval='daily',
                        time_period=14)

# Get MACD
macd, meta = ti.get_macd(symbol='AAPL',
                          interval='daily')
```

**Sources:**
- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)
- [Alpha Vantage Pricing](https://www.alphavantage.co/premium/)

---

### 3. Alpaca Markets

**Official URL:** https://alpaca.markets/

**Overview:**
Alpaca provides a developer-first API for both market data and trading. The free tier includes real-time WebSocket streaming and paper trading capabilities.

**Asset Classes:**
- US Stocks (all major exchanges)
- Options
- Cryptocurrency

**Data Types:**
- Real-time quotes & trades (IEX feed free)
- OHLCV bars (1min to monthly)
- Trade & quote history
- Corporate actions

**Free Tier Specifications:**
- **Rate Limit:** 10,000 API calls/minute
- **Historical Depth:** 7+ years
- **Real-time:** Yes (IEX feed, WebSocket streaming)
- **Authentication:** API key pair
- **Paper Trading:** Included free

**Limitations:**
- Free tier limited to IEX exchange data
- Full SIP feed requires paid subscription
- US stocks only (no international)

**Python Library:** `alpaca-py` (official)

```python
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta

# Initialize client (no keys needed for some data)
client = StockHistoricalDataClient(
    api_key="YOUR_API_KEY",
    secret_key="YOUR_SECRET_KEY"
)

# Get historical bars
request_params = StockBarsRequest(
    symbol_or_symbols=["AAPL", "MSFT"],
    timeframe=TimeFrame.Day,
    start=datetime.now() - timedelta(days=365),
    end=datetime.now()
)
bars = client.get_stock_bars(request_params)
df = bars.df
print(df.head())

# WebSocket streaming example
from alpaca.data.live import StockDataStream

stream = StockDataStream("YOUR_API_KEY", "YOUR_SECRET_KEY")

async def quote_handler(quote):
    print(f"{quote.symbol}: ${quote.ask_price}")

stream.subscribe_quotes(quote_handler, "AAPL")
stream.run()
```

**Sources:**
- [Alpaca Documentation](https://docs.alpaca.markets/)
- [Alpaca Data API](https://alpaca.markets/data)

---

### 4. Twelve Data

**Official URL:** https://twelvedata.com/

**Overview:**
Twelve Data offers comprehensive market data with global coverage across 90+ stock exchanges and 180+ crypto exchanges. Known for clean API responses and excellent documentation.

**Asset Classes:**
- Stocks (US & International - 90+ exchanges)
- Forex
- Cryptocurrency (180+ exchanges)
- ETFs
- Indices
- Funds

**Data Types:**
- Real-time & historical OHLCV
- 100+ technical indicators
- Fundamental data
- Earnings & dividends
- WebSocket streaming

**Free Tier Specifications:**
- **Rate Limit:** 8 calls/minute, 800/day
- **Historical Depth:** Several years (varies by plan)
- **Real-time:** Delayed on free tier
- **Authentication:** API key
- **Batch Calls:** Up to 120 symbols per request

**Limitations:**
- International markets require paid subscription
- Lower rate limit compared to Finnhub
- Free tier has delayed data

**Python Library:** `twelvedata` (official)

```python
from twelvedata import TDClient

# Initialize client
td = TDClient(apikey="YOUR_API_KEY")

# Get time series
ts = td.time_series(
    symbol="AAPL",
    interval="1day",
    outputsize=365,
    timezone="America/New_York"
)
df = ts.as_pandas()
print(df.head())

# Get technical indicator
rsi = td.rsi(
    symbol="AAPL",
    interval="1day",
    time_period=14
).as_pandas()

# Batch request
batch = td.time_series(
    symbol=["AAPL", "MSFT", "GOOGL"],
    interval="1day",
    outputsize=30
).as_pandas()
```

**Sources:**
- [Twelve Data Pricing](https://twelvedata.com/pricing)
- [Twelve Data Python SDK](https://github.com/twelvedata/twelvedata-python)

---

### 5. FRED (Federal Reserve Economic Data)

**Official URL:** https://fred.stlouisfed.org/

**Overview:**
FRED provides free access to over 800,000 economic data series from 100+ sources. Essential for macroeconomic indicators and economic analysis.

**Data Types:**
- GDP & economic growth
- Employment statistics
- Interest rates (Fed Funds, Treasury yields)
- Inflation indicators (CPI, PCE)
- Money supply
- Housing data
- International economic data
- Financial market indices

**Free Tier Specifications:**
- **Rate Limit:** Unlimited (reasonable use)
- **Historical Depth:** Decades of data (varies by series)
- **Real-time:** Updated as released
- **Authentication:** API key (free)
- **Cost:** Completely FREE

**Python Library:** `fredapi`

```python
from fredapi import Fred

# Initialize client
fred = Fred(api_key='YOUR_API_KEY')

# Get GDP data
gdp = fred.get_series('GDP')
print(gdp.tail())

# Get unemployment rate
unemployment = fred.get_series('UNRATE')

# Get 10-year Treasury yield
treasury_10y = fred.get_series('DGS10')

# Get CPI inflation
cpi = fred.get_series('CPIAUCSL')

# Search for series
results = fred.search('inflation')
print(results.head())

# Get series info
info = fred.get_series_info('GDP')
```

**Sources:**
- [FRED API Documentation](https://fred.stlouisfed.org/docs/api/fred/)
- [fredapi PyPI](https://pypi.org/project/fredapi/)

---

### 6. CoinGecko

**Official URL:** https://www.coingecko.com/en/api

**Overview:**
CoinGecko is the leading cryptocurrency data aggregator, tracking 14,000+ coins across 900+ exchanges.

**Asset Classes:**
- Cryptocurrency (14,000+ coins)
- NFTs
- DeFi protocols

**Data Types:**
- Price data (real-time & historical)
- Market cap & volume
- Exchange data
- Trending coins
- Global market data
- OHLCV candles

**Free Tier Specifications:**
- **Public API:** 5-15 calls/minute (no registration)
- **Demo Plan:** 30 calls/minute, 10,000/month (free registration)
- **Historical Depth:** Years of data
- **Real-time:** Yes (with rate limits)

**Python Library:** `pycoingecko`

```python
from pycoingecko import CoinGeckoAPI

cg = CoinGeckoAPI()

# Get Bitcoin price
bitcoin = cg.get_price(ids='bitcoin', vs_currencies='usd')
print(f"Bitcoin: ${bitcoin['bitcoin']['usd']}")

# Get market data for multiple coins
markets = cg.get_coins_markets(
    vs_currency='usd',
    order='market_cap_desc',
    per_page=10,
    page=1
)

# Get OHLC data
ohlc = cg.get_coin_ohlc_by_id(
    id='bitcoin',
    vs_currency='usd',
    days=30
)

# Get historical data
history = cg.get_coin_market_chart_by_id(
    id='bitcoin',
    vs_currency='usd',
    days=365
)
```

**Sources:**
- [CoinGecko API Pricing](https://www.coingecko.com/en/api/pricing)
- [CoinGecko API Documentation](https://docs.coingecko.com/)

---

### 7. Tiingo

**Official URL:** https://www.tiingo.com/

**Overview:**
Tiingo offers high-quality financial data with a generous free tier. Known for clean data and extensive historical coverage (30+ years for stocks).

**Asset Classes:**
- US Stocks & ETFs
- Mutual Funds
- China Stocks
- Cryptocurrency

**Data Types:**
- End-of-day prices
- Intraday data
- Fundamental data (5 years free)
- News feeds

**Free Tier Specifications:**
- **Rate Limit:** 50 symbols/hour
- **Historical Depth:** 30+ years (EOD), 5 years (fundamentals)
- **Real-time:** Not on free tier
- **Authentication:** API key

**Python Library:** `tiingo`

```python
from tiingo import TiingoClient

config = {'api_key': 'YOUR_API_KEY'}
client = TiingoClient(config)

# Get historical prices
historical = client.get_ticker_price(
    "AAPL",
    startDate='2020-01-01',
    endDate='2024-01-01',
    frequency='daily'
)

# Get metadata
meta = client.get_ticker_metadata("AAPL")

# Get crypto data
crypto = client.get_crypto_price_history(
    tickers=['btcusd'],
    startDate='2023-01-01',
    resampleFreq='1day'
)
```

**Sources:**
- [Tiingo Pricing](https://www.tiingo.com/about/pricing)
- [Tiingo Python Client](https://github.com/hydrosquall/tiingo-python)

---

### 8. Financial Modeling Prep (FMP)

**Official URL:** https://financialmodelingprep.com/

**Overview:**
FMP provides comprehensive fundamental data with 30+ years of history across 70,000+ securities in 46 countries.

**Asset Classes:**
- Stocks (70,000+ global)
- ETFs
- Mutual Funds
- Forex
- Cryptocurrency
- Commodities

**Data Types:**
- OHLCV prices
- Financial statements (income, balance sheet, cash flow)
- Key metrics & ratios
- Earnings transcripts
- SEC filings
- News

**Free Tier Specifications:**
- **Rate Limit:** 250 requests/day
- **Bandwidth:** 500MB/30 days
- **Historical Depth:** 30+ years
- **Authentication:** API key

**Limitations:**
- Mixed user reviews on data quality
- Support issues reported
- Some documentation unclear on plan inclusions

**Python Example:**

```python
import requests

API_KEY = 'YOUR_API_KEY'
BASE_URL = 'https://financialmodelingprep.com/api/v3'

# Get stock quote
def get_quote(symbol):
    url = f"{BASE_URL}/quote/{symbol}?apikey={API_KEY}"
    return requests.get(url).json()

# Get income statement
def get_income_statement(symbol):
    url = f"{BASE_URL}/income-statement/{symbol}?limit=5&apikey={API_KEY}"
    return requests.get(url).json()

# Get historical prices
def get_historical_prices(symbol):
    url = f"{BASE_URL}/historical-price-full/{symbol}?apikey={API_KEY}"
    return requests.get(url).json()

quote = get_quote('AAPL')
print(f"AAPL Price: ${quote[0]['price']}")
```

**Sources:**
- [FMP Pricing](https://site.financialmodelingprep.com/pricing-plans)
- [FMP Documentation](https://site.financialmodelingprep.com/developer/docs)

---

### 9. Polygon.io (Now Massive)

**Official URL:** https://polygon.io/ (redirects to massive.com)

**Overview:**
Polygon provides institutional-quality market data with WebSocket streaming. Recently rebranded to Massive. Known for low latency (<20ms) real-time data.

**Asset Classes:**
- US Stocks (exclusively)

**Data Types:**
- Real-time trades & quotes
- OHLCV aggregates
- Reference data
- Market holidays

**Free Tier Specifications:**
- **Rate Limit:** 5 requests/minute
- **Historical Depth:** End-of-day + historical
- **Real-time:** Not on free tier
- **Authentication:** API key

**Limitations:**
- US stocks only (no forex, crypto, international)
- Very restrictive free tier
- Premium features require paid plans

**Python Example:**

```python
from polygon import RESTClient

client = RESTClient(api_key="YOUR_API_KEY")

# Get aggregates (OHLCV)
aggs = client.get_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",
    from_="2023-01-01",
    to="2024-01-01"
)

for bar in aggs:
    print(f"{bar.timestamp}: O={bar.open} H={bar.high} L={bar.low} C={bar.close}")

# Get ticker details
details = client.get_ticker_details("AAPL")
```

**Sources:**
- [Polygon Rate Limits](https://polygon.io/knowledge-base/article/what-is-the-request-limit-for-polygons-restful-apis)
- [Polygon Review](https://medium.com/@yolotrading/a-complete-review-of-the-polygon-io-api-everything-you-wanted-to-know-c79e992a74ff)

---

### 10. EODHD (EOD Historical Data)

**Official URL:** https://eodhd.com/

**Overview:**
EODHD provides extensive historical data (30+ years) for global markets with coverage of 150,000+ tickers.

**Asset Classes:**
- Stocks (60+ global exchanges)
- ETFs
- Funds
- Forex
- Cryptocurrency

**Data Types:**
- End-of-day prices
- Intraday data
- Fundamental data
- Options data
- Technical indicators

**Free Tier Specifications:**
- **Rate Limit:** 20 API calls/day
- **Historical Depth:** 1 year only (free)
- **Tickers:** Limited to demo tickers (AAPL, TSLA, VTI, AMZN, BTC-USD, EURUSD)
- **Authentication:** API key

**Limitations:**
- Very restrictive free tier
- Full data requires paid subscription
- Demo limited to specific tickers

**Sources:**
- [EODHD Pricing](https://eodhd.com/pricing)
- [EODHD Documentation](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)

---

### 11. Nasdaq Data Link (Quandl)

**Official URL:** https://data.nasdaq.com/

**Overview:**
Formerly Quandl, now owned by Nasdaq. Provides 250+ datasets including 40 free ones covering economic and financial data.

**Data Types:**
- Economic data
- Financial market data
- Alternative data
- Commodities
- Real estate

**Free Tier Specifications:**
- **Rate Limit:** 300 calls/10 seconds, 50,000/day
- **Free Datasets:** 40 datasets
- **Historical Depth:** Varies by dataset
- **Data Format:** CSV, JSON, XML

**Note:** The previously popular WIKI free stock dataset has been discontinued.

**Python Library:** `nasdaq-data-link` (official)

```python
import nasdaqdatalink

nasdaqdatalink.ApiConfig.api_key = 'YOUR_API_KEY'

# Get FRED data through Nasdaq
gdp = nasdaqdatalink.get('FRED/GDP')

# Get commodity data
oil = nasdaqdatalink.get('OPEC/ORB')
```

**Sources:**
- [Nasdaq Data Link Documentation](https://docs.data.nasdaq.com/)
- [Nasdaq Data Link Catalog](https://data.nasdaq.com/search)

---

### 12. yfinance (Yahoo Finance)

**Official URL:** https://pypi.org/project/yfinance/

**Overview:**
yfinance is an unofficial Python library that scrapes Yahoo Finance. While feature-rich, it has significant reliability issues.

**Asset Classes:**
- Stocks (global)
- ETFs
- Mutual Funds
- Forex
- Cryptocurrency
- Options

**Data Types:**
- OHLCV prices
- Fundamentals
- Options chains
- Earnings
- Dividends & splits

**Free Tier Specifications:**
- **Rate Limit:** Unofficial (subject to blocking)
- **Historical Depth:** 20+ years
- **Cost:** Free (unofficial)
- **Authentication:** None required

**CRITICAL LIMITATIONS:**
- **NOT RELIABLE** for production use
- Frequently blocked by Yahoo (429 errors)
- API changes can break functionality without warning
- February 2025: Major breakage due to Yahoo API changes
- No official support

**Python Example:**

```python
import yfinance as yf

# Get stock data
ticker = yf.Ticker("AAPL")

# Historical data
hist = ticker.history(period="max")
print(hist.head())

# Fundamentals
info = ticker.info
print(f"Market Cap: {info.get('marketCap')}")

# Options
options = ticker.options  # expiration dates
opt_chain = ticker.option_chain(options[0])

# Multiple tickers
data = yf.download(["AAPL", "MSFT", "GOOGL"],
                   start="2020-01-01",
                   end="2024-01-01")
```

**Recommendation:** Use only for prototyping/learning. NOT suitable for production systems.

**Sources:**
- [yfinance GitHub Issues](https://github.com/ranaroussi/yfinance/issues)
- [Why yfinance Keeps Getting Blocked](https://medium.com/@trading.dude/why-yfinance-keeps-getting-blocked-and-what-to-use-instead-92d84bb2cc01)

---

### 13. OpenBB Platform

**Official URL:** https://openbb.co/

**Overview:**
OpenBB is an open-source financial data aggregation platform that connects to 100+ data providers through a unified interface.

**Key Features:**
- 350+ financial datasets
- Connects to multiple providers (Alpha Vantage, Polygon, Yahoo, etc.)
- REST API included
- Choose your data source
- 31,000+ GitHub stars

**Free Tier Specifications:**
- **Platform:** Completely free & open-source
- **Data Costs:** Depends on underlying providers
- **Default Provider:** Yahoo Finance (free, no API key)

**Python Example:**

```python
from openbb import obb

# Get historical prices (uses Yahoo by default)
output = obb.equity.price.historical("AAPL")
df = output.to_dataframe()
print(df.head())

# Specify different provider
output = obb.equity.price.historical("AAPL", provider="alpha_vantage")

# Get fundamentals
fundamentals = obb.equity.fundamental.income("AAPL")

# Get economic data
gdp = obb.economy.gdp.nominal()
```

**Sources:**
- [OpenBB GitHub](https://github.com/OpenBB-finance/OpenBB)
- [OpenBB Documentation](https://docs.openbb.co/)

---

### 14. Marketstack

**Official URL:** https://marketstack.com/

**Overview:**
Marketstack provides stock market data for 30,000+ tickers across 70+ global exchanges.

**Free Tier Specifications:**
- **Rate Limit:** 100 requests/month
- **Historical Depth:** 12 months
- **Data Type:** End-of-day only
- **No Support** on free tier

**Limitations:**
- Extremely limited (100 requests/month)
- No intraday data on free tier
- No real-time data on free tier

**Sources:**
- [Marketstack Pricing](https://marketstack.com/pricing)

---

## Discontinued/Changed APIs

### IEX Cloud (SHUTDOWN - August 31, 2024)

IEX Cloud retired all API products on August 31, 2024. Former users are directed to Intrinio or can migrate to alternatives like Alpha Vantage.

**Sources:**
- [IEX Cloud Shutdown Notice](https://iexcloud.org/)
- [IEX Migration Guide](https://www.alphavantage.co/iexcloud_shutdown_analysis_and_migration/)

---

## Integration Architecture Recommendation

For a comprehensive market prediction system, I recommend a **multi-API architecture** that leverages the strengths of different providers:

### Recommended Stack

```
+------------------+     +------------------+     +------------------+
|    FINNHUB       |     |  ALPHA VANTAGE   |     |     ALPACA       |
| (Primary Stocks) |     | (Tech Indicators)|     | (Real-time/Trade)|
+------------------+     +------------------+     +------------------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                    +-------------+-------------+
                    |                           |
              +-----+-----+              +------+------+
              |   FRED    |              |  COINGECKO  |
              | (Economic)|              |   (Crypto)  |
              +-----------+              +-------------+
                    |                           |
                    +-------------+-------------+
                                  |
                         +--------+--------+
                         |     OpenBB      |
                         | (Aggregation)   |
                         +-----------------+
```

### Data Flow by Use Case

| Use Case | Primary API | Fallback | Rate Strategy |
|----------|-------------|----------|---------------|
| Stock Quotes | Finnhub | Alpha Vantage | Cache 1 min |
| Historical OHLCV | Alpha Vantage | Tiingo | Cache 24 hrs |
| Technical Indicators | Alpha Vantage | Twelve Data | Cache 5 min |
| Real-time Streaming | Alpaca | Finnhub WS | Live |
| Economic Indicators | FRED | Nasdaq Data Link | Cache 1 day |
| Cryptocurrency | CoinGecko | Finnhub | Cache 1 min |
| Fundamentals | Finnhub | FMP | Cache 1 week |
| News/Sentiment | Finnhub | Alpha Vantage | Cache 15 min |

### Rate Limit Management

```python
# Example rate limit management
API_LIMITS = {
    'finnhub': {'calls_per_min': 60, 'daily': float('inf')},
    'alpha_vantage': {'calls_per_min': 5, 'daily': 25},
    'alpaca': {'calls_per_min': 10000, 'daily': float('inf')},
    'fred': {'calls_per_min': float('inf'), 'daily': float('inf')},
    'coingecko': {'calls_per_min': 30, 'monthly': 10000},
    'twelve_data': {'calls_per_min': 8, 'daily': 800},
}

# Priority order for failover
PROVIDER_PRIORITY = {
    'stocks': ['finnhub', 'alpha_vantage', 'tiingo', 'yfinance'],
    'crypto': ['coingecko', 'finnhub', 'alpha_vantage'],
    'forex': ['finnhub', 'alpha_vantage', 'twelve_data'],
    'economic': ['fred', 'nasdaq_data_link'],
}
```

---

## Quick Reference: Free Tier Limits Summary

| API | Calls/Minute | Calls/Day | Historical Depth | Real-time |
|-----|--------------|-----------|------------------|-----------|
| Finnhub | 60 | Unlimited | ~1 year | 15-min delay |
| Alpha Vantage | 5 | 25 | 20+ years | Some endpoints |
| Alpaca | 10,000 | Unlimited | 7+ years | Yes (IEX) |
| Twelve Data | 8 | 800 | Years | Delayed |
| Polygon.io | 5 | Unlimited | EOD + history | No |
| FRED | Unlimited | Unlimited | Decades | N/A |
| CoinGecko Demo | 30 | ~333 | Years | Yes |
| Tiingo | ~0.8/min | 50 symbols/hr | 30+ years | No |
| FMP | ~0.2/min | 250 | 30+ years | No |
| EODHD | ~0.01/min | 20 | 1 year | No |
| Marketstack | 0.002/min | ~3 | 12 months | No |

---

## Memory Storage Keys

For subsequent agents in the workflow, the following memory keys contain this research:

- **Key:** `research/data/apis` - Complete API comparison (this document)
- **Key:** `research/data/best-apis` - Top recommendations summary

### Best APIs Summary (for quick reference)

```json
{
  "top_3_apis": {
    "1": {
      "name": "Finnhub",
      "url": "https://finnhub.io/",
      "free_rate": "60/min",
      "best_for": "General-purpose market data, sentiment, alternative data"
    },
    "2": {
      "name": "Alpha Vantage",
      "url": "https://www.alphavantage.co/",
      "free_rate": "25/day",
      "best_for": "Historical data, technical indicators"
    },
    "3": {
      "name": "Alpaca Markets",
      "url": "https://alpaca.markets/",
      "free_rate": "10000/min",
      "best_for": "Real-time streaming, paper trading"
    }
  },
  "specialized_apis": {
    "economic": "FRED (free, unlimited)",
    "crypto": "CoinGecko (30/min demo)",
    "aggregation": "OpenBB (open-source)"
  },
  "avoid": {
    "yfinance": "Unreliable, frequently blocked",
    "IEX_Cloud": "Shutdown August 2024",
    "Marketstack_free": "Only 100 requests/month"
  }
}
```

---

## Document Information

**File Location:** `/Volumes/Externalwork/projects/claudeflow-testing/research/data-sources/api-comparison.md`

**Research Sources:**
- [Alpha Vantage](https://www.alphavantage.co/)
- [Finnhub](https://finnhub.io/)
- [Alpaca Markets](https://alpaca.markets/)
- [Twelve Data](https://twelvedata.com/)
- [FRED](https://fred.stlouisfed.org/)
- [CoinGecko](https://www.coingecko.com/en/api)
- [Tiingo](https://www.tiingo.com/)
- [Financial Modeling Prep](https://site.financialmodelingprep.com/)
- [Polygon.io](https://polygon.io/)
- [EODHD](https://eodhd.com/)
- [Nasdaq Data Link](https://data.nasdaq.com/)
- [OpenBB](https://openbb.co/)
- [Marketstack](https://marketstack.com/)

**Next Agents Should:**
1. Retrieve this document for API integration decisions
2. Use the rate limit table for request scheduling
3. Reference code examples for implementation
4. Follow the recommended multi-API architecture
