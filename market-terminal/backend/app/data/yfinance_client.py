"""Async yfinance fallback data client for Market Terminal.

Provides a singleton :class:`YFinanceClient` with circuit-breaker protection,
async wrapping of synchronous yfinance calls via ``asyncio.to_thread()``,
and metadata tagging on all responses.

This is the SECONDARY/FALLBACK data source.  yfinance scrapes Yahoo Finance
and is an unofficial API -- data should be cross-referenced against primary
sources (Finnhub, EDGAR) whenever possible.

Full implementation: TASK-DATA-006
"""
from __future__ import annotations

import asyncio
import enum
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

_ASYNC_TIMEOUT = 10.0  # seconds for asyncio.wait_for wrapping yfinance calls


class CircuitState(enum.Enum):
    """Circuit breaker states: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class YFinanceClient:
    """Async wrapper around yfinance with circuit-breaker protection.

    All yfinance calls are synchronous; they are executed via
    ``asyncio.to_thread()`` with a 10-second timeout so the event loop is
    never blocked.  Every response dict includes ``_source: "yfinance"``
    and ``_is_fallback: True``.
    """

    def __init__(self) -> None:
        settings = get_settings()
        # Circuit breaker configuration
        self._cb_failure_threshold: int = settings.circuit_breaker_failure_threshold
        self._cb_window_seconds: int = settings.circuit_breaker_window_seconds
        self._cb_cooldown_seconds: int = settings.circuit_breaker_cooldown_seconds
        # Deferred import -- yfinance is optional
        self._yf: Any = None
        self._enabled: bool = False
        try:
            import yfinance as yf  # noqa: F811
            self._yf = yf
            self._enabled = True
        except ImportError:
            logger.warning(
                "yfinance package not installed -- YFinanceClient disabled. "
                "Install with: pip install yfinance"
            )
        if self._enabled:
            logger.info(
                "yfinance client initialized (SECONDARY source - unofficial API)"
            )
        # Circuit breaker state
        self._circuit_state: CircuitState = CircuitState.CLOSED
        self._failure_timestamps: deque[float] = deque()
        self._circuit_opened_at: float = 0.0

    # -- properties ---------------------------------------------------------

    @property
    def is_enabled(self) -> bool:
        """Return *True* if yfinance is installed and the client can operate."""
        return self._enabled

    @property
    def circuit_state(self) -> str:
        """Return the current circuit breaker state as a string."""
        return self._circuit_state.value

    # -- lifecycle ----------------------------------------------------------

    async def close(self) -> None:
        """Clean up resources.  Safe to call multiple times."""
        logger.info("YFinanceClient closed")

    # -- circuit breaker ----------------------------------------------------

    def _record_failure(self) -> None:
        """Record a failed request and potentially open the circuit."""
        now = time.monotonic()
        self._failure_timestamps.append(now)
        # Prune old failures outside the window
        cutoff = now - self._cb_window_seconds
        while self._failure_timestamps and self._failure_timestamps[0] < cutoff:
            self._failure_timestamps.popleft()
        # Check threshold
        if len(self._failure_timestamps) >= self._cb_failure_threshold:
            if self._circuit_state != CircuitState.OPEN:
                logger.warning(
                    "yfinance circuit breaker: %s -> OPEN (%d failures in %ds)",
                    self._circuit_state.value,
                    len(self._failure_timestamps),
                    self._cb_window_seconds,
                )
                self._circuit_state = CircuitState.OPEN
                self._circuit_opened_at = now

    def _record_success(self) -> None:
        """Record a successful request; close the breaker if half-open."""
        if self._circuit_state == CircuitState.HALF_OPEN:
            logger.info("yfinance circuit breaker: HALF_OPEN -> CLOSED")
            self._circuit_state = CircuitState.CLOSED
            self._failure_timestamps.clear()

    def _check_circuit(self) -> bool:
        """Return *True* if the circuit allows a request through."""
        if self._circuit_state == CircuitState.CLOSED:
            return True
        if self._circuit_state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._circuit_opened_at
            if elapsed >= self._cb_cooldown_seconds:
                logger.info(
                    "yfinance circuit breaker: OPEN -> HALF_OPEN (cooldown elapsed)"
                )
                self._circuit_state = CircuitState.HALF_OPEN
                return True
            return False
        return True  # HALF_OPEN -- allow one test request

    # -- async wrapping -----------------------------------------------------

    async def _run_sync(self, func: Any, *args: Any) -> Any:
        """Run a synchronous *func* in a thread with timeout.  Never raises."""
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(func, *args),
                timeout=_ASYNC_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.warning("yfinance timeout after %.0fs", _ASYNC_TIMEOUT)
            self._record_failure()
            return None
        except Exception as exc:
            logger.warning("yfinance error: %s: %s", type(exc).__name__, exc)
            self._record_failure()
            return None

    # -- metadata -----------------------------------------------------------

    @staticmethod
    def _add_metadata(data: dict | list) -> dict | list:
        """Tag every dict in *data* with source and fallback markers."""
        now = datetime.now(timezone.utc).isoformat()
        items: list[Any]
        if isinstance(data, dict):
            items = [data]
        elif isinstance(data, list):
            items = data
        else:
            items = []
        for item in items:
            if isinstance(item, dict):
                item["_source"] = "yfinance"
                item["_fetched_at"] = now
                item["_is_fallback"] = True
        return data

    # -- validation ---------------------------------------------------------

    @staticmethod
    def _validate_quote(data: dict) -> bool:
        """Validate quote data is reasonable."""
        price = data.get("current_price")
        if price is None or price <= 0:
            return False
        if data.get("volume") is not None and data["volume"] < 0:
            return False
        return True

    @staticmethod
    def _validate_historical(data: list[dict]) -> bool:
        """Validate historical data is not empty or malformed."""
        if not data:
            return False
        for bar in data:
            for field in ("open", "high", "low", "close"):
                val = bar.get(field)
                if val is not None and val < 0:
                    return False
        return True

    # -- DataFrame helper ---------------------------------------------------

    @staticmethod
    def _df_to_records(df: Any) -> list[dict[str, Any]]:
        """Convert a pandas DataFrame to a list of dicts, handling None/NaN.

        Financial DataFrames from yfinance have dates as *columns* and
        line-items as *index*, so we iterate over columns to produce one
        record per reporting period.
        """
        if df is None or (hasattr(df, "empty") and df.empty):
            return []
        import pandas as pd
        records: list[dict[str, Any]] = []
        for col in df.columns:
            period = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
            row_data: dict[str, Any] = {"period": period}
            for idx_name, val in df[col].items():
                key = str(idx_name).lower().replace(" ", "_")
                row_data[key] = float(val) if pd.notna(val) else None
            records.append(row_data)
        return records

    # -- public API: quotes -------------------------------------------------

    async def get_quote(self, symbol: str) -> dict[str, Any] | None:
        """Get current price quote from yfinance."""
        if not self._enabled:
            return None
        if not self._check_circuit():
            return None
        start = time.monotonic()
        logger.info("yfinance: get_quote(%s) - starting", symbol)
        yf = self._yf

        def _sync() -> dict:
            ticker = yf.Ticker(symbol)
            return ticker.info or {}

        info = await self._run_sync(_sync)
        if info is None:
            return None
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        if not price or price <= 0:
            logger.warning("yfinance: get_quote(%s) - no valid price in response", symbol)
            self._record_failure()
            return None
        result: dict[str, Any] = {
            "symbol": symbol.upper(),
            "current_price": price,
            "change": info.get("regularMarketChange"),
            "percent_change": info.get("regularMarketChangePercent"),
            "high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "open": info.get("open") or info.get("regularMarketOpen"),
            "previous_close": info.get("regularMarketPreviousClose"),
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "market_cap": info.get("marketCap"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if not self._validate_quote(result):
            logger.warning("yfinance: get_quote(%s) - validation failed", symbol)
            self._record_failure()
            return None
        self._record_success()
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info("yfinance: get_quote(%s) - success (%.0fms)", symbol, elapsed_ms)
        return self._add_metadata(result)

    # -- public API: historical data ----------------------------------------

    async def get_historical(
        self, symbol: str, period: str = "1y", interval: str = "1d",
    ) -> list[dict[str, Any]] | None:
        """Get historical OHLCV bars from yfinance."""
        if not self._enabled:
            return None
        if not self._check_circuit():
            return None
        start = time.monotonic()
        logger.info("yfinance: get_historical(%s, %s, %s) - starting", symbol, period, interval)
        yf = self._yf

        def _sync():
            return yf.download(symbol, period=period, interval=interval, progress=False)

        df = await self._run_sync(_sync)
        if df is None or (hasattr(df, "empty") and df.empty):
            logger.warning("yfinance: get_historical(%s) - empty or None dataframe", symbol)
            self._record_failure()
            return None
        import pandas as pd

        # yfinance >= 0.2.31 returns MultiIndex columns like ('Close', 'MSFT').
        # Flatten to single-level ('Close', 'Open', ...) so row access works.
        if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
            df.columns = df.columns.droplevel(1)

        # Ensure index is sorted and unique to prevent chart assertion errors
        df = df.sort_index()
        df = df[~df.index.duplicated(keep="first")]

        # Define intervals that are treated as intraday (require time component)
        intraday_intervals = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"}
        is_intraday = interval in intraday_intervals

        records: list[dict[str, Any]] = []
        for idx, row in df.iterrows():
            if is_intraday:
                date_str = idx.isoformat()
            elif hasattr(idx, "strftime"):
                date_str = idx.strftime("%Y-%m-%d")
            else:
                date_str = str(idx)
            rec: dict[str, Any] = {"date": date_str}
            for col_name, out_key in (
                ("Open", "open"), ("High", "high"), ("Low", "low"),
                ("Close", "close"), ("Adj Close", "adjusted_close"),
            ):
                val = row.get(col_name)
                if val is not None and not isinstance(val, float):
                    # Guard against Series (shouldn't happen after flatten, but be safe)
                    try:
                        val = float(val)
                    except (TypeError, ValueError):
                        val = None
                rec[out_key] = float(val) if val is not None and pd.notna(val) else None
            vol = row.get("Volume")
            if vol is not None and not isinstance(vol, (int, float)):
                try:
                    vol = int(vol)
                except (TypeError, ValueError):
                    vol = None
            rec["volume"] = int(vol) if vol is not None and pd.notna(vol) else None
            records.append(rec)
        if not self._validate_historical(records):
            logger.warning("yfinance: get_historical(%s) - validation failed", symbol)
            self._record_failure()
            return None
        self._record_success()
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info(
            "yfinance: get_historical(%s) - success (%.0fms, %d bars)",
            symbol, elapsed_ms, len(records),
        )
        return self._add_metadata(records)

    # -- public API: company info -------------------------------------------

    async def get_info(self, symbol: str) -> dict[str, Any] | None:
        """Get company information from yfinance."""
        if not self._enabled:
            return None
        if not self._check_circuit():
            return None
        start = time.monotonic()
        logger.info("yfinance: get_info(%s) - starting", symbol)
        yf = self._yf

        def _sync() -> dict:
            ticker = yf.Ticker(symbol)
            return ticker.info or {}

        info = await self._run_sync(_sync)
        if info is None or not info:
            logger.warning("yfinance: get_info(%s) - empty or None response", symbol)
            self._record_failure()
            return None
        result: dict[str, Any] = {
            "symbol": symbol.upper(),
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("exchange"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "eps": info.get("trailingEps"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageDailyVolume10Day"),
            "shares_outstanding": info.get("sharesOutstanding"),
            "heldPercentInstitutions": info.get("heldPercentInstitutions"),
            "_reliability": "low - unofficial API, verify against SEC filings",
        }
        self._record_success()
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info("yfinance: get_info(%s) - success (%.0fms)", symbol, elapsed_ms)
        return self._add_metadata(result)

    # -- public API: financials ---------------------------------------------

    async def get_financials(self, symbol: str) -> dict[str, Any] | None:
        """Get quarterly financial statements from yfinance."""
        if not self._enabled:
            return None
        if not self._check_circuit():
            return None
        start = time.monotonic()
        logger.info("yfinance: get_financials(%s) - starting", symbol)
        yf = self._yf

        def _sync() -> dict[str, Any]:
            ticker = yf.Ticker(symbol)
            return {
                "income": ticker.quarterly_income_stmt,
                "balance": ticker.quarterly_balance_sheet,
                "cashflow": ticker.quarterly_cashflow,
                "annual_income": ticker.income_stmt,
                "annual_balance": ticker.balance_sheet,
                "annual_cashflow": ticker.cashflow,
            }

        raw = await self._run_sync(_sync)
        if raw is None:
            logger.warning("yfinance: get_financials(%s) - None response", symbol)
            self._record_failure()
            return None
        result: dict[str, Any] = {
            "symbol": symbol.upper(),
            "income_statement": self._df_to_records(raw.get("income")),
            "balance_sheet": self._df_to_records(raw.get("balance")),
            "cash_flow": self._df_to_records(raw.get("cashflow")),
            "annual_income_statement": self._df_to_records(raw.get("annual_income")),
            "annual_balance_sheet": self._df_to_records(raw.get("annual_balance")),
            "annual_cash_flow": self._df_to_records(raw.get("annual_cashflow")),
            "_reliability": "low - use EDGAR (TASK-DATA-003) as primary source",
        }
        self._record_success()
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info("yfinance: get_financials(%s) - success (%.0fms)", symbol, elapsed_ms)
        return self._add_metadata(result)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: YFinanceClient | None = None


def get_yfinance_client() -> YFinanceClient:
    """Return the singleton :class:`YFinanceClient`, creating it on first call."""
    global _client
    if _client is None:
        _client = YFinanceClient()
    return _client


async def close_yfinance_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
