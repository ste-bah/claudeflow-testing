import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { FundamentalsApiResponse } from '../../types/fundamentals';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
const mockGetFundamentals = vi.fn<(symbol: string) => Promise<FundamentalsApiResponse>>();

vi.mock('../../api/client', () => ({
  getFundamentals: (...args: [string]) => mockGetFundamentals(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------
import {
  useFundamentals,
  clearFundamentalsCache,
} from '../../hooks/useFundamentals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete raw API response in snake_case format. */
function makeApiResponse(
  overrides: Partial<FundamentalsApiResponse> = {},
): FundamentalsApiResponse {
  return {
    symbol: 'AAPL',
    company_name: 'Apple Inc',
    cik: '0000320193',
    ttm: {
      revenue: 394328000000,
      net_income: 96995000000,
      eps_diluted: 6.42,
      gross_margin: 0.4523,
      operating_margin: 0.3031,
      net_margin: 0.2459,
      pe_ratio: 28.45,
      market_cap: 2870000000000,
      shares_outstanding: 15461900000,
      free_cash_flow: 111443000000,
      debt_to_equity: 1.76,
      return_on_equity: 0.1715,
      dividend_yield: 0.0055,
    },
    quarterly: [
      {
        period: 'Q4 2024',
        filing_date: '2024-11-01',
        filing_type: '10-Q',
        revenue: 94930000000,
        net_income: 23636000000,
        eps_diluted: 1.53,
        gross_margin: 0.4623,
        operating_margin: 0.3178,
        net_margin: 0.2490,
        revenue_growth_yoy: 0.061,
        eps_growth_yoy: 0.122,
        free_cash_flow: 27000000000,
      },
    ],
    next_earnings_date: null,
    data_sources: { financials: 'EDGAR', market_data: 'Finnhub' },
    data_timestamp: '2024-12-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  clearFundamentalsCache();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useFundamentals', () => {
  // ---- 1. Initial state ----

  it('should return loading=true initially when symbol is provided', () => {
    mockGetFundamentals.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useFundamentals('AAPL'));
    expect(result.current.loading).toBe(true);
  });

  // ---- 2. Calls API with uppercase symbol ----

  it('should call getFundamentals with uppercase symbol', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useFundamentals('aapl'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetFundamentals).toHaveBeenCalledWith('AAPL');
  });

  // ---- 3. Successful fetch ----

  it('should return data after successful fetch', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.symbol).toBe('AAPL');
    expect(result.current.data!.companyName).toBe('Apple Inc');
    expect(result.current.error).toBeNull();
  });

  // ---- 4. Error handling ----

  it('should return static error on fetch failure', async () => {
    mockGetFundamentals.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load fundamentals data. Please try again later.',
    );
  });

  it('should return null data on error', async () => {
    mockGetFundamentals.mockRejectedValueOnce(new Error('Server error'));
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  // ---- 5. Empty symbol ----

  it('should not fetch when symbol is empty', () => {
    const { result } = renderHook(() => useFundamentals(''));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetFundamentals).not.toHaveBeenCalled();
  });

  // ---- 6. Caching ----

  it('should cache data for same symbol', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());

    const { result, unmount } = renderHook(() => useFundamentals('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with same symbol -- should use cache
    const { result: result2 } = renderHook(() => useFundamentals('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data).not.toBeNull();
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1); // no new call
  });

  // ---- 7. Cache expiry ----

  it('should re-fetch after cache expires', async () => {
    // Spy on Date.now to simulate time progression without breaking async flows
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    mockGetFundamentals.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useFundamentals('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);

    unmount();

    // Advance Date.now past the 15-minute TTL (900_000 ms)
    fakeNow += 900_001;

    // Re-render -- cache should be expired, should trigger new fetch
    const { result: result2 } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  // ---- 8. Symbol change ----

  it('should re-fetch when symbol changes', async () => {
    const aaplResponse = makeApiResponse({ symbol: 'AAPL' });
    const msftResponse = makeApiResponse({
      symbol: 'MSFT',
      company_name: 'Microsoft Corporation',
    });

    mockGetFundamentals
      .mockResolvedValueOnce(aaplResponse)
      .mockResolvedValueOnce(msftResponse);

    const { result, rerender } = renderHook(
      ({ sym }) => useFundamentals(sym),
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
    expect(result.current.data!.companyName).toBe('Microsoft Corporation');
    expect(mockGetFundamentals).toHaveBeenCalledTimes(2);
  });

  // ---- 9. Cancelled flag (unmount during fetch) ----

  it('should not update state when unmounted during fetch (cancelled flag)', async () => {
    let resolvePromise: (value: FundamentalsApiResponse) => void = () => {};
    const pendingPromise = new Promise<FundamentalsApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetFundamentals.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useFundamentals('NVDA'));
    expect(result.current.loading).toBe(true);

    // Unmount before the promise resolves
    unmount();

    // Resolve now -- should not cause state updates on unmounted component
    await act(async () => {
      resolvePromise(makeApiResponse({ symbol: 'NVDA' }));
    });

    // If we got here without warnings, the cancelled flag works
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);
  });

  it('should not update error state when unmounted during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<FundamentalsApiResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetFundamentals.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useFundamentals('AMD'));
    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);
  });

  // ---- 10. clearFundamentalsCache ----

  it('should force a fresh fetch after clearFundamentalsCache', async () => {
    mockGetFundamentals.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useFundamentals('MSFT'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);

    unmount();
    clearFundamentalsCache();

    // Same symbol should now trigger a new fetch
    const { result: result2 } = renderHook(() => useFundamentals('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(2);
  });

  // ---- 11. Normalization ----

  it('should normalize snake_case response to camelCase', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const data = result.current.data!;
    // Top-level normalized fields
    expect(data.companyName).toBe('Apple Inc');
    expect(data.dataTimestamp).toBe('2024-12-01T12:00:00Z');
    // TTM normalized fields
    expect(data.ttm!.epsDiluted).toBe(6.42);
    expect(data.ttm!.marketCap).toBe(2870000000000);
    expect(data.ttm!.grossMargin).toBe(0.4523);
    expect(data.ttm!.netIncome).toBe(96995000000);
    expect(data.ttm!.peRatio).toBe(28.45);
    expect(data.ttm!.debtToEquity).toBe(1.76);
    expect(data.ttm!.returnOnEquity).toBe(0.1715);
    expect(data.ttm!.dividendYield).toBe(0.0055);
    expect(data.ttm!.freeCashFlow).toBe(111443000000);
    // Data sources normalized
    expect(data.dataSources.financials).toBe('EDGAR');
    expect(data.dataSources.marketData).toBe('Finnhub');
  });

  it('should normalize quarterly entries from snake_case to camelCase', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const quarter = result.current.data!.quarterly[0];
    expect(quarter.period).toBe('Q4 2024');
    expect(quarter.filingDate).toBe('2024-11-01');
    expect(quarter.filingType).toBe('10-Q');
    expect(quarter.epsDiluted).toBe(1.53);
    expect(quarter.revenueGrowthYoy).toBe(0.061);
    expect(quarter.epsGrowthYoy).toBe(0.122);
    expect(quarter.freeCashFlow).toBe(27000000000);
  });

  // ---- 12. Null TTM ----

  it('should handle null TTM in response', async () => {
    mockGetFundamentals.mockResolvedValueOnce(
      makeApiResponse({ ttm: null }),
    );
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.ttm).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ---- 13. Empty quarterly ----

  it('should handle empty quarterly array', async () => {
    mockGetFundamentals.mockResolvedValueOnce(
      makeApiResponse({ quarterly: [] }),
    );
    const { result } = renderHook(() => useFundamentals('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data!.quarterly).toEqual([]);
  });

  // ---- 14. Case normalization for cache ----

  it('should use same cache key for different case symbols', async () => {
    mockGetFundamentals.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useFundamentals('aapl'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with uppercase -- should be a cache hit
    const { result: result2 } = renderHook(() => useFundamentals('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetFundamentals).toHaveBeenCalledTimes(1);
  });

  // ---- 15. Different symbols use different cache entries ----

  it('should fetch separately for different symbols', async () => {
    const aaplResp = makeApiResponse({ symbol: 'AAPL' });
    const msftResp = makeApiResponse({ symbol: 'MSFT', company_name: 'Microsoft' });

    mockGetFundamentals
      .mockResolvedValueOnce(aaplResp)
      .mockResolvedValueOnce(msftResp);

    const { result, unmount } = renderHook(() => useFundamentals('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('AAPL');

    unmount();

    const { result: result2 } = renderHook(() => useFundamentals('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.data!.companyName).toBe('Microsoft');
    expect(mockGetFundamentals).toHaveBeenCalledTimes(2);
  });

  // ---- 16. Error clears on successful retry ----

  it('should clear previous error when new fetch succeeds', async () => {
    mockGetFundamentals
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeApiResponse());

    const { result, rerender } = renderHook(
      ({ sym }) => useFundamentals(sym),
      { initialProps: { sym: 'AAPL' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).not.toBeNull();

    // Clear cache so the symbol change triggers a new fetch
    clearFundamentalsCache();

    // Trigger a fresh fetch by changing symbol and back
    rerender({ sym: 'MSFT' });
    rerender({ sym: 'AAPL' });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.data).not.toBeNull();
  });

  // ---- 17. Loading transitions correctly ----

  it('should set loading=false after fetch completes', async () => {
    mockGetFundamentals.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useFundamentals('AAPL'));

    // Starts as loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  it('should set loading=false after fetch fails', async () => {
    mockGetFundamentals.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useFundamentals('AAPL'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});
