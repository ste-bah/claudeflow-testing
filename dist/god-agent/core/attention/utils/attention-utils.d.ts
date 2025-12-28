/**
 * Attention Utility Functions
 *
 * Provides softmax, normalization, and other attention-specific operations.
 */
/**
 * Numerically stable row-wise softmax
 *
 * Formula: softmax(x_i) = exp(x_i - max(x)) / Σⱼ exp(x_j - max(x))
 *
 * Max subtraction prevents overflow/underflow:
 * - Without: exp(1000) = Infinity
 * - With: exp(1000 - 1000) = exp(0) = 1
 *
 * @param scores Flattened score matrix [seq_len × seq_len] (row-major)
 * @param seqLen Sequence length
 * @returns Normalized weights [seq_len × seq_len] where each row sums to 1
 *
 * @throws Error if scores contain NaN
 *
 * @example
 * ```typescript
 * const scores = new Float32Array([1, 2, 3, 4]);
 * const weights = softmax2D(scores, 2);
 * // Row 0: [exp(1-2)/Z, exp(2-2)/Z]
 * // Row 1: [exp(3-4)/Z, exp(4-4)/Z]
 * ```
 */
export declare function softmax2D(scores: Float32Array, seqLen: number): Float32Array;
/**
 * Validate softmax output (debugging utility)
 *
 * Checks:
 * - Each row sums to 1.0 (±tolerance)
 * - All values in [0, 1]
 * - No NaN/Inf
 *
 * @param weights Softmax output
 * @param seqLen Sequence length
 * @param tolerance Acceptable deviation from 1.0
 * @returns True if valid
 */
export declare function validateSoftmax(weights: Float32Array, seqLen: number, tolerance?: number): boolean;
/**
 * Check for NaN or Infinity in array
 *
 * @param arr Array to check
 * @returns True if contains NaN or Inf
 */
export declare function hasNaNOrInf(arr: Float32Array): boolean;
//# sourceMappingURL=attention-utils.d.ts.map