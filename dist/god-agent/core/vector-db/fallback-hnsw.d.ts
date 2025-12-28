/**
 * God Agent Fallback HNSW Implementation
 *
 * Implements: TASK-VDB-001
 * Referenced by: VectorDB
 *
 * Pure TypeScript fallback implementation using brute-force search.
 * Optimized HNSW will be added later with native bindings.
 *
 * Storage format (.agentdb/vectors.bin):
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
/**
 * Pure TypeScript HNSW fallback implementation
 * Uses brute-force k-NN search (will be optimized with native HNSW later)
 */
export declare class FallbackHNSW implements IHNSWBackend {
    private readonly vectors;
    private readonly dimension;
    readonly metric: DistanceMetric;
    private readonly metricFn;
    private readonly isSimilarity;
    constructor(dimension: number, metric?: DistanceMetric);
    insert(id: VectorID, vector: Float32Array): void;
    search(query: Float32Array, k: number, includeVectors?: boolean): SearchResult[];
    getVector(id: VectorID): Float32Array | undefined;
    delete(id: VectorID): boolean;
    count(): number;
    save(filePath: string): Promise<void>;
    load(filePath: string): Promise<boolean>;
    clear(): void;
}
//# sourceMappingURL=fallback-hnsw.d.ts.map