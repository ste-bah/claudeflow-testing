/**
 * ZoomControls component for graph visualization
 *
 * Provides zoom in/out buttons, zoom to fit, zoom percentage display,
 * and an optional slider for fine-grained control.
 *
 * @module components/graph/controls/ZoomControls
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/utils';
import { Button } from '@/components/common/Button';

// ============================================================================
// Types
// ============================================================================

/**
 * ZoomControls orientation
 */
export type ZoomControlsOrientation = 'vertical' | 'horizontal';

/**
 * ZoomControls position preset
 */
export type ZoomControlsPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Props for the ZoomControls component
 */
export interface ZoomControlsProps {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Minimum allowed zoom level */
  minZoom?: number;
  /** Maximum allowed zoom level */
  maxZoom?: number;
  /** Callback when zoom changes */
  onZoomChange: (zoom: number) => void;
  /** Callback for zoom to fit action */
  onZoomToFit?: () => void;
  /** Callback for zoom to selection action */
  onZoomToSelection?: () => void;
  /** Step size for zoom in/out buttons */
  zoomStep?: number;
  /** Whether to show the zoom percentage display */
  showPercentage?: boolean;
  /** Whether to show the zoom slider */
  showSlider?: boolean;
  /** Whether to show zoom to fit button */
  showFitButton?: boolean;
  /** Whether to show keyboard shortcuts hints */
  showKeyboardHints?: boolean;
  /** Orientation of the controls */
  orientation?: ZoomControlsOrientation;
  /** Position preset for absolute positioning */
  position?: ZoomControlsPosition;
  /** Whether to use glass morphism styling */
  glass?: boolean;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Compact mode - smaller buttons */
  compact?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const ZoomInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const FitIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

// ResetIcon - kept for potential future use with reset button
// const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
//   <svg
//     className={className}
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//   >
//     <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
//     <path d="M3 3v5h5" />
//   </svg>
// );

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clamp a value between min and max
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Format zoom level as percentage string
 */
const formatZoomPercentage = (zoom: number): string => {
  return `${Math.round(zoom * 100)}%`;
};

/**
 * Convert zoom level to slider value (0-100)
 */
const zoomToSlider = (zoom: number, min: number, max: number): number => {
  // Use logarithmic scale for more intuitive control
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const logZoom = Math.log(zoom);
  return ((logZoom - logMin) / (logMax - logMin)) * 100;
};

/**
 * Convert slider value (0-100) to zoom level
 */
const sliderToZoom = (value: number, min: number, max: number): number => {
  // Use logarithmic scale for more intuitive control
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const logZoom = logMin + (value / 100) * (logMax - logMin);
  return Math.exp(logZoom);
};

// ============================================================================
// Component
// ============================================================================

/**
 * ZoomControls provides intuitive zoom control for graph visualizations.
 *
 * Features:
 * - Zoom in/out buttons with configurable step size
 * - Zoom to fit button to show entire graph
 * - Current zoom percentage display
 * - Optional slider for fine-grained zoom control
 * - Keyboard shortcut hints
 * - Glass morphism styling option
 * - Vertical or horizontal orientation
 * - Position presets for easy placement
 *
 * @example
 * ```tsx
 * <ZoomControls
 *   zoom={viewportState.zoom}
 *   onZoomChange={handleZoomChange}
 *   onZoomToFit={handleZoomToFit}
 *   showSlider
 *   showKeyboardHints
 *   position="bottom-right"
 *   glass
 * />
 * ```
 */
export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  minZoom = 0.1,
  maxZoom = 4,
  onZoomChange,
  onZoomToFit,
  // onZoomToSelection - reserved for future use with selection-based zoom
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onZoomToSelection: _onZoomToSelection,
  zoomStep = 0.25,
  showPercentage = true,
  showSlider = false,
  showFitButton = true,
  showKeyboardHints = false,
  orientation = 'vertical',
  position,
  glass = true,
  disabled = false,
  className,
  compact = false,
}) => {
  // Memoize calculations
  const sliderValue = useMemo(
    () => zoomToSlider(zoom, minZoom, maxZoom),
    [zoom, minZoom, maxZoom]
  );

  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  // Handlers
  const handleZoomIn = useCallback(() => {
    if (disabled || !canZoomIn) return;
    const newZoom = clamp(zoom + zoomStep, minZoom, maxZoom);
    onZoomChange(newZoom);
  }, [zoom, zoomStep, minZoom, maxZoom, disabled, canZoomIn, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    if (disabled || !canZoomOut) return;
    const newZoom = clamp(zoom - zoomStep, minZoom, maxZoom);
    onZoomChange(newZoom);
  }, [zoom, zoomStep, minZoom, maxZoom, disabled, canZoomOut, onZoomChange]);

  const handleReset = useCallback(() => {
    if (disabled) return;
    onZoomChange(1);
  }, [disabled, onZoomChange]);

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const value = parseFloat(event.target.value);
      const newZoom = sliderToZoom(value, minZoom, maxZoom);
      onZoomChange(newZoom);
    },
    [minZoom, maxZoom, disabled, onZoomChange]
  );

  const handleFitClick = useCallback(() => {
    if (disabled || !onZoomToFit) return;
    onZoomToFit();
  }, [disabled, onZoomToFit]);

  // Container classes
  const containerClasses = cn(
    'zoom-controls',
    `zoom-controls--${orientation}`,
    glass && 'zoom-controls--glass',
    compact && 'zoom-controls--compact',
    position && `zoom-controls--${position}`,
    disabled && 'zoom-controls--disabled',
    className
  );

  const buttonSize = compact ? 'sm' : 'md';

  return (
    <div
      className={containerClasses}
      role="group"
      aria-label="Zoom controls"
    >
      {/* Zoom Out Button */}
      <Button
        variant="ghost"
        size={buttonSize}
        iconOnly
        onClick={handleZoomOut}
        disabled={disabled || !canZoomOut}
        aria-label="Zoom out"
        title={showKeyboardHints ? 'Zoom out (-)' : 'Zoom out'}
        className="zoom-controls__button"
      >
        <ZoomOutIcon />
      </Button>

      {/* Zoom Percentage Display */}
      {showPercentage && (
        <button
          type="button"
          className="zoom-controls__percentage"
          onClick={handleReset}
          disabled={disabled}
          aria-label={`Current zoom: ${formatZoomPercentage(zoom)}. Click to reset to 100%`}
          title={showKeyboardHints ? 'Reset zoom (0)' : 'Reset to 100%'}
        >
          {formatZoomPercentage(zoom)}
        </button>
      )}

      {/* Zoom Slider */}
      {showSlider && (
        <div className="zoom-controls__slider-container">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderValue}
            onChange={handleSliderChange}
            disabled={disabled}
            className="zoom-controls__slider"
            aria-label="Zoom level"
            aria-valuemin={Math.round(minZoom * 100)}
            aria-valuemax={Math.round(maxZoom * 100)}
            aria-valuenow={Math.round(zoom * 100)}
            aria-valuetext={formatZoomPercentage(zoom)}
          />
        </div>
      )}

      {/* Zoom In Button */}
      <Button
        variant="ghost"
        size={buttonSize}
        iconOnly
        onClick={handleZoomIn}
        disabled={disabled || !canZoomIn}
        aria-label="Zoom in"
        title={showKeyboardHints ? 'Zoom in (+)' : 'Zoom in'}
        className="zoom-controls__button"
      >
        <ZoomInIcon />
      </Button>

      {/* Divider (only in vertical orientation with fit button) */}
      {showFitButton && onZoomToFit && orientation === 'vertical' && (
        <div className="zoom-controls__divider" />
      )}

      {/* Zoom to Fit Button */}
      {showFitButton && onZoomToFit && (
        <Button
          variant="ghost"
          size={buttonSize}
          iconOnly
          onClick={handleFitClick}
          disabled={disabled}
          aria-label="Fit to view"
          title={showKeyboardHints ? 'Fit to view (F)' : 'Fit graph to view'}
          className="zoom-controls__button"
        >
          <FitIcon />
        </Button>
      )}

      {/* Keyboard Hints */}
      {showKeyboardHints && (
        <div className="zoom-controls__hints">
          <span className="zoom-controls__hint">
            <kbd>+</kbd>/<kbd>-</kbd> zoom
          </span>
          <span className="zoom-controls__hint">
            <kbd>0</kbd> reset
          </span>
          {showFitButton && onZoomToFit && (
            <span className="zoom-controls__hint">
              <kbd>F</kbd> fit
            </span>
          )}
        </div>
      )}
    </div>
  );
};

ZoomControls.displayName = 'ZoomControls';

export default ZoomControls;
