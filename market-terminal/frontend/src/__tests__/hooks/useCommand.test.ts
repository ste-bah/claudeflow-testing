/**
 * Dedicated unit tests for the useCommand hook.
 *
 * Tests the hook in isolation by mocking:
 *   - useTickerContext (from TickerContext)
 *   - API client functions (analyzeSymbol, addToWatchlist, etc.)
 *
 * Uses @testing-library/react's renderHook + act for async state updates.
 *
 * @module __tests__/hooks/useCommand
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks -- declared BEFORE imports so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockSetActiveTicker = vi.fn();

vi.mock('../../contexts/TickerContext', () => ({
  useTickerContext: () => ({
    activeTicker: 'AAPL',
    setActiveTicker: mockSetActiveTicker,
  }),
}));

const mockAnalyzeSymbol = vi.fn<(symbol: string) => Promise<Record<string, unknown>>>();
const mockAddToWatchlist = vi.fn<(symbol: string) => Promise<Record<string, unknown>>>();
const mockRemoveFromWatchlist = vi.fn<(symbol: string) => Promise<void>>();
const mockGetScan = vi.fn<(preset: string | null | undefined) => Promise<Record<string, unknown>>>();
const mockPostQuery = vi.fn<(text: string) => Promise<Record<string, unknown>>>();

vi.mock('../../api/client', () => ({
  analyzeSymbol: (...args: [string]) => mockAnalyzeSymbol(...args),
  addToWatchlist: (...args: [string]) => mockAddToWatchlist(...args),
  removeFromWatchlist: (...args: [string]) => mockRemoveFromWatchlist(...args),
  getScan: (...args: [string | null | undefined]) => mockGetScan(...args),
  postQuery: (...args: [string]) => mockPostQuery(...args),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { useCommand } from '../../hooks/useCommand';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flush all pending microtasks (Promise.then, .catch, .finally) so that
 * the hook's async dispatch chain settles and state updates propagate.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API calls resolve successfully
    mockAnalyzeSymbol.mockResolvedValue({ signal: 'bullish' });
    mockAddToWatchlist.mockResolvedValue({ symbol: 'AAPL', id: 1 });
    mockRemoveFromWatchlist.mockResolvedValue(undefined);
    mockGetScan.mockResolvedValue({ results: [], total_matches: 0 });
    mockPostQuery.mockResolvedValue({ answer: 'test response' });
  });

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('should have result as null', () => {
      const { result } = renderHook(() => useCommand());
      expect(result.current.result).toBeNull();
    });

    it('should have loading as false', () => {
      const { result } = renderHook(() => useCommand());
      expect(result.current.loading).toBe(false);
    });

    it('should have error as null', () => {
      const { result } = renderHook(() => useCommand());
      expect(result.current.error).toBeNull();
    });

    it('should expose execute as a function', () => {
      const { result } = renderHook(() => useCommand());
      expect(typeof result.current.execute).toBe('function');
    });

    it('should expose historyBack as a function', () => {
      const { result } = renderHook(() => useCommand());
      expect(typeof result.current.historyBack).toBe('function');
    });

    it('should expose historyForward as a function', () => {
      const { result } = renderHook(() => useCommand());
      expect(typeof result.current.historyForward).toBe('function');
    });

    it('should expose clearResult as a function', () => {
      const { result } = renderHook(() => useCommand());
      expect(typeof result.current.clearResult).toBe('function');
    });
  });

  // =========================================================================
  // execute: empty / whitespace
  // =========================================================================

  describe('execute with empty/whitespace input', () => {
    it('should ignore empty string input', () => {
      const { result } = renderHook(() => useCommand());
      act(() => {
        result.current.execute('');
      });
      expect(result.current.loading).toBe(false);
      expect(mockAnalyzeSymbol).not.toHaveBeenCalled();
      expect(mockPostQuery).not.toHaveBeenCalled();
    });

    it('should ignore whitespace-only input', () => {
      const { result } = renderHook(() => useCommand());
      act(() => {
        result.current.execute('   ');
      });
      expect(result.current.loading).toBe(false);
    });
  });

  // =========================================================================
  // execute: dispatch routing
  // =========================================================================

  describe('execute dispatch routing', () => {
    it('should call analyzeSymbol and setActiveTicker for "analyze MSFT"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('analyze MSFT');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockSetActiveTicker).toHaveBeenCalledWith('MSFT');
      expect(mockAnalyzeSymbol).toHaveBeenCalledWith('MSFT');
      expect(result.current.result).not.toBeNull();
      expect(result.current.result!.command.type).toBe('analyze');
      expect(result.current.result!.data).toEqual({ signal: 'bullish' });
      expect(result.current.result!.error).toBeNull();
    });

    it('should call addToWatchlist for "watch add TSLA"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('watch add TSLA');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockAddToWatchlist).toHaveBeenCalledWith('TSLA');
      expect(result.current.result!.command.type).toBe('watch_add');
    });

    it('should call removeFromWatchlist for "watch remove AAPL"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('watch remove AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockRemoveFromWatchlist).toHaveBeenCalledWith('AAPL');
      expect(result.current.result!.command.type).toBe('watch_remove');
      expect(result.current.result!.data).toEqual({ action: 'watch_removed', symbol: 'AAPL' });
    });

    it('should call setActiveTicker for bare ticker "TSLA"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('TSLA');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockSetActiveTicker).toHaveBeenCalledWith('TSLA');
      expect(result.current.result!.data).toEqual({ action: 'ticker_set', symbol: 'TSLA' });
    });

    it('should call setActiveTicker for news command (default symbol handler)', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('news AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockSetActiveTicker).toHaveBeenCalledWith('AAPL');
      expect(result.current.result!.data).toEqual({ action: 'ticker_set', symbol: 'AAPL' });
    });

    it('should call setActiveTicker for fundamentals command (default symbol handler)', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('fundamentals GOOGL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockSetActiveTicker).toHaveBeenCalledWith('GOOGL');
    });

    it('should call setActiveTicker for insider command (default symbol handler)', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('insider MSFT');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockSetActiveTicker).toHaveBeenCalledWith('MSFT');
    });

    it('should call getScan with null preset for "scan"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('scan');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetScan).toHaveBeenCalledWith(null);
      expect(result.current.result!.command.type).toBe('scan');
    });

    it('should call getScan with preset for "scan bullish"', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('scan bullish');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetScan).toHaveBeenCalledWith('bullish');
    });

    it('should return macro_focus for "macro" without calling any API', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.result!.command.type).toBe('macro');
      expect(result.current.result!.data).toEqual({ action: 'macro_focus' });
      // No API function should be called
      expect(mockAnalyzeSymbol).not.toHaveBeenCalled();
      expect(mockGetScan).not.toHaveBeenCalled();
      expect(mockPostQuery).not.toHaveBeenCalled();
    });

    it('should call postQuery for free-text query', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('what is the price of apple');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockPostQuery).toHaveBeenCalledWith('what is the price of apple');
      expect(result.current.result!.command.type).toBe('query');
    });
  });

  // =========================================================================
  // execute: loading state
  // =========================================================================

  describe('execute loading state', () => {
    it('should set loading to true while executing', async () => {
      // Make the API call hang until we resolve it
      let resolveApi!: (value: Record<string, unknown>) => void;
      mockAnalyzeSymbol.mockReturnValue(
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
      );

      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('analyze AAPL');
      });

      // Loading should be true while API is pending
      expect(result.current.loading).toBe(true);

      // Resolve the API call
      await act(async () => {
        resolveApi({ signal: 'bullish' });
        await flushMicrotasks();
      });

      expect(result.current.loading).toBe(false);
    });

    it('should set result with timestamp after successful execution', async () => {
      const before = Date.now();
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('analyze AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.result!.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.current.result!.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  // =========================================================================
  // execute: error handling
  // =========================================================================

  describe('execute error handling', () => {
    it('should set static error message on API rejection', async () => {
      mockAnalyzeSymbol.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('analyze AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('Command execution failed');
      expect(result.current.result!.error).toBe('Command execution failed');
      expect(result.current.result!.data).toBeNull();
    });

    it('should NOT reflect user input in error message (XSS prevention)', async () => {
      mockPostQuery.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('<script>alert("xss")</script>');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Error message must be the static string, not the user input
      expect(result.current.error).toBe('Command execution failed');
      expect(result.current.error).not.toContain('<script>');
    });

    it('should clear previous error on new execution start', async () => {
      mockAnalyzeSymbol.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useCommand());

      // First execution: fails
      act(() => {
        result.current.execute('analyze AAPL');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('Command execution failed');

      // Second execution: succeeds
      mockAnalyzeSymbol.mockResolvedValueOnce({ signal: 'bearish' });
      act(() => {
        result.current.execute('analyze MSFT');
      });
      // Error should be cleared at start of new execution
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // execute: concurrent guard
  // =========================================================================

  describe('execute concurrent guard', () => {
    it('should ignore second execute while loading', async () => {
      let resolveFirst!: (value: Record<string, unknown>) => void;
      mockAnalyzeSymbol.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { result } = renderHook(() => useCommand());

      // First execute: starts loading
      act(() => {
        result.current.execute('analyze AAPL');
      });
      expect(result.current.loading).toBe(true);

      // Second execute while first is still loading: should be ignored
      act(() => {
        result.current.execute('analyze MSFT');
      });

      // Only first call should have been made
      expect(mockAnalyzeSymbol).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeSymbol).toHaveBeenCalledWith('AAPL');

      // Resolve the first call
      await act(async () => {
        resolveFirst({ signal: 'bullish' });
        await flushMicrotasks();
      });

      expect(result.current.loading).toBe(false);
    });
  });

  // =========================================================================
  // clearResult
  // =========================================================================

  describe('clearResult', () => {
    it('should reset result to null', async () => {
      const { result } = renderHook(() => useCommand());

      // Execute a command to populate result
      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.result).not.toBeNull());

      // Clear it
      act(() => {
        result.current.clearResult();
      });

      expect(result.current.result).toBeNull();
    });

    it('should reset error to null', async () => {
      mockAnalyzeSymbol.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('analyze AAPL');
      });
      await waitFor(() => expect(result.current.error).toBe('Command execution failed'));

      act(() => {
        result.current.clearResult();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // History navigation
  // =========================================================================

  describe('history', () => {
    it('should return null for historyBack when history is empty', () => {
      const { result } = renderHook(() => useCommand());
      let backValue: string | null = null;
      act(() => {
        backValue = result.current.historyBack();
      });
      expect(backValue).toBeNull();
    });

    it('should return null for historyForward when history is empty', () => {
      const { result } = renderHook(() => useCommand());
      let forwardValue: string | null = null;
      act(() => {
        forwardValue = result.current.historyForward();
      });
      expect(forwardValue).toBeNull();
    });

    it('should store executed commands in history', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // historyBack should return the last command
      let backValue: string | null = null;
      act(() => {
        backValue = result.current.historyBack();
      });
      expect(backValue).toBe('macro');
    });

    it('should navigate back through multiple history entries', async () => {
      const { result } = renderHook(() => useCommand());

      // Execute two commands
      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.execute('scan');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // First back: "scan"
      let value1: string | null = null;
      act(() => {
        value1 = result.current.historyBack();
      });
      expect(value1).toBe('scan');

      // Second back: "macro"
      let value2: string | null = null;
      act(() => {
        value2 = result.current.historyBack();
      });
      expect(value2).toBe('macro');
    });

    it('should stay at oldest entry when going back past beginning', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Go back once (to "macro")
      let value: string | null = null;
      act(() => {
        value = result.current.historyBack();
      });
      expect(value).toBe('macro');

      // Go back again (should stay at index 0, still "macro")
      act(() => {
        value = result.current.historyBack();
      });
      expect(value).toBe('macro');
    });

    it('should navigate forward after going back', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.execute('scan');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Go back to "scan" then "macro"
      act(() => {
        result.current.historyBack();
      });
      act(() => {
        result.current.historyBack();
      });

      // Forward: should return "scan"
      let forwardValue: string | null = null;
      act(() => {
        forwardValue = result.current.historyForward();
      });
      expect(forwardValue).toBe('scan');
    });

    it('should return null when going forward past the end', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Go back to "macro"
      act(() => {
        result.current.historyBack();
      });

      // Forward once: past end, should return null
      let value: string | null = null;
      act(() => {
        value = result.current.historyForward();
      });
      expect(value).toBeNull();
    });

    it('should deduplicate consecutive identical commands', async () => {
      const { result } = renderHook(() => useCommand());

      // Execute same command twice
      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Go back: should get "macro"
      let value1: string | null = null;
      act(() => {
        value1 = result.current.historyBack();
      });
      expect(value1).toBe('macro');

      // Go back again: should stay at "macro" (no second entry)
      let value2: string | null = null;
      act(() => {
        value2 = result.current.historyBack();
      });
      expect(value2).toBe('macro');
    });

    it('should NOT deduplicate non-consecutive identical commands', async () => {
      const { result } = renderHook(() => useCommand());

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.execute('scan');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.execute('macro');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // History: ["macro", "scan", "macro"]
      // Back 1: "macro" (last)
      let v: string | null = null;
      act(() => {
        v = result.current.historyBack();
      });
      expect(v).toBe('macro');

      // Back 2: "scan"
      act(() => {
        v = result.current.historyBack();
      });
      expect(v).toBe('scan');

      // Back 3: "macro" (first)
      act(() => {
        v = result.current.historyBack();
      });
      expect(v).toBe('macro');
    });

    it('should cap history at MAX_HISTORY (50) entries', async () => {
      const { result } = renderHook(() => useCommand());

      // Execute 55 unique commands
      for (let i = 0; i < 55; i++) {
        act(() => {
          // Use different text for each to avoid dedup
          result.current.execute(`cmd${i}`);
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
      }

      // Navigate all the way back -- should get at most 50 entries
      let count = 0;
      let lastValue: string | null = null;
      let prevValue: string | null = undefined as unknown as string | null;
      for (let i = 0; i < 60; i++) {
        act(() => {
          lastValue = result.current.historyBack();
        });
        if (lastValue === prevValue) break; // Stuck at oldest
        prevValue = lastValue;
        count++;
      }

      // We should have navigated through exactly 50 entries
      expect(count).toBe(50);
    });
  });
});
