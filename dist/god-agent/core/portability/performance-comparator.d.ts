/**
 * Performance Comparator
 * TASK-NFR-003 - Portability Validation Suite (NFR-5.3)
 *
 * Compares performance across runtime implementations:
 * - Native vs WASM vs JavaScript benchmarks
 * - Performance delta calculations
 * - Recommendations based on results
 */
import { RuntimeType } from './runtime-selector.js';
/**
 * Timing result for a single runtime
 */
export interface RuntimeTiming {
    /** Runtime type */
    runtime: RuntimeType;
    /** Whether runtime is available */
    available: boolean;
    /** Total execution time in ms */
    totalMs?: number;
    /** Average time per operation in ms */
    avgMs?: number;
    /** Standard deviation */
    stdDev?: number;
    /** Relative performance vs native */
    relativeToNative?: string;
    /** Error if unavailable */
    error?: string;
}
/**
 * Operation comparison result
 */
export interface OperationComparison {
    /** Operation name */
    operation: string;
    /** Number of iterations */
    iterations: number;
    /** Results per runtime */
    results: RuntimeTiming[];
    /** Fastest runtime */
    fastest?: RuntimeType;
}
/**
 * Performance summary
 */
export interface PerformanceSummary {
    /** WASM vs native performance ratio */
    wasmVsNative: string;
    /** JavaScript vs native performance ratio */
    jsVsNative: string;
    /** Recommendation based on results */
    recommendation: string;
    /** Performance tier */
    tier: 'optimal' | 'acceptable' | 'degraded';
}
/**
 * Complete performance comparison report
 */
export interface PerformanceComparisonReport {
    /** Timestamp */
    timestamp: number;
    /** Platform identifier */
    platform: string;
    /** Operation comparisons */
    comparisons: OperationComparison[];
    /** Summary */
    summary: PerformanceSummary;
}
/**
 * Comparator configuration
 */
export interface PerformanceComparatorConfig {
    /** Iterations per benchmark */
    iterations: number;
    /** Warm-up iterations */
    warmupIterations: number;
    /** Vector dimensions for tests */
    dimensions: number;
    /** Verbose output */
    verbose: boolean;
}
/**
 * Default comparator configuration
 */
export declare const DEFAULT_COMPARATOR_CONFIG: PerformanceComparatorConfig;
/**
 * Performance comparator for NFR-5.3 validation
 *
 * Benchmarks and compares performance across native, WASM, and
 * JavaScript implementations.
 *
 * @example
 * ```typescript
 * const comparator = new PerformanceComparator();
 * const report = await comparator.compareAll();
 *
 * console.log(`WASM vs Native: ${report.summary.wasmVsNative}`);
 * console.log(`JS vs Native: ${report.summary.jsVsNative}`);
 * ```
 */
export declare class PerformanceComparator {
    private detector;
    private config;
    private implementations;
    constructor(config?: Partial<PerformanceComparatorConfig>);
    /**
     * Initialize implementations for benchmarking
     */
    private initializeImplementations;
    /**
     * Compare performance across all runtimes
     */
    compareAll(): Promise<PerformanceComparisonReport>;
    /**
     * Benchmark a specific operation across all runtimes
     */
    private benchmarkOperation;
    /**
     * Create L2 normalize benchmark function
     */
    private createL2NormalizeBenchmark;
    /**
     * Create cosine similarity benchmark function
     */
    private createCosineSimilarityBenchmark;
    /**
     * Create dot product benchmark function
     */
    private createDotProductBenchmark;
    /**
     * Create kNN search benchmark function
     */
    private createKnnSearchBenchmark;
    /**
     * Calculate performance deltas relative to native
     */
    private calculateDeltas;
    /**
     * Generate performance summary
     */
    private generateSummary;
    /**
     * Get performance recommendation
     */
    private getRecommendation;
    /**
     * Get performance tier
     */
    private getPerformanceTier;
    /**
     * Calculate standard deviation
     */
    private calculateStdDev;
    /**
     * Generate test vector
     */
    private generateVector;
    /**
     * Generate normalized test vector
     */
    private generateNormalizedVector;
    /**
     * Conditional logging
     */
    private log;
    /**
     * Generate markdown report
     */
    generateMarkdownReport(report: PerformanceComparisonReport): string;
}
/**
 * Global performance comparator instance
 */
export declare const performanceComparator: PerformanceComparator;
//# sourceMappingURL=performance-comparator.d.ts.map