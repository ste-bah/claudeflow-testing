/**
 * Truth Protocol Type Definitions
 *
 * Interfaces, types, and constants for the Truth Protocol Verifier.
 *
 * @module src/god-agent/core/pipeline/truth-protocol-types
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import type { SherlockVerdict, SherlockConfidence, ISherlockEvidence, ISherlockIssue } from './types.js';
/**
 * Types of claims that can be made in agent output
 */
export type ClaimType = 'factual' | 'existence' | 'behavioral' | 'quantitative' | 'capability' | 'temporal' | 'causal' | 'comparative' | 'opinion' | 'unknown';
/**
 * Confidence level for a claim assessment
 */
export type ClaimConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
/**
 * Flags that can be applied to claims indicating issues
 */
export type ClaimFlag = 'UNVERIFIABLE' | 'MISSING_EVIDENCE' | 'HALLUCINATION' | 'VAGUE' | 'CONTRADICTORY' | 'UNSUPPORTED' | 'STALE' | 'ASSUMPTION' | 'OVERSTATED';
/**
 * Types of evidence that can support a claim
 */
export type EvidenceType = 'file_exists' | 'code_reference' | 'semantic_match' | 'test_result' | 'documentation' | 'context_provided' | 'external_source' | 'self_referential';
/**
 * Types of hallucination patterns
 */
export type HallucinationPatternType = 'NONEXISTENT_FILE' | 'NONEXISTENT_FUNCTION' | 'INVENTED_API' | 'FABRICATED_OUTPUT' | 'FALSE_CAPABILITY' | 'PHANTOM_DEPENDENCY' | 'CONTRADICTS_CONTEXT' | 'IMPOSSIBLE_CLAIM' | 'OVERCONFIDENT' | 'KNOWLEDGE_CUTOFF' | 'CIRCULAR_REASONING';
/**
 * Evidence supporting a claim
 */
export interface IClaimEvidence {
    /** Type of evidence */
    type: EvidenceType;
    /** Source of the evidence */
    source: string;
    /** Evidence content/value */
    content: string;
    /** Strength of this evidence (0-1) */
    strength: number;
}
/**
 * A single claim extracted from agent output
 */
export interface ITruthClaim {
    /** Unique identifier for this claim */
    id: string;
    /** The claim text */
    statement: string;
    /** Type of claim */
    type: ClaimType;
    /** Truth score (0-100), higher is more verifiable/truthful */
    truthScore: number;
    /** Confidence level in the assessment */
    confidence: ClaimConfidence;
    /** Supporting evidence for this claim */
    evidence: IClaimEvidence[];
    /** Whether this claim is verifiable */
    isVerifiable: boolean;
    /** Whether this claim requires evidence (critical claim) */
    requiresEvidence: boolean;
    /** Flags for potential issues */
    flags: ClaimFlag[];
    /** Source location in the original output */
    sourceLocation?: {
        start: number;
        end: number;
    };
}
/**
 * A detected hallucination pattern
 */
export interface IHallucinationPattern {
    /** Pattern type */
    type: HallucinationPatternType;
    /** Description of the pattern */
    description: string;
    /** Evidence of the pattern */
    evidence: string;
    /** Severity of this pattern */
    severity: 'critical' | 'high' | 'medium' | 'low';
    /** Affected claim IDs */
    affectedClaims: string[];
}
/**
 * Result from hallucination detection
 */
export interface IHallucinationResult {
    /** Whether hallucinations were detected */
    detected: boolean;
    /** Overall hallucination risk score (0-100), higher = more risk */
    riskScore: number;
    /** Specific hallucination patterns found */
    patterns: IHallucinationPattern[];
    /** Claims identified as likely hallucinations */
    suspectedClaims: string[];
    /** Confidence in the detection */
    confidence: ClaimConfidence;
}
/**
 * Statistics about truth verification
 */
export interface ITruthStatistics {
    /** Total claims analyzed */
    totalClaims: number;
    /** Claims that passed verification */
    verifiedClaims: number;
    /** Claims flagged as potentially false */
    flaggedClaims: number;
    /** Claims that could not be verified */
    unverifiableClaims: number;
    /** Claims with sufficient evidence */
    evidencedClaims: number;
    /** Average truth score across claims */
    averageTruthScore: number;
    /** Distribution of claim types */
    claimTypeDistribution: Record<ClaimType, number>;
    /** Distribution of flags */
    flagDistribution: Record<ClaimFlag, number>;
}
/**
 * Complete result from truth verification
 */
export interface ITruthVerificationResult {
    /** Whether the verification passed (overall truthfulness acceptable) */
    passed: boolean;
    /** Overall truth score (0-100) */
    overallTruthScore: number;
    /** Individual claim assessments */
    claims: ITruthClaim[];
    /** Hallucination detection results */
    hallucinationResult: IHallucinationResult;
    /** Summary statistics */
    statistics: ITruthStatistics;
    /** Sherlock-compatible verdict */
    verdict: SherlockVerdict;
    /** Confidence in the verdict */
    confidence: SherlockConfidence;
    /** Evidence collected */
    evidence: ISherlockEvidence[];
    /** Issues found */
    issues: ISherlockIssue[];
    /** Timestamp of verification */
    timestamp: string;
    /** Recommendations for improvement */
    recommendations: string[];
}
/** Minimum truth score to pass verification */
export declare const MIN_TRUTH_SCORE = 70;
/** Minimum percentage of claims that must be verified */
export declare const MIN_VERIFIED_PERCENTAGE = 80;
/** Maximum allowed hallucination risk score */
export declare const MAX_HALLUCINATION_RISK = 30;
/** Patterns indicating existence claims */
export declare const EXISTENCE_PATTERNS: RegExp[];
/** Patterns indicating behavioral claims */
export declare const BEHAVIORAL_PATTERNS: RegExp[];
/** Patterns indicating quantitative claims */
export declare const QUANTITATIVE_PATTERNS: RegExp[];
/** Patterns that may indicate hallucination */
export declare const HALLUCINATION_INDICATORS: Array<{
    pattern: RegExp;
    type: HallucinationPatternType;
}>;
/** Words indicating low confidence or uncertainty */
export declare const UNCERTAINTY_INDICATORS: readonly ["might", "maybe", "perhaps", "possibly", "could", "should", "probably", "likely", "unlikely", "uncertain", "unclear", "appears", "seems", "suggests", "indicates", "implies"];
/** Words indicating high confidence (may be overconfident) */
export declare const OVERCONFIDENCE_INDICATORS: readonly ["definitely", "certainly", "absolutely", "always", "never", "guaranteed", "impossible", "must", "obviously", "clearly", "undoubtedly", "unquestionably", "perfect", "flawless"];
/** Base truth scores by claim type */
export declare const BASE_TRUTH_SCORES: Record<ClaimType, number>;
/** Claim type weights for scoring */
export declare const CLAIM_TYPE_WEIGHTS: Record<ClaimType, number>;
/** Severity scores for hallucination patterns */
export declare const SEVERITY_SCORES: Record<string, number>;
/** Severity mapping for hallucination types */
export declare const HALLUCINATION_SEVERITY: Record<HallucinationPatternType, 'critical' | 'high' | 'medium' | 'low'>;
/** Descriptions for hallucination types */
export declare const HALLUCINATION_DESCRIPTIONS: Record<HallucinationPatternType, string>;
/** Remediation suggestions for hallucination types */
export declare const HALLUCINATION_REMEDIATIONS: Record<HallucinationPatternType, string>;
//# sourceMappingURL=truth-protocol-types.d.ts.map