/**
 * Error Display Component
 *
 * User-friendly error display with support for different error types,
 * retry actions, and dismissal.
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  ApiError,
  ApiErrorCode,
  getErrorMessage,
  getStatusColor,
  isApiError,
  isNetworkError,
  isNotFoundError,
  isAuthError,
  isRateLimitError,
  isRetryable,
} from '../api/errors';

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /** The error to display */
  error: unknown;
  /** Optional title (defaults to error type) */
  title?: string;
  /** Show retry button */
  showRetry?: boolean;
  /** Show dismiss button */
  showDismiss?: boolean;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Callback when error is dismissed */
  onDismiss?: () => void;
  /** Custom icon override */
  icon?: ReactNode;
  /** Additional className */
  className?: string;
  /** Show error details in development */
  showDetails?: boolean;
}

/**
 * Get icon based on error type
 */
function getErrorIcon(error: unknown): ReactNode {
  if (isNetworkError(error)) {
    return (
      <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
    );
  }

  if (isNotFoundError(error)) {
    return (
      <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  }

  if (isAuthError(error)) {
    return (
      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    );
  }

  if (isRateLimitError(error)) {
    return (
      <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  // Default error icon
  return (
    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Get default title based on error type
 */
function getDefaultTitle(error: unknown): string {
  if (isNetworkError(error)) return 'Connection Problem';
  if (isNotFoundError(error)) return 'Not Found';
  if (isAuthError(error)) return 'Access Denied';
  if (isRateLimitError(error)) return 'Too Many Requests';
  if (isApiError(error)) return 'Request Failed';
  return 'Error';
}

/**
 * Get user-friendly message based on error type
 */
function getUserMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  if (isNotFoundError(error)) {
    return 'The requested resource could not be found.';
  }

  if (isAuthError(error)) {
    return 'You do not have permission to access this resource. Please log in and try again.';
  }

  if (isRateLimitError(error)) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (isApiError(error)) {
    return error.message || 'An error occurred while processing your request.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * ErrorDisplay - User-friendly error message component
 */
export function ErrorDisplay({
  error,
  title,
  showRetry = true,
  showDismiss = false,
  onRetry,
  onDismiss,
  icon,
  className = '',
  showDetails = process.env.NODE_ENV === 'development',
}: ErrorDisplayProps): JSX.Element {
  const errorMessage = getErrorMessage(error);
  const userMessage = getUserMessage(error);
  const displayTitle = title || getDefaultTitle(error);
  const canRetry = showRetry && (onRetry || isRetryable(error));

  const handleRetry = (): void => {
    if (onRetry) {
      onRetry();
    } else {
      // Default retry: reload the page
      window.location.reload();
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0 mr-3">
          {icon || getErrorIcon(error)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1">
            {displayTitle}
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            {userMessage}
          </p>

          {/* API Error Details */}
          {showDetails && isApiError(error) && (
            <div className="mb-3 p-2 bg-gray-900 rounded text-xs font-mono">
              <div className="text-gray-400">
                Code: <span className={getStatusColor(error.code)}>{error.code}</span>
              </div>
              <div className="text-gray-400">
                Status: <span className="text-gray-300">{error.status}</span>
              </div>
              {error.details && (
                <div className="text-gray-400 mt-1">
                  Details: <span className="text-gray-300">{JSON.stringify(error.details)}</span>
                </div>
              )}
            </div>
          )}

          {/* Development-only error message */}
          {showDetails && !isApiError(error) && error instanceof Error && (
            <div className="mb-3 p-2 bg-gray-900 rounded text-xs font-mono text-red-400">
              {error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {canRetry && (
              <button
                onClick={handleRetry}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium transition-colors"
              >
                Try Again
              </button>
            )}
            {showDismiss && onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded font-medium transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline error for use within forms or small spaces
 */
export interface InlineErrorProps extends Omit<ErrorDisplayProps, 'showRetry' | 'showDismiss' | 'onRetry' | 'onDismiss'> {
  onRetry?: () => void;
}

export function InlineError({
  error,
  onRetry,
  showDetails = false,
  className = '',
}: InlineErrorProps): JSX.Element {
  const canRetry = onRetry || isRetryable(error);

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-gray-300 flex-1">{getUserMessage(error)}</span>
      {canRetry && (
        <button
          onClick={onRetry}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Loading state wrapper with error handling
 */
export interface ErrorWrapperProps {
  children: ReactNode;
  loading: boolean;
  error: unknown | null;
  loadingComponent?: ReactNode;
  onRetry?: () => void;
}

export function ErrorWrapper({
  children,
  loading,
  error,
  loadingComponent,
  onRetry,
}: ErrorWrapperProps): JSX.Element {
  if (loading) {
    return (
      loadingComponent || (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={onRetry}
        showRetry={!!onRetry}
      />
    );
  }

  return <>{children}</>;
}

export default ErrorDisplay;
