/**
 * GraphDB Type Definitions
 * Provides types for hypergraph with temporal features
 */
export type NodeID = string;
export type EdgeID = string;
export type HyperedgeID = string;
export declare enum Granularity {
    Hourly = "Hourly",
    Daily = "Daily",
    Monthly = "Monthly"
}
export interface INode {
    id: NodeID;
    type: string;
    properties: Record<string, unknown>;
    embedding?: number[];
    createdAt: number;
    updatedAt: number;
}
export interface IEdge {
    id: EdgeID;
    source: NodeID;
    target: NodeID;
    type: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
}
export interface IHyperedge {
    id: HyperedgeID;
    nodes: NodeID[];
    type: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
}
export interface ITemporalHyperedge extends IHyperedge {
    expiresAt: number;
    granularity: Granularity;
    isExpired?: boolean;
}
export declare enum QueryDirection {
    Incoming = "incoming",
    Outgoing = "outgoing",
    Both = "both"
}
export interface QueryResult<T = unknown> {
    data: T[];
    count: number;
    executionTimeMs: number;
}
export interface IIntegrityReport {
    totalNodes: number;
    totalEdges: number;
    totalHyperedges: number;
    orphanNodes: NodeID[];
    invalidHyperedges: HyperedgeID[];
    expiredTemporalHyperedges: HyperedgeID[];
    dimensionMismatches: NodeID[];
    isValid: boolean;
    timestamp: number;
}
export interface GraphDBOptions {
    dataDir?: string;
    enablePersistence?: boolean;
    lockTimeout?: number;
    validateDimensions?: boolean;
    expectedDimensions?: number;
}
export interface CreateNodeOptions {
    type: string;
    properties?: Record<string, unknown>;
    embedding?: number[];
    linkTo?: NodeID;
}
export interface CreateEdgeOptions {
    source: NodeID;
    target: NodeID;
    type: string;
    metadata?: Record<string, unknown>;
}
export interface CreateHyperedgeOptions {
    nodes: NodeID[];
    type: string;
    metadata?: Record<string, unknown>;
}
export interface CreateTemporalHyperedgeOptions extends CreateHyperedgeOptions {
    expiresAt: number;
    granularity: Granularity;
}
//# sourceMappingURL=types.d.ts.map