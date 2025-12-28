/**
 * IDESC-001: Intelligent DESC v2 - Outcome Tracker
 * TASK-IDESC-OUT-001: Implement OutcomeStorage Class
 * TASK-IDESC-OUT-002: Create Success Rate Calculator
 *
 * Implements: REQ-IDESC-001, REQ-IDESC-002, NFR-IDESC-001
 * Constitution: GUARD-IDESC-001 (append-only), GUARD-IDESC-005 (graceful degradation)
 *
 * Records and retrieves episode outcomes for intelligent injection decisions.
 * Performance target: <10ms p95 for recordOutcome (NFR-IDESC-001)
 */
import type { IOutcome, IOutcomeInput, IOutcomeStorage, IEpisodeStats, IWarningConfig, IWarningMessage } from '../types.js';
/**
 * Database connection interface (compatible with better-sqlite3 and daemon IPC)
 */
export interface IDatabaseConnection {
    run(sql: string, params?: unknown[]): Promise<{
        lastInsertRowid: number | bigint;
    }>;
    get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
/**
 * OutcomeTracker - Core implementation of IOutcomeStorage
 *
 * Provides outcome recording and retrieval with:
 * - Append-only storage (GUARD-IDESC-001)
 * - Statistical validity checks (REQ-IDESC-002)
 * - Warning generation for negative examples (REQ-IDESC-003, REQ-IDESC-004)
 * - Performance optimization via caching
 */
export declare class OutcomeTracker implements IOutcomeStorage {
    private readonly db;
    private readonly warningConfig;
    private successRateCache;
    private readonly cacheDurationMs;
    constructor(db: IDatabaseConnection, warningConfig?: Partial<IWarningConfig>);
    /**
     * Record an outcome for an episode
     * Implements: REQ-IDESC-001, NFR-IDESC-001 (<10ms p95)
     *
     * @param outcome - Outcome to record
     * @returns Outcome ID on success
     * @throws OutcomeRecordingError if recording fails
     */
    recordOutcome(outcome: IOutcomeInput): Promise<string>;
    /**
     * Get all outcomes for an episode
     * @param episodeId - Episode to get outcomes for
     * @returns List of outcomes (newest first)
     */
    getOutcomes(episodeId: string): Promise<IOutcome[]>;
    /**
     * Get success rate for an episode
     * Implements: REQ-IDESC-002 (minimum 3 samples)
     *
     * @param episodeId - Episode to get rate for
     * @returns Success rate (0-1) or null if outcomeCount < 3
     */
    getSuccessRate(episodeId: string): Promise<number | null>;
    /**
     * Get outcome count for an episode
     * @param episodeId - Episode to count outcomes for
     * @returns Number of outcomes
     */
    getOutcomeCount(episodeId: string): Promise<number>;
    /**
     * Get episode statistics
     * @param episodeId - Episode to get stats for
     * @returns Pre-computed statistics
     */
    getEpisodeStats(episodeId: string): Promise<IEpisodeStats>;
    /**
     * Get failure outcomes for an episode
     * @param episodeId - Episode to get failures for
     * @param limit - Maximum number of failures to return (default: 5)
     * @returns List of failure outcomes (newest first)
     */
    getFailures(episodeId: string, limit?: number): Promise<IOutcome[]>;
    /**
     * Check if episode should trigger a warning
     * Implements: REQ-IDESC-003
     *
     * @param episodeId - Episode to check
     * @returns True if warning should be shown
     */
    shouldWarn(episodeId: string): Promise<boolean>;
    /**
     * Generate warning message for an episode
     * Implements: REQ-IDESC-004, AC-IDESC-001b
     *
     * @param episodeId - Episode to generate warning for
     * @returns Warning message or null if no warning needed
     */
    generateWarning(episodeId: string): Promise<IWarningMessage | null>;
    /**
     * Get batch success rates for multiple episodes
     * Performance optimization for shouldInject with multiple candidates
     *
     * @param episodeIds - Episodes to get rates for
     * @returns Map of episodeId to success rate
     */
    getBatchSuccessRates(episodeIds: string[]): Promise<Map<string, number | null>>;
    /**
     * Get cached success rate (PERF-001)
     * Public accessor for cache inspection
     *
     * @param episodeId - Episode to check cache for
     * @returns Cached success rate or null if not in cache or expired
     */
    getCachedSuccessRate(episodeId: string): number | null;
    /**
     * Prune old outcomes (PERF-003 - Memory Optimization)
     * Implements: GUARD-IDESC-007
     *
     * Removes episode outcomes older than specified days to keep memory usage under control.
     * Target: <10MB for 10K episodes
     *
     * @param daysOld - Age threshold in days (default: 90)
     * @returns Number of outcomes deleted
     */
    pruneOldOutcomes(daysOld?: number): Promise<number>;
    /**
     * Clear the success rate cache
     * Useful for testing or forced refresh
     */
    clearCache(): void;
    /**
     * Validate outcome input
     */
    private validateOutcomeInput;
    /**
     * Convert database row to IOutcome
     */
    private rowToOutcome;
}
/**
 * Factory function to create OutcomeTracker with daemon IPC
 */
export declare function createOutcomeTracker(db: IDatabaseConnection, warningConfig?: Partial<IWarningConfig>): OutcomeTracker;
//# sourceMappingURL=outcome-tracker.d.ts.map