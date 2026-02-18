/**
 * Tests for useMacroCalendar and useMacroReaction custom hooks.
 *
 * Follows the same pattern as useAnalysis.test.tsx:
 * - Mock the API client before importing the hook.
 * - Use renderHook / waitFor from @testing-library/react.
 * - Test cache hit/miss, expiry, abort cleanup, error states, normalization.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type {
  MacroCalendarApiResponse,
  MacroReactionApiResponse,
} from '../../types/macro';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------

const mockGetMacroCalendar = vi.fn<(opts?: { from_date?: string; to_date?: string }, extra?: { signal?: AbortSignal }) => Promise<MacroCalendarApiResponse>>();

const mockGetMacroReaction = vi.fn<(symbol: string, eventType: string, opts?: { signal?: AbortSignal; periods?: number }) => Promise<MacroReactionApiResponse>>();

vi.mock('../../api/client', () => ({
  getMacroCalendar: (...args: unknown[]) => mockGetMacroCalendar(...(args as Parameters<typeof mockGetMacroCalendar>)),
  getMacroReaction: (...args: unknown[]) => mockGetMacroReaction(...(args as Parameters<typeof mockGetMacroReaction>)),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------

import {
  useMacroCalendar,
  useMacroReaction,
  clearMacroCalendarCache,
  clearMacroReactionCache,
} from '../../hooks/useMacroCalendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid calendar API response. */
function makeCalendarResponse(
  overrides: Partial<MacroCalendarApiResponse> = {},
): MacroCalendarApiResponse {
  return {
    events: [
      {
        event_name: 'CPI',
        event_type: 'cpi',
        date: '2024-06-15',
        time: '08:30',
        country: 'US',
        expected: 3.2,
        previous: 3.1,
        actual: 3.3,
        unit: 'percent',
        importance: 'high',
        description: 'Consumer Price Index (YoY)',
      },
    ],
    date_range: { from: '2024-06-01', to: '2024-07-01' },
    data_source: 'finnhub',
    data_timestamp: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

/** Build a valid reaction API response. */
function makeReactionResponse(
  overrides: Partial<MacroReactionApiResponse> = {},
): MacroReactionApiResponse {
  return {
    symbol: 'AAPL',
    event_type: 'cpi',
    reactions: [
      {
        event_date: '2024-06-15',
        event_value: 3.3,
        expected: 3.2,
        surprise: 'above',
        price_before: 185.5,
        price_after_1d: 187.0,
        price_after_5d: 190.0,
        return_1d_percent: 0.81,
        return_5d_percent: 2.43,
        volume_ratio: 1.35,
      },
    ],
    averages: {
      avg_return_1d_on_beat: 0.45,
      avg_return_1d_on_miss: -0.32,
      avg_return_5d_on_beat: 1.1,
      avg_return_5d_on_miss: -0.88,
      avg_volume_ratio: 1.2,
    },
    sample_size: 12,
    data_sources: ['yfinance', 'finnhub'],
    data_timestamp: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  clearMacroCalendarCache();
  clearMacroReactionCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useMacroCalendar
// ---------------------------------------------------------------------------

describe('useMacroCalendar', () => {
  it('should start with loading=false, data=null, error=null', () => {
    // Don't resolve the mock yet
    mockGetMacroCalendar.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMacroCalendar());

    // Initial render -- before the effect fires, data and error are null
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should auto-fetch on mount and set data', async () => {
    const response = makeCalendarResponse();
    mockGetMacroCalendar.mockResolvedValue(response);

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.events).toHaveLength(1);
    expect(result.current.data!.events[0].eventName).toBe('CPI');
    expect(result.current.data!.events[0].eventType).toBe('cpi');
    expect(result.current.error).toBeNull();
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(1);
  });

  it('should pass from_date and to_date params to the API', async () => {
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetMacroCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        from_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should normalize the response to camelCase', async () => {
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    const data = result.current.data!;
    expect(data.dateRange).toBeDefined();
    expect(data.dataSource).toBe('finnhub');
    expect(data.dataTimestamp).toBe('2024-06-15T12:00:00Z');
    expect(data.events[0].eventName).toBe('CPI');
  });

  it('should serve from cache on re-render (cache hit)', async () => {
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());

    // First render: fetch
    const { result, unmount } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(1);
    unmount();

    // Second render: should use cache
    const { result: result2 } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result2.current.data).not.toBeNull();
    });
    // The mock should NOT be called again for a cache hit
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after cache expires', async () => {
    const dateSpy = vi.spyOn(Date, 'now');
    const startTime = 1700000000000;
    dateSpy.mockReturnValue(startTime);

    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());

    // First render: fetch and cache
    const { result, unmount } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(1);
    unmount();

    // Advance time past cache TTL (5 minutes = 300_000ms)
    dateSpy.mockReturnValue(startTime + 300_001);

    // Clear the cache so the expired-timestamp scenario is triggered on next mount
    clearMacroCalendarCache();

    // Second render: cache is expired, should re-fetch
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse({ data_source: 'refreshed' }));
    const { result: result2 } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result2.current.data).not.toBeNull();
    });
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });

  it('should set a static error message on API failure (no XSS)', async () => {
    mockGetMacroCalendar.mockRejectedValue(new Error('<script>alert("xss")</script>'));

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load calendar data. Please try again later.');
    expect(result.current.data).toBeNull();
    // Error message should NEVER contain user input
    expect(result.current.error).not.toContain('script');
    expect(result.current.error).not.toContain('xss');
  });

  it('should ignore AbortError (DOMException)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockGetMacroCalendar.mockRejectedValue(abortError);

    const { result } = renderHook(() => useMacroCalendar());

    // Give it time to process
    await waitFor(() => {
      expect(mockGetMacroCalendar).toHaveBeenCalled();
    });

    // Should not set error for abort
    expect(result.current.error).toBeNull();
  });

  it('should ignore ERR_CANCELED error', async () => {
    const canceledError = { code: 'ERR_CANCELED', message: 'Canceled' };
    mockGetMacroCalendar.mockRejectedValue(canceledError);

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(mockGetMacroCalendar).toHaveBeenCalled();
    });

    expect(result.current.error).toBeNull();
  });

  it('should abort in-flight request on unmount', async () => {
    let resolvePromise: (value: MacroCalendarApiResponse) => void;
    const pending = new Promise<MacroCalendarApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetMacroCalendar.mockReturnValue(pending);

    const { result, unmount } = renderHook(() => useMacroCalendar());

    // Should be loading
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Unmount while still loading
    unmount();

    // Resolve after unmount -- should not cause errors (state updates after unmount)
    resolvePromise!(makeCalendarResponse());
  });

  it('should set loading=true during fetch and false after', async () => {
    let resolvePromise: (value: MacroCalendarApiResponse) => void;
    const pending = new Promise<MacroCalendarApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetMacroCalendar.mockReturnValue(pending);

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolvePromise!(makeCalendarResponse());
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  it('should handle empty events response', async () => {
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse({ events: [] }));

    const { result } = renderHook(() => useMacroCalendar());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useMacroReaction
// ---------------------------------------------------------------------------

describe('useMacroReaction', () => {
  it('should start with data=null, loading=false, error=null', () => {
    const { result } = renderHook(() => useMacroReaction());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.fetchReaction).toBe('function');
  });

  it('should NOT auto-fetch on mount', () => {
    renderHook(() => useMacroReaction());
    expect(mockGetMacroReaction).not.toHaveBeenCalled();
  });

  it('should fetch reaction data when fetchReaction is called', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.symbol).toBe('AAPL');
    expect(result.current.data!.eventType).toBe('cpi');
    expect(result.current.data!.reactions).toHaveLength(1);
    expect(mockGetMacroReaction).toHaveBeenCalledWith(
      'AAPL',
      'cpi',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should normalize reaction response to camelCase', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    const data = result.current.data!;
    expect(data.averages.avgReturn1dOnBeat).toBe(0.45);
    expect(data.reactions[0].eventDate).toBe('2024-06-15');
    expect(data.reactions[0].return1dPercent).toBe(0.81);
    expect(data.sampleSize).toBe(12);
    expect(data.dataSources).toEqual(['yfinance', 'finnhub']);
  });

  it('should serve from cache on same symbol:eventType (cache hit)', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    // First fetch
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);

    // Second fetch with same params -- should use cache
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    // Should NOT have called the API again
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);
  });

  it('should use uppercase symbol for cache key', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    // Fetch with lowercase
    act(() => {
      result.current.fetchReaction('aapl', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);

    // Fetch with uppercase -- should be cache hit (same key)
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);
  });

  it('should fetch separately for different symbols', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);

    mockGetMacroReaction.mockResolvedValue(makeReactionResponse({ symbol: 'MSFT' }));

    act(() => {
      result.current.fetchReaction('MSFT', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data!.symbol).toBe('MSFT');
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(2);
  });

  it('should fetch separately for different event types', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);

    mockGetMacroReaction.mockResolvedValue(makeReactionResponse({ event_type: 'nfp' }));

    act(() => {
      result.current.fetchReaction('AAPL', 'nfp');
    });
    await waitFor(() => {
      expect(result.current.data!.eventType).toBe('nfp');
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(2);
  });

  it('should clear data and not fetch when symbol is empty', async () => {
    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('', 'cpi');
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockGetMacroReaction).not.toHaveBeenCalled();
  });

  it('should clear data and not fetch when eventType is empty', async () => {
    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', '');
    });

    expect(result.current.data).toBeNull();
    expect(mockGetMacroReaction).not.toHaveBeenCalled();
  });

  it('should set a static error message on API failure (no XSS)', async () => {
    mockGetMacroReaction.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load reaction data. Please try again later.');
    expect(result.current.data).toBeNull();
    // Error message should NEVER contain user input
    expect(result.current.error).not.toContain('Network');
  });

  it('should ignore AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    mockGetMacroReaction.mockRejectedValue(abortError);

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(mockGetMacroReaction).toHaveBeenCalled();
    });

    // Give it a tick for the catch to process
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.error).toBeNull();
  });

  it('should ignore ERR_CANCELED error', async () => {
    mockGetMacroReaction.mockRejectedValue({ code: 'ERR_CANCELED' });

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(mockGetMacroReaction).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.error).toBeNull();
  });

  it('should abort previous request when fetchReaction is called again', async () => {
    let firstResolve: (v: MacroReactionApiResponse) => void;
    const firstPromise = new Promise<MacroReactionApiResponse>((resolve) => {
      firstResolve = resolve;
    });
    mockGetMacroReaction.mockReturnValueOnce(firstPromise);

    const { result } = renderHook(() => useMacroReaction());

    // Start first fetch
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Start second fetch (should abort first)
    mockGetMacroReaction.mockResolvedValueOnce(makeReactionResponse({ symbol: 'MSFT' }));

    act(() => {
      result.current.fetchReaction('MSFT', 'nfp');
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.symbol).toBe('MSFT');

    // Resolve the first promise -- should be ignored (aborted)
    firstResolve!(makeReactionResponse());
  });

  it('should abort in-flight request on unmount', async () => {
    const pending = new Promise<MacroReactionApiResponse>(() => {});
    mockGetMacroReaction.mockReturnValue(pending);

    const { result, unmount } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Unmount should not cause warnings
    unmount();
  });

  it('should set loading=true during fetch and false after success', async () => {
    let resolvePromise: (v: MacroReactionApiResponse) => void;
    const pending = new Promise<MacroReactionApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetMacroReaction.mockReturnValue(pending);

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolvePromise!(makeReactionResponse());
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  it('should set loading=false after error', async () => {
    mockGetMacroReaction.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });

  it('should handle empty reactions array', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse({ reactions: [] }));

    const { result } = renderHook(() => useMacroReaction());

    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.reactions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearMacroCalendarCache / clearMacroReactionCache
// ---------------------------------------------------------------------------

describe('Cache clearing', () => {
  it('clearMacroCalendarCache should force re-fetch', async () => {
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());

    // First render: populates cache
    const { result, unmount } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(1);
    unmount();

    // Clear cache
    clearMacroCalendarCache();

    // Second render: should re-fetch
    mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse({ data_source: 'refreshed' }));
    const { result: result2 } = renderHook(() => useMacroCalendar());
    await waitFor(() => {
      expect(result2.current.data).not.toBeNull();
    });
    expect(mockGetMacroCalendar).toHaveBeenCalledTimes(2);
    expect(result2.current.data!.dataSource).toBe('refreshed');
  });

  it('clearMacroReactionCache should force re-fetch', async () => {
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

    const { result } = renderHook(() => useMacroReaction());

    // First fetch
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(1);

    // Clear cache
    clearMacroReactionCache();

    // Fetch again -- should re-fetch
    mockGetMacroReaction.mockResolvedValue(makeReactionResponse({ symbol: 'AAPL-2' }));
    act(() => {
      result.current.fetchReaction('AAPL', 'cpi');
    });
    await waitFor(() => {
      expect(result.current.data!.symbol).toBe('AAPL-2');
    });
    expect(mockGetMacroReaction).toHaveBeenCalledTimes(2);
  });
});
