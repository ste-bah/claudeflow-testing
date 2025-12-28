/**
 * SocketServer - Unix Domain Socket IPC Server (Daemon Side)
 *
 * Implements Unix Domain Socket server for receiving events from God Agent
 * and routing them to appropriate trackers.
 *
 * @module observability/socket-server
 * @see TASK-OBS-012-SOCKET-IPC.md
 * @see SPEC-OBS-001-CORE.md
 */
import type { IActivityStream } from './activity-stream.js';
import type { IAgentExecutionTracker } from './agent-tracker.js';
import type { IPipelineTracker } from './pipeline-tracker.js';
import type { IRoutingHistory } from './routing-history.js';
import type { IEventStore } from './event-store.js';
import type { ISSEBroadcaster } from './sse-broadcaster.js';
/**
 * Socket server dependencies
 */
export interface ISocketServerDependencies {
    activityStream: IActivityStream;
    agentTracker: IAgentExecutionTracker;
    pipelineTracker: IPipelineTracker;
    routingHistory: IRoutingHistory;
    eventStore: IEventStore;
    sseBroadcaster: ISSEBroadcaster;
}
/**
 * Socket server interface
 * Implements [REQ-OBS-10]: Unix Domain Socket IPC
 */
export interface ISocketServer {
    /**
     * Start the socket server
     * @returns Promise resolving when server is listening
     */
    start(): Promise<void>;
    /**
     * Stop the socket server
     * @returns Promise resolving when server is closed
     */
    stop(): Promise<void>;
    /**
     * Get number of connected clients
     */
    getConnectionCount(): number;
    /**
     * Get socket path
     */
    getSocketPath(): string;
}
/**
 * SocketServer implementation
 *
 * Implements:
 * - [REQ-OBS-10]: Unix Domain Socket IPC
 * - [RULE-OBS-006]: Socket permissions 0600
 * - [RULE-OBS-002]: Non-blocking event processing
 * - NDJSON protocol (newline-delimited JSON)
 * - Stale socket removal on startup
 * - Graceful shutdown with cleanup
 */
export declare class SocketServer implements ISocketServer {
    private server;
    private clients;
    private socketPath;
    private verbose;
    private shuttingDown;
    private deps;
    /**
     * Create a new SocketServer
     * @param dependencies Component dependencies
     * @param options Optional configuration
     */
    constructor(dependencies: ISocketServerDependencies, options?: {
        socketPath?: string;
        verbose?: boolean;
    });
    /**
     * Start the socket server
     * Implements [REQ-OBS-10]: Start Unix socket listener
     */
    start(): Promise<void>;
    /**
     * Stop the socket server
     */
    stop(): Promise<void>;
    /**
     * Get number of connected clients
     */
    getConnectionCount(): number;
    /**
     * Get socket path
     */
    getSocketPath(): string;
    /**
     * Remove stale socket file if it exists
     */
    private removeStaleSocket;
    /**
     * Ensure socket directory exists
     */
    private ensureDirectoryExists;
    /**
     * Handle new client connection
     * @param socket Client socket
     */
    private handleConnection;
    /**
     * Process a complete NDJSON line
     * Implements event routing based on component field
     * @param line JSON line to process
     */
    private processLine;
    /**
     * Validate event structure
     * @param event Event to validate
     * @returns True if valid
     */
    private isValidEvent;
    /**
     * Route routing events to RoutingHistory
     * @param event Activity event with component='routing'
     */
    private routeToRoutingHistory;
    /**
     * Route agent events to AgentExecutionTracker
     * Implements [REQ-OBS-04]: Agent lifecycle tracking via IPC
     *
     * NOTE: The previous comment was WRONG. AgentExecutionTracker in the daemon
     * has NO knowledge of agents in separate God Agent processes. Events MUST
     * be routed via this method to update the tracker.
     *
     * @param event Activity event with component='agent'
     */
    private routeToAgentTracker;
    /**
     * Route pipeline events to PipelineTracker
     * @param event Activity event with component='pipeline'
     */
    private routeToPipelineTracker;
}
export default SocketServer;
//# sourceMappingURL=socket-server.d.ts.map