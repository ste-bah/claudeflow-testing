/**
 * Graph Styles - Cytoscape.js stylesheets
 *
 * Defines visual styles for nodes and edges based on the constitution spec.
 * Includes styles for different node types, edge types, and interaction states.
 *
 * @module services/graph/styles
 */

// Stylesheet interface compatible with Cytoscape's StylesheetStyle
// Using style property format which Cytoscape accepts
interface Stylesheet {
  selector: string;
  style: Record<string, unknown>;
}
import type { NodeType, EdgeType } from '@/types/graph';
import { NODE_COLORS, EDGE_COLORS, INTERACTION_COLORS } from '@/constants/colors';
import { NODE_TYPE_SHAPES, NODE_TYPE_SIZES } from '@/constants/nodeTypes';

// ============================================================================
// Node Styles
// ============================================================================

/**
 * Base node styles applied to all nodes
 */
export function getBaseNodeStyles(): Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': '#6B7280',
        'border-width': 2,
        'border-color': '#4B5563',
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 12,
        'font-family': 'Inter, system-ui, sans-serif',
        color: '#111827',
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        width: 140,
        height: 40,
        shape: 'roundrectangle',
        'overlay-padding': 6,
        'z-index': 10,
        'transition-property': 'background-color, border-color, width, height, opacity',
        'transition-duration': 150,
      },
    },
  ];
}

/**
 * Node type-specific styles (per constitution spec)
 */
export function getNodeTypeStyles(): Stylesheet[] {
  const nodeTypes: NodeType[] = [
    'trajectory',
    'pattern',
    'episode',
    'feedback',
    'reasoning_step',
    'checkpoint',
  ];

  return nodeTypes.map((type) => ({
    selector: `node.${type}`,
    style: {
      'background-color': NODE_COLORS[type].primary,
      'border-color': NODE_COLORS[type].border,
      shape: NODE_TYPE_SHAPES[type],
      width: NODE_TYPE_SIZES[type].width,
      height: NODE_TYPE_SIZES[type].height,
    },
  }));
}

/**
 * Additional visual node type styles (for event-based nodes)
 */
export function getVisualNodeTypeStyles(): Stylesheet[] {
  return [
    {
      selector: 'node.event',
      style: {
        'background-color': '#6B7280',
        'border-color': '#4B5563',
        shape: 'ellipse',
        width: 140,
        height: 40,
      },
    },
    {
      selector: 'node.session',
      style: {
        'background-color': '#14B8A6',
        'border-color': '#0D9488',
        shape: 'roundrectangle',
        width: 160,
        height: 50,
      },
    },
    {
      selector: 'node.agent',
      style: {
        'background-color': '#8B5CF6',
        'border-color': '#6D28D9',
        shape: 'hexagon',
        width: 130,
        height: 45,
      },
    },
    {
      selector: 'node.memory',
      style: {
        'background-color': '#3B82F6',
        'border-color': '#1D4ED8',
        shape: 'rectangle',
        width: 150,
        height: 40,
      },
    },
    {
      selector: 'node.namespace',
      style: {
        'background-color': '#F59E0B',
        'border-color': '#B45309',
        shape: 'octagon',
        width: 140,
        height: 45,
      },
    },
  ];
}

/**
 * Get all node styles combined
 */
export function getNodeStyles(): Stylesheet[] {
  return [
    ...getBaseNodeStyles(),
    ...getNodeTypeStyles(),
    ...getVisualNodeTypeStyles(),
  ];
}

// ============================================================================
// Edge Styles
// ============================================================================

/**
 * Base edge styles applied to all edges
 */
export function getBaseEdgeStyles(): Stylesheet[] {
  return [
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': '#9CA3AF',
        'target-arrow-color': '#9CA3AF',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'curve-style': 'bezier',
        opacity: 0.8,
        'overlay-padding': 4,
        'transition-property': 'line-color, opacity, width',
        'transition-duration': 150,
      },
    },
  ];
}

/**
 * Edge type-specific styles (per constitution spec)
 */
export function getEdgeTypeStyles(): Stylesheet[] {
  const edgeTypes: EdgeType[] = [
    'uses_pattern',
    'creates_pattern',
    'linked_to',
    'informed_by_feedback',
    'belongs_to_route',
    'has_step',
    'has_checkpoint',
  ];

  return edgeTypes.map((type) => ({
    selector: `edge.${type}`,
    style: {
      'line-color': EDGE_COLORS[type],
      'target-arrow-color': EDGE_COLORS[type],
    },
  }));
}

/**
 * Additional edge styles for various relationship types
 */
export function getAdditionalEdgeStyles(): Stylesheet[] {
  return [
    // Temporal edges (dashed)
    {
      selector: 'edge.temporal',
      style: {
        'line-style': 'dashed',
        'line-color': '#6B7280',
        'target-arrow-color': '#6B7280',
        width: 1.5,
      },
    },
    // Membership edges (dotted)
    {
      selector: 'edge.membership',
      style: {
        'line-style': 'dotted',
        'line-color': '#14B8A6',
        'target-arrow-color': '#14B8A6',
        width: 1.5,
      },
    },
    // Reference edges (thinner)
    {
      selector: 'edge.reference',
      style: {
        'line-style': 'solid',
        'line-color': '#9CA3AF',
        'target-arrow-color': '#9CA3AF',
        width: 1,
        opacity: 0.6,
      },
    },
    // Similarity edges (no arrow)
    {
      selector: 'edge.similarity',
      style: {
        'line-style': 'dashed',
        'line-color': '#A855F7',
        'target-arrow-shape': 'none',
        width: 1,
        opacity: 0.5,
      },
    },
  ];
}

/**
 * Get all edge styles combined
 */
export function getEdgeStyles(): Stylesheet[] {
  return [
    ...getBaseEdgeStyles(),
    ...getEdgeTypeStyles(),
    ...getAdditionalEdgeStyles(),
  ];
}

// ============================================================================
// Interaction Styles
// ============================================================================

/**
 * Styles for selected elements
 */
export function getSelectedStyles(): Stylesheet[] {
  return [
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': INTERACTION_COLORS.selected.node,
        'box-shadow': `0 0 0 4px ${INTERACTION_COLORS.selected.glow}`,
        'background-opacity': 1,
        'z-index': 100,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        'line-color': INTERACTION_COLORS.selected.edge,
        'target-arrow-color': INTERACTION_COLORS.selected.edge,
        width: 3,
        opacity: 1,
        'z-index': 100,
      },
    },
  ];
}

/**
 * Styles for hovered elements
 */
export function getHoverStyles(): Stylesheet[] {
  return [
    {
      selector: 'node:active',
      style: {
        'border-width': 3,
        'border-color': INTERACTION_COLORS.hover.node,
        'overlay-opacity': 0.1,
      },
    },
    {
      selector: 'node.hover',
      style: {
        'border-width': 3,
        'border-color': INTERACTION_COLORS.hover.node,
        'z-index': 50,
      },
    },
    {
      selector: 'edge:active',
      style: {
        'line-color': INTERACTION_COLORS.hover.edge,
        'target-arrow-color': INTERACTION_COLORS.hover.edge,
        width: 2.5,
      },
    },
    {
      selector: 'edge.hover',
      style: {
        'line-color': INTERACTION_COLORS.hover.edge,
        'target-arrow-color': INTERACTION_COLORS.hover.edge,
        width: 2.5,
      },
    },
  ];
}

/**
 * Styles for highlighted elements
 */
export function getHighlightStyles(): Stylesheet[] {
  return [
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 4,
        'border-color': '#F59E0B',
        'background-opacity': 1,
        'z-index': 90,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#F59E0B',
        'target-arrow-color': '#F59E0B',
        width: 3,
        opacity: 1,
        'z-index': 90,
      },
    },
  ];
}

/**
 * Styles for dimmed (de-emphasized) elements
 */
export function getDimmedStyles(): Stylesheet[] {
  return [
    {
      selector: 'node.dimmed',
      style: {
        opacity: 0.3,
        'background-opacity': 0.5,
        'text-opacity': 0.3,
        'z-index': 1,
      },
    },
    {
      selector: 'edge.dimmed',
      style: {
        opacity: 0.15,
        'z-index': 1,
      },
    },
  ];
}

/**
 * Styles for focused elements (keyboard navigation)
 */
export function getFocusStyles(): Stylesheet[] {
  return [
    {
      selector: 'node.focused',
      style: {
        'border-width': 3,
        'border-color': INTERACTION_COLORS.focus.outline,
        'border-style': 'double',
        'z-index': 110,
      },
    },
  ];
}

// ============================================================================
// Theme-aware Styles
// ============================================================================

/**
 * Get dark mode node styles
 */
export function getDarkModeNodeStyles(): Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        color: '#F9FAFB',
        'text-outline-color': '#111827',
        'text-outline-width': 1,
      },
    },
  ];
}

/**
 * Get dark mode edge styles
 */
export function getDarkModeEdgeStyles(): Stylesheet[] {
  return [
    {
      selector: 'edge',
      style: {
        opacity: 0.7,
      },
    },
  ];
}

// ============================================================================
// Complete Stylesheets
// ============================================================================

/**
 * Get complete default stylesheet
 */
export function getDefaultStylesheet(): Stylesheet[] {
  return [
    ...getNodeStyles(),
    ...getEdgeStyles(),
    ...getSelectedStyles(),
    ...getHoverStyles(),
    ...getHighlightStyles(),
    ...getDimmedStyles(),
    ...getFocusStyles(),
  ];
}

/**
 * Get complete dark mode stylesheet
 */
export function getDarkModeStylesheet(): Stylesheet[] {
  return [
    ...getDefaultStylesheet(),
    ...getDarkModeNodeStyles(),
    ...getDarkModeEdgeStyles(),
  ];
}

/**
 * Create a custom stylesheet with overrides
 */
export function createCustomStylesheet(overrides: Stylesheet[]): Stylesheet[] {
  return [...getDefaultStylesheet(), ...overrides];
}

// ============================================================================
// Style Utilities
// ============================================================================

/**
 * Get style for a specific node type
 */
export function getNodeTypeStyle(nodeType: NodeType): {
  backgroundColor: string;
  borderColor: string;
  shape: string;
  width: number;
  height: number;
} {
  return {
    backgroundColor: NODE_COLORS[nodeType].primary,
    borderColor: NODE_COLORS[nodeType].border,
    shape: NODE_TYPE_SHAPES[nodeType],
    width: NODE_TYPE_SIZES[nodeType].width,
    height: NODE_TYPE_SIZES[nodeType].height,
  };
}

/**
 * Get style for a specific edge type
 */
export function getEdgeTypeStyle(edgeType: EdgeType): {
  lineColor: string;
  arrowColor: string;
} {
  const color = EDGE_COLORS[edgeType];
  return {
    lineColor: color,
    arrowColor: color,
  };
}

/**
 * Convert style object to Cytoscape format
 */
export function toStyleObject(
  selector: string,
  style: Record<string, string | number>
): Stylesheet {
  return { selector, style } as Stylesheet;
}

/**
 * Merge multiple stylesheets
 */
export function mergeStylesheets(...stylesheets: Stylesheet[][]): Stylesheet[] {
  return stylesheets.flat();
}
