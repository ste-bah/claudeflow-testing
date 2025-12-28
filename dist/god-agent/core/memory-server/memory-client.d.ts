/**
 * Memory Client
 * MEM-001 - Client for UniversalAgent and subagents to access memory server
 *
 * Features:
 * - Auto-discovery of server address
 * - Automatic reconnection on disconnect
 * - Request/response correlation
 * - Timeout handling
 */
import type { IMemoryClientConfig, IClientConnection, IKnowledgeEntry, IStoreKnowledgeParams, IProvideFeedbackParams, IProvideFeedbackResult, IQueryPatternsParams, IQueryPatternsResult, IServerStatus, IPingResult } from '../types/memory-types.js';
export declare class MemoryClient {
    private readonly config;
    private readonly agentDbPath;
    private state;
    private socket;
    private serverAddress;
    private connectedAt;
    private reconnectAttempts;
    private lastError;
    private messageBuffer;
    private pendingRequests;
    private reconnectTimer;
    private intentionalDisconnect;
    constructor(agentDbPath?: string, config?: Partial<IMemoryClientConfig>);
    /**
     * Connect to the memory server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the memory server
     */
    disconnect(): Promise<void>;
    /**
     * Get current connection info
     */
    getConnectionInfo(): IClientConnection;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    private connectUnixSocket;
    private setupSocketHandlers;
    private handleData;
    private handleDisconnect;
    private scheduleReconnect;
    private waitForConnection;
    private sendRequest;
    private sendSocketRequest;
    private sendHttpRequest;
    /**
     * Store knowledge entry
     */
    storeKnowledge(params: IStoreKnowledgeParams): Promise<IKnowledgeEntry>;
    /**
     * Get knowledge entries by domain
     */
    getKnowledgeByDomain(domain: string, limit?: number): Promise<IKnowledgeEntry[]>;
    /**
     * Get knowledge entries by tags
     */
    getKnowledgeByTags(tags: string[], limit?: number): Promise<IKnowledgeEntry[]>;
    /**
     * Delete knowledge entry
     */
    deleteKnowledge(id: string): Promise<{
        deleted: boolean;
    }>;
    /**
     * Provide feedback for a trajectory
     */
    provideFeedback(params: IProvideFeedbackParams): Promise<IProvideFeedbackResult>;
    /**
     * Query patterns
     */
    queryPatterns(params: IQueryPatternsParams): Promise<IQueryPatternsResult>;
    /**
     * Get server status
     */
    getStatus(): Promise<IServerStatus>;
    /**
     * Ping the server
     */
    ping(): Promise<IPingResult>;
    private log;
}
/**
 * Get or create the singleton client instance
 */
export declare function getMemoryClient(agentDbPath?: string, config?: Partial<IMemoryClientConfig>): MemoryClient;
/**
 * Create a new client instance (non-singleton)
 */
export declare function createMemoryClient(agentDbPath?: string, config?: Partial<IMemoryClientConfig>): MemoryClient;
//# sourceMappingURL=memory-client.d.ts.map