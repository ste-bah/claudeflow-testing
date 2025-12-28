/**
 * DAI-003: Intelligent Task Routing Error Classes
 *
 * TASK-002: Routing Error Classes
 * Constitution: RULE-DAI-003-001 (explanation required), RULE-DAI-003-003 (low confidence)
 *
 * Custom error classes for routing operations with full context preservation.
 * All errors include:
 * - Full context (taskId, agentKey, confidence)
 * - Error cause chain via Error.cause
 * - Descriptive messages with [Routing] prefix
 *
 * @module src/god-agent/core/routing/routing-errors
 */
/**
 * Base routing error class
 * All routing errors extend this class for consistent error handling
 */
export class RoutingError extends Error {
    /**
     * Task ID associated with the error
     */
    taskId;
    /**
     * Agent key involved in the error
     */
    agentKey;
    /**
     * Confidence score at time of error
     */
    confidence;
    /**
     * Timestamp when error occurred
     */
    timestamp;
    /**
     * Create a routing error
     *
     * @param message - Error message (will be prefixed with [Routing])
     * @param context - Error context
     * @param cause - Original error that caused this error
     */
    constructor(message, context, cause) {
        super(`[Routing] ${message}`);
        this.name = 'RoutingError';
        this.taskId = context?.taskId;
        this.agentKey = context?.agentKey;
        this.confidence = context?.confidence;
        this.timestamp = Date.now();
        // Set cause manually for TypeScript compatibility
        if (cause) {
            this.cause = cause;
        }
        // Maintain proper stack trace for where our error was thrown (V8 only)
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
/**
 * Task analysis failure error
 * Thrown when task analysis fails to complete
 */
export class TaskAnalysisError extends RoutingError {
    /**
     * Task description that failed to analyze
     */
    task;
    /**
     * Analysis phase where failure occurred
     */
    phase;
    /**
     * Create a task analysis error
     *
     * @param message - Error message
     * @param task - Task description that failed
     * @param phase - Analysis phase where failure occurred
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, task, phase, context, cause) {
        super(message, context, cause);
        this.name = 'TaskAnalysisError';
        this.task = task;
        this.phase = phase;
    }
}
/**
 * Capability index error
 * Thrown when capability index operations fail
 */
export class CapabilityIndexError extends RoutingError {
    /**
     * Index operation that failed
     */
    operation;
    /**
     * Number of indexed agents at time of error
     */
    agentCount;
    /**
     * Create a capability index error
     *
     * @param message - Error message
     * @param operation - Index operation that failed
     * @param agentCount - Number of indexed agents
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, operation, agentCount, context, cause) {
        super(message, context, cause);
        this.name = 'CapabilityIndexError';
        this.operation = operation;
        this.agentCount = agentCount;
    }
}
/**
 * Routing decision error
 * Thrown when routing decision logic fails
 */
export class RoutingDecisionError extends RoutingError {
    /**
     * Decision stage where failure occurred
     */
    stage;
    /**
     * Number of candidate agents considered
     */
    candidateCount;
    /**
     * Create a routing decision error
     *
     * @param message - Error message
     * @param stage - Decision stage where failure occurred
     * @param candidateCount - Number of candidate agents
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, stage, candidateCount, context, cause) {
        super(message, context, cause);
        this.name = 'RoutingDecisionError';
        this.stage = stage;
        this.candidateCount = candidateCount;
    }
}
/**
 * Low confidence routing error
 * Thrown when routing confidence is below acceptable threshold
 * Per RULE-DAI-003-003: Low confidence (<0.7) requires user confirmation
 */
export class LowConfidenceError extends RoutingError {
    /**
     * Confidence threshold that was not met
     */
    threshold;
    /**
     * Actual confidence score achieved
     */
    actualConfidence;
    /**
     * Selected agent that has low confidence
     */
    selectedAgent;
    /**
     * Alternative agents with scores
     */
    alternatives;
    /**
     * Create a low confidence error
     *
     * @param message - Error message
     * @param actualConfidence - Actual confidence score achieved
     * @param threshold - Confidence threshold that was not met
     * @param selectedAgent - Selected agent with low confidence
     * @param alternatives - Alternative agents with scores
     * @param context - Error context
     */
    constructor(message, actualConfidence, threshold, selectedAgent, alternatives, context) {
        super(message, {
            ...context,
            confidence: actualConfidence,
            agentKey: selectedAgent,
        });
        this.name = 'LowConfidenceError';
        this.actualConfidence = actualConfidence;
        this.threshold = threshold;
        this.selectedAgent = selectedAgent;
        this.alternatives = alternatives;
    }
}
/**
 * Error thrown when confirmation times out
 *
 * Indicates that the user did not respond to a confirmation request
 * within the allowed time window.
 */
export class ConfirmationTimeoutError extends RoutingError {
    /**
     * Timeout duration in milliseconds
     */
    timeoutMs;
    /**
     * Task ID that timed out
     */
    taskId;
    /**
     * Confidence score that triggered confirmation
     */
    confidence;
    /**
     * Create a confirmation timeout error
     *
     * @param message - Error message
     * @param taskId - Task ID that timed out
     * @param timeoutMs - Timeout duration in milliseconds
     * @param confidence - Confidence score that triggered confirmation
     * @param context - Error context
     */
    constructor(message, taskId, timeoutMs, confidence, context) {
        super(message, {
            ...context,
            taskId,
            confidence,
        });
        this.name = 'ConfirmationTimeoutError';
        this.taskId = taskId;
        this.timeoutMs = timeoutMs;
        this.confidence = confidence;
    }
}
/**
 * Pipeline generation error
 * Thrown when pipeline generation fails
 */
export class PipelineGenerationError extends RoutingError {
    /**
     * Task description that failed to generate pipeline
     */
    task;
    /**
     * Generation stage where failure occurred
     */
    stage;
    /**
     * Number of stages successfully generated before failure
     */
    completedStages;
    /**
     * Total expected stages
     */
    totalStages;
    /**
     * Create a pipeline generation error
     *
     * @param message - Error message
     * @param task - Task description
     * @param stage - Generation stage where failure occurred
     * @param completedStages - Number of stages successfully generated
     * @param totalStages - Total expected stages
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, task, stage, completedStages, totalStages, context, cause) {
        super(message, context, cause);
        this.name = 'PipelineGenerationError';
        this.task = task;
        this.stage = stage;
        this.completedStages = completedStages;
        this.totalStages = totalStages;
    }
}
/**
 * Routing learning error
 * Thrown when routing learning/feedback processing fails
 */
export class RoutingLearningError extends RoutingError {
    /**
     * Learning operation that failed
     */
    operation;
    /**
     * Routing ID associated with the feedback
     */
    routingId;
    /**
     * Current execution count at time of error
     */
    executionCount;
    /**
     * Create a routing learning error
     *
     * @param message - Error message
     * @param operation - Learning operation that failed
     * @param executionCount - Current execution count
     * @param routingId - Routing ID if applicable
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, operation, executionCount, routingId, context, cause) {
        super(message, context, cause);
        this.name = 'RoutingLearningError';
        this.operation = operation;
        this.routingId = routingId;
        this.executionCount = executionCount;
    }
}
/**
 * Index synchronization error
 * Thrown when capability index fails to sync with agent registry
 */
export class IndexSyncError extends RoutingError {
    /**
     * Sync operation that failed
     */
    syncOperation;
    /**
     * Last successful sync timestamp
     */
    lastSyncTime;
    /**
     * Time since last sync in milliseconds
     */
    timeSinceSync;
    /**
     * Whether index is stale (> 24h)
     */
    isStale;
    /**
     * Create an index sync error
     *
     * @param message - Error message
     * @param syncOperation - Sync operation that failed
     * @param lastSyncTime - Last successful sync timestamp
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message, syncOperation, lastSyncTime, context, cause) {
        super(message, context, cause);
        this.name = 'IndexSyncError';
        this.syncOperation = syncOperation;
        this.lastSyncTime = lastSyncTime;
        this.timeSinceSync = Date.now() - lastSyncTime;
        this.isStale = this.timeSinceSync > 24 * 60 * 60 * 1000; // > 24 hours
    }
}
//# sourceMappingURL=routing-errors.js.map