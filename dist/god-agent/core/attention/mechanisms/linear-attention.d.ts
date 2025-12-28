/**
 * Real Linear Attention Implementation
 *
 * Reference: Katharopoulos et al. 2020 "Transformers are RNNs:
 * Fast Autoregressive Transformers with Linear Attention"
 * https://arxiv.org/abs/2006.16236
 *
 * Key insight: Replace softmax(QK^T) with φ(Q)φ(K)^T where φ is a feature map.
 * This allows O(N) complexity via associativity: (φ(Q)φ(K)^T)V = φ(Q)(φ(K)^TV)
 *
 * Complexity: O(N × d²) time, O(d²) space (vs O(N² × d) time, O(N²) space for standard)
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Linear Attention Implementation
 *
 * @example
 * ```typescript
 * // Create linear attention mechanism
 * const attention = new RealLinearAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   seed: 42  // Optional: deterministic init for testing
 * });
 *
 * // Single vector attention
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Multi-sequence attention (O(N) complexity!)
 * const seqLen = 4;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealLinearAttention implements IAttentionMechanism {
    readonly name = "linear";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly eps;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize linear attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
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
     * ELU feature map: φ(x) = elu(x) + 1
     *
     * Ensures non-negative values for valid attention-like behavior.
     * The +1 ensures φ(x) > 0 for all x, which is required for the
     * kernel interpretation to hold.
     *
     * @param x Input value
     * @returns φ(x) = x + 1 if x > 0, else exp(x)
     */
    private featureMap;
    /**
     * Forward pass: Linear attention with O(N) complexity
     *
     * Algorithm:
     * 1. Project Q, K, V through learned weight matrices
     * 2. Apply feature map φ to Q and K
     * 3. For each head, compute:
     *    - S = φ(K)^T × V (key-value outer product, accumulated)
     *    - Z = sum(φ(K)) (normalizer)
     *    - output = (φ(Q) × S) / (φ(Q) · Z + ε)
     * 4. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension] (flattened)
     * @param key Key vectors [seq_len × dimension] (flattened)
     * @param value Value vectors [seq_len × dimension] (flattened)
     * @param mask Attention mask [seq_len × seq_len] (optional, for compatibility)
     *             Note: Causal masking in linear attention requires cumulative computation
     * @param seqLen Sequence length (optional, inferred from query.length if undefined)
     * @returns Output vectors [seq_len × dimension] (flattened)
     *
     * @throws Error if dimensions incompatible or contain NaN
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute linear attention for a single head
     *
     * Key insight: Instead of computing attention weights explicitly (O(N²)),
     * we use the associative property of matrix multiplication:
     *
     * Standard: output = softmax(QK^T) × V  [O(N²)]
     * Linear:   output = φ(Q) × (φ(K)^T × V) / (φ(Q) · sum(φ(K)))  [O(N)]
     *
     * For causal attention, we compute cumulative sums incrementally.
     *
     * @param qFeature Feature-mapped query [seq_len × dimension]
     * @param kFeature Feature-mapped key [seq_len × dimension]
     * @param V Projected value [seq_len × dimension]
     * @param head Head index
     * @param seqLen Sequence length
     * @param mask Optional attention mask (for causal computation)
     * @returns Head output [seq_len × headDim]
     */
    private computeHeadLinearAttention;
    /**
     * Check if mask is a causal (lower triangular) mask
     */
    private isCausalMask;
    /**
     * Check if any position in the mask row is attended
     */
    private checkMaskRow;
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
     */
    getParameterCount(): number;
}
//# sourceMappingURL=linear-attention.d.ts.map