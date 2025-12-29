/**
 * God Agent Core Validation Module
 *
 * Exports all validation utilities for the 1536-dimensional vector contract
 *
 * Referenced by: TASK-VEC-001
 */
export { VECTOR_DIM, L2_NORM_TOLERANCE, HNSW_PARAMS, LORA_PARAMS, L_SCORE_THRESHOLD } from './constants.js';
export { GraphDimensionMismatchError, ZeroVectorError, InvalidVectorValueError, NotNormalizedError, InvalidNamespaceError } from './errors.js';
export { calculateNorm, isL2Normalized, validateFiniteValues, normL2, assertDimensions, assertDimensionsOnly, createValidatedVector, cosineSimilarity, euclideanDistance } from './vector-validation.js';
export type { IRetryOptions } from './retry.js';
export { RetryExhaustedError, sleep, withRetry, withRetrySync } from './retry.js';
//# sourceMappingURL=index.d.ts.map