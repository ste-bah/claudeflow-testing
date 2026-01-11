/**
 * LEANN Source Adapter
 * Wraps LEANNBackend for quad-fusion unified search integration
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-LEANN-002
 *
 * @module src/god-agent/core/search/adapters/leann-adapter
 */
import type { SourceExecutionResult } from '../search-types.js';
import { LEANNBackend, LEANNConfig, LEANNStats } from '../../vector-db/leann-backend.js';
import { DistanceMetric } from '../../vector-db/types.js';
/**
 * Configuration options for LEANNSourceAdapter
 */
export interface LEANNAdapterConfig {
    /** LEANN backend configuration */
    leannConfig?: Partial<LEANNConfig>;
    /** Function to generate embeddings from text */
    embeddingProvider?: (text: string) => Promise<Float32Array>;
    /** Vector dimension (default: 1536) */
    dimension?: number;
    /** Distance metric (default: COSINE) */
    metric?: DistanceMetric;
    /** Existing LEANNBackend instance (if provided, ignores other config) */
    backend?: LEANNBackend;
}
/**
 * Search options specific to LEANN adapter
 */
export interface LEANNSearchOptions {
    /** Maximum results to return */
    topK?: number;
    /** Include vector data in results */
    includeVectors?: boolean;
}
/**
 * Extended metadata returned by LEANN searches
 */
export interface LEANNResultMetadata {
    /** Vector ID in LEANN backend */
    vectorId: string;
    /** Original similarity score from LEANN */
    originalSimilarity: number;
    /** Whether result came from hub cache */
    fromHubCache: boolean;
    /** Whether vector was recomputed */
    recomputed: boolean;
    /** Hub cache hit ratio at query time */
    cacheHitRatio: number;
    /** Whether this search used hub cache */
    wasHubCacheHit?: boolean;
}
/**
 * Default adapter configuration
 */
export declare const DEFAULT_LEANN_ADAPTER_CONFIG: {
    readonly dimension: 1536;
    readonly metric: DistanceMetric.COSINE;
};
/**
 * Adapter for LEANN vector similarity search
 * Implements the source adapter pattern for quad-fusion integration
 *
 * Features:
 * - Wraps LEANNBackend for unified search integration
 * - Score normalization for cosine/euclidean/dot metrics
 * - Metadata enrichment with LEANN-specific info (cache hits, etc.)
 * - Index operation for content ingestion
 */
export declare class LEANNSourceAdapter {
    /** Source identifier for quad-fusion */
    readonly name = "leann";
    private readonly backend;
    private readonly embedder?;
    private readonly dimension;
    private readonly metric;
    private readonly ownsBackend;
    /** Track hub IDs for cache hit detection */
    private hubIdsCache;
    private lastHubCacheUpdate;
    private readonly hubCacheUpdateIntervalMs;
    /**
     * Create LEANN source adapter
     *
     * @param config - Adapter configuration
     */
    constructor(config?: LEANNAdapterConfig);
    /**
     * Execute LEANN vector similarity search
     *
     * @param embedding - Query embedding (dimension must match backend)
     * @param topK - Maximum results to return
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result with LEANN metadata
     */
    search(embedding: Float32Array | undefined, topK: number, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Search by text query (generates embedding first)
     *
     * @param query - Text query
     * @param topK - Maximum results to return
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    searchByText(query: string, topK: number, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Execute the underlying LEANN search
     */
    private executeSearch;
    /**
     * Index content into LEANN backend
     *
     * @param content - Content to index (will be embedded)
     * @param metadata - Optional metadata for the content
     * @returns Vector ID of indexed content
     */
    index(content: string, metadata?: Record<string, unknown>): Promise<string>;
    /**
     * Index a pre-computed embedding
     *
     * @param id - Vector ID
     * @param embedding - Pre-computed embedding
     */
    indexEmbedding(id: string, embedding: Float32Array): void;
    /**
     * Delete a vector from the index
     *
     * @param id - Vector ID to delete
     * @returns True if deleted, false if not found
     */
    delete(id: string): boolean;
    /**
     * Get the number of vectors in the index
     */
    count(): number;
    /**
     * Get LEANN backend statistics
     */
    getStats(): LEANNStats;
    /**
     * Get the underlying LEANN backend
     * Use with caution - direct access bypasses adapter logic
     */
    getBackend(): LEANNBackend;
    /**
     * Save index to persistent storage
     *
     * @param filePath - Path to save the index
     */
    save(filePath: string): Promise<void>;
    /**
     * Load index from persistent storage
     *
     * @param filePath - Path to load the index from
     * @returns True if loaded successfully
     */
    load(filePath: string): Promise<boolean>;
    /**
     * Clear all vectors from the index
     */
    clear(): void;
    /**
     * Normalize similarity score to [0, 1] range
     *
     * Handles different distance metrics:
     * - Cosine: already [-1, 1], map to [0, 1]
     * - Dot product: similar to cosine for normalized vectors
     * - Euclidean: distance, needs inverse mapping
     * - Manhattan: distance, needs inverse mapping
     */
    private normalizeScore;
    /**
     * Update hub IDs cache periodically
     */
    private updateHubIdsCache;
    /**
     * Generate a unique vector ID
     */
    private generateVectorId;
}
/**
 * Create a LEANNSourceAdapter with default configuration
 *
 * @param embeddingProvider - Function to generate embeddings
 * @param dimension - Vector dimension (default: 1536)
 * @returns Configured LEANNSourceAdapter instance
 */
export declare function createLEANNAdapter(embeddingProvider?: (text: string) => Promise<Float32Array>, dimension?: number): LEANNSourceAdapter;
//# sourceMappingURL=leann-adapter.d.ts.map