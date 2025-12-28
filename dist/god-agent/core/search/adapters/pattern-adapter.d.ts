/**
 * Pattern Source Adapter
 * Wraps ReasoningBank for quad-fusion search
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/adapters/pattern-adapter
 */
import type { ReasoningBank } from '../../reasoning/reasoning-bank.js';
import type { SourceExecutionResult } from '../search-types.js';
/**
 * Adapter for pattern matching via ReasoningBank
 */
export declare class PatternSourceAdapter {
    private readonly reasoningBank;
    /**
     * Create pattern source adapter
     * @param reasoningBank - ReasoningBank instance
     */
    constructor(reasoningBank: ReasoningBank);
    /**
     * Execute pattern search
     *
     * @param query - Query embedding (768 dimensions) or text query for fallback
     * @param minConfidence - Minimum pattern confidence threshold
     * @param timeoutMs - Timeout in milliseconds
     * @returns Source execution result
     */
    search(query: Float32Array | string, minConfidence: number, timeoutMs: number): Promise<SourceExecutionResult>;
    /**
     * Execute pattern matching via ReasoningBank
     */
    private executeSearch;
    /**
     * Convert text to a mock embedding for testing
     * In production, this would use a proper embedding model
     */
    private textToEmbedding;
    /**
     * Convert pattern match to raw source result
     */
    private patternToResult;
}
//# sourceMappingURL=pattern-adapter.d.ts.map