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
/**
 * Default regression configuration
 */
export const DEFAULT_REGRESSION_CONFIG = {
    regressionThreshold: 10,
    improvementThreshold: -10,
    warningSeverityThreshold: 25,
    criticalSeverityThreshold: 50,
    metric: 'p95',
};
/**
 * In-memory baseline storage implementation
 */
export class MemoryBaselineStorage {
    baseline = null;
    save(baseline) {
        this.baseline = { ...baseline };
    }
    load() {
        return this.baseline;
    }
    exists() {
        return this.baseline !== null;
    }
    clear() {
        this.baseline = null;
    }
}
/**
 * JSON-serializable baseline storage
 * (For use with file storage in integration)
 */
export class JsonBaselineStorage {
    data = null;
    save(baseline) {
        this.data = JSON.stringify(baseline);
    }
    load() {
        if (!this.data)
            return null;
        try {
            return JSON.parse(this.data);
        }
        catch {
            // INTENTIONAL: JSON parse failure - return null to indicate invalid baseline data
            return null;
        }
    }
    exists() {
        return this.data !== null;
    }
    clear() {
        this.data = null;
    }
    /** Export baseline as JSON string */
    export() {
        return this.data;
    }
    /** Import baseline from JSON string */
    import(json) {
        try {
            JSON.parse(json); // Validate JSON
            this.data = json;
            return true;
        }
        catch {
            // INTENTIONAL: JSON validation failure - return false to reject invalid import
            return false;
        }
    }
}
// ==================== Regression Detector ====================
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
export class RegressionDetector {
    storage;
    config;
    constructor(storage = new MemoryBaselineStorage(), config = {}) {
        this.storage = storage;
        this.config = { ...DEFAULT_REGRESSION_CONFIG, ...config };
    }
    /**
     * Save current results as the new baseline
     */
    saveBaseline(results) {
        this.storage.save(results);
    }
    /**
     * Load the stored baseline
     */
    loadBaseline() {
        return this.storage.load();
    }
    /**
     * Check if a baseline exists
     */
    hasBaseline() {
        return this.storage.exists();
    }
    /**
     * Clear the stored baseline
     */
    clearBaseline() {
        this.storage.clear();
    }
    /**
     * Detect regressions between current results and baseline
     *
     * @param current - Current benchmark results
     * @param config - Optional configuration overrides
     * @returns Regression report
     */
    detectRegressions(current, config = {}) {
        const cfg = { ...this.config, ...config };
        const baseline = this.storage.load();
        if (!baseline) {
            return {
                hasBaseline: false,
                regressions: [],
                improvements: [],
                summary: {
                    total: current.results.length,
                    regressions: 0,
                    improvements: 0,
                    unchanged: current.results.length,
                },
                status: 'pass',
                currentTimestamp: current.timestamp,
            };
        }
        const regressions = [];
        const improvements = [];
        let unchanged = 0;
        for (const currentResult of current.results) {
            const baselineResult = baseline.results.find(r => r.name === currentResult.name);
            if (!baselineResult) {
                unchanged++;
                continue;
            }
            const baselineValue = baselineResult.statistics[cfg.metric];
            const currentValue = currentResult.statistics[cfg.metric];
            // Calculate percentage change (positive = slower/regression)
            const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
            if (changePercent > cfg.regressionThreshold) {
                // Regression detected
                regressions.push({
                    benchmark: currentResult.name,
                    baseline: baselineValue,
                    current: currentValue,
                    changePercent,
                    severity: this.classifySeverity(changePercent, cfg),
                    metric: cfg.metric,
                });
            }
            else if (changePercent < cfg.improvementThreshold) {
                // Improvement detected
                improvements.push({
                    benchmark: currentResult.name,
                    baseline: baselineValue,
                    current: currentValue,
                    changePercent,
                    metric: cfg.metric,
                });
            }
            else {
                unchanged++;
            }
        }
        // Determine overall status
        let status = 'pass';
        if (regressions.some(r => r.severity === 'critical')) {
            status = 'fail';
        }
        else if (regressions.some(r => r.severity === 'warning')) {
            status = 'warning';
        }
        else if (regressions.length > 0) {
            status = 'warning';
        }
        return {
            hasBaseline: true,
            regressions,
            improvements,
            summary: {
                total: current.results.length,
                regressions: regressions.length,
                improvements: improvements.length,
                unchanged,
            },
            status,
            baselineTimestamp: baseline.timestamp,
            currentTimestamp: current.timestamp,
        };
    }
    /**
     * Compare two benchmark results directly without baseline storage
     *
     * @param baseline - Baseline results
     * @param current - Current results to compare
     * @param config - Optional configuration overrides
     * @returns Regression report
     */
    compare(baseline, current, config = {}) {
        // Temporarily save baseline, detect, then restore
        const previousBaseline = this.storage.load();
        this.storage.save(baseline);
        const report = this.detectRegressions(current, config);
        if (previousBaseline) {
            this.storage.save(previousBaseline);
        }
        else {
            this.storage.clear();
        }
        return report;
    }
    /**
     * Get trend analysis for a specific benchmark across multiple runs
     *
     * @param benchmarkName - Name of benchmark to analyze
     * @param history - Array of past results (oldest first)
     * @returns Trend analysis
     */
    analyzeTrend(benchmarkName, history) {
        const values = [];
        const timestamps = [];
        for (const run of history) {
            const result = run.results.find(r => r.name === benchmarkName);
            if (result) {
                values.push(result.statistics[this.config.metric]);
                timestamps.push(run.timestamp);
            }
        }
        if (values.length < 2) {
            return {
                benchmark: benchmarkName,
                dataPoints: values.length,
                trend: 'stable',
                slope: 0,
                values,
                timestamps,
            };
        }
        // Simple linear regression for trend
        const n = values.length;
        const sumX = timestamps.reduce((a, b, i) => a + i, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = timestamps.reduce((acc, _, i) => acc + i * values[i], 0);
        const sumXX = timestamps.reduce((acc, _, i) => acc + i * i, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        // Determine trend direction
        let trend;
        const threshold = 0.001; // Minimal change threshold
        if (slope > threshold) {
            trend = 'degrading';
        }
        else if (slope < -threshold) {
            trend = 'improving';
        }
        else {
            trend = 'stable';
        }
        return {
            benchmark: benchmarkName,
            dataPoints: n,
            trend,
            slope,
            values,
            timestamps,
        };
    }
    /**
     * Classify regression severity
     */
    classifySeverity(changePercent, config) {
        if (changePercent >= config.criticalSeverityThreshold) {
            return 'critical';
        }
        else if (changePercent >= config.warningSeverityThreshold) {
            return 'warning';
        }
        return 'info';
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ==================== Utility Functions ====================
/**
 * Format regression report as Markdown
 */
export function formatRegressionReportMarkdown(report) {
    let md = `# Performance Regression Report\n\n`;
    md += `**Status:** ${report.status.toUpperCase()}\n`;
    md += `**Baseline Available:** ${report.hasBaseline ? 'Yes' : 'No'}\n\n`;
    if (!report.hasBaseline) {
        md += `> No baseline available for comparison. Save a baseline first.\n`;
        return md;
    }
    // Summary
    md += `## Summary\n\n`;
    md += `- Total benchmarks: ${report.summary.total}\n`;
    md += `- Regressions: ${report.summary.regressions}\n`;
    md += `- Improvements: ${report.summary.improvements}\n`;
    md += `- Unchanged: ${report.summary.unchanged}\n\n`;
    // Regressions
    if (report.regressions.length > 0) {
        md += `## Regressions\n\n`;
        md += `| Benchmark | Baseline | Current | Change | Severity |\n`;
        md += `|-----------|----------|---------|--------|----------|\n`;
        for (const r of report.regressions) {
            const icon = r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟡' : '🟢';
            md += `| ${r.benchmark} | ${r.baseline.toFixed(4)}ms | ${r.current.toFixed(4)}ms | +${r.changePercent.toFixed(1)}% | ${icon} ${r.severity} |\n`;
        }
        md += '\n';
    }
    // Improvements
    if (report.improvements.length > 0) {
        md += `## Improvements\n\n`;
        md += `| Benchmark | Baseline | Current | Change |\n`;
        md += `|-----------|----------|---------|--------|\n`;
        for (const i of report.improvements) {
            md += `| ${i.benchmark} | ${i.baseline.toFixed(4)}ms | ${i.current.toFixed(4)}ms | ${i.changePercent.toFixed(1)}% |\n`;
        }
        md += '\n';
    }
    return md;
}
// ==================== Global Instance ====================
/**
 * Global regression detector instance
 */
export const regressionDetector = new RegressionDetector();
//# sourceMappingURL=regression.js.map