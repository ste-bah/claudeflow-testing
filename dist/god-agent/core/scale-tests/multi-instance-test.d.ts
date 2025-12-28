/**
 * Multi-Instance Test
 * TASK-NFR-002 - Scalability Validation Suite (NFR-4.5)
 *
 * Tests horizontal scaling:
 * - 2-4 instance coordination
 * - State synchronization
 * - Load distribution
 * - Partition tolerance
 */
/**
 * Multi-instance test configuration
 */
export interface MultiInstanceConfig {
    /** Number of instances to test */
    instanceCount: number;
    /** Operations per instance */
    operationsPerInstance: number;
    /** Sync check interval in ms */
    syncIntervalMs: number;
    /** Partition duration in ms */
    partitionDurationMs: number;
}
/**
 * Default multi-instance configuration
 */
export declare const DEFAULT_MULTI_INSTANCE_CONFIG: MultiInstanceConfig;
/**
 * Simulated instance
 */
export interface Instance {
    id: string;
    state: Map<string, unknown>;
    version: number;
    isPartitioned: boolean;
    operationCount: number;
}
/**
 * Sync result
 */
export interface SyncResult {
    /** Whether state is consistent */
    consistent: boolean;
    /** Average sync latency in ms */
    avgSyncLatency: number;
    /** Number of conflicts detected */
    conflicts: number;
    /** Sync attempts made */
    syncAttempts: number;
}
/**
 * Load result
 */
export interface LoadResult {
    /** Whether load is balanced */
    balanced: boolean;
    /** Load variance (lower is better) */
    loadVariance: number;
    /** Total throughput (ops/sec) */
    totalThroughput: number;
    /** Per-instance loads */
    instanceLoads: number[];
}
/**
 * Partition result
 */
export interface PartitionResult {
    /** Whether system survived partition */
    survivedPartition: boolean;
    /** Time to recover in ms */
    recoveryTime: number;
    /** Data loss (items) */
    dataLoss: number;
}
/**
 * Multi-instance report
 */
export interface MultiInstanceReport {
    /** Number of instances */
    instanceCount: number;
    /** State synchronization results */
    stateSynchronization: {
        pass: boolean;
        syncLatencyMs: number;
        conflictsDetected: number;
    };
    /** Load distribution results */
    loadDistribution: {
        pass: boolean;
        variance: number;
        throughput: number;
    };
    /** Partition tolerance results */
    partitionTolerance: {
        pass: boolean;
        recoveryTimeMs: number;
    };
    /** Overall pass status */
    overallPass: boolean;
}
/**
 * Simulated instance for multi-instance testing
 */
export declare class SimulatedInstance implements Instance {
    id: string;
    state: Map<string, unknown>;
    version: number;
    isPartitioned: boolean;
    operationCount: number;
    constructor(id: string);
    /**
     * Execute an operation
     */
    execute(key: string, value: unknown): Promise<void>;
    /**
     * Get state value
     */
    get(key: string): unknown;
    /**
     * Get all keys
     */
    keys(): string[];
    /**
     * Sync state from another instance
     */
    syncFrom(other: SimulatedInstance): number;
    /**
     * Partition this instance
     */
    partition(): void;
    /**
     * Heal partition
     */
    heal(): void;
    /**
     * Reset instance
     */
    reset(): void;
    private sleep;
}
/**
 * Multi-instance scaling test for NFR-4.5 validation
 *
 * Tests horizontal scaling capabilities including state synchronization,
 * load distribution, and partition tolerance.
 *
 * @example
 * ```typescript
 * const test = new MultiInstanceTest();
 * const report = await test.runMultiInstanceTest(4);
 *
 * if (report.overallPass) {
 *   console.log('NFR-4.5 validated: Horizontal scaling working!');
 * }
 * ```
 */
export declare class MultiInstanceTest {
    private instances;
    private config;
    constructor(config?: Partial<MultiInstanceConfig>);
    /**
     * Run multi-instance test
     */
    runMultiInstanceTest(instanceCount?: number): Promise<MultiInstanceReport>;
    /**
     * Spawn instances
     */
    private spawnInstances;
    /**
     * Test state synchronization
     */
    private testStateSynchronization;
    /**
     * Test load distribution
     */
    private testLoadDistribution;
    /**
     * Test partition tolerance
     */
    private testPartitionTolerance;
    /**
     * Shutdown instances
     */
    private shutdownInstances;
    /**
     * Get instances (for testing)
     */
    getInstances(): SimulatedInstance[];
}
/**
 * Global multi-instance test instance
 */
export declare const multiInstanceTest: MultiInstanceTest;
//# sourceMappingURL=multi-instance-test.d.ts.map