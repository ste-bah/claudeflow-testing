/**
 * JSON-RPC 2.0 Message Handler
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-002
 *
 * @module src/god-agent/core/daemon/message-handler
 */
import type { RegisteredService } from './daemon-types.js';
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification, ParsedMessage } from './protocol-types.js';
/**
 * Service registry interface (minimal for message handler)
 */
export interface IServiceRegistry {
    getService(name: string): RegisteredService | undefined;
}
/**
 * Message Handler for JSON-RPC 2.0 protocol
 */
export declare class MessageHandler {
    private readonly serviceRegistry;
    private buffers;
    constructor(serviceRegistry: IServiceRegistry);
    /**
     * Process incoming data buffer
     *
     * @param clientId - Client connection ID
     * @param data - Raw data buffer
     * @returns Array of responses to send back
     */
    processData(clientId: string, data: Buffer): Promise<JsonRpcResponse[]>;
    /**
     * Accumulate buffer and return complete messages
     */
    private accumulateBuffer;
    /**
     * Clear buffer for client
     */
    clearBuffer(clientId: string): void;
    /**
     * Parse a single JSON message
     */
    parseMessage(message: string): ParsedMessage;
    /**
     * Process a complete message string
     */
    processMessage(message: string): Promise<JsonRpcResponse[]>;
    /**
     * Route request to appropriate service handler
     */
    routeRequest(request: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse>;
    /**
     * Process batch of requests
     */
    processBatch(requests: (JsonRpcRequest | JsonRpcNotification)[]): Promise<JsonRpcResponse[]>;
    /**
     * Format response to string
     */
    formatResponse(response: JsonRpcResponse): string;
    /**
     * Format batch responses to string
     */
    formatBatchResponse(responses: JsonRpcResponse[]): string;
    /**
     * Create parse error response (for invalid JSON)
     */
    static createParseError(): JsonRpcResponse;
    /**
     * Create invalid request error response
     */
    static createInvalidRequestError(id?: string | number | null): JsonRpcResponse;
    /**
     * Create method not found error response
     */
    static createMethodNotFoundError(method: string, id: string | number | null): JsonRpcResponse;
    /**
     * Create internal error response
     */
    static createInternalError(message: string, id: string | number | null): JsonRpcResponse;
}
//# sourceMappingURL=message-handler.d.ts.map