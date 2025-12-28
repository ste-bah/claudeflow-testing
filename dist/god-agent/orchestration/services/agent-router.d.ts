/**
 * Agent Router Service
 *
 * Implements: TASK-ORC-011 (TECH-ORC-001 lines 879-941, 1130-1175)
 *
 * Routes tasks to appropriate agents based on detected workflow phase
 * using keyword matching with confidence scoring.
 *
 * @module orchestration/services/agent-router
 */
import type { IAgentRouting, IPhaseAgentMapping } from '../types.js';
/**
 * Routing options
 */
export interface IRoutingOptions {
    /** Preferred agent type (overrides detection) */
    preferredAgent?: string;
    /** Enable fallback to default agent if unavailable */
    fallbackEnabled?: boolean;
}
/**
 * Service that routes tasks to appropriate agent types
 */
export declare class AgentRouter {
    private phaseMapping;
    /**
     * Initialize agent router
     *
     * @param phaseMapping - Custom phase mappings (optional)
     */
    constructor(phaseMapping?: IPhaseAgentMapping[]);
    /**
     * Route task to appropriate agent based on phase detection
     *
     * From TECH-ORC-001 lines 895-911
     *
     * @param taskDescription - Task description
     * @param options - Routing options
     * @returns Agent routing decision
     */
    routeToAgent(taskDescription: string, options?: IRoutingOptions): IAgentRouting;
    /**
     * Detect workflow phase from task description
     *
     * From TECH-ORC-001 lines 914-922
     *
     * @param description - Task description
     * @returns Detected phase and confidence score
     * @private
     */
    private detectPhase;
    /**
     * Check if agent is available
     *
     * From TECH-ORC-001 lines 925-931
     *
     * @param agentType - Agent type to check
     * @returns Whether agent is available
     * @private
     */
    private isAgentAvailable;
    /**
     * Create fallback routing for low confidence or errors
     *
     * @param taskDescription - Task description
     * @param timestamp - Timestamp
     * @param confidence - Detection confidence (optional)
     * @returns Fallback routing decision
     * @private
     */
    private createFallbackRouting;
    /**
     * Store routing ambiguity for learning
     *
     * From TECH-ORC-001 lines 1162-1174
     *
     * @param taskDescription - Task description
     * @param detectedPhase - Detected phase
     * @param confidence - Confidence score
     * @private
     */
    private storeRoutingAmbiguity;
    /**
     * Get default phase-agent mappings
     *
     * From TECH-ORC-001 lines 934-940
     *
     * @returns Array of phase mappings
     * @static
     */
    static getDefaultMappings(): IPhaseAgentMapping[];
}
//# sourceMappingURL=agent-router.d.ts.map