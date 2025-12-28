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
import type { WorkflowCategory } from '../types.js';
import type { IMetricsAggregator } from './metrics-aggregator.js';
import type { IDatabaseConnection } from './outcome-tracker.js';
/**
 * Threshold adjustment record
 * Implements: REQ-IDESC-013, AC-IDESC-006a
 */
export interface IThresholdAdjustment {
    /** Workflow category */
    category: WorkflowCategory;
    /** Previous threshold value */
    oldThreshold: number;
    /** New threshold value */
    newThreshold: number;
    /** Reason for adjustment */
    reason: string;
    /** When adjustment was made */
    timestamp: Date;
    /** Number of samples used for decision */
    samplesUsed: number;
    /** Whether this is a manual override */
    isManualOverride?: boolean;
}
/**
 * Threshold configuration
 * Implements: REQ-IDESC-015, EC-IDESC-008
 */
export interface IThresholdConfig {
    /** Base threshold values by category */
    baseThresholds: Record<WorkflowCategory, number>;
    /** Maximum adjustment per period (default: 0.05 = 5%) */
    maxAdjustmentPerPeriod: number;
    /** Adjustment period in days (default: 30) */
    adjustmentPeriodDays: number;
    /** Minimum samples required for adjustment (default: 10) */
    minimumSamples: number;
    /** Target success rate for optimization (default: 0.80) */
    targetSuccessRate: number;
}
/**
 * Threshold adjuster interface
 * Implements: REQ-IDESC-014
 */
export interface IThresholdAdjuster {
    /**
     * Get current thresholds for all categories
     * @returns Map of category -> current threshold
     */
    getCurrentThresholds(): Record<WorkflowCategory, number>;
    /**
     * Propose threshold adjustment based on metrics
     * @param category - Workflow category to adjust
     * @returns Proposed adjustment or null if no adjustment needed
     */
    proposeAdjustment(category: WorkflowCategory): Promise<IThresholdAdjustment | null>;
    /**
     * Apply threshold adjustment
     * @param adjustment - Adjustment to apply
     * @throws ThresholdBoundsError if adjustment violates bounds
     */
    applyAdjustment(adjustment: IThresholdAdjustment): Promise<void>;
    /**
     * Get adjustment history
     * @param category - Optional category filter
     * @param limit - Maximum number of adjustments to return
     * @returns Array of adjustments (newest first)
     */
    getAdjustmentHistory(category?: WorkflowCategory, limit?: number): Promise<IThresholdAdjustment[]>;
    /**
     * Reset thresholds to base values
     */
    resetToDefaults(): void;
    /**
     * Set manual override for a category
     * Implements: AC-IDESC-006b
     * @param category - Category to override
     * @param threshold - Threshold value
     */
    setManualOverride(category: WorkflowCategory, threshold: number): void;
    /**
     * Clear manual override for a category
     * @param category - Category to clear override for
     */
    clearManualOverride(category: WorkflowCategory): void;
}
/**
 * ThresholdAdjuster - Automatic threshold adjustment based on metrics
 *
 * Features:
 * - Bounded adjustments (±5% per 30 days)
 * - Minimum sample requirements (10 outcomes)
 * - Manual override support
 * - Audit trail persistence
 */
export declare class ThresholdAdjuster implements IThresholdAdjuster {
    private readonly db;
    private readonly metricsAggregator;
    private currentThresholds;
    private manualOverrides;
    private readonly config;
    constructor(db: IDatabaseConnection, metricsAggregator: IMetricsAggregator, config?: Partial<IThresholdConfig>);
    /**
     * Get current thresholds for all categories
     */
    getCurrentThresholds(): Record<WorkflowCategory, number>;
    /**
     * Propose threshold adjustment based on metrics
     * Implements: REQ-IDESC-014, REQ-IDESC-016
     */
    proposeAdjustment(category: WorkflowCategory): Promise<IThresholdAdjustment | null>;
    /**
     * Calculate proposed threshold based on success rate
     * Implements: REQ-IDESC-014
     */
    private calculateProposedThreshold;
    /**
     * Generate human-readable reason for adjustment
     */
    private generateAdjustmentReason;
    /**
     * Validate that adjustment is within bounds
     * Implements: GUARD-IDESC-003
     */
    private validateAdjustmentBounds;
    /**
     * Get total adjustment in current period
     * Implements: GUARD-IDESC-003
     */
    private getPeriodAdjustment;
    /**
     * Apply threshold adjustment
     * Implements: REQ-IDESC-013, AC-IDESC-006a
     */
    applyAdjustment(adjustment: IThresholdAdjustment): Promise<void>;
    /**
     * Get adjustment history
     * Implements: AC-IDESC-006a
     */
    getAdjustmentHistory(category?: WorkflowCategory, limit?: number): Promise<IThresholdAdjustment[]>;
    /**
     * Reset thresholds to base values
     */
    resetToDefaults(): void;
    /**
     * Set manual override for a category
     * Implements: AC-IDESC-006b, AC-IDESC-006c
     */
    setManualOverride(category: WorkflowCategory, threshold: number): void;
    /**
     * Clear manual override for a category
     */
    clearManualOverride(category: WorkflowCategory): void;
}
/**
 * Factory function to create ThresholdAdjuster
 *
 * @param db - Database connection
 * @param metricsAggregator - Metrics aggregator instance
 * @param config - Optional threshold configuration
 * @returns ThresholdAdjuster instance
 */
export declare function createThresholdAdjuster(db: IDatabaseConnection, metricsAggregator: IMetricsAggregator, config?: Partial<IThresholdConfig>): ThresholdAdjuster;
/**
 * Initialize threshold_adjustments table
 *
 * @param db - Database connection
 */
export declare function initThresholdAdjustmentsTable(db: IDatabaseConnection): Promise<void>;
//# sourceMappingURL=threshold-adjuster.d.ts.map