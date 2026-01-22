/**
 * LEANN Search MCP Server - Find Similar Code Tool
 *
 * Implements code similarity search using a code snippet as the query.
 * Finds semantically similar code in the indexed repository.
 *
 * @module mcp-servers/leann-search/tools/find-similar-code
 */
import type { ToolExecutionContext } from './semantic-code-search.js';
import type { CodeMetadata, SupportedLanguage, CodeSymbolType } from '../types.js';
import type { VectorID } from '../../../god-agent/core/vector-db/types.js';
/**
 * Input parameters for finding similar code
 */
export interface FindSimilarCodeInput {
    /** Code snippet to find similar code for */
    code: string;
    /** Maximum number of results to return (default: 10) */
    limit?: number;
    /** Minimum similarity score (0-1, default: 0.5) */
    minScore?: number;
    /** Filter by programming languages */
    languages?: SupportedLanguage[];
    /** Filter by symbol types */
    symbolTypes?: CodeSymbolType[];
    /** Filter by file path pattern (glob) */
    filePattern?: string;
    /** Filter by repository */
    repository?: string;
    /** Whether to exclude exact matches (same file/lines) */
    excludeExact?: boolean;
    /** Include the similar code content in results */
    includeCode?: boolean;
    /** Deduplication threshold (0-1, default: 0.95) */
    deduplicationThreshold?: number;
}
/**
 * Single similar code result
 */
export interface SimilarCodeResult {
    /** Unique identifier */
    vectorId: VectorID;
    /** Similarity score (0-1, higher is more similar) */
    similarity: number;
    /** Code metadata */
    metadata: CodeMetadata;
    /** The similar code content (if includeCode is true) */
    code?: string;
    /** Similarity category for quick understanding */
    category: 'exact' | 'near-duplicate' | 'very-similar' | 'similar' | 'related';
}
/**
 * Output from find similar code
 */
export interface FindSimilarCodeOutput {
    /** Whether search succeeded */
    success: boolean;
    /** Similar code results */
    results: SimilarCodeResult[];
    /** Total results found (before filtering) */
    totalFound: number;
    /** Input code length in characters */
    codeLength: number;
    /** Search time in milliseconds */
    searchTimeMs: number;
    /** Embedding generation time in milliseconds */
    embeddingTimeMs: number;
    /** Summary message */
    message: string;
}
/**
 * Find code similar to a given code snippet
 *
 * This tool:
 * 1. Embeds the input code using DualCodeEmbeddingProvider.embedCode()
 * 2. Searches the LEANN backend for similar code vectors
 * 3. Filters by language, symbol type, file pattern, repository
 * 4. Deduplicates and ranks results
 * 5. Returns categorized similarity results
 *
 * @param input - Search parameters with code snippet
 * @param context - Tool execution context
 * @returns Similar code results with metadata and scores
 */
export declare function findSimilarCode(input: FindSimilarCodeInput, context: ToolExecutionContext): Promise<FindSimilarCodeOutput>;
/**
 * MCP Tool definition for find_similar_code
 */
export declare const FIND_SIMILAR_CODE_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            code: {
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
            excludeExact: {
                type: string;
                description: string;
                default: boolean;
            };
            includeCode: {
                type: string;
                description: string;
                default: boolean;
            };
            deduplicationThreshold: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
                default: number;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=find-similar-code.d.ts.map