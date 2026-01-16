/**
 * Filter types for God Agent Memory Visualization
 *
 * This module defines types for filtering, searching, and organizing
 * the visualization data.
 *
 * @module types/filters
 */

import type { EventType } from './database';
import type { NodeType, EdgeType, LayoutType } from './graph';

// ============================================================================
// Time Range
// ============================================================================

/**
 * Preset time range options
 */
export type TimePreset =
  | 'last_hour'
  | 'last_24h'
  | 'last_7d'
  | 'last_30d'
  | 'custom';

/**
 * Time range filter configuration
 */
export interface TimeRange {
  /** Start of time range, null for unbounded */
  start: Date | null;
  /** End of time range, null for unbounded */
  end: Date | null;
  /** Preset used to generate this range */
  preset?: TimePreset;
}

// ============================================================================
// Search Configuration
// ============================================================================

/**
 * Fields that can be searched
 */
export type SearchField =
  | 'label'
  | 'type'
  | 'data'
  | 'namespace'
  | 'key';

/**
 * Search match mode
 */
export type SearchMode =
  | 'contains'
  | 'exact'
  | 'startsWith'
  | 'regex';

/**
 * Search configuration
 */
export interface SearchConfig {
  /** Search query string */
  query: string;
  /** Fields to search in */
  fields: SearchField[];
  /** Match mode */
  mode: SearchMode;
  /** Case sensitive search */
  caseSensitive: boolean;
}

// ============================================================================
// Clustering
// ============================================================================

/**
 * Options for clustering/grouping nodes
 */
export type ClusterOption =
  | 'session'
  | 'agent'
  | 'namespace'
  | 'eventType'
  | 'timeWindow';

/**
 * Cluster configuration
 */
export interface ClusterConfig {
  /** What to cluster by */
  by: ClusterOption;
  /** Time window size in milliseconds (for timeWindow clustering) */
  windowSize?: number;
  /** Whether to expand clusters by default */
  expandedByDefault: boolean;
  /** Maximum nodes before auto-clustering */
  maxNodesBeforeCluster: number;
}

// ============================================================================
// Complete Filter State
// ============================================================================

/**
 * Complete filter state for the visualization
 */
export interface FilterState {
  /** Time range filter */
  timeRange: TimeRange;
  /** Selected event types to show */
  eventTypes: EventType[];
  /** Selected node types to show */
  nodeTypes: NodeType[];
  /** Selected edge types to show */
  edgeTypes: EdgeType[];
  /** Selected session IDs to show */
  sessions: string[];
  /** Selected agent IDs to show */
  agents: string[];
  /** Selected namespaces to show */
  namespaces: string[];
  /** Current search query */
  searchQuery: string;
  /** Fields to include in search */
  searchFields: SearchField[];
  /** Whether to show node labels */
  showLabels: boolean;
  /** Whether to show edges */
  showEdges: boolean;
  /** Current clustering configuration, null if disabled */
  clusterBy: ClusterOption | null;
  /** Current layout algorithm */
  layout: LayoutType;
}

// ============================================================================
// Filter Presets
// ============================================================================

/**
 * Saved filter preset
 */
export interface FilterPreset {
  /** Unique preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Partial filter state to apply */
  filters: Partial<FilterState>;
  /** When preset was created */
  createdAt: Date;
}

/**
 * Quick filter for common operations
 */
export interface QuickFilter {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon name */
  icon?: string;
  /** Function to apply the filter */
  apply: (current: FilterState) => FilterState;
}

// ============================================================================
// Filter Actions
// ============================================================================

/**
 * Actions that can be performed on filter state
 */
export type FilterAction =
  | { type: 'SET_TIME_RANGE'; payload: TimeRange }
  | { type: 'SET_EVENT_TYPES'; payload: EventType[] }
  | { type: 'TOGGLE_EVENT_TYPE'; payload: EventType }
  | { type: 'SET_NODE_TYPES'; payload: NodeType[] }
  | { type: 'TOGGLE_NODE_TYPE'; payload: NodeType }
  | { type: 'SET_EDGE_TYPES'; payload: EdgeType[] }
  | { type: 'TOGGLE_EDGE_TYPE'; payload: EdgeType }
  | { type: 'SET_SESSIONS'; payload: string[] }
  | { type: 'TOGGLE_SESSION'; payload: string }
  | { type: 'SET_AGENTS'; payload: string[] }
  | { type: 'TOGGLE_AGENT'; payload: string }
  | { type: 'SET_NAMESPACES'; payload: string[] }
  | { type: 'TOGGLE_NAMESPACE'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_FIELDS'; payload: SearchField[] }
  | { type: 'SET_SHOW_LABELS'; payload: boolean }
  | { type: 'SET_SHOW_EDGES'; payload: boolean }
  | { type: 'SET_CLUSTER_BY'; payload: ClusterOption | null }
  | { type: 'SET_LAYOUT'; payload: LayoutType }
  | { type: 'APPLY_PRESET'; payload: FilterPreset }
  | { type: 'RESET_FILTERS' };

// ============================================================================
// Default Filter State
// ============================================================================

/**
 * Default filter state factory
 */
export const createDefaultFilterState = (): FilterState => ({
  timeRange: {
    start: null,
    end: null,
    preset: undefined,
  },
  eventTypes: [],
  nodeTypes: [],
  edgeTypes: [],
  sessions: [],
  agents: [],
  namespaces: [],
  searchQuery: '',
  searchFields: ['label', 'type', 'data'],
  showLabels: true,
  showEdges: true,
  clusterBy: null,
  layout: 'force',
});

// ============================================================================
// Filter Utilities
// ============================================================================

/**
 * Check if any filters are active
 */
export const hasActiveFilters = (state: FilterState): boolean => {
  return (
    state.timeRange.start !== null ||
    state.timeRange.end !== null ||
    state.eventTypes.length > 0 ||
    state.nodeTypes.length > 0 ||
    state.edgeTypes.length > 0 ||
    state.sessions.length > 0 ||
    state.agents.length > 0 ||
    state.namespaces.length > 0 ||
    state.searchQuery.length > 0 ||
    state.clusterBy !== null
  );
};

/**
 * Count number of active filters
 */
export const countActiveFilters = (state: FilterState): number => {
  let count = 0;
  if (state.timeRange.start !== null || state.timeRange.end !== null) count++;
  if (state.eventTypes.length > 0) count++;
  if (state.nodeTypes.length > 0) count++;
  if (state.edgeTypes.length > 0) count++;
  if (state.sessions.length > 0) count++;
  if (state.agents.length > 0) count++;
  if (state.namespaces.length > 0) count++;
  if (state.searchQuery.length > 0) count++;
  if (state.clusterBy !== null) count++;
  return count;
};
