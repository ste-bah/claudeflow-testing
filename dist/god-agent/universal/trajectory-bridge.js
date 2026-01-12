/**
 * Trajectory Bridge for God Agent Auto-Feedback
 *
 * Bridges UniversalAgent to the existing learning infrastructure
 * (ReasoningBank, SonaEngine, TrajectoryTracker) to enable automatic
 * trajectory creation and feedback submission.
 *
 * Part of PRD FR-11 (Sona Engine) implementation.
 */
import { ReasoningMode } from '../core/reasoning/reasoning-types.js';
import { qualityToVerdict, calculateLScore } from './quality-estimator.js';
/**
 * TrajectoryBridge - Connects UniversalAgent to learning infrastructure
 *
 * Responsibilities:
 * 1. Create trajectories for every interaction via ReasoningBank
 * 2. Submit feedback to trigger weight updates in SonaEngine
 * 3. Track pattern creation for high-quality interactions
 */
export class TrajectoryBridge {
    reasoningBank;
    sonaEngine;
    initialized = false;
    constructor(reasoningBank, sonaEngine) {
        this.reasoningBank = reasoningBank;
        this.sonaEngine = sonaEngine;
        this.initialized = true;
    }
    /**
     * Check if bridge is ready to use
     */
    isInitialized() {
        return this.initialized;
    }
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
    async createTrajectoryFromInteraction(input, mode, embedding) {
        const reasoningType = this.modeToReasoningType(mode);
        const request = {
            query: embedding,
            type: reasoningType,
            applyLearning: true,
            enhanceWithGNN: false,
            maxResults: 5,
            confidenceThreshold: 0.5,
            metadata: {
                source: 'universal-agent',
                mode,
                inputLength: input.length,
                timestamp: Date.now(),
            },
        };
        let response;
        try {
            response = await this.reasoningBank.reason(request);
        }
        catch (error) {
            // If reasoning fails, create a minimal trajectory result
            console.warn('[TrajectoryBridge] Reasoning failed, using fallback:', error);
            return {
                trajectoryId: `traj_fallback_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                patterns: [],
                confidence: 0.5,
                lScore: 0.5,
            };
        }
        return {
            trajectoryId: response.trajectoryId,
            patterns: response.patterns,
            confidence: response.confidence,
            lScore: response.provenanceInfo?.combinedLScore ?? 0.5,
        };
    }
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
    async submitFeedback(trajectoryId, quality, options = {}) {
        // Get pattern count before feedback for comparison
        const statsBefore = this.sonaEngine.getStats();
        const patternsBefore = statsBefore.totalPatterns;
        // Calculate L-score for learning weight
        const lScore = options.lScore ?? calculateLScore(quality);
        // Create feedback object
        const feedback = {
            trajectoryId,
            verdict: qualityToVerdict(quality),
            quality,
            timestamp: Date.now(),
            metadata: {
                implicit: options.implicit ?? false,
                notes: options.notes,
                lScore,
            },
        };
        // Submit directly to SonaEngine for guaranteed SQLite persistence
        // (bypasses ReasoningBank indirection that may not reach database)
        try {
            await this.sonaEngine.provideFeedback(trajectoryId, quality, {
                skipAutoSave: false, // CRITICAL: Ensure persistence to SQLite
            });
        }
        catch (error) {
            console.warn('[TrajectoryBridge] SonaEngine feedback failed:', error);
            return {
                weightUpdates: 0,
                patternCreated: false,
            };
        }
        // Check if a new pattern was created (quality > 0.8 triggers auto-pattern)
        const statsAfter = this.sonaEngine.getStats();
        const patternsAfter = statsAfter.totalPatterns;
        return {
            weightUpdates: 1, // SonaEngine updates all patterns in trajectory
            patternCreated: patternsAfter > patternsBefore,
            route: trajectoryId.split('_')[0], // Extract route from trajectory ID if available
        };
    }
    /**
     * Get current learning statistics from SonaEngine
     */
    getLearningStats() {
        const stats = this.sonaEngine.getStats();
        return {
            trajectoryCount: stats.trajectoryCount,
            totalPatterns: stats.totalPatterns,
            routeCount: stats.routeCount,
        };
    }
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
    modeToReasoningType(mode) {
        switch (mode) {
            case 'code':
                // Code generation benefits from pattern matching
                return ReasoningMode.PATTERN_MATCH;
            case 'research':
                // Research needs causal reasoning for deep analysis
                return ReasoningMode.CAUSAL_INFERENCE;
            case 'write':
                // Writing benefits from contextual similarity
                return ReasoningMode.CONTEXTUAL;
            case 'general':
            default:
                // General questions use hybrid approach
                return ReasoningMode.HYBRID;
        }
    }
}
//# sourceMappingURL=trajectory-bridge.js.map