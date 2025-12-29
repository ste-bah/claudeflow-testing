/**
 * Vector Source Adapter
 * Wraps NativeHNSW for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/vector-adapter
 */
import type { NativeHNSW } from '../../vector-db/native-hnsw.js';
import type { SourceExecutionResult } from '../search-types.js';
/**
 * Adapter for vector similarity search via NativeHNSW
 */
export declare class VectorSourceAdapter {
    private readonly vectorDb;
    /**
     * Create vector source adapter
     * @param vectorDb - NativeHNSW instance
     */
    constructor(vectorDb: NativeHNSW);
    /**
     * Execute vector similarity search
     *
     * @param embedding - Query embedding (VECTOR_DIM dimensions, default 1536)
     * @param topK - Maximum results to return
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    search(embedding: Float32Array | undefined, topK: number, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Execute the underlying vector search
     */
    private executeSearch;
    /**
     * Normalize vector similarity score to [0, 1]
     * Assumes cosine similarity which is already [-1, 1]
     */
    private normalizeVectorScore;
}
//# sourceMappingURL=vector-adapter.d.ts.map