/**
 * DAI-003: Capability Index Implementation
 *
 * TASK-005: Capability Index
 * Constitution: RULE-DAI-003-004, INT-002
 *
 * Indexes agent capabilities for fast semantic search and domain matching.
 * Integrates with AgentRegistry for real-time synchronization.
 * Uses VectorDB for embedding-based capability search.
 *
 * Performance target: < 10s rebuild for 200 agents
 *
 * @module src/god-agent/core/routing/capability-index
 */
import type { ICapabilityIndex, IAgentCapability, ICapabilityMatch, TaskDomain } from './routing-types.js';
/**
 * Configuration for CapabilityIndex
 */
export interface ICapabilityIndexConfig {
    /** Path to agents directory (default: .claude/agents) */
    agentsPath?: string;
    /** Whether to use local embedding API (default: true) */
    useLocalEmbedding?: boolean;
    /** Freshness threshold in milliseconds (default: 24h) */
    freshnessThreshold?: number;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
    /** Batch size for embedding requests (default: 10) */
    embeddingBatchSize?: number;
    /** Delay between batches in ms (default: 50) */
    embeddingBatchDelayMs?: number;
}
/**
 * Capability index for semantic agent search
 * Indexes agent capabilities using vector embeddings and domain mapping
 *
 * @implements ICapabilityIndex
 */
export declare class CapabilityIndex implements ICapabilityIndex {
    private readonly config;
    private readonly agentRegistry;
    private readonly vectorDB;
    private embeddingProvider;
    private capabilities;
    private lastSyncTime;
    private initialized;
    constructor(config?: ICapabilityIndexConfig);
    /**
     * Setup listeners for agent registry events
     */
    private setupRegistryListeners;
    /**
     * Initialize the capability provider
     */
    private initEmbeddingProvider;
    /**
     * Initialize the index with agents from registry
     * Per RULE-DAI-003-004: Sync with AgentRegistry
     * Per INT-002: Store agent embeddings
     *
     * @throws CapabilityIndexError if initialization fails
     */
    initialize(): Promise<void>;
    /**
     * Rebuild the index from scratch
     * Loads all agents from registry and re-indexes using batched embedding requests
     *
     * Performance target: < 10s for 200 agents
     *
     * @throws CapabilityIndexError if rebuild fails
     */
    rebuild(): Promise<void>;
    /**
     * Index a batch of agents using batched embedding requests
     * Reduces API calls by embedding multiple texts in a single request
     *
     * @param agents - Array of agents to index
     */
    private indexAgentBatch;
    /**
     * Index a single agent
     *
     * @param agent - Agent definition to index
     * @throws Error if indexing fails
     */
    private indexAgent;
    /**
     * Extract capability text from agent definition
     * Combines name, description, and capabilities
     *
     * @param agent - Agent definition
     * @returns Combined capability text
     */
    private extractCapabilityText;
    /**
     * Extract keywords from capability text
     * Uses simple whitespace tokenization and lowercasing
     *
     * @param text - Capability text
     * @returns Array of keywords
     */
    private extractKeywords;
    /**
     * Extract domains from agent definition
     * Maps agent capabilities to task domains
     *
     * @param agent - Agent definition
     * @returns Array of task domains
     */
    private extractDomains;
    /**
     * Add an agent to the index
     * Called when registry fires agentAdded event
     *
     * @param agentKey - Agent key to add
     */
    private addAgent;
    /**
     * Remove an agent from the index
     * Called when registry fires agentRemoved event
     *
     * @param agentKey - Agent key to remove
     */
    private removeAgent;
    /**
     * Search for matching agents by embedding
     * Returns top N matches ranked by cosine similarity
     *
     * @param embedding - Task embedding vector (VECTOR_DIM (1536), L2-normalized)
     * @param limit - Maximum number of results to return
     * @returns Array of capability matches sorted by combined score
     */
    search(embedding: Float32Array, limit?: number): Promise<ICapabilityMatch[]>;
    /**
     * Search for matching agents by domain
     * Returns agents that handle the specified domain
     *
     * @param domain - Task domain to match
     * @param limit - Maximum number of results to return
     * @returns Array of capability matches for the domain
     */
    searchByDomain(domain: TaskDomain, limit?: number): ICapabilityMatch[];
    /**
     * Get last synchronization timestamp
     *
     * @returns Timestamp of last sync (milliseconds since epoch)
     */
    getLastSyncTime(): number;
    /**
     * Get total indexed agent count
     *
     * @returns Number of agents in index
     */
    getAgentCount(): number;
    /**
     * Verify index freshness
     * Throws if index is stale (> 24h since last sync)
     *
     * @throws IndexSyncError if index is stale
     */
    private verifyFreshness;
    /**
     * Get capability by agent key
     *
     * @param agentKey - Agent key
     * @returns Capability entry or undefined
     */
    getCapability(agentKey: string): IAgentCapability | undefined;
    /**
     * Get index statistics
     */
    getStats(): {
        agentCount: number;
        lastSyncTime: number;
        timeSinceSync: number;
        isStale: boolean;
        domains: Record<TaskDomain, number>;
    };
}
//# sourceMappingURL=capability-index.d.ts.map