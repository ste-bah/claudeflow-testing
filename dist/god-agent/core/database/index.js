/**
 * Database module exports for god-agent learning system
 *
 * Implements: REQ-DESC-007, GAP-DESC-007
 * Implements: TASK-PERF-001 (HNSW), TASK-PERF-002 (Int8 Quantization)
 * Constitution: RULE-008, RULE-046, RULE-085
 */
// Core connection exports (values)
export { DatabaseConnection, getDatabaseConnection, closeDatabaseConnection, hasConnection, createConnection, } from './connection.js';
// DAO exports (TASK-DESC-003: SQLite-backed persistence)
export { EpisodeDAO } from './dao/episode-dao.js';
export { LRUCache, createEpisodeSizeCalculator, } from './cache/lru-cache.js';
// Values
export { HNSWIndex, HNSWNode, DEFAULT_HNSW_CONFIG, cosineDistance, euclideanDistance, dotProductDistance, squaredEuclideanDistance, getDistanceFunction, distanceToSimilarity, } from './hnsw/index.js';
// Values
export { Int8Quantizer, QuantizedVectorStorage, DEFAULT_QUANTIZATION_CONFIG, } from './quantization/index.js';
//# sourceMappingURL=index.js.map