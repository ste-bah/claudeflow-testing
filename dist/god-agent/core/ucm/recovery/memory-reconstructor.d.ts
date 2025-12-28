/**
 * UCM Memory Reconstructor
 * RULE-060: Reconstruct context from memory
 * RULE-061: DESC fallback for missing memories
 *
 * Reconstructs lost context after compaction by retrieving from
 * memory systems and falling back to DESC semantic search.
 */
import type { IMemoryReconstructor, IReconstructedContext, IRecoveryMetrics } from '../types.js';
/**
 * MemoryReconstructor Implementation
 *
 * Orchestrates context reconstruction by:
 * 1. Attempting memory retrieval
 * 2. Falling back to DESC semantic search
 * 3. Tracking completeness and metrics
 */
export declare class MemoryReconstructor implements IMemoryReconstructor {
    private readonly memoryAdapter?;
    private readonly descAdapter?;
    private memoryStore;
    private descThreshold;
    private metrics;
    constructor(memoryAdapter?: {
        get: (key: string) => Promise<unknown>;
        search: (query: string) => Promise<unknown[]>;
    } | undefined, descAdapter?: {
        search: (query: string, threshold: number) => Promise<Array<{
            content: unknown;
            score: number;
        }>>;
    } | undefined);
    /**
     * Reconstruct complete context after compaction
     *
     * @param hints - Optional hints about what to recover
     * @returns Reconstructed context
     */
    reconstructContext(hints?: {
        agentIds?: string[];
        taskIds?: string[];
        timeRange?: {
            start: number;
            end: number;
        };
    }): Promise<IReconstructedContext>;
    /**
     * Get current recovery status
     *
     * @returns Recovery metrics
     */
    getRecoveryStatus(): IRecoveryMetrics;
    /**
     * Reconstruct pinned agents
     */
    private reconstructPinnedAgents;
    /**
     * Reconstruct active window
     */
    private reconstructActiveWindow;
    /**
     * Reconstruct archived summaries
     */
    private reconstructArchivedSummaries;
    /**
     * Reconstruct dependency graph
     */
    private reconstructDependencyGraph;
    /**
     * Attempt to reconstruct data from memory or DESC
     */
    private attemptReconstruction;
    /**
     * Discover agent IDs from available memory
     */
    private discoverAgentIds;
    /**
     * Calculate reconstruction completeness (RULE-062)
     */
    private calculateCompleteness;
    /**
     * Record an unrecoverable item
     */
    private recordUnrecoverable;
    /**
     * Estimate tokens for data object
     */
    private estimateTokens;
    /**
     * Reset metrics
     */
    private resetMetrics;
}
/**
 * Create a new MemoryReconstructor instance
 */
export declare function createMemoryReconstructor(memoryAdapter?: {
    get: (key: string) => Promise<unknown>;
    search: (query: string) => Promise<unknown[]>;
}, descAdapter?: {
    search: (query: string, threshold: number) => Promise<Array<{
        content: unknown;
        score: number;
    }>>;
}): IMemoryReconstructor;
//# sourceMappingURL=memory-reconstructor.d.ts.map