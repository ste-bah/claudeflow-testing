/**
 * PhD Pipeline Bridge
 * TASK-BRG-001 - PhD-specific pipeline bridge extending base
 *
 * Extends PipelineBridge with PhD-specific:
 * - Quality gate requirements (citations, methodology)
 * - Phase-specific task descriptions
 * - Writing phase requirements
 */
import { PipelineBridge, type IPipelineBridgeConfig } from './pipeline-bridge.js';
import type { IPipelineConfig, IAgentConfig } from './pipeline-types.js';
import type { AgentRegistry } from '../agents/agent-registry.js';
import type { ILoadedAgentDefinition } from '../agents/agent-types.js';
/**
 * PhD Pipeline Bridge Configuration
 * Extends base bridge config with PhD-specific options
 */
export interface IPhDPipelineBridgeConfig extends IPipelineBridgeConfig {
    /** Optional style profile ID for Phase 6 (Writing) */
    styleProfileId?: string;
}
/**
 * Phase-specific quality requirements
 */
declare const PHASE_QUALITY_REQUIREMENTS: Record<number, string[]>;
/**
 * Writing phase ID
 */
declare const WRITING_PHASE_ID = 6;
/**
 * QA phase ID
 */
declare const QA_PHASE_ID = 7;
/**
 * Minimum citation requirements by phase
 */
declare const CITATION_REQUIREMENTS: Record<number, number>;
/**
 * PhD-Specific Pipeline Bridge
 *
 * Extends base bridge with academic research requirements:
 * - Citation counting
 * - Methodology verification
 * - Reproducibility gates
 * - Style profile integration for writing phase
 */
export declare class PhDPipelineBridge extends PipelineBridge {
    private styleProfileId?;
    constructor(config: IPipelineConfig, registry?: AgentRegistry | null, bridgeConfig?: Partial<IPhDPipelineBridgeConfig>);
    /**
     * Build PhD-specific task description
     */
    protected buildTaskDescription(agentConfig: IAgentConfig, loadedDef: ILoadedAgentDefinition | null): string;
    /**
     * Build PhD-specific quality gate
     */
    protected buildQualityGate(agentConfig: IAgentConfig, loadedDef: ILoadedAgentDefinition | null): string;
    /**
     * Get phase-specific instructions
     */
    protected getPhaseInstructions(phaseId: number): string | null;
    /**
     * Get PhD-specific statistics
     */
    getPhDStatistics(): {
        totalAgents: number;
        phases: number;
        criticalAgents: number;
        writingAgents: number;
        qaAgents: number;
        estimatedCitations: number;
    };
    /**
     * Get agents by phase
     */
    getAgentsByPhase(phaseId: number): IAgentConfig[];
    /**
     * Get critical path agents (those in the longest dependency chain)
     */
    getCriticalPathAgents(): IAgentConfig[];
    /**
     * Validate PhD-specific requirements
     */
    validatePhDRequirements(): {
        valid: boolean;
        issues: string[];
    };
    /**
     * Get default style prompt
     */
    private getDefaultStylePrompt;
    /**
     * Get style prompt (synchronous)
     * Used during task description building (synchronous context)
     */
    private getStylePromptSync;
}
/**
 * Create a PhD pipeline bridge with default configuration
 */
export declare function createPhDPipelineBridge(config: IPipelineConfig, registry?: AgentRegistry | null): PhDPipelineBridge;
export { PHASE_QUALITY_REQUIREMENTS, CITATION_REQUIREMENTS, WRITING_PHASE_ID, QA_PHASE_ID, };
//# sourceMappingURL=phd-pipeline-bridge.d.ts.map