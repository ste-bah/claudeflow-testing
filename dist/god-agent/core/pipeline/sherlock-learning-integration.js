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
import { Verdict, VerdictConfidence, FORENSIC_MEMORY_NAMESPACE, } from './sherlock-phase-reviewer-types.js';
/**
 * Zod schema for configuration validation (TS-004).
 */
export const SherlockLearningConfigSchema = z.object({
    enabled: z.boolean().default(true),
    patternThreshold: z.number().min(0).max(1).default(0.75),
    verbose: z.boolean().optional().default(false),
    routePrefix: z.string().default('coding/forensics/'),
});
/**
 * Default configuration.
 */
export const DEFAULT_SHERLOCK_LEARNING_CONFIG = {
    enabled: true,
    patternThreshold: 0.75,
    verbose: false,
    routePrefix: 'coding/forensics/',
};
/**
 * Custom error class for Sherlock-Learning integration.
 */
export class SherlockLearningError extends Error {
    code;
    phase;
    constructor(code, message, phase) {
        super(message);
        this.code = code;
        this.phase = phase;
        this.name = 'SherlockLearningError';
        Object.setPrototypeOf(this, SherlockLearningError.prototype);
    }
}
// QUALITY CALCULATION HELPERS
/**
 * Convert verdict to quality score for learning.
 * INNOCENT = high quality (execution was correct)
 * GUILTY = low quality (execution had issues)
 */
function verdictToQuality(verdict, confidence) {
    const baseScore = verdict === Verdict.INNOCENT
        ? 0.9
        : verdict === Verdict.GUILTY
            ? 0.3
            : 0.5; // INSUFFICIENT_EVIDENCE
    const confidenceMultiplier = confidence === VerdictConfidence.HIGH
        ? 1.0
        : confidence === VerdictConfidence.MEDIUM
            ? 0.85
            : 0.7; // LOW
    return Math.min(1.0, baseScore * confidenceMultiplier);
}
/**
 * Extract key findings from adversarial analysis.
 */
function extractFindings(findings) {
    return findings
        .filter((f) => f.severity === 'critical' || f.severity === 'warning')
        .map((f) => `[${f.persona}] ${f.findings}`)
        .slice(0, 5); // Limit to 5 most important
}
/**
 * Generate pattern ID from case file.
 */
function generatePatternId(caseFile) {
    return `forensic-${caseFile.phase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * Build route string for forensic trajectory.
 */
function buildForensicRoute(routePrefix, phase) {
    return `${routePrefix}phase-${phase}/verdict`;
}
// SHERLOCK LEARNING INTEGRATION CLASS
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
/**
 * Maximum patterns to retain (prevents memory leaks).
 */
const MAX_PATTERNS_SIZE = 500;
export class SherlockLearningIntegration {
    _sonaEngine;
    _reasoningBank;
    _config;
    _listeners = [];
    _patterns = new Map();
    constructor(options) {
        this._sonaEngine = options.sonaEngine ?? null;
        this._reasoningBank = options.reasoningBank ?? null;
        // Validate config (TS-004)
        const parsed = SherlockLearningConfigSchema.safeParse(options.config ?? DEFAULT_SHERLOCK_LEARNING_CONFIG);
        if (!parsed.success) {
            throw new SherlockLearningError('CONFIG_INVALID', `Invalid configuration: ${parsed.error.message}`);
        }
        this._config = parsed.data;
    }
    /**
     * Record a Sherlock verdict and feed into learning system.
     *
     * @param result - Phase review result from Sherlock
     * @returns Weight update result if learning occurred
     */
    async recordVerdict(result) {
        if (!this._config.enabled) {
            this._log(`Learning disabled, skipping verdict for phase ${result.phase}`);
            return null;
        }
        if (!this._sonaEngine) {
            this._log(`No SonaEngine available, skipping learning for phase ${result.phase}`);
            return null;
        }
        const quality = verdictToQuality(result.verdict, result.confidence);
        this._log(`Recording verdict: phase=${result.phase}, verdict=${result.verdict}, quality=${quality.toFixed(2)}`);
        // Create trajectory for this forensic investigation
        const trajectoryId = this._createTrajectory(result);
        // Emit event
        this._emitEvent({
            type: 'verdict:recorded',
            timestamp: new Date(),
            phase: result.phase,
            verdict: result.verdict,
            quality,
            trajectoryId,
        });
        // Provide feedback to SonaEngine
        const updateResult = await this._provideFeedback(trajectoryId, quality, result);
        // Store pattern if quality is high enough
        if (quality >= this._config.patternThreshold) {
            await this._storePattern(result, quality);
        }
        return updateResult;
    }
    /**
     * Create trajectory for forensic investigation.
     */
    _createTrajectory(result) {
        const trajectoryId = `sherlock-${result.caseFile.caseId}`;
        const route = buildForensicRoute(this._config.routePrefix, result.phase);
        // Get pattern IDs from verification results
        const patterns = result.caseFile.verificationResults
            .filter((v) => v.passed)
            .map((v) => `verification-${v.check}`);
        // Context includes the case file ID
        const context = [result.caseFile.caseId];
        if (this._sonaEngine) {
            this._sonaEngine.createTrajectoryWithId(trajectoryId, route, patterns, context);
        }
        return trajectoryId;
    }
    /**
     * Provide feedback to SonaEngine.
     */
    async _provideFeedback(trajectoryId, quality, result) {
        if (!this._sonaEngine)
            return null;
        try {
            const updateResult = await this._sonaEngine.provideFeedback(trajectoryId, quality, {
                lScore: quality,
                rlmContext: {
                    injectionSuccess: true,
                    sourceAgentKey: `sherlock-phase-${result.phase}`,
                    sourceStepIndex: result.phase,
                    sourceDomain: FORENSIC_MEMORY_NAMESPACE.caseFile(result.phase),
                },
            });
            this._emitEvent({
                type: 'trajectory:feedback',
                timestamp: new Date(),
                phase: result.phase,
                verdict: result.verdict,
                quality,
                trajectoryId,
                data: { patternsUpdated: updateResult.patternsUpdated },
            });
            return updateResult;
        }
        catch (error) {
            this._log(`Failed to provide feedback: ${error}`);
            return null;
        }
    }
    /**
     * Store high-quality pattern in pattern library.
     */
    async _storePattern(result, quality) {
        const patternId = generatePatternId(result.caseFile);
        const findings = extractFindings(result.caseFile.adversarialFindings);
        const pattern = {
            id: patternId,
            phase: result.phase,
            verdict: result.verdict,
            findings,
            confidence: result.confidence,
            quality,
            timestamp: new Date(),
        };
        // Store locally with bounded size (prevents memory leaks)
        this._trimPatterns();
        this._patterns.set(patternId, pattern);
        // Store in ReasoningBank if available
        if (this._reasoningBank && result.verdict === Verdict.INNOCENT) {
            try {
                await this._reasoningBank.provideFeedback({
                    trajectoryId: `sherlock-${result.caseFile.caseId}`,
                    verdict: 'correct',
                    quality,
                });
                this._emitEvent({
                    type: 'pattern:created',
                    timestamp: new Date(),
                    phase: result.phase,
                    verdict: result.verdict,
                    quality,
                    data: { patternId, findings },
                });
            }
            catch (error) {
                this._log(`Failed to store pattern in ReasoningBank: ${error}`);
            }
        }
    }
    /**
     * Add event listener.
     */
    addEventListener(listener) {
        this._listeners.push(listener);
    }
    /**
     * Remove event listener.
     */
    removeEventListener(listener) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }
    /**
     * Get all stored patterns.
     */
    getPatterns() {
        return Array.from(this._patterns.values());
    }
    /**
     * Get patterns for a specific phase.
     */
    getPatternsForPhase(phase) {
        return this.getPatterns().filter((p) => p.phase === phase);
    }
    /**
     * Clear all patterns.
     */
    clearPatterns() {
        this._patterns.clear();
    }
    /**
     * Check if learning is enabled.
     */
    isEnabled() {
        return this._config.enabled && this._sonaEngine !== null;
    }
    /**
     * Get configuration.
     */
    getConfig() {
        return { ...this._config };
    }
    /**
     * Emit learning event.
     */
    _emitEvent(event) {
        for (const listener of this._listeners) {
            try {
                listener(event);
            }
            catch (error) {
                this._log(`Event listener error: ${error}`);
            }
        }
    }
    /**
     * Trim patterns to bounded size (prevents memory leaks).
     */
    _trimPatterns() {
        while (this._patterns.size >= MAX_PATTERNS_SIZE) {
            const oldest = this._patterns.keys().next().value;
            if (oldest) {
                this._patterns.delete(oldest);
            }
            else {
                break;
            }
        }
    }
    /**
     * Log message if verbose mode enabled.
     */
    _log(message) {
        if (this._config.verbose) {
            process.stderr.write(`[SHERLOCK-LEARNING] ${message}\n`);
        }
    }
}
// FACTORY FUNCTIONS
/**
 * Create a Sherlock-Learning integration instance.
 *
 * @param options - Integration options
 * @returns New SherlockLearningIntegration instance
 */
export function createSherlockLearningIntegration(options) {
    return new SherlockLearningIntegration(options);
}
/**
 * Create a minimal Sherlock-Learning integration for testing.
 *
 * @returns New SherlockLearningIntegration instance with no backing engines
 */
export function createTestSherlockLearningIntegration() {
    return new SherlockLearningIntegration({
        config: { enabled: true, patternThreshold: 0.75 },
    });
}
//# sourceMappingURL=sherlock-learning-integration.js.map