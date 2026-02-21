/**
 * Options Chain Data Types
 * TASK-UPDATE-005
 * Wire-to-Display types matching backend `snake_case` models to frontend `camelCase`.
 */

export interface OptionContractRaw {
    strike: number;
    expiration: string;
    contract_type: string;
    bid: number | null;
    ask: number | null;
    last_price: number | null;
    volume: number | null;
    open_interest: number | null;
    implied_volatility: number | null;
    delta: number | null;
    gamma: number | null;
    theta: number | null;
    vega: number | null;
    break_even_price: number | null;
    option_ticker: string;
}

export interface OptionContract {
    strike: number;
    expiration: string;
    contractType: string;
    bid: number | null;
    ask: number | null;
    lastPrice: number | null;
    volume: number | null;
    openInterest: number | null;
    impliedVolatility: number | null;
    delta: number | null;
    gamma: number | null;
    theta: number | null;
    vega: number | null;
    breakEvenPrice: number | null;
    optionTicker: string;
}

export interface OptionsChainRaw {
    underlying_symbol: string;
    underlying_price: number | null;
    chain: OptionContractRaw[];
    contract_count: number;
    page: number;
    page_size: number;
    has_more: boolean;
    is_delayed: boolean;
}

export interface OptionsChain {
    underlyingSymbol: string;
    underlyingPrice: number | null;
    chain: OptionContract[];
    contractCount: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    isDelayed: boolean;
}

export interface ExpirationInfoRaw {
    expiration_date: string;
    contract_count: number;
}

export interface ExpirationInfo {
    expirationDate: string;
    contractCount: number;
}

export interface GreeksExpirationRaw {
    expiration: string;
    avg_iv: number | null;
    put_call_ratio: number | null;
    total_open_interest: number | null;
    contract_count: number;
}

export interface GreeksExpirationInfo {
    expiration: string;
    avgIv: number | null;
    putCallRatio: number | null;
    totalOpenInterest: number | null;
    contractCount: number;
}

export interface GreeksSummaryRaw {
    underlying_symbol: string;
    underlying_price: number | null;
    expirations: GreeksExpirationRaw[];
}

export interface GreeksSummary {
    underlyingSymbol: string;
    underlyingPrice: number | null;
    expirations: GreeksExpirationInfo[];
}

/**
 * Ensures a value is strictly a finite number, protecting against booleans,
 * NaN, Infinity, strings, and objects.
 */
export function sanitizeNumber(value: unknown): number | null {
    if (typeof value === 'boolean') {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return null;
}

export function normalizeOptionContract(raw: OptionContractRaw): OptionContract {
    return {
        strike: sanitizeNumber(raw.strike) ?? 0,
        expiration: raw.expiration,
        contractType: raw.contract_type,
        bid: sanitizeNumber(raw.bid),
        ask: sanitizeNumber(raw.ask),
        lastPrice: sanitizeNumber(raw.last_price),
        volume: sanitizeNumber(raw.volume),
        openInterest: sanitizeNumber(raw.open_interest),
        impliedVolatility: sanitizeNumber(raw.implied_volatility),
        delta: sanitizeNumber(raw.delta),
        gamma: sanitizeNumber(raw.gamma),
        theta: sanitizeNumber(raw.theta),
        vega: sanitizeNumber(raw.vega),
        breakEvenPrice: sanitizeNumber(raw.break_even_price),
        optionTicker: raw.option_ticker,
    };
}

export function normalizeOptionsChain(raw: OptionsChainRaw): OptionsChain {
    return {
        underlyingSymbol: raw.underlying_symbol,
        underlyingPrice: sanitizeNumber(raw.underlying_price),
        chain: (raw.chain || []).map(normalizeOptionContract),
        contractCount: sanitizeNumber(raw.contract_count) ?? 0,
        page: sanitizeNumber(raw.page) ?? 1,
        pageSize: sanitizeNumber(raw.page_size) ?? 250,
        hasMore: Boolean(raw.has_more),
        isDelayed: Boolean(raw.is_delayed),
    };
}

export function normalizeExpirationInfo(raw: ExpirationInfoRaw): ExpirationInfo {
    return {
        expirationDate: raw.expiration_date,
        contractCount: sanitizeNumber(raw.contract_count) ?? 0,
    };
}

export function normalizeGreeksSummary(raw: GreeksSummaryRaw): GreeksSummary {
    return {
        underlyingSymbol: raw.underlying_symbol,
        underlyingPrice: sanitizeNumber(raw.underlying_price),
        expirations: (raw.expirations || []).map(exp => ({
            expiration: exp.expiration,
            avgIv: sanitizeNumber(exp.avg_iv),
            putCallRatio: sanitizeNumber(exp.put_call_ratio),
            totalOpenInterest: sanitizeNumber(exp.total_open_interest),
            contractCount: sanitizeNumber(exp.contract_count) ?? 0,
        })),
    };
}
