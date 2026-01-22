/**
 * Coding Pipeline Phase Executor
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * Handles:
 * - Agent execution via IStepExecutor injection
 * - Timeout management for agent operations
 * - Learning feedback via SonaEngine/ReasoningBank
 * - Memory leak prevention (MEM-002 fix)
 */
import type { CodingPipelinePhase, CodingPipelineAgent, IAgentMapping } from './types.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { IRlmContext } from '../learning/sona-types.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
/**
 * Interface for executing individual pipeline steps/agents
 * Must be injected via IOrchestratorConfig.stepExecutor
 */
export interface IStepExecutor {
    execute(agentKey: CodingPipelineAgent, prompt: string, timeoutMs: number): Promise<{
        output: unknown;
        quality: number;
        duration: number;
    }>;
}
/**
 * Dependencies required for phase execution
 */
export interface IPhaseExecutorDependencies {
    sonaEngine?: SonaEngine;
    reasoningBank?: ReasoningBank;
}
/**
 * Configuration for execution order resolution
 */
export interface IExecutionOrderConfig {
    /** Enable parallel execution of independent agents */
    enableParallelExecution: boolean;
    /** Maximum agents to run in parallel (MEM-002 bounded) */
    maxParallelAgents: number;
}
/**
 * Trim execution results map to prevent unbounded memory growth
 * Uses FIFO (oldest entries removed first) pruning strategy
 *
 * CRITICAL: This function MUST be called after each agent execution
 * to prevent memory leaks in long-running pipelines
 *
 * @param executionResults - Map to trim (mutated in place)
 * @param log - Logging function
 */
export declare function trimExecutionResults(executionResults: Map<CodingPipelineAgent, unknown>, log: (message: string) => void): void;
/**
 * Execute an agent using the injected step executor with timeout protection
 *
 * @param stepExecutor - Injected executor (REQUIRED in production)
 * @param agentKey - Agent identifier
 * @param prompt - Prompt to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Execution result with output, quality score, and duration
 * @throws Error if no stepExecutor provided (production safety guard)
 */
export declare function executeWithStepExecutor(stepExecutor: IStepExecutor | undefined, agentKey: CodingPipelineAgent, prompt: string, timeoutMs: number): Promise<{
    output: unknown;
    quality: number;
    duration: number;
}>;
/**
 * Create a timeout promise that rejects after the specified duration
 *
 * @param agentKey - Agent identifier for error message
 * @param timeout - Timeout duration in milliseconds
 * @returns Promise that always rejects with timeout error
 */
export declare function createTimeoutPromise(agentKey: CodingPipelineAgent, timeout: number): Promise<never>;
/**
 * Provide feedback for a single step/agent execution
 * Uses SonaEngine as primary, ReasoningBank as fallback
 *
 * @param dependencies - SonaEngine and ReasoningBank instances
 * @param trajectoryId - Learning trajectory identifier
 * @param quality - Quality score (0.0 - 1.0)
 * @param agentKey - Agent that was executed
 * @param phase - Pipeline phase
 * @param rlmContext - Optional RLM context for advanced learning
 * @param log - Logging function
 */
export declare function provideStepFeedback(dependencies: IPhaseExecutorDependencies, trajectoryId: string, quality: number, agentKey: CodingPipelineAgent, phase: CodingPipelinePhase, rlmContext: IRlmContext | undefined, log: (message: string) => void): Promise<void>;
/**
 * Provide feedback for overall pipeline execution
 * Used at pipeline completion or failure
 *
 * @param dependencies - SonaEngine and ReasoningBank instances
 * @param trajectoryId - Learning trajectory identifier
 * @param quality - Overall quality score (0.0 - 1.0)
 * @param status - Pipeline completion status
 * @param errorMessage - Error message if status is 'failed'
 * @param log - Logging function
 */
export declare function providePipelineFeedback(dependencies: IPhaseExecutorDependencies, trajectoryId: string, quality: number, status: 'completed' | 'failed', errorMessage: string | undefined, log: (message: string) => void): Promise<void>;
/**
 * Resolve execution order using topological sort based on agent dependencies
 *
 * Agents are sorted by:
 * 1. Dependency relationships (dependsOn field)
 * 2. Priority (lower number = higher priority)
 *
 * @param agents - Array of agent mappings to sort
 * @returns Agents in correct execution order (dependencies first)
 */
export declare function resolveExecutionOrder(agents: IAgentMapping[]): IAgentMapping[];
/**
 * Batch agents for parallel execution while respecting dependencies
 *
 * Creates batches where:
 * - Agents in the same batch have no dependencies on each other
 * - All dependencies are satisfied by previous batches
 * - Batch size is bounded by maxParallelAgents (MEM-002 compliance)
 *
 * @param agents - Pre-sorted agents (use resolveExecutionOrder first)
 * @param config - Execution configuration with parallel settings
 * @returns Array of batches, each containing agents that can run in parallel
 */
export declare function batchAgentsForExecution(agents: IAgentMapping[], config: IExecutionOrderConfig): IAgentMapping[][];
//# sourceMappingURL=coding-phase-executor.d.ts.map