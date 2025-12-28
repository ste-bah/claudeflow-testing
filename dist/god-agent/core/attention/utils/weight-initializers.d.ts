/**
 * Weight Initialization Utilities
 *
 * Implements Xavier/Glorot uniform initialization for neural network weights.
 *
 * Reference: Glorot & Bengio 2010
 * "Understanding the difficulty of training deep feedforward neural networks"
 */
import { SeededRandom } from './seeded-random.js';
/**
 * Initialize weight matrix using Xavier/Glorot UNIFORM distribution
 *
 * Formula: W ~ U(-limit, limit)
 * where limit = √(6 / (fan_in + fan_out))
 *
 * IMPORTANT: This is UNIFORM distribution, NOT Gaussian.
 *
 * @param fanIn Input dimension
 * @param fanOut Output dimension
 * @param rng Optional seeded RNG for deterministic initialization
 * @returns Weight matrix [fanOut × fanIn] with Xavier uniform initialization
 *
 * @example
 * ```typescript
 * // Random initialization
 * const weights = xavierUniform(768, 768);
 *
 * // Deterministic initialization (for testing)
 * const rng = new SeededRandom(42);
 * const weights = xavierUniform(768, 768, rng);
 * ```
 */
export declare function xavierUniform(fanIn: number, fanOut: number, rng?: SeededRandom): Float32Array;
/**
 * Compute expected variance for Xavier initialization
 *
 * Theoretical variance: Var(W) = 2 / (fan_in + fan_out)
 *
 * @param fanIn Input dimension
 * @param fanOut Output dimension
 * @returns Expected variance
 */
export declare function xavierVariance(fanIn: number, fanOut: number): number;
/**
 * Validate that weights have Xavier-like properties
 *
 * @param weights Weight matrix
 * @param fanIn Input dimension
 * @param fanOut Output dimension
 * @param tolerance Tolerance for statistical checks
 * @returns True if weights pass validation
 */
export declare function validateXavierWeights(weights: Float32Array, fanIn: number, fanOut: number, tolerance?: number): boolean;
//# sourceMappingURL=weight-initializers.d.ts.map