/**
 * Hook for consistent error handling in components
 *
 * @module hooks/useErrorHandler
 */

import { useCallback } from 'react';
import { logError, ErrorContext } from '@/utils/errorLogging';

/**
 * Provides error handling utilities for React components
 *
 * @param context - Optional context to attach to all errors
 * @returns Object with handleError and wrapAsync functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleError, wrapAsync } = useErrorHandler({ component: 'MyComponent' });
 *
 *   const fetchData = wrapAsync(async () => {
 *     const response = await api.getData();
 *     return response;
 *   });
 *
 *   const handleClick = async () => {
 *     try {
 *       await fetchData();
 *     } catch (error) {
 *       handleError(error);
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Fetch</button>;
 * }
 * ```
 */
export function useErrorHandler(context?: ErrorContext) {
  const handleError = useCallback(
    (error: Error | unknown) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError(errorObj, context);
    },
    [context]
  );

  const wrapAsync = useCallback(
    <T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T => {
      return (async (...args: Parameters<T>) => {
        try {
          return await fn(...args);
        } catch (error) {
          handleError(error);
          throw error;
        }
      }) as T;
    },
    [handleError]
  );

  return { handleError, wrapAsync };
}
