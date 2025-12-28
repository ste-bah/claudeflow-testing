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
import { IActivityEvent, IFilterCriteria } from './types.js';
/**
 * Quality metric interface for injection quality tracking
 * Implements [AC-IDESC-005a]: Continuous quality monitoring
 */
export interface IQualityMetric {
    timestamp: Date;
    category: string;
    accuracy: number;
    falsePositiveRate: number;
    injectionCount: number;
}
/**
 * Alert severity levels
 */
export type AlertSeverity = 'WARNING' | 'CRITICAL';
/**
 * Alert interface for quality threshold violations
 */
export interface IQualityAlert {
    severity: AlertSeverity;
    type: string;
    message: string;
    category: string;
    timestamp: Date;
}
/**
 * ActivityStream interface
 * Implements [REQ-OBS-01]: Activity stream buffer
 * Implements [REQ-OBS-02]: Maximum 1000 events enforced (RULE-OBS-004)
 */
export interface IActivityStream {
    /**
     * Push an event to the stream.
     * O(1) operation - overwrites oldest if full.
     * @param event The event to push
     */
    push(event: IActivityEvent): void;
    /**
     * Get the most recent events.
     * @param limit Maximum number of events to return (default: 100)
     * @returns Array of events in chronological order (oldest first)
     */
    getRecent(limit?: number): IActivityEvent[];
    /**
     * Filter events by criteria.
     * @param criteria Filter criteria
     * @returns Filtered events in chronological order
     */
    filter(criteria: IFilterCriteria): IActivityEvent[];
    /**
     * Clear all events from the stream.
     */
    clear(): void;
    /**
     * Get the current number of events in the stream.
     */
    size(): number;
    /**
     * Subscribe to new events.
     * @param listener Callback for new events
     * @returns Unsubscribe function
     */
    subscribe(listener: (event: IActivityEvent) => void): () => void;
}
/**
 * ActivityStream circular buffer implementation
 *
 * Implements:
 * - [REQ-OBS-01]: Activity stream buffer
 * - [REQ-OBS-02]: Maximum 1000 events with FIFO eviction
 * - [RULE-OBS-004]: Memory bounds enforcement
 */
export declare class ActivityStream implements IActivityStream {
    private static instance;
    static getInstance(): Promise<ActivityStream>;
    static resetInstance(): void;
    private buffer;
    private head;
    private tail;
    private count;
    private readonly maxSize;
    private listeners;
    private readonly ACCURACY_THRESHOLD;
    private readonly FPR_ESCALATION_THRESHOLD;
    /**
     * Create a new ActivityStream
     * @param maxSize Maximum buffer size (default: 1000 per RULE-OBS-004)
     */
    constructor(maxSize?: number);
    /**
     * Push an event to the stream
     * Implements [REQ-OBS-02]: FIFO eviction when full
     * O(1) operation - no array shifting
     */
    push(event: IActivityEvent): void;
    /**
     * Get the most recent events
     * @param limit Maximum number of events to return (default: 100)
     * @returns Events in chronological order (oldest first)
     */
    getRecent(limit?: number): IActivityEvent[];
    /**
     * Get all events in chronological order
     * @returns All events from oldest to newest
     */
    getAll(): IActivityEvent[];
    /**
     * Filter events by criteria
     * @param criteria Filter criteria
     * @returns Filtered events in chronological order
     */
    filter(criteria: IFilterCriteria): IActivityEvent[];
    /**
     * Clear all events
     */
    clear(): void;
    /**
     * Get current event count
     */
    size(): number;
    /**
     * Check if buffer is full
     */
    isFull(): boolean;
    /**
     * Subscribe to new events
     * @param listener Callback for new events
     * @returns Unsubscribe function
     */
    subscribe(listener: (event: IActivityEvent) => void): () => void;
    /**
     * Get statistics about the buffer
     */
    getStats(): {
        size: number;
        maxSize: number;
        isFull: boolean;
        headIndex: number;
        tailIndex: number;
    };
    /**
     * Emit an event with auto-generated id and timestamp
     * Convenience method for hooks and components
     * @param event Partial event data (id and timestamp auto-generated)
     */
    emit(event: {
        type: string;
        correlationId?: string;
        payload?: Record<string, unknown>;
        component?: IActivityEvent['component'];
        status?: IActivityEvent['status'];
    }): Promise<void>;
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
    trackQualityMetric(metric: IQualityMetric): Promise<void>;
    /**
     * Emit alert to observability system
     * Logs to console and pushes to activity stream
     * @param alert Alert details
     */
    private emitAlert;
    /**
     * Notify all listeners of a new event
     * Non-blocking - uses setImmediate
     */
    private notifyListeners;
}
/** Singleton instance for global access */
export default ActivityStream;
//# sourceMappingURL=activity-stream.d.ts.map