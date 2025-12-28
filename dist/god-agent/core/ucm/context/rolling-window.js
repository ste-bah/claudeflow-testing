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
 * Phase-aware window size configuration
 * Maps research phase to maximum number of agents in window
 */
const PHASE_WINDOW_SIZES = {
    planning: 2,
    research: 3,
    writing: 5,
    qa: 10,
};
/**
 * Rolling Window Manager
 * Maintains FIFO queue of active agents with phase-aware sizing
 */
export class RollingWindow {
    window = [];
    currentPhase = 'research';
    capacity;
    constructor(initialPhase = 'research', customCapacity) {
        this.currentPhase = initialPhase.toLowerCase();
        this.capacity = customCapacity ?? this.getPhaseCapacity(this.currentPhase);
    }
    /**
     * Get window capacity for current phase
     * RULE-010 to RULE-014
     */
    getPhaseCapacity(phase) {
        return PHASE_WINDOW_SIZES[phase.toLowerCase()] ?? 3; // Default to research window size
    }
    /**
     * Push new agent into window
     * Auto-evicts oldest if capacity exceeded (FIFO)
     *
     * @param agentId - Unique agent identifier
     * @param content - Agent context content
     * @param tokenCount - Token count for content
     * @returns Evicted entry if any
     */
    push(agentId, content, tokenCount) {
        const entry = {
            agentId,
            content,
            tokenCount,
            timestamp: Date.now(),
            phase: this.currentPhase,
        };
        // Check if agent already in window - update instead
        const existingIndex = this.window.findIndex(e => e.agentId === agentId);
        if (existingIndex !== -1) {
            this.window.splice(existingIndex, 1);
        }
        // Add to end of queue
        this.window.push(entry);
        // Evict oldest if over capacity (FIFO)
        if (this.window.length > this.capacity) {
            return this.window.shift() ?? null;
        }
        return null;
    }
    /**
     * Remove and return oldest entry (FIFO pop)
     * @returns Oldest entry or null if empty
     */
    pop() {
        return this.window.shift() ?? null;
    }
    /**
     * Get current window contents
     * @returns Array of window entries in order (oldest to newest)
     */
    getWindow() {
        return [...this.window];
    }
    /**
     * Get specific agent from window
     * @param agentId - Agent to retrieve
     * @returns Entry if found, null otherwise
     */
    getAgent(agentId) {
        return this.window.find(e => e.agentId === agentId) ?? null;
    }
    /**
     * Check if agent is in window
     * @param agentId - Agent to check
     * @returns True if in window
     */
    hasAgent(agentId) {
        return this.window.some(e => e.agentId === agentId);
    }
    /**
     * Remove specific agent from window
     * @param agentId - Agent to remove
     * @returns Removed entry or null
     */
    remove(agentId) {
        const index = this.window.findIndex(e => e.agentId === agentId);
        if (index === -1)
            return null;
        const [removed] = this.window.splice(index, 1);
        return removed;
    }
    /**
     * Resize window for new phase
     * RULE-010 to RULE-014: Phase-specific window sizes
     *
     * @param phase - New research phase
     * @returns Evicted entries if downsizing
     */
    resize(phase) {
        this.currentPhase = phase.toLowerCase();
        this.capacity = this.getPhaseCapacity(this.currentPhase);
        // Evict oldest entries if over new capacity
        const evicted = [];
        while (this.window.length > this.capacity) {
            const entry = this.window.shift();
            if (entry)
                evicted.push(entry);
        }
        return evicted;
    }
    /**
     * Get current window size
     * @returns Number of entries in window
     */
    size() {
        return this.window.length;
    }
    /**
     * Get current capacity
     * @returns Maximum window size for current phase
     */
    getCapacity() {
        return this.capacity;
    }
    /**
     * Get current phase
     * @returns Active research phase
     */
    getPhase() {
        return this.currentPhase;
    }
    /**
     * Get total token count in window
     * @returns Sum of all entry token counts
     */
    getTotalTokens() {
        return this.window.reduce((sum, entry) => sum + entry.tokenCount, 0);
    }
    /**
     * Clear all entries from window
     * @returns All cleared entries
     */
    clear() {
        const cleared = [...this.window];
        this.window = [];
        return cleared;
    }
    /**
     * Get window statistics
     * @returns Window metrics and status
     */
    getStats() {
        return {
            size: this.window.length,
            capacity: this.capacity,
            utilization: this.capacity > 0 ? this.window.length / this.capacity : 0,
            totalTokens: this.getTotalTokens(),
            phase: this.currentPhase,
            agents: this.window.map(e => ({
                agentId: e.agentId,
                tokenCount: e.tokenCount,
                age: Date.now() - e.timestamp,
            })),
        };
    }
}
//# sourceMappingURL=rolling-window.js.map