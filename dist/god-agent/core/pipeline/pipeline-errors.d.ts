/**
 * DAI-002: Multi-Agent Sequential Pipeline Error Classes
 *
 * RULE-003: Fail Fast with Robust Error Logging
 * - All errors MUST be thrown immediately with full context
 * - Silent failures, swallowed exceptions, and generic error messages are FORBIDDEN
 * - Error messages MUST include: what failed, why, what data, stack trace
 *
 * Error Handling Rules:
 * 1. All errors MUST include pipeline context (pipelineId, stepIndex, agentKey)
 * 2. Errors MUST preserve cause chain via Error.cause
 * 3. Partial results MUST be included when available
 * 4. Errors MUST be thrown immediately (fail fast)
 * 5. No silent catch blocks - always rethrow or log with context
 */
import type { IStepResult } from './dai-002-types.js';
/**
 * Abstract base class for all DAI-002 pipeline errors.
 * Provides consistent error structure with context.
 */
export declare abstract class PipelineError extends Error {
    /** Contextual information about the error */
    abstract readonly context: Record<string, unknown>;
    /** The underlying cause of this error (ES2022+ compatibility) */
    cause?: Error;
    constructor(message: string);
    /**
     * Get a formatted error message with full context
     */
    toDetailedString(): string;
}
/**
 * Thrown when pipeline definition is invalid.
 * Used during validation before execution starts.
 *
 * @example
 * throw new PipelineDefinitionError('Pipeline must have at least one agent', {
 *   pipelineName: 'my-pipeline',
 *   invalidField: 'agents',
 *   details: { actualLength: 0 }
 * });
 */
export declare class PipelineDefinitionError extends PipelineError {
    readonly name = "PipelineDefinitionError";
    readonly context: {
        /** Name of the pipeline being validated */
        pipelineName?: string;
        /** Field that failed validation */
        invalidField?: string;
        /** Additional details about the validation failure */
        details?: unknown;
    };
    constructor(message: string, context?: PipelineDefinitionError['context']);
}
/**
 * Thrown when pipeline execution fails at a specific step.
 * Includes partial results from completed steps.
 *
 * @example
 * throw new PipelineExecutionError('Agent returned empty output', {
 *   pipelineId: 'pip_123',
 *   pipelineName: 'feature-impl',
 *   agentKey: 'backend-dev',
 *   stepIndex: 2,
 *   partialResults: [step0Result, step1Result],
 *   cause: originalError
 * });
 */
export declare class PipelineExecutionError extends PipelineError {
    readonly name = "PipelineExecutionError";
    readonly context: {
        /** Unique pipeline execution ID */
        pipelineId: string;
        /** Pipeline name */
        pipelineName: string;
        /** Key of the agent that failed */
        agentKey: string;
        /** Index of the step that failed (0-based) */
        stepIndex: number;
        /** Results from steps that completed before failure */
        partialResults?: IStepResult[];
        /** Underlying error that caused the failure */
        cause?: Error;
    };
    constructor(message: string, context: PipelineExecutionError['context']);
    /**
     * Get the number of steps completed before failure
     */
    get completedStepCount(): number;
}
/**
 * Thrown when memory coordination fails (storage or retrieval).
 * Critical for pipeline handoff between agents.
 *
 * RULE-005: Mandatory Memory Coordination
 * - Every agent in a pipeline MUST coordinate through God Agent's memory systems
 *
 * @example
 * throw new MemoryCoordinationError('Failed to store output: database connection lost', {
 *   pipelineId: 'pip_123',
 *   stepIndex: 1,
 *   domain: 'project/api',
 *   operation: 'store',
 *   cause: dbError
 * });
 */
export declare class MemoryCoordinationError extends PipelineError {
    readonly name = "MemoryCoordinationError";
    readonly context: {
        /** Unique pipeline execution ID */
        pipelineId: string;
        /** Step index where memory operation failed */
        stepIndex: number;
        /** Memory domain involved */
        domain?: string;
        /** Type of operation that failed */
        operation: 'store' | 'retrieve';
        /** Underlying error */
        cause?: Error;
    };
    constructor(message: string, context: MemoryCoordinationError['context']);
}
/**
 * Thrown when agent output quality is below the threshold.
 * Prevents low-quality output from propagating to next agents.
 *
 * @example
 * throw new QualityGateError({
 *   pipelineId: 'pip_123',
 *   stepIndex: 2,
 *   agentKey: 'coder',
 *   actualQuality: 0.45,
 *   requiredQuality: 0.7
 * });
 */
export declare class QualityGateError extends PipelineError {
    readonly name = "QualityGateError";
    readonly context: {
        /** Unique pipeline execution ID */
        pipelineId: string;
        /** Step index where quality check failed */
        stepIndex: number;
        /** Agent key that produced low-quality output */
        agentKey: string;
        /** Actual quality score (0-1) */
        actualQuality: number;
        /** Required minimum quality score (0-1) */
        requiredQuality: number;
    };
    constructor(context: QualityGateError['context']);
    /**
     * Get the quality deficit (how far below threshold)
     */
    get qualityDeficit(): number;
}
/**
 * Thrown when step or pipeline timeout is exceeded.
 * Includes partial results from completed steps.
 *
 * @example
 * throw new PipelineTimeoutError({
 *   pipelineId: 'pip_123',
 *   stepIndex: 3,
 *   agentKey: 'researcher',
 *   timeout: 300000,
 *   elapsed: 305000,
 *   scope: 'step',
 *   partialResults: previousStepResults
 * });
 */
export declare class PipelineTimeoutError extends PipelineError {
    readonly name = "PipelineTimeoutError";
    readonly context: {
        /** Unique pipeline execution ID */
        pipelineId: string;
        /** Step index where timeout occurred (undefined for pipeline timeout) */
        stepIndex?: number;
        /** Agent key that timed out (undefined for pipeline timeout) */
        agentKey?: string;
        /** Timeout limit in milliseconds */
        timeout: number;
        /** Actual elapsed time in milliseconds */
        elapsed: number;
        /** Whether this is a step timeout or pipeline timeout */
        scope: 'step' | 'pipeline';
        /** Results from steps completed before timeout */
        partialResults?: IStepResult[];
    };
    constructor(context: PipelineTimeoutError['context']);
    /**
     * Get how much time over the limit
     */
    get timeOverLimit(): number;
    /**
     * Get the number of steps completed before timeout
     */
    get completedStepCount(): number;
}
/**
 * Thrown when DAI-001 agent selection fails.
 * Used when taskDescription is provided but no suitable agent found.
 *
 * RULE-006: DAI-001 Integration Required
 *
 * @example
 * throw new AgentSelectionError('No suitable agent found', {
 *   pipelineId: 'pip_123',
 *   stepIndex: 1,
 *   taskDescription: 'Implement quantum computing algorithm',
 *   searchedCategories: ['coder', 'researcher', 'analyst']
 * });
 */
export declare class AgentSelectionError extends PipelineError {
    readonly name = "AgentSelectionError";
    readonly context: {
        /** Unique pipeline execution ID */
        pipelineId: string;
        /** Step index where selection failed */
        stepIndex: number;
        /** Task description that couldn't be matched */
        taskDescription: string;
        /** Categories searched (if available) */
        searchedCategories?: string[];
        /** Underlying error */
        cause?: Error;
    };
    constructor(message: string, context: AgentSelectionError['context']);
}
/**
 * Type guard to check if an error is a PipelineError
 */
export declare function isPipelineError(error: unknown): error is PipelineError;
/**
 * Type guard to check if an error is a PipelineDefinitionError
 */
export declare function isPipelineDefinitionError(error: unknown): error is PipelineDefinitionError;
/**
 * Type guard to check if an error is a PipelineExecutionError
 */
export declare function isPipelineExecutionError(error: unknown): error is PipelineExecutionError;
/**
 * Type guard to check if an error is a MemoryCoordinationError
 */
export declare function isMemoryCoordinationError(error: unknown): error is MemoryCoordinationError;
/**
 * Type guard to check if an error is a QualityGateError
 */
export declare function isQualityGateError(error: unknown): error is QualityGateError;
/**
 * Type guard to check if an error is a PipelineTimeoutError
 */
export declare function isPipelineTimeoutError(error: unknown): error is PipelineTimeoutError;
/**
 * Type guard to check if an error is an AgentSelectionError
 */
export declare function isAgentSelectionError(error: unknown): error is AgentSelectionError;
/**
 * Create a PipelineDefinitionError for missing required field
 */
export declare function createMissingFieldError(pipelineName: string, field: string): PipelineDefinitionError;
/**
 * Create a PipelineDefinitionError for invalid agent configuration
 */
export declare function createInvalidAgentError(pipelineName: string, stepIndex: number, reason: string): PipelineDefinitionError;
/**
 * Wrap an unknown error as a PipelineExecutionError
 */
export declare function wrapAsPipelineExecutionError(error: unknown, context: Omit<PipelineExecutionError['context'], 'cause'>): PipelineExecutionError;
//# sourceMappingURL=pipeline-errors.d.ts.map