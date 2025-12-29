/**
 * Real BigBird Attention Implementation
 *
 * Reference: Zaheer et al. 2020 "Big Bird: Transformers for Longer Sequences"
 * https://arxiv.org/abs/2007.14062
 *
 * Key insight: Combine three attention patterns for O(N) complexity:
 * 1. Random attention: Each token attends to r random tokens
 * 2. Window attention: Each token attends to w/2 tokens on each side
 * 3. Global attention: Selected tokens attend to/from all positions
 *
 * The combination of these patterns approximates full attention while
 * maintaining linear complexity.
 *
 * Complexity: O(N × (r + w + g)) where r=random, w=window, g=global
 * Parameter Count: 4 × dim² (same as standard attention)
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real BigBird Attention Implementation
 *
 * Combines random, window, and global attention patterns for
 * efficient long sequence processing.
 *
 * @example
 * ```typescript
 * // Create BigBird attention
 * const attention = new RealBigBirdAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   windowSize: 64,    // Local window
 *   numRandomBlocks: 3, // Random attention blocks
 *   globalIndices: [0], // Global tokens
 *   seed: 42
 * });
 *
 * // Process long sequence
 * const seqLen = 4096;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealBigBirdAttention implements IAttentionMechanism {
    readonly name = "bigbird";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly windowSize;
    private readonly numRandomBlocks;
    private readonly globalIndices;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly rng;
    /**
     * Initialize BigBird attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.windowSize One-sided window size (default: 64)
     * @param config.numRandomBlocks Number of random attention blocks (default: 3)
     * @param config.globalIndices Indices of global attention tokens (default: [0])
     * @param config.seed Random seed for initialization and random patterns
     *
     * @throws Error if dimension not divisible by numHeads
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        windowSize?: number;
        numRandomBlocks?: number;
        globalIndices?: number[];
        seed?: number;
    });
    /**
     * Forward pass: BigBird attention with random + window + global patterns
     *
     * Algorithm:
     * 1. Project Q, K, V through learned weight matrices
     * 2. For each position, determine attention pattern:
     *    - Global tokens: attend to all
     *    - Others: window + random + global tokens
     * 3. Apply softmax and compute weighted values
     * 4. Concatenate heads and project output
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
     * Generate random attention patterns for each position
     *
     * For each position i, generates numRandomBlocks random positions
     * that i will attend to (excluding window and global positions).
     */
    private generateRandomPatterns;
    /**
     * Compute BigBird attention for a single head
     */
    private computeHeadBigBirdAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * BigBird uses standard 4 weight matrices: 4 × dim²
     */
    getParameterCount(): number;
}
//# sourceMappingURL=bigbird-attention.d.ts.map