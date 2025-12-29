/**
 * GNN-based Trajectory Embedding Enhancer - TASK-RSN-001
 * Transforms 1536D embeddings using simulated Graph Attention Network.
 * Cache: gnn-cache.ts | Math: gnn-math.ts | Target: <100ms for 50-node graphs
 */
import type { GNNConfig, IGNNEnhancementResult } from './reasoning-types.js';
import { type ICacheConfig, type ICacheStats } from './gnn-cache.js';
import { WeightManager, type ICheckpointConfig } from './weight-manager.js';
export type { ICacheConfig, ICacheStats } from './gnn-cache.js';
/**
 * Cache entry for a single layer's activation values during forward pass.
 * Required by layer_backward() for gradient computation.
 *
 * Implements: GAP-GNN-002, TASK-GNN-INT-002
 */
export interface LayerActivationCache {
    /** Layer identifier (e.g., 'layer1', 'layer2', 'layer3') */
    layerId: string;
    /** Input to this layer (captured before transformation) */
    input: Float32Array;
    /** Output before activation function (weights * input) */
    preActivation: Float32Array;
    /** Output after activation function (e.g., ReLU(preActivation)) */
    postActivation: Float32Array;
    /** Weight matrix used for this layer's projection */
    weights: Float32Array[];
}
/**
 * Result from enhance() with optional activation cache for backpropagation.
 * When collectActivations=true, the cache contains all layer activations
 * needed for gradient computation via layer_backward().
 *
 * Implements: GAP-GNN-002, TASK-GNN-INT-002
 */
export interface ForwardResult {
    /** Enhanced embedding (normalized output from final layer) */
    enhanced: Float32Array;
    /** Original input embedding */
    original: Float32Array;
    /** Whether result was retrieved from cache */
    cached: boolean;
    /** Processing time in milliseconds */
    enhancementTime?: number;
    /** Number of nodes processed (for graph enhancement) */
    nodeCount?: number;
    /**
     * Activation cache for backpropagation.
     * Only populated when collectActivations=true.
     * Contains one entry per layer in forward order: [layer1, layer2, layer3]
     */
    activationCache: LayerActivationCache[];
}
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
export declare class GNNEnhancer {
    private config;
    private cacheManager;
    private weightManager;
    private weightSeed;
    private weightsLoaded;
    private autoLoadEnabled;
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
    /**
     * Create GNNEnhancer with learned weight projection
     * Implements: TASK-GNN-001, TASK-GNN-003
     *
     * @param config - GNN configuration
     * @param cacheConfig - Cache configuration
     * @param weightSeed - Optional seed for reproducible weight initialization
     * @param checkpointConfig - Optional checkpoint configuration for weight persistence
     * @param autoLoad - Whether to auto-load weights from disk on first use (default: true)
     */
    constructor(config?: Partial<GNNConfig>, cacheConfig?: Partial<ICacheConfig>, weightSeed?: number, checkpointConfig?: Partial<ICheckpointConfig>, autoLoad?: boolean);
    /**
     * Initialize learned weights for all projection layers
     * Implements: TASK-GNN-001, TASK-GNN-003
     *
     * Layer architecture (using VECTOR_DIM = 1536):
     * - input_projection: inputDim -> inputDim (for non-standard input sizes)
     * - layer1: inputDim -> 1024 (compress from 1536 to 1024)
     * - layer2: 1024 -> 1280 (expand)
     * - layer3: 1280 -> outputDim (final projection back to 1536)
     *
     * TASK-GNN-003: If auto-load is enabled, tries to load persisted weights first.
     * Falls back to fresh initialization if loading fails or weights don't exist.
     */
    private initializeLayerWeights;
    /**
     * Try to load all layer weights from disk
     * Implements: TASK-GNN-003 AC-002 (auto-load on construction)
     *
     * @returns Number of layers successfully loaded from disk
     */
    tryLoadWeightsFromDisk(): Promise<number>;
    /**
     * Initialize observability metrics
     */
    private initializeMetrics;
    /**
     * Enhance a 1536D embedding using GNN-like processing with attention mechanism.
     *
     * Implements: GAP-GNN-002, TASK-GNN-INT-002
     *
     * @param embedding - Input embedding to enhance
     * @param graphOrContext - Optional trajectory graph or context string
     * @param hyperedges - Optional hyperedge identifiers for cache key
     * @param collectActivations - When true, captures pre/post activation values for backpropagation.
     *                             Required for layer_backward() gradient computation.
     *                             Default: false for backward compatibility.
     * @returns ForwardResult with enhanced embedding and optional activation cache
     */
    enhance(embedding: Float32Array, graphOrContext?: TrajectoryGraph | string, hyperedges?: string[], collectActivations?: boolean): Promise<ForwardResult>;
    /** Internal: enhance and return raw Float32Array (used by enhanceWithGraph) */
    private enhanceRaw;
    /**
     * Enhance with graph context
     */
    enhanceWithGraph(embedding: Float32Array, graph: TrajectoryGraph): Promise<IGNNEnhancementResult>;
    /**
     * Prepare input embedding (normalize and ensure dimension)
     * Implements: TASK-GNN-001 - Uses learned projection instead of fake index cycling
     */
    private prepareInput;
    /**
     * Apply a GNN-like layer with learned projection, activation, and optional residual
     * Implements: TASK-GNN-001 - Uses project() with WeightManager instead of fake simpleProjection
     */
    private applyLayer;
    /**
     * Apply a GNN layer and capture activation values for backpropagation.
     *
     * This method performs the same computation as applyLayer() but additionally
     * captures pre-activation and post-activation values required by layer_backward()
     * for gradient computation during training.
     *
     * Implements: GAP-GNN-002, TASK-GNN-INT-002
     *
     * Memory consideration (RULE-037): Each cache entry uses approximately:
     * - input: inputDim * 4 bytes (Float32)
     * - preActivation: outputDim * 4 bytes
     * - postActivation: outputDim * 4 bytes
     * - weights: reference only (no copy, weights don't change during forward)
     * For 1536D vectors with 3 layers: ~36KB per forward pass (well under 10MB limit)
     *
     * @param input - Layer input vector
     * @param outputDim - Target output dimension
     * @param layerNum - Layer number (1, 2, or 3)
     * @returns Object with output vector and activation cache for this layer
     */
    private applyLayerWithCache;
    /**
     * Prune graph to max nodes
     */
    private pruneGraph;
    /**
     * Build feature matrix from node embeddings
     * Implements: TASK-GNN-001 - Uses learned projection for dimension alignment
     */
    private buildFeatureMatrix;
    /**
     * Build adjacency matrix from edges
     */
    private buildAdjacencyMatrix;
    /**
     * Aggregate neighborhood information using graph attention
     * Implements: TASK-GNN-002 (real graph attention)
     *
     * This replaces the fake mean aggregation that ignored the adjacency matrix.
     * Now properly:
     * 1. Uses ALL graph nodes as potential neighbors
     * 2. Computes attention scores using scaled dot product with center
     * 3. Weights attention by total edge weight per node (node importance in graph)
     * 4. Applies softmax to get normalized attention weights
     * 5. Performs weighted aggregation of all node features
     * 6. Combines with center embedding (residual connection)
     *
     * The key insight is that the adjacency matrix defines graph STRUCTURE.
     * Nodes with more/stronger connections are more important in the graph.
     * We compute node importance as sum of edge weights for each node.
     *
     * @param center - Center node embedding (query) - the embedding to enhance
     * @param features - All node embeddings in the graph
     * @param adjacency - Adjacency matrix (rows correspond to nodes)
     * @returns Aggregated embedding with graph information
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
    /**
     * Get the weight manager for direct access (useful for persistence)
     * Implements: TASK-GNN-001
     */
    getWeightManager(): WeightManager;
    /**
     * Get the weight seed used for initialization
     * Implements: TASK-GNN-001
     */
    getWeightSeed(): number;
    /**
     * Save all learned weights to disk
     * Implements: TASK-GNN-001 - Foundation for TASK-GNN-003 (persistence)
     */
    saveWeights(): Promise<void>;
    /**
     * Load learned weights from disk
     * Implements: TASK-GNN-001 - Foundation for TASK-GNN-003 (persistence)
     *
     * @returns Number of layers successfully loaded
     */
    loadWeights(): Promise<number>;
    /**
     * Get weight statistics for debugging
     * Implements: TASK-GNN-001
     */
    getWeightStats(): {
        layers: number;
        totalParams: number;
        memoryBytes: number;
        seed: number;
    };
    /**
     * Reinitialize weights with a new seed
     * Useful for testing that different seeds produce different outputs
     * Implements: TASK-GNN-001
     */
    reinitializeWeights(newSeed: number): void;
    /**
     * Save all weights with metadata to disk
     * Implements: TASK-GNN-003 AC-001, AC-003
     *
     * @returns Promise that resolves when all weights are saved
     */
    saveWeightsWithMetadata(): Promise<void>;
    /**
     * Create a checkpoint of all layer weights
     * Implements: TASK-GNN-003 AC-004
     *
     * @returns Array of checkpoint filenames
     */
    createCheckpoint(): Promise<string[]>;
    /**
     * Restore weights from the latest checkpoint
     * Implements: TASK-GNN-003 AC-004
     *
     * @returns Number of layers successfully restored
     */
    restoreFromCheckpoint(): Promise<number>;
    /**
     * Get metadata for all layers
     * Implements: TASK-GNN-003 AC-003
     */
    getWeightMetadata(): Map<string, import('./weight-manager.js').IWeightMetadata | undefined>;
    /**
     * Configure checkpointing behavior
     * Implements: TASK-GNN-003 AC-004
     */
    setCheckpointConfig(config: Partial<import('./weight-manager.js').ICheckpointConfig>): void;
    /**
     * Get checkpoint configuration
     * Implements: TASK-GNN-003 AC-004
     */
    getCheckpointConfig(): import('./weight-manager.js').ICheckpointConfig;
    /**
     * Check if weights have been loaded from disk
     * Implements: TASK-GNN-003 AC-002
     */
    areWeightsLoadedFromDisk(): boolean;
    /**
     * Validate all current weights
     * Implements: TASK-GNN-003 AC-005
     *
     * @returns Validation results for all layers
     */
    validateAllWeights(): Map<string, import('./weight-manager.js').IWeightValidationResult>;
    /**
     * Check if persisted weights exist on disk
     * Implements: TASK-GNN-003
     */
    hasPersistedWeights(): boolean;
    /**
     * Delete all persisted weights
     * Implements: TASK-GNN-003
     */
    deleteAllPersistedWeights(): Promise<number>;
}
//# sourceMappingURL=gnn-enhancer.d.ts.map