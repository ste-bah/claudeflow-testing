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
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG = {
    warmUpIterations: 100,
    measureIterations: 1000,
    coolDownMs: 100,
    timeoutMs: 30000,
    outlierPercentile: 95,
};
// ==================== Statistical Functions ====================
/**
 * Calculate percentile from sorted array
 */
export function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}
/**
 * Calculate mean of array
 */
export function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}
/**
 * Calculate variance of array
 */
export function variance(values, meanValue) {
    if (values.length === 0)
        return 0;
    const m = meanValue ?? mean(values);
    return values.reduce((sum, x) => sum + (x - m) ** 2, 0) / values.length;
}
/**
 * Calculate standard deviation
 */
export function stdDev(values, meanValue) {
    return Math.sqrt(variance(values, meanValue));
}
/**
 * Calculate comprehensive statistics
 */
export function calculateStatistics(timings, outlierPercentile = 95) {
    if (timings.length === 0) {
        return {
            mean: 0,
            median: 0,
            p50: 0,
            p90: 0,
            p95: 0,
            p99: 0,
            min: 0,
            max: 0,
            stdDev: 0,
            variance: 0,
        };
    }
    // Sort for percentile calculation
    const sorted = [...timings].sort((a, b) => a - b);
    // Remove outliers (top N%)
    const cutoff = Math.max(1, Math.floor(sorted.length * (outlierPercentile / 100)));
    const filtered = sorted.slice(0, cutoff);
    const meanVal = mean(filtered);
    const varianceVal = variance(filtered, meanVal);
    return {
        mean: meanVal,
        median: percentile(filtered, 50),
        p50: percentile(filtered, 50),
        p90: percentile(filtered, 90),
        p95: percentile(filtered, 95),
        p99: percentile(filtered, 99),
        min: filtered[0],
        max: filtered[filtered.length - 1],
        stdDev: Math.sqrt(varianceVal),
        variance: varianceVal,
    };
}
// ==================== Benchmark Runner ====================
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Standardized benchmark runner
 */
export class BenchmarkRunner {
    results = new Map();
    /**
     * Run a single benchmark with standardized protocol
     */
    async runBenchmark(config, setup, benchmark, teardown) {
        // Setup phase
        const context = await setup();
        // Warm-up phase (discard results)
        for (let i = 0; i < config.warmUpIterations; i++) {
            await benchmark(context);
        }
        // Cool-down between phases
        await sleep(config.coolDownMs);
        // Measurement phase
        const timings = [];
        const startTotal = performance.now();
        for (let i = 0; i < config.measureIterations; i++) {
            const start = performance.now();
            await benchmark(context);
            const end = performance.now();
            timings.push(end - start);
        }
        const endTotal = performance.now();
        // Teardown
        if (teardown) {
            await teardown(context);
        }
        // Calculate statistics
        const statistics = calculateStatistics(timings, config.outlierPercentile);
        const result = {
            name: config.name,
            iterations: config.measureIterations,
            totalTimeMs: endTotal - startTotal,
            timings,
            statistics,
            timestamp: Date.now(),
        };
        this.results.set(config.name, result);
        return result;
    }
    /**
     * Run a synchronous benchmark
     */
    runBenchmarkSync(config, setup, benchmark, teardown) {
        // Setup phase
        const context = setup();
        // Warm-up phase (discard results)
        for (let i = 0; i < config.warmUpIterations; i++) {
            benchmark(context);
        }
        // Measurement phase
        const timings = [];
        const startTotal = performance.now();
        for (let i = 0; i < config.measureIterations; i++) {
            const start = performance.now();
            benchmark(context);
            const end = performance.now();
            timings.push(end - start);
        }
        const endTotal = performance.now();
        // Teardown
        if (teardown) {
            teardown(context);
        }
        // Calculate statistics
        const statistics = calculateStatistics(timings, config.outlierPercentile);
        const result = {
            name: config.name,
            iterations: config.measureIterations,
            totalTimeMs: endTotal - startTotal,
            timings,
            statistics,
            timestamp: Date.now(),
        };
        this.results.set(config.name, result);
        return result;
    }
    /**
     * Validate SLO for a benchmark result
     */
    validateSLO(result, target, metric = 'p95') {
        result.sloTarget = target;
        result.sloMetric = metric;
        let actual;
        switch (metric) {
            case 'p50':
                actual = result.statistics.p50;
                break;
            case 'p95':
                actual = result.statistics.p95;
                break;
            case 'p99':
                actual = result.statistics.p99;
                break;
            case 'mean':
                actual = result.statistics.mean;
                break;
            case 'median':
                actual = result.statistics.median;
                break;
        }
        result.sloPass = actual <= target;
        return result.sloPass;
    }
    /**
     * Get all results
     */
    getResults() {
        return new Map(this.results);
    }
    /**
     * Get a specific result
     */
    getResult(name) {
        return this.results.get(name);
    }
    /**
     * Clear all results
     */
    clear() {
        this.results.clear();
    }
}
/**
 * Benchmark suite runner
 */
export class BenchmarkSuite {
    name;
    benchmarks = [];
    runner = new BenchmarkRunner();
    constructor(name) {
        this.name = name;
    }
    /**
     * Add a benchmark to the suite
     */
    add(definition) {
        this.benchmarks.push(definition);
    }
    /**
     * Run all benchmarks in the suite
     */
    async run(verbose = false) {
        const results = [];
        let passed = 0;
        let failed = 0;
        if (verbose) {
            console.log(`\nRunning benchmark suite: ${this.name}`);
            console.log('='.repeat(60));
        }
        for (const bench of this.benchmarks) {
            if (verbose) {
                console.log(`\n[${bench.id}] ${bench.name}`);
                console.log(`  Target: <${bench.sloTarget}ms ${bench.sloMetric}`);
            }
            const config = {
                name: bench.id,
                ...DEFAULT_BENCHMARK_CONFIG,
                ...bench.config,
            };
            try {
                const result = await this.runner.runBenchmark(config, bench.setup, bench.benchmark, bench.teardown);
                const sloPass = this.runner.validateSLO(result, bench.sloTarget, bench.sloMetric);
                if (sloPass) {
                    passed++;
                }
                else {
                    failed++;
                }
                results.push(result);
                if (verbose) {
                    const actualValue = result.statistics[bench.sloMetric];
                    console.log(`  Actual: ${actualValue.toFixed(4)}ms ${bench.sloMetric}`);
                    console.log(`  Status: ${sloPass ? '✓ PASS' : '✗ FAIL'}`);
                }
            }
            catch (error) {
                if (verbose) {
                    console.log(`  Error: ${error}`);
                }
                failed++;
            }
        }
        if (verbose) {
            console.log('\n' + '='.repeat(60));
            console.log(`SUMMARY: ${passed}/${this.benchmarks.length} passed`);
            console.log(`Overall: ${failed === 0 ? '✓ ALL PASS' : '✗ FAILED'}`);
        }
        return {
            name: this.name,
            timestamp: Date.now(),
            results,
            summary: {
                passed,
                failed,
                total: this.benchmarks.length,
                allPass: failed === 0,
            },
        };
    }
    /**
     * Get benchmark count
     */
    size() {
        return this.benchmarks.length;
    }
}
// ==================== Global Runner Instance ====================
/**
 * Global benchmark runner instance
 */
export const benchmarkRunner = new BenchmarkRunner();
//# sourceMappingURL=runner.js.map