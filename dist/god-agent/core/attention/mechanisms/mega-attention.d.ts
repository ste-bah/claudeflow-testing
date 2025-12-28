/**
 * MEGA (Moving Average Equipped Gated Attention)
 *
 * Reference: Ma et al. 2022 "MEGA: Moving Average Equipped Gated Attention"
 *
 * Combines Exponential Moving Average (EMA) with single-head gated attention:
 * - EMA provides efficient local context modeling: h_t = α × x_t + (1-α) × h_{t-1}
 * - Single-head attention captures global dependencies
 * - Gating mechanism blends local (EMA) and global (attention) features
 *
 * Complexity: O(N × d) for EMA + O(N²) for attention
 * Use case: Long sequences requiring both local smoothing and global context
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface MegaAttentionConfig {
    dimension?: number;
    numHeads?: number;
    emaAlpha?: number;
    seed?: number;
}
export declare class RealMegaAttention implements IAttentionMechanism {
    readonly name = "mega";
    private readonly dimension;
    private readonly numHeads;
    private readonly emaAlpha;
    private readonly headDim;
    private readonly W_q;
    private readonly W_k;
    private readonly W_v;
    private readonly W_o;
    private readonly W_gate;
    private readonly b_gate;
    private emaState;
    constructor(config?: MegaAttentionConfig);
    /**
     * Forward pass: EMA + Single-head Attention + Gating
     *
     * @param query - Query tensor (flattened, length seqLen * dimension)
     * @param key - Key tensor (flattened, length seqLen * dimension)
     * @param value - Value tensor (flattened, length seqLen * dimension)
     * @param mask - Optional attention mask (length seqLen)
     * @param seqLen - Sequence length (required)
     * @returns Output tensor (flattened, length seqLen * dimension)
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Apply Exponential Moving Average
     * h_t = α × x_t + (1-α) × h_{t-1}
     */
    private applyEMA;
    /**
     * Apply single-head attention (scaled dot-product)
     */
    private applySingleHeadAttention;
    /**
     * Compute gate values: sigmoid(W_gate × x + b_gate)
     */
    private computeGate;
    /**
     * Softmax over 2D matrix (row-wise)
     */
    private softmax2D;
    /**
     * Sigmoid activation: 1 / (1 + exp(-x))
     */
    private sigmoid;
    /**
     * Reset EMA state (call between independent sequences)
     */
    resetState(): void;
    /**
     * Count learnable parameters
     */
    getParameterCount(): number;
}
//# sourceMappingURL=mega-attention.d.ts.map