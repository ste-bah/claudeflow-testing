/**
 * Concurrency Tracker Utilities
 * TASK-NFR-002 - Scalability Validation Suite
 *
 * Provides concurrency monitoring:
 * - Active operation counting
 * - Peak concurrency detection
 * - Contention event logging
 */
/**
 * Contention event
 */
export interface ContentionEvent {
    /** Operation ID */
    operationId: string;
    /** Type of contention */
    type: 'lock' | 'queue' | 'resource' | 'timeout';
    /** Wait time in ms */
    waitTimeMs: number;
    /** Resource involved */
    resource?: string;
    /** Timestamp */
    timestamp: number;
}
/**
 * Concurrency statistics
 */
export interface ConcurrencyStats {
    /** Current active operations */
    current: number;
    /** Peak concurrent operations */
    peak: number;
    /** Total operations tracked */
    total: number;
    /** Average concurrency level */
    average: number;
    /** Contention event count */
    contentionCount: number;
    /** Total wait time from contention */
    totalWaitTimeMs: number;
}
/**
 * Tracks concurrent operations and detects contention
 *
 * @example
 * ```typescript
 * const tracker = new ConcurrencyTracker();
 *
 * // Track an operation
 * const handle = tracker.enter('operation_1');
 * try {
 *   await doWork();
 * } finally {
 *   handle.exit();
 * }
 *
 * // Check stats
 * const stats = tracker.getStats();
 * console.log(`Peak concurrency: ${stats.peak}`);
 * ```
 */
export declare class ConcurrencyTracker {
    private currentCount;
    private peakCount;
    private totalCount;
    private concurrencySum;
    private sampleCount;
    private contentionEvents;
    private maxContentionHistory;
    private activeOperations;
    constructor(options?: {
        maxContentionHistory?: number;
    });
    /**
     * Get current concurrency level
     */
    get current(): number;
    /**
     * Get peak concurrency level
     */
    get peak(): number;
    /**
     * Enter a tracked operation
     *
     * @param operationId - Unique operation identifier
     * @param resource - Optional resource being accessed
     * @returns Handle to exit the operation
     */
    enter(operationId?: string, resource?: string): OperationHandle;
    /**
     * Exit a tracked operation
     */
    exit(operationId: string): void;
    /**
     * Report a contention event
     */
    reportContention(operationId: string, type: ContentionEvent['type'], waitTimeMs: number, resource?: string): void;
    /**
     * Get concurrency statistics
     */
    getStats(): ConcurrencyStats;
    /**
     * Get contention events
     */
    getContentionEvents(): ContentionEvent[];
    /**
     * Get active operations
     */
    getActiveOperations(): {
        operationId: string;
        startTime: number;
        resource?: string;
    }[];
    /**
     * Check for potential contention (high concurrency)
     */
    isContended(threshold?: number): boolean;
    /**
     * Reset all statistics
     */
    reset(): void;
    /**
     * Get formatted report
     */
    getReport(): string;
}
/**
 * Operation handle for tracking
 */
export interface OperationHandle {
    /** Operation ID */
    operationId: string;
    /** Start time */
    startTime: number;
    /** Exit the operation */
    exit: () => void;
    /** Report contention during operation */
    reportContention: (type: ContentionEvent['type'], waitTimeMs: number) => void;
}
/**
 * Async semaphore for limiting concurrency
 */
export declare class AsyncSemaphore {
    private permits;
    private maxPermits;
    private queue;
    constructor(maxPermits: number);
    /**
     * Acquire a permit
     */
    acquire(): Promise<void>;
    /**
     * Release a permit
     */
    release(): void;
    /**
     * Get available permits
     */
    available(): number;
    /**
     * Get waiting count
     */
    waiting(): number;
    /**
     * Run a function with semaphore protection
     */
    withPermit<T>(fn: () => Promise<T>): Promise<T>;
}
/**
 * Token bucket rate limiter
 */
export declare class RateLimiter {
    private tokens;
    private maxTokens;
    private refillRate;
    private lastRefill;
    constructor(maxTokens: number, refillRate: number);
    /**
     * Try to acquire a token
     */
    tryAcquire(): boolean;
    /**
     * Wait to acquire a token
     */
    acquire(): Promise<void>;
    /**
     * Get current token count
     */
    available(): number;
    private refill;
}
/**
 * Global concurrency tracker instance
 */
export declare const concurrencyTracker: ConcurrencyTracker;
//# sourceMappingURL=concurrency-tracker.d.ts.map