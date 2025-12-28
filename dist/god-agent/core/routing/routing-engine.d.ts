/**
 * DAI-003: Routing Engine Implementation
 *
 * TASK-007: Routing Engine
 * Constitution: RULE-DAI-003-001, RULE-DAI-003-003, RULE-DAI-003-005, RULE-DAI-003-006
 *
 * Core routing engine that:
 * - Selects agents based on task analysis and capability matching
 * - Provides explainable routing decisions with factors
 * - Handles cold start behavior with explicit phase indication
 * - Requires confirmation for low-confidence decisions (< 0.7)
 * - NO external LLM calls (pure deterministic routing)
 *
 * Performance target: < 150ms (P95) per RULE-DAI-003-005
 *
 * @module src/god-agent/core/routing/routing-engine
 */
import type { IRoutingEngine, IRoutingResult, ITaskAnalysis, IRoutingConfig, ColdStartPhase } from './routing-types.js';
import { CapabilityIndex } from './capability-index.js';
/**
 * Configuration for RoutingEngine
 */
export interface IRoutingEngineConfig {
    /** Capability index instance (optional, creates one if not provided) */
    capabilityIndex?: CapabilityIndex;
    /** Routing configuration (optional, uses defaults) */
    routingConfig?: IRoutingConfig;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
}
/**
 * Routing engine for intelligent agent selection
 * Implements explainable, deterministic routing with cold start handling
 *
 * @implements IRoutingEngine
 */
export declare class RoutingEngine implements IRoutingEngine {
    private readonly capabilityIndex;
    private readonly config;
    private readonly verbose;
    private executionCount;
    constructor(config?: IRoutingEngineConfig);
    /**
     * Route a task to an agent
     * Per RULE-DAI-003-001: Every routing result must include explanation
     * Per RULE-DAI-003-003: Low confidence (< 0.7) requires confirmation
     * Per RULE-DAI-003-005: NO external LLM calls
     * Per RULE-DAI-003-006: Cold start mode must be explicit
     *
     * @param analysis - Task analysis result
     * @returns Routing result with explanation, factors, and alternatives
     * @throws RoutingError if routing fails
     */
    route(analysis: ITaskAnalysis): Promise<IRoutingResult>;
    /**
     * Get current execution count
     *
     * @returns Execution count
     */
    getExecutionCount(): number;
    /**
     * Get current cold start phase
     *
     * @returns Cold start phase
     */
    getColdStartPhase(): ColdStartPhase;
    /**
     * Create routing result for explicit agent preference
     * Bypasses normal routing logic when user specifies an agent
     *
     * @param analysis - Task analysis
     * @param startTime - Start time for performance tracking
     * @returns Routing result with preference flag
     */
    private createPreferenceResult;
    /**
     * Score agents by combining capability and keyword matching
     * Uses cold start weights to balance similarity vs keyword matching
     *
     * @param matches - Capability matches from index
     * @param analysis - Task analysis
     * @param keywordWeight - Weight for keyword matching
     * @param capabilityWeight - Weight for capability (embedding) matching
     * @returns Scored matches with combined scores
     */
    private scoreAgents;
    /**
     * Calculate keyword matching score
     * Compares task verbs and keywords with agent capabilities
     *
     * @param agentKeywords - Agent capability keywords
     * @param taskVerbs - Task verbs
     * @param taskText - Full task text
     * @returns Keyword score (0-1)
     */
    private calculateKeywordScore;
    /**
     * Get historical success score for agent
     * Placeholder for future learning integration
     *
     * @param _agentKey - Agent key (unused in placeholder)
     * @returns Historical score (0-1) or 0 if no history
     */
    private getHistoricalScore;
    /**
     * Build factors array for explanation
     * Per RULE-DAI-003-001: Explanation must include factors
     *
     * @param match - Selected match
     * @param keywordWeight - Keyword weight
     * @param capabilityWeight - Capability weight
     * @param analysis - Task analysis
     * @returns Array of routing factors
     */
    private buildFactors;
    /**
     * Get primary factor (highest weighted score contribution)
     *
     * @param factors - Routing factors
     * @returns Primary factor
     */
    private getPrimaryFactor;
    /**
     * Build human-readable explanation of routing decision
     * Per RULE-DAI-003-001: Every result must include explanation
     *
     * @param match - Selected match
     * @param confidence - Final confidence score
     * @param primaryFactor - Primary contributing factor
     * @param coldStartPhase - Current cold start phase
     * @param analysis - Task analysis
     * @returns Explanation string
     */
    private buildExplanation;
    /**
     * Build alternatives list
     * Shows up to 3 alternative agents with scores and reasons
     *
     * @param matches - Alternative matches (top 3)
     * @returns Array of routing alternatives
     */
    private buildAlternatives;
    /**
     * Determine confirmation level based on confidence
     * Per RULE-DAI-003-003: Low confidence (< 0.7) requires confirmation
     *
     * Thresholds:
     * - >= 0.9: auto (auto-execute)
     * - 0.7-0.9: show (show decision, proceed)
     * - 0.5-0.7: confirm (require confirmation)
     * - < 0.5: select (require selection from top 5)
     *
     * @param confidence - Routing confidence
     * @returns Confirmation level and flag
     */
    private determineConfirmationLevel;
}
//# sourceMappingURL=routing-engine.d.ts.map