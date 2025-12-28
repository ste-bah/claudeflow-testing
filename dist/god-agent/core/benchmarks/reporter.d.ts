/**
 * Benchmark Reporter
 * TASK-NFR-001 - Performance Benchmark Suite
 *
 * Generates benchmark reports in multiple formats:
 * - JSON: Machine-readable output
 * - Markdown: Human-readable documentation
 * - Prometheus: Metrics export format
 * - JUnit XML: CI/CD integration
 */
import type { BenchmarkSuiteResult } from './runner.js';
/**
 * Report output format
 */
export type ReportFormat = 'json' | 'markdown' | 'prometheus' | 'junit';
/**
 * Report options
 */
export interface ReportOptions {
    /** Include raw timings data */
    includeRawTimings?: boolean;
    /** Include detailed statistics */
    includeDetailedStats?: boolean;
    /** Title for the report */
    title?: string;
}
/**
 * Multi-format benchmark report generator
 */
export declare class BenchmarkReporter {
    /**
     * Generate report in specified format
     */
    generate(result: BenchmarkSuiteResult, format: ReportFormat, options?: ReportOptions): string;
    /**
     * Generate JSON report
     */
    toJSON(result: BenchmarkSuiteResult, options?: ReportOptions): string;
    /**
     * Generate Markdown report
     */
    toMarkdown(result: BenchmarkSuiteResult, options?: ReportOptions): string;
    /**
     * Generate Prometheus metrics format
     */
    toPrometheus(result: BenchmarkSuiteResult): string;
    /**
     * Generate JUnit XML format for CI/CD
     */
    toJUnit(result: BenchmarkSuiteResult): string;
}
/**
 * Global benchmark reporter instance
 */
export declare const benchmarkReporter: BenchmarkReporter;
//# sourceMappingURL=reporter.d.ts.map