/**
 * GraphDB - Hypergraph Database with Temporal Features
 * Supports hyperedges (n-ary relationships), temporal expiration, and embedding validation
 */
import { randomUUID } from 'crypto';
import { GraphDimensionMismatchError } from '../validation/index.js';
import { FallbackGraph } from './fallback-graph.js';
import { NodeNotFoundError, InvalidHyperedgeError, OrphanNodeError } from './errors.js';
import { QueryDirection } from './types.js';
const DEFAULT_OPTIONS = {
    dataDir: '.agentdb/graphs',
    enablePersistence: true,
    lockTimeout: 5000,
    validateDimensions: true,
    expectedDimensions: 1536
};
/**
 * GraphDB - Main hypergraph database class
 */
export class GraphDB {
    backend;
    options;
    // RTF-001: Root namespace constants for orphan prevention
    static ROOT_NAMESPACES = ['project', 'research', 'patterns'];
    static GRAPH_ROOT_ID = 'graph:root';
    constructor(backend, options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        // Use provided backend or create FallbackGraph
        this.backend = backend || new FallbackGraph(this.options.dataDir, this.options.lockTimeout, this.options.enablePersistence);
    }
    /**
     * Initialize the database (load persisted data)
     */
    async initialize() {
        if (this.backend.load) {
            await this.backend.load();
        }
        // RTF-001-T05: graph:root created on-demand by ensureGraphRoot()
        // when first root namespace node needs a parent
    }
    // RTF-001-T02: Extract namespace from node key (e.g., "project/api" -> "project")
    extractNamespace(key) {
        const parts = key.split('/');
        return parts[0] || key;
    }
    // RTF-001-T02: Check if namespace is a root namespace
    isRootNamespace(namespace) {
        return GraphDB.ROOT_NAMESPACES.includes(namespace);
    }
    // RTF-001-T02: Find existing node in same root namespace
    async findExistingRootNode(namespace) {
        const nodes = await this.backend.getAllNodes();
        return nodes.find(n => {
            const key = n.properties?.key;
            return key && this.extractNamespace(key) === namespace;
        });
    }
    // RTF-001-T04: Ensure graph:root node exists, create if needed
    async ensureGraphRoot() {
        const nodes = await this.backend.getAllNodes();
        const graphRoot = nodes.find(n => n.properties?.key === GraphDB.GRAPH_ROOT_ID);
        if (graphRoot) {
            return graphRoot.id;
        }
        // Create graph:root node
        const nodeId = randomUUID();
        const now = Date.now();
        const rootNode = {
            id: nodeId,
            type: 'system',
            properties: {
                key: GraphDB.GRAPH_ROOT_ID,
                created: now,
                purpose: 'Graph root node for orphan prevention'
            },
            createdAt: now,
            updatedAt: now
        };
        await this.backend.insertNode(rootNode);
        console.log(`[GraphDB] Created graph root node: ${GraphDB.GRAPH_ROOT_ID}`);
        return nodeId;
    }
    /**
     * Create a node with optional embedding
     * Enforces non-orphan constraint: first node or must link to existing node
     */
    async createNode(options) {
        const { type, properties = {}, embedding, linkTo } = options;
        // Validate embedding dimensions if provided
        if (embedding && this.options.validateDimensions) {
            if (embedding.length !== this.options.expectedDimensions) {
                throw new GraphDimensionMismatchError(this.options.expectedDimensions, embedding.length, 'GraphDB.createNode');
            }
        }
        // RTF-001-T03: Upsert logic - check if node with same key exists
        const existingNodes = await this.backend.getAllNodes();
        const nodeKey = properties?.key;
        if (nodeKey) {
            const existingNode = existingNodes.find(n => n.properties?.key === nodeKey);
            if (existingNode) {
                // Upsert: update existing node instead of creating new one
                console.log(`[GraphDB] Upserting existing node with key: ${nodeKey}`);
                await this.updateNode(existingNode.id, { properties, embedding });
                return existingNode.id;
            }
        }
        // RTF-001-T04: Smart orphan constraint with root namespace auto-linking
        let effectiveLinkTo = linkTo;
        if (existingNodes.length > 0 && !linkTo) {
            const namespace = nodeKey ? this.extractNamespace(nodeKey) : undefined;
            // Check if key is in root namespace or is a root-level key (no namespace separator)
            const isRootLevelKey = nodeKey && !nodeKey.includes('/');
            if (isRootLevelKey || (namespace && this.isRootNamespace(namespace))) {
                // Root-level key or root namespace node - auto-link to graph:root or existing root node
                if (namespace && this.isRootNamespace(namespace)) {
                    const existingRootNode = await this.findExistingRootNode(namespace);
                    if (existingRootNode) {
                        effectiveLinkTo = existingRootNode.id;
                        console.log(`[GraphDB] Auto-linking to existing root node: ${existingRootNode.id}`);
                    }
                    else {
                        effectiveLinkTo = await this.ensureGraphRoot();
                        console.log(`[GraphDB] Auto-linking to graph root: ${effectiveLinkTo}`);
                    }
                }
                else {
                    // Root-level key without namespace - link to graph:root
                    effectiveLinkTo = await this.ensureGraphRoot();
                    console.log(`[GraphDB] Auto-linking root-level key to graph root: ${effectiveLinkTo}`);
                }
            }
            else {
                // Non-root namespace without linkTo - still an error
                throw new OrphanNodeError();
            }
        }
        // Verify linkTo node exists if provided
        if (effectiveLinkTo) {
            const exists = await this.backend.nodeExists(effectiveLinkTo);
            if (!exists) {
                throw new NodeNotFoundError(effectiveLinkTo);
            }
        }
        const nodeId = randomUUID();
        const now = Date.now();
        const node = {
            id: nodeId,
            type,
            properties,
            embedding,
            createdAt: now,
            updatedAt: now
        };
        await this.backend.insertNode(node);
        // Create edge to linkTo node if provided (or auto-linked for root namespaces)
        if (effectiveLinkTo) {
            await this.createEdge({
                source: nodeId,
                target: effectiveLinkTo,
                type: 'linked_to'
            });
        }
        return nodeId;
    }
    /**
     * Get a node by ID
     */
    async getNode(id) {
        const node = await this.backend.getNode(id);
        if (!node) {
            throw new NodeNotFoundError(id);
        }
        return node;
    }
    /**
     * Update node properties
     */
    async updateNode(id, properties) {
        const node = await this.getNode(id); // Throws if not found
        await this.backend.updateNode(id, {
            properties: { ...node.properties, ...properties }
        });
    }
    /**
     * Update node embedding
     */
    async updateEmbedding(id, embedding) {
        if (this.options.validateDimensions) {
            if (embedding.length !== this.options.expectedDimensions) {
                throw new GraphDimensionMismatchError(this.options.expectedDimensions, embedding.length, 'GraphDB.updateEmbedding');
            }
        }
        await this.backend.updateNode(id, { embedding });
    }
    /**
     * Create a binary edge between two nodes
     */
    async createEdge(options) {
        const { source, target, type, metadata } = options;
        // Verify both nodes exist
        const sourceExists = await this.backend.nodeExists(source);
        const targetExists = await this.backend.nodeExists(target);
        if (!sourceExists)
            throw new NodeNotFoundError(source);
        if (!targetExists)
            throw new NodeNotFoundError(target);
        const edgeId = randomUUID();
        const edge = {
            id: edgeId,
            source,
            target,
            type,
            metadata,
            createdAt: Date.now()
        };
        await this.backend.insertEdge(edge);
        return edgeId;
    }
    /**
     * Get edges connected to a node
     */
    async getEdges(nodeId, direction = QueryDirection.Both) {
        const startTime = Date.now();
        // Verify node exists
        await this.getNode(nodeId); // Throws if not found
        const edges = await this.backend.getEdges(nodeId, direction);
        const executionTimeMs = Date.now() - startTime;
        return {
            data: edges,
            count: edges.length,
            executionTimeMs
        };
    }
    /**
     * Create a hyperedge connecting 3+ nodes
     */
    async createHyperedge(options) {
        const { nodes, type, metadata } = options;
        // Validate hyperedge constraint (3+ nodes)
        if (nodes.length < 3) {
            throw new InvalidHyperedgeError(nodes.length);
        }
        // Verify all nodes exist
        for (const nodeId of nodes) {
            const exists = await this.backend.nodeExists(nodeId);
            if (!exists) {
                throw new NodeNotFoundError(nodeId);
            }
        }
        const hyperedgeId = randomUUID();
        const hyperedge = {
            id: hyperedgeId,
            nodes,
            type,
            metadata,
            createdAt: Date.now()
        };
        await this.backend.insertHyperedge(hyperedge);
        return hyperedgeId;
    }
    /**
     * Create a temporal hyperedge with expiration
     */
    async createTemporalHyperedge(options) {
        const { nodes, type, metadata, expiresAt, granularity } = options;
        // Validate hyperedge constraint (3+ nodes)
        if (nodes.length < 3) {
            throw new InvalidHyperedgeError(nodes.length);
        }
        // Verify all nodes exist
        for (const nodeId of nodes) {
            const exists = await this.backend.nodeExists(nodeId);
            if (!exists) {
                throw new NodeNotFoundError(nodeId);
            }
        }
        const hyperedgeId = randomUUID();
        const now = Date.now();
        const temporalHyperedge = {
            id: hyperedgeId,
            nodes,
            type,
            metadata,
            createdAt: now,
            expiresAt,
            granularity,
            isExpired: expiresAt <= now
        };
        await this.backend.insertHyperedge(temporalHyperedge);
        return hyperedgeId;
    }
    /**
     * Get hyperedge by ID
     */
    async getHyperedge(id) {
        const hyperedge = await this.backend.getHyperedge(id);
        if (!hyperedge) {
            throw new Error(`Hyperedge not found: ${id}`);
        }
        // Update isExpired for temporal hyperedges
        if (this.isTemporalHyperedge(hyperedge)) {
            hyperedge.isExpired = hyperedge.expiresAt <= Date.now();
        }
        return hyperedge;
    }
    /**
     * Get all hyperedges in the graph
     */
    async getAllHyperedges() {
        const hyperedges = await this.backend.getAllHyperedges();
        // Update isExpired for temporal hyperedges
        const now = Date.now();
        hyperedges.forEach(h => {
            if (this.isTemporalHyperedge(h)) {
                h.isExpired = h.expiresAt <= now;
            }
        });
        return hyperedges;
    }
    /**
     * Get hyperedges connected to a node
     */
    async getHyperedgesByNode(nodeId) {
        const startTime = Date.now();
        // Verify node exists
        await this.getNode(nodeId); // Throws if not found
        const hyperedges = await this.backend.getHyperedgesByNode(nodeId);
        // Update isExpired for temporal hyperedges
        const now = Date.now();
        hyperedges.forEach(h => {
            if (this.isTemporalHyperedge(h)) {
                h.isExpired = h.expiresAt <= now;
            }
        });
        const executionTimeMs = Date.now() - startTime;
        return {
            data: hyperedges,
            count: hyperedges.length,
            executionTimeMs
        };
    }
    /**
     * Validate graph integrity
     * Returns report with orphan nodes, invalid hyperedges, expired temporal edges, etc.
     */
    async validateIntegrity() {
        const nodes = await this.backend.getAllNodes();
        const edges = await this.backend.getAllEdges();
        const hyperedges = await this.backend.getAllHyperedges();
        const orphanNodes = [];
        const invalidHyperedges = [];
        const expiredTemporalHyperedges = [];
        const dimensionMismatches = [];
        const now = Date.now();
        // Check for orphan nodes (no edges or hyperedges)
        for (const node of nodes) {
            const hasEdge = edges.some(e => e.source === node.id || e.target === node.id);
            const hasHyperedge = hyperedges.some(h => h.nodes.includes(node.id));
            if (!hasEdge && !hasHyperedge && nodes.length > 1) {
                orphanNodes.push(node.id);
            }
            // Check embedding dimensions
            if (node.embedding && this.options.validateDimensions) {
                if (node.embedding.length !== this.options.expectedDimensions) {
                    dimensionMismatches.push(node.id);
                }
            }
        }
        // Check for invalid hyperedges (< 3 nodes)
        for (const hyperedge of hyperedges) {
            if (hyperedge.nodes.length < 3) {
                invalidHyperedges.push(hyperedge.id);
            }
            // Check for expired temporal hyperedges
            if (this.isTemporalHyperedge(hyperedge)) {
                if (hyperedge.expiresAt <= now) {
                    expiredTemporalHyperedges.push(hyperedge.id);
                }
            }
        }
        const isValid = orphanNodes.length === 0 &&
            invalidHyperedges.length === 0 &&
            dimensionMismatches.length === 0;
        return {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            totalHyperedges: hyperedges.length,
            orphanNodes,
            invalidHyperedges,
            expiredTemporalHyperedges,
            dimensionMismatches,
            isValid,
            timestamp: now
        };
    }
    /**
     * Perform multi-hop traversal (for future query implementation)
     */
    async traverseHops(startNodeId, hops) {
        const startTime = Date.now();
        const visited = new Set();
        const queue = [{ nodeId: startNodeId, depth: 0 }];
        // Verify start node exists
        await this.getNode(startNodeId); // Throws if not found
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.depth > hops)
                break;
            if (visited.has(current.nodeId))
                continue;
            visited.add(current.nodeId);
            if (current.depth < hops) {
                // Get connected nodes via edges
                const outgoingEdges = await this.backend.getEdges(current.nodeId, QueryDirection.Outgoing);
                for (const edge of outgoingEdges) {
                    if (!visited.has(edge.target)) {
                        queue.push({ nodeId: edge.target, depth: current.depth + 1 });
                    }
                }
                const incomingEdges = await this.backend.getEdges(current.nodeId, QueryDirection.Incoming);
                for (const edge of incomingEdges) {
                    if (!visited.has(edge.source)) {
                        queue.push({ nodeId: edge.source, depth: current.depth + 1 });
                    }
                }
                // Get connected nodes via hyperedges
                const hyperedges = await this.backend.getHyperedgesByNode(current.nodeId);
                for (const hyperedge of hyperedges) {
                    for (const nodeId of hyperedge.nodes) {
                        if (!visited.has(nodeId)) {
                            queue.push({ nodeId, depth: current.depth + 1 });
                        }
                    }
                }
            }
        }
        const executionTimeMs = Date.now() - startTime;
        return {
            data: Array.from(visited),
            count: visited.size,
            executionTimeMs
        };
    }
    /**
     * Get the total number of nodes in the graph
     */
    async nodeCount() {
        const nodes = await this.backend.getAllNodes();
        return nodes.length;
    }
    /**
     * Get the total number of edges in the graph
     */
    async edgeCount() {
        const edges = await this.backend.getAllEdges();
        return edges.length;
    }
    /**
     * Clear all data
     */
    async clear() {
        await this.backend.clear();
    }
    // ============================================================================
    // NEW PUBLIC API METHODS (SPEC-TYP-001)
    // ============================================================================
    /**
     * Query nodes with flexible filtering
     * @param filter - Node filter criteria
     * @returns Array of matching node data
     */
    async queryNodes(filter) {
        let nodes = await this.backend.getAllNodes();
        // Convert INode to INodeData format
        let nodeData = nodes.map(node => ({
            id: node.id,
            key: node.properties.key || '',
            namespace: node.properties.namespace,
            vectorId: node.properties.vectorId,
            metadata: node.properties.metadata,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
        }));
        // Apply filters
        if (filter.namespace) {
            nodeData = nodeData.filter(n => n.namespace === filter.namespace);
        }
        if (filter.keyPattern) {
            const regex = new RegExp(filter.keyPattern);
            nodeData = nodeData.filter(n => regex.test(n.key));
        }
        if (filter.createdAfter) {
            nodeData = nodeData.filter(n => n.createdAt > filter.createdAfter);
        }
        if (filter.createdBefore) {
            nodeData = nodeData.filter(n => n.createdAt < filter.createdBefore);
        }
        if (filter.hasVectorId !== undefined) {
            nodeData = nodeData.filter(n => filter.hasVectorId ? !!n.vectorId : !n.vectorId);
        }
        // Apply pagination
        if (filter.offset) {
            nodeData = nodeData.slice(filter.offset);
        }
        if (filter.limit) {
            nodeData = nodeData.slice(0, filter.limit);
        }
        return nodeData;
    }
    /**
     * Get a single node by ID
     * @param nodeId - Node ID to retrieve
     * @returns Node data or null if not found
     */
    async getNodeById(nodeId) {
        const node = await this.backend.getNode(nodeId);
        if (!node) {
            return null;
        }
        return {
            id: node.id,
            key: node.properties.key || '',
            namespace: node.properties.namespace,
            vectorId: node.properties.vectorId,
            metadata: node.properties.metadata,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
        };
    }
    /**
     * Get a node by key and optional namespace
     * @param key - Node key to search for
     * @param namespace - Optional namespace to filter by
     * @returns Node data or null if not found
     */
    async getNodeByKey(key, namespace) {
        const nodes = await this.queryNodes({
            keyPattern: `^${this.escapeRegex(key)}$`,
            namespace
        });
        return nodes[0] || null;
    }
    /**
     * Get all nodes in a namespace
     * @param namespace - Namespace to filter by
     * @returns Array of node data in the namespace
     */
    async getNodesByNamespace(namespace) {
        return this.queryNodes({ namespace });
    }
    /**
     * Get all nodes in the database
     * Use sparingly - prefer queryNodes with filters for large datasets
     * @returns Array of all node data
     */
    async getAllNodes() {
        return this.queryNodes({});
    }
    /**
     * Query edges with flexible filtering
     * @param filter - Edge filter criteria
     * @returns Array of matching edge data
     */
    async queryEdges(filter) {
        let edges = await this.backend.getAllEdges();
        // Apply filters
        if (filter.nodeId) {
            edges = edges.filter(e => e.source === filter.nodeId || e.target === filter.nodeId);
        }
        if (filter.type) {
            edges = edges.filter(e => e.type === filter.type);
        }
        // Convert to IEdgeData format
        return edges.map(edge => ({
            id: edge.id,
            type: edge.type,
            nodeIds: [edge.source, edge.target],
            weight: edge.metadata?.weight,
            metadata: edge.metadata,
            createdAt: edge.createdAt
        }));
    }
    /**
     * Get a single edge by ID
     * @param edgeId - Edge ID to retrieve
     * @returns Edge data or null if not found
     */
    async getEdgeById(edgeId) {
        const edge = await this.backend.getEdge(edgeId);
        if (!edge) {
            return null;
        }
        return {
            id: edge.id,
            type: edge.type,
            nodeIds: [edge.source, edge.target],
            weight: edge.metadata?.weight,
            metadata: edge.metadata,
            createdAt: edge.createdAt
        };
    }
    /**
     * Get all edges connected to a node
     * @param nodeId - Node ID to get edges for
     * @returns Array of edge data
     */
    async getEdgesForNode(nodeId) {
        return this.queryEdges({ nodeId });
    }
    /**
     * Delete a node and all its connected edges
     * @param nodeId - Node ID to delete
     * @returns True if deleted, false if not found
     */
    async deleteNode(nodeId) {
        try {
            // Verify node exists
            const exists = await this.backend.nodeExists(nodeId);
            if (!exists) {
                return false;
            }
            // Delete all connected edges first
            const edges = await this.getEdgesForNode(nodeId);
            for (const edge of edges) {
                await this.backend.deleteEdge(edge.id);
            }
            // Delete the node
            await this.backend.deleteNode(nodeId);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete node ${nodeId}:`, error);
            return false;
        }
    }
    /**
     * Delete an edge
     * @param edgeId - Edge ID to delete
     * @returns True if deleted, false if not found
     */
    async deleteEdge(edgeId) {
        try {
            const edge = await this.backend.getEdge(edgeId);
            if (!edge) {
                return false;
            }
            await this.backend.deleteEdge(edgeId);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete edge ${edgeId}:`, error);
            return false;
        }
    }
    /**
     * Count nodes matching the filter
     * @param filter - Optional filter criteria
     * @returns Number of matching nodes
     */
    async countNodes(filter) {
        if (!filter) {
            const nodes = await this.backend.getAllNodes();
            return nodes.length;
        }
        const nodes = await this.queryNodes(filter);
        return nodes.length;
    }
    /**
     * Check if a node exists by key and optional namespace
     * @param key - Node key to check
     * @param namespace - Optional namespace to filter by
     * @returns True if node exists, false otherwise
     */
    async nodeExists(key, namespace) {
        const node = await this.getNodeByKey(key, namespace);
        return node !== null;
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    /**
     * Escape special regex characters in a string
     * @param str - String to escape
     * @returns Escaped string safe for regex
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Type guard for temporal hyperedges
     */
    isTemporalHyperedge(hyperedge) {
        return 'expiresAt' in hyperedge && 'granularity' in hyperedge;
    }
}
//# sourceMappingURL=graph-db.js.map