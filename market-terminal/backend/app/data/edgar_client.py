"""Async SEC EDGAR financials client for Market Terminal.

Wraps the synchronous ``edgartools`` library with async helpers, a shared
10-req/s rate limiter (SEC fair-access policy), SQLite cache integration
(``fundamentals_cache`` table, 24 h TTL), and response metadata tagging.

Full implementation: TASK-DATA-003
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.data.database import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level rate limiter (shared with future edgar_ownership_client.py)
# ---------------------------------------------------------------------------
_EDGAR_MAX_CALLS_PER_SECOND = 10
_edgar_call_timestamps: deque[float] = deque()
_edgar_rate_lock: asyncio.Lock | None = None
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _get_edgar_rate_lock() -> asyncio.Lock:
    global _edgar_rate_lock
    if _edgar_rate_lock is None:
        _edgar_rate_lock = asyncio.Lock()
    return _edgar_rate_lock


async def _wait_for_edgar_rate_limit() -> None:
    """Block until a request slot is available (sliding 1-s window, 10 req)."""
    lock = _get_edgar_rate_lock()
    async with lock:
        now = time.monotonic()
        while _edgar_call_timestamps and _edgar_call_timestamps[0] < now - 1.0:
            _edgar_call_timestamps.popleft()
        if len(_edgar_call_timestamps) >= _EDGAR_MAX_CALLS_PER_SECOND:
            wait = 1.0 - (now - _edgar_call_timestamps[0])
            if wait > 0:
                await asyncio.sleep(wait)
                now = time.monotonic()
                while _edgar_call_timestamps and _edgar_call_timestamps[0] < now - 1.0:
                    _edgar_call_timestamps.popleft()
        _edgar_call_timestamps.append(now)


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def _safe_div(num: float | None, den: float | None) -> float | None:
    if num is None or den is None or den == 0:
        return None
    try:
        return round(num / den, 6)
    except (TypeError, ZeroDivisionError):
        return None


def _safe_growth(cur: float | None, prev: float | None) -> float | None:
    if cur is None or prev is None or prev == 0:
        return None
    try:
        return round((cur - prev) / abs(prev), 6)
    except (TypeError, ZeroDivisionError):
        return None


def _extract_value(df: Any, col: str, matchers: list[str]) -> float | None:
    """Find a row matching *matchers* and return the cell for *col*.

    Exact match on ``standard_concept`` first, then substring on ``label``.
    Skips abstract / dimension rows.
    """
    try:
        for _, row in df.iterrows():
            if row.get("abstract") is True:
                continue
            dim = row.get("dimension")
            if dim is not None and dim is not False and dim != "":
                continue
            sc = str(row.get("standard_concept", "") or "")
            label = str(row.get("label", "") or "")
            for m in matchers:
                if sc == m or m.lower() in label.lower():
                    val = row.get(col)
                    if val is not None:
                        try:
                            return float(val)
                        except (TypeError, ValueError):
                            return None
    except Exception:
        pass
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tag(data: dict | list, cached: bool = False) -> dict | list:
    """Attach ``_source``, ``_fetched_at``, ``_cached`` metadata."""
    now = _now_iso()
    items = [data] if isinstance(data, dict) else (data if isinstance(data, list) else [])
    for item in items:
        if isinstance(item, dict):
            item.update({"_source": "edgar", "_fetched_at": now, "_cached": cached})
    return data


# ---------------------------------------------------------------------------
# EdgarClient
# ---------------------------------------------------------------------------
class EdgarClient:
    """Async wrapper around *edgartools* with caching and rate limiting."""

    def __init__(self) -> None:
        settings = get_settings()
        self._user_agent: str = settings.sec_edgar_user_agent
        self._cache_ttl: int = settings.cache_ttl_fundamentals
        self._identity_set: bool = False

    # -- lifecycle ----------------------------------------------------------

    def _ensure_identity(self) -> None:
        if not self._identity_set:
            from edgar import set_identity  # type: ignore[import-untyped]
            set_identity(self._user_agent)
            self._identity_set = True
            logger.info("EDGAR identity set: %s", self._user_agent)

    async def close(self) -> None:
        """No persistent connection; matches singleton pattern."""
        logger.info("EdgarClient closed")

    # -- cache helpers ------------------------------------------------------

    async def _get_cached(self, symbol: str, data_type: str, period: str = "latest") -> dict | list | None:
        """Return parsed JSON from ``fundamentals_cache`` if within TTL."""
        db = await get_database()
        row = await db.fetch_one(
            "SELECT value_json, fetched_at FROM fundamentals_cache "
            "WHERE symbol = ? AND data_type = ? AND period = ? AND source = 'edgar'",
            (symbol.upper(), data_type, period),
        )
        if row is None:
            return None
        try:
            fetched_dt = datetime.fromisoformat(row["fetched_at"])
            if fetched_dt.tzinfo is None:
                fetched_dt = fetched_dt.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - fetched_dt).total_seconds() > self._cache_ttl:
                return None
        except (ValueError, TypeError):
            return None
        try:
            return json.loads(row["value_json"])
        except (json.JSONDecodeError, TypeError):
            return None

    async def _store_cache(self, symbol: str, data_type: str, data: Any, period: str = "latest") -> None:
        """Upsert *data* as JSON into ``fundamentals_cache``."""
        db = await get_database()
        await db.execute(
            "INSERT OR REPLACE INTO fundamentals_cache "
            "(symbol, data_type, period, value_json, source, fetched_at) "
            "VALUES (?, ?, ?, ?, 'edgar', datetime('now'))",
            (symbol.upper(), data_type, period, json.dumps(data)),
        )

    # -- sync helpers (run in thread) ---------------------------------------

    def _sync_company(self, symbol: str) -> Any:
        self._ensure_identity()
        from edgar import Company  # type: ignore[import-untyped]
        return Company(symbol.upper())

    async def _get_company_obj(self, symbol: str) -> Any | None:
        """Rate-limit, fetch Company, return None if not found."""
        await _wait_for_edgar_rate_limit()
        company = await asyncio.to_thread(self._sync_company, symbol)
        if company is None or getattr(company, "not_found", False):
            logger.info("EDGAR company not found: %s", symbol)
            return None
        return company

    # -- statement parsing --------------------------------------------------

    @staticmethod
    def _parse_statement(df: Any, field_map: dict[str, list[str]], periods: int = 8) -> list[dict[str, Any]]:
        """Extract financial data from a Statement DataFrame.

        Returns one dict per date column, most-recent first.
        """
        date_cols = sorted(
            [c for c in df.columns if _DATE_RE.match(str(c))], reverse=True
        )[:periods]
        results: list[dict[str, Any]] = []
        for col in date_cols:
            record: dict[str, Any] = {"period": col}
            for field_name, matchers in field_map.items():
                record[field_name] = _extract_value(df, col, matchers)
            results.append(record)
        return results

    # -- internal: fetch + parse a financial statement ----------------------

    async def _fetch_statement(
        self, symbol: str, stmt_type: str, field_map: dict[str, list[str]], periods: int,
    ) -> list[dict[str, Any]] | None:
        try:
            company = await self._get_company_obj(symbol)
            if company is None:
                return None
            await _wait_for_edgar_rate_limit()
            financials = await asyncio.to_thread(company.get_financials)
            if financials is None:
                return None
            stmt_method = {
                "income_statement": financials.income_statement,
                "balance_sheet": financials.balance_sheet,
                "cash_flow": financials.cashflow_statement,
            }.get(stmt_type)
            if stmt_method is None:
                return None
            await _wait_for_edgar_rate_limit()
            stmt = await asyncio.to_thread(stmt_method)
            if stmt is None:
                return None
            await _wait_for_edgar_rate_limit()
            df = await asyncio.to_thread(stmt.to_dataframe)
            return self._parse_statement(df, field_map, periods)
        except Exception as exc:
            logger.warning("EDGAR _fetch_statement(%s, %s): %s", symbol, stmt_type, exc)
            return None

    # ======================================================================
    # Public API (7 methods)
    # ======================================================================

    async def get_company(self, symbol: str) -> dict[str, Any] | None:
        """Return ``{cik, name, ticker, sic_code, fiscal_year_end}`` or *None*."""
        try:
            company = await self._get_company_obj(symbol)
            if company is None:
                return None
            result: dict[str, Any] = {
                "cik": getattr(company, "cik", None),
                "name": getattr(company, "name", None),
                "ticker": symbol.upper(),
                "sic_code": getattr(company, "sic", None),
                "fiscal_year_end": getattr(company, "fiscal_year_end", None),
            }
            return _tag(result)  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("EDGAR get_company(%s): %s", symbol, exc)
            return None

    async def get_income_statement(self, symbol: str, periods: int = 8) -> list[dict[str, Any]] | None:
        """Return income-statement data for the most recent *periods*."""
        cached = await self._get_cached(symbol, "income_statement")
        if cached is not None and isinstance(cached, list):
            return _tag(cached, cached=True)  # type: ignore[return-value]
        field_map: dict[str, list[str]] = {
            "revenue": ["Revenue", "Revenues", "Net sales",
                        "RevenueFromContractWithCustomerExcludingAssessedTax"],
            "cost_of_revenue": ["CostOfGoodsAndServicesSold", "CostOfRevenue", "Cost of"],
            "gross_profit": ["GrossProfit", "Gross profit", "Gross Profit"],
            "operating_income": ["OperatingIncomeLoss", "Operating income",
                                 "Income from operations"],
            "net_income": ["NetIncomeLoss", "Net income", "NetIncome", "ProfitLoss"],
            "eps_basic": ["EarningsPerShareBasic", "Basic earnings per share", "EarningsPerShare"],
            "eps_diluted": ["EarningsPerShareDiluted", "Diluted earnings per share", "EarningsPerShare"],
        }
        data = await self._fetch_statement(symbol, "income_statement", field_map, periods)
        if data is None:
            return None
        for row in data:
            rev, gp, oi, ni = row.get("revenue"), row.get("gross_profit"), \
                row.get("operating_income"), row.get("net_income")
            row["gross_margin"] = _safe_div(gp, rev)
            row["operating_margin"] = _safe_div(oi, rev)
            row["net_margin"] = _safe_div(ni, rev)
        await self._store_cache(symbol, "income_statement", data)
        return _tag(data, cached=False)  # type: ignore[return-value]

    async def get_balance_sheet(self, symbol: str, periods: int = 8) -> list[dict[str, Any]] | None:
        """Return balance-sheet data for the most recent *periods*."""
        cached = await self._get_cached(symbol, "balance_sheet")
        if cached is not None and isinstance(cached, list):
            return _tag(cached, cached=True)  # type: ignore[return-value]
        field_map: dict[str, list[str]] = {
            "total_assets": ["Assets", "Total assets"],
            "total_liabilities": ["Liabilities", "Total liabilities"],
            "total_equity": ["StockholdersEquity", "Stockholders' equity", "Total equity"],
            "cash_and_equivalents": ["CashAndCashEquivalentsAtCarryingValue",
                                     "Cash and cash equivalents"],
            "total_current_assets": ["AssetsCurrent", "Current assets", "Total current assets"],
            "total_current_liabilities": ["LiabilitiesCurrent", "Current liabilities",
                                          "Total current liabilities"],
            "long_term_debt": ["LongTermDebt", "Long-term debt"],
            "shares_outstanding": ["CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding"],
        }
        data = await self._fetch_statement(symbol, "balance_sheet", field_map, periods)
        if data is None:
            return None
        for row in data:
            ca, cl = row.get("total_current_assets"), row.get("total_current_liabilities")
            tl, eq = row.get("total_liabilities"), row.get("total_equity")
            row["current_ratio"] = _safe_div(ca, cl)
            row["debt_to_equity"] = _safe_div(tl, eq)
        await self._store_cache(symbol, "balance_sheet", data)
        return _tag(data, cached=False)  # type: ignore[return-value]

    async def get_cash_flow(self, symbol: str, periods: int = 8) -> list[dict[str, Any]] | None:
        """Return cash-flow statement data for the most recent *periods*."""
        cached = await self._get_cached(symbol, "cash_flow")
        if cached is not None and isinstance(cached, list):
            return _tag(cached, cached=True)  # type: ignore[return-value]
        field_map: dict[str, list[str]] = {
            "operating_cash_flow": ["NetCashProvidedByOperatingActivities",
                                    "Net cash provided by operating activities"],
            "capital_expenditures": ["PaymentsToAcquirePropertyPlantAndEquipment",
                                     "Purchases of property and equipment",
                                     "Capital expenditures"],
            "investing_cash_flow": ["NetCashProvidedByInvestingActivities",
                                    "Net cash used in investing activities"],
            "financing_cash_flow": ["NetCashProvidedByFinancingActivities",
                                    "Net cash used in financing activities"],
            "dividends_paid": ["PaymentsOfDividends", "Dividends paid",
                               "Payments of dividends"],
        }
        data = await self._fetch_statement(symbol, "cash_flow", field_map, periods)
        if data is None:
            return None
        for row in data:
            ocf, capex = row.get("operating_cash_flow"), row.get("capital_expenditures")
            row["free_cash_flow"] = (ocf - abs(capex)) if (ocf is not None and capex is not None) else None
        await self._store_cache(symbol, "cash_flow", data)
        return _tag(data, cached=False)  # type: ignore[return-value]

    async def get_key_metrics(self, symbol: str) -> dict[str, Any] | None:
        """Return key financial metrics computed from the latest filings."""
        cached = await self._get_cached(symbol, "key_metrics")
        if cached is not None and isinstance(cached, dict):
            return _tag(cached, cached=True)  # type: ignore[return-value]
        try:
            company = await self._get_company_obj(symbol)
            if company is None:
                return None
            await _wait_for_edgar_rate_limit()
            financials = await asyncio.to_thread(company.get_financials)
            if financials is None:
                return None
            await _wait_for_edgar_rate_limit()
            raw = await asyncio.to_thread(financials.get_financial_metrics)
            if not isinstance(raw, dict):
                raw = {}
            result: dict[str, Any] = {"symbol": symbol.upper()}
            for key in (
                "revenue", "net_income", "total_assets", "total_liabilities",
                "stockholders_equity", "current_assets", "current_liabilities",
                "operating_cash_flow", "capital_expenditures", "free_cash_flow",
                "shares_outstanding_basic", "shares_outstanding_diluted",
                "current_ratio", "debt_to_assets",
            ):
                result[key] = raw.get(key)
            rev, ni = raw.get("revenue"), raw.get("net_income")
            ta, eq = raw.get("total_assets"), raw.get("stockholders_equity")
            tl = raw.get("total_liabilities")
            result["net_margin"] = _safe_div(ni, rev)
            result["return_on_equity"] = _safe_div(ni, eq)
            result["return_on_assets"] = _safe_div(ni, ta)
            result["debt_to_equity"] = _safe_div(tl, eq)
            result["fcf_margin"] = _safe_div(raw.get("free_cash_flow"), rev)
            result["ocf_margin"] = _safe_div(raw.get("operating_cash_flow"), rev)
            await self._store_cache(symbol, "key_metrics", result)
            return _tag(result, cached=False)  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("EDGAR get_key_metrics(%s): %s", symbol, exc)
            return None

    async def get_eps_history(self, symbol: str, quarters: int = 12) -> list[dict[str, Any]] | None:
        """Return quarterly EPS, revenue, and margins history for *symbol*."""
        cached = await self._get_cached(symbol, "eps_history")
        if cached is not None and isinstance(cached, list):
            return _tag(cached, cached=True)  # type: ignore[return-value]
        field_map: dict[str, list[str]] = {
            "eps_basic": ["EarningsPerShareBasic", "Basic earnings per share", "EarningsPerShare"],
            "eps_diluted": ["EarningsPerShareDiluted", "Diluted earnings per share", "EarningsPerShare"],
            "revenue": ["Revenue", "Revenues", "Net sales",
                        "RevenueFromContractWithCustomerExcludingAssessedTax"],
            "cost_of_revenue": ["CostOfGoodsAndServicesSold", "CostOfRevenue", "Cost of"],
            "gross_profit": ["GrossProfit", "Gross profit", "Gross Profit"],
            "operating_income": ["OperatingIncomeLoss", "Operating income",
                                 "Income from operations"],
            "net_income": ["NetIncomeLoss", "Net income", "NetIncome", "ProfitLoss"],
        }
        try:
            company = await self._get_company_obj(symbol)
            if company is None:
                return None
            await _wait_for_edgar_rate_limit()
            financials = await asyncio.to_thread(company.get_quarterly_financials)
            if financials is None:
                return None
            await _wait_for_edgar_rate_limit()
            stmt = await asyncio.to_thread(financials.income_statement)
            if stmt is None:
                return None
            await _wait_for_edgar_rate_limit()
            df = await asyncio.to_thread(stmt.to_dataframe)
            data = self._parse_statement(df, field_map, periods=quarters)
            
            # Calculate margins and YoY growth
            for i, row in enumerate(data):
                # Margins
                rev, gp, oi, ni = row.get("revenue"), row.get("gross_profit"), \
                    row.get("operating_income"), row.get("net_income")
                row["gross_margin"] = _safe_div(gp, rev)
                row["operating_margin"] = _safe_div(oi, rev)
                row["net_margin"] = _safe_div(ni, rev)

                # YoY growth (compare to same quarter 4 periods back)
                yoy_idx = i + 4
                if yoy_idx < len(data):
                    prev = data[yoy_idx]
                    row["eps_growth_yoy"] = _safe_growth(row.get("eps_diluted"), prev.get("eps_diluted"))
                    row["revenue_growth_yoy"] = _safe_growth(row.get("revenue"), prev.get("revenue"))
                else:
                    row["eps_growth_yoy"] = None
                    row["revenue_growth_yoy"] = None
            
            # Acceleration detection
            for i, row in enumerate(data):
                cur_g = row.get("eps_growth_yoy")
                prev_g = data[i + 1].get("eps_growth_yoy") if i + 1 < len(data) else None
                row["is_accelerating"] = (cur_g > prev_g) if (cur_g is not None and prev_g is not None) else None
            
            await self._store_cache(symbol, "eps_history", data)
            return _tag(data, cached=False)  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("EDGAR get_eps_history(%s): %s", symbol, exc)
            return None

    async def get_recent_filings(
        self, symbol: str, filing_types: list[str] | None = None, count: int = 10,
    ) -> list[dict[str, Any]] | None:
        """Return recent SEC filings for *symbol*.

        *filing_types*: optional filter (e.g. ``["10-K", "10-Q"]``).
        """
        try:
            company = await self._get_company_obj(symbol)
            if company is None:
                return None
            await _wait_for_edgar_rate_limit()
            filings = await asyncio.to_thread(company.get_filings)
            if filings is None:
                return None
            results: list[dict[str, Any]] = []
            for filing in filings:
                if len(results) >= count:
                    break
                ft = getattr(filing, "form", None) or getattr(filing, "filing_type", None)
                if filing_types and ft not in filing_types:
                    continue
                results.append({
                    "filing_type": ft,
                    "filing_date": str(getattr(filing, "filing_date", "")),
                    "accession_number": (getattr(filing, "accession_number", None)
                                         or getattr(filing, "accession_no", None)),
                    "url": getattr(filing, "filing_url", None) or getattr(filing, "url", None),
                    "description": (getattr(filing, "description", None)
                                    or getattr(filing, "title", None)),
                })
            return _tag(results, cached=False)  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("EDGAR get_recent_filings(%s): %s", symbol, exc)
            return None


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: EdgarClient | None = None


def get_edgar_client() -> EdgarClient:
    """Return the singleton :class:`EdgarClient`, creating it on first call."""
    global _client
    if _client is None:
        _client = EdgarClient()
    return _client


async def close_edgar_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
