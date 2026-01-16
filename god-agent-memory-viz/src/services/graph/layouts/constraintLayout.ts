/**
 * Constraint-Based Layout Configuration
 *
 * Layout using WebCola for constraint-based positioning.
 * Ideal for grouped data, avoiding overlaps, and flow preservation.
 *
 * @module services/graph/layouts/constraintLayout
 */

import type { NodeSingular } from 'cytoscape';

// Using any for layout options since cola plugin adds properties not in base types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LayoutOptions = any;

/**
 * Alignment constraint for cola layout
 */
export interface AlignmentConstraint {
  type: 'alignment';
  axis: 'x' | 'y';
  nodeIds: string[];
  offset?: number;
}

/**
 * Relative position constraint
 */
export interface RelativeConstraint {
  type: 'relative';
  left: string;
  right: string;
  gap?: number;
}

/**
 * Constraint types
 */
export type LayoutConstraint = AlignmentConstraint | RelativeConstraint;

/**
 * Constraint-based layout configuration options
 */
export interface ConstraintLayoutOptions {
  /** Whether to animate the layout */
  animate?: boolean;
  /** Maximum simulation time in ms */
  maxSimulationTime?: number;
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Include node labels in dimension calculations */
  nodeDimensionsIncludeLabels?: boolean;
  /** Whether to randomize initial positions */
  randomize?: boolean;
  /** Whether to avoid node overlap */
  avoidOverlap?: boolean;
  /** Whether to handle disconnected components */
  handleDisconnected?: boolean;
  /** Convergence threshold for stopping simulation */
  convergenceThreshold?: number;
  /** Minimum spacing between nodes */
  nodeSpacing?: number;
  /** Function to get ideal edge length */
  edgeLength?: number | ((edge: { data: (key: string) => unknown }) => number);
  /** Whether to use symmetric diff edge lengths */
  edgeSymDiffLength?: number;
  /** Whether to use Jaccard edge lengths */
  edgeJaccardLength?: number;
  /** Alignment constraints */
  alignment?: { horizontal?: string[][]; vertical?: string[][] };
  /** Gap between nodes in alignment */
  gapInequalities?: Array<{
    axis: 'x' | 'y';
    left: string;
    right: string;
    gap: number;
  }>;
  /** Flow direction for edge routing */
  flow?: { axis: 'x' | 'y'; minSeparation: number };
  /** Group constraints */
  groups?: Array<{
    nodeIds: string[];
    padding?: number;
  }>;
}

/**
 * Default constraint layout options
 */
export const DEFAULT_CONSTRAINT_OPTIONS: ConstraintLayoutOptions = {
  animate: true,
  maxSimulationTime: 2000,
  fit: true,
  padding: 50,
  nodeDimensionsIncludeLabels: true,
  randomize: false,
  avoidOverlap: true,
  handleDisconnected: true,
  convergenceThreshold: 0.01,
  nodeSpacing: 20,
  edgeLength: undefined,
  edgeSymDiffLength: undefined,
  edgeJaccardLength: undefined,
  alignment: undefined,
  gapInequalities: undefined,
  flow: undefined,
  groups: undefined,
};

/**
 * Create constraint layout options for Cytoscape
 */
export function createConstraintLayout(
  options?: Partial<ConstraintLayoutOptions>
): LayoutOptions {
  const mergedOptions = { ...DEFAULT_CONSTRAINT_OPTIONS, ...options };

  const layoutOptions: LayoutOptions = {
    name: 'cola',
    animate: mergedOptions.animate,
    maxSimulationTime: mergedOptions.maxSimulationTime,
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    nodeDimensionsIncludeLabels: mergedOptions.nodeDimensionsIncludeLabels,
    randomize: mergedOptions.randomize,
    avoidOverlap: mergedOptions.avoidOverlap,
    handleDisconnected: mergedOptions.handleDisconnected,
    convergenceThreshold: mergedOptions.convergenceThreshold,
    nodeSpacing: () => mergedOptions.nodeSpacing!,
  };

  // Add edge length function if specified
  if (mergedOptions.edgeLength !== undefined) {
    if (typeof mergedOptions.edgeLength === 'number') {
      const length = mergedOptions.edgeLength;
      layoutOptions.edgeLength = () => length;
    } else {
      layoutOptions.edgeLength = mergedOptions.edgeLength;
    }
  }

  if (mergedOptions.edgeSymDiffLength !== undefined) {
    layoutOptions.edgeSymDiffLength = mergedOptions.edgeSymDiffLength;
  }

  if (mergedOptions.edgeJaccardLength !== undefined) {
    layoutOptions.edgeJaccardLength = mergedOptions.edgeJaccardLength;
  }

  if (mergedOptions.flow) {
    layoutOptions.flow = mergedOptions.flow;
  }

  if (mergedOptions.alignment) {
    layoutOptions.alignment = mergedOptions.alignment;
  }

  if (mergedOptions.gapInequalities) {
    layoutOptions.gapInequalities = mergedOptions.gapInequalities;
  }

  return layoutOptions;
}

/**
 * Create alignment constraints for nodes
 */
export function createAlignmentConstraint(
  axis: 'x' | 'y',
  nodeIds: string[]
): { horizontal?: string[][]; vertical?: string[][] } {
  if (axis === 'y') {
    // Horizontal alignment (same y value)
    return { horizontal: [nodeIds] };
  } else {
    // Vertical alignment (same x value)
    return { vertical: [nodeIds] };
  }
}

/**
 * Create gap constraint between nodes
 */
export function createGapConstraint(
  axis: 'x' | 'y',
  leftNodeId: string,
  rightNodeId: string,
  gap: number
): { axis: 'x' | 'y'; left: string; right: string; gap: number } {
  return {
    axis,
    left: leftNodeId,
    right: rightNodeId,
    gap,
  };
}

/**
 * Constraint layout presets for different use cases
 */
export const CONSTRAINT_PRESETS = {
  /** Default constraint layout */
  default: createConstraintLayout(),

  /** Fast constraint layout for interactive use */
  fast: createConstraintLayout({
    maxSimulationTime: 500,
    convergenceThreshold: 0.1,
    animate: true,
  }),

  /** High quality constraint layout */
  quality: createConstraintLayout({
    maxSimulationTime: 5000,
    convergenceThreshold: 0.001,
    nodeSpacing: 30,
  }),

  /** Flow layout (left to right) */
  flowLR: createConstraintLayout({
    flow: { axis: 'x', minSeparation: 80 },
    edgeLength: 120,
  }),

  /** Flow layout (top to bottom) */
  flowTB: createConstraintLayout({
    flow: { axis: 'y', minSeparation: 80 },
    edgeLength: 120,
  }),

  /** Clustered layout with more space */
  clustered: createConstraintLayout({
    nodeSpacing: 40,
    avoidOverlap: true,
    handleDisconnected: true,
    edgeLength: 150,
  }),

  /** Compact constraint layout */
  compact: createConstraintLayout({
    nodeSpacing: 10,
    padding: 30,
    edgeLength: 60,
  }),
} as const;

/**
 * Build constraints from node data
 */
export function buildConstraintsFromData(
  nodes: NodeSingular[],
  groupByField: string
): { alignment: { horizontal: string[][] }; gapInequalities: Array<{ axis: 'x' | 'y'; left: string; right: string; gap: number }> } {
  // Group nodes by field value
  const groups = new Map<string, string[]>();

  nodes.forEach((node) => {
    const value = (node.data(groupByField) as string) ?? 'default';
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(node.id());
  });

  // Create horizontal alignment for each group
  const horizontalAlignments: string[][] = [];
  groups.forEach((nodeIds) => {
    if (nodeIds.length > 1) {
      horizontalAlignments.push(nodeIds);
    }
  });

  // Create gap constraints between groups
  const gapInequalities: Array<{ axis: 'x' | 'y'; left: string; right: string; gap: number }> = [];
  const groupKeys = Array.from(groups.keys());

  for (let i = 0; i < groupKeys.length - 1; i++) {
    const currentGroup = groups.get(groupKeys[i])!;
    const nextGroup = groups.get(groupKeys[i + 1])!;

    // Add gap between last node of current group and first node of next group
    if (currentGroup.length > 0 && nextGroup.length > 0) {
      gapInequalities.push({
        axis: 'y',
        left: currentGroup[currentGroup.length - 1],
        right: nextGroup[0],
        gap: 100,
      });
    }
  }

  return {
    alignment: { horizontal: horizontalAlignments },
    gapInequalities,
  };
}
