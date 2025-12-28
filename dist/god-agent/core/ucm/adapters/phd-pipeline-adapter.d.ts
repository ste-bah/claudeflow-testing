/**
 * PhD Pipeline Adapter
 *
 * Specialized adapter for PhD research workflows with phase-aware
 * rolling window sizes and cross-reference pinning strategy.
 *
 * Implements RULE-010 to RULE-014 from CONSTITUTION-UCM-001.md
 *
 * @module ucm/adapters/phd-pipeline-adapter
 */
import type { IWorkflowAdapter, ITaskContext, ITokenConfig, IPinningStrategy, IPhaseSettings } from '../types.js';
/**
 * PhD research workflow phases
 */
export declare enum PhdPhase {
    PLANNING = "planning",
    RESEARCH = "research",
    WRITING = "writing",
    QA = "qa"
}
/**
 * Adapter for PhD research pipeline workflows
 */
export declare class PhdPipelineAdapter implements IWorkflowAdapter {
    readonly name = "phd-pipeline";
    /**
     * Detect if task context is part of PhD pipeline
     *
     * Detection criteria:
     * - 'phd' in pipelineName (case-insensitive)
     * - 'phd' in agentId (case-insensitive)
     * - 'writing' in phase (case-insensitive)
     *
     * @param context - Task context to analyze
     * @returns True if PhD pipeline detected
     */
    detect(context: ITaskContext): boolean;
    /**
     * Get phase-aware rolling window size
     *
     * Window sizes per RULE-010 to RULE-014:
     * - Planning: 2 messages (RULE-011)
     * - Research: 3 messages (RULE-012)
     * - Writing: 5 messages (RULE-013)
     * - QA: 10 messages (RULE-014)
     * - Default: 3 messages (RULE-010)
     *
     * @param context - Task context
     * @returns Rolling window size
     */
    getWindowSize(context: ITaskContext): number;
    /**
     * Get token configuration for PhD workflows
     *
     * @param context - Task context
     * @returns Token configuration
     */
    getTokenConfig(context: ITaskContext): ITokenConfig;
    /**
     * Get pinning strategy for PhD workflows
     *
     * Uses cross-reference pinning to maintain citations and key concepts
     *
     * @param context - Task context
     * @returns Pinning strategy configuration
     */
    getPinningStrategy(context: ITaskContext): IPinningStrategy;
    /**
     * Get phase-specific settings
     *
     * @param context - Task context
     * @returns Phase-specific settings
     */
    getPhaseSettings(context: ITaskContext): IPhaseSettings;
    /**
     * Detect the current PhD phase from context
     *
     * @param context - Task context
     * @returns Detected phase
     */
    private detectPhase;
}
//# sourceMappingURL=phd-pipeline-adapter.d.ts.map