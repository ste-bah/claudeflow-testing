/**
 * Coding Quality Gate Weights
 *
 * Phase-specific weight calculations for L-Score composite scoring.
 * Different phases prioritize different quality components.
 *
 * @module src/god-agent/core/pipeline/coding-quality-gate-weights
 * @see docs/coding-pipeline/quality-gate-system.md
 */
import type { CodingPipelinePhase } from './types.js';
import { type ILScoreWeights, type ILScoreBreakdown, PipelinePhase } from './coding-quality-gate-types.js';
/**
 * Get phase-specific component weights.
 * Weights are calibrated based on what matters most in each phase.
 *
 * @param phase - The pipeline phase to get weights for
 * @returns The weight configuration for the specified phase
 */
export declare function getPhaseWeights(phase: PipelinePhase | CodingPipelinePhase | string): ILScoreWeights;
/**
 * Calculate composite L-Score based on phase-specific weights.
 *
 * @param breakdown - The individual L-Score components
 * @param phase - The pipeline phase for weight selection
 * @returns The weighted composite score (0.0 - 1.0)
 */
export declare function calculateLScore(breakdown: Omit<ILScoreBreakdown, 'composite'>, phase: PipelinePhase | CodingPipelinePhase): number;
/**
 * Create an L-Score breakdown with computed composite.
 *
 * @param components - The individual component scores
 * @param phase - The pipeline phase for weight calculation
 * @returns Complete L-Score breakdown including composite
 */
export declare function createLScoreBreakdown(components: Omit<ILScoreBreakdown, 'composite'>, phase: PipelinePhase | CodingPipelinePhase): ILScoreBreakdown;
//# sourceMappingURL=coding-quality-gate-weights.d.ts.map