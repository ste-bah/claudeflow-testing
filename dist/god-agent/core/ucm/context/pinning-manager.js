/**
 * Pinning Manager
 * TASK-UCM-CTX-003
 *
 * Manages pinned agents that should always be included in context.
 * RULE-017: Maximum 2000 tokens for pinned content
 * Auto-pins agents when cross-reference threshold is exceeded.
 */
import { BudgetExceededError } from '../errors.js';
/**
 * Reason for pinning
 */
export var PinReason;
(function (PinReason) {
    PinReason["Manual"] = "manual";
    PinReason["CrossReference"] = "cross-reference";
    PinReason["Foundational"] = "foundational";
    PinReason["HighReuse"] = "high-reuse";
})(PinReason || (PinReason = {}));
/**
 * Pinning Manager
 * Maintains set of always-included agents with token budget enforcement
 */
export class PinningManager {
    pinned = new Map();
    maxTokens;
    crossRefThreshold;
    crossRefCounts = new Map();
    constructor(maxTokens = 2000, crossRefThreshold = 3) {
        this.maxTokens = maxTokens;
        this.crossRefThreshold = crossRefThreshold;
    }
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
    pin(agentId, content, tokenCount, reason = PinReason.Manual, priority = 1) {
        // Check if already pinned
        const existing = this.pinned.get(agentId);
        if (existing) {
            // Update if needed
            if (existing.content === content && existing.reason === reason) {
                return;
            }
            // Unpin first to free tokens
            this.unpin(agentId);
        }
        // Check budget
        const currentTokens = this.getTotalTokens();
        if (currentTokens + tokenCount > this.maxTokens) {
            // Try to make space by evicting lowest priority
            if (!this.makeSpace(tokenCount, priority)) {
                throw new BudgetExceededError(currentTokens + tokenCount, this.maxTokens, `pinning-${agentId}`);
            }
        }
        // Pin agent
        this.pinned.set(agentId, {
            agentId,
            content,
            tokenCount,
            pinnedAt: Date.now(),
            reason,
            priority,
        });
    }
    /**
     * Unpin an agent
     * @param agentId - Agent to unpin
     * @returns True if was pinned and removed
     */
    unpin(agentId) {
        return this.pinned.delete(agentId);
    }
    /**
     * Check if agent is pinned
     * @param agentId - Agent to check
     * @returns True if pinned
     */
    isPinned(agentId) {
        return this.pinned.has(agentId);
    }
    /**
     * Get all pinned agents
     * @returns Array of pinned entries sorted by priority (highest first)
     */
    getPinned() {
        return Array.from(this.pinned.values())
            .sort((a, b) => b.priority - a.priority);
    }
    /**
     * Get specific pinned agent
     * @param agentId - Agent to retrieve
     * @returns Pinned entry or null
     */
    getPinnedAgent(agentId) {
        return this.pinned.get(agentId) ?? null;
    }
    /**
     * Check if can pin new agent
     * @param tokenCount - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if can accommodate
     */
    canPin(tokenCount, priority = 1) {
        const currentTokens = this.getTotalTokens();
        // Direct fit
        if (currentTokens + tokenCount <= this.maxTokens) {
            return true;
        }
        // Check if can make space
        return this.canMakeSpace(tokenCount, priority);
    }
    /**
     * Try to make space by evicting lower priority pins
     * @param needed - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if space made
     */
    makeSpace(needed, priority) {
        const currentTokens = this.getTotalTokens();
        const toFree = currentTokens + needed - this.maxTokens;
        if (toFree <= 0)
            return true;
        // Get candidates for eviction (lower priority than new pin)
        const candidates = Array.from(this.pinned.values())
            .filter(p => p.priority < priority)
            .sort((a, b) => a.priority - b.priority); // Lowest priority first
        let freed = 0;
        const toEvict = [];
        for (const candidate of candidates) {
            toEvict.push(candidate.agentId);
            freed += candidate.tokenCount;
            if (freed >= toFree)
                break;
        }
        if (freed < toFree)
            return false;
        // Evict
        for (const agentId of toEvict) {
            this.unpin(agentId);
        }
        return true;
    }
    /**
     * Check if can make space without actually evicting
     * @param needed - Tokens needed
     * @param priority - Priority of new pin
     * @returns True if space could be made
     */
    canMakeSpace(needed, priority) {
        const currentTokens = this.getTotalTokens();
        const toFree = currentTokens + needed - this.maxTokens;
        if (toFree <= 0)
            return true;
        const evictable = Array.from(this.pinned.values())
            .filter(p => p.priority < priority)
            .reduce((sum, p) => sum + p.tokenCount, 0);
        return evictable >= toFree;
    }
    /**
     * Record cross-reference to agent
     * Auto-pins if threshold exceeded
     *
     * @param agentId - Referenced agent
     * @param content - Agent content (for auto-pin)
     * @param tokenCount - Token count (for auto-pin)
     */
    recordCrossReference(agentId, content, tokenCount) {
        const count = (this.crossRefCounts.get(agentId) ?? 0) + 1;
        this.crossRefCounts.set(agentId, count);
        // Auto-pin if threshold exceeded and not already pinned
        if (count >= this.crossRefThreshold &&
            !this.isPinned(agentId) &&
            content &&
            tokenCount !== undefined) {
            try {
                this.pin(agentId, content, tokenCount, PinReason.CrossReference, 2 // Medium-high priority
                );
            }
            catch (error) {
                // Failed to auto-pin due to budget - that's ok
                console.warn(`Failed to auto-pin ${agentId} on cross-reference threshold:`, error);
            }
        }
    }
    /**
     * Get cross-reference count for agent
     * @param agentId - Agent to query
     * @returns Number of cross-references
     */
    getCrossRefCount(agentId) {
        return this.crossRefCounts.get(agentId) ?? 0;
    }
    /**
     * Get total pinned token count
     * @returns Sum of all pinned tokens
     */
    getTotalTokens() {
        return Array.from(this.pinned.values())
            .reduce((sum, entry) => sum + entry.tokenCount, 0);
    }
    /**
     * Get available token budget
     * @returns Remaining tokens before limit
     */
    getAvailableTokens() {
        return Math.max(0, this.maxTokens - this.getTotalTokens());
    }
    /**
     * Get pinning statistics
     * @returns Pinning metrics
     */
    getStats() {
        const entries = Array.from(this.pinned.values());
        const byReason = entries.reduce((acc, entry) => {
            acc[entry.reason] = (acc[entry.reason] ?? 0) + 1;
            return acc;
        }, {});
        return {
            pinnedCount: this.pinned.size,
            totalTokens: this.getTotalTokens(),
            availableTokens: this.getAvailableTokens(),
            utilization: this.maxTokens > 0 ? this.getTotalTokens() / this.maxTokens : 0,
            maxTokens: this.maxTokens,
            byReason,
            avgTokensPerPin: entries.length > 0
                ? this.getTotalTokens() / entries.length
                : 0,
            crossRefThreshold: this.crossRefThreshold,
            autoPinCandidates: Array.from(this.crossRefCounts.entries())
                .filter(([id, count]) => count >= this.crossRefThreshold && !this.isPinned(id))
                .map(([id, count]) => ({ agentId: id, crossRefs: count })),
        };
    }
    /**
     * Clear all pinned agents
     * @returns Cleared entries
     */
    clear() {
        const cleared = Array.from(this.pinned.values());
        this.pinned.clear();
        this.crossRefCounts.clear();
        return cleared;
    }
    /**
     * Update max token budget
     * May evict lowest priority pins if budget reduced
     *
     * @param newMax - New maximum tokens
     */
    setMaxTokens(newMax) {
        this.maxTokens = newMax;
        // Evict lowest priority if over budget
        while (this.getTotalTokens() > this.maxTokens) {
            const lowestPriority = Array.from(this.pinned.values())
                .sort((a, b) => a.priority - b.priority)[0];
            if (!lowestPriority)
                break;
            this.unpin(lowestPriority.agentId);
        }
    }
    /**
     * Update cross-reference threshold
     * @param threshold - New threshold
     */
    setCrossRefThreshold(threshold) {
        this.crossRefThreshold = threshold;
    }
}
//# sourceMappingURL=pinning-manager.js.map