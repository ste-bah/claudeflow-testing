/**
 * SocketClient - Unix Domain Socket IPC Client (God Agent Side)
 *
 * Implements Unix Domain Socket client for sending events to daemon.
 *
 * @module observability/socket-client
 * @see TASK-OBS-012-SOCKET-IPC.md
 * @see SPEC-OBS-001-CORE.md
 */
import { IActivityEvent } from './types.js';
/**
 * Socket client interface
 * Implements [REQ-OBS-11]: God Agent side IPC client
 */
export interface ISocketClient {
    /**
     * Connect to daemon socket
     * @returns Promise resolving to connection success
     */
    connect(): Promise<boolean>;
    /**
     * Send an event (non-blocking)
     * Implements [RULE-OBS-002]: Non-blocking send
     * @param event Event to send
     */
    send(event: IActivityEvent): void;
    /**
     * Disconnect from daemon
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
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
export declare class SocketClient implements ISocketClient {
    private socket;
    private connected;
    private socketPath;
    private verbose;
    private queue;
    private readonly MAX_QUEUE_SIZE;
    private readonly CONNECTION_TIMEOUT_MS;
    /**
     * Create a new SocketClient
     * @param options Optional configuration
     */
    constructor(options?: {
        socketPath?: string;
        verbose?: boolean;
    });
    /**
     * Connect to daemon socket
     * @returns Promise resolving to connection success
     */
    connect(): Promise<boolean>;
    /**
     * Send an event (non-blocking)
     * Implements [RULE-OBS-002]: Non-blocking send
     * @param event Event to send
     */
    send(event: IActivityEvent): void;
    /**
     * Disconnect from daemon
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get current queue size (for testing)
     */
    getQueueSize(): number;
    /**
     * Queue an event when disconnected
     * Implements bounded queue (max 100 events)
     * @param event Event to queue
     */
    private queueEvent;
    /**
     * Flush queued events on connect
     */
    private flushQueue;
}
export default SocketClient;
//# sourceMappingURL=socket-client.d.ts.map