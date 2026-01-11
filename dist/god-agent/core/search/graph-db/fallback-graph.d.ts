/**
 * Fallback Graph Backend
 * In-memory storage with JSON persistence
 */
import type { IGraphBackend } from './graph-backend.js';
import { QueryDirection, type NodeID, type EdgeID, type HyperedgeID, type INode, type IEdge, type IHyperedge, type ITemporalHyperedge } from './types.js';
/**
 * FallbackGraph - In-memory graph storage with JSON persistence
 */
export declare class FallbackGraph implements IGraphBackend {
    private nodes;
    private edges;
    private hyperedges;
    private dataDir;
    private dataFile;
    private lockTimeout;
    private enablePersistence;
    constructor(dataDir?: string, lockTimeout?: number, enablePersistence?: boolean);
    insertNode(node: INode): Promise<void>;
    getNode(id: NodeID): Promise<INode | null>;
    updateNode(id: NodeID, updates: Partial<INode>): Promise<void>;
    deleteNode(id: NodeID): Promise<void>;
    getAllNodes(): Promise<INode[]>;
    nodeExists(id: NodeID): Promise<boolean>;
    insertEdge(edge: IEdge): Promise<void>;
    getEdge(id: EdgeID): Promise<IEdge | null>;
    getEdges(nodeId: NodeID, direction: QueryDirection): Promise<IEdge[]>;
    deleteEdge(id: EdgeID): Promise<void>;
    getAllEdges(): Promise<IEdge[]>;
    insertHyperedge(hyperedge: IHyperedge | ITemporalHyperedge): Promise<void>;
    getHyperedge(id: HyperedgeID): Promise<IHyperedge | ITemporalHyperedge | null>;
    getHyperedgesByNode(nodeId: NodeID): Promise<(IHyperedge | ITemporalHyperedge)[]>;
    deleteHyperedge(id: HyperedgeID): Promise<void>;
    getAllHyperedges(): Promise<(IHyperedge | ITemporalHyperedge)[]>;
    clear(): Promise<void>;
    save(): Promise<void>;
    load(): Promise<void>;
}
//# sourceMappingURL=fallback-graph.d.ts.map