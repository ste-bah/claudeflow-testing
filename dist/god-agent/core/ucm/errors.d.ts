/**
 * UCM Error Hierarchy
 * Universal Context Management System Error Classes
 *
 * CONSTITUTION: All errors must be catchable and recoverable
 */
/**
 * Base UCM error class
 */
export declare abstract class UCMError extends Error {
    abstract readonly code: string;
    abstract readonly recoverable: boolean;
    readonly timestamp: Date;
    readonly context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
    toJSON(): Record<string, unknown>;
}
export declare class DaemonError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
}
export declare class ServiceError extends DaemonError {
    readonly errorCode: number;
    readonly code = "UCM_SERVICE_ERROR";
    readonly recoverable = true;
    readonly details?: unknown;
    constructor(errorCode: number, message: string, details?: unknown);
}
export declare class DaemonUnavailableError extends DaemonError {
    readonly code = "UCM_DAEMON_UNAVAILABLE";
    readonly recoverable = true;
    constructor(socketPath: string, cause?: Error);
}
export declare class DaemonStartupError extends DaemonError {
    readonly code = "UCM_DAEMON_STARTUP_FAILED";
    readonly recoverable = true;
    constructor(timeoutMs: number, cause?: Error);
}
export declare class DaemonIPCError extends DaemonError {
    readonly code = "UCM_DAEMON_IPC_ERROR";
    readonly recoverable = true;
    constructor(method: string, cause?: Error);
}
export declare class EmbeddingError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class EmbeddingServiceUnavailableError extends EmbeddingError {
    readonly code = "UCM_EMBEDDING_SERVICE_UNAVAILABLE";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class EmbeddingTimeoutError extends EmbeddingError {
    readonly code = "UCM_EMBEDDING_TIMEOUT";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class EmbeddingBatchError extends EmbeddingError {
    readonly code = "UCM_EMBEDDING_BATCH_ERROR";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class DESCError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class DESCRetrievalError extends DESCError {
    readonly code = "UCM_DESC_RETRIEVAL_ERROR";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class DESCStorageError extends DESCError {
    readonly code = "UCM_DESC_STORAGE_ERROR";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class DESCChunkingError extends DESCError {
    readonly code = "UCM_DESC_CHUNKING_ERROR";
    readonly recoverable = true;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class RecoveryError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
}
export declare class CompactionDetectionError extends RecoveryError {
    readonly code = "UCM_COMPACTION_DETECTION_ERROR";
    readonly recoverable = true;
    constructor(cause?: Error);
}
export declare class ContextReconstructionError extends RecoveryError {
    readonly code = "UCM_CONTEXT_RECONSTRUCTION_ERROR";
    readonly recoverable = true;
    constructor(agentsRecovered: number, totalAgents: number, failedKeys: string[], cause?: Error);
}
export declare class MemoryRetrievalError extends RecoveryError {
    readonly code = "UCM_MEMORY_RETRIEVAL_ERROR";
    readonly recoverable = true;
    constructor(key: string, cause?: Error);
}
export declare class TokenEstimationError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
}
export declare class ContentClassificationError extends TokenEstimationError {
    readonly code = "UCM_CONTENT_CLASSIFICATION_ERROR";
    readonly recoverable = true;
    constructor(textLength: number, cause?: Error);
}
export declare class ConfigurationError extends UCMError {
    readonly code: string;
    readonly recoverable = false;
}
export declare class InvalidConfigError extends ConfigurationError {
    readonly code = "UCM_INVALID_CONFIG";
    readonly recoverable = false;
    constructor(field: string, value: unknown, expected: string);
}
export declare class MissingConfigError extends ConfigurationError {
    readonly code = "UCM_MISSING_CONFIG";
    readonly recoverable = false;
    constructor(field: string);
}
export declare class WorkflowAdapterError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
}
export declare class AdapterNotFoundError extends WorkflowAdapterError {
    readonly code = "UCM_ADAPTER_NOT_FOUND";
    readonly recoverable = true;
    constructor(adapterName: string);
}
export declare class AdapterDetectionError extends WorkflowAdapterError {
    readonly code = "UCM_ADAPTER_DETECTION_ERROR";
    readonly recoverable = true;
    constructor(context: Record<string, unknown>, cause?: Error);
}
export declare class BudgetError extends UCMError {
    readonly code: string;
    readonly recoverable = true;
}
export declare class BudgetExceededError extends BudgetError {
    readonly code = "UCM_BUDGET_EXCEEDED";
    readonly recoverable = true;
    constructor(current: number, limit: number, category: string);
}
export declare class BudgetAllocationError extends BudgetError {
    readonly code = "UCM_BUDGET_ALLOCATION_ERROR";
    readonly recoverable = true;
    constructor(requested: number, available: number, cause?: Error);
}
export declare function isUCMError(error: unknown): error is UCMError;
export declare function isDaemonError(error: unknown): error is DaemonError;
export declare function isEmbeddingError(error: unknown): error is EmbeddingError;
export declare function isDESCError(error: unknown): error is DESCError;
export declare function isRecoveryError(error: unknown): error is RecoveryError;
export declare function isRecoverableError(error: unknown): boolean;
//# sourceMappingURL=errors.d.ts.map