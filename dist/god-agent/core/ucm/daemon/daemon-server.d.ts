/**
 * UCM Daemon Server (SVC-005)
 * Unix socket JSON-RPC 2.0 server for Universal Context Management
 *
 * FEATURES:
 * - Unix socket IPC at /tmp/godagent-db.sock
 * - JSON-RPC 2.0 request routing
 * - Service registration and lifecycle management
 * - Connection management
 *
 * CONSTITUTION RULES: RULE-051 to RULE-054
 */
import { HealthService } from './health-service.js';
import type { IUniversalContextConfig } from '../types.js';
export declare class DaemonServer {
    private server;
    private config;
    private services;
    private connections;
    private running;
    private contextService;
    private descService;
    private recoveryService;
    private healthService;
    private embeddingProxy;
    constructor(config?: Partial<IUniversalContextConfig>);
    /**
     * Register a service handler
     */
    private registerService;
    /**
     * Start the daemon server
     */
    start(): Promise<void>;
    /**
     * Stop the daemon server
     */
    stop(): Promise<void>;
    /**
     * Handle client connection
     */
    private handleConnection;
    /**
     * Handle JSON-RPC message
     */
    private handleMessage;
    /**
     * Route request to appropriate service
     */
    private routeRequest;
    /**
     * Send JSON-RPC response to client
     */
    private sendResponse;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * Get active connection count
     */
    getConnectionCount(): number;
    /**
     * Get health service for metrics tracking
     */
    getHealthService(): HealthService;
}
/**
 * Create and start daemon server
 */
export declare function startDaemon(config?: Partial<IUniversalContextConfig>): Promise<DaemonServer>;
//# sourceMappingURL=daemon-server.d.ts.map