/**
 * ActivityStream - Circular Buffer for Real-time Events
 *
 * Implements an in-memory circular buffer for real-time event storage
 * with FIFO eviction when full.
 *
 * @module observability/activity-stream
 * @see TASK-OBS-002-ACTIVITY-STREAM.md
 * @see SPEC-OBS-001-CORE.md
 */
import { BUFFER_LIMITS, } from './types.js';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';
const logger = createComponentLogger('ActivityStream', {
    minLevel: LogLevel.WARN,
    handlers: [new ConsoleLogHandler({ useStderr: true })]
});
// =============================================================================
// Implementation
// =============================================================================
/**
 * ActivityStream circular buffer implementation
 *
 * Implements:
 * - [REQ-OBS-01]: Activity stream buffer
 * - [REQ-OBS-02]: Maximum 1000 events with FIFO eviction
 * - [RULE-OBS-004]: Memory bounds enforcement
 */
export class ActivityStream {
    // Static singleton instance
    static singletonInstance = null;
    /**
     * Get the singleton ActivityStream instance
     * Creates one if it doesn't exist
     */
    static getInstance() {
        if (!ActivityStream.singletonInstance) {
            ActivityStream.singletonInstance = new ActivityStream();
        }
        return Promise.resolve(ActivityStream.singletonInstance);
    }
    /**
     * Reset the singleton (for testing)
     */
    static resetInstance() {
        ActivityStream.singletonInstance = null;
    }
    // Circular buffer storage
    buffer;
    head = 0; // Points to oldest element
    tail = 0; // Points to next write position
    count = 0;
    maxSize;
    // Event listeners
    listeners = [];
    // Quality thresholds (AC-IDESC-005a)
    ACCURACY_THRESHOLD = 0.90;
    FPR_ESCALATION_THRESHOLD = 0.03;
    /**
     * Create a new ActivityStream
     * @param maxSize Maximum buffer size (default: 1000 per RULE-OBS-004)
     */
    constructor(maxSize = BUFFER_LIMITS.ACTIVITY_STREAM) {
        this.maxSize = maxSize;
        // Pre-allocate buffer for memory efficiency
        this.buffer = new Array(maxSize).fill(null);
    }
    /**
     * Push an event to the stream
     * Implements [REQ-OBS-02]: FIFO eviction when full
     * O(1) operation - no array shifting
     */
    push(event) {
        // Store at tail position (overwrite if buffer is full)
        this.buffer[this.tail] = event;
        // Advance tail
        this.tail = (this.tail + 1) % this.maxSize;
        if (this.count < this.maxSize) {
            // Buffer not full yet
            this.count++;
        }
        else {
            // Buffer full - head moves forward (oldest evicted)
            this.head = (this.head + 1) % this.maxSize;
        }
        // Notify listeners (non-blocking)
        this.notifyListeners(event);
    }
    /**
     * Get the most recent events
     * @param limit Maximum number of events to return (default: 100)
     * @returns Events in chronological order (oldest first)
     */
    getRecent(limit = 100) {
        if (this.count === 0) {
            return [];
        }
        const resultLimit = Math.min(limit, this.count);
        const result = [];
        // Start from the newest events (work backwards from tail)
        let idx = (this.tail - 1 + this.maxSize) % this.maxSize;
        for (let i = 0; i < resultLimit; i++) {
            const event = this.buffer[idx];
            if (event) {
                result.unshift(event); // Add to front to maintain order
            }
            idx = (idx - 1 + this.maxSize) % this.maxSize;
        }
        return result;
    }
    /**
     * Get all events in chronological order
     * @returns All events from oldest to newest
     */
    getAll() {
        return this.getRecent(this.count);
    }
    /**
     * Filter events by criteria
     * @param criteria Filter criteria
     * @returns Filtered events in chronological order
     */
    filter(criteria) {
        const all = this.getAll();
        return all.filter(event => {
            // Filter by component
            if (criteria.component && event.component !== criteria.component) {
                return false;
            }
            // Filter by status
            if (criteria.status && event.status !== criteria.status) {
                return false;
            }
            // Filter by time range (since)
            if (criteria.since && event.timestamp < criteria.since) {
                return false;
            }
            // Filter by time range (until)
            if (criteria.until && event.timestamp > criteria.until) {
                return false;
            }
            return true;
        });
    }
    /**
     * Clear all events
     */
    clear() {
        this.buffer = new Array(this.maxSize).fill(null);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
    /**
     * Get current event count
     */
    size() {
        return this.count;
    }
    /**
     * Check if buffer is full
     */
    isFull() {
        return this.count >= this.maxSize;
    }
    /**
     * Subscribe to new events
     * @param listener Callback for new events
     * @returns Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    /**
     * Get statistics about the buffer
     */
    getStats() {
        return {
            size: this.count,
            maxSize: this.maxSize,
            isFull: this.isFull(),
            headIndex: this.head,
            tailIndex: this.tail,
        };
    }
    /**
     * Emit an event with auto-generated id and timestamp
     * Convenience method for hooks and components
     * @param event Partial event data (id and timestamp auto-generated)
     */
    async emit(event) {
        const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const timestamp = Date.now();
        // Map type to operation
        const operation = event.type;
        const component = event.component ?? 'general';
        const status = event.status ?? 'success';
        const fullEvent = {
            id,
            timestamp,
            component,
            operation,
            status,
            metadata: {
                correlationId: event.correlationId,
                ...event.payload,
            },
        };
        this.push(fullEvent);
    }
    /**
     * Track injection quality metrics (AC-IDESC-005a)
     * Monitors accuracy and false positive rates with automatic alerting
     *
     * Thresholds:
     * - Accuracy < 90%: WARNING alert
     * - FPR > 3%: CRITICAL alert
     *
     * @param metric Quality metric to track
     */
    async trackQualityMetric(metric) {
        // Emit quality metric event
        await this.emit({
            type: 'quality_metric',
            component: 'quality_monitor',
            status: 'success',
            payload: {
                category: metric.category,
                accuracy: metric.accuracy,
                fpr: metric.falsePositiveRate,
                injectionCount: metric.injectionCount,
                timestamp: metric.timestamp.toISOString(),
            },
        });
        // Check alert thresholds
        const alerts = [];
        // Accuracy degradation check
        if (metric.accuracy < this.ACCURACY_THRESHOLD) {
            alerts.push({
                severity: 'WARNING',
                type: 'ACCURACY_DEGRADATION',
                message: `Accuracy ${(metric.accuracy * 100).toFixed(1)}% below ${(this.ACCURACY_THRESHOLD * 100)}% threshold`,
                category: metric.category,
                timestamp: metric.timestamp,
            });
        }
        // False positive rate escalation check
        if (metric.falsePositiveRate > this.FPR_ESCALATION_THRESHOLD) {
            alerts.push({
                severity: 'CRITICAL',
                type: 'FPR_ESCALATION',
                message: `FPR ${(metric.falsePositiveRate * 100).toFixed(1)}% exceeds ${(this.FPR_ESCALATION_THRESHOLD * 100)}% escalation threshold`,
                category: metric.category,
                timestamp: metric.timestamp,
            });
        }
        // Emit all alerts
        for (const alert of alerts) {
            await this.emitAlert(alert);
        }
    }
    /**
     * Emit alert to observability system
     * Logs to console and pushes to activity stream
     * @param alert Alert details
     */
    async emitAlert(alert) {
        // Log to structured logger for immediate visibility
        logger.error(`Quality alert: ${alert.message}`, undefined, { severity: alert.severity, alertType: alert.type, category: alert.category });
        // Emit to activity stream
        await this.emit({
            type: 'alert',
            component: 'quality_monitor',
            status: alert.severity === 'CRITICAL' ? 'error' : 'warning',
            payload: {
                severity: alert.severity,
                alertType: alert.type,
                message: alert.message,
                category: alert.category,
                timestamp: alert.timestamp.toISOString(),
            },
        });
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Notify all listeners of a new event
     * Non-blocking - uses setImmediate
     */
    notifyListeners(event) {
        if (this.listeners.length === 0) {
            return;
        }
        // Non-blocking notification
        setImmediate(() => {
            for (const listener of this.listeners) {
                try {
                    listener(event);
                }
                catch {
                    // INTENTIONAL: Implements [RULE-OBS-003] - listener exceptions must not propagate to prevent cascade failures
                }
            }
        });
    }
}
// =============================================================================
// Singleton Instance (static methods now in class)
// =============================================================================
// =============================================================================
// Default Export
// =============================================================================
export default ActivityStream;
//# sourceMappingURL=activity-stream.js.map