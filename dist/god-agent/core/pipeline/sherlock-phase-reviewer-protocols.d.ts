/**
 * Sherlock Phase Investigation Protocols
 *
 * Phase-specific investigation protocols per PRD Section 2.3.3.
 * Each protocol defines evidence sources, verification matrix, and verdict criteria.
 *
 * @module src/god-agent/core/pipeline/sherlock-phase-reviewer-protocols
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.3
 */
import { type IPhaseInvestigationProtocol, AdversarialPersona } from './sherlock-phase-reviewer-types.js';
/**
 * Phase 1 investigation protocol: Understanding Verification.
 * Verifies task analysis and requirement extraction.
 */
export declare const PHASE_1_UNDERSTANDING_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 2 investigation protocol: Exploration Verification.
 * Verifies solution exploration and pattern analysis.
 */
export declare const PHASE_2_EXPLORATION_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 3 investigation protocol: Architecture Verification.
 * Verifies system architecture and interface design.
 */
export declare const PHASE_3_ARCHITECTURE_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 4 investigation protocol: Implementation Verification.
 * Verifies code implementation against architecture.
 */
export declare const PHASE_4_IMPLEMENTATION_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 5 investigation protocol: Testing Verification.
 * Verifies test suite completeness and coverage.
 */
export declare const PHASE_5_TESTING_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 6 investigation protocol: Optimization Verification.
 * Verifies production readiness and performance.
 */
export declare const PHASE_6_OPTIMIZATION_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * Phase 7 investigation protocol: Delivery Verification.
 * Verifies release readiness and documentation.
 */
export declare const PHASE_7_DELIVERY_PROTOCOL: IPhaseInvestigationProtocol;
/**
 * All phase investigation protocols in order.
 */
export declare const ALL_PHASE_PROTOCOLS: readonly IPhaseInvestigationProtocol[];
/**
 * Get investigation protocol for a specific phase.
 *
 * @param phase - Phase number (1-7)
 * @returns The investigation protocol or undefined
 */
export declare function getProtocolForPhase(phase: number): IPhaseInvestigationProtocol | undefined;
/**
 * Get all evidence sources for a phase.
 *
 * @param phase - Phase number (1-7)
 * @returns Array of memory keys for evidence sources
 */
export declare function getEvidenceSourcesForPhase(phase: number): readonly string[];
/**
 * Get adversarial personas for a phase.
 *
 * @param phase - Phase number (1-7)
 * @returns Array of adversarial personas to apply
 */
export declare function getAdversarialPersonasForPhase(phase: number): readonly AdversarialPersona[];
/**
 * Get protocol summary for logging/reporting.
 *
 * @returns Summary of all protocols
 */
export declare function getProtocolSummary(): Record<number, {
    subject: string;
    checks: number;
}>;
//# sourceMappingURL=sherlock-phase-reviewer-protocols.d.ts.map