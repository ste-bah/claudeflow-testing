/**
 * Hyperedge Service - Real implementation delegating to GraphDB
 * TASK-DAEMON-002: Hyperedge Service Implementation (GAP-ADV-001 fix)
 *
 * Provides IPC service layer for hyperedge operations via JSON-RPC 2.0.
 * All methods delegate to the injected GraphDB instance for actual storage operations.
 */
import { type ServiceHandler } from '../service-registry.js';
import type { GraphDB } from '../../graph-db/graph-db.js';
import type { Granularity } from '../../graph-db/types.js';
/**
 * Parameters for creating a hyperedge via the service
 */
export interface CreateHyperedgeParams {
    nodes: string[];
    type: string;
    metadata?: Record<string, unknown>;
}
/**
 * Parameters for creating a temporal hyperedge
 */
export interface CreateTemporalHyperedgeParams extends CreateHyperedgeParams {
    expiresAt: number;
    granularity: Granularity;
}
/**
 * Parameters for querying hyperedges
 */
export interface QueryHyperedgesParams {
    /** Query type: 'byNode' or 'all' */
    queryType: 'byNode' | 'all';
    /** Node ID to query by (required when queryType is 'byNode') */
    nodeId?: string;
    /** Include expired temporal hyperedges (default: false) */
    includeExpired?: boolean;
    /** Limit the number of results */
    limit?: number;
}
/**
 * Parameters for expanding a hyperedge
 */
export interface ExpandHyperedgeParams {
    hyperedgeId: string;
}
/**
 * Response for hyperedge creation
 */
export interface CreateHyperedgeResponse {
    hyperedgeId: string;
}
/**
 * Hyperedge data for responses
 */
export interface HyperedgeData {
    id: string;
    nodes: string[];
    type: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
    expiresAt?: number;
    granularity?: Granularity;
    isExpired?: boolean;
}
/**
 * Response for hyperedge queries
 */
export interface QueryHyperedgesResponse {
    hyperedges: HyperedgeData[];
    count: number;
    executionTimeMs?: number;
}
/**
 * Response for expanding a hyperedge
 */
export interface ExpandHyperedgeResponse {
    hyperedgeId: string;
    nodes: string[];
    type: string;
    metadata?: Record<string, unknown>;
    found: boolean;
}
/**
 * Response for hyperedge statistics
 */
export interface HyperedgeStatsResponse {
    hyperedgeCount: number;
    temporalCount: number;
    expiredCount: number;
    totalNodeReferences: number;
}
/**
 * Create hyperedge service handler with real GraphDB delegation
 *
 * @param graphDb - Injected GraphDB instance for actual storage operations
 * @returns Service handler with methods for create, createTemporal, query, expand, and stats
 */
export declare function createHyperedgeService(graphDb: GraphDB): ServiceHandler;
//# sourceMappingURL=hyperedge-service.d.ts.map