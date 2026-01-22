/**
 * Coding Pipeline Sherlock Validator
 * Extracted from coding-pipeline-orchestrator.ts for constitution.xml compliance
 *
 * Handles:
 * - Phase validation with Sherlock forensic analysis
 * - L-Score calculation with weighted components
 * - GUILTY/INNOCENT verdict processing
 * - Remediation extraction from validation results
 */
import type { CodingPipelinePhase, IPhaseExecutionResult } from './types.js';
import type { IntegratedValidator, IIntegratedValidationResult } from './sherlock-quality-gate-integration.js';
import type { ILScoreBreakdown } from './coding-quality-gate-types.js';
/**
 * Weights for L-Score composite calculation
 * Total must equal 1.0
 */
export declare const L_SCORE_WEIGHTS: {
    readonly accuracy: 0.25;
    readonly completeness: 0.2;
    readonly maintainability: 0.15;
    readonly security: 0.15;
    readonly performance: 0.1;
    readonly testCoverage: 0.15;
};
/** Bonus applied when all critical agents pass */
export declare const CRITICAL_AGENT_BONUS = 0.1;
/** Maximum allowed L-Score (capped at 1.0) */
export declare const MAX_L_SCORE = 1;
/**
 * Validate a phase with Sherlock forensic analysis
 * Connects to the IntegratedValidator for GUILTY/INNOCENT verdicts
 *
 * @param integratedValidator - The Sherlock validator instance
 * @param phase - Current pipeline phase
 * @param phaseResult - Results from phase execution
 * @param retryCount - Number of remediation attempts
 * @param storeMemory - Function to store forensics audit trail
 * @param log - Logging function
 * @returns Validation result or null if validator unavailable
 */
export declare function validatePhaseWithSherlock(integratedValidator: IntegratedValidator | null, phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult, retryCount: number, storeMemory: (key: string, value: unknown) => void, log: (message: string) => void): Promise<IIntegratedValidationResult | null>;
/**
 * Calculate L-Score breakdown for a phase
 * Uses weighted components with phase-specific adjustments
 *
 * @param phase - Current pipeline phase
 * @param phaseResult - Results from phase execution
 * @returns L-Score breakdown with all components and composite
 */
export declare function calculatePhaseLScore(phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult): ILScoreBreakdown;
/**
 * Handle GUILTY verdict from Sherlock validation
 * Extracts remediations and stores audit trail
 *
 * @param validationResult - Result from Sherlock validation
 * @param phase - Current pipeline phase
 * @param storeMemory - Function to store forensics audit trail
 * @param log - Logging function
 * @returns Array of remediation actions to take
 */
export declare function handleSherlockGuiltyVerdict(validationResult: IIntegratedValidationResult, phase: CodingPipelinePhase, storeMemory: (key: string, value: unknown) => void, log: (message: string) => void): string[];
/**
 * Check if L-Score meets the threshold for a phase
 *
 * @param phase - Pipeline phase to check
 * @param lScore - L-Score breakdown to evaluate
 * @returns True if composite score meets or exceeds phase threshold
 */
export declare function meetsPhaseThreshold(phase: CodingPipelinePhase, lScore: ILScoreBreakdown): boolean;
//# sourceMappingURL=coding-sherlock-validator.d.ts.map