import { useState, useCallback, useRef } from 'react';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  error?: Error | null;
}

export interface UseLoadingReturn {
  isLoading: boolean;
  message?: string;
  progress?: number;
  error: Error | null;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
  setProgress: (progress: number) => void;
  setError: (error: Error | null) => void;
  withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
}

export function useLoading(initialMessage?: string): UseLoadingReturn {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    message: initialMessage,
    progress: undefined,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const startLoading = useCallback((message?: string) => {
    abortRef.current = new AbortController();
    setState({
      isLoading: true,
      message,
      progress: undefined,
      error: null,
    });
  }, []);

  const stopLoading = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({
      ...prev,
      isLoading: false,
      progress: undefined,
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>, message?: string): Promise<T> => {
      startLoading(message);
      try {
        const result = await fn();
        stopLoading();
        return result;
      } catch (error) {
        setError(error as Error);
        throw error;
      }
    },
    [startLoading, stopLoading, setError]
  );

  return {
    isLoading: state.isLoading,
    message: state.message,
    progress: state.progress,
    error: state.error ?? null,
    startLoading,
    stopLoading,
    setProgress,
    setError,
    withLoading,
  };
}

export function useMultipleLoading<T extends string>(keys: T[]) {
  const [loadingStates, setLoadingStates] = useState<Record<T, boolean>>(
    () => keys.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<T, boolean>)
  );

  const setLoading = useCallback((key: T, isLoading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: isLoading }));
  }, []);

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return {
    loadingStates,
    setLoading,
    isAnyLoading,
    isLoading: (key: T) => loadingStates[key],
  };
}
