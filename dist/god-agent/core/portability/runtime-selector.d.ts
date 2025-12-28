/**
 * Runtime Selector
 * TASK-NFR-003 - Portability Validation Suite (NFR-5.6)
 *
 * Automatically selects the best available runtime:
 * 1. Native Rust (optimal performance)
 * 2. WASM (good performance, universal)
 * 3. JavaScript (acceptable, always available)
 */
/**
 * Available runtime types
 */
export type RuntimeType = 'native' | 'wasm' | 'javascript';
/**
 * Performance rating for runtime
 */
export type PerformanceRating = 'optimal' | 'good' | 'acceptable';
/**
 * Runtime selection result
 */
export interface RuntimeSelection {
    /** Selected runtime type */
    type: RuntimeType;
    /** Reason for selection */
    reason: string;
    /** Performance rating */
    performance: PerformanceRating;
    /** Any warnings about the selection */
    warnings: string[];
    /** Whether selection was forced via environment */
    forced: boolean;
}
/**
 * Runtime loader function type
 */
export type RuntimeLoader = () => Promise<boolean>;
/**
 * Runtime configuration
 */
export interface RuntimeConfig {
    /** Custom native loader function */
    nativeLoader?: RuntimeLoader;
    /** Custom WASM loader function */
    wasmLoader?: RuntimeLoader;
    /** Force specific runtime */
    forceRuntime?: RuntimeType;
    /** Verbose logging */
    verbose?: boolean;
}
/**
 * Environment variable for runtime override
 */
export declare const RUNTIME_ENV_VAR = "GOD_AGENT_RUNTIME";
/**
 * Performance relative to native baseline
 */
export declare const RUNTIME_PERFORMANCE: Record<RuntimeType, number>;
/**
 * Runtime selector for NFR-5.6 validation
 *
 * Automatically selects the best available implementation based on
 * platform capabilities and module availability.
 *
 * @example
 * ```typescript
 * const selector = new RuntimeSelector();
 * const selection = await selector.selectRuntime();
 *
 * console.log(`Selected: ${selection.type}`);
 * console.log(`Performance: ${selection.performance}`);
 * ```
 */
export declare class RuntimeSelector {
    private detector;
    private config;
    private cachedSelection?;
    constructor(config?: RuntimeConfig);
    /**
     * Select best available runtime
     */
    selectRuntime(): Promise<RuntimeSelection>;
    /**
     * Check for environment variable override
     */
    private getEnvOverride;
    /**
     * Validate runtime type string
     */
    private isValidRuntime;
    /**
     * Create selection for forced runtime
     */
    private createForcedSelection;
    /**
     * Automatically select best runtime based on availability
     */
    private autoSelect;
    /**
     * Attempt to load native bindings
     */
    private tryLoadNative;
    /**
     * Attempt to load WASM module
     */
    private tryLoadWasm;
    /**
     * Get performance rating for runtime type
     */
    private getPerformanceRating;
    /**
     * Get relative performance multiplier
     */
    getRelativePerformance(type: RuntimeType): number;
    /**
     * Clear cached selection (for testing)
     */
    clearCache(): void;
    /**
     * Get current cached selection
     */
    getCachedSelection(): RuntimeSelection | undefined;
    /**
     * Conditional logging
     */
    private log;
    /**
     * Validate that selected runtime actually works
     */
    validateSelection(): Promise<{
        valid: boolean;
        selection: RuntimeSelection;
        error?: string;
    }>;
    /**
     * Get selection report for logging/debugging
     */
    getSelectionReport(): Promise<Record<string, unknown>>;
}
/**
 * Global runtime selector instance
 */
export declare const runtimeSelector: RuntimeSelector;
//# sourceMappingURL=runtime-selector.d.ts.map