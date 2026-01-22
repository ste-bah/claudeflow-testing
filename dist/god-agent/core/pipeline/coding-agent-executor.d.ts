/**
 * Coding Pipeline Agent Executor
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * Handles:
 * - Individual agent execution with LEANN/RLM integration
 * - Phase execution with batching and dependency ordering
 * - Memory coordination and observability
 *
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/coding-agent-executor
 * @see TASK-ORCH-004-pipeline-orchestration.md
 */
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { LeannContextService } from './leann-context-service.js';
import type { PipelineMemoryCoordinator } from './pipeline-memory-coordinator.js';
import type { PipelinePromptBuilder } from './pipeline-prompt-builder.js';
import type { CodingPipelinePhase, CodingPipelineAgent, IAgentMapping, IAgentExecutionResult, IPhaseExecutionResult, IPipelineExecutionConfig } from './types.js';
import { type IStepExecutor } from './coding-phase-executor.js';
import type { IIntegratedValidationResult } from './sherlock-quality-gate-integration.js';
/**
 * Dependencies required for agent execution
 */
export interface IAgentExecutorDependencies {
    /** SonaEngine for learning feedback */
    sonaEngine?: SonaEngine;
    /** ReasoningBank for pattern storage */
    reasoningBank?: ReasoningBank;
    /** LEANN context service for semantic search */
    leannContextService?: LeannContextService;
    /** Pipeline memory coordinator */
    memoryCoordinator: PipelineMemoryCoordinator;
    /** Prompt builder for agent prompts */
    promptBuilder: PipelinePromptBuilder;
    /** Step executor for agent execution */
    stepExecutor?: IStepExecutor;
}
/**
 * Configuration for agent executor
 */
export interface IAgentExecutorConfig {
    /** Agent timeout in milliseconds */
    agentTimeoutMs: number;
    /** Memory namespace */
    memoryNamespace: string;
    /** Path to agent markdown files */
    agentMdPath: string;
    /** Enable learning feedback */
    enableLearning: boolean;
    /** Verbose logging */
    verbose: boolean;
    /** Enable parallel execution */
    enableParallelExecution: boolean;
    /** Maximum parallel agents */
    maxParallelAgents: number;
    /** Enable checkpoints */
    enableCheckpoints: boolean;
}
/**
 * State tracked during execution
 */
export interface IExecutionState {
    /** Results of executed agents */
    executionResults: Map<CodingPipelineAgent, IAgentExecutionResult>;
    /** Checkpoints for rollback */
    checkpoints: Map<CodingPipelinePhase, ICheckpointData>;
    /** Total XP earned */
    totalXP: number;
}
/**
 * Checkpoint data structure
 */
export interface ICheckpointData {
    phase: CodingPipelinePhase;
    timestamp: string;
    memorySnapshot: Record<string, unknown>;
    completedAgents: CodingPipelineAgent[];
    totalXP: number;
}
/**
 * Sherlock validator interface
 */
export interface ISherlockValidatorAdapter {
    validatePhase(phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult, retryCount: number): Promise<IIntegratedValidationResult | null>;
    handleGuiltyVerdict(validationResult: IIntegratedValidationResult, phase: CodingPipelinePhase): string[];
}
/**
 * Execute a single agent with LEANN semantic context and RLM memory handoffs.
 * Follows PipelineExecutor pattern for proper learning infrastructure integration.
 *
 * @param deps - Agent executor dependencies
 * @param config - Agent executor configuration
 * @param agentMapping - Agent mapping to execute
 * @param phase - Pipeline phase
 * @param pipelineId - Pipeline instance ID
 * @param state - Execution state (mutated)
 * @param log - Logging function
 * @returns Agent execution result
 */
export declare function executeAgent(deps: IAgentExecutorDependencies, config: IAgentExecutorConfig, agentMapping: IAgentMapping, phase: CodingPipelinePhase, pipelineId: string, state: IExecutionState, log: (message: string) => void): Promise<IAgentExecutionResult>;
/**
 * Execute a single phase of the pipeline.
 *
 * @param deps - Agent executor dependencies
 * @param config - Agent executor configuration
 * @param phase - Phase to execute
 * @param pipelineConfig - Pipeline configuration
 * @param pipelineId - Pipeline instance ID
 * @param state - Execution state (mutated)
 * @param getAgentsForPhase - Function to get agents for a phase
 * @param sherlockValidator - Optional Sherlock validator adapter
 * @param log - Logging function
 * @returns Phase execution result
 */
export declare function executePhase(deps: IAgentExecutorDependencies, config: IAgentExecutorConfig, phase: CodingPipelinePhase, pipelineConfig: IPipelineExecutionConfig, pipelineId: string, state: IExecutionState, getAgentsForPhase: (phase: CodingPipelinePhase) => Promise<IAgentMapping[]>, sherlockValidator: ISherlockValidatorAdapter | null, log: (message: string) => void): Promise<IPhaseExecutionResult>;
/**
 * Load agent markdown file if it exists
 */
export declare function loadAgentMarkdown(agentKey: CodingPipelineAgent, agentMdPath: string): string;
/**
 * Check if agent is critical (halts pipeline on failure)
 */
export declare function isCriticalAgent(agentKey: CodingPipelineAgent): boolean;
/**
 * Create a checkpoint at the current phase
 */
export declare function createCheckpoint(memoryCoordinator: PipelineMemoryCoordinator, memoryNamespace: string, phase: CodingPipelinePhase, state: IExecutionState, log: (message: string) => void): void;
/**
 * Rollback to the last successful checkpoint
 */
export declare function rollbackToLastCheckpoint(memoryCoordinator: PipelineMemoryCoordinator, memoryNamespace: string, state: IExecutionState, log: (message: string) => void): boolean;
//# sourceMappingURL=coding-agent-executor.d.ts.map