/**
 * CausalTraversal - BFS-based bidirectional traversal for causal reasoning
 * Supports forward inference (find effects) and backward analysis (find causes)
 * Performance: <15ms for 5-hop traversal
 */
import type { NodeID, CausalLink, CausalChain, TraversalOptions, InferenceResult, CauseFindingResult } from './causal-types.js';
/**
 * Internal graph structure for traversal
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
 * High-performance bidirectional causal traversal engine
 */
export declare class CausalTraversal {
    /**
     * Traverse forward from start nodes to find effects
     * Uses BFS to explore causal chains in the forward direction
     *
     * @param graph - Graph structure to traverse
     * @param startNodes - Starting node IDs (causes)
     * @param options - Traversal options
     * @returns Inference result with predicted effects and chains
     */
    traverseForward(graph: GraphStructure, startNodes: NodeID[], options?: TraversalOptions): InferenceResult;
    /**
     * Traverse backward from effect nodes to find causes
     * Uses BFS to explore causal chains in reverse
     *
     * @param graph - Graph structure to traverse
     * @param effectNodes - Starting effect node IDs
     * @param options - Traversal options
     * @returns Cause finding result with identified causes and chains
     */
    traverseBackward(graph: GraphStructure, effectNodes: NodeID[], options?: TraversalOptions): CauseFindingResult;
    /**
     * Calculate overall confidence of a causal chain
     * Uses product of individual link confidences
     *
     * @param chain - Array of causal links
     * @returns Combined confidence [0.0, 1.0]
     */
    calculateChainConfidence(chain: CausalLink[]): number;
    /**
     * Build human-readable explanation of causal chain
     *
     * @param graph - Graph structure for node labels
     * @param chain - Causal chain to explain
     * @returns Explanation string
     */
    buildChainExplanation(graph: GraphStructure, chain: CausalChain): string;
    /**
     * Check if adding a link would create a cycle in the chain
     */
    private wouldCreateCycle;
    /**
     * Add a complete chain to the state
     */
    private addChain;
}
export {};
//# sourceMappingURL=causal-traversal.d.ts.map