/**
 * Memory Engine Error Classes
 */
// Re-export OrphanNodeError from graph-db
export { OrphanNodeError } from '../graph-db/index.js';
/**
 * Error thrown when storage transaction fails
 */
export class StorageTransactionError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'StorageTransactionError';
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, StorageTransactionError);
        }
    }
}
/**
 * Error thrown when namespace validation fails
 */
export class NamespaceValidationError extends Error {
    namespace;
    constructor(message, namespace) {
        super(message);
        this.namespace = namespace;
        this.name = 'NamespaceValidationError';
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NamespaceValidationError);
        }
    }
}
//# sourceMappingURL=errors.js.map