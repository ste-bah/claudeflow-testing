/**
 * Color constants for God Agent Memory Visualization
 *
 * Defines color schemes for nodes, edges, statuses, and themes.
 * All colors use hex format for consistency with Cytoscape.js.
 *
 * @module constants/colors
 */

import type { NodeType, EdgeType } from '@/types/graph';
import type { EventType } from '@/types/database';

/**
 * Color palette for each event type
 */
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  task_start: '#22C55E',
  task_complete: '#16A34A',
  task_error: '#EF4444',
  agent_spawn: '#8B5CF6',
  agent_terminate: '#6D28D9',
  memory_store: '#3B82F6',
  memory_retrieve: '#60A5FA',
  memory_delete: '#F59E0B',
  session_start: '#14B8A6',
  session_end: '#0D9488',
  trajectory_start: '#EC4899',
  trajectory_step: '#F472B6',
  trajectory_end: '#DB2777',
  pattern_match: '#A855F7',
  learning_update: '#F97316',
  custom: '#6B7280',
};

/**
 * Color palette for each node type
 * - primary: Main fill color
 * - secondary: Lighter variant for gradients/highlights
 * - border: Border/stroke color
 */
export const NODE_COLORS: Record<NodeType, { primary: string; secondary: string; border: string }> = {
  trajectory: { primary: '#3B82F6', secondary: '#93C5FD', border: '#1D4ED8' },
  pattern: { primary: '#8B5CF6', secondary: '#C4B5FD', border: '#6D28D9' },
  episode: { primary: '#10B981', secondary: '#6EE7B7', border: '#047857' },
  feedback: { primary: '#F59E0B', secondary: '#FCD34D', border: '#B45309' },
  reasoning_step: { primary: '#EC4899', secondary: '#F9A8D4', border: '#BE185D' },
  checkpoint: { primary: '#6366F1', secondary: '#A5B4FC', border: '#4338CA' },
};

/**
 * Edge colors for each relationship type
 */
export const EDGE_COLORS: Record<EdgeType, string> = {
  uses_pattern: '#8B5CF6',
  creates_pattern: '#10B981',
  linked_to: '#6B7280',
  informed_by_feedback: '#F59E0B',
  belongs_to_route: '#3B82F6',
  has_step: '#EC4899',
  has_checkpoint: '#6366F1',
};

/**
 * Status indicator colors
 * - bg: Background color
 * - text: Text color
 * - border: Border color
 */
export const STATUS_COLORS = {
  success: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  error: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  warning: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  info: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  pending: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
} as const;

/**
 * Theme color palettes for light and dark modes
 */
export const THEME_COLORS = {
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
  },
  dark: {
    background: '#111827',
    surface: '#1F2937',
    border: '#374151',
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      muted: '#9CA3AF',
    },
  },
} as const;

/**
 * Selection and interaction colors
 */
export const INTERACTION_COLORS = {
  selected: {
    node: '#2563EB',
    edge: '#2563EB',
    glow: 'rgba(37, 99, 235, 0.3)',
  },
  hover: {
    node: '#3B82F6',
    edge: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.2)',
  },
  focus: {
    outline: '#2563EB',
    ring: 'rgba(37, 99, 235, 0.5)',
  },
} as const;

/**
 * Graph canvas colors
 */
export const CANVAS_COLORS = {
  light: {
    background: '#FAFAFA',
    grid: '#E5E7EB',
    minimap: {
      background: '#FFFFFF',
      viewport: 'rgba(37, 99, 235, 0.2)',
      border: '#E5E7EB',
    },
  },
  dark: {
    background: '#0F172A',
    grid: '#1E293B',
    minimap: {
      background: '#1E293B',
      viewport: 'rgba(96, 165, 250, 0.2)',
      border: '#374151',
    },
  },
} as const;

/**
 * Get node color by type with fallback
 */
export function getNodeColor(type: NodeType): { primary: string; secondary: string; border: string } {
  return NODE_COLORS[type] ?? { primary: '#6B7280', secondary: '#D1D5DB', border: '#4B5563' };
}

/**
 * Get edge color by type with fallback
 */
export function getEdgeColor(type: EdgeType): string {
  return EDGE_COLORS[type] ?? '#6B7280';
}
