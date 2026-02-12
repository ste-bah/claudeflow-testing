/**
 * Pipeline Daemon Service Handler
 *
 * Wraps the coding pipeline CLI functions with a warm orchestrator bundle.
 * Holds UniversalAgent, orchestrator, agentRegistry, and patternMatcher
 * in memory so RPC calls avoid the ~1-30s cold-start penalty.
 *
 * Used by pipeline-daemon.ts via DaemonServer's registerService() pattern.
 */
/**
 * Pipeline service handler for daemon registration.
 *
 * Lifecycle:
 *   1. `initialize()` — creates warm orchestrator bundle (call once at daemon startup)
 *   2. RPC methods — thin wrappers that pass the warm bundle to CLI functions
 *   3. `getHealthInfo()` — returns memory usage + request counts for monitoring
 */
export declare class PipelineDaemonService {
    private bundle;
    private requestCount;
    private lastRequestAt;
    private initStartedAt;
    /**
     * Initialize the warm orchestrator bundle.
     * This is the expensive operation (~1-30s) that the daemon amortizes.
     */
    initialize(): Promise<void>;
    /**
     * Re-initialize the orchestrator bundle (for memory leak recovery).
     */
    reinitialize(): Promise<void>;
    /**
     * Create the service handler function for DaemonServer.registerService().
     * Returns a function that routes `method` strings to the appropriate handler.
     */
    createHandler(): (method: string, params: unknown) => Promise<unknown>;
    /**
     * List of methods supported by this service (for registerService()).
     */
    getMethods(): string[];
    private handleInit;
    private handleNext;
    private handleComplete;
    private handleCompleteAndNext;
    private handleStatus;
    private handleResume;
    /**
     * status() writes to console.log directly. Capture its output.
     */
    private captureStatusOutput;
    /**
     * Health info for monitoring (memory leaks, request stats).
     */
    getHealthInfo(): Record<string, unknown>;
}
//# sourceMappingURL=pipeline-daemon-service.d.ts.map