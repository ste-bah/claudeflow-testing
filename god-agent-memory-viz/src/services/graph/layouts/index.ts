/**
 * Layout configurations index
 *
 * Re-exports all layout types, options, and factory functions.
 *
 * @module services/graph/layouts
 */

export * from './forceLayout';
export * from './hierarchicalLayout';
export * from './radialLayout';
export * from './timelineLayout';
export * from './gridLayout';
export * from './constraintLayout';

import type { LayoutType } from '@/types/graph';
import { createForceLayout, DEFAULT_FORCE_OPTIONS, type ForceLayoutOptions } from './forceLayout';
import { createHierarchicalLayout, DEFAULT_HIERARCHICAL_OPTIONS, type HierarchicalLayoutOptions } from './hierarchicalLayout';
import { createRadialLayout, DEFAULT_RADIAL_OPTIONS, type RadialLayoutOptions } from './radialLayout';
import { createTimelineLayout, DEFAULT_TIMELINE_OPTIONS, type TimelineLayoutOptions } from './timelineLayout';
import { createGridLayout, DEFAULT_GRID_OPTIONS, type GridLayoutOptions } from './gridLayout';

// Using any for layout options since plugins add properties not in base types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLayoutOptions = any;

/**
 * Map of layout type to layout creator function
 */
export const LAYOUT_CREATORS: Record<LayoutType, (options?: Record<string, unknown>) => AnyLayoutOptions> = {
  force: createForceLayout,
  hierarchical: createHierarchicalLayout,
  radial: createRadialLayout,
  timeline: createTimelineLayout,
  grid: createGridLayout,
  concentric: createRadialLayout, // Concentric uses the same as radial
};

/**
 * All layout option types union
 */
export type AllLayoutOptions =
  | ForceLayoutOptions
  | HierarchicalLayoutOptions
  | RadialLayoutOptions
  | TimelineLayoutOptions
  | GridLayoutOptions;

/**
 * Map of layout type to default options
 */
export const DEFAULT_LAYOUT_OPTIONS: Record<LayoutType, AllLayoutOptions> = {
  force: DEFAULT_FORCE_OPTIONS,
  hierarchical: DEFAULT_HIERARCHICAL_OPTIONS,
  radial: DEFAULT_RADIAL_OPTIONS,
  timeline: DEFAULT_TIMELINE_OPTIONS,
  grid: DEFAULT_GRID_OPTIONS,
  concentric: DEFAULT_RADIAL_OPTIONS,
};

/**
 * Create layout options for a given layout type
 */
export function createLayoutOptions(
  layoutType: LayoutType,
  customOptions?: Record<string, unknown>
): AnyLayoutOptions {
  const creator = LAYOUT_CREATORS[layoutType];
  if (!creator) {
    // Fallback to force layout
    return createForceLayout(customOptions);
  }
  return creator(customOptions);
}

/**
 * Get default options for a layout type
 */
export function getDefaultLayoutOptions(layoutType: LayoutType): AllLayoutOptions {
  return DEFAULT_LAYOUT_OPTIONS[layoutType] ?? DEFAULT_FORCE_OPTIONS;
}

/**
 * Layout metadata for UI display
 */
export interface LayoutMetadata {
  type: LayoutType;
  name: string;
  description: string;
  icon: string;
  bestFor: string[];
}

/**
 * Metadata for all available layouts
 */
export const LAYOUT_METADATA: LayoutMetadata[] = [
  {
    type: 'force',
    name: 'Force-Directed',
    description: 'Physics-based spring layout for organic clustering',
    icon: 'scatter-chart',
    bestFor: ['exploring relationships', 'finding clusters', 'general purpose'],
  },
  {
    type: 'hierarchical',
    name: 'Hierarchical',
    description: 'Top-to-bottom tree layout for directed graphs',
    icon: 'git-branch',
    bestFor: ['flow diagrams', 'dependencies', 'tree structures'],
  },
  {
    type: 'radial',
    name: 'Radial',
    description: 'Concentric circles based on importance',
    icon: 'target',
    bestFor: ['centrality', 'importance', 'hub-and-spoke'],
  },
  {
    type: 'timeline',
    name: 'Timeline',
    description: 'Horizontal arrangement by timestamp',
    icon: 'calendar',
    bestFor: ['temporal sequences', 'event history', 'chronology'],
  },
  {
    type: 'grid',
    name: 'Grid',
    description: 'Uniform grid arrangement for comparison',
    icon: 'grid-3x3',
    bestFor: ['comparison', 'collections', 'uniform display'],
  },
  {
    type: 'concentric',
    name: 'Concentric',
    description: 'Nodes arranged in rings by degree',
    icon: 'circle-dot',
    bestFor: ['degree analysis', 'connectivity patterns'],
  },
];

/**
 * Get layout metadata by type
 */
export function getLayoutMetadata(layoutType: LayoutType): LayoutMetadata | undefined {
  return LAYOUT_METADATA.find((m) => m.type === layoutType);
}

/**
 * Get recommended layout for a use case
 */
export function getRecommendedLayout(useCase: string): LayoutType {
  const useCaseLower = useCase.toLowerCase();

  if (useCaseLower.includes('time') || useCaseLower.includes('temporal') || useCaseLower.includes('history')) {
    return 'timeline';
  }
  if (useCaseLower.includes('hierarchy') || useCaseLower.includes('tree') || useCaseLower.includes('flow')) {
    return 'hierarchical';
  }
  if (useCaseLower.includes('importance') || useCaseLower.includes('central') || useCaseLower.includes('hub')) {
    return 'radial';
  }
  if (useCaseLower.includes('compare') || useCaseLower.includes('grid') || useCaseLower.includes('uniform')) {
    return 'grid';
  }
  if (useCaseLower.includes('cluster') || useCaseLower.includes('organic') || useCaseLower.includes('explore')) {
    return 'force';
  }

  // Default to force-directed
  return 'force';
}
