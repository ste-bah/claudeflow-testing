/**
 * PhD Pipeline Orchestrator
 * TASK-PHD-001 - 48-Agent PhD Pipeline
 *
 * Orchestrates execution of 48-agent PhD research pipeline:
 * - Phase-by-phase sequential execution
 * - Topological sort for agent ordering within phases
 * - Dependency tracking and input gathering
 * - Critical agent validation
 * - Integration with Shadow Vector tracking
 */
import { type IPipelineConfig, type IAgentConfig, type IPhaseConfig, type IPipelineState, type IPipelineProgress, type IAgentExecutionRecord, type AgentId } from './pipeline-types.js';
/**
 * Interface for executing agents (allows mocking in tests)
 */
export interface IAgentExecutor {
    /**
     * Execute an agent with given inputs
     */
    execute(agentKey: string, inputs: Record<string, unknown>, timeout: number): Promise<Record<string, unknown>>;
}
/**
 * Interface for shadow vector tracking
 */
export interface IShadowTracker {
    /**
     * Record agent execution
     */
    record(execution: IAgentExecutionRecord): Promise<void>;
}
/**
 * PhD Pipeline Orchestrator - manages 48-agent research pipeline
 */
export declare class PhDPipelineOrchestrator {
    private config;
    private executor;
    private tracker?;
    private state;
    private verbose;
    private socketClient;
    constructor(config: IPipelineConfig, executor: IAgentExecutor, options?: {
        tracker?: IShadowTracker;
        verbose?: boolean;
    });
    /**
     * Initialize socket client for observability events
     */
    private initSocketClient;
    /**
     * Emit event to observability daemon
     */
    private emitEvent;
    /**
     * Validate pipeline configuration
     */
    private validateConfig;
    /**
     * Validate dependency graph is a DAG (no cycles)
     */
    private validateDAG;
    /**
     * Execute the full pipeline
     */
    execute(problemStatement: string): Promise<IPipelineState>;
    /**
     * Execute a single phase
     */
    private executePhase;
    /**
     * Topological sort of agents within a phase
     */
    private topologicalSort;
    /**
     * Execute a single agent
     */
    private executeAgent;
    /**
     * Gather inputs from completed dependencies
     */
    private gatherInputs;
    /**
     * Validate critical agent produced expected outputs
     */
    private validateCriticalAgent;
    /**
     * Get current pipeline state
     */
    getState(): IPipelineState | null;
    /**
     * Get pipeline progress
     */
    getProgress(): IPipelineProgress | null;
    /**
     * Get agent output by ID
     */
    getAgentOutput(agentId: AgentId): Record<string, unknown> | undefined;
    /**
     * Get agent execution record
     */
    getAgentRecord(agentId: AgentId): IAgentExecutionRecord | undefined;
    /**
     * Check if agent completed
     */
    isAgentCompleted(agentId: AgentId): boolean;
    /**
     * Get pipeline configuration
     */
    getConfig(): IPipelineConfig;
    /**
     * Get agent configuration by ID
     */
    getAgentConfig(agentId: AgentId): IAgentConfig | undefined;
    /**
     * Get phase configuration by ID
     */
    getPhaseConfig(phaseId: number): IPhaseConfig | undefined;
    /**
     * Get all critical agents
     */
    getCriticalAgents(): IAgentConfig[];
}
//# sourceMappingURL=phd-pipeline-orchestrator.d.ts.map