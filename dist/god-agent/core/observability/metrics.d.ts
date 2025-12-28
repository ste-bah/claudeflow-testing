/**
 * Prometheus-style Metrics
 * TASK-OBS-001 - Observability Stack
 *
 * Provides Prometheus-compatible metric types:
 * - Counter: monotonically increasing values
 * - Gauge: point-in-time values (can go up/down)
 * - Histogram: value distributions with buckets
 * - Summary: pre-aggregated statistics
 */
/**
 * Metric type enumeration
 */
export declare enum MetricType {
    COUNTER = "counter",
    GAUGE = "gauge",
    HISTOGRAM = "histogram",
    SUMMARY = "summary"
}
/**
 * Metric labels (dimensions)
 */
export interface MetricLabels {
    [key: string]: string | number;
}
/**
 * Metric value with labels and timestamp
 */
export interface MetricValue {
    value: number;
    labels: MetricLabels;
    timestamp: number;
}
/**
 * Histogram percentile result
 */
export interface PercentileResult {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
}
/**
 * Abstract base metric class
 */
export declare abstract class Metric {
    protected readonly name: string;
    protected readonly help: string;
    protected readonly type: MetricType;
    protected readonly labelNames: string[];
    constructor(name: string, help: string, type: MetricType, labelNames?: string[]);
    /**
     * Record a value
     */
    abstract record(value: number, labels?: MetricLabels): void;
    /**
     * Export in Prometheus format
     */
    abstract export(): string;
    /**
     * Get metric name
     */
    getName(): string;
    /**
     * Get metric type
     */
    getType(): MetricType;
    /**
     * Get metric help text
     */
    getHelp(): string;
    /**
     * Validate labels match expected label names
     */
    protected validateLabels(labels?: MetricLabels): void;
    /**
     * Format labels as Prometheus label string
     */
    protected formatLabels(labels?: MetricLabels): string;
    /**
     * Generate label key for internal storage
     */
    protected labelKey(labels?: MetricLabels): string;
}
/**
 * Counter: monotonically increasing value
 * Use for: request counts, error counts, completed tasks
 */
export declare class Counter extends Metric {
    private values;
    constructor(name: string, help: string, labelNames?: string[]);
    /**
     * Increment counter by amount (default 1)
     */
    inc(labels?: MetricLabels, amount?: number): void;
    /**
     * Record a value (alias for inc)
     */
    record(value: number, labels?: MetricLabels): void;
    /**
     * Get current value for labels
     */
    get(labels?: MetricLabels): number;
    /**
     * Reset counter (use sparingly, typically only in tests)
     */
    reset(): void;
    /**
     * Export in Prometheus format
     */
    export(): string;
}
/**
 * Gauge: point-in-time value (can increase or decrease)
 * Use for: memory usage, queue depth, active connections
 */
export declare class Gauge extends Metric {
    private values;
    constructor(name: string, help: string, labelNames?: string[]);
    /**
     * Set gauge to specific value
     */
    set(value: number, labels?: MetricLabels): void;
    /**
     * Increment gauge by amount (default 1)
     */
    inc(labels?: MetricLabels, amount?: number): void;
    /**
     * Decrement gauge by amount (default 1)
     */
    dec(labels?: MetricLabels, amount?: number): void;
    /**
     * Record a value (alias for set)
     */
    record(value: number, labels?: MetricLabels): void;
    /**
     * Get current value for labels
     */
    get(labels?: MetricLabels): number;
    /**
     * Reset gauge
     */
    reset(): void;
    /**
     * Export in Prometheus format
     */
    export(): string;
}
/**
 * Histogram: bucketed value distribution
 * Use for: latency measurements, request sizes
 */
export declare class Histogram extends Metric {
    private buckets;
    private counts;
    private sums;
    private totals;
    private allValues;
    constructor(name: string, help: string, labelNames?: string[], buckets?: number[]);
    /**
     * Observe a value
     */
    observe(value: number, labels?: MetricLabels): void;
    /**
     * Record a value (alias for observe)
     */
    record(value: number, labels?: MetricLabels): void;
    /**
     * Get count for labels
     */
    getCount(labels?: MetricLabels): number;
    /**
     * Get sum for labels
     */
    getSum(labels?: MetricLabels): number;
    /**
     * Get mean for labels
     */
    getMean(labels?: MetricLabels): number;
    /**
     * Get percentiles for labels
     */
    getPercentiles(labels?: MetricLabels): PercentileResult;
    /**
     * Reset histogram
     */
    reset(): void;
    /**
     * Export in Prometheus format
     */
    export(): string;
}
/**
 * Summary: pre-aggregated statistics (quantiles)
 * Use for: pre-calculated percentiles without bucket overhead
 */
export declare class Summary extends Metric {
    private values;
    private _maxAge;
    private _ageBucketCount;
    private maxValues;
    constructor(name: string, help: string, labelNames?: string[], options?: {
        maxAge?: number;
        ageBucketCount?: number;
        maxValues?: number;
    });
    /**
     * Observe a value
     */
    observe(value: number, labels?: MetricLabels): void;
    /**
     * Record a value (alias for observe)
     */
    record(value: number, labels?: MetricLabels): void;
    /**
     * Get count for labels
     */
    getCount(labels?: MetricLabels): number;
    /**
     * Get sum for labels
     */
    getSum(labels?: MetricLabels): number;
    /**
     * Get quantile for labels
     */
    getQuantile(quantile: number, labels?: MetricLabels): number;
    /**
     * Reset summary
     */
    reset(): void;
    /**
     * Export in Prometheus format
     */
    export(): string;
}
/**
 * Central registry for all metrics
 */
export declare class MetricsCollector {
    private metrics;
    /**
     * Create and register a counter
     */
    createCounter(name: string, help: string, labelNames?: string[]): Counter;
    /**
     * Create and register a gauge
     */
    createGauge(name: string, help: string, labelNames?: string[]): Gauge;
    /**
     * Create and register a histogram
     */
    createHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): Histogram;
    /**
     * Create and register a summary
     */
    createSummary(name: string, help: string, labelNames?: string[], options?: {
        maxAge?: number;
        ageBucketCount?: number;
    }): Summary;
    /**
     * Get a specific metric by name
     */
    get<T extends Metric>(name: string): T | undefined;
    /**
     * List all registered metric names
     */
    list(): string[];
    /**
     * Check if a metric exists
     */
    has(name: string): boolean;
    /**
     * Remove a metric
     */
    remove(name: string): boolean;
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Export all metrics in Prometheus format
     */
    export(): string;
    /**
     * Get metrics count
     */
    size(): number;
    /**
     * Get a snapshot of all current metric values
     * Useful for status reporting and debugging
     */
    getSnapshot(): Record<string, unknown>;
    /**
     * Flush metrics (export and optionally reset)
     * Called during shutdown to ensure metrics are persisted
     */
    flush(): Promise<string>;
}
/**
 * Global metrics collector instance
 */
export declare const metricsCollector: MetricsCollector;
/**
 * Predefined metrics for God Agent components
 */
export declare const METRICS: {
    vectordbSearchLatency: Histogram;
    vectordbSearchCount: Counter;
    memoryCacheHit: Counter;
    memoryCacheMiss: Counter;
    memoryCacheSize: Gauge;
    compressionTierCount: Gauge;
    compressionRatio: Histogram;
    compressionLatency: Histogram;
    agentCompletionRate: Gauge;
    agentExecutionTime: Histogram;
    pipelineExecutionCount: Counter;
    attentionSelectionTime: Histogram;
    attentionForwardTime: Histogram;
    shadowVectorContradictions: Counter;
    relayRaceHandoffs: Counter;
    neuralRouterDecisions: Counter;
    qaStoreCreated: Counter;
    qaStoreCreateLatency: Histogram;
    qaStoreSearchLatency: Histogram;
    causalStoreChainCreated: Counter;
    causalStoreCreateLatency: Histogram;
    causalStoreRootCauseLatency: Histogram;
    causalStoreLoopsDetected: Counter;
    causalStoreLoopDetectionLatency: Histogram;
    ucmEpisodeStored: Counter;
    ucmEpisodeRetrieved: Counter;
    ucmContextSize: Gauge;
    ucmRollingWindowSize: Gauge;
    idescOutcomeRecorded: Counter;
    idescOutcomeLatency: Histogram;
    idescInjectionDecisions: Counter;
    idescShouldInjectLatency: Histogram;
    idescNegativeWarnings: Counter;
    idescThresholdAdjustments: Counter;
    episodeLinked: Counter;
    episodeLinkLatency: Histogram;
    episodeTimeIndexSize: Gauge;
    embeddingDimensions: Gauge;
    embeddingGenerated: Counter;
    embeddingLatency: Histogram;
    embeddingCacheHit: Counter;
    agentRegistryTotal: Gauge;
    agentCategoryCount: Gauge;
    agentSelectionCount: Counter;
    tokenBudgetUsage: Gauge;
    tokenBudgetWarnings: Counter;
    summarizationTriggered: Counter;
    daemonHealth: Gauge;
    daemonUptime: Gauge;
    daemonEventProcessed: Counter;
};
//# sourceMappingURL=metrics.d.ts.map