/**
 * Coding Pipeline Checkpoint Manager
 *
 * Manages checkpoint creation, rollback, and trimming for the /god-code coding pipeline.
 * Extracted from CodingPipelineOrchestrator for single-responsibility compliance.
 *
 * @module src/god-agent/core/pipeline/coding-checkpoint-manager
 * @see CONSTITUTION.md - CON-002 (< 500 lines), TS-004 (Zod), ERR-002 (typed errors)
 * @pipelineType coding
 */
import { z } from 'zod';
import type { CodingPipelinePhase, CodingPipelineAgent } from './types.js';
/** Error codes for checkpoint operations */
export type CheckpointErrorCode = 'CREATE_FAILED' | 'ROLLBACK_FAILED' | 'INVALID_CHECKPOINT';
/**
 * Typed error for checkpoint operations.
 * ERR-002 compliant with specific error codes.
 */
export declare class CheckpointError extends Error {
    readonly code: CheckpointErrorCode;
    readonly phase?: CodingPipelinePhase | undefined;
    constructor(code: CheckpointErrorCode, message: string, phase?: CodingPipelinePhase | undefined);
}
/** Zod schema for checkpoint configuration */
export declare const CheckpointConfigSchema: z.ZodObject<{
    /** Enable verbose logging */
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    /** Maximum checkpoints to retain (1-100) */
    maxCheckpoints: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    maxCheckpoints: number;
}, {
    verbose?: boolean | undefined;
    maxCheckpoints?: number | undefined;
}>;
/** Inferred type from Zod schema */
export type ICheckpointConfig = z.infer<typeof CheckpointConfigSchema>;
/**
 * Represents a pipeline execution checkpoint for rollback support.
 */
export interface ICheckpoint {
    /** Phase at which checkpoint was created */
    phase: CodingPipelinePhase;
    /** Unix timestamp of checkpoint creation */
    timestamp: number;
    /** Execution results at checkpoint time */
    executionResults: Map<CodingPipelineAgent, unknown>;
    /** Agents completed at checkpoint time */
    completedAgents: Set<CodingPipelineAgent>;
}
/**
 * Creates a checkpoint at the current pipeline state.
 *
 * @param phase - Current phase being checkpointed
 * @param executionResults - Map of agent results to snapshot
 * @param completedAgents - Set of completed agents to snapshot
 * @param log - Logging function for verbose output
 * @param config - Optional checkpoint configuration
 * @returns New checkpoint containing snapshotted state
 * @throws {CheckpointError} If checkpoint creation fails
 */
export declare function createCheckpoint(phase: CodingPipelinePhase, executionResults: Map<CodingPipelineAgent, unknown>, completedAgents: Set<CodingPipelineAgent>, log: (message: string) => void, config?: ICheckpointConfig): ICheckpoint;
/**
 * Rolls back to the last checkpoint in the stack.
 *
 * @param checkpoints - Array of checkpoints to roll back from
 * @param log - Logging function for verbose output
 * @param config - Optional checkpoint configuration
 * @returns Restored state or null if no checkpoints exist
 * @throws {CheckpointError} If rollback fails
 */
export declare function rollbackToLastCheckpoint(checkpoints: ICheckpoint[], log: (message: string) => void, config?: ICheckpointConfig): {
    phase: CodingPipelinePhase;
    executionResults: Map<CodingPipelineAgent, unknown>;
    completedAgents: Set<CodingPipelineAgent>;
} | null;
/**
 * Trims the checkpoint array to maintain maximum checkpoint limit.
 * Removes oldest checkpoints first (FIFO).
 *
 * @param checkpoints - Array of checkpoints to trim (mutated in place)
 * @param maxCheckpoints - Maximum number of checkpoints to retain
 * @param log - Logging function for verbose output
 */
export declare function trimCheckpoints(checkpoints: ICheckpoint[], maxCheckpoints: number, log: (message: string) => void): void;
//# sourceMappingURL=coding-checkpoint-manager.d.ts.map