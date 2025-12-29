/**
 * HNSW Graph Node
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Referenced by: HNSWIndex
 *
 * Represents a single node in the HNSW graph structure.
 * Each node has connections at multiple levels forming a navigable small world graph.
 */
/**
 * Node in the HNSW graph
 *
 * Each node stores:
 * - Unique identifier
 * - Reference to vector data (stored separately for memory efficiency)
 * - Maximum level in the hierarchy (0 = bottom level only)
 * - Connections at each level (neighbors)
 */
export declare class HNSWNode {
    /** Unique node identifier */
    readonly id: string;
    /** Maximum level this node appears at (0-indexed) */
    level: number;
    /** Neighbors at each level: level -> Set of neighbor IDs */
    readonly connections: Map<number, Set<string>>;
    /**
     * Create a new HNSW node
     *
     * @param id - Unique identifier for the node
     * @param level - Maximum level this node will appear at
     */
    constructor(id: string, level?: number);
    /**
     * Add a connection to a neighbor at a specific level
     *
     * @param level - The level at which to add the connection
     * @param neighborId - The ID of the neighbor node
     */
    addConnection(level: number, neighborId: string): void;
    /**
     * Remove a connection to a neighbor at a specific level
     *
     * @param level - The level at which to remove the connection
     * @param neighborId - The ID of the neighbor node
     * @returns true if the connection was removed, false if it didn't exist
     */
    removeConnection(level: number, neighborId: string): boolean;
    /**
     * Get all neighbors at a specific level
     *
     * @param level - The level to get neighbors from
     * @returns Set of neighbor IDs (empty set if level doesn't exist)
     */
    getNeighbors(level: number): Set<string>;
    /**
     * Get the number of connections at a specific level
     *
     * @param level - The level to count connections at
     * @returns Number of connections
     */
    getConnectionCount(level: number): number;
    /**
     * Check if this node has a connection to another node at a level
     *
     * @param level - The level to check
     * @param neighborId - The ID of the potential neighbor
     * @returns true if connected
     */
    isConnected(level: number, neighborId: string): boolean;
    /**
     * Get the total number of connections across all levels
     *
     * @returns Total connection count
     */
    getTotalConnections(): number;
    /**
     * Clear all connections at a specific level
     *
     * @param level - The level to clear
     */
    clearLevel(level: number): void;
    /**
     * Serialize the node for persistence
     *
     * @returns Serialized node data
     */
    serialize(): {
        id: string;
        level: number;
        connections: Array<[number, string[]]>;
    };
    /**
     * Deserialize a node from persistence data
     *
     * @param data - Serialized node data
     * @returns Reconstructed node
     */
    static deserialize(data: {
        id: string;
        level: number;
        connections: Array<[number, string[]]>;
    }): HNSWNode;
}
//# sourceMappingURL=hnsw-node.d.ts.map