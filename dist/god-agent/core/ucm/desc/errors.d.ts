/**
 * IDESC-001: Intelligent DESC v2 - Error Classes
 * TASK-IDESC-INFRA-003: Create Error Classes
 * Implements: NFR-IDESC-007 (graceful degradation)
 *
 * Error hierarchy for outcome tracking and intelligent DESC features.
 * Note: These errors extend UCMError directly to allow code property overrides.
 */
import { UCMError } from '../errors.js';
/**
 * Base error for outcome-related failures
 * All outcome errors are recoverable - they should not block injection
 */
export declare class OutcomeError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error recording an outcome
 * Implements: GUARD-IDESC-005 (graceful degradation)
 */
export declare class OutcomeRecordingError extends OutcomeError {
    readonly episodeId?: string | undefined;
    readonly taskId?: string | undefined;
    readonly code: string;
    readonly recoverable: boolean;
    constructor(message: string, episodeId?: string | undefined, taskId?: string | undefined, cause?: Error);
}
/**
 * Error when episode does not exist
 */
export declare class EpisodeNotFoundError extends OutcomeError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(episodeId: string);
}
/**
 * Error when outcome data is invalid
 */
export declare class InvalidOutcomeError extends OutcomeError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(reason: string, outcome?: Record<string, unknown>);
}
/**
 * Error when insufficient outcome data for statistical calculations
 * Implements: REQ-IDESC-002 (minimum 3 samples)
 */
export declare class InsufficientOutcomeDataError extends OutcomeError {
    readonly episodeId: string;
    readonly outcomeCount: number;
    readonly minimumRequired: number;
    readonly code: string;
    readonly recoverable: boolean;
    constructor(episodeId: string, outcomeCount: number, minimumRequired?: number);
}
/**
 * Base error for confidence calculation failures
 */
export declare class ConfidenceError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error calculating confidence level
 */
export declare class ConfidenceCalculationError extends ConfidenceError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(episodeId: string, reason: string, cause?: Error);
}
/**
 * Base error for warning generation failures
 */
export declare class WarningError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error generating warning message
 */
export declare class WarningGenerationError extends WarningError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(episodeId: string, reason: string, cause?: Error);
}
/**
 * Base error for ReasoningBank integration failures
 * Implements: GUARD-IDESC-005 (graceful degradation)
 */
export declare class ReasoningLinkError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error linking to ReasoningBank trajectory
 */
export declare class TrajectoryLinkError extends ReasoningLinkError {
    readonly trajectoryId: string;
    readonly code: string;
    readonly recoverable: boolean;
    constructor(trajectoryId: string, reason: string, cause?: Error);
}
/**
 * Error when trajectory not found
 */
export declare class TrajectoryNotFoundError extends ReasoningLinkError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(trajectoryId: string);
}
/**
 * Base error for threshold adjustment failures
 */
export declare class ThresholdError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error when threshold change exceeds bounds
 * Implements: GUARD-IDESC-003 (+/-5% per 30 days)
 */
export declare class ThresholdBoundsError extends ThresholdError {
    readonly category: string;
    readonly currentValue: number;
    readonly proposedValue: number;
    readonly maxChange: number;
    readonly periodDays: number;
    readonly code: string;
    readonly recoverable: boolean;
    constructor(category: string, currentValue: number, proposedValue: number, maxChange: number, periodDays: number);
}
/**
 * Error when threshold value is invalid
 */
export declare class InvalidThresholdError extends ThresholdError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(category: string, value: number, reason: string);
}
/**
 * Base error for active learning failures
 */
export declare class ActiveLearningError extends UCMError {
    readonly code: string;
    readonly recoverable: boolean;
}
/**
 * Error when learning data is insufficient
 */
export declare class InsufficientLearningDataError extends ActiveLearningError {
    readonly dataPoints: number;
    readonly minimumRequired: number;
    readonly code: string;
    readonly recoverable: boolean;
    constructor(dataPoints: number, minimumRequired: number);
}
/**
 * Error when learning rate adjustment fails
 */
export declare class LearningRateError extends ActiveLearningError {
    readonly code: string;
    readonly recoverable: boolean;
    constructor(reason: string, cause?: Error);
}
export declare function isOutcomeError(error: unknown): error is OutcomeError;
export declare function isConfidenceError(error: unknown): error is ConfidenceError;
export declare function isWarningError(error: unknown): error is WarningError;
export declare function isReasoningLinkError(error: unknown): error is ReasoningLinkError;
export declare function isThresholdError(error: unknown): error is ThresholdError;
export declare function isActiveLearningError(error: unknown): error is ActiveLearningError;
//# sourceMappingURL=errors.d.ts.map