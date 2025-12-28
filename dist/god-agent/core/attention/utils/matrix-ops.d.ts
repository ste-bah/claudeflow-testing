/**
 * Matrix Operations for Attention
 *
 * All matrices are stored in row-major (C-style) flattened format.
 *
 * Example 2×3 matrix:
 * ```
 * A = [[a00, a01, a02],
 *      [a10, a11, a12]]
 *
 * Flattened: [a00, a01, a02, a10, a11, a12]
 * Index: A[i,j] → array[i * cols + j]
 * ```
 */
/**
 * Matrix-vector multiplication with support for batched sequences
 *
 * Computes: output = vec × weights^T
 *
 * Supports two modes:
 * 1. Single vector: vec[dim] × weights[dim × dim] → output[dim]
 * 2. Batched: vec[seq_len × dim] × weights[dim × dim] → output[seq_len × dim]
 *
 * @param vec Input vector(s) [seq_len * dim] (flattened)
 * @param weights Weight matrix [dim × dim] (flattened row-major)
 * @param dim Dimension size
 * @returns Output vector(s) [seq_len * dim] (flattened)
 *
 * @throws Error if dimensions incompatible
 *
 * @example
 * ```typescript
 * // Single vector
 * const vec = new Float32Array(768);
 * const weights = xavierUniform(768, 768);
 * const output = matmul(vec, weights, 768);
 *
 * // Batched (3 vectors)
 * const vec = new Float32Array(3 * 768);
 * const output = matmul(vec, weights, 768);
 * ```
 */
export declare function matmul(vec: Float32Array, weights: Float32Array, dim: number): Float32Array;
/**
 * Compute dot product of two flattened vectors
 *
 * @param a First vector
 * @param b Second vector
 * @param offset_a Offset in first vector
 * @param offset_b Offset in second vector
 * @param length Number of elements
 * @returns Dot product
 */
export declare function dotProduct(a: Float32Array, b: Float32Array, offset_a: number, offset_b: number, length: number): number;
/**
 * Validate matrix dimensions for multiplication
 *
 * @param vecLen Vector length
 * @param weightLen Weight matrix length
 * @param dim Dimension
 * @returns True if compatible
 */
export declare function validateMatmulDims(vecLen: number, weightLen: number, dim: number): boolean;
//# sourceMappingURL=matrix-ops.d.ts.map