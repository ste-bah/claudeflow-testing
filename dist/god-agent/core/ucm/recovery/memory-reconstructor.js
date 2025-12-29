/**
 * UCM Memory Reconstructor
 * RULE-060: Reconstruct context from memory
 * RULE-061: DESC fallback for missing memories
 *
 * Reconstructs lost context after compaction by retrieving from
 * memory systems and falling back to DESC semantic search.
 */
import { ContextReconstructionError } from '../errors.js';
/**
 * MemoryReconstructor Implementation
 *
 * Orchestrates context reconstruction by:
 * 1. Attempting memory retrieval
 * 2. Falling back to DESC semantic search
 * 3. Tracking completeness and metrics
 */
export class MemoryReconstructor {
    memoryAdapter;
    descAdapter;
    memoryStore = new Map();
    descThreshold = 0.85;
    metrics = {
        agentsRecovered: 0,
        tokensReconstructed: 0,
        completeness: 0,
        fallbacksUsed: 0,
        unrecoverableItems: []
    };
    constructor(memoryAdapter, descAdapter) {
        this.memoryAdapter = memoryAdapter;
        this.descAdapter = descAdapter;
    }
    /**
     * Reconstruct complete context after compaction
     *
     * @param hints - Optional hints about what to recover
     * @returns Reconstructed context
     */
    async reconstructContext(hints) {
        try {
            this.resetMetrics();
            // Reconstruct each component
            const [pinnedAgents, activeWindow, archivedSummaries, dependencyGraph] = await Promise.all([
                this.reconstructPinnedAgents(hints?.agentIds),
                this.reconstructActiveWindow(hints?.taskIds),
                this.reconstructArchivedSummaries(hints?.timeRange),
                this.reconstructDependencyGraph()
            ]);
            // Calculate completeness
            this.calculateCompleteness({
                pinnedAgents,
                activeWindow,
                archivedSummaries,
                dependencyGraph
            });
            return {
                pinnedAgents,
                activeWindow,
                archivedSummaries,
                dependencyGraph,
                pipelinePhase: 'recovery',
                lastCompletedAgent: '',
                timestamp: Date.now(),
                metrics: { ...this.metrics }
            };
        }
        catch (error) {
            throw new ContextReconstructionError(this.metrics.agentsRecovered, 0, this.metrics.failedKeys ?? [], error);
        }
    }
    /**
     * Get current recovery status
     *
     * @returns Recovery metrics
     */
    getRecoveryStatus() {
        return { ...this.metrics };
    }
    /**
     * Reconstruct pinned agents
     */
    async reconstructPinnedAgents(agentIds) {
        const agents = [];
        const targetIds = agentIds || await this.discoverAgentIds();
        for (const agentId of targetIds) {
            try {
                const result = await this.attemptReconstruction(`agent:${agentId}`, `agent ${agentId} context state`);
                if (result.success && result.data) {
                    agents.push(result.data);
                    this.metrics.agentsRecovered++;
                    this.metrics.tokensReconstructed += result.tokens;
                }
                else {
                    this.recordUnrecoverable('agent', agentId, 'No memory or DESC match found');
                }
            }
            catch (error) {
                this.recordUnrecoverable('agent', agentId, error.message);
            }
        }
        return agents;
    }
    /**
     * Reconstruct active window
     */
    async reconstructActiveWindow(taskIds) {
        try {
            const result = await this.attemptReconstruction('window:active', 'active task window current context');
            if (result.success && result.data) {
                this.metrics.tokensReconstructed += result.tokens;
                return result.data;
            }
            // Return minimal active window if reconstruction fails
            return {
                agentStates: [],
                taskQueue: [],
                pinnedContextIds: [],
                estimatedTokens: 0
            };
        }
        catch (error) {
            this.recordUnrecoverable('window', 'active', error.message);
            return {
                agentStates: [],
                taskQueue: [],
                pinnedContextIds: [],
                estimatedTokens: 0
            };
        }
    }
    /**
     * Reconstruct archived summaries
     */
    async reconstructArchivedSummaries(timeRange) {
        const summaries = [];
        try {
            const result = await this.attemptReconstruction('summaries:archived', 'archived task summaries historical context');
            if (result.success && result.data) {
                let filtered = result.data;
                // Filter by time range if provided
                if (timeRange) {
                    filtered = filtered.filter(s => s.timestamp >= timeRange.start && s.timestamp <= timeRange.end);
                }
                summaries.push(...filtered);
                this.metrics.tokensReconstructed += result.tokens;
            }
        }
        catch (error) {
            this.recordUnrecoverable('summaries', 'archived', error.message);
        }
        return summaries;
    }
    /**
     * Reconstruct dependency graph
     */
    async reconstructDependencyGraph() {
        const graph = new Map();
        try {
            const result = await this.attemptReconstruction('graph:dependencies', 'task dependency graph relationships');
            if (result.success && result.data) {
                for (const [key, node] of result.data) {
                    graph.set(key, node);
                }
                this.metrics.tokensReconstructed += result.tokens;
            }
        }
        catch (error) {
            this.recordUnrecoverable('graph', 'dependencies', error.message);
        }
        return graph;
    }
    /**
     * Attempt to reconstruct data from memory or DESC
     */
    async attemptReconstruction(memoryKey, descQuery) {
        // Try memory first (RULE-060)
        if (this.memoryAdapter) {
            try {
                const data = await this.memoryAdapter.get(memoryKey);
                if (data) {
                    return {
                        data: data,
                        source: 'memory',
                        success: true,
                        tokens: this.estimateTokens(data)
                    };
                }
            }
            catch (error) {
                // Fall through to DESC
            }
        }
        // Fallback to DESC (RULE-061)
        if (this.descAdapter) {
            try {
                const results = await this.descAdapter.search(descQuery, this.descThreshold);
                if (results.length > 0 && results[0].score >= this.descThreshold) {
                    this.metrics.fallbacksUsed = (this.metrics.fallbacksUsed ?? 0) + 1;
                    return {
                        data: results[0].content,
                        source: 'desc',
                        success: true,
                        tokens: this.estimateTokens(results[0].content)
                    };
                }
            }
            catch (error) {
                // Fall through to failure
            }
        }
        return {
            data: null,
            source: 'none',
            success: false,
            tokens: 0
        };
    }
    /**
     * Discover agent IDs from available memory
     */
    async discoverAgentIds() {
        if (!this.memoryAdapter) {
            return [];
        }
        try {
            const results = await this.memoryAdapter.search('agent:*');
            return results
                .map(r => String(r))
                .filter(key => key.startsWith('agent:'))
                .map(key => key.replace('agent:', ''));
        }
        catch {
            // INTENTIONAL: Memory search failure - return empty list as safe default
            return [];
        }
    }
    /**
     * Calculate reconstruction completeness (RULE-062)
     */
    calculateCompleteness(context) {
        let score = 0;
        let maxScore = 4;
        if (context.pinnedAgents && Array.isArray(context.pinnedAgents) && context.pinnedAgents.length > 0)
            score++;
        if (context.activeWindow && typeof context.activeWindow === 'object' && 'agentStates' in context.activeWindow && context.activeWindow.agentStates.length > 0)
            score++;
        if (context.archivedSummaries && Array.isArray(context.archivedSummaries) && context.archivedSummaries.length > 0)
            score++;
        if (context.dependencyGraph && context.dependencyGraph.size > 0)
            score++;
        this.metrics.completeness = score / maxScore;
    }
    /**
     * Record an unrecoverable item
     */
    recordUnrecoverable(type, id, reason) {
        if (!this.metrics.unrecoverableItems) {
            this.metrics.unrecoverableItems = [];
        }
        this.metrics.unrecoverableItems.push({
            type,
            id,
            reason,
            timestamp: Date.now()
        });
    }
    /**
     * Estimate tokens for data object
     */
    estimateTokens(data) {
        const str = JSON.stringify(data);
        // Rough estimate: 4 characters per token
        return Math.ceil(str.length / 4);
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            agentsRecovered: 0,
            tokensReconstructed: 0,
            completeness: 0,
            fallbacksUsed: 0,
            unrecoverableItems: []
        };
    }
}
/**
 * Create a new MemoryReconstructor instance
 */
export function createMemoryReconstructor(memoryAdapter, descAdapter) {
    return new MemoryReconstructor(memoryAdapter, descAdapter);
}
//# sourceMappingURL=memory-reconstructor.js.map