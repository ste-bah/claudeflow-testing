/**
 * Trajectory Bridge for God Agent Auto-Feedback
 *
 * Bridges UniversalAgent to the existing learning infrastructure
 * (ReasoningBank, SonaEngine, TrajectoryTracker) to enable automatic
 * trajectory creation and feedback submission.
 *
 * Part of PRD FR-11 (Sona Engine) implementation.
 */
import type { ReasoningBank } from '../core/reasoning/reasoning-bank.js';
import type { SonaEngine } from '../core/learning/sona-engine.js';
import type { IPatternMatch } from '../core/reasoning/reasoning-types.js';
import type { AgentMode } from './universal-agent.js';
/**
 * Result from trajectory creation
 */
export interface TrajectoryResult {
    /** Unique trajectory ID for feedback reference */
    trajectoryId: string;
    /** Patterns matched during reasoning */
    patterns: IPatternMatch[];
    /** Overall confidence score */
    confidence: number;
    /** L-Score for learning potential */
    lScore: number;
}
/**
 * Result from feedback submission
 */
export interface FeedbackResult {
    /** Number of weight updates applied */
    weightUpdates: number;
    /** Whether a new pattern was auto-created (quality >= 0.7 per RULE-035) */
    patternCreated: boolean;
    /** Route/domain that was updated */
    route?: string;
}
/**
 * Options for feedback submission
 */
export interface FeedbackOptions {
    /** L-Score for learning weight calculation */
    lScore?: number;
    /** Whether this is implicit (auto-estimated) feedback */
    implicit?: boolean;
    /** Optional notes about the feedback */
    notes?: string;
}
/**
 * TrajectoryBridge - Connects UniversalAgent to learning infrastructure
 *
 * Responsibilities:
 * 1. Create trajectories for every interaction via ReasoningBank
 * 2. Submit feedback to trigger weight updates in SonaEngine
 * 3. Track pattern creation for high-quality interactions
 */
export declare class TrajectoryBridge {
    private reasoningBank;
    private sonaEngine;
    private initialized;
    constructor(reasoningBank: ReasoningBank, sonaEngine: SonaEngine);
    /**
     * Check if bridge is ready to use
     */
    isInitialized(): boolean;
    /**
     * Create a trajectory from an interaction.
     *
     * This calls ReasoningBank.reason() to:
     * 1. Find relevant patterns
     * 2. Create a trajectory record
     * 3. Return trajectory ID for later feedback
     *
     * @param input - User input text
     * @param mode - Agent mode (code, research, write, general)
     * @param embedding - Query embedding vector (1536 dimensions, VECTOR_DIM)
     * @returns Trajectory result with ID and patterns
     */
    createTrajectoryFromInteraction(input: string, mode: AgentMode, embedding: Float32Array): Promise<TrajectoryResult>;
    /**
     * Submit feedback for a trajectory.
     *
     * This triggers:
     * 1. ReasoningBank.provideFeedback() for trajectory update
     * 2. SonaEngine weight updates via EWC++ regularization
     * 3. Auto-pattern creation if quality >= 0.7 (per RULE-035)
     *
     * @param trajectoryId - Trajectory to provide feedback for
     * @param quality - Quality score 0-1
     * @param options - Additional feedback options
     * @returns Feedback result with update counts
     */
    submitFeedback(trajectoryId: string, quality: number, options?: FeedbackOptions): Promise<FeedbackResult>;
    /**
     * Get current learning statistics from SonaEngine
     */
    getLearningStats(): {
        trajectoryCount: number;
        totalPatterns: number;
        routeCount: number;
    };
    /**
     * Map UniversalAgent mode to ReasoningBank reasoning type.
     *
     * Mode mapping:
     * - code: pattern-match (template-based, fast)
     * - research: causal-inference (graph-based reasoning)
     * - write: contextual (embedding similarity)
     * - general: hybrid (weighted combination)
     *
     * @param mode - UniversalAgent mode
     * @returns ReasoningMode enum value
     */
    private modeToReasoningType;
}
//# sourceMappingURL=trajectory-bridge.d.ts.map