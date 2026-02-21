"""Massive.com Data Client.

Provides Options API client with rate limiting, circuit breaker, and caching
integration.
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, field_validator

from app.config import get_settings

logger = logging.getLogger(__name__)

try:
    from massive import RESTClient as _MassiveSDK  # type: ignore
    _HAS_SDK = True
except ImportError:
    logger.warning("massive SDK not installed; using httpx fallback")
    _HAS_SDK = False


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class OptionContractModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    strike: float
    expiration: str
    contract_type: str
    bid: float | None = None
    ask: float | None = None
    last_price: float | None = None
    volume: int | None = None
    open_interest: int | None = None
    implied_volatility: float | None = None
    delta: float | None = None
    gamma: float | None = None
    theta: float | None = None
    vega: float | None = None
    break_even_price: float | None = None
    option_ticker: str

    @field_validator("contract_type", mode="before")
    @classmethod
    def validate_contract_type(cls, v: str) -> str:
        v = str(v).lower().strip()
        if v not in ("call", "put"):
            raise ValueError("contract_type must be call or put")
        return v


class OptionsChainResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    underlying_symbol: str
    underlying_price: float | None = None
    chain: list[OptionContractModel]

    @field_validator("underlying_symbol", mode="before")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        v = str(v).strip().upper()
        if len(v) > 10:
            raise ValueError("symbol must be <= 10 chars")
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_snake_case(data: Any) -> Any:
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            new_k = "".join(["_" + c.lower() if c.isupper() else c.lower() for c in k]).lstrip("_")
            out[new_k] = _to_snake_case(v)
        return out
    if isinstance(data, list):
        return [_to_snake_case(x) for x in data]
    return data


def _sanitize_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if math.isnan(value) or math.isinf(value):
            return None
        return float(value)
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _sanitize_dict(data: dict[str, Any]) -> dict[str, Any]:
    for k, v in data.items():
        if isinstance(v, float) or (isinstance(v, int) and not isinstance(v, bool)):
            data[k] = _sanitize_float(v)
    return data


class CircuitBreakerState:
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


# ---------------------------------------------------------------------------
# MassiveClient
# ---------------------------------------------------------------------------

class MassiveClient:
    """Async client for Massive.com API."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.massive_api_key
        self._tier = settings.massive_options_tier.lower()
        self._enabled = bool(self._api_key)

        tier_limits = {"free": 5, "starter": 6000, "developer": 6000, "advanced": 6000}
        self._rate_limit = tier_limits.get(self._tier, 5)
        self._rate_limiter: deque[float] = deque()
        self._rate_lock = asyncio.Lock()
        self._symbol_locks: dict[str, asyncio.Lock] = {}

        self._cb_state = CircuitBreakerState.CLOSED
        self._cb_failures: deque[float] = deque()
        self._cb_lock = asyncio.Lock()
        self._cb_threshold = 5
        self._cb_window = 60.0
        self._cb_cooldown = 120.0
        self._cb_open_time = 0.0

        self._http: httpx.AsyncClient | None = None
        self._sdk = None
        if self._enabled and _HAS_SDK:
            try:
                self._sdk = _MassiveSDK(api_key=self._api_key)  # type: ignore
            except Exception as e:
                logger.warning("Failed to initialize Massive SDK: %s", e)
                self._sdk = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(
                base_url="https://api.massive.com",
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=httpx.Timeout(connect=10.0, read=30.0)
            )
        return self._http

    @property
    def calls_remaining(self) -> int:
        now = time.monotonic()
        while self._rate_limiter and now - self._rate_limiter[0] > 60.0:
            self._rate_limiter.popleft()
        return max(0, self._rate_limit - len(self._rate_limiter))

    def _get_symbol_lock(self, symbol: str) -> asyncio.Lock:
        if symbol not in self._symbol_locks:
            self._symbol_locks[symbol] = asyncio.Lock()
        return self._symbol_locks[symbol]

    async def _record_failure(self) -> None:
        async with self._cb_lock:
            now = time.monotonic()
            if self._cb_state == CircuitBreakerState.HALF_OPEN:
                logger.info("MassiveClient circuit breaker: HALF_OPEN -> OPEN")
                self._cb_state = CircuitBreakerState.OPEN
                self._cb_open_time = now
            elif self._cb_state == CircuitBreakerState.CLOSED:
                self._cb_failures.append(now)
                while self._cb_failures and now - self._cb_failures[0] > self._cb_window:
                    self._cb_failures.popleft()
                if len(self._cb_failures) >= self._cb_threshold:
                    logger.info("MassiveClient circuit breaker: CLOSED -> OPEN")
                    self._cb_state = CircuitBreakerState.OPEN
                    self._cb_open_time = now

    async def _fetch(self, url: str, params: dict[str, Any] | None = None) -> Any | None:
        if not self._enabled:
            logger.warning("MassiveClient is disabled (no API key).")
            return None

        async with self._cb_lock:
            now = time.monotonic()
            while self._cb_failures and now - self._cb_failures[0] > self._cb_window:
                self._cb_failures.popleft()

            is_test_request = False
            if self._cb_state == CircuitBreakerState.OPEN:
                if now - self._cb_open_time >= self._cb_cooldown:
                    logger.info("MassiveClient circuit breaker: OPEN -> HALF_OPEN")
                    self._cb_state = CircuitBreakerState.HALF_OPEN
                    is_test_request = True
                else:
                    return None
            elif self._cb_state == CircuitBreakerState.HALF_OPEN:
                return None

        async with self._rate_lock:
            now = time.monotonic()
            while self._rate_limiter and now - self._rate_limiter[0] > 60.0:
                self._rate_limiter.popleft()
            if len(self._rate_limiter) >= self._rate_limit:
                logger.warning("MassiveClient rate limit exceeded (%d/min).", self._rate_limit)
                if is_test_request:
                    async with self._cb_lock:
                        self._cb_state = CircuitBreakerState.OPEN
                        self._cb_open_time = now - self._cb_cooldown + 0.1
                return None
            self._rate_limiter.append(now)

        try:
            # We attempt httpx since the requirements state the SDK might not be there 
            # and we should fallback to raw httpx. If the SDK is defined, we could use it, 
            # but httpx handles generic requests reliably.
            http_client = await self._get_http()
            resp = await http_client.get(url, params=params)

            if resp.status_code == 429:
                logger.warning("MassiveClient: 429 Rate limited. Retry-After: %s", resp.headers.get("Retry-After"))
                await self._record_failure()
                return None

            if resp.status_code == 403:
                logger.error("MassiveClient: 403 Forbidden. Invalid API key. Disabling.")
                self._enabled = False
                await self._record_failure()
                return None

            resp.raise_for_status()
            data = resp.json()

            async with self._cb_lock:
                if self._cb_state == CircuitBreakerState.HALF_OPEN:
                    logger.info("MassiveClient circuit breaker: HALF_OPEN -> CLOSED")
                    self._cb_state = CircuitBreakerState.CLOSED
                    self._cb_failures.clear()

            return data

        except httpx.HTTPError as e:
            logger.warning("MassiveClient HTTP error for %s: %s - %s", url, type(e).__name__, e)
            await self._record_failure()
            return None
        except Exception as e:
            logger.error("MassiveClient unexpected error for %s: %s", url, type(e).__name__)
            await self._record_failure()
            return None

    # -- Endpoints ----------------------------------------------------------

    async def get_options_chain(
        self,
        symbol: str,
        *,
        expiration_gte: str | None = None,
        expiration_lte: str | None = None,
        strike_gte: float | None = None,
        strike_lte: float | None = None,
        contract_type: str | None = None,
    ) -> dict[str, Any] | None:
        params: dict[str, Any] = {"limit": 250}
        if expiration_gte: params["expiration_gte"] = expiration_gte
        if expiration_lte: params["expiration_lte"] = expiration_lte
        if strike_gte is not None: params["strike_gte"] = strike_gte
        if strike_lte is not None: params["strike_lte"] = strike_lte
        if contract_type: params["contract_type"] = contract_type.lower()

        url = f"/v3/snapshot/options/{symbol}"
        all_contracts: list[dict[str, Any]] = []
        underlying_price = None

        sym_lock = self._get_symbol_lock(symbol)
        async with sym_lock:
            while url:
                data = await self._fetch(url, params=params)
                if not data:
                    break

                data = _to_snake_case(data)
                if underlying_price is None:
                    underlying_price = _sanitize_float(data.get("underlying_price"))

                contracts = data.get("chain", [])
                for c in contracts:
                    all_contracts.append(_sanitize_dict(c))

                url = data.get("next_url")
                params = None  # query params included in next_url

        if not all_contracts:
            return None

        try:
            model = OptionsChainResponse(
                underlying_symbol=symbol,
                underlying_price=underlying_price,
                chain=all_contracts
            )
        except Exception as e:
            logger.warning("MassiveClient validation error: %s", e)
            return None

        return {
            "underlying_symbol": model.underlying_symbol,
            "underlying_price": model.underlying_price,
            "chain": [c.model_dump() for c in model.chain],
            "_source": "massive",
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }

    async def get_expirations(self, symbol: str) -> list[str] | None:
        url = f"/v3/snapshot/options/{symbol}/expirations"
        data = await self._fetch(url)
        if isinstance(data, dict):
            data = _to_snake_case(data)
            exps = data.get("expirations")
            if isinstance(exps, list):
                return sorted(exps)
        elif isinstance(data, list):
            return sorted(data)

        # Fallback to chain extraction
        chain_data = await self.get_options_chain(symbol)
        if not chain_data or not chain_data.get("chain"):
            return None
        return sorted(list({str(c["expiration"]) for c in chain_data["chain"]}))

    async def get_greeks_summary(self, symbol: str) -> dict[str, Any] | None:
        chain_data = await self.get_options_chain(symbol)
        if not chain_data or not chain_data.get("chain"):
            return None

        exps: dict[str, Any] = {}
        for c in chain_data["chain"]:
            exp = c["expiration"]
            if exp not in exps:
                exps[exp] = {"iv": [], "oi": 0, "calls": 0, "puts": 0, "count": 0}

            exps[exp]["count"] += 1
            if c["implied_volatility"] is not None:
                exps[exp]["iv"].append(c["implied_volatility"])
            if c["open_interest"] is not None:
                exps[exp]["oi"] += c["open_interest"]
            if c["contract_type"] == "call":
                exps[exp]["calls"] += 1
            elif c["contract_type"] == "put":
                exps[exp]["puts"] += 1

        results = []
        for exp, metrics in exps.items():
            avg_iv = sum(metrics["iv"]) / len(metrics["iv"]) if metrics["iv"] else None
            pcr = metrics["puts"] / metrics["calls"] if metrics["calls"] > 0 else None
            results.append({
                "expiration": exp,
                "avg_iv": avg_iv,
                "put_call_ratio": pcr,
                "total_open_interest": metrics["oi"],
                "contract_count": metrics["count"]
            })

        return {
            "underlying_symbol": chain_data["underlying_symbol"],
            "underlying_price": chain_data["underlying_price"],
            "expirations": sorted(results, key=lambda x: x["expiration"]),
            "_source": "massive",
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }

    async def get_single_contract(
        self, symbol: str, contract_ticker: str
    ) -> dict[str, Any] | None:
        if not bool(re.match(r"^O:[A-Z]{1,10}\d{6}[CP]\d{8}$", contract_ticker)):
            return None

        url = f"/v3/snapshot/options/{symbol}/{contract_ticker}"
        data = await self._fetch(url)
        if not data:
            return None

        data = _to_snake_case(data)
        data = _sanitize_dict(data)

        try:
            model = OptionContractModel(**data)
        except Exception as e:
            logger.warning("MassiveClient contract validation error: %s", e)
            return None

        result = model.model_dump()
        result["_source"] = "massive"
        result["_fetched_at"] = datetime.now(timezone.utc).isoformat()
        return result

    # ------------------------------------------------------------------------
    # Phase 3: Advanced Fundamentals
    # ------------------------------------------------------------------------

    async def get_short_interest(self, symbol: str) -> dict[str, Any] | None:
        """Return short interest data for *symbol*.
        
        Available on Starter and Developer tiers. Falls back to None if client
        is disabled or the source data is structurally invalid.
        """
        if not self._enabled:
            logger.warning("get_short_interest skipped: MassiveClient disabled.")
            return None

        # Short interest TTL is 24 hours (86400s) handled downstream by default
        url = f"/v3/reference/tickers/{symbol}/short-interest"
        data = await self._fetch(url)

        if not data or "results" not in data:
            return None

        res = data.get("results", {})
        if not res:
             return None

        parsed = {
            "symbol": symbol,
            "shares_short": res.get("shares_short"),
            "short_ratio": _sanitize_float(res.get("short_ratio")),
            "percent_of_float": _sanitize_float(res.get("percent_of_float")),
            "settlement_date": res.get("settlement_date"),
            "_source": "massive",
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }
        
        if not isinstance(parsed["shares_short"], int) or isinstance(parsed["shares_short"], bool):
            try:
                if parsed["shares_short"] is not None:
                    parsed["shares_short"] = int(parsed["shares_short"])
            except (ValueError, TypeError):
                parsed["shares_short"] = None

        return parsed

    async def get_analyst_ratings(self, symbol: str) -> dict[str, Any] | None:
        """Return analyst ratings and price targets for *symbol*.
        
        Requires the Advanced tier. Returns None triggering graceful UI fallback
        otherwise calculating buy/hold/sell spreads onto a consensus.
        """
        if not self._enabled:
            logger.warning("get_analyst_ratings skipped: MassiveClient disabled.")
            return None

        if self._tier != "advanced":
            logger.debug("Analyst ratings require Advanced tier. Returning None mapping graceful logic bypass.")
            return None

        url = f"/v3/reference/tickers/{symbol}/analyst-ratings"
        data = await self._fetch(url)

        if not data or "results" not in data:
            return None

        res = data.get("results", {})
        if not res:
            return None

        buy_count = int(res.get("buy", 0))
        hold_count = int(res.get("hold", 0))
        sell_count = int(res.get("sell", 0))
        total_analysts = buy_count + hold_count + sell_count

        # Consensus Resolution Mapping (REQ-OPT-022)
        consensus = "hold"
        pct_buy = buy_count / total_analysts if total_analysts > 0 else 0
        pct_sell = sell_count / total_analysts if total_analysts > 0 else 0
        
        if pct_buy > 0.66 and total_analysts > 10:
            consensus = "strong_buy"
        elif pct_buy > 0.50:
            consensus = "buy"
        elif pct_sell > 0.66 and total_analysts > 10:
             consensus = "strong_sell"
        elif pct_sell > 0.50:
            consensus = "sell"

        parsed = {
            "symbol": symbol,
            "buy": buy_count,
            "hold": hold_count,
            "sell": sell_count,
            "consensus": consensus,
            "total_analysts": total_analysts,
            "price_target_mean": _sanitize_float(res.get("price_target_mean")),
            "price_target_high": _sanitize_float(res.get("price_target_high")),
            "price_target_low": _sanitize_float(res.get("price_target_low")),
            "_source": "massive",
            "_fetched_at": datetime.now(timezone.utc).isoformat()
        }

        return parsed


_client: MassiveClient | None = None


def get_massive_client() -> MassiveClient:
    global _client
    if _client is None:
        _client = MassiveClient()
    return _client
