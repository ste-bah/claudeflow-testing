/**
 * Portability Module
 * TASK-NFR-003 - Portability Validation Suite
 *
 * Provides portability validation infrastructure:
 * - NFR-5.1: Native Binding Validation
 * - NFR-5.2: JavaScript Fallback Testing
 * - NFR-5.3: Cross-Platform Support
 * - NFR-5.4: Node.js Version Compatibility
 * - NFR-5.5: WASM Fallback Testing
 * - NFR-5.6: Runtime Auto-Selection
 */
export { PlatformDetector, type PlatformInfo, type CompatibilityReport, type SupportedOS, type SupportedArch, SUPPORTED_PLATFORMS, SUPPORTED_NODE_VERSIONS, platformDetector, } from './platform-detector.js';
export { RuntimeSelector, type RuntimeType, type PerformanceRating, type RuntimeSelection, type RuntimeLoader, type RuntimeConfig, RUNTIME_ENV_VAR, RUNTIME_PERFORMANCE, runtimeSelector, } from './runtime-selector.js';
export { NativeBindingValidator, type FunctionValidation, type ModuleValidation, type NativeValidationReport, type ModuleDefinition, DEFAULT_MODULE_DEFINITIONS, nativeBindingValidator, } from './native-binding-validator.js';
export { FallbackValidator, type ImplementationType, type ImplementationResult, type EquivalenceTest, type EquivalenceReport, type FallbackValidatorConfig, DEFAULT_FALLBACK_CONFIG, fallbackValidator, } from './fallback-validator.js';
export { PerformanceComparator, type RuntimeTiming, type OperationComparison, type PerformanceSummary, type PerformanceComparisonReport, type PerformanceComparatorConfig, DEFAULT_COMPARATOR_CONFIG, performanceComparator, } from './performance-comparator.js';
export { CompatibilityMatrix, type PlatformTestEntry, type NodeVersionEntry, type GitHubActionsMatrix, type CompatibilityTestSuite, type MatrixEntryResult, compatibilityMatrix, } from './compatibility-matrix.js';
export { PortabilityTestRunner, type PortabilityTestRunnerConfig, DEFAULT_RUNNER_CONFIG, type NFR5Check, type NFR5Summary, type NFR5Report, portabilityTestRunner, } from './runner.js';
//# sourceMappingURL=index.d.ts.map