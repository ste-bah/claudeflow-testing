/**
 * Pipeline Scale Test
 * TASK-NFR-002 - Scalability Validation Suite (NFR-4.2)
 *
 * Tests 48-agent PhD pipeline scaling:
 * - Concurrent agent execution
 * - Memory key contention
 * - Handoff latency
 * - Completion rate (target: 88%)
 */
/**
 * Pipeline scale test configuration
 */
export interface PipelineScaleConfig {
    /** Number of agents */
    agentCount: number;
    /** Target completion rate */
    targetCompletionRate: number;
    /** Max handoff latency in ms */
    maxHandoffLatencyMs: number;
    /** Operation timeout in ms */
    timeoutMs: number;
}
/**
 * Default pipeline scale configuration
 */
export declare const DEFAULT_PIPELINE_SCALE_CONFIG: PipelineScaleConfig;
/**
 * Agent result
 */
export interface AgentResult {
    /** Agent index */
    agentId: number;
    /** Agent name */
    name: string;
    /** Status */
    status: 'fulfilled' | 'rejected';
    /** Result value */
    value?: unknown;
    /** Error message */
    error?: string;
    /** Execution time in ms */
    executionTimeMs: number;
}
/**
 * Pipeline scale report
 */
export interface PipelineScaleReport {
    /** Number of agents */
    agentCount: number;
    /** Successful completions */
    completions: number;
    /** Failures */
    failures: number;
    /** Completion rate (0-1) */
    completionRate: number;
    /** Target completion rate */
    targetCompletionRate: number;
    /** Pass status */
    pass: boolean;
    /** Total duration in ms */
    durationMs: number;
    /** Average handoff latency in ms */
    avgHandoffLatencyMs: number;
    /** Maximum concurrency observed */
    maxConcurrency: number;
    /** Individual agent results */
    results: AgentResult[];
}
/**
 * Contention report
 */
export interface ContentionReport {
    /** Number of concurrent operations */
    concurrentOperations: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Average latency in ms */
    avgLatencyMs: number;
    /** Number of contention events */
    contentionEvents: number;
    /** Maximum contention latency in ms */
    maxContentionLatencyMs: number;
    /** Pass status */
    pass: boolean;
}
/**
 * Simulated PhD pipeline agent
 */
export interface PipelineAgent {
    id: number;
    name: string;
    phase: string;
    dependencies: number[];
    execute: () => Promise<unknown>;
}
/**
 * Generate PhD pipeline agents (per PRD Section 7.5)
 */
export declare function generatePipelineAgents(count: number): PipelineAgent[];
/**
 * Pipeline scale test for NFR-4.2 validation
 *
 * Tests 48-agent concurrent execution, measuring completion rate,
 * handoff latency, and memory key contention.
 *
 * @example
 * ```typescript
 * const test = new PipelineScaleTest();
 * const report = await test.runPipelineTest();
 *
 * if (report.pass) {
 *   console.log('NFR-4.2 validated: 88%+ completion rate!');
 * }
 * ```
 */
export declare class PipelineScaleTest {
    private concurrencyTracker;
    private memoryStore;
    constructor();
    /**
     * Run 48-agent pipeline test
     */
    runPipelineTest(config?: Partial<PipelineScaleConfig>): Promise<PipelineScaleReport>;
    /**
     * Test memory key contention
     */
    runContentionTest(concurrentOperations?: number): Promise<ContentionReport>;
    /**
     * Wait for dependencies to complete
     */
    private waitForDependencies;
    /**
     * Store result in memory
     */
    private storeResult;
    /**
     * Generate test payload
     */
    private generatePayload;
    /**
     * Get current concurrency statistics
     */
    getConcurrencyStats(): import("./utils/concurrency-tracker.js").ConcurrencyStats;
    /**
     * Get memory store size
     */
    getMemoryStoreSize(): number;
}
/**
 * Global pipeline scale test instance
 */
export declare const pipelineScaleTest: PipelineScaleTest;
//# sourceMappingURL=pipeline-scale-test.d.ts.map