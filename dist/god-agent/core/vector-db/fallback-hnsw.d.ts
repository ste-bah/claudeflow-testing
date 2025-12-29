/**
 * God Agent Fallback HNSW Implementation
 *
 * Implements: TASK-VDB-001, TASK-PERF-001
 * Referenced by: VectorDB
 *
 * Pure TypeScript HNSW implementation with automatic backend selection:
 * - Uses HNSW graph for datasets >= HNSW_THRESHOLD (1000 vectors)
 * - Falls back to brute-force for small datasets (faster for small n)
 *
 * Storage format v2 (.agentdb/vectors.bin):
 * - HNSW index serialized as JSON with graph structure
 *
 * Storage format v1 (legacy, read-only):
 * - 4 bytes: version (uint32)
 * - 4 bytes: dimension (uint32)
 * - 4 bytes: count (uint32)
 * - For each vector:
 *   - 4 bytes: ID length (uint32)
 *   - N bytes: ID string (UTF-8)
 *   - dimension * 4 bytes: vector data (float32)
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { VectorID, SearchResult, DistanceMetric } from './types.js';
import { HNSWIndex } from '../database/hnsw/index.js';
/**
 * Pure TypeScript HNSW implementation
 *
 * Automatically selects between:
 * - Brute-force search for small datasets (< 1000 vectors)
 * - HNSW graph for larger datasets (O(log n) search)
 */
export declare class FallbackHNSW implements IHNSWBackend {
    private readonly vectors;
    private readonly dimension;
    readonly metric: DistanceMetric;
    private readonly metricFn;
    private readonly isSimilarity;
    /** HNSW index for large datasets */
    private hnswIndex;
    /** Whether HNSW index needs rebuilding after modifications */
    private hnswDirty;
    constructor(dimension: number, metric?: DistanceMetric);
    /**
     * Check if we should use HNSW index
     */
    private shouldUseHNSW;
    /**
     * Ensure HNSW index is built and up-to-date
     */
    private ensureHNSWIndex;
    insert(id: VectorID, vector: Float32Array): void;
    search(query: Float32Array, k: number, includeVectors?: boolean): SearchResult[];
    /**
     * HNSW-based search (O(log n))
     */
    private searchHNSW;
    /**
     * Brute-force search (O(n))
     */
    private searchBruteForce;
    getVector(id: VectorID): Float32Array | undefined;
    delete(id: VectorID): boolean;
    count(): number;
    save(filePath: string): Promise<void>;
    /**
     * Save in legacy format (for small datasets)
     */
    private saveLegacy;
    load(filePath: string): Promise<boolean>;
    /**
     * Load HNSW format
     */
    private loadHNSW;
    /**
     * Load legacy format
     */
    private loadLegacy;
    clear(): void;
    /**
     * Get statistics about the backend
     */
    getStats(): {
        size: number;
        usingHNSW: boolean;
        hnswStats?: ReturnType<HNSWIndex['getStats']>;
    };
}
//# sourceMappingURL=fallback-hnsw.d.ts.map