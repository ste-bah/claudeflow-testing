/**
 * Concurrency Tracker Utilities
 * TASK-NFR-002 - Scalability Validation Suite
 *
 * Provides concurrency monitoring:
 * - Active operation counting
 * - Peak concurrency detection
 * - Contention event logging
 */
// ==================== Concurrency Tracker ====================
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
export class ConcurrencyTracker {
    currentCount = 0;
    peakCount = 0;
    totalCount = 0;
    concurrencySum = 0;
    sampleCount = 0;
    contentionEvents = [];
    maxContentionHistory;
    activeOperations = new Map();
    constructor(options = {}) {
        this.maxContentionHistory = options.maxContentionHistory ?? 1000;
    }
    /**
     * Get current concurrency level
     */
    get current() {
        return this.currentCount;
    }
    /**
     * Get peak concurrency level
     */
    get peak() {
        return this.peakCount;
    }
    /**
     * Enter a tracked operation
     *
     * @param operationId - Unique operation identifier
     * @param resource - Optional resource being accessed
     * @returns Handle to exit the operation
     */
    enter(operationId, resource) {
        const id = operationId ?? `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const startTime = Date.now();
        this.currentCount++;
        this.totalCount++;
        this.peakCount = Math.max(this.peakCount, this.currentCount);
        this.concurrencySum += this.currentCount;
        this.sampleCount++;
        this.activeOperations.set(id, { startTime, resource });
        return {
            operationId: id,
            startTime,
            exit: () => this.exit(id),
            reportContention: (type, waitTimeMs) => this.reportContention(id, type, waitTimeMs, resource),
        };
    }
    /**
     * Exit a tracked operation
     */
    exit(operationId) {
        if (this.activeOperations.has(operationId)) {
            this.activeOperations.delete(operationId);
            this.currentCount = Math.max(0, this.currentCount - 1);
        }
    }
    /**
     * Report a contention event
     */
    reportContention(operationId, type, waitTimeMs, resource) {
        const event = {
            operationId,
            type,
            waitTimeMs,
            resource,
            timestamp: Date.now(),
        };
        this.contentionEvents.push(event);
        // Trim history if needed
        if (this.contentionEvents.length > this.maxContentionHistory) {
            this.contentionEvents.shift();
        }
    }
    /**
     * Get concurrency statistics
     */
    getStats() {
        const totalWaitTimeMs = this.contentionEvents.reduce((sum, e) => sum + e.waitTimeMs, 0);
        return {
            current: this.currentCount,
            peak: this.peakCount,
            total: this.totalCount,
            average: this.sampleCount > 0 ? this.concurrencySum / this.sampleCount : 0,
            contentionCount: this.contentionEvents.length,
            totalWaitTimeMs,
        };
    }
    /**
     * Get contention events
     */
    getContentionEvents() {
        return [...this.contentionEvents];
    }
    /**
     * Get active operations
     */
    getActiveOperations() {
        return Array.from(this.activeOperations.entries()).map(([operationId, info]) => ({
            operationId,
            ...info,
        }));
    }
    /**
     * Check for potential contention (high concurrency)
     */
    isContended(threshold = 10) {
        return this.currentCount >= threshold;
    }
    /**
     * Reset all statistics
     */
    reset() {
        this.currentCount = 0;
        this.peakCount = 0;
        this.totalCount = 0;
        this.concurrencySum = 0;
        this.sampleCount = 0;
        this.contentionEvents = [];
        this.activeOperations.clear();
    }
    /**
     * Get formatted report
     */
    getReport() {
        const stats = this.getStats();
        return [
            `Concurrency Report:`,
            `  Current: ${stats.current}`,
            `  Peak: ${stats.peak}`,
            `  Total Operations: ${stats.total}`,
            `  Average Concurrency: ${stats.average.toFixed(2)}`,
            `  Contention Events: ${stats.contentionCount}`,
            `  Total Wait Time: ${stats.totalWaitTimeMs.toFixed(2)}ms`,
        ].join('\n');
    }
}
// ==================== Semaphore ====================
/**
 * Async semaphore for limiting concurrency
 */
export class AsyncSemaphore {
    permits;
    maxPermits;
    queue = [];
    constructor(maxPermits) {
        this.maxPermits = maxPermits;
        this.permits = maxPermits;
    }
    /**
     * Acquire a permit
     */
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise(resolve => {
            this.queue.push(resolve);
        });
    }
    /**
     * Release a permit
     */
    release() {
        const next = this.queue.shift();
        if (next) {
            next();
        }
        else {
            this.permits = Math.min(this.permits + 1, this.maxPermits);
        }
    }
    /**
     * Get available permits
     */
    available() {
        return this.permits;
    }
    /**
     * Get waiting count
     */
    waiting() {
        return this.queue.length;
    }
    /**
     * Run a function with semaphore protection
     */
    async withPermit(fn) {
        await this.acquire();
        try {
            return await fn();
        }
        finally {
            this.release();
        }
    }
}
// ==================== Rate Limiter ====================
/**
 * Token bucket rate limiter
 */
export class RateLimiter {
    tokens;
    maxTokens;
    refillRate; // tokens per second
    lastRefill;
    constructor(maxTokens, refillRate) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }
    /**
     * Try to acquire a token
     */
    tryAcquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens--;
            return true;
        }
        return false;
    }
    /**
     * Wait to acquire a token
     */
    async acquire() {
        while (!this.tryAcquire()) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    /**
     * Get current token count
     */
    available() {
        this.refill();
        return this.tokens;
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}
// ==================== Global Instance ====================
/**
 * Global concurrency tracker instance
 */
export const concurrencyTracker = new ConcurrencyTracker();
//# sourceMappingURL=concurrency-tracker.js.map