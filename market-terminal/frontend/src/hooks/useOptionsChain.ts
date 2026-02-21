/**
 * React Hooks for Options Chain Data
 * TASK-UPDATE-005
 */
import { useState, useEffect, useRef } from 'react';
import {
    OptionsChain,
    OptionsChainRaw,
    ExpirationInfo,
    ExpirationInfoRaw,
    GreeksSummary,
    GreeksSummaryRaw,
    normalizeOptionsChain,
    normalizeExpirationInfo,
    normalizeGreeksSummary,
} from '../types/options';

const API_BASE_URL = '/api';

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
const OPTIONS_CACHE_TTL_MS = 60000;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const chainCache = new Map<string, CacheEntry<OptionsChain>>();
const expirationsCache = new Map<string, CacheEntry<ExpirationInfo[]>>();
const greeksCache = new Map<string, CacheEntry<GreeksSummary>>();

function enforceMapLimit(map: Map<string, unknown>, limit = 50) {
    if (map.size > limit) {
        const oldestKey = map.keys().next().value;
        if (oldestKey) map.delete(oldestKey);
    }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface OptionsChainFilters {
    expirationGte?: string;
    expirationLte?: string;
    strikeGte?: number;
    strikeLte?: number;
    contractType?: 'call' | 'put' | 'both';
}

export function useOptionsChain(symbol: string, filters?: OptionsChainFilters) {
    const [data, setData] = useState<OptionsChain | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [cacheAge, setCacheAge] = useState<number | null>(null);
    const [isDelayed, setIsDelayed] = useState(false);

    const activeSymbolRef = useRef(symbol);

    useEffect(() => {
        activeSymbolRef.current = symbol;
        if (!symbol) return;

        let cancelled = false;
        const controller = new AbortController();

        const fetchChain = async (retryCount = 0) => {
            // Setup payload + cache keys
            const safeFilters = filters || {};
            const params = new URLSearchParams();
            if (safeFilters.expirationGte) params.append('expiration_gte', safeFilters.expirationGte);
            if (safeFilters.expirationLte) params.append('expiration_lte', safeFilters.expirationLte);
            if (safeFilters.strikeGte) params.append('strike_gte', safeFilters.strikeGte.toString());
            if (safeFilters.strikeLte) params.append('strike_lte', safeFilters.strikeLte.toString());
            if (safeFilters.contractType && safeFilters.contractType !== 'both') params.append('contract_type', safeFilters.contractType);

            const qs = params.toString();
            const cacheKey = `${symbol.toUpperCase()}_${qs}`;

            // Check cache
            const cached = chainCache.get(cacheKey);
            const now = Date.now();
            if (cached) {
                setCacheAge(now - cached.timestamp);
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setData(cached.data);
                    setIsDelayed(cached.data.isDelayed);
                    if (now - cached.timestamp < OPTIONS_CACHE_TTL_MS) {
                        setIsStale(false);
                        return;
                    } else {
                        setIsStale(true);
                    }
                }
            }

            setIsLoading(true);
            if (!cached) setError(null);

            try {
                const url = `${API_BASE_URL}/options/chain/${symbol}${qs ? '?' + qs : ''}`;
                const res = await fetch(url, { signal: controller.signal });

                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }

                const json = await res.json();
                if (cancelled || activeSymbolRef.current !== symbol) return;

                const rawData: OptionsChainRaw = json.data;
                const normalized = normalizeOptionsChain(rawData);

                chainCache.set(cacheKey, { data: normalized, timestamp: now });
                enforceMapLimit(chainCache);

                setData(normalized);
                setIsDelayed(normalized.isDelayed);
                setCacheAge(0);
                setIsStale(false);
                setError(null);
            } catch (err: unknown) {
                if (cancelled || activeSymbolRef.current !== symbol) return;

                // Prevent showing underlying abort errors or server dumps to the user
                if (err instanceof DOMException && err.name === 'AbortError') return;

                if (retryCount < 1) {
                    setError('Retrying...');
                    setTimeout(() => fetchChain(retryCount + 1), 2000);
                    return;
                }

                setError('Options data temporarily unavailable');
            } finally {
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setIsLoading(false);
                }
            }
        };

        fetchChain();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [symbol, JSON.stringify(filters)]);

    return { data, isLoading, error, isStale, cacheAge, isDelayed };
}

export function useExpirations(symbol: string) {
    const [expirations, setExpirations] = useState<ExpirationInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeSymbolRef = useRef(symbol);

    useEffect(() => {
        activeSymbolRef.current = symbol;
        if (!symbol) return;

        let cancelled = false;
        const controller = new AbortController();

        const fetchExp = async () => {
            const cacheKey = symbol.toUpperCase();
            const cached = expirationsCache.get(cacheKey);
            const now = Date.now();

            if (cached) {
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setExpirations(cached.data);
                    if (now - cached.timestamp < OPTIONS_CACHE_TTL_MS) return;
                }
            }

            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE_URL}/options/expirations/${symbol}`, { signal: controller.signal });
                if (!res.ok) throw new Error('Network error');

                const json = await res.json();
                if (cancelled || activeSymbolRef.current !== symbol) return;

                const rawList: ExpirationInfoRaw[] = json.data?.expirations || [];
                const normalized = rawList.map(normalizeExpirationInfo);

                expirationsCache.set(cacheKey, { data: normalized, timestamp: now });
                enforceMapLimit(expirationsCache);

                setExpirations(normalized);
                setError(null);
            } catch (err: unknown) {
                if (cancelled || activeSymbolRef.current !== symbol) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('Failed to load expiration dates');
            } finally {
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setIsLoading(false);
                }
            }
        };

        fetchExp();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [symbol]);

    return { expirations, isLoading, error };
}

export function useGreeksSummary(symbol: string) {
    const [greeksSummary, setGreeksSummary] = useState<GreeksSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeSymbolRef = useRef(symbol);

    useEffect(() => {
        activeSymbolRef.current = symbol;
        if (!symbol) return;

        let cancelled = false;
        const controller = new AbortController();

        const fetchGreeks = async () => {
            const cacheKey = symbol.toUpperCase();
            const cached = greeksCache.get(cacheKey);
            const now = Date.now();

            if (cached) {
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setGreeksSummary(cached.data);
                    if (now - cached.timestamp < OPTIONS_CACHE_TTL_MS) return;
                }
            }

            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE_URL}/options/greeks/${symbol}`, { signal: controller.signal });
                if (!res.ok) throw new Error('Network error');

                const json = await res.json();
                if (cancelled || activeSymbolRef.current !== symbol) return;

                const rawData: GreeksSummaryRaw = json.data;
                const normalized = normalizeGreeksSummary(rawData);

                greeksCache.set(cacheKey, { data: normalized, timestamp: now });
                enforceMapLimit(greeksCache);

                setGreeksSummary(normalized);
                setError(null);
            } catch (err: unknown) {
                if (cancelled || activeSymbolRef.current !== symbol) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('Failed to load greeks data');
            } finally {
                if (!cancelled && activeSymbolRef.current === symbol) {
                    setIsLoading(false);
                }
            }
        };

        fetchGreeks();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [symbol]);

    return { greeksSummary, isLoading, error };
}
