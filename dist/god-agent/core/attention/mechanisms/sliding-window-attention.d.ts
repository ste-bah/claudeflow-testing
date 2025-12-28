/**
 * Real Sliding Window Attention Implementation
 *
 * Each position attends to a fixed-size sliding window of neighbors.
 * Window slides across the sequence maintaining constant attention span.
 *
 * Use cases:
 * - Long sequence processing with local context
 * - Longformer-style local attention component
 * - Memory-efficient attention for long documents
 *
 * Complexity: O(N × W) where W is window size
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: REAL implementation
 */
import { IAttentionMechanism } from '../attention-types.js';
export declare class RealSlidingWindowAttention implements IAttentionMechanism {
    readonly name = "sliding-window";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly windowSize;
    private readonly halfWindow;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        windowSize?: number;
        seed?: number;
    });
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    getParameterCount(): number;
}
//# sourceMappingURL=sliding-window-attention.d.ts.map