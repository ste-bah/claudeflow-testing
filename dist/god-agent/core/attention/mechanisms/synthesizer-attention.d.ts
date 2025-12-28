/**
 * Synthesizer Attention Implementation
 *
 * Based on "Synthesizer: Rethinking Self-Attention for Transformer Models" (Tay et al., 2021)
 *
 * Key insight: Attention patterns can be synthesized directly through learned weights
 * rather than computed via Q·K dot products. This is useful when content-based attention
 * isn't necessary and can be more parameter-efficient.
 *
 * Algorithm (Dense Synthesizer):
 * 1. Project input through learned weights: H = ReLU(X · W1)
 * 2. Generate attention logits: A = H · W2
 * 3. Apply softmax: α = softmax(A)
 * 4. Weighted sum of values: output = α · V
 *
 * ANTI-009: All validation errors prefixed with ANTI-009
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface SynthesizerAttentionConfig {
    dimension?: number;
    numHeads?: number;
    maxSeqLen?: number;
    bottleneck?: number;
    seed?: number;
}
/**
 * Dense Synthesizer Attention
 *
 * Learns attention patterns directly through a two-layer network:
 * - W1: [dimension → bottleneck] - First projection
 * - W2: [bottleneck → maxSeqLen] - Second projection to attention logits
 *
 * Features:
 * - Content-independent attention synthesis
 * - Learned attention patterns
 * - More parameter-efficient than full Q·K attention for long sequences
 * - Deterministic with seed
 */
export declare class RealSynthesizerAttention implements IAttentionMechanism {
    readonly name = "synthesizer";
    private readonly dimension;
    private readonly numHeads;
    private readonly maxSeqLen;
    private readonly bottleneck;
    private readonly headDim;
    private readonly w1;
    private readonly w2;
    private readonly b1;
    private readonly b2;
    private readonly wv;
    private readonly wo;
    private readonly rng;
    constructor(config?: SynthesizerAttentionConfig);
    /**
     * Forward pass
     *
     * @param query - Input used for attention synthesis (shape: [seqLen * dimension])
     * @param key - Ignored in pure synthesizer (can be same as query)
     * @param value - Values to attend over (shape: [seqLen * dimension])
     * @param mask - Optional attention mask (shape: [seqLen])
     * @param seqLen - Sequence length (required)
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Synthesize attention patterns through learned network
     *
     * @param input - Input tensor (shape: [seqLen * dimension])
     * @param seqLen - Sequence length
     * @param headIdx - Head index
     * @param mask - Optional mask
     * @returns Attention weights (shape: [seqLen * seqLen])
     */
    private synthesizeAttention;
    /**
     * Stable softmax implementation
     */
    private softmax;
    /**
     * Project values for a single head
     */
    private projectValues;
    /**
     * Apply attention weights to values
     */
    private applyAttention;
    /**
     * Concatenate multi-head outputs
     */
    private concatenateHeads;
    /**
     * Project concatenated output
     */
    private projectOutput;
    /**
     * Get total parameter count
     *
     * Parameters per head:
     * - W1: dimension * bottleneck
     * - b1: bottleneck
     * - W2: bottleneck * maxSeqLen
     * - b2: maxSeqLen
     * - Wv: dimension * headDim
     *
     * Shared:
     * - Wo: dimension * dimension
     */
    getParameterCount(): number;
}
//# sourceMappingURL=synthesizer-attention.d.ts.map