/**
 * MetricsCard Component
 *
 * Displays individual metrics with title, value, trend indicator, optional sparkline,
 * and various styling variants. Supports loading states and animated transitions.
 *
 * @module components/dashboard/MetricsCard
 */

import React, { useMemo, useEffect, useState, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MetricsCardTrend {
  /** Direction of the trend */
  direction: 'up' | 'down' | 'neutral';
  /** Percentage change */
  percentage: number;
}

export interface MetricsCardProps {
  /** Title/label for the metric */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional trend indicator */
  trend?: MetricsCardTrend;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Optional data points for sparkline chart */
  sparklineData?: number[];
  /** Visual variant based on metric type */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  /** Whether the card is in loading state */
  loading?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Variant colors for the card accents */
const VARIANT_COLORS: Record<string, { primary: string; light: string; dark: string }> = {
  default: {
    primary: 'var(--color-primary)',
    light: 'rgba(59, 130, 246, 0.15)',
    dark: 'var(--color-primary-700)',
  },
  success: {
    primary: 'var(--color-success-500)',
    light: 'rgba(34, 197, 94, 0.15)',
    dark: 'var(--color-success-700)',
  },
  warning: {
    primary: 'var(--color-warning-500)',
    light: 'rgba(245, 158, 11, 0.15)',
    dark: 'var(--color-warning-700)',
  },
  danger: {
    primary: 'var(--color-error-500)',
    light: 'rgba(239, 68, 68, 0.15)',
    dark: 'var(--color-error-700)',
  },
  info: {
    primary: 'var(--color-info-500)',
    light: 'rgba(14, 165, 233, 0.15)',
    dark: 'var(--color-info-700)',
  },
};

/** Trend icons and colors */
const TREND_CONFIG = {
  up: {
    icon: '\u2191',
    colorClass: 'metrics-card__trend--up',
    label: 'Increasing',
  },
  down: {
    icon: '\u2193',
    colorClass: 'metrics-card__trend--down',
    label: 'Decreasing',
  },
  neutral: {
    icon: '\u2194',
    colorClass: 'metrics-card__trend--neutral',
    label: 'No change',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Animated number display with transition effect
 */
const AnimatedValue: React.FC<{
  value: string | number;
  loading?: boolean;
}> = ({ value, loading }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (loading) return;

    if (prevValueRef.current !== value) {
      setIsAnimating(true);

      // Start animation
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);

      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value, loading]);

  if (loading) {
    return <span className="metrics-card__value-skeleton skeleton" />;
  }

  return (
    <span className={`metrics-card__value-text ${isAnimating ? 'metrics-card__value-text--animating' : ''}`}>
      {displayValue}
    </span>
  );
};

/**
 * Mini SVG Sparkline Chart
 */
const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}> = ({
  data,
  width = 80,
  height = 24,
  strokeColor = 'var(--color-primary)',
  fillColor = 'rgba(59, 130, 246, 0.1)',
  strokeWidth = 1.5,
}) => {
  const path = useMemo(() => {
    if (!data || data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Add padding to prevent clipping at edges
    const paddingX = 2;
    const paddingY = 2;
    const effectiveWidth = width - paddingX * 2;
    const effectiveHeight = height - paddingY * 2;

    const points = data.map((value, index) => {
      const x = paddingX + (index / (data.length - 1)) * effectiveWidth;
      const y = paddingY + effectiveHeight - ((value - min) / range) * effectiveHeight;
      return { x, y };
    });

    // Create smooth curve path using quadratic bezier
    let linePath = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;

      if (i === 0) {
        linePath += ` Q ${current.x} ${current.y}, ${midX} ${midY}`;
      } else {
        linePath += ` T ${midX} ${midY}`;
      }
    }

    // End at the last point
    const lastPoint = points[points.length - 1];
    linePath += ` L ${lastPoint.x} ${lastPoint.y}`;

    return linePath;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (!path || !data || data.length < 2) return '';

    const paddingX = 2;
    const paddingY = 2;
    const effectiveWidth = width - paddingX * 2;
    const lastX = paddingX + effectiveWidth;
    const firstX = paddingX;

    return `${path} L ${lastX} ${height - paddingY} L ${firstX} ${height - paddingY} Z`;
  }, [path, data, width, height]);

  if (!data || data.length < 2) {
    return null;
  }

  return (
    <svg
      className="metrics-card__sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Area fill */}
      <path
        d={areaPath}
        fill={fillColor}
        className="metrics-card__sparkline-area"
      />
      {/* Line stroke */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="metrics-card__sparkline-line"
      />
      {/* End point dot */}
      {data.length > 0 && (
        <circle
          cx={width - 2}
          cy={
            2 +
            (height - 4) -
            ((data[data.length - 1] - Math.min(...data)) /
              (Math.max(...data) - Math.min(...data) || 1)) *
              (height - 4)
          }
          r={2}
          fill={strokeColor}
          className="metrics-card__sparkline-dot"
        />
      )}
    </svg>
  );
};

/**
 * Trend indicator badge
 */
const TrendBadge: React.FC<{
  trend: MetricsCardTrend;
}> = ({ trend }) => {
  const config = TREND_CONFIG[trend.direction];
  const formattedPercentage = Math.abs(trend.percentage).toFixed(1);

  return (
    <span
      className={`metrics-card__trend ${config.colorClass}`}
      title={`${config.label}: ${trend.percentage >= 0 ? '+' : ''}${trend.percentage.toFixed(1)}%`}
    >
      <span className="metrics-card__trend-icon">{config.icon}</span>
      <span className="metrics-card__trend-value">{formattedPercentage}%</span>
    </span>
  );
};

/**
 * Loading skeleton for the metrics card
 */
const MetricsCardSkeleton: React.FC = () => {
  return (
    <div className="metrics-card metrics-card--loading">
      <div className="metrics-card__header">
        <div className="skeleton metrics-card__title-skeleton" />
      </div>
      <div className="metrics-card__body">
        <div className="skeleton metrics-card__value-skeleton" />
        <div className="skeleton metrics-card__subtitle-skeleton" />
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * MetricsCard displays a single metric with optional trend, sparkline, and styling variants
 */
export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  trend,
  subtitle,
  icon,
  sparklineData,
  variant = 'default',
  loading = false,
  className = '',
  onClick,
}) => {
  const variantColors = VARIANT_COLORS[variant] || VARIANT_COLORS.default;

  // Compute sparkline colors based on variant
  const sparklineStrokeColor = variantColors.primary;
  const sparklineFillColor = variantColors.light;

  // Build class names
  const cardClasses = [
    'metrics-card',
    `metrics-card--${variant}`,
    loading ? 'metrics-card--loading' : '',
    onClick ? 'metrics-card--clickable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Handle keyboard interaction for clickable cards
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  if (loading) {
    return <MetricsCardSkeleton />;
  }

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        '--metrics-card-accent': variantColors.primary,
        '--metrics-card-accent-light': variantColors.light,
      } as React.CSSProperties}
    >
      {/* Header with title and optional icon */}
      <div className="metrics-card__header">
        {icon && <span className="metrics-card__icon">{icon}</span>}
        <span className="metrics-card__title">{title}</span>
        {trend && <TrendBadge trend={trend} />}
      </div>

      {/* Body with main value */}
      <div className="metrics-card__body">
        <div className="metrics-card__value">
          <AnimatedValue value={value} loading={loading} />
        </div>

        {/* Sparkline chart */}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="metrics-card__sparkline-container">
            <Sparkline
              data={sparklineData}
              strokeColor={sparklineStrokeColor}
              fillColor={sparklineFillColor}
            />
          </div>
        )}
      </div>

      {/* Footer with subtitle */}
      {subtitle && (
        <div className="metrics-card__footer">
          <span className="metrics-card__subtitle">{subtitle}</span>
        </div>
      )}

      {/* Accent bar */}
      <div
        className="metrics-card__accent-bar"
        style={{ backgroundColor: variantColors.primary }}
      />
    </div>
  );
};

export default MetricsCard;
