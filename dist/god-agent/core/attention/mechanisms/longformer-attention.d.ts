/**
 * Real Longformer Attention Implementation
 *
 * Reference: Beltagy et al. 2020 "Longformer: The Long-Document Transformer"
 * https://arxiv.org/abs/2004.05150
 *
 * Key insight: Combine sliding window attention (local context) with global attention
 * (selected tokens attend to all positions). This achieves O(N × w) complexity where
 * w is the window size, instead of O(N²).
 *
 * Attention Pattern:
 * - Local: Each token attends to w tokens on each side (sliding window)
 * - Global: Selected tokens (e.g., [CLS], special markers) attend to ALL tokens
 *           and are attended to by ALL tokens
 *
 * Complexity: O(N × (w + g)) where w=window size, g=global tokens
 * Parameter Count: 4 × dim² (same as standard attention)
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Longformer Attention Implementation
 *
 * Combines sliding window local attention with global attention for
 * efficient long document processing.
 *
 * @example
 * ```typescript
 * // Create Longformer attention with window size 128
 * const attention = new RealLongformerAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   windowSize: 128,  // Each side
 *   globalIndices: [0],  // First token is global
 *   seed: 42
 * });
 *
 * // Process long sequence
 * const seqLen = 4096;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealLongformerAttention implements IAttentionMechanism {
    readonly name = "longformer";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly windowSize;
    private readonly globalIndices;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly wQueryGlobal;
    private readonly wKeyGlobal;
    private readonly wValueGlobal;
    private readonly rng?;
    /**
     * Initialize Longformer attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.windowSize One-sided window size (default: 64)
     * @param config.globalIndices Indices of global attention tokens (default: [0])
     * @param config.seed Random seed for deterministic initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if windowSize is not positive
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        windowSize?: number;
        globalIndices?: number[];
        seed?: number;
    });
    /**
     * Forward pass: Longformer attention with sliding window + global
     *
     * Algorithm:
     * 1. Project Q, K, V (local and global projections)
     * 2. For each position:
     *    a. If global token: compute full attention to all positions
     *    b. Else: compute sliding window attention + attend to global tokens
     * 3. Apply softmax and compute weighted values
     * 4. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask (combined with window pattern)
     * @param seqLen Sequence length (optional)
     * @returns Output vectors [seq_len × dimension]
     *
     * @throws Error if dimensions incompatible or contain NaN
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute Longformer attention for a single head
     *
     * Attention pattern:
     * - Global tokens (in globalIndices): Full attention to all positions
     * - Local tokens: Sliding window + attention to global tokens
     *
     * @param qLocal Local projected queries
     * @param kLocal Local projected keys
     * @param vLocal Local projected values
     * @param qGlobal Global projected queries
     * @param kGlobal Global projected keys
     * @param vGlobal Global projected values
     * @param head Head index
     * @param seqLen Sequence length
     * @param mask Optional attention mask
     * @returns Head output [seq × headDim]
     */
    private computeHeadLongformerAttention;
    /**
     * Compute full global attention for a global token
     */
    private computeGlobalAttention;
    /**
     * Compute local sliding window attention (+ global tokens)
     */
    private computeLocalAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Longformer uses 7 weight matrices:
     * - Local: Wq, Wk, Wv (3 × dim²)
     * - Global: Wq_global, Wk_global, Wv_global (3 × dim²)
     * - Output: Wo (dim²)
     *
     * Total: 7 × dim²
     */
    getParameterCount(): number;
}
//# sourceMappingURL=longformer-attention.d.ts.map