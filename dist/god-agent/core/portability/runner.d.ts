/**
 * Portability Test Runner
 * TASK-NFR-003 - Portability Validation Suite
 *
 * Orchestrates all NFR-5 portability tests:
 * - NFR-5.1: Native binding validation
 * - NFR-5.2: JavaScript fallback testing
 * - NFR-5.3: Cross-platform support
 * - NFR-5.4: Node.js version compatibility
 * - NFR-5.5: WASM fallback testing
 * - NFR-5.6: Runtime auto-selection
 */
import { type PlatformInfo, type CompatibilityReport } from './platform-detector.js';
import { type RuntimeSelection } from './runtime-selector.js';
import { type NativeValidationReport } from './native-binding-validator.js';
import { type EquivalenceReport } from './fallback-validator.js';
import { type PerformanceComparisonReport } from './performance-comparator.js';
import { type CompatibilityTestSuite } from './compatibility-matrix.js';
/**
 * Portability test runner configuration
 */
export interface PortabilityTestRunnerConfig {
    /** Run platform detection */
    runPlatformDetection: boolean;
    /** Run runtime selection */
    runRuntimeSelection: boolean;
    /** Run native binding validation */
    runNativeValidation: boolean;
    /** Run fallback equivalence testing */
    runFallbackValidation: boolean;
    /** Run performance comparison */
    runPerformanceComparison: boolean;
    /** Verbose output */
    verbose: boolean;
}
/**
 * Default runner configuration
 */
export declare const DEFAULT_RUNNER_CONFIG: PortabilityTestRunnerConfig;
/**
 * NFR-5 check result
 */
export interface NFR5Check {
    /** Check ID */
    id: string;
    /** Check name */
    name: string;
    /** Pass/fail status */
    pass: boolean;
    /** Details */
    details?: string;
}
/**
 * NFR-5 summary
 */
export interface NFR5Summary {
    /** All checks */
    checks: NFR5Check[];
    /** Passed count */
    passed: number;
    /** Total count */
    total: number;
    /** Overall pass status */
    overallPass: boolean;
}
/**
 * Complete NFR-5 report
 */
export interface NFR5Report {
    /** Report name */
    name: string;
    /** Timestamp */
    timestamp: number;
    /** Duration in ms */
    durationMs: number;
    /** Platform info */
    platform: PlatformInfo;
    /** Test results */
    tests: {
        platformDetection?: CompatibilityReport;
        runtimeSelection?: RuntimeSelection;
        nativeBindings?: NativeValidationReport;
        fallbackEquivalence?: EquivalenceReport;
        performanceComparison?: PerformanceComparisonReport;
        compatibilityMatrix?: CompatibilityTestSuite;
    };
    /** Summary */
    summary: NFR5Summary;
    /** Overall pass status */
    pass: boolean;
}
/**
 * Complete NFR-5 portability test suite runner
 *
 * Orchestrates all portability validation tests and generates
 * comprehensive reports.
 *
 * @example
 * ```typescript
 * const runner = new PortabilityTestRunner();
 * const report = await runner.runAllTests();
 *
 * console.log(`NFR-5 Status: ${report.pass ? 'PASS' : 'FAIL'}`);
 * console.log(`Tests passed: ${report.summary.passed}/${report.summary.total}`);
 * ```
 */
export declare class PortabilityTestRunner {
    private config;
    private detector;
    private selector;
    private nativeValidator;
    private fallbackValidator;
    private performanceComparator;
    private compatibilityMatrix;
    constructor(config?: Partial<PortabilityTestRunnerConfig>);
    /**
     * Run all portability tests
     */
    runAllTests(): Promise<NFR5Report>;
    /**
     * Run specific test
     */
    runTest(testId: 'platform' | 'runtime' | 'native' | 'fallback' | 'performance'): Promise<NFR5Report>;
    /**
     * Generate summary from test results
     */
    private generateSummary;
    /**
     * Log header
     */
    private logHeader;
    /**
     * Log platform results
     */
    private logPlatformResults;
    /**
     * Log runtime results
     */
    private logRuntimeResults;
    /**
     * Log native validation results
     */
    private logNativeResults;
    /**
     * Log fallback results
     */
    private logFallbackResults;
    /**
     * Log performance results
     */
    private logPerformanceResults;
    /**
     * Log summary
     */
    private logSummary;
    /**
     * Generate markdown report
     */
    generateMarkdownReport(report: NFR5Report): string;
}
/**
 * Global portability test runner instance
 */
export declare const portabilityTestRunner: PortabilityTestRunner;
//# sourceMappingURL=runner.d.ts.map