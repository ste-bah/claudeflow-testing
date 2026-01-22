/**
 * LEANN (Lazy-Evaluated Approximate Nearest Neighbors) Backend
 *
 * Implements: TASK-LEANN-001
 * Referenced by: BackendSelector, DualCodeEmbeddingProvider
 *
 * Optimized HNSW backend with LEANN-specific enhancements:
 * - Hub node caching (top 10% high-degree nodes)
 * - Graph pruning algorithm (preserve hub connectivity)
 * - Selective recomputation (on-demand embeddings)
 * - Two-level search (hub cache first, then full graph)
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { VectorID, SearchResult, DistanceMetric } from './types.js';
import { LEANNConfig, LEANNStats } from './leann-types.js';
export type { LEANNConfig, LEANNStats } from './leann-types.js';
export { DEFAULT_LEANN_CONFIG } from './leann-types.js';
/**
 * LEANN Backend Implementation
 *
 * Implements IHNSWBackend with LEANN optimizations:
 * 1. Hub node caching - keeps high-degree nodes in memory for fast access
 * 2. Graph pruning - removes low-value edges while preserving connectivity
 * 3. Selective recomputation - recomputes embeddings on-demand
 * 4. Two-level search - searches hub cache first, then full graph
 */
export declare class LEANNBackend implements IHNSWBackend {
    private readonly config;
    private readonly dimension;
    private readonly metric;
    private readonly metricFn;
    private readonly isSimilarity;
    /** Main vector storage */
    private readonly vectors;
    /** Graph structure with adjacency lists */
    private readonly graph;
    /** Hub cache with LRU tracking */
    private readonly hubCache;
    /** Maximum hub cache size based on config ratio */
    private maxHubCacheSize;
    /** Statistics tracking */
    private cacheHits;
    private cacheMisses;
    private prunedEdges;
    /** Embedding recomputation function (optional) */
    private embeddingGenerator?;
    constructor(dimension: number, metric?: DistanceMetric, config?: Partial<LEANNConfig>);
    /**
     * Set the embedding generator function for selective recomputation
     */
    setEmbeddingGenerator(generator: (id: VectorID) => Promise<Float32Array>): void;
    /**
     * Insert a vector into the index
     *
     * @throws Error if vector dimension doesn't match expected dimension
     */
    insert(id: VectorID, vector: Float32Array): void;
    /**
     * Connect a new node to its nearest neighbors
     */
    private connectToNeighbors;
    /**
     * Prune low-value edges while preserving hub connectivity
     */
    private pruneConnections;
    /**
     * Check if a node is a hub node
     */
    private isHubNode;
    /**
     * Get node degree (number of connections)
     */
    private getNodeDegree;
    /**
     * Update hub cache with highest-degree nodes.
     * Uses atomic swap pattern to prevent concurrent access issues.
     */
    private updateHubCache;
    /**
     * Search for k nearest neighbors using two-level search
     */
    search(query: Float32Array, k: number, includeVectors?: boolean): SearchResult[];
    /**
     * Brute force search - guaranteed to find exact matches
     * Used for small datasets where linear scan is efficient
     */
    private bruteForceSearch;
    /**
     * Search hub cache for nearest neighbors
     */
    private searchHubCache;
    /**
     * Search full graph using greedy traversal
     */
    private searchFullGraph;
    /**
     * Format search results
     */
    private formatResults;
    /**
     * Retrieve a vector by ID
     */
    getVector(id: VectorID): Float32Array | undefined;
    /**
     * Delete a vector from the index
     */
    delete(id: VectorID): boolean;
    /**
     * Get the number of vectors in the index
     */
    count(): number;
    /**
     * Save the index to persistent storage
     */
    save(filePath: string): Promise<void>;
    /**
     * Load the index from persistent storage
     */
    load(filePath: string): Promise<boolean>;
    /**
     * Clear all vectors from the index
     */
    clear(): void;
    /**
     * Get statistics about the LEANN backend
     */
    getStats(): LEANNStats;
    /**
     * Get the configuration
     */
    getConfig(): LEANNConfig;
    /**
     * Trigger selective recomputation for cold vectors
     * Uses the embedding generator if set
     */
    recomputeColdVectors(maxVectors?: number): Promise<number>;
    /**
     * Force rebuild of hub cache
     */
    rebuildHubCache(): void;
    /**
     * Get hub IDs for external use
     */
    getHubIds(): VectorID[];
}
//# sourceMappingURL=leann-backend.d.ts.map