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
import { randomUUID } from 'crypto';
import { OutcomeRecordingError, EpisodeNotFoundError, InvalidOutcomeError } from './errors.js';
/**
 * Default warning configuration
 */
const DEFAULT_WARNING_CONFIG = {
    warningThreshold: 0.5,
    minimumOutcomes: 3
};
/**
 * OutcomeTracker - Core implementation of IOutcomeStorage
 *
 * Provides outcome recording and retrieval with:
 * - Append-only storage (GUARD-IDESC-001)
 * - Statistical validity checks (REQ-IDESC-002)
 * - Warning generation for negative examples (REQ-IDESC-003, REQ-IDESC-004)
 * - Performance optimization via caching
 */
export class OutcomeTracker {
    db;
    warningConfig;
    // In-memory cache for success rates (performance optimization)
    successRateCache = new Map();
    cacheDurationMs = 60_000; // 60 seconds
    constructor(db, warningConfig) {
        this.db = db;
        this.warningConfig = { ...DEFAULT_WARNING_CONFIG, ...warningConfig };
    }
    /**
     * Record an outcome for an episode
     * Implements: REQ-IDESC-001, NFR-IDESC-001 (<10ms p95)
     *
     * @param outcome - Outcome to record
     * @returns Outcome ID on success
     * @throws OutcomeRecordingError if recording fails
     */
    async recordOutcome(outcome) {
        const startTime = performance.now();
        // Validate input
        this.validateOutcomeInput(outcome);
        const outcomeId = randomUUID();
        const recordedAt = new Date().toISOString();
        try {
            // Verify episode exists
            const episodeExists = await this.db.get('SELECT episode_id FROM episodes WHERE episode_id = ?', [outcome.episodeId]);
            if (!episodeExists) {
                throw new EpisodeNotFoundError(outcome.episodeId);
            }
            // Insert outcome (append-only per GUARD-IDESC-001)
            await this.db.run(`INSERT INTO episode_outcomes
         (outcome_id, episode_id, task_id, success, error_type, details, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                outcomeId,
                outcome.episodeId,
                outcome.taskId,
                outcome.success ? 1 : 0,
                outcome.errorType || null,
                outcome.details ? JSON.stringify(outcome.details) : null,
                recordedAt
            ]);
            // Invalidate cache for this episode
            this.successRateCache.delete(outcome.episodeId);
            // Log performance
            const duration = performance.now() - startTime;
            if (duration > 10) {
                console.warn(`[OutcomeTracker] recordOutcome exceeded 10ms: ${duration.toFixed(2)}ms`);
            }
            return outcomeId;
        }
        catch (error) {
            if (error instanceof EpisodeNotFoundError) {
                throw error;
            }
            throw new OutcomeRecordingError(`Failed to record outcome: ${error instanceof Error ? error.message : 'Unknown error'}`, outcome.episodeId, outcome.taskId, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get all outcomes for an episode
     * @param episodeId - Episode to get outcomes for
     * @returns List of outcomes (newest first)
     */
    async getOutcomes(episodeId) {
        const rows = await this.db.all(`SELECT * FROM episode_outcomes
       WHERE episode_id = ?
       ORDER BY recorded_at DESC`, [episodeId]);
        return rows.map(row => this.rowToOutcome(row));
    }
    /**
     * Get success rate for an episode
     * Implements: REQ-IDESC-002 (minimum 3 samples)
     *
     * @param episodeId - Episode to get rate for
     * @returns Success rate (0-1) or null if outcomeCount < 3
     */
    async getSuccessRate(episodeId) {
        // Check cache first
        const cached = this.successRateCache.get(episodeId);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.rate;
        }
        // Get from denormalized stats table (fast O(1) lookup)
        const stats = await this.db.get('SELECT success_rate FROM episode_stats WHERE episode_id = ?', [episodeId]);
        const rate = stats?.success_rate ?? null;
        // Cache the result
        this.successRateCache.set(episodeId, {
            rate,
            expiresAt: Date.now() + this.cacheDurationMs
        });
        return rate;
    }
    /**
     * Get outcome count for an episode
     * @param episodeId - Episode to count outcomes for
     * @returns Number of outcomes
     */
    async getOutcomeCount(episodeId) {
        const stats = await this.db.get('SELECT outcome_count FROM episode_stats WHERE episode_id = ?', [episodeId]);
        return stats?.outcome_count ?? 0;
    }
    /**
     * Get episode statistics
     * @param episodeId - Episode to get stats for
     * @returns Pre-computed statistics
     */
    async getEpisodeStats(episodeId) {
        const row = await this.db.get('SELECT * FROM episode_stats WHERE episode_id = ?', [episodeId]);
        if (!row) {
            return {
                episodeId,
                outcomeCount: 0,
                successCount: 0,
                failureCount: 0,
                successRate: null,
                lastOutcomeAt: null
            };
        }
        return {
            episodeId: row.episode_id,
            outcomeCount: row.outcome_count,
            successCount: row.success_count,
            failureCount: row.failure_count,
            successRate: row.success_rate,
            lastOutcomeAt: row.last_outcome_at ? new Date(row.last_outcome_at) : null
        };
    }
    /**
     * Get failure outcomes for an episode
     * @param episodeId - Episode to get failures for
     * @param limit - Maximum number of failures to return (default: 5)
     * @returns List of failure outcomes (newest first)
     */
    async getFailures(episodeId, limit = 5) {
        const rows = await this.db.all(`SELECT * FROM episode_outcomes
       WHERE episode_id = ? AND success = 0
       ORDER BY recorded_at DESC
       LIMIT ?`, [episodeId, limit]);
        return rows.map(row => this.rowToOutcome(row));
    }
    /**
     * Check if episode should trigger a warning
     * Implements: REQ-IDESC-003
     *
     * @param episodeId - Episode to check
     * @returns True if warning should be shown
     */
    async shouldWarn(episodeId) {
        const outcomeCount = await this.getOutcomeCount(episodeId);
        if (outcomeCount < this.warningConfig.minimumOutcomes) {
            return false;
        }
        const successRate = await this.getSuccessRate(episodeId);
        if (successRate === null) {
            return false;
        }
        return successRate < this.warningConfig.warningThreshold;
    }
    /**
     * Generate warning message for an episode
     * Implements: REQ-IDESC-004, AC-IDESC-001b
     *
     * @param episodeId - Episode to generate warning for
     * @returns Warning message or null if no warning needed
     */
    async generateWarning(episodeId) {
        const shouldWarn = await this.shouldWarn(episodeId);
        if (!shouldWarn) {
            return null;
        }
        const outcomes = await this.getOutcomes(episodeId);
        const successRate = await this.getSuccessRate(episodeId);
        const failures = outcomes.filter(o => !o.success);
        const recentFailures = failures.slice(0, 3).map(f => ({
            errorType: f.errorType || 'logic_error',
            details: f.details ? JSON.stringify(f.details).substring(0, 100) : 'No details',
            timestamp: f.recordedAt
        }));
        const warningText = `
<negative_example_warning>
  <episode_id>${episodeId}</episode_id>
  <success_rate>${((successRate ?? 0) * 100).toFixed(0)}%</success_rate>
  <failure_count>${failures.length}</failure_count>

  <caution>
  This prior solution has a LOW success rate based on ${outcomes.length} previous uses.
  It may not be applicable to your current task or may contain errors.
  </caution>

  <recent_failures>
    ${recentFailures.map(f => `
    <failure>
      <error_type>${f.errorType}</error_type>
      <timestamp>${f.timestamp.toISOString()}</timestamp>
      <details>${f.details}</details>
    </failure>
    `).join('')}
  </recent_failures>

  <recommendation>
  Review this solution critically. Consider alternative approaches or verify its applicability to your specific context.
  </recommendation>
</negative_example_warning>
`.trim();
        return {
            episodeId,
            successRate: successRate ?? 0,
            totalOutcomes: outcomes.length,
            failureCount: failures.length,
            recentFailures,
            warningText
        };
    }
    /**
     * Get batch success rates for multiple episodes
     * Performance optimization for shouldInject with multiple candidates
     *
     * @param episodeIds - Episodes to get rates for
     * @returns Map of episodeId to success rate
     */
    async getBatchSuccessRates(episodeIds) {
        const results = new Map();
        // Check cache first
        const uncached = [];
        for (const episodeId of episodeIds) {
            const cached = this.successRateCache.get(episodeId);
            if (cached && Date.now() < cached.expiresAt) {
                results.set(episodeId, cached.rate);
            }
            else {
                uncached.push(episodeId);
            }
        }
        if (uncached.length === 0) {
            return results;
        }
        // Batch query for uncached episodes
        const placeholders = uncached.map(() => '?').join(',');
        const rows = await this.db.all(`SELECT episode_id, success_rate FROM episode_stats WHERE episode_id IN (${placeholders})`, uncached);
        // Process results and cache
        const found = new Set();
        for (const row of rows) {
            results.set(row.episode_id, row.success_rate);
            found.add(row.episode_id);
            this.successRateCache.set(row.episode_id, {
                rate: row.success_rate,
                expiresAt: Date.now() + this.cacheDurationMs
            });
        }
        // Episodes with no stats yet
        for (const episodeId of uncached) {
            if (!found.has(episodeId)) {
                results.set(episodeId, null);
                this.successRateCache.set(episodeId, {
                    rate: null,
                    expiresAt: Date.now() + this.cacheDurationMs
                });
            }
        }
        return results;
    }
    /**
     * Get cached success rate (PERF-001)
     * Public accessor for cache inspection
     *
     * @param episodeId - Episode to check cache for
     * @returns Cached success rate or null if not in cache or expired
     */
    getCachedSuccessRate(episodeId) {
        const cached = this.successRateCache.get(episodeId);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.rate;
        }
        return null;
    }
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
    async pruneOldOutcomes(daysOld = 90) {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
        try {
            const result = await this.db.run('DELETE FROM episode_outcomes WHERE recorded_at < ?', [cutoff.toISOString()]);
            // Note: episode_stats will be automatically recalculated by triggers
            // Clear cache to force fresh queries
            this.clearCache();
            return Number(result.lastInsertRowid) || 0;
        }
        catch (error) {
            throw new OutcomeRecordingError(`Failed to prune old outcomes: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', 'prune', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Clear the success rate cache
     * Useful for testing or forced refresh
     */
    clearCache() {
        this.successRateCache.clear();
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    /**
     * Validate outcome input
     */
    validateOutcomeInput(outcome) {
        if (!outcome.episodeId || typeof outcome.episodeId !== 'string') {
            throw new InvalidOutcomeError('episodeId is required and must be a string', outcome);
        }
        if (!outcome.taskId || typeof outcome.taskId !== 'string') {
            throw new InvalidOutcomeError('taskId is required and must be a string', outcome);
        }
        if (typeof outcome.success !== 'boolean') {
            throw new InvalidOutcomeError('success is required and must be a boolean', outcome);
        }
    }
    /**
     * Convert database row to IOutcome
     */
    rowToOutcome(row) {
        return {
            outcomeId: row.outcome_id,
            episodeId: row.episode_id,
            taskId: row.task_id,
            success: row.success === 1,
            errorType: row.error_type,
            details: row.details ? JSON.parse(row.details) : undefined,
            recordedAt: new Date(row.recorded_at)
        };
    }
}
/**
 * Factory function to create OutcomeTracker with daemon IPC
 */
export function createOutcomeTracker(db, warningConfig) {
    return new OutcomeTracker(db, warningConfig);
}
//# sourceMappingURL=outcome-tracker.js.map