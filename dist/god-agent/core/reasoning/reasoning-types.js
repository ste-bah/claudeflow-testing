/**
 * ReasoningBank Type Definitions
 * TASK-RSN-001 - Milestone B
 *
 * Provides unified types for 4 reasoning modes:
 * - pattern-match: Template-based retrieval
 * - causal-inference: Graph-based reasoning
 * - contextual: GNN-enhanced embedding similarity
 * - hybrid: Weighted combination
 *
 * Integration with:
 * - PatternMatcher (TASK-PAT-001)
 * - CausalMemory (TASK-CAUSAL-001)
 * - VectorDB for contextual search
 */
// Import TaskType as value (it's an enum, not just a type)
import { TaskType } from './pattern-types.js';
// Re-export for convenience
export { TaskType };
/**
 * Reasoning mode enumeration
 *
 * Defines the four reasoning strategies supported by ReasoningBank:
 * - pattern-match: Fast template retrieval (<10ms)
 * - causal-inference: Graph traversal reasoning (<20ms)
 * - contextual: Embedding similarity with optional GNN enhancement (<30ms)
 * - hybrid: Weighted combination of all modes (<30ms without GNN, <100ms with GNN)
 */
export var ReasoningMode;
(function (ReasoningMode) {
    /** Template-based pattern retrieval using PatternMatcher */
    ReasoningMode["PATTERN_MATCH"] = "pattern-match";
    /** Graph-based causal inference using CausalMemory */
    ReasoningMode["CAUSAL_INFERENCE"] = "causal-inference";
    /** Embedding similarity search with optional GNN enhancement */
    ReasoningMode["CONTEXTUAL"] = "contextual";
    /** Weighted combination of pattern, causal, and contextual modes */
    ReasoningMode["HYBRID"] = "hybrid";
})(ReasoningMode || (ReasoningMode = {}));
//# sourceMappingURL=reasoning-types.js.map