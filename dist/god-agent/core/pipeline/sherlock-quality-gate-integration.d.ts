/**
 * Sherlock-Quality Gate Integration
 *
 * Connects CodingQualityGateValidator to SherlockPhaseReviewer for unified
 * phase boundary validation. Quality Gate failures trigger Sherlock INVESTIGATION tier.
 *
 * @module src/god-agent/core/pipeline/sherlock-quality-gate-integration
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3
 */
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
    /**
     * Pipeline type - MUST be 'coding' for this validator.
     * PhD pipeline uses different quality validation (PhDQualityGateValidator).
     * @default 'coding'
     */
    readonly pipelineType?: PipelineType;
    /**
     * SonaEngine instance for learning integration.
     * When provided, Sherlock verdicts feed into the learning system.
     */
    readonly sonaEngine?: ISonaEngine | null;
    /**
     * ReasoningBank instance for pattern storage.
     * When provided, high-quality verdicts create learning patterns.
     */
    readonly reasoningBank?: ReasoningBank | null;
    /**
     * Configuration for learning integration.
     */
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
    /**
     * Validate phase boundary with integrated Quality Gate and Sherlock review.
     *
     * @param phase - Phase number (1-7)
     * @param lScore - L-Score breakdown
     * @param context - Gate validation context
     * @param retryCount - Current retry count for this phase
     * @returns Promise resolving to integrated validation result
     */
    validatePhase(phase: number, lScore: ILScoreBreakdown, context: IGateValidationContext, retryCount?: number): Promise<IIntegratedValidationResult>;
    /**
     * Run Sherlock review directly (without gate validation).
     *
     * @param phase - Phase number
     * @param tier - Investigation tier
     * @param retryCount - Retry count
     * @returns Sherlock review result
     */
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
/**
 * Create a minimal integrated validator for testing.
 *
 * @param memoryRetriever - Memory retriever implementation
 * @returns New IntegratedValidator instance
 */
export declare function createTestIntegratedValidator(memoryRetriever: IMemoryRetriever): IntegratedValidator;
//# sourceMappingURL=sherlock-quality-gate-integration.d.ts.map