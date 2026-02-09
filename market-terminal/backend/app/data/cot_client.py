"""Async CFTC Commitment of Traders data client for Market Terminal.

Downloads and parses weekly COT reports from the CFTC website, calculates
Williams-style COT indices, and generates positioning signals.  Uses SQLite
caching via the ``cot_data`` table with a 7-day TTL.

Full implementation: TASK-DATA-007
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings
from app.data.cot_helpers import (
    CFTC_CURRENT_URL,
    CFTC_HISTORICAL_URL_TEMPLATE,
    DEFAULT_LOOKBACK_WEEKS,
    build_market_summary,
    build_report_entry,
    calculate_cot_index,
    extract_csv_from_zip_sync,
    get_cached_cot_data,
    get_cached_current_report,
    parse_cot_csv_sync,
    resolve_market_name,
    store_cot_rows,
    tag,
)

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT: float = 10.0
_READ_TIMEOUT: float = 30.0


# ---------------------------------------------------------------------------
# CotClient
# ---------------------------------------------------------------------------
class CotClient:
    """Async client for CFTC Commitment of Traders data.

    Downloads weekly COT reports (current and historical), parses the
    CFTC legacy short-format CSV, caches results in SQLite, and provides
    Williams-style COT index calculations with signal generation.

    No API key is required -- CFTC data is fully public.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._cache_ttl: int = settings.cache_ttl_cot
        self._http: httpx.AsyncClient | None = None
        logger.info("COT client initialized (CFTC public data - no key required)")

    # -- lifecycle ----------------------------------------------------------

    def _get_http(self) -> httpx.AsyncClient:
        """Return (or lazily create) the shared httpx.AsyncClient."""
        if self._http is None:
            self._http = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=_CONNECT_TIMEOUT,
                    read=_READ_TIMEOUT,
                    write=_READ_TIMEOUT,
                    pool=_READ_TIMEOUT,
                ),
                headers={"User-Agent": "MarketTerminal/1.0"},
                follow_redirects=True,
            )
        return self._http

    async def close(self) -> None:
        """Close the underlying HTTP client.  Safe to call multiple times."""
        if self._http is not None:
            await self._http.aclose()
            self._http = None
            logger.info("COT client closed")

    # -- download helpers ---------------------------------------------------

    async def _download_text(self, url: str) -> str | None:
        """Download a URL and return text.  Returns None on any error."""
        try:
            resp = await self._get_http().get(url)
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPStatusError as exc:
            logger.warning("COT download HTTP %d: %s", exc.response.status_code, url)
            return None
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            logger.warning("COT download error for %s: %s", url, exc)
            return None
        except Exception as exc:
            logger.warning("COT download unexpected error: %s", exc)
            return None

    async def _download_bytes(self, url: str) -> bytes | None:
        """Download a URL and return raw bytes.  Returns None on any error."""
        try:
            resp = await self._get_http().get(url)
            resp.raise_for_status()
            return resp.content
        except httpx.HTTPStatusError as exc:
            logger.warning("COT download HTTP %d: %s", exc.response.status_code, url)
            return None
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            logger.warning("COT download error for %s: %s", url, exc)
            return None
        except Exception as exc:
            logger.warning("COT download unexpected error: %s", exc)
            return None

    # ======================================================================
    # Public API
    # ======================================================================

    async def fetch_current_report(self) -> list[dict[str, Any]] | None:
        """Download and parse the current week's COT report.

        Returns list of report entry dicts for all mapped markets,
        or None on download/parse failure.
        """
        # 1. Check cache
        cached_rows = await get_cached_current_report(self._cache_ttl)
        if cached_rows is not None:
            logger.info("COT current report: cache hit (%d markets)", len(cached_rows))
            entries = await self._enrich_rows(cached_rows)
            return tag(entries, cached=True)

        # 2. Download fresh
        logger.info("COT: downloading current report from CFTC")
        text = await self._download_text(CFTC_CURRENT_URL)
        if text is None:
            return None

        # 3. Parse CSV in worker thread
        parsed = await asyncio.to_thread(parse_cot_csv_sync, text)
        if not parsed:
            logger.warning("COT: current report parse returned no records")
            return None

        # 4. Store in cache
        await store_cot_rows(parsed)
        logger.info("COT: stored %d records from current report", len(parsed))

        # 5. Enrich with indices and return
        entries = await self._enrich_rows(parsed)
        return tag(entries)

    async def fetch_historical(
        self, market_name: str, weeks: int = 52,
    ) -> list[dict[str, Any]] | None:
        """Get historical COT data for a specific market.

        Returns list of dicts sorted by report_date descending,
        or None if market not found or on failure.
        """
        # 1. Check cache
        cached = await get_cached_cot_data(market_name, weeks, self._cache_ttl)
        if cached is not None and len(cached) >= weeks:
            logger.info("COT historical %s: cache hit (%d rows)", market_name, len(cached))
            return self._enrich_historical(cached)

        # 2. Determine years to download
        now = datetime.now(timezone.utc)
        years_needed = self._years_for_weeks(now.year, weeks)

        # 3. Download and parse each year
        all_rows: list[dict[str, Any]] = []
        for year in years_needed:
            rows = await self._fetch_year(year, market_name)
            if rows:
                all_rows.extend(rows)

        # Also fetch the current report (most up-to-date data)
        current_text = await self._download_text(CFTC_CURRENT_URL)
        if current_text:
            current_parsed = await asyncio.to_thread(parse_cot_csv_sync, current_text)
            market_rows = [r for r in current_parsed if r["market_name"] == market_name]
            if market_rows:
                all_rows.extend(market_rows)

        if not all_rows:
            logger.warning("COT historical %s: no data found", market_name)
            return None

        # 4. Store all rows
        await store_cot_rows(all_rows)

        # 5. Re-query cache for deduped, sorted results
        result = await get_cached_cot_data(market_name, weeks, self._cache_ttl)
        if result is None:
            return None
        return self._enrich_historical(result)

    async def get_market_summary(self, symbol: str) -> dict[str, Any] | None:
        """Get a summary of COT positioning for a market.

        Maps ETFs and futures symbols to their CFTC equivalents.
        Returns None if symbol has no COT data.
        """
        market_name = resolve_market_name(symbol)
        if market_name is None:
            logger.info("COT: no mapping for symbol '%s'", symbol)
            return None

        historical = await self.fetch_historical(market_name, DEFAULT_LOOKBACK_WEEKS)
        if not historical:
            return None

        summary = build_market_summary(market_name, historical)
        if summary is None:
            return None
        return tag(summary)

    @staticmethod
    def calculate_cot_index(
        net_positions: list[int],
        lookback: int = DEFAULT_LOOKBACK_WEEKS,
    ) -> float:
        """Calculate COT index (0-100) using Larry Williams' formula."""
        return calculate_cot_index(net_positions, lookback)

    # -- internal helpers ---------------------------------------------------

    async def _enrich_rows(
        self, rows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Add COT indices to a list of current-report rows."""
        entries: list[dict[str, Any]] = []
        for row in rows:
            market_name = row["market_name"]
            # Use relaxed TTL (10x) for index context -- we want historical
            # range data even if the latest weekly report is slightly stale
            historical = await get_cached_cot_data(
                market_name, DEFAULT_LOOKBACK_WEEKS, self._cache_ttl * 10,
            )
            comm_idx: float | None = None
            spec_idx: float | None = None
            if historical and len(historical) >= 2:
                comm_nets = [r["commercial_net"] for r in reversed(historical)]
                spec_nets = [r["speculative_net"] for r in reversed(historical)]
                comm_idx = calculate_cot_index(comm_nets)
                spec_idx = calculate_cot_index(spec_nets)
            entries.append(build_report_entry(
                row, commercial_index=comm_idx, speculative_index=spec_idx,
            ))
        return entries

    @staticmethod
    def _enrich_historical(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Add indices and change fields to cached historical rows."""
        if not rows:
            return []
        # Compute indices from all available data (oldest first)
        comm_nets = [r["commercial_net"] for r in reversed(rows)]
        spec_nets = [r["speculative_net"] for r in reversed(rows)]
        result: list[dict[str, Any]] = []
        for i, row in enumerate(rows):
            # Index using all data up to this point
            window_comm = comm_nets[: len(comm_nets) - i]
            window_spec = spec_nets[: len(spec_nets) - i]
            comm_idx = calculate_cot_index(window_comm)
            spec_idx = calculate_cot_index(window_spec)
            # Week-over-week change
            comm_change = None
            spec_change = None
            if i + 1 < len(rows):
                comm_change = row["commercial_net"] - rows[i + 1]["commercial_net"]
                spec_change = row["speculative_net"] - rows[i + 1]["speculative_net"]
            result.append({
                "report_date": row["report_date"],
                "commercial_net": row["commercial_net"],
                "speculative_net": row["speculative_net"],
                "open_interest": row["open_interest"],
                "commercial_index": round(comm_idx, 1),
                "speculative_index": round(spec_idx, 1),
                "commercial_change": comm_change,
                "speculative_change": spec_change,
            })
        return result

    async def _fetch_year(
        self, year: int, market_name: str,
    ) -> list[dict[str, Any]] | None:
        """Download and parse a single year's historical archive."""
        url = CFTC_HISTORICAL_URL_TEMPLATE.format(year=year)
        logger.info("COT: downloading historical archive for %d", year)
        zip_bytes = await self._download_bytes(url)
        if zip_bytes is None:
            return None
        csv_text = await asyncio.to_thread(extract_csv_from_zip_sync, zip_bytes)
        if csv_text is None:
            logger.warning("COT: failed to extract CSV from %d archive", year)
            return None
        all_parsed = await asyncio.to_thread(parse_cot_csv_sync, csv_text)
        market_rows = [r for r in all_parsed if r["market_name"] == market_name]
        if not market_rows:
            logger.info("COT: market '%s' not found in %d archive", market_name, year)
            return None
        logger.info("COT: parsed %d rows for '%s' from %d archive", len(market_rows), market_name, year)
        return market_rows

    @staticmethod
    def _years_for_weeks(current_year: int, weeks: int) -> list[int]:
        """Return list of years needed to cover *weeks* of data."""
        years_back = max(1, (weeks // 52) + 1)
        return list(range(current_year - years_back + 1, current_year + 1))


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_client: CotClient | None = None


def get_cot_client() -> CotClient:
    """Return the singleton :class:`CotClient`, creating it on first call."""
    global _client
    if _client is None:
        _client = CotClient()
    return _client


async def close_cot_client() -> None:
    """Close the singleton client and clear the reference."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
