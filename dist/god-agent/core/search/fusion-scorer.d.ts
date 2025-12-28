/**
 * Fusion Scorer for Quad-Fusion Unified Search
 * Implements weighted fusion with deduplication
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-002
 *
 * @module src/god-agent/core/search/fusion-scorer
 */
import type { SourceWeights, RawSourceResult, FusedSearchResult, AggregatedResults } from './search-types.js';
/**
 * Fusion scorer for combining results from multiple search sources
 * Uses weighted averaging with source failure redistribution
 */
export declare class FusionScorer {
    private weights;
    /**
     * Create fusion scorer with initial weights
     * @param weights - Source weights (will be normalized)
     */
    constructor(weights: SourceWeights);
    /**
     * Fuse aggregated results into ranked results
     *
     * @param aggregated - Aggregated results from all sources
     * @param topK - Maximum number of results to return
     * @returns Fused and ranked results
     */
    fuse(aggregated: AggregatedResults, topK: number): FusedSearchResult[];
    /**
     * Calculate active weights, redistributing from failed/timed-out sources
     *
     * @param aggregated - Aggregated results with source outcomes
     * @returns Adjusted weights for active sources only
     */
    private calculateActiveWeights;
    /**
     * Deduplicate results by content hash
     *
     * @param results - Raw results from all sources
     * @returns Map of content hash to array of results with that content
     */
    deduplicate(results: RawSourceResult[]): Map<string, RawSourceResult[]>;
    /**
     * Score deduplicated result groups
     *
     * @param groups - Deduplicated result groups
     * @param activeWeights - Active source weights
     * @returns Fused results with combined scores
     */
    private scoreResults;
    /**
     * Merge metadata from multiple sources
     *
     * @param group - Group of results with same content
     * @returns Merged metadata object
     */
    private mergeMetadata;
    /**
     * Compute SHA-256 content hash (first 16 chars)
     *
     * @param content - Content string to hash
     * @returns First 16 characters of SHA-256 hex digest
     */
    computeContentHash(content: string): string;
    /**
     * Normalize weights to sum to 1.0
     *
     * @param weights - Weights to normalize
     * @returns Normalized weights
     */
    normalizeWeights(weights: SourceWeights): SourceWeights;
    /**
     * Get current weights
     *
     * @returns Current source weights
     */
    getWeights(): SourceWeights;
    /**
     * Update weights
     *
     * @param weights - New weights (will be normalized)
     */
    updateWeights(weights: SourceWeights): void;
}
//# sourceMappingURL=fusion-scorer.d.ts.map