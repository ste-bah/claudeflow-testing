/**
 * Memory Budget Monitor
 * TASK-MON-001
 *
 * Monitors god-agent memory usage against Constitution limits.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-037: Episode cache max 1000 items
 * - RULE-038: Embedding cache max 100MB
 * - RULE-039: Trajectory cache max 100 active
 * - RULE-040: Total overhead max 200MB, warning at 150MB
 */
import { IMemoryBudgets, IMemoryUsage, MemoryAlertCallback, IMemoryUsageProvider } from './types.js';
/** Alert threshold ratios */
declare const THRESHOLDS: {
    readonly WARNING: 0.75;
    readonly ERROR: 1;
};
export declare class MemoryMonitor {
    private readonly budgets;
    private readonly alertCallbacks;
    private intervalId;
    private readonly checkIntervalMs;
    /** Service providers for usage collection (late binding) */
    private descServiceProvider;
    private trajectoryTrackerProvider;
    constructor(config?: {
        budgets?: Partial<IMemoryBudgets>;
        checkIntervalMs?: number;
    });
    /** Set DESC service provider */
    setDescServiceProvider(provider: () => IMemoryUsageProvider | null): void;
    /** Set trajectory tracker provider */
    setTrajectoryTrackerProvider(provider: () => IMemoryUsageProvider | null): void;
    /** Start periodic monitoring */
    start(): void;
    /** Stop monitoring */
    stop(): void;
    /** Register alert callback */
    onAlert(callback: MemoryAlertCallback): void;
    /** Perform memory check */
    check(): IMemoryUsage;
    /** Collect current memory usage */
    private collectUsage;
    /** Check a threshold and emit alerts if exceeded */
    private checkThreshold;
    /** Emit alert to all callbacks */
    private emitAlert;
    /** Get current usage */
    getUsage(): IMemoryUsage;
    /** Get configured budgets */
    getBudgets(): IMemoryBudgets;
    /** Check if monitoring is active */
    isRunning(): boolean;
}
export declare function getMemoryMonitor(): MemoryMonitor;
export declare function _resetMemoryMonitorForTesting(): void;
export { THRESHOLDS as MEMORY_THRESHOLDS };
//# sourceMappingURL=memory-monitor.d.ts.map