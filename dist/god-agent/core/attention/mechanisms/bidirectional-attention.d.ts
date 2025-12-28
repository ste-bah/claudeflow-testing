/**
 * Real Bidirectional Attention Implementation
 *
 * Reference: Devlin et al. 2019 "BERT: Pre-training of Deep Bidirectional Transformers"
 * https://arxiv.org/abs/1810.04805
 *
 * Key insight: Bidirectional attention allows each position to attend to
 * ALL other positions in the sequence (both left and right context).
 * This is the standard self-attention used in encoder models like BERT.
 *
 * Bidirectional Attention formula:
 *   BiAttn(Q, K, V) = softmax(Q·Kᵀ / √d) · V
 *
 * Unlike causal attention, there is no mask preventing attention to future
 * positions. Every position can attend to every other position.
 *
 * Use cases:
 * - BERT-style encoders
 * - Masked language modeling
 * - Sentence classification
 * - Named entity recognition
 * - Question answering (context encoding)
 *
 * Complexity: O(N²)
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Bidirectional Attention Implementation
 *
 * Implements full self-attention where each position can attend to
 * all other positions (both past and future).
 *
 * @example
 * ```typescript
 * // Create Bidirectional attention for BERT-style encoding
 * const attention = new RealBidirectionalAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   seed: 42
 * });
 *
 * // Process sequence with full context
 * const seqLen = 512;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * // Every position attends to every other position
 * ```
 */
export declare class RealBidirectionalAttention implements IAttentionMechanism {
    readonly name = "bidirectional";
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
     * Initialize Bidirectional attention mechanism
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
     * Forward pass: Bidirectional (full) attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. For each head, compute scaled dot-product attention (NO causal mask)
     * 3. Each position attends to all other positions
     * 4. Softmax over all positions
     * 5. Weighted sum of values
     * 6. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask (e.g., padding mask)
     * @param seqLen Sequence length (optional, inferred from query)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute bidirectional attention for a single head
     *
     * Unlike causal attention, there is NO positional mask.
     * Every position i attends to every position j (full N×N attention).
     */
    private computeHeadBidirectionalAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Bidirectional Attention: 4 × dim² (same as standard MHA)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=bidirectional-attention.d.ts.map