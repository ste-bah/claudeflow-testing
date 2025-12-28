/**
 * Louvain Community Detection Algorithm
 *
 * Two-phase modularity optimization algorithm for community detection.
 * Performance: O(n log n) - must complete in <2s for 10k nodes (HYPER-06)
 *
 * Algorithm:
 * 1. Phase 1: Move nodes to communities that maximize modularity gain
 * 2. Phase 2: Aggregate communities into super-nodes
 * 3. Repeat until no improvement
 *
 * Modularity: Q = (1/2m) * Σ[Aij - (ki*kj)/(2m)] * δ(ci, cj)
 * where m = total edge weight, ki = degree of node i, Aij = edge weight
 */
import type { NodeID, CommunityDetectionResult } from '../hyperedge-types.js';
export declare class LouvainDetector {
    private graph;
    private originalGraph;
    private communities;
    private nodeMapping;
    private stats;
    private minCommunitySize;
    constructor(minCommunitySize?: number);
    /**
     * Detect communities using Louvain algorithm
     * @param nodes Array of node IDs
     * @param edges Array of [source, target] or [source, target, weight] tuples
     * @returns Community detection result with modularity score
     */
    detect(nodes: NodeID[], edges: Array<[NodeID, NodeID] | [NodeID, NodeID, number]>): CommunityDetectionResult;
    /**
     * Initialize graph structure with nodes and edges
     */
    private initializeGraph;
    /**
     * Phase 1: Optimize modularity by moving nodes to better communities
     * @returns true if any node was moved
     */
    private optimizeModularity;
    /**
     * Calculate modularity gain from moving a node to a new community
     */
    private calculateModularityGain;
    /**
     * Get total weight of edges from node to nodes in a community
     */
    private getEdgeWeightToCommunity;
    /**
     * Update community weights after node movements
     */
    private updateCommunityWeights;
    /**
     * Phase 2: Aggregate communities into super-nodes
     */
    private aggregateCommunities;
    /**
     * Recalculate node degrees and total weight after aggregation
     */
    private recalculateStats;
    /**
     * Calculate final modularity score
     */
    private calculateModularity;
    /**
     * Build final community list, filtering by minimum size
     */
    private buildCommunities;
    /**
     * Calculate community cohesion (internal density)
     */
    private calculateCommunityCohesion;
}
//# sourceMappingURL=louvain.d.ts.map