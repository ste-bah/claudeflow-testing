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
// ═══════════════════════════════════════════════════════════════════════════
// INVESTIGATION TIER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Investigation tier levels per PRD 2.3.2.
 * Determines investigation depth based on agent criticality.
 */
export var InvestigationTier;
(function (InvestigationTier) {
    /** Quick verification (5 seconds) - non-critical agents */
    InvestigationTier["GLANCE"] = "glance";
    /** Cold read scan (30 seconds) - standard agents */
    InvestigationTier["SCAN"] = "scan";
    /** Full evidence analysis (5 minutes) - quality gate failures */
    InvestigationTier["INVESTIGATION"] = "investigation";
    /** Complete forensic reconstruction (30+ minutes) - critical failures */
    InvestigationTier["DEEP_DIVE"] = "deep_dive";
})(InvestigationTier || (InvestigationTier = {}));
/**
 * Tier configurations per PRD 2.3.2.
 */
export const INVESTIGATION_TIER_CONFIG = {
    [InvestigationTier.GLANCE]: {
        tier: InvestigationTier.GLANCE,
        maxDurationMs: 5000,
        humanDuration: '5 seconds',
        triggers: ['Non-critical agents'],
        scope: 'Quick verification of outputs exist',
    },
    [InvestigationTier.SCAN]: {
        tier: InvestigationTier.SCAN,
        maxDurationMs: 30000,
        humanDuration: '30 seconds',
        triggers: ['Standard agents'],
        scope: 'Cold read of evidence patterns',
    },
    [InvestigationTier.INVESTIGATION]: {
        tier: InvestigationTier.INVESTIGATION,
        maxDurationMs: 300000,
        humanDuration: '5 minutes',
        triggers: ['Quality gate failures'],
        scope: 'Full evidence chain analysis',
    },
    [InvestigationTier.DEEP_DIVE]: {
        tier: InvestigationTier.DEEP_DIVE,
        maxDurationMs: 1800000,
        humanDuration: '30+ minutes',
        triggers: ['Critical agent failures'],
        scope: 'Complete forensic reconstruction',
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// VERDICT TYPES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Sherlock verdict types per PRD 2.3.6.
 */
export var Verdict;
(function (Verdict) {
    /** Phase outputs verified as correct */
    Verdict["INNOCENT"] = "INNOCENT";
    /** Phase outputs contain violations - remediation required */
    Verdict["GUILTY"] = "GUILTY";
    /** Cannot determine verdict - additional evidence needed */
    Verdict["INSUFFICIENT_EVIDENCE"] = "INSUFFICIENT_EVIDENCE";
})(Verdict || (Verdict = {}));
/**
 * Confidence levels for verdicts.
 */
export var VerdictConfidence;
(function (VerdictConfidence) {
    VerdictConfidence["HIGH"] = "HIGH";
    VerdictConfidence["MEDIUM"] = "MEDIUM";
    VerdictConfidence["LOW"] = "LOW";
})(VerdictConfidence || (VerdictConfidence = {}));
// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE TYPES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Evidence source status.
 */
export var EvidenceStatus;
(function (EvidenceStatus) {
    EvidenceStatus["VERIFIED"] = "VERIFIED";
    EvidenceStatus["SUSPECT"] = "SUSPECT";
    EvidenceStatus["MISSING"] = "MISSING";
})(EvidenceStatus || (EvidenceStatus = {}));
// ═══════════════════════════════════════════════════════════════════════════
// ADVERSARIAL PERSONA TYPES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Adversarial personas per PRD 2.3.3 and sherlock-holmes.md.
 */
export var AdversarialPersona;
(function (AdversarialPersona) {
    /** Thinks like a bug trying to hide */
    AdversarialPersona["THE_BUG"] = "THE_BUG";
    /** Thinks like a malicious actor */
    AdversarialPersona["THE_ATTACKER"] = "THE_ATTACKER";
    /** Thinks like an exhausted maintainer */
    AdversarialPersona["THE_TIRED_DEVELOPER"] = "THE_TIRED_DEVELOPER";
    /** Thinks like someone reading code in 2 years */
    AdversarialPersona["THE_FUTURE_ARCHAEOLOGIST"] = "THE_FUTURE_ARCHAEOLOGIST";
    /** Thinks like a confused developer */
    AdversarialPersona["THE_CONFUSED_DEVELOPER"] = "THE_CONFUSED_DEVELOPER";
    /** Thinks like a future maintainer */
    AdversarialPersona["THE_FUTURE_MAINTAINER"] = "THE_FUTURE_MAINTAINER";
    /** Thinks like a performance tester */
    AdversarialPersona["THE_PERFORMANCE_TESTER"] = "THE_PERFORMANCE_TESTER";
    /** Thinks like a new hire onboarding */
    AdversarialPersona["THE_NEW_HIRE"] = "THE_NEW_HIRE";
})(AdversarialPersona || (AdversarialPersona = {}));
// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS (TS-004 Compliance)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Zod schema for phase number validation.
 */
export const PhaseNumberSchema = z.number()
    .int()
    .min(1, 'Phase must be >= 1')
    .max(7, 'Phase must be <= 7')
    .describe('Pipeline phase number (1-7)');
/**
 * Zod schema for investigation tier.
 */
export const InvestigationTierSchema = z.nativeEnum(InvestigationTier)
    .describe('Investigation depth tier');
/**
 * Zod schema for verdict.
 */
export const VerdictSchema = z.nativeEnum(Verdict)
    .describe('Investigation verdict');
/**
 * Zod schema for verdict confidence.
 */
export const VerdictConfidenceSchema = z.nativeEnum(VerdictConfidence)
    .describe('Confidence level in verdict');
/**
 * Zod schema for evidence status.
 */
export const EvidenceStatusSchema = z.nativeEnum(EvidenceStatus)
    .describe('Evidence verification status');
/**
 * Zod schema for evidence item.
 */
export const EvidenceItemSchema = z.object({
    source: z.string().min(1).describe('Memory key source'),
    status: EvidenceStatusSchema,
    notes: z.string().describe('Additional notes'),
    data: z.unknown().optional().describe('Raw evidence data'),
});
/**
 * Zod schema for verification check.
 */
export const VerificationCheckSchema = z.object({
    check: z.string().min(1).describe('Check name'),
    method: z.string().min(1).describe('Verification method'),
    expected: z.string().describe('Expected threshold'),
    actual: z.string().describe('Actual value'),
    passed: z.boolean().describe('Check result'),
});
/**
 * Zod schema for phase review input.
 */
export const PhaseReviewInputSchema = z.object({
    phase: PhaseNumberSchema,
    tier: InvestigationTierSchema.optional()
        .describe('Override investigation tier (auto-detected if not provided)'),
    retryCount: z.number().int().min(0).default(0)
        .describe('Current retry count'),
});
// ═══════════════════════════════════════════════════════════════════════════
// MEMORY NAMESPACE CONSTANTS (PRD 2.3.5)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Memory namespace patterns for forensic findings.
 */
export const FORENSIC_MEMORY_NAMESPACE = {
    /** Per-phase case files: coding/forensics/phase-[N]/case-file */
    caseFile: (phase) => `coding/forensics/phase-${phase}/case-file`,
    /** Per-phase verdict: coding/forensics/phase-[N]/verdict */
    verdict: (phase) => `coding/forensics/phase-${phase}/verdict`,
    /** Evidence summary: coding/forensics/phase-[N]/evidence-summary */
    evidenceSummary: (phase) => `coding/forensics/phase-${phase}/evidence-summary`,
    /** Required remediation: coding/forensics/phase-[N]/remediation */
    remediation: (phase) => `coding/forensics/phase-${phase}/remediation`,
    /** All verdicts summary: coding/forensics/pipeline/all-verdicts */
    allVerdicts: 'coding/forensics/pipeline/all-verdicts',
    /** Investigation log: coding/forensics/pipeline/investigation-log */
    investigationLog: 'coding/forensics/pipeline/investigation-log',
    /** Pattern library: coding/forensics/pipeline/pattern-library */
    patternLibrary: 'coding/forensics/pipeline/pattern-library',
};
/**
 * Custom error class for Sherlock phase reviewer.
 */
export class SherlockPhaseReviewerError extends Error {
    code;
    phase;
    /**
     * Creates a new SherlockPhaseReviewerError.
     *
     * @param code - Error code
     * @param message - Human-readable message
     * @param phase - Phase number if applicable
     */
    constructor(code, message, phase) {
        super(message);
        this.code = code;
        this.phase = phase;
        this.name = 'SherlockPhaseReviewerError';
        Object.setPrototypeOf(this, SherlockPhaseReviewerError.prototype);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Maximum retry count before escalation to human */
export const MAX_RETRY_COUNT = 3;
/** Default investigation tier for standard phases */
export const DEFAULT_INVESTIGATION_TIER = InvestigationTier.SCAN;
/** Phase names for case file generation */
export const PHASE_NAMES = {
    1: 'Understanding',
    2: 'Exploration',
    3: 'Architecture',
    4: 'Implementation',
    5: 'Testing',
    6: 'Optimization',
    7: 'Delivery',
};
//# sourceMappingURL=sherlock-phase-reviewer-types.js.map