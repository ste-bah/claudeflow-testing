/**
 * Counterfactual Reasoning Engine
 * RSN-002 Implementation - What-If Scenario Analysis
 *
 * Purpose: Explore alternative worlds by simulating interventions
 * in the causal graph and predicting divergent outcomes
 *
 * Features:
 * - Abduction → Intervention → Prediction pipeline
 * - Alternative world construction
 * - Outcome divergence calculation
 * - Impact propagation through causal graph
 * - Scenario comparison
 *
 * Dependencies:
 * - CausalMemory: Causal graph traversal
 * - GraphDB: Node manipulation
 * - MemoryEngine: State persistence (optional)
 *
 * Performance Target: <200ms latency
 */
import type { IReasoningRequest } from '../reasoning-types.js';
import type { CounterfactualConfig, ICounterfactualResult, NodeID } from '../advanced-reasoning-types.js';
/**
 * Dependencies for CounterfactualEngine
 */
export interface CounterfactualEngineDependencies {
    /** Causal memory for graph traversal */
    causalMemory?: {
        getNode?(nodeId: NodeID): Promise<CausalNode | null>;
        getEffects?(nodeId: NodeID): Promise<NodeID[]>;
        findPaths?(from: NodeID, to: NodeID): Promise<CausalPath[]>;
    };
    /** Graph database for state queries */
    graphDB?: {
        getNodeValue?(nodeId: NodeID): Promise<unknown>;
        setNodeValue?(nodeId: NodeID, value: unknown): Promise<void>;
        getConnectedNodes?(nodeId: NodeID, direction: 'in' | 'out' | 'both'): Promise<NodeID[]>;
    };
    /** Memory engine for state persistence (optional) */
    memoryEngine?: {
        saveState?(key: string, state: unknown): Promise<void>;
        loadState?(key: string): Promise<unknown>;
    };
}
/**
 * Internal causal node representation
 */
interface CausalNode {
    id: NodeID;
    value: unknown;
    type: string;
    effects?: NodeID[];
    causes?: NodeID[];
    strength?: number;
}
/**
 * Causal path between nodes
 */
interface CausalPath {
    nodes: NodeID[];
    strength: number;
}
/**
 * Counterfactual reasoning engine
 *
 * Implements the Abduction → Intervention → Prediction pipeline
 * for "what-if" scenario analysis. Creates alternative worlds by
 * intervening on causal nodes and propagating effects.
 *
 * @example
 * ```typescript
 * const engine = new CounterfactualEngine({ causalMemory, graphDB });
 * const result = await engine.reason(
 *   { query: 'What if we used a different database?' },
 *   {
 *     intervention: {
 *       nodeId: 'database-choice',
 *       originalValue: 'PostgreSQL',
 *       counterfactualValue: 'MongoDB'
 *     }
 *   }
 * );
 * // result.scenarios contains divergent outcomes
 * ```
 */
export declare class CounterfactualEngine {
    private deps;
    constructor(deps: CounterfactualEngineDependencies);
    /**
     * Perform counterfactual reasoning on a query
     *
     * @param request - The reasoning request containing the query
     * @param config - Counterfactual configuration with intervention
     * @returns Counterfactual result with scenarios
     */
    reason(_request: IReasoningRequest, config: CounterfactualConfig): Promise<ICounterfactualResult>;
    /**
     * Compute baseline outcomes from intervention node
     */
    private computeBaselineOutcomes;
    /**
     * Get effects of a node
     */
    private getNodeEffects;
    /**
     * Generate synthetic effects for testing/fallback
     */
    private generateSyntheticEffects;
    /**
     * Simple string hash function
     */
    private hashString;
    /**
     * Create alternative worlds with intervention applied
     */
    private createAlternativeWorlds;
    /**
     * Create world with direct intervention
     */
    private createInterventionWorld;
    /**
     * Create variant world with modified intervention
     */
    private createVariantWorld;
    /**
     * Create variant value for alternative scenarios
     */
    private createVariantValue;
    /**
     * Compute counterfactual scenario for an alternative world
     */
    private computeScenario;
    /**
     * Propagate intervention effects through causal graph
     */
    private propagateIntervention;
    /**
     * Calculate divergence between baseline and counterfactual outcomes
     */
    private calculateDivergence;
    /**
     * Identify nodes impacted by intervention
     */
    private identifyImpactedNodes;
    /**
     * Calculate confidence for a single scenario
     */
    private calculateScenarioConfidence;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Format answer from scenarios
     */
    private formatAnswer;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
}
/**
 * Create a configured CounterfactualEngine instance
 */
export declare function createCounterfactualEngine(deps: CounterfactualEngineDependencies): CounterfactualEngine;
export {};
//# sourceMappingURL=counterfactual-engine.d.ts.map