/**
 * Sherlock Phase Reviewer Types
 *
 * Type definitions for the Sherlock-Holmes forensic phase review system.
 * Implements "Guilty Until Proven Innocent" verification model per PRD Section 2.3.
 *
 * @module src/god-agent/core/pipeline/sherlock-phase-reviewer-types
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import { z } from 'zod';
/**
 * Investigation tier levels per PRD 2.3.2.
 * Determines investigation depth based on agent criticality.
 */
export declare enum InvestigationTier {
    /** Quick verification (5 seconds) - non-critical agents */
    GLANCE = "glance",
    /** Cold read scan (30 seconds) - standard agents */
    SCAN = "scan",
    /** Full evidence analysis (5 minutes) - quality gate failures */
    INVESTIGATION = "investigation",
    /** Complete forensic reconstruction (30+ minutes) - critical failures */
    DEEP_DIVE = "deep_dive"
}
/**
 * Investigation tier configuration.
 */
export interface IInvestigationTierConfig {
    /** Tier identifier */
    readonly tier: InvestigationTier;
    /** Maximum duration in milliseconds */
    readonly maxDurationMs: number;
    /** Human-readable duration */
    readonly humanDuration: string;
    /** Triggering conditions */
    readonly triggers: readonly string[];
    /** Required verification depth */
    readonly scope: string;
}
/**
 * Tier configurations per PRD 2.3.2.
 */
export declare const INVESTIGATION_TIER_CONFIG: Record<InvestigationTier, IInvestigationTierConfig>;
/**
 * Sherlock verdict types per PRD 2.3.6.
 */
export declare enum Verdict {
    /** Phase outputs verified as correct */
    INNOCENT = "INNOCENT",
    /** Phase outputs contain violations - remediation required */
    GUILTY = "GUILTY",
    /** Cannot determine verdict - additional evidence needed */
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
}
/**
 * Confidence levels for verdicts.
 */
export declare enum VerdictConfidence {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}
/**
 * Evidence source status.
 */
export declare enum EvidenceStatus {
    VERIFIED = "VERIFIED",
    SUSPECT = "SUSPECT",
    MISSING = "MISSING"
}
/**
 * Evidence item from memory.
 */
export interface IEvidenceItem {
    /** Memory key source */
    readonly source: string;
    /** Verification status */
    readonly status: EvidenceStatus;
    /** Additional notes */
    readonly notes: string;
    /** Raw evidence data */
    readonly data?: unknown;
}
/**
 * Verification matrix check result.
 */
export interface IVerificationCheck {
    /** Check name */
    readonly check: string;
    /** Method used to verify */
    readonly method: string;
    /** Expected threshold or value */
    readonly expected: string;
    /** Actual measured value */
    readonly actual: string;
    /** Check result */
    readonly passed: boolean;
}
/**
 * Adversarial persona finding.
 */
export interface IAdversarialFinding {
    /** Persona identifier */
    readonly persona: AdversarialPersona;
    /** Findings from this persona's perspective */
    readonly findings: string;
    /** Severity if issue found */
    readonly severity?: 'critical' | 'warning' | 'info';
}
/**
 * Adversarial personas per PRD 2.3.3 and sherlock-holmes.md.
 */
export declare enum AdversarialPersona {
    /** Thinks like a bug trying to hide */
    THE_BUG = "THE_BUG",
    /** Thinks like a malicious actor */
    THE_ATTACKER = "THE_ATTACKER",
    /** Thinks like an exhausted maintainer */
    THE_TIRED_DEVELOPER = "THE_TIRED_DEVELOPER",
    /** Thinks like someone reading code in 2 years */
    THE_FUTURE_ARCHAEOLOGIST = "THE_FUTURE_ARCHAEOLOGIST",
    /** Thinks like a confused developer */
    THE_CONFUSED_DEVELOPER = "THE_CONFUSED_DEVELOPER",
    /** Thinks like a future maintainer */
    THE_FUTURE_MAINTAINER = "THE_FUTURE_MAINTAINER",
    /** Thinks like a performance tester */
    THE_PERFORMANCE_TESTER = "THE_PERFORMANCE_TESTER",
    /** Thinks like a new hire onboarding */
    THE_NEW_HIRE = "THE_NEW_HIRE"
}
/**
 * Chain of custody event.
 */
export interface IChainOfCustodyEvent {
    /** Event type */
    readonly event: string;
    /** Timestamp */
    readonly timestamp: Date;
}
/**
 * Complete case file output per PRD 2.3.4.
 */
export interface ICaseFile {
    /** Case ID: PHASE-[N]-REVIEW-[TIMESTAMP] */
    readonly caseId: string;
    /** Phase number */
    readonly phase: number;
    /** Subject of investigation */
    readonly subject: string;
    /** Investigation tier used */
    readonly tier: InvestigationTier;
    /** Final verdict */
    readonly verdict: Verdict;
    /** Verdict confidence */
    readonly confidence: VerdictConfidence;
    /** Evidence summary */
    readonly evidenceSummary: readonly IEvidenceItem[];
    /** Verification matrix results */
    readonly verificationResults: readonly IVerificationCheck[];
    /** Adversarial analysis findings */
    readonly adversarialFindings: readonly IAdversarialFinding[];
    /** Chain of custody */
    readonly chainOfCustody: readonly IChainOfCustodyEvent[];
    /** Remediation required (if GUILTY) */
    readonly remediations: readonly string[];
    /** Investigator signature */
    readonly investigator: string;
    /** Investigation timestamp */
    readonly timestamp: Date;
}
/**
 * Phase review result per PRD 2.3.6.
 * This is the primary interface for verdict-based flow control.
 */
export interface IPhaseReviewResult {
    /** Phase number (1-7) */
    readonly phase: number;
    /** Final verdict */
    readonly verdict: Verdict;
    /** Confidence in verdict */
    readonly confidence: VerdictConfidence;
    /** Required remediations if GUILTY */
    readonly remediations: readonly string[];
    /** Retry count for this phase */
    readonly retryCount: number;
    /** Full case file for audit */
    readonly caseFile: ICaseFile;
}
/**
 * Verification matrix entry definition.
 */
export interface IVerificationMatrixEntry {
    /** Check name */
    readonly check: string;
    /** Verification method */
    readonly method: string;
    /** Threshold or expected value */
    readonly threshold: string;
}
/**
 * Verdict criteria definition.
 */
export interface IVerdictCriteria {
    /** Criteria for INNOCENT verdict */
    readonly INNOCENT: string;
    /** Criteria for GUILTY verdict */
    readonly GUILTY: string;
}
/**
 * Phase-specific investigation protocol per PRD 2.3.3.
 */
export interface IPhaseInvestigationProtocol {
    /** Phase number (1-7) */
    readonly phase: number;
    /** Investigation subject */
    readonly subject: string;
    /** Evidence source memory keys */
    readonly evidenceSources: readonly string[];
    /** Verification matrix checks */
    readonly verificationMatrix: readonly IVerificationMatrixEntry[];
    /** Adversarial personas to use */
    readonly adversarialPersonas: readonly AdversarialPersona[];
    /** Verdict criteria */
    readonly verdictCriteria: IVerdictCriteria;
}
/**
 * Zod schema for phase number validation.
 */
export declare const PhaseNumberSchema: z.ZodNumber;
/**
 * Zod schema for investigation tier.
 */
export declare const InvestigationTierSchema: z.ZodNativeEnum<typeof InvestigationTier>;
/**
 * Zod schema for verdict.
 */
export declare const VerdictSchema: z.ZodNativeEnum<typeof Verdict>;
/**
 * Zod schema for verdict confidence.
 */
export declare const VerdictConfidenceSchema: z.ZodNativeEnum<typeof VerdictConfidence>;
/**
 * Zod schema for evidence status.
 */
export declare const EvidenceStatusSchema: z.ZodNativeEnum<typeof EvidenceStatus>;
/**
 * Zod schema for evidence item.
 */
export declare const EvidenceItemSchema: z.ZodObject<{
    source: z.ZodString;
    status: z.ZodNativeEnum<typeof EvidenceStatus>;
    notes: z.ZodString;
    data: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    status: EvidenceStatus;
    source: string;
    notes: string;
    data?: unknown;
}, {
    status: EvidenceStatus;
    source: string;
    notes: string;
    data?: unknown;
}>;
/**
 * Zod schema for verification check.
 */
export declare const VerificationCheckSchema: z.ZodObject<{
    check: z.ZodString;
    method: z.ZodString;
    expected: z.ZodString;
    actual: z.ZodString;
    passed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    method: string;
    expected: string;
    actual: string;
    check: string;
    passed: boolean;
}, {
    method: string;
    expected: string;
    actual: string;
    check: string;
    passed: boolean;
}>;
/**
 * Zod schema for phase review input.
 */
export declare const PhaseReviewInputSchema: z.ZodObject<{
    phase: z.ZodNumber;
    tier: z.ZodOptional<z.ZodNativeEnum<typeof InvestigationTier>>;
    retryCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    phase: number;
    retryCount: number;
    tier?: InvestigationTier | undefined;
}, {
    phase: number;
    tier?: InvestigationTier | undefined;
    retryCount?: number | undefined;
}>;
/**
 * Memory namespace patterns for forensic findings.
 */
export declare const FORENSIC_MEMORY_NAMESPACE: {
    /** Per-phase case files: coding/forensics/phase-[N]/case-file */
    readonly caseFile: (phase: number) => string;
    /** Per-phase verdict: coding/forensics/phase-[N]/verdict */
    readonly verdict: (phase: number) => string;
    /** Evidence summary: coding/forensics/phase-[N]/evidence-summary */
    readonly evidenceSummary: (phase: number) => string;
    /** Required remediation: coding/forensics/phase-[N]/remediation */
    readonly remediation: (phase: number) => string;
    /** All verdicts summary: coding/forensics/pipeline/all-verdicts */
    readonly allVerdicts: "coding/forensics/pipeline/all-verdicts";
    /** Investigation log: coding/forensics/pipeline/investigation-log */
    readonly investigationLog: "coding/forensics/pipeline/investigation-log";
    /** Pattern library: coding/forensics/pipeline/pattern-library */
    readonly patternLibrary: "coding/forensics/pipeline/pattern-library";
};
/**
 * Error codes for Sherlock phase reviewer.
 */
export type SherlockErrorCode = 'INVALID_PHASE' | 'EVIDENCE_MISSING' | 'INVESTIGATION_TIMEOUT' | 'VERIFICATION_FAILED' | 'PROTOCOL_NOT_FOUND';
/**
 * Custom error class for Sherlock phase reviewer.
 */
export declare class SherlockPhaseReviewerError extends Error {
    readonly code: SherlockErrorCode;
    readonly phase?: number | undefined;
    /**
     * Creates a new SherlockPhaseReviewerError.
     *
     * @param code - Error code
     * @param message - Human-readable message
     * @param phase - Phase number if applicable
     */
    constructor(code: SherlockErrorCode, message: string, phase?: number | undefined);
}
/** Maximum retry count before escalation to human */
export declare const MAX_RETRY_COUNT = 3;
/** Default investigation tier for standard phases */
export declare const DEFAULT_INVESTIGATION_TIER = InvestigationTier.SCAN;
/** Phase names for case file generation */
export declare const PHASE_NAMES: Record<number, string>;
//# sourceMappingURL=sherlock-phase-reviewer-types.d.ts.map