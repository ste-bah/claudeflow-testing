/**
 * Sherlock-Learning Integration
 *
 * Connects Sherlock forensic verdicts to the RLM/LEANN learning system.
 * ONLY for /god-code coding pipeline - NOT for PhD pipeline.
 *
 * @module src/god-agent/core/pipeline/sherlock-learning-integration
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.5
 */
import { z } from 'zod';
import type { ISonaEngine, IWeightUpdateResult } from '../learning/sona-types.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import { type IPhaseReviewResult, Verdict, VerdictConfidence } from './sherlock-phase-reviewer-types.js';
/**
 * Configuration for Sherlock-Learning integration.
 */
export interface ISherlockLearningConfig {
    /** Enable learning from verdicts */
    readonly enabled: boolean;
    /** Quality threshold for pattern creation (0-1) */
    readonly patternThreshold: number;
    /** Enable verbose logging */
    readonly verbose?: boolean;
    /** Route prefix for forensic trajectories */
    readonly routePrefix: string;
}
/**
 * Zod schema for configuration validation (TS-004).
 */
export declare const SherlockLearningConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    patternThreshold: z.ZodDefault<z.ZodNumber>;
    verbose: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    routePrefix: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    verbose: boolean;
    enabled: boolean;
    patternThreshold: number;
    routePrefix: string;
}, {
    verbose?: boolean | undefined;
    enabled?: boolean | undefined;
    patternThreshold?: number | undefined;
    routePrefix?: string | undefined;
}>;
/**
 * Default configuration.
 */
export declare const DEFAULT_SHERLOCK_LEARNING_CONFIG: ISherlockLearningConfig;
/**
 * Learning event types for Sherlock integration.
 */
export type SherlockLearningEventType = 'verdict:recorded' | 'pattern:created' | 'trajectory:feedback';
/**
 * Learning event payload.
 */
export interface ISherlockLearningEvent {
    readonly type: SherlockLearningEventType;
    readonly timestamp: Date;
    readonly phase: number;
    readonly verdict: Verdict;
    readonly quality?: number;
    readonly trajectoryId?: string;
    readonly data?: Record<string, unknown>;
}
/**
 * Listener for learning events.
 */
export type SherlockLearningEventListener = (event: ISherlockLearningEvent) => void;
/**
 * Pattern extracted from forensic investigation.
 */
export interface IForensicPattern {
    /** Pattern ID */
    readonly id: string;
    /** Phase number */
    readonly phase: number;
    /** Verdict that created this pattern */
    readonly verdict: Verdict;
    /** Key findings */
    readonly findings: readonly string[];
    /** Confidence level */
    readonly confidence: VerdictConfidence;
    /** Quality score used for learning */
    readonly quality: number;
    /** Timestamp */
    readonly timestamp: Date;
}
/**
 * Error codes for Sherlock-Learning integration.
 */
export type SherlockLearningErrorCode = 'CONFIG_INVALID' | 'LEARNING_DISABLED' | 'TRAJECTORY_FAILED' | 'FEEDBACK_FAILED';
/**
 * Custom error class for Sherlock-Learning integration.
 */
export declare class SherlockLearningError extends Error {
    readonly code: SherlockLearningErrorCode;
    readonly phase?: number | undefined;
    constructor(code: SherlockLearningErrorCode, message: string, phase?: number | undefined);
}
/**
 * Integrates Sherlock forensic verdicts with the learning system.
 *
 * When a Sherlock review completes:
 * 1. Creates trajectory for the forensic investigation
 * 2. Provides quality feedback based on verdict
 * 3. Stores high-quality patterns in pattern library
 *
 * CODING PIPELINE ONLY - PhD pipeline uses separate quality validation.
 *
 * @example
 * ```typescript
 * const integration = new SherlockLearningIntegration({
 *   sonaEngine,
 *   reasoningBank,
 * });
 *
 * // After Sherlock review completes
 * await integration.recordVerdict(reviewResult);
 * ```
 */
export declare class SherlockLearningIntegration {
    private readonly _sonaEngine;
    private readonly _reasoningBank;
    private readonly _config;
    private readonly _listeners;
    private readonly _patterns;
    constructor(options: {
        sonaEngine?: ISonaEngine | null;
        reasoningBank?: ReasoningBank | null;
        config?: Partial<ISherlockLearningConfig>;
    });
    /**
     * Record a Sherlock verdict and feed into learning system.
     *
     * @param result - Phase review result from Sherlock
     * @returns Weight update result if learning occurred
     */
    recordVerdict(result: IPhaseReviewResult): Promise<IWeightUpdateResult | null>;
    /**
     * Create trajectory for forensic investigation.
     */
    private _createTrajectory;
    /**
     * Provide feedback to SonaEngine.
     */
    private _provideFeedback;
    /**
     * Store high-quality pattern in pattern library.
     */
    private _storePattern;
    /**
     * Add event listener.
     */
    addEventListener(listener: SherlockLearningEventListener): void;
    /**
     * Remove event listener.
     */
    removeEventListener(listener: SherlockLearningEventListener): void;
    /**
     * Get all stored patterns.
     */
    getPatterns(): IForensicPattern[];
    /**
     * Get patterns for a specific phase.
     */
    getPatternsForPhase(phase: number): IForensicPattern[];
    /**
     * Clear all patterns.
     */
    clearPatterns(): void;
    /**
     * Check if learning is enabled.
     */
    isEnabled(): boolean;
    /**
     * Get configuration.
     */
    getConfig(): ISherlockLearningConfig;
    /**
     * Emit learning event.
     */
    private _emitEvent;
    /**
     * Log message if verbose mode enabled.
     */
    private _log;
}
/**
 * Create a Sherlock-Learning integration instance.
 *
 * @param options - Integration options
 * @returns New SherlockLearningIntegration instance
 */
export declare function createSherlockLearningIntegration(options: {
    sonaEngine?: ISonaEngine | null;
    reasoningBank?: ReasoningBank | null;
    config?: Partial<ISherlockLearningConfig>;
}): SherlockLearningIntegration;
/**
 * Create a minimal Sherlock-Learning integration for testing.
 *
 * @returns New SherlockLearningIntegration instance with no backing engines
 */
export declare function createTestSherlockLearningIntegration(): SherlockLearningIntegration;
//# sourceMappingURL=sherlock-learning-integration.d.ts.map