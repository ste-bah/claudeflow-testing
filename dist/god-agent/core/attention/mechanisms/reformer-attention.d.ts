/**
 * Real Reformer Attention Implementation (LSH Attention)
 *
 * Reference: Kitaev et al. 2020 "Reformer: The Efficient Transformer"
 * https://arxiv.org/abs/2001.04451
 *
 * Key insight: Use Locality-Sensitive Hashing (LSH) to find similar queries
 * and keys, reducing attention from O(N²) to O(N log N) or better.
 *
 * LSH works by:
 * 1. Hash Q and K using random projections
 * 2. Only compute attention within same hash buckets
 * 3. Keys similar to queries will hash to same bucket with high probability
 *
 * Additionally, Reformer uses:
 * - Shared Q/K (reduces memory)
 * - Reversible residual layers (not implemented here - attention only)
 *
 * Complexity: O(N × log N × d) for attention
 * Parameter Count: 4 × dim² + hash projections
 *
 * ANTI-009: This is a REAL implementation, not a placeholder.
 */
import { IAttentionMechanism } from '../attention-types.js';
/**
 * Real Reformer Attention Implementation
 *
 * Implements Locality-Sensitive Hashing attention for efficient
 * long-sequence processing with O(N log N) complexity.
 *
 * @example
 * ```typescript
 * // Create Reformer attention
 * const attention = new RealReformerAttention({
 *   dimension: 768,
 *   numHeads: 8,
 *   numHashBuckets: 64,
 *   numHashRounds: 4,
 *   seed: 42
 * });
 *
 * // Process long sequence efficiently
 * const seqLen = 16384;
 * const query = new Float32Array(seqLen * 768);
 * const output = attention.forward(query, query, query, undefined, seqLen);
 * ```
 */
export declare class RealReformerAttention implements IAttentionMechanism {
    readonly name = "reformer";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly numHashBuckets;
    private readonly numHashRounds;
    private readonly scale;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    private readonly hashProjections;
    private readonly rng?;
    /**
     * Initialize Reformer attention mechanism
     *
     * @param config Configuration options
     * @param config.dimension Model dimension (default: VECTOR_DIM=1536)
     * @param config.numHeads Number of attention heads (default: 8)
     * @param config.numHashBuckets Number of hash buckets (default: 64)
     * @param config.numHashRounds Number of hashing rounds (default: 4)
     * @param config.seed Random seed for initialization (optional)
     *
     * @throws Error if dimension not divisible by numHeads
     * @throws Error if numHashBuckets is not even
     */
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        numHashBuckets?: number;
        numHashRounds?: number;
        seed?: number;
    });
    /**
     * Compute LSH hash for a vector
     *
     * Uses angular LSH: hash(x) = sign(R · x)
     * Returns bucket indices for multiple rounds
     */
    private computeHash;
    /**
     * Forward pass: Reformer LSH attention
     *
     * Algorithm:
     * 1. Project Q, K, V through linear transformations
     * 2. Hash Q and K using LSH
     * 3. For each hash round, compute attention within buckets
     * 4. Average results across rounds
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
     * Compute LSH attention for a single head
     *
     * For each hash round:
     * 1. Hash all positions
     * 2. Sort by hash value
     * 3. Attend within sorted chunks
     */
    private computeHeadLSHAttention;
    /**
     * Concatenate multiple head outputs
     */
    private concatenateHeads;
    /**
     * Get total parameter count
     *
     * Reformer: 4 × dim² + LSH projections
     */
    getParameterCount(): number;
}
//# sourceMappingURL=reformer-attention.d.ts.map