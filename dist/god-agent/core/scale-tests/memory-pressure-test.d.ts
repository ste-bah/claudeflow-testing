/**
 * Memory Pressure Test
 * TASK-NFR-002 - Scalability Validation Suite (NFR-4.3)
 *
 * Tests system behavior under memory pressure:
 * - Tests at 60%, 80%, 90%, 95% utilization
 * - OOM prevention validation
 * - Compression trigger verification
 * - GC behavior analysis
 */
import { MemoryMonitor, type MemoryThreshold } from './utils/memory-monitor.js';
/**
 * Memory pressure test configuration
 */
export interface MemoryPressureConfig {
    /** Target utilization percentages */
    thresholds: number[];
    /** Operations to run under pressure */
    operationCount: number;
    /** Operation timeout in ms */
    operationTimeoutMs: number;
    /** Allow GC between operations */
    allowGC: boolean;
}
/**
 * Default memory pressure configuration
 */
export declare const DEFAULT_MEMORY_PRESSURE_CONFIG: MemoryPressureConfig;
/**
 * Operation result
 */
export interface OperationResult {
    /** Operation index */
    index: number;
    /** Success status */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Latency in ms */
    latency: number;
    /** Memory usage at operation */
    memoryUsage: number;
}
/**
 * Memory pressure report for single threshold
 */
export interface MemoryPressureReport {
    /** Target utilization percentage */
    targetUtilization: number;
    /** Actual utilization achieved */
    actualUtilization: number;
    /** Number of operations run */
    operationCount: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Average latency in ms */
    avgLatencyMs: number;
    /** Whether OOM occurred */
    oomOccurred: boolean;
    /** Whether compression was triggered */
    compressionTriggered: boolean;
    /** Memory threshold level */
    memoryLevel: MemoryThreshold;
    /** Pass status */
    pass: boolean;
}
/**
 * Complete pressure test report
 */
export interface PressureTestSuiteReport {
    /** Test name */
    name: string;
    /** Timestamp */
    timestamp: number;
    /** Individual threshold reports */
    reports: MemoryPressureReport[];
    /** Overall pass status */
    pass: boolean;
    /** Summary */
    summary: {
        thresholdsTested: number;
        thresholdsPassed: number;
        anyOOM: boolean;
        maxUtilizationAchieved: number;
    };
}
/**
 * Memory pressure test for NFR-4.3 validation
 *
 * Tests system behavior under various memory pressure levels,
 * validating OOM prevention and graceful degradation.
 *
 * @example
 * ```typescript
 * const test = new MemoryPressureTest();
 *
 * // Test at specific threshold
 * const report = await test.runPressureTest(80);
 *
 * // Run all threshold tests
 * const suiteReport = await test.runAllPressureTests();
 * ```
 */
export declare class MemoryPressureTest {
    private memoryMonitor;
    private allocations;
    private compressionCount;
    constructor(options?: {
        heapLimit?: number;
    });
    /**
     * Run pressure test at specific utilization level
     */
    runPressureTest(targetUtilization: number, config?: Partial<MemoryPressureConfig>): Promise<MemoryPressureReport>;
    /**
     * Run pressure tests at all configured thresholds
     */
    runAllPressureTests(config?: Partial<MemoryPressureConfig>): Promise<PressureTestSuiteReport>;
    /**
     * Simulate a typical memory operation
     */
    private simulateOperation;
    /**
     * Check and trigger compression if needed
     */
    private checkAndCompress;
    /**
     * Reset test state
     */
    private reset;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Get memory monitor
     */
    getMemoryMonitor(): MemoryMonitor;
    /**
     * Get compression count
     */
    getCompressionCount(): number;
}
/**
 * Global memory pressure test instance
 */
export declare const memoryPressureTest: MemoryPressureTest;
//# sourceMappingURL=memory-pressure-test.d.ts.map