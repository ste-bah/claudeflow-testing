/**
 * LEANN Search MCP Server - Type Definitions
 *
 * This module defines all TypeScript interfaces for the LEANN Search MCP server.
 * It provides types for the 4 core tools: index_code, search_code, get_stats, and clear_index.
 *
 * @module mcp-servers/leann-search/types
 */
// ============================================================================
// Error Types
// ============================================================================
/**
 * Error codes for the MCP server
 */
export var LEANNErrorCode;
(function (LEANNErrorCode) {
    // General errors
    LEANNErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    LEANNErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    LEANNErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    // Backend errors
    LEANNErrorCode["BACKEND_NOT_INITIALIZED"] = "BACKEND_NOT_INITIALIZED";
    LEANNErrorCode["BACKEND_LOAD_FAILED"] = "BACKEND_LOAD_FAILED";
    LEANNErrorCode["BACKEND_SAVE_FAILED"] = "BACKEND_SAVE_FAILED";
    // Indexing errors
    LEANNErrorCode["INDEX_FAILED"] = "INDEX_FAILED";
    LEANNErrorCode["EMBEDDING_FAILED"] = "EMBEDDING_FAILED";
    LEANNErrorCode["DUPLICATE_ENTRY"] = "DUPLICATE_ENTRY";
    LEANNErrorCode["CONTENT_TOO_LARGE"] = "CONTENT_TOO_LARGE";
    // Search errors
    LEANNErrorCode["SEARCH_FAILED"] = "SEARCH_FAILED";
    LEANNErrorCode["INVALID_FILTER"] = "INVALID_FILTER";
    LEANNErrorCode["QUERY_TOO_LONG"] = "QUERY_TOO_LONG";
    // Clear errors
    LEANNErrorCode["CLEAR_FAILED"] = "CLEAR_FAILED";
    LEANNErrorCode["CONFIRMATION_REQUIRED"] = "CONFIRMATION_REQUIRED";
    LEANNErrorCode["INVALID_SCOPE"] = "INVALID_SCOPE";
    // Stats errors
    LEANNErrorCode["STATS_FAILED"] = "STATS_FAILED";
})(LEANNErrorCode || (LEANNErrorCode = {}));
/**
 * Custom error class for LEANN MCP operations
 */
export class LEANNMCPError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'LEANNMCPError';
    }
}
//# sourceMappingURL=types.js.map