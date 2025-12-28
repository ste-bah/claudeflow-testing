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
export { type BenchmarkConfig, DEFAULT_BENCHMARK_CONFIG, type BenchmarkStatistics, type BenchmarkResult, type BenchmarkSuiteResult, type BenchmarkDefinition, percentile, mean, variance, stdDev, calculateStatistics, BenchmarkRunner, BenchmarkSuite, benchmarkRunner, } from './runner.js';
export { type ReportFormat, type ReportOptions, BenchmarkReporter, benchmarkReporter, } from './reporter.js';
export { type RegressionSeverity, type Regression, type Improvement, type RegressionReport, type RegressionConfig, DEFAULT_REGRESSION_CONFIG, type TrendAnalysis, type BaselineStorage, MemoryBaselineStorage, JsonBaselineStorage, RegressionDetector, formatRegressionReportMarkdown, regressionDetector, } from './regression.js';
//# sourceMappingURL=index.d.ts.map