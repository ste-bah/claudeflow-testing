/**
 * HNSW Index Type Definitions
 *
 * Implements: TASK-PERF-001 (Native HNSW backend)
 * Implements: TASK-PERF-002 (Int8 quantization support)
 * Referenced by: HNSWIndex, HNSWNode
 *
 * Type definitions for the Hierarchical Navigable Small World algorithm.
 */
/**
 * Default HNSW configuration optimized for balanced performance
 */
export const DEFAULT_HNSW_CONFIG = {
    M: 16,
    efConstruction: 200,
    efSearch: 50,
    metric: 'cosine',
    M0: 32, // 2 * M
    mL: 1 / Math.log(16), // 1 / ln(M)
};
//# sourceMappingURL=hnsw-types.js.map