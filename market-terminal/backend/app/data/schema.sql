-- ==========================================================================
-- Market Terminal SQLite Schema (v1)
-- ==========================================================================
-- Executed via executescript() on first connection. All statements use
-- IF NOT EXISTS so the file is idempotent.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Migration tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    version      INTEGER PRIMARY KEY,
    description  TEXT,
    applied_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- 1. Watchlist — user's tracked symbols
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watchlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL UNIQUE,
    name        TEXT,
    asset_type  TEXT DEFAULT 'stock',
    group_name  TEXT DEFAULT 'default',
    sort_order  INTEGER DEFAULT 0,
    added_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- 2. Price cache — cached OHLCV price data
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    date        TEXT NOT NULL,
    open        REAL,
    high        REAL,
    low         REAL,
    close       REAL,
    volume      INTEGER,
    source      TEXT NOT NULL,
    fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, date, source)
);

-- --------------------------------------------------------------------------
-- 3. Fundamentals cache — cached fundamental data from EDGAR
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fundamentals_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    data_type   TEXT NOT NULL,
    period      TEXT NOT NULL,
    value_json  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'edgar',
    fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, data_type, period, source)
);

-- --------------------------------------------------------------------------
-- 4. News cache — cached news articles with sentiment
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT NOT NULL,
    headline        TEXT NOT NULL,
    summary         TEXT,
    source          TEXT NOT NULL,
    url             TEXT,
    published_at    TEXT NOT NULL,
    sentiment       TEXT,
    sentiment_score REAL,
    sentiment_model TEXT,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, url)
);

-- --------------------------------------------------------------------------
-- 5. Analysis results — cached methodology analysis outputs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    methodology TEXT NOT NULL,
    direction   TEXT NOT NULL,
    confidence  REAL NOT NULL,
    timeframe   TEXT,
    signal_json TEXT NOT NULL,
    reasoning   TEXT,
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, methodology, analyzed_at)
);

-- --------------------------------------------------------------------------
-- 6. Macro events — economic calendar and historical event data
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS macro_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name      TEXT NOT NULL,
    event_date      TEXT NOT NULL,
    expected_value  REAL,
    actual_value    REAL,
    previous_value  REAL,
    impact          TEXT DEFAULT 'medium',
    source          TEXT NOT NULL,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_name, event_date)
);

-- --------------------------------------------------------------------------
-- 7. Macro reactions — historical asset price reactions to macro events
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS macro_reactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name          TEXT NOT NULL,
    event_date          TEXT NOT NULL,
    symbol              TEXT NOT NULL,
    reaction_1d         REAL,
    reaction_5d         REAL,
    surprise_direction  TEXT,
    calculated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_name, event_date, symbol)
);

-- --------------------------------------------------------------------------
-- 8. Ownership cache — 13F institutional holdings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ownership_cache (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol               TEXT NOT NULL,
    holder_name          TEXT NOT NULL,
    shares               INTEGER,
    value_usd            REAL,
    percent_of_portfolio REAL,
    change_shares        INTEGER,
    change_percent       REAL,
    filing_date          TEXT NOT NULL,
    report_period        TEXT NOT NULL,
    source               TEXT NOT NULL DEFAULT 'edgar_13f',
    fetched_at           TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, holder_name, report_period)
);

-- --------------------------------------------------------------------------
-- 9. Insider transactions — Form 4 insider activity
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insider_transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol              TEXT NOT NULL,
    insider_name        TEXT NOT NULL,
    insider_title       TEXT,
    transaction_type    TEXT NOT NULL,
    shares              INTEGER NOT NULL,
    price_per_share     REAL,
    total_value         REAL,
    shares_owned_after  INTEGER,
    transaction_date    TEXT NOT NULL,
    filing_date         TEXT NOT NULL,
    source              TEXT NOT NULL DEFAULT 'edgar_form4',
    fetched_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, insider_name, transaction_date, transaction_type, shares)
);

-- --------------------------------------------------------------------------
-- 10. COT data — CFTC Commitment of Traders reports
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cot_data (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    market_name      TEXT NOT NULL,
    report_date      TEXT NOT NULL,
    commercial_long  INTEGER,
    commercial_short INTEGER,
    commercial_net   INTEGER,
    speculative_long  INTEGER,
    speculative_short INTEGER,
    speculative_net   INTEGER,
    open_interest    INTEGER,
    source           TEXT NOT NULL DEFAULT 'cftc',
    fetched_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(market_name, report_date)
);

-- ==========================================================================
-- Indexes
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_price_cache_symbol_date
    ON price_cache(symbol, date DESC);

CREATE INDEX IF NOT EXISTS idx_fundamentals_cache_symbol
    ON fundamentals_cache(symbol, data_type);

CREATE INDEX IF NOT EXISTS idx_news_cache_symbol_date
    ON news_cache(symbol, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_results_symbol
    ON analysis_results(symbol, methodology, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_macro_events_date
    ON macro_events(event_date DESC);

CREATE INDEX IF NOT EXISTS idx_macro_events_name
    ON macro_events(event_name, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_macro_reactions_event
    ON macro_reactions(event_name, symbol);

CREATE INDEX IF NOT EXISTS idx_ownership_cache_symbol
    ON ownership_cache(symbol, report_period DESC);

CREATE INDEX IF NOT EXISTS idx_insider_transactions_symbol
    ON insider_transactions(symbol, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_cot_data_market
    ON cot_data(market_name, report_date DESC);

-- ==========================================================================
-- Initial version record
-- ==========================================================================
INSERT OR IGNORE INTO schema_version (version, description)
    VALUES (1, 'Initial schema');
