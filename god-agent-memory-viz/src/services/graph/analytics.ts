/**
 * Graph Analytics
 *
 * Functions for computing graph statistics, centrality measures,
 * path finding, and other graph analysis operations.
 *
 * @module services/graph/analytics
 */

import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphStats,
  NodeType,
  EdgeType,
} from '@/types/graph';

// ============================================================================
// Basic Statistics
// ============================================================================

/**
 * Compute basic graph statistics
 */
export function computeGraphStats(data: GraphData): GraphStats {
  const nodesByType = countNodesByType(data.nodes);
  const edgesByType = countEdgesByType(data.edges);
  const averageDegree = computeAverageDegree(data);
  const density = computeDensity(data);
  const connectedComponents = countConnectedComponents(data);

  return {
    nodesByType,
    edgesByType,
    averageDegree,
    density,
    connectedComponents,
  };
}

/**
 * Count nodes grouped by type
 */
export function countNodesByType(nodes: GraphNode[]): Record<NodeType, number> {
  const counts: Record<string, number> = {};

  for (const node of nodes) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }

  return counts as Record<NodeType, number>;
}

/**
 * Count edges grouped by type
 */
export function countEdgesByType(edges: GraphEdge[]): Record<EdgeType, number> {
  const counts: Record<string, number> = {};

  for (const edge of edges) {
    counts[edge.type] = (counts[edge.type] ?? 0) + 1;
  }

  return counts as Record<EdgeType, number>;
}

/**
 * Compute the average degree of nodes
 */
export function computeAverageDegree(data: GraphData): number {
  if (data.nodes.length === 0) return 0;

  const degrees = computeNodeDegrees(data);
  const sum = Array.from(degrees.values()).reduce((acc, deg) => acc + deg, 0);

  return sum / data.nodes.length;
}

/**
 * Compute node degrees (number of connections)
 */
export function computeNodeDegrees(data: GraphData): Map<string, number> {
  const degrees = new Map<string, number>();

  // Initialize all nodes with degree 0
  for (const node of data.nodes) {
    degrees.set(node.id, 0);
  }

  // Count edges
  for (const edge of data.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }

  return degrees;
}

/**
 * Compute in-degrees (incoming edges)
 */
export function computeInDegrees(data: GraphData): Map<string, number> {
  const inDegrees = new Map<string, number>();

  // Initialize all nodes with degree 0
  for (const node of data.nodes) {
    inDegrees.set(node.id, 0);
  }

  // Count incoming edges
  for (const edge of data.edges) {
    inDegrees.set(edge.target, (inDegrees.get(edge.target) ?? 0) + 1);
  }

  return inDegrees;
}

/**
 * Compute out-degrees (outgoing edges)
 */
export function computeOutDegrees(data: GraphData): Map<string, number> {
  const outDegrees = new Map<string, number>();

  // Initialize all nodes with degree 0
  for (const node of data.nodes) {
    outDegrees.set(node.id, 0);
  }

  // Count outgoing edges
  for (const edge of data.edges) {
    outDegrees.set(edge.source, (outDegrees.get(edge.source) ?? 0) + 1);
  }

  return outDegrees;
}

/**
 * Compute graph density (ratio of actual edges to possible edges)
 */
export function computeDensity(data: GraphData): number {
  const n = data.nodes.length;
  if (n <= 1) return 0;

  // For directed graph: max edges = n * (n - 1)
  // For undirected graph: max edges = n * (n - 1) / 2
  // Assuming directed graph here
  const maxEdges = n * (n - 1);
  return data.edges.length / maxEdges;
}

// ============================================================================
// Connectivity
// ============================================================================

/**
 * Count connected components using union-find
 */
export function countConnectedComponents(data: GraphData): number {
  if (data.nodes.length === 0) return 0;

  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  // Initialize each node as its own component
  for (const node of data.nodes) {
    parent.set(node.id, node.id);
    rank.set(node.id, 0);
  }

  // Find with path compression
  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  // Union by rank
  const union = (id1: string, id2: string): void => {
    const root1 = find(id1);
    const root2 = find(id2);

    if (root1 === root2) return;

    const rank1 = rank.get(root1)!;
    const rank2 = rank.get(root2)!;

    if (rank1 < rank2) {
      parent.set(root1, root2);
    } else if (rank1 > rank2) {
      parent.set(root2, root1);
    } else {
      parent.set(root2, root1);
      rank.set(root1, rank1 + 1);
    }
  };

  // Union nodes connected by edges (treating as undirected)
  for (const edge of data.edges) {
    if (parent.has(edge.source) && parent.has(edge.target)) {
      union(edge.source, edge.target);
    }
  }

  // Count unique roots
  const roots = new Set<string>();
  for (const node of data.nodes) {
    roots.add(find(node.id));
  }

  return roots.size;
}

/**
 * Get all connected components as arrays of node IDs
 */
export function getConnectedComponents(data: GraphData): string[][] {
  if (data.nodes.length === 0) return [];

  const parent = new Map<string, string>();

  // Initialize each node as its own component
  for (const node of data.nodes) {
    parent.set(node.id, node.id);
  }

  // Find with path compression
  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  // Union
  const union = (id1: string, id2: string): void => {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root1, root2);
    }
  };

  // Union connected nodes
  for (const edge of data.edges) {
    if (parent.has(edge.source) && parent.has(edge.target)) {
      union(edge.source, edge.target);
    }
  }

  // Group by root
  const components = new Map<string, string[]>();
  for (const node of data.nodes) {
    const root = find(node.id);
    if (!components.has(root)) {
      components.set(root, []);
    }
    components.get(root)!.push(node.id);
  }

  return Array.from(components.values());
}

/**
 * Check if two nodes are connected
 */
export function areNodesConnected(data: GraphData, nodeId1: string, nodeId2: string): boolean {
  const components = getConnectedComponents(data);

  for (const component of components) {
    if (component.includes(nodeId1) && component.includes(nodeId2)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Path Finding
// ============================================================================

/**
 * Result of shortest path calculation
 */
export interface ShortestPathResult {
  /** Path as array of node IDs */
  path: string[];
  /** Edges along the path */
  edges: string[];
  /** Distance (number of hops), -1 if no path */
  distance: number;
}

/**
 * Find shortest path between two nodes using BFS
 */
export function findShortestPath(
  data: GraphData,
  sourceId: string,
  targetId: string
): ShortestPathResult {
  if (sourceId === targetId) {
    return { path: [sourceId], edges: [], distance: 0 };
  }

  // Build adjacency list
  const adjacency = buildAdjacencyList(data);

  if (!adjacency.has(sourceId) || !adjacency.has(targetId)) {
    return { path: [], edges: [], distance: -1 };
  }

  // BFS
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[]; edgePath: string[] }> = [
    { nodeId: sourceId, path: [sourceId], edgePath: [] },
  ];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = adjacency.get(current.nodeId) ?? [];
    for (const { nodeId: neighborId, edgeId } of neighbors) {
      if (neighborId === targetId) {
        return {
          path: [...current.path, neighborId],
          edges: [...current.edgePath, edgeId],
          distance: current.path.length,
        };
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          nodeId: neighborId,
          path: [...current.path, neighborId],
          edgePath: [...current.edgePath, edgeId],
        });
      }
    }
  }

  return { path: [], edges: [], distance: -1 };
}

/**
 * Build adjacency list from graph data
 */
export function buildAdjacencyList(
  data: GraphData
): Map<string, Array<{ nodeId: string; edgeId: string }>> {
  const adjacency = new Map<string, Array<{ nodeId: string; edgeId: string }>>();

  // Initialize for all nodes
  for (const node of data.nodes) {
    adjacency.set(node.id, []);
  }

  // Add edges (treating as undirected for path finding)
  for (const edge of data.edges) {
    if (adjacency.has(edge.source)) {
      adjacency.get(edge.source)!.push({ nodeId: edge.target, edgeId: edge.id });
    }
    if (adjacency.has(edge.target)) {
      adjacency.get(edge.target)!.push({ nodeId: edge.source, edgeId: edge.id });
    }
  }

  return adjacency;
}

/**
 * Find all paths between two nodes (up to a maximum depth)
 */
export function findAllPaths(
  data: GraphData,
  sourceId: string,
  targetId: string,
  maxDepth = 10
): string[][] {
  const adjacency = buildAdjacencyList(data);
  const paths: string[][] = [];

  const dfs = (current: string, path: string[], visited: Set<string>) => {
    if (path.length > maxDepth) return;

    if (current === targetId) {
      paths.push([...path]);
      return;
    }

    const neighbors = adjacency.get(current) ?? [];
    for (const { nodeId: neighborId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        path.push(neighborId);
        dfs(neighborId, path, visited);
        path.pop();
        visited.delete(neighborId);
      }
    }
  };

  const visited = new Set<string>([sourceId]);
  dfs(sourceId, [sourceId], visited);

  return paths;
}

// ============================================================================
// Centrality Measures
// ============================================================================

/**
 * Compute degree centrality for all nodes
 */
export function computeDegreeCentrality(data: GraphData): Map<string, number> {
  const degrees = computeNodeDegrees(data);
  const maxDegree = Math.max(...Array.from(degrees.values()), 1);

  const centrality = new Map<string, number>();
  for (const [nodeId, degree] of degrees) {
    centrality.set(nodeId, degree / maxDegree);
  }

  return centrality;
}

/**
 * Compute betweenness centrality (simplified)
 * Note: This is a simplified O(n^2) version, not the full O(n*m) algorithm
 */
export function computeBetweennessCentrality(data: GraphData): Map<string, number> {
  const centrality = new Map<string, number>();

  // Initialize
  for (const node of data.nodes) {
    centrality.set(node.id, 0);
  }

  // For each pair of nodes, find shortest path and count intermediates
  for (let i = 0; i < data.nodes.length; i++) {
    for (let j = i + 1; j < data.nodes.length; j++) {
      const source = data.nodes[i].id;
      const target = data.nodes[j].id;

      const { path } = findShortestPath(data, source, target);

      // Add 1 to each intermediate node
      for (let k = 1; k < path.length - 1; k++) {
        const nodeId = path[k];
        centrality.set(nodeId, (centrality.get(nodeId) ?? 0) + 1);
      }
    }
  }

  // Normalize
  const n = data.nodes.length;
  const maxPossible = ((n - 1) * (n - 2)) / 2;

  if (maxPossible > 0) {
    for (const [nodeId, value] of centrality) {
      centrality.set(nodeId, value / maxPossible);
    }
  }

  return centrality;
}

/**
 * Compute closeness centrality
 */
export function computeClosenessCentrality(data: GraphData): Map<string, number> {
  const centrality = new Map<string, number>();
  // Note: n is available if needed for normalization
  // const n = data.nodes.length;

  for (const node of data.nodes) {
    let totalDistance = 0;
    let reachable = 0;

    for (const otherNode of data.nodes) {
      if (node.id !== otherNode.id) {
        const { distance } = findShortestPath(data, node.id, otherNode.id);
        if (distance >= 0) {
          totalDistance += distance;
          reachable++;
        }
      }
    }

    // Closeness = reachable nodes / total distance
    if (totalDistance > 0 && reachable > 0) {
      centrality.set(node.id, reachable / totalDistance);
    } else {
      centrality.set(node.id, 0);
    }
  }

  return centrality;
}

/**
 * Compute combined node centrality (weighted average of different measures)
 */
export function computeNodeCentrality(data: GraphData): Map<string, number> {
  const degreeCentrality = computeDegreeCentrality(data);

  // For performance, just use degree centrality for large graphs
  if (data.nodes.length > 100) {
    return degreeCentrality;
  }

  const betweenness = computeBetweennessCentrality(data);

  const combined = new Map<string, number>();
  for (const node of data.nodes) {
    const dc = degreeCentrality.get(node.id) ?? 0;
    const bc = betweenness.get(node.id) ?? 0;

    // Weighted average
    combined.set(node.id, dc * 0.6 + bc * 0.4);
  }

  return combined;
}

// ============================================================================
// Clustering
// ============================================================================

/**
 * Compute local clustering coefficient for a node
 */
export function computeLocalClusteringCoefficient(
  data: GraphData,
  nodeId: string
): number {
  const adjacency = buildAdjacencyList(data);
  const neighbors = adjacency.get(nodeId) ?? [];

  if (neighbors.length < 2) return 0;

  const neighborSet = new Set(neighbors.map((n) => n.nodeId));
  let edgesBetweenNeighbors = 0;

  // Count edges between neighbors
  for (const edge of data.edges) {
    if (neighborSet.has(edge.source) && neighborSet.has(edge.target)) {
      edgesBetweenNeighbors++;
    }
  }

  // Maximum possible edges between neighbors
  const k = neighbors.length;
  const maxEdges = (k * (k - 1)) / 2;

  return maxEdges > 0 ? edgesBetweenNeighbors / maxEdges : 0;
}

/**
 * Compute average clustering coefficient for the graph
 */
export function computeAverageClusteringCoefficient(data: GraphData): number {
  if (data.nodes.length === 0) return 0;

  let sum = 0;
  for (const node of data.nodes) {
    sum += computeLocalClusteringCoefficient(data, node.id);
  }

  return sum / data.nodes.length;
}

// ============================================================================
// Neighbor Analysis
// ============================================================================

/**
 * Get immediate neighbors of a node
 */
export function getNeighbors(data: GraphData, nodeId: string): string[] {
  const neighbors = new Set<string>();

  for (const edge of data.edges) {
    if (edge.source === nodeId) {
      neighbors.add(edge.target);
    }
    if (edge.target === nodeId) {
      neighbors.add(edge.source);
    }
  }

  return Array.from(neighbors);
}

/**
 * Get neighbors up to a certain distance
 */
export function getNeighborsAtDistance(
  data: GraphData,
  nodeId: string,
  maxDistance: number
): Map<string, number> {
  const distances = new Map<string, number>();
  const adjacency = buildAdjacencyList(data);

  const queue: Array<{ id: string; distance: number }> = [{ id: nodeId, distance: 0 }];
  distances.set(nodeId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.distance >= maxDistance) continue;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const { nodeId: neighborId } of neighbors) {
      if (!distances.has(neighborId)) {
        const newDistance = current.distance + 1;
        distances.set(neighborId, newDistance);
        queue.push({ id: neighborId, distance: newDistance });
      }
    }
  }

  // Remove the source node itself
  distances.delete(nodeId);

  return distances;
}

/**
 * Get common neighbors between two nodes
 */
export function getCommonNeighbors(
  data: GraphData,
  nodeId1: string,
  nodeId2: string
): string[] {
  const neighbors1 = new Set(getNeighbors(data, nodeId1));
  const neighbors2 = getNeighbors(data, nodeId2);

  return neighbors2.filter((n) => neighbors1.has(n));
}

// ============================================================================
// Graph Comparison
// ============================================================================

/**
 * Compare two graphs and return differences
 */
export function compareGraphs(
  graph1: GraphData,
  graph2: GraphData
): {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
} {
  const nodes1 = new Set(graph1.nodes.map((n) => n.id));
  const nodes2 = new Set(graph2.nodes.map((n) => n.id));
  const edges1 = new Set(graph1.edges.map((e) => e.id));
  const edges2 = new Set(graph2.edges.map((e) => e.id));

  return {
    addedNodes: Array.from(nodes2).filter((id) => !nodes1.has(id)),
    removedNodes: Array.from(nodes1).filter((id) => !nodes2.has(id)),
    addedEdges: Array.from(edges2).filter((id) => !edges1.has(id)),
    removedEdges: Array.from(edges1).filter((id) => !edges2.has(id)),
  };
}

// ============================================================================
// Subgraph Extraction
// ============================================================================

/**
 * Extract a subgraph containing only specified nodes and their connecting edges
 */
export function extractSubgraph(data: GraphData, nodeIds: string[]): GraphData {
  const nodeIdSet = new Set(nodeIds);

  const nodes = data.nodes.filter((n) => nodeIdSet.has(n.id));
  const edges = data.edges.filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
  );

  return { nodes, edges };
}

/**
 * Extract ego network (node and its neighbors up to distance)
 */
export function extractEgoNetwork(
  data: GraphData,
  centerNodeId: string,
  radius = 1
): GraphData {
  const distances = getNeighborsAtDistance(data, centerNodeId, radius);
  const nodeIds = [centerNodeId, ...Array.from(distances.keys())];

  return extractSubgraph(data, nodeIds);
}
