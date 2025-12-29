/**
 * SSEBroadcaster - Server-Sent Events Broadcaster
 *
 * Implements real-time event streaming to connected dashboard clients.
 *
 * @module observability/sse-broadcaster
 * @see TASK-OBS-007-SSE-BROADCASTER.md
 * @see SPEC-OBS-001-CORE.md
 */
// =============================================================================
// Implementation
// =============================================================================
/**
 * SSEBroadcaster implementation
 *
 * Implements:
 * - [REQ-OBS-09]: SSE real-time streaming
 * - [RULE-OBS-002]: Non-blocking broadcast
 * - [RULE-OBS-003]: Graceful degradation (no errors from broadcast)
 */
export class SSEBroadcaster {
    // Active client connections
    clients = new Map();
    // Heartbeat interval handle
    heartbeatInterval = null;
    // Heartbeat interval in milliseconds
    HEARTBEAT_MS = 30000;
    // Verbose logging
    verbose;
    // Shutdown flag
    shuttingDown = false;
    /**
     * Create a new SSEBroadcaster
     * @param options Optional configuration
     */
    constructor(options) {
        this.verbose = options?.verbose ?? false;
        this.startHeartbeat();
    }
    /**
     * Add a client to receive SSE events
     * Implements [REQ-OBS-09]: Client management
     * @param res Express Response object
     * @returns Unique client ID
     */
    addClient(res) {
        const clientId = this.generateClientId();
        // Ensure SSE headers are set
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
            res.flushHeaders();
        }
        this.clients.set(clientId, res);
        // Send connection confirmation
        this.sendToClient(clientId, {
            type: 'connected',
            data: { clientId, timestamp: Date.now() },
        });
        if (this.verbose) {
            console.log('[SSEBroadcaster] Client connected: ' + clientId);
        }
        return clientId;
    }
    /**
     * Remove a client from broadcasting
     * @param clientId Client ID to remove
     */
    removeClient(clientId) {
        const existed = this.clients.delete(clientId);
        if (existed && this.verbose) {
            console.log('[SSEBroadcaster] Client disconnected: ' + clientId);
        }
    }
    /**
     * Broadcast an event to all connected clients
     * Implements [RULE-OBS-002]: Non-blocking
     * Implements [RULE-OBS-003]: No exceptions from broadcast
     * @param event SSE event to broadcast
     */
    broadcast(event) {
        if (this.clients.size === 0) {
            return;
        }
        const message = this.formatSSE(event);
        // Non-blocking: iterate and send to each client
        for (const [clientId, res] of this.clients) {
            try {
                res.write(message);
            }
            catch {
                // INTENTIONAL: Client disconnected - [RULE-OBS-003] requires silent removal to prevent cascade failures
                this.clients.delete(clientId);
                if (this.verbose) {
                    console.log('[SSEBroadcaster] Client removed on write error: ' + clientId);
                }
            }
        }
    }
    /**
     * Get the number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Shutdown the broadcaster
     */
    shutdown() {
        this.shuttingDown = true;
        // Stop heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        // Close all client connections
        for (const [clientId, res] of this.clients) {
            try {
                // Send shutdown event
                const message = this.formatSSE({
                    type: 'shutdown',
                    data: { reason: 'server_shutdown', timestamp: Date.now() },
                });
                res.write(message);
                res.end();
            }
            catch {
                // INTENTIONAL: Best-effort cleanup during shutdown - errors are expected from already-disconnected clients
            }
        }
        this.clients.clear();
        if (this.verbose) {
            console.log('[SSEBroadcaster] Shutdown complete');
        }
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Generate unique client ID
     * Format: client_{timestamp}_{random}
     */
    generateClientId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return 'client_' + timestamp + '_' + random;
    }
    /**
     * Format an event for SSE protocol
     * Format: event: {type}\ndata: {json}\nid: {id}\n\n
     */
    formatSSE(event) {
        const lines = [];
        lines.push('event: ' + event.type);
        lines.push('data: ' + JSON.stringify(event.data));
        if (event.id) {
            lines.push('id: ' + event.id);
        }
        lines.push(''); // Empty line to end message
        lines.push('');
        return lines.join('\n');
    }
    /**
     * Send an event to a specific client
     * @param clientId Target client ID
     * @param event SSE event to send
     */
    sendToClient(clientId, event) {
        const res = this.clients.get(clientId);
        if (!res) {
            return;
        }
        try {
            const message = this.formatSSE(event);
            res.write(message);
        }
        catch {
            // INTENTIONAL: Client disconnected - silent removal prevents cascade failures in SSE broadcast
            this.clients.delete(clientId);
            if (this.verbose) {
                console.log('[SSEBroadcaster] Client removed on send error: ' + clientId);
            }
        }
    }
    /**
     * Start heartbeat to detect stale connections
     * Sends :heartbeat comment every 30 seconds
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.shuttingDown) {
                return;
            }
            for (const [clientId, res] of this.clients) {
                try {
                    // SSE comment format for heartbeat
                    res.write(':heartbeat\n\n');
                }
                catch {
                    // INTENTIONAL: Client disconnected during heartbeat - silent removal prevents stale client accumulation
                    this.clients.delete(clientId);
                    if (this.verbose) {
                        console.log('[SSEBroadcaster] Stale client removed: ' + clientId);
                    }
                }
            }
        }, this.HEARTBEAT_MS);
        // Don't prevent process from exiting
        this.heartbeatInterval.unref();
    }
}
// =============================================================================
// Default Export
// =============================================================================
export default SSEBroadcaster;
//# sourceMappingURL=sse-broadcaster.js.map