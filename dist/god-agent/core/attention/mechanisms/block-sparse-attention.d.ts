/**
 * Real Block Sparse Attention Implementation
 *
 * Reference: BigBird (Zaheer et al. 2020), Sparse Transformer (Child et al. 2019)
 *
 * Divides sequence into blocks and computes attention within/between blocks.
 * Creates structured sparsity for memory efficiency.
 *
 * Use cases:
 * - Long document processing
 * - Structured sparse attention
 * - Memory-efficient transformers
 *
 * Complexity: O(N × B) where B is block size (vs O(N²))
 * Parameter Count: 4 × dim²
 *
 * ANTI-009: REAL implementation
 */
import { IAttentionMechanism } from '../attention-types.js';
export interface BlockSparseAttentionConfig {
    dimension?: number;
    numHeads?: number;
    blockSize?: number;
    numRandomBlocks?: number;
    seed?: number;
}
export declare class RealBlockSparseAttention implements IAttentionMechanism {
    readonly name = "block-sparse";
    private readonly dimension;
    private readonly numHeads;
    private readonly headDim;
    private readonly scale;
    private readonly blockSize;
    private readonly numRandomBlocks;
    private readonly rng;
    private readonly wQuery;
    private readonly wKey;
    private readonly wValue;
    private readonly wOutput;
    constructor(config?: BlockSparseAttentionConfig);
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[]): Float32Array;
    /**
     * Generate random block connections for each block (deterministic from seed)
     */
    private generateRandomBlockConnections;
    /**
     * Determine which blocks a given block should attend to
     */
    private getAttendBlocks;
    getParameterCount(): number;
    getWeights(): {
        wQuery: Float32Array;
        wKey: Float32Array;
        wValue: Float32Array;
        wOutput: Float32Array;
    };
    getConfig(): {
        dimension: number;
        numHeads: number;
        headDim: number;
        blockSize: number;
        numRandomBlocks: number;
    };
}
//# sourceMappingURL=block-sparse-attention.d.ts.map