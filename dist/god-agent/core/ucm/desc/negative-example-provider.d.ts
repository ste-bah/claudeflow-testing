/**
 * IDESC-001: Intelligent DESC v2 - Negative Example Provider
 * TASK-IDESC-NEG-003: Build Negative Example Provider
 *
 * Implements: AC-IDESC-001c, AC-IDESC-001d
 * Constitution: GUARD-IDESC-005 (graceful degradation)
 *
 * Provides warnings for episodes with poor success rates and handles
 * deprioritization logic for negative examples in retrieval results.
 */
import type { IRetrievalResult, IEnhancedRetrievalResult, IWarningMessage, INegativeExampleConfig } from '../types.js';
import type { OutcomeTracker } from './outcome-tracker.js';
/**
 * Default configuration for negative example handling
 */
export declare const DEFAULT_NEGATIVE_EXAMPLE_CONFIG: Required<INegativeExampleConfig>;
/**
 * Provides negative example warnings and deprioritization for retrieved episodes
 *
 * Key responsibilities:
 * - Detect episodes that should have warnings (success rate < 50% with >= 3 outcomes)
 * - Generate warning messages for inclusion in retrieval results
 * - Apply deprioritization to move failed episodes after successful ones
 * - Maintain graceful degradation if outcome data is unavailable
 */
export declare class NegativeExampleProvider {
    private readonly outcomeTracker;
    private readonly config;
    private readonly statsCache;
    private readonly cacheDurationMs;
    constructor(outcomeTracker: OutcomeTracker, config?: Partial<INegativeExampleConfig>);
    /**
     * Enhance retrieval results with warning information
     * Implements: AC-IDESC-001c, AC-IDESC-001d
     *
     * @param results - Original retrieval results
     * @returns Enhanced results with warnings and deprioritization applied
     */
    enhanceResults(results: IRetrievalResult[]): Promise<IEnhancedRetrievalResult[]>;
    /**
     * Check if an episode should have a warning
     *
     * @param episodeId - Episode to check
     * @returns True if episode should trigger a warning
     */
    shouldWarn(episodeId: string): Promise<boolean>;
    /**
     * Generate a warning message for an episode
     *
     * @param episodeId - Episode to generate warning for
     * @returns Warning message or null if no warning needed
     */
    getWarning(episodeId: string): Promise<IWarningMessage | null>;
    /**
     * Get batch warnings for multiple episodes
     *
     * @param episodeIds - Episode IDs to check
     * @returns Map of episode ID to warning message (null if no warning)
     */
    getBatchWarnings(episodeIds: string[]): Promise<Map<string, IWarningMessage | null>>;
    /**
     * Calculate deprioritization factor for an episode
     *
     * @param successRate - Episode success rate (null if insufficient data)
     * @param outcomeCount - Number of outcomes
     * @returns Factor to multiply score by (1.0 = no change, < 1.0 = deprioritized)
     */
    getDeprioritizationFactor(successRate: number | null, outcomeCount: number): number;
    /**
     * Get episode stats with caching
     */
    private getStats;
    /**
     * Get batch stats for multiple episodes
     */
    private getBatchStats;
    /**
     * Enhance a single retrieval result with warning and stats
     */
    private enhanceSingleResult;
    /**
     * Sort results: non-deprioritized first, then by score
     * Implements: AC-IDESC-001d (deprioritized but not suppressed)
     */
    private sortByDeprioritization;
}
/**
 * Create a NegativeExampleProvider instance
 *
 * @param outcomeTracker - OutcomeTracker for accessing outcome data
 * @param config - Optional configuration overrides
 * @returns Configured NegativeExampleProvider
 */
export declare function createNegativeExampleProvider(outcomeTracker: OutcomeTracker, config?: Partial<INegativeExampleConfig>): NegativeExampleProvider;
//# sourceMappingURL=negative-example-provider.d.ts.map