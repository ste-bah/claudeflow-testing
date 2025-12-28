/**
 * God Agent VectorDB - High-Level Vector Database
 *
 * Implements: TASK-VDB-001
 * Referenced by: God Agent core system
 *
 * Provides validated vector storage with k-NN search.
 * All vectors are validated at insertion boundaries per VEC-04.
 */
import { randomUUID } from 'crypto';
import { assertDimensions, VECTOR_DIM } from '../validation/index.js';
import { BackendSelector } from './backend-selector.js';
import { DistanceMetric } from './types.js';
/**
 * High-level vector database with automatic validation
 * Enforces 768D, L2-normalized vectors at all insertion boundaries
 * Automatically selects optimal HNSW backend (native Rust or JavaScript fallback)
 */
export class VectorDB {
    backend; // Initialized in initialize()
    dimension;
    metric;
    persistencePath;
    autoSave;
    backendConfig;
    backendSelection;
    initialized = false;
    /**
     * Create a new VectorDB instance
     *
     * Note: Backend selection happens asynchronously during first operation.
     * Call initialize() explicitly if you need to know backend selection before first use.
     *
     * @param options - Configuration options
     */
    constructor(options = {}) {
        const { dimension = VECTOR_DIM, metric = DistanceMetric.COSINE, 
        // HNSW params (hnswM, hnswEfConstruction, hnswEfSearch) will be used
        // when native backend is implemented - see HNSW_PARAMS in validation/constants
        persistencePath = '.agentdb/vectors.bin', autoSave = false, backend = 'auto', verbose = false } = options;
        this.dimension = dimension;
        this.metric = metric;
        this.persistencePath = persistencePath;
        this.autoSave = autoSave;
        // Store backend configuration for lazy initialization
        this.backendConfig = {
            type: backend === 'auto' ? undefined : backend,
            verbose
        };
    }
    /**
     * Initialize the VectorDB backend
     * This is called automatically on first operation, but can be called explicitly
     * to control when backend selection happens.
     *
     * @returns Backend selection information
     */
    async initialize() {
        if (this.initialized) {
            return this.backendSelection;
        }
        const { backend, selection } = await BackendSelector.loadBackend(this.dimension, this.metric, { forceBackend: this.backendConfig.type, verbose: this.backendConfig.verbose });
        this.backend = backend;
        this.backendSelection = selection;
        this.initialized = true;
        return selection;
    }
    /**
     * Get the underlying HNSW backend (for advanced use cases)
     * Note: Will trigger initialization if not already done
     */
    get backend_() {
        if (!this.initialized) {
            throw new Error('VectorDB not initialized. Call initialize() or perform an operation first.');
        }
        return this.backend;
    }
    /**
     * Get backend selection information
     *
     * @returns Backend selection details, or undefined if not yet initialized
     */
    getBackendInfo() {
        return this.backendSelection;
    }
    /**
     * Check if VectorDB is initialized
     *
     * @returns true if backend has been loaded
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Insert a vector into the database
     * Automatically generates a UUID for the vector
     *
     * @param vector - Vector to insert (must be 768D, L2-normalized, finite)
     * @returns The generated vector ID
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    async insert(vector) {
        // Ensure backend is initialized
        await this.initialize();
        // VEC-04: Validate at insertion boundary
        assertDimensions(vector, this.dimension, 'VectorDB.insert');
        // Generate ID and insert
        const id = randomUUID();
        this.backend.insert(id, vector);
        // Auto-save if enabled
        if (this.autoSave) {
            await this.save();
        }
        return id;
    }
    /**
     * Insert a vector with a specific ID
     *
     * @param id - Vector identifier
     * @param vector - Vector to insert (must be 768D, L2-normalized, finite)
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    async insertWithId(id, vector) {
        // Ensure backend is initialized
        await this.initialize();
        // VEC-04: Validate at insertion boundary
        assertDimensions(vector, this.dimension, 'VectorDB.insertWithId');
        this.backend.insert(id, vector);
        // Auto-save if enabled
        if (this.autoSave) {
            await this.save();
        }
    }
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
    async batchInsert(vectors) {
        // Ensure backend is initialized
        await this.initialize();
        const ids = [];
        // Validate all vectors first (fail fast)
        for (let i = 0; i < vectors.length; i++) {
            assertDimensions(vectors[i], this.dimension, `VectorDB.batchInsert[${i}]`);
        }
        // Insert all vectors
        for (const vector of vectors) {
            const id = randomUUID();
            this.backend.insert(id, vector);
            ids.push(id);
        }
        // Auto-save if enabled
        if (this.autoSave) {
            await this.save();
        }
        return ids;
    }
    /**
     * Search for k nearest neighbors
     *
     * @param query - Query vector (must be 768D, L2-normalized, finite)
     * @param k - Number of neighbors to return (default: 10)
     * @param includeVectors - Whether to include vector data in results (default: false)
     * @returns Array of search results, sorted by similarity (best first)
     * @throws GraphDimensionMismatchError if dimension mismatch
     * @throws NotNormalizedError if not L2-normalized
     * @throws InvalidVectorValueError if contains NaN/Infinity
     */
    async search(query, k = 10, includeVectors = false) {
        // Ensure backend is initialized
        await this.initialize();
        // VEC-04: Validate query at search boundary
        assertDimensions(query, this.dimension, 'VectorDB.search');
        return this.backend.search(query, k, includeVectors);
    }
    /**
     * Retrieve a vector by ID
     *
     * @param id - Vector identifier
     * @returns The vector if found, undefined otherwise
     */
    async getVector(id) {
        // Ensure backend is initialized
        await this.initialize();
        return this.backend.getVector(id);
    }
    /**
     * Delete a vector from the database
     *
     * @param id - Vector identifier to delete
     * @returns true if vector was deleted, false if not found
     */
    async delete(id) {
        // Ensure backend is initialized
        await this.initialize();
        const deleted = this.backend.delete(id);
        // Auto-save if enabled and something was deleted
        if (this.autoSave && deleted) {
            await this.save();
        }
        return deleted;
    }
    /**
     * Get the number of vectors in the database
     *
     * @returns Vector count
     */
    async count() {
        // Ensure backend is initialized
        await this.initialize();
        return this.backend.count();
    }
    /**
     * Save the database to persistent storage
     */
    async save() {
        // Ensure backend is initialized
        await this.initialize();
        await this.backend.save(this.persistencePath);
    }
    /**
     * Load the database from persistent storage
     *
     * @returns true if loaded successfully, false if file doesn't exist
     */
    async load() {
        // Ensure backend is initialized
        await this.initialize();
        return await this.backend.load(this.persistencePath);
    }
    /**
     * Clear all vectors from the database
     */
    async clear() {
        // Ensure backend is initialized
        await this.initialize();
        this.backend.clear();
    }
}
//# sourceMappingURL=vector-db.js.map