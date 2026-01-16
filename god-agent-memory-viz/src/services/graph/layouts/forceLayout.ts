/**
 * Force-Directed Layout Configuration
 *
 * Physics-based spring layout using fCoSE (fast Compound Spring Embedder).
 * Ideal for exploring organic relationships and clusters.
 *
 * @module services/graph/layouts/forceLayout
 */

import type { LayoutOptions } from 'cytoscape';

/**
 * Force layout configuration options
 */
export interface ForceLayoutOptions {
  /** Quality preset: 'draft' | 'default' | 'proof' */
  quality?: 'draft' | 'default' | 'proof';
  /** Whether to randomize initial positions */
  randomize?: boolean;
  /** Whether to animate the layout */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Include node labels in dimension calculations */
  nodeDimensionsIncludeLabels?: boolean;
  /** Node repulsion force (higher = more spread out) */
  nodeRepulsion?: number;
  /** Ideal edge length */
  idealEdgeLength?: number;
  /** Edge elasticity (spring constant) */
  edgeElasticity?: number;
  /** Nesting factor for compound nodes */
  nestingFactor?: number;
  /** Gravity towards center */
  gravity?: number;
  /** Number of iterations */
  numIter?: number;
  /** Whether to tile disconnected components */
  tile?: boolean;
  /** Tile padding between components */
  tilingPaddingVertical?: number;
  tilingPaddingHorizontal?: number;
}

/**
 * Default force layout options
 */
export const DEFAULT_FORCE_OPTIONS: ForceLayoutOptions = {
  quality: 'default',
  randomize: false,
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 50,
  nodeDimensionsIncludeLabels: true,
  nodeRepulsion: 4500,
  idealEdgeLength: 100,
  edgeElasticity: 0.45,
  nestingFactor: 0.1,
  gravity: 0.25,
  numIter: 2500,
  tile: true,
  tilingPaddingVertical: 10,
  tilingPaddingHorizontal: 10,
};

/**
 * Create force layout options for Cytoscape
 */
export function createForceLayout(options?: Partial<ForceLayoutOptions>): LayoutOptions {
  const mergedOptions = { ...DEFAULT_FORCE_OPTIONS, ...options };

  return {
    name: 'fcose',
    quality: mergedOptions.quality,
    randomize: mergedOptions.randomize,
    animate: mergedOptions.animate,
    animationDuration: mergedOptions.animationDuration,
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    nodeDimensionsIncludeLabels: mergedOptions.nodeDimensionsIncludeLabels,
    nodeRepulsion: () => mergedOptions.nodeRepulsion!,
    idealEdgeLength: () => mergedOptions.idealEdgeLength!,
    edgeElasticity: () => mergedOptions.edgeElasticity!,
    nestingFactor: mergedOptions.nestingFactor,
    gravity: mergedOptions.gravity,
    numIter: mergedOptions.numIter,
    tile: mergedOptions.tile,
    tilingPaddingVertical: mergedOptions.tilingPaddingVertical,
    tilingPaddingHorizontal: mergedOptions.tilingPaddingHorizontal,
  } as LayoutOptions;
}

/**
 * Force layout presets for different use cases
 */
export const FORCE_PRESETS = {
  /** Compact layout for small graphs */
  compact: createForceLayout({
    idealEdgeLength: 60,
    nodeRepulsion: 3000,
    gravity: 0.5,
    padding: 30,
  }),

  /** Spread out layout for large graphs */
  spacious: createForceLayout({
    idealEdgeLength: 150,
    nodeRepulsion: 6000,
    gravity: 0.15,
    padding: 80,
  }),

  /** Quick draft layout */
  draft: createForceLayout({
    quality: 'draft',
    numIter: 500,
    animationDuration: 200,
  }),

  /** High quality layout for final presentation */
  presentation: createForceLayout({
    quality: 'proof',
    numIter: 5000,
    animationDuration: 800,
    padding: 100,
  }),
} as const;
