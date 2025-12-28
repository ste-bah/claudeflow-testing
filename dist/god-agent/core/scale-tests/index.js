/**
 * Scale Tests Module
 * TASK-NFR-002 - Scalability Validation Suite
 *
 * Provides scalability validation infrastructure:
 * - NFR-4.1: Vector Scale Testing (1M vectors)
 * - NFR-4.2: Pipeline Scale Testing (48 agents)
 * - NFR-4.3: Memory Pressure Testing
 * - NFR-4.4: Graceful Degradation Testing
 * - NFR-4.5: Multi-Instance Testing
 */
// ===== UTILITIES =====
export { 
// Memory Monitor
MemoryMonitor, DEFAULT_MEMORY_THRESHOLDS, memoryMonitor, } from './utils/memory-monitor.js';
export { 
// Concurrency Tracker
ConcurrencyTracker, AsyncSemaphore, RateLimiter, concurrencyTracker, } from './utils/concurrency-tracker.js';
// ===== VECTOR SCALE TEST =====
export { VectorScaleTest, DEFAULT_VECTOR_SCALE_CONFIG, generateNormalizedVectors, vectorScaleTest, } from './vector-scale-test.js';
// ===== PIPELINE SCALE TEST =====
export { PipelineScaleTest, DEFAULT_PIPELINE_SCALE_CONFIG, generatePipelineAgents, pipelineScaleTest, } from './pipeline-scale-test.js';
// ===== MEMORY PRESSURE TEST =====
export { MemoryPressureTest, DEFAULT_MEMORY_PRESSURE_CONFIG, memoryPressureTest, } from './memory-pressure-test.js';
// ===== DEGRADATION TEST =====
export { DegradationTest, CapacityManager, CapacityExceededError, DEFAULT_DEGRADATION_CONFIG, degradationTest, } from './degradation-test.js';
// ===== MULTI-INSTANCE TEST =====
export { MultiInstanceTest, SimulatedInstance, DEFAULT_MULTI_INSTANCE_CONFIG, multiInstanceTest, } from './multi-instance-test.js';
// ===== RUNNER =====
export { ScaleTestRunner, DEFAULT_RUNNER_CONFIG, scaleTestRunner, } from './runner.js';
//# sourceMappingURL=index.js.map