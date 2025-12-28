/**
 * Real Dilated Attention Implementation
 *
 * Reference: Inspired by dilated convolutions (WaveNet, etc.)
 *
 * Attends to positions at regular intervals (dilation factor).
 * Efficiently captures long-range dependencies.
 *
 * Use cases:
 * - Long sequence modeling
 * - Hierarchical attention (multi-scale)
 * - Audio/speech processing
 *
 * Complexity: O(N × N/D) where D is dilation factor
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: REAL implementation
 */
import { IAttentionMechanism } from '../attention-types.js';
export declare class RealDilatedAttention implements IAttentionMechanism {
    readonly name = "dilated";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly dilation;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    constructor(config?: {
        dimension?: number;
        numHeads?: number;
        dilation?: number;
        seed?: number;
    });
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    getParameterCount(): number;
}
//# sourceMappingURL=dilated-attention.d.ts.map