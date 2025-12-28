/**
 * UCM Tier Bridge
 *
 * Bridges between Hot/Warm/Cold memory tiers, managing data lifecycle
 * and retrieval across different storage layers.
 */
/**
 * Memory tier definitions
 */
export declare enum MemoryTier {
    /**
     * Hot tier: Current session, in-memory
     * - Fastest access
     * - Limited capacity
     * - Volatile (lost on restart)
     */
    HOT = "hot",
    /**
     * Warm tier: Summarized, quick retrieval
     * - Medium access speed
     * - Larger capacity
     * - Persistent storage
     */
    WARM = "warm",
    /**
     * Cold tier: Archived, DESC-indexed
     * - Slower access (semantic search)
     * - Unlimited capacity
     * - Long-term persistence
     */
    COLD = "cold"
}
/**
 * Tier access statistics
 */
export interface ITierStats {
    tier: MemoryTier;
    hits: number;
    misses: number;
    promotions: number;
    demotions: number;
    evictions: number;
    sizeBytes: number;
    itemCount: number;
}
/**
 * Tier Bridge Implementation
 *
 * Manages data movement between memory tiers:
 * - Hot: In-memory Map for active context
 * - Warm: Persistent storage for recent data
 * - Cold: DESC-indexed archive for historical data
 */
export declare class TierBridge {
    private readonly warmAdapter?;
    private readonly coldAdapter?;
    private hotStorage;
    private hotCapacityBytes;
    private hotCurrentBytes;
    private stats;
    constructor(warmAdapter?: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
    } | undefined, coldAdapter?: {
        search: (query: string, threshold: number) => Promise<Array<{
            key: string;
            content: unknown;
            score: number;
        }>>;
        index: (key: string, content: unknown) => Promise<void>;
    } | undefined);
    /**
     * Retrieve data from appropriate tier
     *
     * @param key - Data key
     * @returns Data and tier it was found in
     */
    getFromTier<T>(key: string): Promise<{
        data: T;
        tier: MemoryTier;
    } | null>;
    /**
     * Promote data to hot tier
     *
     * @param key - Data key
     * @param data - Data to store
     */
    promoteToHot<T>(key: string, data: T): Promise<void>;
    /**
     * Demote data to warm tier
     *
     * @param key - Data key
     * @param data - Data to store
     */
    demoteToWarm<T>(key: string, data: T): Promise<void>;
    /**
     * Archive data to cold tier
     *
     * @param key - Data key
     * @param data - Data to archive
     */
    archiveToCold<T>(key: string, data: T): Promise<void>;
    /**
     * Get statistics for all tiers
     *
     * @returns Map of tier statistics
     */
    getStats(): Map<MemoryTier, ITierStats>;
    /**
     * Get statistics for specific tier
     *
     * @param tier - Memory tier
     * @returns Tier statistics
     */
    getTierStats(tier: MemoryTier): ITierStats;
    /**
     * Clear hot tier
     */
    clearHot(): void;
    /**
     * Evict least recently used item from hot tier
     */
    private evictFromHot;
    /**
     * Update access metadata for item
     */
    private updateAccessMetadata;
    /**
     * Record tier access
     */
    private recordAccess;
    /**
     * Estimate size of data in bytes
     */
    private estimateSize;
    /**
     * Get hot tier hit rate
     */
    getHitRate(tier: MemoryTier): number;
}
/**
 * Create a new TierBridge instance
 */
export declare function createTierBridge(warmAdapter?: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
}, coldAdapter?: {
    search: (query: string, threshold: number) => Promise<Array<{
        key: string;
        content: unknown;
        score: number;
    }>>;
    index: (key: string, content: unknown) => Promise<void>;
}): TierBridge;
//# sourceMappingURL=tier-bridge.d.ts.map