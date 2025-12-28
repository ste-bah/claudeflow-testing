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
import type { ITokenConfig, IPhaseSettings, ISummarizationConfig } from '../types.js';
export interface IBudgetAllocation {
    phase: string;
    pinned: number;
    activeWindow: number;
    archivedSummaries: number;
    total: number;
    timestamp: number;
}
export interface ITierBudget {
    pinned: number;
    active: number;
    archived: number;
}
export interface IBudgetStatus {
    allocated: number;
    used: number;
    remaining: number;
    percentUsed: number;
}
/**
 * Manages token budget allocation across context tiers and workflow phases
 */
export declare class TokenBudgetManager {
    private config;
    private summaryConfig;
    private allocations;
    private tierBudgets;
    private maxOutputTokens;
    private pinnedContextMaxTokens;
    constructor(config?: ITokenConfig, summaryConfig?: ISummarizationConfig, maxOutputTokens?: number, pinnedContextMaxTokens?: number);
    /**
     * Calculate initial tier budgets based on constitution rules
     */
    private calculateTierBudgets;
    /**
     * Allocate budget for a specific workflow phase
     * @param phase - Workflow phase name
     * @param phaseSettings - Phase-specific settings
     * @param agentCount - Number of agents in the phase
     * @returns Allocated budget breakdown
     */
    allocate(phase: string, phaseSettings: IPhaseSettings, agentCount?: number): IBudgetAllocation;
    /**
     * Get remaining budget for a phase
     * @param phase - Workflow phase name
     * @param currentUsage - Current token usage
     * @returns Remaining budget by tier
     */
    getRemaining(phase: string, currentUsage: number): IBudgetStatus;
    /**
     * Check if a token allocation request can be satisfied
     * @param phase - Workflow phase name
     * @param requestedTokens - Tokens requested
     * @param currentUsage - Current token usage
     * @returns True if allocation can be satisfied
     */
    canAllocate(phase: string, requestedTokens: number, currentUsage: number): boolean;
    /**
     * Get allocation for a specific phase
     */
    getAllocation(phase: string): IBudgetAllocation | undefined;
    /**
     * Get all allocations
     */
    getAllAllocations(): Map<string, IBudgetAllocation>;
    /**
     * Get tier budgets
     */
    getTierBudgets(): ITierBudget;
    /**
     * Update configuration and recalculate budgets
     */
    updateConfig(config: Partial<ITokenConfig>): void;
    /**
     * Clear allocation for a phase (when phase completes)
     */
    clearAllocation(phase: string): boolean;
    /**
     * Clear all allocations
     */
    clearAll(): void;
    /**
     * Get budget statistics
     */
    getStatistics(): {
        totalAllocated: number;
        activePhases: number;
        tierBudgets: ITierBudget;
        allocations: IBudgetAllocation[];
    };
}
//# sourceMappingURL=token-budget-manager.d.ts.map