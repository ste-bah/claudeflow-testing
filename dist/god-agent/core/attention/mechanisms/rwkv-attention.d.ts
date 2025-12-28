/**
 * Real RWKV Attention Implementation
 *
 * Reference: Peng et al. 2023 "RWKV: Reinventing RNNs for the Transformer Era"
 * https://arxiv.org/abs/2305.13048
 *
 * Key insight: RWKV is a linear attention mechanism that combines:
 * - RNN-style recurrence for efficient inference
 * - Transformer-style parallelism for training
 * - Channel mixing and time mixing for expressiveness
 *
 * The RWKV formula (Time Mixing):
 * - r = sigmoid(x · w_r + state_r)  (Receptance)
 * - k = x · w_k                      (Key)
 * - v = x · w_v                      (Value)
 * - wkv = (exp(u + k) · v + state_wkv) / (exp(u + k) + state_num)
 * - output = r ⊙ wkv                 (Gate with receptance)
 *
 * State update:
 * - state_wkv' = exp(w) · state_wkv + exp(k) · v
 * - state_num' = exp(w) · state_num + exp(k)
 *
 * Complexity: O(N) time and space
 * Parameter Count: 4 × dim² + 2 × dim
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real RWKV Attention Implementation
 *
 * Implements Receptance Weighted Key Value attention with linear complexity.
 * Provides both parallel (training) and sequential (inference) modes.
 *
 * @example
 * ```typescript
 * // Create RWKV attention
 * const attention = new RealRWKVAttention({
 *   dimension: 768,
 *   numLayers: 12,
 *   seed: 42
 * });
 *
 * // Process sequence with O(N) complexity
 * const seqLen = 16384;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealRWKVAttention implements IAttentionMechanism {
    readonly name = "rwkv";
    private readonly dimension;
    private readonly wReceptance;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly timeDecay;
    private readonly timeFirst;
    private readonly timeMix;
    private readonly rng?;
    /**
     * Initialize RWKV attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension < 1
     */
    constructor(config?: {
        dimension?: number;
        seed?: number;
    });
    /**
     * Project input through weight matrix
     */
    private project;
    /**
     * Sigmoid activation
     */
    private sigmoid;
    /**
     * RWKV Time Mixing (WKV computation)
     *
     * Computes the weighted key-value aggregation with exponential decay.
     * Uses numerically stable formulation to prevent overflow.
     */
    private computeWKV;
    /**
     * Forward pass: RWKV Time Mixing
     *
     * Algorithm:
     * 1. Apply token shift (mix current with previous)
     * 2. Compute r, k, v projections
     * 3. Compute WKV (weighted key-value) with recurrence
     * 4. Gate output with receptance
     * 5. Project to output dimension
     *
     * Note: In RWKV, query/key/value are computed internally from input.
     * We use query as the input; key/value parameters are for compatibility.
     *
     * @param query Input vectors [seq_len × dimension] (main input)
     * @param _key Ignored (for interface compatibility)
     * @param _value Ignored (for interface compatibility)
     * @param _mask Ignored (RWKV is naturally causal)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, _key: Float32Array, _value: Float32Array, _mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Get total parameter count
     *
     * RWKV parameters:
     * - wReceptance: dim × dim
     * - wKey: dim × dim
     * - wValue: dim × dim
     * - wOutput: dim × dim
     * - timeDecay: dim
     * - timeFirst: dim
     * - timeMix: dim
     */
    getParameterCount(): number;
}
//# sourceMappingURL=rwkv-attention.d.ts.map