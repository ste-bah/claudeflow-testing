/**
 * Confidence Scoring for Pattern Matching
 *
 * Implements: TASK-PAT-001 (Confidence Scorer)
 *
 * Provides confidence scoring, calibration, and ranking for pattern results.
 * Performance target: <1ms per pattern scoring
 */
import { Pattern, PatternResult } from './pattern-types.js';
/**
 * Calculate raw confidence score for a pattern match
 *
 * Formula: confidence = similarity × successRate × sonaWeight
 *
 * @param similarity - Vector similarity [0, 1] from HNSW search
 * @param successRate - Historical success rate [0, 1]
 * @param sonaWeight - SONA confidence weight [0, 1]
 * @returns Raw confidence score [0, 1]
 */
export declare function calculateConfidence(similarity: number, successRate: number, sonaWeight: number): number;
/**
 * Calibrate raw confidence using sigmoid function
 *
 * Maps raw confidence to calibrated confidence with better distribution.
 * Uses sigmoid centered at 0.5 with steepness parameter.
 *
 * Formula: sigmoid(x) = 1 / (1 + exp(-k * (x - 0.5)))
 * where k controls steepness (higher k = steeper curve)
 *
 * @param rawConfidence - Raw confidence score [0, 1]
 * @param steepness - Sigmoid steepness parameter (default: 10)
 * @returns Calibrated confidence [0, 1]
 */
export declare function calibrateConfidence(rawConfidence: number, steepness?: number): number;
/**
 * Rank patterns by confidence with tie-breaking rules
 *
 * Primary sort: confidence (descending)
 * Tie-breakers (in order):
 * 1. successRate (descending)
 * 2. sonaWeight (descending)
 * 3. usageCount (descending)
 * 4. createdAt (ascending - older patterns preferred)
 *
 * @param patterns - Array of pattern results to rank
 * @returns Sorted array with rank field updated
 */
export declare function rankPatterns(patterns: PatternResult[]): PatternResult[];
/**
 * Filter patterns by minimum thresholds
 *
 * @param patterns - Array of pattern results
 * @param minConfidence - Minimum confidence threshold [0, 1]
 * @param minSuccessRate - Minimum success rate threshold [0, 1]
 * @param minSonaWeight - Minimum SONA weight threshold [0, 1]
 * @returns Filtered array of patterns
 */
export declare function filterPatterns(patterns: PatternResult[], minConfidence?: number, minSuccessRate?: number, minSonaWeight?: number): PatternResult[];
/**
 * Batch calculate confidences for multiple patterns
 *
 * Performance-optimized for batch processing.
 * Target: <1ms per pattern
 *
 * @param patterns - Array of patterns to score
 * @param similarities - Corresponding similarity scores
 * @param calibrate - Whether to apply sigmoid calibration (default: true)
 * @returns Array of confidence scores
 */
export declare function batchCalculateConfidence(patterns: Pattern[], similarities: number[], calibrate?: boolean): number[];
/**
 * Create pattern result from pattern and scoring metrics
 *
 * @param pattern - The pattern object
 * @param similarity - Vector similarity score [0, 1]
 * @param rank - Result rank position (1-based)
 * @param calibrate - Whether to calibrate confidence (default: true)
 * @returns PatternResult object
 */
export declare function createPatternResult(pattern: Pattern, similarity: number, rank?: number, calibrate?: boolean): PatternResult;
//# sourceMappingURL=confidence-scorer.d.ts.map