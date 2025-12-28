/**
 * SPRINT 3 - DESC-004: Injection Filter
 *
 * Safety mechanisms for DESC injection to prevent stale/wrong prior solutions
 * from being injected into coding tasks.
 *
 * Key Safety Rules:
 * 1. CODING tasks: High threshold (0.92), strict file context matching
 * 2. RESEARCH tasks: Lower threshold (0.80), broader context matching
 * 3. Recency decay: Older episodes get lower weight (30-day half-life for code)
 * 4. Content type matching: Code episodes only inject into code tasks
 */
import type { IInjectionFilter, IInjectionDecision, IEnhancedInjectionDecision, IStoredEpisode, IEpisodeWithOutcomes, ITaskContext, WorkflowCategory } from '../types.js';
import type { OutcomeTracker } from './outcome-tracker.js';
import type { ConfidenceCalculator } from './confidence-calculator.js';
import type { NegativeExampleProvider } from './negative-example-provider.js';
/**
 * InjectionFilter - Safety mechanism for DESC injection
 */
export declare class InjectionFilter implements IInjectionFilter {
    /**
     * Detect workflow category from task context
     */
    detectWorkflowCategory(taskContext: ITaskContext): WorkflowCategory;
    /**
     * Apply recency decay based on episode age
     */
    applyRecencyDecay(episode: IStoredEpisode, category: WorkflowCategory): number;
    /**
     * Check if episode content type matches task context
     */
    isContentTypeMatch(episodeMetadata: Record<string, unknown>, taskContext: ITaskContext): boolean;
    /**
     * Check if episode file context is relevant
     */
    isFileContextRelevant(episodeMetadata: Record<string, unknown>, taskContext: ITaskContext): boolean;
    /**
     * Determine if an episode should be injected
     */
    shouldInject(episode: IStoredEpisode, similarity: number, taskContext: ITaskContext): IInjectionDecision;
    /**
     * Extract file paths from metadata
     */
    private extractFiles;
    /**
     * Check if text contains any of the given keywords
     */
    private hasKeywords;
    /**
     * Check if metadata contains code files
     */
    private hasCodeFiles;
}
/**
 * EnhancedInjectionFilter - Extends InjectionFilter with confidence calculation
 * TASK-IDESC-CONF-004: Update InjectionFilter with Confidence
 *
 * Implements: REQ-IDESC-005, NFR-IDESC-002
 * Constitution: REQ-IDESC-018 (backward compatible)
 *
 * Key enhancements:
 * - Calculates confidence level based on similarity, success rate, and recency
 * - Includes warning information for episodes with low success rates
 * - Returns IEnhancedInjectionDecision with full metadata
 * - Maintains backward compatibility with sync shouldInject()
 */
export declare class EnhancedInjectionFilter extends InjectionFilter {
    private readonly outcomeTracker;
    private readonly confidenceCalculator;
    private readonly negativeExampleProvider?;
    private readonly statsCache;
    private readonly cacheDurationMs;
    constructor(outcomeTracker: OutcomeTracker, confidenceCalculator: ConfidenceCalculator, negativeExampleProvider?: NegativeExampleProvider | undefined);
    /**
     * Enhanced shouldInject with confidence calculation
     * Implements: REQ-IDESC-005
     *
     * @param episode - Episode to evaluate (may have outcome data)
     * @param similarity - Maximum similarity score from retrieval
     * @param taskContext - Current task context
     * @returns Enhanced decision with confidence and warnings
     */
    shouldInjectEnhanced(episode: IStoredEpisode | IEpisodeWithOutcomes, similarity: number, taskContext: ITaskContext): Promise<IEnhancedInjectionDecision>;
    /**
     * Batch process multiple episodes
     * Performance optimization: batch stats lookups
     *
     * @param episodes - Episodes to evaluate
     * @param similarities - Similarity scores per episode
     * @param taskContext - Task context
     * @returns Array of enhanced decisions
     */
    shouldInjectBatch(episodes: Array<{
        episode: IStoredEpisode;
        similarity: number;
    }>, taskContext: ITaskContext): Promise<IEnhancedInjectionDecision[]>;
    /**
     * Get cached episode stats
     */
    private getEpisodeStats;
    /**
     * Get outcome count for an episode
     */
    private getOutcomeCount;
}
/**
 * Factory function for creating EnhancedInjectionFilter
 *
 * @param outcomeTracker - Outcome tracker for success rate data
 * @param confidenceCalculator - Confidence calculator
 * @param negativeExampleProvider - Optional negative example provider for warnings
 * @returns Configured EnhancedInjectionFilter
 */
export declare function createEnhancedInjectionFilter(outcomeTracker: OutcomeTracker, confidenceCalculator: ConfidenceCalculator, negativeExampleProvider?: NegativeExampleProvider): EnhancedInjectionFilter;
/**
 * Convert enhanced decision to legacy format
 * Implements: REQ-IDESC-018 (backward compatible)
 *
 * This helper strips enhanced fields (confidence, successRate, etc.)
 * to produce a decision compatible with legacy IInjectionDecision consumers.
 *
 * @param enhanced - Enhanced injection decision
 * @returns Legacy injection decision (base fields only)
 *
 * @example
 * const enhanced = await filter.shouldInjectEnhanced(episode, 0.95, taskContext);
 * const legacy = toLegacyDecision(enhanced);
 * // legacy has only: inject, reason, adjustedScore, category
 */
export declare function toLegacyDecision(enhanced: IEnhancedInjectionDecision): IInjectionDecision;
/**
 * Check if decision is enhanced format
 * Type guard to determine if a decision has enhanced fields
 *
 * @param decision - Injection decision (base or enhanced)
 * @returns True if decision has enhanced fields
 *
 * @example
 * if (isEnhancedDecision(decision)) {
 *   console.log(`Confidence: ${decision.confidence}`);
 * }
 */
export declare function isEnhancedDecision(decision: IInjectionDecision): decision is IEnhancedInjectionDecision;
//# sourceMappingURL=injection-filter.d.ts.map