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
export declare class RoutingError extends Error {
    /**
     * Task ID associated with the error
     */
    readonly taskId?: string;
    /**
     * Agent key involved in the error
     */
    readonly agentKey?: string;
    /**
     * Confidence score at time of error
     */
    readonly confidence?: number;
    /**
     * Timestamp when error occurred
     */
    readonly timestamp: number;
    /**
     * Create a routing error
     *
     * @param message - Error message (will be prefixed with [Routing])
     * @param context - Error context
     * @param cause - Original error that caused this error
     */
    constructor(message: string, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Task analysis failure error
 * Thrown when task analysis fails to complete
 */
export declare class TaskAnalysisError extends RoutingError {
    /**
     * Task description that failed to analyze
     */
    readonly task: string;
    /**
     * Analysis phase where failure occurred
     */
    readonly phase: 'embedding' | 'domain-detection' | 'complexity-assessment' | 'verb-extraction' | 'capability-inference';
    /**
     * Create a task analysis error
     *
     * @param message - Error message
     * @param task - Task description that failed
     * @param phase - Analysis phase where failure occurred
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message: string, task: string, phase: 'embedding' | 'domain-detection' | 'complexity-assessment' | 'verb-extraction' | 'capability-inference', context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Capability index error
 * Thrown when capability index operations fail
 */
export declare class CapabilityIndexError extends RoutingError {
    /**
     * Index operation that failed
     */
    readonly operation: 'initialize' | 'rebuild' | 'search' | 'add' | 'remove' | 'sync';
    /**
     * Number of indexed agents at time of error
     */
    readonly agentCount: number;
    /**
     * Create a capability index error
     *
     * @param message - Error message
     * @param operation - Index operation that failed
     * @param agentCount - Number of indexed agents
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message: string, operation: 'initialize' | 'rebuild' | 'search' | 'add' | 'remove' | 'sync', agentCount: number, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Routing decision error
 * Thrown when routing decision logic fails
 */
export declare class RoutingDecisionError extends RoutingError {
    /**
     * Decision stage where failure occurred
     */
    readonly stage: 'preference-check' | 'agent-scoring' | 'explanation-generation' | 'alternatives-generation' | 'factor-calculation';
    /**
     * Number of candidate agents considered
     */
    readonly candidateCount: number;
    /**
     * Create a routing decision error
     *
     * @param message - Error message
     * @param stage - Decision stage where failure occurred
     * @param candidateCount - Number of candidate agents
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message: string, stage: 'preference-check' | 'agent-scoring' | 'explanation-generation' | 'alternatives-generation' | 'factor-calculation', candidateCount: number, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Low confidence routing error
 * Thrown when routing confidence is below acceptable threshold
 * Per RULE-DAI-003-003: Low confidence (<0.7) requires user confirmation
 */
export declare class LowConfidenceError extends RoutingError {
    /**
     * Confidence threshold that was not met
     */
    readonly threshold: number;
    /**
     * Actual confidence score achieved
     */
    readonly actualConfidence: number;
    /**
     * Selected agent that has low confidence
     */
    readonly selectedAgent: string;
    /**
     * Alternative agents with scores
     */
    readonly alternatives: ReadonlyArray<{
        agentKey: string;
        score: number;
    }>;
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
    constructor(message: string, actualConfidence: number, threshold: number, selectedAgent: string, alternatives: ReadonlyArray<{
        agentKey: string;
        score: number;
    }>, context?: {
        taskId?: string;
        agentKey?: string;
    });
}
/**
 * Error thrown when confirmation times out
 *
 * Indicates that the user did not respond to a confirmation request
 * within the allowed time window.
 */
export declare class ConfirmationTimeoutError extends RoutingError {
    /**
     * Timeout duration in milliseconds
     */
    readonly timeoutMs: number;
    /**
     * Task ID that timed out
     */
    readonly taskId: string;
    /**
     * Confidence score that triggered confirmation
     */
    readonly confidence: number;
    /**
     * Create a confirmation timeout error
     *
     * @param message - Error message
     * @param taskId - Task ID that timed out
     * @param timeoutMs - Timeout duration in milliseconds
     * @param confidence - Confidence score that triggered confirmation
     * @param context - Error context
     */
    constructor(message: string, taskId: string, timeoutMs: number, confidence: number, context?: {
        agentKey?: string;
    });
}
/**
 * Pipeline generation error
 * Thrown when pipeline generation fails
 */
export declare class PipelineGenerationError extends RoutingError {
    /**
     * Task description that failed to generate pipeline
     */
    readonly task: string;
    /**
     * Generation stage where failure occurred
     */
    readonly stage: 'segmentation' | 'verb-extraction' | 'routing' | 'definition-building' | 'validation';
    /**
     * Number of stages successfully generated before failure
     */
    readonly completedStages: number;
    /**
     * Total expected stages
     */
    readonly totalStages: number;
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
    constructor(message: string, task: string, stage: 'segmentation' | 'verb-extraction' | 'routing' | 'definition-building' | 'validation', completedStages: number, totalStages: number, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Routing learning error
 * Thrown when routing learning/feedback processing fails
 */
export declare class RoutingLearningError extends RoutingError {
    /**
     * Learning operation that failed
     */
    readonly operation: 'feedback-processing' | 'weight-update' | 'ewc-calculation' | 'accuracy-tracking' | 'rollback' | 'checkpoint-creation';
    /**
     * Routing ID associated with the feedback
     */
    readonly routingId?: string;
    /**
     * Current execution count at time of error
     */
    readonly executionCount: number;
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
    constructor(message: string, operation: 'feedback-processing' | 'weight-update' | 'ewc-calculation' | 'accuracy-tracking' | 'rollback' | 'checkpoint-creation', executionCount: number, routingId?: string, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
/**
 * Index synchronization error
 * Thrown when capability index fails to sync with agent registry
 */
export declare class IndexSyncError extends RoutingError {
    /**
     * Sync operation that failed
     */
    readonly syncOperation: 'registry-load' | 'agent-added' | 'agent-removed' | 'full-rebuild' | 'freshness-check';
    /**
     * Last successful sync timestamp
     */
    readonly lastSyncTime: number;
    /**
     * Time since last sync in milliseconds
     */
    readonly timeSinceSync: number;
    /**
     * Whether index is stale (> 24h)
     */
    readonly isStale: boolean;
    /**
     * Create an index sync error
     *
     * @param message - Error message
     * @param syncOperation - Sync operation that failed
     * @param lastSyncTime - Last successful sync timestamp
     * @param context - Error context
     * @param cause - Original error
     */
    constructor(message: string, syncOperation: 'registry-load' | 'agent-added' | 'agent-removed' | 'full-rebuild' | 'freshness-check', lastSyncTime: number, context?: {
        taskId?: string;
        agentKey?: string;
        confidence?: number;
    }, cause?: Error);
}
//# sourceMappingURL=routing-errors.d.ts.map