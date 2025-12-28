/**
 * PhD Pipeline Runner
 * TASK-E2E-001 - High-level orchestrator for PhD research pipeline
 *
 * Wires together:
 * - AgentRegistry (agent loading from .claude/agents/)
 * - ClaudeTaskExecutor (agent execution via Task tool)
 * - PhDPipelineBridge (pipeline definition building)
 * - PhDLearningIntegration (Sona Engine trajectory tracking)
 * - RelayRaceOrchestrator (sequential agent execution)
 */
import { AgentRegistry } from '../agents/index.js';
import { RelayRaceOrchestrator } from '../orchestration/relay-race-orchestrator.js';
import type { IAgentExecutor, IPipelineExecution } from '../orchestration/orchestration-types.js';
import { PhDPipelineBridge } from './index.js';
import { PhDLearningIntegration, type ILearningIntegrationConfig } from '../integration/index.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
/**
 * Memory engine interface for cross-agent communication
 */
export interface IMemoryEngine {
    store(key: string, content: string, options?: {
        namespace?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    retrieve(key: string, options?: {
        namespace?: string;
    }): Promise<string | null>;
}
/**
 * Options for PhDPipelineRunner
 */
export interface IPhDPipelineRunnerOptions {
    /** Base path to agent definitions (e.g., '.claude/agents') */
    agentsBasePath: string;
    /** Optional custom executor (for testing) */
    executor?: IAgentExecutor;
    /** Sona Engine for trajectory tracking */
    sonaEngine?: SonaEngine;
    /** Memory engine for agent communication */
    memoryEngine?: IMemoryEngine;
    /** Reasoning bank for hyperedge creation */
    reasoningBank?: ReasoningBank | null;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Agent execution timeout (ms) */
    agentTimeout?: number;
    /** Learning integration configuration overrides */
    learningConfig?: Partial<ILearningIntegrationConfig>;
    /** Working directory for hooks */
    workingDirectory?: string;
    /** Optional style profile ID for Phase 6 (Writing) */
    styleProfileId?: string;
}
/**
 * Runner statistics
 */
export interface IRunnerStats {
    /** Number of agents loaded in registry */
    agentsLoaded: number;
    /** Number of categories discovered */
    categoriesLoaded: number;
    /** Number of pipeline runs */
    pipelinesRun: number;
    /** Number of successful pipelines */
    pipelinesSucceeded: number;
    /** Overall success rate */
    successRate: number;
    /** Number of trajectories created */
    trajectoriesCreated: number;
    /** PhD-specific metrics */
    phdMetrics?: {
        phaseStats: Map<string, {
            total: number;
            successful: number;
            rate: number;
        }>;
        criticalAgentCount: number;
        criticalAgentSuccessRate: number;
        overallSuccessRate: number;
    };
}
/**
 * Pipeline run result
 */
export interface IRunResult {
    /** Pipeline execution state */
    execution: IPipelineExecution;
    /** Execution ID */
    executionId: string;
    /** Whether pipeline completed successfully */
    success: boolean;
    /** Duration in milliseconds */
    duration: number;
    /** Error message if failed */
    error?: string;
}
/**
 * High-Level PhD Pipeline Runner
 *
 * Orchestrates the full 48-agent PhD research pipeline with:
 * - Automatic agent loading from .claude/agents/phdresearch/
 * - Sequential execution via RelayRaceOrchestrator
 * - Continuous learning via PhDLearningIntegration
 * - Memory key passing between agents
 */
export declare class PhDPipelineRunner {
    private options;
    private initialized;
    private registry;
    private executor;
    private orchestrator;
    private bridge;
    private learning;
    private pipelinesRun;
    private pipelinesSucceeded;
    private trajectoriesCreated;
    constructor(options: IPhDPipelineRunnerOptions);
    /**
     * Initialize all components
     */
    initialize(): Promise<void>;
    /**
     * Wire orchestrator events to learning integration
     */
    private wireOrchestrationEvents;
    /**
     * Run the PhD research pipeline
     * @param problemStatement - Research problem to investigate
     * @returns Pipeline execution result
     */
    run(problemStatement: string): Promise<IRunResult>;
    /**
     * Get runner statistics
     */
    getStats(): IRunnerStats;
    /**
     * Get orchestrator for advanced usage
     */
    getOrchestrator(): RelayRaceOrchestrator;
    /**
     * Get learning integration for advanced usage
     */
    getLearningIntegration(): PhDLearningIntegration;
    /**
     * Get bridge for advanced usage
     */
    getBridge(): PhDPipelineBridge;
    /**
     * Get registry for advanced usage
     */
    getRegistry(): AgentRegistry;
    /**
     * Check if runner is initialized
     */
    isInitialized(): boolean;
    /**
     * Generate unique execution ID
     */
    private generateExecutionId;
    /**
     * Infer phase from agent name
     */
    private inferPhaseFromAgent;
    /**
     * Create no-op Sona Engine for when real one isn't provided
     */
    private createNoOpSonaEngine;
    /**
     * Ensure runner is initialized
     */
    private ensureInitialized;
    /**
     * Log message if verbose
     */
    private log;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Create a PhD Pipeline Runner with default configuration
 */
export declare function createPhDPipelineRunner(options: IPhDPipelineRunnerOptions): PhDPipelineRunner;
//# sourceMappingURL=phd-pipeline-runner.d.ts.map