/**
 * LEANN (Lazy-Evaluated Approximate Nearest Neighbors) Type Definitions
 *
 * Implements: TASK-LEANN-001
 * Referenced by: LEANNBackend, BackendSelector
 */
/**
 * Default LEANN configuration
 */
export const DEFAULT_LEANN_CONFIG = {
    hubCacheRatio: 0.1,
    graphPruningRatio: 0.7,
    batchSize: 100,
    maxRecomputeLatencyMs: 50,
    efSearch: 50,
    hubDegreeThreshold: 10,
};
/** Storage version for LEANN format */
export const LEANN_STORAGE_VERSION = 1;
//# sourceMappingURL=leann-types.js.map