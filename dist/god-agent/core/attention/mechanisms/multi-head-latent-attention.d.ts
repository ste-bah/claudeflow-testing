/**
 * Multi-Head Latent Attention Mechanism
 *
 * Based on DeepMind's Perceiver architecture concept.
 * Uses learned latent queries to compress variable-length inputs
 * into fixed-size representations.
 *
 * Algorithm:
 * 1. Maintain learned latent array L [numLatents × dimension]
 * 2. Cross-attention: output = Attention(L, input, input)
 * 3. Latent queries attend to all input positions
 * 4. Output is fixed-size regardless of input length
 *
 * Complexity: O(L × N) where L = latent size (fixed, small)
 *
 * @module attention/mechanisms/multi-head-latent-attention
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface MultiHeadLatentAttentionConfig {
    dimension?: number;
    numHeads?: number;
    numLatents?: number;
    seed?: number;
}
export declare class RealMultiHeadLatentAttention implements IAttentionMechanism {
    readonly name = "multi-head-latent";
    private readonly dimension;
    private readonly numHeads;
    private readonly numLatents;
    private readonly headDim;
    private readonly seed;
    private readonly latentQueries;
    private readonly Wq;
    private readonly Wk;
    private readonly Wv;
    private readonly Wo;
    constructor(config?: MultiHeadLatentAttentionConfig);
    /**
     * Forward pass: cross-attention from latent queries to input
     *
     * @param query - Unused in pure latent mode (latent queries are learned)
     * @param key - Input sequence to attend to [seqLen × dimension]
     * @param value - Input sequence values [seqLen × dimension]
     * @param mask - Optional attention mask [seqLen]
     * @param seqLen - Sequence length
     * @returns Fixed-size output [numLatents × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Get total trainable parameter count
     */
    getParameterCount(): number;
}
//# sourceMappingURL=multi-head-latent-attention.d.ts.map