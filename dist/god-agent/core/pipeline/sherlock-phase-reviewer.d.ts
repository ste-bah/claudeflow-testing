/**
 * Sherlock Phase Reviewer
 *
 * Implements "Guilty Until Proven Innocent" forensic review for each pipeline phase.
 * Integrates with CodingQualityGateValidator for comprehensive phase verification.
 *
 * @module src/god-agent/core/pipeline/sherlock-phase-reviewer
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import { type ICaseFile, type IPhaseReviewResult, InvestigationTier } from './sherlock-phase-reviewer-types.js';
import type { ILScoreBreakdown } from './coding-quality-gate-types.js';
export { handlePhaseReviewResult, type IPhaseReviewCallbacks } from './sherlock-flow-handler.js';
/**
 * Memory retrieval function interface.
 * Injected dependency for retrieving evidence from memory system.
 */
export interface IMemoryRetriever {
    /**
     * Retrieve value from memory by key.
     *
     * @param key - Memory key to retrieve
     * @returns The stored value or undefined
     */
    retrieve(key: string): Promise<unknown>;
    /**
     * Store value in memory.
     *
     * @param key - Memory key
     * @param value - Value to store
     */
    store(key: string, value: unknown): Promise<void>;
}
/**
 * Configuration for SherlockPhaseReviewer.
 */
export interface ISherlockPhaseReviewerConfig {
    /** Memory retrieval interface */
    readonly memoryRetriever: IMemoryRetriever;
    /** Enable verbose logging */
    readonly verbose?: boolean;
    /** Override default tier selection */
    readonly defaultTier?: InvestigationTier;
    /** Optional L-Score for integrated verification */
    readonly lScore?: ILScoreBreakdown;
}
/**
 * Sherlock Phase Reviewer - Forensic verification for coding pipeline phases.
 *
 * Implements the "Guilty Until Proven Innocent" methodology, conducting
 * thorough forensic investigation of each phase's outputs before allowing
 * progression to the next phase.
 *
 * @example
 * ```typescript
 * const reviewer = createSherlockPhaseReviewer({
 *   memoryRetriever: myMemorySystem,
 *   verbose: true,
 * });
 *
 * const result = await reviewer.reviewPhase(3, InvestigationTier.INVESTIGATION);
 * if (result.verdict === Verdict.GUILTY) {
 *   console.log('Remediation required:', result.remediations);
 * }
 * ```
 */
export declare class SherlockPhaseReviewer {
    private readonly _memoryRetriever;
    private readonly _verbose;
    private readonly _defaultTier;
    private readonly _reviewHistory;
    private _currentLScore?;
    /**
     * Creates a new SherlockPhaseReviewer.
     *
     * @param config - Reviewer configuration
     * @throws {SherlockPhaseReviewerError} If configuration is invalid
     */
    constructor(config: ISherlockPhaseReviewerConfig);
    /**
     * Set L-Score for integrated verification.
     *
     * @param lScore - L-Score breakdown to use in verification
     */
    setLScore(lScore: ILScoreBreakdown): void;
    /**
     * Conduct forensic review of a pipeline phase.
     *
     * @param phase - Phase number (1-7)
     * @param tier - Optional investigation tier override
     * @param retryCount - Current retry count
     * @param lScore - Optional L-Score for integrated verification
     * @returns Promise resolving to the phase review result
     * @throws {SherlockPhaseReviewerError} If phase is invalid or protocol not found
     */
    reviewPhase(phase: number, tier?: InvestigationTier, retryCount?: number, lScore?: ILScoreBreakdown): Promise<IPhaseReviewResult>;
    /**
     * Get review history.
     *
     * @returns Copy of review history
     */
    getReviewHistory(): IPhaseReviewResult[];
    /**
     * Clear review history.
     */
    clearHistory(): void;
    /**
     * Get case file report as markdown.
     * Delegates to sherlock-case-file-builder module.
     *
     * @param caseFile - Case file to format
     * @returns Markdown-formatted case file
     */
    getCaseFileReport(caseFile: ICaseFile): string;
    /**
     * Select investigation tier based on context.
     * @private
     */
    private _selectTier;
    /**
     * Collect evidence from memory.
     * @private
     */
    private _collectEvidence;
    /**
     * Store forensic findings in memory.
     * @private
     */
    private _storeForensicFindings;
    /**
     * Log message if verbose mode enabled.
     * @private
     */
    private _log;
}
/**
 * Create a SherlockPhaseReviewer instance.
 *
 * @param config - Reviewer configuration
 * @returns New SherlockPhaseReviewer instance
 */
export declare function createSherlockPhaseReviewer(config: ISherlockPhaseReviewerConfig): SherlockPhaseReviewer;
export { InvestigationTier, Verdict, VerdictConfidence, EvidenceStatus, AdversarialPersona, INVESTIGATION_TIER_CONFIG, FORENSIC_MEMORY_NAMESPACE, MAX_RETRY_COUNT, PHASE_NAMES, SherlockPhaseReviewerError, } from './sherlock-phase-reviewer-types.js';
export type { ICaseFile, IPhaseReviewResult, IEvidenceItem, IVerificationCheck, IAdversarialFinding, IChainOfCustodyEvent, IPhaseInvestigationProtocol, } from './sherlock-phase-reviewer-types.js';
export { ALL_PHASE_PROTOCOLS, getProtocolForPhase, getEvidenceSourcesForPhase, getAdversarialPersonasForPhase, } from './sherlock-phase-reviewer-protocols.js';
export { buildCaseFile, getCaseFileReport } from './sherlock-case-file-builder.js';
export { renderVerdict, type IVerdictResult } from './sherlock-verdict-engine.js';
export { runAdversarialAnalysis, generateAdversarialFinding } from './sherlock-adversarial-analysis.js';
//# sourceMappingURL=sherlock-phase-reviewer.d.ts.map