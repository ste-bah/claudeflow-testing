/**
 * Search Type Definitions for Quad-Fusion Unified Search
 * PRD: PRD-GOD-AGENT-001
 * Technical Spec: TECH-SEARCH-001
 */
/**
 * Default configuration values
 */
export const DEFAULT_OPTIONS = {
    topK: 10,
    weights: {
        vector: 0.4,
        graph: 0.3,
        memory: 0.2,
        pattern: 0.1
    },
    graphDepth: 2,
    minPatternConfidence: 0.5,
    memoryNamespace: 'default',
    sourceTimeoutMs: 400,
    includeAttribution: true
};
/**
 * Maximum allowed values
 */
export const MAX_TOP_K = 100;
export const MAX_GRAPH_DEPTH = 5;
export const MAX_SOURCE_TIMEOUT_MS = 500;
// ============================================================================
// Error Types
// ============================================================================
/**
 * Search error codes
 */
export var SearchErrorCode;
(function (SearchErrorCode) {
    // Input errors (1xx)
    SearchErrorCode[SearchErrorCode["INVALID_QUERY"] = 100] = "INVALID_QUERY";
    SearchErrorCode[SearchErrorCode["INVALID_EMBEDDING"] = 101] = "INVALID_EMBEDDING";
    SearchErrorCode[SearchErrorCode["INVALID_OPTIONS"] = 102] = "INVALID_OPTIONS";
    SearchErrorCode[SearchErrorCode["QUERY_TOO_LONG"] = 103] = "QUERY_TOO_LONG";
    // Source errors (2xx)
    SearchErrorCode[SearchErrorCode["ALL_SOURCES_FAILED"] = 200] = "ALL_SOURCES_FAILED";
    SearchErrorCode[SearchErrorCode["VECTOR_SOURCE_ERROR"] = 201] = "VECTOR_SOURCE_ERROR";
    SearchErrorCode[SearchErrorCode["GRAPH_SOURCE_ERROR"] = 202] = "GRAPH_SOURCE_ERROR";
    SearchErrorCode[SearchErrorCode["MEMORY_SOURCE_ERROR"] = 203] = "MEMORY_SOURCE_ERROR";
    SearchErrorCode[SearchErrorCode["PATTERN_SOURCE_ERROR"] = 204] = "PATTERN_SOURCE_ERROR";
    // Fusion errors (3xx)
    SearchErrorCode[SearchErrorCode["FUSION_ERROR"] = 300] = "FUSION_ERROR";
    SearchErrorCode[SearchErrorCode["DEDUPLICATION_ERROR"] = 301] = "DEDUPLICATION_ERROR";
    SearchErrorCode[SearchErrorCode["SCORING_ERROR"] = 302] = "SCORING_ERROR";
    // System errors (4xx)
    SearchErrorCode[SearchErrorCode["INITIALIZATION_ERROR"] = 400] = "INITIALIZATION_ERROR";
    SearchErrorCode[SearchErrorCode["CONFIGURATION_ERROR"] = 401] = "CONFIGURATION_ERROR";
    SearchErrorCode[SearchErrorCode["UNKNOWN_ERROR"] = 499] = "UNKNOWN_ERROR";
})(SearchErrorCode || (SearchErrorCode = {}));
/**
 * Create typed search error
 * @param code - Error code from SearchErrorCode enum
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns SearchError instance
 */
export function createSearchError(code, message, context = {}) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    error.recoverable = code < 300;
    return error;
}
// ============================================================================
// Validation Helpers
// ============================================================================
/**
 * Validate search options
 * @param options - Partial options to validate
 * @throws SearchError if validation fails
 */
export function validateOptions(options) {
    if (options.topK !== undefined) {
        if (options.topK < 1 || options.topK > MAX_TOP_K) {
            throw createSearchError(SearchErrorCode.INVALID_OPTIONS, `topK must be between 1 and ${MAX_TOP_K}`, { topK: options.topK });
        }
    }
    if (options.graphDepth !== undefined) {
        if (options.graphDepth < 1 || options.graphDepth > MAX_GRAPH_DEPTH) {
            throw createSearchError(SearchErrorCode.INVALID_OPTIONS, `graphDepth must be between 1 and ${MAX_GRAPH_DEPTH}`, { graphDepth: options.graphDepth });
        }
    }
    if (options.sourceTimeoutMs !== undefined) {
        if (options.sourceTimeoutMs < 100 || options.sourceTimeoutMs > MAX_SOURCE_TIMEOUT_MS) {
            throw createSearchError(SearchErrorCode.INVALID_OPTIONS, `sourceTimeoutMs must be between 100 and ${MAX_SOURCE_TIMEOUT_MS}`, { sourceTimeoutMs: options.sourceTimeoutMs });
        }
    }
    if (options.weights !== undefined) {
        const sum = Object.values(options.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 0.001) {
            throw createSearchError(SearchErrorCode.INVALID_OPTIONS, `weights must sum to 1.0, got ${sum}`, { weights: options.weights });
        }
    }
}
/**
 * Normalize weights to sum to 1.0
 * @param weights - Weights to normalize
 * @returns Normalized weights
 */
export function normalizeWeights(weights) {
    const sum = weights.vector + weights.graph + weights.memory + weights.pattern;
    if (sum === 0) {
        return { ...DEFAULT_OPTIONS.weights };
    }
    return {
        vector: weights.vector / sum,
        graph: weights.graph / sum,
        memory: weights.memory / sum,
        pattern: weights.pattern / sum
    };
}
/**
 * Merge partial options with defaults
 * @param options - Partial options to merge
 * @returns Complete options with defaults
 */
export function mergeOptions(options) {
    return {
        ...DEFAULT_OPTIONS,
        ...options,
        weights: options.weights
            ? normalizeWeights(options.weights)
            : DEFAULT_OPTIONS.weights
    };
}
//# sourceMappingURL=search-types.js.map