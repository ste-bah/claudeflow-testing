/**
 * Real Strided Attention Implementation
 *
 * Reference: Sparse Transformer (Child et al. 2019)
 *
 * Combines local window attention with strided global attention.
 * Each position attends to nearby positions AND every stride-th position.
 *
 * Use cases:
 * - Long sequence processing
 * - Sparse Transformer architectures
 * - Image generation (when sequences represent pixels)
 *
 * Complexity: O(N × (W + N/S)) where W is window, S is stride
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: REAL implementation
 */
import { IAttentionMechanism } from '../attention-types.js';
export declare class RealStridedAttention implements IAttentionMechanism {
    readonly name = "strided";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly stride;
    private readonly windowSize;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        stride?: number;
        windowSize?: number;
        seed?: number;
    });
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Determine which positions position i should attend to
     *
     * Combines:
     * - Local window: positions within [i - windowSize/2, i + windowSize/2]
     * - Strided positions: all j where j % stride == 0
     *
     * @param i Current position
     * @param N Total sequence length
     * @returns Sorted array of unique attended positions
     */
    private getAttendedPositions;
    getParameterCount(): number;
}
//# sourceMappingURL=strided-attention.d.ts.map