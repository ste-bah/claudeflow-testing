/**
 * Real Grouped-Query Attention Implementation
 *
 * Reference: Ainslie et al. 2023 "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints"
 * https://arxiv.org/abs/2305.13245
 *
 * Key insight: GQA is a generalization between MHA and MQA.
 * - MHA: numKVHeads = numHeads (each Q head has its own K,V)
 * - MQA: numKVHeads = 1 (all Q heads share single K,V)
 * - GQA: numKVHeads = G where 1 < G < numHeads (groups of Q heads share K,V)
 *
 * Trade-off: More KV heads = better quality, fewer KV heads = less memory/compute
 *
 * Memory: KV cache is O(numKVHeads × d × seq) vs O(numHeads × d × seq) for MHA
 *
 * Parameter Count: 2×dim² + 2×numKVHeads×headDim×dim
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Grouped-Query Attention Implementation
 *
 * Generalizes between MHA (numKVHeads=numHeads) and MQA (numKVHeads=1).
 * Groups of query heads share common key-value heads.
 *
 * @example
 * ```typescript
 * // Create GQA mechanism with 8 query heads and 2 KV heads
 * // (4 query heads per KV head)
 * const attention = new RealGroupedQueryAttention({
 *   dimension: 768,
 *   numHeads: 8,      // Query heads
 *   numKVHeads: 2,    // KV heads (must divide numHeads)
 *   seed: 42
 * });
 *
 * // Single vector attention
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Multi-sequence attention
 * const seqLen = 1024;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealGroupedQueryAttention implements IAttentionMechanism {
    readonly name = "grouped-query";
    private readonly dimension;
    private readonly numHeads;
    private readonly numKVHeads;
    private readonly headsPerGroup;
    private readonly headDim;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize Grouped-Query Attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of query heads (default: 8)
     * @param config.numKVHeads Number of key-value heads (default: 2)
     * @param config.seed Random seed for deterministic initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if numHeads not divisible by numKVHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        numKVHeads?: number;
        seed?: number;
    });
    /**
     * Forward pass: Grouped-Query Attention
     *
     * Algorithm:
     * 1. Project Q through full multi-head weights → [seq × dim]
     * 2. Project K, V through grouped-head weights → [seq × (numKVHeads × headDim)]
     * 3. For each query head:
     *    - Determine which KV head group it belongs to
     *    - Compute attention scores: Q_h × K_g^T (using group's K)
     *    - Apply softmax (with optional mask)
     *    - Weighted sum with V_g (using group's V)
     * 4. Concatenate heads and project output
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
     * Project input through grouped-head weight matrix
     *
     * @param input Input [seq × dim]
     * @param weights Weight matrix [dim × kvDim]
     * @param seqLen Sequence length
     * @param kvDim Output dimension (numKVHeads × headDim)
     * @returns Projected [seq × kvDim]
     */
    private projectGroupedHeads;
    /**
     * Compute attention for a single query head with grouped K,V
     *
     * @param Q Full projected queries [seq × dim]
     * @param K Grouped projected keys [seq × (numKVHeads × headDim)]
     * @param V Grouped projected values [seq × (numKVHeads × headDim)]
     * @param qHead Query head index
     * @param kvGroup KV group index (0 to numKVHeads-1)
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
     * GQA parameters:
     * - Q: dim × dim
     * - K: dim × (numKVHeads × headDim)
     * - V: dim × (numKVHeads × headDim)
     * - O: dim × dim
     *
     * Total: 2×dim² + 2×dim×numKVHeads×headDim
     *
     * @returns Parameter count
     */
    getParameterCount(): number;
}
//# sourceMappingURL=grouped-query-attention.d.ts.map