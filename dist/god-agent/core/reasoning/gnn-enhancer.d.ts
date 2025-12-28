/**
 * GNN-based Trajectory Embedding Enhancer - TASK-RSN-001
 * Transforms 768D embeddings to 1024D using simulated Graph Attention Network.
 * Cache: gnn-cache.ts | Math: gnn-math.ts | Target: <100ms for 50-node graphs
 */
import type { GNNConfig, IGNNEnhancementResult } from './reasoning-types.js';
import { type ICacheConfig, type ICacheStats } from './gnn-cache.js';
export type { ICacheConfig, ICacheStats } from './gnn-cache.js';
/**
 * Trajectory graph structure for GNN enhancement
 */
export interface TrajectoryGraph {
    nodes: TrajectoryNode[];
    edges?: TrajectoryEdge[];
}
/**
 * Trajectory node with embedding
 */
export interface TrajectoryNode {
    id: string;
    embedding: Float32Array;
    metadata?: Record<string, unknown>;
}
/**
 * Trajectory edge connecting two nodes
 */
export interface TrajectoryEdge {
    source: string;
    target: string;
    weight: number;
}
/**
 * Default GNN configuration
 */
export declare const DEFAULT_GNN_CONFIG: GNNConfig;
/**
 * GNN-based embedding enhancer
 *
 * Transforms 768D embeddings to 1024D using a simulated Graph Attention Network.
 * Architecture:
 * - Layer 1: 768 → 512 (project down, simulate attention)
 * - Layer 2: 512 → 768 (expand back, residual connection)
 * - Layer 3: 768 → 1024 (final projection)
 */
export declare class GNNEnhancer {
    private config;
    private cacheManager;
    private totalEnhancements;
    private totalCacheHits;
    private totalEnhancementTime;
    private cacheHitMetric?;
    private cacheMissMetric?;
    private cacheEvictionMetric?;
    private cacheHitLatencyMetric?;
    private cacheMissLatencyMetric?;
    private cacheMemoryMetric?;
    private cacheSizeMetric?;
    constructor(config?: Partial<GNNConfig>, cacheConfig?: Partial<ICacheConfig>);
    /**
     * Initialize observability metrics
     */
    private initializeMetrics;
    /**
     * Enhance a 768D embedding to 1024D using GNN-like processing
     */
    enhance(embedding: Float32Array, graphOrContext?: TrajectoryGraph | string, hyperedges?: string[]): Promise<{
        enhanced: Float32Array;
        original: Float32Array;
        cached: boolean;
        enhancementTime?: number;
        nodeCount?: number;
    }>;
    /** Internal: enhance and return raw Float32Array (used by enhanceWithGraph) */
    private enhanceRaw;
    /**
     * Enhance with graph context
     */
    enhanceWithGraph(embedding: Float32Array, graph: TrajectoryGraph): Promise<IGNNEnhancementResult>;
    /**
     * Prepare input embedding (normalize and ensure dimension)
     */
    private prepareInput;
    /**
     * Apply a GNN-like layer with projection, activation, and optional residual
     */
    private applyLayer;
    /**
     * Prune graph to max nodes
     */
    private pruneGraph;
    /**
     * Build feature matrix from node embeddings
     */
    private buildFeatureMatrix;
    /**
     * Build adjacency matrix from edges
     */
    private buildAdjacencyMatrix;
    /**
     * Aggregate neighborhood information
     */
    private aggregateNeighborhood;
    /**
     * Update cache metrics for observability
     */
    private updateCacheMetrics;
    /**
     * Warm cache with pre-computed entries
     */
    warmCache(entries: Array<{
        embedding: Float32Array;
        hyperedges: string[];
        enhanced: Float32Array;
    }>): Promise<number>;
    /**
     * Invalidate cache entries for specific nodes
     */
    invalidateNodes(nodeIds: string[]): number;
    /**
     * Invalidate all cache entries
     */
    invalidateAll(): number;
    /**
     * Clear cache and reset metrics
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): ICacheStats & {
        hitRate: number;
        maxSize: number;
        totalEnhancements: number;
        totalCacheHits: number;
        memoryUsedMB: number;
        averageEnhancementTime: number;
    };
    /**
     * Get observability metrics (compatible with test expectations)
     */
    getObservabilityMetrics(): Record<string, number>;
    /**
     * Export metrics in Prometheus format
     */
    exportMetrics(): string;
    /**
     * Get metrics summary
     */
    getMetrics(): {
        hits: number;
        misses: number;
        hitRate: number;
        cacheHitRate: number;
        totalEnhancements: number;
        averageLatencyMs: number;
        averageTimeMs: number;
    };
    /**
     * Reset all metrics counters
     */
    resetMetrics(): void;
}
//# sourceMappingURL=gnn-enhancer.d.ts.map