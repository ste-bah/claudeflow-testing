/**
 * Real Multi-Head Scaled Dot-Product Attention
 *
 * Reference: Vaswani et al. 2017 "Attention is All You Need"
 *
 * Implements true multi-head attention with:
 * - Scaled dot-product: (Q·K^T) / √d_k
 * - Softmax normalization
 * - Xavier uniform weight initialization
 * - Numerical stability (no NaN/Inf)
 * - Attention masking support
 *
 * Complexity: O(N² × d) time, O(N²) space
 * Parameter Count: 4 × dim²
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Standard Attention Implementation
 *
 * @example
 * ```typescript
 * // Create attention mechanism
 * const attention = new RealStandardAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   seed: 42  // Optional: deterministic init for testing
 * });
 *
 * // Single vector attention
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Multi-sequence attention
 * const seqLen = 4;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 *
 * // With causal mask
 * import { createCausalMask } from '../utils/index.js';
 * const mask = createCausalMask(seqLen);
 * const output = attention.forward(query, query, query, mask, seqLen);
 * ```
 */
export declare class RealStandardAttention implements IAttentionMechanism {
    readonly name = "standard";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize standard attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 12)
     * @param config.seed Random seed for deterministic initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        seed?: number;
    });
    /**
     * Forward pass: Multi-head attention computation
     *
     * Computes: MultiHead(Q, K, V) = Concat(head₁, ..., headₕ) W^O
     * where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
     *
     * @param query Query vectors [seq_len × dimension] (flattened)
     * @param key Key vectors [seq_len × dimension] (flattened)
     * @param value Value vectors [seq_len × dimension] (flattened)
     * @param mask Attention mask [seq_len × seq_len] (flattened row-major, optional)
     *             Semantics: true=attend, false=mask out (PyTorch convention)
     * @param seqLen Sequence length (optional, inferred from query.length if undefined)
     * @returns Output vectors [seq_len × dimension] (flattened)
     *
     * @throws Error if dimensions incompatible or contain NaN
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute attention for a single head
     *
     * Algorithm:
     * 1. Compute scaled dot-product scores: (Q·K^T) / √d_k
     * 2. Apply mask (set masked positions to -Infinity)
     * 3. Apply softmax normalization
     * 4. Compute weighted sum: weights · V
     *
     * @param Q Projected query [seq_len × dimension]
     * @param K Projected key [seq_len × dimension]
     * @param V Projected value [seq_len × dimension]
     * @param head Head index
     * @param seqLen Sequence length
     * @param mask Optional attention mask
     * @returns Head output [seq_len × headDim]
     */
    private computeHeadAttention;
    /**
     * Concatenate multiple head outputs
     *
     * Transforms: [head₁[seq×d_k], head₂[seq×d_k], ...] → [seq×dim]
     *
     * @param headOutputs Array of head outputs
     * @param seqLen Sequence length
     * @returns Concatenated output [seq_len × dimension]
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Parameters: 4 weight matrices (Wq, Wk, Wv, Wo) each of size [dim × dim]
     *
     * @returns Parameter count = 4 × dim²
     *
     * @example
     * ```typescript
     * const attention = new RealStandardAttention({ dimension: 768 });
     * console.log(attention.getParameterCount()); // 2,359,296
     * ```
     */
    getParameterCount(): number;
}
//# sourceMappingURL=standard-attention.d.ts.map