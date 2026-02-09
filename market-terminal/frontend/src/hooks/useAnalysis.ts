import { useState, useCallback } from 'react';
import type { CompositeSignal } from '../types';
import { analyzeSymbol } from '../api/client';

export function useAnalysis(symbol: string) {
  const [composite, setComposite] = useState<CompositeSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(() => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    analyzeSymbol(symbol)
      .then(setComposite)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  return { composite, loading, error, analyze };
}
