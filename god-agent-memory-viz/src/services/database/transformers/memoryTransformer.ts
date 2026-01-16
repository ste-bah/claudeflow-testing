/**
 * Memory Entry to Graph Node Transformer
 *
 * Transforms MemoryEntry records into GraphNode structures for visualization.
 * Creates namespace groupings and reference edges between related entries.
 *
 * @module services/database/transformers/memoryTransformer
 */

import type { MemoryEntry } from '@/types/database';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { createNodeId, createEdgeId } from '@/utils/ids';
import { NODE_COLORS, EDGE_COLORS } from '@/constants/colors';
import { NODE_TYPE_SIZES } from '@/constants/nodeTypes';

/**
 * Transforms a single MemoryEntry into a GraphNode
 * @param entry - The memory entry to transform
 * @returns GraphNode representing the memory entry
 */
export function memoryEntryToNode(entry: MemoryEntry): GraphNode {
  const colors = NODE_COLORS.checkpoint;
  const size = NODE_TYPE_SIZES.memory;

  // Extract the last segment of the key for the label
  const keyParts = entry.key.split('/');
  const shortLabel = keyParts[keyParts.length - 1] ?? entry.key;

  // Compute opacity based on access count (more accessed = more prominent)
  const baseOpacity = 0.7;
  const accessBoost = Math.min(0.3, entry.accessCount * 0.02);

  return {
    id: createNodeId('memory', String(entry.id)),
    type: 'checkpoint',
    label: shortLabel.slice(0, 30),
    data: {
      memoryKey: entry.key,
      namespace: entry.namespace,
      accessCount: entry.accessCount,
      timestamp: entry.createdAt,
      raw: entry.value,
    },
    style: {
      backgroundColor: colors.primary,
      borderColor: colors.border,
      borderWidth: entry.hasEmbedding ? 3 : 2,
      width: size.width,
      height: size.height,
      opacity: baseOpacity + accessBoost,
    },
  };
}

/**
 * Transforms an array of MemoryEntries into GraphNodes
 * @param entries - Array of memory entries to transform
 * @returns Array of GraphNodes
 */
export function memoryEntriesToNodes(entries: MemoryEntry[]): GraphNode[] {
  return entries.map(memoryEntryToNode);
}

/**
 * Extracts unique namespaces from memory entries and creates namespace nodes
 * @param entries - Memory entries to extract namespaces from
 * @returns Array of namespace GraphNodes
 */
export function extractNamespaceNodes(entries: MemoryEntry[]): GraphNode[] {
  const namespaces = new Map<string, { count: number; firstTimestamp: Date }>();

  for (const entry of entries) {
    const existing = namespaces.get(entry.namespace);
    if (existing) {
      existing.count++;
      if (entry.createdAt < existing.firstTimestamp) {
        existing.firstTimestamp = entry.createdAt;
      }
    } else {
      namespaces.set(entry.namespace, {
        count: 1,
        firstTimestamp: entry.createdAt,
      });
    }
  }

  const nodes: GraphNode[] = [];
  const colors = NODE_COLORS.episode;
  const size = NODE_TYPE_SIZES.namespace;

  for (const [namespace, info] of namespaces) {
    nodes.push({
      id: createNodeId('namespace', namespace),
      type: 'episode',
      label: namespace,
      data: {
        namespace,
        eventCount: info.count,
        timestamp: info.firstTimestamp,
      },
      style: {
        backgroundColor: colors.secondary,
        borderColor: colors.border,
        borderWidth: 2,
        width: size.width,
        height: size.height,
        opacity: 0.9,
      },
    });
  }

  return nodes;
}

/**
 * Creates edges connecting memory entries to their namespaces
 * @param entries - Memory entries
 * @param namespaceNodes - Map of namespace to node ID
 * @returns Array of membership edges
 */
export function createNamespaceMembershipEdges(
  entries: MemoryEntry[],
  namespaceNodes: Map<string, string>
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const entry of entries) {
    const namespaceNodeId = namespaceNodes.get(entry.namespace);
    if (namespaceNodeId) {
      const memoryNodeId = createNodeId('memory', String(entry.id));

      edges.push({
        id: createEdgeId(namespaceNodeId, memoryNodeId, 'belongs_to_route'),
        source: namespaceNodeId,
        target: memoryNodeId,
        type: 'belongs_to_route',
        data: { weight: 0.5 },
        style: {
          lineColor: EDGE_COLORS.belongs_to_route,
          lineStyle: 'dashed',
          width: 1,
          opacity: 0.4,
          curveStyle: 'bezier',
          targetArrowShape: 'triangle',
        },
      });
    }
  }

  return edges;
}

/**
 * Creates edges between memory entries that reference each other by key
 * Detects patterns like "project/api/users" referencing "project/api/auth"
 * @param entries - Memory entries to analyze
 * @returns Array of reference edges
 */
export function createKeyReferenceEdges(entries: MemoryEntry[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const keyToId = new Map<string, number>();

  // Build key -> id mapping
  for (const entry of entries) {
    keyToId.set(entry.key, entry.id);
  }

  // Look for references in values
  for (const entry of entries) {
    const valueStr = JSON.stringify(entry.value);

    // Check if this entry's value contains references to other keys
    for (const [otherKey, otherId] of keyToId) {
      if (
        otherId !== entry.id &&
        valueStr.includes(otherKey) &&
        otherKey.length > 5 // Avoid false positives with short keys
      ) {
        const sourceId = createNodeId('memory', String(entry.id));
        const targetId = createNodeId('memory', String(otherId));

        edges.push({
          id: createEdgeId(sourceId, targetId, 'linked_to'),
          source: sourceId,
          target: targetId,
          type: 'linked_to',
          label: 'references',
          data: { weight: 1 },
          style: {
            lineColor: EDGE_COLORS.linked_to,
            lineStyle: 'solid',
            width: 1,
            opacity: 0.6,
            curveStyle: 'bezier',
            targetArrowShape: 'triangle',
          },
        });
      }
    }
  }

  return edges;
}

/**
 * Creates edges between memory entries in the same namespace that share key prefixes
 * @param entries - Memory entries to analyze
 * @param minPrefixLength - Minimum prefix length to consider (default: 2 segments)
 * @returns Array of similarity edges
 */
export function createSimilarityEdges(
  entries: MemoryEntry[],
  minPrefixLength: number = 2
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  // Group by namespace first for efficiency
  const byNamespace = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    const list = byNamespace.get(entry.namespace) ?? [];
    list.push(entry);
    byNamespace.set(entry.namespace, list);
  }

  // Find entries with shared prefixes within each namespace
  for (const namespaceEntries of byNamespace.values()) {
    for (let i = 0; i < namespaceEntries.length; i++) {
      const entryA = namespaceEntries[i];
      const partsA = entryA.key.split('/');

      for (let j = i + 1; j < namespaceEntries.length; j++) {
        const entryB = namespaceEntries[j];
        const partsB = entryB.key.split('/');

        // Count shared prefix segments
        let sharedCount = 0;
        for (let k = 0; k < Math.min(partsA.length, partsB.length); k++) {
          if (partsA[k] === partsB[k]) {
            sharedCount++;
          } else {
            break;
          }
        }

        // Create edge if prefix is long enough
        if (sharedCount >= minPrefixLength) {
          const sourceId = createNodeId('memory', String(entryA.id));
          const targetId = createNodeId('memory', String(entryB.id));
          const edgeKey = [sourceId, targetId].sort().join('--');

          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            edges.push({
              id: createEdgeId(sourceId, targetId, 'linked_to'),
              source: sourceId,
              target: targetId,
              type: 'linked_to',
              label: 'related',
              data: { weight: sharedCount * 0.5 },
              style: {
                lineColor: EDGE_COLORS.linked_to,
                lineStyle: 'dotted',
                width: 1,
                opacity: 0.3,
                curveStyle: 'bezier',
                targetArrowShape: 'none',
              },
            });
          }
        }
      }
    }
  }

  return edges;
}
