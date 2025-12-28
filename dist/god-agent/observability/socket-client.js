/**
 * SocketClient - Unix Domain Socket IPC Client (God Agent Side)
 *
 * Implements Unix Domain Socket client for sending events to daemon.
 *
 * @module observability/socket-client
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
 * SocketClient implementation
 *
 * Implements:
 * - [REQ-OBS-11]: God Agent socket client
 * - [RULE-OBS-002]: Non-blocking send
 * - Queue up to 100 events if not connected
 * - Flush queue on connect
 * - Connection timeout: 1000ms
 */
export class SocketClient {
    socket = null;
    connected = false;
    socketPath;
    verbose;
    // Event queue for when disconnected
    queue = [];
    MAX_QUEUE_SIZE = 100;
    // Connection timeout in milliseconds
    CONNECTION_TIMEOUT_MS = 1000;
    /**
     * Create a new SocketClient
     * @param options Optional configuration
     */
    constructor(options) {
        this.verbose = options?.verbose ?? false;
        // Determine socket path
        const defaultPath = path.join(os.homedir(), '.god-agent', 'daemon.sock');
        this.socketPath = options?.socketPath
            || process.env.GOD_AGENT_SOCKET_PATH
            || defaultPath;
    }
    /**
     * Connect to daemon socket
     * @returns Promise resolving to connection success
     */
    async connect() {
        // Check if socket exists
        if (!fs.existsSync(this.socketPath)) {
            if (this.verbose) {
                console.warn(`[SocketClient] Socket does not exist: ${this.socketPath}`);
            }
            return false;
        }
        return new Promise((resolve) => {
            const socket = net.connect(this.socketPath);
            // Set connection timeout
            const timeout = setTimeout(() => {
                socket.destroy();
                if (this.verbose) {
                    console.warn('[SocketClient] Connection timeout');
                }
                resolve(false);
            }, this.CONNECTION_TIMEOUT_MS);
            socket.on('connect', () => {
                clearTimeout(timeout);
                this.socket = socket;
                this.connected = true;
                if (this.verbose) {
                    console.log('[SocketClient] Connected to daemon');
                }
                // Flush queued events
                this.flushQueue();
                resolve(true);
            });
            socket.on('error', (error) => {
                clearTimeout(timeout);
                if (this.verbose) {
                    console.error('[SocketClient] Connection error:', error);
                }
                resolve(false);
            });
            socket.on('close', () => {
                this.connected = false;
                this.socket = null;
                if (this.verbose) {
                    console.log('[SocketClient] Disconnected from daemon');
                }
            });
        });
    }
    /**
     * Send an event (non-blocking)
     * Implements [RULE-OBS-002]: Non-blocking send
     * @param event Event to send
     */
    send(event) {
        if (!this.connected || !this.socket) {
            // Queue event if not connected
            this.queueEvent(event);
            return;
        }
        try {
            // NDJSON format: one JSON object per line
            const line = JSON.stringify(event) + '\n';
            this.socket.write(line);
        }
        catch (error) {
            if (this.verbose) {
                console.error('[SocketClient] Send error:', error);
            }
            // Queue event and mark as disconnected
            this.connected = false;
            this.queueEvent(event);
        }
    }
    /**
     * Disconnect from daemon
     */
    disconnect() {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
            this.connected = false;
            if (this.verbose) {
                console.log('[SocketClient] Disconnected');
            }
        }
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get current queue size (for testing)
     */
    getQueueSize() {
        return this.queue.length;
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Queue an event when disconnected
     * Implements bounded queue (max 100 events)
     * @param event Event to queue
     */
    queueEvent(event) {
        if (this.queue.length >= this.MAX_QUEUE_SIZE) {
            // Queue full - drop oldest event (FIFO)
            this.queue.shift();
            if (this.verbose) {
                console.warn('[SocketClient] Queue full, dropping oldest event');
            }
        }
        this.queue.push(event);
    }
    /**
     * Flush queued events on connect
     */
    flushQueue() {
        if (this.queue.length === 0) {
            return;
        }
        if (this.verbose) {
            console.log(`[SocketClient] Flushing ${this.queue.length} queued events`);
        }
        const eventsToSend = [...this.queue];
        this.queue = [];
        for (const event of eventsToSend) {
            this.send(event);
        }
    }
}
// =============================================================================
// Default Export
// =============================================================================
export default SocketClient;
//# sourceMappingURL=socket-client.js.map