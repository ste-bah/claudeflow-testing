/**
 * GraphDB - Hypergraph Database with Temporal Features
 * Supports hyperedges (n-ary relationships), temporal expiration, and embedding validation
 */
import type { IGraphBackend } from './graph-backend.js';
import { QueryDirection, type NodeID, type EdgeID, type HyperedgeID, type INode, type IEdge, type IHyperedge, type ITemporalHyperedge, type GraphDBOptions, type CreateNodeOptions, type CreateEdgeOptions, type CreateHyperedgeOptions, type CreateTemporalHyperedgeOptions, type QueryResult, type IIntegrityReport } from './types.js';
/**
 * Node data interface for public API
 */
export interface INodeData {
    id: string;
    key: string;
    namespace?: string;
    vectorId?: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}
/**
 * Edge data interface for public API
 */
export interface IEdgeData {
    id: string;
    type: string;
    nodeIds: string[];
    weight?: number;
    metadata?: Record<string, unknown>;
    createdAt: number;
}
/**
 * Node filter interface for public API queries
 */
export interface INodeFilter {
    namespace?: string;
    keyPattern?: string;
    createdAfter?: number;
    createdBefore?: number;
    hasVectorId?: boolean;
    limit?: number;
    offset?: number;
}
/**
 * Edge filter interface for public API queries
 */
export interface IEdgeFilter {
    nodeId?: string;
    type?: string;
}
/**
 * Complete GraphDB interface defining all public methods
 */
export interface IGraphDB {
    createNode(options: CreateNodeOptions): Promise<NodeID>;
    getNode(id: NodeID): Promise<INode>;
    updateNode(id: NodeID, properties: Record<string, unknown>): Promise<void>;
    updateEmbedding(id: NodeID, embedding: number[]): Promise<void>;
    createEdge(options: CreateEdgeOptions): Promise<EdgeID>;
    getEdges(nodeId: NodeID, direction?: QueryDirection): Promise<QueryResult<IEdge>>;
    createHyperedge(options: CreateHyperedgeOptions): Promise<HyperedgeID>;
    createTemporalHyperedge(options: CreateTemporalHyperedgeOptions): Promise<HyperedgeID>;
    getHyperedge(id: HyperedgeID): Promise<IHyperedge | ITemporalHyperedge>;
    getAllHyperedges(): Promise<(IHyperedge | ITemporalHyperedge)[]>;
    getHyperedgesByNode(nodeId: NodeID): Promise<QueryResult<IHyperedge | ITemporalHyperedge>>;
    validateIntegrity(): Promise<IIntegrityReport>;
    traverseHops(startNodeId: NodeID, hops: number): Promise<QueryResult<NodeID>>;
    nodeCount(): Promise<number>;
    edgeCount(): Promise<number>;
    clear(): Promise<void>;
    initialize(): Promise<void>;
    queryNodes(filter: INodeFilter): Promise<INodeData[]>;
    getNodeById(nodeId: string): Promise<INodeData | null>;
    getNodeByKey(key: string, namespace?: string): Promise<INodeData | null>;
    getNodesByNamespace(namespace: string): Promise<INodeData[]>;
    getAllNodes(): Promise<INodeData[]>;
    queryEdges(filter: IEdgeFilter): Promise<IEdgeData[]>;
    getEdgeById(edgeId: string): Promise<IEdgeData | null>;
    getEdgesForNode(nodeId: string): Promise<IEdgeData[]>;
    deleteNode(nodeId: string): Promise<boolean>;
    deleteEdge(edgeId: string): Promise<boolean>;
    countNodes(filter?: INodeFilter): Promise<number>;
    nodeExists(key: string, namespace?: string): Promise<boolean>;
}
/**
 * GraphDB - Main hypergraph database class
 */
export declare class GraphDB implements IGraphDB {
    private backend;
    private options;
    private static readonly ROOT_NAMESPACES;
    private static readonly GRAPH_ROOT_ID;
    constructor(backend?: IGraphBackend, options?: GraphDBOptions);
    /**
     * Initialize the database (load persisted data)
     */
    initialize(): Promise<void>;
    private extractNamespace;
    private isRootNamespace;
    private findExistingRootNode;
    private ensureGraphRoot;
    /**
     * Create a node with optional embedding
     * Enforces non-orphan constraint: first node or must link to existing node
     */
    createNode(options: CreateNodeOptions): Promise<NodeID>;
    /**
     * Get a node by ID
     */
    getNode(id: NodeID): Promise<INode>;
    /**
     * Update node properties
     */
    updateNode(id: NodeID, properties: Record<string, unknown>): Promise<void>;
    /**
     * Update node embedding
     */
    updateEmbedding(id: NodeID, embedding: number[]): Promise<void>;
    /**
     * Create a binary edge between two nodes
     */
    createEdge(options: CreateEdgeOptions): Promise<EdgeID>;
    /**
     * Get edges connected to a node
     */
    getEdges(nodeId: NodeID, direction?: QueryDirection): Promise<QueryResult<IEdge>>;
    /**
     * Create a hyperedge connecting 3+ nodes
     */
    createHyperedge(options: CreateHyperedgeOptions): Promise<HyperedgeID>;
    /**
     * Create a temporal hyperedge with expiration
     */
    createTemporalHyperedge(options: CreateTemporalHyperedgeOptions): Promise<HyperedgeID>;
    /**
     * Get hyperedge by ID
     */
    getHyperedge(id: HyperedgeID): Promise<IHyperedge | ITemporalHyperedge>;
    /**
     * Get all hyperedges in the graph
     */
    getAllHyperedges(): Promise<(IHyperedge | ITemporalHyperedge)[]>;
    /**
     * Get hyperedges connected to a node
     */
    getHyperedgesByNode(nodeId: NodeID): Promise<QueryResult<IHyperedge | ITemporalHyperedge>>;
    /**
     * Validate graph integrity
     * Returns report with orphan nodes, invalid hyperedges, expired temporal edges, etc.
     */
    validateIntegrity(): Promise<IIntegrityReport>;
    /**
     * Perform multi-hop traversal (for future query implementation)
     */
    traverseHops(startNodeId: NodeID, hops: number): Promise<QueryResult<NodeID>>;
    /**
     * Get the total number of nodes in the graph
     */
    nodeCount(): Promise<number>;
    /**
     * Get the total number of edges in the graph
     */
    edgeCount(): Promise<number>;
    /**
     * Clear all data
     */
    clear(): Promise<void>;
    /**
     * Query nodes with flexible filtering
     * @param filter - Node filter criteria
     * @returns Array of matching node data
     */
    queryNodes(filter: INodeFilter): Promise<INodeData[]>;
    /**
     * Get a single node by ID
     * @param nodeId - Node ID to retrieve
     * @returns Node data or null if not found
     */
    getNodeById(nodeId: string): Promise<INodeData | null>;
    /**
     * Get a node by key and optional namespace
     * @param key - Node key to search for
     * @param namespace - Optional namespace to filter by
     * @returns Node data or null if not found
     */
    getNodeByKey(key: string, namespace?: string): Promise<INodeData | null>;
    /**
     * Get all nodes in a namespace
     * @param namespace - Namespace to filter by
     * @returns Array of node data in the namespace
     */
    getNodesByNamespace(namespace: string): Promise<INodeData[]>;
    /**
     * Get all nodes in the database
     * Use sparingly - prefer queryNodes with filters for large datasets
     * @returns Array of all node data
     */
    getAllNodes(): Promise<INodeData[]>;
    /**
     * Query edges with flexible filtering
     * @param filter - Edge filter criteria
     * @returns Array of matching edge data
     */
    queryEdges(filter: IEdgeFilter): Promise<IEdgeData[]>;
    /**
     * Get a single edge by ID
     * @param edgeId - Edge ID to retrieve
     * @returns Edge data or null if not found
     */
    getEdgeById(edgeId: string): Promise<IEdgeData | null>;
    /**
     * Get all edges connected to a node
     * @param nodeId - Node ID to get edges for
     * @returns Array of edge data
     */
    getEdgesForNode(nodeId: string): Promise<IEdgeData[]>;
    /**
     * Delete a node and all its connected edges
     * @param nodeId - Node ID to delete
     * @returns True if deleted, false if not found
     */
    deleteNode(nodeId: string): Promise<boolean>;
    /**
     * Delete an edge
     * @param edgeId - Edge ID to delete
     * @returns True if deleted, false if not found
     */
    deleteEdge(edgeId: string): Promise<boolean>;
    /**
     * Count nodes matching the filter
     * @param filter - Optional filter criteria
     * @returns Number of matching nodes
     */
    countNodes(filter?: INodeFilter): Promise<number>;
    /**
     * Check if a node exists by key and optional namespace
     * @param key - Node key to check
     * @param namespace - Optional namespace to filter by
     * @returns True if node exists, false otherwise
     */
    nodeExists(key: string, namespace?: string): Promise<boolean>;
    /**
     * Escape special regex characters in a string
     * @param str - String to escape
     * @returns Escaped string safe for regex
     */
    private escapeRegex;
    /**
     * Type guard for temporal hyperedges
     */
    private isTemporalHyperedge;
}
//# sourceMappingURL=graph-db.d.ts.map