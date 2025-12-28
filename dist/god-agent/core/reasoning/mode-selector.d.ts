/**
 * Mode Selector - Automatic Reasoning Mode Selection
 *
 * Analyzes request characteristics to select optimal reasoning mode:
 * - Pattern-Match: Template-like queries, well-defined tasks
 * - Causal-Inference: Cause-effect reasoning, multi-step logic
 * - Contextual: Open-ended queries, semantic similarity
 * - Hybrid: Complex queries needing multiple approaches
 *
 * Selection latency: <2ms
 *
 * @module god-agent/core/reasoning/mode-selector
 */
import { ReasoningMode, ModeSelectionResult } from './reasoning-types.js';
import { TaskType } from './pattern-types.js';
/**
 * Extended reasoning request with string query for mode selection
 *
 * ModeSelector works with high-level string queries before embedding.
 * The query field here is a string that will be analyzed for keywords,
 * patterns, etc.
 */
export interface ModeSelectionRequest {
    /** Query string to analyze */
    query: string;
    /** Optional reasoning mode override */
    type?: ReasoningMode;
    /** Optional task type for filtering */
    taskType?: TaskType;
    /** Optional context data */
    context?: Record<string, any>;
    /** Optional context embeddings */
    contextEmbeddings?: Float32Array[];
    /** Optional metadata */
    metadata?: Record<string, any>;
}
/**
 * Configuration for mode selector
 */
export interface ModeSelectorConfig {
    /** Threshold for pattern-match mode selection (default: 0.6) */
    patternMatchThreshold?: number;
    /** Threshold for causal-inference mode selection (default: 0.6) */
    causalInferenceThreshold?: number;
    /** Threshold for contextual mode selection (default: 0.6) */
    contextualThreshold?: number;
    /** Score gap threshold for hybrid mode (default: 0.15) */
    hybridThreshold?: number;
    /** Custom causal keywords for detection */
    causalKeywords?: string[];
}
/**
 * ModeSelector - Automatically selects optimal reasoning mode
 *
 * Analyzes request characteristics to determine which reasoning mode
 * will be most effective. Supports hybrid mode when multiple approaches
 * would be beneficial.
 */
export declare class ModeSelector {
    private config;
    private causalKeywords;
    constructor(config?: ModeSelectorConfig);
    /**
     * Select optimal reasoning mode based on request characteristics
     *
     * @param request The reasoning request to analyze (with string query)
     * @returns ModeSelectionResult with selected mode and confidence
     */
    selectMode(request: ModeSelectionRequest): ModeSelectionResult;
    /**
     * Analyze request for pattern-match mode suitability
     *
     * High score when:
     * - Query has template-like structure
     * - TaskType is well-defined
     * - Low context complexity
     *
     * @param request The reasoning request
     * @returns Score 0.0-1.0
     */
    private analyzeForPatternMatch;
    /**
     * Analyze request for causal-inference mode suitability
     *
     * High score when:
     * - Query contains causal keywords
     * - Need to understand cause-effect
     * - Multi-step reasoning required
     *
     * @param request The reasoning request
     * @returns Score 0.0-1.0
     */
    private analyzeForCausalInference;
    /**
     * Analyze request for contextual mode suitability
     *
     * High score when:
     * - Context embeddings provided
     * - Open-ended query
     * - Semantic similarity needed
     *
     * @param request The reasoning request
     * @returns Score 0.0-1.0
     */
    private analyzeForContextual;
    /**
     * Check if hybrid mode should be used
     *
     * Hybrid mode is beneficial when:
     * - Multiple modes score similarly (within threshold)
     * - Complex query needing multiple approaches
     * - Confidence is low in single mode
     *
     * @param scores Scores for all modes
     * @returns true if hybrid mode should be used
     */
    private shouldUseHybrid;
    /**
     * Get mode description
     *
     * @param mode Reasoning mode
     * @returns Human-readable description
     */
    getModeDescription(mode: ReasoningMode): string;
}
//# sourceMappingURL=mode-selector.d.ts.map