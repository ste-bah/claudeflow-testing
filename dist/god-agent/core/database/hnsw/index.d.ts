/**
 * HNSW Module Exports
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Referenced by: VectorDB
 *
 * Exports the HNSW index implementation and related types.
 */
export { HNSWIndex } from './hnsw-index.js';
export { HNSWNode } from './hnsw-node.js';
export type { HNSWConfig, HNSWSearchResult, SerializedIndex, SerializedNode, CandidateEntry, DistanceFunction, } from './hnsw-types.js';
export { DEFAULT_HNSW_CONFIG } from './hnsw-types.js';
export { cosineDistance, euclideanDistance, dotProductDistance, squaredEuclideanDistance, getDistanceFunction, distanceToSimilarity, } from './distance.js';
//# sourceMappingURL=index.d.ts.map