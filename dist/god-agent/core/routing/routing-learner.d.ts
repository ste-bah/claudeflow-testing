/**
 * DAI-003: Intelligent Task Routing Learner
 *
 * TASK-009: Routing Learner
 * Constitution: RULE-DAI-003-002 (EWC++ regularization), RULE-DAI-003-007 (failure attribution)
 *
 * Learns from routing outcomes with EWC++ regularization to prevent catastrophic forgetting.
 * Tracks accuracy across a rolling 100-task window and automatically rolls back if degradation
 * exceeds 2%.
 *
 * Key features:
 * - EWC++ regularization with lambda = 0.1
 * - Maximum 5% weight change per update
 * - Failure attribution via FailureClassifier
 * - Skip routing penalty for AGENT_FAILURE and TASK_IMPOSSIBLE
 * - Rolling 100-task accuracy window
 * - Auto-rollback on degradation > 2%
 * - Checkpoint/restore for weight rollback
 * - ReasoningBank integration for continuous learning
 *
 * @module src/god-agent/core/routing/routing-learner
 */
import type { IRoutingFeedback, IRoutingLearner, IRoutingConfig } from './routing-types.js';
import { FailureClassifier } from './failure-classifier.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
/**
 * Configuration for RoutingLearner
 */
export interface IRoutingLearnerConfig {
    /** Failure classifier (creates one if not provided) */
    readonly failureClassifier?: FailureClassifier;
    /** Routing configuration (uses defaults if not provided) */
    readonly routingConfig?: Partial<IRoutingConfig>;
    /** ReasoningBank for feedback submission (optional) */
    readonly reasoningBank?: ReasoningBank;
    /** Enable verbose logging (default: false) */
    readonly verbose?: boolean;
}
/**
 * Routing learner with EWC++ regularization
 *
 * Learns from routing outcomes while preventing catastrophic forgetting.
 * Uses Elastic Weight Consolidation Plus Plus (EWC++) to constrain weight
 * updates based on their importance (Fisher information).
 *
 * Per RULE-DAI-003-002: EWC++ with lambda=0.1, max 5% weight change
 * Per RULE-DAI-003-007: Failure attribution before learning
 */
export declare class RoutingLearner implements IRoutingLearner {
    private readonly failureClassifier;
    private readonly config;
    private readonly reasoningBank?;
    private readonly verbose;
    private agentWeights;
    private agentImportance;
    private accuracyHistory;
    private totalFeedback;
    private successfulRoutes;
    private checkpoint;
    /**
     * Create a routing learner
     *
     * @param config - Learner configuration
     */
    constructor(config?: IRoutingLearnerConfig);
    /**
     * Process feedback and update weights
     *
     * Per RULE-DAI-003-002: EWC++ regularization with max 5% change
     * Per RULE-DAI-003-007: Failure attribution before learning
     *
     * @param feedback - Routing feedback to process
     */
    processFeedback(feedback: IRoutingFeedback): Promise<void>;
    /**
     * Get current accuracy across rolling window
     *
     * @returns Accuracy (0-1) or 0 if no feedback yet
     */
    getCurrentAccuracy(): number;
    /**
     * Get rolling accuracy history
     *
     * @returns Readonly array of accuracy values (1 = success, 0 = failure)
     */
    getAccuracyHistory(): readonly number[];
    /**
     * Calculate reward from feedback
     *
     * Base reward: +1 for success, -1 for failure
     * Adjusted by user rating if available
     * Penalized if user overrode agent selection
     *
     * @param feedback - Routing feedback
     * @returns Reward value (typically -1 to +1)
     */
    private calculateReward;
    /**
     * Update weights with EWC++ regularization
     *
     * EWC++ prevents catastrophic forgetting by:
     * 1. Computing raw update from reward
     * 2. Applying penalty based on importance (Fisher information)
     * 3. Clamping to max 5% change per update
     *
     * Per RULE-DAI-003-002: lambda=0.1, max 5% change
     *
     * @param agentKey - Agent key to update
     * @param reward - Calculated reward
     */
    private updateWeights;
    /**
     * Update importance (Fisher information approximation)
     *
     * Importance increases with each task, representing how critical
     * this weight is to maintaining performance. Higher importance
     * means more resistance to weight changes (via EWC++ penalty).
     *
     * @param agentKey - Agent key to update
     * @param reward - Calculated reward (magnitude indicates importance)
     */
    private updateImportance;
    /**
     * Update accuracy history with new feedback
     *
     * Maintains rolling window of last 100 tasks
     *
     * @param feedback - Routing feedback
     */
    private updateAccuracyHistory;
    /**
     * Detect accuracy degradation compared to checkpoint
     *
     * Per RULE-DAI-003-002: Rollback if degradation > 2%
     *
     * @returns True if accuracy degraded beyond threshold
     */
    private detectAccuracyDegradation;
    /**
     * Rollback weights to checkpoint
     *
     * Restores weights and importance but keeps accuracy history
     * (we need to track the bad outcomes to prevent repeating them)
     */
    private rollbackWeights;
    /**
     * Create checkpoint before weight updates
     *
     * Captures current state for potential rollback
     */
    private createCheckpoint;
    /**
     * Get weight for agent (default: 0.5)
     *
     * @param agentKey - Agent key
     * @returns Weight value (0-1)
     */
    private getWeight;
    /**
     * Set weight for agent
     *
     * @param agentKey - Agent key
     * @param weight - Weight value (0-1)
     */
    private setWeight;
    /**
     * Get importance for agent (default: 0.1)
     *
     * @param agentKey - Agent key
     * @returns Importance value (>= 0)
     */
    private getImportance;
    /**
     * Log agent reliability (for monitoring)
     *
     * @param agentKey - Agent key
     * @param success - Whether task succeeded
     */
    private logAgentReliability;
    /**
     * Submit feedback to ReasoningBank for continuous learning
     *
     * @param feedback - Routing feedback
     * @param classification - Failure classification
     */
    private submitToReasoningBank;
}
//# sourceMappingURL=routing-learner.d.ts.map