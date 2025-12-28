/**
 * UCM Error Hierarchy
 * Universal Context Management System Error Classes
 *
 * CONSTITUTION: All errors must be catchable and recoverable
 */
/**
 * Base UCM error class
 */
export class UCMError extends Error {
    timestamp;
    context;
    constructor(message, context) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.context = context;
        Error.captureStackTrace?.(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            recoverable: this.recoverable,
            timestamp: this.timestamp.toISOString(),
            context: this.context
        };
    }
}
// ============================================================================
// Daemon Errors
// ============================================================================
export class DaemonError extends UCMError {
    code = 'UCM_DAEMON_ERROR';
    recoverable = true;
}
export class ServiceError extends DaemonError {
    errorCode;
    code = 'UCM_SERVICE_ERROR';
    recoverable = true;
    details;
    constructor(errorCode, message, details) {
        super(message, { errorCode, details });
        this.errorCode = errorCode;
        this.details = details;
    }
}
export class DaemonUnavailableError extends DaemonError {
    code = 'UCM_DAEMON_UNAVAILABLE';
    recoverable = true;
    constructor(socketPath, cause) {
        super(`UCM Daemon unavailable at ${socketPath}`, {
            socketPath,
            cause: cause?.message
        });
    }
}
export class DaemonStartupError extends DaemonError {
    code = 'UCM_DAEMON_STARTUP_FAILED';
    recoverable = true;
    constructor(timeoutMs, cause) {
        super(`UCM Daemon failed to start within ${timeoutMs}ms`, {
            timeoutMs,
            cause: cause?.message
        });
    }
}
export class DaemonIPCError extends DaemonError {
    code = 'UCM_DAEMON_IPC_ERROR';
    recoverable = true;
    constructor(method, cause) {
        super(`IPC call failed: ${method}`, {
            method,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Embedding Errors
// ============================================================================
export class EmbeddingError extends UCMError {
    code = 'UCM_EMBEDDING_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class EmbeddingServiceUnavailableError extends EmbeddingError {
    code = 'UCM_EMBEDDING_SERVICE_UNAVAILABLE';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class EmbeddingTimeoutError extends EmbeddingError {
    code = 'UCM_EMBEDDING_TIMEOUT';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class EmbeddingBatchError extends EmbeddingError {
    code = 'UCM_EMBEDDING_BATCH_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
// ============================================================================
// DESC Errors
// ============================================================================
export class DESCError extends UCMError {
    code = 'UCM_DESC_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class DESCRetrievalError extends DESCError {
    code = 'UCM_DESC_RETRIEVAL_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class DESCStorageError extends DESCError {
    code = 'UCM_DESC_STORAGE_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
export class DESCChunkingError extends DESCError {
    code = 'UCM_DESC_CHUNKING_ERROR';
    recoverable = true;
    constructor(message, context) {
        super(message, context);
    }
}
// ============================================================================
// Recovery Errors
// ============================================================================
export class RecoveryError extends UCMError {
    code = 'UCM_RECOVERY_ERROR';
    recoverable = true;
}
export class CompactionDetectionError extends RecoveryError {
    code = 'UCM_COMPACTION_DETECTION_ERROR';
    recoverable = true;
    constructor(cause) {
        super('Failed to detect compaction event', {
            cause: cause?.message
        });
    }
}
export class ContextReconstructionError extends RecoveryError {
    code = 'UCM_CONTEXT_RECONSTRUCTION_ERROR';
    recoverable = true;
    constructor(agentsRecovered, totalAgents, failedKeys, cause) {
        super(`Context reconstruction incomplete: ${agentsRecovered}/${totalAgents} agents recovered`, {
            agentsRecovered,
            totalAgents,
            failedKeys,
            cause: cause?.message
        });
    }
}
export class MemoryRetrievalError extends RecoveryError {
    code = 'UCM_MEMORY_RETRIEVAL_ERROR';
    recoverable = true;
    constructor(key, cause) {
        super(`Failed to retrieve memory: ${key}`, {
            key,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Token Estimation Errors
// ============================================================================
export class TokenEstimationError extends UCMError {
    code = 'UCM_TOKEN_ESTIMATION_ERROR';
    recoverable = true;
}
export class ContentClassificationError extends TokenEstimationError {
    code = 'UCM_CONTENT_CLASSIFICATION_ERROR';
    recoverable = true;
    constructor(textLength, cause) {
        super(`Failed to classify content of length ${textLength}`, {
            textLength,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Configuration Errors
// ============================================================================
export class ConfigurationError extends UCMError {
    code = 'UCM_CONFIGURATION_ERROR';
    recoverable = false;
}
export class InvalidConfigError extends ConfigurationError {
    code = 'UCM_INVALID_CONFIG';
    recoverable = false;
    constructor(field, value, expected) {
        super(`Invalid configuration: ${field}`, {
            field,
            value,
            expected
        });
    }
}
export class MissingConfigError extends ConfigurationError {
    code = 'UCM_MISSING_CONFIG';
    recoverable = false;
    constructor(field) {
        super(`Missing required configuration: ${field}`, {
            field
        });
    }
}
// ============================================================================
// Workflow Adapter Errors
// ============================================================================
export class WorkflowAdapterError extends UCMError {
    code = 'UCM_WORKFLOW_ADAPTER_ERROR';
    recoverable = true;
}
export class AdapterNotFoundError extends WorkflowAdapterError {
    code = 'UCM_ADAPTER_NOT_FOUND';
    recoverable = true;
    constructor(adapterName) {
        super(`Workflow adapter not found: ${adapterName}`, {
            adapterName
        });
    }
}
export class AdapterDetectionError extends WorkflowAdapterError {
    code = 'UCM_ADAPTER_DETECTION_ERROR';
    recoverable = true;
    constructor(context, cause) {
        super('Failed to detect appropriate workflow adapter', {
            context,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Budget Errors
// ============================================================================
export class BudgetError extends UCMError {
    code = 'UCM_BUDGET_ERROR';
    recoverable = true;
}
export class BudgetExceededError extends BudgetError {
    code = 'UCM_BUDGET_EXCEEDED';
    recoverable = true;
    constructor(current, limit, category) {
        super(`Token budget exceeded for ${category}: ${current}/${limit}`, {
            current,
            limit,
            category
        });
    }
}
export class BudgetAllocationError extends BudgetError {
    code = 'UCM_BUDGET_ALLOCATION_ERROR';
    recoverable = true;
    constructor(requested, available, cause) {
        super(`Cannot allocate ${requested} tokens, only ${available} available`, {
            requested,
            available,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Error Type Guards
// ============================================================================
export function isUCMError(error) {
    return error instanceof UCMError;
}
export function isDaemonError(error) {
    return error instanceof DaemonError;
}
export function isEmbeddingError(error) {
    return error instanceof EmbeddingError;
}
export function isDESCError(error) {
    return error instanceof DESCError;
}
export function isRecoveryError(error) {
    return error instanceof RecoveryError;
}
export function isRecoverableError(error) {
    if (isUCMError(error)) {
        return error.recoverable;
    }
    return false;
}
//# sourceMappingURL=errors.js.map