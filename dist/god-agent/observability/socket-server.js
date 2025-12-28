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
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// =============================================================================
// Implementation
// =============================================================================
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
export class SocketServer {
    server = null;
    clients = new Set();
    socketPath;
    verbose;
    shuttingDown = false;
    // Dependencies
    deps;
    /**
     * Create a new SocketServer
     * @param dependencies Component dependencies
     * @param options Optional configuration
     */
    constructor(dependencies, options) {
        this.deps = dependencies;
        this.verbose = options?.verbose ?? false;
        // Determine socket path
        const defaultPath = path.join(os.homedir(), '.god-agent', 'daemon.sock');
        this.socketPath = options?.socketPath
            || process.env.GOD_AGENT_SOCKET_PATH
            || defaultPath;
    }
    /**
     * Start the socket server
     * Implements [REQ-OBS-10]: Start Unix socket listener
     */
    async start() {
        // Remove stale socket if it exists
        await this.removeStaleSocket();
        // Ensure socket directory exists
        this.ensureDirectoryExists();
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });
            this.server.on('error', (error) => {
                if (this.verbose) {
                    console.error('[SocketServer] Server error:', error);
                }
                reject(error);
            });
            this.server.listen(this.socketPath, () => {
                // Set socket permissions to 0600 (RULE-OBS-006)
                try {
                    fs.chmodSync(this.socketPath, 0o600);
                }
                catch (error) {
                    console.warn('[SocketServer] Failed to set socket permissions:', error);
                }
                if (this.verbose) {
                    console.log(`[SocketServer] Listening on ${this.socketPath}`);
                }
                resolve();
            });
        });
    }
    /**
     * Stop the socket server
     */
    async stop() {
        this.shuttingDown = true;
        // Close all client connections
        for (const client of Array.from(this.clients)) {
            client.end();
        }
        this.clients.clear();
        // Close server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    // Remove socket file
                    try {
                        if (fs.existsSync(this.socketPath)) {
                            fs.unlinkSync(this.socketPath);
                        }
                    }
                    catch {
                        // Ignore errors during cleanup
                    }
                    if (this.verbose) {
                        console.log('[SocketServer] Stopped');
                    }
                    resolve();
                });
            });
        }
    }
    /**
     * Get number of connected clients
     */
    getConnectionCount() {
        return this.clients.size;
    }
    /**
     * Get socket path
     */
    getSocketPath() {
        return this.socketPath;
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Remove stale socket file if it exists
     */
    async removeStaleSocket() {
        if (!fs.existsSync(this.socketPath)) {
            return;
        }
        try {
            // Try to connect to see if it's active
            const testSocket = net.connect(this.socketPath);
            await new Promise((resolve, reject) => {
                testSocket.on('connect', () => {
                    testSocket.end();
                    reject(new Error('Socket is already in use'));
                });
                testSocket.on('error', () => {
                    // Socket exists but not in use - remove it
                    fs.unlinkSync(this.socketPath);
                    if (this.verbose) {
                        console.log('[SocketServer] Removed stale socket');
                    }
                    resolve();
                });
            });
        }
        catch {
            // Error indicates socket file exists but is stale
            if (fs.existsSync(this.socketPath)) {
                fs.unlinkSync(this.socketPath);
            }
        }
    }
    /**
     * Ensure socket directory exists
     */
    ensureDirectoryExists() {
        const dir = path.dirname(this.socketPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    /**
     * Handle new client connection
     * @param socket Client socket
     */
    handleConnection(socket) {
        if (this.shuttingDown) {
            socket.end();
            return;
        }
        this.clients.add(socket);
        if (this.verbose) {
            console.log('[SocketServer] Client connected');
        }
        // Buffer for incomplete lines
        let buffer = '';
        socket.on('data', (data) => {
            // Append to buffer
            buffer += data.toString('utf-8');
            // Process complete lines (NDJSON protocol)
            const lines = buffer.split('\n');
            // Keep last incomplete line in buffer
            buffer = lines.pop() || '';
            // Process complete lines
            for (const line of lines) {
                if (line.trim()) {
                    this.processLine(line);
                }
            }
        });
        socket.on('end', () => {
            this.clients.delete(socket);
            if (this.verbose) {
                console.log('[SocketServer] Client disconnected');
            }
        });
        socket.on('error', (error) => {
            if (this.verbose) {
                console.error('[SocketServer] Client error:', error);
            }
            this.clients.delete(socket);
        });
    }
    /**
     * Process a complete NDJSON line
     * Implements event routing based on component field
     * @param line JSON line to process
     */
    processLine(line) {
        try {
            const event = JSON.parse(line);
            // Validate event structure
            if (!this.isValidEvent(event)) {
                if (this.verbose) {
                    console.warn('[SocketServer] Invalid event structure:', line);
                }
                return;
            }
            // Route to ALL base components
            this.deps.activityStream.push(event);
            this.deps.eventStore.insert(event);
            // Broadcast with operation as event type for specific handlers
            // AND as generic activity_event for the activity feed
            this.deps.sseBroadcaster.broadcast({
                type: event.operation,
                data: event,
                id: event.id,
            });
            this.deps.sseBroadcaster.broadcast({
                type: 'activity',
                data: event,
                id: event.id + '_activity',
            });
            // Route based on component
            switch (event.component) {
                case 'routing':
                    this.routeToRoutingHistory(event);
                    break;
                case 'agent':
                    this.routeToAgentTracker(event);
                    break;
                case 'pipeline':
                    this.routeToPipelineTracker(event);
                    break;
                // Other components just go to base components (already done above)
                default:
                    break;
            }
        }
        catch (error) {
            // Implements [RULE-OBS-003]: Log and skip malformed JSON
            if (this.verbose) {
                console.warn('[SocketServer] Malformed JSON:', line, error);
            }
        }
    }
    /**
     * Validate event structure
     * @param event Event to validate
     * @returns True if valid
     */
    isValidEvent(event) {
        if (typeof event !== 'object' || event === null) {
            return false;
        }
        const e = event;
        return (typeof e.id === 'string' &&
            typeof e.timestamp === 'number' &&
            typeof e.component === 'string' &&
            typeof e.operation === 'string' &&
            typeof e.status === 'string' &&
            typeof e.metadata === 'object');
    }
    /**
     * Route routing events to RoutingHistory
     * @param event Activity event with component='routing'
     */
    routeToRoutingHistory(event) {
        // RoutingHistory records decisions via its own API
        // Events are just logged to activity stream
        // The routing system itself calls routingHistory.record()
    }
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
    routeToAgentTracker(event) {
        const { operation, metadata, timestamp, durationMs } = event;
        // Extract executionId from metadata (required for correlation)
        const executionId = metadata?.executionId;
        if (!executionId) {
            if (this.verbose) {
                console.warn('[SocketServer] agent event missing executionId, cannot route:', operation);
            }
            return;
        }
        switch (operation) {
            case 'agent_started': {
                // Create new agent execution in tracker
                this.deps.agentTracker.startAgentFromEvent({
                    id: executionId,
                    agentKey: metadata.agentKey || 'unknown',
                    agentName: metadata.agentName || metadata.agentKey || 'unknown',
                    category: metadata.agentCategory || 'general',
                    pipelineId: metadata.pipelineId,
                    input: metadata.taskPreview || '',
                    startTime: timestamp,
                });
                if (this.verbose) {
                    console.log(`[SocketServer] Tracked agent start: ${executionId}`);
                }
                break;
            }
            case 'agent_completed': {
                // Mark execution as completed
                this.deps.agentTracker.completeAgentFromEvent(executionId, {
                    output: metadata.outputPreview || '',
                    qualityScore: metadata.qualityScore,
                    durationMs: durationMs || 0,
                });
                if (this.verbose) {
                    console.log(`[SocketServer] Tracked agent complete: ${executionId}`);
                }
                break;
            }
            case 'agent_failed': {
                // Mark execution as failed
                this.deps.agentTracker.failAgentFromEvent(executionId, metadata.error || 'Unknown error', durationMs || 0);
                if (this.verbose) {
                    console.log(`[SocketServer] Tracked agent failure: ${executionId}`);
                }
                break;
            }
            default:
                // Unknown agent operation, just log
                if (this.verbose) {
                    console.log(`[SocketServer] Unknown agent operation: ${operation}`);
                }
                break;
        }
    }
    /**
     * Route pipeline events to PipelineTracker
     * @param event Activity event with component='pipeline'
     */
    routeToPipelineTracker(event) {
        // PipelineTracker manages its own lifecycle
        // Events are emitted BY the tracker itself
        // No additional routing needed
    }
}
// =============================================================================
// Default Export
// =============================================================================
export default SocketServer;
//# sourceMappingURL=socket-server.js.map