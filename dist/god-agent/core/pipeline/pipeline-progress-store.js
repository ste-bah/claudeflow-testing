/**
 * Pipeline Progress Store
 *
 * In-memory store tracking every agent's lifecycle and output summary.
 * Enables situational awareness for parallel agent execution - concurrent
 * agents can see what peers have completed, what's currently running,
 * and what decisions/files are in play.
 *
 * @module src/god-agent/core/pipeline/pipeline-progress-store
 */
// =============================================================================
// PROGRESS STORE
// =============================================================================
/**
 * Tracks agent lifecycle and output summaries during pipeline execution.
 * Thread-safe for concurrent reads (JS single-threaded event loop).
 */
export class PipelineProgressStore {
    agents = new Map();
    /**
     * Register an agent as pending before execution begins.
     */
    registerAgent(agentKey, phase) {
        this.agents.set(agentKey, {
            agentKey,
            phase,
            status: 'pending',
        });
    }
    /**
     * Mark an agent as actively running.
     */
    markActive(agentKey) {
        const agent = this.agents.get(agentKey);
        if (agent) {
            agent.status = 'active';
            agent.startedAt = Date.now();
        }
    }
    /**
     * Mark an agent as completed with its output summary.
     */
    markCompleted(agentKey, outputSummary) {
        const agent = this.agents.get(agentKey);
        if (agent) {
            agent.status = 'completed';
            agent.completedAt = Date.now();
            agent.duration = agent.startedAt
                ? agent.completedAt - agent.startedAt
                : undefined;
            agent.outputSummary = outputSummary;
        }
    }
    /**
     * Mark an agent as failed with error message.
     */
    markFailed(agentKey, error) {
        const agent = this.agents.get(agentKey);
        if (agent) {
            agent.status = 'failed';
            agent.completedAt = Date.now();
            agent.duration = agent.startedAt
                ? agent.completedAt - agent.startedAt
                : undefined;
            agent.error = error;
        }
    }
    /**
     * Get a single agent's progress.
     */
    getAgent(agentKey) {
        return this.agents.get(agentKey);
    }
    /**
     * Get all agents in a specific phase.
     */
    getByPhase(phase) {
        return Array.from(this.agents.values()).filter(a => a.phase === phase);
    }
    /**
     * Get all currently active agents.
     */
    getActive() {
        return Array.from(this.agents.values()).filter(a => a.status === 'active');
    }
    /**
     * Get all completed agents.
     */
    getCompleted() {
        return Array.from(this.agents.values()).filter(a => a.status === 'completed');
    }
    /**
     * Get full snapshot of all agents.
     */
    getSnapshot() {
        return Array.from(this.agents.values());
    }
    // ===========================================================================
    // OUTPUT PARSING
    // ===========================================================================
    /**
     * Extract a structured output summary from raw agent output.
     *
     * Looks for structured markers in the output:
     * - Lines starting with "Created:" or "File created:" -> filesCreated
     * - Lines starting with "Modified:" or "File modified:" -> filesModified
     * - Lines starting with "Decision:" -> decisions
     * - Lines starting with "Finding:" or "Key finding:" -> keyFindings
     *
     * Falls back to first 3 non-empty lines as keyFindings if no markers found.
     */
    static extractOutputSummary(rawOutput) {
        const lines = rawOutput.split('\n');
        const decisions = [];
        const filesCreated = [];
        const filesModified = [];
        const keyFindings = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const lower = trimmed.toLowerCase();
            if (lower.startsWith('created:') || lower.startsWith('file created:')) {
                filesCreated.push(trimmed.replace(/^(file )?created:\s*/i, ''));
            }
            else if (lower.startsWith('modified:') ||
                lower.startsWith('file modified:')) {
                filesModified.push(trimmed.replace(/^(file )?modified:\s*/i, ''));
            }
            else if (lower.startsWith('decision:')) {
                decisions.push(trimmed.replace(/^decision:\s*/i, ''));
            }
            else if (lower.startsWith('finding:') ||
                lower.startsWith('key finding:')) {
                keyFindings.push(trimmed.replace(/^(key )?finding:\s*/i, ''));
            }
        }
        // Fallback: if no structured markers found, use first 3 non-empty lines
        if (decisions.length === 0 &&
            filesCreated.length === 0 &&
            filesModified.length === 0 &&
            keyFindings.length === 0) {
            const nonEmpty = lines.map(l => l.trim()).filter(l => l.length > 0);
            keyFindings.push(...nonEmpty.slice(0, 3));
        }
        return {
            decisions,
            filesCreated,
            filesModified,
            keyFindings,
            outputLength: rawOutput.length,
        };
    }
}
//# sourceMappingURL=pipeline-progress-store.js.map