/**
 * Graph Service - IPC wrapper for GraphDB
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes graph database operations via JSON-RPC 2.0
 */
import { createServiceHandler } from '../service-registry.js';
/**
 * Create graph service handler
 *
 * @param graphDB - GraphDB instance
 * @returns Service handler with method map
 */
export function createGraphService(graphDB) {
    return createServiceHandler({
        /**
         * Add node to graph
         */
        addNode: async (params) => {
            const { type, properties = {}, embedding, linkTo } = params;
            if (!type) {
                throw new Error('type is required');
            }
            const options = {
                type,
                properties,
                linkTo: linkTo,
            };
            // Add embedding if provided (already in number[] format)
            if (embedding) {
                options.embedding = embedding;
            }
            const nodeId = await graphDB.createNode(options);
            return { nodeId };
        },
        /**
         * Get node by ID
         */
        getNode: async (params) => {
            const { id } = params;
            if (!id) {
                throw new Error('id is required');
            }
            const node = await graphDB.getNodeById(id);
            return node || { found: false };
        },
        /**
         * Add edge between nodes
         */
        addEdge: async (params) => {
            const { source, target, type, metadata } = params;
            if (!source || !target || !type) {
                throw new Error('source, target, and type are required');
            }
            const options = {
                source: source,
                target: target,
                type,
                metadata,
            };
            const edgeId = await graphDB.createEdge(options);
            return { edgeId };
        },
        /**
         * Query nodes with filters
         */
        query: async (params) => {
            const nodes = await graphDB.queryNodes(params);
            return { nodes };
        },
        /**
         * Traverse graph with N hops
         */
        traverse: async (params) => {
            const { startNodeId, depth } = params;
            if (!startNodeId || depth === undefined) {
                throw new Error('startNodeId and depth are required');
            }
            const result = await graphDB.traverseHops(startNodeId, depth);
            return {
                nodeIds: result.data,
                count: result.count,
                executionTimeMs: result.executionTimeMs,
            };
        },
        /**
         * Get graph statistics
         */
        stats: async () => {
            const nodeCount = await graphDB.nodeCount();
            const edgeCount = await graphDB.edgeCount();
            return { nodeCount, edgeCount };
        },
        /**
         * Clear all graph data
         */
        clear: async () => {
            await graphDB.clear();
            return { success: true };
        },
    });
}
//# sourceMappingURL=graph-service.js.map