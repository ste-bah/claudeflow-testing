/**
 * JSON-RPC 2.0 Protocol Types
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-002
 *
 * @module src/god-agent/core/daemon/protocol-types
 */
/**
 * JSON-RPC 2.0 version constant
 */
export const JSONRPC_VERSION = '2.0';
/**
 * Maximum message size in bytes (10MB)
 */
export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;
/**
 * Message delimiter
 */
export const MESSAGE_DELIMITER = '\n';
/**
 * JSON-RPC error codes per spec
 */
export var RpcErrorCode;
(function (RpcErrorCode) {
    /** Invalid JSON was received by the server */
    RpcErrorCode[RpcErrorCode["PARSE_ERROR"] = -32700] = "PARSE_ERROR";
    /** The JSON sent is not a valid Request object */
    RpcErrorCode[RpcErrorCode["INVALID_REQUEST"] = -32600] = "INVALID_REQUEST";
    /** The method does not exist / is not available */
    RpcErrorCode[RpcErrorCode["METHOD_NOT_FOUND"] = -32601] = "METHOD_NOT_FOUND";
    /** Invalid method parameter(s) */
    RpcErrorCode[RpcErrorCode["INVALID_PARAMS"] = -32602] = "INVALID_PARAMS";
    /** Internal JSON-RPC error */
    RpcErrorCode[RpcErrorCode["INTERNAL_ERROR"] = -32603] = "INTERNAL_ERROR";
    /** Reserved for implementation-defined server-errors (-32000 to -32099) */
    RpcErrorCode[RpcErrorCode["SERVER_ERROR"] = -32000] = "SERVER_ERROR";
})(RpcErrorCode || (RpcErrorCode = {}));
/**
 * Error messages for standard error codes
 */
export const RPC_ERROR_MESSAGES = {
    [RpcErrorCode.PARSE_ERROR]: 'Parse error',
    [RpcErrorCode.INVALID_REQUEST]: 'Invalid Request',
    [RpcErrorCode.METHOD_NOT_FOUND]: 'Method not found',
    [RpcErrorCode.INVALID_PARAMS]: 'Invalid params',
    [RpcErrorCode.INTERNAL_ERROR]: 'Internal error',
    [RpcErrorCode.SERVER_ERROR]: 'Server error',
};
/**
 * Create a JSON-RPC error object
 */
export function createRpcError(code, message, data) {
    return {
        code,
        message: message || RPC_ERROR_MESSAGES[code] || 'Unknown error',
        data,
    };
}
/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(result, id) {
    return {
        jsonrpc: JSONRPC_VERSION,
        result,
        id,
    };
}
/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(error, id) {
    return {
        jsonrpc: JSONRPC_VERSION,
        error,
        id,
    };
}
/**
 * Check if request is a notification (no id field)
 */
export function isNotification(request) {
    return !('id' in request) || request.id === undefined;
}
/**
 * Check if message is a valid JSON-RPC request structure
 */
export function isValidRequest(msg) {
    if (typeof msg !== 'object' || msg === null)
        return false;
    const obj = msg;
    return (obj.jsonrpc === JSONRPC_VERSION &&
        typeof obj.method === 'string' &&
        obj.method.length > 0);
}
/**
 * Check if message is a batch request
 */
export function isBatchRequest(msg) {
    return Array.isArray(msg) && msg.length > 0;
}
/**
 * Validate method name format
 * Methods should be lowercase with optional dots for namespacing
 */
export function isValidMethodName(method) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(method);
}
/**
 * Extract service name from method (e.g., "search.query" -> "search")
 */
export function extractServiceName(method) {
    const dotIndex = method.indexOf('.');
    return dotIndex > 0 ? method.substring(0, dotIndex) : method;
}
/**
 * Extract method name from full method (e.g., "search.query" -> "query")
 */
export function extractMethodName(method) {
    const dotIndex = method.indexOf('.');
    return dotIndex > 0 ? method.substring(dotIndex + 1) : method;
}
//# sourceMappingURL=protocol-types.js.map