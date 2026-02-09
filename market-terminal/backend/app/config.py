"""Environment configuration for Market Terminal.

Uses ``pydantic-settings`` to load configuration from ``.env`` files with
type-safe defaults.  Provides :func:`get_settings` (cached singleton) and
:func:`validate_config` (startup health-check that never crashes).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Dict

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# .env file discovery
# ---------------------------------------------------------------------------

def _find_env_file() -> Path | None:
    """Walk up from CWD looking for a ``.env`` next to a ``backend/`` dir."""
    current = Path.cwd().resolve()
    for directory in (current, *current.parents):
        candidate = directory / ".env"
        if candidate.is_file():
            return candidate
        # Also check if this looks like the project root
        if (directory / "backend").is_dir() and (directory / ".env").exists():
            return directory / ".env"
    return None


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class Settings(BaseSettings):
    """All Market Terminal configuration in a single flat model.

    Values are loaded from environment variables and/or a ``.env`` file.
    Every field has a sensible default so the app can start without any
    configuration at all (in degraded mode).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -- API keys -------------------------------------------------------------
    finnhub_api_key: str = ""
    fred_api_key: str = ""
    alpha_vantage_api_key: str = ""

    # -- SEC EDGAR ------------------------------------------------------------
    sec_edgar_user_agent: str = "MarketTerminal user@example.com"

    # -- Server ---------------------------------------------------------------
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_port: int = 3000
    cors_origins: str = "http://localhost:3000"

    # -- Database -------------------------------------------------------------
    database_path: Path = Path("data/market_terminal.db")

    # -- Cache TTL (seconds) --------------------------------------------------
    cache_ttl_price: int = 900
    cache_ttl_fundamentals: int = 86400
    cache_ttl_news: int = 3600
    cache_ttl_macro: int = 43200
    cache_ttl_cot: int = 604800
    cache_ttl_ownership: int = 86400
    cache_ttl_insider: int = 14400
    cache_ttl_analysis: int = 3600

    # -- Circuit breaker ------------------------------------------------------
    circuit_breaker_failure_threshold: int = 3
    circuit_breaker_window_seconds: int = 300
    circuit_breaker_cooldown_seconds: int = 900

    # -- Sentiment ------------------------------------------------------------
    sentiment_use_lightweight: bool = False

    # -- Logging --------------------------------------------------------------
    log_level: str = "INFO"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton.

    The ``.env`` file is discovered by walking up from the current working
    directory.  If no file is found the built-in defaults are used.
    """
    env_path = _find_env_file()
    if env_path is not None:
        return Settings(_env_file=env_path)
    return Settings(_env_file=None)


# ---------------------------------------------------------------------------
# Startup validation
# ---------------------------------------------------------------------------

def _mask(key: str) -> str:
    """Return a masked version of *key* showing at most 4 leading characters."""
    if len(key) <= 6:
        return "****"
    return key[:4] + "****"


def validate_config() -> Dict[str, str]:
    """Check every data-source key and log a human-friendly summary.

    Returns a dict mapping service names to one of
    ``"available"``, ``"missing"``, or ``"default_placeholder"``.

    This function **never** raises; any unexpected error is caught and
    logged so the application can still start in degraded mode.
    """
    try:
        return _validate_config_inner()
    except Exception:
        logger.exception("Unexpected error during config validation")
        return {}


def _validate_config_inner() -> Dict[str, str]:
    settings = get_settings()
    status: Dict[str, str] = {}

    # -- API keys ----------------------------------------------------------
    api_keys = [
        ("Finnhub API", settings.finnhub_api_key, "finnhub", False),
        ("FRED API", settings.fred_api_key, "fred", False),
        ("Alpha Vantage", settings.alpha_vantage_api_key, "alpha_vantage", True),
    ]

    lines: list[str] = ["", "=== Market Terminal Configuration ==="]

    for display_name, value, key_name, is_optional in api_keys:
        if value:
            status[key_name] = "available"
            lines.append(f"  {display_name + ':':<20s} CONFIGURED ({_mask(value)})")
            logger.info("%s: CONFIGURED (%s)", display_name, _mask(value))
        else:
            status[key_name] = "missing"
            label = "optional" if is_optional else "recommended"
            extra = ""
            if key_name == "finnhub":
                extra = " - get free key at https://finnhub.io/register"
            elif key_name == "fred":
                extra = " - get free key at https://fred.stlouisfed.org/docs/api/api_key.html"
            elif key_name == "alpha_vantage":
                extra = " - fallback data source"
            lines.append(
                f"  {display_name + ':':<20s} NOT CONFIGURED ({label}{extra})"
            )
            if is_optional:
                logger.info("%s: NOT CONFIGURED (%s%s)", display_name, label, extra)
            else:
                logger.warning("%s: NOT CONFIGURED (%s%s)", display_name, label, extra)

    # -- SEC EDGAR ---------------------------------------------------------
    edgar_ua = settings.sec_edgar_user_agent
    if "user@example.com" in edgar_ua:
        status["sec_edgar"] = "default_placeholder"
        lines.append(
            "  SEC EDGAR:          DEFAULT PLACEHOLDER (update SEC_EDGAR_USER_AGENT)"
        )
        logger.warning(
            "SEC EDGAR: using default placeholder User-Agent — "
            "update SEC_EDGAR_USER_AGENT in your .env"
        )
    else:
        status["sec_edgar"] = "available"
        lines.append("  SEC EDGAR:          CONFIGURED (User-Agent set)")
        logger.info("SEC EDGAR: CONFIGURED (User-Agent set)")

    # -- Always-available sources ------------------------------------------
    lines.append("  yfinance:           AVAILABLE (no key needed)")
    lines.append("  CFTC COT:           AVAILABLE (public data)")
    status["yfinance"] = "available"
    status["cot"] = "available"

    # -- Database ----------------------------------------------------------
    db_path = settings.database_path
    if not db_path.is_absolute():
        # Resolve relative to project root (where .env lives)
        env_file = _find_env_file()
        if env_file is not None:
            db_path = env_file.parent / db_path
        else:
            db_path = Path.cwd() / db_path

    db_dir = db_path.parent
    try:
        db_dir.mkdir(parents=True, exist_ok=True)
        status["database"] = "available"
        lines.append(f"  Database:           {settings.database_path}")
        logger.info("Database path: %s (directory ready)", db_path)
    except OSError as exc:
        status["database"] = "missing"
        lines.append(f"  Database:           ERROR creating directory ({exc})")
        logger.warning("Cannot create database directory %s: %s", db_dir, exc)

    # -- Sentiment mode ----------------------------------------------------
    mode = "Lightweight (dictionary)" if settings.sentiment_use_lightweight else "FinBERT (full model)"
    lines.append(f"  Sentiment Mode:     {mode}")

    lines.append("=" * 42)
    logger.info("\n".join(lines))

    return status
