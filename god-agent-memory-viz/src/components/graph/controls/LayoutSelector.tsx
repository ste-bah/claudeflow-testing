/**
 * LayoutSelector component for selecting graph layouts
 *
 * Provides a dropdown/select for layout type selection with preview icons
 * and an apply button to run the selected layout algorithm.
 *
 * @module components/graph/controls/LayoutSelector
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/utils';
import { Button } from '@/components/common/Button';
import type { LayoutType } from '@/types/graph';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended layout types including all Cytoscape-compatible layouts
 */
export type ExtendedLayoutType =
  | LayoutType
  | 'circle'
  | 'breadthfirst'
  | 'dagre'
  | 'cose'
  | 'cola';

/**
 * Layout option metadata
 */
export interface LayoutOption {
  /** Layout type identifier */
  type: ExtendedLayoutType;
  /** Display name */
  label: string;
  /** Short description */
  description: string;
}

/**
 * Props for the LayoutSelector component
 */
export interface LayoutSelectorProps {
  /** Currently selected layout type */
  currentLayout: ExtendedLayoutType;
  /** Callback when layout selection changes */
  onLayoutChange: (layout: ExtendedLayoutType) => void;
  /** Callback to apply the current layout */
  onApplyLayout: () => void;
  /** Whether a layout is currently running */
  isRunning?: boolean;
  /** Whether to automatically apply layout on change */
  autoApply?: boolean;
  /** Callback when auto-apply setting changes */
  onAutoApplyChange?: (autoApply: boolean) => void;
  /** Additional CSS class name */
  className?: string;
  /** Whether to use glass morphism styling */
  glass?: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Compact mode - smaller controls */
  compact?: boolean;
}

// ============================================================================
// Layout Options Configuration
// ============================================================================

/**
 * Available layout options with metadata
 */
const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    type: 'force',
    label: 'Force',
    description: 'Force-directed layout with physics simulation',
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'Organized grid arrangement',
  },
  {
    type: 'circle',
    label: 'Circle',
    description: 'Nodes arranged in a circle',
  },
  {
    type: 'concentric',
    label: 'Concentric',
    description: 'Nodes in concentric circles by degree',
  },
  {
    type: 'breadthfirst',
    label: 'Hierarchical',
    description: 'Breadth-first tree layout',
  },
  {
    type: 'dagre',
    label: 'Dagre',
    description: 'Directed acyclic graph layout',
  },
  {
    type: 'cose',
    label: 'CoSE',
    description: 'Compound spring embedder',
  },
  {
    type: 'cola',
    label: 'Cola',
    description: 'Constraint-based layout',
  },
  {
    type: 'hierarchical',
    label: 'Tree',
    description: 'Hierarchical tree structure',
  },
  {
    type: 'radial',
    label: 'Radial',
    description: 'Radial outward from center',
  },
  {
    type: 'timeline',
    label: 'Timeline',
    description: 'Time-based horizontal layout',
  },
];

// ============================================================================
// Icons
// ============================================================================

const ForceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2" />
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <line x1="8" y1="8" x2="10" y2="10" />
    <line x1="14" y1="10" x2="16" y2="8" />
    <line x1="8" y1="16" x2="10" y2="14" />
    <line x1="14" y1="14" x2="16" y2="16" />
  </svg>
);

const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const CircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="5" r="2" />
    <circle cx="19" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
    <circle cx="5" cy="12" r="2" />
  </svg>
);

const ConcentricIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const HierarchyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="4" r="2" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="12" r="2" />
    <circle cx="4" cy="20" r="2" />
    <circle cx="12" cy="20" r="2" />
    <circle cx="20" cy="20" r="2" />
    <line x1="12" y1="6" x2="6" y2="10" />
    <line x1="12" y1="6" x2="18" y2="10" />
    <line x1="6" y1="14" x2="4" y2="18" />
    <line x1="6" y1="14" x2="12" y2="18" />
    <line x1="18" y1="14" x2="20" y2="18" />
  </svg>
);

const DagreIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <rect x="3" y="10" width="6" height="4" rx="1" />
    <rect x="15" y="10" width="6" height="4" rx="1" />
    <rect x="9" y="18" width="6" height="4" rx="1" />
    <line x1="12" y1="6" x2="6" y2="10" />
    <line x1="12" y1="6" x2="18" y2="10" />
    <line x1="6" y1="14" x2="12" y2="18" />
    <line x1="18" y1="14" x2="12" y2="18" />
  </svg>
);

const CoseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="3" />
    <circle cx="16" cy="8" r="3" />
    <circle cx="12" cy="16" r="3" />
    <line x1="10" y1="9" x2="14" y2="9" />
    <line x1="9" y1="10" x2="11" y2="14" />
    <line x1="15" y1="10" x2="13" y2="14" />
  </svg>
);

const ColaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <circle cx="12" cy="12" r="2" />
    <line x1="8" y1="6" x2="10" y2="10" />
    <line x1="14" y1="10" x2="16" y2="6" />
    <line x1="8" y1="18" x2="10" y2="14" />
    <line x1="14" y1="14" x2="16" y2="18" />
  </svg>
);

const RadialIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="4" r="1.5" />
    <circle cx="19" cy="8" r="1.5" />
    <circle cx="19" cy="16" r="1.5" />
    <circle cx="12" cy="20" r="1.5" />
    <circle cx="5" cy="16" r="1.5" />
    <circle cx="5" cy="8" r="1.5" />
    <line x1="12" y1="10" x2="12" y2="5.5" />
    <line x1="13.5" y1="11" x2="17.5" y2="8.5" />
    <line x1="13.5" y1="13" x2="17.5" y2="15.5" />
    <line x1="12" y1="14" x2="12" y2="18.5" />
    <line x1="10.5" y1="13" x2="6.5" y2="15.5" />
    <line x1="10.5" y1="11" x2="6.5" y2="8.5" />
  </svg>
);

const TimelineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="2" y1="12" x2="22" y2="12" />
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <line x1="5" y1="6" x2="5" y2="10" />
    <line x1="12" y1="6" x2="12" y2="10" />
    <line x1="19" y1="6" x2="19" y2="10" />
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

/**
 * Get the icon component for a layout type
 */
const getLayoutIcon = (type: ExtendedLayoutType): React.FC<{ className?: string }> => {
  const iconMap: Record<ExtendedLayoutType, React.FC<{ className?: string }>> = {
    force: ForceIcon,
    grid: GridIcon,
    circle: CircleIcon,
    concentric: ConcentricIcon,
    breadthfirst: HierarchyIcon,
    hierarchical: HierarchyIcon,
    dagre: DagreIcon,
    cose: CoseIcon,
    cola: ColaIcon,
    radial: RadialIcon,
    timeline: TimelineIcon,
  };
  return iconMap[type] || ForceIcon;
};

// ============================================================================
// Component
// ============================================================================

/**
 * LayoutSelector provides intuitive layout algorithm selection for graph visualizations.
 *
 * Features:
 * - Dropdown selector with layout type options
 * - Preview icons for each layout type
 * - Apply button to run layout algorithm
 * - Auto-apply option for immediate layout on change
 * - Loading state during layout execution
 * - Glass morphism styling option
 *
 * @example
 * ```tsx
 * <LayoutSelector
 *   currentLayout="force"
 *   onLayoutChange={setLayout}
 *   onApplyLayout={runLayout}
 *   isRunning={layoutRunning}
 *   autoApply
 *   glass
 * />
 * ```
 */
export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  currentLayout,
  onLayoutChange,
  onApplyLayout,
  isRunning = false,
  autoApply = false,
  onAutoApplyChange,
  className,
  glass = true,
  disabled = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current layout option
  const currentOption = LAYOUT_OPTIONS.find((opt) => opt.type === currentLayout) || LAYOUT_OPTIONS[0];
  const CurrentIcon = getLayoutIcon(currentLayout);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          setIsOpen((prev) => !prev);
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          if (isOpen) {
            event.preventDefault();
            const currentIndex = LAYOUT_OPTIONS.findIndex(
              (opt) => opt.type === currentLayout
            );
            const nextIndex = (currentIndex + 1) % LAYOUT_OPTIONS.length;
            onLayoutChange(LAYOUT_OPTIONS[nextIndex].type);
          } else {
            setIsOpen(true);
          }
          break;
        case 'ArrowUp':
          if (isOpen) {
            event.preventDefault();
            const currentIndex = LAYOUT_OPTIONS.findIndex(
              (opt) => opt.type === currentLayout
            );
            const prevIndex =
              (currentIndex - 1 + LAYOUT_OPTIONS.length) % LAYOUT_OPTIONS.length;
            onLayoutChange(LAYOUT_OPTIONS[prevIndex].type);
          }
          break;
      }
    },
    [disabled, isOpen, currentLayout, onLayoutChange]
  );

  // Handle layout selection
  const handleSelectLayout = useCallback(
    (type: ExtendedLayoutType) => {
      onLayoutChange(type);
      setIsOpen(false);
      if (autoApply) {
        onApplyLayout();
      }
    },
    [onLayoutChange, autoApply, onApplyLayout]
  );

  // Handle apply button click
  const handleApply = useCallback(() => {
    if (!disabled && !isRunning) {
      onApplyLayout();
    }
  }, [disabled, isRunning, onApplyLayout]);

  // Handle auto-apply toggle
  const handleAutoApplyToggle = useCallback(() => {
    if (onAutoApplyChange) {
      onAutoApplyChange(!autoApply);
    }
  }, [autoApply, onAutoApplyChange]);

  // Container classes
  const containerClasses = cn(
    'layout-selector',
    glass && 'layout-selector--glass',
    compact && 'layout-selector--compact',
    disabled && 'layout-selector--disabled',
    className
  );

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      role="group"
      aria-label="Layout selector"
    >
      {/* Layout dropdown trigger */}
      <button
        type="button"
        className={cn(
          'layout-selector__trigger',
          isOpen && 'layout-selector__trigger--open'
        )}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select layout: ${currentOption.label}`}
      >
        <CurrentIcon className="layout-selector__trigger-icon" />
        <span className="layout-selector__trigger-label">{currentOption.label}</span>
        <ChevronDownIcon
          className={cn(
            'layout-selector__chevron',
            isOpen && 'layout-selector__chevron--open'
          )}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="layout-selector__dropdown"
          role="listbox"
          aria-label="Layout options"
        >
          {LAYOUT_OPTIONS.map((option) => {
            const OptionIcon = getLayoutIcon(option.type);
            const isSelected = option.type === currentLayout;
            return (
              <button
                key={option.type}
                type="button"
                className={cn(
                  'layout-selector__option',
                  isSelected && 'layout-selector__option--selected'
                )}
                onClick={() => handleSelectLayout(option.type)}
                role="option"
                aria-selected={isSelected}
                title={option.description}
              >
                <OptionIcon className="layout-selector__option-icon" />
                <div className="layout-selector__option-content">
                  <span className="layout-selector__option-label">
                    {option.label}
                  </span>
                  <span className="layout-selector__option-description">
                    {option.description}
                  </span>
                </div>
                {isSelected && (
                  <CheckIcon className="layout-selector__option-check" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="layout-selector__divider" />

      {/* Apply button */}
      <Button
        variant="ghost"
        size={compact ? 'sm' : 'md'}
        iconOnly
        onClick={handleApply}
        disabled={disabled || isRunning}
        isLoading={isRunning}
        aria-label="Apply layout"
        title={autoApply ? 'Layout applied automatically' : 'Apply layout'}
        className="layout-selector__apply"
      >
        <PlayIcon />
      </Button>

      {/* Auto-apply toggle */}
      {onAutoApplyChange && (
        <>
          <div className="layout-selector__divider" />
          <label className="layout-selector__auto-apply">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={handleAutoApplyToggle}
              disabled={disabled}
              className="layout-selector__auto-apply-input"
            />
            <span className="layout-selector__auto-apply-track">
              <span className="layout-selector__auto-apply-thumb" />
            </span>
            {!compact && (
              <span className="layout-selector__auto-apply-label">Auto</span>
            )}
          </label>
        </>
      )}
    </div>
  );
};

LayoutSelector.displayName = 'LayoutSelector';

export default LayoutSelector;
