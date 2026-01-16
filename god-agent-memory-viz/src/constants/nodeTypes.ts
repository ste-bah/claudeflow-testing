/**
 * Node type constants for God Agent Memory Visualization
 *
 * Defines labels, descriptions, and ordering for node types
 * as specified in the constitution.
 *
 * @module constants/nodeTypes
 */

import type { NodeType } from '@/types/graph';

/**
 * Human-readable labels for each node type
 */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trajectory: 'Trajectory',
  pattern: 'Pattern',
  episode: 'Episode',
  feedback: 'Feedback',
  reasoning_step: 'Reasoning Step',
  checkpoint: 'Checkpoint',
};

/**
 * Detailed descriptions for each node type
 */
export const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string> = {
  trajectory: 'A complete execution path through the system',
  pattern: 'A learned behavior or strategy',
  episode: 'A bounded interaction session',
  feedback: 'User or system feedback on performance',
  reasoning_step: 'An individual reasoning or decision step',
  checkpoint: 'A saved state or milestone',
};

/**
 * Display order for node types in UI lists and legends
 */
export const NODE_TYPE_ORDER: NodeType[] = [
  'trajectory',
  'pattern',
  'episode',
  'feedback',
  'reasoning_step',
  'checkpoint',
];

/**
 * Icons associated with each node type (for UI rendering)
 */
export const NODE_TYPE_ICONS: Record<NodeType, string> = {
  trajectory: 'route',
  pattern: 'shapes',
  episode: 'play-circle',
  feedback: 'message-square',
  reasoning_step: 'git-commit',
  checkpoint: 'flag',
};

/**
 * Default shapes for each node type in the graph visualization
 */
export const NODE_TYPE_SHAPES: Record<NodeType, string> = {
  trajectory: 'roundrectangle',
  pattern: 'hexagon',
  episode: 'ellipse',
  feedback: 'diamond',
  reasoning_step: 'rectangle',
  checkpoint: 'star',
};

/**
 * Extended visual node types for rendering (beyond constitution types)
 * These are used for intermediate visualization before mapping to constitution types
 */
export type VisualNodeType = NodeType | 'event' | 'session' | 'agent' | 'memory' | 'namespace';

/**
 * Shapes for extended visual node types
 */
export const VISUAL_NODE_SHAPES: Record<VisualNodeType, string> = {
  ...NODE_TYPE_SHAPES,
  event: 'ellipse',
  session: 'roundrectangle',
  agent: 'hexagon',
  memory: 'rectangle',
  namespace: 'octagon',
};

/**
 * Default sizes for each visual node type
 */
export const NODE_TYPE_SIZES: Record<VisualNodeType, { width: number; height: number }> = {
  trajectory: { width: 180, height: 60 },
  pattern: { width: 140, height: 50 },
  episode: { width: 160, height: 50 },
  feedback: { width: 120, height: 40 },
  reasoning_step: { width: 150, height: 40 },
  checkpoint: { width: 100, height: 40 },
  event: { width: 140, height: 40 },
  session: { width: 160, height: 50 },
  agent: { width: 130, height: 45 },
  memory: { width: 150, height: 40 },
  namespace: { width: 140, height: 45 },
};
