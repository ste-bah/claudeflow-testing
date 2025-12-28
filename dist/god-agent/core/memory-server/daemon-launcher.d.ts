/**
 * Daemon Launcher
 * MEM-001 - Spawns memory server as a detached daemon process
 *
 * This module provides functions to start, stop, and manage the
 * memory server daemon as a truly independent background process.
 */
export interface IDaemonLaunchResult {
    success: boolean;
    address?: string;
    pid?: number;
    error?: string;
    alreadyRunning?: boolean;
}
export interface IDaemonStopResult {
    success: boolean;
    wasRunning: boolean;
    error?: string;
}
export interface IDaemonStatus {
    running: boolean;
    pid?: number;
    address?: string;
    uptime?: number;
    version?: string;
    reachable?: boolean;
}
/**
 * Launch the memory server as a detached daemon process
 */
export declare function launchDaemon(agentDbPath?: string, options?: {
    verbose?: boolean;
}): Promise<IDaemonLaunchResult>;
/**
 * Stop the memory server daemon
 */
export declare function stopDaemon(agentDbPath?: string): Promise<IDaemonStopResult>;
/**
 * Get daemon status
 */
export declare function getDaemonStatus(agentDbPath?: string): Promise<IDaemonStatus>;
/**
 * Ensure daemon is running, launching if necessary
 */
export declare function ensureDaemonRunning(agentDbPath?: string, options?: {
    verbose?: boolean;
}): Promise<IDaemonLaunchResult>;
export { launchDaemon as startMemoryDaemon, stopDaemon as stopMemoryDaemon, getDaemonStatus as getMemoryDaemonStatus, ensureDaemonRunning as ensureMemoryDaemonRunning, };
//# sourceMappingURL=daemon-launcher.d.ts.map