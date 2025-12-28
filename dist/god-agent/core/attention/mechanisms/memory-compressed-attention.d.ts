/**
 * Memory Compressed Attention Implementation
 *
 * Based on Liu et al. 2018 "Generating Wikipedia by Summarizing Long Sequences"
 *
 * Key Innovation: Reduces memory by compressing Key/Value sequences before attention.
 * - Compression via strided pooling or average pooling
 * - Complexity: O(N × (N/c)) where c is compression factor
 * - Use case: Long document processing where full N² attention is too expensive
 *
 * Architecture:
 * 1. Compress K and V sequences by factor c (default 4)
 * 2. Compute attention between full Q and compressed K,V
 * 3. Query attends to compressed memory, not full sequence
 *
 * @module memory-compressed-attention
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface MemoryCompressedAttentionConfig {
    dimension?: number;
    numHeads?: number;
    compressionFactor?: number;
    seed?: number;
}
/**
 * Memory Compressed Attention Mechanism
 *
 * Reduces memory by compressing K,V sequences before computing attention.
 * This allows processing longer sequences with reduced memory footprint.
 */
export declare class RealMemoryCompressedAttention implements IAttentionMechanism {
    readonly name = "memory-compressed";
    private readonly dimension;
    private readonly numHeads;
    private readonly compressionFactor;
    private readonly headDim;
    private readonly Wq;
    private readonly Wk;
    private readonly Wv;
    private readonly Wo;
    constructor(config?: MemoryCompressedAttentionConfig);
    /**
     * Forward pass: Compute memory-compressed attention
     *
     * @param query - Query tensor [seqLen, dimension]
     * @param key - Key tensor [seqLen, dimension]
     * @param value - Value tensor [seqLen, dimension]
     * @param mask - Optional attention mask
     * @param seqLen - Sequence length (required)
     * @returns Output tensor [seqLen, dimension]
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Compress sequence using average pooling
     *
     * @param seq - Input sequence [seqLen, dimension]
     * @param seqLen - Original sequence length
     * @param compressedLen - Target compressed length
     * @returns Compressed sequence [compressedLen, dimension]
     */
    private compressSequence;
    /**
     * Compress mask to match compressed sequence length
     */
    private compressMask;
    /**
     * Reshape to multi-head format
     * [seqLen, dimension] -> [seqLen, numHeads, headDim]
     */
    private reshapeToHeads;
    /**
     * Extract single head from multi-head tensor
     */
    private extractHead;
    /**
     * Compute attention scores: Q @ K^T / sqrt(headDim)
     */
    private computeAttentionScores;
    /**
     * Apply mask to attention scores
     */
    private applyMask;
    /**
     * Apply softmax to attention scores (stable version)
     */
    private applySoftmax;
    /**
     * Compute weighted sum: scores @ V
     */
    private weightedSum;
    /**
     * Copy head output to final output tensor
     */
    private copyHeadToOutput;
    /**
     * Get total number of trainable parameters
     */
    getParameterCount(): number;
}
//# sourceMappingURL=memory-compressed-attention.d.ts.map