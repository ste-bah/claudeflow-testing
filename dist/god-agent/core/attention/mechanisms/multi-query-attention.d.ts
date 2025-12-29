/**
 * Real Multi-Query Attention Implementation
 *
 * Reference: Shazeer 2019 "Fast Transformer Decoding: One Write-Head is All You Need"
 * https://arxiv.org/abs/1911.02150
 *
 * Key Innovation: SHARED K,V projections across ALL heads
 * - Standard MHA: numHeads × (Wq, Wk, Wv) + Wo
 * - Multi-Query: numHeads × Wq + 1 × Wk + 1 × Wv + Wo
 *
 * Benefits:
 * - Reduces KV cache memory by numHeads× during inference
 * - 46% fewer parameters (dim=768, heads=12)
 * - Faster decoding with minimal quality loss
 *
 * Formula:
 * MQA(Q, K, V) = Concat(head_1, ..., head_h) × Wo
 * where head_i = Attention(Q × Wq_i, K × Wk_shared, V × Wv_shared)
 *
 * Parameter Count: (numHeads + 2) × dim × headDim + dim²
 *
 * ANTI-009: REAL implementation with proper shared projections
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Multi-Query Attention Implementation
 *
 * Uses single shared K,V head across all query heads for memory efficiency.
 *
 * @example
 * ```typescript
 * // Create MQA mechanism
 * const attention = new RealMultiQueryAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   seed: 42  // Optional: deterministic init for testing
 * });
 *
 * // Single vector attention
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Multi-sequence attention (memory efficient!)
 * const seqLen = 1024;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealMultiQueryAttention implements IAttentionMechanism {
    readonly name = "multi-query";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly wQueries;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize Multi-Query Attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of query heads (default: 8)
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
     * Forward pass: Multi-Query Attention
     *
     * Algorithm:
     * 1. Project K, V through SHARED single-head weights → [seq × headDim]
     * 2. For each query head:
     *    - Project Q through per-head weights → [seq × headDim]
     *    - Compute attention scores: Q_h × K^T (shared K)
     *    - Apply softmax (with optional mask)
     *    - Weighted sum with V (shared V)
     * 3. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Attention mask [seq_len × seq_len] (optional)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     *
     * @throws Error if dimensions incompatible or contain NaN
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Project input through single-head weight matrix
     *
     * @param input Input [seq × dim]
     * @param weights Weight matrix [dim × headDim]
     * @param seqLen Sequence length
     * @returns Projected [seq × headDim]
     */
    private projectSingleHead;
    /**
     * Compute attention for a single query head with shared K,V
     *
     * @param Q Projected queries for this head [seq × headDim]
     * @param K Shared projected keys [seq × headDim]
     * @param V Shared projected values [seq × headDim]
     * @param seqLen Sequence length
     * @param mask Optional attention mask
     * @returns Head output [seq × headDim]
     */
    private computeHeadAttention;
    /**
     * Concatenate multiple head outputs
     *
     * @param headOutputs Array of head outputs [seq × headDim]
     * @param seqLen Sequence length
     * @returns Concatenated output [seq × dim]
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * MQA has fewer parameters than standard attention:
     * - Q: numHeads × (dim × headDim) per-head projections
     * - K: dim × headDim (SHARED single head)
     * - V: dim × headDim (SHARED single head)
     * - O: dim × dim
     *
     * Total: (numHeads + 2) × dim × headDim + dim²
     *
     * For dim=768, numHeads=12, headDim=64:
     * - Standard MHA: 4 × 768² = 2,359,296
     * - MQA: (12+2) × 768 × 64 + 768² = 1,277,952 (46% fewer)
     *
     * @returns Parameter count
     */
    getParameterCount(): number;
}
//# sourceMappingURL=multi-query-attention.d.ts.map