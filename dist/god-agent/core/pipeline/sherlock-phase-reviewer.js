/**
 * Sherlock Phase Reviewer
 *
 * Implements "Guilty Until Proven Innocent" forensic review for each pipeline phase.
 * Integrates with CodingQualityGateValidator for comprehensive phase verification.
 *
 * @module src/god-agent/core/pipeline/sherlock-phase-reviewer
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import { z } from 'zod';
import { InvestigationTier, EvidenceStatus, FORENSIC_MEMORY_NAMESPACE, DEFAULT_INVESTIGATION_TIER, PhaseNumberSchema, InvestigationTierSchema, SherlockPhaseReviewerError, } from './sherlock-phase-reviewer-types.js';
import { getProtocolForPhase } from './sherlock-phase-reviewer-protocols.js';
import { buildCaseFile, getCaseFileReport } from './sherlock-case-file-builder.js';
import { renderVerdict } from './sherlock-verdict-engine.js';
import { runAdversarialAnalysis } from './sherlock-adversarial-analysis.js';
import { runVerificationMatrix } from './sherlock-verification-matrix.js';
// Re-export flow handler for convenience
export { handlePhaseReviewResult } from './sherlock-flow-handler.js';
/**
 * Zod schema for reviewer configuration.
 */
const SherlockPhaseReviewerConfigSchema = z.object({
    memoryRetriever: z.object({
        retrieve: z.function().describe('Memory retrieve function'),
        store: z.function().describe('Memory store function'),
    }).describe('Memory retrieval interface'),
    verbose: z.boolean().optional().describe('Enable verbose logging'),
    defaultTier: InvestigationTierSchema.optional().describe('Default investigation tier'),
});
// ═══════════════════════════════════════════════════════════════════════════
// SHERLOCK PHASE REVIEWER CLASS
// ═══════════════════════════════════════════════════════════════════════════
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
export class SherlockPhaseReviewer {
    _memoryRetriever;
    _verbose;
    _defaultTier;
    _reviewHistory = [];
    _currentLScore;
    /**
     * Creates a new SherlockPhaseReviewer.
     *
     * @param config - Reviewer configuration
     * @throws {SherlockPhaseReviewerError} If configuration is invalid
     */
    constructor(config) {
        // Validate config (TS-004)
        const parsed = SherlockPhaseReviewerConfigSchema.safeParse(config);
        if (!parsed.success) {
            throw new SherlockPhaseReviewerError('VERIFICATION_FAILED', `Invalid configuration: ${parsed.error.message}`);
        }
        this._memoryRetriever = config.memoryRetriever;
        this._verbose = config.verbose ?? false;
        this._defaultTier = config.defaultTier ?? DEFAULT_INVESTIGATION_TIER;
        this._currentLScore = config.lScore;
    }
    /**
     * Set L-Score for integrated verification.
     *
     * @param lScore - L-Score breakdown to use in verification
     */
    setLScore(lScore) {
        this._currentLScore = lScore;
    }
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
    async reviewPhase(phase, tier, retryCount = 0, lScore) {
        // Use provided L-Score or fall back to configured one
        const effectiveLScore = lScore ?? this._currentLScore;
        // Validate phase (TS-004)
        const phaseResult = PhaseNumberSchema.safeParse(phase);
        if (!phaseResult.success) {
            throw new SherlockPhaseReviewerError('INVALID_PHASE', phaseResult.error.message, phase);
        }
        // Get protocol for phase
        const protocol = getProtocolForPhase(phase);
        if (!protocol) {
            throw new SherlockPhaseReviewerError('PROTOCOL_NOT_FOUND', `No investigation protocol found for phase ${phase}`, phase);
        }
        const effectiveTier = tier ?? this._selectTier(retryCount);
        this._log(`Starting ${effectiveTier} investigation for Phase ${phase}: ${protocol.subject}`);
        // Initialize chain of custody
        const chainOfCustody = [
            { event: 'Investigation initiated', timestamp: new Date() },
        ];
        // Collect evidence
        const evidenceSummary = await this._collectEvidence(protocol.evidenceSources, chainOfCustody);
        chainOfCustody.push({ event: 'Evidence collected', timestamp: new Date() });
        // Run verification matrix with enhanced verification (using sherlock-verification-matrix module)
        const verificationResults = runVerificationMatrix(protocol.verificationMatrix, evidenceSummary, effectiveLScore);
        chainOfCustody.push({ event: 'Verification matrix completed', timestamp: new Date() });
        // Run adversarial analysis (using extracted module)
        const adversarialFindings = runAdversarialAnalysis(protocol, evidenceSummary);
        chainOfCustody.push({ event: 'Adversarial analysis completed', timestamp: new Date() });
        // Render verdict (using extracted module)
        const { verdict, confidence, remediations } = renderVerdict(protocol, verificationResults, adversarialFindings);
        chainOfCustody.push({ event: 'Verdict rendered', timestamp: new Date() });
        // Build case file (using extracted module)
        const caseFile = buildCaseFile({
            phase,
            protocol,
            tier: effectiveTier,
            verdict,
            confidence,
            evidenceSummary,
            verificationResults,
            adversarialFindings,
            chainOfCustody,
            remediations,
        });
        // Store forensic findings in memory
        await this._storeForensicFindings(phase, caseFile, verdict, remediations);
        // Build result
        const result = {
            phase,
            verdict,
            confidence,
            remediations,
            retryCount,
            caseFile,
        };
        // Record in history
        this._reviewHistory.push(result);
        this._log(`Phase ${phase} verdict: ${verdict} (${confidence} confidence)`);
        return result;
    }
    /**
     * Get review history.
     *
     * @returns Copy of review history
     */
    getReviewHistory() {
        return [...this._reviewHistory];
    }
    /**
     * Clear review history.
     */
    clearHistory() {
        this._reviewHistory.length = 0;
    }
    /**
     * Get case file report as markdown.
     * Delegates to sherlock-case-file-builder module.
     *
     * @param caseFile - Case file to format
     * @returns Markdown-formatted case file
     */
    getCaseFileReport(caseFile) {
        return getCaseFileReport(caseFile);
    }
    /**
     * Select investigation tier based on context.
     * @private
     */
    _selectTier(retryCount) {
        if (retryCount >= 2)
            return InvestigationTier.DEEP_DIVE;
        if (retryCount >= 1)
            return InvestigationTier.INVESTIGATION;
        return this._defaultTier;
    }
    /**
     * Collect evidence from memory.
     * @private
     */
    async _collectEvidence(evidenceSources, chainOfCustody) {
        const evidence = [];
        for (const source of evidenceSources) {
            try {
                const data = await this._memoryRetriever.retrieve(source);
                if (data !== undefined && data !== null) {
                    evidence.push({
                        source,
                        status: EvidenceStatus.VERIFIED,
                        notes: 'Evidence retrieved successfully',
                        data,
                    });
                }
                else {
                    evidence.push({
                        source,
                        status: EvidenceStatus.MISSING,
                        notes: 'Evidence not found in memory',
                    });
                }
            }
            catch (error) {
                evidence.push({
                    source,
                    status: EvidenceStatus.SUSPECT,
                    notes: `Error retrieving evidence: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
            }
        }
        return evidence;
    }
    /**
     * Store forensic findings in memory.
     * @private
     */
    async _storeForensicFindings(phase, caseFile, verdict, remediations) {
        await this._memoryRetriever.store(FORENSIC_MEMORY_NAMESPACE.caseFile(phase), caseFile);
        await this._memoryRetriever.store(FORENSIC_MEMORY_NAMESPACE.verdict(phase), verdict);
        await this._memoryRetriever.store(FORENSIC_MEMORY_NAMESPACE.evidenceSummary(phase), caseFile.evidenceSummary);
        if (remediations.length > 0) {
            await this._memoryRetriever.store(FORENSIC_MEMORY_NAMESPACE.remediation(phase), remediations);
        }
    }
    /**
     * Log message if verbose mode enabled.
     * @private
     */
    _log(message) {
        if (this._verbose) {
            process.stderr.write(`[SHERLOCK] ${message}\n`);
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Create a SherlockPhaseReviewer instance.
 *
 * @param config - Reviewer configuration
 * @returns New SherlockPhaseReviewer instance
 */
export function createSherlockPhaseReviewer(config) {
    return new SherlockPhaseReviewer(config);
}
// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS FOR CONVENIENCE
// ═══════════════════════════════════════════════════════════════════════════
export { InvestigationTier, Verdict, VerdictConfidence, EvidenceStatus, AdversarialPersona, INVESTIGATION_TIER_CONFIG, FORENSIC_MEMORY_NAMESPACE, MAX_RETRY_COUNT, PHASE_NAMES, SherlockPhaseReviewerError, } from './sherlock-phase-reviewer-types.js';
export { ALL_PHASE_PROTOCOLS, getProtocolForPhase, getEvidenceSourcesForPhase, getAdversarialPersonasForPhase, } from './sherlock-phase-reviewer-protocols.js';
// Export case file builder functions
export { buildCaseFile, getCaseFileReport } from './sherlock-case-file-builder.js';
// Export verdict engine
export { renderVerdict } from './sherlock-verdict-engine.js';
// Export adversarial analysis
export { runAdversarialAnalysis, generateAdversarialFinding } from './sherlock-adversarial-analysis.js';
//# sourceMappingURL=sherlock-phase-reviewer.js.map