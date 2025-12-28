/**
 * CausalMemory - Main interface for hypergraph-based causal reasoning
 * Integrates hypergraph, traversal, and cycle detection for complete causal inference
 */
import { CausalHypergraph } from './causal-hypergraph.js';
import { CausalTraversal } from './causal-traversal.js';
/**
 * Main causal reasoning engine with persistence
 * Provides high-level API for causal inference and analysis
 */
export class CausalMemory {
    graph;
    traversal;
    memoryEngine;
    config;
    initialized = false;
    constructor(memoryEngine, config = {}) {
        this.memoryEngine = memoryEngine;
        this.graph = new CausalHypergraph();
        this.traversal = new CausalTraversal();
        this.config = {
            storageKey: config.storageKey ?? 'causal-graph',
            autoSave: config.autoSave ?? true,
            trackPerformance: config.trackPerformance ?? false,
        };
    }
    /**
     * Initialize CausalMemory by loading persisted graph
     * Must be called before using the instance
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Try to load existing graph from memory
            const stored = await this.memoryEngine.retrieve(this.config.storageKey);
            if (stored) {
                const serialized = JSON.parse(stored);
                this.graph = CausalHypergraph.fromJSON(serialized);
                console.log(`Loaded causal graph with ${this.graph.getNodes().length} nodes and ${this.graph.getLinks().length} links`);
            }
            else {
                console.log('No existing causal graph found, starting fresh');
            }
        }
        catch (error) {
            console.warn('Failed to load causal graph, starting fresh:', error);
            this.graph.clear();
        }
        this.initialized = true;
    }
    /**
     * Ensure initialized before operations
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('CausalMemory not initialized. Call initialize() first.');
        }
    }
    /**
     * Add a new node to the causal graph
     *
     * @param node - Causal node to add
     */
    async addNode(node) {
        this.ensureInitialized();
        this.graph.addNode(node);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Add a causal link (hyperedge) to the graph
     * Validates nodes exist and checks for cycles
     *
     * @param params - Link parameters
     * @returns The created causal link
     * @throws Error if validation fails or cycle detected
     */
    async addCausalLink(params) {
        this.ensureInitialized();
        const startTime = performance.now();
        const link = this.graph.addCausalLink(params);
        if (this.config.trackPerformance) {
            const elapsed = performance.now() - startTime;
            console.log(`Added causal link in ${elapsed.toFixed(2)}ms`);
        }
        if (this.config.autoSave) {
            await this.persist();
        }
        return link;
    }
    /**
     * Infer consequences (effects) from given conditions (causes)
     * Uses forward traversal through the causal graph
     *
     * @param conditions - Array of cause node IDs
     * @param maxDepth - Maximum traversal depth (default: 5)
     * @param options - Additional traversal options
     * @returns Inference result with predicted effects and causal chains
     */
    async inferConsequences(conditions, maxDepth = 5, options = {}) {
        this.ensureInitialized();
        const traversalOptions = {
            ...options,
            maxDepth,
            direction: 'forward',
        };
        const result = this.traversal.traverseForward(this.graph.getGraphStructure(), conditions, traversalOptions);
        // Add explanations to chains
        for (const chain of result.chains) {
            chain.explanation = this.traversal.buildChainExplanation(this.graph.getGraphStructure(), chain);
        }
        if (this.config.trackPerformance && result.traversalTime) {
            console.log(`Forward traversal completed in ${result.traversalTime.toFixed(2)}ms, ` +
                `explored ${result.nodesExplored} nodes, found ${result.chains.length} chains`);
        }
        return result;
    }
    /**
     * Find possible causes for a given effect
     * Uses backward traversal through the causal graph
     *
     * @param effect - Effect node ID
     * @param maxDepth - Maximum traversal depth (default: 5)
     * @param options - Additional traversal options
     * @returns Cause finding result with identified causes and causal chains
     */
    async findCauses(effect, maxDepth = 5, options = {}) {
        this.ensureInitialized();
        const traversalOptions = {
            ...options,
            maxDepth,
            direction: 'backward',
        };
        const result = this.traversal.traverseBackward(this.graph.getGraphStructure(), [effect], traversalOptions);
        // Add explanations to chains
        for (const chain of result.chains) {
            chain.explanation = this.traversal.buildChainExplanation(this.graph.getGraphStructure(), chain);
        }
        if (this.config.trackPerformance && result.traversalTime) {
            console.log(`Backward traversal completed in ${result.traversalTime.toFixed(2)}ms, ` +
                `explored ${result.nodesExplored} nodes, found ${result.chains.length} chains`);
        }
        return result;
    }
    /**
     * Get a node by ID
     */
    getNode(nodeId) {
        this.ensureInitialized();
        return this.graph.getNode(nodeId);
    }
    /**
     * Get a link by ID
     */
    getLink(linkId) {
        this.ensureInitialized();
        return this.graph.getLink(linkId);
    }
    /**
     * Get all nodes in the graph
     */
    getNodes() {
        this.ensureInitialized();
        return this.graph.getNodes();
    }
    /**
     * Get all links in the graph
     */
    getLinks() {
        this.ensureInitialized();
        return this.graph.getLinks();
    }
    /**
     * Get nodes by type
     */
    getNodesByType(type) {
        this.ensureInitialized();
        return this.graph.getNodes().filter((node) => node.type === type);
    }
    /**
     * Get outgoing links from a node
     */
    getOutgoingLinks(nodeId) {
        this.ensureInitialized();
        return this.graph.getOutgoingLinks(nodeId);
    }
    /**
     * Get incoming links to a node
     */
    getIncomingLinks(nodeId) {
        this.ensureInitialized();
        return this.graph.getIncomingLinks(nodeId);
    }
    /**
     * Update an existing node
     */
    async updateNode(nodeId, updates) {
        this.ensureInitialized();
        this.graph.updateNode(nodeId, updates);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Update an existing link
     */
    async updateLink(linkId, updates) {
        this.ensureInitialized();
        this.graph.updateLink(linkId, updates);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Remove a node and all connected links
     */
    async removeNode(nodeId) {
        this.ensureInitialized();
        this.graph.removeNode(nodeId);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Remove a link
     */
    async removeLink(linkId) {
        this.ensureInitialized();
        this.graph.removeLink(linkId);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Get statistics about the causal graph
     */
    getStats() {
        this.ensureInitialized();
        return this.graph.getStats();
    }
    /**
     * Search for nodes by label (case-insensitive partial match)
     */
    searchNodes(query) {
        this.ensureInitialized();
        const lowerQuery = query.toLowerCase();
        return this.graph.getNodes().filter((node) => node.label.toLowerCase().includes(lowerQuery));
    }
    /**
     * Find all nodes that are root causes (no incoming links)
     */
    getRootCauses() {
        this.ensureInitialized();
        return this.graph.getNodes().filter((node) => {
            const incoming = this.graph.getIncomingLinks(node.id);
            return incoming.length === 0;
        });
    }
    /**
     * Find all nodes that are terminal effects (no outgoing links)
     */
    getTerminalEffects() {
        this.ensureInitialized();
        return this.graph.getNodes().filter((node) => {
            const outgoing = this.graph.getOutgoingLinks(node.id);
            return outgoing.length === 0;
        });
    }
    /**
     * Persist the causal graph to memory
     */
    async persist() {
        this.ensureInitialized();
        const serialized = this.graph.toJSON();
        const value = JSON.stringify(serialized);
        // Use store with namespace for causal graph
        await this.memoryEngine.store(this.config.storageKey, value, { namespace: 'research' });
    }
    /**
     * Clear all data from the causal graph
     */
    async clear() {
        this.ensureInitialized();
        this.graph.clear();
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Export the graph as JSON
     */
    export() {
        this.ensureInitialized();
        return JSON.stringify(this.graph.toJSON(), null, 2);
    }
    /**
     * Import a graph from JSON
     */
    async import(jsonData) {
        this.ensureInitialized();
        const data = JSON.parse(jsonData);
        this.graph = CausalHypergraph.fromJSON(data);
        if (this.config.autoSave) {
            await this.persist();
        }
    }
    /**
     * Get the underlying hypergraph (for advanced use)
     */
    getHypergraph() {
        this.ensureInitialized();
        return this.graph;
    }
    /**
     * Validate graph integrity
     * Checks for orphaned links, invalid references, etc.
     */
    validateIntegrity() {
        this.ensureInitialized();
        const errors = [];
        const nodeIds = new Set(this.graph.getNodes().map((n) => n.id));
        for (const link of this.graph.getLinks()) {
            // Check all causes exist
            for (const causeId of link.causes) {
                if (!nodeIds.has(causeId)) {
                    errors.push(`Link ${link.id} references non-existent cause: ${causeId}`);
                }
            }
            // Check all effects exist
            for (const effectId of link.effects) {
                if (!nodeIds.has(effectId)) {
                    errors.push(`Link ${link.id} references non-existent effect: ${effectId}`);
                }
            }
            // Validate confidence and strength
            if (link.confidence < 0 || link.confidence > 1) {
                errors.push(`Link ${link.id} has invalid confidence: ${link.confidence}`);
            }
            if (link.strength < 0 || link.strength > 1) {
                errors.push(`Link ${link.id} has invalid strength: ${link.strength}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
//# sourceMappingURL=causal-memory.js.map