/**
 * God Agent Time Index Utilities
 *
 * Implements: TASK-EPISODE-002
 * Referenced by: TimeIndex
 *
 * Provides utility functions for B+ tree persistence and statistics.
 * Split from time-index.ts to comply with 500-line limit.
 */
/**
 * B+ tree node structure
 */
export interface BPlusNode {
    /** True if this is a leaf node */
    isLeaf: boolean;
    /** Timestamp keys (sorted ascending) */
    keys: number[];
    /** Episode IDs at each timestamp (leaf nodes only) */
    values?: string[][];
    /** Child node pointers (internal nodes only) */
    children?: BPlusNode[];
    /** Next leaf node (leaf nodes only, for range scans) */
    next?: BPlusNode;
    /** Previous leaf node (leaf nodes only, for bidirectional scans) */
    prev?: BPlusNode;
}
/**
 * Serialized B+ tree node structure (for persistence)
 * Omits prev/next links which are reconstructed during restore
 */
export interface SerializedBPlusNode {
    /** True if this is a leaf node */
    isLeaf: boolean;
    /** Timestamp keys (sorted ascending) */
    keys: number[];
    /** Episode IDs at each timestamp (leaf nodes only) */
    values?: string[][];
    /** Serialized child nodes (internal nodes only) */
    children?: SerializedBPlusNode[];
}
/**
 * Persisted index data structure
 */
export interface PersistedIndexData {
    order: number;
    height: number;
    size: number;
    root: SerializedBPlusNode;
}
/**
 * Index statistics for monitoring
 */
export interface IndexStats {
    /** Total number of episode references in index */
    size: number;
    /** Tree height (number of levels) */
    height: number;
    /** B+ tree order (max keys per node) */
    order: number;
    /** Number of leaf nodes */
    leafCount: number;
    /** Number of internal nodes */
    internalCount: number;
    /** Average keys per node */
    avgKeysPerNode: number;
}
/**
 * Statistics collection result
 */
export interface CollectedStats {
    leafCount: number;
    internalCount: number;
    totalKeys: number;
    totalNodes: number;
}
/**
 * Serialize node for persistence
 */
export declare function serializeNode(node: BPlusNode): SerializedBPlusNode;
/**
 * Deserialize node from JSON
 */
export declare function deserializeNode(data: SerializedBPlusNode, prevLeaf: BPlusNode | null): BPlusNode;
/**
 * Persist index to disk
 *
 * @param path - File path for serialization
 * @param order - B+ tree order
 * @param height - Tree height
 * @param size - Total episode references
 * @param root - Root node
 */
export declare function persistIndex(path: string, order: number, height: number, size: number, root: BPlusNode): void;
/**
 * Restore index from disk
 *
 * @param path - File path for deserialization
 * @returns Restored index data
 */
export declare function restoreIndex(path: string): {
    order: number;
    height: number;
    size: number;
    root: BPlusNode;
};
/**
 * Collect statistics recursively
 */
export declare function collectStats(node: BPlusNode): CollectedStats;
/**
 * Get index statistics
 */
export declare function getStats(root: BPlusNode, height: number, size: number, order: number): IndexStats;
/**
 * Find leaf node that could contain timestamp
 */
export declare function findLeafNode(node: BPlusNode, timestamp: number, findKeyIndex: (node: BPlusNode, key: number) => number): BPlusNode | undefined;
/**
 * Find index for key in node (binary search)
 */
export declare function findKeyIndex(node: BPlusNode, key: number): number;
//# sourceMappingURL=time-index-utils.d.ts.map