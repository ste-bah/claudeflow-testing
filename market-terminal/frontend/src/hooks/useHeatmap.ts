/**
 * Custom hook for fetching heatmap data with 60-second polling and client-side caching.
 * Follows the same cancelled-flag pattern as useNewsFeed.ts.
 */
import { useEffect, useState } from 'react';
import type { HeatmapData, IndexFilter, SectorFilter } from '../types/heatmap';
import { getHeatmap } from '../api/heatmap';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const HEATMAP_CACHE_TTL_MS = 60_000;   // 60 seconds
const POLL_INTERVAL_MS = 60_000;        // normal poll interval
const FAST_POLL_MS = 5_000;             // fast-poll when backend prices not yet loaded

interface CacheEntry {
  readonly data: HeatmapData;
  readonly timestamp: number;
}

/** Module-level cache keyed by "index:sector". */
const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Result interface
// ---------------------------------------------------------------------------

export interface UseHeatmapResult {
  readonly data: HeatmapData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch heatmap data for the given index and sector filters, polling every 60s.
 *
 * - Serves cached data immediately when a valid cache entry exists.
 * - Always fetches fresh data in background after serving from cache.
 * - Uses safe static error messages (never reflects user input -- XSS prevention).
 * - Clears the polling interval on unmount via cancelled-flag pattern.
 *
 * @param index  - Index filter ('all', 'sp500', or 'nasdaq100')
 * @param sector - Sector filter ('all' or a GICS sector name)
 */
export function useHeatmap(
  index: IndexFilter = 'all',
  sector: SectorFilter = 'all',
): UseHeatmapResult {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${index}:${sector}`;
    let cancelled = false;
    let fastPollId: ReturnType<typeof setTimeout> | null = null;

    async function fetchData(): Promise<void> {
      // Clear any pending fast-poll before issuing a new fetch.
      if (fastPollId !== null) {
        clearTimeout(fastPollId);
        fastPollId = null;
      }

      const cached = cache.get(cacheKey);

      // Serve cached data immediately so there is no loading flash.
      if (cached) {
        setData(cached.data);
        setError(null);
        setLoading(false);
      }

      // Show loading spinner only on the very first fetch (no cached data).
      if (!cached) {
        setLoading(true);
      }

      try {
        const result = await getHeatmap(index, sector);
        if (cancelled) return;

        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        setData(result);
        setError(null);

        // If the backend hasn't finished its background price fetch yet,
        // schedule a fast re-poll so prices appear within ~5s of loading.
        if (!result.pricesReady) {
          fastPollId = setTimeout(() => {
            if (!cancelled) fetchData();
          }, FAST_POLL_MS);
        }
      } catch {
        if (cancelled) return;
        // Only surface an error when there is no cached data to fall back to.
        if (!cached) {
          setError('Failed to load heatmap data. Please try again.');
        }
        // If cached data exists, silently keep showing it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();

    // Poll every 60 seconds to keep data fresh.
    const intervalId = setInterval(() => {
      fetchData();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (fastPollId !== null) clearTimeout(fastPollId);
    };
  }, [index, sector]);

  return { data, loading, error };
}

/**
 * Clear the heatmap cache. Useful for testing or force-refresh.
 */
export function clearHeatmapCache(): void {
  cache.clear();
}
