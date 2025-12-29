/**
 * HNSW Distance Functions
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Referenced by: HNSWIndex
 *
 * Optimized distance/similarity functions for HNSW search.
 * Note: For HNSW, we use distance (lower = more similar) not similarity.
 */
import { DistanceFunction } from './hnsw-types.js';
/**
 * Cosine distance between two vectors
 * For normalized vectors: distance = 1 - dot_product
 *
 * @param a - First vector (should be L2-normalized)
 * @param b - Second vector (should be L2-normalized)
 * @returns Distance in range [0, 2], where 0 = identical
 */
export declare function cosineDistance(a: Float32Array, b: Float32Array): number;
/**
 * Euclidean distance (L2 distance) between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance >= 0, where 0 = identical
 */
export declare function euclideanDistance(a: Float32Array, b: Float32Array): number;
/**
 * Negative dot product distance (for maximizing dot product)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Negative dot product (lower = higher similarity)
 */
export declare function dotProductDistance(a: Float32Array, b: Float32Array): number;
/**
 * Squared Euclidean distance (faster, avoids sqrt)
 * Use when only relative ordering matters
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Squared distance >= 0
 */
export declare function squaredEuclideanDistance(a: Float32Array, b: Float32Array): number;
/**
 * Get distance function for a given metric type
 *
 * @param metric - The metric type
 * @returns Distance function
 */
export declare function getDistanceFunction(metric: 'cosine' | 'euclidean' | 'dot'): DistanceFunction;
/**
 * Convert distance back to similarity for output
 * HNSW uses distance internally, but API returns similarity
 *
 * @param distance - Distance value
 * @param metric - The metric type used
 * @returns Similarity value (higher = more similar)
 */
export declare function distanceToSimilarity(distance: number, metric: 'cosine' | 'euclidean' | 'dot'): number;
//# sourceMappingURL=distance.d.ts.map