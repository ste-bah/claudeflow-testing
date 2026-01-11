/**
 * DAI-002: Pipeline Executor
 * TASK-005: Core execution engine for multi-agent sequential pipelines
 *
 * RULE-004: Sequential Execution (99.9% Rule)
 * - Agents execute ONE AT A TIME
 * - NEVER use Promise.all() for agent execution
 * - Each step completes before next begins
 *
 * RULE-005: Mandatory Memory Coordination
 * - Every agent coordinates through InteractionStore
 * - Outputs stored BEFORE next agent starts
 *
 * RULE-006: DAI-001 Integration
 * - Use AgentSelector when taskDescription provided instead of agentKey
 *
 * RULE-007: Forward-Looking Prompts
 * - Each agent knows its position, previous, and next in pipeline
 */
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { AgentSelector } from '../agents/agent-selector.js';
import type { InteractionStore } from '../../universal/interaction-store.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { IPipelineDefinition, IPipelineOptions, IPipelineResult, PipelineEventHandler } from './dai-002-types.js';
/**
 * Configuration for PipelineExecutor
 */
export interface IPipelineExecutorConfig {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Event handler for pipeline lifecycle events */
    onEvent?: PipelineEventHandler;
    /** Whether to provide feedback to ReasoningBank after steps */
    enableLearning?: boolean;
    /** Custom step executor function (for testing or custom execution) */
    stepExecutor?: IStepExecutor;
}
/**
 * Interface for step execution function.
 * This allows injection of custom execution logic (e.g., for testing).
 */
export interface IStepExecutor {
    execute(agentKey: string, prompt: string, timeout: number): Promise<IStepExecutionResult>;
}
/**
 * Result from step executor
 */
export interface IStepExecutionResult {
    output: unknown;
    quality: number;
    duration: number;
}
/**
 * Executes multi-agent sequential pipelines.
 * Implements DAI-002 specification with RULE-004 sequential execution.
 *
 * @example
 * ```typescript
 * const executor = new PipelineExecutor({
 *   agentRegistry,
 *   agentSelector,
 *   interactionStore,
 *   reasoningBank,
 * });
 *
 * const result = await executor.execute(pipeline, {
 *   verbose: true,
 *   input: initialData,
 * });
 * ```
 */
export declare class PipelineExecutor {
    private readonly dependencies;
    private readonly validator;
    private readonly promptBuilder;
    private readonly memoryCoordinator;
    private readonly config;
    /**
     * Create a new PipelineExecutor
     *
     * @param dependencies - Required dependencies
     * @param config - Optional configuration
     */
    constructor(dependencies: {
        agentRegistry: AgentRegistry;
        agentSelector: AgentSelector;
        interactionStore: InteractionStore;
        reasoningBank?: ReasoningBank;
    }, config?: IPipelineExecutorConfig);
    /**
     * Execute a pipeline sequentially.
     * CRITICAL: Steps execute ONE AT A TIME (RULE-004).
     *
     * @param pipeline - Pipeline definition to execute
     * @param options - Execution options
     * @returns Pipeline execution result
     * @throws PipelineDefinitionError if pipeline is invalid
     * @throws PipelineExecutionError if execution fails
     * @throws PipelineTimeoutError if timeout exceeded
     * @throws QualityGateError if quality threshold not met
     */
    execute(pipeline: IPipelineDefinition, options?: IPipelineOptions): Promise<IPipelineResult>;
    /**
     * Execute a single pipeline step.
     * Private method - handles agent selection, execution, memory storage.
     */
    private executeStep;
    /**
     * Execute agent with timeout enforcement.
     */
    private executeWithTimeout;
    /**
     * Default execution implementation.
     * PRODUCTION-READY: Throws error requiring stepExecutor injection.
     *
     * This method is called when no stepExecutor is provided via config.
     * In production, you MUST provide a stepExecutor that integrates with
     * Claude Code's Task() tool or another agent execution mechanism.
     *
     * @throws PipelineExecutionError - Always throws, requiring explicit executor injection
     */
    private defaultExecute;
    /**
     * Create a timeout promise that rejects with PipelineTimeoutError.
     */
    private createTimeoutPromise;
    /**
     * Assess output quality.
     * Uses provided quality or estimates based on output structure.
     */
    private assessQuality;
    /**
     * Provide feedback to ReasoningBank for a step.
     */
    private provideStepFeedback;
    /**
     * Provide feedback to ReasoningBank for the entire pipeline.
     */
    private providePipelineFeedback;
    /**
     * Emit a pipeline event if handler configured.
     */
    private emitEvent;
    /**
     * Log a message if verbose mode enabled.
     */
    private log;
}
/**
 * Create a PipelineExecutor with required dependencies.
 *
 * @param dependencies - Required dependencies
 * @param config - Optional configuration
 * @returns PipelineExecutor instance
 */
export declare function createPipelineExecutor(dependencies: {
    agentRegistry: AgentRegistry;
    agentSelector: AgentSelector;
    interactionStore: InteractionStore;
    reasoningBank?: ReasoningBank;
}, config?: IPipelineExecutorConfig): PipelineExecutor;
//# sourceMappingURL=pipeline-executor.d.ts.map