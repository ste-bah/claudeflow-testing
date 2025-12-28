/**
 * Advanced Reasoning Type Definitions
 * RSN-002 Implementation - 8 Advanced Reasoning Modes
 *
 * This file defines types for the extended reasoning capabilities:
 * - Analogical: Cross-domain pattern transfer
 * - Abductive: Best explanation finding
 * - Counterfactual: Alternative world simulation
 * - Decomposition: Problem breakdown
 * - Adversarial: Critical argument testing
 * - Temporal: Time-based reasoning
 * - Constraint-based: Satisfaction solving
 * - First Principles: Axiomatic derivation
 *
 * Dependencies:
 * - reasoning-types.ts (base types)
 * - pattern-types.ts (Pattern, TaskType)
 * - causal-types.ts (NodeID, CausalNode)
 */
// ============================================================================
// ADVANCED REASONING MODES ENUM
// ============================================================================
/**
 * Extended reasoning modes beyond base pattern-match, causal-inference, contextual, hybrid
 *
 * These modes provide specialized reasoning capabilities for complex tasks:
 * - Analogical: Transfer knowledge from source to target domain
 * - Abductive: Infer most likely explanations from observations
 * - Counterfactual: Explore "what if" scenarios
 * - Decomposition: Break down complex problems
 * - Adversarial: Test arguments with counter-arguments
 * - Temporal: Reason about time-dependent sequences
 * - Constraint-based: Solve problems with constraints
 * - First Principles: Derive from fundamental axioms
 */
export var AdvancedReasoningMode;
(function (AdvancedReasoningMode) {
    /** Cross-domain pattern transfer and mapping */
    AdvancedReasoningMode["ANALOGICAL"] = "analogical";
    /** Best explanation inference from observations */
    AdvancedReasoningMode["ABDUCTIVE"] = "abductive";
    /** Alternative world simulation and intervention analysis */
    AdvancedReasoningMode["COUNTERFACTUAL"] = "counterfactual";
    /** Problem breakdown into subproblems */
    AdvancedReasoningMode["DECOMPOSITION"] = "decomposition";
    /** Critical argument testing with counter-arguments */
    AdvancedReasoningMode["ADVERSARIAL"] = "adversarial";
    /** Time-based sequential reasoning */
    AdvancedReasoningMode["TEMPORAL"] = "temporal";
    /** Constraint satisfaction solving */
    AdvancedReasoningMode["CONSTRAINT_BASED"] = "constraint-based";
    /** Axiomatic derivation from first principles */
    AdvancedReasoningMode["FIRST_PRINCIPLES"] = "first-principles";
})(AdvancedReasoningMode || (AdvancedReasoningMode = {}));
//# sourceMappingURL=advanced-reasoning-types.js.map