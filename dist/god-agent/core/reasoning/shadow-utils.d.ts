/**
 * Shadow Vector Utilities
 * TASK-SHA-001 - Contradiction Detection Helpers
 *
 * Provides utility functions for:
 * - Vector inversion (shadow creation)
 * - Similarity calculations
 * - Classification logic
 * - Credibility scoring
 */
import type { ValidationVerdict, EvidenceType, IClassificationThresholds, IShadowSearchResult } from './shadow-types.js';
/**
 * Create a shadow vector by inverting all components
 * Shadow(v) = v × -1
 *
 * Property: cosine(v, x) = -cosine(Shadow(v), x)
 *
 * @param vector - Original vector (1536-dim VECTOR_DIM, L2-normalized)
 * @returns Inverted shadow vector
 */
export declare function createShadowVector(vector: Float32Array): Float32Array;
/**
 * Calculate cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity [-1, 1]
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Verify a vector is L2-normalized
 *
 * @param vector - Vector to check
 * @param tolerance - Acceptable deviation from 1.0 (default 0.001)
 * @returns True if normalized
 */
export declare function isL2Normalized(vector: Float32Array, tolerance?: number): boolean;
/**
 * L2-normalize a vector
 *
 * @param vector - Vector to normalize
 * @returns L2-normalized vector
 */
export declare function normalizeL2(vector: Float32Array): Float32Array;
/**
 * Classify a document based on hypothesis and shadow similarities
 *
 * Classification Matrix:
 * | Hypothesis Similarity | Shadow Similarity | Classification |
 * |----------------------|-------------------|----------------|
 * | > 0.7                | > 0.7             | AMBIGUOUS      |
 * | < Shadow             | > 0.7             | CONTESTED      |
 * | 0.5-0.7              | 0.5-0.7           | DEBATED        |
 * | < 0.3                | > 0.7             | FALSIFIED      |
 * | > 0.7                | < 0.3             | SUPPORTED      |
 * | otherwise            |                   | UNCERTAIN      |
 *
 * @param hypothesisSimilarity - Similarity to original hypothesis
 * @param shadowSimilarity - Similarity to shadow vector
 * @param thresholds - Classification thresholds
 * @returns Classification verdict
 */
export declare function classifyDocument(hypothesisSimilarity: number, shadowSimilarity: number, thresholds?: IClassificationThresholds): ValidationVerdict;
/**
 * Determine evidence type based on classification and strength
 *
 * @param classification - Document classification
 * @param refutationStrength - Strength of refutation
 * @returns Evidence type
 */
export declare function determineEvidenceType(classification: ValidationVerdict, refutationStrength: number): EvidenceType;
/**
 * Calculate credibility score based on support vs contradiction balance
 *
 * Formula:
 * credibility = (supportSum - contradictionSum) / (supportSum + contradictionSum + epsilon)
 * Normalized to [0, 1] range
 *
 * @param supportStrengths - Array of support strengths
 * @param refutationStrengths - Array of refutation strengths
 * @returns Credibility score [0, 1]
 */
export declare function calculateCredibility(supportStrengths: number[], refutationStrengths: number[]): number;
/**
 * Determine final verdict based on credibility and evidence
 *
 * @param credibility - Credibility score [0, 1]
 * @param supportCount - Number of supporting evidence
 * @param contradictionCount - Number of contradicting evidence
 * @returns Final verdict
 */
export declare function determineVerdict(credibility: number, supportCount: number, contradictionCount: number): ValidationVerdict;
/**
 * Calculate confidence in the verdict
 *
 * Higher confidence when:
 * - More evidence available
 * - Evidence is consistent (one-sided)
 * - Individual evidence strengths are high
 *
 * @param supportStrengths - Support evidence strengths
 * @param refutationStrengths - Refutation evidence strengths
 * @returns Confidence score [0, 1]
 */
export declare function calculateVerdictConfidence(supportStrengths: number[], refutationStrengths: number[]): number;
/**
 * Calculate refutation strength from similarity scores
 *
 * Refutation strength is high when:
 * - Shadow similarity is high
 * - Hypothesis similarity is low
 *
 * @param hypothesisSimilarity - Similarity to hypothesis
 * @param shadowSimilarity - Similarity to shadow vector
 * @returns Refutation strength [0, 1]
 */
export declare function calculateRefutationStrength(hypothesisSimilarity: number, shadowSimilarity: number): number;
/**
 * Sort search results by refutation strength
 *
 * @param results - Search results to sort
 * @returns Sorted results (highest refutation first)
 */
export declare function sortByRefutationStrength(results: IShadowSearchResult[]): IShadowSearchResult[];
/**
 * Filter results by threshold
 *
 * @param results - Search results to filter
 * @param threshold - Minimum refutation strength
 * @returns Filtered results
 */
export declare function filterByThreshold(results: IShadowSearchResult[], threshold: number): IShadowSearchResult[];
//# sourceMappingURL=shadow-utils.d.ts.map