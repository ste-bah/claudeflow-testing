/**
 * Attention Type Definitions
 * TASK-ATT-001 - Attention Factory Auto-Selection
 *
 * Provides types for automatic attention mechanism selection:
 * - IDataProfile for input characterization
 * - AttentionCapabilities for mechanism features
 * - ComplexityClass for computational costs
 * - 39+ attention mechanism descriptors
 *
 * Target: <1ms selection overhead, 95%+ correct mechanism selection
 */
/**
 * Complexity class for attention mechanisms
 */
export var ComplexityClass;
(function (ComplexityClass) {
    ComplexityClass["LINEAR"] = "O(N)";
    ComplexityClass["LINEARITHMIC"] = "O(N log N)";
    ComplexityClass["QUADRATIC"] = "O(N\u00B2)";
    ComplexityClass["SUBQUADRATIC"] = "O(N\u221AN)";
})(ComplexityClass || (ComplexityClass = {}));
/**
 * Default selection thresholds
 */
export const DEFAULT_SELECTION_THRESHOLDS = {
    longSequenceThreshold: 10000,
    hierarchyDepthThreshold: 3,
    strictLatencyThreshold: 1.0,
    mediumSequenceThreshold: 4096,
    sparsityThreshold: 0.5,
    dualSpaceHierarchyThreshold: 2,
};
/**
 * Default attention configuration
 */
export const DEFAULT_ATTENTION_CONFIG = {
    thresholds: DEFAULT_SELECTION_THRESHOLDS,
    verbose: false,
    dualSpaceMixingWeight: 0.5,
};
// ==================== Error Types ====================
/**
 * Error thrown when attention mechanism operations fail
 */
export class AttentionError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'AttentionError';
    }
}
// ==================== Utility Functions ====================
/**
 * Default data profile for testing
 */
export function createDefaultDataProfile() {
    return {
        sequenceLength: 512,
        hierarchyDepth: 0,
        hasGraphStructure: false,
        latencyBudget: 10,
        sparsity: 0,
        batchSize: 1,
        memoryBudget: 1000,
    };
}
/**
 * Create a hash of data profile for caching/logging
 */
export function hashDataProfile(profile) {
    return `${profile.sequenceLength}_${profile.hierarchyDepth}_${profile.hasGraphStructure}_${profile.latencyBudget}`;
}
//# sourceMappingURL=attention-types.js.map