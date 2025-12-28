/**
 * Unified Community Detection Interface
 *
 * Provides algorithm selection, result filtering, and statistics.
 * Enforces constitutional constraints (HYPER-06, HYPER-07, HYPER-08).
 */
import type { NodeID, Community, CommunityDetectionResult } from '../hyperedge-types.js';
export type CommunityAlgorithm = 'louvain' | 'label-propagation' | 'auto';
export interface CommunityDetectorOptions {
    algorithm?: CommunityAlgorithm;
    minCommunitySize?: number;
    maxIterations?: number;
}
export declare class CommunityDetector {
    private options;
    constructor(options?: CommunityDetectorOptions);
    /**
     * Detect communities in graph
     * @param nodes Array of node IDs
     * @param edges Array of [source, target] or [source, target, weight] tuples
     * @returns Community detection result
     */
    detect(nodes: NodeID[], edges: Array<[NodeID, NodeID] | [NodeID, NodeID, number]>): CommunityDetectionResult;
    /**
     * Select algorithm based on graph size and user preference
     */
    private selectAlgorithm;
    /**
     * Validate performance constraints (HYPER-06, HYPER-07)
     */
    private validatePerformance;
    /**
     * Get statistics about community structure
     */
    getStatistics(result: CommunityDetectionResult): CommunityStatistics;
    /**
     * Find community for a given node
     */
    findNodeCommunity(nodeId: NodeID, result: CommunityDetectionResult): Community | null;
    /**
     * Find overlapping members between two communities
     */
    findOverlap(community1: Community, community2: Community): NodeID[];
    /**
     * Calculate average of array
     */
    private average;
}
export interface CommunityStatistics {
    communityCount: number;
    avgCommunitySize: number;
    minCommunitySize: number;
    maxCommunitySize: number;
    avgCohesion: number;
    modularity: number;
}
//# sourceMappingURL=community-detector.d.ts.map