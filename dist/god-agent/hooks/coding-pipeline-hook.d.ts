/**
 * Coding Pipeline Hook Handler
 *
 * Intercepts /god-code command and routes to full 40-agent pipeline.
 * Provides pre-execution initialization and post-execution XP aggregation.
 *
 * @module src/god-agent/hooks/coding-pipeline-hook
 * @see TASK-HOOK-001-coding-hooks.md for specification
 */
/**
 * Hook context passed to hook handlers.
 * Contains information about the triggering command/tool.
 */
export interface IHookContext {
    /** The command or tool name that triggered the hook */
    command: string;
    /** Arguments passed to the command */
    args: {
        task?: string;
        phase?: number;
        dryRun?: boolean;
        [key: string]: unknown;
    };
    /** Timestamp when the hook was triggered */
    timestamp: string;
    /** Session ID for tracking */
    sessionId?: string;
}
/**
 * Result returned from hook handlers.
 * Indicates success/failure and provides context for downstream processing.
 */
export interface IHookResult {
    /** Whether the hook executed successfully */
    success: boolean;
    /** Human-readable message about the result */
    message: string;
    /** Additional context for downstream processing */
    context?: {
        pipelineId?: string;
        startPhase?: number;
        endPhase?: number;
        [key: string]: unknown;
    };
    /** Metrics collected during hook execution */
    metrics?: {
        totalXP?: number;
        phasesCompleted?: number;
        phasesFailed?: number;
        [key: string]: unknown;
    };
    /** Error details if success is false */
    error?: {
        code: string;
        message: string;
        stack?: string;
    };
}
/**
 * Options for configuring coding pipeline hook behavior.
 * Controls phase execution, checkpointing, and dry-run mode.
 */
export interface ICodingPipelineHookOptions {
    /** Start from specific phase (1-7). Default: 1 */
    startPhase?: number;
    /** End at specific phase (1-7). Default: 7 */
    endPhase?: number;
    /** Skip phases that have checkpoints. Default: false */
    resumeFromCheckpoint?: boolean;
    /** Dry run without execution. Default: false */
    dryRun?: boolean;
}
/**
 * Pre-execution hook for /god-code command.
 *
 * Initializes pipeline state and stores initial context in memory.
 * This hook runs BEFORE the coding pipeline begins execution.
 *
 * @param context - Hook context containing command info and args
 * @param options - Pipeline configuration options
 * @returns Hook result with pipeline ID and configuration
 *
 * @example
 * ```typescript
 * const result = await preCodeHook(
 *   { command: '/god-code', args: { task: 'Build REST API' }, timestamp: new Date().toISOString() },
 *   { startPhase: 1, endPhase: 7 }
 * );
 * console.log(result.context?.pipelineId); // e.g., '123e4567-e89b-12d3-a456-426614174000'
 * ```
 */
export declare function preCodeHook(context: IHookContext, options?: ICodingPipelineHookOptions): Promise<IHookResult>;
/**
 * Post-execution hook for /god-code command.
 *
 * Aggregates XP from all phases, updates final pipeline state, and stores metrics.
 * This hook runs AFTER the coding pipeline completes execution.
 *
 * @param context - Hook context containing command info and args
 * @param result - Result from the pipeline execution (unused but available for future use)
 * @returns Hook result with aggregated metrics
 *
 * @example
 * ```typescript
 * const result = await postCodeHook(
 *   { command: '/god-code', args: { task: 'Build REST API' }, timestamp: new Date().toISOString() },
 *   { success: true }
 * );
 * console.log(result.metrics?.totalXP); // e.g., 350
 * ```
 */
export declare function postCodeHook(context: IHookContext, result: unknown): Promise<IHookResult>;
/**
 * Update pipeline phase status during execution.
 * Called by the pipeline orchestrator as phases complete.
 *
 * @param phase - Phase number (1-7)
 * @param status - 'completed' or 'failed'
 * @param xpEarned - XP earned in this phase (if completed)
 */
export declare function updatePhaseStatus(phase: number, status: 'completed' | 'failed', xpEarned?: number): Promise<void>;
/**
 * Create a checkpoint for the current phase.
 * Enables resume functionality if pipeline is interrupted.
 *
 * @param phase - Phase number to checkpoint
 * @param data - Checkpoint data to store
 */
export declare function createCheckpoint(phase: number, data: unknown): Promise<void>;
//# sourceMappingURL=coding-pipeline-hook.d.ts.map