/**
 * Causal Chain Store
 * TASK-HYPEREDGE-001
 *
 * Stores and analyzes causal chains with cycle detection
 * Constitution: HYPER-05 - detect loops via DFS before creation
 */
import type { NodeID } from '../../graph-db/types.js';
import type { GraphDB } from '../../graph-db/graph-db.js';
import type { CausalNode, CausalChain, CausalLoop, RootCauseResult } from '../hyperedge-types.js';
/**
 * Configuration for causal store
 */
export interface CausalStoreConfig {
    /** Graph DB for storage */
    graphDB: GraphDB;
    /** Enable observability events (default: true) */
    emitEvents?: boolean;
    /** Maximum depth for root cause analysis (default: 10) */
    maxDepth?: number;
}
/**
 * Causal Chain Store
 *
 * Constitution compliance:
 * - HYPER-05: DFS loop detection before creation
 */
export declare class CausalStore {
    private readonly graphDB;
    private readonly emitEvents;
    private readonly maxDepth;
    private readonly chainCache;
    private readonly loopDetector;
    constructor(config: CausalStoreConfig);
    /**
     * Create a causal chain
     *
     * @param nodes - Causal nodes
     * @returns Created causal chain
     *
     * Constitution: HYPER-05 - validate no cycles before creation
     */
    createChain(nodes: CausalNode[]): Promise<CausalChain>;
    /**
     * Find root cause of an effect
     *
     * @param effectId - Effect node ID
     * @param maxDepth - Maximum traversal depth (optional)
     * @returns Root cause result
     */
    findRootCause(effectId: NodeID, maxDepth?: number): Promise<RootCauseResult>;
    /**
     * Detect loops in a causal chain
     *
     * @param chainId - Chain ID
     * @returns Detected loops
     *
     * Constitution: HYPER-05 - DFS-based loop detection
     */
    detectLoops(chainId: string): Promise<CausalLoop[]>;
    /**
     * Get causal chain by ID
     */
    getChainById(chainId: string): CausalChain | undefined;
    /**
     * Find chain containing a specific node
     */
    private findChainWithNode;
    /**
     * Build causal edges from node relationships
     */
    private buildEdges;
    /**
     * Calculate root cause confidence
     * Higher confidence for shorter paths and complete traversals
     */
    private calculateRootCauseConfidence;
    /**
     * Validate causal nodes
     */
    private validateNodes;
    /**
     * Clear cache (for testing/maintenance)
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        chains: number;
    };
}
//# sourceMappingURL=causal-store.d.ts.map