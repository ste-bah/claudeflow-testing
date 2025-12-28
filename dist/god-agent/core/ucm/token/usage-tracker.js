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
import { DEFAULT_UCM_CONFIG } from '../config.js';
/**
 * Tracks token usage with warnings at configurable thresholds
 */
export class UsageTracker extends EventEmitter {
    config;
    records;
    agentUsage;
    phaseUsage;
    warningEmitted;
    constructor(config = DEFAULT_UCM_CONFIG.tokenManagement.defaults) {
        super();
        this.config = config;
        this.records = [];
        this.agentUsage = new Map();
        this.phaseUsage = new Map();
        this.warningEmitted = new Set();
    }
    /**
     * Record token usage for an agent operation
     * @param agent - Agent identifier
     * @param phase - Workflow phase
     * @param tokens - Number of tokens used
     * @param operation - Operation description
     */
    recordUsage(agent, phase, tokens, operation = 'unknown') {
        const timestamp = Date.now();
        // Create usage record
        const record = {
            agent,
            phase,
            tokens,
            timestamp,
            operation
        };
        this.records.push(record);
        // Update agent usage
        this.updateAgentUsage(agent, tokens, timestamp, operation);
        // Update phase usage
        this.updatePhaseUsage(phase, agent, tokens, timestamp);
        // Check thresholds and emit warnings
        this.checkThresholds(phase);
    }
    /**
     * Update agent-specific usage tracking
     */
    updateAgentUsage(agent, tokens, timestamp, operation) {
        let usage = this.agentUsage.get(agent);
        if (!usage) {
            usage = {
                agent,
                totalTokens: 0,
                recordCount: 0,
                firstSeen: timestamp,
                lastSeen: timestamp,
                operations: new Map()
            };
            this.agentUsage.set(agent, usage);
        }
        usage.totalTokens += tokens;
        usage.recordCount += 1;
        usage.lastSeen = timestamp;
        // Track per-operation usage
        const opTokens = usage.operations.get(operation) || 0;
        usage.operations.set(operation, opTokens + tokens);
    }
    /**
     * Update phase-specific usage tracking
     */
    updatePhaseUsage(phase, agent, tokens, timestamp) {
        let usage = this.phaseUsage.get(phase);
        if (!usage) {
            usage = {
                phase,
                totalTokens: 0,
                agents: new Set(),
                recordCount: 0,
                startTime: timestamp,
                lastUpdate: timestamp
            };
            this.phaseUsage.set(phase, usage);
        }
        usage.totalTokens += tokens;
        usage.agents.add(agent);
        usage.recordCount += 1;
        usage.lastUpdate = timestamp;
    }
    /**
     * Check usage thresholds and emit warnings
     * RULE-041: warningThreshold = 80%
     */
    checkThresholds(phase) {
        const phaseUsage = this.phaseUsage.get(phase);
        if (!phaseUsage)
            return;
        const totalUsage = this.getTotalUsage();
        const contextWindow = this.config.contextWindow ?? 200000;
        const percentUsed = (totalUsage / contextWindow) * 100;
        // Warning threshold (80%)
        const warningThreshold = this.config.warningThreshold ?? 0.8;
        const warningKey = `warning-${phase}`;
        if (percentUsed >= warningThreshold && !this.warningEmitted.has(warningKey)) {
            this.warningEmitted.add(warningKey);
            const warningEvent = {
                type: 'warning',
                message: `Token usage reached ${percentUsed.toFixed(1)}% of context window`,
                usage: totalUsage,
                threshold: warningThreshold ?? 0.8,
                percentUsed,
                phase
            };
            this.emit('usage-warning', warningEvent);
        }
        // Critical threshold (95%)
        const criticalThreshold = 95;
        const criticalKey = `critical-${phase}`;
        if (percentUsed >= criticalThreshold && !this.warningEmitted.has(criticalKey)) {
            this.warningEmitted.add(criticalKey);
            const criticalEvent = {
                type: 'critical',
                message: `Critical: Token usage at ${percentUsed.toFixed(1)}% of context window`,
                usage: totalUsage,
                threshold: criticalThreshold,
                percentUsed,
                phase
            };
            this.emit('usage-critical', criticalEvent);
        }
    }
    /**
     * Get usage statistics for a specific agent
     */
    getUsage(agent) {
        return this.agentUsage.get(agent);
    }
    /**
     * Get usage statistics for a specific phase
     */
    getPhaseUsage(phase) {
        return this.phaseUsage.get(phase);
    }
    /**
     * Get total token usage across all agents and phases
     */
    getTotalUsage() {
        return this.records.reduce((sum, record) => sum + record.tokens, 0);
    }
    /**
     * Get usage snapshot at current time
     */
    getSnapshot() {
        return {
            totalUsage: this.getTotalUsage(),
            agentCount: this.agentUsage.size,
            phaseCount: this.phaseUsage.size,
            recordCount: this.records.length,
            timestamp: Date.now()
        };
    }
    /**
     * Get all agent usage statistics
     */
    getAllAgentUsage() {
        return new Map(this.agentUsage);
    }
    /**
     * Get all phase usage statistics
     */
    getAllPhaseUsage() {
        return new Map(this.phaseUsage);
    }
    /**
     * Get usage records filtered by criteria
     */
    getRecords(filter) {
        if (!filter)
            return [...this.records];
        return this.records.filter(record => {
            if (filter.agent && record.agent !== filter.agent)
                return false;
            if (filter.phase && record.phase !== filter.phase)
                return false;
            if (filter.startTime && record.timestamp < filter.startTime)
                return false;
            if (filter.endTime && record.timestamp > filter.endTime)
                return false;
            return true;
        });
    }
    /**
     * Get top agents by token usage
     */
    getTopAgents(limit = 10) {
        return Array.from(this.agentUsage.values())
            .sort((a, b) => b.totalTokens - a.totalTokens)
            .slice(0, limit);
    }
    /**
     * Get phases sorted by token usage
     */
    getPhasesByUsage() {
        const phases = Array.from(this.phaseUsage.values());
        return phases.sort((a, b) => b.totalTokens - a.totalTokens);
    }
    /**
     * Reset usage tracking for a specific phase
     */
    resetPhase(phase) {
        // Remove phase usage
        this.phaseUsage.delete(phase);
        // Remove records for this phase
        this.records = this.records.filter(r => r.phase !== phase);
        // Clear warnings for this phase
        this.warningEmitted.delete(`warning-${phase}`);
        this.warningEmitted.delete(`critical-${phase}`);
        // Recalculate agent usage
        this.recalculateAgentUsage();
    }
    /**
     * Recalculate agent usage from remaining records
     */
    recalculateAgentUsage() {
        this.agentUsage.clear();
        for (const record of this.records) {
            this.updateAgentUsage(record.agent, record.tokens, record.timestamp, record.operation);
        }
    }
    /**
     * Reset all usage tracking
     */
    resetAll() {
        this.records = [];
        this.agentUsage.clear();
        this.phaseUsage.clear();
        this.warningEmitted.clear();
    }
    /**
     * Get all phase names
     */
    getPhaseNames() {
        return Array.from(this.phaseUsage.keys());
    }
    /**
     * Export usage data for analysis
     */
    exportData() {
        return {
            records: [...this.records],
            agentUsage: Array.from(this.agentUsage.values()),
            phaseUsage: Array.from(this.phaseUsage.values()),
            snapshot: this.getSnapshot()
        };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Re-check thresholds with new config
        const phaseNames = this.getPhaseNames();
        for (const phase of phaseNames) {
            this.warningEmitted.delete(`warning-${phase}`);
            this.warningEmitted.delete(`critical-${phase}`);
            this.checkThresholds(phase);
        }
    }
}
//# sourceMappingURL=usage-tracker.js.map