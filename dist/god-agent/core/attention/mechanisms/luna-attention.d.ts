/**
 * Luna (Linear Unified Nested Attention) Mechanism
 *
 * Reference: Ma et al. 2021 "Luna: Linear Unified Nested Attention"
 *
 * Key Innovation:
 * - Uses fixed-length projected context (P) to achieve linear complexity
 * - Two-stage attention: pack sequence into P, then unpack back to sequence
 * - Complexity: O(N × P) where P << N (e.g., P=64, N=1024)
 *
 * Algorithm:
 * 1. Pack: P = softmax(Wp × X) × X  [N → P projection]
 * 2. Unpack: output = softmax(X × P^T) × P [P → N attention]
 *
 * @module attention/mechanisms/luna-attention
 */
import type { IAttentionMechanism } from '../attention-types.js';
/**
 * Configuration for Luna Attention
 */
export interface LunaAttentionConfig {
    /** Model dimension (default: 768) */
    dimension?: number;
    /** Number of attention heads (default: 12) */
    numHeads?: number;
    /** Projected context length P (default: 64) */
    projectedLength?: number;
    /** Random seed for reproducibility */
    seed?: number;
}
/**
 * Real Luna Attention Implementation
 *
 * Implements packed attention with linear complexity O(N × P).
 * Uses fixed-length projected context to compress sequence information.
 */
export declare class RealLunaAttention implements IAttentionMechanism {
    readonly name = "luna";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly projectedLength;
    private readonly scale;
    private readonly packProjection;
    private readonly wq;
    private readonly wk;
    private readonly wv;
    private readonly wo;
    constructor(config?: LunaAttentionConfig);
    /**
     * Forward pass: Luna two-stage attention
     *
     * Stage 1 (Pack): Project sequence to fixed-length context
     * Stage 2 (Unpack): Attend from sequence to packed context
     *
     * @param query - Query vectors [seqLen * dimension]
     * @param key - Key vectors [seqLen * dimension]
     * @param value - Value vectors [seqLen * dimension]
     * @param mask - Optional attention mask [seqLen]
     * @param seqLen - Sequence length
     * @returns Attention output [seqLen * dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compute pack scores: Wp × K → [P, N]
     *
     * @param K - Key matrix [N, D]
     * @param N - Sequence length
     * @param mask - Optional mask [N]
     * @returns Pack attention scores [P, N]
     */
    private computePackScores;
    /**
     * Apply pack scores to values: scores × V → [P, D]
     *
     * @param scores - Pack scores [P, N]
     * @param V - Value matrix [N, D]
     * @param N - Sequence length
     * @returns Packed context [P, D]
     */
    private applyPackScores;
    /**
     * Compute unpack scores: Q × P^T → [N, P]
     *
     * @param Q - Query matrix [N, D]
     * @param P - Packed context [P, D]
     * @param N - Sequence length
     * @returns Unpack attention scores [N, P]
     */
    private computeUnpackScores;
    /**
     * Apply unpack scores to packed context: scores × P → [N, D]
     *
     * @param scores - Unpack scores [N, P]
     * @param P - Packed context [P, D]
     * @param N - Sequence length
     * @returns Attended output [N, D]
     */
    private applyUnpackScores;
    /**
     * In-place stable softmax with optional masking
     *
     * @param arr - Array to apply softmax to
     * @param offset - Starting offset in array
     * @param length - Number of elements
     * @param mask - Optional mask (false = -Inf)
     */
    private softmaxInPlace;
    /**
     * Get total parameter count
     *
     * @returns Number of trainable parameters
     */
    getParameterCount(): number;
}
//# sourceMappingURL=luna-attention.d.ts.map