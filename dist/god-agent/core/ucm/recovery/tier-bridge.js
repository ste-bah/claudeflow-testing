/**
 * UCM Tier Bridge
 *
 * Bridges between Hot/Warm/Cold memory tiers, managing data lifecycle
 * and retrieval across different storage layers.
 */
import { MemoryRetrievalError } from '../errors.js';
/**
 * Memory tier definitions
 */
export var MemoryTier;
(function (MemoryTier) {
    /**
     * Hot tier: Current session, in-memory
     * - Fastest access
     * - Limited capacity
     * - Volatile (lost on restart)
     */
    MemoryTier["HOT"] = "hot";
    /**
     * Warm tier: Summarized, quick retrieval
     * - Medium access speed
     * - Larger capacity
     * - Persistent storage
     */
    MemoryTier["WARM"] = "warm";
    /**
     * Cold tier: Archived, DESC-indexed
     * - Slower access (semantic search)
     * - Unlimited capacity
     * - Long-term persistence
     */
    MemoryTier["COLD"] = "cold";
})(MemoryTier || (MemoryTier = {}));
/**
 * Tier Bridge Implementation
 *
 * Manages data movement between memory tiers:
 * - Hot: In-memory Map for active context
 * - Warm: Persistent storage for recent data
 * - Cold: DESC-indexed archive for historical data
 */
export class TierBridge {
    warmAdapter;
    coldAdapter;
    // Hot tier: In-memory storage
    hotStorage = new Map();
    hotCapacityBytes = 10 * 1024 * 1024; // 10MB
    hotCurrentBytes = 0;
    // Tier statistics
    stats = new Map([
        [MemoryTier.HOT, { tier: MemoryTier.HOT, hits: 0, misses: 0, promotions: 0, demotions: 0, evictions: 0, sizeBytes: 0, itemCount: 0 }],
        [MemoryTier.WARM, { tier: MemoryTier.WARM, hits: 0, misses: 0, promotions: 0, demotions: 0, evictions: 0, sizeBytes: 0, itemCount: 0 }],
        [MemoryTier.COLD, { tier: MemoryTier.COLD, hits: 0, misses: 0, promotions: 0, demotions: 0, evictions: 0, sizeBytes: 0, itemCount: 0 }]
    ]);
    constructor(warmAdapter, coldAdapter) {
        this.warmAdapter = warmAdapter;
        this.coldAdapter = coldAdapter;
    }
    /**
     * Retrieve data from appropriate tier
     *
     * @param key - Data key
     * @returns Data and tier it was found in
     */
    async getFromTier(key) {
        // Try hot tier first
        const hotItem = this.hotStorage.get(key);
        if (hotItem) {
            this.recordAccess(MemoryTier.HOT, true);
            this.updateAccessMetadata(hotItem);
            return { data: hotItem.data, tier: MemoryTier.HOT };
        }
        this.recordAccess(MemoryTier.HOT, false);
        // Try warm tier
        if (this.warmAdapter) {
            try {
                const warmData = await this.warmAdapter.get(key);
                if (warmData !== null && warmData !== undefined) {
                    this.recordAccess(MemoryTier.WARM, true);
                    // Promote to hot on access
                    await this.promoteToHot(key, warmData);
                    return { data: warmData, tier: MemoryTier.WARM };
                }
            }
            catch (error) {
                // Continue to cold tier
            }
        }
        this.recordAccess(MemoryTier.WARM, false);
        // Try cold tier (semantic search)
        if (this.coldAdapter) {
            try {
                const results = await this.coldAdapter.search(key, 0.9);
                if (results.length > 0) {
                    this.recordAccess(MemoryTier.COLD, true);
                    const data = results[0].content;
                    // Promote to warm on access
                    await this.demoteToWarm(key, data);
                    return { data, tier: MemoryTier.COLD };
                }
            }
            catch (error) {
                // Not found in any tier
            }
        }
        this.recordAccess(MemoryTier.COLD, false);
        return null;
    }
    /**
     * Promote data to hot tier
     *
     * @param key - Data key
     * @param data - Data to store
     */
    async promoteToHot(key, data) {
        const sizeBytes = this.estimateSize(data);
        // Evict if necessary
        while (this.hotCurrentBytes + sizeBytes > this.hotCapacityBytes && this.hotStorage.size > 0) {
            await this.evictFromHot();
        }
        const item = {
            key,
            data,
            tier: MemoryTier.HOT,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now(),
            sizeBytes
        };
        this.hotStorage.set(key, item);
        this.hotCurrentBytes += sizeBytes;
        const stats = this.stats.get(MemoryTier.HOT);
        stats.promotions++;
        stats.sizeBytes = this.hotCurrentBytes;
        stats.itemCount = this.hotStorage.size;
    }
    /**
     * Demote data to warm tier
     *
     * @param key - Data key
     * @param data - Data to store
     */
    async demoteToWarm(key, data) {
        if (!this.warmAdapter) {
            throw new MemoryRetrievalError(key);
        }
        try {
            await this.warmAdapter.set(key, data);
            const stats = this.stats.get(MemoryTier.WARM);
            stats.demotions++;
            stats.itemCount++;
            stats.sizeBytes += this.estimateSize(data);
        }
        catch (error) {
            throw new MemoryRetrievalError(key, error);
        }
    }
    /**
     * Archive data to cold tier
     *
     * @param key - Data key
     * @param data - Data to archive
     */
    async archiveToCold(key, data) {
        if (!this.coldAdapter) {
            throw new MemoryRetrievalError(key);
        }
        try {
            await this.coldAdapter.index(key, data);
            const stats = this.stats.get(MemoryTier.COLD);
            stats.itemCount++;
            stats.sizeBytes += this.estimateSize(data);
        }
        catch (error) {
            throw new MemoryRetrievalError(key, error);
        }
    }
    /**
     * Get statistics for all tiers
     *
     * @returns Map of tier statistics
     */
    getStats() {
        return new Map(this.stats);
    }
    /**
     * Get statistics for specific tier
     *
     * @param tier - Memory tier
     * @returns Tier statistics
     */
    getTierStats(tier) {
        return { ...this.stats.get(tier) };
    }
    /**
     * Clear hot tier
     */
    clearHot() {
        this.hotStorage.clear();
        this.hotCurrentBytes = 0;
        const stats = this.stats.get(MemoryTier.HOT);
        stats.sizeBytes = 0;
        stats.itemCount = 0;
    }
    /**
     * Evict least recently used item from hot tier
     */
    async evictFromHot() {
        let oldestItem = null;
        let oldestKey = null;
        // Find LRU item
        for (const [key, item] of this.hotStorage.entries()) {
            if (!oldestItem || item.lastAccessed < oldestItem.lastAccessed) {
                oldestItem = item;
                oldestKey = key;
            }
        }
        if (oldestItem && oldestKey) {
            // Demote to warm tier
            if (this.warmAdapter) {
                await this.demoteToWarm(oldestKey, oldestItem.data);
            }
            this.hotStorage.delete(oldestKey);
            this.hotCurrentBytes -= oldestItem.sizeBytes;
            const stats = this.stats.get(MemoryTier.HOT);
            stats.evictions++;
            stats.sizeBytes = this.hotCurrentBytes;
            stats.itemCount = this.hotStorage.size;
        }
    }
    /**
     * Update access metadata for item
     */
    updateAccessMetadata(item) {
        item.accessCount++;
        item.lastAccessed = Date.now();
    }
    /**
     * Record tier access
     */
    recordAccess(tier, hit) {
        const stats = this.stats.get(tier);
        if (hit) {
            stats.hits++;
        }
        else {
            stats.misses++;
        }
    }
    /**
     * Estimate size of data in bytes
     */
    estimateSize(data) {
        const str = JSON.stringify(data);
        // UTF-16 encoding: 2 bytes per character
        return str.length * 2;
    }
    /**
     * Get hot tier hit rate
     */
    getHitRate(tier) {
        const stats = this.stats.get(tier);
        const total = stats.hits + stats.misses;
        return total > 0 ? stats.hits / total : 0;
    }
}
/**
 * Create a new TierBridge instance
 */
export function createTierBridge(warmAdapter, coldAdapter) {
    return new TierBridge(warmAdapter, coldAdapter);
}
//# sourceMappingURL=tier-bridge.js.map