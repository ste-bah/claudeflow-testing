/**
 * Real Axial Attention Implementation
 *
 * Reference: Axial Attention in Multidimensional Transformers (Ho et al. 2019)
 *
 * Factorizes 2D attention into row and column attention.
 * Reduces O(N²) to O(N√N) by attending along axes separately.
 *
 * For 1D sequences, reshapes to √N × √N grid internally.
 *
 * Use cases:
 * - Image processing
 * - 2D sequence modeling
 * - Vision Transformers
 *
 * Complexity: O(N × √N) = O(N^1.5)
 * Parameter Count: 4 × dim² (shared for both axes)
 *
 * ANTI-009: REAL implementation
 */
import { IAttentionMechanism } from '../attention-types.js';
export declare class RealAxialAttention implements IAttentionMechanism {
    readonly name = "axial";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly axisSize;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        axisSize?: number;
        seed?: number;
    });
    forward(query: Float32Array, key?: Float32Array, value?: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Perform attention along one axis (row or column)
     */
    private performAxisAttention;
    /**
     * Stable softmax with max subtraction and epsilon guard
     */
    private softmax;
    /**
     * Pad sequence to target length with zeros
     */
    private padSequence;
    getParameterCount(): number;
}
//# sourceMappingURL=axial-attention.d.ts.map