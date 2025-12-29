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
import { getObservabilityBus } from '../../observability/bus.js';
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
export class LRUCache {
    /** Internal cache storage (maintains insertion order) */
    cache;
    /** Maximum number of items */
    maxSize;
    /** Maximum memory in bytes (optional) */
    maxMemoryBytes;
    /** Function to calculate value size */
    sizeCalculator;
    /** Callback when item is evicted */
    onEvict;
    /** Cache name for observability events */
    cacheName;
    /** Whether to emit observability events (default: true) */
    emitEvents;
    /** Metrics tracking */
    hits = 0;
    misses = 0;
    evictions = 0;
    totalMemoryBytes = 0;
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
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 1000; // RULE-037: Maximum 1000 episodes
        this.maxMemoryBytes = options.maxMemoryBytes ?? null;
        this.sizeCalculator = options.sizeCalculator ?? null;
        this.onEvict = options.onEvict ?? null;
        this.cacheName = options.name ?? 'lru_cache';
        this.emitEvents = options.emitEvents ?? true;
        this.cache = new Map();
    }
    /**
     * Get a value from the cache
     *
     * Updates access order (moves to most recent position)
     *
     * @param key - The key to look up
     * @returns The value or undefined if not found
     */
    get(key) {
        const entry = this.cache.get(key);
        if (entry === undefined) {
            this.misses++;
            return undefined;
        }
        this.hits++;
        // Move to end (most recent) by delete + set
        // This is O(1) in V8's Map implementation
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }
    /**
     * Set a value in the cache
     *
     * Evicts LRU items if size limit is reached
     *
     * @param key - The key to store
     * @param value - The value to store
     */
    set(key, value) {
        // Calculate size of new entry
        const sizeBytes = this.sizeCalculator ? this.sizeCalculator(value) : 0;
        // If key exists, remove it first (will be re-added at end)
        if (this.cache.has(key)) {
            const existing = this.cache.get(key);
            this.totalMemoryBytes -= existing.sizeBytes;
            this.cache.delete(key);
        }
        // Evict if at capacity
        while (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        // Evict if memory limit exceeded
        if (this.maxMemoryBytes !== null) {
            while (this.totalMemoryBytes + sizeBytes > this.maxMemoryBytes && this.cache.size > 0) {
                this.evictLRU();
            }
        }
        // Add new entry at end (most recent position)
        this.cache.set(key, { value, sizeBytes });
        this.totalMemoryBytes += sizeBytes;
    }
    /**
     * Check if a key exists in the cache
     *
     * Does NOT update access order (peek operation)
     *
     * @param key - The key to check
     * @returns true if the key exists
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Peek at a value without updating access order
     *
     * @param key - The key to peek
     * @returns The value or undefined if not found
     */
    peek(key) {
        const entry = this.cache.get(key);
        return entry?.value;
    }
    /**
     * Delete a key from the cache
     *
     * @param key - The key to delete
     * @returns true if the key was deleted
     */
    delete(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.totalMemoryBytes -= entry.sizeBytes;
            return this.cache.delete(key);
        }
        return false;
    }
    /**
     * Clear all items from the cache
     */
    clear() {
        this.cache.clear();
        this.totalMemoryBytes = 0;
        this.hits = 0;
        this.misses = 0;
        // Note: evictions count is preserved for historical tracking
    }
    /**
     * Evict the least recently used item
     *
     * The first item in the Map is the LRU (oldest access)
     */
    evictLRU() {
        // Get first key (LRU - least recently used)
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
            const entry = this.cache.get(firstKey);
            if (entry) {
                // Update memory tracking
                this.totalMemoryBytes -= entry.sizeBytes;
                // Notify callback before deletion
                if (this.onEvict) {
                    this.onEvict(firstKey, entry.value);
                }
                // Remove from cache
                this.cache.delete(firstKey);
                this.evictions++;
                // Emit eviction event for observability
                if (this.emitEvents) {
                    try {
                        const bus = getObservabilityBus();
                        bus.emit({
                            component: 'vectordb',
                            operation: 'vectordb_cache_eviction',
                            status: 'success',
                            metadata: {
                                cacheName: this.cacheName,
                                evictedKey: String(firstKey),
                                sizeBytes: entry.sizeBytes,
                                totalEvictions: this.evictions,
                                cacheSize: this.cache.size,
                                memoryBytes: this.totalMemoryBytes
                            }
                        });
                    }
                    catch {
                        // INTENTIONAL: Observability emit failure - silently ignore to avoid disrupting cache operations
                    }
                }
            }
        }
    }
    /**
     * Get current cache size
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Get all keys (in LRU order - oldest first)
     */
    keys() {
        return this.cache.keys();
    }
    /**
     * Get all values (in LRU order - oldest first)
     */
    values() {
        return (function* (cache) {
            for (const entry of cache.values()) {
                yield entry.value;
            }
        })(this.cache);
    }
    /**
     * Get all entries (in LRU order - oldest first)
     */
    entries() {
        return (function* (cache) {
            for (const [key, entry] of cache.entries()) {
                yield [key, entry.value];
            }
        })(this.cache);
    }
    /**
     * Get cache metrics for monitoring
     *
     * Implements: RULE-049, RULE-050 (health checks and diagnostics)
     */
    getMetrics() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            evictions: this.evictions,
            memoryBytes: this.totalMemoryBytes
        };
    }
    /**
     * Reset metrics (useful for monitoring intervals)
     */
    resetMetrics() {
        this.hits = 0;
        this.misses = 0;
        // Note: evictions count is preserved for historical tracking
    }
    /**
     * Get approximate memory usage in bytes
     *
     * Implements: RULE-040 (memory overhead under 200MB)
     */
    getMemoryUsage() {
        return this.totalMemoryBytes;
    }
    /**
     * Check if cache is at capacity
     */
    isFull() {
        return this.cache.size >= this.maxSize;
    }
    /**
     * Iterate over cache entries (for testing/debugging)
     */
    forEach(callback) {
        for (const [key, entry] of this.cache.entries()) {
            callback(entry.value, key);
        }
    }
}
/**
 * Create a size calculator for IStoredEpisode objects
 *
 * Estimates memory usage based on embedding dimensions
 */
export function createEpisodeSizeCalculator() {
    return (episode) => {
        // Base object overhead
        let size = 500;
        // Query embeddings (Float32Array = 4 bytes per float)
        for (const emb of episode.queryChunkEmbeddings) {
            size += emb.length * 4 + 16; // Array overhead
        }
        // Answer embeddings
        for (const emb of episode.answerChunkEmbeddings) {
            size += emb.length * 4 + 16;
        }
        return size;
    };
}
//# sourceMappingURL=lru-cache.js.map