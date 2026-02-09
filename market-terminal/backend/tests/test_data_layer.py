"""Tests for TASK-DATA-001: SQLite Schema Design & DatabaseManager.

Validates the 11-table schema (schema.sql), 10 indexes, column definitions,
UNIQUE constraints, default values, idempotency, and the full async
DatabaseManager lifecycle including WAL mode, CRUD helpers, migration
framework, and the module-level singleton functions.

Run with: ``cd market-terminal/backend && python -m pytest tests/test_data_layer.py -v``
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio

from app.data.database import DatabaseManager, close_database, get_database

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "app" / "data" / "schema.sql")

EXPECTED_TABLES = [
    "watchlist",
    "price_cache",
    "fundamentals_cache",
    "news_cache",
    "analysis_results",
    "macro_events",
    "macro_reactions",
    "ownership_cache",
    "insider_transactions",
    "cot_data",
    "schema_version",
]

EXPECTED_INDEXES = [
    "idx_price_cache_symbol_date",
    "idx_fundamentals_cache_symbol",
    "idx_news_cache_symbol_date",
    "idx_analysis_results_symbol",
    "idx_macro_events_date",
    "idx_macro_events_name",
    "idx_macro_reactions_event",
    "idx_ownership_cache_symbol",
    "idx_insider_transactions_symbol",
    "idx_cot_data_market",
]

# Expected columns per table (order matches schema.sql)
TABLE_COLUMNS = {
    "schema_version": ["version", "description", "applied_at"],
    "watchlist": [
        "id", "symbol", "name", "asset_type", "group_name",
        "sort_order", "added_at", "updated_at",
    ],
    "price_cache": [
        "id", "symbol", "date", "open", "high", "low",
        "close", "volume", "source", "fetched_at",
    ],
    "fundamentals_cache": [
        "id", "symbol", "data_type", "period",
        "value_json", "source", "fetched_at",
    ],
    "news_cache": [
        "id", "symbol", "headline", "summary", "source", "url",
        "published_at", "sentiment", "sentiment_score",
        "sentiment_model", "fetched_at",
    ],
    "analysis_results": [
        "id", "symbol", "methodology", "direction", "confidence",
        "timeframe", "signal_json", "reasoning", "analyzed_at",
    ],
    "macro_events": [
        "id", "event_name", "event_date", "expected_value",
        "actual_value", "previous_value", "impact", "source",
        "fetched_at",
    ],
    "macro_reactions": [
        "id", "event_name", "event_date", "symbol",
        "reaction_1d", "reaction_5d", "surprise_direction",
        "calculated_at",
    ],
    "ownership_cache": [
        "id", "symbol", "holder_name", "shares", "value_usd",
        "percent_of_portfolio", "change_shares", "change_percent",
        "filing_date", "report_period", "source", "fetched_at",
    ],
    "insider_transactions": [
        "id", "symbol", "insider_name", "insider_title",
        "transaction_type", "shares", "price_per_share",
        "total_value", "shares_owned_after", "transaction_date",
        "filing_date", "source", "fetched_at",
    ],
    "cot_data": [
        "id", "market_name", "report_date", "commercial_long",
        "commercial_short", "commercial_net", "speculative_long",
        "speculative_short", "speculative_net", "open_interest",
        "source", "fetched_at",
    ],
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db(tmp_path: Path) -> DatabaseManager:
    """Yield an initialized DatabaseManager backed by a temp directory."""
    manager = DatabaseManager(db_path=tmp_path / "test.db")
    await manager.initialize()
    yield manager
    await manager.close()


@pytest_asyncio.fixture
async def uninit_db(tmp_path: Path) -> DatabaseManager:
    """Return a DatabaseManager that has NOT been initialized yet."""
    return DatabaseManager(db_path=tmp_path / "uninit.db")


# ===================================================================
# 1. Schema Creation Tests
# ===================================================================
class TestSchemaCreation:
    """Validate that schema.sql creates all expected tables and indexes."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("table", EXPECTED_TABLES, ids=lambda t: f"table-{t}")
    async def test_table_exists(self, db: DatabaseManager, table: str):
        """Each of the 11 expected tables must exist after initialization."""
        row = await db.fetch_one(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert row is not None, f"Table '{table}' not found"
        assert row["name"] == table

    @pytest.mark.asyncio
    async def test_all_11_tables_present(self, db: DatabaseManager):
        """Exactly 11 application tables must exist (excludes internal sqlite tables)."""
        rows = await db.fetch_all(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        table_names = sorted([r["name"] for r in rows])
        assert table_names == sorted(EXPECTED_TABLES)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("index", EXPECTED_INDEXES, ids=lambda i: f"index-{i}")
    async def test_index_exists(self, db: DatabaseManager, index: str):
        """Each of the 10 expected indexes must exist."""
        row = await db.fetch_one(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            (index,),
        )
        assert row is not None, f"Index '{index}' not found"

    @pytest.mark.asyncio
    async def test_all_10_indexes_present(self, db: DatabaseManager):
        """Exactly 10 custom indexes must exist (excludes autoindex)."""
        rows = await db.fetch_all(
            "SELECT name FROM sqlite_master WHERE type='index' "
            "AND name NOT LIKE 'sqlite_%'"
        )
        index_names = sorted([r["name"] for r in rows])
        assert sorted(EXPECTED_INDEXES) == index_names


# ===================================================================
# 2. Column Definitions
# ===================================================================
class TestColumnDefinitions:
    """Verify every table has the correct columns in the correct order."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "table,expected_cols",
        list(TABLE_COLUMNS.items()),
        ids=lambda t: t if isinstance(t, str) else None,
    )
    async def test_column_names(
        self, db: DatabaseManager, table: str, expected_cols: list[str]
    ):
        """Column names and count must match the schema definition."""
        rows = await db.fetch_all(f"PRAGMA table_info({table})")
        actual_cols = [r["name"] for r in rows]
        assert actual_cols == expected_cols, (
            f"Table '{table}': expected {expected_cols}, got {actual_cols}"
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "table,expected_count",
        [(t, len(c)) for t, c in TABLE_COLUMNS.items()],
        ids=lambda t: t if isinstance(t, str) else None,
    )
    async def test_column_count(
        self, db: DatabaseManager, table: str, expected_count: int
    ):
        """Column count must match the schema definition."""
        rows = await db.fetch_all(f"PRAGMA table_info({table})")
        assert len(rows) == expected_count, (
            f"Table '{table}': expected {expected_count} columns, got {len(rows)}"
        )


# ===================================================================
# 3. Constraints & Defaults
# ===================================================================
class TestConstraintsAndDefaults:
    """UNIQUE constraints, NOT NULL enforcement, and default value tests."""

    @pytest.mark.asyncio
    async def test_watchlist_symbol_unique(self, db: DatabaseManager):
        """Inserting duplicate watchlist symbols must raise IntegrityError."""
        await db.execute(
            "INSERT INTO watchlist (symbol, name) VALUES (?, ?)",
            ("AAPL", "Apple Inc"),
        )
        with pytest.raises(sqlite3.IntegrityError):
            await db.execute(
                "INSERT INTO watchlist (symbol, name) VALUES (?, ?)",
                ("AAPL", "Apple Duplicate"),
            )

    @pytest.mark.asyncio
    async def test_price_cache_composite_unique(self, db: DatabaseManager):
        """Inserting duplicate (symbol, date, source) in price_cache must fail."""
        params = ("AAPL", "2024-01-15", 100.0, 105.0, 99.0, 102.0, 1000000, "yfinance")
        await db.execute(
            "INSERT INTO price_cache (symbol, date, open, high, low, close, volume, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params,
        )
        with pytest.raises(sqlite3.IntegrityError):
            await db.execute(
                "INSERT INTO price_cache (symbol, date, open, high, low, close, volume, source) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params,
            )

    @pytest.mark.asyncio
    async def test_macro_events_composite_unique(self, db: DatabaseManager):
        """Inserting duplicate (event_name, event_date) in macro_events must fail."""
        params = ("CPI Release", "2024-01-15", 3.1, 3.2, 3.0, "high", "fred")
        await db.execute(
            "INSERT INTO macro_events "
            "(event_name, event_date, expected_value, actual_value, previous_value, impact, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            params,
        )
        with pytest.raises(sqlite3.IntegrityError):
            await db.execute(
                "INSERT INTO macro_events "
                "(event_name, event_date, expected_value, actual_value, previous_value, impact, source) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                params,
            )

    @pytest.mark.asyncio
    async def test_watchlist_added_at_default(self, db: DatabaseManager):
        """The added_at column must auto-populate via DEFAULT (datetime('now'))."""
        await db.execute(
            "INSERT INTO watchlist (symbol) VALUES (?)", ("TSLA",)
        )
        row = await db.fetch_one(
            "SELECT added_at FROM watchlist WHERE symbol = ?", ("TSLA",)
        )
        assert row is not None
        assert row["added_at"] is not None, "added_at should auto-populate"
        # Rough format check: 'YYYY-MM-DD HH:MM:SS'
        assert len(row["added_at"]) == 19

    @pytest.mark.asyncio
    async def test_watchlist_updated_at_default(self, db: DatabaseManager):
        """The updated_at column must auto-populate via DEFAULT."""
        await db.execute(
            "INSERT INTO watchlist (symbol) VALUES (?)", ("MSFT",)
        )
        row = await db.fetch_one(
            "SELECT updated_at FROM watchlist WHERE symbol = ?", ("MSFT",)
        )
        assert row is not None
        assert row["updated_at"] is not None

    @pytest.mark.asyncio
    async def test_price_cache_fetched_at_default(self, db: DatabaseManager):
        """The fetched_at column in price_cache must auto-populate."""
        await db.execute(
            "INSERT INTO price_cache (symbol, date, open, high, low, close, volume, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("GOOG", "2024-01-15", 140.0, 145.0, 139.0, 143.0, 500000, "yfinance"),
        )
        row = await db.fetch_one(
            "SELECT fetched_at FROM price_cache WHERE symbol = ?", ("GOOG",)
        )
        assert row is not None
        assert row["fetched_at"] is not None

    @pytest.mark.asyncio
    async def test_watchlist_asset_type_default(self, db: DatabaseManager):
        """The asset_type column in watchlist defaults to 'stock'."""
        await db.execute(
            "INSERT INTO watchlist (symbol) VALUES (?)", ("SPY",)
        )
        row = await db.fetch_one(
            "SELECT asset_type FROM watchlist WHERE symbol = ?", ("SPY",)
        )
        assert row is not None
        assert row["asset_type"] == "stock"


# ===================================================================
# 4. Schema Idempotency
# ===================================================================
class TestSchemaIdempotency:
    """Running the schema SQL multiple times must not error or duplicate."""

    @pytest.mark.asyncio
    async def test_double_initialization(self, tmp_path: Path):
        """Calling initialize() twice on the same db must succeed."""
        manager = DatabaseManager(db_path=tmp_path / "idempotent.db")
        await manager.initialize()
        # Second call: no error expected
        await manager.initialize()
        # Tables still present
        row = await manager.fetch_one(
            "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%'"
        )
        assert row["cnt"] == len(EXPECTED_TABLES)
        await manager.close()

    @pytest.mark.asyncio
    async def test_executescript_idempotent(self, tmp_path: Path):
        """Running schema.sql via executescript twice must not raise."""
        db_path = tmp_path / "script_test.db"
        manager = DatabaseManager(db_path=db_path)
        await manager.initialize()

        # Manually run schema a second time
        schema_sql = SCHEMA_SQL.read_text(encoding="utf-8")
        assert manager._db is not None
        await manager._db.executescript(schema_sql)

        # Verify schema_version still has exactly version 1
        row = await manager.fetch_one(
            "SELECT COUNT(*) as cnt FROM schema_version"
        )
        assert row["cnt"] == 1
        await manager.close()

    @pytest.mark.asyncio
    async def test_insert_or_ignore_schema_version(self, db: DatabaseManager):
        """INSERT OR IGNORE on schema_version must not overwrite the existing row."""
        original = await db.fetch_one(
            "SELECT description FROM schema_version WHERE version = 1"
        )
        assert original is not None
        assert original["description"] == "Initial schema"

        # Try to insert again with a different description
        await db.execute(
            "INSERT OR IGNORE INTO schema_version (version, description) "
            "VALUES (?, ?)",
            (1, "Should not overwrite"),
        )
        after = await db.fetch_one(
            "SELECT description FROM schema_version WHERE version = 1"
        )
        assert after["description"] == "Initial schema"


# ===================================================================
# 5. DatabaseManager Lifecycle
# ===================================================================
class TestDatabaseManagerLifecycle:
    """Connection open/close, WAL mode, and directory creation."""

    @pytest.mark.asyncio
    async def test_is_connected_after_init(self, db: DatabaseManager):
        """is_connected must be True after initialize()."""
        assert db.is_connected is True

    @pytest.mark.asyncio
    async def test_is_connected_false_before_init(self, uninit_db: DatabaseManager):
        """is_connected must be False before initialize()."""
        assert uninit_db.is_connected is False

    @pytest.mark.asyncio
    async def test_is_connected_false_after_close(self, tmp_path: Path):
        """is_connected must be False after close()."""
        manager = DatabaseManager(db_path=tmp_path / "close_test.db")
        await manager.initialize()
        assert manager.is_connected is True
        await manager.close()
        assert manager.is_connected is False

    @pytest.mark.asyncio
    async def test_close_is_noop_when_already_closed(self, tmp_path: Path):
        """Calling close() on an already-closed manager must not raise."""
        manager = DatabaseManager(db_path=tmp_path / "noop_close.db")
        await manager.initialize()
        await manager.close()
        # Second close: no error expected
        await manager.close()
        assert manager.is_connected is False

    @pytest.mark.asyncio
    async def test_wal_mode_enabled(self, db: DatabaseManager):
        """After initialization, journal_mode must be WAL."""
        row = await db.fetch_one("PRAGMA journal_mode")
        assert row is not None
        assert row["journal_mode"] == "wal"

    @pytest.mark.asyncio
    async def test_wal_mode_persists(self, tmp_path: Path):
        """WAL mode must persist across close and reopen."""
        db_path = tmp_path / "wal_persist.db"
        manager1 = DatabaseManager(db_path=db_path)
        await manager1.initialize()
        await manager1.close()

        # Reopen
        manager2 = DatabaseManager(db_path=db_path)
        await manager2.initialize()
        row = await manager2.fetch_one("PRAGMA journal_mode")
        assert row is not None
        assert row["journal_mode"] == "wal"
        await manager2.close()

    @pytest.mark.asyncio
    async def test_creates_parent_directory(self, tmp_path: Path):
        """initialize() must create parent directories if they do not exist."""
        nested = tmp_path / "deep" / "nested" / "dir" / "test.db"
        manager = DatabaseManager(db_path=nested)
        await manager.initialize()
        assert nested.parent.is_dir()
        assert nested.exists()
        await manager.close()

    @pytest.mark.asyncio
    async def test_db_path_property(self, tmp_path: Path):
        """db_path property must return the resolved Path."""
        expected = tmp_path / "prop_test.db"
        manager = DatabaseManager(db_path=expected)
        assert manager.db_path == expected


# ===================================================================
# 6. Query Interface
# ===================================================================
class TestQueryInterface:
    """Tests for execute(), executemany(), fetch_one(), fetch_all()."""

    @pytest.mark.asyncio
    async def test_execute_insert_and_commit(self, db: DatabaseManager):
        """execute() must insert a row and auto-commit."""
        await db.execute(
            "INSERT INTO watchlist (symbol, name) VALUES (?, ?)",
            ("NVDA", "NVIDIA Corp"),
        )
        row = await db.fetch_one(
            "SELECT symbol, name FROM watchlist WHERE symbol = ?", ("NVDA",)
        )
        assert row is not None
        assert row["symbol"] == "NVDA"
        assert row["name"] == "NVIDIA Corp"

    @pytest.mark.asyncio
    async def test_execute_returns_cursor(self, db: DatabaseManager):
        """execute() must return an aiosqlite Cursor."""
        cursor = await db.execute(
            "INSERT INTO watchlist (symbol) VALUES (?)", ("AMD",)
        )
        assert cursor is not None
        assert cursor.lastrowid is not None
        assert cursor.lastrowid > 0

    @pytest.mark.asyncio
    async def test_executemany_batch_insert(self, db: DatabaseManager):
        """executemany() must insert multiple rows in one call."""
        symbols = [("SYM1",), ("SYM2",), ("SYM3",)]
        await db.executemany(
            "INSERT INTO watchlist (symbol) VALUES (?)", symbols
        )
        rows = await db.fetch_all("SELECT symbol FROM watchlist ORDER BY symbol")
        assert len(rows) == 3
        assert [r["symbol"] for r in rows] == ["SYM1", "SYM2", "SYM3"]

    @pytest.mark.asyncio
    async def test_fetch_one_returns_dict(self, db: DatabaseManager):
        """fetch_one() must return a dict (not sqlite3.Row)."""
        await db.execute(
            "INSERT INTO watchlist (symbol, name) VALUES (?, ?)",
            ("META", "Meta Platforms"),
        )
        row = await db.fetch_one(
            "SELECT symbol, name FROM watchlist WHERE symbol = ?", ("META",)
        )
        assert isinstance(row, dict)
        assert row == {"symbol": "META", "name": "Meta Platforms"}

    @pytest.mark.asyncio
    async def test_fetch_one_returns_none_for_missing(self, db: DatabaseManager):
        """fetch_one() must return None when no row matches."""
        row = await db.fetch_one(
            "SELECT * FROM watchlist WHERE symbol = ?", ("NONEXISTENT",)
        )
        assert row is None

    @pytest.mark.asyncio
    async def test_fetch_all_returns_list_of_dicts(self, db: DatabaseManager):
        """fetch_all() must return a list of dicts."""
        await db.executemany(
            "INSERT INTO watchlist (symbol) VALUES (?)",
            [("AAA",), ("BBB",), ("CCC",)],
        )
        rows = await db.fetch_all(
            "SELECT symbol FROM watchlist ORDER BY symbol"
        )
        assert isinstance(rows, list)
        assert len(rows) == 3
        assert all(isinstance(r, dict) for r in rows)
        assert [r["symbol"] for r in rows] == ["AAA", "BBB", "CCC"]

    @pytest.mark.asyncio
    async def test_fetch_all_returns_empty_list(self, db: DatabaseManager):
        """fetch_all() must return [] when no rows match."""
        rows = await db.fetch_all(
            "SELECT * FROM watchlist WHERE symbol = ?", ("NOPE",)
        )
        assert rows == []

    @pytest.mark.asyncio
    async def test_sqlite_row_factory_produces_dict_convertible(self, db: DatabaseManager):
        """sqlite3.Row factory must produce rows convertible to dict."""
        await db.execute(
            "INSERT INTO watchlist (symbol) VALUES (?)", ("DICT_TEST",)
        )
        # Use raw connection to verify Row factory
        assert db._db is not None
        cursor = await db._db.execute(
            "SELECT * FROM watchlist WHERE symbol = ?", ("DICT_TEST",)
        )
        row = await cursor.fetchone()
        assert row is not None
        converted = dict(row)
        assert isinstance(converted, dict)
        assert converted["symbol"] == "DICT_TEST"


# ===================================================================
# 7. Migration Framework
# ===================================================================
class TestMigrations:
    """Tests for _migrate() and _get_schema_version()."""

    @pytest.mark.asyncio
    async def test_schema_version_is_1_after_init(self, db: DatabaseManager):
        """After initialization, schema version must be 1 (from schema.sql INSERT)."""
        version = await db._get_schema_version()
        assert version == 1

    @pytest.mark.asyncio
    async def test_schema_version_row_content(self, db: DatabaseManager):
        """The schema_version table must contain the initial record."""
        row = await db.fetch_one(
            "SELECT version, description FROM schema_version WHERE version = 1"
        )
        assert row is not None
        assert row["version"] == 1
        assert row["description"] == "Initial schema"

    @pytest.mark.asyncio
    async def test_migrate_applies_pending(self, tmp_path: Path):
        """_migrate() must apply registered migrations with version > current."""
        from app.data import database as db_module

        # Register a test migration
        async def _migrate_v2(conn):
            await conn.execute("ALTER TABLE watchlist ADD COLUMN notes TEXT")

        original_migrations = db_module._MIGRATIONS.copy()
        db_module._MIGRATIONS[2] = _migrate_v2
        try:
            manager = DatabaseManager(db_path=tmp_path / "migrate_test.db")
            await manager.initialize()

            # Version should be 2 now
            version = await manager._get_schema_version()
            assert version == 2

            # Column should exist
            rows = await manager.fetch_all("PRAGMA table_info(watchlist)")
            col_names = [r["name"] for r in rows]
            assert "notes" in col_names

            await manager.close()
        finally:
            db_module._MIGRATIONS.clear()
            db_module._MIGRATIONS.update(original_migrations)

    @pytest.mark.asyncio
    async def test_migrate_skips_applied(self, tmp_path: Path):
        """_migrate() must skip migrations with version <= current."""
        from app.data import database as db_module

        call_count = 0

        async def _counting_migration(conn):
            nonlocal call_count
            call_count += 1
            await conn.execute("ALTER TABLE watchlist ADD COLUMN counter_col TEXT")

        original_migrations = db_module._MIGRATIONS.copy()
        db_module._MIGRATIONS[2] = _counting_migration
        try:
            manager = DatabaseManager(db_path=tmp_path / "skip_test.db")
            await manager.initialize()
            assert call_count == 1

            # Close and re-initialize; migration should NOT run again
            await manager.close()
            manager2 = DatabaseManager(db_path=tmp_path / "skip_test.db")
            await manager2.initialize()
            assert call_count == 1  # Still 1, not 2

            await manager2.close()
        finally:
            db_module._MIGRATIONS.clear()
            db_module._MIGRATIONS.update(original_migrations)


# ===================================================================
# 8. Module-Level Singleton Functions
# ===================================================================
class TestModuleSingleton:
    """Tests for get_database() and close_database() module functions."""

    @pytest.mark.asyncio
    async def test_get_database_returns_manager(self, tmp_path: Path):
        """get_database() must return a DatabaseManager instance."""
        import app.data.database as db_module

        # Patch _resolve_db_path so the singleton uses a temp file
        db_file = tmp_path / "singleton.db"
        original_manager = db_module._manager
        db_module._manager = None
        try:
            with patch.object(db_module, "_resolve_db_path", return_value=db_file):
                manager = await get_database()
                assert isinstance(manager, DatabaseManager)
                assert manager.is_connected is True
                await close_database()
        finally:
            db_module._manager = original_manager

    @pytest.mark.asyncio
    async def test_get_database_returns_same_instance(self, tmp_path: Path):
        """get_database() must return the same singleton on repeated calls."""
        import app.data.database as db_module

        db_file = tmp_path / "singleton2.db"
        original_manager = db_module._manager
        db_module._manager = None
        try:
            with patch.object(db_module, "_resolve_db_path", return_value=db_file):
                m1 = await get_database()
                m2 = await get_database()
                assert m1 is m2
                await close_database()
        finally:
            db_module._manager = original_manager

    @pytest.mark.asyncio
    async def test_close_database_clears_singleton(self, tmp_path: Path):
        """close_database() must close the connection and set _manager to None."""
        import app.data.database as db_module

        db_file = tmp_path / "singleton3.db"
        original_manager = db_module._manager
        db_module._manager = None
        try:
            with patch.object(db_module, "_resolve_db_path", return_value=db_file):
                manager = await get_database()
                assert manager.is_connected is True
                await close_database()
                assert db_module._manager is None
        finally:
            db_module._manager = original_manager

    @pytest.mark.asyncio
    async def test_close_database_noop_when_none(self):
        """close_database() must be a no-op when _manager is None."""
        import app.data.database as db_module

        original_manager = db_module._manager
        db_module._manager = None
        try:
            # Should not raise
            await close_database()
            assert db_module._manager is None
        finally:
            db_module._manager = original_manager


# ===================================================================
# 9. Path Resolution
# ===================================================================
class TestPathResolution:
    """Tests for db_path property and _resolve_db_path()."""

    def test_db_path_returns_path_object(self, tmp_path: Path):
        """db_path property must return a Path instance."""
        manager = DatabaseManager(db_path=tmp_path / "path_test.db")
        assert isinstance(manager.db_path, Path)

    def test_db_path_accepts_string(self, tmp_path: Path):
        """DatabaseManager constructor must accept a string db_path."""
        str_path = str(tmp_path / "str_path.db")
        manager = DatabaseManager(db_path=str_path)
        assert manager.db_path == Path(str_path)

    def test_resolve_db_path_absolute(self, tmp_path: Path):
        """_resolve_db_path() returns absolute path unchanged from settings."""
        from app.data.database import _resolve_db_path

        abs_path = tmp_path / "absolute.db"
        with patch("app.data.database.get_settings") as mock_settings:
            mock_settings.return_value.database_path = abs_path
            result = _resolve_db_path()
            assert result == abs_path
            assert result.is_absolute()
