/**
 * God Agent Vector Distance Metrics
 *
 * Implements: TASK-VDB-001
 * Referenced by: VectorDB search operations
 *
 * All metrics assume vectors are already validated (768D, L2-normalized, finite)
 */
import { DistanceMetric } from './types.js';
/**
 * Calculate cosine similarity between two vectors
 * For L2-normalized vectors, this is simply the dot product
 *
 * @param a - First vector (must be L2-normalized)
 * @param b - Second vector (must be L2-normalized)
 * @returns Similarity in range [-1, 1], where 1 = identical, -1 = opposite
 * @throws GraphDimensionMismatchError if dimensions don't match
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Calculate Euclidean distance (L2 distance) between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (0 = identical, larger = more different)
 * @throws GraphDimensionMismatchError if dimensions don't match
 */
export declare function euclideanDistance(a: Float32Array, b: Float32Array): number;
/**
 * Calculate dot product between two vectors
 * Similar to cosine similarity but without normalization assumption
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product value
 * @throws GraphDimensionMismatchError if dimensions don't match
 */
export declare function dotProduct(a: Float32Array, b: Float32Array): number;
/**
 * Calculate Manhattan distance (L1 distance) between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (0 = identical, larger = more different)
 * @throws GraphDimensionMismatchError if dimensions don't match
 */
export declare function manhattanDistance(a: Float32Array, b: Float32Array): number;
/**
 * Get the appropriate distance/similarity function for a metric
 *
 * @param metric - The distance metric to use
 * @returns Function that calculates the metric
 */
export declare function getMetricFunction(metric: DistanceMetric): (a: Float32Array, b: Float32Array) => number;
/**
 * Check if a metric is a similarity metric (higher = better)
 * vs distance metric (lower = better)
 *
 * @param metric - The metric to check
 * @returns true if similarity metric, false if distance metric
 */
export declare function isSimilarityMetric(metric: DistanceMetric): boolean;
//# sourceMappingURL=distance-metrics.d.ts.map