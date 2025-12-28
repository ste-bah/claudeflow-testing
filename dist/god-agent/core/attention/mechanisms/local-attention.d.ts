/**
 * Real Local Attention Implementation
 *
 * Reference: Longformer (Beltagy et al. 2020) "Longformer: The Long-Document Transformer"
 * https://arxiv.org/abs/2004.05150
 *
 * Key insight: Local attention restricts each position to attend only to
 * a fixed-size window of neighboring positions. This reduces complexity
 * from O(N²) to O(N × W) where W is the window size.
 *
 * Local Attention formula:
 *   LocalAttn(Q, K, V)[i] = softmax(Q[i] · K[i-w:i+w]ᵀ / √d) · V[i-w:i+w]
 *
 * Where w is the half-window size and each position only attends to
 * positions within distance w (both left and right).
 *
 * Use cases:
 * - Long document processing
 * - Efficient sequence modeling
 * - When local context is most important
 * - Combined with global attention (Longformer pattern)
 *
 * Complexity: O(N × W) where W is window size
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Local Attention Implementation
 *
 * Implements windowed attention where each position attends only to
 * its local neighborhood within a fixed window size.
 *
 * @example
 * ```typescript
 * // Create Local attention with window size 128
 * const attention = new RealLocalAttention({
 *   dimension: 768,
 *   numHeads: 12,
 *   windowSize: 128,  // Each position attends to 128 positions total
 *   seed: 42
 * });
 *
 * // Process long sequence efficiently
 * const seqLen = 4096;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * // Complexity: O(4096 × 128) instead of O(4096²)
 * ```
 */
export declare class RealLocalAttention implements IAttentionMechanism {
    readonly name = "local";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly windowSize;
    private readonly halfWindow;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng?;
    /**
     * Initialize Local attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: 768)
     * @param config.numHeads Number of attention heads (default: 12)
     * @param config.windowSize Total window size (default: 64)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        windowSize?: number;
        seed?: number;
    });
    /**
     * Forward pass: Local (windowed) attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. For each position, compute attention only within local window
     * 3. Window boundaries: [max(0, i-halfWindow), min(seqLen, i+halfWindow+1)]
     * 4. Apply softmax over window positions
     * 5. Weighted sum of values in window
     * 6. Concatenate heads and project output
     *
     * @param query Query vectors [seq_len × dimension]
     * @param key Key vectors [seq_len × dimension]
     * @param value Value vectors [seq_len × dimension]
     * @param mask Optional attention mask
     * @param seqLen Sequence length (optional, inferred from query)
     * @returns Output vectors [seq_len × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute local attention for a single head
     *
     * Each position i attends only to positions in window:
     *   [max(0, i - halfWindow), min(seqLen-1, i + halfWindow)]
     *
     * This creates a banded attention pattern instead of full N×N.
     */
    private computeHeadLocalAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get the configured window size
     */
    getWindowSize(): number;
    /**
     * Get total parameter count
     *
     * Local Attention: 4 × dim² (same as standard MHA)
     */
    getParameterCount(): number;
}
//# sourceMappingURL=local-attention.d.ts.map