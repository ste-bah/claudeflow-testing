/**
 * Code Review Adapter
 *
 * Specialized adapter for code review workflows with file-based
 * pinning strategy and code-optimized token estimation.
 *
 * @module ucm/adapters/code-review-adapter
 */
import type { IWorkflowAdapter, ITaskContext, ITokenConfig, IPinningStrategy, IPhaseSettings } from '../types.js';
/**
 * Adapter for code review workflows
 */
export declare class CodeReviewAdapter implements IWorkflowAdapter {
    readonly name = "code-review";
    /**
     * Detect if task context is code review related
     *
     * Detection criteria:
     * - 'review' in agentId (case-insensitive)
     * - 'review' in pipelineName (case-insensitive)
     * - 'review' in task description (case-insensitive)
     * - 'pr' or 'pull-request' in context
     *
     * @param context - Task context to analyze
     * @returns True if code review detected
     */
    detect(context: ITaskContext): boolean;
    /**
     * Get rolling window size for code review
     *
     * Code reviews typically need moderate context:
     * - Initial review: smaller window (3)
     * - Discussion phase: larger window (5)
     * - Final approval: medium window (4)
     *
     * @param context - Task context
     * @returns Rolling window size
     */
    getWindowSize(context: ITaskContext): number;
    /**
     * Get token configuration for code review
     *
     * Code has higher token density due to:
     * - Special characters
     * - Camel/snake case
     * - Indentation
     *
     * @param context - Task context
     * @returns Token configuration
     */
    getTokenConfig(_context: ITaskContext): ITokenConfig;
    /**
     * Get pinning strategy for code review
     *
     * Uses file-based pinning to maintain:
     * - Key files under review
     * - Related files (imports, dependencies)
     * - Test files
     *
     * @param context - Task context
     * @returns Pinning strategy configuration
     */
    getPinningStrategy(_context: ITaskContext): IPinningStrategy;
    /**
     * Get phase-specific settings for code review
     *
     * @param context - Task context
     * @returns Phase-specific settings
     */
    getPhaseSettings(context: ITaskContext): IPhaseSettings;
}
//# sourceMappingURL=code-review-adapter.d.ts.map