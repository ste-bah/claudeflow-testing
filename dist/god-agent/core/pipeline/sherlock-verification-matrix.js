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
import { EvidenceStatus, } from './sherlock-phase-reviewer-types.js';
// Import all verification methods from extracted module
import { executeCrossReference, executeScanAssumptions, executeVerifyBoundaries, executeTestConstraints, executePatternMatch, executeTradeoffAnalysis, executeAceVAnalysis, executeDetectCycles, executeTypeSoundness, executeTraceExecution, executeTestExceptionPaths, executeContradictionEngine, executeVerifyCoverage, executeTestBoundaries, executeRegressionCheck, executePerformanceCompare, executeOwaspScan, executeComplexityMetrics, executeDocumentationCheck, executeReviewStatus, executeArtifactIntegrity, executeDefaultVerification, } from './sherlock-verification-methods.js';
// Re-export types and thresholds for convenience
export { PHASE_1_THRESHOLDS, PHASE_2_THRESHOLDS, PHASE_3_THRESHOLDS, PHASE_4_THRESHOLDS, PHASE_5_THRESHOLDS, PHASE_6_THRESHOLDS, PHASE_7_THRESHOLDS, LSCORE_VERIFICATION_THRESHOLD, } from './sherlock-verification-methods.js';
// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION METHOD ENUM
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Verification method identifiers per PRD 2.3.3.
 */
export var VerificationMethod;
(function (VerificationMethod) {
    VerificationMethod["CROSS_REFERENCE"] = "cross_reference";
    VerificationMethod["SCAN_ASSUMPTIONS"] = "scan_assumptions";
    VerificationMethod["VERIFY_BOUNDARIES"] = "verify_boundaries";
    VerificationMethod["TEST_CONSTRAINTS"] = "test_constraints";
    VerificationMethod["PATTERN_MATCH"] = "pattern_match";
    VerificationMethod["TRADEOFF_ANALYSIS"] = "tradeoff_analysis";
    VerificationMethod["ACE_V_ANALYSIS"] = "ace_v_analysis";
    VerificationMethod["DETECT_CYCLES"] = "detect_cycles";
    VerificationMethod["TYPE_SOUNDNESS"] = "type_soundness";
    VerificationMethod["TRACE_EXECUTION"] = "trace_execution";
    VerificationMethod["TEST_EXCEPTION_PATHS"] = "test_exception_paths";
    VerificationMethod["CONTRADICTION_ENGINE"] = "contradiction_engine";
    VerificationMethod["VERIFY_COVERAGE"] = "verify_coverage";
    VerificationMethod["TEST_BOUNDARIES"] = "test_boundaries";
    VerificationMethod["REGRESSION_CHECK"] = "regression_check";
    VerificationMethod["PERFORMANCE_COMPARE"] = "performance_compare";
    VerificationMethod["OWASP_SCAN"] = "owasp_scan";
    VerificationMethod["COMPLEXITY_METRICS"] = "complexity_metrics";
    VerificationMethod["DOCUMENTATION_CHECK"] = "documentation_check";
    VerificationMethod["REVIEW_STATUS"] = "review_status";
    VerificationMethod["ARTIFACT_INTEGRITY"] = "artifact_integrity";
})(VerificationMethod || (VerificationMethod = {}));
// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS (TS-004 Compliance)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Zod schema for verification context.
 */
export const VerificationContextSchema = z.object({
    phase: z.number().int().min(1).max(7),
    evidence: z.array(z.object({
        source: z.string(),
        status: z.nativeEnum(EvidenceStatus),
        notes: z.string(),
        data: z.unknown().optional(),
    })),
    lScore: z.object({
        accuracy: z.number().min(0).max(1),
        completeness: z.number().min(0).max(1),
        maintainability: z.number().min(0).max(1),
        security: z.number().min(0).max(1),
        performance: z.number().min(0).max(1),
        testCoverage: z.number().min(0).max(1),
        composite: z.number().min(0).max(1),
    }).optional(),
});
// ═══════════════════════════════════════════════════════════════════════════
// METHOD ROUTING - Maps method strings to verification functions
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Route method string to appropriate verification function.
 * Split into smaller helper functions for constitution compliance (< 50 lines per function).
 */
function routePhase1Methods(methodLower, evidence, lScore) {
    if (methodLower.includes('cross-reference') || methodLower.includes('cross reference')) {
        return executeCrossReference(evidence, lScore);
    }
    if (methodLower.includes('scan') && methodLower.includes('assumption')) {
        return executeScanAssumptions(evidence);
    }
    if (methodLower.includes('verify') && methodLower.includes('scope')) {
        return executeVerifyBoundaries(evidence);
    }
    return null;
}
function routePhase2Methods(methodLower, evidence) {
    if (methodLower.includes('test') && methodLower.includes('constraint')) {
        return executeTestConstraints(evidence);
    }
    if (methodLower.includes('pattern') && methodLower.includes('match')) {
        return executePatternMatch(evidence);
    }
    if (methodLower.includes('trade-off') || methodLower.includes('pros/cons')) {
        return executeTradeoffAnalysis(evidence);
    }
    return null;
}
function routePhase3Methods(methodLower, evidence, lScore) {
    if (methodLower.includes('ace-v')) {
        return executeAceVAnalysis(evidence);
    }
    if (methodLower.includes('circular') || methodLower.includes('cycle')) {
        return executeDetectCycles(evidence);
    }
    if (methodLower.includes('type') && methodLower.includes('sound')) {
        return executeTypeSoundness(evidence, lScore);
    }
    return null;
}
function routePhase4Methods(methodLower, evidence, lScore) {
    if (methodLower.includes('trace') && methodLower.includes('execution')) {
        return executeTraceExecution(evidence, lScore);
    }
    if (methodLower.includes('exception') || methodLower.includes('error')) {
        return executeTestExceptionPaths(evidence, lScore);
    }
    if (methodLower.includes('contradiction')) {
        return executeContradictionEngine(evidence);
    }
    return null;
}
function routePhase5Methods(methodLower, evidence, lScore) {
    const isPathVerify = methodLower.includes('path') &&
        (methodLower.includes('test') || methodLower.includes('coverage') || methodLower.includes('verify'));
    if (isPathVerify) {
        return executeVerifyCoverage(evidence, lScore);
    }
    if (methodLower.includes('boundary') || methodLower.includes('edge case')) {
        return executeTestBoundaries(evidence);
    }
    if (methodLower.includes('regression')) {
        return executeRegressionCheck(evidence);
    }
    return null;
}
function routePhase6Methods(methodLower, evidence, lScore) {
    if (methodLower.includes('performance') || methodLower.includes('benchmark')) {
        return executePerformanceCompare(evidence, lScore);
    }
    if (methodLower.includes('owasp') || methodLower.includes('security')) {
        return executeOwaspScan(evidence, lScore);
    }
    if (methodLower.includes('complexity') || methodLower.includes('lint')) {
        return executeComplexityMetrics(evidence, lScore);
    }
    return null;
}
function routePhase7Methods(methodLower, evidence) {
    if (methodLower.includes('document')) {
        return executeDocumentationCheck(evidence);
    }
    if (methodLower.includes('review')) {
        return executeReviewStatus(evidence);
    }
    if (methodLower.includes('artifact') || methodLower.includes('package')) {
        return executeArtifactIntegrity(evidence);
    }
    return null;
}
// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION MATRIX EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Execute a single verification check using the appropriate method.
 *
 * @param entry - Verification matrix entry defining the check
 * @param evidence - Collected evidence items
 * @param lScore - Optional L-Score for integrated verification
 * @returns Verification check result
 */
export function executeVerificationCheck(entry, evidence, lScore) {
    const methodLower = entry.method.toLowerCase();
    // Try each phase's methods in order
    const result = routePhase1Methods(methodLower, evidence, lScore) ||
        routePhase2Methods(methodLower, evidence) ||
        routePhase3Methods(methodLower, evidence, lScore) ||
        routePhase4Methods(methodLower, evidence, lScore) ||
        routePhase5Methods(methodLower, evidence, lScore) ||
        routePhase6Methods(methodLower, evidence, lScore) ||
        routePhase7Methods(methodLower, evidence) ||
        executeDefaultVerification(evidence);
    return {
        check: entry.check,
        method: entry.method,
        expected: entry.threshold,
        actual: result.actual,
        passed: result.passed,
    };
}
/**
 * Run full verification matrix for a phase.
 *
 * @param verificationMatrix - Matrix entries to verify
 * @param evidence - Collected evidence items
 * @param lScore - Optional L-Score for integrated verification
 * @returns Array of verification check results
 */
export function runVerificationMatrix(verificationMatrix, evidence, lScore) {
    const results = [];
    for (const entry of verificationMatrix) {
        const result = executeVerificationCheck(entry, evidence, lScore);
        results.push(result);
    }
    return results;
}
/**
 * Calculate verification matrix pass rate.
 *
 * @param results - Verification check results
 * @returns Pass rate from 0.0 to 1.0
 */
export function calculatePassRate(results) {
    if (results.length === 0)
        return 0;
    const passed = results.filter((r) => r.passed).length;
    return passed / results.length;
}
//# sourceMappingURL=sherlock-verification-matrix.js.map