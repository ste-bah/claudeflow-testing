/**
 * Memory IPC Protocol
 * MEM-001 - Serialization and message handling for multi-process memory
 *
 * Protocol: Newline-delimited JSON (NDJSON) over stream
 * Each message is a single JSON object followed by \n
 */
import type { IMemoryRequest, IMemoryResponse, MemoryMethod, IMemoryErrorInfo } from '../types/memory-types.js';
/**
 * Create a new request message
 */
export declare function createRequest<T>(method: MemoryMethod, params: T): IMemoryRequest<T>;
/**
 * Create a success response
 */
export declare function createSuccessResponse<T>(requestId: string, result: T): IMemoryResponse<T>;
/**
 * Create an error response
 */
export declare function createErrorResponse(requestId: string, error: IMemoryErrorInfo): IMemoryResponse<null>;
/**
 * Serialize message to NDJSON format (with trailing newline)
 */
export declare function serializeMessage<T>(message: IMemoryRequest<T> | IMemoryResponse<T>): string;
/**
 * Parse a single message from JSON string
 * Throws InvalidRequestError if malformed
 */
export declare function parseMessage(data: string): IMemoryRequest | IMemoryResponse;
/**
 * Check if message is a request
 */
export declare function isRequest(message: IMemoryRequest | IMemoryResponse): message is IMemoryRequest;
/**
 * Check if message is a response
 */
export declare function isResponse(message: IMemoryRequest | IMemoryResponse): message is IMemoryResponse;
/**
 * Message buffer for parsing NDJSON stream
 * Handles partial messages and multiple messages per chunk
 */
export declare class MessageBuffer {
    private buffer;
    /**
     * Add data to buffer and extract complete messages
     */
    push(chunk: string): (IMemoryRequest | IMemoryResponse)[];
    /**
     * Clear the buffer
     */
    clear(): void;
    /**
     * Check if buffer has partial data
     */
    hasPartial(): boolean;
}
/**
 * Check if method name is valid
 */
export declare function isValidMethod(method: string): method is MemoryMethod;
/**
 * Validate request parameters based on method
 */
export declare function validateParams(method: MemoryMethod, params: unknown): void;
//# sourceMappingURL=memory-protocol.d.ts.map