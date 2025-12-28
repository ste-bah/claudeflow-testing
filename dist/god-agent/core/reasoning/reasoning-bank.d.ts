/**
 * ReasoningBank - Main Unified Reasoning Interface
 *
 * Orchestrates all 4 reasoning modes:
 * 1. Pattern-Match: Template-based reasoning from historical patterns
 * 2. Causal-Inference: Graph-based cause-effect reasoning
 * 3. Contextual: GNN-enhanced semantic similarity
 * 4. Hybrid: Weighted combination of all modes
 *
 * Integrates with Sona for continuous learning through feedback.
 *
 * Performance targets:
 * - Pattern-match: <10ms
 * - Causal-inference: <20ms
 * - Contextual: <30ms
 * - Hybrid: <30ms (without GNN)
 */
import { PatternMatcher } from './pattern-matcher.js';
import { CausalMemory } from './causal-memory.js';
import type { VectorDB } from '../vector-db/vector-db.js';
import type { SonaEngine } from '../learning/sona-engine.js';
import type { ProvenanceStore } from './provenance-store.js';
import { type IReasoningRequest, type IReasoningResponse, type ILearningFeedback, type ReasoningBankConfig } from './reasoning-types.js';
/**
 * Dependencies required to construct ReasoningBank
 */
export interface ReasoningBankDependencies {
    patternMatcher: PatternMatcher;
    causalMemory: CausalMemory;
    vectorDB: VectorDB;
    sonaEngine?: SonaEngine;
    provenanceStore?: ProvenanceStore;
    config?: Partial<ReasoningBankConfig>;
}
/**
 * ReasoningBank - Unified reasoning orchestrator
 *
 * Main entry point for all reasoning operations in the God Agent.
 * Coordinates pattern matching, causal inference, contextual reasoning,
 * and hybrid approaches while tracking learning trajectories.
 */
export declare class ReasoningBank {
    private patternMatcher;
    private causalMemory;
    private vectorDB;
    private gnnEnhancer;
    private trajectoryTracker;
    private _modeSelector;
    private config;
    private initialized;
    private sonaEngine?;
    private provenanceStore?;
    constructor(deps: ReasoningBankDependencies);
    /**
     * Initialize all components
     * Must be called before using reason()
     */
    initialize(): Promise<void>;
    /**
     * Set SonaEngine for feedback loop integration (late binding)
     * Called after SonaEngine is initialized to break circular dependency
     */
    setSonaEngine(engine: SonaEngine): void;
    /**
     * Get L-Score for a pattern or inference
     * Uses ProvenanceStore lookup with fallback to default
     *
     * @param id - Pattern ID or inference node ID
     * @returns L-Score value (0-1), defaults to 0.5 if not found
     */
    private getLScoreForId;
    /**
     * Main reasoning API entry point
     *
     * Executes reasoning based on the request type (or auto-selects mode).
     * Tracks trajectories for learning and applies GNN enhancement if requested.
     *
     * @param request - Reasoning request with query and parameters
     * @returns Reasoning response with patterns, inferences, and metadata
     */
    reason(request: IReasoningRequest): Promise<IReasoningResponse>;
    /**
     * Pattern-match reasoning mode
     *
     * Finds historical patterns similar to the query embedding.
     * Filters by confidence and L-Score thresholds.
     */
    private patternMatchReasoning;
    /**
     * Causal-inference reasoning mode
     *
     * Uses VectorDB to find relevant nodes, then infers consequences
     * through the causal graph using edge weights and transitivity.
     */
    private causalInferenceReasoning;
    /**
     * Contextual reasoning mode
     *
     * Uses GNN-enhanced embeddings for semantic similarity search.
     * Leverages graph structure to improve context understanding.
     */
    private contextualReasoning;
    /**
     * Hybrid reasoning mode
     *
     * Combines all reasoning modes with configurable weights.
     * Executes modes in parallel for optimal performance.
     */
    private hybridReasoning;
    /**
     * Provide feedback for a trajectory (Sona integration)
     *
     * Updates trajectory with feedback quality.
     * High quality (>= 0.8) triggers pattern creation.
     *
     * @param feedback - Learning feedback with quality score
     */
    provideFeedback(feedback: ILearningFeedback): Promise<void>;
    /**
     * Close and cleanup resources
     */
    close(): Promise<void>;
    /**
     * Validate reasoning request
     */
    private validateRequest;
    /**
     * Apply GNN enhancement to embedding
     */
    private applyGNNEnhancement;
    /**
     * Calculate provenance information from results
     *
     * Uses geometric mean for combined L-Score to account for
     * multiplicative uncertainty across sources.
     */
    private calculateProvenanceInfo;
    /**
     * Build standardized reasoning response
     */
    private buildResponse;
    /**
     * Generate deterministic node ID from trajectory data
     */
    private generateCausalNodeId;
    /**
     * Ensure a causal node exists, create if missing
     */
    private ensureNodeExists;
    /**
     * Create causal hyperedge from high-quality trajectory
     * Called when feedback.quality >= 0.8
     */
    private createCausalHyperedge;
    /**
     * Infer task type from request context
     *
     * Uses heuristics to determine task type when not explicitly provided.
     * Can be extended with more sophisticated classification.
     */
    private inferTaskType;
    /**
     * Convert ReasoningMode to SonaEngine route string
     *
     * Maps reasoning modes to route identifiers for trajectory tracking.
     * Routes are used by SonaEngine for per-task-type weight management.
     */
    private inferRouteFromReasoningMode;
}
//# sourceMappingURL=reasoning-bank.d.ts.map