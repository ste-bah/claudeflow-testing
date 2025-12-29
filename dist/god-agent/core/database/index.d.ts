/**
 * Database module exports for god-agent learning system
 *
 * Implements: REQ-DESC-007, GAP-DESC-007
 * Implements: TASK-PERF-001 (HNSW), TASK-PERF-002 (Int8 Quantization)
 * Constitution: RULE-008, RULE-046, RULE-085
 */
export type { IDatabaseConnection, DatabaseConfig, } from './connection.js';
export { DatabaseConnection, getDatabaseConnection, closeDatabaseConnection, hasConnection, createConnection, } from './connection.js';
export { EpisodeDAO } from './dao/episode-dao.js';
export type { ILRUCacheMetrics, EvictionCallback, SizeCalculator, } from './cache/lru-cache.js';
export { LRUCache, createEpisodeSizeCalculator, } from './cache/lru-cache.js';
export type { HNSWConfig, HNSWSearchResult, SerializedIndex, SerializedNode, CandidateEntry, DistanceFunction, } from './hnsw/index.js';
export { HNSWIndex, HNSWNode, DEFAULT_HNSW_CONFIG, cosineDistance, euclideanDistance, dotProductDistance, squaredEuclideanDistance, getDistanceFunction, distanceToSimilarity, } from './hnsw/index.js';
export type { QuantizationConfig, QuantizedVector, QuantizedVectorBatch, QuantizationMemoryStats, QuantizationQualityMetrics, StoredQuantizedVector, QuantizedSearchResult, } from './quantization/index.js';
export { Int8Quantizer, QuantizedVectorStorage, DEFAULT_QUANTIZATION_CONFIG, } from './quantization/index.js';
//# sourceMappingURL=index.d.ts.map