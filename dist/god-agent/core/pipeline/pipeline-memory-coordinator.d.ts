/**
 * DAI-002: Pipeline Memory Coordinator
 * TASK-004: Handles memory operations for pipeline execution
 *
 * RULE-005: Mandatory Memory Coordination
 * - Every agent in a pipeline MUST coordinate through God Agent's memory systems
 * - Uses InteractionStore (NOT claude-flow) for storage/retrieval
 * - Outputs stored BEFORE next agent starts
 *
 * Memory Operations:
 * 1. storeStepOutput() - Store agent output after step completion
 * 2. retrievePreviousOutput() - Retrieve previous agent's output
 * 3. clearPipelineData() - Clean up after pipeline completion (optional)
 */
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { KnowledgeEntry } from '../../universal/universal-agent.js';
import type { IPipelineStep, IPipelineStepStorage } from './dai-002-types.js';
import type { CodingPipelinePhase, IPipelineDAG } from './types.js';
/**
 * Memory namespace constants for the 40-agent coding pipeline.
 * Aligns with TASK-HOOK-001 specification.
 */
export declare const CODING_NAMESPACES: {
    /** Root namespace for all coding pipeline data */
    readonly ROOT: "coding";
    /** Context namespace - pre-pipeline initialization */
    readonly CONTEXT: {
        readonly ROOT: "coding/context";
        readonly TASK: "coding/context/task";
        readonly REQUIREMENTS: "coding/context/requirements";
        readonly CONSTRAINTS: "coding/context/constraints";
    };
    /** Pipeline namespace - runtime state */
    readonly PIPELINE: {
        readonly ROOT: "coding/pipeline";
        readonly STATE: "coding/pipeline/state";
        readonly DAG: "coding/pipeline/dag";
        readonly CHECKPOINTS: "coding/pipeline/checkpoints";
        readonly CONFIG: "coding/pipeline/config";
    };
    /** XP namespace - experience points tracking */
    readonly XP: {
        readonly ROOT: "coding/xp";
        readonly TOTAL: "coding/xp/total";
        /** Generate phase-specific key */
        readonly phase: (phase: CodingPipelinePhase) => string;
    };
    /** Phase-specific output namespaces */
    readonly PHASES: {
        readonly understanding: "coding/understanding";
        readonly exploration: "coding/exploration";
        readonly architecture: "coding/architecture";
        readonly implementation: "coding/implementation";
        readonly testing: "coding/testing";
        readonly optimization: "coding/optimization";
        readonly delivery: "coding/delivery";
    };
};
/**
 * Task context stored before pipeline execution
 */
export interface ITaskContext {
    /** User's task description */
    description: string;
    /** Timestamp of initialization */
    timestamp: string;
    /** Current status */
    status: 'initialized' | 'in_progress' | 'completed' | 'failed';
    /** Optional hook options */
    options?: {
        startPhase?: number;
        endPhase?: number;
        resumeFromCheckpoint?: boolean;
    };
}
/**
 * Extracted requirements from task analysis
 */
export interface IRequirementsContext {
    /** Functional requirements */
    functional: string[];
    /** Non-functional requirements */
    nonfunctional: string[];
    /** Identified constraints */
    constraints: string[];
    /** Whether extraction is complete */
    extracted: boolean;
    /** Timestamp of extraction */
    timestamp?: string;
}
/**
 * Pipeline execution state
 */
export interface IPipelineState {
    /** Current phase (1-7) */
    currentPhase: number;
    /** Completed phase names */
    completedPhases: CodingPipelinePhase[];
    /** Failed phase names (if any) */
    failedPhases: CodingPipelinePhase[];
    /** Pipeline start time */
    startTime: string;
    /** Pipeline end time (when completed) */
    endTime?: string;
    /** Current status */
    status?: 'running' | 'completed' | 'failed' | 'paused';
    /** Total XP earned */
    totalXP?: number;
    /** Checkpoint IDs created */
    checkpoints: string[];
}
/**
 * Checkpoint data for rollback support
 */
export interface ICheckpointData {
    /** Unique checkpoint ID */
    id: string;
    /** Phase at checkpoint */
    phase: CodingPipelinePhase;
    /** State snapshot */
    state: IPipelineState;
    /** Timestamp */
    timestamp: string;
    /** Memory keys preserved */
    preservedKeys: string[];
}
/**
 * XP tracking for a phase
 */
export interface IPhaseXP {
    /** Phase name */
    phase: CodingPipelinePhase;
    /** XP earned in this phase */
    xp: number;
    /** Agents that contributed */
    agentContributions: Array<{
        agentKey: string;
        xp: number;
    }>;
    /** Timestamp */
    timestamp: string;
}
/**
 * Configuration for memory operations
 */
export interface IMemoryCoordinatorConfig {
    /** Quality score for stored knowledge (0-1) */
    defaultQuality?: number;
    /** Whether to log memory operations */
    verbose?: boolean;
}
/**
 * Result of a storage operation
 */
export interface IStoreResult {
    /** Knowledge entry ID */
    entryId: string;
    /** Domain where stored */
    domain: string;
    /** Tags used */
    tags: string[];
    /** Timestamp of storage */
    timestamp: number;
}
/**
 * Result of a retrieval operation
 */
export interface IRetrieveResult {
    /** Found knowledge entries */
    entries: KnowledgeEntry[];
    /** Parsed output data if available */
    output?: unknown;
    /** Pipeline step storage metadata if available */
    stepData?: IPipelineStepStorage;
}
/**
 * Coordinates memory operations for pipeline execution.
 * Stores and retrieves agent outputs via InteractionStore.
 *
 * @example
 * ```typescript
 * const coordinator = new PipelineMemoryCoordinator(interactionStore);
 *
 * // Store output after agent completes
 * await coordinator.storeStepOutput(step, 0, 'pip_123', agentOutput, 'backend-dev');
 *
 * // Retrieve for next agent
 * const previous = coordinator.retrievePreviousOutput(nextStep, 'pip_123');
 * ```
 */
export declare class PipelineMemoryCoordinator {
    private readonly interactionStore;
    private readonly config;
    /**
     * Create a new memory coordinator
     * @param interactionStore - The InteractionStore instance for storage
     * @param config - Optional configuration
     */
    constructor(interactionStore: InteractionStore, config?: IMemoryCoordinatorConfig);
    /**
     * Store agent output after step completion.
     *
     * CRITICAL: This MUST be called BEFORE the next agent starts (RULE-005).
     *
     * @param step - The pipeline step that completed
     * @param stepIndex - Index of the step (0-based)
     * @param pipelineId - Unique pipeline execution ID
     * @param output - Agent's output to store
     * @param agentKey - Key of the agent that executed
     * @returns Storage result with entry ID
     * @throws MemoryCoordinationError if storage fails
     */
    storeStepOutput(step: IPipelineStep, stepIndex: number, pipelineId: string, output: unknown, agentKey: string): IStoreResult;
    /**
     * Retrieve previous agent's output for a step.
     *
     * @param step - The current step that needs previous output
     * @param pipelineId - Unique pipeline execution ID
     * @returns Retrieved data (may be empty if first agent or no matches)
     * @throws MemoryCoordinationError if retrieval fails unexpectedly
     */
    retrievePreviousOutput(step: IPipelineStep, pipelineId: string): IRetrieveResult;
    /**
     * Retrieve output from a specific step by index.
     *
     * @param pipelineId - Pipeline execution ID
     * @param stepIndex - Step index to retrieve
     * @param domain - Domain where output was stored
     * @returns Retrieved data
     */
    retrieveStepOutput(pipelineId: string, stepIndex: number, domain: string): IRetrieveResult;
    /**
     * Get all outputs from a pipeline execution.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns All stored outputs for this pipeline
     */
    getAllPipelineOutputs(pipelineId: string): KnowledgeEntry[];
    /**
     * Check if previous output exists for a step.
     *
     * @param step - The step to check
     * @param pipelineId - Pipeline execution ID
     * @returns True if previous output is available
     */
    hasPreviousOutput(step: IPipelineStep, pipelineId: string): boolean;
    /**
     * Generate a unique entry ID for a pipeline step output.
     */
    private generateEntryId;
    /**
     * Store initial task context from hook initialization.
     *
     * Called by pre-execution hook (TASK-HOOK-001) to store the task
     * description and options before pipeline execution begins.
     *
     * @param pipelineId - Unique pipeline execution ID
     * @param context - Task context from hook
     * @returns Storage result
     */
    storeTaskContext(pipelineId: string, context: ITaskContext): IStoreResult;
    /**
     * Retrieve task context for a pipeline.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns Task context or undefined if not found
     */
    retrieveTaskContext(pipelineId: string): ITaskContext | undefined;
    /**
     * Store extracted requirements from Phase 1 agents.
     *
     * @param pipelineId - Pipeline execution ID
     * @param requirements - Extracted requirements
     * @returns Storage result
     */
    storeRequirements(pipelineId: string, requirements: IRequirementsContext): IStoreResult;
    /**
     * Store or update pipeline execution state.
     *
     * Called by orchestrator to track current phase, completed phases,
     * and overall pipeline status.
     *
     * @param pipelineId - Pipeline execution ID
     * @param state - Current pipeline state
     * @returns Storage result
     */
    storePipelineState(pipelineId: string, state: IPipelineState): IStoreResult;
    /**
     * Retrieve latest pipeline state.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns Latest pipeline state or undefined
     */
    retrievePipelineState(pipelineId: string): IPipelineState | undefined;
    /**
     * Store DAG configuration for a pipeline.
     *
     * @param pipelineId - Pipeline execution ID
     * @param dag - Pipeline DAG structure
     * @returns Storage result
     */
    storeDAG(pipelineId: string, dag: IPipelineDAG): IStoreResult;
    /**
     * Create a checkpoint at the end of a phase.
     *
     * Checkpoints allow rollback if subsequent phases fail.
     * Per SPEC-001, checkpoints are created for phases 1-5.
     *
     * @param pipelineId - Pipeline execution ID
     * @param phase - Phase being checkpointed
     * @param state - Current pipeline state
     * @returns Checkpoint data with ID
     */
    createCheckpoint(pipelineId: string, phase: CodingPipelinePhase, state: IPipelineState): ICheckpointData;
    /**
     * Retrieve a checkpoint for potential rollback.
     *
     * @param pipelineId - Pipeline execution ID
     * @param phase - Phase to retrieve checkpoint for
     * @returns Checkpoint data or undefined
     */
    retrieveCheckpoint(pipelineId: string, phase: CodingPipelinePhase): ICheckpointData | undefined;
    /**
     * List all checkpoints for a pipeline.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns Array of checkpoint data
     */
    listCheckpoints(pipelineId: string): ICheckpointData[];
    /**
     * Collect all memory keys associated with a pipeline.
     * Used for checkpoint preservation.
     */
    private collectPipelineKeys;
    /**
     * Store XP earned for a phase.
     *
     * Called by orchestrator after phase completion to track
     * XP contributions from each agent.
     *
     * @param pipelineId - Pipeline execution ID
     * @param phaseXP - Phase XP data with agent contributions
     * @returns Storage result
     */
    storePhaseXP(pipelineId: string, phaseXP: IPhaseXP): IStoreResult;
    /**
     * Retrieve XP for a specific phase.
     *
     * @param pipelineId - Pipeline execution ID
     * @param phase - Phase to retrieve XP for
     * @returns Phase XP data or undefined
     */
    retrievePhaseXP(pipelineId: string, phase: CodingPipelinePhase): IPhaseXP | undefined;
    /**
     * Aggregate and store total XP for a pipeline.
     *
     * Called by post-execution hook to calculate final XP.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns Total XP across all phases
     */
    aggregateTotalXP(pipelineId: string): number;
    /**
     * Retrieve total XP for a pipeline.
     *
     * @param pipelineId - Pipeline execution ID
     * @returns Total XP or 0 if not found
     */
    retrieveTotalXP(pipelineId: string): number;
}
/**
 * Create a PipelineMemoryCoordinator with given InteractionStore
 * @param interactionStore - Initialized InteractionStore
 * @param config - Optional configuration
 * @returns PipelineMemoryCoordinator instance
 */
export declare function createPipelineMemoryCoordinator(interactionStore: InteractionStore, config?: IMemoryCoordinatorConfig): PipelineMemoryCoordinator;
//# sourceMappingURL=pipeline-memory-coordinator.d.ts.map