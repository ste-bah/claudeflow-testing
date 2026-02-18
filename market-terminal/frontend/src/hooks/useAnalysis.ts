/**
 * Custom hook for fetching multi-methodology analysis data with client-side caching.
 * Follows the same cancelled-flag pattern as useOwnership.ts.
 */
import { useState, useEffect } from 'react';
import { getAnalysis } from '../api/client';
import type { AnalysisData, AnalysisApiResponse } from '../types/analysis';
import {
  ANALYSIS_CACHE_TTL_MS,
  normalizeAnalysis,
} from '../types/analysis';

interface CacheEntry {
  readonly data: AnalysisData;
  readonly timestamp: number;
}

/** Module-level cache keyed by uppercase symbol. */
const cache = new Map<string, CacheEntry>();

export interface UseAnalysisResult {
  readonly data: AnalysisData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Clear the analysis cache. Useful for testing or force-refresh.
 */
export function clearAnalysisCache(): void {
  cache.clear();
}

/**
 * Fetch multi-methodology analysis data for a given symbol.
 *
 * - Returns null data when symbol is empty (no fetch).
 * - Serves from a 15-minute client-side cache when available.
 * - Normalises snake_case backend response to camelCase via normalizeAnalysis.
 * - Uses safe static error messages (no XSS -- never reflects user input).
 * - No auto-retry on failure.
 *
 * @param symbol - Ticker symbol (e.g. "AAPL")
 * @param refreshKey - Optional key to force a re-fetch when incremented (e.g. after WebSocket analysis_complete)
 */
export function useAnalysis(symbol: string, refreshKey?: number): UseAnalysisResult {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
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
    if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL_MS) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getAnalysis(key, { signal: controller.signal })
      .then((raw: AnalysisApiResponse) => {
        if (cancelled) return;

        const normalized = normalizeAnalysis(raw);
        cache.set(key, { data: normalized, timestamp: Date.now() });
        setData(normalized);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Ignore abort errors -- these are expected on symbol change / unmount
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as Record<string, unknown>).code === 'ERR_CANCELED'
        ) {
          return;
        }
        setData(null);
        // Static error message -- NEVER reflect user input (XSS prevention)
        setError('Failed to load analysis data. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, refreshKey]);

  return { data, loading, error };
}
