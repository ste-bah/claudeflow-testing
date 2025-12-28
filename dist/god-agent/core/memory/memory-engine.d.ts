/**
 * Memory Engine Core Implementation
 * Orchestrates VectorDB and GraphDB for unified memory management
 */
import type { VectorDB } from '../vector-db/index.js';
import type { GraphDB, NodeID } from '../graph-db/index.js';
import type { IEmbeddingProvider, IStoreOptions, IRetrieveOptions, ISearchOptions, MemorySearchResult, RelationType } from './types.js';
/**
 * MemoryEngine orchestrates vector and graph databases for semantic memory storage
 * Includes LRU cache for <50µs p95 latency on cache hits
 */
export declare class MemoryEngine {
    private readonly vectorDB;
    private readonly graphDB;
    private readonly embeddingProvider;
    private cache;
    private transactionManager;
    constructor(vectorDB: VectorDB, graphDB: GraphDB, embeddingProvider: IEmbeddingProvider, cacheCapacity?: number);
    /**
     * Store a key-value pair with semantic embedding and graph relationships
     * Uses Two-Phase Commit (2PC) for atomic rollback across VectorDB and GraphDB
     *
     * @param key - Unique identifier for the memory
     * @param value - Value to store (will be Base64 encoded)
     * @param options - Storage options including namespace and relationships
     * @throws {NamespaceValidationError} If namespace format is invalid
     * @throws {OrphanNodeError} If non-root namespace lacks linkTo
     * @throws {StorageTransactionError} If storage operation fails
     */
    store(key: string, value: string, options: IStoreOptions): Promise<void>;
    /**
     * Retrieve a memory value by key
     *
     * @param key - Memory key to retrieve
     * @param options - Retrieval options
     * @returns Decoded value or null if not found
     */
    retrieve(key: string, options?: IRetrieveOptions): Promise<string | null>;
    /**
     * Semantic search for memories using vector similarity
     *
     * @param query - Search query text
     * @param options - Search options (limit, namespace filter, etc.)
     * @returns Array of search results with scores
     */
    search(query: string, options?: ISearchOptions): Promise<MemorySearchResult[]>;
    /**
     * Get related memories through graph traversal
     *
     * @param nodeId - Starting node ID
     * @param relationType - Optional relation type filter
     * @returns Array of related memory results
     */
    getRelated(nodeId: NodeID, relationType?: RelationType): Promise<MemorySearchResult[]>;
    /**
     * Close the memory engine and release resources
     * Clears cache and closes any database connections
     */
    close(): Promise<void>;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): {
        size: number;
        capacity: number;
    };
}
//# sourceMappingURL=memory-engine.d.ts.map