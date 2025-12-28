/**
 * Task Executor
 * TASK-003: DAI-001 Core Layer
 *
 * Executes selected agent via Task() abstraction.
 * Handles prompt building, execution, and result handling.
 *
 * Per constitution.md:
 * - RULE-003: MUST throw AgentExecutionError with full context on failure
 * - RULE-005: MUST use agent definitions from AgentRegistry
 */
import type { ILoadedAgentDefinition } from './agent-types.js';
/**
 * Task execution options
 */
export interface ITaskExecutionOptions {
    /** Additional context to inject into prompt */
    context?: string;
    /** Timeout in milliseconds (default: 120000 - 2 minutes) */
    timeout?: number;
    /** Whether to store result in InteractionStore (default: true) */
    storeResult?: boolean;
    /** Memory domain for storage */
    memoryDomain?: string;
    /** Tags for memory storage */
    memoryTags?: string[];
}
/**
 * Task execution result
 */
export interface ITaskExecutionResult {
    /** Agent that executed the task */
    agent: ILoadedAgentDefinition;
    /** Original task */
    task: string;
    /** Task output */
    output: string;
    /** Execution duration in ms */
    duration: number;
    /** Whether execution succeeded */
    success: boolean;
    /** Error if execution failed */
    error?: Error;
    /** Timestamp of execution */
    executedAt: number;
}
/**
 * Task execution function type
 * This is the interface for the actual Task() execution
 */
export type TaskExecutionFunction = (agentType: string, prompt: string, options?: {
    timeout?: number;
}) => Promise<string>;
/**
 * TaskExecutor
 *
 * Wraps Task() execution with prompt building and error handling.
 * This is an abstraction layer that doesn't directly call Claude Code's Task()
 * but provides the interface for UniversalAgent to do so.
 */
export declare class TaskExecutor {
    private verbose;
    private defaultTimeout;
    constructor(options?: {
        verbose?: boolean;
        defaultTimeout?: number;
    });
    /**
     * Execute task with selected agent
     *
     * NOTE: This method builds the prompt and handles the result.
     * The actual Task() execution is delegated to the caller (UniversalAgent)
     * via the executeTask callback.
     *
     * @throws AgentExecutionError if execution fails
     */
    execute(agent: ILoadedAgentDefinition, task: string, executeTask: TaskExecutionFunction, options?: ITaskExecutionOptions): Promise<ITaskExecutionResult>;
    /**
     * Build Task() prompt from agent definition and task
     *
     * The prompt structure:
     * 1. Agent prompt content (from .md file)
     * 2. Memory context (if provided)
     * 3. User task
     */
    buildPrompt(agent: ILoadedAgentDefinition, task: string, context?: string): string;
    /**
     * Validate that an agent definition has the minimum required fields
     * for execution.
     */
    validateAgent(agent: ILoadedAgentDefinition): {
        valid: boolean;
        issues: string[];
    };
    /**
     * Estimate token count for a prompt
     * (Rough estimate: ~4 characters per token)
     */
    estimateTokens(prompt: string): number;
    /**
     * Create a summary of the execution for logging/storage
     */
    createExecutionSummary(result: ITaskExecutionResult): string;
}
//# sourceMappingURL=task-executor.d.ts.map