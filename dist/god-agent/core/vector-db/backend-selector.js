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
import { FallbackHNSW } from './fallback-hnsw.js';
/**
 * Backend Selector - Detects and loads optimal HNSW backend
 */
export class BackendSelector {
    /**
     * Detect if native Rust backend is available
     *
     * @returns true if native backend can be loaded
     */
    static async detectNativeBackend() {
        try {
            // Try to dynamically import native bindings
            // This will fail gracefully if native module is not compiled/available
            const native = await import('./native-hnsw.js');
            // Check both if the class exists AND if it's marked as available
            // Stub modules export NATIVE_AVAILABLE = false
            return typeof native.NativeHNSW !== 'undefined' && native.NATIVE_AVAILABLE === true;
        }
        catch (error) {
            // Native backend not available (expected in most environments)
            return false;
        }
    }
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
    static async selectBest(config = {}) {
        const { forceBackend, verbose = false } = config;
        // If backend is forced, skip detection
        if (forceBackend === 'javascript') {
            if (verbose) {
                console.log('[VectorDB] Backend forced to JavaScript fallback');
            }
            return {
                type: 'javascript',
                available: true,
                performance: 'fallback',
                description: 'JavaScript HNSW implementation (forced)',
            };
        }
        if (forceBackend === 'native') {
            const hasNative = await this.detectNativeBackend();
            if (!hasNative) {
                throw new Error('Native backend forced but not available. Compile Rust bindings or use forceBackend: "javascript"');
            }
            if (verbose) {
                console.log('[VectorDB] Backend forced to native Rust');
            }
            return {
                type: 'native',
                available: true,
                performance: 'optimal',
                description: 'Native Rust HNSW implementation (forced)',
            };
        }
        // Auto-detect best backend
        const hasNative = await this.detectNativeBackend();
        if (hasNative) {
            if (verbose) {
                console.log('[VectorDB] Native Rust backend detected - using optimal performance mode');
            }
            return {
                type: 'native',
                available: true,
                performance: 'optimal',
                description: 'Native Rust HNSW implementation (auto-detected)',
            };
        }
        // Fallback to JavaScript implementation
        if (verbose) {
            console.log('[VectorDB] Native backend unavailable - using JavaScript fallback');
        }
        return {
            type: 'javascript',
            available: true,
            performance: 'fallback',
            description: 'JavaScript HNSW implementation (auto-detected)',
        };
    }
    /**
     * Load the selected HNSW backend implementation
     *
     * @param dimension - Vector dimension
     * @param metric - Distance metric to use
     * @param config - Backend selector configuration
     * @returns Initialized HNSW backend
     */
    static async loadBackend(dimension, metric, config = {}) {
        const selection = await this.selectBest(config);
        let backend;
        if (selection.type === 'native') {
            // Load native backend
            const { NativeHNSW } = await import('./native-hnsw.js');
            backend = new NativeHNSW(dimension, metric);
        }
        else {
            // Load JavaScript fallback
            backend = new FallbackHNSW(dimension, metric);
        }
        return { backend, selection };
    }
    /**
     * Get information about all available backends
     *
     * @returns Array of backend availability information
     */
    static async getAvailableBackends() {
        const hasNative = await this.detectNativeBackend();
        const backends = [
            {
                type: 'javascript',
                available: true,
                performance: 'fallback',
                description: 'JavaScript HNSW implementation (always available)',
            },
        ];
        if (hasNative) {
            backends.unshift({
                type: 'native',
                available: true,
                performance: 'optimal',
                description: 'Native Rust HNSW implementation',
            });
        }
        return backends;
    }
}
//# sourceMappingURL=backend-selector.js.map