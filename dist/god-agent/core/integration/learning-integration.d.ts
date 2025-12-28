/**
 * Learning Integration
 * TASK-LRN-001 - Integrates pipeline execution with Sona Engine learning
 *
 * Creates trajectories for agent executions and provides feedback
 * for continuous improvement through pattern recognition.
 */
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { IAgentResult, IPipelineExecution } from '../orchestration/orchestration-types.js';
/**
 * Learning integration configuration
 */
export interface ILearningIntegrationConfig {
    /** Enable trajectory tracking */
    trackTrajectories: boolean;
    /** Automatically provide feedback on completion */
    autoFeedback: boolean;
    /** Quality threshold for pattern creation (0-1) */
    qualityThreshold: number;
    /** Route prefix for trajectories */
    routePrefix: string;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Enable ReasoningBank hyperedge creation */
    enableHyperedges?: boolean;
    /** Minimum quality for hyperedge creation */
    hyperedgeThreshold?: number;
}
/**
 * Default configuration
 */
export declare const DEFAULT_LEARNING_CONFIG: ILearningIntegrationConfig;
/**
 * Trajectory metadata for tracking
 */
export interface ITrajectoryMetadata {
    trajectoryId: string;
    agentName: string;
    phase: string;
    createdAt: number;
    pipelineTrajectoryId?: string;
}
/**
 * Quality calculation result
 */
export interface IQualityCalculation {
    quality: number;
    factors: {
        baseSuccess: number;
        speedBonus: number;
        outputBonus: number;
        errorPenalty: number;
    };
}
/**
 * Learning integration events
 */
export type LearningEventType = 'trajectory:created' | 'trajectory:feedback' | 'pattern:created' | 'hyperedge:created';
export interface ILearningEvent {
    type: LearningEventType;
    timestamp: number;
    trajectoryId?: string;
    quality?: number;
    agentName?: string;
    data?: Record<string, unknown>;
}
export type LearningEventListener = (event: ILearningEvent) => void;
/**
 * Base Learning Integration
 *
 * Bridges pipeline execution with Sona Engine for trajectory
 * tracking and continuous learning through feedback loops.
 */
export declare class LearningIntegration {
    protected sonaEngine: SonaEngine;
    protected reasoningBank: ReasoningBank | null;
    protected config: ILearningIntegrationConfig;
    /** Active trajectory IDs by agent name */
    protected trajectoryIds: Map<string, ITrajectoryMetadata>;
    /** Event listeners */
    protected listeners: LearningEventListener[];
    /** Pipeline-level trajectory ID */
    protected pipelineTrajectoryId: string | null;
    constructor(sonaEngine: SonaEngine, config?: Partial<ILearningIntegrationConfig>, reasoningBank?: ReasoningBank | null);
    /**
     * Add event listener
     */
    addEventListener(listener: LearningEventListener): void;
    /**
     * Remove event listener
     */
    removeEventListener(listener: LearningEventListener): void;
    /**
     * Emit learning event
     */
    protected emitEvent(event: ILearningEvent): void;
    /**
     * Called when pipeline starts
     * Creates a pipeline-level trajectory
     */
    onPipelineStart(pipelineId: string, pipelineName: string): string | undefined;
    /**
     * Called when an agent starts execution
     * Creates an agent-level trajectory
     */
    onAgentStart(agentName: string, phase: string, pipelineTrajectoryId?: string): string | undefined;
    /**
     * Called when an agent completes execution
     * Provides feedback to Sona Engine
     */
    onAgentComplete(agentName: string, result: IAgentResult): Promise<void>;
    /**
     * Called when pipeline completes
     * Provides overall quality feedback
     */
    onPipelineComplete(execution: IPipelineExecution, pipelineTrajectoryId?: string): Promise<void>;
    /**
     * Calculate quality score for agent result
     * Override in subclasses for custom calculation
     */
    protected calculateQuality(result: IAgentResult): IQualityCalculation;
    /**
     * Calculate quality score for entire pipeline
     */
    protected calculatePipelineQuality(execution: IPipelineExecution): number;
    /**
     * Build route string for pipeline
     */
    protected buildRoute(pipelineName: string): string;
    /**
     * Build route string for agent
     */
    protected buildAgentRoute(phase: string, agentName: string): string;
    /**
     * Create hyperedge in ReasoningBank for high-quality execution
     */
    protected createHyperedge(metadata: ITrajectoryMetadata, result: IAgentResult, quality: number): Promise<void>;
    /**
     * Get current trajectory count
     */
    getActiveTrajectoryCount(): number;
    /**
     * Get trajectory metadata for agent
     */
    getTrajectoryMetadata(agentName: string): ITrajectoryMetadata | undefined;
    /**
     * Get all active trajectory metadata
     */
    getAllTrajectoryMetadata(): Map<string, ITrajectoryMetadata>;
    /**
     * Get pipeline trajectory ID
     */
    getPipelineTrajectoryId(): string | null;
    /**
     * Clear all tracking state
     */
    clear(): void;
    /**
     * Get configuration
     */
    getConfig(): ILearningIntegrationConfig;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ILearningIntegrationConfig>): void;
}
export { DEFAULT_LEARNING_CONFIG as DEFAULT_CONFIG };
//# sourceMappingURL=learning-integration.d.ts.map