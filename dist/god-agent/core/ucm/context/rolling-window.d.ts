/**
 * Rolling Window Manager
 * TASK-UCM-CTX-001
 *
 * Implements phase-aware rolling window for active agent context.
 * RULE-010 to RULE-014: Different window sizes per phase
 * - Planning: 2 agents
 * - Research: 3 agents
 * - Writing: 5 agents
 * - QA: 10 agents
 *
 * Uses FIFO queue with automatic eviction when capacity exceeded.
 */
/**
 * Rolling window entry
 * Contains agent context and metadata
 */
interface IWindowEntry {
    agentId: string;
    content: string;
    tokenCount: number;
    timestamp: number;
    phase: string;
}
/**
 * Rolling Window Manager
 * Maintains FIFO queue of active agents with phase-aware sizing
 */
export declare class RollingWindow {
    private window;
    private currentPhase;
    private capacity;
    constructor(initialPhase?: string, customCapacity?: number);
    /**
     * Get window capacity for current phase
     * RULE-010 to RULE-014
     */
    private getPhaseCapacity;
    /**
     * Push new agent into window
     * Auto-evicts oldest if capacity exceeded (FIFO)
     *
     * @param agentId - Unique agent identifier
     * @param content - Agent context content
     * @param tokenCount - Token count for content
     * @returns Evicted entry if any
     */
    push(agentId: string, content: string, tokenCount: number): IWindowEntry | null;
    /**
     * Remove and return oldest entry (FIFO pop)
     * @returns Oldest entry or null if empty
     */
    pop(): IWindowEntry | null;
    /**
     * Get current window contents
     * @returns Array of window entries in order (oldest to newest)
     */
    getWindow(): readonly IWindowEntry[];
    /**
     * Get specific agent from window
     * @param agentId - Agent to retrieve
     * @returns Entry if found, null otherwise
     */
    getAgent(agentId: string): IWindowEntry | null;
    /**
     * Check if agent is in window
     * @param agentId - Agent to check
     * @returns True if in window
     */
    hasAgent(agentId: string): boolean;
    /**
     * Remove specific agent from window
     * @param agentId - Agent to remove
     * @returns Removed entry or null
     */
    remove(agentId: string): IWindowEntry | null;
    /**
     * Resize window for new phase
     * RULE-010 to RULE-014: Phase-specific window sizes
     *
     * @param phase - New research phase
     * @returns Evicted entries if downsizing
     */
    resize(phase: string): IWindowEntry[];
    /**
     * Get current window size
     * @returns Number of entries in window
     */
    size(): number;
    /**
     * Get current capacity
     * @returns Maximum window size for current phase
     */
    getCapacity(): number;
    /**
     * Get current phase
     * @returns Active research phase
     */
    getPhase(): string;
    /**
     * Get total token count in window
     * @returns Sum of all entry token counts
     */
    getTotalTokens(): number;
    /**
     * Clear all entries from window
     * @returns All cleared entries
     */
    clear(): IWindowEntry[];
    /**
     * Get window statistics
     * @returns Window metrics and status
     */
    getStats(): {
        size: number;
        capacity: number;
        utilization: number;
        totalTokens: number;
        phase: string;
        agents: {
            agentId: string;
            tokenCount: number;
            age: number;
        }[];
    };
}
export {};
//# sourceMappingURL=rolling-window.d.ts.map