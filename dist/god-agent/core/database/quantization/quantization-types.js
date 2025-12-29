/**
 * Int8 Quantization Type Definitions
 *
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: Int8Quantizer, QuantizedVectorStorage
 *
 * Type definitions for Int8 vector quantization system.
 */
/**
 * Default quantization configuration
 */
export const DEFAULT_QUANTIZATION_CONFIG = {
    method: 'symmetric',
    scaleType: 'per-vector',
};
//# sourceMappingURL=quantization-types.js.map