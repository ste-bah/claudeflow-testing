/**
 * ObservabilityBus - Central Event Emission System
 *
 * Implements the core event emission system that forwards events to the
 * observability daemon via Unix socket.
 *
 * @module core/observability/bus
 * @see TASK-OBS-001-OBSERVABILITY-BUS.md
 * @see SPEC-OBS-001-CORE.md
 */
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { BUFFER_LIMITS, } from '../../observability/types.js';
// =============================================================================
// Implementation
// =============================================================================
/**
 * ObservabilityBus singleton implementation
 *
 * Implements:
 * - [REQ-OBS-01]: Event emission
 * - [RULE-OBS-002]: Non-blocking emission
 * - [RULE-OBS-003]: Graceful degradation
 * - [RULE-OBS-008]: Auto-detection
 */
export class ObservabilityBus {
    static instance = null;
    socket = null;
    connected = false;
    connecting = false;
    queue = [];
    checkInterval = null;
    socketPath;
    maxQueueSize = BUFFER_LIMITS.BUS_QUEUE;
    checkIntervalMs = 5000;
    verbose;
    shuttingDown = false;
    /**
     * Get singleton instance
     * Implements [RULE-OBS-008]: Auto-detection without configuration
     */
    static getInstance() {
        if (!ObservabilityBus.instance) {
            ObservabilityBus.instance = new ObservabilityBus();
        }
        return ObservabilityBus.instance;
    }
    /**
     * Reset singleton (for testing)
     */
    static resetInstance() {
        if (ObservabilityBus.instance) {
            ObservabilityBus.instance.shutdown();
            ObservabilityBus.instance = null;
        }
    }
    constructor(options) {
        // Implements [RULE-OBS-008]: Auto-detect daemon socket
        this.socketPath = options?.socketPath ?? this.getDefaultSocketPath();
        this.verbose = options?.verbose ?? false;
        // Start checking for daemon
        this.checkForDaemon();
        this.startPeriodicCheck();
    }
    /**
     * Get default socket path
     * Checks both ~/.god-agent/daemon.sock and /tmp/god-agent.sock
     */
    getDefaultSocketPath() {
        const homeSocket = path.join(os.homedir(), '.god-agent', 'daemon.sock');
        const tmpSocket = '/tmp/god-agent.sock';
        // Prefer home directory socket if it exists
        if (fs.existsSync(homeSocket)) {
            return homeSocket;
        }
        return tmpSocket;
    }
    /**
     * Emit an event
     * Implements [RULE-OBS-002]: MUST return immediately (non-blocking)
     * Implements [RULE-OBS-003]: Failed delivery logged but no exception thrown
     */
    emit(event) {
        // Implements [REQ-OBS-03]: Auto-generate id and timestamp
        const fullEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: Date.now(),
        };
        // Non-blocking: queue event and return immediately
        // Implements [RULE-OBS-002]: emit() MUST return immediately
        if (this.connected && this.socket) {
            // Send immediately in background
            setImmediate(() => this.sendEvent(fullEvent));
        }
        else {
            // Queue for later
            this.queueEvent(fullEvent);
        }
    }
    /**
     * Check if connected to daemon
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Get queue size
     */
    getQueueSize() {
        return this.queue.length;
    }
    /**
     * Flush all queued events
     */
    async flush() {
        if (!this.connected || this.queue.length === 0) {
            return;
        }
        const events = [...this.queue];
        this.queue = [];
        for (const event of events) {
            await this.sendEventAsync(event);
        }
    }
    /**
     * Shutdown the bus
     */
    shutdown() {
        this.shuttingDown = true;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.socket) {
            try {
                this.socket.end();
            }
            catch {
                // Ignore errors during shutdown
            }
            this.socket = null;
        }
        this.connected = false;
        this.queue = [];
        if (this.verbose) {
            console.log('[ObservabilityBus] Shutdown complete');
        }
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Generate unique event ID
     * Format: evt_{timestamp}_{random}
     */
    generateEventId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `evt_${timestamp}_${random}`;
    }
    /**
     * Queue an event for later sending
     * Implements [RULE-OBS-004]: FIFO eviction when full
     */
    queueEvent(event) {
        this.queue.push(event);
        // Evict oldest if over limit
        while (this.queue.length > this.maxQueueSize) {
            this.queue.shift();
            if (this.verbose) {
                console.log('[ObservabilityBus] Queue full, oldest event evicted');
            }
        }
    }
    /**
     * Send event to daemon (non-blocking)
     */
    sendEvent(event) {
        if (!this.socket || !this.connected) {
            this.queueEvent(event);
            return;
        }
        try {
            // NDJSON format (newline-delimited JSON)
            const data = JSON.stringify(event) + '\n';
            this.socket.write(data);
        }
        catch (error) {
            // Implements [RULE-OBS-003]: Log error but continue
            if (this.verbose) {
                console.log('[ObservabilityBus] Send error:', error);
            }
            this.queueEvent(event);
        }
    }
    /**
     * Send event async (for flush)
     */
    sendEventAsync(event) {
        return new Promise((resolve) => {
            if (!this.socket || !this.connected) {
                resolve();
                return;
            }
            try {
                const data = JSON.stringify(event) + '\n';
                this.socket.write(data, () => resolve());
            }
            catch {
                resolve();
            }
        });
    }
    /**
     * Check for daemon socket and connect if available
     * Implements [RULE-OBS-008]: Auto-detect daemon
     */
    checkForDaemon() {
        if (this.shuttingDown || this.connecting || this.connected) {
            return;
        }
        // Check if socket file exists
        if (!fs.existsSync(this.socketPath)) {
            if (this.verbose) {
                console.log('[ObservabilityBus] Daemon socket not found at', this.socketPath);
            }
            return;
        }
        this.connect();
    }
    /**
     * Connect to daemon socket
     */
    connect() {
        if (this.connecting || this.connected || this.shuttingDown) {
            return;
        }
        this.connecting = true;
        try {
            this.socket = net.createConnection(this.socketPath);
            this.socket.on('connect', () => {
                this.connected = true;
                this.connecting = false;
                if (this.verbose) {
                    console.log('[ObservabilityBus] Connected to daemon');
                }
                // Drain queue
                this.drainQueue();
            });
            this.socket.on('error', (error) => {
                this.connecting = false;
                this.connected = false;
                if (this.verbose) {
                    console.log('[ObservabilityBus] Socket error:', error.message);
                }
            });
            this.socket.on('close', () => {
                this.connected = false;
                this.connecting = false;
                this.socket = null;
                if (this.verbose) {
                    console.log('[ObservabilityBus] Disconnected from daemon');
                }
            });
            this.socket.on('end', () => {
                this.connected = false;
                this.connecting = false;
            });
        }
        catch (error) {
            this.connecting = false;
            if (this.verbose) {
                console.log('[ObservabilityBus] Connection failed:', error);
            }
        }
    }
    /**
     * Drain queued events after connection
     */
    drainQueue() {
        if (!this.connected || this.queue.length === 0) {
            return;
        }
        const events = [...this.queue];
        this.queue = [];
        for (const event of events) {
            this.sendEvent(event);
        }
        if (this.verbose) {
            console.log(`[ObservabilityBus] Drained ${events.length} queued events`);
        }
    }
    /**
     * Start periodic daemon check
     */
    startPeriodicCheck() {
        this.checkInterval = setInterval(() => {
            if (!this.connected && !this.shuttingDown) {
                this.checkForDaemon();
            }
        }, this.checkIntervalMs);
        // Don't prevent process from exiting
        this.checkInterval.unref();
    }
}
// =============================================================================
// Convenience Functions
// =============================================================================
/**
 * Get the singleton ObservabilityBus instance
 */
export function getObservabilityBus() {
    return ObservabilityBus.getInstance();
}
/**
 * Emit an event to the observability system
 * Convenience function for quick event emission
 */
export function emitObservabilityEvent(event) {
    getObservabilityBus().emit(event);
}
// =============================================================================
// Default Export
// =============================================================================
export default ObservabilityBus;
//# sourceMappingURL=bus.js.map