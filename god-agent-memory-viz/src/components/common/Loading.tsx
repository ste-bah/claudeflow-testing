import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={clsx('loading-spinner', className)} role="status" aria-label={label || 'Loading'}>
      <Loader2 className={clsx('animate-spin', sizeClasses[size])} />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({ isLoading, message, progress }: LoadingOverlayProps): JSX.Element | null {
  if (!isLoading) return null;

  return (
    <div className="loading-overlay" role="alert" aria-busy="true">
      <div className="loading-overlay__content">
        <Spinner size="xl" />
        {message && <p className="loading-overlay__message">{message}</p>}
        {progress !== undefined && (
          <div className="loading-overlay__progress">
            <div
              className="loading-overlay__progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface InlineLoadingProps {
  message?: string;
  className?: string;
}

export function InlineLoading({ message = 'Loading...', className }: InlineLoadingProps): JSX.Element {
  return (
    <div className={clsx('inline-loading', className)}>
      <Spinner size="sm" />
      <span>{message}</span>
    </div>
  );
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({
  isLoading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps): JSX.Element {
  return (
    <button
      className={clsx('btn', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" />
          {loadingText || 'Loading...'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  className?: string;
  animate?: boolean;
}

export function Skeleton({
  width,
  height,
  variant = 'text',
  className,
  animate = true,
}: SkeletonProps): JSX.Element {
  const style: React.CSSProperties = {
    width: width,
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={clsx(
        'skeleton',
        `skeleton--${variant}`,
        animate && 'skeleton--animate',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps): JSX.Element {
  return (
    <div className={clsx('skeleton-text', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="skeleton-card">
      <Skeleton variant="rectangular" height={120} />
      <div className="skeleton-card__content">
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps): JSX.Element {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table__header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width="80%" />
        ))}
      </div>
      <div className="skeleton-table__body">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-table__row">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" width="70%" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Legacy export for backward compatibility
export const Loading = LoadingOverlay;

export default {
  Spinner,
  LoadingOverlay,
  InlineLoading,
  LoadingButton,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
};
