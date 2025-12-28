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
import { IActivityEventInput } from '../../observability/types.js';
/**
 * ObservabilityBus interface
 * Implements [REQ-OBS-01]: Event emission
 */
export interface IObservabilityBus {
    /**
     * Emit an event to the observability system.
     * Non-blocking - returns immediately.
     * @param event Event data (id and timestamp auto-generated)
     */
    emit(event: IActivityEventInput): void;
    /**
     * Check if connected to the daemon.
     */
    isConnected(): boolean;
    /**
     * Get the current queue size (events waiting to be sent).
     */
    getQueueSize(): number;
    /**
     * Flush all queued events (waits for completion).
     */
    flush(): Promise<void>;
    /**
     * Shutdown the bus and clean up resources.
     */
    shutdown(): void;
}
/**
 * ObservabilityBus singleton implementation
 *
 * Implements:
 * - [REQ-OBS-01]: Event emission
 * - [RULE-OBS-002]: Non-blocking emission
 * - [RULE-OBS-003]: Graceful degradation
 * - [RULE-OBS-008]: Auto-detection
 */
export declare class ObservabilityBus implements IObservabilityBus {
    private static instance;
    private socket;
    private connected;
    private connecting;
    private queue;
    private checkInterval;
    private readonly socketPath;
    private readonly maxQueueSize;
    private readonly checkIntervalMs;
    private readonly verbose;
    private shuttingDown;
    /**
     * Get singleton instance
     * Implements [RULE-OBS-008]: Auto-detection without configuration
     */
    static getInstance(): ObservabilityBus;
    /**
     * Reset singleton (for testing)
     */
    static resetInstance(): void;
    private constructor();
    /**
     * Get default socket path
     * Checks both ~/.god-agent/daemon.sock and /tmp/god-agent.sock
     */
    private getDefaultSocketPath;
    /**
     * Emit an event
     * Implements [RULE-OBS-002]: MUST return immediately (non-blocking)
     * Implements [RULE-OBS-003]: Failed delivery logged but no exception thrown
     */
    emit(event: IActivityEventInput): void;
    /**
     * Check if connected to daemon
     */
    isConnected(): boolean;
    /**
     * Get queue size
     */
    getQueueSize(): number;
    /**
     * Flush all queued events
     */
    flush(): Promise<void>;
    /**
     * Shutdown the bus
     */
    shutdown(): void;
    /**
     * Generate unique event ID
     * Format: evt_{timestamp}_{random}
     */
    private generateEventId;
    /**
     * Queue an event for later sending
     * Implements [RULE-OBS-004]: FIFO eviction when full
     */
    private queueEvent;
    /**
     * Send event to daemon (non-blocking)
     */
    private sendEvent;
    /**
     * Send event async (for flush)
     */
    private sendEventAsync;
    /**
     * Check for daemon socket and connect if available
     * Implements [RULE-OBS-008]: Auto-detect daemon
     */
    private checkForDaemon;
    /**
     * Connect to daemon socket
     */
    private connect;
    /**
     * Drain queued events after connection
     */
    private drainQueue;
    /**
     * Start periodic daemon check
     */
    private startPeriodicCheck;
}
/**
 * Get the singleton ObservabilityBus instance
 */
export declare function getObservabilityBus(): ObservabilityBus;
/**
 * Emit an event to the observability system
 * Convenience function for quick event emission
 */
export declare function emitObservabilityEvent(event: IActivityEventInput): void;
export default ObservabilityBus;
//# sourceMappingURL=bus.d.ts.map