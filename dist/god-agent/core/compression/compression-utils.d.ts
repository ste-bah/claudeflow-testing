/**
 * Compression Utilities
 * TASK-CMP-001 - 5-Tier Compression Lifecycle
 *
 * Provides encoding/decoding utilities for:
 * - Float32 ↔ Float16 conversion
 * - Product Quantization (PQ8, PQ4)
 * - Binary quantization
 *
 * Target: <1ms compression/decompression for real-time use
 */
import type { IPQCodebook, IBinaryThresholds } from './compression-types.js';
/**
 * Convert Float32 to Float16 (half precision)
 * IEEE 754 half-precision format
 */
export declare function float32ToFloat16(value: number): number;
/**
 * Convert Float16 to Float32
 */
export declare function float16ToFloat32(half: number): number;
/**
 * Encode Float32Array to Float16 (Uint16Array)
 */
export declare function encodeFloat16(vector: Float32Array): Uint16Array;
/**
 * Decode Float16 (Uint16Array) to Float32Array
 */
export declare function decodeFloat16(encoded: Uint16Array): Float32Array;
/**
 * Train PQ codebook using k-means clustering
 * @param vectors Training vectors
 * @param numSubvectors Number of subvectors to split into
 * @param numCentroids Number of centroids per subvector (256 for PQ8, 16 for PQ4)
 * @param maxIterations Maximum k-means iterations
 */
export declare function trainPQCodebook(vectors: Float32Array[], numSubvectors: number, numCentroids: number, maxIterations?: number): IPQCodebook;
/**
 * Encode vector using PQ codebook (PQ8 - 8-bit codes)
 */
export declare function encodePQ8(vector: Float32Array, codebook: IPQCodebook): Uint8Array;
/**
 * Decode PQ8 codes back to approximate vector
 */
export declare function decodePQ8(codes: Uint8Array, codebook: IPQCodebook, originalDim: number): Float32Array;
/**
 * Encode vector using PQ4 (4-bit codes, packed into bytes)
 */
export declare function encodePQ4(vector: Float32Array, codebook: IPQCodebook): Uint8Array;
/**
 * Decode PQ4 codes back to approximate vector
 */
export declare function decodePQ4(codes: Uint8Array, codebook: IPQCodebook, originalDim: number): Float32Array;
/**
 * Train binary thresholds from vectors (per-dimension median)
 */
export declare function trainBinaryThresholds(vectors: Float32Array[]): IBinaryThresholds;
/**
 * Encode vector to binary (1 bit per dimension)
 */
export declare function encodeBinary(vector: Float32Array, thresholds: IBinaryThresholds): Uint8Array;
/**
 * Decode binary back to approximate vector
 * Uses threshold values as reconstruction targets
 */
export declare function decodeBinary(encoded: Uint8Array, thresholds: IBinaryThresholds): Float32Array;
/**
 * Calculate reconstruction error (MSE)
 */
export declare function calculateReconstructionError(original: Float32Array, reconstructed: Float32Array): number;
/**
 * Calculate cosine similarity between vectors
 */
export declare function cosineSimilarityCompression(a: Float32Array, b: Float32Array): number;
/**
 * Convert Uint8Array to Uint16Array (for Float16)
 */
export declare function uint8ToUint16(data: Uint8Array): Uint16Array;
/**
 * Convert Uint16Array to Uint8Array
 */
export declare function uint16ToUint8(data: Uint16Array): Uint8Array;
//# sourceMappingURL=compression-utils.d.ts.map