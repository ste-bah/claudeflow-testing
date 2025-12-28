/**
 * Provenance Types
 * TASK-PRV-001 - ProvenanceStore Type Definitions
 *
 * Defines types for source tracking, provenance chains, L-Score calculation,
 * and citation graph traversal.
 */
// ==================== Error Types ====================
/**
 * Error thrown when L-Score is below threshold
 */
export class LScoreRejectionError extends Error {
    lScore;
    threshold;
    domain;
    constructor(lScore, threshold, domain) {
        super(`Provenance L-Score ${lScore.toFixed(3)} below threshold ${threshold} for domain ${domain || 'default'}`);
        this.lScore = lScore;
        this.threshold = threshold;
        this.domain = domain;
        this.name = 'LScoreRejectionError';
    }
}
/**
 * Error thrown when provenance validation fails
 */
export class ProvenanceValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProvenanceValidationError';
    }
}
//# sourceMappingURL=provenance-types.js.map