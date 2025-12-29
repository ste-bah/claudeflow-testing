/**
 * Compression Type Definitions
 * TASK-CMP-001 - 5-Tier Compression Lifecycle
 *
 * Provides types for adaptive vector compression (1536D vectors):
 * - Hot: Float32 (1x, 6144 bytes)
 * - Warm: Float16 (2x, 3072 bytes)
 * - Cool: PQ8 (8x, 768 bytes)
 * - Cold: PQ4 (16x, 384 bytes)
 * - Frozen: Binary (32x, 192 bytes)
 *
 * Target: 90%+ memory reduction for 1M vectors (6GB → 594MB)
 */
/**
 * Vector identifier
 */
export type VectorID = string;
/**
 * Compression tier enumeration
 * Ordered from least to most compressed
 */
export declare enum CompressionTier {
    HOT = "hot",// Float32, no compression
    WARM = "warm",// Float16, 2x compression
    COOL = "cool",// PQ8, 8x compression
    COLD = "cold",// PQ4, 16x compression
    FROZEN = "frozen"
}
/**
 * Tier hierarchy for one-way transitions
 */
export declare const TIER_HIERARCHY: CompressionTier[];
/**
 * Tier configuration
 */
export interface ITierConfig {
    /** Tier name */
    tier: CompressionTier;
    /** Minimum heat score for this tier */
    minHeatScore: number;
    /** Maximum heat score for this tier */
    maxHeatScore: number;
    /** Compression format */
    format: 'float32' | 'float16' | 'pq8' | 'pq4' | 'binary';
    /** Compression ratio (1 = no compression) */
    compressionRatio: number;
    /** Bytes per VECTOR_DIM vector */
    bytesPerVector: number;
    /** Maximum acceptable error rate */
    maxErrorRate: number;
}
/**
 * Default tier configurations
 */
export declare const TIER_CONFIGS: Record<CompressionTier, ITierConfig>;
/**
 * Compressed embedding with metadata
 */
export interface ICompressedEmbedding {
    /** Vector identifier */
    vectorId: VectorID;
    /** Current compression tier */
    tier: CompressionTier;
    /** Compressed data */
    data: Uint8Array;
    /** Original dimension (for validation) */
    originalDim: number;
    /** Compression timestamp */
    compressedAt: number;
    /** Codebook index (for PQ methods) */
    codebookIndex?: number;
}
/**
 * Access record for a vector
 */
export interface IAccessRecord {
    /** Vector identifier */
    vectorId: VectorID;
    /** Current tier */
    tier: CompressionTier;
    /** Access timestamps (last 24h) */
    accessTimestamps: number[];
    /** Total access count */
    totalAccesses: number;
    /** Current heat score [0, 1] */
    heatScore: number;
    /** Last access timestamp */
    lastAccessAt: number;
    /** Creation timestamp */
    createdAt: number;
}
/**
 * Memory usage statistics
 */
export interface IMemoryUsageStats {
    /** Total number of vectors */
    totalVectors: number;
    /** Count by tier */
    byTier: Record<CompressionTier, number>;
    /** Total bytes used */
    totalBytes: number;
    /** Compression ratio (original / compressed) */
    compressionRatio: number;
    /** Bytes saved */
    bytesSaved: number;
    /** Uncompressed size (for comparison) */
    uncompressedBytes: number;
}
/**
 * Compression manager configuration
 */
export interface ICompressionConfig {
    /** Default dimension (default: VECTOR_DIM = 1536) */
    dimension?: number;
    /** Heat decay rate per hour (default: 0.1) */
    heatDecayRate?: number;
    /** Window for access counting in ms (default: 86400000 = 24h) */
    accessWindow?: number;
    /** Enable automatic tier transitions (default: true) */
    autoTransition?: boolean;
    /** Transition check interval in ms (default: 3600000 = 1h) */
    transitionCheckInterval?: number;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
}
/**
 * Default configuration
 */
export declare const DEFAULT_COMPRESSION_CONFIG: Required<ICompressionConfig>;
/**
 * Product Quantization codebook
 */
export interface IPQCodebook {
    /** Number of subvectors */
    numSubvectors: number;
    /** Dimension per subvector */
    subvectorDim: number;
    /** Number of centroids (256 for PQ8, 16 for PQ4) */
    numCentroids: number;
    /** Centroids: [numSubvectors][numCentroids][subvectorDim] */
    centroids: Float32Array[];
    /** Training timestamp */
    trainedAt: number;
    /** Number of vectors used for training */
    trainingSize: number;
}
/**
 * Binary quantization thresholds
 */
export interface IBinaryThresholds {
    /** Per-dimension thresholds */
    thresholds: Float32Array;
    /** Training timestamp */
    trainedAt: number;
    /** Number of vectors used for training */
    trainingSize: number;
}
/**
 * Error thrown when compression fails
 */
export declare class CompressionError extends Error {
    readonly code: 'INVALID_TIER' | 'INVALID_DATA' | 'CODEC_NOT_TRAINED' | 'DIMENSION_MISMATCH';
    constructor(message: string, code: 'INVALID_TIER' | 'INVALID_DATA' | 'CODEC_NOT_TRAINED' | 'DIMENSION_MISMATCH');
}
/**
 * Error thrown when tier transition is invalid
 */
export declare class TierTransitionError extends Error {
    readonly fromTier: CompressionTier;
    readonly toTier: CompressionTier;
    constructor(fromTier: CompressionTier, toTier: CompressionTier);
}
/**
 * Get tier config for a heat score
 */
export declare function getTierForHeatScore(heatScore: number): CompressionTier;
/**
 * Check if tier transition is valid (forward only)
 */
export declare function isValidTransition(fromTier: CompressionTier, toTier: CompressionTier): boolean;
/**
 * Get the next tier in the hierarchy
 */
export declare function getNextTier(tier: CompressionTier): CompressionTier | null;
/**
 * Calculate bytes for N vectors at a tier
 */
export declare function calculateBytesForTier(tier: CompressionTier, count: number): number;
//# sourceMappingURL=compression-types.d.ts.map