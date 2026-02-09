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
export type AgentStatus = 'pending' | 'active' | 'completed' | 'failed';
export interface IAgentOutputSummary {
    /** Key decisions made by the agent */
    decisions: string[];
    /** Files created by the agent */
    filesCreated: string[];
    /** Files modified by the agent */
    filesModified: string[];
    /** Key findings or outputs */
    keyFindings: string[];
    /** Length of raw output */
    outputLength: number;
}
export interface IAgentProgress {
    /** Agent key identifier */
    agentKey: string;
    /** Phase this agent belongs to */
    phase: string;
    /** Current status */
    status: AgentStatus;
    /** Timestamp when agent started (ms) */
    startedAt?: number;
    /** Timestamp when agent completed (ms) */
    completedAt?: number;
    /** Duration in ms */
    duration?: number;
    /** Parsed output summary (populated on completion) */
    outputSummary?: IAgentOutputSummary;
    /** Error message if failed */
    error?: string;
}
/**
 * Tracks agent lifecycle and output summaries during pipeline execution.
 * Thread-safe for concurrent reads (JS single-threaded event loop).
 */
export declare class PipelineProgressStore {
    private agents;
    /**
     * Register an agent as pending before execution begins.
     */
    registerAgent(agentKey: string, phase: string): void;
    /**
     * Mark an agent as actively running.
     */
    markActive(agentKey: string): void;
    /**
     * Mark an agent as completed with its output summary.
     */
    markCompleted(agentKey: string, outputSummary: IAgentOutputSummary): void;
    /**
     * Mark an agent as failed with error message.
     */
    markFailed(agentKey: string, error: string): void;
    /**
     * Get a single agent's progress.
     */
    getAgent(agentKey: string): IAgentProgress | undefined;
    /**
     * Get all agents in a specific phase.
     */
    getByPhase(phase: string): IAgentProgress[];
    /**
     * Get all currently active agents.
     */
    getActive(): IAgentProgress[];
    /**
     * Get all completed agents.
     */
    getCompleted(): IAgentProgress[];
    /**
     * Get full snapshot of all agents.
     */
    getSnapshot(): IAgentProgress[];
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
    static extractOutputSummary(rawOutput: string): IAgentOutputSummary;
}
//# sourceMappingURL=pipeline-progress-store.d.ts.map