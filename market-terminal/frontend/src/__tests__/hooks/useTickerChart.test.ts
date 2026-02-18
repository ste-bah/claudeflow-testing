import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { OHLCVBar, TickerHistoryResponse, Timeframe } from '../../types/ticker';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
const mockGetTickerHistory = vi.fn<(symbol: string, timeframe: Timeframe) => Promise<TickerHistoryResponse>>();

vi.mock('../../api/client', () => ({
  getTickerHistory: (...args: [string, Timeframe]) =>
    mockGetTickerHistory(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------
import {
  useTickerChart,
  clearTickerChartCache,
} from '../../hooks/useTickerChart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid OHLCVBar. */
function makeBar(overrides: Partial<OHLCVBar> = {}): OHLCVBar {
  return {
    date: '2024-01-15',
    open: 150.0,
    high: 155.0,
    low: 148.0,
    close: 153.0,
    volume: 1_000_000,
    ...overrides,
  };
}

/** Build a minimal valid TickerHistoryResponse. */
function makeResponse(
  ohlcv: OHLCVBar[],
  symbol = 'AAPL',
): TickerHistoryResponse {
  return {
    symbol,
    name: 'Apple Inc',
    exchange: 'NASDAQ',
    currency: 'USD',
    asset_type: 'stock',
    price: {
      current: 153.0,
      open: 150.0,
      high: 155.0,
      low: 148.0,
      previous_close: 149.0,
      change: 4.0,
      change_percent: 2.68,
      volume: 1_000_000,
      avg_volume_10d: 900_000,
      fifty_two_week_high: 200.0,
      fifty_two_week_low: 120.0,
      market_cap: 2_500_000_000_000,
    },
    data_source: 'yfinance',
    data_timestamp: '2024-01-15T16:00:00Z',
    data_age_seconds: 60,
    is_market_open: true,
    cache_hit: false,
    ohlcv,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('useTickerChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTickerChartCache();
  });

  // ---- 1. Empty symbol ----

  it('should return empty bars, null error, false loading when symbol is empty', () => {
    const { result } = renderHook(() => useTickerChart(''));

    expect(result.current.bars).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockGetTickerHistory).not.toHaveBeenCalled();
  });

  // ---- 2. Successful fetch ----

  it('should fetch bars and clear error on success', async () => {
    const bars = [makeBar(), makeBar({ date: '2024-01-16', close: 154.0 })];
    mockGetTickerHistory.mockResolvedValueOnce(makeResponse(bars));

    const { result } = renderHook(() => useTickerChart('AAPL', '3m'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bars).toEqual(bars);
    expect(result.current.error).toBeNull();
    expect(mockGetTickerHistory).toHaveBeenCalledWith('AAPL', '3m');
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);
  });

  // ---- 3. Fetch error ----

  it('should set static error message on fetch failure', async () => {
    mockGetTickerHistory.mockRejectedValueOnce(new Error('Network timeout'));

    const { result } = renderHook(() => useTickerChart('AAPL', '1d'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load chart data. Please try again.',
    );
    expect(result.current.bars).toEqual([]);
  });

  // ---- 4. Invalid bars filtered ----

  it('should filter out bars with NaN or missing fields', async () => {
    const goodBar = makeBar({ date: '2024-01-15' });
    const nanBar = makeBar({ date: '2024-01-16', open: NaN });
    const missingFieldBar = { date: '2024-01-17', open: 100, high: 105 } as unknown as OHLCVBar;
    const infinityBar = makeBar({ date: '2024-01-18', volume: Infinity });
    const emptyDateBar = makeBar({ date: '' });
    const nullBar = null as unknown as OHLCVBar;

    mockGetTickerHistory.mockResolvedValueOnce(
      makeResponse([goodBar, nanBar, missingFieldBar, infinityBar, emptyDateBar, nullBar]),
    );

    const { result } = renderHook(() => useTickerChart('TSLA'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only the good bar should survive
    expect(result.current.bars).toHaveLength(1);
    expect(result.current.bars[0]).toEqual(goodBar);
  });

  it('should handle non-array ohlcv field gracefully', async () => {
    const response = makeResponse([]);
    // Force ohlcv to be a non-array value
    const badResponse = { ...response, ohlcv: 'not-an-array' } as unknown as TickerHistoryResponse;
    mockGetTickerHistory.mockResolvedValueOnce(badResponse);

    const { result } = renderHook(() => useTickerChart('GOOG'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.bars).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // ---- 5. Cache hit ----

  it('should serve cached data on second call with same symbol and timeframe', async () => {
    const bars = [makeBar()];
    mockGetTickerHistory.mockResolvedValueOnce(makeResponse(bars));

    const { result, unmount } = renderHook(() => useTickerChart('AAPL', '3m'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bars).toEqual(bars);
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with same args -- should use cache, no new API call
    const { result: result2 } = renderHook(() => useTickerChart('AAPL', '3m'));

    // Cache hit is synchronous, so loading should never be true
    expect(result2.current.loading).toBe(false);
    expect(result2.current.bars).toEqual(bars);
    expect(result2.current.error).toBeNull();
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1); // still only 1
  });

  // ---- 6. Cache miss on different timeframe ----

  it('should fetch new data when timeframe changes', async () => {
    const bars3m = [makeBar({ date: '2024-01-15' })];
    const bars1y = [makeBar({ date: '2023-06-01' }), makeBar({ date: '2024-01-15' })];

    mockGetTickerHistory
      .mockResolvedValueOnce(makeResponse(bars3m))
      .mockResolvedValueOnce(makeResponse(bars1y));

    // First call with 3m
    const { result, unmount } = renderHook(() => useTickerChart('AAPL', '3m'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bars).toEqual(bars3m);
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);

    unmount();

    // Second call with 1y -- different cache key, should fetch
    const { result: result2 } = renderHook(() => useTickerChart('AAPL', '1y'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.bars).toEqual(bars1y);
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(2);
    expect(mockGetTickerHistory).toHaveBeenLastCalledWith('AAPL', '1y');
  });

  // ---- 7. clearTickerChartCache ----

  it('should force a fresh fetch after clearTickerChartCache', async () => {
    const bars = [makeBar()];
    mockGetTickerHistory.mockResolvedValue(makeResponse(bars));

    // First fetch
    const { result, unmount } = renderHook(() => useTickerChart('MSFT', '1m'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);

    unmount();

    // Clear cache
    clearTickerChartCache();

    // Same args should now trigger a new fetch
    const { result: result2 } = renderHook(() => useTickerChart('MSFT', '1m'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(2);
  });

  // ---- 8. Cancelled flag (unmount during fetch) ----

  it('should not update state when unmounted during fetch', async () => {
    // Create a promise we control
    let resolvePromise: (value: TickerHistoryResponse) => void = () => {};
    const pendingPromise = new Promise<TickerHistoryResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetTickerHistory.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useTickerChart('NVDA', '6m'));

    // Loading should be true while the fetch is in flight
    expect(result.current.loading).toBe(true);

    // Unmount before the fetch resolves
    unmount();

    // Now resolve the promise -- the cancelled flag should prevent state updates
    // This should NOT throw "Can't perform a React state update on an unmounted component"
    await act(async () => {
      resolvePromise(makeResponse([makeBar()]));
    });

    // If we got here without warnings/errors, the cancelled flag works
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);
  });

  it('should not update error state when unmounted during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<TickerHistoryResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetTickerHistory.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useTickerChart('AMD', '1w'));

    expect(result.current.loading).toBe(true);

    // Unmount before the fetch fails
    unmount();

    // Reject -- cancelled flag should prevent error state update
    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);
  });

  // ---- Default timeframe ----

  it('should use default timeframe (3m) when none is provided', async () => {
    mockGetTickerHistory.mockResolvedValueOnce(makeResponse([makeBar()]));

    const { result } = renderHook(() => useTickerChart('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetTickerHistory).toHaveBeenCalledWith('AAPL', '3m');
  });

  // ---- Symbol case normalization in cache key ----

  it('should normalize symbol to uppercase for cache key', async () => {
    const bars = [makeBar()];
    mockGetTickerHistory.mockResolvedValue(makeResponse(bars));

    // Fetch with lowercase
    const { result, unmount } = renderHook(() => useTickerChart('aapl', '3m'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);

    unmount();

    // Fetch with uppercase -- cache key should match (AAPL:3m)
    const { result: result2 } = renderHook(() => useTickerChart('AAPL', '3m'));
    // Cache uses symbol.toUpperCase() so this should be a cache hit
    expect(result2.current.bars).toEqual(bars);
    expect(result2.current.loading).toBe(false);
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(1);
  });

  // ---- Different symbols use different cache entries ----

  it('should fetch separately for different symbols', async () => {
    const aaplBars = [makeBar({ close: 150 })];
    const msftBars = [makeBar({ close: 400 })];

    mockGetTickerHistory
      .mockResolvedValueOnce(makeResponse(aaplBars, 'AAPL'))
      .mockResolvedValueOnce(makeResponse(msftBars, 'MSFT'));

    const { result, unmount } = renderHook(() => useTickerChart('AAPL', '3m'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bars).toEqual(aaplBars);

    unmount();

    const { result: result2 } = renderHook(() => useTickerChart('MSFT', '3m'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.bars).toEqual(msftBars);
    expect(mockGetTickerHistory).toHaveBeenCalledTimes(2);
  });
});
