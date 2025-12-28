/**
 * PipelineTracker - Track DAI-002 pipeline execution with step-by-step progress
 *
 * Implements pipeline execution tracking with per-step timing, status, and overall progress.
 * Maintains bounded list of active and completed pipelines with FIFO eviction.
 *
 * @module observability/pipeline-tracker
 * @see TASK-OBS-004-PIPELINE-TRACKER.md
 * @see TECH-OBS-001-IMPLEMENTATION.md Section 3.5
 */
import { IActivityStream } from './activity-stream.js';
/**
 * Pipeline start configuration
 */
export interface IPipelineStart {
    /** Pipeline name */
    name: string;
    /** Ordered step names */
    steps: string[];
    /** Task type (e.g., 'research', 'code', 'analysis') */
    taskType: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Step start configuration
 */
export interface IStepStart {
    /** Step name */
    name: string;
    /** Agent type executing this step (optional) */
    agentType?: string;
}
/**
 * Step result after completion
 */
export interface IStepResult {
    /** Step output data */
    output?: unknown;
    /** Files modified during step */
    filesModified?: string[];
}
/**
 * Pipeline result after completion
 */
export interface IPipelineResult {
    /** Pipeline output */
    output: unknown;
    /** Total duration in milliseconds */
    totalDurationMs: number;
}
/**
 * Step status tracking
 */
export interface IStepStatus {
    /** Unique step ID */
    id: string;
    /** Step name */
    name: string;
    /** Step execution status */
    status: 'pending' | 'running' | 'success' | 'error';
    /** Start time (Unix epoch ms) */
    startTime?: number;
    /** End time (Unix epoch ms) */
    endTime?: number;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Agent type executing this step */
    agentType?: string;
    /** Error message if failed */
    error?: string;
}
/**
 * Pipeline status tracking
 */
export interface IPipelineStatus {
    /** Unique pipeline ID */
    id: string;
    /** Pipeline name */
    name: string;
    /** Pipeline status */
    status: 'running' | 'success' | 'error';
    /** Start time (Unix epoch ms) */
    startTime: number;
    /** End time (Unix epoch ms) */
    endTime?: number;
    /** Total steps in pipeline */
    totalSteps: number;
    /** Number of completed steps */
    completedSteps: number;
    /** Current step name (if running) */
    currentStep?: string;
    /** Steps status array */
    steps: IStepStatus[];
    /** Progress percentage 0-100 */
    progress: number;
}
/**
 * PipelineTracker interface
 * Implements [REQ-OBS-06]: Pipeline execution monitoring
 */
export interface IPipelineTracker {
    /**
     * Start tracking a new pipeline
     * @param pipeline Pipeline start configuration
     * @returns Unique pipeline ID
     */
    startPipeline(pipeline: IPipelineStart): string;
    /**
     * Start a pipeline step
     * @param pipelineId Pipeline ID
     * @param step Step start configuration
     * @returns Unique step ID
     */
    startStep(pipelineId: string, step: IStepStart): string;
    /**
     * Mark a step as completed
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param result Step result data
     */
    completeStep(pipelineId: string, stepId: string, result: IStepResult): void;
    /**
     * Mark a step as failed
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param error Error that caused failure
     */
    failStep(pipelineId: string, stepId: string, error: Error): void;
    /**
     * Mark pipeline as completed
     * @param pipelineId Pipeline ID
     * @param result Pipeline result data
     */
    completePipeline(pipelineId: string, result: IPipelineResult): void;
    /**
     * Mark pipeline as failed
     * @param pipelineId Pipeline ID
     * @param error Error that caused failure
     */
    failPipeline(pipelineId: string, error: Error): void;
    /**
     * Get all active pipelines
     * @returns Array of active pipeline statuses
     */
    getActive(): IPipelineStatus[];
    /**
     * Get a pipeline by ID
     * @param pipelineId Pipeline ID
     * @returns Pipeline status or null if not found
     */
    getById(pipelineId: string): IPipelineStatus | null;
}
/**
 * PipelineTracker implementation
 *
 * Implements:
 * - [REQ-OBS-06]: Pipeline execution monitoring
 * - [REQ-OBS-10]: Pipeline status and per-step execution tracking
 * - [RULE-OBS-004]: Memory bounds enforcement (20 completed max)
 */
export declare class PipelineTracker implements IPipelineTracker {
    private activityStream;
    private active;
    private completed;
    private readonly MAX_COMPLETED;
    /**
     * Create a new PipelineTracker
     * @param activityStream ActivityStream for event emission
     */
    constructor(activityStream: IActivityStream);
    /**
     * Start tracking a new pipeline
     * Implements [REQ-OBS-10]: Track pipeline start
     *
     * @param pipeline Pipeline start configuration
     * @returns Unique pipeline ID (format: pipe_{name}_{timestamp}_{random})
     */
    startPipeline(pipeline: IPipelineStart): string;
    /**
     * Start a pipeline step
     *
     * @param pipelineId Pipeline ID
     * @param step Step start configuration
     * @returns Unique step ID
     */
    startStep(pipelineId: string, step: IStepStart): string;
    /**
     * Mark a step as completed
     *
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param result Step result data
     */
    completeStep(pipelineId: string, stepId: string, result: IStepResult): void;
    /**
     * Mark a step as failed
     *
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param error Error that caused failure
     */
    failStep(pipelineId: string, stepId: string, error: Error): void;
    /**
     * Mark pipeline as completed
     *
     * @param pipelineId Pipeline ID
     * @param result Pipeline result data
     */
    completePipeline(pipelineId: string, result: IPipelineResult): void;
    /**
     * Mark pipeline as failed
     *
     * @param pipelineId Pipeline ID
     * @param error Error that caused failure
     */
    failPipeline(pipelineId: string, error: Error): void;
    /**
     * Get all active pipelines
     * @returns Array of active pipeline statuses
     */
    getActive(): IPipelineStatus[];
    /**
     * Get a pipeline by ID
     * @param pipelineId Pipeline ID
     * @returns Pipeline status or null if not found
     */
    getById(pipelineId: string): IPipelineStatus | null;
    /**
     * Get statistics about tracker state
     */
    getStats(): {
        activeCount: number;
        completedCount: number;
        maxCompleted: number;
    };
    /**
     * Generate a unique pipeline ID
     * Format: pipe_{name}_{timestamp}_{random}
     *
     * @param name Pipeline name
     * @returns Unique pipeline ID
     */
    private generatePipelineId;
    /**
     * Generate a unique step ID
     * Format: step_{pipelineId}_{stepIndex}_{random}
     *
     * @param pipelineId Pipeline ID
     * @param stepIndex Step index
     * @returns Unique step ID
     */
    private generateStepId;
    /**
     * Generate a random 6-character ID
     * @returns Random alphanumeric string
     */
    private randomId;
    /**
     * Add a completed pipeline to the completed list
     * Implements FIFO eviction when exceeding MAX_COMPLETED
     *
     * @param pipeline The completed pipeline
     */
    private addCompleted;
}
export default PipelineTracker;
//# sourceMappingURL=pipeline-tracker.d.ts.map