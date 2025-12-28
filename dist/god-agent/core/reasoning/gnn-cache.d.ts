/**
 * GNN Cache Manager - Extracted from GNNEnhancer
 *
 * Provides LRU cache with similarity-aware key hashing
 * for GNN-enhanced embeddings.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-002 (cache optimization)
 *
 * @module src/god-agent/core/reasoning/gnn-cache
 */
/**
 * Cache entry storing enhanced embedding with metadata
 */
export interface ICacheEntry {
    embedding: Float32Array;
    timestamp: number;
    accessCount: number;
    lastAccess: number;
    hyperedgeHash: string;
    memoryBytes: number;
}
/**
 * Cache configuration
 */
export interface ICacheConfig {
    maxSize: number;
    maxMemoryMB: number;
    ttlMs: number;
    minAccessCount: number;
    similarityThreshold: number;
}
/**
 * Default cache configuration optimized for >80% hit rate
 */
export declare const DEFAULT_CACHE_CONFIG: ICacheConfig;
/**
 * Cache statistics for observability
 */
export interface ICacheStats {
    size: number;
    memoryBytes: number;
    hitRate: number;
    averageAccessCount: number;
    oldestEntryAge: number;
    evictionCount: number;
}
/**
 * GNN Cache Manager
 * Manages LRU cache with similarity-aware hashing
 */
export declare class GNNCacheManager {
    private cache;
    private config;
    private evictionCount;
    private hits;
    private misses;
    constructor(config?: Partial<ICacheConfig>);
    /**
     * Generate smart cache key using embedding hash and hyperedge hash
     */
    getSmartCacheKey(embedding: Float32Array, hyperedges?: string[]): string;
    /**
     * Get cached entry if exists and not expired
     */
    getCachedEntry(key: string): ICacheEntry | undefined;
    /**
     * Cache result with metadata
     */
    cacheResult(key: string, embedding: Float32Array, hyperedgeHash: string): void;
    /**
     * Evict least recently used entry
     */
    evictLRU(): void;
    /**
     * Get total memory used by cache
     */
    getTotalMemory(): number;
    /**
     * Invalidate cache entries matching node IDs
     */
    invalidateNodes(nodeIds: string[]): number;
    /**
     * Invalidate all cache entries
     */
    invalidateAll(): number;
    /**
     * Clear cache and reset metrics
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): ICacheStats;
    /**
     * Warm cache with pre-computed entries
     */
    warmCache(entries: Array<{
        embedding: Float32Array;
        hyperedges: string[];
        enhanced: Float32Array;
    }>): Promise<number>;
    /**
     * Get raw metrics for observability
     */
    getMetrics(): {
        hits: number;
        misses: number;
        evictions: number;
    };
    /**
     * Reset metrics counters
     */
    resetMetrics(): void;
    /**
     * Get cache configuration
     */
    getConfig(): ICacheConfig;
    /**
     * Hash embedding to 16-char hex string
     */
    private hashEmbedding;
    /**
     * Hash hyperedge IDs to string
     */
    private hashHyperedges;
}
//# sourceMappingURL=gnn-cache.d.ts.map