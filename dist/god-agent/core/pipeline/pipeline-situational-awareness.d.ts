/**
 * Pipeline Situational Awareness Builder
 *
 * Builds a markdown section injected into each agent's prompt showing:
 * - What peer agents have completed and their key outputs
 * - What agents are currently running alongside
 * - Key decisions made so far in this phase
 * - File claims to coordinate write access
 *
 * This enables parallel agents to coordinate without direct communication.
 *
 * @module src/god-agent/core/pipeline/pipeline-situational-awareness
 */
import type { PipelineProgressStore } from './pipeline-progress-store.js';
import type { PipelineFileClaims } from './pipeline-file-claims.js';
/**
 * Builds situational awareness markdown sections for agent prompts.
 * Each agent receives a snapshot of what's happening around it.
 */
export declare class SituationalAwarenessBuilder {
    private readonly progressStore;
    private readonly fileClaims;
    constructor(progressStore: PipelineProgressStore, fileClaims: PipelineFileClaims);
    /**
     * Build the full situational awareness section for an agent.
     *
     * @param agentKey - The agent receiving this context
     * @param phase - Current phase
     * @returns Markdown string to inject into the agent's prompt
     */
    buildAwarenessSection(agentKey: string, phase: string): string;
    /**
     * Build section showing completed agents and their summaries.
     */
    private buildCompletedSection;
    /**
     * Format a single completed agent's summary.
     */
    private formatCompletedAgent;
    /**
     * Build section showing currently active agents.
     */
    private buildActiveSection;
    /**
     * Build aggregated decisions section from all completed agents in this phase.
     */
    private buildDecisionsSection;
    /**
     * Build file claims section showing files this agent should avoid.
     */
    private buildFileClaimsSection;
    /**
     * Build coordination guidance for agents running in parallel.
     */
    private buildCoordinationGuidance;
    /**
     * Truncate a string to a maximum length.
     */
    private truncate;
}
//# sourceMappingURL=pipeline-situational-awareness.d.ts.map