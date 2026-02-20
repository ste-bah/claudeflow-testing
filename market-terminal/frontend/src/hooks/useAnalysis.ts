/**
 * Custom hook for fetching multi-methodology analysis data with client-side caching.
 * Follows the same cancelled-flag pattern as useOwnership.ts.
 *
 * If no cached analysis exists (GET returns 404), the hook automatically
 * triggers a fresh analysis run via POST and then re-fetches the result.
 */
import { useState, useEffect } from 'react';
import { getAnalysis, analyzeSymbol } from '../api/client';
import { isApiError } from '../api/errors';
import type { AnalysisData, AnalysisApiResponse } from '../types/analysis';
import {
  ANALYSIS_CACHE_TTL_MS,
  normalizeAnalysis,
} from '../types/analysis';
import { DEFAULT_TIMEFRAME, type Timeframe } from '../types/ticker';

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
 * Fetch multi-methodology analysis data for a given symbol and chart timeframe.
 *
 * - `timeframe` controls the OHLCV window and EW ZigZag sensitivity. Defaults to '1d'.
 * - Cache key is `symbol:timeframe` so different timeframes are cached separately.
 * - On 404, auto-triggers a POST to run analysis, then re-fetches.
 *
 * @param symbol - Ticker symbol (e.g. "AAPL")
 * @param timeframe - Chart timeframe (e.g. "1w" fetches 10yr of weekly bars)
 * @param refreshKey - Optional key to force a re-fetch when incremented
 */
export function useAnalysis(
  symbol: string,
  timeframe: Timeframe = DEFAULT_TIMEFRAME,
  refreshKey?: number,
): UseAnalysisResult {
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

    // Include timeframe in the cache key so 1W and 1D results are stored separately.
    const key = `${symbol.toUpperCase()}:${timeframe}`;

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

    getAnalysis(symbol.toUpperCase(), { timeframe, signal: controller.signal })
      .catch(async (err: unknown) => {
        // If no cached analysis exists (404), trigger a fresh analysis run
        if (isApiError(err) && err.status === 404) {
          await analyzeSymbol(symbol.toUpperCase(), { timeframe });
          return getAnalysis(symbol.toUpperCase(), { timeframe, signal: controller.signal });
        }
        throw err;
      })
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
        setError('Failed to load analysis data. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, timeframe, refreshKey]);

  return { data, loading, error };
}

