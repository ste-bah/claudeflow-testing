/**
 * Graph Service - IPC wrapper for GraphDB
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes graph database operations via JSON-RPC 2.0
 */
import type { GraphDB } from '../../graph-db/graph-db.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * Graph service parameters
 */
export interface IGraphAddNodeParams {
    type: string;
    properties?: Record<string, unknown>;
    embedding?: number[];
    linkTo?: string;
}
export interface IGraphGetNodeParams {
    id: string;
}
export interface IGraphAddEdgeParams {
    source: string;
    target: string;
    type: string;
    metadata?: Record<string, unknown>;
}
export interface IGraphQueryParams {
    namespace?: string;
    keyPattern?: string;
    limit?: number;
}
export interface IGraphTraverseParams {
    startNodeId: string;
    depth: number;
}
/**
 * Create graph service handler
 *
 * @param graphDB - GraphDB instance
 * @returns Service handler with method map
 */
export declare function createGraphService(graphDB: GraphDB): ServiceHandler;
//# sourceMappingURL=graph-service.d.ts.map