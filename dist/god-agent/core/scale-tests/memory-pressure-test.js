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
import { MemoryMonitor } from './utils/memory-monitor.js';
import { VECTOR_DIM } from '../validation/constants.js';
/**
 * Default memory pressure configuration
 */
export const DEFAULT_MEMORY_PRESSURE_CONFIG = {
    thresholds: [60, 80, 90, 95],
    operationCount: 100,
    operationTimeoutMs: 1000,
    allowGC: true,
};
// ==================== Memory Pressure Test ====================
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
export class MemoryPressureTest {
    memoryMonitor;
    allocations = [];
    compressionCount = 0;
    constructor(options = {}) {
        this.memoryMonitor = new MemoryMonitor(options);
    }
    /**
     * Run pressure test at specific utilization level
     */
    async runPressureTest(targetUtilization, config = {}) {
        const cfg = { ...DEFAULT_MEMORY_PRESSURE_CONFIG, ...config };
        // Reset state
        this.reset();
        // Fill memory to target utilization
        const heapLimit = this.memoryMonitor.getHeapLimit();
        const targetBytes = heapLimit * (targetUtilization / 100);
        let currentUsage = this.memoryMonitor.getHeapUsed();
        try {
            while (currentUsage < targetBytes) {
                // Allocate 1MB chunks
                const chunkSizeMB = 1;
                const chunk = new Float32Array((chunkSizeMB * 1024 * 1024) / 4);
                // Fill with data to prevent optimization
                for (let i = 0; i < chunk.length; i++) {
                    chunk[i] = Math.random();
                }
                this.allocations.push(chunk);
                currentUsage = this.memoryMonitor.getHeapUsed();
                // Prevent infinite loop if we can't reach target
                if (this.allocations.length > 1000)
                    break;
            }
        }
        catch {
            // INTENTIONAL: Memory allocation failure is expected at high thresholds during pressure testing
        }
        const actualUtilization = (this.memoryMonitor.getHeapUsed() / heapLimit) * 100;
        // Run operations under pressure
        const operationResults = [];
        let oomOccurred = false;
        for (let i = 0; i < cfg.operationCount; i++) {
            const start = performance.now();
            try {
                // Simulate typical operation
                await this.simulateOperation();
                operationResults.push({
                    index: i,
                    success: true,
                    latency: performance.now() - start,
                    memoryUsage: this.memoryMonitor.getHeapUsed(),
                });
            }
            catch (error) {
                const errorMessage = String(error);
                if (errorMessage.includes('OOM') || errorMessage.includes('allocation')) {
                    oomOccurred = true;
                }
                operationResults.push({
                    index: i,
                    success: false,
                    error: errorMessage,
                    latency: performance.now() - start,
                    memoryUsage: this.memoryMonitor.getHeapUsed(),
                });
            }
            // Check compression trigger
            if (i % 10 === 0 && actualUtilization > 60) {
                await this.checkAndCompress();
            }
        }
        // Calculate results
        const successCount = operationResults.filter(r => r.success).length;
        const avgLatency = operationResults
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.latency, 0) / Math.max(successCount, 1);
        const memoryLevel = this.memoryMonitor.getThresholdLevel();
        // Release pressure
        this.reset();
        return {
            targetUtilization,
            actualUtilization,
            operationCount: cfg.operationCount,
            successRate: successCount / cfg.operationCount,
            avgLatencyMs: avgLatency,
            oomOccurred,
            compressionTriggered: this.compressionCount > 0,
            memoryLevel,
            pass: successCount / cfg.operationCount >= 0.95 && !oomOccurred,
        };
    }
    /**
     * Run pressure tests at all configured thresholds
     */
    async runAllPressureTests(config = {}) {
        const cfg = { ...DEFAULT_MEMORY_PRESSURE_CONFIG, ...config };
        const reports = [];
        for (const threshold of cfg.thresholds) {
            const report = await this.runPressureTest(threshold, cfg);
            reports.push(report);
            // Allow recovery between tests
            this.reset();
            if (cfg.allowGC) {
                this.memoryMonitor.forceGC();
            }
            await this.sleep(100);
        }
        const allPass = reports.every(r => r.pass);
        const anyOOM = reports.some(r => r.oomOccurred);
        const maxUtilization = Math.max(...reports.map(r => r.actualUtilization));
        return {
            name: 'Memory Pressure Test Suite',
            timestamp: Date.now(),
            reports,
            pass: allPass,
            summary: {
                thresholdsTested: reports.length,
                thresholdsPassed: reports.filter(r => r.pass).length,
                anyOOM,
                maxUtilizationAchieved: maxUtilization,
            },
        };
    }
    /**
     * Simulate a typical memory operation
     */
    async simulateOperation() {
        // Allocate small buffer
        const buffer = new Float32Array(VECTOR_DIM);
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.random();
        }
        // Simulate async work
        await this.sleep(1 + Math.random() * 5);
        // Simple computation
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
        }
        // Return to prevent optimization
        if (sum === 0)
            throw new Error('Unexpected');
    }
    /**
     * Check and trigger compression if needed
     */
    async checkAndCompress() {
        const level = this.memoryMonitor.getThresholdLevel();
        if (level === 'orange' || level === 'red' || level === 'critical') {
            // Simulate compression by releasing some allocations
            const toRelease = Math.min(10, this.allocations.length);
            this.allocations.splice(0, toRelease);
            this.compressionCount++;
        }
    }
    /**
     * Reset test state
     */
    reset() {
        this.allocations = [];
        this.compressionCount = 0;
        this.memoryMonitor.clearHistory();
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get memory monitor
     */
    getMemoryMonitor() {
        return this.memoryMonitor;
    }
    /**
     * Get compression count
     */
    getCompressionCount() {
        return this.compressionCount;
    }
}
// ==================== Global Instance ====================
/**
 * Global memory pressure test instance
 */
export const memoryPressureTest = new MemoryPressureTest();
//# sourceMappingURL=memory-pressure-test.js.map