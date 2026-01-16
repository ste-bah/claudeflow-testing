/**
 * Graph types for God Agent Memory Visualization
 *
 * This module defines types for graph nodes, edges, layouts, and visualization.
 * Node and edge types conform to the constitution specification.
 *
 * @module types/graph
 */

import type { EventType } from './database';

// ============================================================================
// Node Types (per Constitution)
// ============================================================================

/**
 * Node types in the visualization graph
 * These match the constitution specification exactly
 */
export type NodeType =
  | 'trajectory'
  | 'pattern'
  | 'episode'
  | 'feedback'
  | 'reasoning_step'
  | 'checkpoint';

/**
 * Node shape options for visual styling
 */
export type NodeShape =
  | 'ellipse'
  | 'rectangle'
  | 'roundrectangle'
  | 'diamond'
  | 'hexagon'
  | 'octagon'
  | 'star';

// ============================================================================
// Edge Types (per Constitution)
// ============================================================================

/**
 * Edge types representing relationships between nodes
 * These match the constitution specification exactly
 */
export type EdgeType =
  | 'uses_pattern'
  | 'creates_pattern'
  | 'linked_to'
  | 'informed_by_feedback'
  | 'belongs_to_route'
  | 'has_step'
  | 'has_checkpoint';

// ============================================================================
// Position and Geometry
// ============================================================================

/**
 * 2D position coordinates
 */
export interface Position {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
}

/**
 * Bounding box for region calculations
 */
export interface BoundingBox {
  /** Left edge x coordinate */
  x1: number;
  /** Top edge y coordinate */
  y1: number;
  /** Right edge x coordinate */
  x2: number;
  /** Bottom edge y coordinate */
  y2: number;
  /** Box width (x2 - x1) */
  width: number;
  /** Box height (y2 - y1) */
  height: number;
}

// ============================================================================
// Node Definitions
// ============================================================================

/**
 * Data payload for graph nodes
 */
export interface NodeData {
  /** Timestamp associated with this node */
  timestamp?: Date;
  /** Event type if derived from an event */
  eventType?: EventType;
  /** Source event ID */
  eventId?: number;
  /** Associated session ID */
  sessionId?: string;
  /** Number of events in this node (for grouped nodes) */
  eventCount?: number;
  /** Associated agent ID */
  agentId?: string;
  /** Agent type/role */
  agentType?: string;
  /** Memory key if this is a memory node */
  memoryKey?: string;
  /** Memory namespace */
  namespace?: string;
  /** Access count for memory nodes */
  accessCount?: number;
  /** Raw underlying data */
  raw?: unknown;
}

/**
 * Visual style properties for nodes
 */
export interface NodeStyle {
  /** Background/fill color */
  backgroundColor?: string;
  /** Border color */
  borderColor?: string;
  /** Border width in pixels */
  borderWidth?: number;
  /** Node width in pixels */
  width?: number;
  /** Node height in pixels */
  height?: number;
  /** Node shape */
  shape?: NodeShape;
  /** Opacity (0-1) */
  opacity?: number;
}

/**
 * Complete graph node definition
 */
export interface GraphNode {
  /** Unique node identifier */
  id: string;
  /** Node type (per constitution) */
  type: NodeType;
  /** Display label */
  label: string;
  /** Node data payload */
  data: NodeData;
  /** Position in graph space */
  position?: Position;
  /** Visual styling */
  style?: NodeStyle;
}

// ============================================================================
// Edge Definitions
// ============================================================================

/**
 * Data payload for graph edges
 */
export interface EdgeData {
  /** Edge weight for layout algorithms */
  weight?: number;
  /** Timestamp of the relationship */
  timestamp?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Visual style properties for edges
 */
export interface EdgeStyle {
  /** Line/stroke color */
  lineColor?: string;
  /** Line style */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Line width in pixels */
  width?: number;
  /** Opacity (0-1) */
  opacity?: number;
  /** Curve style for rendering */
  curveStyle?: 'bezier' | 'straight' | 'segments';
  /** Arrow shape at target end */
  targetArrowShape?: 'triangle' | 'circle' | 'none';
}

/**
 * Complete graph edge definition
 */
export interface GraphEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type (per constitution) */
  type: EdgeType;
  /** Optional display label */
  label?: string;
  /** Edge data payload */
  data?: EdgeData;
  /** Visual styling */
  style?: EdgeStyle;
}

// ============================================================================
// Graph Data Structure
// ============================================================================

/**
 * Metadata about the graph
 */
export interface GraphMetadata {
  /** Total number of nodes */
  nodeCount: number;
  /** Total number of edges */
  edgeCount: number;
  /** When this graph data was generated */
  generatedAt: Date;
  /** Filters used to generate this graph */
  filters?: unknown;
}

/**
 * Complete graph data structure
 */
export interface GraphData {
  /** All nodes in the graph */
  nodes: GraphNode[];
  /** All edges in the graph */
  edges: GraphEdge[];
  /** Graph metadata */
  metadata?: GraphMetadata;
}

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Available layout algorithms
 */
export type LayoutType =
  | 'force'
  | 'hierarchical'
  | 'radial'
  | 'timeline'
  | 'grid'
  | 'concentric';

/**
 * Layout algorithm options
 */
export interface LayoutOptions {
  /** Layout algorithm name (for Cytoscape.js compatibility) */
  name?: string;
  /** Spring length for force-directed layouts */
  springLength?: number;
  /** Spring coefficient for force-directed layouts */
  springCoeff?: number;
  /** Gravity strength */
  gravity?: number;
  /** Drag coefficient */
  dragCoeff?: number;
  /** Direction for hierarchical layouts */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Vertical spacing between levels */
  levelSeparation?: number;
  /** Horizontal spacing between nodes */
  nodeSeparation?: number;
  /** Spacing between nodes (general) */
  nodeSpacing?: number;
  /** Ideal edge length */
  edgeLength?: number;
  /** Radius for radial/concentric layouts */
  radius?: number;
  /** Starting angle in radians */
  startAngle?: number;
  /** Sweep angle in radians */
  sweep?: number;
  /** Field to use for timeline ordering */
  timeField?: string;
  /** Field to use for grouping nodes */
  groupBy?: string;
  /** Whether to animate layout transitions */
  animate?: boolean;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Whether to fit graph to viewport after layout */
  fit?: boolean;
  /** Padding around graph when fitting */
  padding?: number;
}

/**
 * Complete layout configuration
 */
export interface LayoutConfig {
  /** Layout algorithm type */
  type: LayoutType;
  /** Algorithm-specific options */
  options: LayoutOptions;
}

// ============================================================================
// Viewport State
// ============================================================================

/**
 * Current viewport state (store-friendly version)
 */
export interface ViewportState {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Current pan offset */
  pan: Position;
  /** Minimum allowed zoom level */
  minZoom: number;
  /** Maximum allowed zoom level */
  maxZoom: number;
}

/**
 * Current viewport state (with bounds - for Cytoscape integration)
 */
export interface Viewport {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Current pan offset */
  pan: Position;
  /** Visible bounding box */
  bounds: BoundingBox;
}

// ============================================================================
// Graph Statistics
// ============================================================================

/**
 * Statistics about the current graph
 */
export interface GraphStats {
  /** Nodes grouped by type */
  nodesByType: Record<NodeType, number>;
  /** Edges grouped by type */
  edgesByType: Record<EdgeType, number>;
  /** Average node degree */
  averageDegree: number;
  /** Graph density */
  density: number;
  /** Number of connected components */
  connectedComponents: number;
}
