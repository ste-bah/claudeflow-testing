/**
 * HNSW Index Implementation
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: VectorDB, FallbackHNSW
 *
 * Hierarchical Navigable Small World graph for approximate nearest neighbor search.
 * Provides O(log n) search complexity instead of O(n) brute force.
 *
 * Algorithm based on:
 * - Malkov & Yashunin (2018): "Efficient and robust approximate nearest neighbor search
 *   using Hierarchical Navigable Small World graphs"
 *
 * Performance targets:
 * - Search latency: < 10ms for 100K vectors
 * - Memory overhead: < 20% for graph structure (4x reduction with quantization)
 * - Build time: < 1 second for 10K vectors
 * - Recall@10: > 0.95 (> 0.96 with quantization + reranking)
 */
import { HNSWConfig, HNSWSearchResult } from './hnsw-types.js';
/**
 * HNSW Index - Hierarchical Navigable Small World graph
 *
 * Provides O(log n) approximate nearest neighbor search with high recall.
 * Supports Int8 quantization for 4x memory reduction (TASK-PERF-002).
 */
export declare class HNSWIndex {
    /** Vector dimension */
    readonly dimension: number;
    /** HNSW configuration */
    readonly config: HNSWConfig;
    /** Graph nodes indexed by ID */
    private nodes;
    /** Vector data indexed by ID (full precision, used when quantization disabled) */
    private vectors;
    /** Entry point for graph traversal (highest level node) */
    private entryPointId;
    /** Maximum level in the current graph */
    private maxLevel;
    /** Distance function */
    private distanceFn;
    /** Int8 quantizer for memory-efficient storage (TASK-PERF-002) */
    private quantizer;
    /** Quantized vector storage (used when quantization enabled) */
    private quantizedStorage;
    /** Whether quantization is enabled */
    readonly quantizationEnabled: boolean;
    /**
     * Create a new HNSW index
     *
     * @param dimension - Vector dimension (e.g., 1536 for OpenAI embeddings)
     * @param config - Optional HNSW configuration
     */
    constructor(dimension: number, config?: Partial<HNSWConfig>);
    /**
     * Get the number of vectors in the index
     */
    get size(): number;
    /**
     * Get the maximum level in the graph
     */
    get levels(): number;
    /**
     * Generate a random level for a new node
     * Uses exponential distribution: P(level = l) ~ exp(-l * mL)
     *
     * @returns Random level (0 = base level)
     */
    private getRandomLevel;
    /**
     * Add a vector to the index
     *
     * When quantization is enabled (TASK-PERF-002), stores both:
     * - Full precision vector for re-ranking
     * - Quantized version for graph navigation
     *
     * @param id - Unique identifier for the vector
     * @param vector - Vector data (must match dimension)
     */
    add(id: string, vector: Float32Array): void;
    /**
     * Greedy search at a single layer (for traversing upper layers)
     *
     * @param query - Query vector
     * @param entryId - Entry point node ID
     * @param level - Layer to search
     * @returns ID of closest node found
     */
    private searchLayerGreedy;
    /**
     * Search a layer for ef nearest neighbors
     *
     * @param query - Query vector
     * @param entryId - Entry point node ID
     * @param ef - Number of neighbors to find (beam width)
     * @param level - Layer to search
     * @returns Array of candidate entries sorted by distance
     */
    private searchLayer;
    /**
     * Select best neighbors using simple heuristic
     *
     * @param query - Query vector
     * @param candidates - Candidate neighbors
     * @param M - Maximum number of neighbors to select
     * @param level - Current level
     * @returns Selected neighbors sorted by distance
     */
    private selectNeighbors;
    /**
     * Prune connections for a node that has too many
     *
     * @param node - Node to prune
     * @param level - Level to prune at
     * @param maxConnections - Maximum allowed connections
     */
    private pruneConnections;
    /**
     * Search for k nearest neighbors
     *
     * When quantization is enabled (TASK-PERF-002):
     * 1. Use quantized vectors for graph navigation (faster, lower memory)
     * 2. Re-rank final candidates using full precision vectors
     *
     * @param query - Query vector
     * @param k - Number of neighbors to return
     * @returns Array of search results sorted by distance (closest first)
     */
    search(query: Float32Array, k: number): Array<{
        id: string;
        distance: number;
    }>;
    /**
     * Re-rank search results using full precision vectors (TASK-PERF-002)
     *
     * After approximate search using quantized vectors, compute exact distances
     * using the full Float32 vectors for the top candidates.
     *
     * @param query - Query vector
     * @param candidates - Approximate search results
     * @param k - Number of results to return
     * @returns Re-ranked results sorted by exact distance
     */
    private rerankWithFullPrecision;
    /**
     * Search and return results with optional vectors
     *
     * @param query - Query vector
     * @param k - Number of neighbors to return
     * @param includeVectors - Whether to include vector data
     * @returns Array of search results with similarity scores
     */
    searchWithVectors(query: Float32Array, k: number, includeVectors?: boolean): HNSWSearchResult[];
    /**
     * Remove a vector from the index
     *
     * @param id - Vector ID to remove
     * @returns true if removed, false if not found
     */
    remove(id: string): boolean;
    /**
     * Get a vector by ID
     *
     * @param id - Vector ID
     * @returns Vector data or undefined if not found
     */
    getVector(id: string): Float32Array | undefined;
    /**
     * Check if a vector exists
     *
     * @param id - Vector ID
     * @returns true if exists
     */
    has(id: string): boolean;
    /**
     * Add multiple vectors in batch
     *
     * @param items - Array of id/vector pairs
     */
    addBatch(items: Array<{
        id: string;
        vector: Float32Array;
    }>): void;
    /**
     * Clear all vectors from the index
     */
    clear(): void;
    /**
     * Serialize the index for persistence
     *
     * @returns Buffer containing serialized index data
     */
    serialize(): Buffer;
    /**
     * Deserialize an index from buffer
     *
     * @param buffer - Buffer containing serialized index
     * @returns Reconstructed HNSWIndex
     */
    static deserialize(buffer: Buffer): HNSWIndex;
    /**
     * Get statistics about the index
     *
     * @returns Index statistics with quantization info (TASK-PERF-002)
     */
    getStats(): {
        size: number;
        levels: number;
        avgConnections: number;
        memoryEstimate: number;
        quantizationEnabled: boolean;
        compressionRatio?: number;
        quantizedMemoryEstimate?: number;
    };
    /**
     * Get quantized distance between two vectors (TASK-PERF-002)
     *
     * Uses quantized representation for faster approximate distance computation.
     * Only available when quantization is enabled.
     *
     * @param idA - First vector ID
     * @param idB - Second vector ID
     * @returns Approximate distance or null if IDs not found
     */
    getQuantizedDistance(idA: string, idB: string): number | null;
    /**
     * Get quantization quality metrics (TASK-PERF-002)
     *
     * Measures the quality degradation from quantization by comparing
     * original vectors with their quantized/dequantized versions.
     *
     * @returns Quality metrics or null if quantization disabled
     */
    getQuantizationQuality(): {
        mse: number;
        maxError: number;
        mae: number;
        sqnr: number;
    } | null;
}
//# sourceMappingURL=hnsw-index.d.ts.map