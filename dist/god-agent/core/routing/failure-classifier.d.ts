/**
 * DAI-003: Intelligent Task Routing Failure Classifier
 *
 * TASK-006: Failure Classifier
 * Constitution: RULE-DAI-003-007 (failure attribution before learning)
 *
 * Classifies routing failures to determine:
 * - Whether routing was wrong (user override → success)
 * - Whether agent failed (internal error, retry succeeded)
 * - Whether task was impossible (multiple agents fail, user abandons)
 * - Whether task had partial success (some stages completed)
 *
 * Provides:
 * - Failure type classification
 * - Confidence scores
 * - Penalization recommendations (routing vs agent)
 * - Recommended actions (retry, escalate, abandon)
 *
 * @module src/god-agent/core/routing/failure-classifier
 */
import type { IRoutingFeedback, IFailureClassification } from './routing-types.js';
/**
 * Failure classifier for routing feedback
 *
 * Classifies failures to determine attribution:
 * - ROUTING_FAILURE: User override followed by success (routing was wrong)
 * - AGENT_FAILURE: Agent threw internal error, retry might succeed
 * - TASK_IMPOSSIBLE: Multiple agents fail, user abandons
 * - PARTIAL_SUCCESS: Some stages completed, not all
 *
 * Per RULE-DAI-003-007: Failure attribution before learning
 */
export declare class FailureClassifier {
    /**
     * Classify a failure from routing feedback
     *
     * @param feedback - Routing feedback to classify
     * @returns Failure classification with type, confidence, and recommendations
     */
    classify(feedback: IRoutingFeedback): IFailureClassification;
    /**
     * Detect user override indicator
     *
     * @param feedback - Routing feedback
     * @returns True if user overrode agent selection
     */
    private detectUserOverride;
    /**
     * Detect agent error indicator
     *
     * @param feedback - Routing feedback
     * @returns True if agent threw internal error
     */
    private detectAgentError;
    /**
     * Detect task impossible indicator
     *
     * @param feedback - Routing feedback
     * @returns True if task appears impossible
     */
    private detectTaskImpossible;
    /**
     * Detect partial success indicator
     *
     * @param feedback - Routing feedback
     * @returns True if some stages completed (for pipelines)
     */
    private detectPartialSuccess;
    /**
     * Calculate confidence score based on evidence indicators
     *
     * @param indicators - Number of evidence indicators
     * @returns Confidence score (0-1)
     */
    private calculateConfidence;
}
//# sourceMappingURL=failure-classifier.d.ts.map