/**
 * Sherlock Verification Methods
 *
 * Individual verification method implementations per PRD Section 2.3.3.
 * Extracted from sherlock-verification-matrix.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-verification-methods
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.3
 */
import { type IEvidenceItem } from './sherlock-phase-reviewer-types.js';
import type { ILScoreBreakdown } from './coding-quality-gate-types.js';
/** Phase 1 thresholds */
export declare const PHASE_1_THRESHOLDS: {
    readonly requirementsCoverage: 0.9;
    readonly scopeClarity: 1;
};
/** Phase 2 thresholds */
export declare const PHASE_2_THRESHOLDS: {
    readonly viableSolutions: 3;
    readonly patternValidity: 1;
    readonly tradeoffCompleteness: 1;
};
/** Phase 3 thresholds */
export declare const PHASE_3_THRESHOLDS: {
    readonly interfaceCompatibility: 1;
    readonly dagStructure: 1;
    readonly typeSafety: 1;
};
/** Phase 4 thresholds */
export declare const PHASE_4_THRESHOLDS: {
    readonly algorithmCorrectness: 1;
    readonly errorHandling: 1;
    readonly commentConsistency: 1;
};
/** Phase 5 thresholds */
export declare const PHASE_5_THRESHOLDS: {
    readonly lineCoverage: 0.8;
    readonly criticalPathCoverage: 1;
    readonly edgeCaseCoverage: 1;
    readonly regressionRisk: 0;
};
/** Phase 6 thresholds - aligns with L-SCORE-CRITICAL (0.85) */
export declare const PHASE_6_THRESHOLDS: {
    readonly performanceTarget: 1;
    readonly criticalVulnerabilities: 0;
    readonly qualityScore: 0.85;
};
/** Phase 7 thresholds */
export declare const PHASE_7_THRESHOLDS: {
    readonly documentationCoverage: 0.9;
    readonly reviewBlockers: 0;
    readonly artifactValidity: 1;
};
/** L-Score threshold for integrated verification (aligns with L-SCORE-CRITICAL) */
export declare const LSCORE_VERIFICATION_THRESHOLD = 0.85;
/**
 * Result of a verification method execution.
 */
export interface IVerificationResult {
    /** Whether the check passed */
    readonly passed: boolean;
    /** Human-readable result description */
    readonly actual: string;
}
/**
 * Execute cross-reference verification against original request.
 */
export declare function executeCrossReference(evidence: readonly IEvidenceItem[], _lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Scan for hidden assumptions in evidence.
 */
export declare function executeScanAssumptions(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Verify explicit scope boundaries.
 */
export declare function executeVerifyBoundaries(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Test solution viability against Phase 1 constraints.
 */
export declare function executeTestConstraints(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Verify patterns match problem domain.
 */
export declare function executePatternMatch(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Confirm trade-off analysis documentation.
 */
export declare function executeTradeoffAnalysis(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * ACE-V analysis of API contracts.
 * Analysis, Comparison, Evaluation, Verification methodology.
 */
export declare function executeAceVAnalysis(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Detect circular dependencies in architecture.
 */
export declare function executeDetectCycles(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Verify type hierarchy soundness.
 */
export declare function executeTypeSoundness(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Trace execution against specification.
 */
export declare function executeTraceExecution(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Test all exception paths.
 */
export declare function executeTestExceptionPaths(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Contradiction Engine analysis for code-comment consistency.
 */
export declare function executeContradictionEngine(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Verify test coverage paths.
 */
export declare function executeVerifyCoverage(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Test boundary conditions.
 */
export declare function executeTestBoundaries(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Check for regression risk.
 */
export declare function executeRegressionCheck(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Compare performance against Phase 1 requirements.
 */
export declare function executePerformanceCompare(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * OWASP Top 10 security scan.
 */
export declare function executeOwaspScan(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Code quality complexity metrics.
 */
export declare function executeComplexityMetrics(evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationResult;
/**
 * Verify all public APIs documented.
 */
export declare function executeDocumentationCheck(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Confirm all review comments addressed.
 */
export declare function executeReviewStatus(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Verify package integrity.
 */
export declare function executeArtifactIntegrity(evidence: readonly IEvidenceItem[]): IVerificationResult;
/**
 * Default verification when method is unknown.
 */
export declare function executeDefaultVerification(evidence: readonly IEvidenceItem[]): IVerificationResult;
//# sourceMappingURL=sherlock-verification-methods.d.ts.map