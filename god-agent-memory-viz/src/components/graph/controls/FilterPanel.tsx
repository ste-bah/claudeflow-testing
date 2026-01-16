/**
 * FilterPanel Component
 *
 * A comprehensive filter panel for filtering graph nodes and edges in the
 * God Agent Memory Visualization. Provides checkboxes for node/edge types,
 * time range selection, and quick filter actions.
 *
 * @module components/graph/controls/FilterPanel
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/utils';
import { Button } from '@/components/common/Button';
import { useFilterStore } from '@/stores/filterStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Node type configuration with display name and color
 */
interface NodeTypeConfig {
  type: string;
  label: string;
  color: string;
}

/**
 * Edge type configuration with display name
 */
interface EdgeTypeConfig {
  type: string;
  label: string;
}

/**
 * FilterPanel component props
 */
export interface FilterPanelProps {
  /** Additional CSS class name */
  className?: string;
  /** Whether the panel can be collapsed */
  collapsible?: boolean;
  /** Default expanded state when collapsible */
  defaultExpanded?: boolean;
  /** Callback when filter state changes */
  onFilterChange?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Node types with their display labels and colors
 */
const NODE_TYPES: NodeTypeConfig[] = [
  { type: 'trajectory', label: 'Trajectory', color: '#3B82F6' },
  { type: 'pattern', label: 'Pattern', color: '#10B981' },
  { type: 'episode', label: 'Episode', color: '#8B5CF6' },
  { type: 'feedback', label: 'Feedback', color: '#F59E0B' },
  { type: 'reasoning_step', label: 'Reasoning Step', color: '#EC4899' },
  { type: 'checkpoint', label: 'Checkpoint', color: '#6366F1' },
  { type: 'session', label: 'Session', color: '#06B6D4' },
  { type: 'agent', label: 'Agent', color: '#14B8A6' },
  { type: 'namespace', label: 'Namespace', color: '#84CC16' },
];

/**
 * Edge types with their display labels
 */
const EDGE_TYPES: EdgeTypeConfig[] = [
  { type: 'uses_pattern', label: 'Uses Pattern' },
  { type: 'creates_pattern', label: 'Creates Pattern' },
  { type: 'linked_to', label: 'Linked To' },
  { type: 'informed_by_feedback', label: 'Informed By Feedback' },
  { type: 'belongs_to_route', label: 'Belongs To Route' },
  { type: 'has_step', label: 'Has Step' },
  { type: 'has_checkpoint', label: 'Has Checkpoint' },
  { type: 'temporal', label: 'Temporal' },
  { type: 'membership', label: 'Membership' },
  { type: 'reference', label: 'Reference' },
  { type: 'similarity', label: 'Similarity' },
];

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Chevron icon for collapsible sections
 */
const ChevronIcon: React.FC<{ expanded: boolean; className?: string }> = ({
  expanded,
  className,
}) => (
  <svg
    className={cn('filter-panel__chevron', expanded && 'filter-panel__chevron--expanded', className)}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Filter icon for the panel header
 */
const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5C14 3.77614 13.7761 4 13.5 4H2.5C2.22386 4 2 3.77614 2 3.5Z"
      fill="currentColor"
    />
    <path
      d="M4 8C4 7.72386 4.22386 7.5 4.5 7.5H11.5C11.7761 7.5 12 7.72386 12 8C12 8.27614 11.7761 8.5 11.5 8.5H4.5C4.22386 8.5 4 8.27614 4 8Z"
      fill="currentColor"
    />
    <path
      d="M6 12.5C6 12.2239 6.22386 12 6.5 12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H6.5C6.22386 13 6 12.7761 6 12.5Z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Reset icon for the reset filters button
 */
const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 8C2 4.68629 4.68629 2 8 2C10.5264 2 12.6791 3.54968 13.5 5.72727M14 8C14 11.3137 11.3137 14 8 14C5.47361 14 3.32085 12.4503 2.5 10.2727"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14 2V6H10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 14V10H6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Checkbox component for filter items
 */
interface FilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  color?: string;
  disabled?: boolean;
}

const FilterCheckbox: React.FC<FilterCheckboxProps> = ({
  checked,
  onChange,
  label,
  color,
  disabled = false,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    },
    [onChange]
  );

  return (
    <label className={cn('filter-panel__checkbox', disabled && 'filter-panel__checkbox--disabled')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="filter-panel__checkbox-input"
        aria-label={`Filter by ${label} node type`}
      />
      <span className="filter-panel__checkbox-box" aria-hidden="true">
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 5L4 7L8 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {color && (
        <span
          className="filter-panel__checkbox-color"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <span className="filter-panel__checkbox-label">{label}</span>
    </label>
  );
};

/**
 * Collapsible section component
 */
interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: number;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  badge,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="filter-panel__section">
      <button
        type="button"
        className="filter-panel__section-header"
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <span className="filter-panel__section-title">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="filter-panel__section-badge">{badge}</span>
        )}
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded && <div className="filter-panel__section-content">{children}</div>}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * FilterPanel component for filtering graph visualization nodes and edges.
 *
 * Features:
 * - Node type filters with colored indicators
 * - Edge type filters
 * - Time range selection with date pickers
 * - Quick actions (Select All, Clear All, Reset)
 * - Active filter count badge
 * - Collapsible sections
 *
 * @example
 * <FilterPanel
 *   collapsible
 *   defaultExpanded={true}
 *   onFilterChange={() => console.log('Filters changed')}
 * />
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  className,
  collapsible = false,
  defaultExpanded = true,
  onFilterChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get filter state and actions from store
  const {
    enabledNodeTypes,
    enabledEdgeTypes,
    timeRange,
    toggleNodeType,
    toggleEdgeType,
    enableAllNodeTypes,
    disableAllNodeTypes,
    enableAllEdgeTypes,
    disableAllEdgeTypes,
    setTimeRange,
    clearTimeRange,
    resetAllFilters,
  } = useFilterStore();

  // Calculate active filter counts
  const activeNodeFilters = useMemo(() => {
    const totalNodeTypes = NODE_TYPES.length;
    return totalNodeTypes - enabledNodeTypes.size;
  }, [enabledNodeTypes]);

  const activeEdgeFilters = useMemo(() => {
    const totalEdgeTypes = EDGE_TYPES.length;
    return totalEdgeTypes - enabledEdgeTypes.size;
  }, [enabledEdgeTypes]);

  const hasTimeFilter = useMemo(() => {
    return timeRange.start !== null || timeRange.end !== null;
  }, [timeRange]);

  const totalActiveFilters = useMemo(() => {
    return activeNodeFilters + activeEdgeFilters + (hasTimeFilter ? 1 : 0);
  }, [activeNodeFilters, activeEdgeFilters, hasTimeFilter]);

  // Handlers
  const handleNodeTypeToggle = useCallback(
    (type: string) => {
      toggleNodeType(type);
      onFilterChange?.();
    },
    [toggleNodeType, onFilterChange]
  );

  const handleEdgeTypeToggle = useCallback(
    (type: string) => {
      toggleEdgeType(type);
      onFilterChange?.();
    },
    [toggleEdgeType, onFilterChange]
  );

  const handleSelectAllNodes = useCallback(() => {
    enableAllNodeTypes();
    onFilterChange?.();
  }, [enableAllNodeTypes, onFilterChange]);

  const handleClearAllNodes = useCallback(() => {
    disableAllNodeTypes();
    onFilterChange?.();
  }, [disableAllNodeTypes, onFilterChange]);

  const handleSelectAllEdges = useCallback(() => {
    enableAllEdgeTypes();
    onFilterChange?.();
  }, [enableAllEdgeTypes, onFilterChange]);

  const handleClearAllEdges = useCallback(() => {
    disableAllEdgeTypes();
    onFilterChange?.();
  }, [disableAllEdgeTypes, onFilterChange]);

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setTimeRange({
        start: value ? new Date(value) : null,
        end: timeRange.end,
      });
      onFilterChange?.();
    },
    [setTimeRange, timeRange.end, onFilterChange]
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setTimeRange({
        start: timeRange.start,
        end: value ? new Date(value) : null,
      });
      onFilterChange?.();
    },
    [setTimeRange, timeRange.start, onFilterChange]
  );

  const handleClearTimeRange = useCallback(() => {
    clearTimeRange();
    onFilterChange?.();
  }, [clearTimeRange, onFilterChange]);

  const handleResetAllFilters = useCallback(() => {
    resetAllFilters();
    onFilterChange?.();
  }, [resetAllFilters, onFilterChange]);

  const togglePanel = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Format date for input value
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().slice(0, 16);
  };

  const panelClasses = cn(
    'filter-panel',
    collapsible && 'filter-panel--collapsible',
    !isExpanded && 'filter-panel--collapsed',
    className
  );

  return (
    <div className={panelClasses}>
      {/* Panel Header */}
      <div className="filter-panel__header">
        {collapsible ? (
          <button
            type="button"
            className="filter-panel__header-toggle"
            onClick={togglePanel}
            aria-expanded={isExpanded}
          >
            <FilterIcon className="filter-panel__header-icon" />
            <span className="filter-panel__header-title">Filters</span>
            {totalActiveFilters > 0 && (
              <span className="filter-panel__header-badge">{totalActiveFilters}</span>
            )}
            <ChevronIcon expanded={isExpanded} />
          </button>
        ) : (
          <div className="filter-panel__header-static">
            <FilterIcon className="filter-panel__header-icon" />
            <span className="filter-panel__header-title">Filters</span>
            {totalActiveFilters > 0 && (
              <span className="filter-panel__header-badge">{totalActiveFilters}</span>
            )}
          </div>
        )}

        {isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAllFilters}
            leftIcon={<ResetIcon />}
            className="filter-panel__reset-btn"
            title="Reset all filters"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Panel Content */}
      {isExpanded && (
        <div className="filter-panel__content">
          {/* Node Type Filters */}
          <FilterSection
            title="Node Types"
            defaultExpanded
            badge={activeNodeFilters > 0 ? activeNodeFilters : undefined}
          >
            <div className="filter-panel__quick-actions">
              <button
                type="button"
                className="filter-panel__quick-action"
                onClick={handleSelectAllNodes}
              >
                Select All
              </button>
              <span className="filter-panel__quick-action-divider">|</span>
              <button
                type="button"
                className="filter-panel__quick-action"
                onClick={handleClearAllNodes}
              >
                Clear All
              </button>
            </div>
            <div className="filter-panel__checkbox-list">
              {NODE_TYPES.map((nodeType) => (
                <FilterCheckbox
                  key={nodeType.type}
                  checked={enabledNodeTypes.has(nodeType.type)}
                  onChange={() => handleNodeTypeToggle(nodeType.type)}
                  label={nodeType.label}
                  color={nodeType.color}
                />
              ))}
            </div>
          </FilterSection>

          {/* Edge Type Filters */}
          <FilterSection
            title="Edge Types"
            defaultExpanded={false}
            badge={activeEdgeFilters > 0 ? activeEdgeFilters : undefined}
          >
            <div className="filter-panel__quick-actions">
              <button
                type="button"
                className="filter-panel__quick-action"
                onClick={handleSelectAllEdges}
              >
                Select All
              </button>
              <span className="filter-panel__quick-action-divider">|</span>
              <button
                type="button"
                className="filter-panel__quick-action"
                onClick={handleClearAllEdges}
              >
                Clear All
              </button>
            </div>
            <div className="filter-panel__checkbox-list">
              {EDGE_TYPES.map((edgeType) => (
                <FilterCheckbox
                  key={edgeType.type}
                  checked={enabledEdgeTypes.has(edgeType.type)}
                  onChange={() => handleEdgeTypeToggle(edgeType.type)}
                  label={edgeType.label}
                />
              ))}
            </div>
          </FilterSection>

          {/* Time Range Filter */}
          <FilterSection
            title="Time Range"
            defaultExpanded={false}
            badge={hasTimeFilter ? 1 : undefined}
          >
            <div className="filter-panel__time-range">
              <div className="filter-panel__time-input-group">
                <label className="filter-panel__time-label">Start</label>
                <input
                  type="datetime-local"
                  className="filter-panel__time-input"
                  value={formatDateForInput(timeRange.start)}
                  onChange={handleStartDateChange}
                />
              </div>
              <div className="filter-panel__time-input-group">
                <label className="filter-panel__time-label">End</label>
                <input
                  type="datetime-local"
                  className="filter-panel__time-input"
                  value={formatDateForInput(timeRange.end)}
                  onChange={handleEndDateChange}
                />
              </div>
              {hasTimeFilter && (
                <button
                  type="button"
                  className="filter-panel__clear-time"
                  onClick={handleClearTimeRange}
                >
                  Clear time range
                </button>
              )}
            </div>
          </FilterSection>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
