"""Market Terminal API -- FastAPI application entry point.

Configures CORS, registers global exception handlers, includes all route
modules, manages database and data-client lifecycle, and provides a
health-check endpoint with freshness metadata.

Full implementation: TASK-API-001
"""
from __future__ import annotations

import importlib
import logging
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings, validate_config
from app.exceptions import DataSourceError, RateLimitError

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------
_startup_time: float = 0.0
_config_status: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Route imports (graceful: skip if module not yet implemented)
# ---------------------------------------------------------------------------

def _import_router(module_path: str, name: str):
    """Import a router from *module_path*, returning None on ImportError."""
    try:
        mod = importlib.import_module(module_path)
        return getattr(mod, "router", None)
    except ImportError:
        logger.warning("Route module %s not available -- skipping", name)
        return None


_ticker_router = _import_router("app.api.routes.ticker", "ticker")
_news_router = _import_router("app.api.routes.news", "news")
_fundamentals_router = _import_router("app.api.routes.fundamentals", "fundamentals")
_ownership_router = _import_router("app.api.routes.ownership", "ownership")
_insider_router = None
try:
    from app.api.routes.ownership import insider_router as _insider_router  # type: ignore[assignment]
except (ImportError, AttributeError):
    pass
_macro_router = _import_router("app.api.routes.macro", "macro")
_analysis_router = _import_router("app.api.routes.analysis", "analysis")
_watchlist_router = _import_router("app.api.routes.watchlist", "watchlist")
_query_router = _import_router("app.api.routes.query", "query")
_scan_router = _import_router("app.api.routes.scan", "scan")
_websocket_router = _import_router("app.api.routes.websocket", "websocket")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    global _startup_time, _config_status

    # -- startup ---------------------------------------------------------
    logger.info("Market Terminal API starting up")
    _startup_time = time.time()

    # Validate config (API keys, database path)
    _config_status = validate_config()

    # Initialize database (WAL mode, create tables)
    try:
        from app.data.database import get_database
        await get_database()
        logger.info("Database initialized successfully")
    except Exception:
        logger.exception("Database initialization failed -- running in degraded mode")

    # Configure log level from settings
    settings = get_settings()
    logging.getLogger().setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    yield

    # -- shutdown --------------------------------------------------------
    logger.info("Market Terminal API shutting down")

    # Close data clients and database
    close_fns = [
        ("cache_manager", "app.data.cache", "close_cache_manager"),
        ("finnhub_client", "app.data.finnhub_client", "close_finnhub_client"),
        ("yfinance_client", "app.data.yfinance_client", "close_yfinance_client"),
        ("edgar_client", "app.data.edgar_client", "close_edgar_client"),
        ("ownership_client", "app.data.edgar_ownership", "close_ownership_client"),
        ("fred_client", "app.data.fred_client", "close_fred_client"),
        ("cot_client", "app.data.cot_client", "close_cot_client"),
        ("database", "app.data.database", "close_database"),
    ]
    for label, mod_path, fn_name in close_fns:
        try:
            mod = importlib.import_module(mod_path)
            fn = getattr(mod, fn_name, None)
            if fn is not None:
                await fn()
                logger.debug("Closed %s", label)
        except Exception:
            logger.warning("Error closing %s", label, exc_info=True)

    logger.info("Shutdown complete")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Market Terminal API",
    version="1.0.0",
    description="Bloomberg-style financial terminal API providing real-time "
    "and historical market data, fundamentals, news, and analysis.",
    lifespan=lifespan,
)

# -- CORS ---------------------------------------------------------------
settings = get_settings()
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
# Ensure localhost:3000 and :5173 are always included for dev
for dev_origin in ("http://localhost:3000", "http://localhost:5173"):
    if dev_origin not in _cors_origins:
        _cors_origins.append(dev_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Return structured JSON for all HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(DataSourceError)
async def data_source_error_handler(request: Request, exc: DataSourceError) -> JSONResponse:
    """502 Bad Gateway for upstream data source failures."""
    logger.warning("DataSourceError: %s", exc)
    return JSONResponse(
        status_code=502,
        content={
            "error": "Data source unavailable",
            "source": exc.source,
        },
    )


@app.exception_handler(RateLimitError)
async def rate_limit_error_handler(request: Request, exc: RateLimitError) -> JSONResponse:
    """429 Too Many Requests for rate-limited sources."""
    logger.warning("RateLimitError: %s", exc)
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limited",
            "source": exc.source,
            "retry_after": exc.retry_after,
        },
        headers={"Retry-After": str(exc.retry_after)},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """500 Internal Server Error for unhandled exceptions."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
for _router in (
    _ticker_router,
    _news_router,
    _fundamentals_router,
    _ownership_router,
    _insider_router,
    _macro_router,
    _analysis_router,
    _watchlist_router,
    _query_router,
    _scan_router,
    _websocket_router,
):
    if _router is not None:
        app.include_router(_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["health"])
async def health_check() -> dict:
    """Liveness probe with database, API key status, and uptime."""
    # Database status
    db_status = "unknown"
    try:
        from app.data.database import get_database
        db = await get_database()
        row = await db.fetch_one("SELECT 1")
        db_status = "connected" if row is not None else "error"
    except Exception:
        db_status = "error"

    # API key status
    api_keys = {
        "finnhub": "configured" if _config_status.get("finnhub") == "available" else "missing",
        "fred": "configured" if _config_status.get("fred") == "available" else "missing",
        "alpha_vantage": "configured" if _config_status.get("alpha_vantage") == "available" else "missing",
    }

    uptime = time.time() - _startup_time if _startup_time > 0 else 0.0

    return {
        "status": "ok",
        "version": "1.0.0",
        "database": db_status,
        "api_keys": api_keys,
        "uptime_seconds": round(uptime, 1),
    }


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
