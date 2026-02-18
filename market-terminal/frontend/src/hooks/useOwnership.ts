/**
 * Custom hook for fetching institutional ownership data with client-side caching.
 * Follows the same cancelled-flag pattern as useFundamentals.ts.
 */
import { useState, useEffect } from 'react';
import { getOwnership } from '../api/client';
import type { OwnershipData, OwnershipApiResponse } from '../types/ownership';
import {
  OWNERSHIP_CACHE_TTL_MS,
  normalizeOwnership,
} from '../types/ownership';

interface CacheEntry {
  readonly data: OwnershipData;
  readonly timestamp: number;
}

/** Module-level cache keyed by uppercase symbol. */
const cache = new Map<string, CacheEntry>();

export interface UseOwnershipResult {
  readonly data: OwnershipData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Clear the ownership cache. Useful for testing or force-refresh.
 */
export function clearOwnershipCache(): void {
  cache.clear();
}

/**
 * Fetch institutional ownership data for a given symbol.
 *
 * - Returns null data when symbol is empty (no fetch).
 * - Serves from a 15-minute client-side cache when available.
 * - Normalises snake_case backend response to camelCase via normalizeOwnership.
 * - Uses safe static error messages (no XSS -- never reflects user input).
 * - No auto-retry on failure.
 *
 * @param symbol - Ticker symbol (e.g. "AAPL")
 */
export function useOwnership(symbol: string): UseOwnershipResult {
  const [data, setData] = useState<OwnershipData | null>(null);
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
    if (cached && Date.now() - cached.timestamp < OWNERSHIP_CACHE_TTL_MS) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getOwnership(key)
      .then((raw: OwnershipApiResponse) => {
        if (cancelled) return;

        const normalized = normalizeOwnership(raw);
        cache.set(key, { data: normalized, timestamp: Date.now() });
        setData(normalized);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        // Static error message -- NEVER reflect user input (XSS prevention)
        setError('Failed to load ownership data. Please try again later.');
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
