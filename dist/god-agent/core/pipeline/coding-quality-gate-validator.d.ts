/**
 * Coding Quality Gate Validator
 *
 * Validates L-Scores (Learning Scores) at phase boundaries within the
 * God Agent Coding Pipeline. Each gate enforces minimum quality thresholds
 * before allowing progression to the next phase.
 *
 * @module src/god-agent/core/pipeline/coding-quality-gate-validator
 * @see docs/coding-pipeline/quality-gate-system.md
 */
import type { CodingPipelinePhase } from './types.js';
import { type ILScoreBreakdown, type IGateValidationContext, type IGateValidationResult, type IQualityGate, PipelinePhase } from './coding-quality-gate-types.js';
export { LScoreBreakdownSchema, GateValidationContextSchema, GateIdSchema } from './coding-quality-gate-schemas.js';
/**
 * Error codes for quality gate validation errors.
 */
export type QualityGateErrorCode = 'UNKNOWN_GATE' | 'VALIDATION_FAILED' | 'INVALID_INPUT' | 'GATE_NOT_FOUND';
/**
 * Custom error class for coding quality gate validation errors.
 * Includes error codes per constitution ERR-002.
 * Named CodingQualityGateError to avoid conflict with pipeline-errors.ts QualityGateError.
 */
export declare class CodingQualityGateError extends Error {
    readonly code: QualityGateErrorCode;
    /**
     * Creates a new CodingQualityGateError.
     *
     * @param code - The error code
     * @param message - Human-readable error message
     */
    constructor(code: QualityGateErrorCode, message: string);
}
/**
 * Quality Gate Validation Engine for Coding Pipeline.
 *
 * Validates L-Scores at phase boundaries, handles remediation workflows,
 * and integrates with the EMERG bypass system.
 *
 * @example
 * ```typescript
 * const validator = createCodingQualityGateValidator();
 * const result = await validator.validateGate('GATE-01-UNDERSTANDING', lScore, context);
 * if (!result.passed) {
 *   console.log(validator.getFailureReport(result));
 * }
 * ```
 */
export declare class CodingQualityGateValidator {
    private readonly _gates;
    private readonly _validationHistory;
    constructor();
    /**
     * Register all gates in the validator.
     * @private
     */
    private _registerAllGates;
    /**
     * Get gate by ID.
     *
     * @param gateId - The gate identifier
     * @returns The gate definition or undefined if not found
     */
    getGate(gateId: string): IQualityGate | undefined;
    /**
     * Get gate for a specific phase transition.
     *
     * @param phase - The pipeline phase before the gate
     * @returns The gate definition or undefined if not found
     */
    getGateForPhase(phase: PipelinePhase | CodingPipelinePhase): IQualityGate | undefined;
    /**
     * Validate L-Score against gate requirements.
     *
     * @param gateId - The gate identifier to validate against
     * @param lScore - The L-Score breakdown to validate
     * @param context - The validation context with remediation info
     * @returns Promise resolving to the validation result
     * @throws {CodingQualityGateError} If gate is not found or input is invalid
     */
    validateGate(gateId: string, lScore: ILScoreBreakdown, context: IGateValidationContext): Promise<IGateValidationResult>;
    /**
     * Check if emergency bypass conditions are met.
     * @private
     */
    private _checkBypassConditions;
    /**
     * Log a bypass event.
     * @private
     */
    private _logBypassEvent;
    /**
     * Determine if this is a hard rejection scenario.
     * @private
     */
    private _isHardRejection;
    /**
     * Generate remediation actions based on violations.
     * @private
     */
    private _generateRemediationActions;
    /**
     * Record result in history and return.
     * @private
     */
    private _recordAndReturn;
    /**
     * Get validation history.
     * @returns Copy of the validation history array
     */
    getValidationHistory(): IGateValidationResult[];
    /**
     * Clear validation history.
     */
    clearHistory(): void;
    /**
     * Quick check if L-Score passes gate (without full validation).
     */
    quickCheck(gateId: string, lScore: ILScoreBreakdown): boolean;
    /**
     * Get detailed failure report for a validation result.
     */
    getFailureReport(result: IGateValidationResult): string;
    /**
     * Create an L-Score breakdown with composite calculation.
     */
    static createLScore(components: Omit<ILScoreBreakdown, 'composite'>, phase: PipelinePhase | CodingPipelinePhase): ILScoreBreakdown;
}
/**
 * Create a coding quality gate validator instance.
 * @returns A new CodingQualityGateValidator instance
 */
export declare function createCodingQualityGateValidator(): CodingQualityGateValidator;
/**
 * Get all gate definitions.
 * @returns Array of all quality gate definitions
 */
export declare function getAllGates(): readonly IQualityGate[];
//# sourceMappingURL=coding-quality-gate-validator.d.ts.map