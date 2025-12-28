/**
 * Vector Scale Test
 * TASK-NFR-002 - Scalability Validation Suite (NFR-4.1)
 *
 * Tests vector database scaling:
 * - Progressive load: 10K → 100K → 500K → 1M vectors
 * - Compression ratio validation (target: 90%+ reduction)
 * - Search performance at scale
 * - Memory tracking
 */
/**
 * Vector scale test configuration
 */
export interface VectorScaleConfig {
    /** Vector dimensions */
    dimensions: number;
    /** Scale points to test */
    scalePoints: number[];
    /** Enable compression */
    compressionEnabled: boolean;
    /** Validate search performance */
    searchValidation: boolean;
    /** Track memory usage */
    memoryTracking: boolean;
    /** Batch size for insertions */
    batchSize: number;
}
/**
 * Default vector scale configuration
 */
export declare const DEFAULT_VECTOR_SCALE_CONFIG: VectorScaleConfig;
/**
 * Tier distribution
 */
export interface TierDistribution {
    hot: number;
    warm: number;
    cool: number;
    cold: number;
    frozen: number;
}
/**
 * Scale point result
 */
export interface ScalePointResult {
    /** Number of vectors */
    vectorCount: number;
    /** Raw memory in MB */
    rawMemoryMB: number;
    /** Compressed memory in MB */
    compressedMemoryMB: number;
    /** Compression ratio (0-1) */
    compressionRatio: number;
    /** Search latency p95 in ms */
    searchLatencyP95: number;
    /** Insert throughput (vectors/sec) */
    insertThroughput: number;
    /** Tier distribution */
    tierDistribution: TierDistribution;
    /** Duration in ms */
    durationMs: number;
}
/**
 * NFR-4.1 validation result
 */
export interface NFR41ValidationResult {
    /** Overall pass status */
    pass: boolean;
    /** Individual checks */
    checks: Array<{
        name: string;
        target: number;
        actual: number;
        pass: boolean;
    }>;
    /** Recommendation */
    recommendation: string;
}
/**
 * Vector scale report
 */
export interface VectorScaleReport {
    /** Test name */
    name: string;
    /** Timestamp */
    timestamp: number;
    /** Configuration used */
    config: VectorScaleConfig;
    /** Results for each scale point */
    results: ScalePointResult[];
    /** NFR-4.1 validation */
    validation: NFR41ValidationResult;
    /** Overall pass status */
    pass: boolean;
}
/**
 * Generate normalized random vectors
 */
export declare function generateNormalizedVectors(count: number, dimensions: number): Float32Array[];
/**
 * Vector scale test for NFR-4.1 validation
 *
 * Tests progressive vector scaling from 10K to 1M vectors,
 * measuring compression ratios and search performance.
 *
 * @example
 * ```typescript
 * const test = new VectorScaleTest();
 * const report = await test.runScaleTest();
 *
 * if (report.pass) {
 *   console.log('NFR-4.1 validated!');
 * } else {
 *   console.log('Compression or performance targets not met');
 * }
 * ```
 */
export declare class VectorScaleTest {
    private memoryMonitor;
    private vectors;
    private compressed;
    constructor();
    /**
     * Run progressive scale test
     */
    runScaleTest(config?: Partial<VectorScaleConfig>): Promise<VectorScaleReport>;
    /**
     * Run a single scale point test
     */
    private runScalePoint;
    /**
     * Simulate compression tier distribution
     */
    private simulateCompression;
    /**
     * Calculate compressed memory based on tier distribution
     */
    private calculateCompressedMemory;
    /**
     * Validate search performance
     */
    private validateSearchPerformance;
    /**
     * Simulate kNN search
     */
    private simulateSearch;
    /**
     * Calculate cosine similarity
     */
    private cosineSimilarity;
    /**
     * Reset test state
     */
    private reset;
    /**
     * Validate NFR-4.1 compliance
     */
    validateNFR41(results: ScalePointResult[]): NFR41ValidationResult;
    /**
     * Get current vector count
     */
    getVectorCount(): number;
    /**
     * Check if compression is active
     */
    isCompressed(): boolean;
}
/**
 * Global vector scale test instance
 */
export declare const vectorScaleTest: VectorScaleTest;
//# sourceMappingURL=vector-scale-test.d.ts.map