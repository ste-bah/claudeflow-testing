import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { WatchlistResponse } from '../../types/watchlist';

// ---- Mock API client ----

const mockGetWatchlist = vi.fn<() => Promise<WatchlistResponse>>();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();

vi.mock('../../api/client', () => ({
  getWatchlist: () => mockGetWatchlist(),
  addToWatchlist: (...args: unknown[]) => mockAddToWatchlist(...args),
  removeFromWatchlist: (...args: unknown[]) => mockRemoveFromWatchlist(...args),
}));

// Import AFTER mock setup so the module picks up the mock
import { useWatchlist } from '../../hooks/useWatchlist';

// ---- Helpers ----

function makeWatchlistResponse(
  overrides: Partial<WatchlistResponse> = {},
): WatchlistResponse {
  return {
    tickers: [],
    count: 0,
    max_allowed: 50,
    groups: ['default'],
    ...overrides,
  };
}

function makeAxiosError(status: number): Error {
  const err = new Error('Request failed') as Error & {
    isAxiosError: boolean;
    response: { status: number };
  };
  err.isAxiosError = true;
  err.response = { status };
  // Patch axios.isAxiosError to recognize this mock error
  return err;
}

// ---- Tests ----

describe('useWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful empty watchlist
    mockGetWatchlist.mockResolvedValue(makeWatchlistResponse());
  });

  // ----------------------------------------------------------------
  // Initial state and fetch
  // ----------------------------------------------------------------

  it('should start with loading=true', () => {
    // Use a pending promise so fetch never resolves
    mockGetWatchlist.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.loading).toBe(true);
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch watchlist on mount and update state', async () => {
    const tickers = [
      {
        symbol: 'AAPL',
        group: 'default',
        added_at: '2024-01-01T00:00:00Z',
        position: 0,
        last_price: 185.50,
        price_change_percent: 1.25,
        last_composite_signal: 'bullish' as const,
        last_composite_confidence: 0.80,
        last_updated: '2024-01-01T12:00:00Z',
      },
    ];
    mockGetWatchlist.mockResolvedValue(
      makeWatchlistResponse({ tickers, count: 1, max_allowed: 50 }),
    );

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toEqual(tickers);
    expect(result.current.count).toBe(1);
    expect(result.current.maxAllowed).toBe(50);
    expect(result.current.error).toBeNull();
  });

  it('should set error on failed fetch', async () => {
    mockGetWatchlist.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load watchlist. Please try again.');
    expect(result.current.entries).toEqual([]);
  });

  // ----------------------------------------------------------------
  // addEntry - validation
  // ----------------------------------------------------------------

  it('should reject invalid symbol format', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('123');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockAddToWatchlist).not.toHaveBeenCalled();
  });

  it('should reject empty string symbol', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockAddToWatchlist).not.toHaveBeenCalled();
  });

  it('should reject symbol longer than 5 chars', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('ABCDEF');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockAddToWatchlist).not.toHaveBeenCalled();
  });

  it('should reject lowercase symbols (regex requires uppercase)', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('aapl');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockAddToWatchlist).not.toHaveBeenCalled();
  });

  it('should reject when at max capacity', async () => {
    mockGetWatchlist.mockResolvedValue(
      makeWatchlistResponse({ count: 50, max_allowed: 50 }),
    );

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.error).toBe('Watchlist is full. Remove a ticker first.');
    expect(mockAddToWatchlist).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // addEntry - success
  // ----------------------------------------------------------------

  it('should call addToWatchlist API and trigger refresh on success', async () => {
    mockAddToWatchlist.mockResolvedValue({});

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First fetch call
    expect(mockGetWatchlist).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(mockAddToWatchlist).toHaveBeenCalledWith('AAPL', undefined);

    // refreshKey incremented triggers re-fetch
    await waitFor(() => {
      expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
    });
  });

  it('should pass group parameter to addToWatchlist', async () => {
    mockAddToWatchlist.mockResolvedValue({});

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL', 'tech');
    });

    expect(mockAddToWatchlist).toHaveBeenCalledWith('AAPL', 'tech');
  });

  // ----------------------------------------------------------------
  // addEntry - concurrent guard
  // ----------------------------------------------------------------

  it('should guard against concurrent adds', async () => {
    // Make the API call slow
    let resolveAdd: () => void = () => {};
    mockAddToWatchlist.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAdd = resolve;
      }),
    );

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start first add (don't await)
    let firstAdd: Promise<void>;
    act(() => {
      firstAdd = result.current.addEntry('AAPL');
    });

    // adding should be true now
    expect(result.current.adding).toBe(true);

    // Try second add while first is in progress
    await act(async () => {
      await result.current.addEntry('MSFT');
    });

    // Second call should have been skipped (adding guard)
    expect(mockAddToWatchlist).toHaveBeenCalledTimes(1);
    expect(mockAddToWatchlist).toHaveBeenCalledWith('AAPL', undefined);

    // Resolve the first add
    await act(async () => {
      resolveAdd();
      await firstAdd!;
    });

    expect(result.current.adding).toBe(false);
  });

  // ----------------------------------------------------------------
  // addEntry - error mapping
  // ----------------------------------------------------------------

  it('should map 409 status to duplicate error message', async () => {
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(409));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.error).toBe('Ticker already exists in watchlist.');
  });

  it('should map 400 status to full watchlist error message', async () => {
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(400));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.error).toBe('Watchlist is full. Remove a ticker first.');
  });

  it('should map other axios errors to generic add error message', async () => {
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(500));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.error).toBe('Failed to add ticker. Please try again.');
  });

  it('should map non-axios errors to generic add error message', async () => {
    mockAddToWatchlist.mockRejectedValue(new TypeError('Unexpected'));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.error).toBe('Failed to add ticker. Please try again.');
  });

  // ----------------------------------------------------------------
  // removeEntry - success
  // ----------------------------------------------------------------

  it('should call removeFromWatchlist API and trigger refresh on success', async () => {
    mockRemoveFromWatchlist.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetWatchlist).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.removeEntry('AAPL');
    });

    expect(mockRemoveFromWatchlist).toHaveBeenCalledWith('AAPL');

    // refreshKey incremented triggers re-fetch
    await waitFor(() => {
      expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
    });
  });

  it('should clear any existing error before removing', async () => {
    // First, produce an error
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(409));

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });
    expect(result.current.error).toBe('Ticker already exists in watchlist.');

    // Now remove should clear the error
    mockRemoveFromWatchlist.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.removeEntry('MSFT');
    });

    // Error should be cleared (null) because removeEntry sets error = null first
    expect(result.current.error).toBeNull();
  });

  // ----------------------------------------------------------------
  // removeEntry - validation
  // ----------------------------------------------------------------

  it('should reject removeEntry with invalid symbol format', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeEntry('123');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockRemoveFromWatchlist).not.toHaveBeenCalled();
  });

  it('should reject removeEntry with empty string', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeEntry('');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockRemoveFromWatchlist).not.toHaveBeenCalled();
  });

  it('should reject removeEntry with lowercase symbol', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeEntry('aapl');
    });

    expect(result.current.error).toBe('Invalid ticker symbol format.');
    expect(mockRemoveFromWatchlist).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // removeEntry - error mapping
  // ----------------------------------------------------------------

  it('should map 404 status to not found error message', async () => {
    mockRemoveFromWatchlist.mockRejectedValue(makeAxiosError(404));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeEntry('AAPL');
    });

    expect(result.current.error).toBe('Ticker not found in watchlist.');
  });

  it('should map non-404 remove errors to generic remove error message', async () => {
    mockRemoveFromWatchlist.mockRejectedValue(new Error('Network fail'));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeEntry('AAPL');
    });

    expect(result.current.error).toBe('Failed to remove ticker. Please try again.');
  });

  // ----------------------------------------------------------------
  // refresh
  // ----------------------------------------------------------------

  it('should trigger re-fetch when refresh is called', async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetWatchlist).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------------
  // Cleanup - cancelled flag
  // ----------------------------------------------------------------

  it('should not update state after unmount during fetch', async () => {
    let resolvePromise: (value: WatchlistResponse) => void = () => {};
    const pendingPromise = new Promise<WatchlistResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetWatchlist.mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useWatchlist());

    expect(result.current.loading).toBe(true);

    // Unmount before the fetch resolves
    unmount();

    // Resolve -- cancelled flag should prevent state updates
    await act(async () => {
      resolvePromise(
        makeWatchlistResponse({
          tickers: [
            {
              symbol: 'AAPL',
              group: 'default',
              added_at: '2024-01-01T00:00:00Z',
              position: 0,
              last_price: 185.50,
              price_change_percent: 1.25,
              last_composite_signal: null,
              last_composite_confidence: null,
              last_updated: null,
            },
          ],
          count: 1,
        }),
      );
    });

    // No error should have been thrown about updating unmounted component
    expect(mockGetWatchlist).toHaveBeenCalledTimes(1);
  });

  it('should not update error state after unmount during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<WatchlistResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetWatchlist.mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useWatchlist());

    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetWatchlist).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // Adding flag reset
  // ----------------------------------------------------------------

  it('should reset adding to false after successful add', async () => {
    mockAddToWatchlist.mockResolvedValue({});

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.adding).toBe(false);
  });

  it('should reset adding to false after failed add', async () => {
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(500));

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry('AAPL');
    });

    expect(result.current.adding).toBe(false);
  });

  // ----------------------------------------------------------------
  // Error messages are all static strings (never reflect user input)
  // ----------------------------------------------------------------

  it('should never reflect user-supplied symbol in error messages', async () => {
    const maliciousSymbol = 'AAPL'; // Even a valid symbol should not appear in errors
    mockAddToWatchlist.mockRejectedValue(makeAxiosError(409));

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addEntry(maliciousSymbol);
    });

    // Error message should be a static string, not containing the input
    expect(result.current.error).toBe('Ticker already exists in watchlist.');
    // Verify it doesn't contain the symbol we passed in
    expect(result.current.error).not.toContain(maliciousSymbol);
  });
});
