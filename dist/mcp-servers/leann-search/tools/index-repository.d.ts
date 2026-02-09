/**
 * LEANN Search MCP Server - Index Repository Tool
 *
 * Implements repository indexing functionality for the LEANN semantic code search.
 * Walks the file system, parses code into chunks, embeds them, and stores in LEANN backend.
 *
 * @module mcp-servers/leann-search/tools/index-repository
 */
import type { ToolExecutionContext } from './semantic-code-search.js';
import type { IndexCodeInput, IndexCodeOutput, SupportedLanguage, CodeSymbolType } from '../types.js';
/**
 * Input parameters for repository indexing
 */
export interface IndexRepositoryInput {
    /** Path to the repository directory */
    repositoryPath: string;
    /** Repository name (optional, derived from path if not provided) */
    repositoryName?: string;
    /** File patterns to include (glob patterns) */
    filePatterns?: string[];
    /** File patterns to exclude (glob patterns) */
    excludePatterns?: string[];
    /** Programming languages to include */
    languages?: SupportedLanguage[];
    /** Maximum file size in bytes (default: 1MB) */
    maxFileSize?: number;
    /** Whether to replace existing entries for same files */
    replaceExisting?: boolean;
    /** Maximum chunk size in characters (default: 2000) */
    maxChunkSize?: number;
    /** Git branch name */
    branch?: string;
    /** Git commit hash */
    commitHash?: string;
}
/**
 * Output from repository indexing
 */
export interface IndexRepositoryOutput {
    /** Whether indexing completed successfully */
    success: boolean;
    /** Repository path that was indexed */
    repositoryPath: string;
    /** Repository name */
    repositoryName: string;
    /** Number of files indexed */
    filesIndexed: number;
    /** Number of code chunks indexed */
    chunksIndexed: number;
    /** Number of files skipped */
    filesSkipped: number;
    /** Total time in milliseconds */
    indexTimeMs: number;
    /** Files that had errors */
    errors: Array<{
        filePath: string;
        error: string;
    }>;
    /** Summary message */
    message: string;
}
/**
 * Parsed code chunk from a file
 */
export interface CodeChunk {
    /** The code content */
    content: string;
    /** Starting line number (1-indexed) */
    startLine: number;
    /** Ending line number (1-indexed) */
    endLine: number;
    /** Symbol type detected */
    symbolType: CodeSymbolType;
    /** Symbol name if detected */
    symbolName?: string;
    /** Parent symbol if nested */
    parentSymbol?: string;
}
/**
 * Detect language from file extension
 */
export declare function detectLanguage(filePath: string): SupportedLanguage;
/**
 * Parse code into chunks based on language-specific patterns
 */
export declare function parseCodeIntoChunks(content: string, language: SupportedLanguage, maxChunkSize: number): CodeChunk[];
/**
 * Get language-specific parsing patterns
 */
export declare function getLanguagePatterns(language: SupportedLanguage): Array<{
    regex: RegExp;
    type: CodeSymbolType;
}>;
/**
 * Index a repository for semantic code search
 *
 * This tool:
 * 1. Walks the file system to find matching code files
 * 2. Parses each file into semantic chunks (functions, classes, etc.)
 * 3. Generates embeddings for each chunk using DualCodeEmbeddingProvider
 * 4. Stores embeddings and metadata in the LEANN backend
 *
 * @param input - Repository indexing parameters
 * @param context - Tool execution context
 * @returns Indexing results with statistics
 */
export declare function indexRepository(input: IndexRepositoryInput, context: ToolExecutionContext): Promise<IndexRepositoryOutput>;
/**
 * Index a single code snippet
 *
 * @param input - Code indexing parameters
 * @param context - Tool execution context
 * @returns Indexing result
 */
export declare function indexCode(input: IndexCodeInput, context: ToolExecutionContext): Promise<IndexCodeOutput>;
/**
 * MCP Tool definition for index_repository
 */
export declare const INDEX_REPOSITORY_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            repositoryPath: {
                type: string;
                description: string;
            };
            repositoryName: {
                type: string;
                description: string;
            };
            filePatterns: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            excludePatterns: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            languages: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            maxFileSize: {
                type: string;
                description: string;
                default: number;
            };
            replaceExisting: {
                type: string;
                description: string;
                default: boolean;
            };
            branch: {
                type: string;
                description: string;
            };
            commitHash: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/**
 * MCP Tool definition for index_code
 */
export declare const INDEX_CODE_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            code: {
                type: string;
                description: string;
            };
            filePath: {
                type: string;
                description: string;
            };
            language: {
                type: string;
                description: string;
            };
            symbolType: {
                type: string;
                description: string;
            };
            symbolName: {
                type: string;
                description: string;
            };
            startLine: {
                type: string;
                description: string;
            };
            endLine: {
                type: string;
                description: string;
            };
            repository: {
                type: string;
                description: string;
            };
            replaceExisting: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=index-repository.d.ts.map