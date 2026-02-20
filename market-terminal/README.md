# Market Terminal

A terminal-style market analysis dashboard that combines six professional trading
methodologies into a single weighted composite signal. The frontend presents a
Bloomberg-inspired panel layout driven entirely by keyboard commands, while the
backend aggregates data from five free sources and exposes 19 tools through an
MCP (Model Context Protocol) server for AI-agent integration.

**Six methodologies, one verdict.** Type a ticker, get a directional signal
backed by Wyckoff, Elliott Wave, ICT Smart Money, CANSLIM, Larry Williams
indicators, and news sentiment -- each weighted and merged into a composite
score.

---

## Prerequisites

| Dependency | Minimum version | Purpose |
|------------|-----------------|---------|
| Python | 3.11+ | Backend API and analysis engine |
| Node.js | 18+ | Frontend build tooling and dev server |
| pip | bundled with Python | Python package management |
| npm | bundled with Node.js | Node package management |
| Git | any recent version | Clone the repository |

Download links:

- Python: <https://www.python.org/downloads/>
- Node.js: <https://nodejs.org/en/download>

All data-source libraries (`yfinance`, `fredapi`, `edgartools`) are installed
automatically through `requirements.txt`. No databases need to be provisioned;
the backend creates an SQLite file on first run.

---

## API Key Setup

Market Terminal pulls data from five sources. Two require no key at all,
and the remaining three offer free tiers that are sufficient for personal use.

| Source | Key required | Free tier | Used for |
|--------|-------------|-----------|----------|
| Finnhub | Recommended | 60 calls/min | Real-time quotes, news, economic calendar |
| FRED | Recommended | Unlimited | Macro indicators, yield curve |
| Massive | Optional | Starter Tier/Live | Options chains, Analyst ratings, Short interest |
| JBlanked | None | Unlimited | Economic ML predictions |
| Alpha Vantage | Optional | 25 calls/day | Fallback price data |
| yfinance | None | Unlimited | Price, fundamentals, insider data |
| CFTC COT | None | Public data | Commitment of Traders reports |
| SEC EDGAR | User-Agent string | Unlimited | 13F ownership, fundamentals |

### Obtaining Keys

1. **Finnhub** -- Register at <https://finnhub.io/register> and copy the API
   key from your dashboard.
2. **FRED** -- Request a key at <https://fred.stlouisfed.org/docs/api/api_key.html>.
3. **Alpha Vantage** (optional) -- Claim a free key at
   <https://www.alphavantage.co/support/#api-key>.

### Creating the `.env` File

After cloning the repository (see [Installation](#installation) below), copy
the example and fill in your keys:

```bash
cd market-terminal
cp .env.example .env
```

Open `.env` and set at minimum:

```env
FINNHUB_API_KEY=your_finnhub_key_here
FRED_API_KEY=your_fred_key_here
```

Optional entries:

```env
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
MASSIVE_API_KEY=your_massive_key_here
SEC_EDGAR_USER_AGENT=YourName your@email.com
```

The app starts without any keys configured but runs in degraded mode -- price
data falls back to yfinance only, and news and macro features are disabled.

### Data Fallback Chains

- **Price data**: Finnhub -> yfinance
- **Fundamentals**: EDGAR/SEC -> yfinance

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd market-terminal
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # macOS / Linux
# .venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

### 4. Start Both Servers

Open two terminals (or use a multiplexer):

**Terminal 1 -- Backend** (runs on port `8000`):

```bash
cd market-terminal/backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 -- Frontend** (runs on port `3000`):

```bash
cd market-terminal/frontend
npm run dev
```

Open <http://localhost:3000> in your browser.

### 5. Verify

Confirm the backend is healthy:

```bash
curl http://localhost:8000/api/health
```

A successful response returns a JSON object with service status details.

---

## Usage Guide

### Command Bar

The command bar at the top of the terminal accepts all input. Click it or
start typing. Commands are case-insensitive; ticker symbols are normalized
to uppercase automatically.

### Commands

| Command | Example | What it does |
|---------|---------|--------------|
| `TICKER` | `AAPL` | Load a ticker into all panels |
| `analyze TICKER` | `analyze TSLA` | Run all 6 methodology analyses |
| `news TICKER` | `news MSFT` | Show recent news articles |
| `fundamentals TICKER` | `fundamentals GOOG` | Show key fundamental metrics |
| `insider TICKER` | `insider NVDA` | Show insider buy/sell activity |
| `options TICKER` | `options AMZN` | Load options chain into terminal |
| `watch add TICKER` | `watch add AMZN` | Add a symbol to the watchlist |
| `watch remove TICKER` | `watch remove AMZN` | Remove a symbol from the watchlist |
| `scan` | `scan` | Scan all watchlist tickers |
| `scan PRESET` | `scan bullish` | Filter by signal preset (`bullish`, `bearish`, `strong`) |
| `macro` | `macro` | Show the economic calendar with JBlanked API predictions |

### Panel Layout

The interface is organized into four resizable rows:

| Row | Height | Panels |
|-----|--------|--------|
| 1 | 50% | Watchlist (20%) -- Chart (50%) -- Methodology Scores (30%) |
| 2 | 22% | News Feed (40%) -- Fundamentals (60%) |
| 3 | 18% | Institutional Ownership (50%) -- Insider Activity (50%) |
| 4 | 10% | Macro Calendar (100%) |

A header bar spans the top containing the command bar and an analysis progress
indicator that auto-hides when idle.

All panel dividers are draggable. Resize positions persist in local storage.

### Analysis Workflow

1. Type a ticker (e.g., `AAPL`) to load it into every panel.
2. Run `analyze AAPL` to kick off all six methodologies.
3. Watch the progress bar in the header as each methodology completes.
4. Review the Methodology Scores panel for individual and composite signals.
5. Cross-reference with fundamentals, insider activity, and news panels.

### Methodology Weights

The composite signal blends six independent scores:

| Methodology | Weight | Focus |
|-------------|--------|-------|
| Wyckoff | 20% | Accumulation/distribution phases, volume-price spread |
| Elliott Wave | 15% | Impulse and corrective wave patterns |
| ICT Smart Money | 20% | Order blocks, fair value gaps, liquidity sweeps |
| CANSLIM | 20% | O'Neil growth criteria with fundamentals |
| Larry Williams | 10% | Williams %R, COT positioning, seasonals |
| Sentiment | 15% | FinBERT / VADER news sentiment scoring |

---

## God-Agent Integration (MCP)

Market Terminal exposes 19 tools through an MCP server using stdio transport.
Any MCP-compatible AI agent (Claude, god-agent pipelines, custom agents) can
call these tools programmatically.

### Adding the MCP Server

In your Claude Desktop config or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "market-terminal": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/absolute/path/to/market-terminal/backend"
    }
  }
}
```

The server name is `market-terminal` and it communicates over stdio.

### Available Tools (19)

#### Data Retrieval (8 Tools)

| Tool | Arguments | Description |
|------|-----------|-------------|
| `get_price` | `symbol`, `timeframe` | Historical OHLCV price bars |
| `get_volume` | `symbol`, `period` | Volume analysis with trend and anomalies |
| `get_fundamentals` | `symbol` | Key financial metrics (PE, EPS, margins) |
| `get_options_chain` | `symbol` | Fetches options chain strings |
| `get_ownership` | `symbol` | Institutional 13F ownership data |
| `get_insider_activity` | `symbol`, `days` | Form 4 insider transactions |
| `get_news` | `symbol`, `limit` | Recent news articles |
| `get_macro_calendar` | `days` | Upcoming economic events from ForexFactory |
| `get_macro_history` | `indicator`, `symbol` | FRED macro indicator history |

#### Analysis (7 Tools)

| Tool | Arguments | Description |
|------|-----------|-------------|
| `run_wyckoff` | `symbol` | Wyckoff phase and volume-price analysis |
| `run_elliott` | `symbol` | Elliott Wave pattern detection |
| `run_ict` | `symbol` | ICT Smart Money Concepts analysis |
| `run_canslim` | `symbol` | CANSLIM growth criteria scoring |
| `run_williams` | `symbol` | Larry Williams indicators and COT |
| `run_sentiment` | `symbol` | News sentiment via FinBERT/VADER |
| `run_composite` | `symbol` | All 6 methodologies with weighted composite |

#### Watchlist (3 Tools)

| Tool | Arguments | Description |
|------|-----------|-------------|
| `watchlist_add` | `symbol`, `group` | Add ticker to watchlist (max 50) |
| `watchlist_remove` | `symbol` | Remove ticker from watchlist |
| `watchlist_list` | -- | List all watchlist entries with prices |

#### Scan (1 Tool)

| Tool | Arguments | Description |
|------|-----------|-------------|
| `scan_watchlist` | `method`, `signal`, `min_confidence`, `limit` | Filter watchlist by methodology signals |

### Example Agent Usage

```python
# Using an MCP client to analyze a stock
result = await client.call_tool("run_composite", {"symbol": "NVDA"})
print(result["direction"])    # "bullish" | "bearish" | "neutral"
print(result["confidence"])   # 0.0 - 1.0
```

---

## Configuration

### Environment Variables

All configuration is loaded through environment variables (or a `.env` file in
the project root). Every variable has a sensible default so the application
can start without any configuration at all.

#### API Keys

| Variable | Default | Description |
|----------|---------|-------------|
| `FINNHUB_API_KEY` | (empty) | Finnhub API key for quotes and news |
| `FRED_API_KEY` | (empty) | FRED API key for macro data |
| `MASSIVE_API_KEY` | (empty) | Massive API key for options data |
| `ALPHA_VANTAGE_API_KEY` | (empty) | Alpha Vantage key (optional fallback) |
| `SEC_EDGAR_USER_AGENT` | `MarketTerminal user@example.com` | SEC EDGAR request identity |

#### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_HOST` | `0.0.0.0` | Backend bind address |
| `BACKEND_PORT` | `8000` | Backend listen port |
| `FRONTEND_PORT` | `3000` | Frontend dev server port |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `DATABASE_PATH` | `data/market_terminal.db` | SQLite database file path |

#### Cache TTLs

Each data type has an independent time-to-live in seconds:

| Variable | Default | Human-readable |
|----------|---------|----------------|
| `CACHE_TTL_PRICE` | `900` | 15 minutes |
| `CACHE_TTL_FUNDAMENTALS` | `86400` | 24 hours |
| `CACHE_TTL_NEWS` | `3600` | 1 hour |
| `CACHE_TTL_MACRO` | `43200` | 12 hours |
| `CACHE_TTL_COT` | `604800` | 7 days |
| `CACHE_TTL_OWNERSHIP` | `86400` | 24 hours |
| `CACHE_TTL_INSIDER` | `14400` | 4 hours |
| `CACHE_TTL_ANALYSIS` | `3600` | 1 hour |
| `CACHE_TTL_OPTIONS` | `300` | 5 minutes |
| `CACHE_TTL_ECONOMIC_CALENDAR` | `43200` | 12 hours |

Note: `CACHE_TTL_OWNERSHIP`, `CACHE_TTL_INSIDER`, and `CACHE_TTL_ANALYSIS` are
defined in `backend/app/config.py` only and are not present in `.env.example`.

#### Circuit Breaker

The circuit breaker protects against cascading failures from external APIs:

| Variable | Default | Description |
|----------|---------|-------------|
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `3` | Failures before circuit opens |
| `CIRCUIT_BREAKER_WINDOW_SECONDS` | `300` | Window for counting failures (5 min) |
| `CIRCUIT_BREAKER_COOLDOWN_SECONDS` | `900` | Time before retry after opening (15 min) |

#### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTIMENT_USE_LIGHTWEIGHT` | `false` | Use dictionary-based sentiment instead of FinBERT |
| `LOG_LEVEL` | `INFO` | Python logging level |

### Lightweight Sentiment Mode

Set `SENTIMENT_USE_LIGHTWEIGHT=true` to skip the FinBERT transformer model and
use a VADER + Loughran-McDonald dictionary approach instead. This reduces memory
usage and startup time at the cost of lower sentiment accuracy.

---

## Troubleshooting

### Backend Fails to Start

**Symptom**: `ModuleNotFoundError` on import.

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

Make sure you are running Python 3.11 or newer:

```bash
python --version
```

### Frontend Fails to Start

**Symptom**: `vite: command not found` or module resolution errors.

```bash
cd frontend
rm -rf node_modules
npm install
```

Make sure you are running Node.js 18 or newer:

```bash
node --version
```

### No Data Appears in Panels

- The app runs without API keys in degraded mode (price data from yfinance
  only; news and macro features disabled). For full functionality, set
  `FINNHUB_API_KEY` and `FRED_API_KEY` in `.env`.
- Verify the backend is running and healthy:

```bash
curl http://localhost:8000/api/health
```

- Check backend logs for circuit breaker trips or API rate-limit errors.

### Analysis Returns Errors

- Confirm the ticker symbol is valid (1-5 uppercase letters).
- Check that price data is available -- some tickers have limited history.
- If `run_sentiment` fails, try setting `SENTIMENT_USE_LIGHTWEIGHT=true` to
  skip FinBERT and use the Loughran-McDonald dictionary + VADER fallback
  instead, which avoids the model download and reduces memory usage.

### CORS Errors in the Browser Console

Ensure `CORS_ORIGINS` includes the URL you are accessing the frontend from.
The default is `http://localhost:3000`. If you run the frontend on a different
port or hostname, update this variable accordingly.

### MCP Server Does Not Connect

- The MCP server must be started from inside the `backend/` directory:

```bash
cd market-terminal/backend
python -m app.mcp_server
```

- Confirm the `cwd` path in your MCP client config is an absolute path to the
  `backend/` directory.
- Check stderr output for initialization errors.

### Circuit Breaker Is Open

When an external API fails repeatedly, the circuit breaker opens and blocks
further requests for the cooldown period. Check the logs for a message
matching `circuit breaker: ... -> OPEN`. Wait 15 minutes (default cooldown)
or restart the backend to reset.

### High Memory Usage

The FinBERT model loaded by the sentiment analyzer requires approximately
1.5 GB of RAM. Set `SENTIMENT_USE_LIGHTWEIGHT=true` to use the dictionary-based
fallback and reduce memory usage significantly.

---

## Architecture

### Project Structure

```text
market-terminal/
  backend/
    app/
      api/
        routes/           # FastAPI route handlers
          analysis.py     # POST /api/analyze/{symbol}
          fundamentals.py # GET /api/fundamentals/{symbol}
          macro.py        # GET /api/macro/calendar
          news.py         # GET /api/news/{symbol}
          ownership.py    # GET /api/ownership/{symbol}
          scan.py         # GET /api/scan
          ticker.py       # GET /api/ticker/{symbol}
          watchlist.py    # CRUD /api/watchlist
          websocket.py    # WS /api/ws
          query.py        # POST /api/query
      analysis/           # Methodology engines
        wyckoff.py
        elliott_wave.py
        ict_smart_money.py
        canslim.py
        larry_williams.py
        sentiment.py
        composite.py      # Weighted aggregator
        base.py           # Abstract base class
      data/               # Data fetching and caching
        cache.py          # CacheManager with TTL + circuit breaker
        database.py       # Async SQLite via aiosqlite
      config.py           # Pydantic settings
      main.py             # FastAPI app factory
      mcp_server.py       # MCP stdio server (19 tools)
    requirements.txt
  frontend/
    src/
      components/         # React panel components
        Chart.tsx
        CommandBar.tsx
        Watchlist.tsx
        MethodologyScores.tsx
        NewsFeed.tsx
        Fundamentals.tsx
        InstitutionalOwnership.tsx
        InsiderActivity.tsx
        MacroCalendar.tsx
        AnalysisProgress.tsx
      contexts/           # React contexts
        TickerContext.tsx
        WebSocketContext.tsx
      hooks/              # Custom React hooks
      layouts/
        Terminal.tsx       # Main panel layout
      types/              # TypeScript type definitions
        command.ts         # Command parser and types
      api/
        client.ts          # Axios HTTP client
    package.json
    vite.config.ts
    tailwind.config.js
    tsconfig.json
```

### Technology Stack

**Backend**: Python 3.11+, FastAPI, Uvicorn, Pydantic, aiosqlite, pandas,
yfinance, edgartools, fredapi, transformers (FinBERT), MCP SDK

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TradingView
Lightweight Charts, AG Grid, react-resizable-panels, Axios, Vitest

### Data Flow

```text
User command --> CommandBar (parse) --> API client --> FastAPI routes
                                                        |
                                                   CacheManager
                                                   /    |    \
                                             Finnhub  yfinance  FRED
                                               |        |        |
                                            (cache with TTL + circuit breaker)
                                                        |
                                                   Analysis engines
                                                        |
                                                  Composite signal
                                                        |
                                                WebSocket push --> UI panels
```

### Key Design Decisions

- **Composite scoring**: Each methodology produces an independent signal with a
  direction and confidence. The composite aggregator applies fixed weights
  (totaling 100%) and returns a single merged verdict.
- **Cache-first**: Every external call goes through `CacheManager`, which
  checks SQLite-backed TTL caches before hitting the network. This minimizes
  API usage and improves responsiveness.
- **Circuit breaker**: Protects against cascading failures. After 3 failures
  within a 5-minute window, the breaker opens and all requests to that source
  return immediately for a 15-minute cooldown.
- **Graceful degradation**: The app starts and remains functional even with zero
  API keys configured. Missing data sources are logged as warnings, and panels
  display appropriate empty states.
- **MCP-first**: The 19 MCP tools mirror the REST API surface, enabling any
  AI agent to drive the full analysis pipeline without the browser UI.

---

## License and Costs

### API Costs

All data sources used by Market Terminal offer free tiers:

| Source | Free tier limit | Typical usage |
|--------|----------------|---------------|
| Finnhub | 60 calls/minute | Well within limits with caching |
| FRED | Unlimited | No cost |
| Massive | Starter API Tier | Excludes real-time options |
| JBlanked | Unlimited | Returns ML predictions for /macro |
| ForexFactory | No authentication | Primary source for /macro endpoints |
| Alpha Vantage | 25 calls/day | Optional; rarely hit with caching |
| yfinance | Unlimited (unofficial) | No cost |
| SEC EDGAR | Unlimited | No cost; requires User-Agent |
| CFTC COT | Public data | No cost |

With default cache TTLs, typical usage stays well within every free tier.
No paid API plan is required for normal operation.

### License

This project does not currently specify a license. Contact the repository owner
for usage terms.
