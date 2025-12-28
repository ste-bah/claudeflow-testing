/**
 * Memory Server Error Classes
 * MEM-001 - Typed error classes for multi-process memory system
 *
 * All errors include:
 * - Error code for IPC protocol
 * - Context for debugging
 * - Actionable error messages
 */
import type { MemoryErrorCode, IMemoryErrorInfo } from '../types/memory-types.js';
/**
 * Base class for all memory server errors
 */
export declare abstract class MemoryError extends Error {
    /** Error code for IPC protocol */
    abstract readonly code: MemoryErrorCode;
    /** Additional error context */
    readonly context: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
    /**
     * Convert to IPC error info structure
     */
    toErrorInfo(): IMemoryErrorInfo;
    /**
     * Create structured log entry
     */
    toLogEntry(): Record<string, unknown>;
}
/**
 * Thrown when request message is malformed
 */
export declare class InvalidRequestError extends MemoryError {
    readonly code: "INVALID_REQUEST";
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Thrown when method name is not recognized
 */
export declare class UnknownMethodError extends MemoryError {
    readonly code: "UNKNOWN_METHOD";
    constructor(method: string);
}
/**
 * Thrown when request parameters fail validation
 */
export declare class ValidationError extends MemoryError {
    readonly code: "VALIDATION_ERROR";
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Thrown when storage operation fails
 */
export declare class StorageError extends MemoryError {
    readonly code: "STORAGE_ERROR";
    constructor(operation: string, reason: string, context?: Record<string, unknown>);
}
/**
 * Thrown when server is shutting down and rejecting requests
 */
export declare class ServerShuttingDownError extends MemoryError {
    readonly code: "SERVER_SHUTTING_DOWN";
    constructor();
}
/**
 * Thrown when operation times out
 */
export declare class TimeoutError extends MemoryError {
    readonly code: "TIMEOUT";
    constructor(operation: string, timeoutMs: number);
}
/**
 * Thrown when server has reached maximum connections
 */
export declare class MaxConnectionsError extends MemoryError {
    readonly code: "MAX_CONNECTIONS";
    constructor(currentConnections: number, maxConnections: number);
}
/**
 * Thrown when server is not running
 */
export declare class ServerNotRunningError extends MemoryError {
    readonly code: "SERVER_NOT_RUNNING";
    constructor(address?: string);
}
/**
 * Thrown when connection to server is lost
 */
export declare class ServerDisconnectedError extends MemoryError {
    readonly code: "SERVER_DISCONNECTED";
    constructor(reason?: string);
}
/**
 * Create error from IPC error info
 */
export declare function errorFromInfo(info: IMemoryErrorInfo): MemoryError;
/**
 * Check if an error is a MemoryError
 */
export declare function isMemoryError(error: unknown): error is MemoryError;
/**
 * Wrap unknown error as MemoryError
 */
export declare function wrapError(error: unknown, operation: string): MemoryError;
//# sourceMappingURL=memory-errors.d.ts.map