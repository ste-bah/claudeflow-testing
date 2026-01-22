/**
 * Coding Pipeline Orchestrator
 *
 * Executes the 40-agent, 7-phase coding pipeline with:
 * - DAG-based dependency resolution
 * - Checkpoint management for rollback
 * - XP tracking and aggregation
 * - ClaudeFlow subagent integration
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-orchestrator
 * @see TASK-ORCH-004-pipeline-orchestration.md
 * @see SPEC-001-architecture.md
 */
import { type ICheckpointData } from './coding-agent-executor.js';
import type { CodingPipelinePhase, CodingPipelineAgent, IPipelineDAG, IPipelineExecutionConfig, IAgentExecutionResult, IPipelineExecutionResult } from './types.js';
import type { IStepExecutor, IOrchestratorDependencies, IOrchestratorConfig } from './coding-pipeline-types.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from './coding-pipeline-constants.js';
/**
 * Orchestrates the 40-agent coding pipeline execution
 *
 * The orchestrator:
 * 1. Builds execution order from DAG
 * 2. Executes agents phase by phase
 * 3. Creates checkpoints for rollback
 * 4. Tracks XP and metrics
 * 5. Handles critical agent failures
 */
export declare class CodingPipelineOrchestrator {
    private readonly dependencies;
    private config;
    private dag;
    private executionState;
    private readonly validator;
    private readonly promptBuilder;
    private readonly memoryCoordinator;
    private readonly configLoader;
    private readonly integratedValidator;
    /**
     * Create a new CodingPipelineOrchestrator with dependency injection.
     *
     * @param dependencies - Required services for LEANN/RLM/Learning integration
     * @param config - Optional orchestrator configuration
     */
    constructor(dependencies: IOrchestratorDependencies, config?: Partial<IOrchestratorConfig>);
    /**
     * Execute the full coding pipeline
     *
     * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
     * @returns Complete pipeline execution result
     */
    execute(pipelineConfig: IPipelineExecutionConfig): Promise<IPipelineExecutionResult>;
    /**
     * Execute a single phase of the pipeline.
     * Wrapper that builds dependencies and delegates to extracted function.
     */
    private executePhaseWrapper;
    /** Build Sherlock wrapper dependencies for extracted functions */
    private getSherlockDeps;
    /** Validate phase with Sherlock-Quality Gate (delegates to factory function) */
    private validatePhaseWithSherlockWrapper;
    /** Handle GUILTY verdict (delegates to factory function) */
    private handleSherlockGuiltyVerdictWrapper;
    /**
     * Get agents for a phase from the dynamic loader.
     * Converts CodingAgentConfig to IAgentMapping for orchestrator compatibility.
     */
    private getAgentsForPhaseFromLoader;
    /**
     * Get agent markdown content from loaded config.
     * Falls back to file read if not in cache.
     */
    private getAgentMarkdownFromLoader;
    /** Log message if verbose mode enabled */
    private log;
    /**
     * Get current total XP
     */
    getTotalXP(): number;
    /**
     * Get all execution results
     */
    getExecutionResults(): Map<CodingPipelineAgent, IAgentExecutionResult>;
    /**
     * Get all checkpoints
     */
    getCheckpoints(): Map<CodingPipelinePhase, ICheckpointData>;
    /**
     * Get the DAG
     */
    getDAG(): IPipelineDAG;
}
/**
 * Create a new CodingPipelineOrchestrator instance with dependency injection.
 *
 * @param dependencies - Required services for LEANN/RLM/Learning integration
 * @param config - Optional orchestrator configuration
 */
export declare function createOrchestrator(dependencies: IOrchestratorDependencies, config?: Partial<IOrchestratorConfig>): CodingPipelineOrchestrator;
/**
 * Execute a coding pipeline with dependency injection.
 *
 * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
 * @param dependencies - Required services for LEANN/RLM/Learning integration
 * @param orchestratorConfig - Optional orchestrator configuration
 */
export declare function executePipeline(pipelineConfig: IPipelineExecutionConfig, dependencies: IOrchestratorDependencies, orchestratorConfig?: Partial<IOrchestratorConfig>): Promise<IPipelineExecutionResult>;
export type { IStepExecutor, IOrchestratorDependencies, IOrchestratorConfig };
export { DEFAULT_ORCHESTRATOR_CONFIG };
//# sourceMappingURL=coding-pipeline-orchestrator.d.ts.map