/**
 * PhD Learning Integration
 * TASK-LRN-001 - PhD-specific learning integration
 *
 * Extends base LearningIntegration with PhD research-specific
 * quality calculation and phase-aware trajectory tracking.
 */
import { LearningIntegration, type ILearningIntegrationConfig, type IQualityCalculation } from './learning-integration.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { IAgentResult } from '../orchestration/orchestration-types.js';
/**
 * Phase importance weights for quality calculation
 * Higher weights for critical phases
 */
export declare const PHASE_WEIGHTS: Record<string, number>;
/**
 * Minimum output lengths by phase
 */
export declare const PHASE_MIN_OUTPUT_LENGTH: Record<string, number>;
/**
 * Critical agent keys that should have higher quality thresholds
 */
export declare const CRITICAL_AGENT_KEYS: string[];
/**
 * PhD-specific configuration defaults
 */
export declare const PHD_LEARNING_CONFIG: Partial<ILearningIntegrationConfig>;
/**
 * PhD-Specific Learning Integration
 *
 * Extends base integration with:
 * - Phase-weighted quality calculation
 * - Citation awareness in quality scoring
 * - Critical agent tracking
 * - Academic writing quality metrics
 */
export declare class PhDLearningIntegration extends LearningIntegration {
    /** Track critical agent results for special handling */
    private criticalAgentResults;
    /** Track phase completion for phase-level learning */
    private phaseCompletionCounts;
    constructor(sonaEngine: SonaEngine, config?: Partial<ILearningIntegrationConfig>, reasoningBank?: ReasoningBank | null);
    /**
     * PhD-specific quality calculation
     */
    protected calculateQuality(result: IAgentResult): IQualityCalculation;
    /**
     * PhD-specific agent start with phase tracking
     */
    onAgentStart(agentName: string, phase: string, pipelineTrajectoryId?: string): string | undefined;
    /**
     * Count citations in output text
     */
    protected countCitations(output: string): number;
    /**
     * Check if agent is critical
     */
    protected isCriticalAgent(agentName: string): boolean;
    /**
     * Extract phase from agent result metadata
     */
    protected extractPhase(result: IAgentResult): string;
    /**
     * Infer phase from agent number (based on PhD pipeline structure)
     */
    protected inferPhaseFromAgentNumber(agentNum: number): string;
    /**
     * Update phase completion tracking
     */
    protected updatePhaseCompletion(phase: string, success: boolean): void;
    /**
     * Get phase completion statistics
     */
    getPhaseStatistics(): Map<string, {
        total: number;
        successful: number;
        rate: number;
    }>;
    /**
     * Get critical agent results
     */
    getCriticalAgentResults(): Map<string, IAgentResult>;
    /**
     * Get overall PhD pipeline success metrics
     */
    getPhdMetrics(): {
        phaseStats: Map<string, {
            total: number;
            successful: number;
            rate: number;
        }>;
        criticalAgentCount: number;
        criticalAgentSuccessRate: number;
        overallSuccessRate: number;
    };
    /**
     * Clear all PhD-specific tracking
     */
    clear(): void;
}
/**
 * Create a PhD learning integration with default configuration
 */
export declare function createPhDLearningIntegration(sonaEngine: SonaEngine, reasoningBank?: ReasoningBank | null, config?: Partial<ILearningIntegrationConfig>): PhDLearningIntegration;
//# sourceMappingURL=phd-learning-integration.d.ts.map