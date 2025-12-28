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
 * Default cache configuration optimized for >80% hit rate
 */
export const DEFAULT_CACHE_CONFIG = {
    maxSize: 1000,
    maxMemoryMB: 100,
    ttlMs: 300_000, // 5 minutes
    minAccessCount: 2,
    similarityThreshold: 0.95,
};
/**
 * GNN Cache Manager
 * Manages LRU cache with similarity-aware hashing
 */
export class GNNCacheManager {
    cache = new Map();
    config;
    evictionCount = 0;
    hits = 0;
    misses = 0;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    }
    /**
     * Generate smart cache key using embedding hash and hyperedge hash
     */
    getSmartCacheKey(embedding, hyperedges = []) {
        const embeddingHash = this.hashEmbedding(embedding);
        const hyperedgeHash = this.hashHyperedges(hyperedges);
        return `${embeddingHash}:${hyperedgeHash}`;
    }
    /**
     * Get cached entry if exists and not expired
     */
    getCachedEntry(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.ttlMs) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        // Update access metadata
        entry.accessCount++;
        entry.lastAccess = Date.now();
        this.hits++;
        return entry;
    }
    /**
     * Cache result with metadata
     */
    cacheResult(key, embedding, hyperedgeHash) {
        // Check memory limit
        const memoryBytes = embedding.byteLength;
        const totalMemory = this.getTotalMemory() + memoryBytes;
        const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
        if (totalMemory > maxMemoryBytes) {
            this.evictLRU();
        }
        // Check size limit
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }
        const entry = {
            embedding: new Float32Array(embedding),
            timestamp: Date.now(),
            accessCount: 1,
            lastAccess: Date.now(),
            hyperedgeHash,
            memoryBytes,
        };
        this.cache.set(key, entry);
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldest = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldest = key;
            }
        }
        if (oldest) {
            this.cache.delete(oldest);
            this.evictionCount++;
        }
    }
    /**
     * Get total memory used by cache
     */
    getTotalMemory() {
        let total = 0;
        for (const entry of this.cache.values()) {
            total += entry.memoryBytes;
        }
        return total;
    }
    /**
     * Invalidate cache entries matching node IDs
     */
    invalidateNodes(nodeIds) {
        const nodeSet = new Set(nodeIds);
        let invalidated = 0;
        for (const [key] of this.cache) {
            // Check if key contains any node ID
            for (const nodeId of nodeSet) {
                if (key.includes(nodeId)) {
                    this.cache.delete(key);
                    invalidated++;
                    break;
                }
            }
        }
        return invalidated;
    }
    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        const count = this.cache.size;
        this.cache.clear();
        return count;
    }
    /**
     * Clear cache and reset metrics
     */
    clearCache() {
        this.cache.clear();
        this.evictionCount = 0;
        this.hits = 0;
        this.misses = 0;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        let totalAccessCount = 0;
        let oldestTimestamp = Date.now();
        for (const entry of this.cache.values()) {
            totalAccessCount += entry.accessCount;
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
            }
        }
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            memoryBytes: this.getTotalMemory(),
            hitRate: total > 0 ? this.hits / total : 0,
            averageAccessCount: this.cache.size > 0 ? totalAccessCount / this.cache.size : 0,
            oldestEntryAge: Date.now() - oldestTimestamp,
            evictionCount: this.evictionCount,
        };
    }
    /**
     * Warm cache with pre-computed entries
     */
    async warmCache(entries) {
        let warmed = 0;
        for (const entry of entries) {
            const key = this.getSmartCacheKey(entry.embedding, entry.hyperedges);
            const hyperedgeHash = this.hashHyperedges(entry.hyperedges);
            this.cacheResult(key, entry.enhanced, hyperedgeHash);
            warmed++;
        }
        return warmed;
    }
    /**
     * Get raw metrics for observability
     */
    getMetrics() {
        return {
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictionCount,
        };
    }
    /**
     * Reset metrics counters
     */
    resetMetrics() {
        this.hits = 0;
        this.misses = 0;
        this.evictionCount = 0;
    }
    /**
     * Get cache configuration
     */
    getConfig() {
        return { ...this.config };
    }
    // =========================================================================
    // Private Helpers
    // =========================================================================
    /**
     * Hash embedding to 16-char hex string
     */
    hashEmbedding(embedding) {
        // Simple FNV-1a hash variant for fast cache key generation
        let hash = 2166136261;
        for (let i = 0; i < embedding.length; i += 4) {
            const val = Math.round(embedding[i] * 1000);
            hash ^= val;
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    /**
     * Hash hyperedge IDs to string
     */
    hashHyperedges(hyperedges) {
        if (hyperedges.length === 0)
            return 'empty';
        const sorted = [...hyperedges].sort();
        let hash = 2166136261;
        for (const id of sorted) {
            for (let i = 0; i < id.length; i++) {
                hash ^= id.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
//# sourceMappingURL=gnn-cache.js.map