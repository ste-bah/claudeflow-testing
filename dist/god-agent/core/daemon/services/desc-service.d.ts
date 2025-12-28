/**
 * DESC Metrics Service - IPC wrapper for IDESC-001 Metrics Aggregation
 * TASK-IDESC-LEARN-004: Implement Observability Dashboard Integration
 * Sprint 6: Active Learning
 *
 * Exposes DESC (Dual Embedding Symmetric Chunking) metrics via JSON-RPC 2.0
 * for observability dashboards and monitoring systems.
 *
 * Implements:
 * - REQ-IDESC-009: Aggregate injection metrics by workflow category
 * - REQ-IDESC-010: Calculate false positive rates
 * - REQ-IDESC-011: Support 7-day and 30-day time windows
 * - REQ-IDESC-012: Alert on quality degradation
 * - NFR-IDESC-003: <100ms p95 for getMetrics
 */
import { type IDatabaseConnection } from '../../ucm/desc/index.js';
import { WorkflowCategory } from '../../ucm/types.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * DESC metrics service parameters
 */
export interface IDescMetricsParams {
    /** Optional workflow category filter */
    category?: WorkflowCategory | string;
    /** Time window for metrics aggregation */
    timeWindow?: '7d' | '30d';
}
export interface IDescSuccessRateParams {
    /** Optional workflow category filter */
    category?: WorkflowCategory | string;
}
export interface IDescFalsePositiveRateParams {
    /** Optional workflow category filter */
    category?: WorkflowCategory | string;
}
export interface IDescInjectionCountParams {
    /** Time window for injection count */
    timeWindow: '7d' | '30d';
}
export interface IDescRecentFailuresParams {
    /** Workflow category */
    category: WorkflowCategory | string;
    /** Maximum number of failures to return */
    limit?: number;
}
export interface IDescTimeSeriesParams {
    /** Optional workflow category filter */
    category?: WorkflowCategory | string;
    /** Time window for time series data */
    timeWindow?: '7d' | '30d';
    /** Granularity: 'hourly' or 'daily' */
    granularity?: 'hourly' | 'daily';
}
/**
 * DESC metrics service responses
 */
export interface IDescMetricsResponse {
    /** Array of metrics by workflow category */
    metrics: Array<{
        category: string;
        injectionCount: number;
        successRate: number;
        falsePositiveRate: number;
        avgConfidence: number;
        timeWindow: string;
        startDate: string;
        endDate: string;
    }>;
}
export interface IDescSuccessRateResponse {
    /** Map of category to success rate */
    successRates: Record<string, number>;
}
export interface IDescFalsePositiveRateResponse {
    /** False positive rate (0-1) */
    falsePositiveRate: number;
}
export interface IDescInjectionCountResponse {
    /** Total injection count for time window */
    injectionCount: number;
    timeWindow: string;
}
export interface IDescAlertsResponse {
    /** Array of emitted alerts */
    alerts: Array<{
        type: string;
        severity: string;
        category: string;
        falsePositiveRate: number;
        threshold: number;
        message: string;
        timestamp: string;
        recentFailures?: Array<{
            outcomeId: string;
            episodeId: string;
            taskId: string;
            success: boolean;
            errorType: string | null;
            details: unknown;
            recordedAt: string;
        }>;
    }>;
}
export interface IDescRecentFailuresResponse {
    /** Array of recent failure outcomes */
    failures: Array<{
        outcomeId: string;
        episodeId: string;
        taskId: string;
        success: boolean;
        errorType: string | null;
        details: unknown;
        recordedAt: string;
    }>;
}
export interface IDescTimeSeriesResponse {
    /** Time series data points */
    timeSeries: Array<{
        timestamp: string;
        value: number;
        category?: string;
    }>;
    granularity: string;
    timeWindow: string;
}
/**
 * Create DESC metrics service handler
 *
 * @param db - Database connection for accessing episode outcomes
 * @returns Service handler with method map
 *
 * @example
 * ```typescript
 * const db = getDatabaseConnection();
 * const descService = createDescService(db);
 * serviceRegistry.registerService('desc', descService);
 * ```
 */
export declare function createDescService(db: IDatabaseConnection): ServiceHandler;
//# sourceMappingURL=desc-service.d.ts.map