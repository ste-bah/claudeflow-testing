/**
 * AFT (Attention Free Transformer) Mechanism
 *
 * Reference: Zhai et al. 2021 "An Attention Free Transformer"
 * https://arxiv.org/abs/2105.14103
 *
 * Key Innovation:
 * - Replaces dot-product attention with element-wise operations
 * - Uses learned position-wise biases instead of Q·K^T
 * - Linear complexity O(N × d) instead of quadratic O(N^2 × d)
 *
 * Formula:
 * output_i = σ(Q_i) ⊙ Σ_j exp(K_j + w_{i,j}) × V_j / Σ_j exp(K_j + w_{i,j})
 *
 * Where:
 * - σ is sigmoid activation
 * - w_{i,j} is learned position bias
 * - ⊙ is element-wise multiplication
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface AFTAttentionConfig {
    dimension?: number;
    numHeads?: number;
    maxSeqLen?: number;
    seed?: number;
}
/**
 * AFT (Attention Free Transformer) Attention Mechanism
 *
 * Replaces quadratic dot-product attention with linear element-wise operations
 * using learned position biases.
 */
export declare class RealAFTAttention implements IAttentionMechanism {
    readonly name = "aft";
    private dimension;
    private numHeads;
    private maxSeqLen;
    private headDim;
    private positionBias;
    constructor(config?: AFTAttentionConfig);
    /**
     * Forward pass of AFT attention
     *
     * @param query - Query vectors [seqLen × dimension]
     * @param key - Key vectors [seqLen × dimension]
     * @param value - Value vectors [seqLen × dimension]
     * @param mask - Optional boolean mask [seqLen] (true = keep, false = mask)
     * @param seqLen - Sequence length (inferred if not provided)
     * @returns Attention output [seqLen × dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Get total number of learnable parameters
     */
    getParameterCount(): number;
    /**
     * Sigmoid activation: σ(x) = 1 / (1 + exp(-x))
     */
    private sigmoid;
    /**
     * Safe exponential with clipping to prevent overflow
     */
    private safeExp;
    /**
     * Validate input tensors
     */
    private validateInputs;
}
//# sourceMappingURL=aft-attention.d.ts.map