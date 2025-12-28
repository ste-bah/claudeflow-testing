/**
 * Usage Tracker (BDG-002)
 * Tracks token usage across agents and workflow phases
 *
 * Constitution Rules Applied:
 * - RULE-007: contextWindow = 100,000 tokens
 * - RULE-041: warningThreshold = 80%
 * - RULE-042: summarizationThreshold = 70%
 */
import { EventEmitter } from 'events';
import type { ITokenConfig } from '../types.js';
export interface IUsageRecord {
    agent: string;
    phase: string;
    tokens: number;
    timestamp: number;
    operation: string;
}
export interface IAgentUsage {
    agent: string;
    totalTokens: number;
    recordCount: number;
    firstSeen: number;
    lastSeen: number;
    operations: Map<string, number>;
}
export interface IPhaseUsage {
    phase: string;
    totalTokens: number;
    agents: Set<string>;
    recordCount: number;
    startTime: number;
    lastUpdate: number;
}
export interface IUsageSnapshot {
    totalUsage: number;
    agentCount: number;
    phaseCount: number;
    recordCount: number;
    timestamp: number;
}
export interface IWarningEvent {
    type: 'warning' | 'critical';
    message: string;
    usage: number;
    threshold: number;
    percentUsed: number;
    phase?: string;
    agent?: string;
}
/**
 * Tracks token usage with warnings at configurable thresholds
 */
export declare class UsageTracker extends EventEmitter {
    private config;
    private records;
    private agentUsage;
    private phaseUsage;
    private warningEmitted;
    constructor(config?: ITokenConfig);
    /**
     * Record token usage for an agent operation
     * @param agent - Agent identifier
     * @param phase - Workflow phase
     * @param tokens - Number of tokens used
     * @param operation - Operation description
     */
    recordUsage(agent: string, phase: string, tokens: number, operation?: string): void;
    /**
     * Update agent-specific usage tracking
     */
    private updateAgentUsage;
    /**
     * Update phase-specific usage tracking
     */
    private updatePhaseUsage;
    /**
     * Check usage thresholds and emit warnings
     * RULE-041: warningThreshold = 80%
     */
    private checkThresholds;
    /**
     * Get usage statistics for a specific agent
     */
    getUsage(agent: string): IAgentUsage | undefined;
    /**
     * Get usage statistics for a specific phase
     */
    getPhaseUsage(phase: string): IPhaseUsage | undefined;
    /**
     * Get total token usage across all agents and phases
     */
    getTotalUsage(): number;
    /**
     * Get usage snapshot at current time
     */
    getSnapshot(): IUsageSnapshot;
    /**
     * Get all agent usage statistics
     */
    getAllAgentUsage(): Map<string, IAgentUsage>;
    /**
     * Get all phase usage statistics
     */
    getAllPhaseUsage(): Map<string, IPhaseUsage>;
    /**
     * Get usage records filtered by criteria
     */
    getRecords(filter?: {
        agent?: string;
        phase?: string;
        startTime?: number;
        endTime?: number;
    }): IUsageRecord[];
    /**
     * Get top agents by token usage
     */
    getTopAgents(limit?: number): IAgentUsage[];
    /**
     * Get phases sorted by token usage
     */
    getPhasesByUsage(): IPhaseUsage[];
    /**
     * Reset usage tracking for a specific phase
     */
    resetPhase(phase: string): void;
    /**
     * Recalculate agent usage from remaining records
     */
    private recalculateAgentUsage;
    /**
     * Reset all usage tracking
     */
    resetAll(): void;
    /**
     * Get all phase names
     */
    getPhaseNames(): string[];
    /**
     * Export usage data for analysis
     */
    exportData(): {
        records: IUsageRecord[];
        agentUsage: IAgentUsage[];
        phaseUsage: IPhaseUsage[];
        snapshot: IUsageSnapshot;
    };
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ITokenConfig>): void;
}
//# sourceMappingURL=usage-tracker.d.ts.map