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
import { CapabilityIndexError, IndexSyncError } from './routing-errors.js';
import { AgentRegistry } from '../agents/index.js';
import { VectorDB, DistanceMetric } from '../vector-db/index.js';
import { EmbeddingProviderFactory } from '../memory/embedding-provider.js';
// ==================== Capability Index Implementation ====================
/**
 * Capability index for semantic agent search
 * Indexes agent capabilities using vector embeddings and domain mapping
 *
 * @implements ICapabilityIndex
 */
export class CapabilityIndex {
    config;
    agentRegistry;
    vectorDB;
    embeddingProvider = null;
    // Index state
    capabilities = new Map();
    lastSyncTime = 0;
    initialized = false;
    constructor(config = {}) {
        this.config = {
            agentsPath: config.agentsPath ?? '.claude/agents',
            useLocalEmbedding: config.useLocalEmbedding ?? true,
            freshnessThreshold: config.freshnessThreshold ?? 24 * 60 * 60 * 1000, // 24h
            verbose: config.verbose ?? false,
            embeddingBatchSize: config.embeddingBatchSize ?? 10,
            embeddingBatchDelayMs: config.embeddingBatchDelayMs ?? 50,
        };
        // Create agent registry
        this.agentRegistry = new AgentRegistry({
            basePath: this.config.agentsPath,
            verbose: this.config.verbose,
        });
        // Create vector DB for capability embeddings
        this.vectorDB = new VectorDB({
            dimension: 1536,
            hnswEfConstruction: 200,
            hnswM: 16,
            metric: DistanceMetric.COSINE,
        });
        // Listen for registry events
        this.setupRegistryListeners();
    }
    /**
     * Setup listeners for agent registry events
     */
    setupRegistryListeners() {
        // Note: AgentRegistry doesn't emit events in current implementation
        // This is a placeholder for future event-driven updates
        // For now, we rely on periodic freshness checks
    }
    /**
     * Initialize the capability provider
     */
    async initEmbeddingProvider() {
        if (this.embeddingProvider)
            return;
        try {
            this.embeddingProvider = await EmbeddingProviderFactory.getProvider(this.config.useLocalEmbedding);
            if (this.config.verbose) {
                const providerName = this.embeddingProvider?.getProviderName?.() ?? 'unknown';
                console.log(`[CapabilityIndex] Using ${providerName} provider`);
            }
        }
        catch (error) {
            throw new CapabilityIndexError('Failed to initialize embedding provider', 'initialize', 0, undefined, error);
        }
    }
    /**
     * Initialize the index with agents from registry
     * Per RULE-DAI-003-004: Sync with AgentRegistry
     * Per INT-002: Store agent embeddings
     *
     * @throws CapabilityIndexError if initialization fails
     */
    async initialize() {
        if (this.initialized) {
            if (this.config.verbose) {
                console.log('[CapabilityIndex] Already initialized, skipping');
            }
            return;
        }
        const startTime = performance.now();
        try {
            // Initialize embedding provider
            await this.initEmbeddingProvider();
            // Initialize agent registry
            if (!this.agentRegistry.isInitialized) {
                await this.agentRegistry.initialize(this.config.agentsPath);
            }
            // Build initial index
            await this.rebuild();
            this.initialized = true;
            const duration = performance.now() - startTime;
            if (this.config.verbose) {
                console.log(`[CapabilityIndex] Initialized with ${this.capabilities.size} agents in ${duration.toFixed(2)}ms`);
            }
        }
        catch (error) {
            throw new CapabilityIndexError('Failed to initialize capability index', 'initialize', this.capabilities.size, undefined, error);
        }
    }
    /**
     * Rebuild the index from scratch
     * Loads all agents from registry and re-indexes using batched embedding requests
     *
     * Performance target: < 10s for 200 agents
     *
     * @throws CapabilityIndexError if rebuild fails
     */
    async rebuild() {
        const startTime = performance.now();
        try {
            // Clear existing index
            this.capabilities.clear();
            await this.vectorDB.clear();
            // Get all agents from registry
            const agents = this.agentRegistry.getAll();
            const batchSize = this.config.embeddingBatchSize;
            const batchDelay = this.config.embeddingBatchDelayMs;
            if (this.config.verbose) {
                console.log(`[CapabilityIndex] Rebuilding index for ${agents.length} agents (batch size: ${batchSize})`);
            }
            // Process agents in batches to avoid rate limiting
            for (let i = 0; i < agents.length; i += batchSize) {
                const batch = agents.slice(i, i + batchSize);
                // Index batch
                await this.indexAgentBatch(batch);
                // Delay between batches to avoid overwhelming the embedding service
                if (i + batchSize < agents.length && batchDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, batchDelay));
                }
            }
            this.lastSyncTime = Date.now();
            const duration = performance.now() - startTime;
            if (this.config.verbose) {
                console.log(`[CapabilityIndex] Rebuild complete: ${this.capabilities.size} agents indexed in ${duration.toFixed(2)}ms`);
            }
            // Check performance target
            if (duration > 10000) {
                console.warn(`[CapabilityIndex] Rebuild exceeded 10s target: ${duration.toFixed(2)}ms`);
            }
        }
        catch (error) {
            throw new CapabilityIndexError('Failed to rebuild capability index', 'rebuild', this.capabilities.size, undefined, error);
        }
    }
    /**
     * Index a batch of agents using batched embedding requests
     * Reduces API calls by embedding multiple texts in a single request
     *
     * @param agents - Array of agents to index
     */
    async indexAgentBatch(agents) {
        if (!this.embeddingProvider) {
            throw new Error('Embedding provider not initialized');
        }
        // Extract capability texts for all agents
        const capabilityTexts = agents.map(agent => this.extractCapabilityText(agent));
        // Generate embeddings in batch
        let embeddings;
        try {
            if (this.embeddingProvider.embedBatch) {
                embeddings = await this.embeddingProvider.embedBatch(capabilityTexts);
            }
            else {
                // Fallback to sequential if embedBatch not available
                embeddings = await Promise.all(capabilityTexts.map(text => this.embeddingProvider.embed(text)));
            }
        }
        catch (error) {
            // If batch fails, fall back to individual indexing
            if (this.config.verbose) {
                console.warn(`[CapabilityIndex] Batch embedding failed, falling back to individual: ${error}`);
            }
            for (const agent of agents) {
                try {
                    await this.indexAgent(agent);
                }
                catch (err) {
                    if (this.config.verbose) {
                        console.warn(`[CapabilityIndex] Failed to index agent ${agent.key}: ${err}`);
                    }
                }
            }
            return;
        }
        // Process each agent with its embedding
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            let embedding = embeddings[i];
            try {
                // Validate embedding exists and is not zero
                if (!embedding || embedding.length === 0) {
                    if (this.config.verbose) {
                        console.warn(`[CapabilityIndex] Missing embedding for ${agent.key}, retrying individually`);
                    }
                    try {
                        embedding = await this.embeddingProvider.embed(capabilityTexts[i]);
                    }
                    catch {
                        if (this.config.verbose) {
                            console.warn(`[CapabilityIndex] Retry failed for ${agent.key}, skipping`);
                        }
                        continue;
                    }
                }
                // Validate embedding - check for zero vectors
                const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
                if (norm < 0.001) {
                    // Zero or near-zero vector - try individual embedding
                    if (this.config.verbose) {
                        console.warn(`[CapabilityIndex] Zero vector for ${agent.key}, retrying individually`);
                    }
                    try {
                        embedding = await this.embeddingProvider.embed(capabilityTexts[i]);
                    }
                    catch {
                        if (this.config.verbose) {
                            console.warn(`[CapabilityIndex] Retry failed for ${agent.key}, skipping`);
                        }
                        continue;
                    }
                }
                // Normalize if not already normalized
                const finalNorm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
                if (Math.abs(finalNorm - 1.0) > 0.001 && finalNorm > 0) {
                    for (let j = 0; j < embedding.length; j++) {
                        embedding[j] /= finalNorm;
                    }
                }
                // Extract keywords, domains, and tools
                const keywords = this.extractKeywords(capabilityTexts[i]);
                const domains = this.extractDomains(agent);
                const tools = [];
                // Create capability definition
                const capability = {
                    agentKey: agent.key,
                    name: agent.frontmatter.name || agent.key,
                    description: agent.frontmatter.description || '',
                    domains,
                    keywords,
                    tools,
                    embedding,
                    successRate: 0.5,
                    taskCount: 0,
                    indexedAt: Date.now(),
                };
                // Store in index
                this.capabilities.set(agent.key, {
                    capability,
                    keywords: new Set(keywords),
                    domains: new Set(domains),
                });
                // Add to vector DB
                await this.vectorDB.insertWithId(agent.key, embedding);
            }
            catch (error) {
                if (this.config.verbose) {
                    console.warn(`[CapabilityIndex] Failed to index agent ${agent.key}: ${error}`);
                }
            }
        }
    }
    /**
     * Index a single agent
     *
     * @param agent - Agent definition to index
     * @throws Error if indexing fails
     */
    async indexAgent(agent) {
        if (!this.embeddingProvider) {
            throw new Error('Embedding provider not initialized');
        }
        // Extract capability text
        const capabilityText = this.extractCapabilityText(agent);
        // Generate embedding
        const embedding = await this.embeddingProvider.embed(capabilityText);
        // Extract keywords, domains, and tools
        const keywords = this.extractKeywords(capabilityText);
        const domains = this.extractDomains(agent);
        const tools = []; // Tools not available in frontmatter, use empty array
        // Create capability definition
        const capability = {
            agentKey: agent.key,
            name: agent.frontmatter.name || agent.key,
            description: agent.frontmatter.description || '',
            domains,
            keywords,
            tools,
            embedding,
            successRate: 0.5, // Default, will be updated by learning
            taskCount: 0,
            indexedAt: Date.now(),
        };
        // Store in index
        this.capabilities.set(agent.key, {
            capability,
            keywords: new Set(keywords),
            domains: new Set(domains),
        });
        // Add to vector DB
        await this.vectorDB.insertWithId(agent.key, embedding);
    }
    /**
     * Extract capability text from agent definition
     * Combines name, description, and capabilities
     *
     * @param agent - Agent definition
     * @returns Combined capability text
     */
    extractCapabilityText(agent) {
        const parts = [];
        // Add name
        if (agent.frontmatter.name) {
            parts.push(agent.frontmatter.name);
        }
        // Add description
        if (agent.frontmatter.description) {
            parts.push(agent.frontmatter.description);
        }
        // Add capabilities
        if (agent.frontmatter.capabilities && agent.frontmatter.capabilities.length > 0) {
            parts.push(agent.frontmatter.capabilities.join(' '));
        }
        // Add triggers (if available)
        if (agent.frontmatter.triggers && agent.frontmatter.triggers.length > 0) {
            parts.push(agent.frontmatter.triggers.join(' '));
        }
        return parts.join(' ');
    }
    /**
     * Extract keywords from capability text
     * Uses simple whitespace tokenization and lowercasing
     *
     * @param text - Capability text
     * @returns Array of keywords
     */
    extractKeywords(text) {
        const words = text
            .toLowerCase()
            .split(/\s+/)
            .map(w => w.replace(/[^a-z0-9]/g, ''))
            .filter(w => w.length >= 3); // Filter short words
        // Remove duplicates and return
        return Array.from(new Set(words));
    }
    /**
     * Extract domains from agent definition
     * Maps agent capabilities to task domains
     *
     * @param agent - Agent definition
     * @returns Array of task domains
     */
    extractDomains(agent) {
        const domains = new Set();
        const textLower = this.extractCapabilityText(agent).toLowerCase();
        // Domain keyword mapping
        const domainKeywords = {
            research: ['research', 'analyze', 'investigate', 'study', 'explore', 'find'],
            testing: ['test', 'verify', 'validate', 'check', 'qa', 'quality'],
            code: ['code', 'implement', 'build', 'develop', 'program', 'debug'],
            writing: ['write', 'document', 'author', 'compose', 'draft'],
            design: ['design', 'architect', 'plan', 'structure', 'model', 'observability', 'monitoring', 'telemetry', 'infrastructure'],
            review: ['review', 'audit', 'inspect', 'evaluate', 'grade'],
        };
        // Check for domain keywords
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            for (const keyword of keywords) {
                if (textLower.includes(keyword)) {
                    domains.add(domain);
                    break;
                }
            }
        }
        // Default to code if no domains found
        if (domains.size === 0) {
            domains.add('code');
        }
        return Array.from(domains);
    }
    /**
     * Add an agent to the index
     * Called when registry fires agentAdded event
     *
     * @param agentKey - Agent key to add
     */
    addAgent(agentKey) {
        const agent = this.agentRegistry.getByKey(agentKey);
        if (!agent) {
            if (this.config.verbose) {
                console.warn(`[CapabilityIndex] Agent ${agentKey} not found in registry`);
            }
            return;
        }
        this.indexAgent(agent).catch(error => {
            if (this.config.verbose) {
                console.warn(`[CapabilityIndex] Failed to add agent ${agentKey}: ${error}`);
            }
        });
    }
    /**
     * Remove an agent from the index
     * Called when registry fires agentRemoved event
     *
     * @param agentKey - Agent key to remove
     */
    async removeAgent(agentKey) {
        this.capabilities.delete(agentKey);
        await this.vectorDB.delete(agentKey);
    }
    /**
     * Search for matching agents by embedding
     * Returns top N matches ranked by cosine similarity
     *
     * @param embedding - Task embedding vector (768-dim, L2-normalized)
     * @param limit - Maximum number of results to return
     * @returns Array of capability matches sorted by combined score
     */
    async search(embedding, limit = 10) {
        // Verify freshness
        this.verifyFreshness();
        try {
            // Search vector DB
            const searchResults = await this.vectorDB.search(embedding, limit);
            // Map to capability matches
            const matches = [];
            for (const result of searchResults) {
                const entry = this.capabilities.get(result.id);
                if (!entry) {
                    if (this.config.verbose) {
                        console.warn(`[CapabilityIndex] Agent ${result.id} in VectorDB but not in index`);
                    }
                    continue;
                }
                const match = {
                    agentKey: entry.capability.agentKey,
                    name: entry.capability.name,
                    similarityScore: result.similarity, // Cosine similarity
                    keywordScore: 0, // Will be computed by routing engine
                    domainMatch: false, // Will be set by routing engine
                    combinedScore: result.similarity, // Default to similarity score
                    capability: entry.capability,
                };
                matches.push(match);
            }
            return matches;
        }
        catch (error) {
            throw new CapabilityIndexError('Search operation failed', 'search', this.capabilities.size, undefined, error);
        }
    }
    /**
     * Search for matching agents by domain
     * Returns agents that handle the specified domain
     *
     * @param domain - Task domain to match
     * @param limit - Maximum number of results to return
     * @returns Array of capability matches for the domain
     */
    searchByDomain(domain, limit = 10) {
        // Verify freshness
        this.verifyFreshness();
        const matches = [];
        for (const [agentKey, entry] of this.capabilities) {
            if (entry.domains.has(domain)) {
                const match = {
                    agentKey: entry.capability.agentKey,
                    name: entry.capability.name,
                    similarityScore: 0, // Not applicable for domain search
                    keywordScore: 0,
                    domainMatch: true,
                    combinedScore: entry.capability.successRate, // Rank by success rate
                    capability: entry.capability,
                };
                matches.push(match);
            }
        }
        // Sort by success rate (descending)
        matches.sort((a, b) => b.capability.successRate - a.capability.successRate);
        // Return top N
        return matches.slice(0, limit);
    }
    /**
     * Get last synchronization timestamp
     *
     * @returns Timestamp of last sync (milliseconds since epoch)
     */
    getLastSyncTime() {
        return this.lastSyncTime;
    }
    /**
     * Get total indexed agent count
     *
     * @returns Number of agents in index
     */
    getAgentCount() {
        return this.capabilities.size;
    }
    /**
     * Verify index freshness
     * Throws if index is stale (> 24h since last sync)
     *
     * @throws IndexSyncError if index is stale
     */
    verifyFreshness() {
        const timeSinceSync = Date.now() - this.lastSyncTime;
        if (timeSinceSync > this.config.freshnessThreshold) {
            throw new IndexSyncError(`Index is stale: ${(timeSinceSync / 1000 / 60 / 60).toFixed(1)}h since last sync`, 'freshness-check', this.lastSyncTime);
        }
    }
    /**
     * Get capability by agent key
     *
     * @param agentKey - Agent key
     * @returns Capability entry or undefined
     */
    getCapability(agentKey) {
        return this.capabilities.get(agentKey)?.capability;
    }
    /**
     * Get index statistics
     */
    getStats() {
        const domainCounts = {
            research: 0,
            testing: 0,
            code: 0,
            writing: 0,
            design: 0,
            review: 0,
        };
        for (const entry of this.capabilities.values()) {
            for (const domain of entry.domains) {
                domainCounts[domain]++;
            }
        }
        const timeSinceSync = Date.now() - this.lastSyncTime;
        return {
            agentCount: this.capabilities.size,
            lastSyncTime: this.lastSyncTime,
            timeSinceSync,
            isStale: timeSinceSync > this.config.freshnessThreshold,
            domains: domainCounts,
        };
    }
}
//# sourceMappingURL=capability-index.js.map