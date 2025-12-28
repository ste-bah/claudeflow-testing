/**
 * Real Linformer Attention Implementation
 *
 * Reference: Wang et al. 2020 "Linformer: Self-Attention with Linear Complexity"
 * https://arxiv.org/abs/2006.04768
 *
 * Key insight: Approximate the full N×N attention matrix with a low-rank
 * projection, reducing complexity from O(N²) to O(N×k) where k << N.
 *
 * The key observation is that the attention matrix is often low-rank,
 * so we can project K and V to a lower dimension:
 *
 * Original: softmax(Q·K^T/√d)·V
 * Linformer: softmax(Q·(E·K)^T/√d)·(F·V)
 *
 * Where E, F ∈ ℝ^{k×N} are learned projections that compress the sequence.
 *
 * Complexity: O(N × k × d) where k is the projected dimension
 * Parameter Count: 4 × dim² + 2 × k × dim (projection matrices)
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Linformer Attention Implementation
 *
 * Implements low-rank self-attention for O(N) complexity.
 *
 * @example
 * ```typescript
 * // Create Linformer attention
 * const attention = new RealLinformerAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   projectedDim: 256,  // k - projected sequence length
 *   maxSeqLen: 4096,
 *   seed: 42
 * });
 *
 * // Process long sequence efficiently
 * const seqLen = 4096;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealLinformerAttention implements IAttentionMechanism {
    readonly name = "linformer";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly projectedDim;
    private readonly maxSeqLen;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly projE;
    private readonly projF;
    private readonly rng?;
    /**
     * Initialize Linformer attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.projectedDim Projected sequence dimension k (default: 256)
     * @param config.maxSeqLen Maximum sequence length (default: 512)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if projectedDim > maxSeqLen
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        projectedDim?: number;
        maxSeqLen?: number;
        seed?: number;
    });
    /**
     * Project sequence through low-rank projection matrix
     * [seqLen × dim] × [seqLen × k]^T = [k × dim]
     */
    private projectSequence;
    /**
     * Forward pass: Linformer low-rank attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. Project K, V through low-rank projections (E, F)
     * 3. Compute attention: softmax(Q·(E·K)^T/√d)·(F·V)
     * 4. Project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask (ignored in low-rank approximation)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute Linformer attention for a single head
     */
    private computeHeadLinformerAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Linformer: 4 × dim² + 2 × maxSeqLen × projectedDim
     */
    getParameterCount(): number;
}
//# sourceMappingURL=linformer-attention.d.ts.map