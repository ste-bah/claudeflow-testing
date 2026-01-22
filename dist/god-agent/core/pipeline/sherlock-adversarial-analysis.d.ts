/**
 * Sherlock Adversarial Analysis
 *
 * Implements adversarial persona analysis for forensic investigations.
 * Extracted from sherlock-phase-reviewer.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-adversarial-analysis
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.3
 */
import { type IEvidenceItem, type IAdversarialFinding, type IPhaseInvestigationProtocol, AdversarialPersona } from './sherlock-phase-reviewer-types.js';
/**
 * Run adversarial persona analysis on collected evidence.
 *
 * Each persona approaches the evidence from a different perspective:
 * - THE_BUG: Looks for places to hide
 * - THE_ATTACKER: Looks for security blindspots
 * - THE_TIRED_DEVELOPER: Assesses maintainability
 * - THE_FUTURE_ARCHAEOLOGIST: Evaluates long-term context preservation
 *
 * @param protocol - Investigation protocol with personas to apply
 * @param evidence - Evidence items to analyze
 * @returns Findings from each adversarial persona
 */
export declare function runAdversarialAnalysis(protocol: IPhaseInvestigationProtocol, evidence: readonly IEvidenceItem[]): IAdversarialFinding[];
/**
 * Generate finding for a specific adversarial persona.
 *
 * @param persona - Adversarial persona to apply
 * @param evidence - All evidence items
 * @param missingEvidence - Evidence items that are missing or suspect
 * @returns Finding from the persona's perspective
 */
export declare function generateAdversarialFinding(persona: AdversarialPersona, evidence: readonly IEvidenceItem[], missingEvidence: readonly IEvidenceItem[]): IAdversarialFinding;
//# sourceMappingURL=sherlock-adversarial-analysis.d.ts.map