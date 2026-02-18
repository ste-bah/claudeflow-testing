/**
 * Error Handler Hook
 *
 * Provides comprehensive error handling including:
 * - Error state management
 * - Automatic retry with exponential backoff
 * - Error logging integration
 * - Recovery callbacks
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ApiError,
  isRetryable,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from '../api/errors';

export interface UseErrorHandlerState<T = unknown> {
  /** Current error if any */
  error: T | null;
  /** Whether a retry is in progress */
  isRetrying: boolean;
  /** Number of retry attempts made */
  retryCount: number;
  /** Last successful operation timestamp */
  lastSuccess: Date | null;
}

export interface UseErrorHandlerActions {
  /** Clear the current error */
  clearError: () => void;
  /** Manually set an error */
  setError: (error: unknown) => void;
  /** Execute an operation with automatic retry */
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Manually trigger a retry of the last failed operation */
  retry: () => Promise<void>;
  /** Reset the error handler state */
  reset: () => void;
}

export interface UseErrorHandlerOptions {
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Called when an error occurs */
  onError?: (error: unknown) => void;
  /** Called when a retry is about to be attempted */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Called when the operation succeeds */
  onSuccess?: (result: unknown) => void;
  /** Called after all retries are exhausted */
  onExhausted?: (error: unknown) => void;
  /** Callback that returns true if the error should trigger a retry */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, baseDelay: number, multiplier: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Hook for comprehensive error handling with retry logic.
 *
 * @example
 * ```typescript
 * const { execute, error, isRetrying, retryCount, clearError } = useErrorHandler({
 *   retryConfig: { maxRetries: 3, retryDelay: 1000 },
 *   onError: (err) => console.error('Error:', err),
 *   onSuccess: () => console.log('Success!'),
 * });
 *
 * // Use in a component
 * const handleFetch = async () => {
 *   const data = await execute(() => fetchData());
 *   // Handle data...
 * };
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerActions & UseErrorHandlerState {
  const {
    retryConfig = DEFAULT_RETRY_CONFIG,
    onError,
    onRetry,
    onSuccess,
    onExhausted,
    shouldRetry = (error) => isRetryable(error, retryConfig),
  } = options;

  const [error, setErrorState] = useState<unknown | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);

  // Store the last operation for manual retry
  const lastOperationRef = useRef<(() => Promise<unknown>) | null>(null);
  const lastErrorRef = useRef<unknown>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState(null);
    setRetryCount(0);
  }, []);

  // Set error and notify
  const setError = useCallback((err: unknown) => {
    setErrorState(err);
    lastErrorRef.current = err;
    onError?.(err);
  }, [onError]);

  // Execute operation with retry logic
  const execute = useCallback(async function <T>(operation: () => Promise<T>): Promise<T> {
    lastOperationRef.current = operation;

    let lastError: unknown;
    let currentDelay = retryConfig.retryDelay;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        setLastSuccess(new Date());
        setErrorState(null);
        setRetryCount(0);
        onSuccess?.(result);
        return result;
      } catch (err) {
        lastError = err;

        // Check if we should retry
        const shouldRetryAttempt = attempt < retryConfig.maxRetries && shouldRetry(err);

        if (!shouldRetryAttempt) {
          // No more retries
          break;
        }

        // Notify about retry
        onRetry?.(err, attempt + 1);
        setIsRetrying(true);
        setRetryCount(attempt + 1);

        // Wait before retrying with exponential backoff
        await sleep(currentDelay);
        currentDelay = calculateDelay(
          attempt + 1,
          retryConfig.retryDelay,
          retryConfig.backoffMultiplier ?? 2,
          retryConfig.maxDelayMs ?? 30000
        );
      }
    }

    // All retries exhausted
    setIsRetrying(false);
    setErrorState(lastError);
    onExhausted?.(lastError);

    throw lastError;
  }, [retryConfig, onError, onRetry, onSuccess, onExhausted, shouldRetry]);

  // Manual retry of last failed operation
  const retry = useCallback(async function () {
    if (!lastOperationRef.current) {
      throw new Error('No operation to retry');
    }

    setIsRetrying(true);

    try {
      await execute(lastOperationRef.current as () => Promise<unknown>);
    } finally {
      setIsRetrying(false);
    }
  }, [execute]);

  // Reset handler state
  const reset = useCallback(() => {
    setErrorState(null);
    setIsRetrying(false);
    setRetryCount(0);
    setLastSuccess(null);
    lastOperationRef.current = null;
    lastErrorRef.current = null;
  }, []);

  return {
    // State
    error,
    isRetrying,
    retryCount,
    lastSuccess,
    // Actions
    clearError,
    setError,
    execute,
    retry,
    reset,
  };
}

/**
 * Hook for handling errors in async operations with state tracking.
 * Simpler version for basic use cases.
 *
 * @example
 * ```typescript
 * const { error, loading, execute } = useAsyncError();
 *
 * const handleClick = () => {
 *   execute(fetchData())
 *     .then(data => console.log(data))
 *     .catch(err => console.error(err));
 * };
 * ```
 */
export function useAsyncError(): {
  error: unknown | null;
  loading: boolean;
  execute: <T>(promise: Promise<T>) => Promise<T | undefined>;
  clearError: () => void;
} {
  const [error, setError] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async <T>(promise: Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);

    try {
      const result = await promise;
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, loading, execute, clearError };
}

/**
 * Hook that provides a handler for handling errors in event handlers.
 * Automatically logs errors and optionally displays them.
 *
 * @example
 * ```typescript
 * const handleError = useErrorCallback((err) => {
 *   console.error('Operation failed:', err);
 * });
 *
 * const handleClick = async () => {
 *   try {
 *     await riskyOperation();
 *   } catch (err) {
 *     handleError(err);
 *   }
 * };
 * ```
 */
export function useErrorCallback<T extends (...args: unknown[]) => Promise<void> | void>(
  callback?: T,
  options: { onError?: (error: unknown) => void } = {}
): T {
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  return ((...args: Parameters<T>) => {
    try {
      const result = callback?.(...args);
      // If it's a promise, catch errors
      if (result instanceof Promise) {
        return result.catch((error) => {
          console.error('[useErrorCallback] Error in async handler:', error);
          onErrorRef.current?.(error);
        }) as ReturnType<T>;
      }
    } catch (error) {
      console.error('[useErrorCallback] Error in sync handler:', error);
      onErrorRef.current?.(error);
    }
  }) as T;
}

/**
 * Hook for handling form validation errors
 */
export function useFormError() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const hasError = useCallback((field: string): boolean => {
    return field in fieldErrors;
  }, [fieldErrors]);

  const getError = useCallback((field: string): string | undefined => {
    return fieldErrors[field];
  }, [fieldErrors]);

  return {
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasError,
    getError,
    hasAnyError: Object.keys(fieldErrors).length > 0,
  };
}

export default useErrorHandler;
