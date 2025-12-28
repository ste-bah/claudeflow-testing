/**
 * SSEBroadcaster - Server-Sent Events Broadcaster
 *
 * Implements real-time event streaming to connected dashboard clients.
 *
 * @module observability/sse-broadcaster
 * @see TASK-OBS-007-SSE-BROADCASTER.md
 * @see SPEC-OBS-001-CORE.md
 */
import type { Response } from 'express';
import { ISSEEvent } from './types.js';
/**
 * SSEBroadcaster interface
 * Implements [REQ-OBS-09]: SSE real-time streaming
 */
export interface ISSEBroadcaster {
    /**
     * Add a client to receive SSE events.
     * @param res Express Response object
     * @returns Unique client ID
     */
    addClient(res: Response): string;
    /**
     * Remove a client from broadcasting.
     * @param clientId Client ID to remove
     */
    removeClient(clientId: string): void;
    /**
     * Broadcast an event to all connected clients.
     * Non-blocking - returns immediately.
     * @param event SSE event to broadcast
     */
    broadcast(event: ISSEEvent): void;
    /**
     * Get the number of connected clients.
     */
    getClientCount(): number;
    /**
     * Shutdown the broadcaster and clean up resources.
     */
    shutdown(): void;
}
/**
 * SSEBroadcaster implementation
 *
 * Implements:
 * - [REQ-OBS-09]: SSE real-time streaming
 * - [RULE-OBS-002]: Non-blocking broadcast
 * - [RULE-OBS-003]: Graceful degradation (no errors from broadcast)
 */
export declare class SSEBroadcaster implements ISSEBroadcaster {
    private clients;
    private heartbeatInterval;
    private readonly HEARTBEAT_MS;
    private readonly verbose;
    private shuttingDown;
    /**
     * Create a new SSEBroadcaster
     * @param options Optional configuration
     */
    constructor(options?: {
        verbose?: boolean;
    });
    /**
     * Add a client to receive SSE events
     * Implements [REQ-OBS-09]: Client management
     * @param res Express Response object
     * @returns Unique client ID
     */
    addClient(res: Response): string;
    /**
     * Remove a client from broadcasting
     * @param clientId Client ID to remove
     */
    removeClient(clientId: string): void;
    /**
     * Broadcast an event to all connected clients
     * Implements [RULE-OBS-002]: Non-blocking
     * Implements [RULE-OBS-003]: No exceptions from broadcast
     * @param event SSE event to broadcast
     */
    broadcast(event: ISSEEvent): void;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Shutdown the broadcaster
     */
    shutdown(): void;
    /**
     * Generate unique client ID
     * Format: client_{timestamp}_{random}
     */
    private generateClientId;
    /**
     * Format an event for SSE protocol
     * Format: event: {type}\ndata: {json}\nid: {id}\n\n
     */
    private formatSSE;
    /**
     * Send an event to a specific client
     * @param clientId Target client ID
     * @param event SSE event to send
     */
    private sendToClient;
    /**
     * Start heartbeat to detect stale connections
     * Sends :heartbeat comment every 30 seconds
     */
    private startHeartbeat;
}
export default SSEBroadcaster;
//# sourceMappingURL=sse-broadcaster.d.ts.map