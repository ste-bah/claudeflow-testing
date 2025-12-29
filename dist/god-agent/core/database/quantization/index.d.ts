/**
 * Quantization Module Exports
 *
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: VectorDB, database/index.ts
 *
 * Provides Int8 vector quantization for memory-efficient storage.
 */
export type { QuantizationConfig, QuantizedVector, QuantizedVectorBatch, QuantizationMemoryStats, QuantizationQualityMetrics, StoredQuantizedVector, QuantizedSearchResult, } from './quantization-types.js';
export { DEFAULT_QUANTIZATION_CONFIG } from './quantization-types.js';
export { Int8Quantizer } from './int8-quantizer.js';
export { QuantizedVectorStorage } from './quantized-storage.js';
//# sourceMappingURL=index.d.ts.map