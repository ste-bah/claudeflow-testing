/**
 * Hierarchical Layout Configuration
 *
 * Directed acyclic graph layout using Dagre algorithm.
 * Ideal for showing flow, dependencies, and tree structures.
 *
 * @module services/graph/layouts/hierarchicalLayout
 */

import type { LayoutOptions } from 'cytoscape';

/**
 * Direction options for hierarchical layout
 */
export type HierarchicalDirection = 'TB' | 'BT' | 'LR' | 'RL';

/**
 * Ranker algorithm options
 */
export type RankerAlgorithm = 'network-simplex' | 'tight-tree' | 'longest-path';

/**
 * Hierarchical layout configuration options
 */
export interface HierarchicalLayoutOptions {
  /** Layout direction: TB (top-bottom), BT (bottom-top), LR (left-right), RL (right-left) */
  direction?: HierarchicalDirection;
  /** Horizontal separation between nodes */
  nodeSep?: number;
  /** Vertical separation between ranks/levels */
  rankSep?: number;
  /** Separation between edges */
  edgeSep?: number;
  /** Ranking algorithm */
  ranker?: RankerAlgorithm;
  /** Whether to animate the layout */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Alignment of nodes within each rank */
  align?: 'UL' | 'UR' | 'DL' | 'DR' | undefined;
  /** Whether to allow compound nodes */
  acyclicer?: 'greedy' | undefined;
}

/**
 * Default hierarchical layout options
 */
export const DEFAULT_HIERARCHICAL_OPTIONS: HierarchicalLayoutOptions = {
  direction: 'TB',
  nodeSep: 50,
  rankSep: 100,
  edgeSep: 10,
  ranker: 'network-simplex',
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 50,
  align: undefined,
  acyclicer: undefined,
};

/**
 * Create hierarchical layout options for Cytoscape
 */
export function createHierarchicalLayout(
  options?: Partial<HierarchicalLayoutOptions>
): LayoutOptions {
  const mergedOptions = { ...DEFAULT_HIERARCHICAL_OPTIONS, ...options };

  return {
    name: 'dagre',
    rankDir: mergedOptions.direction,
    nodeSep: mergedOptions.nodeSep,
    rankSep: mergedOptions.rankSep,
    edgeSep: mergedOptions.edgeSep,
    ranker: mergedOptions.ranker,
    animate: mergedOptions.animate,
    animationDuration: mergedOptions.animationDuration,
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    align: mergedOptions.align,
    acyclicer: mergedOptions.acyclicer,
  } as LayoutOptions;
}

/**
 * Hierarchical layout presets for different use cases
 */
export const HIERARCHICAL_PRESETS = {
  /** Top to bottom (default) */
  topDown: createHierarchicalLayout({
    direction: 'TB',
    rankSep: 100,
    nodeSep: 50,
  }),

  /** Bottom to top */
  bottomUp: createHierarchicalLayout({
    direction: 'BT',
    rankSep: 100,
    nodeSep: 50,
  }),

  /** Left to right (horizontal flow) */
  leftRight: createHierarchicalLayout({
    direction: 'LR',
    rankSep: 120,
    nodeSep: 40,
  }),

  /** Right to left */
  rightLeft: createHierarchicalLayout({
    direction: 'RL',
    rankSep: 120,
    nodeSep: 40,
  }),

  /** Compact hierarchical layout */
  compact: createHierarchicalLayout({
    direction: 'TB',
    rankSep: 60,
    nodeSep: 30,
    edgeSep: 5,
    padding: 30,
  }),

  /** Spacious hierarchical layout */
  spacious: createHierarchicalLayout({
    direction: 'TB',
    rankSep: 150,
    nodeSep: 80,
    edgeSep: 20,
    padding: 80,
  }),
} as const;
