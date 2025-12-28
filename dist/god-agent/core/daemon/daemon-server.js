/**
 * Daemon Server - Unix socket IPC server
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001
 *
 * @module src/god-agent/core/daemon/daemon-server
 */
import { createServer } from 'net';
import { existsSync, unlinkSync } from 'fs';
import { EventEmitter } from 'events';
import { DEFAULT_DAEMON_CONFIG, GRACEFUL_SHUTDOWN_TIMEOUT_MS, ClientRejectionReason, DaemonErrorCode, createDaemonError, generateClientId, } from './daemon-types.js';
/**
 * Daemon Server manages Unix socket connections for IPC
 */
export class DaemonServer extends EventEmitter {
    config;
    server = null;
    clients = new Map();
    services = new Map();
    state = 'stopped';
    startedAt = 0;
    totalRequests = 0;
    keepAliveTimers = new Map();
    /**
     * Create a new daemon server
     *
     * @param socketPath - Path to Unix socket file (default: /tmp/godagent-db.sock)
     * @param options - Optional configuration overrides
     */
    constructor(socketPath = DEFAULT_DAEMON_CONFIG.socketPath, options) {
        super();
        this.config = {
            ...DEFAULT_DAEMON_CONFIG,
            ...options,
            socketPath,
        };
    }
    /**
     * Start the daemon server
     *
     * @throws DaemonError if server cannot start
     */
    async start() {
        if (this.state !== 'stopped') {
            throw createDaemonError(DaemonErrorCode.UNKNOWN, `Cannot start server in ${this.state} state`);
        }
        this.state = 'starting';
        // Clean up existing socket file if present
        if (existsSync(this.config.socketPath)) {
            try {
                unlinkSync(this.config.socketPath);
            }
            catch (error) {
                this.state = 'stopped';
                throw createDaemonError(DaemonErrorCode.PERMISSION_DENIED, `Cannot remove existing socket file: ${this.config.socketPath}`, { originalError: error });
            }
        }
        return new Promise((resolve, reject) => {
            this.server = createServer((socket) => this.handleConnection(socket));
            this.server.on('error', (error) => {
                this.state = 'stopped';
                if (error.code === 'EADDRINUSE') {
                    reject(createDaemonError(DaemonErrorCode.SOCKET_EXISTS, `Socket already in use: ${this.config.socketPath}`));
                }
                else if (error.code === 'EACCES') {
                    reject(createDaemonError(DaemonErrorCode.PERMISSION_DENIED, `Permission denied for socket: ${this.config.socketPath}`));
                }
                else {
                    reject(createDaemonError(DaemonErrorCode.UNKNOWN, `Server error: ${error.message}`, { originalError: error }));
                }
            });
            this.server.listen(this.config.socketPath, () => {
                this.state = 'running';
                this.startedAt = Date.now();
                this.emitEvent('start', { socketPath: this.config.socketPath });
                resolve();
            });
        });
    }
    /**
     * Stop the daemon server gracefully
     *
     * Notifies all clients, waits for in-flight requests, then closes
     */
    async stop() {
        if (this.state !== 'running') {
            return;
        }
        this.state = 'stopping';
        // Notify all clients of shutdown
        for (const client of this.clients.values()) {
            this.notifyClientShutdown(client);
        }
        // Wait for graceful shutdown or timeout
        await this.waitForShutdown();
        // Close all remaining connections
        for (const [clientId] of this.clients) {
            this.removeConnection(clientId);
        }
        // Close server
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    // Remove socket file
                    if (existsSync(this.config.socketPath)) {
                        try {
                            unlinkSync(this.config.socketPath);
                        }
                        catch {
                            // Ignore cleanup errors on shutdown
                        }
                    }
                    this.server = null;
                    this.state = 'stopped';
                    this.emitEvent('stop', {
                        uptime: Date.now() - this.startedAt,
                        totalRequests: this.totalRequests,
                    });
                    resolve();
                });
            }
            else {
                this.state = 'stopped';
                resolve();
            }
        });
    }
    /**
     * Register a service handler
     *
     * @param name - Service name
     * @param handler - Handler function for service calls
     * @param methods - List of supported methods
     */
    registerService(name, handler, methods = []) {
        this.services.set(name, { name, handler, methods });
    }
    /**
     * Unregister a service
     *
     * @param name - Service name to remove
     */
    unregisterService(name) {
        return this.services.delete(name);
    }
    /**
     * Get registered service by name
     */
    getService(name) {
        return this.services.get(name);
    }
    /**
     * Get all registered services
     */
    getServices() {
        return Array.from(this.services.values());
    }
    /**
     * Handle new client connection
     */
    handleConnection(socket) {
        // Check max clients limit
        if (this.clients.size >= this.config.maxClients) {
            this.rejectConnection(socket, ClientRejectionReason.MAX_CLIENTS_EXCEEDED);
            return;
        }
        // Check if server is shutting down
        if (this.state === 'stopping') {
            this.rejectConnection(socket, ClientRejectionReason.SERVER_SHUTTING_DOWN);
            return;
        }
        const clientId = generateClientId();
        const connection = {
            id: clientId,
            socket,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
        };
        this.clients.set(clientId, connection);
        // Set up keepalive timeout
        this.resetKeepAliveTimer(clientId);
        // Handle socket events
        socket.on('data', (data) => this.handleData(clientId, data));
        socket.on('close', () => this.handleClose(clientId));
        socket.on('error', (error) => this.handleError(clientId, error));
        this.emitEvent('client_connect', { clientId });
    }
    /**
     * Reject a connection with reason
     */
    rejectConnection(socket, reason) {
        const message = JSON.stringify({
            error: {
                code: -32000,
                message: `Connection rejected: ${reason}`,
            },
        });
        socket.write(message);
        socket.end();
        this.emitEvent('client_rejected', { reason });
    }
    /**
     * Handle incoming data from client
     */
    handleData(clientId, _data) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        // Update last activity
        client.lastActivity = Date.now();
        this.totalRequests++;
        // Reset keepalive timer
        this.resetKeepAliveTimer(clientId);
        // Data handling will be implemented in TASK-DAEMON-002
    }
    /**
     * Handle client disconnect
     */
    handleClose(clientId) {
        this.removeConnection(clientId);
    }
    /**
     * Handle socket error
     */
    handleError(clientId, error) {
        // Use safeEmitError to avoid uncaught errors when no listener is registered
        this.safeEmitError({ clientId, error: error.message });
        this.removeConnection(clientId);
    }
    /**
     * Safely emit error event (won't throw if no listener)
     */
    safeEmitError(data) {
        const event = {
            type: 'error',
            timestamp: Date.now(),
            data,
        };
        // Only emit 'error' if there are listeners to prevent unhandled error exceptions
        if (this.listenerCount('error') > 0) {
            this.emit('error', event);
        }
        // Always emit through 'event' channel for monitoring
        this.emit('event', event);
    }
    /**
     * Remove a client connection
     */
    removeConnection(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        // Clear keepalive timer
        const timer = this.keepAliveTimers.get(clientId);
        if (timer) {
            clearTimeout(timer);
            this.keepAliveTimers.delete(clientId);
        }
        // Close socket if still open
        if (!client.socket.destroyed) {
            client.socket.destroy();
        }
        this.clients.delete(clientId);
        this.emitEvent('client_disconnect', { clientId });
    }
    /**
     * Reset keepalive timer for client
     */
    resetKeepAliveTimer(clientId) {
        // Clear existing timer
        const existingTimer = this.keepAliveTimers.get(clientId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Set new timer
        const timer = setTimeout(() => {
            this.removeConnection(clientId);
        }, this.config.keepAliveTimeout);
        this.keepAliveTimers.set(clientId, timer);
    }
    /**
     * Notify client of server shutdown
     */
    notifyClientShutdown(client) {
        try {
            const message = JSON.stringify({
                notification: 'shutdown',
                message: 'Server is shutting down',
            });
            client.socket.write(message);
        }
        catch {
            // Ignore write errors during shutdown
        }
    }
    /**
     * Wait for graceful shutdown
     */
    async waitForShutdown() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkClients = () => {
                // Check if all clients disconnected or timeout
                if (this.clients.size === 0 ||
                    Date.now() - startTime >= GRACEFUL_SHUTDOWN_TIMEOUT_MS) {
                    resolve();
                }
                else {
                    setTimeout(checkClients, 100);
                }
            };
            checkClients();
        });
    }
    /**
     * Emit a daemon event
     */
    emitEvent(type, data) {
        const event = {
            type,
            timestamp: Date.now(),
            data,
        };
        this.emit(type, event);
        this.emit('event', event);
    }
    /**
     * Get daemon statistics
     */
    getStats() {
        return {
            activeConnections: this.clients.size,
            totalRequests: this.totalRequests,
            uptime: this.state === 'running' ? Date.now() - this.startedAt : 0,
            startedAt: this.startedAt,
        };
    }
    /**
     * Get current daemon state
     */
    getState() {
        return this.state;
    }
    /**
     * Get client connection info
     */
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    /**
     * Get all connected clients
     */
    getClients() {
        return Array.from(this.clients.values());
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=daemon-server.js.map