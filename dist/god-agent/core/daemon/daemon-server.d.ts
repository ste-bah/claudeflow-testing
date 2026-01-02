/**
 * Daemon Server - Unix socket IPC server
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001, TASK-DAEMON-003 (Integration)
 *
 * Provides IPC access to God Agent services via Unix socket.
 * Services are wired to real storage backends (EpisodeStore, GraphDB)
 * for persistent episodic memory and hyperedge storage.
 *
 * Constitution Compliance:
 * - RULE-008: Stores persist to SQLite/disk
 * - RULE-011: Episodes stored in SQLite
 *
 * @module src/god-agent/core/daemon/daemon-server
 */
import { EventEmitter } from 'events';
import type { DaemonConfig, ClientConnection, DaemonStats, RegisteredService, ServiceHandler, DaemonState } from './daemon-types.js';
import { EpisodeStore } from '../episode/episode-store.js';
import { GraphDB } from '../graph-db/graph-db.js';
/**
 * Extended daemon configuration with storage options
 */
export interface DaemonServerConfig extends Partial<Omit<DaemonConfig, 'socketPath'>> {
    /** Directory for persistent storage (default: .god-agent) */
    storageDir?: string;
    /** Enable verbose logging for store operations */
    verbose?: boolean;
    /** Expected embedding dimension for GraphDB (default: VECTOR_DIM = 1536) */
    embeddingDimension?: number;
    /** Data directory for GraphDB (default: .agentdb/graphs) */
    graphDataDir?: string;
}
/**
 * Default storage configuration
 */
declare const DEFAULT_STORAGE_CONFIG: {
    storageDir: string;
    verbose: boolean;
    embeddingDimension: number;
    graphDataDir: string;
};
/**
 * Daemon Server manages Unix socket connections for IPC
 *
 * Integrates with real storage backends:
 * - EpisodeStore: SQLite + HNSW for episodic memory
 * - GraphDB: Hypergraph database with temporal features
 */
export declare class DaemonServer extends EventEmitter {
    private readonly config;
    private readonly storageConfig;
    private server;
    private clients;
    private services;
    private state;
    private startedAt;
    private totalRequests;
    private keepAliveTimers;
    /** Message buffers per client for partial message handling - TASK-DAEMON-002 */
    private messageBuffers;
    private episodeStore;
    private graphDb;
    /**
     * Create a new daemon server
     *
     * @param socketPath - Path to Unix socket file (default: /tmp/godagent-db.sock)
     * @param options - Optional configuration overrides including storage options
     */
    constructor(socketPath?: string, options?: DaemonServerConfig);
    /**
     * Start the daemon server
     *
     * Initializes storage backends (EpisodeStore, GraphDB) and registers
     * real services with dependency injection before starting the socket server.
     *
     * @throws DaemonError if server cannot start
     */
    start(): Promise<void>;
    /**
     * Initialize storage backends for real service delegation
     *
     * Creates and initializes:
     * - EpisodeStore: SQLite + HNSW for episodic memory (RULE-011)
     * - GraphDB: Hypergraph with FallbackGraph backend (RULE-008)
     */
    private initializeStores;
    /**
     * Register core services with injected storage backends
     *
     * Services are wired to real stores for actual data persistence:
     * - episode: EpisodeService -> EpisodeStore (SQLite + HNSW)
     * - hyperedge: HyperedgeService -> GraphDB (FallbackGraph)
     *
     * Uses adaptServiceHandler to convert service-registry format to daemon-types format.
     */
    private registerCoreServices;
    /**
     * Stop the daemon server gracefully
     *
     * Notifies all clients, waits for in-flight requests, closes storage backends,
     * then closes the socket server.
     */
    stop(): Promise<void>;
    /**
     * Close storage backends and persist data
     *
     * Ensures all data is saved before server shutdown.
     */
    private closeStores;
    /**
     * Register a service handler
     *
     * @param name - Service name
     * @param handler - Handler function for service calls
     * @param methods - List of supported methods
     */
    registerService(name: string, handler: ServiceHandler, methods?: string[]): void;
    /**
     * Unregister a service
     *
     * @param name - Service name to remove
     */
    unregisterService(name: string): boolean;
    /**
     * Get registered service by name
     */
    getService(name: string): RegisteredService | undefined;
    /**
     * Get all registered services
     */
    getServices(): RegisteredService[];
    /**
     * Handle new client connection
     */
    private handleConnection;
    /**
     * Reject a connection with reason
     */
    private rejectConnection;
    /**
     * Handle incoming data from client
     * Implements JSON-RPC 2.0 message parsing and routing
     *
     * TASK-DAEMON-002: Core RPC handler implementation
     */
    private handleData;
    /**
     * Process a single JSON-RPC message
     * TASK-DAEMON-002
     */
    private processMessage;
    /**
     * Validate JSON-RPC 2.0 request format
     * TASK-DAEMON-002
     */
    private isValidRequest;
    /**
     * Route request to appropriate service handler
     * TASK-DAEMON-002
     */
    private routeRequest;
    /**
     * Send JSON-RPC response to client
     * TASK-DAEMON-002
     */
    private sendResponse;
    /**
     * Handle client disconnect
     */
    private handleClose;
    /**
     * Handle socket error
     */
    private handleError;
    /**
     * Safely emit error event (won't throw if no listener)
     */
    private safeEmitError;
    /**
     * Remove a client connection
     */
    removeConnection(clientId: string): void;
    /**
     * Reset keepalive timer for client
     */
    private resetKeepAliveTimer;
    /**
     * Notify client of server shutdown
     */
    private notifyClientShutdown;
    /**
     * Wait for graceful shutdown
     */
    private waitForShutdown;
    /**
     * Emit a daemon event
     */
    private emitEvent;
    /**
     * Get daemon statistics
     */
    getStats(): DaemonStats;
    /**
     * Get current daemon state
     */
    getState(): DaemonState;
    /**
     * Get client connection info
     */
    getClient(clientId: string): ClientConnection | undefined;
    /**
     * Get all connected clients
     */
    getClients(): ClientConnection[];
    /**
     * Get configuration
     */
    getConfig(): DaemonConfig;
    /**
     * Get storage configuration
     */
    getStorageConfig(): typeof DEFAULT_STORAGE_CONFIG;
    /**
     * Get EpisodeStore instance (for advanced usage/testing)
     *
     * @returns EpisodeStore instance or null if not initialized
     */
    getEpisodeStore(): EpisodeStore | null;
    /**
     * Get GraphDB instance (for advanced usage/testing)
     *
     * @returns GraphDB instance or null if not initialized
     */
    getGraphDb(): GraphDB | null;
}
export {};
//# sourceMappingURL=daemon-server.d.ts.map