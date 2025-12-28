/**
 * God Agent Custom Error Classes
 *
 * Implements: REQ-VEC-05 (GraphDimensionMismatchError)
 * Referenced by: TASK-VEC-001
 */
/**
 * Error thrown when vector dimensions don't match expected value
 * Per constitution.md VEC-05: Dimension mismatch MUST cause hard failure
 */
export declare class GraphDimensionMismatchError extends Error {
    readonly expected: number;
    readonly actual: number;
    readonly context: string;
    constructor(expected: number, actual: number, context: string);
}
/**
 * Error thrown when attempting to normalize a zero vector
 */
export declare class ZeroVectorError extends Error {
    constructor(message?: string);
}
/**
 * Error thrown when vector contains NaN or Infinity values
 */
export declare class InvalidVectorValueError extends Error {
    readonly position: number;
    readonly value: number;
    readonly context: string;
    constructor(position: number, value: number, context: string);
}
/**
 * Error thrown when vector is not L2 normalized
 */
export declare class NotNormalizedError extends Error {
    readonly norm: number;
    readonly context: string;
    constructor(norm: number, context: string);
}
/**
 * Error thrown when namespace format is invalid
 */
export declare class InvalidNamespaceError extends Error {
    readonly namespace: string;
    readonly reason: string;
    constructor(namespace: string, reason: string);
}
//# sourceMappingURL=errors.d.ts.map