import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

export function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps): JSX.Element {
  const isDev = import.meta.env.DEV;

  return (
    <div className="error-fallback">
      <div className="error-fallback__icon">
        <AlertTriangle size={48} />
      </div>
      <h2 className="error-fallback__title">Something went wrong</h2>
      <p className="error-fallback__message">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <div className="error-fallback__actions">
        <button onClick={onReset} className="btn btn--primary">
          <RefreshCw size={16} />
          Try Again
        </button>
        <button onClick={() => window.location.reload()} className="btn btn--secondary">
          <RefreshCw size={16} />
          Reload Page
        </button>
        <button onClick={() => window.location.href = '/'} className="btn btn--ghost">
          <Home size={16} />
          Go Home
        </button>
      </div>
      {isDev && error && (
        <details className="error-fallback__details">
          <summary>Error Details (Development Only)</summary>
          <pre className="error-fallback__stack">
            <strong>Error:</strong> {error.toString()}
            {'\n\n'}
            <strong>Stack:</strong> {error.stack}
            {errorInfo && (
              <>
                {'\n\n'}
                <strong>Component Stack:</strong> {errorInfo.componentStack}
              </>
            )}
          </pre>
        </details>
      )}
    </div>
  );
}

interface SectionErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function SectionErrorFallback({
  title = 'Error loading section',
  message = 'Failed to load this section',
  onRetry,
}: SectionErrorFallbackProps): JSX.Element {
  return (
    <div className="section-error">
      <AlertTriangle size={24} className="section-error__icon" />
      <h3 className="section-error__title">{title}</h3>
      <p className="section-error__message">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn--sm btn--secondary">
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
