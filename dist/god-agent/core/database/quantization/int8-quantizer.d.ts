/**
 * Int8 Quantizer Implementation
 *
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: QuantizedVectorStorage, HNSWIndex
 *
 * Provides Int8 quantization/dequantization for vector embeddings.
 * Supports symmetric and asymmetric quantization methods.
 *
 * Memory reduction: Float32 (4 bytes) -> Int8 (1 byte) = 4x reduction
 * Quality target: < 2% recall degradation
 *
 * Algorithm:
 * - Symmetric: value_int8 = round(value_float / scale)
 *   where scale = max(|values|) / 127
 * - Asymmetric: value_int8 = round((value_float - zero_point) / scale)
 *   where scale = (max - min) / 255, zero_point = min
 */
import { QuantizationConfig, QuantizedVector, QuantizedVectorBatch, QuantizationQualityMetrics } from './quantization-types.js';
/**
 * Int8 Quantizer for vector compression
 *
 * Converts Float32 vectors to Int8 representation with 4x memory reduction.
 * Maintains search quality through calibrated quantization parameters.
 */
export declare class Int8Quantizer {
    /** Quantization configuration */
    readonly config: QuantizationConfig;
    /** Int8 range constants */
    private readonly INT8_MIN;
    private readonly INT8_MAX;
    private readonly UINT8_RANGE;
    /**
     * Create a new Int8Quantizer
     *
     * @param config - Optional quantization configuration
     */
    constructor(config?: Partial<QuantizationConfig>);
    /**
     * Quantize a Float32 vector to Int8
     *
     * @param vector - Float32 vector to quantize
     * @returns Quantized Int8 array with scale and zero point
     */
    quantize(vector: Float32Array): QuantizedVector;
    /**
     * Symmetric quantization: maps [-max, +max] to [-127, +127]
     * Zero point is always 0, simplifies distance computation
     */
    private quantizeSymmetric;
    /**
     * Asymmetric quantization: maps [min, max] to [0, 255] then shifts to Int8
     * Provides better precision for non-symmetric distributions
     */
    private quantizeAsymmetric;
    /**
     * Dequantize Int8 vector back to Float32
     *
     * @param quantized - Int8 quantized vector
     * @param scale - Scale factor from quantization
     * @param zeroPoint - Zero point from quantization
     * @returns Reconstructed Float32 vector
     */
    dequantize(quantized: Int8Array, scale: number, zeroPoint: number): Float32Array;
    /**
     * Quantize multiple vectors in batch
     *
     * @param vectors - Array of Float32 vectors
     * @returns Batch of quantized vectors with metadata
     */
    quantizeBatch(vectors: Float32Array[]): QuantizedVectorBatch;
    /**
     * Compute approximate distance directly on quantized vectors
     *
     * Uses integer arithmetic for speed, then scales result.
     * For cosine distance on normalized vectors, we use dot product.
     *
     * @param a - First quantized vector
     * @param scaleA - Scale of first vector
     * @param zpA - Zero point of first vector
     * @param b - Second quantized vector
     * @param scaleB - Scale of second vector
     * @param zpB - Zero point of second vector
     * @returns Approximate distance
     */
    quantizedDistance(a: Int8Array, scaleA: number, zpA: number, b: Int8Array, scaleB: number, zpB: number): number;
    /**
     * Fast symmetric quantized distance computation
     * Uses integer dot product with delayed scaling
     */
    private symmetricQuantizedDistance;
    /**
     * Cosine distance for Float32 vectors
     */
    private cosineDistance;
    /**
     * Compute squared Euclidean distance on quantized vectors
     * Faster than cosine when only ranking matters
     */
    quantizedSquaredEuclidean(a: Int8Array, scaleA: number, zpA: number, b: Int8Array, scaleB: number, zpB: number): number;
    /**
     * Measure quantization quality by computing round-trip error
     *
     * @param vector - Original Float32 vector
     * @returns Quality metrics
     */
    measureQuality(vector: Float32Array): QuantizationQualityMetrics;
    /**
     * Batch quality measurement
     *
     * @param vectors - Array of original vectors
     * @returns Aggregated quality metrics
     */
    measureBatchQuality(vectors: Float32Array[]): QuantizationQualityMetrics;
}
//# sourceMappingURL=int8-quantizer.d.ts.map