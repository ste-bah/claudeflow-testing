/**
 * AbductiveEngine - Backward Causal Inference for Best Explanation
 * SPEC-RSN-002 Section 2.2: Abductive Reasoning Mode
 *
 * Implements inference to best explanation by:
 * 1. Extracting observed effects from query
 * 2. Backward traversing causal graph to find potential causes
 * 3. Generating hypotheses (cause combinations)
 * 4. Scoring hypotheses by coverage, parsimony (Occam's Razor), and prior probability
 * 5. Returning best explanation with confidence
 *
 * Performance Target: <100ms for 3-hop backward traversal
 *
 * Algorithm:
 * - Uses VectorDB for semantic effect extraction
 * - Uses CausalMemory.findCauses() for backward graph traversal
 * - Implements Occam's Razor weighting for simpler explanations
 * - Evaluates 5-20 hypotheses per query
 */
import type { CausalMemory } from '../causal-memory.js';
import type { VectorDB } from '../../vector-db/vector-db.js';
import type { IReasoningRequest } from '../reasoning-types.js';
import type { AbductiveConfig, IAbductiveResult } from '../advanced-reasoning-types.js';
/**
 * Dependencies for AbductiveEngine
 */
export interface AbductiveEngineDependencies {
    /** Causal graph for backward traversal */
    causalMemory: CausalMemory;
    /** Vector database for semantic search */
    vectorDB: VectorDB;
}
/**
 * AbductiveEngine - Infer best explanation from observed effects
 *
 * Implementation of backward causal reasoning to find most likely causes
 * for observed effects using Occam's Razor and Bayesian priors.
 */
export declare class AbductiveEngine {
    private causalMemory;
    private vectorDB;
    constructor(deps: AbductiveEngineDependencies);
    /**
     * Perform abductive reasoning to find best explanation for observed effects
     *
     * Algorithm:
     * 1. Parse observed effects from query embedding
     * 2. Backward traverse causal graph from effects to potential causes
     * 3. Generate hypotheses (cause combinations)
     * 4. Score hypotheses by:
     *    - Explanatory coverage (how many effects explained)
     *    - Parsimony (simpler = better, weighted by occamWeight)
     *    - Prior probability (from pattern frequency)
     * 5. Return best explanation with confidence
     *
     * @param request - Reasoning request with query embedding
     * @param config - Abductive configuration
     * @returns Abductive result with ranked explanations
     */
    reason(request: IReasoningRequest, config: AbductiveConfig): Promise<IAbductiveResult>;
    /**
     * Extract effects from query using VectorDB semantic search
     *
     * @param embedding - Query embedding vector
     * @param maxEffects - Maximum number of effects to extract
     * @returns Array of node IDs representing observed effects
     */
    private extractEffects;
    /**
     * Generate hypotheses from causal chains
     *
     * Creates both single-cause and multi-cause hypotheses (up to 3 causes combined)
     *
     * @param chains - Causal chains from backward traversal
     * @param allCauses - All unique causes found
     * @param limit - Maximum number of hypotheses to generate
     * @returns Array of hypotheses
     */
    private generateHypotheses;
    /**
     * Score a hypothesis using explanatory coverage, parsimony, and prior probability
     *
     * Score formula:
     * score = (coverage * (1 - occamWeight)) + (parsimony * occamWeight)
     *
     * Coverage: % of effects explained by this hypothesis
     * Parsimony: Inverse of hypothesis complexity (fewer causes = higher)
     *
     * @param hypothesis - Hypothesis to score
     * @param observedEffects - Observed effects to explain
     * @param occamWeight - Weight for Occam's Razor [0, 1]
     * @returns Scored hypothesis with metrics
     */
    private scoreHypothesis;
    /**
     * Convert scored hypothesis to explanation
     *
     * @param scoredHypothesis - Scored hypothesis to convert
     * @param totalAlternatives - Total number of alternative explanations
     * @param isBest - Whether this is the best explanation
     * @returns Abductive explanation
     */
    private toExplanation;
    /**
     * Build human-readable hypothesis description
     *
     * @param causes - Cause node IDs
     * @returns Description string
     */
    private buildHypothesisDescription;
    /**
     * Get node label from causal memory
     *
     * @param nodeId - Node ID
     * @returns Node label or ID if not found
     */
    private getNodeLabel;
    /**
     * Calculate combined L-Score from explanations
     *
     * @param explanations - Array of explanations
     * @returns Combined L-Score (geometric mean)
     */
    private calculateCombinedLScore;
    /**
     * Generate trajectory ID for tracking
     *
     * @returns Trajectory ID
     */
    private generateTrajectoryId;
    /**
     * Create empty result when no explanations found
     *
     * @param request - Original request
     * @param processingTimeMs - Processing time
     * @returns Empty abductive result
     */
    private createEmptyResult;
    /**
     * Format answer from explanations
     */
    private formatAnswer;
    /**
     * Generate reasoning steps from explanations
     */
    private generateReasoningSteps;
}
//# sourceMappingURL=abductive-engine.d.ts.map