/**
 * Error logging utilities for consistent error handling and reporting
 *
 * @module utils/errorLogging
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an error with context information
 * In development, provides detailed console output
 * In production, logs minimal information
 */
export function logError(error: Error, context?: ErrorContext): void {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  if (import.meta.env.DEV) {
    console.group('%c Error Logged', 'color: red; font-weight: bold;');
    console.error('Error:', error);
    console.info('Context:', context);
    console.info('Full data:', errorData);
    console.groupEnd();
  } else {
    console.error('Error:', errorData);
  }
}

/**
 * Creates an error with attached context
 */
export function createError(message: string, context?: ErrorContext): Error {
  const error = new Error(message);
  (error as Error & { context?: ErrorContext }).context = context;
  return error;
}

/**
 * Wraps an async function with error logging
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Executes a function and returns fallback value on error
 */
export function tryCatch<T>(fn: () => T, fallback: T, context?: ErrorContext): T {
  try {
    return fn();
  } catch (error) {
    logError(error as Error, context);
    return fallback;
  }
}

/**
 * Executes an async function and returns fallback value on error
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error as Error, context);
    return fallback;
  }
}
