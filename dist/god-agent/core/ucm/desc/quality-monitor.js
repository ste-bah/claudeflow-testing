/**
 * IDESC-001: Intelligent DESC v2 - Continuous Quality Monitoring
 * TASK-IDESC-LEARN-005: Implement Continuous Quality Monitoring
 * Sprint 6: Active Learning
 *
 * Background quality monitoring job that runs periodically to check
 * injection quality metrics and emit alerts when thresholds are exceeded.
 *
 * Implements:
 * - REQ-IDESC-013: Continuous quality monitoring
 * - AC-IDESC-005e: Periodic checks (configurable interval, default 1 hour)
 * - AC-IDESC-005f: Alert emission on quality degradation
 *
 * Constitution:
 * - GUARD-IDESC-006: Graceful error handling in background job
 * - GUARD-IDESC-007: Safe shutdown without data loss
 */
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    intervalMs: 3600000, // 1 hour
    enabled: true
};
/**
 * QualityMonitor - Background job for continuous quality monitoring
 *
 * Periodically checks injection metrics via MetricsAggregator and emits
 * alerts when quality degradation is detected.
 *
 * Features:
 * - Configurable check interval (default: 1 hour)
 * - Immediate initial check on start
 * - Graceful error handling (GUARD-IDESC-006)
 * - Safe shutdown (GUARD-IDESC-007)
 * - Manual trigger via checkNow()
 */
export class QualityMonitor {
    metricsAggregator;
    interval;
    running = false;
    lastCheckTime = null;
    checkCount = 0;
    config;
    constructor(metricsAggregator, config) {
        this.metricsAggregator = metricsAggregator;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Start the quality monitoring job
     * Implements: AC-IDESC-005e
     */
    start() {
        if (this.running || !this.config.enabled) {
            return;
        }
        this.running = true;
        // Set up periodic checks
        this.interval = setInterval(async () => {
            await this.runCheck();
        }, this.config.intervalMs);
        // Run initial check immediately
        this.runCheck().catch(error => {
            console.error('[QualityMonitor] Initial check failed:', error);
        });
    }
    /**
     * Stop the quality monitoring job
     * Implements: GUARD-IDESC-007 (safe shutdown)
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.running = false;
    }
    /**
     * Check if monitoring is running
     */
    isRunning() {
        return this.running;
    }
    /**
     * Trigger an immediate quality check
     * Implements: AC-IDESC-005f
     */
    async checkNow() {
        return this.runCheck();
    }
    /**
     * Get timestamp of last check
     */
    getLastCheckTime() {
        return this.lastCheckTime;
    }
    /**
     * Get total number of checks performed
     */
    getCheckCount() {
        return this.checkCount;
    }
    /**
     * Internal method to run a quality check
     * Implements: GUARD-IDESC-006 (graceful error handling)
     */
    async runCheck() {
        try {
            // Check all categories for quality degradation
            const alerts = await this.metricsAggregator.checkAndAlert();
            // Update check metadata
            this.lastCheckTime = new Date();
            this.checkCount++;
            // Invoke callback for each alert
            if (this.config.onAlert && alerts.length > 0) {
                for (const alert of alerts) {
                    try {
                        this.config.onAlert(alert);
                    }
                    catch (error) {
                        // GUARD-IDESC-006: Don't fail entire check if callback fails
                        console.error('[QualityMonitor] Alert callback failed:', error);
                    }
                }
            }
            return alerts;
        }
        catch (error) {
            // GUARD-IDESC-006: Graceful error handling
            console.error('[QualityMonitor] Check failed:', error);
            return [];
        }
    }
}
/**
 * Factory function to create QualityMonitor
 *
 * @param metricsAggregator - MetricsAggregator instance for quality checks
 * @param config - Optional configuration overrides
 * @returns QualityMonitor instance
 *
 * @example
 * ```typescript
 * const monitor = createQualityMonitor(metricsAggregator, {
 *   intervalMs: 1800000, // 30 minutes
 *   onAlert: (alert) => console.log('Alert:', alert.message)
 * });
 * monitor.start();
 * ```
 */
export function createQualityMonitor(metricsAggregator, config) {
    return new QualityMonitor(metricsAggregator, config);
}
//# sourceMappingURL=quality-monitor.js.map