/**
 * Quality Assessment Trigger Hook
 * TASK-HOOK-003
 *
 * Triggers quality assessment on tool outputs.
 * This is a REQUIRED hook per CONSTITUTION RULE-032.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-033: Quality assessed on actual result, NOT prompt
 * - RULE-035: Uses thresholds 0.5 (feedback), 0.7 (pattern)
 */
/**
 * Quality thresholds per CONSTITUTION RULE-035
 */
export declare const QUALITY_THRESHOLDS: {
    /** Minimum score to avoid feedback trigger */
    readonly FEEDBACK: 0.5;
    /** Minimum score to store as pattern */
    readonly PATTERN: 0.7;
};
/**
 * Quality assessment result
 */
export interface IQualityAssessment {
    /** Quality score (0.0 - 1.0) */
    score: number;
    /** Optional feedback message */
    feedback?: string;
    /** Optional detailed breakdown */
    breakdown?: Record<string, number>;
}
/**
 * Quality assessment callback type
 *
 * Implement this callback and register it via setQualityAssessmentCallback
 * to connect to the QualityEstimator or other quality assessment system.
 */
export type QualityAssessmentCallback = (trajectoryId: string, output: unknown, metadata?: Record<string, unknown>) => Promise<IQualityAssessment>;
/**
 * Learning feedback callback type
 *
 * Called after quality assessment to feed scores to the learning system.
 * RULE-035: All agent results MUST be assessed for quality with 0.5 threshold
 *
 * @param trajectoryId - The trajectory being assessed
 * @param qualityScore - The quality score (0.0 - 1.0)
 * @param metadata - Additional metadata for learning
 */
export type LearningFeedbackCallback = (trajectoryId: string, qualityScore: number, metadata?: Record<string, unknown>) => Promise<void>;
/**
 * Set the quality assessment callback
 *
 * Should be called during daemon initialization to connect to QualityEstimator.
 * The callback receives trajectory ID, tool output, and optional metadata.
 *
 * @param callback - Function to call for quality assessment
 */
export declare function setQualityAssessmentCallback(callback: QualityAssessmentCallback): void;
/**
 * Set the learning feedback callback (TASK-HOOK-009)
 *
 * Should be called during initialization to connect to ReasoningBank/SonaEngine.
 * The callback is invoked after quality assessment to feed scores to learning system.
 *
 * RULE-035: All agent results MUST be assessed for quality with 0.5 threshold
 * RULE-036: Task hook outputs MUST include quality assessment scores
 *
 * @param callback - Function to call for learning feedback
 *
 * @example
 * ```typescript
 * import { setLearningFeedbackCallback } from './hooks/handlers/quality-assessment-trigger.js';
 *
 * // During initialization when ReasoningBank is available
 * setLearningFeedbackCallback(async (trajectoryId, quality, metadata) => {
 *   await reasoningBank.provideFeedback({
 *     trajectoryId,
 *     quality,
 *     verdict: quality >= 0.7 ? 'correct' : quality >= 0.4 ? 'neutral' : 'incorrect'
 *   });
 * });
 * ```
 */
export declare function setLearningFeedbackCallback(callback: LearningFeedbackCallback): void;
/**
 * Check if a quality assessment callback is registered
 *
 * @returns True if callback is registered
 */
export declare function hasQualityAssessmentCallback(): boolean;
/**
 * Check if a learning feedback callback is registered (TASK-HOOK-009)
 *
 * @returns True if callback is registered
 */
export declare function hasLearningFeedbackCallback(): boolean;
/**
 * Clear the quality assessment callback (for testing)
 * WARNING: Only for testing purposes
 */
export declare function _clearQualityAssessmentCallbackForTesting(): void;
/**
 * Clear the learning feedback callback (for testing)
 * WARNING: Only for testing purposes
 */
export declare function _clearLearningFeedbackCallbackForTesting(): void;
/**
 * Register the quality-assessment-trigger hook
 *
 * This hook triggers quality assessment on Task tool results.
 * It calls the registered quality callback and logs threshold compliance.
 *
 * MUST be called before HookRegistry.initialize() per RULE-032.
 *
 * Hook details:
 * - ID: 'quality-assessment-trigger' (REQUIRED hook)
 * - Type: postToolUse
 * - Tool: Task (primary target is Task tool results)
 * - Priority: POST_PROCESS (60) - runs after capture
 */
export declare function registerQualityAssessmentTriggerHook(): void;
//# sourceMappingURL=quality-assessment-trigger.d.ts.map