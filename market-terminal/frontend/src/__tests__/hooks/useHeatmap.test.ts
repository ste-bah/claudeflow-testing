import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { HeatmapData } from '../../types/heatmap';

// ---------------------------------------------------------------------------
// Mock the API client BEFORE importing the hook
// ---------------------------------------------------------------------------

const mockGetHeatmap = vi.fn<(index: string, sector: string) => Promise<HeatmapData>>();

vi.mock('../../api/heatmap', () => ({
  getHeatmap: (...args: unknown[]) => mockGetHeatmap(...(args as [string, string])),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup
// ---------------------------------------------------------------------------

import { useHeatmap, clearHeatmapCache } from '../../hooks/useHeatmap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid HeatmapData object. */
function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    stocks: [],
    refreshedAt: '2024-06-15T10:30:00Z',
    nextRefreshIn: 60,
    totalCount: 0,
    filteredCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHeatmapCache();
  });

  // -------------------------------------------------------------------------
  // 1. Initial loading state
  // -------------------------------------------------------------------------

  describe('initial loading', () => {
    it('returns loading=true initially when no cache exists', async () => {
      // Never resolves during the synchronous assertions
      mockGetHeatmap.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useHeatmap());

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('returns loading=false after successful fetch', async () => {
      mockGetHeatmap.mockResolvedValueOnce(makeHeatmapData({ totalCount: 10 }));

      const { result } = renderHook(() => useHeatmap());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).not.toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Successful fetch
  // -------------------------------------------------------------------------

  describe('successful fetch', () => {
    it('returns data after a successful fetch', async () => {
      const heatmapData = makeHeatmapData({ totalCount: 5, filteredCount: 5 });
      mockGetHeatmap.mockResolvedValueOnce(heatmapData);

      const { result } = renderHook(() => useHeatmap());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(heatmapData);
      expect(result.current.error).toBeNull();
    });

    it('calls getHeatmap with the correct index and sector params', async () => {
      mockGetHeatmap.mockResolvedValueOnce(makeHeatmapData());

      renderHook(() => useHeatmap('sp500', 'Technology'));

      await waitFor(() => {
        expect(mockGetHeatmap).toHaveBeenCalledWith('sp500', 'Technology');
      });

      expect(mockGetHeatmap).toHaveBeenCalledTimes(1);
    });

    it('calls getHeatmap with "all" defaults when no params provided', async () => {
      mockGetHeatmap.mockResolvedValueOnce(makeHeatmapData());

      renderHook(() => useHeatmap());

      await waitFor(() => {
        expect(mockGetHeatmap).toHaveBeenCalledWith('all', 'all');
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Cache behaviour
  // -------------------------------------------------------------------------

  describe('cache behaviour', () => {
    it('serves cached data immediately with loading=false when cache exists', async () => {
      const heatmapData = makeHeatmapData({ totalCount: 3 });
      // Prime the cache with a first fetch
      mockGetHeatmap.mockResolvedValueOnce(heatmapData);

      const { result: first, unmount } = renderHook(() => useHeatmap());
      await waitFor(() => expect(first.current.loading).toBe(false));
      unmount();

      // Second render — cache is warm; background fetch pending (never resolves here)
      mockGetHeatmap.mockReturnValueOnce(new Promise(() => {}));
      const { result: second } = renderHook(() => useHeatmap());

      // Should immediately show cached data without a loading flash
      expect(second.current.loading).toBe(false);
      expect(second.current.data).toEqual(heatmapData);
      expect(second.current.error).toBeNull();
    });

    it('caches data separately for different filter combinations', async () => {
      const allData = makeHeatmapData({ totalCount: 100 });
      const sp500Data = makeHeatmapData({ totalCount: 50 });

      mockGetHeatmap
        .mockResolvedValueOnce(allData)
        .mockResolvedValueOnce(sp500Data);

      const { result: r1, unmount: u1 } = renderHook(() => useHeatmap('all', 'all'));
      await waitFor(() => expect(r1.current.loading).toBe(false));
      expect(r1.current.data?.totalCount).toBe(100);
      u1();

      const { result: r2, unmount: u2 } = renderHook(() => useHeatmap('sp500', 'all'));
      await waitFor(() => expect(r2.current.loading).toBe(false));
      expect(r2.current.data?.totalCount).toBe(50);
      u2();

      expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('sets error when fetch fails and no cache exists', async () => {
      mockGetHeatmap.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useHeatmap());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load heatmap data. Please try again.');
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('does NOT set error when fetch fails but cached data exists', async () => {
      const cachedData = makeHeatmapData({ totalCount: 7 });

      // Prime the cache
      mockGetHeatmap.mockResolvedValueOnce(cachedData);
      const { result: first, unmount } = renderHook(() => useHeatmap());
      await waitFor(() => expect(first.current.loading).toBe(false));
      unmount();

      // Background fetch fails — cached data should remain visible, no error
      mockGetHeatmap.mockRejectedValueOnce(new Error('Server down'));
      const { result: second } = renderHook(() => useHeatmap());

      await waitFor(() => {
        expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
      });

      // Allow any async microtasks to settle
      await act(async () => {
        await Promise.resolve();
      });

      expect(second.current.data).toEqual(cachedData);
      expect(second.current.error).toBeNull();
    });

    it('uses a static error message and never reflects user input (XSS prevention)', async () => {
      mockGetHeatmap.mockRejectedValueOnce(
        new Error('<script>alert("xss")</script>'),
      );

      const { result } = renderHook(() => useHeatmap());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toContain('script');
      expect(result.current.error).not.toContain('xss');
      expect(result.current.error).toBe('Failed to load heatmap data. Please try again.');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Filter dependency re-fetching
  // -------------------------------------------------------------------------

  describe('filter dependency re-fetching', () => {
    it('re-fetches when index filter changes', async () => {
      const allData = makeHeatmapData({ totalCount: 100 });
      const sp500Data = makeHeatmapData({ totalCount: 50 });
      mockGetHeatmap
        .mockResolvedValueOnce(allData)
        .mockResolvedValueOnce(sp500Data);

      const { result, rerender } = renderHook(
        ({ index }: { index: 'all' | 'sp500' | 'nasdaq100' }) =>
          useHeatmap(index, 'all'),
        { initialProps: { index: 'all' as const } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.totalCount).toBe(100);

      rerender({ index: 'sp500' });

      await waitFor(() => expect(result.current.data?.totalCount).toBe(50));
      expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
      expect(mockGetHeatmap).toHaveBeenLastCalledWith('sp500', 'all');
    });

    it('re-fetches when sector filter changes', async () => {
      const allData = makeHeatmapData({ totalCount: 200 });
      const techData = makeHeatmapData({ totalCount: 42 });
      mockGetHeatmap
        .mockResolvedValueOnce(allData)
        .mockResolvedValueOnce(techData);

      const { result, rerender } = renderHook(
        ({ sector }: { sector: string }) =>
          useHeatmap('all', sector as 'all' | 'Technology'),
        { initialProps: { sector: 'all' } },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.totalCount).toBe(200);

      rerender({ sector: 'Technology' });

      await waitFor(() => expect(result.current.data?.totalCount).toBe(42));
      expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
      expect(mockGetHeatmap).toHaveBeenLastCalledWith('all', 'Technology');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Polling
  // -------------------------------------------------------------------------

  describe('polling', () => {
    it('polls every 60 seconds after initial fetch', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const firstData = makeHeatmapData({ totalCount: 1 });
      const secondData = makeHeatmapData({ totalCount: 2 });
      const thirdData = makeHeatmapData({ totalCount: 3 });

      mockGetHeatmap
        .mockResolvedValueOnce(firstData)
        .mockResolvedValueOnce(secondData)
        .mockResolvedValueOnce(thirdData);

      const { result } = renderHook(() => useHeatmap());

      // Initial fetch
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data?.totalCount).toBe(1);
      expect(mockGetHeatmap).toHaveBeenCalledTimes(1);

      // Advance 60s → second poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      await waitFor(() => {
        expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
      });
      expect(result.current.data?.totalCount).toBe(2);

      // Advance another 60s → third poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      await waitFor(() => {
        expect(mockGetHeatmap).toHaveBeenCalledTimes(3);
      });
      expect(result.current.data?.totalCount).toBe(3);

      vi.useRealTimers();
    });

    it('clears the polling interval on unmount (no state updates after unmount)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockGetHeatmap.mockResolvedValue(makeHeatmapData());

      const { result, unmount } = renderHook(() => useHeatmap());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetHeatmap).toHaveBeenCalledTimes(1);

      // Unmount — interval must be cleared
      unmount();

      // Advance 120s — should NOT trigger any more fetches
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });

      // Call count must remain at 1 (no further polls after unmount)
      expect(mockGetHeatmap).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // 7. clearHeatmapCache
  // -------------------------------------------------------------------------

  describe('clearHeatmapCache', () => {
    it('forces a fresh fetch (with loading=true) after cache is cleared', async () => {
      const cachedData = makeHeatmapData({ totalCount: 99 });
      mockGetHeatmap.mockResolvedValue(cachedData);

      // Prime the cache
      const { result, unmount } = renderHook(() => useHeatmap());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetHeatmap).toHaveBeenCalledTimes(1);
      unmount();

      // Clear cache
      clearHeatmapCache();

      // Re-mount — cache is empty, so loading should be true initially
      const newData = makeHeatmapData({ totalCount: 1 });
      mockGetHeatmap.mockResolvedValueOnce(newData);
      const { result: result2 } = renderHook(() => useHeatmap());

      expect(result2.current.loading).toBe(true);

      await waitFor(() => expect(result2.current.loading).toBe(false));
      expect(mockGetHeatmap).toHaveBeenCalledTimes(2);
    });
  });
});
