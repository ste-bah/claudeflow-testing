import { CodingQualityGateValidator } from './coding-quality-gate-validator.js';
import { type ILScoreBreakdown, type IGateValidationContext, type IGateValidationResult } from './coding-quality-gate-types.js';
import { SherlockPhaseReviewer, type IMemoryRetriever } from './sherlock-phase-reviewer.js';
import { type IPhaseReviewResult, InvestigationTier } from './sherlock-phase-reviewer-types.js';
import { SherlockLearningIntegration, type ISherlockLearningConfig } from './sherlock-learning-integration.js';
import type { ISonaEngine } from '../learning/sona-types.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
/**
 * Supported pipeline types for isolation validation.
 * This module is ONLY for /god-code pipeline, NOT PhD pipeline.
 */
export type PipelineType = 'coding' | 'phd';
/**
 * Configuration for the integrated validator.
 */
export interface IIntegratedValidatorConfig {
    /** Memory retriever for Sherlock */
    readonly memoryRetriever: IMemoryRetriever;
    /** Enable verbose logging */
    readonly verbose?: boolean;
    /** Auto-trigger Sherlock on gate failure */
    readonly autoTriggerSherlock?: boolean;
    /** Default tier for standard reviews */
    readonly defaultTier?: InvestigationTier;
    /** Pipeline type - MUST be 'coding' (PhD uses PhDQualityGateValidator) @default 'coding' */
    readonly pipelineType?: PipelineType;
    /** SonaEngine instance for learning integration (verdicts feed into RLM/LEANN) */
    readonly sonaEngine?: ISonaEngine | null;
    /** ReasoningBank instance for pattern storage (high-quality verdicts create patterns) */
    readonly reasoningBank?: ReasoningBank | null;
    /** Configuration for learning integration */
    readonly learningConfig?: Partial<ISherlockLearningConfig>;
}
/**
 * Combined validation result from both systems.
 */
export interface IIntegratedValidationResult {
    /** Gate validation result */
    readonly gateResult: IGateValidationResult;
    /** Sherlock review result (if triggered) */
    readonly sherlockResult?: IPhaseReviewResult;
    /** Whether pipeline can proceed */
    readonly canProceed: boolean;
    /** Combined remediation actions */
    readonly remediations: readonly string[];
    /** Effective investigation tier used */
    readonly investigationTier?: InvestigationTier;
    /** Timestamp */
    readonly timestamp: Date;
}
/**
 * Error codes for integration errors.
 */
export type IntegrationErrorCode = 'CONFIG_INVALID' | 'PHASE_INVALID' | 'VALIDATION_FAILED' | 'SHERLOCK_FAILED';
/**
 * Custom error class for integration errors.
 */
export declare class IntegratedValidatorError extends Error {
    readonly code: IntegrationErrorCode;
    readonly phase?: number | undefined;
    constructor(code: IntegrationErrorCode, message: string, phase?: number | undefined);
}
/**
 * Integrated validator combining Quality Gate and Sherlock Phase Review.
 *
 * When a Quality Gate fails (SOFT_REJECT or HARD_REJECT), automatically
 * triggers a Sherlock INVESTIGATION tier review for detailed forensics.
 *
 * @example
 * ```typescript
 * const validator = createIntegratedValidator({
 *   memoryRetriever: myMemory,
 *   autoTriggerSherlock: true,
 * });
 *
 * const result = await validator.validatePhase(3, lScore, context);
 * if (!result.canProceed) {
 *   console.log('Remediations:', result.remediations);
 * }
 * ```
 */
export declare class IntegratedValidator {
    private readonly _gateValidator;
    private readonly _sherlockReviewer;
    private readonly _learningIntegration;
    private readonly _autoTriggerSherlock;
    private readonly _verbose;
    private readonly _validationHistory;
    constructor(config: IIntegratedValidatorConfig);
    /** Validate phase boundary with integrated Quality Gate and Sherlock review. */
    validatePhase(phase: number, lScore: ILScoreBreakdown, context: IGateValidationContext, retryCount?: number): Promise<IIntegratedValidationResult>;
    /** Run Sherlock review directly (without gate validation). */
    reviewPhase(phase: number, tier?: InvestigationTier, retryCount?: number): Promise<IPhaseReviewResult>;
    /**
     * Quick gate check without Sherlock.
     *
     * @param phase - Phase number
     * @param lScore - L-Score breakdown
     * @returns Whether gate passes
     */
    quickGateCheck(phase: number, lScore: ILScoreBreakdown): boolean;
    /**
     * Get validation history.
     */
    getValidationHistory(): IIntegratedValidationResult[];
    /**
     * Get underlying gate validator.
     */
    getGateValidator(): CodingQualityGateValidator;
    /**
     * Get underlying Sherlock reviewer.
     */
    getSherlockReviewer(): SherlockPhaseReviewer;
    /**
     * Get underlying learning integration.
     */
    getLearningIntegration(): SherlockLearningIntegration;
    /**
     * Clear all validation history.
     */
    clearHistory(): void;
    /**
     * Determine if Sherlock review should be triggered.
     *
     * Per PRD Section 2.3: "Each phase concludes with a **mandatory forensic review**
     * by the sherlock-holmes agent before proceeding to the next phase."
     *
     * This implements the "Guilty Until Proven Innocent" verification model where
     * ALL phases are reviewed, not just failures. The investigation tier is
     * selected based on gate result severity via _selectTier().
     *
     * @private
     */
    private _shouldTriggerSherlock;
    /**
     * Select investigation tier based on gate result.
     * @private
     */
    private _selectTier;
    /**
     * Determine if pipeline can proceed based on both results.
     * @private
     */
    private _determineCanProceed;
    /**
     * Combine remediations from both systems.
     * @private
     */
    private _combineRemediations;
    /**
     * Trim history to bounded size (prevents memory leaks).
     * @private
     */
    private _trimHistory;
    /**
     * Record Sherlock verdict in learning system.
     * @private
     */
    private _recordLearningFeedback;
    /**
     * Log message if verbose mode enabled.
     * @private
     */
    private _log;
}
/**
 * Create an integrated validator instance.
 *
 * @param config - Configuration options
 * @returns New IntegratedValidator instance
 */
export declare function createIntegratedValidator(config: IIntegratedValidatorConfig): IntegratedValidator;
/** Create a minimal integrated validator for testing. */
export declare function createTestIntegratedValidator(memoryRetriever: IMemoryRetriever): IntegratedValidator;
//# sourceMappingURL=sherlock-quality-gate-integration.d.ts.map