/**
 * API Error Handling Types and Utilities
 *
 * Provides consistent error handling across all API endpoints.
 * Matches the error response format from the backend.
 */

/**
 * API error codes returned by the backend.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Structured API error response.
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

/**
 * Type guard to check if an unknown error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === 'string' &&
    typeof e.message === 'string' &&
    typeof e.status === 'number'
  );
}

/**
 * Get a user-friendly error message for display.
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Check if an error indicates a network connectivity issue.
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'NETWORK_ERROR' || error.status === 0;
  }
  return false;
}

/**
 * Check if an error indicates the resource was not found.
 */
export function isNotFoundError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'NOT_FOUND';
  }
  return false;
}

/**
 * Check if an error indicates an authentication/authorization issue.
 */
export function isAuthError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN';
  }
  return false;
}

/**
 * Check if an error indicates a rate limit issue.
 */
export function isRateLimitError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'RATE_LIMITED';
  }
  return false;
}

/**
 * Map API error codes to HTTP status codes for display.
 */
export function getStatusColor(code: ApiErrorCode): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'text-yellow-500';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return 'text-red-500';
    case 'NOT_FOUND':
      return 'text-orange-500';
    case 'RATE_LIMITED':
      return 'text-purple-500';
    case 'SERVICE_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

/**
 * Retry configuration for failed requests.
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableCodes: ApiErrorCode[];
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableCodes: ['NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED'],
};

/**
 * Check if an error is retryable based on its code.
 */
export function isRetryable(error: unknown, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (isApiError(error)) {
    return config.retryableCodes.includes(error.code);
  }
  return false;
}