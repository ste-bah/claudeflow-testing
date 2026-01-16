/**
 * Data Transformers for God Agent Memory Visualization
 *
 * This module provides functions to transform raw database entities
 * (events, memory entries) into graph-ready structures for Cytoscape.js.
 *
 * @module services/database/transformers
 */

import type { GodAgentEvent, MemoryEntry } from '@/types/database';
import type { GraphData, GraphNode, GraphEdge } from '@/types/graph';

// Event transformers
import {
  eventToNode,
  eventsToNodes,
  createTemporalEdges,
  createSessionTemporalEdges,
  createMembershipEdges,
  extractSessionNodes,
  extractAgentNodes,
} from './eventTransformer';

// Memory transformers
import {
  memoryEntryToNode,
  memoryEntriesToNodes,
  extractNamespaceNodes,
  createNamespaceMembershipEdges,
  createKeyReferenceEdges,
  createSimilarityEdges,
} from './memoryTransformer';

// Re-export all transformers
export {
  eventToNode,
  eventsToNodes,
  createTemporalEdges,
  createSessionTemporalEdges,
  createMembershipEdges,
  extractSessionNodes,
  extractAgentNodes,
  memoryEntryToNode,
  memoryEntriesToNodes,
  extractNamespaceNodes,
  createNamespaceMembershipEdges,
  createKeyReferenceEdges,
  createSimilarityEdges,
};

/**
 * Options for graph data transformation
 */
export interface TransformOptions {
  /** Include temporal edges between sequential events */
  includeTemporalEdges?: boolean;
  /** Scope temporal edges to within sessions only */
  sessionScopedTemporal?: boolean;
  /** Include session nodes extracted from events */
  includeSessionNodes?: boolean;
  /** Include agent nodes extracted from events */
  includeAgentNodes?: boolean;
  /** Include namespace nodes extracted from memory entries */
  includeNamespaceNodes?: boolean;
  /** Include edges connecting entries to namespaces */
  includeNamespaceMembership?: boolean;
  /** Include edges based on key references in values */
  includeKeyReferences?: boolean;
  /** Include similarity edges based on shared key prefixes */
  includeSimilarityEdges?: boolean;
  /** Minimum key prefix segments for similarity edges */
  similarityMinPrefixLength?: number;
}

/**
 * Default transformation options
 */
const DEFAULT_OPTIONS: TransformOptions = {
  includeTemporalEdges: true,
  sessionScopedTemporal: true,
  includeSessionNodes: true,
  includeAgentNodes: true,
  includeNamespaceNodes: true,
  includeNamespaceMembership: true,
  includeKeyReferences: true,
  includeSimilarityEdges: false,
  similarityMinPrefixLength: 2,
};

/**
 * Transforms raw events and memory entries into a complete GraphData structure
 * ready for visualization with Cytoscape.js
 *
 * @param events - Array of GodAgentEvent records
 * @param memoryEntries - Array of MemoryEntry records
 * @param options - Transformation options
 * @returns Complete GraphData structure
 */
export function transformToGraphData(
  events: GodAgentEvent[],
  memoryEntries: MemoryEntry[],
  options: TransformOptions = {}
): GraphData {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Transform events to nodes
  const eventNodes = eventsToNodes(events);
  nodes.push(...eventNodes);

  // Transform memory entries to nodes
  const memoryNodes = memoryEntriesToNodes(memoryEntries);
  nodes.push(...memoryNodes);

  // Extract and add session nodes
  if (opts.includeSessionNodes) {
    const sessionNodes = extractSessionNodes(events);
    nodes.push(...sessionNodes);

    // Create session membership edges
    const sessionNodeMap = new Map<string, string>();
    for (const node of sessionNodes) {
      if (node.data.sessionId) {
        sessionNodeMap.set(node.data.sessionId, node.id);
      }
    }
    edges.push(...createMembershipEdges(events, sessionNodeMap));
  }

  // Extract and add agent nodes
  if (opts.includeAgentNodes) {
    const agentNodes = extractAgentNodes(events);
    nodes.push(...agentNodes);
  }

  // Extract and add namespace nodes
  if (opts.includeNamespaceNodes) {
    const namespaceNodes = extractNamespaceNodes(memoryEntries);
    nodes.push(...namespaceNodes);

    // Create namespace membership edges
    if (opts.includeNamespaceMembership) {
      const namespaceNodeMap = new Map<string, string>();
      for (const node of namespaceNodes) {
        if (node.data.namespace) {
          namespaceNodeMap.set(node.data.namespace, node.id);
        }
      }
      edges.push(...createNamespaceMembershipEdges(memoryEntries, namespaceNodeMap));
    }
  }

  // Create temporal edges
  if (opts.includeTemporalEdges) {
    if (opts.sessionScopedTemporal) {
      edges.push(...createSessionTemporalEdges(events));
    } else {
      edges.push(...createTemporalEdges(events));
    }
  }

  // Create key reference edges
  if (opts.includeKeyReferences) {
    edges.push(...createKeyReferenceEdges(memoryEntries));
  }

  // Create similarity edges
  if (opts.includeSimilarityEdges) {
    edges.push(...createSimilarityEdges(memoryEntries, opts.similarityMinPrefixLength));
  }

  return {
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      generatedAt: new Date(),
    },
  };
}
