/**
 * Nyströmformer Attention Mechanism
 *
 * Reference: Xiong et al. 2021 "Nyströmformer: A Nyström-Based Algorithm for Approximating Self-Attention"
 *
 * Uses Nyström approximation to reduce attention complexity from O(N^2) to O(N × m)
 * where m is the number of landmark points.
 *
 * Algorithm:
 * 1. Sample m landmark points from the sequence
 * 2. Compute Q̃ = Q[landmarks], K̃ = K[landmarks]
 * 3. Approximate attention: A ≈ softmax(Q × K̃^T) × softmax(K̃ × K̃^T)^{-1} × softmax(K̃ × K^T)
 * 4. Use Moore-Penrose pseudoinverse for the middle term
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface NystromformerAttentionConfig {
    dimension?: number;
    numHeads?: number;
    numLandmarks?: number;
    seed?: number;
}
export declare class RealNystromformerAttention implements IAttentionMechanism {
    readonly name = "nystromformer";
    private readonly dimension;
    private readonly numHeads;
    private readonly numLandmarks;
    private readonly headDim;
    private readonly scale;
    private readonly wq;
    private readonly wk;
    private readonly wv;
    private readonly wo;
    constructor(config?: NystromformerAttentionConfig);
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    getParameterCount(): number;
    /**
     * Select landmark indices using segment-based uniform sampling
     */
    private selectLandmarks;
    /**
     * Extract landmark rows from a matrix
     */
    private extractLandmarks;
    /**
     * Extract a single attention head from the full tensor
     */
    private extractHead;
    /**
     * General matrix multiplication: C = A × B
     * A is [rowsA × cols], B is [cols × colsB]
     * Returns C [rowsA × colsB]
     */
    private matrixMultiply;
    /**
     * Compute scaled softmax attention: softmax(Q × K^T / sqrt(d))
     */
    private computeScaledSoftmax;
    /**
     * Compute Moore-Penrose pseudoinverse using SVD approximation
     * For simplicity, using regularized inverse: (A^T A + λI)^{-1} A^T
     */
    private pseudoinverse;
    /**
     * Invert a square matrix using Gauss-Jordan elimination
     */
    private invertMatrix;
}
//# sourceMappingURL=nystromformer-attention.d.ts.map