/**
 * Timeline Layout Configuration
 *
 * Horizontal layout arranged by timestamp for showing temporal sequences.
 * Uses dagre with LR direction and custom sorting.
 *
 * @module services/graph/layouts/timelineLayout
 */

import type { LayoutOptions, NodeSingular, Collection } from 'cytoscape';

/**
 * Timeline layout configuration options
 */
export interface TimelineLayoutOptions {
  /** Field name containing timestamp data */
  timestampField?: string;
  /** Horizontal spacing between time points */
  nodeSpacing?: number;
  /** Vertical spacing between parallel tracks */
  trackSpacing?: number;
  /** Whether to group nodes by a category field */
  groupBy?: string;
  /** Whether to show time scale */
  showTimeScale?: boolean;
  /** Whether to animate the layout */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Whether to fit graph to viewport */
  fit?: boolean;
  /** Padding around graph */
  padding?: number;
  /** Direction of time flow */
  direction?: 'LR' | 'RL';
}

/**
 * Default timeline layout options
 */
export const DEFAULT_TIMELINE_OPTIONS: TimelineLayoutOptions = {
  timestampField: 'timestamp',
  nodeSpacing: 80,
  trackSpacing: 60,
  groupBy: undefined,
  showTimeScale: false,
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 50,
  direction: 'LR',
};

/**
 * Create timeline layout options for Cytoscape
 * Uses dagre with horizontal direction
 */
export function createTimelineLayout(options?: Partial<TimelineLayoutOptions>): LayoutOptions {
  const mergedOptions = { ...DEFAULT_TIMELINE_OPTIONS, ...options };

  return {
    name: 'dagre',
    rankDir: mergedOptions.direction,
    nodeSep: mergedOptions.trackSpacing,
    rankSep: mergedOptions.nodeSpacing,
    edgeSep: 10,
    ranker: 'tight-tree',
    animate: mergedOptions.animate,
    animationDuration: mergedOptions.animationDuration,
    fit: mergedOptions.fit,
    padding: mergedOptions.padding,
    // Sort nodes by timestamp
    sort: (a: NodeSingular, b: NodeSingular) => {
      const timestampA = a.data(mergedOptions.timestampField!) as string | number | undefined;
      const timestampB = b.data(mergedOptions.timestampField!) as string | number | undefined;

      if (!timestampA && !timestampB) return 0;
      if (!timestampA) return 1;
      if (!timestampB) return -1;

      const dateA = new Date(timestampA).getTime();
      const dateB = new Date(timestampB).getTime();

      return dateA - dateB;
    },
  } as LayoutOptions;
}

/**
 * Create a custom timeline layout with manual positioning
 * For more precise control over temporal arrangement
 */
export function createCustomTimelineLayout(
  options?: Partial<TimelineLayoutOptions>
): (cy: { nodes: () => Collection }) => void {
  const mergedOptions = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  const timestampField = mergedOptions.timestampField!;
  const nodeSpacing = mergedOptions.nodeSpacing!;
  const trackSpacing = mergedOptions.trackSpacing!;
  const groupBy = mergedOptions.groupBy;

  return (cy: { nodes: () => Collection }) => {
    const nodes = cy.nodes();

    // Get all timestamps
    const timestamps: number[] = [];
    nodes.forEach((node: NodeSingular) => {
      const ts = node.data(timestampField);
      if (ts) {
        timestamps.push(new Date(ts).getTime());
      }
    });

    if (timestamps.length === 0) return;

    // Calculate time range
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;

    // Group nodes by category if specified
    const groups: Map<string, NodeSingular[]> = new Map();
    nodes.forEach((node: NodeSingular) => {
      const group = groupBy ? (node.data(groupBy) as string) ?? 'default' : 'default';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(node);
    });

    // Position nodes
    const totalWidth = nodes.length * nodeSpacing;
    let trackIndex = 0;

    groups.forEach((groupNodes) => {
      groupNodes.forEach((node) => {
        const ts = node.data(timestampField);
        if (ts) {
          const time = new Date(ts).getTime();
          const normalizedTime = (time - minTime) / timeRange;
          const x = normalizedTime * totalWidth;
          const y = trackIndex * trackSpacing;

          node.position({ x, y });
        }
      });
      trackIndex++;
    });
  };
}

/**
 * Timeline layout presets for different use cases
 */
export const TIMELINE_PRESETS = {
  /** Default left-to-right timeline */
  default: createTimelineLayout(),

  /** Right-to-left timeline (newest on left) */
  rightToLeft: createTimelineLayout({
    direction: 'RL',
  }),

  /** Compact timeline */
  compact: createTimelineLayout({
    nodeSpacing: 50,
    trackSpacing: 40,
    padding: 30,
  }),

  /** Spacious timeline for large time ranges */
  spacious: createTimelineLayout({
    nodeSpacing: 120,
    trackSpacing: 80,
    padding: 80,
  }),

  /** Dense timeline for many events */
  dense: createTimelineLayout({
    nodeSpacing: 40,
    trackSpacing: 30,
    padding: 20,
  }),
} as const;

/**
 * Utility function to extract time bounds from nodes
 */
export function getTimeBounds(
  nodes: NodeSingular[],
  timestampField = 'timestamp'
): { min: Date; max: Date } | null {
  const timestamps: number[] = [];

  nodes.forEach((node) => {
    const ts = node.data(timestampField);
    if (ts) {
      timestamps.push(new Date(ts).getTime());
    }
  });

  if (timestamps.length === 0) return null;

  return {
    min: new Date(Math.min(...timestamps)),
    max: new Date(Math.max(...timestamps)),
  };
}
