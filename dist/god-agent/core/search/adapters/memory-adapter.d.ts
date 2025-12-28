/**
 * Memory Source Adapter
 * Wraps MemoryClient for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/memory-adapter
 */
import type { MemoryClient } from '../../memory-server/memory-client.js';
import type { SourceExecutionResult } from '../search-types.js';
/**
 * Adapter for memory-based pattern search via MemoryClient
 */
export declare class MemorySourceAdapter {
    private readonly memoryClient;
    /**
     * Create memory source adapter
     * @param memoryClient - MemoryClient instance
     */
    constructor(memoryClient: MemoryClient);
    /**
     * Execute memory pattern search
     *
     * @param query - Search query string
     * @param namespace - Memory namespace (used for type filter)
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    search(query: string, namespace: string, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Execute memory pattern query
     */
    private executeSearch;
    /**
     * Convert pattern match to raw source result
     */
    private patternToResult;
}
//# sourceMappingURL=memory-adapter.d.ts.map