/**
 * Default values and configuration limits for God Agent Memory Visualization
 *
 * Centralizes all default states, performance limits, animation durations,
 * and other configurable defaults.
 *
 * @module constants/defaults
 */

import type { FilterState, SearchField } from '@/types/filters';
import type { Theme } from '@/types/ui';
import type { LayoutType } from '@/types/graph';
import { DEFAULT_LAYOUT, type LayoutName } from './layouts';

/**
 * Default filter state for the visualization
 */
export const DEFAULT_FILTER_STATE: Omit<FilterState, 'timeRange' | 'layout'> & {
  timeRange: { start: null; end: null };
  layout: LayoutType;
  routes: string[];
  minConfidence: number;
  statuses: string[];
  showOnlyConnected: boolean;
  maxNodes: number;
} = {
  nodeTypes: [],
  edgeTypes: [],
  timeRange: { start: null, end: null },
  eventTypes: [],
  sessions: [],
  agents: [],
  namespaces: [],
  routes: [],
  searchQuery: '',
  searchFields: ['label', 'type', 'data'] as SearchField[],
  minConfidence: 0,
  statuses: [],
  showOnlyConnected: false,
  maxNodes: 1000,
  showLabels: true,
  showEdges: true,
  clusterBy: null,
  layout: 'force',
};

/**
 * Default UI state settings
 */
export const DEFAULT_UI_STATE = {
  theme: 'system' as Theme,
  layout: DEFAULT_LAYOUT as LayoutName,
  sidebarOpen: true,
  detailsPanelOpen: true,
  filterPanelOpen: true,
  miniMapVisible: true,
  tooltipsEnabled: true,
  animationsEnabled: true,
  highContrastMode: false,
  compactMode: false,
} as const;

/**
 * Performance limits to prevent browser lockup
 */
export const PERFORMANCE_LIMITS = {
  /** Default maximum nodes to render */
  maxNodesDefault: 1000,
  /** High performance mode maximum nodes */
  maxNodesHigh: 5000,
  /** Default maximum edges to render */
  maxEdgesDefault: 5000,
  /** High performance mode maximum edges */
  maxEdgesHigh: 25000,
  /** Warning threshold (percentage of max) */
  warningThreshold: 0.8,
  /** Critical threshold (percentage of max) */
  criticalThreshold: 0.95,
  /** Target frames per second */
  targetFPS: 30,
  /** Minimum acceptable FPS */
  minFPS: 15,
  /** Batch size for progressive rendering */
  batchSize: 100,
  /** Viewport culling margin in pixels */
  cullingMargin: 200,
} as const;

/**
 * Animation duration presets in milliseconds
 */
export const ANIMATION_DURATIONS = {
  /** No animation */
  instant: 0,
  /** Quick transitions (hover, focus) */
  fast: 150,
  /** Standard transitions (panel open/close) */
  normal: 300,
  /** Slow transitions (major layout changes) */
  slow: 500,
  /** Graph layout animation */
  layout: 500,
  /** Page transitions */
  page: 200,
} as const;

/**
 * Debounce delays for various operations in milliseconds
 */
export const DEBOUNCE_DELAYS = {
  /** Search input debounce */
  search: 300,
  /** Filter changes debounce */
  filter: 150,
  /** Window resize debounce */
  resize: 100,
  /** Scroll event debounce */
  scroll: 50,
  /** Graph pan/zoom debounce */
  viewport: 16,
  /** Database query debounce */
  query: 250,
} as const;

/**
 * Pagination settings for large datasets
 */
export const PAGINATION = {
  /** Default number of items per page */
  defaultPageSize: 50,
  /** Available page size options */
  pageSizeOptions: [25, 50, 100, 200] as const,
  /** Maximum allowed page size */
  maxPageSize: 500,
  /** Number of page buttons to show */
  visiblePages: 5,
} as const;

/**
 * Zoom level limits for the graph viewport
 */
export const ZOOM_LIMITS = {
  /** Minimum zoom level */
  min: 0.1,
  /** Maximum zoom level */
  max: 4,
  /** Default zoom level */
  default: 1,
  /** Zoom step for button controls */
  step: 0.2,
  /** Zoom sensitivity for scroll */
  sensitivity: 0.1,
} as const;

/**
 * Node size defaults
 */
export const NODE_SIZES = {
  /** Default node width */
  defaultWidth: 150,
  /** Default node height */
  defaultHeight: 40,
  /** Minimum node width */
  minWidth: 80,
  /** Minimum node height */
  minHeight: 30,
  /** Maximum node width */
  maxWidth: 300,
  /** Maximum node height */
  maxHeight: 100,
  /** Label font size */
  labelFontSize: 12,
} as const;

/**
 * Edge style defaults
 */
export const EDGE_DEFAULTS = {
  /** Default edge width */
  width: 2,
  /** Selected edge width */
  selectedWidth: 3,
  /** Default opacity */
  opacity: 0.7,
  /** Default curve style */
  curveStyle: 'bezier' as const,
  /** Default arrow shape */
  arrowShape: 'triangle' as const,
} as const;

/**
 * Sidebar dimensions
 */
export const SIDEBAR_DIMENSIONS = {
  /** Default width */
  defaultWidth: 320,
  /** Minimum width */
  minWidth: 240,
  /** Maximum width */
  maxWidth: 600,
  /** Collapsed width */
  collapsedWidth: 0,
} as const;

/**
 * Local storage keys for persistence
 */
export const STORAGE_KEYS = {
  theme: 'god-agent-viz-theme',
  layout: 'god-agent-viz-layout',
  filters: 'god-agent-viz-filters',
  sidebarWidth: 'god-agent-viz-sidebar-width',
  preferences: 'god-agent-viz-preferences',
} as const;

/**
 * Performance thresholds for large data handling
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Chunk size for progressive loading */
  chunkSize: 100,
  /** Maximum nodes before showing performance warning */
  maxNodesBeforeWarning: 2000,
  /** Maximum edges before showing performance warning */
  maxEdgesBeforeWarning: 5000,
  /** Delay between chunks in milliseconds */
  chunkDelayMs: 10,
} as const;

/**
 * Data limits for queries and loading
 */
export const DATA_LIMITS = {
  /** Default page size for queries */
  defaultPageSize: 100,
  /** Maximum page size allowed */
  maxPageSize: 1000,
  /** Maximum items to load at once */
  maxBatchSize: 500,
} as const;
