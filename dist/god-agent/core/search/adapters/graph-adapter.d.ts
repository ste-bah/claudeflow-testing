/**
 * Graph Source Adapter
 * Wraps FallbackGraph for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/graph-adapter
 */
import type { FallbackGraph } from '../../graph-db/fallback-graph.js';
import type { SourceExecutionResult } from '../search-types.js';
/**
 * Adapter for graph-based search via FallbackGraph
 */
export declare class GraphSourceAdapter {
    private readonly graphDb;
    /**
     * Create graph source adapter
     * @param graphDb - FallbackGraph instance
     */
    constructor(graphDb: FallbackGraph);
    /**
     * Execute graph search by query text matching
     *
     * @param query - Search query string
     * @param depth - Traversal depth (not used in simple search)
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    search(query: string, depth: number, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Execute graph search by matching node properties
     */
    private executeSearch;
    /**
     * Score how well a node matches the query
     */
    private scoreNodeMatch;
    /**
     * Convert node to content string
     */
    private nodeToContent;
}
//# sourceMappingURL=graph-adapter.d.ts.map