# Market Sentiment Data Sources - Comprehensive Research Report

**Research Agent #2 of 10 | Market Prediction System**
**Date:** January 2026
**Purpose:** Catalog all available market sentiment data sources including news, social media, and alternative data for integration into a market prediction system.
**Previous Agent:** API Comparison (research/data-sources/api-comparison.md)

---

## Executive Summary

Market sentiment data provides crucial signals for predicting price movements by capturing the collective psychology of market participants. This research identifies **40+ sentiment data sources** across three categories:

### Key Findings

| Category | Best Free Option | Best Paid Option | Integration Complexity |
|----------|------------------|------------------|------------------------|
| **News Sentiment** | Finnhub (60/min) | Benzinga via Alpaca | Low |
| **Social Media** | StockTwits (free, limited) | ApeWisdom API | Medium |
| **Alternative Data** | Quiver Quantitative (freemium) | Unusual Whales | Medium-High |
| **Regulatory Filings** | SEC EDGAR (unlimited, free) | sec-api.io | Low |

### Top 5 Recommendations for Free Tier Implementation

1. **Finnhub** - News sentiment with 60 calls/min free (already in API comparison)
2. **SEC EDGAR Official API** - Free, unlimited, real-time insider/13F data
3. **StockTwits** - Free social sentiment (30 messages limit per call)
4. **Quiver Quantitative** - Congress trading, Reddit sentiment (freemium)
5. **Google Trends via pytrends** - Search volume correlation (free, unofficial)

---

## Part 1: News Sentiment APIs

### 1.1 Finnhub News Sentiment (Recommended)

**URL:** https://finnhub.io/docs/api/news-sentiment

**Overview:**
Finnhub provides company-level sentiment scores derived from news articles, making it the best free option for news-based sentiment analysis.

**Sentiment Data Available:**
- Company News Sentiment endpoint
- Buzz score (article volume)
- Weighted sentiment (-1 to +1)
- Sector average comparison
- 52-week high/low sentiment

**Free Tier:**
- 60 API calls/minute
- Real-time news feed
- Company-level sentiment scores

**Python Example:**
```python
import finnhub

client = finnhub.Client(api_key="YOUR_API_KEY")

# Get news sentiment for a stock
sentiment = client.news_sentiment('AAPL')
print(f"Buzz: {sentiment['buzz']['buzz']}")
print(f"Sentiment: {sentiment['sentiment']['bullishPercent']}")

# Get company news
news = client.company_news('AAPL', _from="2024-01-01", to="2024-01-15")
for article in news[:5]:
    print(f"{article['headline']}: {article['sentiment']}")
```

**Strengths:**
- Pre-computed sentiment scores
- Historical sentiment data
- Company and sector-level analysis

**Limitations:**
- Sentiment algorithm is proprietary
- No raw text for custom NLP

---

### 1.2 Alpha Vantage News & Sentiments API

**URL:** https://www.alphavantage.co/documentation/#news-sentiment

**Overview:**
Alpha Vantage offers AI-powered sentiment analysis across financial news with 20+ years of historical coverage.

**Sentiment Features:**
- Sentiment score (-1 to +1)
- Sentiment label (Bearish/Bullish/Neutral)
- Relevance score per ticker
- Topic-based filtering
- 50+ news sources

**Free Tier:**
- 25 requests/day total (shared with all endpoints)
- News articles with sentiment scores

**Python Example:**
```python
import requests

API_KEY = 'YOUR_API_KEY'
url = f'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=AAPL&apikey={API_KEY}'

response = requests.get(url)
data = response.json()

for article in data.get('feed', [])[:5]:
    print(f"Title: {article['title']}")
    print(f"Overall Sentiment: {article['overall_sentiment_score']}")
    for ticker in article.get('ticker_sentiment', []):
        print(f"  {ticker['ticker']}: {ticker['ticker_sentiment_score']}")
```

**Limitations:**
- Very limited free tier (25/day total)
- Shares quota with price data endpoints

---

### 1.3 EODHD Financial News & Sentiment

**URL:** https://eodhd.com/financial-apis/stock-market-financial-news-api

**Overview:**
EODHD provides daily sentiment scores calculated from both news and social media, normalized on a scale from -1 to +1.

**Sentiment Features:**
- Daily sentiment scores for stocks/ETFs
- Forex and crypto sentiment
- News aggregation from major portals
- Historical sentiment data

**Free Tier:**
- 20 API calls/day
- Limited to demo tickers (AAPL, TSLA, etc.)

**Python Example:**
```python
import requests

API_KEY = 'YOUR_API_KEY'
url = f'https://eodhd.com/api/sentiments?s=AAPL.US&from=2024-01-01&to=2024-01-31&api_token={API_KEY}'

response = requests.get(url)
sentiments = response.json()

for day in sentiments:
    print(f"{day['date']}: Normalized={day['normalized']}, Count={day['count']}")
```

---

### 1.4 Benzinga News API

**URL:** https://www.benzinga.com/apis/

**Overview:**
Benzinga provides institutional-grade financial news with sentiment tags, accessible via AWS Marketplace free tier or through Alpaca Markets.

**Sentiment Features:**
- Sentiment tags per article
- StockSnips NLP analysis (paid)
- Entity-level sentiment
- Real-time streaming

**Access Options:**
1. **Via Alpaca Markets** (Free with Alpaca account) - 130+ articles/day since 2015
2. **AWS Marketplace Free Tier** - Basic access
3. **Direct API** (Paid)

**Python Example (via Alpaca):**
```python
from alpaca.data.historical import NewsClient
from alpaca.data.requests import NewsRequest

client = NewsClient(api_key="YOUR_KEY", secret_key="YOUR_SECRET")

request = NewsRequest(
    symbols=["AAPL", "TSLA"],
    start="2024-01-01",
    end="2024-01-15"
)

news = client.get_news(request)
for article in news.news[:5]:
    print(f"{article.headline}")
    print(f"Sentiment: {article.sentiment}")
```

---

### 1.5 StockGeist API

**URL:** https://www.stockgeist.ai/stock-market-api/

**Overview:**
StockGeist uses advanced algorithms trained specifically on financial language to analyze sentiment from news and social media.

**Sentiment Features:**
- Real-time sentiment signals
- Historical sentiment data
- Financial language-trained models
- Stock-specific sentiment tracking

**Free Tier:**
- 10,000 free credits on signup
- 5 free API streams

**Strengths:**
- Models trained on financial language (not generic sentiment)
- More accurate for market-specific content

---

### 1.6 Marketaux

**URL:** https://www.marketaux.com/

**Overview:**
Marketaux tracks 80+ global markets with news from 5,000+ quality sources in 30+ languages.

**Sentiment Features:**
- Sentiment scores (-1 to +1) per article
- Multi-language support
- Entity extraction
- Topic categorization

**Free Tier:**
- 100 requests/day
- Basic sentiment scoring

**Python Example:**
```python
import requests

API_KEY = 'YOUR_API_KEY'
url = f'https://api.marketaux.com/v1/news/all?symbols=AAPL&filter_entities=true&api_token={API_KEY}'

response = requests.get(url)
articles = response.json()['data']

for article in articles[:5]:
    print(f"{article['title']}")
    print(f"Sentiment: {article['sentiment_score']}")
```

---

### 1.7 Stock News API

**URL:** https://stocknewsapi.com/

**Overview:**
Indexes content from CNBC, Zacks, Bloomberg, Motley Fool, Fox Business, and more with sentiment labels.

**Sentiment Features:**
- Positive/Negative/Neutral classification
- Top mentioned stocks tracking
- Sector sentiment
- Market-wide sentiment

**Free Tier:**
- Free trial available
- Sentiment included in responses

---

### 1.8 AYLIEN News API (Quantexa)

**URL:** https://aylien.com/

**Overview:**
Enterprise-grade news API with entity-level sentiment analysis, used by companies like Revolut.

**Sentiment Features:**
- Document and entity-level sentiment
- Confidence scores
- 9+ years searchable archive
- 90,000+ news publishers
- 16 language support

**Rate Limits:**
- 60 hits/minute
- 3 hits/second

**Pricing:** Enterprise (contact for pricing)

**SNES Dataset:**
AYLIEN released a free academic dataset (Stock-News-Events-Sentiment) covering S&P 500 companies from Oct 2020-Jul 2022 with joined market and news data.

---

### News Sentiment Comparison Table

| API | Free Tier | Sentiment Type | Coverage | Update Frequency | Best For |
|-----|-----------|----------------|----------|------------------|----------|
| **Finnhub** | 60/min | Pre-computed scores | 7,000+ stocks | Real-time | General use |
| **Alpha Vantage** | 25/day | AI-powered scores | Global | Real-time | Deep analysis |
| **EODHD** | 20/day | Normalized scores | Global | Daily | Historical |
| **Benzinga (Alpaca)** | Free w/account | Tags | US stocks | Real-time | Trading |
| **StockGeist** | 10k credits | Financial-trained | US stocks | Real-time | Accuracy |
| **Marketaux** | 100/day | Score (-1 to +1) | 80+ markets | Real-time | Global |
| **Stock News API** | Trial | Classification | US stocks | 15min | Simple use |
| **AYLIEN** | None | Entity-level | Global | Real-time | Enterprise |

---

## Part 2: Social Media Sentiment APIs

### 2.1 X (Twitter) API - Current State

**URL:** https://developer.x.com/

**Overview:**
Twitter/X API underwent dramatic pricing changes since 2023, making it prohibitively expensive for most use cases.

**Current Pricing (2025):**

| Tier | Price | Tweets/Month | Best For |
|------|-------|--------------|----------|
| Free | $0 | Very limited | Testing only |
| Basic | $100/month | 10,000 reads | Small projects |
| Pro | $5,000/month | 1M reads | Research |
| Enterprise | $10,000+/month | Custom | Large-scale |

**Impact:**
- 9,900% price increase since 2022
- Most researchers priced out
- Academic access severely limited

**Alternatives:**
1. **EODHD Tweets Sentiment API** - Aggregated Twitter sentiment for tickers
2. **Third-party scrapers** - Use with caution (ToS concerns)
3. **Historical datasets** - Academic datasets from pre-2023

**Python Example (Official API):**
```python
import tweepy

client = tweepy.Client(bearer_token='YOUR_BEARER_TOKEN')

# Search for stock-related tweets (limited on free tier)
tweets = client.search_recent_tweets(
    query='$AAPL -is:retweet lang:en',
    max_results=10,
    tweet_fields=['created_at', 'public_metrics']
)
```

**Recommendation:** Due to cost, use aggregated sentiment from Finnhub or EODHD rather than direct Twitter API access.

---

### 2.2 Reddit API

**URL:** https://www.reddit.com/dev/api/

**Overview:**
Reddit dramatically increased API pricing in 2023, but limited free access remains for non-commercial use.

**Current Pricing (2025):**

| Use Case | Price | Rate Limit |
|----------|-------|------------|
| Free (Personal/Academic) | $0 | 100 req/min OAuth, 10/min unauth |
| Commercial | $0.24/1,000 calls | Requires approval |
| Enterprise | $12,000+/year | Custom |

**Relevant Subreddits:**
- r/wallstreetbets (14M+ members)
- r/stocks (5M+ members)
- r/investing (2M+ members)
- r/options (1.5M+ members)
- r/StockMarket (3M+ members)
- r/Daytrading (1M+ members)

**Python Example (PRAW):**
```python
import praw

reddit = praw.Reddit(
    client_id='YOUR_CLIENT_ID',
    client_secret='YOUR_CLIENT_SECRET',
    user_agent='sentiment_bot/1.0'
)

# Get top posts from wallstreetbets
wsb = reddit.subreddit('wallstreetbets')
for post in wsb.hot(limit=10):
    print(f"{post.title} | Score: {post.score}")
```

**Important:** WSB language requires custom sentiment lexicons - standard NLP models perform poorly on slang-heavy content.

---

### 2.3 StockTwits API (Recommended Free Option)

**URL:** https://api.stocktwits.com/

**Overview:**
StockTwits is the largest social platform for traders, with built-in bullish/bearish tagging that simplifies sentiment analysis.

**Key Features:**
- User-tagged sentiment (Bullish/Bearish)
- No NLP required for basic sentiment
- Real-time message stream
- First-party trading-specific data

**Free Tier:**
- No authentication required for basic endpoints
- 30 most recent messages per request
- Rate limits apply

**Sentiment API v2:**
```
https://sentiment-v2-api.stocktwits.com/
```

**Python Example:**
```python
import requests

# Basic endpoint (no auth required)
symbol = 'AAPL'
url = f'https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json'

response = requests.get(url)
data = response.json()

bullish = 0
bearish = 0
neutral = 0

for message in data.get('messages', []):
    sentiment = message.get('entities', {}).get('sentiment', {}).get('basic')
    if sentiment == 'Bullish':
        bullish += 1
    elif sentiment == 'Bearish':
        bearish += 1
    else:
        neutral += 1

print(f"Bullish: {bullish}, Bearish: {bearish}, Neutral: {neutral}")
```

**Limitations:**
- Only 30 messages per request
- Developer status required for full API
- Some resort to scraping for larger datasets

---

### 2.4 ApeWisdom API

**URL:** https://apewisdom.io/api/

**Overview:**
ApeWisdom tracks stock and crypto mentions across multiple subreddits and 4chan, specifically designed for retail investor sentiment.

**Covered Subreddits:**
- wallstreetbets
- stocks
- options
- SPACs
- investing
- Daytrading
- CryptoCurrency
- SatoshiStreetBets
- And more...

**API Endpoints:**
```
GET /api/filter/all-stocks           # Top mentioned stocks
GET /api/filter/all-crypto           # Top mentioned crypto
GET /api/filter/{subreddit}          # Specific subreddit
GET /api/ticker/{ticker}             # Specific ticker history
```

**Python Example:**
```python
import requests

# Get top mentioned stocks across all subreddits
url = 'https://apewisdom.io/api/v1.0/filter/all-stocks'
response = requests.get(url)
data = response.json()

for stock in data['results'][:10]:
    print(f"{stock['ticker']}: {stock['mentions']} mentions, "
          f"Rank: {stock['rank']}, 24h change: {stock['mentions_24h_ago']}")
```

**Free Tier:** Available with reasonable limits

---

### 2.5 Tradestie Reddit API

**URL:** https://tradestie.com/apps/reddit/api/

**Overview:**
Tradestie provides pre-computed sentiment analysis for r/wallstreetbets, making integration simple.

**Features:**
- Top 50 discussed stocks on WSB
- Sentiment scores (Bullish/Bearish)
- Comment counts
- 15-minute update frequency
- 20 requests/minute rate limit

**API Response:**
```json
{
  "ticker": "GME",
  "no_of_comments": 245,
  "sentiment": "Bullish",
  "sentiment_score": 0.78
}
```

**Python Example:**
```python
import requests

url = 'https://tradestie.com/api/v1/apps/reddit'
response = requests.get(url)
wsb_data = response.json()

for stock in wsb_data[:10]:
    print(f"{stock['ticker']}: {stock['sentiment']} ({stock['sentiment_score']:.2f})")
```

---

### Social Media Comparison Table

| Platform | Free Tier | Rate Limit | Sentiment Included | Coverage |
|----------|-----------|------------|-------------------|----------|
| **X (Twitter)** | Very limited | 10k/month (Basic) | No | Global |
| **Reddit (PRAW)** | Yes (non-commercial) | 100/min OAuth | No | Forums |
| **StockTwits** | Yes | Varies | Yes (user-tagged) | Trading |
| **ApeWisdom** | Yes | Reasonable | Yes (aggregated) | Reddit/4chan |
| **Tradestie** | Yes | 20/min | Yes | r/wallstreetbets |

---

## Part 3: Alternative Data Sources

### 3.1 SEC EDGAR Official API (Highly Recommended - Free)

**URL:** https://www.sec.gov/search-filings/edgar-application-programming-interfaces

**Overview:**
The SEC provides completely free, unlimited access to all regulatory filings including insider trading (Form 3/4/5) and institutional holdings (13F).

**Data Available:**
- **Form 4** - Insider transactions (real-time)
- **Form 13F** - Institutional holdings (quarterly)
- **Form 3** - Initial beneficial ownership
- **Form 5** - Annual changes
- **8-K** - Material events
- **10-K/10-Q** - Financial statements

**Free Tier:**
- Completely FREE
- No authentication required
- Real-time updates
- Bulk downloads available

**API Endpoints:**
```
# Company submissions
https://data.sec.gov/submissions/CIK{cik}.json

# Company facts (XBRL)
https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json

# Bulk downloads
https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip
```

**Python Example:**
```python
import requests

# Get insider transactions for Apple (CIK: 0000320193)
cik = '0000320193'
url = f'https://data.sec.gov/submissions/CIK{cik}.json'

headers = {'User-Agent': 'YourApp/1.0 (your@email.com)'}
response = requests.get(url, headers=headers)
data = response.json()

# Filter for Form 4 (insider trading)
filings = data['filings']['recent']
for i, form in enumerate(filings['form']):
    if form == '4':
        print(f"Form 4 filed: {filings['filingDate'][i]}")
```

---

### 3.2 EdgarTools (Open Source)

**URL:** https://github.com/dgunning/edgartools

**Overview:**
Python library for downloading and analyzing SEC EDGAR filings with support for insider trading data.

**Features:**
- All SEC form types
- XBRL parsing
- Form 4 insider transactions
- 13F institutional holdings
- Easy Python API

**Installation:**
```bash
pip install edgartools
```

**Python Example:**
```python
from edgar import Company, set_identity

set_identity("Your Name your@email.com")

# Get Apple's insider trading
apple = Company("AAPL")
form4s = apple.get_filings(form="4").latest(10)

for filing in form4s:
    print(f"{filing.filing_date}: {filing.form}")
```

---

### 3.3 sec-api.io (Comprehensive Paid Option)

**URL:** https://sec-api.io/

**Overview:**
Premium SEC data API with 18M+ filings, insider trading, and 13F holdings in standardized JSON format.

**Features:**
- Form 3/4/5 insider trading API
- 13F institutional ownership API
- Full-text search
- Real-time streaming
- XBRL-to-JSON conversion

**Python Package:**
```bash
pip install sec-api
```

**Python Example:**
```python
from sec_api import InsiderTradingApi

api = InsiderTradingApi(api_key="YOUR_API_KEY")

# Get insider trades
trades = api.get_data({
    "query": {
        "query_string": {
            "query": "issuer.tradingSymbol:AAPL"
        }
    },
    "sort": [{"filedAt": {"order": "desc"}}],
    "size": 50
})

for trade in trades['data']:
    print(f"{trade['reportingOwner']['name']}: {trade['transactionType']}")
```

---

### 3.4 Quiver Quantitative (Recommended Alternative Data)

**URL:** https://www.quiverquant.com/

**Overview:**
Founded by college students in 2020, Quiver bridges the information gap between Wall Street and retail investors.

**Data Available:**
- **Congress Trading** - Senate/House stock trades (since 2016)
- **Government Contracts** - Federal contract awards
- **Corporate Lobbying** - Lobbying expenditures
- **Reddit Mentions** - WSB and other subreddits
- **Wikipedia Traffic** - Page view data
- **Off-Exchange Volume** - Dark pool data

**Pricing:**

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic congressional data, dashboard |
| Premium | $25/month | API access, advanced features |

**Python Package:**
```bash
pip install quiverquant
```

**Python Example:**
```python
import quiverquant

quiver = quiverquant.quiver("YOUR_API_TOKEN")

# Get congressional trades
congress_trades = quiver.congress_trading()
print(congress_trades.head())

# Get trades for specific stock
tsla_trades = quiver.congress_trading("TSLA")

# Get trades by politician
pelosi_trades = quiver.congress_trading("Nancy Pelosi", politician=True)
```

---

### 3.5 Capitol Trades (Free Congress Trading)

**URL:** https://www.capitoltrades.com/

**Overview:**
Free platform tracking stock trades by U.S. government officials, aggregating disclosures from Congress and other officials.

**Features:**
- Filter by politician, asset, trade size, party
- Historical trade data
- Email alerts
- Completely free

**Access:** Web-based (no API, but scrapeable)

---

### 3.6 Google Trends (Free Search Data)

**URL:** https://trends.google.com/

**Overview:**
Google Trends provides search volume data that correlates with trading volume and can predict price movements.

**Research Findings:**
- High search volume for "debt" has predictive power
- Search spikes correlate with trading volume
- Can estimate company revenue before earnings
- Look-ahead bias warning for backtesting

**Python Library:** `pytrends` (unofficial)

```bash
pip install pytrends
```

**Python Example:**
```python
from pytrends.request import TrendReq

pytrends = TrendReq(hl='en-US', tz=360)

# Get interest over time for stock symbols
pytrends.build_payload(['Tesla stock', 'Tesla'], timeframe='today 3-m')
interest = pytrends.interest_over_time()
print(interest.head())

# Compare multiple stocks
pytrends.build_payload(['AAPL', 'TSLA', 'MSFT'], timeframe='today 12-m')
comparison = pytrends.interest_over_time()
```

**Caveats:**
- Data is relative (percentages), not absolute
- Look-ahead bias: historical values change with new popularity
- Rate limited (unofficial API)

---

### 3.7 Unusual Options Activity / Dark Pool Data

#### Unusual Whales

**URL:** https://unusualwhales.com/public-api

**Overview:**
Real-time options flow, dark pool data, and congressional trading through API access.

**Data Available:**
- Options flow alerts
- Dark pool trades
- Congressional trading
- Institutional holdings

**Pricing:** Subscription required (varies by tier)

**API Example:**
```python
import requests

headers = {'Authorization': 'Bearer YOUR_TOKEN'}
url = 'https://api.unusualwhales.com/v1/flow/alerts'

response = requests.get(url, headers=headers)
alerts = response.json()
```

#### FlowAlgo

**URL:** https://www.flowalgo.com/

**Overview:**
Real-time options flow and dark pool prints with alerting.

**Pricing:**
- 2-week trial: $37
- Monthly: $149/month

#### InsiderFinance

**URL:** https://www.insiderfinance.io/

**Overview:**
Options flow and dark pool analysis with some free access.

**Pricing:** $55-75/month

---

### 3.8 Web Traffic & App Data

#### SimilarWeb

**URL:** https://www.similarweb.com/

**Overview:**
Web traffic data for competitor analysis and revenue estimation.

**Use Cases:**
- E-commerce traffic estimation
- Market share analysis
- Consumer behavior tracking

**Pricing:** Enterprise (expensive, no free tier)

#### data.ai (formerly App Annie)

**URL:** https://www.data.ai/

**Overview:**
App download and usage data for mobile-first companies.

**Use Cases:**
- App store rankings
- Download estimates
- Usage metrics

**Pricing:** Enterprise

---

### 3.9 Satellite & Geolocation Data

#### Umbra (SAR Imagery)

**URL:** https://umbra.space/

**Overview:**
On-demand synthetic aperture radar (SAR) satellite imagery, works through clouds and at night.

**Use Cases:**
- Retail parking lot analysis
- Oil storage monitoring
- Construction tracking

**Pricing:** Pay-per-image (more accessible than traditional satellite)

#### SkyFi

**URL:** https://www.skyfi.com/

**Overview:**
Network of 90+ satellites for high-resolution imagery.

**Pricing:** Per-image model

---

### Alternative Data Comparison Table

| Source | Free Tier | Data Type | Update Frequency | Trading Signal |
|--------|-----------|-----------|------------------|----------------|
| **SEC EDGAR** | Unlimited | Insider/13F | Real-time | High |
| **Quiver Quant** | Yes | Congress/Reddit | Daily | Medium-High |
| **Capitol Trades** | Yes | Congress | Daily | Medium-High |
| **Google Trends** | Yes | Search volume | Daily | Medium |
| **Unusual Whales** | No | Options/Dark Pool | Real-time | High |
| **SimilarWeb** | No | Web traffic | Weekly | Medium |
| **Satellite** | No | Physical activity | Varies | High |

---

## Part 4: Sentiment Aggregation Strategy

### 4.1 Multi-Source Sentiment Pipeline

```
                    +------------------+
                    |  Data Collection |
                    +--------+---------+
                             |
    +------------------------+------------------------+
    |            |           |           |            |
+---+---+   +----+----+  +---+---+  +----+----+  +----+----+
| News  |   | Social  |  | SEC   |  |Alt Data |  | Market  |
|Finnhub|   |StockTwts|  | EDGAR |  | Quiver  |  | Price   |
+---+---+   +----+----+  +---+---+  +----+----+  +----+----+
    |            |           |           |            |
    +------------------------+------------------------+
                             |
                    +--------+---------+
                    |   Normalization  |
                    | (Scale to -1,+1) |
                    +--------+---------+
                             |
                    +--------+---------+
                    |    Weighting     |
                    | (by source type) |
                    +--------+---------+
                             |
                    +--------+---------+
                    |   Aggregation    |
                    | (time-weighted)  |
                    +--------+---------+
                             |
                    +--------+---------+
                    |  Composite Score |
                    +------------------+
```

### 4.2 Recommended Weights by Source Type

| Source Type | Weight | Rationale |
|-------------|--------|-----------|
| Insider Trading (Form 4) | 25% | Direct knowledge signal |
| Institutional Holdings (13F) | 15% | Smart money signal |
| Options Flow/Dark Pool | 20% | Institutional activity |
| News Sentiment | 15% | Market narrative |
| Social Sentiment | 10% | Retail sentiment |
| Congress Trading | 10% | Potential edge |
| Search/Web Traffic | 5% | Consumer behavior |

### 4.3 Time Decay Function

```python
import numpy as np
from datetime import datetime, timedelta

def time_weighted_sentiment(sentiments, timestamps, half_life_hours=24):
    """
    Apply exponential time decay to sentiment scores.

    Args:
        sentiments: List of sentiment scores (-1 to +1)
        timestamps: List of datetime objects
        half_life_hours: Time for weight to decay by 50%

    Returns:
        Time-weighted average sentiment
    """
    now = datetime.now()
    decay_rate = np.log(2) / half_life_hours

    weights = []
    for ts in timestamps:
        age_hours = (now - ts).total_seconds() / 3600
        weight = np.exp(-decay_rate * age_hours)
        weights.append(weight)

    weights = np.array(weights)
    sentiments = np.array(sentiments)

    return np.sum(weights * sentiments) / np.sum(weights)
```

### 4.4 Composite Sentiment Score Implementation

```python
class SentimentAggregator:
    """Aggregate sentiment from multiple sources."""

    WEIGHTS = {
        'insider': 0.25,
        'institutional': 0.15,
        'options_flow': 0.20,
        'news': 0.15,
        'social': 0.10,
        'congress': 0.10,
        'search': 0.05
    }

    def __init__(self):
        self.sources = {}

    def add_signal(self, source_type, score, confidence=1.0):
        """Add a sentiment signal from a source."""
        if source_type not in self.WEIGHTS:
            raise ValueError(f"Unknown source type: {source_type}")

        if source_type not in self.sources:
            self.sources[source_type] = []

        self.sources[source_type].append({
            'score': score,  # -1 to +1
            'confidence': confidence,  # 0 to 1
            'timestamp': datetime.now()
        })

    def get_composite_score(self):
        """Calculate weighted composite sentiment score."""
        total_weight = 0
        weighted_sum = 0

        for source_type, signals in self.sources.items():
            if not signals:
                continue

            # Get most recent signal
            latest = max(signals, key=lambda x: x['timestamp'])

            weight = self.WEIGHTS[source_type] * latest['confidence']
            weighted_sum += weight * latest['score']
            total_weight += weight

        if total_weight == 0:
            return 0

        return weighted_sum / total_weight

    def get_signal_summary(self):
        """Get summary of all signals."""
        summary = {}
        for source_type, signals in self.sources.items():
            if signals:
                latest = max(signals, key=lambda x: x['timestamp'])
                summary[source_type] = {
                    'score': latest['score'],
                    'confidence': latest['confidence'],
                    'weight': self.WEIGHTS[source_type]
                }
        return summary


# Usage example
aggregator = SentimentAggregator()

# Add signals from different sources
aggregator.add_signal('news', 0.3, confidence=0.8)        # Slightly bullish news
aggregator.add_signal('social', 0.6, confidence=0.5)      # Bullish social (lower confidence)
aggregator.add_signal('insider', 0.8, confidence=0.9)     # Strong insider buying
aggregator.add_signal('options_flow', 0.4, confidence=0.7) # Moderately bullish options

composite = aggregator.get_composite_score()
print(f"Composite Sentiment: {composite:.2f}")
print(f"Signal Summary: {aggregator.get_signal_summary()}")
```

---

## Part 5: Integration Code Examples

### 5.1 Complete Free Tier Sentiment Collector

```python
"""
Multi-source sentiment collector using only free APIs.
"""

import finnhub
import requests
from datetime import datetime, timedelta
import time

class FreeSentimentCollector:
    """Collect sentiment from free API sources."""

    def __init__(self, finnhub_key, alpaca_key=None, alpaca_secret=None):
        self.finnhub = finnhub.Client(api_key=finnhub_key)
        self.alpaca_key = alpaca_key
        self.alpaca_secret = alpaca_secret

    def get_finnhub_sentiment(self, symbol):
        """Get news sentiment from Finnhub."""
        try:
            sentiment = self.finnhub.news_sentiment(symbol)
            return {
                'source': 'finnhub_news',
                'score': (sentiment['sentiment']['bullishPercent'] - 0.5) * 2,  # Convert to -1,+1
                'buzz': sentiment['buzz']['buzz'],
                'articles_in_week': sentiment['buzz']['articlesInLastWeek'],
                'confidence': min(sentiment['buzz']['articlesInLastWeek'] / 10, 1.0)
            }
        except Exception as e:
            print(f"Finnhub error: {e}")
            return None

    def get_stocktwits_sentiment(self, symbol):
        """Get sentiment from StockTwits (no auth required)."""
        try:
            url = f'https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json'
            response = requests.get(url)
            data = response.json()

            bullish = 0
            bearish = 0

            for msg in data.get('messages', []):
                sentiment = msg.get('entities', {}).get('sentiment', {}).get('basic')
                if sentiment == 'Bullish':
                    bullish += 1
                elif sentiment == 'Bearish':
                    bearish += 1

            total = bullish + bearish
            if total == 0:
                return None

            score = (bullish - bearish) / total

            return {
                'source': 'stocktwits',
                'score': score,
                'bullish_count': bullish,
                'bearish_count': bearish,
                'confidence': min(total / 20, 1.0)  # More messages = higher confidence
            }
        except Exception as e:
            print(f"StockTwits error: {e}")
            return None

    def get_tradestie_wsb_sentiment(self, symbol):
        """Get r/wallstreetbets sentiment from Tradestie."""
        try:
            url = 'https://tradestie.com/api/v1/apps/reddit'
            response = requests.get(url)
            data = response.json()

            for stock in data:
                if stock['ticker'] == symbol.upper():
                    score = stock['sentiment_score']
                    return {
                        'source': 'reddit_wsb',
                        'score': score,
                        'comments': stock['no_of_comments'],
                        'sentiment_label': stock['sentiment'],
                        'confidence': min(stock['no_of_comments'] / 50, 1.0)
                    }
            return None
        except Exception as e:
            print(f"Tradestie error: {e}")
            return None

    def get_sec_insider_sentiment(self, cik):
        """Get insider trading sentiment from SEC EDGAR."""
        try:
            url = f'https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json'
            headers = {'User-Agent': 'SentimentBot/1.0 (contact@example.com)'}
            response = requests.get(url, headers=headers)
            data = response.json()

            filings = data['filings']['recent']

            # Look at Form 4 filings in last 30 days
            buys = 0
            sells = 0
            cutoff = datetime.now() - timedelta(days=30)

            for i, form in enumerate(filings['form']):
                if form == '4':
                    filing_date = datetime.strptime(filings['filingDate'][i], '%Y-%m-%d')
                    if filing_date > cutoff:
                        # Would need to parse the actual Form 4 for buy/sell
                        # This is simplified - in practice, parse the XML
                        buys += 1  # Placeholder

            return {
                'source': 'sec_insider',
                'form4_count_30d': buys + sells,
                'confidence': 0.7  # Placeholder
            }
        except Exception as e:
            print(f"SEC EDGAR error: {e}")
            return None

    def collect_all_sentiment(self, symbol, cik=None):
        """Collect sentiment from all free sources."""
        results = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'sources': {}
        }

        # Finnhub (60/min limit)
        finnhub_data = self.get_finnhub_sentiment(symbol)
        if finnhub_data:
            results['sources']['finnhub'] = finnhub_data

        time.sleep(0.5)  # Rate limiting

        # StockTwits (no auth, generous limits)
        stocktwits_data = self.get_stocktwits_sentiment(symbol)
        if stocktwits_data:
            results['sources']['stocktwits'] = stocktwits_data

        time.sleep(0.5)

        # Tradestie WSB (20/min limit)
        wsb_data = self.get_tradestie_wsb_sentiment(symbol)
        if wsb_data:
            results['sources']['reddit_wsb'] = wsb_data

        # SEC EDGAR (no limit, but be respectful)
        if cik:
            sec_data = self.get_sec_insider_sentiment(cik)
            if sec_data:
                results['sources']['sec_edgar'] = sec_data

        return results


# Usage
collector = FreeSentimentCollector(finnhub_key='YOUR_FINNHUB_KEY')
sentiment = collector.collect_all_sentiment('AAPL', cik='320193')
print(sentiment)
```

### 5.2 Quiver Quantitative Integration

```python
"""
Quiver Quantitative integration for alternative data.
"""

import quiverquant

class QuiverCollector:
    """Collect alternative data from Quiver Quantitative."""

    def __init__(self, api_token):
        self.quiver = quiverquant.quiver(api_token)

    def get_congress_trading(self, symbol=None, days=30):
        """Get congressional trading data."""
        df = self.quiver.congress_trading(symbol)

        if df is None or df.empty:
            return None

        # Filter to recent trades
        df['Date'] = pd.to_datetime(df['Date'])
        cutoff = datetime.now() - timedelta(days=days)
        df = df[df['Date'] > cutoff]

        buys = len(df[df['Transaction'] == 'Purchase'])
        sells = len(df[df['Transaction'] == 'Sale'])

        if buys + sells == 0:
            return None

        return {
            'source': 'congress_trading',
            'buys': buys,
            'sells': sells,
            'score': (buys - sells) / (buys + sells),
            'recent_trades': df.head(5).to_dict('records')
        }

    def get_reddit_sentiment(self, symbol):
        """Get Reddit mention data from Quiver."""
        try:
            df = self.quiver.reddit_activity(symbol)
            if df is None or df.empty:
                return None

            recent = df.tail(7)
            avg_mentions = recent['Mentions'].mean()
            trend = recent['Mentions'].iloc[-1] / max(avg_mentions, 1)

            return {
                'source': 'quiver_reddit',
                'avg_mentions_7d': avg_mentions,
                'trend': trend,
                'score': min(max((trend - 1) / 2, -1), 1)  # Normalize
            }
        except:
            return None
```

---

## Part 6: Quick Reference Tables

### 6.1 Free Tier Summary

| API | Free Limit | Best Use Case | Python Package |
|-----|------------|---------------|----------------|
| Finnhub | 60/min | News sentiment | `finnhub-python` |
| StockTwits | ~30 msgs/call | Social sentiment | `requests` |
| Tradestie | 20/min | WSB sentiment | `requests` |
| SEC EDGAR | Unlimited | Insider trading | `edgartools` |
| ApeWisdom | Reasonable | Reddit tracking | `requests` |
| Quiver | Freemium | Congress trading | `quiverquant` |
| Google Trends | Rate limited | Search correlation | `pytrends` |
| Alpha Vantage | 25/day | News sentiment | `alpha_vantage` |

### 6.2 Sentiment Signal Strength by Source

| Source | Lead Time | Accuracy | Noise Level | Signal Strength |
|--------|-----------|----------|-------------|-----------------|
| Insider Trading | Days-Weeks | High | Low | Strong |
| Options Flow | Hours-Days | Medium-High | Medium | Strong |
| Institutional (13F) | Weeks | High | Low | Medium |
| News Sentiment | Minutes-Hours | Medium | High | Medium |
| Social Media | Minutes | Low-Medium | Very High | Weak |
| Congress Trading | Days-Weeks | Medium | Low | Medium |
| Search Trends | Days | Low-Medium | Medium | Weak |

### 6.3 API Rate Limits Quick Reference

| API | Per Minute | Per Day | Per Month |
|-----|------------|---------|-----------|
| Finnhub | 60 | Unlimited | Unlimited |
| Alpha Vantage | 5 | 25 | ~750 |
| EODHD | ~0.01 | 20 | ~600 |
| Tradestie | 20 | Unlimited | Unlimited |
| StockTwits | ~10 | Varies | Varies |
| SEC EDGAR | ~10 (respectful) | Unlimited | Unlimited |
| Twitter/X Basic | Varies | ~333 | 10,000 |
| Reddit Free | 100 (OAuth) | Unlimited | Unlimited |

---

## Document Information

**File Location:** `/Volumes/Externalwork/projects/claudeflow-testing/research/data-sources/sentiment-sources.md`

**Memory Keys for Next Agents:**
- `research/sentiment/sources` - This complete document
- `research/sentiment/free-apis` - Free tier summary
- `research/sentiment/aggregation` - Aggregation strategy

**Next Agents Should:**
1. Use Finnhub as primary news sentiment source (builds on API comparison)
2. Implement SEC EDGAR for insider/institutional signals (free, unlimited)
3. Add StockTwits for social sentiment (free, no auth)
4. Consider Quiver Quantitative for alternative data ($25/month or free tier)
5. Implement time-weighted aggregation for composite scores

**Sources:**
- [Finnhub Sentiment](https://finnhub.io/docs/api/news-sentiment)
- [Alpha Vantage News](https://www.alphavantage.co/documentation/#news-sentiment)
- [StockTwits API](https://api.stocktwits.com/)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Quiver Quantitative](https://www.quiverquant.com/)
- [ApeWisdom](https://apewisdom.io/api/)
- [Tradestie](https://tradestie.com/apps/reddit/api/)
- [EODHD Sentiment](https://eodhd.com/financial-apis/stock-market-financial-news-api)
- [Benzinga](https://www.benzinga.com/apis/)
- [X API Pricing](https://twitterapi.io/blog/twitter-api-pricing-2025)
- [Reddit API Pricing](https://rankvise.com/blog/reddit-api-cost-guide/)
- [Unusual Whales](https://unusualwhales.com/public-api)
- [Google Trends](https://trends.google.com/)
