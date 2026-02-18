import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { OwnershipApiResponse } from '../../types/ownership';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
const mockGetOwnership = vi.fn<(symbol: string) => Promise<OwnershipApiResponse>>();

vi.mock('../../api/client', () => ({
  getOwnership: (...args: [string]) => mockGetOwnership(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------
import {
  useOwnership,
  clearOwnershipCache,
} from '../../hooks/useOwnership';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete raw API response in snake_case format. */
function makeOwnershipResponse(
  overrides: Partial<OwnershipApiResponse> = {},
): OwnershipApiResponse {
  return {
    symbol: 'AAPL',
    filing_period: 'Q3 2024',
    total_institutional_shares: 15000000000,
    total_institutional_value: 2700000000000,
    institutional_ownership_percent: null,
    holders: [
      {
        holder_name: 'Vanguard Group',
        cik: '0000102909',
        shares: 1300000000,
        value: 234000000000,
        percent_of_outstanding: null,
        change_shares: 5000000,
        change_percent: 0.39,
        filing_date: '2024-08-14',
      },
    ],
    quarter_over_quarter: {
      new_positions: 0,
      increased_positions: 12,
      decreased_positions: 5,
      closed_positions: 0,
      net_shares_change: 50000000,
    },
    data_source: 'edgar_13f',
    data_timestamp: '2024-12-01T12:00:00Z',
    note: '13F filings have a 45-day reporting delay.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  clearOwnershipCache();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useOwnership', () => {
  // ---- 1. Initial state ----

  it('should return loading=true initially when symbol is provided', () => {
    mockGetOwnership.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useOwnership('AAPL'));
    expect(result.current.loading).toBe(true);
  });

  // ---- 2. Calls API with uppercase symbol ----

  it('should call getOwnership with uppercase symbol', async () => {
    mockGetOwnership.mockResolvedValueOnce(makeOwnershipResponse());
    const { result } = renderHook(() => useOwnership('aapl'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetOwnership).toHaveBeenCalledWith('AAPL');
  });

  // ---- 3. Successful fetch ----

  it('should return data after successful fetch', async () => {
    mockGetOwnership.mockResolvedValueOnce(makeOwnershipResponse());
    const { result } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.symbol).toBe('AAPL');
    expect(result.current.data!.holders[0].holderName).toBe('Vanguard Group');
    expect(result.current.error).toBeNull();
  });

  // ---- 4. Error handling ----

  it('should return static error on fetch failure', async () => {
    mockGetOwnership.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load ownership data. Please try again later.',
    );
  });

  it('should return null data on error', async () => {
    mockGetOwnership.mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  // ---- 5. Empty symbol ----

  it('should not fetch when symbol is empty', () => {
    const { result } = renderHook(() => useOwnership(''));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetOwnership).not.toHaveBeenCalled();
  });

  // ---- 6. Caching ----

  it('should cache data for same symbol', async () => {
    mockGetOwnership.mockResolvedValueOnce(makeOwnershipResponse());

    const { result, unmount } = renderHook(() => useOwnership('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with same symbol -- should use cache
    const { result: result2 } = renderHook(() => useOwnership('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data).not.toBeNull();
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetOwnership).toHaveBeenCalledTimes(1); // no new call
  });

  // ---- 7. Cache expiry ----

  it('should re-fetch after cache expires', async () => {
    // Spy on Date.now to simulate time progression without breaking async flows
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    mockGetOwnership.mockResolvedValue(makeOwnershipResponse());

    const { result, unmount } = renderHook(() => useOwnership('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);

    unmount();

    // Advance Date.now past the 15-minute TTL (900_000 ms)
    fakeNow += 900_001;

    // Re-render -- cache should be expired, should trigger new fetch
    const { result: result2 } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  // ---- 8. Symbol change ----

  it('should re-fetch when symbol changes', async () => {
    const aaplResponse = makeOwnershipResponse({ symbol: 'AAPL' });
    const msftResponse = makeOwnershipResponse({
      symbol: 'MSFT',
      filing_period: 'Q3 2024',
    });

    mockGetOwnership
      .mockResolvedValueOnce(aaplResponse)
      .mockResolvedValueOnce(msftResponse);

    const { result, rerender } = renderHook(
      ({ sym }) => useOwnership(sym),
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
    expect(mockGetOwnership).toHaveBeenCalledTimes(2);
  });

  // ---- 9. Cancelled flag (unmount during fetch) ----

  it('should not update state when unmounted during fetch (cancelled flag)', async () => {
    let resolvePromise: (value: OwnershipApiResponse) => void = () => {};
    const pendingPromise = new Promise<OwnershipApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetOwnership.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useOwnership('NVDA'));
    expect(result.current.loading).toBe(true);

    // Unmount before the promise resolves
    unmount();

    // Resolve now -- should not cause state updates on unmounted component
    await act(async () => {
      resolvePromise(makeOwnershipResponse({ symbol: 'NVDA' }));
    });

    // If we got here without warnings, the cancelled flag works
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);
  });

  it('should not update error state when unmounted during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<OwnershipApiResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetOwnership.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useOwnership('AMD'));
    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetOwnership).toHaveBeenCalledTimes(1);
  });

  // ---- 10. clearOwnershipCache ----

  it('should force a fresh fetch after clearOwnershipCache', async () => {
    mockGetOwnership.mockResolvedValue(makeOwnershipResponse());

    const { result, unmount } = renderHook(() => useOwnership('MSFT'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);

    unmount();
    clearOwnershipCache();

    // Same symbol should now trigger a new fetch
    const { result: result2 } = renderHook(() => useOwnership('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(2);
  });

  // ---- 11. Normalization ----

  it('should normalize snake_case response to camelCase', async () => {
    mockGetOwnership.mockResolvedValueOnce(makeOwnershipResponse());
    const { result } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const data = result.current.data!;
    // Top-level normalized fields
    expect(data.filingPeriod).toBe('Q3 2024');
    expect(data.totalInstitutionalShares).toBe(15000000000);
    expect(data.totalInstitutionalValue).toBe(2700000000000);
    expect(data.institutionalOwnershipPercent).toBeNull();
    expect(data.dataSource).toBe('edgar_13f');
    expect(data.dataTimestamp).toBe('2024-12-01T12:00:00Z');
    expect(data.note).toBe('13F filings have a 45-day reporting delay.');

    // Holder normalized fields
    const holder = data.holders[0];
    expect(holder.holderName).toBe('Vanguard Group');
    expect(holder.cik).toBe('0000102909');
    expect(holder.shares).toBe(1300000000);
    expect(holder.value).toBe(234000000000);
    expect(holder.percentOfOutstanding).toBeNull();
    expect(holder.changeShares).toBe(5000000);
    expect(holder.changePercent).toBe(0.39);
    expect(holder.filingDate).toBe('2024-08-14');

    // Quarter-over-quarter normalized fields
    expect(data.quarterOverQuarter.newPositions).toBe(0);
    expect(data.quarterOverQuarter.increasedPositions).toBe(12);
    expect(data.quarterOverQuarter.decreasedPositions).toBe(5);
    expect(data.quarterOverQuarter.closedPositions).toBe(0);
    expect(data.quarterOverQuarter.netSharesChange).toBe(50000000);
  });

  // ---- 12. Empty holders ----

  it('should handle empty holders array', async () => {
    mockGetOwnership.mockResolvedValueOnce(
      makeOwnershipResponse({ holders: [] }),
    );
    const { result } = renderHook(() => useOwnership('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data!.holders).toEqual([]);
  });

  // ---- 13. Case normalization for cache ----

  it('should use same cache key for different case symbols', async () => {
    mockGetOwnership.mockResolvedValue(makeOwnershipResponse());

    const { result, unmount } = renderHook(() => useOwnership('aapl'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with uppercase -- should be a cache hit
    const { result: result2 } = renderHook(() => useOwnership('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetOwnership).toHaveBeenCalledTimes(1);
  });

  // ---- 14. Different symbols use different cache entries ----

  it('should fetch separately for different symbols', async () => {
    const aaplResp = makeOwnershipResponse({ symbol: 'AAPL' });
    const msftResp = makeOwnershipResponse({ symbol: 'MSFT' });

    mockGetOwnership
      .mockResolvedValueOnce(aaplResp)
      .mockResolvedValueOnce(msftResp);

    const { result, unmount } = renderHook(() => useOwnership('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('AAPL');

    unmount();

    const { result: result2 } = renderHook(() => useOwnership('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.data!.symbol).toBe('MSFT');
    expect(mockGetOwnership).toHaveBeenCalledTimes(2);
  });

  // ---- 15. Loading transitions ----

  it('should set loading=false after fetch completes', async () => {
    mockGetOwnership.mockResolvedValueOnce(makeOwnershipResponse());
    const { result } = renderHook(() => useOwnership('AAPL'));

    // Starts as loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  it('should set loading=false after fetch fails', async () => {
    mockGetOwnership.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useOwnership('AAPL'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});
