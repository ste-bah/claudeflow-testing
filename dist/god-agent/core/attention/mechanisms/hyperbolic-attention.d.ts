/**
 * Real Hyperbolic Attention Implementation
 *
 * Reference: Gulcehre et al. 2019 "Hyperbolic Attention Networks"
 * https://arxiv.org/abs/1805.09786
 *
 * Key insight: Embed attention in hyperbolic space to better capture
 * hierarchical relationships. Hyperbolic geometry can represent tree-like
 * structures more efficiently than Euclidean space.
 *
 * Uses the Poincaré ball model:
 * - Points lie within a unit ball
 * - Distance grows exponentially toward the boundary
 * - Hierarchies are naturally represented (root at center, leaves at boundary)
 *
 * Complexity: O(N²) (same as standard attention)
 * Parameter Count: 4 × dim² + curvature parameter
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Hyperbolic Attention Implementation
 *
 * Projects queries and keys into hyperbolic space (Poincaré ball),
 * computes attention based on hyperbolic distance.
 *
 * @example
 * ```typescript
 * // Create Hyperbolic attention for hierarchical data
 * const attention = new RealHyperbolicAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   curvature: -1.0,  // Negative curvature for hyperbolic space
 *   seed: 42
 * });
 *
 * // Process hierarchical data
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 * ```
 */
export declare class RealHyperbolicAttention implements IAttentionMechanism {
    readonly name = "hyperbolic";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly curvature;
    private readonly eps;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize Hyperbolic attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.curvature Curvature of hyperbolic space (default: -1.0)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if curvature is non-negative
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        curvature?: number;
        seed?: number;
    });
    /**
     * Project point onto Poincaré ball
     *
     * Ensures the point lies within the unit ball by clamping norm.
     * This is necessary to maintain valid hyperbolic coordinates.
     */
    private projectToPoincare;
    /**
     * Compute hyperbolic distance in Poincaré ball
     *
     * d(x, y) = (2/√|c|) * arctanh(√|c| * ||−x ⊕ y||)
     *
     * where ⊕ is Möbius addition and c is curvature.
     *
     * For simplicity, we use the squared distance formula:
     * d²(x, y) = (2/|c|) * arcosh²(1 + 2|c| * ||x-y||² / ((1-|c|*||x||²)(1-|c|*||y||²)))
     */
    private hyperbolicDistance;
    /**
     * Forward pass: Hyperbolic attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. Project Q, K onto Poincaré ball
     * 3. Compute attention scores using hyperbolic distance
     * 4. Apply softmax (with temperature from distance)
     * 5. Compute weighted values (in Euclidean space)
     * 6. Project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute hyperbolic attention for a single head
     */
    private computeHeadHyperbolicAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Hyperbolic attention: 4 × dim² (curvature is not learned here)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=hyperbolic-attention.d.ts.map