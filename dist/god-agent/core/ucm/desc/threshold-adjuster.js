/**
 * IDESC-001: Intelligent DESC v2 - Threshold Adjustment Algorithm
 * TASK-IDESC-LEARN-003: Implement Threshold Adjustment Algorithm
 * Sprint 6: Active Learning
 *
 * Automatic threshold adjustment based on outcome feedback.
 *
 * Implements:
 * - REQ-IDESC-013: Track threshold changes by category
 * - REQ-IDESC-014: Adjust thresholds based on success rate
 * - REQ-IDESC-015: Bound adjustments to ±5% per 30 days
 * - REQ-IDESC-016: Require minimum 10 samples for adjustment
 * - AC-IDESC-006a: Track all adjustment history
 * - AC-IDESC-006b: Support manual overrides
 * - AC-IDESC-006c: Manual overrides take precedence
 *
 * Constitution:
 * - GUARD-IDESC-003: Bound threshold changes to ±5% per 30 days
 * - GUARD-IDESC-005: Graceful degradation on errors
 * - EC-IDESC-008: Minimum 10 samples for statistical validity
 */
import { randomUUID } from 'crypto';
import { ThresholdError, ThresholdBoundsError, InvalidThresholdError } from './errors.js';
/**
 * Default threshold configuration
 * Implements: REQ-IDESC-015, EC-IDESC-008
 */
const DEFAULT_THRESHOLD_CONFIG = {
    baseThresholds: {
        research: 0.80,
        coding: 0.75,
        general: 0.70
    },
    maxAdjustmentPerPeriod: 0.05, // 5%
    adjustmentPeriodDays: 30,
    minimumSamples: 10,
    targetSuccessRate: 0.80
};
/**
 * ThresholdAdjuster - Automatic threshold adjustment based on metrics
 *
 * Features:
 * - Bounded adjustments (±5% per 30 days)
 * - Minimum sample requirements (10 outcomes)
 * - Manual override support
 * - Audit trail persistence
 */
export class ThresholdAdjuster {
    db;
    metricsAggregator;
    currentThresholds;
    manualOverrides;
    config;
    constructor(db, metricsAggregator, config) {
        this.db = db;
        this.metricsAggregator = metricsAggregator;
        this.config = { ...DEFAULT_THRESHOLD_CONFIG, ...config };
        this.currentThresholds = { ...this.config.baseThresholds };
        this.manualOverrides = new Map();
    }
    /**
     * Get current thresholds for all categories
     */
    getCurrentThresholds() {
        // Manual overrides take precedence (AC-IDESC-006c)
        const result = { ...this.currentThresholds };
        this.manualOverrides.forEach((threshold, category) => {
            result[category] = threshold;
        });
        return result;
    }
    /**
     * Propose threshold adjustment based on metrics
     * Implements: REQ-IDESC-014, REQ-IDESC-016
     */
    async proposeAdjustment(category) {
        try {
            // Check if manual override is set (AC-IDESC-006c)
            if (this.manualOverrides.has(category)) {
                console.log(`[ThresholdAdjuster] Category ${category} has manual override, skipping adjustment`);
                return null;
            }
            // Get metrics for category
            const metrics = await this.metricsAggregator.getMetrics(category, '30d');
            if (metrics.length === 0) {
                return null; // No data for this category
            }
            const categoryMetrics = metrics[0];
            const { injectionCount, successRate } = categoryMetrics;
            // Check minimum samples requirement (EC-IDESC-008)
            if (injectionCount < this.config.minimumSamples) {
                console.log(`[ThresholdAdjuster] Category ${category} has ${injectionCount} samples, minimum ${this.config.minimumSamples} required`);
                return null;
            }
            // Get current threshold (accounting for manual overrides)
            const currentThreshold = this.getCurrentThresholds()[category];
            // Calculate proposed adjustment
            const proposedThreshold = this.calculateProposedThreshold(currentThreshold, successRate, category);
            // Check if adjustment is significant enough (>0.5%)
            const delta = Math.abs(proposedThreshold - currentThreshold);
            if (delta < 0.005) {
                console.log(`[ThresholdAdjuster] Category ${category} delta ${delta.toFixed(4)} too small, no adjustment needed`);
                return null;
            }
            // Validate bounds (GUARD-IDESC-003)
            await this.validateAdjustmentBounds(category, currentThreshold, proposedThreshold);
            // Generate reason
            const reason = this.generateAdjustmentReason(currentThreshold, proposedThreshold, successRate);
            return {
                category,
                oldThreshold: currentThreshold,
                newThreshold: proposedThreshold,
                reason,
                timestamp: new Date(),
                samplesUsed: injectionCount,
                isManualOverride: false
            };
        }
        catch (error) {
            // GUARD-IDESC-005: Graceful degradation
            if (error instanceof ThresholdError) {
                throw error; // Re-throw threshold-specific errors (RULE-070: already typed)
            }
            console.error(`[ThresholdAdjuster] Failed to propose adjustment for ${category}:`, error);
            return null;
        }
    }
    /**
     * Calculate proposed threshold based on success rate
     * Implements: REQ-IDESC-014
     */
    calculateProposedThreshold(currentThreshold, successRate, category) {
        const targetRate = this.config.targetSuccessRate;
        // Calculate delta based on success rate deviation
        let delta = 0;
        if (successRate > 0.85) {
            // Excellent results - can lower threshold to allow more injections
            delta = -0.02; // Lower by 2%
        }
        else if (successRate > targetRate) {
            // Good results - small reduction
            delta = -0.01; // Lower by 1%
        }
        else if (successRate < 0.60) {
            // Poor results - raise threshold to be more selective
            delta = 0.03; // Raise by 3%
        }
        else if (successRate < targetRate) {
            // Below target - moderate increase
            delta = 0.02; // Raise by 2%
        }
        // Apply delta and bound to [0, 1]
        const proposed = Math.max(0, Math.min(1, currentThreshold + delta));
        return Math.round(proposed * 1000) / 1000; // Round to 3 decimals
    }
    /**
     * Generate human-readable reason for adjustment
     */
    generateAdjustmentReason(oldThreshold, newThreshold, successRate) {
        const direction = newThreshold > oldThreshold ? 'Raising' : 'Lowering';
        const percentChange = Math.abs((newThreshold - oldThreshold) / oldThreshold * 100).toFixed(1);
        const successPercent = (successRate * 100).toFixed(1);
        return `${direction} threshold by ${percentChange}% based on ${successPercent}% success rate`;
    }
    /**
     * Validate that adjustment is within bounds
     * Implements: GUARD-IDESC-003
     */
    async validateAdjustmentBounds(category, currentValue, proposedValue) {
        // Validate threshold range [0, 1] first (before checking period bounds)
        if (proposedValue < 0 || proposedValue > 1) {
            throw new InvalidThresholdError(category, proposedValue, 'Threshold must be between 0 and 1');
        }
        // Get total adjustment in current period
        const periodAdjustment = await this.getPeriodAdjustment(category);
        const requestedAdjustment = proposedValue - currentValue;
        const totalAdjustment = periodAdjustment + requestedAdjustment;
        const maxAdjustment = this.config.maxAdjustmentPerPeriod;
        // Check bounds
        if (Math.abs(totalAdjustment) > maxAdjustment) {
            throw new ThresholdBoundsError(category, currentValue, proposedValue, maxAdjustment, this.config.adjustmentPeriodDays);
        }
    }
    /**
     * Get total adjustment in current period
     * Implements: GUARD-IDESC-003
     */
    async getPeriodAdjustment(category) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - this.config.adjustmentPeriodDays);
            const startDateStr = startDate.toISOString();
            const sql = `
        SELECT
          SUM(new_threshold - old_threshold) as total_adjustment
        FROM threshold_adjustments
        WHERE category = ?
          AND adjusted_at >= ?
          AND is_manual_override = 0
      `;
            const result = await this.db.get(sql, [category, startDateStr]);
            return result?.total_adjustment ?? 0;
        }
        catch (error) {
            console.error('[ThresholdAdjuster] Failed to get period adjustment:', error);
            return 0; // Fail safe - assume no adjustment
        }
    }
    /**
     * Apply threshold adjustment
     * Implements: REQ-IDESC-013, AC-IDESC-006a
     */
    async applyAdjustment(adjustment) {
        try {
            // Validate adjustment bounds
            await this.validateAdjustmentBounds(adjustment.category, adjustment.oldThreshold, adjustment.newThreshold);
            // Update current threshold
            this.currentThresholds[adjustment.category] = adjustment.newThreshold;
            // Persist to database
            await this.db.run(`INSERT INTO threshold_adjustments (
          id,
          category,
          old_threshold,
          new_threshold,
          reason,
          samples_used,
          is_manual_override,
          adjusted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                randomUUID(),
                adjustment.category,
                adjustment.oldThreshold,
                adjustment.newThreshold,
                adjustment.reason,
                adjustment.samplesUsed,
                adjustment.isManualOverride ? 1 : 0,
                adjustment.timestamp.toISOString()
            ]);
            console.log(`[ThresholdAdjuster] Applied adjustment for ${adjustment.category}: ${adjustment.oldThreshold} -> ${adjustment.newThreshold} (${adjustment.reason})`);
        }
        catch (error) {
            if (error instanceof ThresholdError) {
                throw error;
            }
            throw new ThresholdError(`Failed to apply adjustment for ${adjustment.category}`, {
                adjustment,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Get adjustment history
     * Implements: AC-IDESC-006a
     */
    async getAdjustmentHistory(category, limit = 50) {
        try {
            let sql = `
        SELECT
          category,
          old_threshold as oldThreshold,
          new_threshold as newThreshold,
          reason,
          samples_used as samplesUsed,
          is_manual_override as isManualOverride,
          adjusted_at as timestamp
        FROM threshold_adjustments
      `;
            const params = [];
            if (category) {
                sql += ' WHERE category = ?';
                params.push(category);
            }
            sql += ' ORDER BY adjusted_at DESC LIMIT ?';
            params.push(limit);
            const rows = await this.db.all(sql, params);
            return rows.map(row => ({
                category: row.category,
                oldThreshold: row.oldThreshold,
                newThreshold: row.newThreshold,
                reason: row.reason,
                samplesUsed: row.samplesUsed,
                isManualOverride: row.isManualOverride === 1,
                timestamp: new Date(row.timestamp)
            }));
        }
        catch (error) {
            console.error('[ThresholdAdjuster] Failed to get adjustment history:', error);
            return [];
        }
    }
    /**
     * Reset thresholds to base values
     */
    resetToDefaults() {
        this.currentThresholds = { ...this.config.baseThresholds };
        this.manualOverrides.clear();
        console.log('[ThresholdAdjuster] Reset thresholds to defaults');
    }
    /**
     * Set manual override for a category
     * Implements: AC-IDESC-006b, AC-IDESC-006c
     */
    setManualOverride(category, threshold) {
        // Validate threshold range
        if (threshold < 0 || threshold > 1) {
            throw new InvalidThresholdError(category, threshold, 'Threshold must be between 0 and 1');
        }
        this.manualOverrides.set(category, threshold);
        console.log(`[ThresholdAdjuster] Set manual override for ${category}: ${threshold}`);
    }
    /**
     * Clear manual override for a category
     */
    clearManualOverride(category) {
        this.manualOverrides.delete(category);
        console.log(`[ThresholdAdjuster] Cleared manual override for ${category}`);
    }
}
/**
 * Factory function to create ThresholdAdjuster
 *
 * @param db - Database connection
 * @param metricsAggregator - Metrics aggregator instance
 * @param config - Optional threshold configuration
 * @returns ThresholdAdjuster instance
 */
export function createThresholdAdjuster(db, metricsAggregator, config) {
    return new ThresholdAdjuster(db, metricsAggregator, config);
}
/**
 * Initialize threshold_adjustments table
 *
 * @param db - Database connection
 */
export async function initThresholdAdjustmentsTable(db) {
    try {
        await db.run(`
      CREATE TABLE IF NOT EXISTS threshold_adjustments (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        old_threshold REAL NOT NULL,
        new_threshold REAL NOT NULL,
        reason TEXT NOT NULL,
        samples_used INTEGER NOT NULL,
        is_manual_override INTEGER DEFAULT 0,
        adjusted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create index for efficient queries
        await db.run(`
      CREATE INDEX IF NOT EXISTS idx_threshold_adjustments_category
      ON threshold_adjustments(category, adjusted_at DESC)
    `);
        console.log('[ThresholdAdjuster] Initialized threshold_adjustments table');
    }
    catch (error) {
        console.error('[ThresholdAdjuster] Failed to initialize table:', error);
        // RULE-070: Re-throw with initialization context
        throw new Error(`Failed to initialize threshold_adjustments table: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
//# sourceMappingURL=threshold-adjuster.js.map