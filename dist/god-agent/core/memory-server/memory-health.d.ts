/**
 * Memory Health Monitor
 * MEM-001 - Health checking and diagnostics for memory server
 *
 * Provides:
 * - Periodic health checks
 * - Server discovery
 * - Connectivity verification
 * - Diagnostic reporting
 */
import type { IHealthCheckResult, IHealthMonitorConfig, IPidFileContent } from '../types/memory-types.js';
export declare class MemoryHealthMonitor {
    private readonly config;
    private readonly agentDbPath;
    private checkTimer;
    private consecutiveFailures;
    private lastResult;
    private listeners;
    constructor(agentDbPath?: string, config?: Partial<IHealthMonitorConfig>);
    /**
     * Start periodic health monitoring
     */
    start(): void;
    /**
     * Stop health monitoring
     */
    stop(): void;
    /**
     * Subscribe to health check results
     */
    subscribe(listener: (result: IHealthCheckResult) => void): () => void;
    /**
     * Get last health check result
     */
    getLastResult(): IHealthCheckResult | null;
    /**
     * Perform a single health check
     */
    check(): Promise<IHealthCheckResult>;
    private handleResult;
    /**
     * Discover the memory server address from PID file
     */
    discoverServer(): Promise<string | null>;
    /**
     * Check if server is healthy at the given address
     */
    isServerHealthy(address?: string): Promise<boolean>;
    private pingServer;
    private pingUnixSocket;
    private pingHttp;
    /**
     * Get comprehensive diagnostic information
     */
    getDiagnostics(): Promise<IDiagnosticReport>;
}
export interface IDiagnosticReport {
    timestamp: string;
    agentDbPath: string;
    pidFileExists: boolean;
    pidFileContent: IPidFileContent | null;
    serverProcessRunning: boolean;
    serverReachable: boolean;
    lastHealthCheck: IHealthCheckResult | null;
    consecutiveFailures: number;
    storageStatus: IStorageStatus | null;
}
interface IStorageStatus {
    exists: boolean;
    isDirectory?: boolean;
    permissions?: string;
}
/**
 * Get or create the singleton health monitor
 */
export declare function getHealthMonitor(agentDbPath?: string, config?: Partial<IHealthMonitorConfig>): MemoryHealthMonitor;
/**
 * Quick check if server is healthy
 */
export declare function isMemoryServerHealthy(agentDbPath?: string): Promise<boolean>;
/**
 * Discover memory server address
 */
export declare function discoverMemoryServer(agentDbPath?: string): Promise<string | null>;
export {};
//# sourceMappingURL=memory-health.d.ts.map