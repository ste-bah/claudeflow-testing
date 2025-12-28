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
}
/**
 * Create a PipelineMemoryCoordinator with given InteractionStore
 * @param interactionStore - Initialized InteractionStore
 * @param config - Optional configuration
 * @returns PipelineMemoryCoordinator instance
 */
export declare function createPipelineMemoryCoordinator(interactionStore: InteractionStore, config?: IMemoryCoordinatorConfig): PipelineMemoryCoordinator;
//# sourceMappingURL=pipeline-memory-coordinator.d.ts.map