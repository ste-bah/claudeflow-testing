/**
 * Scale Test Runner
 * TASK-NFR-002 - Scalability Validation Suite
 *
 * Orchestrates all NFR-4 scale tests:
 * - NFR-4.1: Vector Scale Testing
 * - NFR-4.2: Pipeline Scale Testing
 * - NFR-4.3: Memory Pressure Testing
 * - NFR-4.4: Degradation Testing
 * - NFR-4.5: Multi-Instance Testing
 */
import { type VectorScaleReport, type VectorScaleConfig } from './vector-scale-test.js';
import { type PipelineScaleReport, type ContentionReport } from './pipeline-scale-test.js';
import { type PressureTestSuiteReport } from './memory-pressure-test.js';
import { type DegradationReport } from './degradation-test.js';
import { type MultiInstanceReport } from './multi-instance-test.js';
/**
 * Scale test runner configuration
 */
export interface ScaleTestRunnerConfig {
    /** Run vector scale test */
    runVectorScale: boolean;
    /** Run pipeline scale test */
    runPipelineScale: boolean;
    /** Run memory pressure test */
    runMemoryPressure: boolean;
    /** Run degradation test */
    runDegradation: boolean;
    /** Run multi-instance test */
    runMultiInstance: boolean;
    /** Verbose output */
    verbose: boolean;
}
/**
 * Default runner configuration
 */
export declare const DEFAULT_RUNNER_CONFIG: ScaleTestRunnerConfig;
/**
 * NFR-4 check result
 */
export interface NFR4Check {
    id: string;
    name: string;
    pass: boolean;
    details?: string;
}
/**
 * NFR-4 summary
 */
export interface NFR4Summary {
    checks: NFR4Check[];
    passed: number;
    total: number;
    overallPass: boolean;
}
/**
 * Complete NFR-4 report
 */
export interface NFR4Report {
    /** Report name */
    name: string;
    /** Timestamp */
    timestamp: number;
    /** Duration in ms */
    durationMs: number;
    /** Test results */
    tests: {
        vectorScale?: VectorScaleReport;
        pipelineScale?: PipelineScaleReport;
        pipelineContention?: ContentionReport;
        memoryPressure?: PressureTestSuiteReport;
        degradation?: DegradationReport;
        multiInstance?: MultiInstanceReport;
    };
    /** Summary */
    summary: NFR4Summary;
    /** Overall pass status */
    pass: boolean;
}
/**
 * Complete NFR-4 scale test suite runner
 *
 * Orchestrates all scalability validation tests and generates
 * comprehensive reports.
 *
 * @example
 * ```typescript
 * const runner = new ScaleTestRunner();
 * const report = await runner.runAllScaleTests();
 *
 * console.log(`NFR-4 Status: ${report.pass ? 'PASS' : 'FAIL'}`);
 * console.log(`Tests passed: ${report.summary.passed}/${report.summary.total}`);
 * ```
 */
export declare class ScaleTestRunner {
    private config;
    constructor(config?: Partial<ScaleTestRunnerConfig>);
    /**
     * Run all scale tests
     */
    runAllScaleTests(vectorConfig?: Partial<VectorScaleConfig>): Promise<NFR4Report>;
    /**
     * Run specific test
     */
    runTest(testId: 'vector' | 'pipeline' | 'memory' | 'degradation' | 'multi'): Promise<NFR4Report>;
    /**
     * Generate summary from test results
     */
    private generateSummary;
    /**
     * Log header
     */
    private logHeader;
    /**
     * Log vector results
     */
    private logVectorResults;
    /**
     * Log pipeline results
     */
    private logPipelineResults;
    /**
     * Log pressure results
     */
    private logPressureResults;
    /**
     * Log degradation results
     */
    private logDegradationResults;
    /**
     * Log multi-instance results
     */
    private logMultiInstanceResults;
    /**
     * Log summary
     */
    private logSummary;
    /**
     * Generate markdown report
     */
    generateMarkdownReport(report: NFR4Report): string;
}
/**
 * Global scale test runner instance
 */
export declare const scaleTestRunner: ScaleTestRunner;
//# sourceMappingURL=runner.d.ts.map