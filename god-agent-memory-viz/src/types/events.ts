/**
 * Application event types for God Agent Memory Visualization
 *
 * This module defines types for internal application events used
 * for communication between components and services.
 *
 * @module types/events
 */

import type { FilterState } from './filters';
import type { LayoutType, GraphData } from './graph';

// ============================================================================
// Event Types
// ============================================================================

/**
 * All application event types
 */
export type AppEventType =
  // Node interactions
  | 'NODE_CLICK'
  | 'NODE_DOUBLE_CLICK'
  | 'NODE_HOVER'
  | 'NODE_LEAVE'
  | 'NODE_DRAG_START'
  | 'NODE_DRAG'
  | 'NODE_DRAG_END'
  // Edge interactions
  | 'EDGE_CLICK'
  | 'EDGE_HOVER'
  | 'EDGE_LEAVE'
  // Canvas interactions
  | 'CANVAS_CLICK'
  | 'CANVAS_DOUBLE_CLICK'
  | 'CANVAS_PAN'
  | 'CANVAS_ZOOM'
  | 'CANVAS_CONTEXT_MENU'
  // Selection events
  | 'SELECTION_CHANGE'
  | 'SELECTION_CLEAR'
  // Filter events
  | 'FILTER_CHANGE'
  | 'FILTER_RESET'
  // Layout events
  | 'LAYOUT_CHANGE'
  | 'LAYOUT_COMPLETE'
  // Data events
  | 'DATA_LOAD_START'
  | 'DATA_LOAD_COMPLETE'
  | 'DATA_LOAD_ERROR'
  | 'DATA_REFRESH'
  // Export events
  | 'EXPORT_START'
  | 'EXPORT_PROGRESS'
  | 'EXPORT_COMPLETE'
  | 'EXPORT_ERROR'
  // Search events
  | 'SEARCH_START'
  | 'SEARCH_COMPLETE'
  | 'SEARCH_CLEAR';

// ============================================================================
// Base Event Interface
// ============================================================================

/**
 * Base application event structure
 */
export interface AppEvent<T = unknown> {
  /** Event type */
  type: AppEventType;
  /** Event payload */
  payload: T;
  /** When event occurred */
  timestamp: Date;
  /** Source component/service that emitted the event */
  source?: string;
}

// ============================================================================
// Node Event Payloads
// ============================================================================

/**
 * Payload for node click events
 */
export interface NodeClickEvent {
  /** ID of clicked node */
  nodeId: string;
  /** Click position in graph coordinates */
  position: { x: number; y: number };
  /** Original DOM mouse event */
  originalEvent: MouseEvent;
}

/**
 * Payload for node hover events
 */
export interface NodeHoverEvent {
  /** ID of hovered node */
  nodeId: string;
  /** Mouse position in graph coordinates */
  position: { x: number; y: number };
}

/**
 * Payload for node drag events
 */
export interface NodeDragEvent {
  /** ID of dragged node */
  nodeId: string;
  /** Current position during drag */
  position: { x: number; y: number };
  /** Delta from last position */
  delta: { x: number; y: number };
}

// ============================================================================
// Edge Event Payloads
// ============================================================================

/**
 * Payload for edge click events
 */
export interface EdgeClickEvent {
  /** ID of clicked edge */
  edgeId: string;
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Original DOM mouse event */
  originalEvent: MouseEvent;
}

/**
 * Payload for edge hover events
 */
export interface EdgeHoverEvent {
  /** ID of hovered edge */
  edgeId: string;
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
}

// ============================================================================
// Canvas Event Payloads
// ============================================================================

/**
 * Payload for canvas pan events
 */
export interface CanvasPanEvent {
  /** New pan offset */
  pan: { x: number; y: number };
  /** Delta from previous position */
  delta: { x: number; y: number };
}

/**
 * Payload for canvas zoom events
 */
export interface CanvasZoomEvent {
  /** New zoom level */
  zoom: number;
  /** Previous zoom level */
  previousZoom: number;
  /** Zoom center point */
  center: { x: number; y: number };
}

/**
 * Payload for canvas context menu events
 */
export interface CanvasContextMenuEvent {
  /** Screen position for context menu */
  position: { x: number; y: number };
  /** Graph position where right-click occurred */
  graphPosition: { x: number; y: number };
  /** Original DOM event */
  originalEvent: MouseEvent;
}

// ============================================================================
// Selection Event Payloads
// ============================================================================

/**
 * Payload for selection change events
 */
export interface SelectionChangeEvent {
  /** Currently selected node IDs */
  selectedNodes: string[];
  /** Currently selected edge IDs */
  selectedEdges: string[];
  /** What action caused this change */
  action: 'add' | 'remove' | 'set' | 'clear';
}

// ============================================================================
// Filter Event Payloads
// ============================================================================

/**
 * Payload for filter change events
 */
export interface FilterChangeEvent {
  /** Which filter field changed */
  field: keyof FilterState;
  /** Previous value */
  previousValue: unknown;
  /** New value */
  newValue: unknown;
}

// ============================================================================
// Layout Event Payloads
// ============================================================================

/**
 * Payload for layout change events
 */
export interface LayoutChangeEvent {
  /** New layout type */
  layout: LayoutType;
  /** Previous layout type */
  previousLayout: LayoutType;
}

/**
 * Payload for layout complete events
 */
export interface LayoutCompleteEvent {
  /** Layout type that completed */
  layout: LayoutType;
  /** Duration in milliseconds */
  duration: number;
  /** Number of nodes positioned */
  nodeCount: number;
}

// ============================================================================
// Data Event Payloads
// ============================================================================

/**
 * Payload for data load complete events
 */
export interface DataLoadCompleteEvent {
  /** Loaded graph data */
  data: GraphData;
  /** Load duration in milliseconds */
  duration: number;
}

/**
 * Payload for data load error events
 */
export interface DataLoadErrorEvent {
  /** The error that occurred */
  error: Error;
  /** Context/operation that failed */
  context: string;
}

// ============================================================================
// Export Event Payloads
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'png' | 'svg' | 'json' | 'csv';

/**
 * Payload for export start events
 */
export interface ExportStartEvent {
  /** Export format */
  format: ExportFormat;
  /** Export options */
  options?: Record<string, unknown>;
}

/**
 * Payload for export progress events
 */
export interface ExportProgressEvent {
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
}

/**
 * Payload for export complete events
 */
export interface ExportCompleteEvent {
  /** Export format */
  format: ExportFormat;
  /** File name if applicable */
  filename?: string;
  /** File size in bytes */
  size?: number;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Payload for export error events
 */
export interface ExportErrorEvent {
  /** Export format that failed */
  format: ExportFormat;
  /** The error that occurred */
  error: Error;
}

// ============================================================================
// Search Event Payloads
// ============================================================================

/**
 * Payload for search complete events
 */
export interface SearchCompleteEvent {
  /** Search query */
  query: string;
  /** Matching node IDs */
  matchingNodes: string[];
  /** Matching edge IDs */
  matchingEdges: string[];
  /** Search duration in milliseconds */
  duration: number;
}

// ============================================================================
// Event Emitter Types
// ============================================================================

/**
 * Event listener callback type
 */
export type EventListener<T = unknown> = (event: AppEvent<T>) => void;

/**
 * Unsubscribe function returned by subscribe
 */
export type Unsubscribe = () => void;

/**
 * Event emitter interface
 */
export interface EventEmitter {
  /** Subscribe to events */
  on<T>(type: AppEventType, listener: EventListener<T>): Unsubscribe;
  /** Subscribe to events (once) */
  once<T>(type: AppEventType, listener: EventListener<T>): Unsubscribe;
  /** Unsubscribe from events */
  off<T>(type: AppEventType, listener: EventListener<T>): void;
  /** Emit an event */
  emit<T>(type: AppEventType, payload: T, source?: string): void;
}
