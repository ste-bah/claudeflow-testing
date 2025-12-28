/**
 * God Agent Time Index Implementation (B+ Tree)
 *
 * Implements: TASK-EPISODE-002
 * Referenced by: EpisodeStore
 *
 * Provides efficient time-based indexing using B+ tree structure:
 * - O(log n) insert/remove operations
 * - O(log n + k) range queries
 * - Leaf node linking for fast sequential access
 * - Handles ongoing episodes (null endTime as infinity)
 */
import { IndexStats } from './time-index-utils.js';
/**
 * TimeIndex - B+ tree implementation for temporal episode indexing
 *
 * Performance targets:
 * - Insert: <1ms p95
 * - Remove: <1ms p95
 * - Range query (10): <2ms p95
 * - Range query (100): <5ms p95
 * - Range query (1k): <20ms p95
 * - Nearest (k=10): <3ms p95
 * - Memory: <100KB for 100k episodes
 */
export declare class TimeIndex {
    private root;
    private readonly order;
    private height;
    private size;
    constructor(order?: number);
    /**
     * Insert episode at timestamp
     *
     * @param timestamp - Episode timestamp (Unix ms)
     * @param episodeId - Episode UUID
     */
    insert(timestamp: number, episodeId: string): void;
    /**
     * Insert into a node that is not full
     */
    private insertNonFull;
    /**
     * Split a full child node
     *
     * @param parent - Parent node
     * @param childIndex - Index of child to split
     */
    private splitChild;
    /**
     * Remove episode at timestamp
     *
     * @param timestamp - Episode timestamp
     * @param episodeId - Episode UUID to remove
     * @returns True if episode was found and removed
     */
    remove(timestamp: number, episodeId: string): boolean;
    /**
     * Remove episode from node (recursive)
     */
    private removeFromNode;
    /**
     * Rebalance child node (delegates to balancing module)
     */
    private rebalanceChild;
    /**
     * Find index for key in node (binary search)
     */
    private findKeyIndex;
    /**
     * Query episodes in time range
     *
     * @param start - Start timestamp (inclusive)
     * @param end - End timestamp (inclusive, Infinity for ongoing episodes)
     * @returns Array of episode IDs in chronological order
     */
    queryRange(start: number, end: number): string[];
    /**
     * Find leaf node that could contain timestamp
     */
    private findLeafNode;
    /**
     * Get k nearest episodes to timestamp
     *
     * @param timestamp - Target timestamp
     * @param k - Number of nearest episodes
     * @returns Array of episode IDs, sorted by distance to timestamp
     */
    getNearest(timestamp: number, k: number): string[];
    /**
     * Rebalance tree (currently no-op, balancing happens during insert/remove)
     */
    rebalance(): void;
    /**
     * Persist index to disk
     *
     * @param path - File path for serialization
     */
    persist(path: string): void;
    /**
     * Restore index from disk
     *
     * @param path - File path for deserialization
     */
    restore(path: string): void;
    /**
     * Get index statistics
     */
    getStats(): IndexStats;
    /**
     * Get total number of episode references
     */
    getSize(): number;
    /**
     * Get tree height
     */
    getHeight(): number;
    /**
     * Clear all data from index
     */
    clear(): void;
}
export type { IndexStats } from './time-index-utils.js';
//# sourceMappingURL=time-index.d.ts.map