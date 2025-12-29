/**
 * Database module exports for god-agent learning system
 *
 * Implements: REQ-DESC-007, GAP-DESC-007
 * Implements: TASK-PERF-001 (HNSW), TASK-PERF-002 (Int8 Quantization)
 * Constitution: RULE-008, RULE-046, RULE-085
 */

// Core connection exports
export {
  DatabaseConnection,
  IDatabaseConnection,
  DatabaseConfig,
  getDatabaseConnection,
  closeDatabaseConnection,
  hasConnection,
  createConnection,
} from './connection.js';

// DAO exports (TASK-DESC-003: SQLite-backed persistence)
export { EpisodeDAO } from './dao/episode-dao.js';

// Cache exports (TASK-DESC-005: LRU cache with eviction)
export {
  LRUCache,
  ILRUCacheMetrics,
  EvictionCallback,
  SizeCalculator,
  createEpisodeSizeCalculator,
} from './cache/lru-cache.js';

// HNSW exports (TASK-PERF-001: O(log n) vector search)
export {
  HNSWIndex,
  HNSWNode,
  HNSWConfig,
  HNSWSearchResult,
  DEFAULT_HNSW_CONFIG,
  cosineDistance,
  euclideanDistance,
  dotProductDistance,
  squaredEuclideanDistance,
  getDistanceFunction,
  distanceToSimilarity,
} from './hnsw/index.js';

// Quantization exports (TASK-PERF-002: 4x memory reduction)
export {
  Int8Quantizer,
  QuantizedVectorStorage,
  QuantizationConfig,
  DEFAULT_QUANTIZATION_CONFIG,
  QuantizedVector,
  QuantizedVectorBatch,
  QuantizationMemoryStats,
  QuantizationQualityMetrics,
  StoredQuantizedVector,
  QuantizedSearchResult,
} from './quantization/index.js';
