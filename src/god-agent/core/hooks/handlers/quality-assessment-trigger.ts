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

import {
  registerPostToolUseHook,
  DEFAULT_PRIORITIES,
  type IPostToolUseContext,
  type IHookResult
} from '../index.js';
import { createComponentLogger } from '../../observability/logger.js';

const logger = createComponentLogger('QualityAssessmentTriggerHook');

// ============================================================================
// Constants
// ============================================================================

/**
 * Quality thresholds per CONSTITUTION RULE-035
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum score to avoid feedback trigger */
  FEEDBACK: 0.5,
  /** Minimum score to store as pattern */
  PATTERN: 0.7
} as const;

// ============================================================================
// Types
// ============================================================================

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
export type QualityAssessmentCallback = (
  trajectoryId: string,
  output: unknown,
  metadata?: Record<string, unknown>
) => Promise<IQualityAssessment>;

// ============================================================================
// Callback Management
// ============================================================================

/** Registered callback for quality assessment */
let qualityCallback: QualityAssessmentCallback | null = null;

/**
 * Set the quality assessment callback
 *
 * Should be called during daemon initialization to connect to QualityEstimator.
 * The callback receives trajectory ID, tool output, and optional metadata.
 *
 * @param callback - Function to call for quality assessment
 */
export function setQualityAssessmentCallback(callback: QualityAssessmentCallback): void {
  qualityCallback = callback;
  logger.info('Quality assessment callback registered');
}

/**
 * Check if a quality assessment callback is registered
 *
 * @returns True if callback is registered
 */
export function hasQualityAssessmentCallback(): boolean {
  return qualityCallback !== null;
}

/**
 * Clear the quality assessment callback (for testing)
 * WARNING: Only for testing purposes
 */
export function _clearQualityAssessmentCallbackForTesting(): void {
  qualityCallback = null;
}

// ============================================================================
// Hook Registration
// ============================================================================

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
export function registerQualityAssessmentTriggerHook(): void {
  registerPostToolUseHook({
    id: 'quality-assessment-trigger',
    toolName: 'Task',  // Primary target is Task tool results
    priority: DEFAULT_PRIORITIES.POST_PROCESS,  // Priority 60 (after capture)
    description: 'Triggers quality assessment on Task tool results',
    handler: async (context: IPostToolUseContext): Promise<IHookResult> => {
      try {
        // Skip if no trajectory
        if (!context.trajectoryId) {
          logger.debug('No active trajectory, skipping quality assessment', {
            toolName: context.toolName,
            sessionId: context.sessionId
          });
          return { continue: true };
        }

        // Skip if no callback registered
        if (!qualityCallback) {
          logger.debug('No quality callback registered, skipping assessment', {
            trajectoryId: context.trajectoryId,
            toolName: context.toolName
          });
          return {
            continue: true,
            metadata: {
              skipped: true,
              reason: 'no_callback'
            }
          };
        }

        // Skip if execution failed (don't assess failed outputs)
        if (context.executionSuccess === false) {
          logger.debug('Task execution failed, skipping quality assessment', {
            trajectoryId: context.trajectoryId,
            toolName: context.toolName
          });
          return {
            continue: true,
            metadata: {
              skipped: true,
              reason: 'execution_failed'
            }
          };
        }

        // Trigger quality assessment
        const assessment = await qualityCallback(
          context.trajectoryId,
          context.toolOutput,
          {
            toolName: context.toolName,
            durationMs: context.executionDurationMs,
            sessionId: context.sessionId,
            timestamp: context.timestamp
          }
        );

        // Check thresholds per RULE-035
        const meetsPatternThreshold = assessment.score >= QUALITY_THRESHOLDS.PATTERN;
        const meetsFeedbackThreshold = assessment.score >= QUALITY_THRESHOLDS.FEEDBACK;

        logger.info('Quality assessment completed', {
          trajectoryId: context.trajectoryId,
          score: assessment.score,
          meetsPatternThreshold,
          meetsFeedbackThreshold,
          hasFeedback: !!assessment.feedback,
          hasBreakdown: !!assessment.breakdown
        });

        // Warn if below feedback threshold
        if (!meetsFeedbackThreshold) {
          logger.warn('Quality score below feedback threshold', {
            trajectoryId: context.trajectoryId,
            score: assessment.score,
            threshold: QUALITY_THRESHOLDS.FEEDBACK,
            feedback: assessment.feedback
          });
        }

        return {
          continue: true,
          metadata: {
            qualityScore: assessment.score,
            qualityFeedback: assessment.feedback,
            qualityBreakdown: assessment.breakdown,
            meetsPatternThreshold,
            meetsFeedbackThreshold,
            assessedAt: Date.now()
          }
        };
      } catch (error) {
        // Log but don't throw - hook errors shouldn't break the chain
        logger.error('Quality assessment failed', error, {
          trajectoryId: context.trajectoryId,
          toolName: context.toolName
        });

        return {
          continue: true,
          metadata: {
            assessmentError: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  });

  logger.debug('Quality assessment trigger hook registered');
}
