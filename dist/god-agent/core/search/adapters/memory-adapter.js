/**
 * Memory Source Adapter
 * Wraps MemoryClient for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/memory-adapter
 */
import { withTimeout, TimeoutError, generateResultId } from '../utils.js';
/**
 * Adapter for memory-based pattern search via MemoryClient
 */
export class MemorySourceAdapter {
    memoryClient;
    /**
     * Create memory source adapter
     * @param memoryClient - MemoryClient instance
     */
    constructor(memoryClient) {
        this.memoryClient = memoryClient;
    }
    /**
     * Execute memory pattern search
     *
     * @param query - Search query string
     * @param namespace - Memory namespace (used for type filter)
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    async search(query, namespace, timeoutMs) {
        const startTime = performance.now();
        if (!query || query.trim().length === 0) {
            return {
                status: 'success',
                results: [],
                durationMs: performance.now() - startTime,
            };
        }
        try {
            const searchPromise = this.executeSearch(query, namespace);
            const results = await withTimeout(searchPromise, timeoutMs, 'memory');
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
     * Execute memory pattern query
     */
    async executeSearch(query, _namespace) {
        // Check if client is connected
        if (!this.memoryClient.isConnected()) {
            // Return empty results if not connected (graceful degradation)
            return [];
        }
        const params = {
            query,
            type: 'semantic',
            maxResults: 20,
            confidenceThreshold: 0.3,
        };
        let result;
        try {
            result = await this.memoryClient.queryPatterns(params);
        }
        catch (error) {
            // Handle connection errors gracefully
            if (error instanceof Error &&
                (error.message.includes('not connected') ||
                    error.message.includes('disconnected'))) {
                return [];
            }
            throw error;
        }
        return result.patterns.map((pattern, index) => this.patternToResult(pattern, index));
    }
    /**
     * Convert pattern match to raw source result
     */
    patternToResult(pattern, index) {
        return {
            source: 'memory',
            id: generateResultId('memory', index),
            content: pattern.content,
            score: pattern.confidence,
            metadata: {
                patternId: pattern.id,
                originalConfidence: pattern.confidence,
                ...pattern.metadata,
            },
        };
    }
}
//# sourceMappingURL=memory-adapter.js.map