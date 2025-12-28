/**
 * CausalMemory - Main interface for hypergraph-based causal reasoning
 * Integrates hypergraph, traversal, and cycle detection for complete causal inference
 */
import type { MemoryEngine } from '../memory/index.js';
import type { NodeID, CausalNode, CausalLink, AddCausalLinkParams, InferenceResult, CauseFindingResult, CausalGraphStats, TraversalOptions } from './causal-types.js';
import { CausalHypergraph } from './causal-hypergraph.js';
/**
 * Configuration for CausalMemory
 */
export interface CausalMemoryConfig {
    /** Key for persisting graph in MemoryEngine */
    storageKey?: string;
    /** Auto-save after operations */
    autoSave?: boolean;
    /** Enable performance tracking */
    trackPerformance?: boolean;
}
/**
 * Main causal reasoning engine with persistence
 * Provides high-level API for causal inference and analysis
 */
export declare class CausalMemory {
    private graph;
    private traversal;
    private memoryEngine;
    private config;
    private initialized;
    constructor(memoryEngine: MemoryEngine, config?: CausalMemoryConfig);
    /**
     * Initialize CausalMemory by loading persisted graph
     * Must be called before using the instance
     */
    initialize(): Promise<void>;
    /**
     * Ensure initialized before operations
     */
    private ensureInitialized;
    /**
     * Add a new node to the causal graph
     *
     * @param node - Causal node to add
     */
    addNode(node: CausalNode): Promise<void>;
    /**
     * Add a causal link (hyperedge) to the graph
     * Validates nodes exist and checks for cycles
     *
     * @param params - Link parameters
     * @returns The created causal link
     * @throws Error if validation fails or cycle detected
     */
    addCausalLink(params: AddCausalLinkParams): Promise<CausalLink>;
    /**
     * Infer consequences (effects) from given conditions (causes)
     * Uses forward traversal through the causal graph
     *
     * @param conditions - Array of cause node IDs
     * @param maxDepth - Maximum traversal depth (default: 5)
     * @param options - Additional traversal options
     * @returns Inference result with predicted effects and causal chains
     */
    inferConsequences(conditions: NodeID[], maxDepth?: number, options?: Omit<TraversalOptions, 'maxDepth' | 'direction'>): Promise<InferenceResult>;
    /**
     * Find possible causes for a given effect
     * Uses backward traversal through the causal graph
     *
     * @param effect - Effect node ID
     * @param maxDepth - Maximum traversal depth (default: 5)
     * @param options - Additional traversal options
     * @returns Cause finding result with identified causes and causal chains
     */
    findCauses(effect: NodeID, maxDepth?: number, options?: Omit<TraversalOptions, 'maxDepth' | 'direction'>): Promise<CauseFindingResult>;
    /**
     * Get a node by ID
     */
    getNode(nodeId: NodeID): CausalNode | undefined;
    /**
     * Get a link by ID
     */
    getLink(linkId: string): CausalLink | undefined;
    /**
     * Get all nodes in the graph
     */
    getNodes(): CausalNode[];
    /**
     * Get all links in the graph
     */
    getLinks(): CausalLink[];
    /**
     * Get nodes by type
     */
    getNodesByType(type: 'concept' | 'action' | 'state'): CausalNode[];
    /**
     * Get outgoing links from a node
     */
    getOutgoingLinks(nodeId: NodeID): CausalLink[];
    /**
     * Get incoming links to a node
     */
    getIncomingLinks(nodeId: NodeID): CausalLink[];
    /**
     * Update an existing node
     */
    updateNode(nodeId: NodeID, updates: Partial<Omit<CausalNode, 'id'>>): Promise<void>;
    /**
     * Update an existing link
     */
    updateLink(linkId: string, updates: Partial<Omit<CausalLink, 'id' | 'causes' | 'effects'>>): Promise<void>;
    /**
     * Remove a node and all connected links
     */
    removeNode(nodeId: NodeID): Promise<void>;
    /**
     * Remove a link
     */
    removeLink(linkId: string): Promise<void>;
    /**
     * Get statistics about the causal graph
     */
    getStats(): CausalGraphStats;
    /**
     * Search for nodes by label (case-insensitive partial match)
     */
    searchNodes(query: string): CausalNode[];
    /**
     * Find all nodes that are root causes (no incoming links)
     */
    getRootCauses(): CausalNode[];
    /**
     * Find all nodes that are terminal effects (no outgoing links)
     */
    getTerminalEffects(): CausalNode[];
    /**
     * Persist the causal graph to memory
     */
    persist(): Promise<void>;
    /**
     * Clear all data from the causal graph
     */
    clear(): Promise<void>;
    /**
     * Export the graph as JSON
     */
    export(): string;
    /**
     * Import a graph from JSON
     */
    import(jsonData: string): Promise<void>;
    /**
     * Get the underlying hypergraph (for advanced use)
     */
    getHypergraph(): CausalHypergraph;
    /**
     * Validate graph integrity
     * Checks for orphaned links, invalid references, etc.
     */
    validateIntegrity(): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=causal-memory.d.ts.map