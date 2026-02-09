"""Async SQLite database manager for Market Terminal.

Provides a singleton :class:`DatabaseManager` with WAL mode, dict-based row
returns, schema initialization, and forward-only migrations.

Full implementation: TASK-DATA-001
"""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import Any, Iterable

import aiosqlite

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_manager: DatabaseManager | None = None


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
def _resolve_db_path() -> Path:
    """Resolve the configured database_path to an absolute path.

    Mirrors the resolution logic in ``config.validate_config()``:
    * If the path is already absolute, return it unchanged.
    * Otherwise walk up from CWD looking for a ``.env`` file or a directory
      that contains a ``backend/`` subdirectory (i.e. the project root) and
      resolve relative to that.
    * Falls back to CWD if nothing is found.
    """
    settings = get_settings()
    db_path = settings.database_path
    if db_path.is_absolute():
        return db_path
    current = Path.cwd().resolve()
    for directory in (current, *current.parents):
        if (directory / ".env").is_file():
            return directory / db_path
        if (directory / "backend").is_dir():
            return directory / db_path
    return current / db_path


# ---------------------------------------------------------------------------
# DatabaseManager
# ---------------------------------------------------------------------------
class DatabaseManager:
    """Async SQLite database manager with WAL mode and dict rows.

    Parameters
    ----------
    db_path
        Explicit database file path.  When *None* the path is resolved from
        ``app.config.get_settings().database_path``.
    """

    def __init__(self, db_path: Path | str | None = None) -> None:
        if db_path is None:
            db_path = _resolve_db_path()
        self._db_path = Path(db_path)
        self._db: aiosqlite.Connection | None = None

    # -- properties ---------------------------------------------------------

    @property
    def is_connected(self) -> bool:
        """Return *True* if the database connection is open."""
        return self._db is not None

    @property
    def db_path(self) -> Path:
        """Return the resolved database file path."""
        return self._db_path

    # -- lifecycle ----------------------------------------------------------

    async def initialize(self) -> None:
        """Open connection, enable WAL/FK, create schema, run migrations.

        Creates the parent directory if it does not exist.  Safe to call
        multiple times — all DDL uses ``IF NOT EXISTS``.
        """
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

        self._db = await aiosqlite.connect(str(self._db_path))
        self._db.row_factory = sqlite3.Row

        # WAL mode for concurrent reads from WebSocket handlers
        wal_result = await self._db.execute("PRAGMA journal_mode=WAL")
        row = await wal_result.fetchone()
        logger.info("SQLite journal mode: %s", row[0] if row else "unknown")

        # Foreign key enforcement
        await self._db.execute("PRAGMA foreign_keys=ON")

        # Apply schema
        schema_path = Path(__file__).parent / "schema.sql"
        schema_sql = schema_path.read_text(encoding="utf-8")
        await self._db.executescript(schema_sql)

        # Run pending migrations
        await self._migrate()

        logger.info("Database initialized at %s", self._db_path)

    async def close(self) -> None:
        """Close the database connection.  No-op if already closed."""
        if self._db is not None:
            await self._db.close()
            self._db = None
            logger.info("Database connection closed")

    # -- query interface ----------------------------------------------------

    async def execute(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> aiosqlite.Cursor:
        """Execute a single SQL statement, commit, and return the cursor."""
        assert self._db is not None, (
            "Database not initialized. Call initialize() first."
        )
        cursor = await self._db.execute(sql, params)
        await self._db.commit()
        return cursor

    async def executemany(
        self, sql: str, params_seq: Iterable[tuple[Any, ...]]
    ) -> None:
        """Execute *sql* against each parameter set in *params_seq* and commit."""
        assert self._db is not None, "Database not initialized."
        await self._db.executemany(sql, params_seq)
        await self._db.commit()

    async def fetch_one(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> dict[str, Any] | None:
        """Execute *sql* and return a single row as a dict, or *None*."""
        assert self._db is not None, "Database not initialized."
        cursor = await self._db.execute(sql, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def fetch_all(
        self, sql: str, params: tuple[Any, ...] = ()
    ) -> list[dict[str, Any]]:
        """Execute *sql* and return all rows as a list of dicts."""
        assert self._db is not None, "Database not initialized."
        cursor = await self._db.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    # -- migrations ---------------------------------------------------------

    async def _migrate(self) -> None:
        """Apply pending forward-only migrations in version order."""
        current = await self._get_schema_version()
        for version in sorted(_MIGRATIONS.keys()):
            if version > current:
                logger.info("Applying migration v%d", version)
                await _MIGRATIONS[version](self._db)
                await self._db.execute(
                    "INSERT OR REPLACE INTO schema_version "
                    "(version, description) VALUES (?, ?)",
                    (version, f"Migration v{version}"),
                )
                await self._db.commit()
                logger.info("Migration v%d applied", version)

    async def _get_schema_version(self) -> int:
        """Return the current (highest) schema version, or 0."""
        try:
            cursor = await self._db.execute(
                "SELECT MAX(version) FROM schema_version"
            )
            row = await cursor.fetchone()
            return row[0] if row and row[0] is not None else 0
        except Exception:
            return 0


# ---------------------------------------------------------------------------
# Forward-only migration registry
# ---------------------------------------------------------------------------
_MIGRATIONS: dict[int, Any] = {
    # Register future migrations here:
    #   async def _migrate_v2(db: aiosqlite.Connection) -> None:
    #       await db.execute("ALTER TABLE watchlist ADD COLUMN notes TEXT")
    #   _MIGRATIONS[2] = _migrate_v2
}


# ---------------------------------------------------------------------------
# Module-level convenience functions
# ---------------------------------------------------------------------------
async def get_database() -> DatabaseManager:
    """Return the singleton DatabaseManager, initializing on first call."""
    global _manager
    if _manager is None:
        _manager = DatabaseManager()
    if not _manager.is_connected:
        await _manager.initialize()
    return _manager


async def close_database() -> None:
    """Close the singleton database connection and clear the reference."""
    global _manager
    if _manager is not None:
        await _manager.close()
        _manager = None
