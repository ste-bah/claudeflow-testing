/**
 * Sherlock Verification Matrix Engine
 *
 * Implements sophisticated verification logic per PRD Section 2.3.3.
 * Matrix execution and check routing logic.
 *
 * @module src/god-agent/core/pipeline/sherlock-verification-matrix
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.3
 */
import { z } from 'zod';
import { type IEvidenceItem, type IVerificationCheck, type IVerificationMatrixEntry, EvidenceStatus } from './sherlock-phase-reviewer-types.js';
import type { ILScoreBreakdown } from './coding-quality-gate-types.js';
export { type IVerificationResult, PHASE_1_THRESHOLDS, PHASE_2_THRESHOLDS, PHASE_3_THRESHOLDS, PHASE_4_THRESHOLDS, PHASE_5_THRESHOLDS, PHASE_6_THRESHOLDS, PHASE_7_THRESHOLDS, LSCORE_VERIFICATION_THRESHOLD, } from './sherlock-verification-methods.js';
/**
 * Verification method identifiers per PRD 2.3.3.
 */
export declare enum VerificationMethod {
    CROSS_REFERENCE = "cross_reference",
    SCAN_ASSUMPTIONS = "scan_assumptions",
    VERIFY_BOUNDARIES = "verify_boundaries",
    TEST_CONSTRAINTS = "test_constraints",
    PATTERN_MATCH = "pattern_match",
    TRADEOFF_ANALYSIS = "tradeoff_analysis",
    ACE_V_ANALYSIS = "ace_v_analysis",
    DETECT_CYCLES = "detect_cycles",
    TYPE_SOUNDNESS = "type_soundness",
    TRACE_EXECUTION = "trace_execution",
    TEST_EXCEPTION_PATHS = "test_exception_paths",
    CONTRADICTION_ENGINE = "contradiction_engine",
    VERIFY_COVERAGE = "verify_coverage",
    TEST_BOUNDARIES = "test_boundaries",
    REGRESSION_CHECK = "regression_check",
    PERFORMANCE_COMPARE = "performance_compare",
    OWASP_SCAN = "owasp_scan",
    COMPLEXITY_METRICS = "complexity_metrics",
    DOCUMENTATION_CHECK = "documentation_check",
    REVIEW_STATUS = "review_status",
    ARTIFACT_INTEGRITY = "artifact_integrity"
}
/**
 * Zod schema for verification context.
 */
export declare const VerificationContextSchema: z.ZodObject<{
    phase: z.ZodNumber;
    evidence: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    lScore: z.ZodOptional<z.ZodObject<{
        accuracy: z.ZodNumber;
        completeness: z.ZodNumber;
        maintainability: z.ZodNumber;
        security: z.ZodNumber;
        performance: z.ZodNumber;
        testCoverage: z.ZodNumber;
        composite: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        performance: number;
        accuracy: number;
        security: number;
        composite: number;
        completeness: number;
        maintainability: number;
        testCoverage: number;
    }, {
        performance: number;
        accuracy: number;
        security: number;
        composite: number;
        completeness: number;
        maintainability: number;
        testCoverage: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    phase: number;
    evidence: {
        status: EvidenceStatus;
        source: string;
        notes: string;
        data?: unknown;
    }[];
    lScore?: {
        performance: number;
        accuracy: number;
        security: number;
        composite: number;
        completeness: number;
        maintainability: number;
        testCoverage: number;
    } | undefined;
}, {
    phase: number;
    evidence: {
        status: EvidenceStatus;
        source: string;
        notes: string;
        data?: unknown;
    }[];
    lScore?: {
        performance: number;
        accuracy: number;
        security: number;
        composite: number;
        completeness: number;
        maintainability: number;
        testCoverage: number;
    } | undefined;
}>;
export type IVerificationContext = z.infer<typeof VerificationContextSchema>;
/**
 * Execute a single verification check using the appropriate method.
 *
 * @param entry - Verification matrix entry defining the check
 * @param evidence - Collected evidence items
 * @param lScore - Optional L-Score for integrated verification
 * @returns Verification check result
 */
export declare function executeVerificationCheck(entry: IVerificationMatrixEntry, evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationCheck;
/**
 * Run full verification matrix for a phase.
 *
 * @param verificationMatrix - Matrix entries to verify
 * @param evidence - Collected evidence items
 * @param lScore - Optional L-Score for integrated verification
 * @returns Array of verification check results
 */
export declare function runVerificationMatrix(verificationMatrix: readonly IVerificationMatrixEntry[], evidence: readonly IEvidenceItem[], lScore?: ILScoreBreakdown): IVerificationCheck[];
/**
 * Calculate verification matrix pass rate.
 *
 * @param results - Verification check results
 * @returns Pass rate from 0.0 to 1.0
 */
export declare function calculatePassRate(results: readonly IVerificationCheck[]): number;
//# sourceMappingURL=sherlock-verification-matrix.d.ts.map