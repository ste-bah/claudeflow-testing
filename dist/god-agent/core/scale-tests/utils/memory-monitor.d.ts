/**
 * Memory Monitor Utilities
 * TASK-NFR-002 - Scalability Validation Suite
 *
 * Provides memory monitoring capabilities:
 * - Heap usage tracking
 * - Memory threshold detection
 * - GC event monitoring
 */
/**
 * Memory snapshot
 */
export interface MemorySnapshot {
    /** Heap used in bytes */
    heapUsed: number;
    /** Heap total in bytes */
    heapTotal: number;
    /** External memory in bytes */
    external: number;
    /** Array buffers in bytes */
    arrayBuffers: number;
    /** RSS (resident set size) in bytes */
    rss: number;
    /** Timestamp of snapshot */
    timestamp: number;
}
/**
 * Memory threshold levels
 */
export type MemoryThreshold = 'green' | 'yellow' | 'orange' | 'red' | 'critical';
/**
 * Memory threshold configuration
 */
export interface MemoryThresholdConfig {
    /** Yellow threshold (%) */
    yellow: number;
    /** Orange threshold (%) */
    orange: number;
    /** Red threshold (%) */
    red: number;
    /** Critical threshold (%) */
    critical: number;
}
/**
 * Default memory thresholds (from NFR-4.3)
 */
export declare const DEFAULT_MEMORY_THRESHOLDS: MemoryThresholdConfig;
/**
 * Memory trend analysis
 */
export interface MemoryTrend {
    /** Average growth rate (bytes/second) */
    growthRate: number;
    /** Projected time to threshold (seconds) */
    timeToThreshold: number;
    /** Trend direction */
    direction: 'stable' | 'growing' | 'shrinking';
    /** Number of samples */
    sampleCount: number;
}
/**
 * Memory monitoring utility
 *
 * Tracks heap usage and provides threshold detection
 *
 * @example
 * ```typescript
 * const monitor = new MemoryMonitor();
 *
 * // Get current usage
 * const snapshot = monitor.getSnapshot();
 * console.log(`Heap: ${snapshot.heapUsed / 1024 / 1024}MB`);
 *
 * // Check threshold
 * const level = monitor.getThresholdLevel();
 * if (level === 'red') {
 *   console.log('High memory pressure!');
 * }
 *
 * // Track trend
 * const trend = monitor.analyzeTrend();
 * console.log(`Growth: ${trend.growthRate} bytes/sec`);
 * ```
 */
export declare class MemoryMonitor {
    private history;
    private maxHistorySize;
    private thresholds;
    private heapLimit;
    constructor(options?: {
        maxHistorySize?: number;
        thresholds?: Partial<MemoryThresholdConfig>;
        heapLimit?: number;
    });
    /**
     * Get current memory snapshot
     */
    getSnapshot(): MemorySnapshot;
    /**
     * Get heap used in bytes
     */
    getHeapUsed(): number;
    /**
     * Get heap total in bytes
     */
    getHeapTotal(): number;
    /**
     * Get configured heap limit
     */
    getHeapLimit(): number;
    /**
     * Get current utilization percentage
     */
    getUtilization(): number;
    /**
     * Get current threshold level
     */
    getThresholdLevel(): MemoryThreshold;
    /**
     * Check if memory pressure is high
     */
    isHighPressure(): boolean;
    /**
     * Analyze memory trend from history
     */
    analyzeTrend(): MemoryTrend;
    /**
     * Get memory history
     */
    getHistory(): MemorySnapshot[];
    /**
     * Clear history
     */
    clearHistory(): void;
    /**
     * Get formatted memory report
     */
    getReport(): string;
    /**
     * Estimate heap limit from environment
     */
    private estimateHeapLimit;
    /**
     * Force garbage collection if available
     */
    forceGC(): boolean;
}
/**
 * Global memory monitor instance
 */
export declare const memoryMonitor: MemoryMonitor;
//# sourceMappingURL=memory-monitor.d.ts.map