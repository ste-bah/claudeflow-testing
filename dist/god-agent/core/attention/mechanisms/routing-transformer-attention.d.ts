/**
 * Routing Transformer Attention
 *
 * Implements content-based routing attention mechanism where queries are routed
 * to relevant key clusters, reducing complexity from O(N²) to O(N × k).
 *
 * Reference: Roy et al. 2021 "Efficient Content-Based Sparse Attention with Routing Transformers"
 *
 * Key Features:
 * - Content-based clustering of keys into k groups
 * - Each query routes to top-r most relevant clusters
 * - Attention computed only within selected clusters
 * - Complexity: O(N × k) where k is number of clusters
 */
import type { IAttentionMechanism } from '../attention-types.js';
export interface RealRoutingTransformerAttentionConfig {
    dimension?: number;
    numHeads?: number;
    numClusters?: number;
    numRoutes?: number;
    seed?: number;
}
export declare class RealRoutingTransformerAttention implements IAttentionMechanism {
    readonly name = "routing-transformer";
    private dimension;
    private numHeads;
    private numClusters;
    private numRoutes;
    private headDim;
    private seed;
    private clusterCentroids;
    private wq;
    private wk;
    private wv;
    private wo;
    constructor(config?: RealRoutingTransformerAttentionConfig);
    forward(query: Float32Array, key: Float32Array, value: Float32Array, mask?: boolean[], seqLen?: number): Float32Array;
    /**
     * Route query to top-r most similar clusters
     */
    private routeQuery;
    /**
     * Assign key to nearest cluster
     */
    private assignKeyToCluster;
    /**
     * Compute attention only with keys in routed clusters
     */
    private computeRoutedAttention;
    getParameterCount(): number;
}
//# sourceMappingURL=routing-transformer-attention.d.ts.map