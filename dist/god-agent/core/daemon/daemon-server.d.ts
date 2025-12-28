/**
 * Daemon Server - Unix socket IPC server
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001
 *
 * @module src/god-agent/core/daemon/daemon-server
 */
import { EventEmitter } from 'events';
import type { DaemonConfig, ClientConnection, DaemonStats, RegisteredService, ServiceHandler, DaemonState } from './daemon-types.js';
/**
 * Daemon Server manages Unix socket connections for IPC
 */
export declare class DaemonServer extends EventEmitter {
    private readonly config;
    private server;
    private clients;
    private services;
    private state;
    private startedAt;
    private totalRequests;
    private keepAliveTimers;
    /**
     * Create a new daemon server
     *
     * @param socketPath - Path to Unix socket file (default: /tmp/godagent-db.sock)
     * @param options - Optional configuration overrides
     */
    constructor(socketPath?: string, options?: Partial<Omit<DaemonConfig, 'socketPath'>>);
    /**
     * Start the daemon server
     *
     * @throws DaemonError if server cannot start
     */
    start(): Promise<void>;
    /**
     * Stop the daemon server gracefully
     *
     * Notifies all clients, waits for in-flight requests, then closes
     */
    stop(): Promise<void>;
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
     */
    private handleData;
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
}
//# sourceMappingURL=daemon-server.d.ts.map