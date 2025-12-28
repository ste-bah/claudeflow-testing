/**
 * DAI-003: Intelligent Task Routing Cold Start Configuration
 *
 * TASK-003: Cold Start Configuration
 * Constitution: RULE-DAI-003-006 (cold start mode must be explicit)
 *
 * Provides:
 * - Phase determination based on execution count
 * - Weight calculation per phase
 * - Cold start indicator formatting
 * - Validation for execution counts
 *
 * Phase thresholds:
 * - keyword-only: 0-25 executions
 * - blended: 26-100 executions
 * - learned: 100+ executions
 *
 * Weight progression:
 * - keyword-only: keyword=1.0, capability=0.0
 * - blended: keyword=0.7, capability=0.3
 * - learned: keyword=0.2, capability=0.8
 *
 * @module src/god-agent/core/routing/cold-start-config
 */
import { ColdStartPhase, IColdStartConfig } from './routing-types.js';
/**
 * Default cold start configuration (re-export)
 */
export declare const defaultColdStartConfig: IColdStartConfig;
/**
 * Determine the cold start phase based on execution count
 *
 * Phase thresholds:
 * - keyword-only: 0-25 executions (pure keyword matching)
 * - blended: 26-100 executions (keyword + capability)
 * - learned: 100+ executions (full learned routing)
 *
 * @param executionCount - Current execution count
 * @param config - Cold start configuration (optional)
 * @returns Cold start phase
 * @throws RoutingError if execution count is negative
 *
 * @example
 * ```typescript
 * const phase = getColdStartPhase(15); // 'keyword-only'
 * const phase2 = getColdStartPhase(50); // 'blended'
 * const phase3 = getColdStartPhase(150); // 'learned'
 * ```
 */
export declare function getColdStartPhase(executionCount: number, config?: IColdStartConfig): ColdStartPhase;
/**
 * Get keyword and capability weights for a given cold start phase
 *
 * Weight progression:
 * - keyword-only: keyword=1.0, capability=0.0
 * - blended: keyword=0.7, capability=0.3
 * - learned: keyword=0.2, capability=0.8
 *
 * Capability weight is always (1.0 - keyword weight) to ensure they sum to 1.0
 *
 * @param phase - Cold start phase
 * @param config - Cold start configuration (optional)
 * @returns Object with keywordWeight and capabilityWeight
 *
 * @example
 * ```typescript
 * const weights = getColdStartWeights('keyword-only');
 * // { keywordWeight: 1.0, capabilityWeight: 0.0 }
 *
 * const weights2 = getColdStartWeights('blended');
 * // { keywordWeight: 0.7, capabilityWeight: 0.3 }
 *
 * const weights3 = getColdStartWeights('learned');
 * // { keywordWeight: 0.2, capabilityWeight: 0.8 }
 * ```
 */
export declare function getColdStartWeights(phase: ColdStartPhase, config?: IColdStartConfig): {
    keywordWeight: number;
    capabilityWeight: number;
};
/**
 * Format a cold start indicator message for routing results
 *
 * Per RULE-DAI-003-006, cold start mode must be explicit in routing results.
 *
 * Format:
 * - Cold start (< 100 executions): "[Cold Start Mode: X/100 executions]"
 * - Learned (≥ 100 executions): "[Learned Mode]"
 *
 * @param phase - Cold start phase
 * @param executionCount - Current execution count
 * @returns Formatted cold start indicator string
 *
 * @example
 * ```typescript
 * const indicator = formatColdStartIndicator('keyword-only', 15);
 * // "[Cold Start Mode: 15/100 executions]"
 *
 * const indicator2 = formatColdStartIndicator('blended', 75);
 * // "[Cold Start Mode: 75/100 executions]"
 *
 * const indicator3 = formatColdStartIndicator('learned', 150);
 * // "[Learned Mode]"
 * ```
 */
export declare function formatColdStartIndicator(phase: ColdStartPhase, executionCount: number): string;
//# sourceMappingURL=cold-start-config.d.ts.map