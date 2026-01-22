/**
 * Truth Protocol Verifier - Validates agent outputs for truthfulness and evidence.
 *
 * Implements truth verification from PRD Section 2.3 (Sherlock-Holmes Integration):
 * 1. Track truth scores (0-100) for agent claims
 * 2. Flag unverifiable assertions
 * 3. Require evidence for critical claims
 * 4. Detect hallucination patterns
 * 5. Track confidence levels per claim
 *
 * @module src/god-agent/core/pipeline/truth-protocol
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import type { ISemanticContext } from './leann-context-service.js';
export type { ClaimType, ClaimConfidence, ClaimFlag, EvidenceType, HallucinationPatternType, IClaimEvidence, ITruthClaim, IHallucinationPattern, IHallucinationResult, ITruthStatistics, ITruthVerificationResult, } from './truth-protocol-types.js';
export { MIN_TRUTH_SCORE, MIN_VERIFIED_PERCENTAGE, MAX_HALLUCINATION_RISK, } from './truth-protocol-types.js';
import { type ITruthClaim, type IHallucinationResult, type ITruthVerificationResult } from './truth-protocol-types.js';
/**
 * TruthProtocolVerifier - Validates agent outputs for truthfulness and evidence.
 *
 * @example
 * ```typescript
 * const verifier = new TruthProtocolVerifier();
 * const result = await verifier.verify(agentOutput, semanticContext);
 * if (!result.passed) {
 *   console.log('Issues:', result.issues);
 * }
 * ```
 */
export declare class TruthProtocolVerifier {
    private readonly minTruthScore;
    private readonly minVerifiedPercentage;
    private readonly maxHallucinationRisk;
    constructor(options?: {
        minTruthScore?: number;
        minVerifiedPercentage?: number;
        maxHallucinationRisk?: number;
    });
    /** Verify a single claim for truthfulness */
    verifyClaim(claim: string, evidence?: string): ITruthClaim;
    /** Detect hallucination patterns in agent output */
    detectHallucinations(output: string, context?: ISemanticContext): IHallucinationResult;
    /** Calculate truth score from an array of claims */
    calculateTruthScore(claims: ITruthClaim[]): number;
    /** Perform complete truth verification on agent output */
    verify(agentOutput: string, context?: unknown): ITruthVerificationResult;
    private determineClaimType;
    private claimRequiresEvidence;
    private calculateBaseTruthScore;
    private measureSpecificity;
    private hasAppropriateHedging;
    private parseEvidence;
    private hasUncertaintyIndicators;
    private hasOverconfidenceIndicators;
    private calculateClaimConfidence;
    private findContextContradictions;
    private extractClaims;
    private linkHallucinationsToClaims;
    private calculateStatistics;
    private determineVerdict;
    private determineConfidence;
    private generateEvidence;
    private generateIssues;
    private generateRecommendations;
}
/** Create a TruthProtocolVerifier with default settings */
export declare function createTruthProtocolVerifier(): TruthProtocolVerifier;
/** Create a TruthProtocolVerifier with custom thresholds */
export declare function createCustomTruthProtocolVerifier(options: {
    minTruthScore?: number;
    minVerifiedPercentage?: number;
    maxHallucinationRisk?: number;
}): TruthProtocolVerifier;
//# sourceMappingURL=truth-protocol.d.ts.map