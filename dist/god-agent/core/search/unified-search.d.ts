/**
 * Unified Search - Quad-Fusion Search Orchestration
 * Combines vector, graph, memory, and pattern sources
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-SEARCH-001
 *
 * @module src/god-agent/core/search/unified-search
 */
import type { NativeHNSW } from '../vector-db/native-hnsw.js';
import type { FallbackGraph } from '../graph-db/fallback-graph.js';
import type { MemoryClient } from '../memory-server/memory-client.js';
import type { ReasoningBank } from '../reasoning/reasoning-bank.js';
import type { QuadFusionOptions, QuadFusionResult, SourceWeights } from './search-types.js';
import type { GNNEnhancer } from '../reasoning/gnn-enhancer.js';
import { ActivityStream } from '../../observability/activity-stream.js';
/**
 * Unified Search orchestrates quad-fusion search across four sources
 */
export declare class UnifiedSearch {
    private readonly vectorAdapter;
    private readonly graphAdapter;
    private readonly memoryAdapter;
    private readonly patternAdapter;
    private readonly fusionScorer;
    private readonly gnnAdapter?;
    private readonly activityStream?;
    private options;
    /**
     * Create unified search instance
     *
     * @param vectorDb - NativeHNSW vector database
     * @param graphDb - FallbackGraph graph database
     * @param memoryClient - MemoryClient for pattern queries
     * @param reasoningBank - ReasoningBank for pattern matching
     * @param gnnEnhancer - Optional GNN enhancer for graph-enhanced embeddings
     * @param options - Optional configuration overrides
     * @param activityStream - Optional ActivityStream for observability events
     */
    constructor(vectorDb: NativeHNSW, graphDb: FallbackGraph, memoryClient: MemoryClient, reasoningBank: ReasoningBank, gnnEnhancer?: GNNEnhancer, options?: Partial<QuadFusionOptions>, activityStream?: ActivityStream);
    /**
     * Execute quad-fusion search
     *
     * @param query - Text query string
     * @param embedding - Optional pre-computed query embedding (VECTOR_DIM dimensions, default 1536)
     * @param options - Optional per-query options
     * @returns Quad-fusion search result
     */
    search(query: string, embedding?: Float32Array, options?: Partial<QuadFusionOptions>): Promise<QuadFusionResult>;
    /**
     * Execute parallel search across all sources
     */
    private executeParallelSearch;
    /**
     * Convert settled promise result to source execution result
     */
    private settledToOutcome;
    /**
     * Build search metadata
     */
    private buildMetadata;
    /**
     * Build per-source statistics
     */
    private buildSourceStats;
    /**
     * Generate correlation ID for tracing
     */
    private generateCorrelationId;
    /**
     * Emit search observability event
     * Non-blocking - errors are caught and logged silently
     */
    private emitSearchEvent;
    /**
     * Update source weights
     *
     * @param weights - Partial weights to update
     */
    updateWeights(weights: Partial<SourceWeights>): void;
    /**
     * Get current options
     *
     * @returns Current quad-fusion options
     */
    getOptions(): QuadFusionOptions;
    /**
     * Update options
     *
     * @param options - Partial options to update
     */
    updateOptions(options: Partial<QuadFusionOptions>): void;
}
//# sourceMappingURL=unified-search.d.ts.map