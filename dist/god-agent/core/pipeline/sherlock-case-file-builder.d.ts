/**
 * Sherlock Case File Builder
 *
 * Builds case files and generates markdown reports for forensic investigations.
 * Extracted from sherlock-phase-reviewer.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-case-file-builder
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.4
 */
import { type ICaseFile, type IEvidenceItem, type IVerificationCheck, type IAdversarialFinding, type IChainOfCustodyEvent, type IPhaseInvestigationProtocol, InvestigationTier, Verdict, VerdictConfidence } from './sherlock-phase-reviewer-types.js';
/**
 * Parameters for building a case file.
 */
export interface IBuildCaseFileParams {
    /** Phase number (1-7) */
    readonly phase: number;
    /** Investigation protocol used */
    readonly protocol: IPhaseInvestigationProtocol;
    /** Investigation tier */
    readonly tier: InvestigationTier;
    /** Final verdict */
    readonly verdict: Verdict;
    /** Verdict confidence */
    readonly confidence: VerdictConfidence;
    /** Evidence collected */
    readonly evidenceSummary: readonly IEvidenceItem[];
    /** Verification results */
    readonly verificationResults: readonly IVerificationCheck[];
    /** Adversarial findings */
    readonly adversarialFindings: readonly IAdversarialFinding[];
    /** Chain of custody events */
    readonly chainOfCustody: readonly IChainOfCustodyEvent[];
    /** Required remediations */
    readonly remediations: readonly string[];
}
/**
 * Build complete case file from investigation results.
 *
 * @param params - Case file parameters
 * @returns Complete case file
 */
export declare function buildCaseFile(params: IBuildCaseFileParams): ICaseFile;
/**
 * Generate markdown report from case file.
 *
 * @param caseFile - Case file to format
 * @returns Markdown-formatted case file report
 */
export declare function getCaseFileReport(caseFile: ICaseFile): string;
//# sourceMappingURL=sherlock-case-file-builder.d.ts.map