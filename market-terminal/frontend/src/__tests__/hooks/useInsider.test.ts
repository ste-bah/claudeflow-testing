import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { InsiderApiResponse } from '../../types/ownership';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
const mockGetInsider = vi.fn<(symbol: string) => Promise<InsiderApiResponse>>();

vi.mock('../../api/client', () => ({
  getInsider: (...args: [string]) => mockGetInsider(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------
import {
  useInsider,
  clearInsiderCache,
} from '../../hooks/useInsider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete raw insider API response in snake_case format. */
function makeInsiderResponse(
  overrides: Partial<InsiderApiResponse> = {},
): InsiderApiResponse {
  return {
    symbol: 'AAPL',
    transactions: [
      {
        insider_name: 'Tim Cook',
        title: 'CEO',
        transaction_type: 'S-Sale',
        transaction_date: '2024-11-15',
        shares: 50000,
        price_per_share: 185.50,
        total_value: 9275000,
        shares_remaining: 3000000,
        filing_date: '2024-11-17',
        filing_url: null,
      },
    ],
    summary: {
      period_days: 90,
      total_insider_buys: 10000,
      total_insider_sells: 50000,
      total_buy_value: 1850000,
      total_sell_value: 9275000,
      net_activity: 'net_selling',
      buy_sell_ratio: 0.2,
    },
    data_source: 'edgar_form4',
    data_timestamp: '2024-12-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  clearInsiderCache();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useInsider', () => {
  // ---- 1. Initial state ----

  it('should return loading=true initially when symbol is provided', () => {
    mockGetInsider.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useInsider('AAPL'));
    expect(result.current.loading).toBe(true);
  });

  // ---- 2. Calls API with uppercase symbol ----

  it('should call getInsider with uppercase symbol', async () => {
    mockGetInsider.mockResolvedValueOnce(makeInsiderResponse());
    const { result } = renderHook(() => useInsider('aapl'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetInsider).toHaveBeenCalledWith('AAPL');
  });

  // ---- 3. Successful fetch ----

  it('should return data after successful fetch', async () => {
    mockGetInsider.mockResolvedValueOnce(makeInsiderResponse());
    const { result } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.symbol).toBe('AAPL');
    expect(result.current.data!.transactions[0].insiderName).toBe('Tim Cook');
    expect(result.current.error).toBeNull();
  });

  // ---- 4. Error handling ----

  it('should return static error on fetch failure', async () => {
    mockGetInsider.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load insider data. Please try again later.',
    );
  });

  it('should return null data on error', async () => {
    mockGetInsider.mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  // ---- 5. Empty symbol ----

  it('should not fetch when symbol is empty', () => {
    const { result } = renderHook(() => useInsider(''));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetInsider).not.toHaveBeenCalled();
  });

  // ---- 6. Caching ----

  it('should cache data for same symbol', async () => {
    mockGetInsider.mockResolvedValueOnce(makeInsiderResponse());

    const { result, unmount } = renderHook(() => useInsider('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with same symbol -- should use cache
    const { result: result2 } = renderHook(() => useInsider('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data).not.toBeNull();
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetInsider).toHaveBeenCalledTimes(1); // no new call
  });

  // ---- 7. Cache expiry ----

  it('should re-fetch after cache expires', async () => {
    // Spy on Date.now to simulate time progression without breaking async flows
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    mockGetInsider.mockResolvedValue(makeInsiderResponse());

    const { result, unmount } = renderHook(() => useInsider('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(1);

    unmount();

    // Advance Date.now past the 15-minute TTL (900_000 ms)
    fakeNow += 900_001;

    // Re-render -- cache should be expired, should trigger new fetch
    const { result: result2 } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  // ---- 8. Symbol change ----

  it('should re-fetch when symbol changes', async () => {
    const aaplResponse = makeInsiderResponse({ symbol: 'AAPL' });
    const msftResponse = makeInsiderResponse({
      symbol: 'MSFT',
    });

    mockGetInsider
      .mockResolvedValueOnce(aaplResponse)
      .mockResolvedValueOnce(msftResponse);

    const { result, rerender } = renderHook(
      ({ sym }) => useInsider(sym),
      { initialProps: { sym: 'AAPL' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('AAPL');

    rerender({ sym: 'MSFT' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('MSFT');
    expect(mockGetInsider).toHaveBeenCalledTimes(2);
  });

  // ---- 9. Cancelled flag (unmount during fetch) ----

  it('should not update state when unmounted during fetch (cancelled flag)', async () => {
    let resolvePromise: (value: InsiderApiResponse) => void = () => {};
    const pendingPromise = new Promise<InsiderApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetInsider.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useInsider('NVDA'));
    expect(result.current.loading).toBe(true);

    // Unmount before the promise resolves
    unmount();

    // Resolve now -- should not cause state updates on unmounted component
    await act(async () => {
      resolvePromise(makeInsiderResponse({ symbol: 'NVDA' }));
    });

    // If we got here without warnings, the cancelled flag works
    expect(mockGetInsider).toHaveBeenCalledTimes(1);
  });

  it('should not update error state when unmounted during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<InsiderApiResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetInsider.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useInsider('AMD'));
    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetInsider).toHaveBeenCalledTimes(1);
  });

  // ---- 10. clearInsiderCache ----

  it('should force a fresh fetch after clearInsiderCache', async () => {
    mockGetInsider.mockResolvedValue(makeInsiderResponse());

    const { result, unmount } = renderHook(() => useInsider('MSFT'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(1);

    unmount();
    clearInsiderCache();

    // Same symbol should now trigger a new fetch
    const { result: result2 } = renderHook(() => useInsider('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(2);
  });

  // ---- 11. Normalization ----

  it('should normalize snake_case response to camelCase', async () => {
    mockGetInsider.mockResolvedValueOnce(makeInsiderResponse());
    const { result } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const data = result.current.data!;
    // Top-level normalized fields
    expect(data.dataSource).toBe('edgar_form4');
    expect(data.dataTimestamp).toBe('2024-12-01T12:00:00Z');

    // Transaction normalized fields
    const tx = data.transactions[0];
    expect(tx.insiderName).toBe('Tim Cook');
    expect(tx.title).toBe('CEO');
    expect(tx.transactionType).toBe('S-Sale');
    expect(tx.transactionDate).toBe('2024-11-15');
    expect(tx.shares).toBe(50000);
    expect(tx.pricePerShare).toBe(185.50);
    expect(tx.totalValue).toBe(9275000);
    expect(tx.sharesRemaining).toBe(3000000);
    expect(tx.filingDate).toBe('2024-11-17');

    // Summary normalized fields
    expect(data.summary.periodDays).toBe(90);
    expect(data.summary.totalInsiderBuys).toBe(10000);
    expect(data.summary.totalInsiderSells).toBe(50000);
    expect(data.summary.totalBuyValue).toBe(1850000);
    expect(data.summary.totalSellValue).toBe(9275000);
    expect(data.summary.netActivity).toBe('net_selling');
    expect(data.summary.buySellRatio).toBe(0.2);
  });

  // ---- 12. Empty transactions ----

  it('should handle empty transactions array', async () => {
    mockGetInsider.mockResolvedValueOnce(
      makeInsiderResponse({ transactions: [] }),
    );
    const { result } = renderHook(() => useInsider('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data!.transactions).toEqual([]);
  });

  // ---- 13. Case normalization for cache ----

  it('should use same cache key for different case symbols', async () => {
    mockGetInsider.mockResolvedValue(makeInsiderResponse());

    const { result, unmount } = renderHook(() => useInsider('aapl'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetInsider).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with uppercase -- should be a cache hit
    const { result: result2 } = renderHook(() => useInsider('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetInsider).toHaveBeenCalledTimes(1);
  });

  // ---- 14. Different symbols use different cache entries ----

  it('should fetch separately for different symbols', async () => {
    const aaplResp = makeInsiderResponse({ symbol: 'AAPL' });
    const msftResp = makeInsiderResponse({ symbol: 'MSFT' });

    mockGetInsider
      .mockResolvedValueOnce(aaplResp)
      .mockResolvedValueOnce(msftResp);

    const { result, unmount } = renderHook(() => useInsider('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('AAPL');

    unmount();

    const { result: result2 } = renderHook(() => useInsider('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.data!.symbol).toBe('MSFT');
    expect(mockGetInsider).toHaveBeenCalledTimes(2);
  });

  // ---- 15. Loading transitions ----

  it('should set loading=false after fetch completes', async () => {
    mockGetInsider.mockResolvedValueOnce(makeInsiderResponse());
    const { result } = renderHook(() => useInsider('AAPL'));

    // Starts as loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  it('should set loading=false after fetch fails', async () => {
    mockGetInsider.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useInsider('AAPL'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});
