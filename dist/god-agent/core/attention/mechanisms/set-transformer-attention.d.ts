/**
 * Set Transformer Attention Implementation
 *
 * Based on "Set Transformer: A Framework for Attention-based Permutation-Invariant Neural Networks"
 * (Lee et al. 2019)
 *
 * Key Features:
 * - Uses inducing points to reduce O(N²) complexity to O(N×m + m²)
 * - Permutation invariant - order of inputs doesn't matter
 * - Efficient for large sets with no sequential structure
 * - ISAB (Induced Set Attention Block) architecture
 *
 * Algorithm:
 * 1. Learn m inducing points I (trainable parameters)
 * 2. H = MAB(I, X) - inducing points attend to input
 * 3. output = MAB(X, H) - input attends to inducing points
 *
 * where MAB is a Multi-head Attention Block
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface SetTransformerConfig {
    dimension?: number;
    numHeads?: number;
    numInducingPoints?: number;
    seed?: number;
}
/**
 * Set Transformer Attention using Induced Set Attention Blocks (ISAB)
 *
 * Efficient attention for sets with no inherent ordering.
 * Complexity: O(N×m + m²) instead of O(N²)
 */
export declare class RealSetTransformerAttention implements IAttentionMechanism {
    readonly name = "set-transformer";
    private readonly dimension;
    private readonly numHeads;
    private readonly numInducingPoints;
    private readonly inducingPoints;
    private readonly mab1;
    private readonly mab2;
    constructor(config?: SetTransformerConfig);
    /**
     * Forward pass: ISAB(X) = MAB(X, MAB(I, X))
     *
     * @param query - Input embeddings (flattened seqLen × dimension)
     * @param key - Ignored (uses query for set processing)
     * @param value - Ignored (uses query for set processing)
     * @param mask - Optional attention mask
     * @param seqLen - Sequence length (required)
     * @returns Transformed embeddings (seqLen × dimension)
     */
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Get total number of trainable parameters
     *
     * Includes:
     * - Inducing points: m × d
     * - MAB1 parameters: 4 × d²
     * - MAB2 parameters: 4 × d²
     */
    getParameterCount(): number;
}
export default RealSetTransformerAttention;
//# sourceMappingURL=set-transformer-attention.d.ts.map