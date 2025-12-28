/**
 * Extended Mode Selector - Advanced Reasoning Mode Selection
 *
 * Extends ModeSelector with 8 advanced reasoning modes:
 * - Analogical: Cross-domain pattern transfer
 * - Abductive: Best explanation finding
 * - Counterfactual: Alternative world simulation
 * - Decomposition: Problem breakdown
 * - Adversarial: Critical argument testing
 * - Temporal: Time-based reasoning
 * - Constraint-based: Satisfaction solving
 * - First Principles: Axiomatic derivation
 *
 * Selection latency: <5ms (including core mode scoring)
 *
 * @module god-agent/core/reasoning/extended-mode-selector
 */
import { ModeSelectionRequest, ModeSelectorConfig } from './mode-selector.js';
import { ExtendedQueryFeatures, AllReasoningModes } from './advanced-reasoning-types.js';
/**
 * Configuration for extended mode selector
 */
export interface ExtendedModeSelectorConfig extends ModeSelectorConfig {
    /** Threshold for analogical mode selection (default: 0.6) */
    analogicalThreshold?: number;
    /** Threshold for abductive mode selection (default: 0.6) */
    abductiveThreshold?: number;
    /** Threshold for counterfactual mode selection (default: 0.6) */
    counterfactualThreshold?: number;
    /** Threshold for decomposition mode selection (default: 0.6) */
    decompositionThreshold?: number;
    /** Threshold for adversarial mode selection (default: 0.6) */
    adversarialThreshold?: number;
    /** Threshold for temporal mode selection (default: 0.6) */
    temporalThreshold?: number;
    /** Threshold for constraint-based mode selection (default: 0.6) */
    constraintBasedThreshold?: number;
    /** Threshold for first-principles mode selection (default: 0.6) */
    firstPrinciplesThreshold?: number;
}
/**
 * Extended mode selection result
 */
export interface ExtendedModeSelectionResult {
    /** Selected reasoning mode (core or advanced) */
    mode: AllReasoningModes;
    /** Confidence in the selection [0, 1] */
    confidence: number;
    /** Human-readable reasoning for the selection */
    reasoning: string;
    /** Scores for all modes (core + advanced) */
    allScores: ExtendedQueryFeatures;
}
/**
 * ExtendedModeSelector - Automatically selects optimal reasoning mode
 *
 * Extends base ModeSelector with 8 advanced reasoning capabilities.
 * Analyzes query characteristics to determine which reasoning mode
 * will be most effective among 12 total modes.
 */
export declare class ExtendedModeSelector {
    private coreSelector;
    private config;
    constructor(config?: ExtendedModeSelectorConfig);
    /**
     * Select optimal reasoning mode based on request characteristics
     *
     * Considers all 12 modes (4 core + 8 advanced) and returns the
     * highest scoring mode with confidence and explanation.
     *
     * @param request The reasoning request to analyze
     * @returns Extended mode selection result
     */
    selectMode(request: ModeSelectionRequest): Promise<ExtendedModeSelectionResult>;
    /**
     * Analyze query to extract features for mode selection
     *
     * Extracts characteristics like keywords, patterns, complexity,
     * temporal markers, constraints, etc.
     *
     * @param query The query string to analyze
     * @returns Query features with core mode scores
     */
    private analyzeQuery;
    /**
     * Score query for analogical reasoning
     *
     * High score when:
     * - Query contains cross-domain keywords
     * - Query mentions different domains
     * - Query asks to transfer knowledge
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreAnalogical;
    /**
     * Score query for abductive reasoning
     *
     * High score when:
     * - Query asks "why" or seeks causes
     * - Query involves diagnosis/troubleshooting
     * - Query seeks explanations
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreAbductive;
    /**
     * Score query for counterfactual reasoning
     *
     * High score when:
     * - Query contains "what if" scenarios
     * - Query explores alternatives
     * - Query compares different choices
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreCounterfactual;
    /**
     * Score query for decomposition reasoning
     *
     * High score when:
     * - Query is complex/long
     * - Query has multiple subjects
     * - Query asks to break down
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreDecomposition;
    /**
     * Score query for adversarial reasoning
     *
     * High score when:
     * - Query mentions security/vulnerabilities
     * - Query asks about failure modes
     * - Query seeks edge cases
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreAdversarial;
    /**
     * Score query for temporal reasoning
     *
     * High score when:
     * - Query contains time keywords
     * - Query has date references
     * - Query asks about sequences/order
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreTemporal;
    /**
     * Score query for constraint-based reasoning
     *
     * High score when:
     * - Query has hard constraints
     * - Query mentions requirements/limitations
     * - Query has conditional constraints
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreConstraintBased;
    /**
     * Score query for first-principles reasoning
     *
     * High score when:
     * - Query mentions fundamentals
     * - Query asks for derivation/proof
     * - Query challenges assumptions
     *
     * @param query Query string to analyze
     * @returns Score [0, 1]
     */
    private scoreFirstPrinciples;
    /**
     * Check if query contains any of the specified keywords with word boundaries
     *
     * Uses regex with word boundaries for very short words to prevent false matches.
     * For example, searching for "is" will not match "this", "analysis", or "his".
     * For longer words, uses flexible matching to catch variations
     * like "fail" matching "failing", "failed", "fails" and vice versa.
     *
     * @param query Query string (lowercase)
     * @param keywords Keywords to search for
     * @returns true if any keyword found
     */
    private hasKeywords;
    /**
     * Explain why a particular mode was selected
     *
     * @param mode Selected mode
     * @param score Mode score
     * @returns Human-readable explanation
     */
    private explainSelection;
    /**
     * Get mode description for any reasoning mode
     *
     * @param mode Reasoning mode
     * @returns Human-readable description
     */
    getModeDescription(mode: AllReasoningModes): string;
}
//# sourceMappingURL=extended-mode-selector.d.ts.map