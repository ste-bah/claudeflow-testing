import { useState, useCallback } from 'react';
import { postQuery } from '../api/client';

export function useCommand() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback((text: string) => {
    setLoading(true);
    postQuery(text)
      .then(setResult)
      .catch(() => setResult({ error: 'Command failed' }))
      .finally(() => setLoading(false));
  }, []);

  return { execute, result, loading };
}
