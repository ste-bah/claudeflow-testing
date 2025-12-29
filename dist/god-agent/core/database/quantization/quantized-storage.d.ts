/**
 * Quantized Vector Storage Implementation
 *
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: VectorDB, HNSWIndex
 *
 * Storage wrapper that automatically quantizes vectors for memory efficiency.
 * Provides transparent quantization/dequantization with search capabilities.
 *
 * Memory layout:
 * - Float32Array: 4 bytes per component
 * - Int8Array: 1 byte per component
 * - Metadata: 8 bytes per vector (scale: 4, zeroPoint: 4)
 * - Compression ratio: ~4x (dimension >> 8 bytes overhead)
 */
import { QuantizationConfig, QuantizationMemoryStats, StoredQuantizedVector, QuantizedSearchResult } from './quantization-types.js';
/**
 * Quantized Vector Storage
 *
 * Stores vectors in Int8 format with automatic quantization/dequantization.
 * Provides 4x memory reduction with minimal quality degradation.
 */
export declare class QuantizedVectorStorage {
    /** Vector dimension */
    readonly dimension: number;
    /** Quantizer instance */
    private readonly quantizer;
    /** Storage for quantized vectors */
    private storage;
    /** Original Float32 vectors for re-ranking (optional) */
    private fullPrecisionCache;
    /** Whether to cache full precision for re-ranking */
    private cacheFullPrecision;
    /** Maximum cache size for full precision vectors */
    private maxCacheSize;
    /**
     * Create a new QuantizedVectorStorage
     *
     * @param dimension - Vector dimension
     * @param config - Optional quantization configuration
     * @param options - Storage options
     */
    constructor(dimension: number, config?: Partial<QuantizationConfig>, options?: {
        cacheFullPrecision?: boolean;
        maxCacheSize?: number;
    });
    /**
     * Get the number of stored vectors
     */
    get size(): number;
    /**
     * Store a vector with automatic quantization
     *
     * @param id - Unique vector identifier
     * @param vector - Float32 vector to store
     */
    store(id: string, vector: Float32Array): void;
    /**
     * Update LRU cache with full precision vector
     */
    private updateCache;
    /**
     * Retrieve a vector with automatic dequantization
     *
     * @param id - Vector identifier
     * @returns Dequantized Float32 vector or null if not found
     */
    retrieve(id: string): Float32Array | null;
    /**
     * Get raw quantized representation
     *
     * @param id - Vector identifier
     * @returns Raw quantized data or null if not found
     */
    getQuantized(id: string): StoredQuantizedVector | null;
    /**
     * Check if a vector exists
     *
     * @param id - Vector identifier
     */
    has(id: string): boolean;
    /**
     * Remove a vector
     *
     * @param id - Vector identifier
     * @returns true if removed, false if not found
     */
    remove(id: string): boolean;
    /**
     * Clear all stored vectors
     */
    clear(): void;
    /**
     * Search for k nearest neighbors using quantized distance
     *
     * This is a brute-force search on quantized vectors.
     * For large datasets, use with HNSW index instead.
     *
     * @param query - Query vector (Float32)
     * @param k - Number of results
     * @returns Array of search results sorted by distance
     */
    search(query: Float32Array, k: number): Array<{
        id: string;
        distance: number;
    }>;
    /**
     * Search with re-ranking using full precision vectors
     *
     * First pass: approximate search on quantized vectors
     * Second pass: re-rank candidates using dequantized vectors
     *
     * @param query - Query vector (Float32)
     * @param k - Number of results
     * @param efSearch - Number of candidates to consider (default: k * 2)
     * @returns Array of search results with both distances
     */
    searchWithRerank(query: Float32Array, k: number, efSearch?: number): QuantizedSearchResult[];
    /**
     * Cosine distance for Float32 vectors
     */
    private cosineDistanceFloat;
    /**
     * Store multiple vectors in batch
     *
     * @param items - Array of id/vector pairs
     */
    storeBatch(items: Array<{
        id: string;
        vector: Float32Array;
    }>): void;
    /**
     * Get memory usage statistics
     *
     * @returns Memory usage breakdown
     */
    getMemoryUsage(): QuantizationMemoryStats;
    /**
     * Get all stored vector IDs
     */
    getIds(): string[];
    /**
     * Iterate over all stored vectors (dequantized)
     */
    entries(): Generator<[string, Float32Array]>;
    /**
     * Iterate over raw quantized entries
     */
    quantizedEntries(): Generator<StoredQuantizedVector>;
    /**
     * Export all vectors for serialization
     */
    export(): Array<{
        id: string;
        quantized: number[];
        scale: number;
        zeroPoint: number;
    }>;
    /**
     * Import vectors from serialized format
     */
    import(data: Array<{
        id: string;
        quantized: number[];
        scale: number;
        zeroPoint: number;
    }>): void;
}
//# sourceMappingURL=quantized-storage.d.ts.map