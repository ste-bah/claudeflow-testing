/**
 * Regression Detector
 * TASK-NFR-001 - Performance Benchmark Suite
 *
 * Provides regression detection capabilities:
 * - Baseline storage and loading
 * - Threshold-based regression detection
 * - Severity classification
 * - Trend analysis
 */
import type { BenchmarkSuiteResult, BenchmarkStatistics } from './runner.js';
/**
 * Severity levels for regressions
 */
export type RegressionSeverity = 'info' | 'warning' | 'critical';
/**
 * Single regression detection result
 */
export interface Regression {
    /** Benchmark name */
    benchmark: string;
    /** Baseline value in ms */
    baseline: number;
    /** Current value in ms */
    current: number;
    /** Percentage change */
    changePercent: number;
    /** Severity classification */
    severity: RegressionSeverity;
    /** Metric used for comparison */
    metric: keyof BenchmarkStatistics;
}
/**
 * Improvement detection (negative change)
 */
export interface Improvement {
    /** Benchmark name */
    benchmark: string;
    /** Baseline value in ms */
    baseline: number;
    /** Current value in ms */
    current: number;
    /** Percentage change (negative = improvement) */
    changePercent: number;
    /** Metric used for comparison */
    metric: keyof BenchmarkStatistics;
}
/**
 * Complete regression report
 */
export interface RegressionReport {
    /** Whether a baseline was available */
    hasBaseline: boolean;
    /** Detected regressions */
    regressions: Regression[];
    /** Detected improvements */
    improvements: Improvement[];
    /** Summary counts */
    summary: {
        total: number;
        regressions: number;
        improvements: number;
        unchanged: number;
    };
    /** Overall status */
    status: 'pass' | 'warning' | 'fail';
    /** Baseline timestamp if available */
    baselineTimestamp?: number;
    /** Current timestamp */
    currentTimestamp: number;
}
/**
 * Regression detection configuration
 */
export interface RegressionConfig {
    /** Percentage threshold for regression detection (default: 10) */
    regressionThreshold: number;
    /** Percentage threshold for improvement detection (default: -10) */
    improvementThreshold: number;
    /** Percentage threshold for warning severity (default: 25) */
    warningSeverityThreshold: number;
    /** Percentage threshold for critical severity (default: 50) */
    criticalSeverityThreshold: number;
    /** Metric to compare (default: 'p95') */
    metric: keyof BenchmarkStatistics;
}
/**
 * Default regression configuration
 */
export declare const DEFAULT_REGRESSION_CONFIG: RegressionConfig;
/**
 * In-memory baseline storage interface
 */
export interface BaselineStorage {
    /** Save baseline */
    save(baseline: BenchmarkSuiteResult): void;
    /** Load baseline */
    load(): BenchmarkSuiteResult | null;
    /** Check if baseline exists */
    exists(): boolean;
    /** Clear baseline */
    clear(): void;
}
/**
 * In-memory baseline storage implementation
 */
export declare class MemoryBaselineStorage implements BaselineStorage {
    private baseline;
    save(baseline: BenchmarkSuiteResult): void;
    load(): BenchmarkSuiteResult | null;
    exists(): boolean;
    clear(): void;
}
/**
 * JSON-serializable baseline storage
 * (For use with file storage in integration)
 */
export declare class JsonBaselineStorage implements BaselineStorage {
    private data;
    save(baseline: BenchmarkSuiteResult): void;
    load(): BenchmarkSuiteResult | null;
    exists(): boolean;
    clear(): void;
    /** Export baseline as JSON string */
    export(): string | null;
    /** Import baseline from JSON string */
    import(json: string): boolean;
}
/**
 * Regression detector for performance trends
 *
 * Compares benchmark results against a stored baseline and
 * detects performance regressions based on configurable thresholds.
 *
 * @example
 * ```typescript
 * const detector = new RegressionDetector();
 *
 * // Save baseline
 * detector.saveBaseline(baselineResults);
 *
 * // Detect regressions
 * const report = detector.detectRegressions(currentResults);
 *
 * if (report.status === 'fail') {
 *   console.log('Performance regressions detected!');
 *   for (const r of report.regressions) {
 *     console.log(`${r.benchmark}: ${r.changePercent.toFixed(1)}% slower`);
 *   }
 * }
 * ```
 */
export declare class RegressionDetector {
    private storage;
    private config;
    constructor(storage?: BaselineStorage, config?: Partial<RegressionConfig>);
    /**
     * Save current results as the new baseline
     */
    saveBaseline(results: BenchmarkSuiteResult): void;
    /**
     * Load the stored baseline
     */
    loadBaseline(): BenchmarkSuiteResult | null;
    /**
     * Check if a baseline exists
     */
    hasBaseline(): boolean;
    /**
     * Clear the stored baseline
     */
    clearBaseline(): void;
    /**
     * Detect regressions between current results and baseline
     *
     * @param current - Current benchmark results
     * @param config - Optional configuration overrides
     * @returns Regression report
     */
    detectRegressions(current: BenchmarkSuiteResult, config?: Partial<RegressionConfig>): RegressionReport;
    /**
     * Compare two benchmark results directly without baseline storage
     *
     * @param baseline - Baseline results
     * @param current - Current results to compare
     * @param config - Optional configuration overrides
     * @returns Regression report
     */
    compare(baseline: BenchmarkSuiteResult, current: BenchmarkSuiteResult, config?: Partial<RegressionConfig>): RegressionReport;
    /**
     * Get trend analysis for a specific benchmark across multiple runs
     *
     * @param benchmarkName - Name of benchmark to analyze
     * @param history - Array of past results (oldest first)
     * @returns Trend analysis
     */
    analyzeTrend(benchmarkName: string, history: BenchmarkSuiteResult[]): TrendAnalysis;
    /**
     * Classify regression severity
     */
    private classifySeverity;
    /**
     * Get current configuration
     */
    getConfig(): RegressionConfig;
    /**
     * Update configuration
     */
    setConfig(config: Partial<RegressionConfig>): void;
}
/**
 * Trend analysis result
 */
export interface TrendAnalysis {
    /** Benchmark name */
    benchmark: string;
    /** Number of data points */
    dataPoints: number;
    /** Trend direction */
    trend: 'improving' | 'degrading' | 'stable';
    /** Linear regression slope */
    slope: number;
    /** Historical values */
    values: number[];
    /** Historical timestamps */
    timestamps: number[];
}
/**
 * Format regression report as Markdown
 */
export declare function formatRegressionReportMarkdown(report: RegressionReport): string;
/**
 * Global regression detector instance
 */
export declare const regressionDetector: RegressionDetector;
//# sourceMappingURL=regression.d.ts.map