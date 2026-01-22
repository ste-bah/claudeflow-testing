/**
 * Coding Pipeline Sherlock Validator
 *
 * Extracted validation logic for Sherlock-Quality Gate integration.
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/coding-pipeline-sherlock-validator
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
import { z } from 'zod';
import type { CodingPipelinePhase } from './types.js';
import type { IPhaseExecutionResult } from './types.js';
import type { ILScoreBreakdown } from './coding-quality-gate-types.js';
import type { IntegratedValidator, IIntegratedValidationResult } from './sherlock-quality-gate-integration.js';
/**
 * Error codes for Sherlock validation.
 */
export type SherlockValidatorErrorCode = 'VALIDATION_FAILED' | 'PHASE_INVALID' | 'LSCORE_CALCULATION_FAILED';
/**
 * Custom error class for Sherlock validation errors.
 */
export declare class SherlockValidatorError extends Error {
    readonly code: SherlockValidatorErrorCode;
    readonly phase?: CodingPipelinePhase | undefined;
    constructor(code: SherlockValidatorErrorCode, message: string, phase?: CodingPipelinePhase | undefined);
}
/**
 * Map CodingPipelinePhase to numeric phase for Sherlock.
 */
export declare const PHASE_TO_NUMBER: Readonly<Record<CodingPipelinePhase, number>>;
/**
 * L-Score thresholds per phase.
 * Later phases require higher quality scores.
 */
export declare const PHASE_L_SCORE_THRESHOLDS: Readonly<Record<CodingPipelinePhase, number>>;
/**
 * L-Score component weights for calculation.
 * Weights sum to 1.0.
 */
export declare const L_SCORE_WEIGHTS: {
    readonly accuracy: 0.25;
    readonly completeness: 0.2;
    readonly maintainability: 0.15;
    readonly security: 0.15;
    readonly performance: 0.1;
    readonly testCoverage: 0.15;
};
/**
 * Configuration for Sherlock validation.
 */
export interface ISherlockValidatorConfig {
    /** Enable verbose logging */
    readonly verbose?: boolean;
    /** Default L-Score for missing components */
    readonly defaultComponentScore?: number;
}
/**
 * Zod schema for configuration validation.
 */
export declare const SherlockValidatorConfigSchema: z.ZodObject<{
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    defaultComponentScore: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    defaultComponentScore: number;
}, {
    verbose?: boolean | undefined;
    defaultComponentScore?: number | undefined;
}>;
/**
 * Calculate L-Score breakdown for a phase execution result.
 *
 * Components are weighted and combined into composite score:
 * - accuracy: 0.25 (code correctness)
 * - completeness: 0.20 (feature coverage)
 * - maintainability: 0.15 (code quality)
 * - security: 0.15 (vulnerability absence)
 * - performance: 0.10 (efficiency)
 * - testCoverage: 0.15 (test quality)
 *
 * @param phase - Current pipeline phase
 * @param phaseResult - Execution result from phase
 * @param config - Optional configuration
 * @returns L-Score breakdown with composite
 */
export declare function calculatePhaseLScore(phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult, config?: ISherlockValidatorConfig): ILScoreBreakdown;
/**
 * Validate phase with integrated Sherlock-Quality Gate system.
 *
 * Per PRD Section 2.3: "Each phase concludes with a mandatory forensic review
 * by the sherlock-holmes agent before proceeding to the next phase."
 *
 * @param validator - IntegratedValidator instance
 * @param phase - Current pipeline phase
 * @param phaseResult - Execution result from phase
 * @param retryCount - Number of retry attempts (escalates investigation tier)
 * @param config - Optional configuration
 * @returns Validation result or null if validator unavailable
 */
export declare function validatePhaseWithSherlock(validator: IntegratedValidator | null, phase: CodingPipelinePhase, phaseResult: IPhaseExecutionResult, retryCount?: number, config?: ISherlockValidatorConfig): Promise<IIntegratedValidationResult | null>;
/**
 * Handle Sherlock GUILTY verdict by extracting remediation actions.
 *
 * @param validationResult - Result from Sherlock validation
 * @param phase - Current pipeline phase
 * @param config - Optional configuration
 * @returns Array of remediation action strings
 */
export declare function handleSherlockGuiltyVerdict(validationResult: IIntegratedValidationResult, phase: CodingPipelinePhase, config?: ISherlockValidatorConfig): string[];
/**
 * Check if L-Score meets phase threshold.
 *
 * @param phase - Pipeline phase
 * @param lScore - L-Score breakdown
 * @returns Whether composite meets threshold
 */
export declare function meetsPhaseThreshold(phase: CodingPipelinePhase, lScore: ILScoreBreakdown): boolean;
/**
 * Get threshold for a phase.
 *
 * @param phase - Pipeline phase
 * @returns Threshold value (0.75 - 0.95)
 */
export declare function getPhaseThreshold(phase: CodingPipelinePhase): number;
/**
 * Get numeric phase number.
 *
 * @param phase - Pipeline phase
 * @returns Phase number (1-7)
 */
export declare function getPhaseNumber(phase: CodingPipelinePhase): number;
//# sourceMappingURL=coding-pipeline-sherlock-validator.d.ts.map