/**
 * Custom hook for fetching insider trading data with client-side caching.
 * Follows the same cancelled-flag pattern as useFundamentals.ts.
 */
import { useState, useEffect } from 'react';
import { getInsider } from '../api/client';
import type { InsiderData, InsiderApiResponse } from '../types/ownership';
import {
  INSIDER_CACHE_TTL_MS,
  normalizeInsider,
} from '../types/ownership';

interface CacheEntry {
  readonly data: InsiderData;
  readonly timestamp: number;
}

/** Module-level cache keyed by uppercase symbol. */
const cache = new Map<string, CacheEntry>();

export interface UseInsiderResult {
  readonly data: InsiderData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Clear the insider cache. Useful for testing or force-refresh.
 */
export function clearInsiderCache(): void {
  cache.clear();
}

/**
 * Fetch insider trading data for a given symbol.
 *
 * - Returns null data when symbol is empty (no fetch).
 * - Serves from a 15-minute client-side cache when available.
 * - Normalises snake_case backend response to camelCase via normalizeInsider.
 * - Uses safe static error messages (no XSS -- never reflects user input).
 * - No auto-retry on failure.
 *
 * @param symbol - Ticker symbol (e.g. "AAPL")
 */
export function useInsider(symbol: string): UseInsiderResult {
  const [data, setData] = useState<InsiderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const key = symbol.toUpperCase();

    // Check cache first
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < INSIDER_CACHE_TTL_MS) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getInsider(key)
      .then((raw: InsiderApiResponse) => {
        if (cancelled) return;

        const normalized = normalizeInsider(raw);
        cache.set(key, { data: normalized, timestamp: Date.now() });
        setData(normalized);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        // Static error message -- NEVER reflect user input (XSS prevention)
        setError('Failed to load insider data. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { data, loading, error };
}
