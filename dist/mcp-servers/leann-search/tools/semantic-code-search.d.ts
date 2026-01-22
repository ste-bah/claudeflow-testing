/**
 * LEANN Search MCP Server - Semantic Code Search Tool
 *
 * Implements natural language code search using the LEANN backend
 * and DualCodeEmbeddingProvider for optimal query understanding.
 *
 * @module mcp-servers/leann-search/tools/semantic-code-search
 */
import type { LEANNBackend } from '../../../god-agent/core/vector-db/leann-backend.js';
import type { DualCodeEmbeddingProvider } from '../../../god-agent/core/search/dual-code-embedding.js';
import type { SearchCodeInput, SearchCodeOutput, CodeMetadata } from '../types.js';
import type { VectorID } from '../../../god-agent/core/vector-db/types.js';
/**
 * Execution context provided to all tools
 * Contains backend and embedding provider instances
 */
export interface ToolExecutionContext {
    /** LEANN backend instance for vector operations */
    backend: LEANNBackend;
    /** Dual code embedding provider for query/code embeddings */
    embeddingProvider: DualCodeEmbeddingProvider;
    /** Metadata storage (maps vector IDs to code metadata) */
    metadataStore: Map<VectorID, CodeMetadata>;
    /** Code content storage (maps vector IDs to actual code) */
    codeStore: Map<VectorID, string>;
    /** Request ID for tracing */
    requestId?: string;
}
/**
 * Generic tool handler function signature
 */
export type ToolHandler<TInput, TOutput> = (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;
/**
 * Perform semantic code search using natural language query
 *
 * This tool:
 * 1. Embeds the natural language query using DualCodeEmbeddingProvider
 * 2. Searches the LEANN backend for similar code vectors
 * 3. Applies metadata filters (language, file pattern, repository)
 * 4. Returns ranked code search results
 *
 * @param input - Search parameters (query, filters, options)
 * @param context - Tool execution context with backend and providers
 * @returns Search results with metadata and similarity scores
 */
export declare function semanticCodeSearch(input: SearchCodeInput, context: ToolExecutionContext): Promise<SearchCodeOutput>;
/**
 * MCP Tool definition for semantic_code_search
 */
export declare const SEMANTIC_CODE_SEARCH_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
                default: number;
            };
            minScore: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
            mode: {
                type: string;
                enum: string[];
                description: string;
                default: string;
            };
            languages: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            symbolTypes: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            filePattern: {
                type: string;
                description: string;
            };
            repository: {
                type: string;
                description: string;
            };
            includeCode: {
                type: string;
                description: string;
                default: boolean;
            };
            deduplicate: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=semantic-code-search.d.ts.map