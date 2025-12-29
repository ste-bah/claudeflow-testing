/**
 * Quality Estimator for God Agent Auto-Feedback
 *
 * Estimates interaction quality based on output characteristics
 * to enable automatic feedback without explicit user input.
 *
 * Part of PRD FR-11 (Sona Engine) implementation.
 */
import type { AgentMode } from './universal-agent.js';
/**
 * Interaction data used for quality estimation
 */
export interface QualityInteraction {
    id: string;
    mode: AgentMode;
    input: string;
    output: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Detailed quality assessment result
 */
export interface QualityAssessment {
    /** Overall quality score 0-1 */
    score: number;
    /** Individual factor scores */
    factors: {
        length: number;
        structure: number;
        codeContent: number;
        modeRelevance: number;
        /** TASK-FIX-008: Bonus for Task() result patterns */
        taskResultBonus: number;
    };
    /** Whether this meets auto-store threshold (feedback threshold) */
    meetsThreshold: boolean;
    /** Whether this qualifies for auto-pattern creation (RULE-035: >= 0.7) */
    qualifiesForPattern: boolean;
}
/**
 * Estimate quality of an interaction based on output characteristics.
 *
 * Quality factors:
 * - Length: Longer, more detailed responses score higher
 * - Code blocks: Technical content with code examples
 * - Structure: Lists, headers, organized content
 * - Mode relevance: Mode-specific quality indicators
 *
 * @param interaction - The interaction to assess
 * @param threshold - Auto-store threshold (default 0.5 per RULE-035)
 * @returns Quality score between 0 and 1
 */
export declare function estimateQuality(interaction: QualityInteraction, threshold?: number): number;
/**
 * Perform detailed quality assessment with factor breakdown.
 *
 * @param interaction - The interaction to assess
 * @param threshold - Auto-store/feedback threshold (default 0.5 per RULE-035)
 * @returns Detailed quality assessment
 */
export declare function assessQuality(interaction: QualityInteraction, threshold?: number): QualityAssessment;
/**
 * Determine verdict based on quality score.
 * Maps to ReasoningBank feedback verdict types.
 *
 * @param quality - Quality score 0-1
 * @returns Verdict string for feedback
 */
export declare function qualityToVerdict(quality: number): 'correct' | 'neutral' | 'incorrect';
/**
 * Calculate L-score (learning potential) from quality and novelty.
 * Used by SonaEngine for weight updates.
 *
 * @param quality - Quality score 0-1
 * @param novelty - Novelty score 0-1 (how different from existing patterns)
 * @returns L-score for learning weight calculation
 */
export declare function calculateLScore(quality: number, novelty?: number): number;
//# sourceMappingURL=quality-estimator.d.ts.map