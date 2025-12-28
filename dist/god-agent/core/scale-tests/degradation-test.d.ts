/**
 * Degradation Test
 * TASK-NFR-002 - Scalability Validation Suite (NFR-4.4)
 *
 * Tests graceful degradation under load:
 * - Behavior at capacity limits
 * - 429 Too Many Requests handling
 * - Recovery after overload
 * - Crash prevention
 */
/**
 * Degradation test configuration
 */
export interface DegradationConfig {
    /** Capacity limit (max operations) */
    capacityLimit: number;
    /** Operations to attempt beyond capacity */
    overloadAttempts: number;
    /** Recovery check operations */
    recoveryCheckCount: number;
    /** Timeout for recovery in ms */
    recoveryTimeoutMs: number;
}
/**
 * Default degradation configuration
 */
export declare const DEFAULT_DEGRADATION_CONFIG: DegradationConfig;
/**
 * Capacity error
 */
export declare class CapacityExceededError extends Error {
    code: string;
    status: number;
    constructor(message?: string);
}
/**
 * Rejection result
 */
export interface RejectionResult {
    /** Total attempts */
    attempts: number;
    /** Graceful 429 rejections */
    graceful429s: number;
    /** Crashes (unhandled errors) */
    crashes: number;
    /** Other errors */
    otherErrors: number;
}
/**
 * Recovery result
 */
export interface RecoveryResult {
    /** Time to recovery in ms */
    timeToRecoveryMs: number;
    /** Whether operations resumed */
    resumed: boolean;
    /** Recovery attempts made */
    attempts: number;
    /** Successful operations after recovery */
    successfulOps: number;
}
/**
 * Capacity result
 */
export interface CapacityResult {
    /** Whether capacity was reached */
    capacityReached: boolean;
    /** Operations completed before capacity */
    operationsCompleted: number;
    /** Final capacity utilization */
    utilization: number;
}
/**
 * Degradation report
 */
export interface DegradationReport {
    /** Whether capacity was reached */
    capacityReached: boolean;
    /** Rejection behavior results */
    rejectionBehavior: {
        totalAttempts: number;
        gracefulRejections: number;
        crashes: number;
        pass: boolean;
    };
    /** Recovery results */
    recovery: {
        timeToRecoveryMs: number;
        operationsResumed: boolean;
        pass: boolean;
    };
    /** Overall pass status */
    overallPass: boolean;
}
/**
 * Simulated capacity manager for testing
 */
export declare class CapacityManager {
    private currentLoad;
    private maxCapacity;
    private isOverloaded;
    constructor(maxCapacity: number);
    /**
     * Try to acquire capacity
     */
    tryAcquire(): boolean;
    /**
     * Acquire capacity, throwing if not available
     */
    acquire(): void;
    /**
     * Release capacity
     */
    release(): void;
    /**
     * Get current load
     */
    getLoad(): number;
    /**
     * Get capacity utilization (0-1)
     */
    getUtilization(): number;
    /**
     * Check if system is overloaded
     */
    checkOverloaded(): boolean;
    /**
     * Reset to initial state
     */
    reset(): void;
    /**
     * Reduce load (simulate cleanup/recovery)
     */
    reduceLoad(amount: number): void;
}
/**
 * Graceful degradation test for NFR-4.4 validation
 *
 * Tests system behavior at capacity limits, verifying graceful
 * rejection (429) instead of crashes, and proper recovery.
 *
 * @example
 * ```typescript
 * const test = new DegradationTest();
 * const report = await test.runDegradationTest();
 *
 * if (report.overallPass) {
 *   console.log('NFR-4.4 validated: Graceful degradation working!');
 * }
 * ```
 */
export declare class DegradationTest {
    private capacityManager;
    private config;
    constructor(config?: Partial<DegradationConfig>);
    /**
     * Run complete degradation test
     */
    runDegradationTest(): Promise<DegradationReport>;
    /**
     * Push system to capacity
     */
    pushToCapacity(): Promise<CapacityResult>;
    /**
     * Test graceful rejection at capacity
     */
    testGracefulRejection(): Promise<RejectionResult>;
    /**
     * Test recovery after overload
     */
    testRecovery(): Promise<RecoveryResult>;
    /**
     * Simulate an operation
     */
    private simulateOperation;
    /**
     * Check if error represents a crash
     */
    private isCrash;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Get capacity manager (for testing)
     */
    getCapacityManager(): CapacityManager;
    /**
     * Reset test state
     */
    reset(): void;
}
/**
 * Global degradation test instance
 */
export declare const degradationTest: DegradationTest;
//# sourceMappingURL=degradation-test.d.ts.map