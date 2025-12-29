/**
 * DualEmbeddingStore - SQLite-backed episode storage with cache layer
 *
 * FIXED: GAP-DESC-001, GAP-DESC-004, GAP-DESC-009
 * Implements: REQ-DESC-007, REQ-DESC-009, RULE-011, RULE-015, RULE-037, RULE-040, RULE-074
 * Implements: TASK-OBS-002 - VectorDB observability wiring
 *
 * Key changes from broken implementation:
 * - PRIMARY storage is SQLite via EpisodeDAO (RULE-011)
 * - LRUCache is used as cache layer with automatic eviction (RULE-015, RULE-037)
 * - Memory tracking via sizeCalculator (RULE-040)
 * - All store() operations write to SQLite FIRST
 * - Emits observability events for cache hit/miss and storage operations
 *
 * Constitution compliance:
 * - RULE-011: All episode data MUST be stored in SQLite
 * - RULE-015: JavaScript Maps ONLY permitted for caching with eviction (LRUCache provides this)
 * - RULE-037: Maximum 1000 episodes in memory (LRUCache default)
 * - RULE-040: Total memory overhead under 200MB (tracked via sizeCalculator)
 * - RULE-074: FORBIDDEN - In-memory Map as primary storage
 */
import type { IStoredEpisode, IEpisodeInput, IDualEmbeddingStore } from '../types.js';
import { type IDatabaseConnection } from '../../database/index.js';
/**
 * Configuration for DualEmbeddingStore
 */
export interface IDualEmbeddingStoreConfig {
    /** Path to SQLite database (uses default if not provided) */
    dbPath?: string;
    /** Maximum cache size (default: 1000) */
    cacheSize?: number;
    /** Existing database connection (optional, for testing) */
    connection?: IDatabaseConnection;
}
/**
 * DualEmbeddingStore - SQLite-backed with LRU cache layer
 *
 * ARCHITECTURE:
 * 1. SQLite (via EpisodeDAO) is the source of truth
 * 2. LRUCache provides automatic LRU eviction (TASK-DESC-005)
 * 3. All writes go to SQLite first, then cache
 * 4. Reads check cache first, fall back to SQLite (updates LRU order)
 *
 * RULE-011 COMPLIANCE: All episode data persisted to SQLite
 * RULE-015 COMPLIANCE: LRUCache provides cache-only with automatic eviction
 * RULE-037 COMPLIANCE: Maximum 1000 episodes in memory (LRUCache default)
 * RULE-040 COMPLIANCE: Memory tracking via sizeCalculator
 * RULE-074 COMPLIANCE: LRUCache is NOT primary storage
 */
export declare class DualEmbeddingStore implements IDualEmbeddingStore {
    /** Database connection for flush/close operations (RULE-046) */
    private readonly db;
    /** SQLite data access object - PRIMARY STORAGE (RULE-011) */
    private readonly dao;
    /** LRU Cache layer ONLY - NOT primary storage (RULE-015, RULE-037) */
    private readonly cache;
    /** Track if store has been closed */
    private closed;
    constructor(config?: IDualEmbeddingStoreConfig);
    /**
     * Store an episode with dual embeddings
     *
     * CRITICAL: Writes to SQLite FIRST (RULE-011)
     * Then adds to cache for read performance
     *
     * @param input - Episode data with query/answer text
     * @param queryEmbeddings - Embeddings for query chunks
     * @param answerEmbeddings - Embeddings for answer chunks
     * @returns The episodeId
     */
    storeEpisode(input: IEpisodeInput, queryEmbeddings: Float32Array[], answerEmbeddings: Float32Array[]): Promise<string>;
    /**
     * Generate unique episode ID
     */
    private generateEpisodeId;
    /**
     * Retrieve an episode by ID
     *
     * Checks cache first, falls back to SQLite
     *
     * @param episodeId - Unique episode identifier
     * @returns The stored episode or null if not found
     */
    getEpisode(episodeId: string): Promise<IStoredEpisode | null>;
    /**
     * Get all stored episodes
     *
     * Reads from SQLite (source of truth) to ensure completeness
     *
     * @returns Array of all stored episodes
     */
    getAllEpisodes(): Promise<IStoredEpisode[]>;
    /**
     * Delete an episode by ID
     *
     * RULE-016 VIOLATION: Episodes are append-only. DELETE operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @param _episodeId - Episode ID (unused - operation forbidden)
     * @throws DESCStorageError Always throws - DELETE is forbidden per RULE-016
     */
    deleteEpisode(_episodeId: string): Promise<never>;
    /**
     * Get episode count from SQLite
     */
    getEpisodeCount(): number;
    /**
     * Clear cache only - Database clearing is FORBIDDEN per RULE-016
     *
     * RULE-016 COMPLIANCE: This method only clears the in-memory cache layer.
     * Database episodes are append-only and cannot be cleared.
     * Exception: Compaction with explicit human approval requires separate implementation.
     *
     * Use this for:
     * - Memory pressure relief
     * - Cache invalidation scenarios
     * - Testing cache behavior (not database behavior)
     */
    clearCache(): Promise<void>;
    /**
     * Clear all episodes
     *
     * RULE-016 VIOLATION: Episodes are append-only. CLEAR operations are FORBIDDEN.
     * Exception: Compaction with explicit human approval (not implemented here).
     *
     * @throws DESCStorageError Always throws - CLEAR is forbidden per RULE-016
     * @deprecated Use clearCache() to clear only the cache layer
     */
    clear(): Promise<never>;
    /**
     * Get storage statistics including cache performance
     */
    getStats(): {
        episodeCount: number;
        totalQueryChunks: number;
        totalAnswerChunks: number;
        avgQueryChunksPerEpisode: number;
        avgAnswerChunksPerEpisode: number;
        cacheSize: number;
        cacheHitRate: number;
    };
    /**
     * Invalidate cache (for testing or recovery scenarios)
     *
     * Uses LRUCache.clear() which resets hits/misses internally
     */
    invalidateCache(): void;
    /**
     * Get cache metrics for monitoring
     *
     * Delegates to LRUCache.getMetrics() for accurate tracking
     * Includes eviction count and memory usage (RULE-040)
     */
    getCacheMetrics(): {
        size: number;
        maxSize: number;
        hits: number;
        misses: number;
        hitRate: number;
        evictions: number;
        memoryBytes: number;
    };
    /**
     * Force WAL checkpoint to ensure all data is persisted to disk
     *
     * Implements: RULE-046 (atomic operations)
     *
     * Call this method:
     * - Before application shutdown
     * - After critical batch operations
     * - Periodically for long-running processes
     */
    flush(): void;
    /**
     * Gracefully close the DualEmbeddingStore
     *
     * Implements: RULE-008, RULE-009 (persistence and state recovery)
     *
     * This method:
     * 1. Flushes WAL checkpoint to ensure all data is persisted
     * 2. Clears the in-memory cache
     * 3. Closes the database connection
     *
     * IMPORTANT: After close(), the store cannot be used.
     * Create a new instance if you need to continue operations.
     */
    close(): void;
    /**
     * Check if the store is healthy and operational
     *
     * Implements: RULE-049, RULE-050 (health checks and diagnostics)
     *
     * Verifies:
     * - Store is not closed
     * - Database connection is healthy
     * - Basic operations succeed
     *
     * @returns true if store is healthy, false otherwise
     */
    isHealthy(): boolean;
    /**
     * Check if the store has been closed
     *
     * @returns true if close() has been called
     */
    isClosed(): boolean;
}
//# sourceMappingURL=dual-embedding-store.d.ts.map