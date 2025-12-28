/**
 * CycleDetector - Fast cycle detection for causal hypergraphs
 * Prevents infinite loops in causal chains with <5ms performance guarantee
 */
import type { CausalLink, NodeID, CycleCheckResult } from './causal-types.js';
/**
 * Internal representation of the graph for cycle detection
 */
interface GraphStructure {
    nodes: Map<NodeID, CausalNode>;
    links: Map<string, CausalLink>;
    forwardIndex: Map<NodeID, Set<string>>;
    backwardIndex: Map<NodeID, Set<string>>;
}
interface CausalNode {
    id: NodeID;
    label: string;
    type: string;
}
/**
 * High-performance cycle detector for causal hypergraphs
 * Uses BFS with caching to achieve <5ms detection time
 */
export declare class CycleDetector {
    private cache;
    constructor(cacheSize?: number);
    /**
     * Check if adding a new causal link would create a cycle
     * Performance: <5ms per check
     *
     * @param graph - Current graph structure
     * @param newLink - Proposed causal link to add
     * @returns Result indicating if cycle would be created
     */
    wouldCreateCycle(graph: GraphStructure, newLink: CausalLink): CycleCheckResult;
    /**
     * Check if there's a directed path from source to target
     * Uses BFS with cycle detection and caching
     *
     * @param graph - Graph structure to search
     * @param sourceId - Starting node
     * @param targetId - Target node to reach
     * @returns true if path exists
     */
    hasPath(graph: GraphStructure, sourceId: NodeID, targetId: NodeID): boolean;
    /**
     * Find actual path from source to target (for cycle reporting)
     * Uses BFS with parent tracking
     *
     * @param graph - Graph structure
     * @param sourceId - Starting node
     * @param targetId - Target node
     * @returns Array of node IDs forming the path, or empty if no path
     */
    private findPath;
    /**
     * Reconstruct path from parent map
     */
    private reconstructPath;
    /**
     * Get cached result with LRU tracking
     */
    private getCached;
    /**
     * Set cached result with LRU eviction
     */
    private setCached;
    /**
     * Clear the cycle detection cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
export {};
//# sourceMappingURL=cycle-detector.d.ts.map