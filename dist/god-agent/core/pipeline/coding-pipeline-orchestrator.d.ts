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
import type { CodingPipelinePhase, CodingPipelineAgent, IPipelineDAG, IPipelineExecutionConfig, IAgentExecutionResult, IPipelineExecutionResult } from './types.js';
/**
 * Configuration for the pipeline orchestrator
 */
export interface IOrchestratorConfig {
    /** Maximum time for a single agent execution (ms) */
    agentTimeoutMs: number;
    /** Maximum time for a full phase execution (ms) */
    phaseTimeoutMs: number;
    /** Enable checkpoint creation for rollback */
    enableCheckpoints: boolean;
    /** Enable parallel execution of parallelizable agents */
    enableParallelExecution: boolean;
    /** Maximum agents to run in parallel within a phase */
    maxParallelAgents: number;
    /** Memory namespace for coordination */
    memoryNamespace: string;
    /** Path to agent markdown files */
    agentMdPath: string;
    /** Enable verbose logging */
    verbose: boolean;
}
/**
 * Default orchestrator configuration
 */
export declare const DEFAULT_ORCHESTRATOR_CONFIG: IOrchestratorConfig;
interface ICheckpoint {
    phase: CodingPipelinePhase;
    timestamp: string;
    memorySnapshot: Record<string, unknown>;
    completedAgents: CodingPipelineAgent[];
    totalXP: number;
}
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
    private config;
    private dag;
    private checkpoints;
    private executionResults;
    private totalXP;
    constructor(config?: Partial<IOrchestratorConfig>);
    /**
     * Execute the full coding pipeline
     *
     * @param pipelineConfig - Pipeline configuration from prepareCodeTask()
     * @returns Complete pipeline execution result
     */
    execute(pipelineConfig: IPipelineExecutionConfig): Promise<IPipelineExecutionResult>;
    /**
     * Execute a single phase of the pipeline
     */
    private executePhase;
    /**
     * Execute a single agent using ClaudeFlow subagent spawning
     */
    private executeAgent;
    /**
     * Execute agent using ClaudeFlow Task tool subprocess
     *
     * This replaces the mock implementation with actual ClaudeFlow integration.
     * Uses npx claude-flow task_orchestrate for subagent execution.
     */
    private runAgentWithClaudeFlow;
    /**
     * Build ClaudeFlow prompt with mandatory 4-part context
     */
    private buildClaudeFlowPrompt;
    /**
     * Resolve execution order for agents within a phase
     * Uses topological sort based on dependencies
     */
    private resolveExecutionOrder;
    /**
     * Batch agents for parallel execution where allowed
     */
    private batchAgentsForExecution;
    /**
     * Create a checkpoint at the current phase
     */
    private createCheckpoint;
    /**
     * Rollback to the last successful checkpoint
     */
    private rollbackToLastCheckpoint;
    /**
     * Store value in ClaudeFlow memory
     */
    private storeMemory;
    /**
     * Retrieve memory context for agent execution
     */
    private retrieveMemoryContext;
    /**
     * Load agent markdown file if it exists
     */
    private loadAgentMarkdown;
    /**
     * Check if agent is critical (halts pipeline on failure)
     */
    private isCriticalAgent;
    /**
     * Log message if verbose mode enabled
     */
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
    getCheckpoints(): Map<CodingPipelinePhase, ICheckpoint>;
    /**
     * Get the DAG
     */
    getDAG(): IPipelineDAG;
}
/**
 * Create a new CodingPipelineOrchestrator instance
 */
export declare function createOrchestrator(config?: Partial<IOrchestratorConfig>): CodingPipelineOrchestrator;
/**
 * Execute a coding pipeline with default configuration
 */
export declare function executePipeline(pipelineConfig: IPipelineExecutionConfig, orchestratorConfig?: Partial<IOrchestratorConfig>): Promise<IPipelineExecutionResult>;
export {};
//# sourceMappingURL=coding-pipeline-orchestrator.d.ts.map