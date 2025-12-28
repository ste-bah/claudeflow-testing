/**
 * Clustered Attention Mechanism
 *
 * Reference: Vyas et al. 2020 "Fast Transformers with Clustered Attention"
 *
 * Approximates full attention by clustering queries and keys into groups,
 * computing attention between cluster centroids, then distributing back
 * to individual positions.
 *
 * Complexity: O(N × c) where c is number of clusters (typically sqrt(N))
 *
 * Algorithm:
 * 1. Cluster queries into c groups
 * 2. Cluster keys into c groups
 * 3. Compute centroids for each cluster
 * 4. Compute attention between query centroids and key centroids
 * 5. Distribute cluster-level attention back to individual positions
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface ClusteredAttentionConfig {
    dimension?: number;
    numHeads?: number;
    numClusters?: number;
    seed?: number;
    maxKMeansIterations?: number;
}
export declare class RealClusteredAttention implements IAttentionMechanism {
    readonly name = "clustered";
    private readonly dimension;
    private readonly numHeads;
    private readonly numClusters;
    private readonly headDim;
    private readonly seed;
    private readonly maxKMeansIterations;
    private readonly Wq;
    private readonly Wk;
    private readonly Wv;
    private readonly Wo;
    constructor(config?: ClusteredAttentionConfig);
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    private extractHead;
    /**
     * Simple k-means clustering
     * Returns cluster assignment for each position
     */
    private clusterVectors;
    private computeCentroids;
    /**
     * Compute attention between cluster centroids
     * Returns: (numClusters × headDim) attention-weighted value centroids
     */
    private computeClusterAttention;
    /**
     * Distribute cluster-level attention back to individual positions
     */
    private distributeClusterAttention;
    getParameterCount(): number;
}
//# sourceMappingURL=clustered-attention.d.ts.map