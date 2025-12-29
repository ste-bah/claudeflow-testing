/**
 * Quantization Module Exports
 *
 * Implements: TASK-PERF-002 (Int8 quantization for 4x memory reduction)
 * Referenced by: VectorDB, database/index.ts
 *
 * Provides Int8 vector quantization for memory-efficient storage.
 */

// Types
export {
  QuantizationConfig,
  DEFAULT_QUANTIZATION_CONFIG,
  QuantizedVector,
  QuantizedVectorBatch,
  QuantizationMemoryStats,
  QuantizationQualityMetrics,
  StoredQuantizedVector,
  QuantizedSearchResult,
} from './quantization-types.js';

// Core quantizer
export { Int8Quantizer } from './int8-quantizer.js';

// Storage wrapper
export { QuantizedVectorStorage } from './quantized-storage.js';
