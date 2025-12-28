/**
 * Memory Engine Error Classes
 */
export { OrphanNodeError } from '../graph-db/index.js';
/**
 * Error thrown when storage transaction fails
 */
export declare class StorageTransactionError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
/**
 * Error thrown when namespace validation fails
 */
export declare class NamespaceValidationError extends Error {
    readonly namespace: string;
    constructor(message: string, namespace: string);
}
//# sourceMappingURL=errors.d.ts.map