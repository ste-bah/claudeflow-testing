/**
 * IDESC-001: Intelligent DESC v2 - Metrics Aggregation Service
 * TASK-IDESC-LEARN-001: Implement Metrics Aggregation Service
 * TASK-IDESC-LEARN-002: Implement Alert System for Quality Degradation
 * Sprint 6: Active Learning
 *
 * Aggregates injection metrics for active learning threshold adjustments.
 *
 * Implements:
 * - REQ-IDESC-009: Aggregate injection metrics by workflow category
 * - REQ-IDESC-010: Calculate false positive rates
 * - REQ-IDESC-011: Support 7-day and 30-day time windows
 * - REQ-IDESC-012: Alert on quality degradation
 * - NFR-IDESC-003: <100ms p95 for getMetrics
 * - AC-IDESC-005d: Alert rules (WARNING: 2%, CRITICAL: 5%, cooldown: 1 hour)
 *
 * Constitution:
 * - GUARD-IDESC-005: Graceful degradation on errors
 */
import { WorkflowCategory, type IAlert, type IAlertConfig, type IOutcome } from '../types.js';
import type { IDatabaseConnection } from './outcome-tracker.js';
/**
 * Injection metrics for a workflow category
 */
export interface IInjectionMetrics {
    /** Workflow category */
    category: WorkflowCategory;
    /** Number of episode injections */
    injectionCount: number;
    /** Success rate (0-1) */
    successRate: number;
    /** False positive rate (failed injections / total) */
    falsePositiveRate: number;
    /** Average confidence across injections (0-1) */
    avgConfidence: number;
    /** Time window for metrics */
    timeWindow: '7d' | '30d';
    /** Start of time window */
    startDate: Date;
    /** End of time window */
    endDate: Date;
}
/**
 * Metrics aggregator interface
 */
export interface IMetricsAggregator {
    /**
     * Get aggregated metrics for workflow categories
     * @param category - Optional category filter (if null, return all categories)
     * @param timeWindow - Time window for aggregation (default: '7d')
     * @returns Array of metrics by category
     */
    getMetrics(category?: WorkflowCategory, timeWindow?: '7d' | '30d'): Promise<IInjectionMetrics[]>;
    /**
     * Get false positive rate for a category or overall
     * @param category - Optional category filter
     * @returns False positive rate (0-1)
     */
    getFalsePositiveRate(category?: WorkflowCategory): Promise<number>;
    /**
     * Get success rate by category
     * @returns Map of category -> success rate
     */
    getSuccessRateByCategory(): Promise<Map<WorkflowCategory, number>>;
    /**
     * Get injection count for a time window
     * @param timeWindow - Time window ('7d' or '30d')
     * @returns Total injection count
     */
    getInjectionCountByWindow(timeWindow: '7d' | '30d'): Promise<number>;
    /**
     * Check all categories for FPR thresholds and emit alerts
     * Implements: REQ-IDESC-012, AC-IDESC-005d
     * @returns Array of emitted alerts
     */
    checkAndAlert(): Promise<IAlert[]>;
    /**
     * Get recent failure outcomes for a category
     * @param category - Workflow category
     * @param limit - Maximum number of failures to return
     * @returns Array of failure outcomes (newest first)
     */
    getRecentFailures(category: WorkflowCategory, limit?: number): Promise<IOutcome[]>;
}
/**
 * MetricsAggregator - Aggregates injection metrics for active learning
 *
 * Performance target: <100ms p95 for getMetrics (NFR-IDESC-003)
 */
export declare class MetricsAggregator implements IMetricsAggregator {
    private readonly db;
    private readonly lastAlertTime;
    private readonly alertConfig;
    constructor(db: IDatabaseConnection, alertConfig?: Partial<IAlertConfig>);
    /**
     * Get aggregated metrics for workflow categories
     * Implements: REQ-IDESC-009, REQ-IDESC-011
     */
    getMetrics(category?: WorkflowCategory, timeWindow?: '7d' | '30d'): Promise<IInjectionMetrics[]>;
    /**
     * Get false positive rate for a category or overall
     * Implements: REQ-IDESC-010
     */
    getFalsePositiveRate(category?: WorkflowCategory): Promise<number>;
    /**
     * Get success rate by category
     * Implements: REQ-IDESC-009
     */
    getSuccessRateByCategory(): Promise<Map<WorkflowCategory, number>>;
    /**
     * Get injection count for a time window
     * Implements: REQ-IDESC-011
     */
    getInjectionCountByWindow(timeWindow: '7d' | '30d'): Promise<number>;
    /**
     * Check all categories for FPR thresholds and emit alerts
     * Implements: REQ-IDESC-012, AC-IDESC-005d
     */
    checkAndAlert(): Promise<IAlert[]>;
    /**
     * Emit an alert for quality degradation
     * Implements: AC-IDESC-005d
     */
    private emitAlert;
    /**
     * Get recent failure outcomes for a category
     * Implements: REQ-IDESC-012
     */
    getRecentFailures(category: WorkflowCategory, limit?: number): Promise<IOutcome[]>;
}
/**
 * Factory function to create MetricsAggregator
 *
 * @param db - Database connection
 * @param alertConfig - Optional alert configuration
 * @returns MetricsAggregator instance
 */
export declare function createMetricsAggregator(db: IDatabaseConnection, alertConfig?: Partial<IAlertConfig>): MetricsAggregator;
//# sourceMappingURL=metrics-aggregator.d.ts.map