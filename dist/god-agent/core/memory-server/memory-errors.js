/**
 * Memory Server Error Classes
 * MEM-001 - Typed error classes for multi-process memory system
 *
 * All errors include:
 * - Error code for IPC protocol
 * - Context for debugging
 * - Actionable error messages
 */
// ==================== Base Error ====================
/**
 * Base class for all memory server errors
 */
export class MemoryError extends Error {
    /** Additional error context */
    context;
    constructor(message, context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.context = context;
        Error.captureStackTrace?.(this, this.constructor);
    }
    /**
     * Convert to IPC error info structure
     */
    toErrorInfo() {
        return {
            code: this.code,
            message: this.message,
            context: this.context,
        };
    }
    /**
     * Create structured log entry
     */
    toLogEntry() {
        return {
            error: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            stack: this.stack,
        };
    }
}
// ==================== Request Errors ====================
/**
 * Thrown when request message is malformed
 */
export class InvalidRequestError extends MemoryError {
    code = 'INVALID_REQUEST';
    constructor(message, context = {}) {
        super(`Invalid request: ${message}`, context);
    }
}
/**
 * Thrown when method name is not recognized
 */
export class UnknownMethodError extends MemoryError {
    code = 'UNKNOWN_METHOD';
    constructor(method) {
        super(`Unknown method: ${method}`, { method });
    }
}
/**
 * Thrown when request parameters fail validation
 */
export class ValidationError extends MemoryError {
    code = 'VALIDATION_ERROR';
    constructor(message, context = {}) {
        super(`Validation failed: ${message}`, context);
    }
}
// ==================== Server Errors ====================
/**
 * Thrown when storage operation fails
 */
export class StorageError extends MemoryError {
    code = 'STORAGE_ERROR';
    constructor(operation, reason, context = {}) {
        super(`Storage error during ${operation}: ${reason}`, { operation, ...context });
    }
}
/**
 * Thrown when server is shutting down and rejecting requests
 */
export class ServerShuttingDownError extends MemoryError {
    code = 'SERVER_SHUTTING_DOWN';
    constructor() {
        super('Server is shutting down, request rejected');
    }
}
/**
 * Thrown when operation times out
 */
export class TimeoutError extends MemoryError {
    code = 'TIMEOUT';
    constructor(operation, timeoutMs) {
        super(`Operation timed out after ${timeoutMs}ms: ${operation}`, { operation, timeoutMs });
    }
}
/**
 * Thrown when server has reached maximum connections
 */
export class MaxConnectionsError extends MemoryError {
    code = 'MAX_CONNECTIONS';
    constructor(currentConnections, maxConnections) {
        super(`Maximum connections reached (${currentConnections}/${maxConnections}). Try again later.`, { currentConnections, maxConnections });
    }
}
// ==================== Client Errors ====================
/**
 * Thrown when server is not running
 */
export class ServerNotRunningError extends MemoryError {
    code = 'SERVER_NOT_RUNNING';
    constructor(address) {
        super(address
            ? `Memory server not running at ${address}`
            : 'Memory server not running. Start with MemoryServer.start()', { address });
    }
}
/**
 * Thrown when connection to server is lost
 */
export class ServerDisconnectedError extends MemoryError {
    code = 'SERVER_DISCONNECTED';
    constructor(reason) {
        super(reason
            ? `Disconnected from memory server: ${reason}`
            : 'Disconnected from memory server', { reason });
    }
}
// ==================== Factory Functions ====================
/**
 * Create error from IPC error info
 */
export function errorFromInfo(info) {
    const context = info.context ?? {};
    switch (info.code) {
        case 'INVALID_REQUEST':
            return new InvalidRequestError(info.message, context);
        case 'UNKNOWN_METHOD':
            return new UnknownMethodError(context.method ?? 'unknown');
        case 'VALIDATION_ERROR':
            return new ValidationError(info.message, context);
        case 'STORAGE_ERROR':
            return new StorageError(context.operation ?? 'unknown', info.message, context);
        case 'SERVER_SHUTTING_DOWN':
            return new ServerShuttingDownError();
        case 'TIMEOUT':
            return new TimeoutError(context.operation ?? 'unknown', context.timeoutMs ?? 0);
        case 'MAX_CONNECTIONS':
            return new MaxConnectionsError(context.currentConnections ?? 0, context.maxConnections ?? 0);
        case 'SERVER_NOT_RUNNING':
            return new ServerNotRunningError(context.address);
        case 'SERVER_DISCONNECTED':
            return new ServerDisconnectedError(context.reason);
        default:
            // Should never happen, but TypeScript needs exhaustive check
            return new InvalidRequestError(`Unknown error code: ${info.code}`, context);
    }
}
/**
 * Check if an error is a MemoryError
 */
export function isMemoryError(error) {
    return error instanceof MemoryError;
}
/**
 * Wrap unknown error as MemoryError
 */
export function wrapError(error, operation) {
    if (isMemoryError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new StorageError(operation, error.message, {
            originalError: error.name,
            originalStack: error.stack,
        });
    }
    return new StorageError(operation, String(error));
}
//# sourceMappingURL=memory-errors.js.map