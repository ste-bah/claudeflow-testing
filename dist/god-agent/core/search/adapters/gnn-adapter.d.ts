/**
 * GNN Enhancement Adapter
 * Integrates GNN Enhancer into Unified Search pipeline
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-003
 *
 * Enhances embeddings with graph context for improved search quality.
 * Implements circuit breaker pattern for resilience.
 *
 * @module src/god-agent/core/search/adapters/gnn-adapter
 */
import type { GNNEnhancer } from '../../reasoning/gnn-enhancer.js';
import type { FallbackGraph } from '../../graph-db/fallback-graph.js';
/**
 * GNN enhancement point in search pipeline
 */
export type GNNEnhancementPoint = 'pre_search' | 'post_search' | 'both' | 'none';
/**
 * GNN enhancement configuration
 */
export interface GNNEnhancementOptions {
    /** Enable GNN enhancement */
    enabled: boolean;
    /** When to enhance: before search, after, or both */
    enhancementPoint: GNNEnhancementPoint;
    /** Graph traversal depth for context building (default: 2) */
    graphDepth: number;
    /** Enhancement timeout in ms (default: 50ms) */
    timeout: number;
    /** Fallback to raw embeddings on error (default: true) */
    fallbackOnError: boolean;
    /** Cache enhanced embeddings (default: true) */
    cacheResults: boolean;
    /** Circuit breaker configuration */
    circuitBreaker?: {
        /** Enable circuit breaker (default: true) */
        enabled: boolean;
        /** Failure threshold before opening (default: 5) */
        threshold: number;
        /** Reset timeout in ms (default: 60000) */
        resetTimeout: number;
    };
}
/**
 * Default GNN enhancement options
 */
export declare const DEFAULT_GNN_OPTIONS: GNNEnhancementOptions;
/**
 * Circuit breaker states
 */
type CircuitState = 'closed' | 'open' | 'half-open';
/**
 * GNN enhancement statistics
 */
export interface GNNEnhancementStats {
    /** Total enhancements attempted */
    totalAttempts: number;
    /** Successful enhancements */
    successes: number;
    /** Failures (returned to fallback) */
    failures: number;
    /** Timeouts */
    timeouts: number;
    /** Circuit breaker trips */
    circuitBreakerTrips: number;
    /** Average enhancement time (ms) */
    avgEnhancementTime: number;
    /** Circuit breaker state */
    circuitState: CircuitState;
}
/**
 * GNN Search Adapter
 * Integrates GNN Enhancer into search pipeline with circuit breaker
 */
export declare class GNNSearchAdapter {
    private readonly gnnEnhancer;
    private readonly graphDb;
    private readonly circuitBreaker;
    private options;
    private totalAttempts;
    private successes;
    private failures;
    private timeouts;
    private circuitBreakerTrips;
    private totalEnhancementTime;
    /**
     * Create GNN search adapter
     *
     * @param gnnEnhancer - GNN enhancer instance
     * @param graphDb - Graph database for context building
     * @param options - Enhancement configuration
     */
    constructor(gnnEnhancer: GNNEnhancer, graphDb: FallbackGraph, options?: Partial<GNNEnhancementOptions>);
    /**
     * Enhance embedding with GNN
     *
     * @param embedding - Raw embedding (768D)
     * @param query - Query string for graph context
     * @returns Enhanced embedding (1024D) or original on failure
     */
    enhance(embedding: Float32Array, query: string): Promise<Float32Array>;
    /**
     * Build graph context from query
     *
     * @param query - Query string
     * @param depth - Traversal depth
     * @returns Trajectory graph for enhancement
     */
    private buildGraphContext;
    /**
     * Extract entities from query
     * Simple word-based extraction (could be enhanced with NER)
     */
    private extractEntities;
    /**
     * Find graph nodes related to entities
     *
     * @param entities - Entity strings
     * @param depth - Traversal depth
     * @returns Graph nodes with embeddings
     */
    private findGraphNodes;
    /**
     * Execute promise with timeout
     */
    private withTimeout;
    /**
     * Get enhancement statistics
     */
    getStats(): GNNEnhancementStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
    /**
     * Update options
     */
    updateOptions(options: Partial<GNNEnhancementOptions>): void;
    /**
     * Get current options
     */
    getOptions(): GNNEnhancementOptions;
}
export {};
//# sourceMappingURL=gnn-adapter.d.ts.map