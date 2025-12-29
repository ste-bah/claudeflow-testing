/**
 * Vector Source Adapter
 * Wraps NativeHNSW for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/vector-adapter
 */
import { withTimeout, TimeoutError, generateResultId } from '../utils.js';
/**
 * Adapter for vector similarity search via NativeHNSW
 */
export class VectorSourceAdapter {
    vectorDb;
    /**
     * Create vector source adapter
     * @param vectorDb - NativeHNSW instance
     */
    constructor(vectorDb) {
        this.vectorDb = vectorDb;
    }
    /**
     * Execute vector similarity search
     *
     * @param embedding - Query embedding (VECTOR_DIM dimensions, default 1536)
     * @param topK - Maximum results to return
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    async search(embedding, topK, timeoutMs) {
        const startTime = performance.now();
        // Handle missing embedding gracefully
        if (!embedding) {
            return {
                status: 'success',
                results: [],
                durationMs: performance.now() - startTime,
            };
        }
        try {
            const searchPromise = this.executeSearch(embedding, topK);
            const results = await withTimeout(searchPromise, timeoutMs, 'vector');
            return {
                status: 'success',
                results,
                durationMs: performance.now() - startTime,
            };
        }
        catch (error) {
            const durationMs = performance.now() - startTime;
            if (error instanceof TimeoutError) {
                return {
                    status: 'timeout',
                    durationMs,
                };
            }
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs,
            };
        }
    }
    /**
     * Execute the underlying vector search
     */
    async executeSearch(embedding, topK) {
        // NativeHNSW.search is synchronous but may throw if not available
        let searchResults;
        try {
            searchResults = this.vectorDb.search(embedding, topK);
        }
        catch (error) {
            // Handle "Native HNSW not available" error gracefully
            if (error instanceof Error && error.message.includes('not available')) {
                return [];
            }
            // RULE-070: Re-throw with operation context
            throw new Error(`Vector search failed (topK: ${topK}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
        return searchResults.map((result, index) => ({
            source: 'vector',
            id: generateResultId('vector', index),
            content: result.id, // Vector ID is the content reference
            score: this.normalizeVectorScore(result.similarity),
            metadata: {
                vectorId: result.id,
                originalSimilarity: result.similarity,
                hasVector: result.vector !== undefined,
            },
        }));
    }
    /**
     * Normalize vector similarity score to [0, 1]
     * Assumes cosine similarity which is already [-1, 1]
     */
    normalizeVectorScore(similarity) {
        // Cosine similarity: map [-1, 1] to [0, 1]
        return (similarity + 1) / 2;
    }
}
//# sourceMappingURL=vector-adapter.js.map