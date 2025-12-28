/**
 * Causal Loop Detector
 * TASK-HYPEREDGE-001
 *
 * DFS-based cycle detection for causal chains
 * Constitution: HYPER-05 - detect loops before chain creation
 */
import type { NodeID } from '../../graph-db/types.js';
import type { CausalNode, CausalLoop } from '../hyperedge-types.js';
/**
 * Detects cycles in a directed graph using DFS
 * Constitution: HYPER-05 - DFS loop detection
 */
export declare class LoopDetector {
    private visitedNodes;
    private recursionStack;
    private detectedCycles;
    constructor();
    /**
     * Detect all cycles in a causal chain
     *
     * @param nodes - Nodes in the causal chain
     * @param chainId - Chain ID for cycle metadata
     * @returns Array of detected cycles
     *
     * Constitution: HYPER-05 - DFS-based detection
     */
    detectLoops(nodes: CausalNode[], chainId: string): CausalLoop[];
    /**
     * DFS traversal to detect cycles
     *
     * @param nodeId - Current node ID
     * @param adjacency - Adjacency list representation
     * @param chainId - Chain ID for metadata
     * @param path - Current path for cycle reconstruction
     */
    private dfsDetectCycle;
    /**
     * Build adjacency list from causal nodes
     *
     * @param nodes - Causal nodes
     * @returns Adjacency list (node -> effects)
     */
    private buildAdjacencyList;
    /**
     * Check if adding an edge would create a cycle
     * Fast check for single edge addition
     *
     * @param from - Source node ID
     * @param to - Target node ID
     * @param nodes - Existing causal nodes
     * @returns True if edge would create a cycle
     */
    wouldCreateCycle(from: NodeID, to: NodeID, nodes: CausalNode[]): boolean;
    /**
     * Check if target is reachable from source
     *
     * @param source - Source node ID
     * @param target - Target node ID
     * @param adjacency - Adjacency list
     * @param visited - Visited nodes (for cycle prevention in this check)
     * @returns True if target is reachable from source
     */
    private canReach;
}
/**
 * Validate that a causal chain has no cycles
 *
 * @param nodes - Causal nodes
 * @param chainId - Chain ID
 * @returns Validation result
 *
 * Constitution: HYPER-05 - validate before creation
 */
export declare function validateNoCycles(nodes: CausalNode[], chainId: string): {
    valid: boolean;
    cycles: CausalLoop[];
};
//# sourceMappingURL=loop-detector.d.ts.map