/**
 * Compression Manager
 * TASK-CMP-001 - 5-Tier Compression Lifecycle
 *
 * Manages adaptive vector compression with:
 * - Automatic tier transitions based on access patterns
 * - Heat score tracking (recency + frequency)
 * - One-way compression (Hot → Frozen only)
 *
 * Target: 90%+ memory reduction for 1M vectors (3GB → 297MB)
 */
import { CompressionTier, type VectorID, type IAccessRecord, type IMemoryUsageStats, type ICompressionConfig } from './compression-types.js';
/**
 * Compression Manager - Handles 5-tier adaptive compression
 */
export declare class CompressionManager {
    private readonly config;
    private embeddings;
    private accessRecords;
    private originalVectors;
    private pq8Codebook;
    private pq4Codebook;
    private binaryThresholds;
    private trainingBuffer;
    private readonly minTrainingSize;
    private transitionTimer;
    constructor(config?: ICompressionConfig);
    /**
     * Store a new vector (starts at HOT tier)
     */
    store(vectorId: VectorID, vector: Float32Array): void;
    /**
     * Retrieve a vector (decompresses and updates access)
     */
    retrieve(vectorId: VectorID): Float32Array | null;
    /**
     * Check if a vector exists
     */
    has(vectorId: VectorID): boolean;
    /**
     * Delete a vector
     */
    delete(vectorId: VectorID): boolean;
    /**
     * Get current tier of a vector
     */
    getTier(vectorId: VectorID): CompressionTier | null;
    /**
     * Get access record for a vector
     */
    getAccessRecord(vectorId: VectorID): IAccessRecord | null;
    /**
     * Compress vector to target tier
     */
    private compress;
    /**
     * Decompress embedding back to Float32
     */
    private decompress;
    /**
     * Manually transition a vector to a new tier
     * Only forward transitions allowed (Hot → Frozen direction)
     */
    transitionTier(vectorId: VectorID, targetTier: CompressionTier): void;
    /**
     * Check and transition vectors based on heat scores
     */
    checkTransitions(): number;
    /**
     * Record an access to a vector
     */
    private recordAccess;
    /**
     * Calculate heat score based on access patterns
     * Combines recency and frequency
     */
    private calculateHeatScore;
    /**
     * Decay all heat scores (call periodically)
     */
    decayHeatScores(): void;
    /**
     * Train all codebooks from stored vectors
     */
    trainCodebooks(): void;
    /**
     * Check if codebooks are trained
     */
    areCodebooksTrained(): boolean;
    /**
     * Get memory usage statistics
     */
    getMemoryStats(): IMemoryUsageStats;
    /**
     * Get tier distribution
     */
    getTierDistribution(): Map<CompressionTier, number>;
    /**
     * Get all vector IDs
     */
    getAllVectorIds(): VectorID[];
    /**
     * Get count of vectors
     */
    get size(): number;
    /**
     * Start automatic tier transitions
     */
    private startAutoTransition;
    /**
     * Stop automatic tier transitions
     */
    stopAutoTransition(): void;
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Dispose of resources
     */
    dispose(): void;
    /**
     * Measure compression error for a vector (MSE between original and reconstructed)
     */
    measureCompressionError(vectorId: VectorID): number | null;
    /**
     * Force train codebooks with custom data
     * (Used for testing)
     */
    forceTrainCodebooks(vectors: Float32Array[]): void;
}
//# sourceMappingURL=compression-manager.d.ts.map