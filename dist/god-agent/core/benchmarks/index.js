/**
 * Benchmarks Module
 * TASK-NFR-001 - Performance Benchmark Suite
 *
 * Provides performance benchmarking infrastructure:
 * - Standardized benchmark runner
 * - Statistical analysis
 * - Multi-format reporting
 * - SLO validation
 */
// ===== RUNNER =====
export { DEFAULT_BENCHMARK_CONFIG, 
// Statistical functions
percentile, mean, variance, stdDev, calculateStatistics, 
// Classes
BenchmarkRunner, BenchmarkSuite, 
// Global instance
benchmarkRunner, } from './runner.js';
// ===== REPORTER =====
export { 
// Classes
BenchmarkReporter, 
// Global instance
benchmarkReporter, } from './reporter.js';
// ===== REGRESSION =====
export { DEFAULT_REGRESSION_CONFIG, MemoryBaselineStorage, JsonBaselineStorage, 
// Classes
RegressionDetector, 
// Utilities
formatRegressionReportMarkdown, 
// Global instance
regressionDetector, } from './regression.js';
//# sourceMappingURL=index.js.map