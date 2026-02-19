"""Async SEC EDGAR ownership client for Market Terminal.

Provides 13F institutional ownership data (via EDGAR EFTS search + edgartools)
and Form 4 insider transaction data (via edgartools) with SQLite caching.

Full implementation: TASK-DATA-004
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.data.edgar_client import _wait_for_edgar_rate_limit
from app.data.edgar_ownership_helpers import (
    EFTS_URL,
    MAX_EFTS_RESULTS,
    MAX_FILINGS_PER_SEARCH,
    build_holders_response,
    build_insider_response,
    get_cached_holders,
    get_cached_insiders,
    parse_form4_sync,
    quarter_start,
    store_holders,
    store_insiders,
    tag,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EdgarOwnershipClient
# ---------------------------------------------------------------------------
class EdgarOwnershipClient:
    """Async client for 13F institutional holdings and Form 4 insider trades.

    Uses EDGAR EFTS for 13F holder discovery, ``edgartools`` for filing
    parsing, and SQLite for caching.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._user_agent: str = settings.sec_edgar_user_agent
        self._http: httpx.AsyncClient | None = None
        self._identity_set: bool = False

    # -- lifecycle ----------------------------------------------------------

    def _ensure_identity(self) -> None:
        """Set the edgartools identity header (once per process)."""
        if not self._identity_set:
            from edgar import set_identity  # type: ignore[import-untyped]
            set_identity(self._user_agent)
            self._identity_set = True
            logger.info("EDGAR ownership identity set: %s", self._user_agent)

    def _get_http(self) -> httpx.AsyncClient:
        """Return (or lazily create) the shared HTTP client."""
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": self._user_agent},
            )
        return self._http

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http is not None and not self._http.is_closed:
            await self._http.aclose()
            self._http = None
        logger.info("EdgarOwnershipClient closed")

    # -- internal: Company lookup ------------------------------------------

    async def _get_company_obj(self, symbol: str) -> Any | None:
        """Rate-limit and fetch an edgartools Company object."""
        self._ensure_identity()
        await _wait_for_edgar_rate_limit()

        def _fetch() -> Any:
            from edgar import Company  # type: ignore[import-untyped]
            return Company(symbol.upper())

        try:
            company = await asyncio.to_thread(_fetch)
            if company is None or getattr(company, "not_found", False):
                logger.info("EDGAR company not found: %s", symbol)
                return None
            return company
        except Exception as exc:
            logger.warning("EDGAR Company(%s) failed: %s", symbol, exc)
            return None

    # -- internal: EFTS search ---------------------------------------------

    async def _search_efts(
        self,
        query: str,
        forms: str = "13F-HR",
        start_date: str | None = None,
        end_date: str | None = None,
        max_results: int = MAX_EFTS_RESULTS,
    ) -> list[dict[str, Any]]:
        """Search EDGAR EFTS for filings matching *query*.

        Returns a list of dicts with keys: institution_name, cik,
        filing_date, accession_no, report_period.
        """
        await _wait_for_edgar_rate_limit()
        params: dict[str, Any] = {
            "q": f'"{query}"',
            "forms": forms,
        }
        if start_date and end_date:
            params["dateRange"] = "custom"
            params["startdt"] = start_date
            params["enddt"] = end_date
        try:
            client = self._get_http()
            resp = await client.get(EFTS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.warning("EFTS search failed for %r: %s", query, exc)
            return []

        results: list[dict[str, Any]] = []
        hits = data.get("hits", {}).get("hits", [])
        for hit in hits[:max_results]:
            src = hit.get("_source", {})
            ciks = src.get("ciks", [])
            names = src.get("display_names", [])
            if not ciks:
                continue
            results.append({
                "institution_name": names[0] if names else "Unknown",
                "cik": int(ciks[0]),
                "filing_date": src.get("file_date", ""),
                "accession_no": src.get("adsh", ""),
                "report_period": src.get("period_ending", ""),
            })
        return results

    # -- internal: 13F parsing ---------------------------------------------

    async def _parse_13f_holding(
        self,
        cik: int,
        company_name: str,
        form: str,
        filing_date: str,
        accession_no: str,
        target_ticker: str,
    ) -> dict[str, Any] | None:
        """Parse a single 13F filing for *target_ticker*.

        Returns dict with holder_name, shares, value_usd, report_period
        or None if the ticker is not found in the filing.
        """
        self._ensure_identity()

        def _parse_sync() -> dict[str, Any] | None:
            from edgar import Filing  # type: ignore[import-untyped]
            filing = Filing(
                cik=cik, company=company_name, form=form,
                filing_date=filing_date, accession_no=accession_no,
            )
            obj = filing.obj()
            if obj is None:
                return None
            holdings = getattr(obj, "holdings", None)
            if holdings is None:
                return None
            ticker_upper = target_ticker.upper()
            try:
                # Handle Ticker aliases using shared configuration
                from app.data.edgar_ownership_helpers import TICKER_ALIASES
                
                search_tickers = [ticker_upper]
                aliases = TICKER_ALIASES.get(ticker_upper, [])
                search_tickers.extend(aliases)

                matched = None
                for t in search_tickers:
                    # Exact match
                    m = holdings[holdings["Ticker"] == t]
                    if not m.empty:
                        matched = m
                        break
                    # Case-insensitive match
                    m = holdings[holdings["Ticker"].str.upper() == t]
                    if not m.empty:
                        matched = m
                        break

                if matched is None or matched.empty:
                    return None
            except Exception:
                return None
            row = matched.iloc[0]
            shares_val = row.get("SharesPrnAmount")
            value_val = row.get("Value")
            return {
                "holder_name": company_name,
                "shares": int(shares_val) if shares_val is not None else None,
                "value_usd": float(value_val) if value_val is not None else None,
                "report_period": getattr(obj, "report_period", "") or "",
                "filing_date": filing_date,
            }

        try:
            await _wait_for_edgar_rate_limit()
            return await asyncio.to_thread(_parse_sync)
        except Exception as exc:
            logger.warning(
                "13F parse failed (CIK %s, %s): %s", cik, accession_no, exc
            )
            return None

    # -- internal: Form 4 parsing ------------------------------------------

    async def _parse_form4_filing(self, filing: Any) -> dict[str, Any] | None:
        """Parse a single Form 4 filing into a structured dict."""
        self._ensure_identity()
        try:
            await _wait_for_edgar_rate_limit()
            return await asyncio.to_thread(parse_form4_sync, filing)
        except Exception as exc:
            logger.warning("Form4 parse failed: %s", exc)
            return None

    # ======================================================================
    # Public API: Institutional Ownership (13F)
    # ======================================================================

    async def get_institutional_holders(
        self, symbol: str, quarters: int = 4
    ) -> dict[str, Any] | None:
        """Return 13F institutional holders for *symbol*.

        Checks cache first; on miss searches EFTS for 13F filings and
        parses each to extract the position for *symbol*.
        """
        sym = symbol.upper()

        # -- cache check ---------------------------------------------------
        cached_rows = await get_cached_holders(sym)
        if cached_rows is not None:
            holders = [
                {k: r[k] for k in (
                    "holder_name", "shares", "value_usd",
                    "change_shares", "change_percent",
                    "filing_date", "report_period",
                )}
                for r in cached_rows
            ]
            result = build_holders_response(sym, holders)
            return tag(result, cached=True)  # type: ignore[return-value]

        # -- EFTS search ---------------------------------------------------
        # Try to resolve Company Name first for better search results (fixes short tickers like HL)
        query = sym
        try:
            company = await self._get_company_obj(sym)
            if company and hasattr(company, "name"):
                # Use company name for search if available
                # Clean the name: EDGAR often has "NAME /DE/" or "NAME /NV/"
                # We strip everything after the first slash to get the "clean" name
                raw_name = company.name
                query = raw_name.split("/")[0].strip()
                logger.info("Resolved %s to company name '%s' (raw: '%s') for EFTS search", sym, query, raw_name)
        except Exception as exc:
            logger.warning("Failed to resolve company name for %s: %s", sym, exc)

        start_date = quarter_start(quarters)
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        efts_hits = await self._search_efts(
            query=query, forms="13F-HR",
            start_date=start_date, end_date=end_date,
            max_results=MAX_FILINGS_PER_SEARCH,
        )
        if not efts_hits:
            # Fallback: if name search failed (or yielded 0 hits), try ticker
            if query != sym:
                logger.info("No EFTS hits for name '%s', retrying with ticker '%s'", query, sym)
                efts_hits = await self._search_efts(
                    query=sym, forms="13F-HR",
                    start_date=start_date, end_date=end_date,
                    max_results=MAX_FILINGS_PER_SEARCH,
                )

        if not efts_hits:
            logger.info("No 13F EFTS hits for %s", sym)
            return None

        # De-duplicate institutions (keep most recent filing per CIK)
        seen_ciks: set[int] = set()
        unique_hits: list[dict[str, Any]] = []
        for hit in efts_hits:
            cik = hit["cik"]
            if cik not in seen_ciks:
                seen_ciks.add(cik)
                unique_hits.append(hit)

        # -- parse each 13F ------------------------------------------------
        holders: list[dict[str, Any]] = []
        for hit in unique_hits[:20]:
            holding = await self._parse_13f_holding(
                cik=hit["cik"],
                company_name=hit["institution_name"],
                form="13F-HR",
                filing_date=hit["filing_date"],
                accession_no=hit["accession_no"],
                target_ticker=sym,
            )
            if holding is not None:
                holders.append(holding)

        if not holders:
            logger.info("No 13F holdings found for %s", sym)
            return None

        await store_holders(sym, holders)
        result = build_holders_response(sym, holders)
        return tag(result, cached=False)  # type: ignore[return-value]

    async def get_top_holders(
        self, symbol: str, top_n: int = 20
    ) -> list[dict[str, Any]] | None:
        """Return the top *top_n* institutional holders by share count."""
        sym = symbol.upper()
        cached_rows = await get_cached_holders(sym)
        if cached_rows is not None:
            holders = [
                {k: r[k] for k in (
                    "holder_name", "shares", "value_usd",
                    "filing_date", "report_period",
                )}
                for r in cached_rows
            ]
            top = sorted(
                holders, key=lambda h: h.get("shares") or 0, reverse=True
            )[:top_n]
            return tag(top, cached=True)  # type: ignore[return-value]

        full = await self.get_institutional_holders(sym)
        if full is None:
            return None
        top = sorted(
            full.get("holders", []),
            key=lambda h: h.get("shares") or 0,
            reverse=True,
        )[:top_n]
        return tag(top, cached=False)  # type: ignore[return-value]

    # ======================================================================
    # Public API: Insider Transactions (Form 4)
    # ======================================================================

    async def get_insider_transactions(
        self, symbol: str, days: int = 365
    ) -> dict[str, Any] | None:
        """Return Form 4 insider transactions for *symbol* over the last *days*.

        Checks cache first (4 h TTL); on miss fetches via edgartools.
        """
        sym = symbol.upper()

        # -- cache check ---------------------------------------------------
        cached_rows = await get_cached_insiders(sym, days)
        if cached_rows is not None:
            flat_txns = [
                {k: r.get(k) for k in (
                    "insider_name", "insider_title", "transaction_type",
                    "shares", "price_per_share", "total_value",
                    "shares_owned_after", "transaction_date", "filing_date",
                )}
                for r in cached_rows
            ]
            result = build_insider_response(sym, flat_txns)
            return tag(result, cached=True)  # type: ignore[return-value]

        # -- fetch Form 4 filings -----------------------------------------
        try:
            company = await self._get_company_obj(sym)
            if company is None:
                return None
        except Exception as exc:
            logger.warning("Company lookup failed for %s: %s", sym, exc)
            return None

        try:
            await _wait_for_edgar_rate_limit()
            filings = await asyncio.to_thread(
                lambda: company.get_filings().filter(form="4")
            )
        except Exception as exc:
            logger.warning("Form 4 filings fetch failed for %s: %s", sym, exc)
            return None

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        flat_txns: list[dict[str, Any]] = []
        parsed_count = 0

        for filing in filings:
            if parsed_count >= MAX_FILINGS_PER_SEARCH:
                break
            f_date_str = str(getattr(filing, "filing_date", ""))
            if f_date_str:
                try:
                    f_date = datetime.strptime(
                        f_date_str, "%Y-%m-%d"
                    ).replace(tzinfo=timezone.utc)
                    if f_date < cutoff:
                        break
                except ValueError:
                    pass

            parsed = await self._parse_form4_filing(filing)
            parsed_count += 1
            if parsed is None:
                continue
            for tx in parsed.get("transactions", []):
                flat_txns.append({
                    "insider_name": parsed["insider_name"],
                    "insider_title": parsed.get("insider_title"),
                    "transaction_type": tx["transaction_type"],
                    "shares": tx["shares"],
                    "price_per_share": tx.get("price_per_share"),
                    "total_value": tx.get("total_value"),
                    "shares_owned_after": None,
                    "transaction_date": f_date_str,
                    "filing_date": f_date_str,
                })

        await store_insiders(sym, flat_txns)
        result = build_insider_response(sym, flat_txns)
        return tag(result, cached=False)  # type: ignore[return-value]

    async def get_insider_summary(
        self, symbol: str, days: int = 90
    ) -> dict[str, Any] | None:
        """Return a simplified insider activity summary for *symbol*.

        Includes net direction (buying/selling/neutral), aggregate totals,
        and the top 3 notable transactions by value.
        """
        data = await self.get_insider_transactions(symbol, days=days)
        if data is None:
            return None

        summary = data.get("summary", {})
        transactions = data.get("transactions", [])
        net_shares = summary.get("net_shares", 0)

        if net_shares > 0:
            direction = "buying"
        elif net_shares < 0:
            direction = "selling"
        else:
            direction = "neutral"

        valued_txns = [
            t for t in transactions if t.get("total_value") is not None
        ]
        notable = sorted(
            valued_txns,
            key=lambda t: abs(t.get("total_value") or 0),
            reverse=True,
        )[:3]

        result: dict[str, Any] = {
            "symbol": symbol.upper(),
            "days": days,
            "net_direction": direction,
            "net_shares": net_shares,
            "net_value": summary.get("net_value", 0),
            "total_buys": summary.get("total_buys", 0),
            "total_sells": summary.get("total_sells", 0),
            "total_buy_value": summary.get("total_buy_value", 0),
            "total_sell_value": summary.get("total_sell_value", 0),
            "unique_insiders_buying": summary.get("unique_insiders_buying", 0),
            "unique_insiders_selling": summary.get(
                "unique_insiders_selling", 0
            ),
            "notable_transactions": [
                {
                    "insider_name": t["insider_name"],
                    "transaction_type": t["transaction_type"],
                    "shares": t["shares"],
                    "total_value": t.get("total_value"),
                    "transaction_date": t.get("transaction_date"),
                }
                for t in notable
            ],
        }
        is_cached = data.get("_cached", False)
        return tag(result, cached=is_cached)  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: EdgarOwnershipClient | None = None


def get_ownership_client() -> EdgarOwnershipClient:
    """Return the singleton :class:`EdgarOwnershipClient`."""
    global _client
    if _client is None:
        _client = EdgarOwnershipClient()
    return _client


async def close_ownership_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
