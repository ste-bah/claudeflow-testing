/**
 * Grid Layout Configuration
 *
 * Simple grid arrangement for uniform node display.
 * Ideal for comparing items or showing collections.
 *
 * @module services/graph/layouts/gridLayout
 */

import type { LayoutOptions, NodeSingular } from 'cytoscape';

/**
 * Sort function type for grid layout
 */
export type GridSortFunction = (a: NodeSingular, b: NodeSingular) => number;

/**
 * Position function type for grid layout
 */
export type GridPositionFunction = (node: NodeSingular, i: number) => { row: number; col: number };

/**
 * Grid layout configuration options
 */
export interface GridLayoutOptions {
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Whether to avoid node overlap */
  avoidOverlap?: boolean;
  /** Padding between overlapping nodes */
  avoidOverlapPadding?: number;
  /** Include node labels in dimension calculations */
  nodeDimensionsIncludeLabels?: boolean;
  /** Spacing factor (multiplier) */
  spacingFactor?: number;
  /** Whether to condense into minimum space */
  condense?: boolean;
  /** Number of rows (undefined = auto) */
  rows?: number;
  /** Number of columns (undefined = auto) */
  cols?: number;
  /** Sort function for node ordering */
  sort?: GridSortFunction;
  /** Position function for custom placement */
  position?: GridPositionFunction;
  /** Whether to animate the layout */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Bounding box for the layout */
  boundingBox?: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Default grid layout options
 */
export const DEFAULT_GRID_OPTIONS: GridLayoutOptions = {
  fit: true,
  padding: 50,
  avoidOverlap: true,
  avoidOverlapPadding: 10,
  nodeDimensionsIncludeLabels: true,
  spacingFactor: 1,
  condense: false,
  rows: undefined,
  cols: undefined,
  sort: undefined,
  position: undefined,
  animate: true,
  animationDuration: 500,
  boundingBox: undefined,
};

/**
 * Create grid layout options for Cytoscape
 */
export function createGridLayout(options?: Partial<GridLayoutOptions>): LayoutOptions {
  const mergedOptions = { ...DEFAULT_GRID_OPTIONS, ...options };

  return {
    name: 'grid',
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    avoidOverlap: mergedOptions.avoidOverlap,
    avoidOverlapPadding: mergedOptions.avoidOverlapPadding,
    nodeDimensionsIncludeLabels: mergedOptions.nodeDimensionsIncludeLabels,
    spacingFactor: mergedOptions.spacingFactor,
    condense: mergedOptions.condense,
    rows: mergedOptions.rows,
    cols: mergedOptions.cols,
    sort: mergedOptions.sort,
    position: mergedOptions.position,
    animate: mergedOptions.animate,
    animationDuration: mergedOptions.animationDuration,
    boundingBox: mergedOptions.boundingBox,
  } as LayoutOptions;
}

/**
 * Sort function presets for grid layout
 */
export const GRID_SORT_FUNCTIONS = {
  /** Sort by node ID alphabetically */
  byId: (a: NodeSingular, b: NodeSingular) => a.id().localeCompare(b.id()),

  /** Sort by label alphabetically */
  byLabel: (a: NodeSingular, b: NodeSingular) => {
    const labelA = (a.data('label') as string) ?? a.id();
    const labelB = (b.data('label') as string) ?? b.id();
    return labelA.localeCompare(labelB);
  },

  /** Sort by type */
  byType: (a: NodeSingular, b: NodeSingular) => {
    const typeA = (a.data('type') as string) ?? '';
    const typeB = (b.data('type') as string) ?? '';
    return typeA.localeCompare(typeB);
  },

  /** Sort by timestamp (oldest first) */
  byTimestamp: (a: NodeSingular, b: NodeSingular) => {
    const tsA = a.data('timestamp');
    const tsB = b.data('timestamp');
    if (!tsA && !tsB) return 0;
    if (!tsA) return 1;
    if (!tsB) return -1;
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  },

  /** Sort by timestamp (newest first) */
  byTimestampDesc: (a: NodeSingular, b: NodeSingular) => {
    const tsA = a.data('timestamp');
    const tsB = b.data('timestamp');
    if (!tsA && !tsB) return 0;
    if (!tsA) return 1;
    if (!tsB) return -1;
    return new Date(tsB).getTime() - new Date(tsA).getTime();
  },

  /** Sort by degree (most connected first) */
  byDegree: (a: NodeSingular, b: NodeSingular) => b.degree() - a.degree(),

  /** Sort by custom data field */
  byDataField: (field: string, ascending = true) => (a: NodeSingular, b: NodeSingular) => {
    const valueA = a.data(field);
    const valueB = b.data(field);

    if (valueA === undefined && valueB === undefined) return 0;
    if (valueA === undefined) return 1;
    if (valueB === undefined) return -1;

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    }

    const numA = Number(valueA);
    const numB = Number(valueB);
    return ascending ? numA - numB : numB - numA;
  },
} as const;

/**
 * Grid layout presets for different use cases
 */
export const GRID_PRESETS = {
  /** Default grid layout */
  default: createGridLayout(),

  /** Single row layout */
  singleRow: createGridLayout({
    rows: 1,
    condense: true,
    spacingFactor: 1.2,
  }),

  /** Single column layout */
  singleColumn: createGridLayout({
    cols: 1,
    condense: true,
    spacingFactor: 1.2,
  }),

  /** Compact grid for many items */
  compact: createGridLayout({
    condense: true,
    spacingFactor: 0.8,
    avoidOverlapPadding: 5,
    padding: 30,
  }),

  /** Spacious grid for fewer items */
  spacious: createGridLayout({
    spacingFactor: 1.5,
    avoidOverlapPadding: 20,
    padding: 80,
  }),

  /** Square grid (equal rows and cols) */
  square: (nodeCount: number): LayoutOptions => {
    const side = Math.ceil(Math.sqrt(nodeCount));
    return createGridLayout({
      rows: side,
      cols: side,
      condense: true,
    });
  },
} as const;

/**
 * Create a grouped grid layout
 * Arranges nodes in groups with their own grids
 */
export function createGroupedGridLayout(
  groupBy: string,
  options?: Partial<GridLayoutOptions>
): LayoutOptions {
  const baseOptions = { ...DEFAULT_GRID_OPTIONS, ...options };

  // Sort by group first, then by any additional sort function
  const sort = (a: NodeSingular, b: NodeSingular) => {
    const groupA = (a.data(groupBy) as string) ?? '';
    const groupB = (b.data(groupBy) as string) ?? '';

    if (groupA !== groupB) {
      return groupA.localeCompare(groupB);
    }

    // Apply secondary sort if provided
    if (baseOptions.sort) {
      return baseOptions.sort(a, b);
    }

    return 0;
  };

  return createGridLayout({
    ...baseOptions,
    sort,
  });
}
