/**
 * Pipeline Daemon Client
 *
 * JSON-RPC 2.0 client for the pipeline daemon with auto-start capability.
 * Follows CoreDaemonClient pattern: RULE-106 (spawn not exec), RULE-108 (env allowlist).
 */
/**
 * Pipeline Daemon Client with auto-start
 */
export declare class PipelineDaemonClient {
    private readonly socketPath;
    private readonly timeout;
    private readonly autoStart;
    private requestId;
    private autoStartAttempted;
    constructor(socketPath?: string, timeout?: number, autoStart?: boolean);
    /** Check if daemon socket exists */
    private socketExists;
    /**
     * Auto-start daemon if not running.
     * Uses spawn (RULE-106) with env allowlist (RULE-108).
     */
    private startDaemon;
    /** Ensure daemon is running */
    private ensureRunning;
    /** Low-level JSON-RPC 2.0 call over Unix socket */
    private call;
    isHealthy(): Promise<boolean>;
    init(task: string): Promise<Record<string, unknown>>;
    next(sessionId: string): Promise<Record<string, unknown>>;
    complete(sessionId: string, agentKey: string, file?: string): Promise<Record<string, unknown>>;
    completeAndNext(sessionId: string, agentKey: string, file?: string): Promise<Record<string, unknown>>;
    status(sessionId: string): Promise<Record<string, unknown>>;
    resume(sessionId: string): Promise<Record<string, unknown>>;
    health(): Promise<Record<string, unknown>>;
    restart(): Promise<Record<string, unknown>>;
}
export declare function getPipelineDaemonClient(): PipelineDaemonClient;
export declare function resetPipelineDaemonClient(): void;
//# sourceMappingURL=pipeline-daemon-client.d.ts.map