/**
 * Coding Quality Gate Definitions
 *
 * Defines the 7 quality gates for the God Agent Coding Pipeline.
 * Each gate enforces minimum L-Score thresholds at phase boundaries.
 *
 * Gate Progression: 0.75 → 0.80 → 0.85 → 0.90 → 0.92 → 0.88 → 0.95
 *
 * @module src/god-agent/core/pipeline/coding-quality-gate-definitions
 * @see docs/coding-pipeline/quality-gate-system.md
 */
import { type IQualityGate, PipelinePhase } from './coding-quality-gate-types.js';
/**
 * Gate 1: Understanding → Exploration
 * Minimum L-Score: 0.75
 * Critical: accuracy, completeness
 */
export declare const GATE_1_UNDERSTANDING: IQualityGate;
/**
 * Gate 2: Exploration → Architecture
 * Minimum L-Score: 0.80
 * Critical: completeness, accuracy
 */
export declare const GATE_2_EXPLORATION: IQualityGate;
/**
 * Gate 3: Architecture → Implementation
 * Minimum L-Score: 0.85
 * Critical: maintainability, completeness, security
 */
export declare const GATE_3_ARCHITECTURE: IQualityGate;
/**
 * Gate 4: Implementation → Testing
 * Minimum L-Score: 0.90
 * Critical: accuracy, security, maintainability
 */
export declare const GATE_4_IMPLEMENTATION: IQualityGate;
/**
 * Gate 5: Testing → Optimization
 * Minimum L-Score: 0.92
 * Critical: testCoverage, accuracy, security
 */
export declare const GATE_5_TESTING: IQualityGate;
/**
 * Gate 6: Optimization → Delivery
 * Minimum L-Score: 0.88
 * Critical: performance, security, testCoverage
 */
export declare const GATE_6_OPTIMIZATION: IQualityGate;
/**
 * Gate 7: Delivery → Complete
 * Minimum L-Score: 0.95 (highest threshold)
 * Critical: accuracy, completeness, security
 */
export declare const GATE_7_DELIVERY: IQualityGate;
/**
 * All gates in execution order.
 * Gate progression: 0.75 → 0.80 → 0.85 → 0.90 → 0.92 → 0.88 → 0.95
 */
export declare const ALL_GATES: readonly IQualityGate[];
/**
 * Get gate by ID.
 *
 * @param gateId - The gate identifier
 * @returns The gate definition or undefined
 */
export declare function getGateById(gateId: string): IQualityGate | undefined;
/**
 * Get gate for a specific phase transition.
 *
 * @param phaseBefore - The phase before the gate
 * @returns The gate definition or undefined
 */
export declare function getGateForPhase(phaseBefore: PipelinePhase | string): IQualityGate | undefined;
/**
 * Get summary of all gate thresholds.
 *
 * @returns Record of gate IDs to their threshold info
 */
export declare function getGateThresholdsSummary(): Record<string, {
    minLScore: number;
    criticalComponents: string[];
}>;
//# sourceMappingURL=coding-quality-gate-definitions.d.ts.map