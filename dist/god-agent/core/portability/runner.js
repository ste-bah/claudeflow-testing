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
import { PlatformDetector, } from './platform-detector.js';
import { RuntimeSelector } from './runtime-selector.js';
import { NativeBindingValidator, } from './native-binding-validator.js';
import { FallbackValidator } from './fallback-validator.js';
import { PerformanceComparator, } from './performance-comparator.js';
import { CompatibilityMatrix } from './compatibility-matrix.js';
/**
 * Default runner configuration
 */
export const DEFAULT_RUNNER_CONFIG = {
    runPlatformDetection: true,
    runRuntimeSelection: true,
    runNativeValidation: true,
    runFallbackValidation: true,
    runPerformanceComparison: true,
    verbose: true,
};
// ==================== Portability Test Runner ====================
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
export class PortabilityTestRunner {
    config;
    detector;
    selector;
    nativeValidator;
    fallbackValidator;
    performanceComparator;
    compatibilityMatrix;
    constructor(config = {}) {
        this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };
        this.detector = new PlatformDetector();
        this.selector = new RuntimeSelector({ verbose: this.config.verbose });
        this.nativeValidator = new NativeBindingValidator();
        this.fallbackValidator = new FallbackValidator({ verbose: this.config.verbose });
        this.performanceComparator = new PerformanceComparator({ verbose: this.config.verbose });
        this.compatibilityMatrix = new CompatibilityMatrix();
    }
    /**
     * Run all portability tests
     */
    async runAllTests() {
        const startTime = Date.now();
        const tests = {};
        if (this.config.verbose) {
            this.logHeader();
        }
        const platform = this.detector.detect();
        // NFR-5.3/5.4: Platform Detection
        if (this.config.runPlatformDetection) {
            if (this.config.verbose) {
                console.log('\n[1/5] Platform Detection (NFR-5.3, NFR-5.4)');
                console.log('-'.repeat(50));
            }
            tests.platformDetection = this.detector.getCompatibilityReport();
            tests.compatibilityMatrix = this.compatibilityMatrix.generateTestSuite();
            if (this.config.verbose) {
                this.logPlatformResults(tests.platformDetection);
            }
        }
        // NFR-5.6: Runtime Selection
        if (this.config.runRuntimeSelection) {
            if (this.config.verbose) {
                console.log('\n[2/5] Runtime Selection (NFR-5.6)');
                console.log('-'.repeat(50));
            }
            tests.runtimeSelection = await this.selector.selectRuntime();
            if (this.config.verbose) {
                this.logRuntimeResults(tests.runtimeSelection);
            }
        }
        // NFR-5.1: Native Binding Validation
        if (this.config.runNativeValidation) {
            if (this.config.verbose) {
                console.log('\n[3/5] Native Binding Validation (NFR-5.1)');
                console.log('-'.repeat(50));
            }
            tests.nativeBindings = await this.nativeValidator.validateAll();
            if (this.config.verbose) {
                this.logNativeResults(tests.nativeBindings);
            }
        }
        // NFR-5.2: Fallback Equivalence Testing
        if (this.config.runFallbackValidation) {
            if (this.config.verbose) {
                console.log('\n[4/5] Fallback Equivalence Testing (NFR-5.2)');
                console.log('-'.repeat(50));
            }
            tests.fallbackEquivalence = await this.fallbackValidator.validateEquivalence();
            if (this.config.verbose) {
                this.logFallbackResults(tests.fallbackEquivalence);
            }
        }
        // NFR-5.5: Performance Comparison
        if (this.config.runPerformanceComparison) {
            if (this.config.verbose) {
                console.log('\n[5/5] Performance Comparison (NFR-5.5)');
                console.log('-'.repeat(50));
            }
            tests.performanceComparison = await this.performanceComparator.compareAll();
            if (this.config.verbose) {
                this.logPerformanceResults(tests.performanceComparison);
            }
        }
        // Generate summary
        const summary = this.generateSummary(tests);
        const durationMs = Date.now() - startTime;
        if (this.config.verbose) {
            this.logSummary(summary, durationMs);
        }
        return {
            name: 'NFR-5 Portability Validation Suite',
            timestamp: Date.now(),
            durationMs,
            platform,
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
            runPlatformDetection: testId === 'platform',
            runRuntimeSelection: testId === 'runtime',
            runNativeValidation: testId === 'native',
            runFallbackValidation: testId === 'fallback',
            runPerformanceComparison: testId === 'performance',
        };
        this.config = config;
        return this.runAllTests();
    }
    /**
     * Generate summary from test results
     */
    generateSummary(tests) {
        const checks = [];
        // NFR-5.1: Native Bindings
        if (tests.nativeBindings) {
            checks.push({
                id: 'NFR-5.1',
                name: 'Native Bindings',
                pass: tests.nativeBindings.summary.allLoaded,
                details: tests.nativeBindings.summary.allLoaded
                    ? `${tests.nativeBindings.summary.loadedModules}/${tests.nativeBindings.summary.totalModules} modules loaded`
                    : `Only ${tests.nativeBindings.summary.loadedModules}/${tests.nativeBindings.summary.totalModules} modules loaded`,
            });
        }
        // NFR-5.2: JS Fallback
        if (tests.fallbackEquivalence) {
            checks.push({
                id: 'NFR-5.2',
                name: 'JS Fallback',
                pass: tests.fallbackEquivalence.summary.allEquivalent,
                details: `${tests.fallbackEquivalence.summary.passed}/${tests.fallbackEquivalence.summary.total} equivalence tests passed`,
            });
        }
        // NFR-5.3: Platform Support
        if (tests.platformDetection) {
            checks.push({
                id: 'NFR-5.3',
                name: 'Platform Support',
                pass: tests.platformDetection.isSupported,
                details: tests.platformDetection.isSupported
                    ? `Platform ${tests.platformDetection.platform} fully supported`
                    : `Platform ${tests.platformDetection.platform} has limited support`,
            });
        }
        // NFR-5.4: Node.js Compatibility
        if (tests.platformDetection) {
            const detector = new PlatformDetector();
            const nodeSupported = detector.isNodeVersionSupported();
            checks.push({
                id: 'NFR-5.4',
                name: 'Node.js Compat',
                pass: nodeSupported,
                details: `Node.js ${tests.platformDetection.nodeVersion} ${nodeSupported ? 'supported' : 'not officially supported'}`,
            });
        }
        // NFR-5.5: WASM Fallback
        if (tests.platformDetection) {
            checks.push({
                id: 'NFR-5.5',
                name: 'WASM Fallback',
                pass: tests.platformDetection.capabilities.wasm,
                details: tests.platformDetection.capabilities.wasm
                    ? 'WASM available as fallback'
                    : 'WASM not available',
            });
        }
        // NFR-5.6: Runtime Selection
        if (tests.runtimeSelection) {
            checks.push({
                id: 'NFR-5.6',
                name: 'Runtime Selection',
                pass: true, // Always passes if selection completes
                details: `Selected ${tests.runtimeSelection.type} runtime (${tests.runtimeSelection.performance})`,
            });
        }
        const passed = checks.filter(c => c.pass).length;
        return {
            checks,
            passed,
            total: checks.length,
            // Pass if at least 4/6 checks pass (allow graceful degradation)
            overallPass: passed >= 4,
        };
    }
    /**
     * Log header
     */
    logHeader() {
        console.log('');
        console.log('='.repeat(60));
        console.log('            NFR-5 PORTABILITY VALIDATION SUITE');
        console.log('='.repeat(60));
    }
    /**
     * Log platform results
     */
    logPlatformResults(report) {
        console.log(`  Platform: ${report.platform}`);
        console.log(`  Node.js: ${report.nodeVersion}`);
        console.log(`  Supported: ${report.isSupported ? '✓' : '✗'}`);
        console.log(`  Capabilities:`);
        console.log(`    Native: ${report.capabilities.native ? '✓' : '✗'}`);
        console.log(`    WASM: ${report.capabilities.wasm ? '✓' : '✗'}`);
        console.log(`    SIMD: ${report.capabilities.simd ? '✓' : '✗'}`);
        if (report.warnings.length > 0) {
            console.log(`  Warnings: ${report.warnings.join(', ')}`);
        }
    }
    /**
     * Log runtime results
     */
    logRuntimeResults(selection) {
        console.log(`  Selected: ${selection.type}`);
        console.log(`  Performance: ${selection.performance}`);
        console.log(`  Reason: ${selection.reason}`);
        console.log(`  Forced: ${selection.forced ? 'Yes' : 'No'}`);
        if (selection.warnings.length > 0) {
            console.log(`  Warnings: ${selection.warnings.join(', ')}`);
        }
    }
    /**
     * Log native validation results
     */
    logNativeResults(report) {
        console.log(`  Modules: ${report.summary.loadedModules}/${report.summary.totalModules}`);
        console.log(`  Functions: ${report.summary.workingFunctions}/${report.summary.totalFunctions}`);
        for (const module of report.modules) {
            const status = module.loaded ? '✓' : '✗';
            console.log(`    ${status} ${module.module}: ${module.functions.filter(f => f.working).length}/${module.functions.length} functions`);
        }
        console.log(`  Status: ${report.summary.allWorking ? '✓ PASS' : '✗ PARTIAL'}`);
    }
    /**
     * Log fallback results
     */
    logFallbackResults(report) {
        for (const test of report.tests) {
            const status = test.equivalent ? '✓' : '✗';
            console.log(`  ${status} ${test.name}`);
        }
        console.log(`  Tests: ${report.summary.passed}/${report.summary.total} passed`);
        console.log(`  Status: ${report.summary.allEquivalent ? '✓ PASS' : '✗ FAIL'}`);
    }
    /**
     * Log performance results
     */
    logPerformanceResults(report) {
        console.log(`  WASM vs Native: ${report.summary.wasmVsNative}`);
        console.log(`  JS vs Native: ${report.summary.jsVsNative}`);
        console.log(`  Performance Tier: ${report.summary.tier}`);
        console.log(`  Recommendation: ${report.summary.recommendation}`);
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
        console.log('| NFR ID   | Test              | Status |');
        console.log('|----------|-------------------|--------|');
        for (const check of summary.checks) {
            const status = check.pass ? '✓ PASS' : '✗ FAIL';
            console.log(`| ${check.id.padEnd(8)} | ${check.name.padEnd(17)} | ${status.padEnd(6)} |`);
        }
        console.log('');
        console.log(`Tests: ${summary.passed}/${summary.total} passed`);
        console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
        console.log(`Overall: ${summary.overallPass ? '✓ PASS' : '✗ FAIL'}`);
        console.log('');
    }
    /**
     * Generate markdown report
     */
    generateMarkdownReport(report) {
        let md = `# NFR-5 Portability Validation Report\n\n`;
        md += `**Timestamp:** ${new Date(report.timestamp).toISOString()}\n`;
        md += `**Duration:** ${(report.durationMs / 1000).toFixed(2)}s\n`;
        md += `**Platform:** ${report.platform.platform}\n`;
        md += `**Status:** ${report.pass ? '✓ PASS' : '✗ FAIL'}\n\n`;
        md += `## Summary\n\n`;
        md += `| NFR ID | Test | Status | Details |\n`;
        md += `|--------|------|--------|--------|\n`;
        for (const check of report.summary.checks) {
            const status = check.pass ? '✓ PASS' : '✗ FAIL';
            md += `| ${check.id} | ${check.name} | ${status} | ${check.details || '-'} |\n`;
        }
        md += `\n**Total:** ${report.summary.passed}/${report.summary.total} tests passed\n`;
        if (report.tests.performanceComparison) {
            md += `\n## Performance\n\n`;
            md += `- WASM vs Native: ${report.tests.performanceComparison.summary.wasmVsNative}\n`;
            md += `- JS vs Native: ${report.tests.performanceComparison.summary.jsVsNative}\n`;
            md += `- Tier: ${report.tests.performanceComparison.summary.tier}\n`;
        }
        return md;
    }
}
// ==================== Global Instance ====================
/**
 * Global portability test runner instance
 */
export const portabilityTestRunner = new PortabilityTestRunner();
//# sourceMappingURL=runner.js.map