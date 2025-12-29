/**
 * God Agent VectorDB Module
 *
 * Implements: TASK-VDB-001
 * Referenced by: God Agent core system
 *
 * High-performance vector database with k-NN search for VECTOR_DIM (1536D) embeddings.
 * Enforces strict validation contract per constitution.md VEC-01 through VEC-05.
 * Supports automatic backend selection (native Rust or JavaScript fallback).
 */
export { VectorDB } from './vector-db.js';
export { DistanceMetric } from './types.js';
export type { VectorID, SearchResult, VectorDBOptions, VectorDBOptions as VectorDBConfig, // Alias for compatibility
BackendType } from './types.js';
export type { IHNSWBackend } from './hnsw-backend.js';
export { FallbackHNSW } from './fallback-hnsw.js';
export { BackendSelector } from './backend-selector.js';
export type { BackendSelection, PerformanceTier, BackendSelectorConfig } from './backend-selector.js';
export { cosineSimilarity, euclideanDistance, dotProduct, manhattanDistance, getMetricFunction, isSimilarityMetric } from './distance-metrics.js';
//# sourceMappingURL=index.d.ts.map