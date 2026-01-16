/**
 * Layout configuration constants for God Agent Memory Visualization
 *
 * Defines available graph layout algorithms and their default options.
 * Compatible with Cytoscape.js layout extensions.
 *
 * @module constants/layouts
 */

/**
 * Available layout algorithm names
 */
export type LayoutName = 'dagre' | 'fcose' | 'cola' | 'concentric' | 'breadthfirst' | 'grid';

/**
 * Layout configuration with name, label, description, and options
 */
export interface LayoutConfig {
  /** Internal layout name */
  name: LayoutName;
  /** Human-readable label */
  label: string;
  /** Description of the layout behavior */
  description: string;
  /** Layout-specific options */
  options: Record<string, unknown>;
}

/**
 * Complete layout configurations for each algorithm
 */
export const LAYOUT_CONFIGS: Record<LayoutName, LayoutConfig> = {
  dagre: {
    name: 'dagre',
    label: 'Hierarchical',
    description: 'Top-to-bottom directed graph layout',
    options: {
      rankDir: 'TB',
      nodeSep: 50,
      rankSep: 100,
      edgeSep: 10,
      ranker: 'network-simplex',
    },
  },
  fcose: {
    name: 'fcose',
    label: 'Force-Directed',
    description: 'Physics-based spring layout',
    options: {
      quality: 'default',
      randomize: false,
      animate: true,
      animationDuration: 500,
      fit: true,
      padding: 30,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 4500,
      idealEdgeLength: 100,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
    },
  },
  cola: {
    name: 'cola',
    label: 'Constraint-Based',
    description: 'Layout with constraints and groups',
    options: {
      animate: true,
      maxSimulationTime: 2000,
      fit: true,
      padding: 30,
      nodeDimensionsIncludeLabels: true,
      randomize: false,
      avoidOverlap: true,
      handleDisconnected: true,
      convergenceThreshold: 0.01,
      nodeSpacing: 20,
      edgeLength: undefined,
      edgeSymDiffLength: undefined,
      edgeJaccardLength: undefined,
    },
  },
  concentric: {
    name: 'concentric',
    label: 'Concentric',
    description: 'Nodes arranged in concentric circles',
    options: {
      fit: true,
      padding: 30,
      startAngle: (3 / 2) * Math.PI,
      sweep: undefined,
      clockwise: true,
      equidistant: false,
      minNodeSpacing: 50,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      height: undefined,
      width: undefined,
      spacingFactor: 1,
      concentric: (node: { degree: () => number }) => node.degree(),
      levelWidth: () => 2,
    },
  },
  breadthfirst: {
    name: 'breadthfirst',
    label: 'Breadth-First',
    description: 'Tree-like hierarchical layout',
    options: {
      fit: true,
      directed: true,
      padding: 30,
      circle: false,
      grid: false,
      spacingFactor: 1.5,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      maximal: false,
    },
  },
  grid: {
    name: 'grid',
    label: 'Grid',
    description: 'Simple grid arrangement',
    options: {
      fit: true,
      padding: 30,
      avoidOverlap: true,
      avoidOverlapPadding: 10,
      nodeDimensionsIncludeLabels: true,
      spacingFactor: 1,
      condense: false,
      rows: undefined,
      cols: undefined,
      sort: undefined,
    },
  },
};

/**
 * Default layout to use when no preference is set
 */
export const DEFAULT_LAYOUT: LayoutName = 'fcose';

/**
 * Display order for layout options in UI
 */
export const LAYOUT_ORDER: LayoutName[] = ['fcose', 'dagre', 'cola', 'concentric', 'breadthfirst', 'grid'];

/**
 * Layout presets for different use cases
 */
export const LAYOUT_PRESETS = {
  /** Best for understanding data flow and dependencies */
  dataFlow: 'dagre' as LayoutName,
  /** Best for exploring relationships organically */
  exploration: 'fcose' as LayoutName,
  /** Best for grouped/clustered data */
  clustered: 'cola' as LayoutName,
  /** Best for importance-based views */
  centrality: 'concentric' as LayoutName,
  /** Best for hierarchical/tree structures */
  hierarchical: 'breadthfirst' as LayoutName,
  /** Best for comparing items side by side */
  comparison: 'grid' as LayoutName,
} as const;

/**
 * Get layout configuration by name with fallback to default
 */
export function getLayoutConfig(name: LayoutName): LayoutConfig {
  return LAYOUT_CONFIGS[name] ?? LAYOUT_CONFIGS[DEFAULT_LAYOUT];
}

/**
 * Get layout options ready for Cytoscape
 */
export function getCytoscapeLayoutOptions(name: LayoutName): Record<string, unknown> {
  const config = getLayoutConfig(name);
  return {
    name: config.name,
    ...config.options,
  };
}
