/**
 * ID generation and parsing utilities for God Agent Memory Visualization
 *
 * Provides functions for creating and parsing node/edge IDs.
 *
 * @module utils/ids
 */

/**
 * Generates a unique ID with optional prefix
 * @param prefix - Optional prefix for the ID
 * @returns Generated unique ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Creates a standardized node ID
 * @param type - Node type
 * @param sourceId - Source identifier
 * @returns Formatted node ID
 */
export function createNodeId(type: string, sourceId: string): string {
  return `node_${type}_${sourceId}`;
}

/**
 * Creates a standardized edge ID
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param type - Edge type
 * @returns Formatted edge ID
 */
export function createEdgeId(sourceId: string, targetId: string, type: string): string {
  return `edge_${type}_${sourceId}_${targetId}`;
}

/**
 * Parses a node ID into its components
 * @param id - Node ID to parse
 * @returns Object with type and sourceId, or null if invalid
 */
export function parseNodeId(id: string): { type: string; sourceId: string } | null {
  const match = id.match(/^node_([a-z_]+)_(.+)$/);
  if (!match) return null;
  return { type: match[1], sourceId: match[2] };
}

/**
 * Parses an edge ID into its components
 * @param id - Edge ID to parse
 * @returns Object with type, sourceId, and targetId, or null if invalid
 */
export function parseEdgeId(
  id: string
): { type: string; sourceId: string; targetId: string } | null {
  const match = id.match(/^edge_([a-z_]+)_(.+)_(.+)$/);
  if (!match) return null;
  return { type: match[1], sourceId: match[2], targetId: match[3] };
}

/**
 * Checks if an ID is a node ID
 * @param id - ID to check
 * @returns True if ID starts with 'node_'
 */
export function isNodeId(id: string): boolean {
  return id.startsWith('node_');
}

/**
 * Checks if an ID is an edge ID
 * @param id - ID to check
 * @returns True if ID starts with 'edge_'
 */
export function isEdgeId(id: string): boolean {
  return id.startsWith('edge_');
}
