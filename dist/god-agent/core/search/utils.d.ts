/**
 * Search Utility Functions
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-004
 *
 * @module src/god-agent/core/search/utils
 */
/**
 * Custom timeout error for source execution
 */
export declare class TimeoutError extends Error {
    /** Timeout duration in milliseconds */
    readonly timeoutMs: number;
    /** Source that timed out */
    readonly source?: string;
    constructor(message: string, timeoutMs: number, source?: string);
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
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, source?: string): Promise<T>;
/**
 * Compute SHA-256 content hash
 * Returns first 16 characters of hex digest
 *
 * @param content - String content to hash
 * @returns First 16 characters of SHA-256 hex digest
 */
export declare function computeContentHash(content: string): string;
/**
 * Measure execution time of an async function
 *
 * @param fn - Async function to measure
 * @returns Object with result and duration in ms
 */
export declare function measureTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    durationMs: number;
}>;
/**
 * Generate a unique result ID
 *
 * @param source - Source identifier
 * @param index - Result index
 * @returns Unique result ID
 */
export declare function generateResultId(source: string, index: number): string;
/**
 * Normalize a score to [0, 1] range
 *
 * @param score - Raw score
 * @param min - Minimum possible value
 * @param max - Maximum possible value
 * @returns Normalized score between 0 and 1
 */
export declare function normalizeScore(score: number, min: number, max: number): number;
//# sourceMappingURL=utils.d.ts.map