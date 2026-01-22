/**
 * LEANN Context Service - Provides semantic code search for pipeline context.
 * Integrates LEANN vector search into pipeline execution per PRD Section 4.5.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-LEANN-CONTEXT-001
 *
 * @module src/god-agent/core/pipeline/leann-context-service
 */
import type { LEANNSourceAdapter } from '../search/adapters/leann-adapter.js';
/**
 * Code context result from semantic search
 */
export interface ICodeContextResult {
    /** File path of the code */
    filePath: string;
    /** Code content snippet */
    content: string;
    /** Similarity score (0-1) */
    similarity: number;
    /** Programming language (optional) */
    language?: string;
}
/**
 * Parameters for building semantic context
 */
export interface ISemanticContextParams {
    /** Description of the task to find relevant code for */
    taskDescription: string;
    /** Current pipeline phase index */
    phase: number;
    /** Output from previous pipeline step (optional) */
    previousOutput?: unknown;
    /** Maximum number of results to return (default: 5) */
    maxResults?: number;
}
/**
 * Semantic context result containing code search results
 */
export interface ISemanticContext {
    /** Array of relevant code contexts */
    codeContext: ICodeContextResult[];
    /** Total number of results found */
    totalResults: number;
    /** Original search query used */
    searchQuery: string;
}
/**
 * Configuration interface for LEANN context service
 */
export interface ILeannContextConfig {
    /** Default number of results to return */
    defaultMaxResults?: number;
    /** Default timeout for searches in ms */
    defaultTimeoutMs?: number;
    /** Minimum similarity threshold to include results */
    minSimilarityThreshold?: number;
}
/**
 * Service for providing semantic code context to pipeline agents.
 * Uses LEANN vector search to find relevant code snippets based on task descriptions.
 *
 * @example
 * ```typescript
 * const service = new LeannContextService();
 * await service.initialize(leannAdapter);
 *
 * const context = await service.buildSemanticContext({
 *   taskDescription: 'implement user authentication',
 *   phase: 1,
 *   maxResults: 5,
 * });
 * ```
 */
export declare class LeannContextService {
    private adapter?;
    private initialized;
    private readonly defaultMaxResults;
    private readonly defaultTimeoutMs;
    private readonly minSimilarityThreshold;
    /**
     * Create a new LEANN context service
     *
     * @param config - Optional configuration overrides
     */
    constructor(config?: ILeannContextConfig);
    /**
     * Initialize the service with a LEANN adapter
     *
     * @param adapter - Configured LEANNSourceAdapter instance
     */
    initialize(adapter: LEANNSourceAdapter): Promise<void>;
    /**
     * Check if the service is initialized and ready
     */
    isInitialized(): boolean;
    /**
     * Search for relevant code context based on a text query
     *
     * @param query - Text query to search for
     * @param k - Maximum number of results (default: 5)
     * @param timeoutMs - Search timeout in milliseconds
     * @returns Array of code context results
     */
    searchCodeContext(query: string, k?: number, timeoutMs?: number): Promise<ICodeContextResult[]>;
    /**
     * Build semantic context for a pipeline step
     *
     * @param params - Parameters for building context
     * @returns Semantic context with code search results
     */
    buildSemanticContext(params: ISemanticContextParams): Promise<ISemanticContext>;
    /**
     * Transform raw LEANN results to code context format
     *
     * @param results - Raw search results from LEANN
     * @returns Transformed code context results
     */
    private transformResults;
    /**
     * Extract file path from result metadata
     */
    private extractFilePath;
    /**
     * Extract content from result
     */
    private extractContent;
    /**
     * Extract programming language from metadata
     */
    private extractLanguage;
    /**
     * Infer programming language from file path extension
     */
    private inferLanguageFromPath;
    /**
     * Build search query from context parameters
     *
     * @param params - Semantic context parameters
     * @returns Optimized search query string
     */
    private buildSearchQuery;
    /**
     * Extract relevant terms from previous output for context enrichment
     *
     * @param output - Previous step output
     * @returns Array of relevant terms
     */
    private extractContextTerms;
    /**
     * Get the underlying adapter (for testing/debugging)
     */
    getAdapter(): LEANNSourceAdapter | undefined;
    /**
     * Save the LEANN index to persistent storage.
     * Persists both the vector index and content store.
     * Uses atomic writes (temp file + rename) to prevent corruption.
     *
     * @param filePath - Path to save the index (content stored at filePath + '.content')
     * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
     * @throws Error if adapter not initialized (ERR-001)
     * @throws Error if save operation times out or fails
     */
    save(filePath: string, timeoutMs?: number): Promise<void>;
    /**
     * Load the LEANN index from persistent storage.
     * Restores both the vector index and content store.
     *
     * @param filePath - Path to load the index from (content loaded from filePath + '.content')
     * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
     * @returns True if loaded successfully, false if file doesn't exist
     * @throws Error if adapter not initialized (ERR-001)
     * @throws Error if load operation times out or fails
     */
    load(filePath: string, timeoutMs?: number): Promise<boolean>;
    /**
     * Get the number of vectors currently in the index.
     * Useful for debugging and metrics.
     *
     * @returns Number of vectors, or 0 if adapter not initialized
     */
    getVectorCount(): number;
}
/**
 * Factory function to create a LeannContextService
 *
 * @param config - Optional configuration overrides
 * @returns New LeannContextService instance
 */
export declare function createLeannContextService(config?: ILeannContextConfig): LeannContextService;
//# sourceMappingURL=leann-context-service.d.ts.map