/**
 * Hyperedge Service - Real implementation delegating to GraphDB
 * TASK-DAEMON-002: Hyperedge Service Implementation (GAP-ADV-001 fix)
 *
 * Provides IPC service layer for hyperedge operations via JSON-RPC 2.0.
 * All methods delegate to the injected GraphDB instance for actual storage operations.
 */
import { createServiceHandler } from '../service-registry.js';
/**
 * Type guard for temporal hyperedges
 */
function isTemporalHyperedge(hyperedge) {
    return 'expiresAt' in hyperedge && 'granularity' in hyperedge;
}
/**
 * Convert IHyperedge or ITemporalHyperedge to HyperedgeData
 */
function toHyperedgeData(hyperedge) {
    const data = {
        id: hyperedge.id,
        nodes: hyperedge.nodes,
        type: hyperedge.type,
        metadata: hyperedge.metadata,
        createdAt: hyperedge.createdAt,
    };
    if (isTemporalHyperedge(hyperedge)) {
        data.expiresAt = hyperedge.expiresAt;
        data.granularity = hyperedge.granularity;
        data.isExpired = hyperedge.isExpired;
    }
    return data;
}
/**
 * Create hyperedge service handler with real GraphDB delegation
 *
 * @param graphDb - Injected GraphDB instance for actual storage operations
 * @returns Service handler with methods for create, createTemporal, query, expand, and stats
 */
export function createHyperedgeService(graphDb) {
    return createServiceHandler({
        /**
         * Create a new hyperedge
         * Delegates to graphDb.createHyperedge()
         */
        create: async (params) => {
            const hyperedgeId = await graphDb.createHyperedge({
                nodes: params.nodes,
                type: params.type,
                metadata: params.metadata,
            });
            return { hyperedgeId };
        },
        /**
         * Create a temporal hyperedge with expiration
         * Delegates to graphDb.createTemporalHyperedge()
         */
        createTemporal: async (params) => {
            const hyperedgeId = await graphDb.createTemporalHyperedge({
                nodes: params.nodes,
                type: params.type,
                metadata: params.metadata,
                expiresAt: params.expiresAt,
                granularity: params.granularity,
            });
            return { hyperedgeId };
        },
        /**
         * Query hyperedges by node or get all
         * Routes to graphDb.getHyperedgesByNode() or graphDb.getAllHyperedges()
         */
        query: async (params) => {
            const startTime = Date.now();
            let hyperedges;
            if (params.queryType === 'byNode') {
                if (!params.nodeId) {
                    throw new Error('nodeId required for byNode query');
                }
                const result = await graphDb.getHyperedgesByNode(params.nodeId);
                hyperedges = result.data;
            }
            else if (params.queryType === 'all') {
                hyperedges = await graphDb.getAllHyperedges();
            }
            else {
                throw new Error(`Unknown queryType: ${params.queryType}. Use 'byNode' or 'all'.`);
            }
            // Filter expired if not requested
            if (!params.includeExpired) {
                hyperedges = hyperedges.filter((h) => {
                    if (isTemporalHyperedge(h)) {
                        return !h.isExpired;
                    }
                    return true;
                });
            }
            // Apply limit
            if (params.limit && params.limit > 0) {
                hyperedges = hyperedges.slice(0, params.limit);
            }
            const executionTimeMs = Date.now() - startTime;
            return {
                hyperedges: hyperedges.map(toHyperedgeData),
                count: hyperedges.length,
                executionTimeMs,
            };
        },
        /**
         * Expand a hyperedge to get its full details
         * Delegates to graphDb.getHyperedge()
         */
        expand: async (params) => {
            try {
                const hyperedge = await graphDb.getHyperedge(params.hyperedgeId);
                return {
                    hyperedgeId: hyperedge.id,
                    nodes: hyperedge.nodes,
                    type: hyperedge.type,
                    metadata: hyperedge.metadata,
                    found: true,
                };
            }
            catch (error) {
                // Hyperedge not found
                return {
                    hyperedgeId: params.hyperedgeId,
                    nodes: [],
                    type: '',
                    metadata: undefined,
                    found: false,
                };
            }
        },
        /**
         * Get hyperedge statistics
         * Computes stats from graphDb.getAllHyperedges()
         */
        stats: async () => {
            const allHyperedges = await graphDb.getAllHyperedges();
            let temporalCount = 0;
            let expiredCount = 0;
            let totalNodeReferences = 0;
            for (const hyperedge of allHyperedges) {
                totalNodeReferences += hyperedge.nodes.length;
                if (isTemporalHyperedge(hyperedge)) {
                    temporalCount++;
                    if (hyperedge.isExpired) {
                        expiredCount++;
                    }
                }
            }
            return {
                hyperedgeCount: allHyperedges.length,
                temporalCount,
                expiredCount,
                totalNodeReferences,
            };
        },
        /**
         * Get a single hyperedge by ID
         * Delegates to graphDb.getHyperedge()
         */
        get: async (params) => {
            try {
                const hyperedge = await graphDb.getHyperedge(params.id);
                return {
                    found: true,
                    hyperedge: toHyperedgeData(hyperedge),
                };
            }
            catch {
                // INTENTIONAL: Hyperedge not found - return not found response to caller
                return {
                    found: false,
                    hyperedge: null,
                };
            }
        },
    });
}
//# sourceMappingURL=hyperedge-service.js.map