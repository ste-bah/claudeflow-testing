/**
 * God Agent VectorDB - High-Level Vector Database
 *
 * Implements: TASK-VDB-001, TASK-OBS-002
 * Referenced by: God Agent core system
 *
 * Provides validated vector storage with k-NN search.
 * All vectors are validated at insertion boundaries per VEC-04.
 * Emits observability events for all operations per TASK-OBS-002.
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { BackendSelection } from './backend-selector.js';
import { VectorID, SearchResult, VectorDBOptions } from './types.js';
/**
 * High-level vector database with automatic validation
 * Enforces VECTOR_DIM (1536D), L2-normalized vectors at all insertion boundaries
 * Automatically selects optimal HNSW backend (native Rust or JavaScript fallback)
 */
export declare class VectorDB {
    private backend;
    private readonly dimension;
    private readonly metric;
    private readonly persistencePath;
    private readonly autoSave;
    private readonly backendConfig;
    private backendSelection?;
    private initialized;
    /**
     * Create a new VectorDB instance
     *
     * Note: Backend selection happens asynchronously during first operation.
     * Call initialize() explicitly if you need to know backend selection before first use.
     *
     * @param options - Configuration options
     */
    constructor(options?: VectorDBOptions);
    /**
     * Initialize the VectorDB backend
     * This is called automatically on first operation, but can be called explicitly
     * to control when backend selection happens.
     *
     * @returns Backend selection information
     */
    initialize(): Promise<BackendSelection>;
    /**
     * Get the underlying HNSW backend (for advanced use cases)
     * Note: Will trigger initialization if not already done
     */
    get backend_(): IHNSWBackend;
    /**
     * Get backend selection information
     *
     * @returns Backend selection details, or undefined if not yet initialized
     */
    getBackendInfo(): BackendSelection | undefined;
    /**
     * Check if VectorDB is initialized
     *
     * @returns true if backend has been loaded
     */
    isInitialized(): boolean;
    /**
     * Insert a vector into the database
     * Automatically generates a UUID for the vector
     *
     * @param vector - Vector to insert (must be VECTOR_DIM (1536D), L2-normalized, finite)
     * @returns The generated vector ID
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    insert(vector: Float32Array): Promise<VectorID>;
    /**
     * Insert a vector with a specific ID
     *
     * @param id - Vector identifier
     * @param vector - Vector to insert (must be VECTOR_DIM (1536D), L2-normalized, finite)
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    insertWithId(id: VectorID, vector: Float32Array): Promise<void>;
    /**
     * Batch insert multiple vectors
     * More efficient than individual inserts
     *
     * @param vectors - Array of vectors to insert
     * @returns Array of generated vector IDs
     * @throws GraphDimensionMismatchError if any dimension mismatch
     * @throws NotNormalizedError if any vector not L2-normalized
     * @throws InvalidVectorValueError if any vector contains NaN/Infinity
     */
    batchInsert(vectors: Float32Array[]): Promise<VectorID[]>;
    /**
     * Search for k nearest neighbors
     *
     * @param query - Query vector (must be VECTOR_DIM (1536D), L2-normalized, finite)
     * @param k - Number of neighbors to return (default: 10)
     * @param includeVectors - Whether to include vector data in results (default: false)
     * @returns Array of search results, sorted by similarity (best first)
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    search(query: Float32Array, k?: number, includeVectors?: boolean): Promise<SearchResult[]>;
    /**
     * Retrieve a vector by ID
     *
     * @param id - Vector identifier
     * @returns The vector if found, undefined otherwise
     */
    getVector(id: VectorID): Promise<Float32Array | undefined>;
    /**
     * Delete a vector from the database
     *
     * @param id - Vector identifier to delete
     * @returns true if vector was deleted, false if not found
     */
    delete(id: VectorID): Promise<boolean>;
    /**
     * Get the number of vectors in the database
     *
     * @returns Vector count
     */
    count(): Promise<number>;
    /**
     * Save the database to persistent storage
     */
    save(): Promise<void>;
    /**
     * Load the database from persistent storage
     *
     * @returns true if loaded successfully, false if file doesn't exist
     */
    load(): Promise<boolean>;
    /**
     * Clear all vectors from the database
     */
    clear(): Promise<void>;
}
//# sourceMappingURL=vector-db.d.ts.map