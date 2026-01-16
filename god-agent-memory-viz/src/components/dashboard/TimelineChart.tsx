/**
 * TimelineChart Component
 *
 * SVG-based line/area chart for displaying temporal data with multiple series support,
 * interactive tooltips, grid lines, legends, and responsive sizing.
 *
 * @module components/dashboard/TimelineChart
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimelineDataPoint {
  /** Timestamp for the data point */
  timestamp: Date;
  /** Values for each series keyed by series key */
  values: Record<string, number>;
}

export interface TimelineSeries {
  /** Unique key matching values in data points */
  key: string;
  /** Display label for the series */
  label: string;
  /** Color for the series line/area */
  color: string;
  /** Whether to show area fill under the line */
  showArea?: boolean;
}

export interface TimelineChartProps {
  /** Array of data points with timestamps and values */
  data: TimelineDataPoint[];
  /** Series configuration */
  series: TimelineSeries[];
  /** Chart height in pixels */
  height?: number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Whether to show grid lines */
  showGrid?: boolean;
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
  /** Date format function or string pattern */
  dateFormat?: string | ((date: Date) => string);
  /** Additional CSS class name */
  className?: string;
  /** Click handler for data points */
  onPointClick?: (timestamp: Date, values: Record<string, number>) => void;
  /** Padding around the chart area */
  padding?: { top: number; right: number; bottom: number; left: number };
  /** Whether to animate on initial render */
  animate?: boolean;
  /** Number of Y-axis ticks */
  yTickCount?: number;
  /** Number of X-axis ticks */
  xTickCount?: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: TimelineDataPoint | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HEIGHT = 300;
const DEFAULT_PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
const DEFAULT_Y_TICK_COUNT = 5;
const DEFAULT_X_TICK_COUNT = 6;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a date for display
 */
const formatDate = (
  date: Date,
  format?: string | ((date: Date) => string)
): string => {
  if (typeof format === 'function') {
    return format(date);
  }

  // Default formatting based on time range
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleDateString('en-US', options);
};

/**
 * Format a number for display
 */
const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
};

/**
 * Generate smooth bezier curve path from points
 */
const generateSmoothPath = (
  points: Array<{ x: number; y: number }>
): string => {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const prev = points[i - 1] || current;
    const nextNext = points[i + 2] || next;

    // Calculate control points for smooth bezier curve
    const tension = 0.3;
    const cp1x = current.x + (next.x - prev.x) * tension;
    const cp1y = current.y + (next.y - prev.y) * tension;
    const cp2x = next.x - (nextNext.x - current.x) * tension;
    const cp2y = next.y - (nextNext.y - current.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  return path;
};

/**
 * Generate area path from line path
 */
const generateAreaPath = (
  linePath: string,
  points: Array<{ x: number; y: number }>,
  baseY: number
): string => {
  if (points.length < 2) return '';

  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;

  return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Grid lines for the chart
 */
const ChartGrid: React.FC<{
  width: number;
  height: number;
  yTicks: number[];
  xTicks: Date[];
  scaleY: (value: number) => number;
  scaleX: (date: Date) => number;
}> = ({ width, height, yTicks, xTicks, scaleY, scaleX }) => {
  return (
    <g className="timeline-chart__grid">
      {/* Horizontal grid lines */}
      {yTicks.map((tick, i) => {
        const y = scaleY(tick);
        return (
          <line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            className="timeline-chart__grid-line timeline-chart__grid-line--horizontal"
          />
        );
      })}
      {/* Vertical grid lines */}
      {xTicks.map((tick, i) => {
        const x = scaleX(tick);
        return (
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            className="timeline-chart__grid-line timeline-chart__grid-line--vertical"
          />
        );
      })}
    </g>
  );
};

/**
 * Y-axis with labels
 */
const YAxis: React.FC<{
  ticks: number[];
  scaleY: (value: number) => number;
  width: number;
}> = ({ ticks, scaleY }) => {
  return (
    <g className="timeline-chart__y-axis">
      {ticks.map((tick, i) => {
        const y = scaleY(tick);
        return (
          <g key={i} transform={`translate(0, ${y})`}>
            <line
              x1={-6}
              y1={0}
              x2={0}
              y2={0}
              className="timeline-chart__axis-tick"
            />
            <text
              x={-10}
              y={0}
              dy="0.32em"
              textAnchor="end"
              className="timeline-chart__axis-label"
            >
              {formatNumber(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * X-axis with labels
 */
const XAxis: React.FC<{
  ticks: Date[];
  scaleX: (date: Date) => number;
  height: number;
  dateFormat?: string | ((date: Date) => string);
}> = ({ ticks, scaleX, height, dateFormat }) => {
  return (
    <g className="timeline-chart__x-axis" transform={`translate(0, ${height})`}>
      {ticks.map((tick, i) => {
        const x = scaleX(tick);
        return (
          <g key={i} transform={`translate(${x}, 0)`}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              className="timeline-chart__axis-tick"
            />
            <text
              x={0}
              y={20}
              textAnchor="middle"
              className="timeline-chart__axis-label"
            >
              {formatDate(tick, dateFormat)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/**
 * Legend component
 */
const ChartLegend: React.FC<{
  series: TimelineSeries[];
  onSeriesToggle?: (key: string) => void;
  disabledSeries?: Set<string>;
}> = ({ series, onSeriesToggle, disabledSeries }) => {
  return (
    <div className="timeline-chart__legend">
      {series.map((s) => {
        const isDisabled = disabledSeries?.has(s.key);
        return (
          <button
            key={s.key}
            className={`timeline-chart__legend-item ${isDisabled ? 'timeline-chart__legend-item--disabled' : ''}`}
            onClick={() => onSeriesToggle?.(s.key)}
            type="button"
          >
            <span
              className="timeline-chart__legend-color"
              style={{ backgroundColor: isDisabled ? 'var(--color-neutral-600)' : s.color }}
            />
            <span className="timeline-chart__legend-label">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * Tooltip component
 */
const ChartTooltip: React.FC<{
  state: TooltipState;
  series: TimelineSeries[];
  dateFormat?: string | ((date: Date) => string);
  containerRect: DOMRect | null;
}> = ({ state, series, dateFormat, containerRect }) => {
  if (!state.visible || !state.dataPoint || !containerRect) return null;

  // Calculate tooltip position to keep it within bounds
  const tooltipWidth = 180;
  const tooltipHeight = 30 + series.length * 24;
  let left = state.x + 15;
  let top = state.y - tooltipHeight / 2;

  // Adjust if tooltip would overflow right
  if (left + tooltipWidth > containerRect.width) {
    left = state.x - tooltipWidth - 15;
  }

  // Adjust if tooltip would overflow top
  if (top < 0) {
    top = 10;
  }

  // Adjust if tooltip would overflow bottom
  if (top + tooltipHeight > containerRect.height) {
    top = containerRect.height - tooltipHeight - 10;
  }

  return (
    <div
      className="timeline-chart__tooltip"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <div className="timeline-chart__tooltip-header">
        {formatDate(state.dataPoint.timestamp, dateFormat)}
      </div>
      <div className="timeline-chart__tooltip-content">
        {series.map((s) => {
          const value = state.dataPoint?.values[s.key];
          if (value === undefined) return null;
          return (
            <div key={s.key} className="timeline-chart__tooltip-row">
              <span
                className="timeline-chart__tooltip-color"
                style={{ backgroundColor: s.color }}
              />
              <span className="timeline-chart__tooltip-label">{s.label}:</span>
              <span className="timeline-chart__tooltip-value">
                {formatNumber(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Empty state when no data
 */
const EmptyState: React.FC = () => {
  return (
    <div className="timeline-chart__empty">
      <svg
        className="timeline-chart__empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 16l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="timeline-chart__empty-text">No data available</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * TimelineChart displays temporal data with multiple series, tooltips, and interactive features
 */
export const TimelineChart: React.FC<TimelineChartProps> = ({
  data,
  series,
  height = DEFAULT_HEIGHT,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  dateFormat,
  className = '',
  onPointClick,
  padding = DEFAULT_PADDING,
  animate = true,
  yTickCount = DEFAULT_Y_TICK_COUNT,
  xTickCount = DEFAULT_X_TICK_COUNT,
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // State
  const [containerWidth, setContainerWidth] = useState(0);
  const [disabledSeries, setDisabledSeries] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    dataPoint: null,
  });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setContainerWidth(container.clientWidth);
      setContainerRect(container.getBoundingClientRect());
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Trigger animation on mount
  useEffect(() => {
    if (animate && data.length > 0) {
      const timer = setTimeout(() => setIsAnimated(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animate, data.length]);

  // Calculate chart dimensions
  const chartWidth = Math.max(0, containerWidth - padding.left - padding.right);
  const chartHeight = Math.max(0, height - padding.top - padding.bottom);

  // Filter active series
  const activeSeries = useMemo(
    () => series.filter((s) => !disabledSeries.has(s.key)),
    [series, disabledSeries]
  );

  // Sort data by timestamp
  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [data]
  );

  // Calculate scales
  const { scaleX, scaleY, yMin, yMax, xMin, xMax } = useMemo(() => {
    if (sortedData.length === 0 || activeSeries.length === 0) {
      return {
        scaleX: () => 0,
        scaleY: () => 0,
        yMin: 0,
        yMax: 100,
        xMin: new Date(),
        xMax: new Date(),
      };
    }

    // X scale (time)
    const timestamps = sortedData.map((d) => d.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;

    const scaleX = (date: Date): number => {
      return ((date.getTime() - minTime) / timeRange) * chartWidth;
    };

    // Y scale (values)
    const allValues = sortedData.flatMap((d) =>
      activeSeries.map((s) => d.values[s.key] ?? 0)
    );
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(...allValues);
    const valueRange = maxVal - minVal || 1;

    // Add 10% padding to Y range
    const paddedMin = minVal - valueRange * 0.05;
    const paddedMax = maxVal + valueRange * 0.1;
    const paddedRange = paddedMax - paddedMin;

    const scaleY = (value: number): number => {
      return chartHeight - ((value - paddedMin) / paddedRange) * chartHeight;
    };

    return {
      scaleX,
      scaleY,
      yMin: paddedMin,
      yMax: paddedMax,
      xMin: new Date(minTime),
      xMax: new Date(maxTime),
    };
  }, [sortedData, activeSeries, chartWidth, chartHeight]);

  // Generate tick values
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = yMax - yMin;
    const step = range / (yTickCount - 1);

    for (let i = 0; i < yTickCount; i++) {
      ticks.push(yMin + step * i);
    }

    return ticks;
  }, [yMin, yMax, yTickCount]);

  const xTicks = useMemo(() => {
    if (sortedData.length === 0) return [];

    const ticks: Date[] = [];
    const minTime = xMin.getTime();
    const maxTime = xMax.getTime();
    const timeRange = maxTime - minTime || 1;
    const step = timeRange / (xTickCount - 1);

    for (let i = 0; i < xTickCount; i++) {
      ticks.push(new Date(minTime + step * i));
    }

    return ticks;
  }, [sortedData.length, xMin, xMax, xTickCount]);

  // Generate paths for each series
  const seriesPaths = useMemo(() => {
    return activeSeries.map((s) => {
      const points = sortedData.map((d) => ({
        x: scaleX(d.timestamp),
        y: scaleY(d.values[s.key] ?? 0),
      }));

      const linePath = generateSmoothPath(points);
      const areaPath =
        s.showArea !== false
          ? generateAreaPath(linePath, points, chartHeight)
          : '';

      return {
        key: s.key,
        color: s.color,
        linePath,
        areaPath,
        points,
        showArea: s.showArea !== false,
      };
    });
  }, [activeSeries, sortedData, scaleX, scaleY, chartHeight]);

  // Handle mouse events for tooltip
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!showTooltip || sortedData.length === 0) return;

      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left - padding.left;
      const y = event.clientY - rect.top - padding.top;

      // Find closest data point using for loop for proper type narrowing
      let closestPoint: TimelineDataPoint | undefined;
      let closestDistance = Infinity;

      for (let i = 0; i < sortedData.length; i++) {
        const d = sortedData[i];
        const pointX = scaleX(d.timestamp);
        const distance = Math.abs(pointX - x);

        if (distance < closestDistance && distance < 50) {
          closestDistance = distance;
          closestPoint = d;
        }
      }

      if (closestPoint) {
        setTooltip({
          visible: true,
          x: scaleX(closestPoint.timestamp) + padding.left,
          y: y + padding.top,
          dataPoint: closestPoint,
        });
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    },
    [showTooltip, sortedData, scaleX, padding]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleClick = useCallback(
    (_event: React.MouseEvent<SVGSVGElement>) => {
      if (!onPointClick || !tooltip.dataPoint) return;
      onPointClick(tooltip.dataPoint.timestamp, tooltip.dataPoint.values);
    },
    [onPointClick, tooltip.dataPoint]
  );

  // Toggle series visibility
  const handleSeriesToggle = useCallback((key: string) => {
    setDisabledSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Build class names
  const containerClasses = [
    'timeline-chart',
    animate && isAnimated ? 'timeline-chart--animated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Empty state
  if (data.length === 0 || series.length === 0) {
    return (
      <div className={containerClasses} style={{ height }} ref={containerRef}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={containerClasses} ref={containerRef}>
      {showLegend && (
        <ChartLegend
          series={series}
          onSeriesToggle={handleSeriesToggle}
          disabledSeries={disabledSeries}
        />
      )}

      <div className="timeline-chart__container" style={{ height }}>
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          className="timeline-chart__svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Grid lines */}
            {showGrid && (
              <ChartGrid
                width={chartWidth}
                height={chartHeight}
                yTicks={yTicks}
                xTicks={xTicks}
                scaleY={scaleY}
                scaleX={scaleX}
              />
            )}

            {/* Area fills */}
            {seriesPaths.map(
              (path) =>
                path.showArea && (
                  <path
                    key={`area-${path.key}`}
                    d={path.areaPath}
                    fill={path.color}
                    className="timeline-chart__area"
                  />
                )
            )}

            {/* Lines */}
            {seriesPaths.map((path) => (
              <path
                key={`line-${path.key}`}
                d={path.linePath}
                fill="none"
                stroke={path.color}
                className="timeline-chart__line"
              />
            ))}

            {/* Data points */}
            {seriesPaths.map((path) =>
              path.points.map((point, i) => (
                <circle
                  key={`point-${path.key}-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r={3}
                  fill={path.color}
                  className="timeline-chart__point"
                />
              ))
            )}

            {/* Hover line */}
            {tooltip.visible && tooltip.dataPoint && (
              <line
                x1={scaleX(tooltip.dataPoint.timestamp)}
                y1={0}
                x2={scaleX(tooltip.dataPoint.timestamp)}
                y2={chartHeight}
                className="timeline-chart__hover-line"
              />
            )}

            {/* Axes */}
            <YAxis ticks={yTicks} scaleY={scaleY} width={chartWidth} />
            <XAxis
              ticks={xTicks}
              scaleX={scaleX}
              height={chartHeight}
              dateFormat={dateFormat}
            />
          </g>
        </svg>

        {/* Tooltip */}
        {showTooltip && (
          <ChartTooltip
            state={tooltip}
            series={activeSeries}
            dateFormat={dateFormat}
            containerRect={containerRect}
          />
        )}
      </div>
    </div>
  );
};

export default TimelineChart;
