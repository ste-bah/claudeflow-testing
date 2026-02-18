/**
 * Command execution hook for the CommandBar.
 *
 * ADR-001: Uses useTickerContext() directly (zero props drilling).
 * ADR-004: Command history stored in useRef to avoid re-renders.
 *
 * @module hooks/useCommand
 */

import { useState, useCallback, useRef } from 'react';
import { useTickerContext } from '../contexts/TickerContext';
import {
  parseCommand,
  isSymbolCommand,
  isScanCommand,
  isMacroCommand,
  isQueryCommand,
  MAX_HISTORY,
} from '../types/command';
import type {
  ParsedCommand,
  CommandResult,
  UseCommandResult,
} from '../types/command';
import {
  analyzeSymbol,
  addToWatchlist,
  removeFromWatchlist,
  getScan,
  postQuery,
} from '../api/client';

// ---------------------------------------------------------------------------
// Dispatch helper (file-private)
// ---------------------------------------------------------------------------

async function dispatch(
  cmd: ParsedCommand,
  setActiveTicker: (ticker: string) => void,
): Promise<Record<string, unknown>> {
  if (isSymbolCommand(cmd)) {
    switch (cmd.type) {
      case 'analyze': {
        setActiveTicker(cmd.symbol);
        const analysis = await analyzeSymbol(cmd.symbol);
        return analysis as unknown as Record<string, unknown>;
      }
      case 'watch_add': {
        const entry = await addToWatchlist(cmd.symbol);
        return entry as unknown as Record<string, unknown>;
      }
      case 'watch_remove': {
        await removeFromWatchlist(cmd.symbol);
        return { action: 'watch_removed', symbol: cmd.symbol };
      }
      // ticker, news, fundamentals, insider all set the active ticker
      // and let the panels react to the context change
      default: {
        setActiveTicker(cmd.symbol);
        return { action: 'ticker_set', symbol: cmd.symbol };
      }
    }
  }

  if (isScanCommand(cmd)) {
    const scanResult = await getScan(cmd.preset);
    return scanResult as unknown as Record<string, unknown>;
  }

  if (isMacroCommand(cmd)) {
    return { action: 'macro_focus' };
  }

  if (isQueryCommand(cmd)) {
    return await postQuery(cmd.text);
  }

  // Unreachable but satisfies exhaustiveness
  return { action: 'unknown' };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCommand(): UseCommandResult {
  const { setActiveTicker } = useTickerContext();

  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ADR-004: history in useRef to avoid re-renders
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const execute = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (trimmed.length === 0 || loading) return;

      const cmd = parseCommand(trimmed);

      // Add to history (deduplicate consecutive)
      const history = historyRef.current;
      if (history.length === 0 || history[history.length - 1] !== trimmed) {
        history.push(trimmed);
        if (history.length > MAX_HISTORY) {
          history.shift();
        }
      }
      historyIndexRef.current = history.length;

      setLoading(true);
      setError(null);

      dispatch(cmd, setActiveTicker)
        .then((data) => {
          setResult({
            command: cmd,
            data,
            error: null,
            timestamp: Date.now(),
          });
        })
        .catch(() => {
          // CRITICAL: static error string only -- never reflect user input (XSS)
          setResult({
            command: cmd,
            data: null,
            error: 'Command execution failed',
            timestamp: Date.now(),
          });
          setError('Command execution failed');
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [loading, setActiveTicker],
  );

  const historyBack = useCallback((): string | null => {
    const history = historyRef.current;
    if (history.length === 0) return null;

    const idx = historyIndexRef.current;
    const nextIdx = idx > 0 ? idx - 1 : 0;
    historyIndexRef.current = nextIdx;
    return history[nextIdx] ?? null;
  }, []);

  const historyForward = useCallback((): string | null => {
    const history = historyRef.current;
    if (history.length === 0) return null;

    const idx = historyIndexRef.current;
    if (idx >= history.length - 1) {
      historyIndexRef.current = history.length;
      return null; // past end = clear input
    }
    const nextIdx = idx + 1;
    historyIndexRef.current = nextIdx;
    return history[nextIdx] ?? null;
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    loading,
    error,
    execute,
    historyBack,
    historyForward,
    clearResult,
  };
}
