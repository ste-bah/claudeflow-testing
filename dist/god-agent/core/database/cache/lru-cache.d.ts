/**
 * LRUCache - Least Recently Used Cache Implementation
 *
 * Implements: TASK-DESC-005, REQ-DESC-009, GAP-DESC-009, TASK-OBS-002
 * Constitution: RULE-037, RULE-040
 *
 * Key features:
 * - O(1) get/set operations using Map's insertion order
 * - Automatic eviction when maxSize reached
 * - Memory usage tracking for budget compliance (RULE-040)
 * - Hit/miss metrics for monitoring
 * - Observability events for cache operations (TASK-OBS-002)
 */
/**
 * LRU Cache metrics for monitoring
 */
export interface ILRUCacheMetrics {
    /** Current number of items in cache */
    size: number;
    /** Maximum allowed items */
    maxSize: number;
    /** Number of cache hits */
    hits: number;
    /** Number of cache misses */
    misses: number;
    /** Hit rate (0.0 - 1.0) */
    hitRate: number;
    /** Total evictions performed */
    evictions: number;
    /** Approximate memory usage in bytes */
    memoryBytes: number;
}
/**
 * Callback for eviction events
 */
export type EvictionCallback<K, V> = (key: K, value: V) => void;
/**
 * Size calculator for values
 */
export type SizeCalculator<V> = (value: V) => number;
/**
 * LRUCache - Generic LRU cache with size limits
 *
 * Uses JavaScript Map's insertion order guarantee for O(1) LRU operations:
 * - Map maintains insertion order
 * - Delete + set moves entry to end (most recent)
 * - First entry is always LRU (least recent)
 *
 * RULE-037 COMPLIANCE: Maximum 1000 episodes in memory
 * RULE-040 COMPLIANCE: Total memory overhead under 200MB
 */
export declare class LRUCache<K, V> {
    /** Internal cache storage (maintains insertion order) */
    private readonly cache;
    /** Maximum number of items */
    private readonly maxSize;
    /** Maximum memory in bytes (optional) */
    private readonly maxMemoryBytes;
    /** Function to calculate value size */
    private readonly sizeCalculator;
    /** Callback when item is evicted */
    private readonly onEvict;
    /** Cache name for observability events */
    private readonly cacheName;
    /** Whether to emit observability events (default: true) */
    private readonly emitEvents;
    /** Metrics tracking */
    private hits;
    private misses;
    private evictions;
    private totalMemoryBytes;
    /**
     * Create a new LRU cache
     *
     * @param options - Cache configuration
     * @param options.maxSize - Maximum number of items (default: 1000, per RULE-037)
     * @param options.maxMemoryBytes - Optional memory limit in bytes
     * @param options.sizeCalculator - Optional function to calculate value size
     * @param options.onEvict - Optional callback when items are evicted
     * @param options.name - Cache name for observability events (default: 'lru_cache')
     * @param options.emitEvents - Whether to emit observability events (default: true)
     */
    constructor(options?: {
        maxSize?: number;
        maxMemoryBytes?: number;
        sizeCalculator?: SizeCalculator<V>;
        onEvict?: EvictionCallback<K, V>;
        name?: string;
        emitEvents?: boolean;
    });
    /**
     * Get a value from the cache
     *
     * Updates access order (moves to most recent position)
     *
     * @param key - The key to look up
     * @returns The value or undefined if not found
     */
    get(key: K): V | undefined;
    /**
     * Set a value in the cache
     *
     * Evicts LRU items if size limit is reached
     *
     * @param key - The key to store
     * @param value - The value to store
     */
    set(key: K, value: V): void;
    /**
     * Check if a key exists in the cache
     *
     * Does NOT update access order (peek operation)
     *
     * @param key - The key to check
     * @returns true if the key exists
     */
    has(key: K): boolean;
    /**
     * Peek at a value without updating access order
     *
     * @param key - The key to peek
     * @returns The value or undefined if not found
     */
    peek(key: K): V | undefined;
    /**
     * Delete a key from the cache
     *
     * @param key - The key to delete
     * @returns true if the key was deleted
     */
    delete(key: K): boolean;
    /**
     * Clear all items from the cache
     */
    clear(): void;
    /**
     * Evict the least recently used item
     *
     * The first item in the Map is the LRU (oldest access)
     */
    private evictLRU;
    /**
     * Get current cache size
     */
    get size(): number;
    /**
     * Get all keys (in LRU order - oldest first)
     */
    keys(): IterableIterator<K>;
    /**
     * Get all values (in LRU order - oldest first)
     */
    values(): IterableIterator<V>;
    /**
     * Get all entries (in LRU order - oldest first)
     */
    entries(): IterableIterator<[K, V]>;
    /**
     * Get cache metrics for monitoring
     *
     * Implements: RULE-049, RULE-050 (health checks and diagnostics)
     */
    getMetrics(): ILRUCacheMetrics;
    /**
     * Reset metrics (useful for monitoring intervals)
     */
    resetMetrics(): void;
    /**
     * Get approximate memory usage in bytes
     *
     * Implements: RULE-040 (memory overhead under 200MB)
     */
    getMemoryUsage(): number;
    /**
     * Check if cache is at capacity
     */
    isFull(): boolean;
    /**
     * Iterate over cache entries (for testing/debugging)
     */
    forEach(callback: (value: V, key: K) => void): void;
}
/**
 * Create a size calculator for IStoredEpisode objects
 *
 * Estimates memory usage based on embedding dimensions
 */
export declare function createEpisodeSizeCalculator(): SizeCalculator<{
    queryChunkEmbeddings: Float32Array[];
    answerChunkEmbeddings: Float32Array[];
}>;
//# sourceMappingURL=lru-cache.d.ts.map