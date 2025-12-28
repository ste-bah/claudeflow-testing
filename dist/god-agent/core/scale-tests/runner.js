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
import { VectorScaleTest, } from './vector-scale-test.js';
import { PipelineScaleTest, } from './pipeline-scale-test.js';
import { MemoryPressureTest, } from './memory-pressure-test.js';
import { DegradationTest } from './degradation-test.js';
import { MultiInstanceTest, } from './multi-instance-test.js';
/**
 * Default runner configuration
 */
export const DEFAULT_RUNNER_CONFIG = {
    runVectorScale: true,
    runPipelineScale: true,
    runMemoryPressure: true,
    runDegradation: true,
    runMultiInstance: true,
    verbose: true,
};
// ==================== Scale Test Runner ====================
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
export class ScaleTestRunner {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };
    }
    /**
     * Run all scale tests
     */
    async runAllScaleTests(vectorConfig) {
        const startTime = Date.now();
        const tests = {};
        if (this.config.verbose) {
            this.logHeader();
        }
        // NFR-4.1: Vector Scale Test
        if (this.config.runVectorScale) {
            if (this.config.verbose) {
                console.log('\n[1/5] Vector Scale Test (NFR-4.1)');
                console.log('-'.repeat(50));
            }
            tests.vectorScale = await new VectorScaleTest().runScaleTest(vectorConfig);
            if (this.config.verbose) {
                this.logVectorResults(tests.vectorScale);
            }
        }
        // NFR-4.2: Pipeline Scale Test
        if (this.config.runPipelineScale) {
            if (this.config.verbose) {
                console.log('\n[2/5] Pipeline Scale Test (NFR-4.2)');
                console.log('-'.repeat(50));
            }
            const pipelineTest = new PipelineScaleTest();
            tests.pipelineScale = await pipelineTest.runPipelineTest();
            tests.pipelineContention = await pipelineTest.runContentionTest();
            if (this.config.verbose) {
                this.logPipelineResults(tests.pipelineScale, tests.pipelineContention);
            }
        }
        // NFR-4.3: Memory Pressure Test
        if (this.config.runMemoryPressure) {
            if (this.config.verbose) {
                console.log('\n[3/5] Memory Pressure Tests (NFR-4.3)');
                console.log('-'.repeat(50));
            }
            tests.memoryPressure = await new MemoryPressureTest().runAllPressureTests();
            if (this.config.verbose) {
                this.logPressureResults(tests.memoryPressure);
            }
        }
        // NFR-4.4: Degradation Test
        if (this.config.runDegradation) {
            if (this.config.verbose) {
                console.log('\n[4/5] Graceful Degradation Test (NFR-4.4)');
                console.log('-'.repeat(50));
            }
            tests.degradation = await new DegradationTest().runDegradationTest();
            if (this.config.verbose) {
                this.logDegradationResults(tests.degradation);
            }
        }
        // NFR-4.5: Multi-Instance Test
        if (this.config.runMultiInstance) {
            if (this.config.verbose) {
                console.log('\n[5/5] Multi-Instance Test (NFR-4.5)');
                console.log('-'.repeat(50));
            }
            tests.multiInstance = await new MultiInstanceTest().runMultiInstanceTest();
            if (this.config.verbose) {
                this.logMultiInstanceResults(tests.multiInstance);
            }
        }
        // Generate summary
        const summary = this.generateSummary(tests);
        const durationMs = Date.now() - startTime;
        if (this.config.verbose) {
            this.logSummary(summary, durationMs);
        }
        return {
            name: 'NFR-4 Scalability Validation Suite',
            timestamp: Date.now(),
            durationMs,
            tests,
            summary,
            pass: summary.overallPass,
        };
    }
    /**
     * Run specific test
     */
    async runTest(testId) {
        const config = {
            ...DEFAULT_RUNNER_CONFIG,
            runVectorScale: testId === 'vector',
            runPipelineScale: testId === 'pipeline',
            runMemoryPressure: testId === 'memory',
            runDegradation: testId === 'degradation',
            runMultiInstance: testId === 'multi',
        };
        this.config = config;
        return this.runAllScaleTests();
    }
    /**
     * Generate summary from test results
     */
    generateSummary(tests) {
        const checks = [];
        // NFR-4.1: Vector Scale
        if (tests.vectorScale) {
            checks.push({
                id: 'NFR-4.1',
                name: 'Vector Scale',
                pass: tests.vectorScale.pass,
                details: tests.vectorScale.pass
                    ? `${tests.vectorScale.results.length} scale points validated`
                    : tests.vectorScale.validation.recommendation,
            });
        }
        // NFR-4.2: Pipeline Scale
        if (tests.pipelineScale) {
            checks.push({
                id: 'NFR-4.2',
                name: 'Pipeline Scale',
                pass: tests.pipelineScale.pass,
                details: `${(tests.pipelineScale.completionRate * 100).toFixed(1)}% completion rate (target: 88%)`,
            });
        }
        // NFR-4.3: Memory Pressure
        if (tests.memoryPressure) {
            checks.push({
                id: 'NFR-4.3',
                name: 'Memory Pressure',
                pass: tests.memoryPressure.pass,
                details: tests.memoryPressure.summary.anyOOM
                    ? 'OOM detected'
                    : `${tests.memoryPressure.summary.thresholdsPassed}/${tests.memoryPressure.summary.thresholdsTested} thresholds passed`,
            });
        }
        // NFR-4.4: Degradation
        if (tests.degradation) {
            checks.push({
                id: 'NFR-4.4',
                name: 'Degradation',
                pass: tests.degradation.overallPass,
                details: tests.degradation.rejectionBehavior.crashes > 0
                    ? `${tests.degradation.rejectionBehavior.crashes} crashes detected`
                    : `Graceful rejection working (${tests.degradation.rejectionBehavior.gracefulRejections} 429s)`,
            });
        }
        // NFR-4.5: Multi-Instance
        if (tests.multiInstance) {
            checks.push({
                id: 'NFR-4.5',
                name: 'Multi-Instance',
                pass: tests.multiInstance.overallPass,
                details: tests.multiInstance.overallPass
                    ? `${tests.multiInstance.instanceCount} instances coordinated`
                    : 'Synchronization or partition issues',
            });
        }
        const passed = checks.filter(c => c.pass).length;
        return {
            checks,
            passed,
            total: checks.length,
            overallPass: passed === checks.length,
        };
    }
    /**
     * Log header
     */
    logHeader() {
        console.log('');
        console.log('='.repeat(60));
        console.log('           NFR-4 SCALABILITY VALIDATION SUITE');
        console.log('='.repeat(60));
    }
    /**
     * Log vector results
     */
    logVectorResults(report) {
        for (const result of report.results) {
            console.log(`  ${result.vectorCount.toLocaleString()} vectors:`);
            console.log(`    Compression: ${(result.compressionRatio * 100).toFixed(1)}%`);
            console.log(`    Search p95: ${result.searchLatencyP95.toFixed(2)}ms`);
        }
        console.log(`  Status: ${report.pass ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log pipeline results
     */
    logPipelineResults(report, contention) {
        console.log(`  Agents: ${report.agentCount}`);
        console.log(`  Completions: ${report.completions}/${report.agentCount}`);
        console.log(`  Rate: ${(report.completionRate * 100).toFixed(1)}% (target: 88%)`);
        console.log(`  Handoff latency: ${report.avgHandoffLatencyMs.toFixed(2)}ms`);
        console.log(`  Contention events: ${contention.contentionEvents}`);
        console.log(`  Status: ${report.pass ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log pressure results
     */
    logPressureResults(report) {
        for (const r of report.reports) {
            const status = r.pass ? '✓' : '✗';
            console.log(`  ${r.targetUtilization}%: ${status} (${(r.successRate * 100).toFixed(0)}% success)`);
        }
        console.log(`  OOM: ${report.summary.anyOOM ? 'Yes' : 'No'}`);
        console.log(`  Status: ${report.pass ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log degradation results
     */
    logDegradationResults(report) {
        console.log(`  Graceful rejections: ${report.rejectionBehavior.gracefulRejections}`);
        console.log(`  Crashes: ${report.rejectionBehavior.crashes}`);
        console.log(`  Recovery time: ${report.recovery.timeToRecoveryMs}ms`);
        console.log(`  Status: ${report.overallPass ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log multi-instance results
     */
    logMultiInstanceResults(report) {
        console.log(`  Instances: ${report.instanceCount}`);
        console.log(`  Sync: ${report.stateSynchronization.pass ? '✓' : '✗'} (${report.stateSynchronization.syncLatencyMs.toFixed(2)}ms)`);
        console.log(`  Load: ${report.loadDistribution.pass ? '✓' : '✗'} (${report.loadDistribution.throughput.toFixed(0)} ops/s)`);
        console.log(`  Partition: ${report.partitionTolerance.pass ? '✓' : '✗'}`);
        console.log(`  Status: ${report.overallPass ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log summary
     */
    logSummary(summary, durationMs) {
        console.log('');
        console.log('='.repeat(60));
        console.log('                         SUMMARY');
        console.log('='.repeat(60));
        console.log('');
        console.log('| NFR ID   | Test            | Status |');
        console.log('|----------|-----------------|--------|');
        for (const check of summary.checks) {
            const status = check.pass ? '✓ PASS' : '✗ FAIL';
            console.log(`| ${check.id.padEnd(8)} | ${check.name.padEnd(15)} | ${status.padEnd(6)} |`);
        }
        console.log('');
        console.log(`Tests: ${summary.passed}/${summary.total} passed`);
        console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
        console.log(`Overall: ${summary.overallPass ? '✓ ALL PASS' : '✗ FAILED'}`);
        console.log('');
    }
    /**
     * Generate markdown report
     */
    generateMarkdownReport(report) {
        let md = `# NFR-4 Scalability Validation Report\n\n`;
        md += `**Timestamp:** ${new Date(report.timestamp).toISOString()}\n`;
        md += `**Duration:** ${(report.durationMs / 1000).toFixed(2)}s\n`;
        md += `**Status:** ${report.pass ? '✓ PASS' : '✗ FAIL'}\n\n`;
        md += `## Summary\n\n`;
        md += `| NFR ID | Test | Status | Details |\n`;
        md += `|--------|------|--------|--------|\n`;
        for (const check of report.summary.checks) {
            const status = check.pass ? '✓ PASS' : '✗ FAIL';
            md += `| ${check.id} | ${check.name} | ${status} | ${check.details || '-'} |\n`;
        }
        md += `\n**Total:** ${report.summary.passed}/${report.summary.total} tests passed\n`;
        return md;
    }
}
// ==================== Global Instance ====================
/**
 * Global scale test runner instance
 */
export const scaleTestRunner = new ScaleTestRunner();
//# sourceMappingURL=runner.js.map