/**
 * Fallback Validator
 * TASK-NFR-003 - Portability Validation Suite (NFR-5.2)
 *
 * Validates JavaScript fallback implementations:
 * - Functional equivalence with native
 * - Output consistency within tolerance
 * - Automatic fallback triggering
 */
/**
 * Runtime implementation type
 */
export type ImplementationType = 'native' | 'wasm' | 'javascript';
/**
 * Implementation result
 */
export interface ImplementationResult {
    /** Implementation type */
    type: ImplementationType;
    /** Whether implementation is available */
    available: boolean;
    /** Result value (stringified for comparison) */
    result?: string;
    /** Error if failed */
    error?: string;
    /** Execution time in ms */
    executionTimeMs?: number;
}
/**
 * Equivalence test result
 */
export interface EquivalenceTest {
    /** Test name */
    name: string;
    /** Reference implementation result */
    reference?: ImplementationResult;
    /** Fallback implementation result */
    fallback?: ImplementationResult;
    /** Whether outputs are equivalent */
    equivalent: boolean;
    /** Maximum difference (for numeric results) */
    maxDifference?: number;
    /** Tolerance used */
    tolerance?: number;
    /** Additional notes */
    note?: string;
    /** Error message */
    error?: string;
}
/**
 * Equivalence report
 */
export interface EquivalenceReport {
    /** Timestamp */
    timestamp: number;
    /** Tests run */
    tests: EquivalenceTest[];
    /** Summary */
    summary: {
        total: number;
        passed: number;
        allEquivalent: boolean;
    };
}
/**
 * Fallback validator configuration
 */
export interface FallbackValidatorConfig {
    /** Numeric comparison tolerance */
    tolerance: number;
    /** Vector comparison tolerance */
    vectorTolerance: number;
    /** Whether to log verbose output */
    verbose: boolean;
}
/**
 * Default validator configuration
 */
export declare const DEFAULT_FALLBACK_CONFIG: FallbackValidatorConfig;
/**
 * Fallback validator for NFR-5.2 validation
 *
 * Tests that JavaScript fallback implementations produce
 * functionally equivalent results to native implementations.
 *
 * @example
 * ```typescript
 * const validator = new FallbackValidator();
 * const report = await validator.validateEquivalence();
 *
 * if (report.summary.allEquivalent) {
 *   console.log('JS fallback is equivalent to native!');
 * }
 * ```
 */
export declare class FallbackValidator {
    private config;
    private nativeImpl?;
    private jsImpl?;
    constructor(config?: Partial<FallbackValidatorConfig>);
    /**
     * Initialize mock implementations for testing
     */
    private initializeImplementations;
    /**
     * Set custom native implementation
     */
    setNativeImplementation(impl: Record<string, Function>): void;
    /**
     * Set custom JS implementation
     */
    setJsImplementation(impl: Record<string, Function>): void;
    /**
     * Validate functional equivalence between native and JS
     */
    validateEquivalence(): Promise<EquivalenceReport>;
    /**
     * Test L2 normalization equivalence
     */
    testL2Normalize(): Promise<EquivalenceTest>;
    /**
     * Test cosine similarity equivalence
     */
    testCosineSimilarity(): Promise<EquivalenceTest>;
    /**
     * Test dot product equivalence
     */
    testDotProduct(): Promise<EquivalenceTest>;
    /**
     * Test Euclidean distance equivalence
     */
    testEuclideanDistance(): Promise<EquivalenceTest>;
    /**
     * Test kNN search equivalence
     */
    testKnnSearch(): Promise<EquivalenceTest>;
    /**
     * Test automatic fallback triggering
     */
    testFallbackTrigger(): Promise<{
        triggered: boolean;
        fallbackType: ImplementationType;
        reason?: string;
    }>;
    /**
     * Execute operation with automatic fallback
     */
    private executeWithFallback;
    /**
     * Generate test vector with random values
     */
    private generateTestVector;
    /**
     * Generate normalized test vector
     */
    private generateNormalizedVector;
    /**
     * Compute maximum absolute difference between vectors
     */
    private maxAbsDiff;
    /**
     * Compute cosine similarity
     */
    private computeCosineSimilarity;
    /**
     * Compute overlap between two ID lists
     */
    private computeOverlap;
    /**
     * Conditional logging
     */
    private log;
}
/**
 * Global fallback validator instance
 */
export declare const fallbackValidator: FallbackValidator;
//# sourceMappingURL=fallback-validator.d.ts.map