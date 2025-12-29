/**
 * Real Retentive Network Attention Implementation
 *
 * Reference: Sun et al. 2023 "Retentive Network: A Successor to Transformer for Large Language Models"
 * https://arxiv.org/abs/2307.08621
 *
 * Key insight: Replace softmax attention with a retention mechanism that
 * supports parallel training and efficient O(1) inference through recurrence.
 *
 * Retention formula:
 *   Retention(X) = (QK^T ⊙ D) V
 *   where D is a decay matrix: D_nm = γ^(n-m) for n >= m, 0 otherwise
 *
 * Key innovations:
 * - Multi-scale retention with different decay rates per head
 * - Parallel mode for training (full matrix)
 * - Recurrent mode for inference (O(1) per step)
 * - Chunk mode for balance
 *
 * This implementation focuses on parallel mode with decay mask.
 *
 * Complexity: O(N²) for training, O(1) for inference (recurrent mode)
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Retentive Network Attention Implementation
 *
 * Implements retention mechanism with exponential decay for efficient
 * sequence modeling.
 *
 * @example
 * ```typescript
 * // Create RetNet attention
 * const attention = new RealRetentiveAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   seed: 42
 * });
 *
 * // Process sequence with retention
 * const seqLen = 1024;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealRetentiveAttention implements IAttentionMechanism {
    readonly name = "retentive";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly gammas;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly groupNormGamma;
    private readonly groupNormBeta;
    private readonly rng?;
    /**
     * Initialize Retentive attention mechanism
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
     * Apply group normalization to head output
     */
    private groupNorm;
    /**
     * Forward pass: Retentive Network attention (parallel mode)
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. For each head, compute retention with decay mask
     * 3. Apply group normalization
     * 4. Project output
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
     * Compute retention for a single head
     *
     * Retention(X) = (QK^T ⊙ D) V
     * where D_nm = γ^(n-m) for n >= m, 0 otherwise (causal)
     */
    private computeHeadRetention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * RetNet: 4 × dim² + 2 × headDim (group norm)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=retentive-attention.d.ts.map