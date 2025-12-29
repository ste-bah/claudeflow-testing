/**
 * HNSW Module Exports
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Referenced by: VectorDB
 *
 * Exports the HNSW index implementation and related types.
 */

// Core index
export { HNSWIndex } from './hnsw-index.js';

// Node structure
export { HNSWNode } from './hnsw-node.js';

// Types
export {
  HNSWConfig,
  HNSWSearchResult,
  DEFAULT_HNSW_CONFIG,
  SerializedIndex,
  SerializedNode,
  CandidateEntry,
  DistanceFunction,
} from './hnsw-types.js';

// Distance functions
export {
  cosineDistance,
  euclideanDistance,
  dotProductDistance,
  squaredEuclideanDistance,
  getDistanceFunction,
  distanceToSimilarity,
} from './distance.js';
