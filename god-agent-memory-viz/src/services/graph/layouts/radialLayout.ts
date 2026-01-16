/**
 * Radial Layout Configuration
 *
 * Concentric circles layout where nodes are arranged in rings.
 * Ideal for showing importance, centrality, or distance from center.
 *
 * @module services/graph/layouts/radialLayout
 */

import type { LayoutOptions, NodeSingular } from 'cytoscape';

/**
 * Function to determine which concentric level a node belongs to
 */
export type ConcentricFunction = (node: NodeSingular) => number;

/**
 * Function to determine how many nodes fit in each level
 */
export type LevelWidthFunction = (nodes: NodeSingular[]) => number;

/**
 * Radial layout configuration options
 */
export interface RadialLayoutOptions {
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Starting angle in radians (0 = 3 o'clock, default 3/2 PI = 12 o'clock) */
  startAngle?: number;
  /** How much of the circle to use (undefined = full circle) */
  sweep?: number;
  /** Whether to go clockwise */
  clockwise?: boolean;
  /** Whether levels should be equidistant */
  equidistant?: boolean;
  /** Minimum spacing between nodes */
  minNodeSpacing?: number;
  /** Whether to avoid node overlap */
  avoidOverlap?: boolean;
  /** Include node labels in dimension calculations */
  nodeDimensionsIncludeLabels?: boolean;
  /** Fixed height (undefined = auto) */
  height?: number;
  /** Fixed width (undefined = auto) */
  width?: number;
  /** Spacing factor (multiplier) */
  spacingFactor?: number;
  /** Function to determine concentric level */
  concentric?: ConcentricFunction;
  /** Function to determine level width */
  levelWidth?: LevelWidthFunction;
  /** Whether to animate the layout */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

/**
 * Default radial layout options
 */
export const DEFAULT_RADIAL_OPTIONS: RadialLayoutOptions = {
  fit: true,
  padding: 50,
  startAngle: (3 / 2) * Math.PI, // 12 o'clock
  sweep: undefined, // Full circle
  clockwise: true,
  equidistant: false,
  minNodeSpacing: 50,
  avoidOverlap: true,
  nodeDimensionsIncludeLabels: true,
  height: undefined,
  width: undefined,
  spacingFactor: 1,
  concentric: (node: NodeSingular) => node.degree(),
  levelWidth: () => 2,
  animate: true,
  animationDuration: 500,
};

/**
 * Create radial layout options for Cytoscape
 */
export function createRadialLayout(options?: Partial<RadialLayoutOptions>): LayoutOptions {
  const mergedOptions = { ...DEFAULT_RADIAL_OPTIONS, ...options };

  return {
    name: 'concentric',
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    startAngle: mergedOptions.startAngle,
    sweep: mergedOptions.sweep,
    clockwise: mergedOptions.clockwise,
    equidistant: mergedOptions.equidistant,
    minNodeSpacing: mergedOptions.minNodeSpacing,
    avoidOverlap: mergedOptions.avoidOverlap,
    nodeDimensionsIncludeLabels: mergedOptions.nodeDimensionsIncludeLabels,
    height: mergedOptions.height,
    width: mergedOptions.width,
    spacingFactor: mergedOptions.spacingFactor,
    concentric: mergedOptions.concentric,
    levelWidth: mergedOptions.levelWidth,
    animate: mergedOptions.animate,
    animationDuration: mergedOptions.animationDuration,
  } as LayoutOptions;
}

/**
 * Concentric function presets
 */
export const CONCENTRIC_FUNCTIONS = {
  /** By degree (most connected nodes in center) */
  byDegree: (node: NodeSingular) => node.degree(),

  /** By in-degree (nodes with most incoming edges in center) */
  byInDegree: (node: NodeSingular) => node.indegree(),

  /** By out-degree (nodes with most outgoing edges in center) */
  byOutDegree: (node: NodeSingular) => node.outdegree(),

  /** By node type (custom ordering) */
  byType: (typeOrder: string[]) => (node: NodeSingular) => {
    const type = node.data('type') as string;
    const index = typeOrder.indexOf(type);
    return index >= 0 ? typeOrder.length - index : 0;
  },

  /** By timestamp (newest in center) */
  byTimestamp: (node: NodeSingular) => {
    const timestamp = node.data('timestamp');
    return timestamp ? new Date(timestamp).getTime() : 0;
  },

  /** By custom data field */
  byDataField: (field: string, defaultValue = 0) => (node: NodeSingular) => {
    return (node.data(field) as number) ?? defaultValue;
  },
} as const;

/**
 * Radial layout presets for different use cases
 */
export const RADIAL_PRESETS = {
  /** Default radial layout by degree */
  default: createRadialLayout(),

  /** Radial layout optimized for showing importance */
  importance: createRadialLayout({
    concentric: CONCENTRIC_FUNCTIONS.byDegree,
    levelWidth: () => 1,
    equidistant: true,
    minNodeSpacing: 60,
  }),

  /** Half-circle layout */
  semicircle: createRadialLayout({
    sweep: Math.PI,
    startAngle: Math.PI / 2,
    minNodeSpacing: 40,
  }),

  /** Quarter-circle layout */
  quarter: createRadialLayout({
    sweep: Math.PI / 2,
    startAngle: 0,
    minNodeSpacing: 40,
  }),

  /** Compact radial layout */
  compact: createRadialLayout({
    minNodeSpacing: 30,
    spacingFactor: 0.8,
    padding: 30,
  }),

  /** Spacious radial layout */
  spacious: createRadialLayout({
    minNodeSpacing: 80,
    spacingFactor: 1.5,
    padding: 80,
  }),
} as const;
