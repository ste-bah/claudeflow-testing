/**
 * Real Cross Attention Implementation
 *
 * Reference: Vaswani et al. 2017 "Attention Is All You Need"
 * https://arxiv.org/abs/1706.03762 (Section 3.2.3)
 *
 * Key insight: Cross attention allows a decoder to attend to encoder outputs,
 * enabling information flow between different sequences or modalities.
 *
 * Cross Attention formula:
 *   CrossAttn(Q_dec, K_enc, V_enc) = softmax(Q_dec · K_enc^T / √d) · V_enc
 *
 * Where:
 * - Q comes from decoder (query sequence)
 * - K, V come from encoder (context sequence)
 *
 * Use cases:
 * - Encoder-decoder models (translation, summarization)
 * - Vision-language models (image captioning)
 * - Multi-modal fusion
 *
 * Complexity: O(N_q × N_kv) where N_q is query length, N_kv is context length
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Cross Attention Implementation
 *
 * Implements encoder-decoder cross attention for information flow
 * between different sequences.
 *
 * @example
 * ```typescript
 * // Create Cross attention
 * const attention = new RealCrossAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   seed: 42
 * });
 *
 * // Decoder attending to encoder outputs
 * const decoderLen = 32;
 * const encoderLen = 128;
 * const query = new Float32Array(decoderLen * 768);   // From decoder
 * const key = new Float32Array(encoderLen * 768);     // From encoder
 * const value = new Float32Array(encoderLen * 768);   // From encoder
 * const output = attention.forward(query, key, value);
 * ```
 */
export declare class RealCrossAttention implements IAttentionMechanism {
    readonly name = "cross";
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
     * Initialize Cross attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of attention heads (default: 8)
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
     * Forward pass: Cross attention
     *
     * Unlike self-attention, Q comes from one sequence while K,V come from another.
     * This allows attending from decoder to encoder outputs.
     *
     * @param query Query vectors [query_len × dimension] - from decoder
     * @param key Key vectors [context_len × dimension] - from encoder
     * @param value Value vectors [context_len × dimension] - from encoder
     * @param mask Optional attention mask for context positions
     * @param seqLen Query sequence length (optional, inferred from query)
     * @returns Output vectors [query_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute cross attention for a single head
     *
     * Each query position attends to all context (encoder) positions
     */
    private computeHeadCrossAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Cross Attention: 4 × dim²
     */
    getParameterCount(): number;
}
//# sourceMappingURL=cross-attention.d.ts.map