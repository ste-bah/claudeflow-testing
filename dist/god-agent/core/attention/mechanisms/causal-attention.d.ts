/**
 * Real Causal Attention Implementation
 *
 * Reference: Vaswani et al. 2017 "Attention Is All You Need"
 * https://arxiv.org/abs/1706.03762
 *
 * Key insight: Causal (autoregressive) attention restricts each position
 * to only attend to previous positions and itself. This is essential for
 * language models where future tokens must not influence current predictions.
 *
 * Causal Attention formula:
 *   CausalAttn(Q, K, V) = softmax(mask(Q·Kᵀ/√d)) · V
 *
 * Where mask sets positions j > i to -∞ before softmax, ensuring:
 *   attention_weights[i][j] = 0 for all j > i
 *
 * Use cases:
 * - GPT-style language models
 * - Autoregressive text generation
 * - Causal sequence modeling
 * - Decoder-only transformers
 *
 * Complexity: O(N²) but effectively O(N²/2) due to triangular mask
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Causal Attention Implementation
 *
 * Implements autoregressive attention where each position can only
 * attend to itself and previous positions (left-to-right masking).
 *
 * @example
 * ```typescript
 * // Create Causal attention for GPT-style model
 * const attention = new RealCausalAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   seed: 42
 * });
 *
 * // Process sequence autoregressively
 * const seqLen = 512;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * // Position 0 attends only to position 0
 * // Position 1 attends to positions 0, 1
 * // Position N attends to positions 0, 1, ..., N
 * ```
 */
export declare class RealCausalAttention implements IAttentionMechanism {
    readonly name = "causal";
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
     * Initialize Causal attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 12)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        seed?: number;
    });
    /**
     * Forward pass: Causal (autoregressive) attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. For each head, compute scaled dot-product attention with causal mask
     * 3. Apply -∞ mask to future positions (j > i)
     * 4. Softmax over valid positions only
     * 5. Weighted sum of values
     * 6. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional additional attention mask (combined with causal)
     * @param seqLen Sequence length (optional, inferred from query)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute causal attention for a single head
     *
     * The causal mask ensures position i can only attend to positions 0..i:
     *   mask[i][j] = -∞ if j > i, else 0
     *
     * This creates a lower-triangular attention pattern:
     *   [1 0 0 0]
     *   [1 1 0 0]
     *   [1 1 1 0]
     *   [1 1 1 1]
     */
    private computeHeadCausalAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Causal Attention: 4 × dim² (same as standard MHA)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=causal-attention.d.ts.map