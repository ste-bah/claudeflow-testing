/**
 * Label Propagation Community Detection Algorithm
 *
 * Fast iterative algorithm where nodes adopt most frequent label among neighbors.
 * Performance: O(n + m) - must complete in <500ms for 10k nodes (HYPER-07)
 *
 * Algorithm:
 * 1. Initialize each node with unique label
 * 2. Iterate: each node adopts most frequent label among neighbors
 * 3. Break ties by node ID (deterministic)
 * 4. Stop when labels converge (no changes)
 */
import type { NodeID, CommunityDetectionResult } from '../hyperedge-types.js';
export declare class LabelPropagationDetector {
    private graph;
    private labels;
    private minCommunitySize;
    private maxIterations;
    private convergenceThreshold;
    constructor(minCommunitySize?: number, maxIterations?: number);
    /**
     * Detect communities using Label Propagation algorithm
     * @param nodes Array of node IDs
     * @param edges Array of [source, target] or [source, target, weight] tuples
     * @returns Community detection result
     */
    detect(nodes: NodeID[], edges: Array<[NodeID, NodeID] | [NodeID, NodeID, number]>): CommunityDetectionResult;
    /**
     * Initialize graph structure with nodes and edges
     */
    private initializeGraph;
    /**
     * Propagate labels: each node adopts most frequent label among neighbors
     * @returns Number of nodes that changed labels
     */
    private propagateLabels;
    /**
     * Get most frequent label among node's neighbors
     * Breaks ties deterministically by choosing label with largest node ID
     */
    private getMostFrequentNeighborLabel;
    /**
     * Check if algorithm has converged
     */
    private checkConvergence;
    /**
     * Build final community list, filtering by minimum size
     */
    private buildCommunities;
    /**
     * Calculate community cohesion (internal density)
     */
    private calculateCommunityCohesion;
    /**
     * Calculate modularity score for communities
     */
    private calculateModularity;
    /**
     * Fisher-Yates shuffle algorithm for randomizing node order
     */
    private shuffleArray;
}
//# sourceMappingURL=label-propagation.d.ts.map