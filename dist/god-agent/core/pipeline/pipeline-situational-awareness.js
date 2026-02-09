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
// =============================================================================
// AWARENESS BUILDER
// =============================================================================
/**
 * Builds situational awareness markdown sections for agent prompts.
 * Each agent receives a snapshot of what's happening around it.
 */
export class SituationalAwarenessBuilder {
    progressStore;
    fileClaims;
    constructor(progressStore, fileClaims) {
        this.progressStore = progressStore;
        this.fileClaims = fileClaims;
    }
    /**
     * Build the full situational awareness section for an agent.
     *
     * @param agentKey - The agent receiving this context
     * @param phase - Current phase
     * @returns Markdown string to inject into the agent's prompt
     */
    buildAwarenessSection(agentKey, phase) {
        const sections = [];
        sections.push('## Situational Awareness');
        // 1. Completed agents in this phase
        const completedSection = this.buildCompletedSection(phase, agentKey);
        if (completedSection) {
            sections.push(completedSection);
        }
        // 2. Currently active agents
        const activeSection = this.buildActiveSection(agentKey);
        if (activeSection) {
            sections.push(activeSection);
        }
        // 3. Key decisions aggregated from completed agents
        const decisionsSection = this.buildDecisionsSection(phase);
        if (decisionsSection) {
            sections.push(decisionsSection);
        }
        // 4. File claims (files to avoid modifying)
        const claimsSection = this.buildFileClaimsSection(agentKey);
        if (claimsSection) {
            sections.push(claimsSection);
        }
        // 5. Coordination guidance
        const activeCount = this.progressStore.getActive().filter(a => a.agentKey !== agentKey).length;
        if (activeCount > 0) {
            sections.push(this.buildCoordinationGuidance(activeCount));
        }
        // If nothing interesting to report, return minimal section
        if (sections.length <= 1) {
            sections.push('No peer agents active or completed in this phase yet.');
        }
        return sections.join('\n\n');
    }
    /**
     * Build section showing completed agents and their summaries.
     */
    buildCompletedSection(phase, currentAgentKey) {
        const completed = this.progressStore
            .getByPhase(phase)
            .filter(a => a.status === 'completed' && a.agentKey !== currentAgentKey);
        if (completed.length === 0)
            return null;
        const lines = ['### Completed Agents (This Phase)'];
        for (const agent of completed) {
            lines.push(this.formatCompletedAgent(agent));
        }
        return lines.join('\n');
    }
    /**
     * Format a single completed agent's summary.
     */
    formatCompletedAgent(agent) {
        const durationStr = agent.duration
            ? `${(agent.duration / 1000).toFixed(1)}s`
            : '?s';
        const summary = agent.outputSummary;
        let line = `- **${agent.agentKey}** (${durationStr})`;
        if (summary) {
            // Add key findings summary
            if (summary.keyFindings.length > 0) {
                const findingsPreview = summary.keyFindings
                    .slice(0, 2)
                    .map(f => this.truncate(f, 80))
                    .join('; ');
                line += `: ${findingsPreview}`;
            }
            // Add decisions if any
            if (summary.decisions.length > 0) {
                const decisionsStr = summary.decisions
                    .map(d => `"${this.truncate(d, 60)}"`)
                    .join(', ');
                line += `\n  - Decisions: ${decisionsStr}`;
            }
            // Add files if any
            const allFiles = [...summary.filesCreated, ...summary.filesModified];
            if (allFiles.length > 0) {
                const filesStr = allFiles
                    .slice(0, 5)
                    .map(f => `\`${f}\``)
                    .join(', ');
                const suffix = allFiles.length > 5 ? ` (+${allFiles.length - 5} more)` : '';
                line += `\n  - Files: ${filesStr}${suffix}`;
            }
        }
        return line;
    }
    /**
     * Build section showing currently active agents.
     */
    buildActiveSection(currentAgentKey) {
        const active = this.progressStore
            .getActive()
            .filter(a => a.agentKey !== currentAgentKey);
        if (active.length === 0)
            return null;
        const lines = ['### Currently Active (Running Alongside You)'];
        for (const agent of active) {
            const elapsed = agent.startedAt
                ? `${((Date.now() - agent.startedAt) / 1000).toFixed(0)}s ago`
                : 'just started';
            lines.push(`- **${agent.agentKey}**: Started ${elapsed} (in progress)`);
        }
        return lines.join('\n');
    }
    /**
     * Build aggregated decisions section from all completed agents in this phase.
     */
    buildDecisionsSection(phase) {
        const completed = this.progressStore
            .getByPhase(phase)
            .filter(a => a.status === 'completed' && a.outputSummary);
        const allDecisions = [];
        for (const agent of completed) {
            for (const decision of agent.outputSummary.decisions) {
                allDecisions.push({ decision, agent: agent.agentKey });
            }
        }
        if (allDecisions.length === 0)
            return null;
        const lines = ['### Key Decisions So Far'];
        for (let i = 0; i < Math.min(allDecisions.length, 10); i++) {
            const d = allDecisions[i];
            lines.push(`${i + 1}. "${this.truncate(d.decision, 80)}" (${d.agent})`);
        }
        if (allDecisions.length > 10) {
            lines.push(`... and ${allDecisions.length - 10} more decisions`);
        }
        return lines.join('\n');
    }
    /**
     * Build file claims section showing files this agent should avoid.
     */
    buildFileClaimsSection(agentKey) {
        const conflicts = this.fileClaims.getConflicts(agentKey);
        if (conflicts.length === 0)
            return null;
        const lines = ['### File Claims (Do Not Modify These)'];
        for (const claim of conflicts.slice(0, 10)) {
            lines.push(`- \`${claim.filePath}\` \u2014 claimed by ${claim.claimedBy} (${claim.operation})`);
        }
        if (conflicts.length > 10) {
            lines.push(`... and ${conflicts.length - 10} more claimed files`);
        }
        return lines.join('\n');
    }
    /**
     * Build coordination guidance for agents running in parallel.
     */
    buildCoordinationGuidance(peerCount) {
        return `### Your Role
You are running in parallel with ${peerCount} other agent${peerCount > 1 ? 's' : ''}. Coordinate by:
- Avoiding files listed above unless necessary
- Building on decisions already made
- If you need a file claimed by another agent, note this in your output`;
    }
    /**
     * Truncate a string to a maximum length.
     */
    truncate(str, maxLen) {
        if (str.length <= maxLen)
            return str;
        return str.substring(0, maxLen - 3) + '...';
    }
}
//# sourceMappingURL=pipeline-situational-awareness.js.map