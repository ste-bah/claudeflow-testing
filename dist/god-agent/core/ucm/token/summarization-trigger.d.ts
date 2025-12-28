/**
 * Summarization Trigger (BDG-003)
 * Determines when context summarization is needed based on token usage
 *
 * Constitution Rules Applied:
 * - RULE-042: summarizationThreshold = 70%
 * - RULE-043: Summarization budget allocation
 * - RULE-044: Emergency summarization at 90%
 */
import type { ITokenConfig, ISummarizationConfig } from '../types.js';
export interface ITriggerReason {
    triggered: boolean;
    reason: string;
    severity: 'normal' | 'high' | 'critical';
    percentUsed: number;
    threshold: number;
    details?: Record<string, unknown>;
}
export interface ISummarizationDecision {
    shouldSummarize: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reason: ITriggerReason;
    recommendedAction: string;
    estimatedSavings?: number;
}
export interface ISummarizationContext {
    phase: string;
    currentUsage: number;
    budgetAllocated: number;
    agentCount: number;
    activeWindowSize: number;
}
/**
 * Determines when summarization should be triggered based on usage patterns
 */
export declare class SummarizationTrigger {
    private config;
    private summaryConfig;
    constructor(config?: ITokenConfig, summaryConfig?: ISummarizationConfig);
    /**
     * Determine if summarization should be triggered
     * RULE-042: summarizationThreshold = 70%
     *
     * @param context - Current summarization context
     * @returns Decision with reasoning and urgency
     */
    shouldSummarize(context: ISummarizationContext): ISummarizationDecision;
    /**
     * Get the specific trigger reason with details
     */
    getTriggerReason(context: ISummarizationContext): ITriggerReason;
    /**
     * Calculate urgency level based on usage and severity
     */
    private calculateUrgency;
    /**
     * Estimate token savings from summarization
     * RULE-018: Summary max 200 tokens per agent
     */
    private estimateSavings;
    /**
     * Get recommended action based on urgency
     */
    private getRecommendedAction;
    /**
     * Check if emergency summarization is needed
     * RULE-044: Emergency at 90%
     */
    isEmergency(currentUsage: number, budgetAllocated: number): boolean;
    /**
     * Check if proactive summarization is recommended
     * Between 70-80%
     */
    isProactiveRecommended(currentUsage: number, budgetAllocated: number): boolean;
    /**
     * Get next summarization threshold that will be crossed
     */
    getNextThreshold(currentUsage: number, budgetAllocated: number): {
        threshold: number;
        tokensUntil: number;
        severity: 'normal' | 'high' | 'critical';
    } | null;
    /**
     * Calculate optimal batch size for summarization
     * Returns number of agents to summarize in one batch
     */
    getOptimalBatchSize(context: ISummarizationContext): number;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ITokenConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ITokenConfig;
}
//# sourceMappingURL=summarization-trigger.d.ts.map