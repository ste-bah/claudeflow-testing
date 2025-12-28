/**
 * IDESC-001: Intelligent DESC v2 - Confidence Calculator
 * TASK-IDESC-CONF-001: Implement Multi-Factor Confidence Calculator
 *
 * Implements: REQ-IDESC-006, REQ-IDESC-007, REQ-IDESC-008
 *
 * Calculates confidence levels based on:
 * - Similarity score
 * - Success rate (from outcome tracking)
 * - Episode recency
 * - Workflow category
 */
import type { ConfidenceLevel, IConfidenceCalculator, WorkflowCategory } from '../types.js';
/**
 * Confidence calculation configuration
 */
export interface IConfidenceConfig {
    /**
     * HIGH confidence requirements
     */
    high: {
        minSimilarity: number;
        minSuccessRate: number;
        maxAgeDays: number;
        minOutcomes: number;
    };
    /**
     * MEDIUM confidence requirements
     */
    medium: {
        minSuccessRate: number;
    };
    /**
     * LOW confidence floor
     */
    low: {
        minSimilarity: number;
    };
}
/**
 * ConfidenceCalculator - Multi-factor confidence level calculation
 *
 * Confidence levels:
 * - HIGH: similarity >= 0.95 AND success_rate >= 0.80 AND age < 14 days AND outcomes >= 3
 * - MEDIUM: similarity >= threshold AND (success_rate >= 0.50 OR outcome_count < 3)
 * - LOW: similarity >= 0.70 AND below MEDIUM thresholds
 */
export declare class ConfidenceCalculator implements IConfidenceCalculator {
    private readonly config;
    private memoCache;
    private readonly cacheTTLMs;
    constructor(config?: Partial<IConfidenceConfig>);
    /**
     * Calculate confidence level for an injection
     * Implements: REQ-IDESC-006, REQ-IDESC-007, REQ-IDESC-008
     *
     * @param similarity - Similarity score (0-1)
     * @param successRate - Success rate (0-1 or null if insufficient data)
     * @param outcomeCount - Number of recorded outcomes
     * @param episodeCreatedAt - When the episode was created
     * @param category - Workflow category for threshold lookup
     * @returns Confidence level: HIGH, MEDIUM, or LOW
     */
    calculate(similarity: number, successRate: number | null, outcomeCount: number, episodeCreatedAt: Date, category: WorkflowCategory): ConfidenceLevel;
    /**
     * Calculate detailed confidence metrics
     * Useful for debugging and logging
     */
    calculateDetailed(similarity: number, successRate: number | null, outcomeCount: number, episodeCreatedAt: Date, category: WorkflowCategory): {
        confidence: ConfidenceLevel;
        factors: {
            similarity: number;
            successRate: number | null;
            outcomeCount: number;
            ageDays: number;
            threshold: number;
        };
        reasons: string[];
    };
    /**
     * Check if conditions meet HIGH confidence
     */
    private isHighConfidence;
    /**
     * Check if conditions meet MEDIUM confidence
     */
    private isMediumConfidence;
    /**
     * Calculate age in days from episode creation date
     */
    private calculateAgeDays;
    /**
     * Calculate confidence with memoization (PERF-002)
     * Performance target: <1ms average
     *
     * @param similarity - Similarity score (0-1)
     * @param successRate - Success rate (0-1 or null)
     * @param outcomeCount - Number of outcomes
     * @param episodeCreatedAt - Episode creation date
     * @param category - Workflow category
     * @returns Cached or calculated confidence level
     */
    calculateMemoized(similarity: number, successRate: number | null, outcomeCount: number, episodeCreatedAt: Date, category: WorkflowCategory): ConfidenceLevel;
    /**
     * Batch calculate confidence for multiple episodes (PERF-002)
     * Optimizes injection decision for multiple candidates
     *
     * @param episodes - Array of episode data
     * @returns Array of confidence levels in same order
     */
    calculateBatch(episodes: Array<{
        similarity: number;
        successRate: number | null;
        outcomeCount: number;
        episodeCreatedAt: Date;
        category: WorkflowCategory;
    }>): ConfidenceLevel[];
    /**
     * Clear memoization cache
     * Useful for testing or forced recalculation
     */
    clearCache(): void;
    /**
     * Get cache statistics (for monitoring)
     */
    getCacheStats(): {
        size: number;
        ttlMs: number;
    };
    /**
     * Get current configuration (for testing/debugging)
     */
    getConfig(): IConfidenceConfig;
}
/**
 * Factory function to create ConfidenceCalculator
 */
export declare function createConfidenceCalculator(config?: Partial<IConfidenceConfig>): ConfidenceCalculator;
/**
 * Format confidence level for display
 */
export declare function formatConfidence(confidence: ConfidenceLevel): string;
/**
 * Get confidence level description for injection output
 */
export declare function getConfidenceDescription(confidence: ConfidenceLevel): string;
//# sourceMappingURL=confidence-calculator.d.ts.map