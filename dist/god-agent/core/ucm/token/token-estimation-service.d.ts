/**
 * Token Estimation Service
 * Fast, accurate token estimation using constitutional ratios
 *
 * CONSTITUTION RULES:
 * - RULE-001: prose = 1.3 tokens/word
 * - RULE-002: code = 1.5 tokens/word
 * - RULE-003: tables = 2.0 tokens/word
 * - RULE-004: citations = 1.4 tokens/word
 * - RULE-006: default = 1.3 tokens/word
 * - RULE-020: Accuracy ±5%
 * - RULE-051: <10ms for 10K words
 */
import type { ITokenEstimator, ITokenEstimate, IEstimationHints } from '../types.js';
/**
 * High-performance token estimation service
 * Meets RULE-051: <10ms for 10K words
 */
export declare class TokenEstimationService implements ITokenEstimator {
    private wordCounter;
    private classifier;
    constructor();
    /**
     * Estimate tokens for given text
     * @param text - Input text to estimate
     * @param hints - Optional hints for faster classification
     * @returns Token estimate with confidence and breakdown
     */
    estimate(text: string, hints?: IEstimationHints): ITokenEstimate;
    /**
     * Fast path estimation using hints
     * Avoids full content classification for performance
     */
    private fastEstimate;
    /**
     * Detailed estimation with full content classification
     * Provides breakdown by content type
     */
    private detailedEstimate;
    /**
     * Check if we can use fast path estimation
     */
    private canUseFastPath;
    /**
     * Batch estimation for multiple texts
     * Optimized for processing multiple items efficiently
     */
    estimateBatch(texts: string[], hints?: IEstimationHints): ITokenEstimate[];
    /**
     * Quick token count without detailed breakdown
     * Optimized for RULE-051 performance requirement
     */
    quickEstimate(text: string): number;
    /**
     * Estimate with validation against performance requirements
     * Ensures RULE-051: <10ms for 10K words
     */
    estimateWithValidation(text: string): ITokenEstimate & {
        meetsPerformanceTarget: boolean;
    };
}
//# sourceMappingURL=token-estimation-service.d.ts.map