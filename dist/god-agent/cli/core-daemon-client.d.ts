/**
 * Core Daemon Client for God Agent
 * Provides JSON-RPC 2.0 communication with the core God Agent daemon
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: DAEMON-002
 *
 * Features auto-start: if daemon is not running, automatically starts it.
 * Implements RULE-106 (spawn not exec) and RULE-108 (env allowlist).
 */
/**
 * Health check result from daemon
 */
interface HealthCheckResult {
    status: string;
    timestamp: number;
}
/**
 * Status result from daemon
 */
interface StatusResult {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    services: string[];
}
/**
 * Core Daemon Client
 *
 * Implements DAEMON-002: Auto-start functionality for core daemon
 * Implements RULE-091: JSDoc on all public methods
 * Implements RULE-106: Uses spawn() not exec()
 * Implements RULE-108: Allowlisted environment variables
 */
export declare class CoreDaemonClient {
    private socketPath;
    private timeout;
    private requestId;
    private autoStartAttempted;
    /**
     * Create a new CoreDaemonClient
     *
     * Implements DAEMON-002: Client initialization
     *
     * @param options - Configuration options
     * @param options.socketPath - Path to Unix socket (default: /tmp/godagent-db.sock)
     * @param options.timeout - Request timeout in milliseconds (default: 30000)
     */
    constructor(options?: {
        socketPath?: string;
        timeout?: number;
    });
    /**
     * Check if daemon socket exists
     *
     * Implements DAEMON-002: Socket existence check
     * Implements RULE-069: Try/catch with context
     *
     * @returns True if socket file exists
     */
    private socketExists;
    /**
     * Start the core daemon in background
     *
     * Implements DAEMON-002: Auto-start daemon functionality
     * Implements RULE-106: Uses spawn() not exec() for security
     * Implements RULE-108: Allowlisted environment variables only
     * Implements RULE-069: Try/catch with error context
     *
     * @returns True if daemon started successfully
     */
    private startDaemon;
    /**
     * Ensure daemon is running, start if needed
     *
     * Implements DAEMON-002: Daemon availability guarantee
     *
     * @returns True if daemon is running or was started successfully
     */
    private ensureDaemonRunning;
    /**
     * Call core daemon via JSON-RPC over Unix socket
     *
     * Implements DAEMON-002: JSON-RPC 2.0 communication
     * Implements RULE-069: Try/catch error handling
     *
     * Auto-starts daemon if not running
     *
     * @param method - RPC method name (e.g., 'health.check')
     * @param params - Method parameters
     * @returns Promise resolving to method result
     * @throws Error if RPC call fails
     */
    private call;
    /**
     * Check if core daemon is healthy
     *
     * Implements DAEMON-002: Health check method
     * Implements RULE-091: JSDoc on public methods
     *
     * @returns True if daemon is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Get detailed health status
     *
     * Implements DAEMON-002: Health check method
     * Implements RULE-091: JSDoc on public methods
     *
     * @returns Health check result or null if unavailable
     */
    healthCheck(): Promise<HealthCheckResult | null>;
    /**
     * Get daemon status and metrics
     *
     * Implements DAEMON-002: Status method
     * Implements RULE-091: JSDoc on public methods
     *
     * @returns Status result with uptime, memory, and services
     */
    getStatus(): Promise<StatusResult | null>;
    /**
     * Call a custom RPC method
     *
     * Implements DAEMON-002: Generic RPC method
     * Implements RULE-091: JSDoc on public methods
     *
     * @param method - RPC method name
     * @param params - Method parameters
     * @returns Promise resolving to method result
     */
    callMethod<T>(method: string, params: unknown): Promise<T>;
}
/**
 * Get the default CoreDaemonClient singleton
 *
 * Implements DAEMON-002: Singleton accessor
 * Implements RULE-091: JSDoc on public methods
 *
 * @returns The default CoreDaemonClient instance
 */
export declare function getCoreDaemonClient(): CoreDaemonClient;
/**
 * Reset the default CoreDaemonClient singleton
 *
 * Implements DAEMON-002: Singleton reset for testing
 * Implements RULE-091: JSDoc on public methods
 *
 * Used primarily for testing to ensure clean state
 */
export declare function resetCoreDaemonClient(): void;
export {};
//# sourceMappingURL=core-daemon-client.d.ts.map