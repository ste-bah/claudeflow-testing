"""Options API endpoints.

Provides REST endpoints for MassiveClient options data including full chains,
expirations lists, aggregated greeks, and individual contract snapshots.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Path
from pydantic import BaseModel

from app.config import get_settings
from app.data.cache import CacheManager
from app.data.cache_types import CachedResult
from app.data.massive_client import get_massive_client, OptionContractModel

router = APIRouter(prefix="/api/options", tags=["options"])
_cache_mgr = CacheManager()

# Module-level locks to prevent duplicate concurrent upstream fetches
_symbol_locks: dict[str, asyncio.Lock] = {}

def _get_symbol_lock(symbol: str) -> asyncio.Lock:
    if symbol not in _symbol_locks:
        _symbol_locks[symbol] = asyncio.Lock()
    return _symbol_locks[symbol]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class OptionsChainResponse(BaseModel):
    underlying_symbol: str
    underlying_price: float | None
    chain: list[OptionContractModel]
    contract_count: int
    page: int
    page_size: int
    has_more: bool
    is_delayed: bool


class ExpirationItem(BaseModel):
    expiration_date: str
    contract_count: int


class ExpirationListResponse(BaseModel):
    underlying_symbol: str
    expirations: list[ExpirationItem]
    total_expirations: int


class GreeksExpirationItem(BaseModel):
    expiration: str
    avg_iv: float | None
    put_call_ratio: float | None
    total_open_interest: int | None
    contract_count: int


class GreeksSummaryResponse(BaseModel):
    underlying_symbol: str
    underlying_price: float | None
    expirations: list[GreeksExpirationItem]


class OptionContractDetailModel(OptionContractModel):
    fair_market_value: float | None


class ContractDetailResponse(BaseModel):
    underlying_symbol: str
    underlying_price: float | None
    contract: OptionContractDetailModel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_delayed() -> bool:
    settings = get_settings()
    return settings.massive_options_tier.lower() == "starter"


def _handle_client_error(data: dict | None) -> None:
    if data is None:
        client = get_massive_client()
        if not client._enabled:
            raise HTTPException(
                status_code=503,
                detail="Options data source not configured."
            )
        raise HTTPException(
            status_code=503,
            detail="Options data temporarily unavailable."
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/chain/{symbol}", response_model=CachedResult)
async def get_options_chain(
    symbol: str = Path(..., min_length=1, max_length=10),
    expiration_gte: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    expiration_lte: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    strike_gte: float | None = Query(None, ge=0),
    strike_lte: float | None = Query(None, ge=0),
    contract_type: str | None = Query("both"),
    page: int = Query(1, ge=1),
    page_size: int = Query(250, ge=1, le=500),
) -> CachedResult:
    """Get full options chain snapshot for a symbol."""
    symbol = symbol.strip().upper()
    if strike_gte is not None and strike_lte is not None and strike_gte > strike_lte:
        raise HTTPException(
            status_code=422, detail="strike_gte cannot be strictly greater than strike_lte"
        )
    if expiration_gte is not None and expiration_lte is not None and expiration_gte > expiration_lte:
        raise HTTPException(
            status_code=422, detail="expiration_gte cannot be strictly greater than expiration_lte"
        )

    ctype = contract_type.lower().strip() if contract_type else None
    if ctype == "both":
        ctype = None
    elif ctype not in ("call", "put", None):
        raise HTTPException(status_code=422, detail="contract_type must be call, put, or both")

    kwargs = {
        "expiration_gte": expiration_gte,
        "expiration_lte": expiration_lte,
        "strike_gte": strike_gte,
        "strike_lte": strike_lte,
        "contract_type": ctype,
    }

    # Filter out None kwargs for accurate cache keying
    active_filters = {k: v for k, v in kwargs.items() if v is not None}
    filter_str = ":".join(f"{k}={v}" for k, v in sorted(active_filters.items()))
    period_key = f"chain:{filter_str}" if filter_str else "chain"

    async with _get_symbol_lock(symbol):
        result = await _cache_mgr.get_or_fetch(
            "options", symbol, period_key,
            fetch_kwargs=kwargs,
            source_override="massive"
        )

    _handle_client_error(result.data if result else None)
    assert result is not None

    data = result.data
    contracts = data.get("chain", [])

    # Apply pagination locally since the cache holds the full filtered chain
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_contracts = contracts[start_idx:end_idx]

    has_more = end_idx < len(contracts)

    response_data = OptionsChainResponse(
        underlying_symbol=data.get("underlying_symbol", symbol),
        underlying_price=data.get("underlying_price"),
        chain=[OptionContractModel(**c) for c in paginated_contracts],
        contract_count=len(contracts),
        page=page,
        page_size=page_size,
        has_more=has_more,
        is_delayed=_is_delayed(),
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type=result.data_type,
        cache_key=result.cache_key,
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )


@router.get("/expirations/{symbol}", response_model=CachedResult)
async def get_expirations(
    symbol: str = Path(..., min_length=1, max_length=10),
) -> CachedResult:
    """Get sorted list of available option expiration dates."""
    symbol = symbol.strip().upper()

    async with _get_symbol_lock(symbol):
        # We'll fetch the whole chain and derive expirations just like MassiveClient does
        result = await _cache_mgr.get_or_fetch(
            "options", symbol, "chain",
            source_override="massive"
        )

    _handle_client_error(result.data if result else None)
    assert result is not None

    data = result.data
    contracts = data.get("chain", [])
    
    exp_counts: dict[str, int] = {}
    for c in contracts:
        exp = c["expiration"]
        exp_counts[exp] = exp_counts.get(exp, 0) + 1

    items = [
        ExpirationItem(expiration_date=k, contract_count=v)
        for k, v in sorted(exp_counts.items())
    ]

    response_data = ExpirationListResponse(
        underlying_symbol=data.get("underlying_symbol", symbol),
        expirations=items,
        total_expirations=len(items)
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type="options",
        cache_key=f"options:{symbol.upper()}:expirations",
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )


@router.get("/greeks/{symbol}", response_model=CachedResult)
async def get_greeks_summary(
    symbol: str = Path(..., min_length=1, max_length=10),
) -> CachedResult:
    """Get aggregated greeks summary per expiration."""
    symbol = symbol.strip().upper()

    async with _get_symbol_lock(symbol):
        # We manually call to massive client for greeks structure or derive if cached
        client = get_massive_client()
        cached = await _cache_mgr.get_or_fetch(
            "options", symbol, "chain",
            source_override="massive"
        )

    _handle_client_error(cached.data if cached else None)
    assert cached is not None

    chain_data = cached.data
    contracts = chain_data.get("chain", [])

    exps: dict[str, Any] = {}
    for c in contracts:
        exp = c["expiration"]
        if exp not in exps:
            exps[exp] = {"iv": [], "oi": 0, "calls": 0, "puts": 0, "count": 0}

        exps[exp]["count"] += 1
        if c.get("implied_volatility") is not None:
            exps[exp]["iv"].append(c["implied_volatility"])
        if c.get("open_interest") is not None:
            exps[exp]["oi"] += c["open_interest"]
        if c.get("contract_type") == "call":
            exps[exp]["calls"] += 1
        elif c.get("contract_type") == "put":
            exps[exp]["puts"] += 1

    results = []
    for exp, metrics in sorted(exps.items()):
        avg_iv = sum(metrics["iv"]) / len(metrics["iv"]) if metrics["iv"] else None
        pcr = metrics["puts"] / metrics["calls"] if metrics["calls"] > 0 else None
        # Replace 0 with None if missing
        oi = metrics["oi"] if metrics["oi"] > 0 else None
        results.append(
            GreeksExpirationItem(
                expiration=exp,
                avg_iv=avg_iv,
                put_call_ratio=pcr,
                total_open_interest=oi,
                contract_count=metrics["count"],
            )
        )

    response_data = GreeksSummaryResponse(
        underlying_symbol=chain_data.get("underlying_symbol", symbol),
        underlying_price=chain_data.get("underlying_price"),
        expirations=results
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type="options",
        cache_key=f"options:{symbol.upper()}:greeks",
        source=cached.source,
        is_cached=cached.is_cached,
        is_stale=cached.is_stale,
        fetched_at=cached.fetched_at,
        cache_age_seconds=cached.cache_age_seconds,
        cache_age_human=cached.cache_age_human,
        ttl_seconds=cached.ttl_seconds,
        expires_at=cached.expires_at,
    )


@router.get("/contract/{symbol}/{contract}", response_model=CachedResult)
async def get_single_contract(
    symbol: str = Path(..., min_length=1, max_length=10),
    contract: str = Path(..., pattern=r"^O:[A-Z]{1,10}\d{6}[CP]\d{8}$"),
) -> CachedResult:
    """Get single options contract detail."""
    symbol = symbol.strip().upper()
    contract = contract.strip().upper()

    # Create dummy fetch_fn for individual contract since dispatch won't cover it directly out of the box in CacheManager cleanly without extending CacheManager params.
    # It's cleaner to use get_or_fetch with a lambda.
    client = get_massive_client()
    async def fetcher():
        return await client.get_single_contract(symbol, contract)

    async with _get_symbol_lock(symbol):
        result = await _cache_mgr.get_or_fetch(
            "options", symbol, f"contract:{contract}",
            fetch_fn=fetcher,
            source_override="massive"
        )

    _handle_client_error(result.data if result else None)
    assert result is not None

    contract_data = result.data

    # Fair market value computation placeholder
    # In a real app we might put black-scholes here. We'll simply mirror mid-price if missing.
    fmv = contract_data.get("fair_market_value")
    if fmv is None:
        bid = contract_data.get("bid")
        ask = contract_data.get("ask")
        if bid is not None and ask is not None:
            fmv = (bid + ask) / 2.0
            contract_data["fair_market_value"] = fmv

    # Try mapping
    model_data = OptionContractDetailModel(**contract_data)
    
    # We don't have underlying_price stored natively in single contract snapshot typically, but we return None if absent
    response_data = ContractDetailResponse(
        underlying_symbol=symbol,
        underlying_price=None,
        contract=model_data
    )

    return CachedResult(
        data=response_data.model_dump(),
        data_type=result.data_type,
        cache_key=result.cache_key,
        source=result.source,
        is_cached=result.is_cached,
        is_stale=result.is_stale,
        fetched_at=result.fetched_at,
        cache_age_seconds=result.cache_age_seconds,
        cache_age_human=result.cache_age_human,
        ttl_seconds=result.ttl_seconds,
        expires_at=result.expires_at,
    )
