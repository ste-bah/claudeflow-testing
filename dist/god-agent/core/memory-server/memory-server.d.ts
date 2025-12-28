/**
 * Memory Server
 * MEM-001 - Single daemon process owning all .agentdb/ file operations
 *
 * Architecture:
 * - Listens on Unix socket (Linux/macOS) or HTTP localhost (Windows)
 * - Handles concurrent client connections
 * - Owns all file I/O to .agentdb directory
 * - Provides graceful shutdown
 */
import type { IMemoryServerConfig, ServerState } from '../types/memory-types.js';
export declare class MemoryServer {
    private readonly config;
    private state;
    private server;
    private clients;
    private startedAt;
    private totalRequests;
    private knowledge;
    private feedbackLog;
    private dirty;
    private saveTimer;
    constructor(config?: Partial<IMemoryServerConfig>);
    /**
     * Start the memory server
     */
    start(): Promise<string>;
    /**
     * Stop the memory server gracefully
     */
    stop(): Promise<void>;
    /**
     * Get current server state
     */
    getState(): ServerState;
    private checkExistingServer;
    private startServer;
    private handleConnection;
    private handleDisconnect;
    private handleData;
    private handleHttpRequest;
    private handleRequest;
    private processRequest;
    private executeMethod;
    private handleStoreKnowledge;
    private handleGetKnowledgeByDomain;
    private handleGetKnowledgeByTags;
    private handleDeleteKnowledge;
    private handleProvideFeedback;
    private handleQueryPatterns;
    private handleGetStatus;
    private handlePing;
    private getStorageStats;
    private ensureStorageDir;
    private loadData;
    private saveData;
    private markDirty;
    private startPeriodicSave;
    private writePidFile;
    private removePidFile;
    private log;
}
/**
 * Get or create the singleton server instance
 */
export declare function getMemoryServer(config?: Partial<IMemoryServerConfig>): MemoryServer;
/**
 * Start the memory server (creates singleton if needed)
 */
export declare function startMemoryServer(config?: Partial<IMemoryServerConfig>): Promise<string>;
/**
 * Stop the memory server
 */
export declare function stopMemoryServer(): Promise<void>;
//# sourceMappingURL=memory-server.d.ts.map