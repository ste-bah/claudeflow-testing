/**
 * God Agent VectorDB Backend Selector
 *
 * Implements: TASK-VDB-001 enhancement (Native HNSW backend selection)
 * Referenced by: VectorDB
 *
 * Automatically selects the best available HNSW backend:
 * 1. Native Rust backend (optimal performance)
 * 2. LEANN backend (efficient - 97% storage savings, pure TypeScript)
 * 3. JavaScript fallback (guaranteed availability)
 */
import { IHNSWBackend } from './hnsw-backend.js';
import { DistanceMetric } from './types.js';
import type { LEANNConfig } from './leann-types.js';
/**
 * Backend type identifier
 */
export type BackendType = 'native' | 'leann' | 'javascript';
/**
 * Performance tier for backend
 */
export type PerformanceTier = 'optimal' | 'efficient' | 'fallback';
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
    /** LEANN configuration options (only used when backend is 'leann') */
    leannConfig?: Partial<LEANNConfig>;
}
/**
 * Backend Selector - Detects and loads optimal HNSW backend
 *
 * Priority order:
 * 1. Native Rust backend (optimal) - requires compiled bindings
 * 2. LEANN backend (efficient) - always available, 97% storage savings
 * 3. JavaScript fallback (fallback) - always available
 */
export declare class BackendSelector {
    /**
     * Detect if native Rust backend is available
     *
     * @returns true if native backend can be loaded
     */
    private static detectNativeBackend;
    /**
     * Detect if LEANN backend is available
     * LEANN is always available as it's pure TypeScript with no native dependencies
     *
     * @returns true (LEANN is always available)
     */
    private static detectLEANNBackend;
    /**
     * Select the best available HNSW backend
     *
     * Priority order:
     * 1. Native Rust backend (if available) - optimal performance
     * 2. LEANN backend (always available) - efficient, 97% storage savings
     * 3. JavaScript fallback (always available) - guaranteed compatibility
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
    /**
     * Get the recommended backend for a given use case
     *
     * @param useCase - The intended use case
     * @returns Recommended backend type
     */
    static getRecommendedBackend(useCase: 'speed' | 'storage' | 'compatibility'): BackendType;
}
//# sourceMappingURL=backend-selector.d.ts.map