/**
 * Tests for the useAnalysis custom hook.
 *
 * Follows the same pattern as useOwnership.test.ts:
 * - Mock the API client before importing the hook.
 * - Use renderHook / waitFor from @testing-library/react.
 * - Test cache, cancellation, error, and normalization behaviours.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { AnalysisApiResponse } from '../../types/analysis';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------

const mockGetAnalysis = vi.fn<(symbol: string, opts?: { signal?: AbortSignal }) => Promise<AnalysisApiResponse>>();

vi.mock('../../api/client', () => ({
  getAnalysis: (...args: [string, { signal?: AbortSignal }?]) => mockGetAnalysis(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup so the module picks up the mock
// ---------------------------------------------------------------------------

import {
  useAnalysis,
  clearAnalysisCache,
} from '../../hooks/useAnalysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete raw API response in snake_case format. */
function makeApiResponse(
  overrides: Partial<AnalysisApiResponse> = {},
): AnalysisApiResponse {
  return {
    symbol: 'AAPL',
    composite: {
      overall_direction: 'bullish',
      overall_confidence: 0.75,
      confluence_count: 4,
      timeframe_breakdown: {
        short: { direction: 'bullish', confidence: 0.8, methodologies: ['wyckoff'] },
        medium: { direction: 'neutral', confidence: 0.5, methodologies: ['elliott_wave'] },
        long: { direction: 'bearish', confidence: 0.6, methodologies: ['canslim'] },
      },
      trade_thesis: 'Strong uptrend with healthy pullback',
      weights_used: { wyckoff: 1.0, elliott_wave: 0.8 },
      timestamp: '2024-02-15T10:00:00Z',
    },
    signals: [
      {
        ticker: 'AAPL',
        methodology: 'wyckoff',
        direction: 'bullish',
        confidence: 0.85,
        timeframe: 'short',
        reasoning: 'Accumulation phase detected',
        key_levels: { support: 148.5, resistance: 155.0 },
        timestamp: '2024-02-15T10:00:00Z',
      },
    ],
    metadata: {
      analysis_duration_ms: 1234,
      methodologies_requested: 6,
      methodologies_completed: 5,
      methodologies_failed: 1,
      failed_methodologies: ['sentiment'],
      cached: false,
      data_sources_used: ['yfinance', 'edgar'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  clearAnalysisCache();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalysis', () => {
  // ---- 1. Empty symbol returns idle state ----

  it('should return idle state for empty symbol (loading=false, data=null, error=null)', () => {
    const { result } = renderHook(() => useAnalysis(''));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetAnalysis).not.toHaveBeenCalled();
  });

  // ---- 2. Fetches and normalizes data on symbol change ----

  it('should fetch and normalize data when symbol is provided', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useAnalysis('AAPL'));

    // Starts loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetAnalysis).toHaveBeenCalledWith('AAPL', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.symbol).toBe('AAPL');
    // Check normalization: snake_case -> camelCase
    expect(result.current.data!.composite.overallDirection).toBe('bullish');
    expect(result.current.data!.composite.overallConfidence).toBe(0.75);
    expect(result.current.data!.signals[0].keyLevels).toEqual({
      support: 148.5,
      resistance: 155.0,
    });
    expect(result.current.error).toBeNull();
  });

  it('should re-fetch when symbol changes', async () => {
    const aaplResponse = makeApiResponse({ symbol: 'AAPL' });
    const msftResponse = makeApiResponse({ symbol: 'MSFT' });

    mockGetAnalysis
      .mockResolvedValueOnce(aaplResponse)
      .mockResolvedValueOnce(msftResponse);

    const { result, rerender } = renderHook(
      ({ sym }) => useAnalysis(sym),
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
    expect(mockGetAnalysis).toHaveBeenCalledTimes(2);
  });

  // ---- 3. Cache hit skips fetch ----

  it('should serve cached data for same symbol (no second fetch)', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());

    const { result, unmount } = renderHook(() => useAnalysis('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with same symbol -- should use cache
    const { result: result2 } = renderHook(() => useAnalysis('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data).not.toBeNull();
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1); // no new call
  });

  it('should use same cache key for different case symbols', async () => {
    mockGetAnalysis.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useAnalysis('aapl'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);

    unmount();

    // Re-render with uppercase -- should be a cache hit
    const { result: result2 } = renderHook(() => useAnalysis('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data!.symbol).toBe('AAPL');
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);
  });

  // ---- 4. Cache expires after TTL ----

  it('should re-fetch after cache TTL expires (mock Date.now)', async () => {
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    mockGetAnalysis.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useAnalysis('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);

    unmount();

    // Advance Date.now past the 15-minute TTL (900_000 ms)
    fakeNow += 900_001;

    // Re-render -- cache should be expired, should trigger new fetch
    const { result: result2 } = renderHook(() => useAnalysis('AAPL'));

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it('should NOT re-fetch if TTL has not expired', async () => {
    const realDateNow = Date.now;
    let fakeNow = realDateNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    mockGetAnalysis.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useAnalysis('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);

    unmount();

    // Advance Date.now but NOT past TTL
    fakeNow += 899_999;

    const { result: result2 } = renderHook(() => useAnalysis('AAPL'));
    expect(result2.current.loading).toBe(false);
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1); // still cached

    vi.restoreAllMocks();
  });

  // ---- 5. Cancelled fetch on unmount ----

  it('should not update state when unmounted during fetch (cancelled flag)', async () => {
    let resolvePromise: (value: AnalysisApiResponse) => void = () => {};
    const pendingPromise = new Promise<AnalysisApiResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetAnalysis.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useAnalysis('NVDA'));
    expect(result.current.loading).toBe(true);

    // Unmount before the promise resolves
    unmount();

    // Resolve now -- should not cause state updates on unmounted component
    await act(async () => {
      resolvePromise(makeApiResponse({ symbol: 'NVDA' }));
    });

    // If we got here without warnings, the cancelled flag works
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);
  });

  it('should not update error state when unmounted during failed fetch', async () => {
    let rejectPromise: (reason: Error) => void = () => {};
    const pendingPromise = new Promise<AnalysisApiResponse>((_, reject) => {
      rejectPromise = reject;
    });
    mockGetAnalysis.mockReturnValueOnce(pendingPromise);

    const { result, unmount } = renderHook(() => useAnalysis('AMD'));
    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      rejectPromise(new Error('Server error'));
    });

    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);
  });

  // ---- 6. Cancelled fetch on rapid symbol change ----

  it('should discard stale result when symbol changes rapidly', async () => {
    let resolveFirst: (value: AnalysisApiResponse) => void = () => {};
    const firstPromise = new Promise<AnalysisApiResponse>((resolve) => {
      resolveFirst = resolve;
    });

    const secondResponse = makeApiResponse({ symbol: 'MSFT' });

    mockGetAnalysis
      .mockReturnValueOnce(firstPromise) // AAPL (slow)
      .mockResolvedValueOnce(secondResponse); // MSFT (fast)

    const { result, rerender } = renderHook(
      ({ sym }) => useAnalysis(sym),
      { initialProps: { sym: 'AAPL' } },
    );

    expect(result.current.loading).toBe(true);

    // Quickly change symbol before AAPL resolves
    rerender({ sym: 'MSFT' });

    // Wait for MSFT to resolve
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should show MSFT data, not AAPL
    expect(result.current.data!.symbol).toBe('MSFT');

    // Now resolve AAPL (stale) -- should be discarded
    await act(async () => {
      resolveFirst(makeApiResponse({ symbol: 'AAPL' }));
    });

    // Still MSFT, not overwritten by stale AAPL result
    expect(result.current.data!.symbol).toBe('MSFT');
  });

  // ---- 7. Error handling ----

  it('should set static error message on fetch failure', async () => {
    mockGetAnalysis.mockRejectedValueOnce(new Error('Network failure'));
    const { result } = renderHook(() => useAnalysis('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(
      'Failed to load analysis data. Please try again later.',
    );
    expect(result.current.data).toBeNull();
  });

  it('should never reflect actual error message (XSS prevention)', async () => {
    mockGetAnalysis.mockRejectedValueOnce(
      new Error('<script>alert("xss")</script>'),
    );
    const { result } = renderHook(() => useAnalysis('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Error should be static, not the actual error message
    expect(result.current.error).toBe(
      'Failed to load analysis data. Please try again later.',
    );
    expect(result.current.error).not.toContain('script');
  });

  it('should set loading=false after fetch fails', async () => {
    mockGetAnalysis.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useAnalysis('AAPL'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });

  // ---- 8. clearAnalysisCache ----

  it('should force a fresh fetch after clearAnalysisCache', async () => {
    mockGetAnalysis.mockResolvedValue(makeApiResponse());

    const { result, unmount } = renderHook(() => useAnalysis('MSFT'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(1);

    unmount();
    clearAnalysisCache();

    // Same symbol should now trigger a new fetch
    const { result: result2 } = renderHook(() => useAnalysis('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(mockGetAnalysis).toHaveBeenCalledTimes(2);
  });

  // ---- 9. Loading transitions ----

  it('should return loading=true initially when symbol is provided', () => {
    mockGetAnalysis.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAnalysis('AAPL'));
    expect(result.current.loading).toBe(true);
  });

  it('should set loading=false after successful fetch', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useAnalysis('AAPL'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
  });

  // ---- 10. Calls API with uppercase symbol ----

  it('should call getAnalysis with uppercase symbol', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useAnalysis('aapl'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetAnalysis).toHaveBeenCalledWith('AAPL', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  // ---- 11. Different symbols use different cache entries ----

  it('should fetch separately for different symbols', async () => {
    const aaplResp = makeApiResponse({ symbol: 'AAPL' });
    const msftResp = makeApiResponse({ symbol: 'MSFT' });

    mockGetAnalysis
      .mockResolvedValueOnce(aaplResp)
      .mockResolvedValueOnce(msftResp);

    const { result, unmount } = renderHook(() => useAnalysis('AAPL'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data!.symbol).toBe('AAPL');

    unmount();

    const { result: result2 } = renderHook(() => useAnalysis('MSFT'));
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.data!.symbol).toBe('MSFT');
    expect(mockGetAnalysis).toHaveBeenCalledTimes(2);
  });

  // ---- 12. Clears data/error when symbol changes to empty ----

  it('should clear data and error when symbol changes to empty', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());

    const { result, rerender } = renderHook(
      ({ sym }) => useAnalysis(sym),
      { initialProps: { sym: 'AAPL' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).not.toBeNull();

    // Change to empty symbol
    rerender({ sym: '' });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  // ---- 13. Normalization of snake_case to camelCase ----

  it('should normalize snake_case API response to camelCase', async () => {
    mockGetAnalysis.mockResolvedValueOnce(makeApiResponse());
    const { result } = renderHook(() => useAnalysis('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const data = result.current.data!;

    // Composite
    expect(data.composite.overallDirection).toBe('bullish');
    expect(data.composite.overallConfidence).toBe(0.75);
    expect(data.composite.confluenceCount).toBe(4);
    expect(data.composite.tradeThesis).toBe('Strong uptrend with healthy pullback');
    expect(data.composite.timeframeBreakdown.short.direction).toBe('bullish');
    expect(data.composite.timeframeBreakdown.medium.direction).toBe('neutral');
    expect(data.composite.timeframeBreakdown.long.direction).toBe('bearish');

    // Signals
    expect(data.signals[0].ticker).toBe('AAPL');
    expect(data.signals[0].methodology).toBe('wyckoff');
    expect(data.signals[0].keyLevels).toEqual({ support: 148.5, resistance: 155.0 });

    // Metadata
    expect(data.metadata.analysisDurationMs).toBe(1234);
    expect(data.metadata.methodologiesRequested).toBe(6);
    expect(data.metadata.methodologiesCompleted).toBe(5);
    expect(data.metadata.methodologiesFailed).toBe(1);
    expect(data.metadata.failedMethodologies).toEqual(['sentiment']);
    expect(data.metadata.cached).toBe(false);
    expect(data.metadata.dataSourcesUsed).toEqual(['yfinance', 'edgar']);
  });
});
