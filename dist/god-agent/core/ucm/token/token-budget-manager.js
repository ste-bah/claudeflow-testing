/**
 * Token Budget Manager (BDG-001)
 * Allocates and tracks token budgets per workflow phase and context tier
 *
 * Constitution Rules Applied:
 * - RULE-007: contextWindow = 100,000 tokens
 * - RULE-008: maxOutputTokens = 15,000
 * - RULE-017: Pinned tier max 2,000 tokens
 * - RULE-018: Summary max 200 tokens per agent
 * - RULE-043: Summarization budget allocation
 */
import { DEFAULT_UCM_CONFIG } from '../config.js';
import { BudgetAllocationError } from '../errors.js';
/**
 * Manages token budget allocation across context tiers and workflow phases
 */
export class TokenBudgetManager {
    config;
    summaryConfig;
    allocations;
    tierBudgets;
    maxOutputTokens;
    pinnedContextMaxTokens;
    constructor(config = DEFAULT_UCM_CONFIG.tokenManagement.defaults, summaryConfig = DEFAULT_UCM_CONFIG.tokenManagement.summarization, maxOutputTokens = 15000, pinnedContextMaxTokens = 2000) {
        this.config = config;
        this.summaryConfig = summaryConfig;
        this.maxOutputTokens = maxOutputTokens;
        this.pinnedContextMaxTokens = pinnedContextMaxTokens;
        this.allocations = new Map();
        this.tierBudgets = this.calculateTierBudgets();
    }
    /**
     * Calculate initial tier budgets based on constitution rules
     */
    calculateTierBudgets() {
        const contextWindow = this.config.contextWindow ?? 200000;
        const maxOutput = this.maxOutputTokens;
        const availableForContext = contextWindow - maxOutput; // Reserve for output
        // RULE-017: Pinned tier max 2,000 tokens
        const pinnedBudget = Math.min(2000, this.pinnedContextMaxTokens);
        // Remaining budget split between active and archived
        const remainingBudget = availableForContext - pinnedBudget;
        // Active window gets priority (70% of remaining)
        const activeBudget = Math.floor(remainingBudget * 0.7);
        // Archived gets the rest (30% of remaining)
        const archivedBudget = remainingBudget - activeBudget;
        return {
            pinned: pinnedBudget,
            active: activeBudget,
            archived: archivedBudget
        };
    }
    /**
     * Allocate budget for a specific workflow phase
     * @param phase - Workflow phase name
     * @param phaseSettings - Phase-specific settings
     * @param agentCount - Number of agents in the phase
     * @returns Allocated budget breakdown
     */
    allocate(phase, phaseSettings, agentCount = 1) {
        // Calculate phase-specific budgets
        const phaseMaxTokens = phaseSettings.maxActiveTokens || 50000;
        const pinnedBudget = Math.min(this.tierBudgets.pinned, phaseMaxTokens * 0.1 // 10% for pinned
        );
        // Active window budget based on phase settings
        const activeWindowBudget = Math.min(this.tierBudgets.active, phaseMaxTokens - pinnedBudget);
        // RULE-018: Summary max 200 tokens per agent
        const summaryTokensPerAgent = Math.min(200, this.summaryConfig.maxTokens);
        const archivedSummariesBudget = Math.min(this.tierBudgets.archived, summaryTokensPerAgent * agentCount * 2 // Buffer for multiple summaries
        );
        const totalBudget = pinnedBudget + activeWindowBudget + archivedSummariesBudget;
        // Validate against context window (RULE-007)
        const availableContext = (this.config.contextWindow ?? 200000) - this.maxOutputTokens;
        if (totalBudget > availableContext) {
            throw new BudgetAllocationError(totalBudget, availableContext);
        }
        const allocation = {
            phase,
            pinned: Math.floor(pinnedBudget),
            activeWindow: Math.floor(activeWindowBudget),
            archivedSummaries: Math.floor(archivedSummariesBudget),
            total: Math.floor(totalBudget),
            timestamp: Date.now()
        };
        this.allocations.set(phase, allocation);
        return allocation;
    }
    /**
     * Get remaining budget for a phase
     * @param phase - Workflow phase name
     * @param currentUsage - Current token usage
     * @returns Remaining budget by tier
     */
    getRemaining(phase, currentUsage) {
        const allocation = this.allocations.get(phase);
        if (!allocation) {
            throw new Error(`No budget allocation found for phase: ${phase}`);
        }
        const remaining = Math.max(0, allocation.total - currentUsage);
        const percentUsed = (currentUsage / allocation.total) * 100;
        return {
            allocated: allocation.total,
            used: currentUsage,
            remaining,
            percentUsed
        };
    }
    /**
     * Check if a token allocation request can be satisfied
     * @param phase - Workflow phase name
     * @param requestedTokens - Tokens requested
     * @param currentUsage - Current token usage
     * @returns True if allocation can be satisfied
     */
    canAllocate(phase, requestedTokens, currentUsage) {
        try {
            const status = this.getRemaining(phase, currentUsage);
            return status.remaining >= requestedTokens;
        }
        catch {
            return false;
        }
    }
    /**
     * Get allocation for a specific phase
     */
    getAllocation(phase) {
        return this.allocations.get(phase);
    }
    /**
     * Get all allocations
     */
    getAllAllocations() {
        return new Map(this.allocations);
    }
    /**
     * Get tier budgets
     */
    getTierBudgets() {
        return { ...this.tierBudgets };
    }
    /**
     * Update configuration and recalculate budgets
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.tierBudgets = this.calculateTierBudgets();
        // Recalculate existing allocations if needed
        // This is conservative - existing allocations remain valid
    }
    /**
     * Clear allocation for a phase (when phase completes)
     */
    clearAllocation(phase) {
        return this.allocations.delete(phase);
    }
    /**
     * Clear all allocations
     */
    clearAll() {
        this.allocations.clear();
    }
    /**
     * Get budget statistics
     */
    getStatistics() {
        const allocations = Array.from(this.allocations.values());
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.total, 0);
        return {
            totalAllocated,
            activePhases: this.allocations.size,
            tierBudgets: this.getTierBudgets(),
            allocations
        };
    }
}
//# sourceMappingURL=token-budget-manager.js.map