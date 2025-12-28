/**
 * Pinning Manager
 * TASK-UCM-CTX-003
 *
 * Manages pinned agents that should always be included in context.
 * RULE-017: Maximum 2000 tokens for pinned content
 * Auto-pins agents when cross-reference threshold is exceeded.
 */
/**
 * Pinned agent entry
 */
interface IPinnedEntry {
    agentId: string;
    content: string;
    tokenCount: number;
    pinnedAt: number;
    reason: PinReason;
    priority: number;
}
/**
 * Reason for pinning
 */
export declare enum PinReason {
    Manual = "manual",
    CrossReference = "cross-reference",
    Foundational = "foundational",
    HighReuse = "high-reuse"
}
/**
 * Pinning Manager
 * Maintains set of always-included agents with token budget enforcement
 */
export declare class PinningManager {
    private pinned;
    private maxTokens;
    private crossRefThreshold;
    private crossRefCounts;
    constructor(maxTokens?: number, crossRefThreshold?: number);
    /**
     * Pin an agent to context
     * RULE-017: Enforce 2000 token maximum
     *
     * @param agentId - Agent to pin
     * @param content - Agent content
     * @param tokenCount - Token count for content
     * @param reason - Reason for pinning
     * @param priority - Priority level (higher = more important)
     * @throws BudgetExceededError if pinning would exceed budget
     */
    pin(agentId: string, content: string, tokenCount: number, reason?: PinReason, priority?: number): void;
    /**
     * Unpin an agent
     * @param agentId - Agent to unpin
     * @returns True if was pinned and removed
     */
    unpin(agentId: string): boolean;
    /**
     * Check if agent is pinned
     * @param agentId - Agent to check
     * @returns True if pinned
     */
    isPinned(agentId: string): boolean;
    /**
     * Get all pinned agents
     * @returns Array of pinned entries sorted by priority (highest first)
     */
    getPinned(): readonly IPinnedEntry[];
    /**
     * Get specific pinned agent
     * @param agentId - Agent to retrieve
     * @returns Pinned entry or null
     */
    getPinnedAgent(agentId: string): IPinnedEntry | null;
    /**
     * Check if can pin new agent
     * @param tokenCount - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if can accommodate
     */
    canPin(tokenCount: number, priority?: number): boolean;
    /**
     * Try to make space by evicting lower priority pins
     * @param needed - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if space made
     */
    private makeSpace;
    /**
     * Check if can make space without actually evicting
     * @param needed - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if space could be made
     */
    private canMakeSpace;
    /**
     * Record cross-reference to agent
     * Auto-pins if threshold exceeded
     *
     * @param agentId - Referenced agent
     * @param content - Agent content (for auto-pin)
     * @param tokenCount - Token count (for auto-pin)
     */
    recordCrossReference(agentId: string, content?: string, tokenCount?: number): void;
    /**
     * Get cross-reference count for agent
     * @param agentId - Agent to query
     * @returns Number of cross-references
     */
    getCrossRefCount(agentId: string): number;
    /**
     * Get total pinned token count
     * @returns Sum of all pinned tokens
     */
    getTotalTokens(): number;
    /**
     * Get available token budget
     * @returns Remaining tokens before limit
     */
    getAvailableTokens(): number;
    /**
     * Get pinning statistics
     * @returns Pinning metrics
     */
    getStats(): {
        pinnedCount: number;
        totalTokens: number;
        availableTokens: number;
        utilization: number;
        maxTokens: number;
        byReason: Record<string, number>;
        avgTokensPerPin: number;
        crossRefThreshold: number;
        autoPinCandidates: {
            agentId: string;
            crossRefs: number;
        }[];
    };
    /**
     * Clear all pinned agents
     * @returns Cleared entries
     */
    clear(): IPinnedEntry[];
    /**
     * Update max token budget
     * May evict lowest priority pins if budget reduced
     *
     * @param newMax - New maximum tokens
     */
    setMaxTokens(newMax: number): void;
    /**
     * Update cross-reference threshold
     * @param threshold - New threshold
     */
    setCrossRefThreshold(threshold: number): void;
}
export {};
//# sourceMappingURL=pinning-manager.d.ts.map