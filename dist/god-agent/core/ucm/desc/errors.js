/**
 * IDESC-001: Intelligent DESC v2 - Error Classes
 * TASK-IDESC-INFRA-003: Create Error Classes
 * Implements: NFR-IDESC-007 (graceful degradation)
 *
 * Error hierarchy for outcome tracking and intelligent DESC features.
 * Note: These errors extend UCMError directly to allow code property overrides.
 */
import { UCMError } from '../errors.js';
// ============================================================================
// Outcome Recording Errors
// ============================================================================
/**
 * Base error for outcome-related failures
 * All outcome errors are recoverable - they should not block injection
 */
export class OutcomeError extends UCMError {
    code = 'UCM_OUTCOME_ERROR';
    recoverable = true;
}
/**
 * Error recording an outcome
 * Implements: GUARD-IDESC-005 (graceful degradation)
 */
export class OutcomeRecordingError extends OutcomeError {
    episodeId;
    taskId;
    code = 'UCM_OUTCOME_RECORDING_ERROR';
    recoverable = true;
    constructor(message, episodeId, taskId, cause) {
        super(message, {
            episodeId,
            taskId,
            cause: cause?.message
        });
        this.episodeId = episodeId;
        this.taskId = taskId;
    }
}
/**
 * Error when episode does not exist
 */
export class EpisodeNotFoundError extends OutcomeError {
    code = 'UCM_EPISODE_NOT_FOUND';
    recoverable = true;
    constructor(episodeId) {
        super(`Episode not found: ${episodeId}`, { episodeId });
    }
}
/**
 * Error when outcome data is invalid
 */
export class InvalidOutcomeError extends OutcomeError {
    code = 'UCM_INVALID_OUTCOME';
    recoverable = true;
    constructor(reason, outcome) {
        super(`Invalid outcome: ${reason}`, { reason, outcome });
    }
}
// ============================================================================
// Statistical Validity Errors
// ============================================================================
/**
 * Error when insufficient outcome data for statistical calculations
 * Implements: REQ-IDESC-002 (minimum 3 samples)
 */
export class InsufficientOutcomeDataError extends OutcomeError {
    episodeId;
    outcomeCount;
    minimumRequired;
    code = 'UCM_INSUFFICIENT_OUTCOME_DATA';
    recoverable = true;
    constructor(episodeId, outcomeCount, minimumRequired = 3) {
        super(`Episode ${episodeId} has ${outcomeCount} outcomes, minimum ${minimumRequired} required for statistical validity`, { episodeId, outcomeCount, minimumRequired });
        this.episodeId = episodeId;
        this.outcomeCount = outcomeCount;
        this.minimumRequired = minimumRequired;
    }
}
// ============================================================================
// Confidence Calculation Errors
// ============================================================================
/**
 * Base error for confidence calculation failures
 */
export class ConfidenceError extends UCMError {
    code = 'UCM_CONFIDENCE_ERROR';
    recoverable = true;
}
/**
 * Error calculating confidence level
 */
export class ConfidenceCalculationError extends ConfidenceError {
    code = 'UCM_CONFIDENCE_CALCULATION_ERROR';
    recoverable = true;
    constructor(episodeId, reason, cause) {
        super(`Failed to calculate confidence for ${episodeId}: ${reason}`, {
            episodeId,
            reason,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Warning Generation Errors
// ============================================================================
/**
 * Base error for warning generation failures
 */
export class WarningError extends UCMError {
    code = 'UCM_WARNING_ERROR';
    recoverable = true;
}
/**
 * Error generating warning message
 */
export class WarningGenerationError extends WarningError {
    code = 'UCM_WARNING_GENERATION_ERROR';
    recoverable = true;
    constructor(episodeId, reason, cause) {
        super(`Failed to generate warning for ${episodeId}: ${reason}`, {
            episodeId,
            reason,
            cause: cause?.message
        });
    }
}
// ============================================================================
// ReasoningBank Integration Errors
// ============================================================================
/**
 * Base error for ReasoningBank integration failures
 * Implements: GUARD-IDESC-005 (graceful degradation)
 */
export class ReasoningLinkError extends UCMError {
    code = 'UCM_REASONING_LINK_ERROR';
    recoverable = true;
}
/**
 * Error linking to ReasoningBank trajectory
 */
export class TrajectoryLinkError extends ReasoningLinkError {
    trajectoryId;
    code = 'UCM_TRAJECTORY_LINK_ERROR';
    recoverable = true;
    constructor(trajectoryId, reason, cause) {
        super(`Failed to link trajectory ${trajectoryId}: ${reason}`, {
            trajectoryId,
            reason,
            cause: cause?.message
        });
        this.trajectoryId = trajectoryId;
    }
}
/**
 * Error when trajectory not found
 */
export class TrajectoryNotFoundError extends ReasoningLinkError {
    code = 'UCM_TRAJECTORY_NOT_FOUND';
    recoverable = true;
    constructor(trajectoryId) {
        super(`Trajectory not found: ${trajectoryId}`, { trajectoryId });
    }
}
// ============================================================================
// Threshold Adjustment Errors
// ============================================================================
/**
 * Base error for threshold adjustment failures
 */
export class ThresholdError extends UCMError {
    code = 'UCM_THRESHOLD_ERROR';
    recoverable = true;
}
/**
 * Error when threshold change exceeds bounds
 * Implements: GUARD-IDESC-003 (+/-5% per 30 days)
 */
export class ThresholdBoundsError extends ThresholdError {
    category;
    currentValue;
    proposedValue;
    maxChange;
    periodDays;
    code = 'UCM_THRESHOLD_BOUNDS_ERROR';
    recoverable = false; // Intentionally not recoverable - this is a guard violation
    constructor(category, currentValue, proposedValue, maxChange, periodDays) {
        super(`GUARD-IDESC-003 violation: Cannot change ${category} threshold from ${currentValue} to ${proposedValue}. Maximum change is ±${maxChange * 100}% per ${periodDays} days`, {
            category,
            currentValue,
            proposedValue,
            maxChange,
            periodDays,
            requestedChange: Math.abs(proposedValue - currentValue),
            percentChange: Math.abs((proposedValue - currentValue) / currentValue) * 100
        });
        this.category = category;
        this.currentValue = currentValue;
        this.proposedValue = proposedValue;
        this.maxChange = maxChange;
        this.periodDays = periodDays;
    }
}
/**
 * Error when threshold value is invalid
 */
export class InvalidThresholdError extends ThresholdError {
    code = 'UCM_INVALID_THRESHOLD';
    recoverable = false;
    constructor(category, value, reason) {
        super(`Invalid threshold for ${category}: ${value} - ${reason}`, {
            category,
            value,
            reason
        });
    }
}
// ============================================================================
// Active Learning Errors
// ============================================================================
/**
 * Base error for active learning failures
 */
export class ActiveLearningError extends UCMError {
    code = 'UCM_ACTIVE_LEARNING_ERROR';
    recoverable = true;
}
/**
 * Error when learning data is insufficient
 */
export class InsufficientLearningDataError extends ActiveLearningError {
    dataPoints;
    minimumRequired;
    code = 'UCM_INSUFFICIENT_LEARNING_DATA';
    recoverable = true;
    constructor(dataPoints, minimumRequired) {
        super(`Insufficient data for learning: ${dataPoints} data points, minimum ${minimumRequired} required`, { dataPoints, minimumRequired });
        this.dataPoints = dataPoints;
        this.minimumRequired = minimumRequired;
    }
}
/**
 * Error when learning rate adjustment fails
 */
export class LearningRateError extends ActiveLearningError {
    code = 'UCM_LEARNING_RATE_ERROR';
    recoverable = true;
    constructor(reason, cause) {
        super(`Learning rate adjustment failed: ${reason}`, {
            reason,
            cause: cause?.message
        });
    }
}
// ============================================================================
// Type Guards
// ============================================================================
export function isOutcomeError(error) {
    return error instanceof OutcomeError;
}
export function isConfidenceError(error) {
    return error instanceof ConfidenceError;
}
export function isWarningError(error) {
    return error instanceof WarningError;
}
export function isReasoningLinkError(error) {
    return error instanceof ReasoningLinkError;
}
export function isThresholdError(error) {
    return error instanceof ThresholdError;
}
export function isActiveLearningError(error) {
    return error instanceof ActiveLearningError;
}
//# sourceMappingURL=errors.js.map