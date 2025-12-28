/**
 * CausalHypergraph - Core data structure for causal reasoning
 * Supports hyperedges with multiple causes and effects (A+B+C→D+E)
 * Maintains bidirectional indices for efficient traversal
 */
import type { NodeID, CausalNode, CausalLink, AddCausalLinkParams, SerializedCausalGraph, CausalGraphStats } from './causal-types.js';
/**
 * Hypergraph data structure for causal relationships
 * Supports multi-cause, multi-effect relationships with efficient indexing
 */
export declare class CausalHypergraph {
    /** All nodes in the graph */
    private nodes;
    /** All causal links (hyperedges) */
    private links;
    /** Forward index: node → outgoing link IDs */
    private forwardIndex;
    /** Backward index: node → incoming link IDs */
    private backwardIndex;
    /** Cycle detector for preventing infinite loops */
    private cycleDetector;
    constructor();
    /**
     * Add a new node to the graph
     *
     * @param node - Causal node to add
     * @throws Error if node with same ID already exists
     */
    addNode(node: CausalNode): void;
    /**
     * Add a causal link (hyperedge) to the graph
     * Validates that all cause and effect nodes exist
     * Checks for cycles before adding
     *
     * @param params - Link parameters
     * @returns The created causal link
     * @throws Error if nodes don't exist or cycle would be created
     */
    addCausalLink(params: AddCausalLinkParams): CausalLink;
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
     * Get all outgoing links from a node
     */
    getOutgoingLinks(nodeId: NodeID): CausalLink[];
    /**
     * Get all incoming links to a node
     */
    getIncomingLinks(nodeId: NodeID): CausalLink[];
    /**
     * Update an existing node
     */
    updateNode(nodeId: NodeID, updates: Partial<Omit<CausalNode, 'id'>>): void;
    /**
     * Update an existing link
     */
    updateLink(linkId: string, updates: Partial<Omit<CausalLink, 'id' | 'causes' | 'effects'>>): void;
    /**
     * Remove a node and all connected links
     */
    removeNode(nodeId: NodeID): void;
    /**
     * Remove a link from the graph
     */
    removeLink(linkId: string): void;
    /**
     * Get statistics about the graph
     */
    getStats(): CausalGraphStats;
    /**
     * Serialize graph to JSON for persistence
     */
    toJSON(): SerializedCausalGraph;
    /**
     * Deserialize graph from JSON
     */
    static fromJSON(data: SerializedCausalGraph): CausalHypergraph;
    /**
     * Clear all data from the graph
     */
    clear(): void;
    /**
     * Get internal structure for traversal (used by CycleDetector and CausalTraversal)
     */
    getGraphStructure(): {
        nodes: Map<string, CausalNode>;
        links: Map<string, CausalLink>;
        forwardIndex: Map<string, Set<string>>;
        backwardIndex: Map<string, Set<string>>;
    };
}
//# sourceMappingURL=causal-hypergraph.d.ts.map