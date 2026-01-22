/**
 * LEANN Search MCP Server
 *
 * Provides semantic code search capabilities via MCP protocol.
 * Uses LEANN (Lightweight Exact Approximate Nearest Neighbor) for
 * high-performance vector similarity search with hub-aware navigation.
 *
 * Features:
 * - Natural language code search
 * - Repository indexing with automatic language detection
 * - Code similarity search
 * - Index statistics and monitoring
 *
 * @module mcp-servers/leann-search
 *
 * @example
 * ```typescript
 * // Programmatic usage
 * import { LEANNMCPServer } from './mcp-servers/leann-search';
 *
 * const server = new LEANNMCPServer({
 *   persistPath: './my-index',
 *   autoSave: true,
 * });
 *
 * await server.initialize();
 * await server.start();
 * ```
 *
 * @example
 * ```bash
 * # CLI usage
 * npx tsx src/mcp-servers/leann-search/index.ts
 *
 * # With environment variables
 * LEANN_PERSIST_PATH=./custom-path LEANN_LOG_LEVEL=debug npx tsx src/mcp-servers/leann-search/index.ts
 * ```
 */
import { LEANNMCPServer, main as serverMain } from './server.js';
import type { ToolExecutionContext } from './server.js';
export { LEANNMCPServer };
export type { ToolExecutionContext };
export { serverMain as main };
export type { SupportedLanguage, CodeSymbolType, CodeMetadata, } from './types.js';
export type { LEANNMCPServerConfig, LEANNMCPServerState, MCPToolDefinition, ToolContext, ToolResult, } from './types.js';
export type { IndexCodeInput, IndexCodeOutput, } from './types.js';
export type { SearchMode, FilterOperator, FilterCondition, FilterGroup, SearchCodeInput, SearchCodeOutput, CodeSearchResult, } from './types.js';
export type { GetStatsInput, GetStatsOutput, CategoryBreakdown, MemoryStats, LeannIndexStats, } from './types.js';
export type { ClearScope, ClearIndexInput, ClearIndexOutput, } from './types.js';
export { LEANNErrorCode, LEANNMCPError } from './types.js';
export type { VectorID, SearchResult, DistanceMetric, LEANNConfig, LEANNStats, } from './types.js';
export { semanticCodeSearch, SEMANTIC_CODE_SEARCH_DEFINITION, } from './tools/semantic-code-search.js';
export { indexRepository, indexCode, INDEX_REPOSITORY_DEFINITION, INDEX_CODE_DEFINITION, } from './tools/index-repository.js';
export { findSimilarCode, FIND_SIMILAR_CODE_DEFINITION, } from './tools/find-similar-code.js';
export { getIndexStats, getQuickStats, GET_INDEX_STATS_DEFINITION, } from './tools/get-index-stats.js';
export type { ToolHandler } from './tools/index.js';
//# sourceMappingURL=index.d.ts.map