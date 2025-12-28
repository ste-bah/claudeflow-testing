/**
 * Real Global Attention Implementation
 *
 * Reference: Longformer (Beltagy et al. 2020)
 * "Longformer: The Long-Document Transformer"
 *
 * Global positions attend to ALL positions, and ALL positions attend to globals.
 * Used for [CLS] tokens, question tokens, or summary positions.
 *
 * Use cases:
 * - Document classification (global [CLS])
 * - Question answering (global question tokens)
 * - Summarization (global summary token)
 *
 * Complexity: O(G × N) where G is number of global tokens
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: REAL implementation (no mocks, no fake attention)
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Global Attention Implementation
 *
 * @example
 * ```typescript
 * // Create global attention with 1 global token ([CLS])
 * const attention = new RealGlobalAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   numGlobalTokens: 1,  // First position is global
 *   seed: 42
 * });
 *
 * // Single vector (1 global token)
 * const query = new Float32Array(768);
 * const output = attention.forward(query, query, query);
 *
 * // Sequence with global tokens
 * const seqLen = 512;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 *
 * // With mask
 * const mask = new Array(seqLen * seqLen).fill(true);
 * const output = attention.forward(query, query, query, mask, seqLen);
 * ```
 */
export declare class RealGlobalAttention implements IAttentionMechanism {
    readonly name = "global";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly numGlobalTokens;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize global attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 12)
     * @param config.numGlobalTokens Number of global positions (default: 1)
     * @param config.seed Random seed for deterministic initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if numGlobalTokens < 1
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        numGlobalTokens?: number;
        seed?: number;
    });
    /**
     * Forward pass: Global attention computation
     *
     * Algorithm:
     * 1. For global positions (0 to G-1):
     *    - Compute full attention to ALL positions
     * 2. For regular positions (G to N-1):
     *    - Only attend to global positions (0 to G-1)
     * 3. This creates asymmetric attention pattern
     *
     * @param query Query vectors [seq_len × dimension] (flattened)
     * @param key Key vectors [seq_len × dimension] (flattened)
     * @param value Value vectors [seq_len × dimension] (flattened)
     * @param mask Attention mask [seq_len × seq_len] (flattened row-major, optional)
     *             Semantics: true=attend, false=mask out (PyTorch convention)
     * @param seqLen Sequence length (optional, inferred from query.length if undefined)
     * @returns Output vectors [seq_len × dimension] (flattened)
     *
     * @throws Error if dimensions incompatible or contain NaN
     * @throws Error if numGlobalTokens >= seqLen
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute attention for a single head with global pattern
     *
     * Global Pattern:
     * - Positions [0, G-1] attend to ALL positions [0, N-1]
     * - Positions [G, N-1] attend ONLY to global positions [0, G-1]
     *
     * This creates an asymmetric attention matrix:
     * ```
     *     k0  k1  k2  k3  k4  k5
     * q0  ✓   ✓   ✓   ✓   ✓   ✓    (global: attends to all)
     * q1  ✓   ✓   ✓   ✓   ✓   ✓    (global: attends to all)
     * q2  ✓   ✓   -   -   -   -    (regular: attends only to global)
     * q3  ✓   ✓   -   -   -   -
     * q4  ✓   ✓   -   -   -   -
     * q5  ✓   ✓   -   -   -   -
     * ```
     *
     * Algorithm:
     * 1. Compute scaled dot-product scores: (Q·K^T) / √d_k
     * 2. Apply global pattern mask:
     *    - Global positions: allow all
     *    - Regular positions: mask out non-global positions
     * 3. Apply user-provided mask (if any)
     * 4. Apply softmax normalization
     * 5. Compute weighted sum: weights · V
     *
     * @param Q Projected query [seq_len × dimension]
     * @param K Projected key [seq_len × dimension]
     * @param V Projected value [seq_len × dimension]
     * @param head Head index
     * @param seqLen Sequence length
     * @param mask Optional attention mask
     * @returns Head output [seq_len × headDim]
     */
    private computeHeadAttention;
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
     *
     * @example
     * ```typescript
     * const attention = new RealGlobalAttention({ dimension: 768 });
     * console.log(attention.getParameterCount()); // 2,359,296
     * ```
     */
    getParameterCount(): number;
}
//# sourceMappingURL=global-attention.d.ts.map