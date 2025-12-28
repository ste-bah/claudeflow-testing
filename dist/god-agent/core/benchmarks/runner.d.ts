/**
 * Benchmark Runner
 * TASK-NFR-001 - Performance Benchmark Suite
 *
 * Provides standardized benchmark execution with:
 * - Warm-up, measurement, and cool-down phases
 * - Statistical analysis (percentiles, mean, stdDev)
 * - Outlier removal
 * - SLO validation
 */
/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
    /** Benchmark name */
    name: string;
    /** Warm-up iterations (discarded) */
    warmUpIterations: number;
    /** Measurement iterations */
    measureIterations: number;
    /** Cool-down time in ms */
    coolDownMs: number;
    /** Maximum timeout in ms */
    timeoutMs: number;
    /** Percentile for outlier removal (e.g., 95 removes top 5%) */
    outlierPercentile: number;
}
/**
 * Default benchmark configuration
 */
export declare const DEFAULT_BENCHMARK_CONFIG: Omit<BenchmarkConfig, 'name'>;
/**
 * Statistics result
 */
export interface BenchmarkStatistics {
    mean: number;
    median: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    stdDev: number;
    variance: number;
}
/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
    /** Benchmark name */
    name: string;
    /** Number of measurement iterations */
    iterations: number;
    /** Total execution time in ms */
    totalTimeMs: number;
    /** Individual iteration timings in ms */
    timings: number[];
    /** Calculated statistics */
    statistics: BenchmarkStatistics;
    /** SLO target in ms (if defined) */
    sloTarget?: number;
    /** SLO metric type */
    sloMetric?: 'p50' | 'p95' | 'p99' | 'mean' | 'median';
    /** Whether SLO was met */
    sloPass?: boolean;
    /** Timestamp of benchmark run */
    timestamp: number;
}
/**
 * Benchmark suite result
 */
export interface BenchmarkSuiteResult {
    /** Suite name */
    name: string;
    /** Timestamp */
    timestamp: number;
    /** Individual benchmark results */
    results: BenchmarkResult[];
    /** SLO summary */
    summary: {
        passed: number;
        failed: number;
        total: number;
        allPass: boolean;
    };
}
/**
 * Calculate percentile from sorted array
 */
export declare function percentile(sorted: number[], p: number): number;
/**
 * Calculate mean of array
 */
export declare function mean(values: number[]): number;
/**
 * Calculate variance of array
 */
export declare function variance(values: number[], meanValue?: number): number;
/**
 * Calculate standard deviation
 */
export declare function stdDev(values: number[], meanValue?: number): number;
/**
 * Calculate comprehensive statistics
 */
export declare function calculateStatistics(timings: number[], outlierPercentile?: number): BenchmarkStatistics;
/**
 * Standardized benchmark runner
 */
export declare class BenchmarkRunner {
    private results;
    /**
     * Run a single benchmark with standardized protocol
     */
    runBenchmark<T>(config: BenchmarkConfig, setup: () => Promise<T>, benchmark: (context: T) => Promise<void> | void, teardown?: (context: T) => Promise<void> | void): Promise<BenchmarkResult>;
    /**
     * Run a synchronous benchmark
     */
    runBenchmarkSync<T>(config: BenchmarkConfig, setup: () => T, benchmark: (context: T) => void, teardown?: (context: T) => void): BenchmarkResult;
    /**
     * Validate SLO for a benchmark result
     */
    validateSLO(result: BenchmarkResult, target: number, metric?: 'p50' | 'p95' | 'p99' | 'mean' | 'median'): boolean;
    /**
     * Get all results
     */
    getResults(): Map<string, BenchmarkResult>;
    /**
     * Get a specific result
     */
    getResult(name: string): BenchmarkResult | undefined;
    /**
     * Clear all results
     */
    clear(): void;
}
/**
 * Benchmark definition for suite
 */
export interface BenchmarkDefinition<T = unknown> {
    /** Benchmark ID */
    id: string;
    /** Display name */
    name: string;
    /** SLO target in ms */
    sloTarget: number;
    /** SLO metric type */
    sloMetric: 'p50' | 'p95' | 'p99' | 'mean' | 'median';
    /** Configuration overrides */
    config?: Partial<BenchmarkConfig>;
    /** Setup function */
    setup: () => Promise<T> | T;
    /** Benchmark function */
    benchmark: (context: T) => Promise<void> | void;
    /** Teardown function */
    teardown?: (context: T) => Promise<void> | void;
}
/**
 * Benchmark suite runner
 */
export declare class BenchmarkSuite {
    private name;
    private benchmarks;
    private runner;
    constructor(name: string);
    /**
     * Add a benchmark to the suite
     */
    add<T>(definition: BenchmarkDefinition<T>): void;
    /**
     * Run all benchmarks in the suite
     */
    run(verbose?: boolean): Promise<BenchmarkSuiteResult>;
    /**
     * Get benchmark count
     */
    size(): number;
}
/**
 * Global benchmark runner instance
 */
export declare const benchmarkRunner: BenchmarkRunner;
//# sourceMappingURL=runner.d.ts.map