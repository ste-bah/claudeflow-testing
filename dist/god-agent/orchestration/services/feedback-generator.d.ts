/**
 * FeedbackGenerator - Quality Estimation for ReasoningBank
 *
 * Implements: TASK-ORC-007 (TECH-ORC-001 lines 760-816)
 *
 * Analyzes task output and generates quality estimates for ReasoningBank
 * feedback using heuristic indicators.
 *
 * @module orchestration/services/feedback-generator
 */
import type { IQualityEstimate } from '../types.js';
/**
 * Metadata for quality estimation
 */
export interface IFeedbackMetadata {
    agentType: string;
    taskType: string;
    success: boolean;
    error?: string;
}
/**
 * FeedbackGenerator - Generates quality estimates for task output
 */
export declare class FeedbackGenerator {
    /**
     * Generate quality estimate from task output
     *
     * @param output - Task output
     * @param metadata - Task metadata
     * @returns Quality estimate with reasoning
     */
    generateQualityEstimate(output: string, metadata: IFeedbackMetadata): IQualityEstimate;
    /**
     * Check for completion markers
     *
     * Keywords: "complete", "done", "success", "finished"
     *
     * @param output - Task output
     * @returns Whether completion markers are present
     */
    private hasCompletionMarkers;
    /**
     * Check for error indicators
     *
     * Keywords: "error", "failed", "exception", "warning"
     *
     * @param output - Task output
     * @param metadata - Task metadata
     * @returns Whether errors are present
     */
    private hasErrors;
    /**
     * Check for expected deliverables
     *
     * Looks for: code blocks, file paths, schemas
     *
     * @param output - Task output
     * @returns Whether deliverables are present
     */
    private hasExpectedDeliverables;
    /**
     * Calculate quality score from indicators
     *
     * Algorithm (from spec lines 1094-1099):
     * - Base: 0.5
     * - +0.2 if completionMarkers present
     * - -0.3 if errors present
     * - +0.1 if deliverables present
     * - +0.1 if length adequate
     * - Min: 0.0, Max: 1.0
     *
     * @param indicators - Quality indicators
     * @param success - Task success flag
     * @returns Quality score (0-1)
     */
    private calculateQualityScore;
    /**
     * Classify outcome based on quality
     *
     * Classification (from spec lines 1100-1102):
     * - Positive: quality >= 0.7
     * - Negative: quality < 0.4
     * - Neutral: 0.4 <= quality < 0.7
     *
     * @param quality - Quality score
     * @returns Outcome classification
     */
    private classifyOutcome;
    /**
     * Generate reasoning for estimate
     *
     * @param indicators - Quality indicators
     * @param output - Task output
     * @param metadata - Task metadata
     * @returns Reasoning string
     */
    private generateReasoning;
}
//# sourceMappingURL=feedback-generator.d.ts.map