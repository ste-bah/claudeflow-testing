/**
 * Sherlock Verdict Engine
 *
 * Renders final verdicts based on evidence and adversarial analysis.
 * Extracted from sherlock-phase-reviewer.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-verdict-engine
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.6
 */
import { type IVerificationCheck, type IAdversarialFinding, type IPhaseInvestigationProtocol, Verdict, VerdictConfidence } from './sherlock-phase-reviewer-types.js';
/**
 * Result of verdict rendering.
 */
export interface IVerdictResult {
    /** Final verdict */
    readonly verdict: Verdict;
    /** Confidence in verdict */
    readonly confidence: VerdictConfidence;
    /** Required remediations if GUILTY */
    readonly remediations: string[];
}
/**
 * Render final verdict based on verification results and adversarial findings.
 *
 * The verdict engine implements "Guilty Until Proven Innocent" methodology:
 * - INNOCENT: All checks passed, no critical findings
 * - GUILTY: Critical issues found or majority of checks failed
 * - INSUFFICIENT_EVIDENCE: Some failures but not conclusive
 *
 * @param _protocol - Investigation protocol (reserved for future use)
 * @param verificationResults - Results from verification matrix
 * @param adversarialFindings - Findings from adversarial analysis
 * @returns Verdict result with confidence and remediations
 */
export declare function renderVerdict(_protocol: IPhaseInvestigationProtocol, verificationResults: readonly IVerificationCheck[], adversarialFindings: readonly IAdversarialFinding[]): IVerdictResult;
//# sourceMappingURL=sherlock-verdict-engine.d.ts.map