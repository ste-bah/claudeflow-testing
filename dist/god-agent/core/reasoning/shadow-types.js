/**
 * Shadow Vector Type Definitions
 * TASK-SHA-001 - Contradiction Detection via Semantic Inversion
 *
 * Provides types for adversarial search using shadow vectors (v × -1)
 * to detect contradictions, counterarguments, and falsifications.
 *
 * Classification Matrix:
 * | Hypothesis Similarity | Shadow Similarity | Classification |
 * |----------------------|-------------------|----------------|
 * | > 0.7                | > 0.7             | AMBIGUOUS      |
 * | < Shadow             | > 0.7             | CONTESTED      |
 * | 0.5-0.7              | 0.5-0.7           | DEBATED        |
 * | < 0.3                | > 0.7             | FALSIFIED      |
 */
// ==================== Error Types ====================
/**
 * Error thrown when shadow vector operations fail
 */
export class ShadowVectorError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'ShadowVectorError';
    }
}
/**
 * Default classification thresholds
 */
export const DEFAULT_CLASSIFICATION_THRESHOLDS = {
    high: 0.7,
    medium: 0.5,
    low: 0.3,
};
/**
 * Default shadow vector configuration
 */
export const DEFAULT_SHADOW_CONFIG = {
    defaultThreshold: 0.7,
    defaultK: 10,
    validateLScoreByDefault: true,
    defaultMinLScore: 0.3,
    verbose: false,
};
//# sourceMappingURL=shadow-types.js.map