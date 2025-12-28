/**
 * God Agent VectorDB Backend Selector
 *
 * Implements: TASK-VDB-001 enhancement (Native HNSW backend selection)
 * Referenced by: VectorDB
 *
 * Automatically selects the best available HNSW backend:
 * 1. Native Rust backend (optimal performance)
 * 2. JavaScript fallback (guaranteed availability)
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { DistanceMetric } from './types.js';
/**
 * Backend type identifier
 */
export type BackendType = 'native' | 'javascript';
/**
 * Performance tier for backend
 */
export type PerformanceTier = 'optimal' | 'fallback';
/**
 * Backend selection result
 */
export interface BackendSelection {
    /** Type of backend selected */
    type: BackendType;
    /** Whether backend is available and loaded */
    available: boolean;
    /** Performance tier of backend */
    performance: PerformanceTier;
    /** Human-readable description */
    description: string;
}
/**
 * Backend selector configuration
 */
export interface BackendSelectorConfig {
    /** Force specific backend type (skip auto-detection) */
    forceBackend?: BackendType;
    /** Enable verbose logging */
    verbose?: boolean;
}
/**
 * Backend Selector - Detects and loads optimal HNSW backend
 */
export declare class BackendSelector {
    /**
     * Detect if native Rust backend is available
     *
     * @returns true if native backend can be loaded
     */
    private static detectNativeBackend;
    /**
     * Select the best available HNSW backend
     *
     * Priority order:
     * 1. Native Rust backend (if available)
     * 2. JavaScript fallback (always available)
     *
     * @param config - Backend selector configuration
     * @returns Backend selection information
     */
    static selectBest(config?: BackendSelectorConfig): Promise<BackendSelection>;
    /**
     * Load the selected HNSW backend implementation
     *
     * @param dimension - Vector dimension
     * @param metric - Distance metric to use
     * @param config - Backend selector configuration
     * @returns Initialized HNSW backend
     */
    static loadBackend(dimension: number, metric: DistanceMetric, config?: BackendSelectorConfig): Promise<{
        backend: IHNSWBackend;
        selection: BackendSelection;
    }>;
    /**
     * Get information about all available backends
     *
     * @returns Array of backend availability information
     */
    static getAvailableBackends(): Promise<BackendSelection[]>;
}
//# sourceMappingURL=backend-selector.d.ts.map