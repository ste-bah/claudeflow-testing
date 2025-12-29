/**
 * Search Utility Functions
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/utils
 */
import * as crypto from 'crypto';
/**
 * Custom timeout error for source execution
 */
export class TimeoutError extends Error {
    /** Timeout duration in milliseconds */
    timeoutMs;
    /** Source that timed out */
    source;
    constructor(message, timeoutMs, source) {
        super(message);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
        this.source = source;
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
/**
 * Execute a promise with timeout
 *
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param source - Optional source name for error context
 * @returns Promise result or throws TimeoutError
 * @throws TimeoutError if promise doesn't resolve within timeout
 */
export async function withTimeout(promise, timeoutMs, source) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs, source));
        }, timeoutMs);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        return result;
    }
    catch (error) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        // RULE-070: Re-throw with timeout context
        throw new Error(`Operation from "${source}" failed or timed out after ${timeoutMs}ms: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
/**
 * Compute SHA-256 content hash
 * Returns first 16 characters of hex digest
 *
 * @param content - String content to hash
 * @returns First 16 characters of SHA-256 hex digest
 */
export function computeContentHash(content) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex').substring(0, 16);
}
/**
 * Measure execution time of an async function
 *
 * @param fn - Async function to measure
 * @returns Object with result and duration in ms
 */
export async function measureTime(fn) {
    const startTime = performance.now();
    const result = await fn();
    const durationMs = performance.now() - startTime;
    return { result, durationMs };
}
/**
 * Generate a unique result ID
 *
 * @param source - Source identifier
 * @param index - Result index
 * @returns Unique result ID
 */
export function generateResultId(source, index) {
    return `${source}_${Date.now()}_${index}`;
}
/**
 * Normalize a score to [0, 1] range
 *
 * @param score - Raw score
 * @param min - Minimum possible value
 * @param max - Maximum possible value
 * @returns Normalized score between 0 and 1
 */
export function normalizeScore(score, min, max) {
    if (max === min)
        return 0.5;
    const normalized = (score - min) / (max - min);
    return Math.max(0, Math.min(1, normalized));
}
//# sourceMappingURL=utils.js.map