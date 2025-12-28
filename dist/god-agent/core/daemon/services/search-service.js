/**
 * Search Service - IPC wrapper for UnifiedSearch
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes quad-fusion search operations via JSON-RPC 2.0
 */
import { createServiceHandler } from '../service-registry.js';
/**
 * Create search service handler
 *
 * @param unifiedSearch - UnifiedSearch instance
 * @returns Service handler with method map
 */
export function createSearchService(unifiedSearch) {
    return createServiceHandler({
        /**
         * Execute quad-fusion search
         */
        query: async (params) => {
            const { query, embedding, options } = params;
            if (!query) {
                throw new Error('query is required');
            }
            const embeddingArray = embedding ? new Float32Array(embedding) : undefined;
            const result = await unifiedSearch.search(query, embeddingArray, options);
            return {
                query: result.query,
                results: result.results.map((r) => ({
                    id: r.id,
                    score: r.score,
                    sources: r.sources,
                    metadata: r.metadata,
                })),
                metadata: result.metadata,
                sourceStats: Object.fromEntries(Object.entries(result.sourceStats).map(([source, stat]) => [
                    source,
                    {
                        responded: stat.responded,
                        durationMs: stat.durationMs,
                        resultCount: stat.resultCount,
                        timedOut: stat.timedOut,
                        error: stat.error,
                    },
                ])),
            };
        },
        /**
         * Update source weights
         */
        updateWeights: async (params) => {
            const { weights } = params;
            if (!weights) {
                throw new Error('weights are required');
            }
            unifiedSearch.updateWeights(weights);
            return { success: true };
        },
        /**
         * Get current options
         */
        getOptions: async () => {
            const options = unifiedSearch.getOptions();
            return {
                weights: options.weights,
                topK: options.topK,
                sourceTimeoutMs: options.sourceTimeoutMs,
                graphDepth: options.graphDepth,
                memoryNamespace: options.memoryNamespace,
                minPatternConfidence: options.minPatternConfidence,
            };
        },
        /**
         * Get search statistics
         */
        stats: async () => {
            const options = unifiedSearch.getOptions();
            return {
                weightsConfigured: options.weights,
                topK: options.topK,
                sourceTimeoutMs: options.sourceTimeoutMs,
            };
        },
    });
}
//# sourceMappingURL=search-service.js.map