/**
 * DaemonServer - Observability Daemon Process
 *
 * Implements the observability daemon process that:
 * 1. Initializes all observability components
 * 2. Starts Unix socket server for God Agent communication
 * 3. Starts Express HTTP server for dashboard
 * 4. Handles graceful shutdown on SIGTERM/SIGINT
 *
 * @module observability/daemon-server
 * @see TASK-OBS-009-DAEMON-CLI.md
 * @see SPEC-OBS-001-CORE.md
 */
/**
 * Daemon server configuration
 */
export interface IDaemonServerConfig {
    /** HTTP port (default: 3847) */
    port?: number;
    /** Enable verbose logging */
    verbose?: boolean;
}
/**
 * DaemonServer interface
 * Implements [REQ-OBS-12]: Daemon lifecycle management
 */
export interface IDaemonServer {
    /**
     * Start the daemon server
     * @param port HTTP port to listen on
     * @returns Promise resolving when server is started
     */
    start(port: number): Promise<void>;
    /**
     * Stop the daemon server
     * @returns Promise resolving when server is stopped
     */
    stop(): Promise<void>;
    /**
     * Get the current port
     * @returns Port number or 0 if not started
     */
    getPort(): number;
    /**
     * Check if server is running
     * @returns True if running
     */
    isRunning(): boolean;
}
/**
 * Write PID file
 * Implements [REQ-OBS-12]: PID file management
 */
export declare function writePidFile(pid: number): void;
/**
 * Remove PID file
 */
export declare function removePidFile(): void;
/**
 * Read PID from file
 * @returns PID or null if file doesn't exist
 */
export declare function readPidFile(): number | null;
/**
 * Check if process is running
 * @param pid Process ID to check
 * @returns True if process exists
 */
export declare function isProcessRunning(pid: number): boolean;
/**
 * DaemonServer implementation
 *
 * Implements:
 * - [REQ-OBS-12]: Daemon lifecycle management
 * - [RULE-OBS-007]: Startup time < 2 seconds
 * - [RULE-OBS-003]: Graceful shutdown
 */
export declare class DaemonServer implements IDaemonServer {
    private components;
    private expressServer;
    private socketServer;
    private port;
    private verbose;
    private running;
    /**
     * Create a new DaemonServer
     * @param config Optional configuration
     */
    constructor(config?: IDaemonServerConfig);
    /**
     * Start the daemon server
     * Implements [REQ-OBS-12]: Complete startup sequence
     */
    start(port: number): Promise<void>;
    /**
     * Stop the daemon server
     * Implements [REQ-OBS-12]: Graceful shutdown
     */
    stop(): Promise<void>;
    /**
     * Cleanup all resources
     */
    private cleanup;
    /**
     * Setup signal handlers for graceful shutdown
     * Implements [REQ-OBS-12]: Handle SIGTERM and SIGINT
     */
    private setupSignalHandlers;
    /**
     * Get the current port
     */
    getPort(): number;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
    /**
     * Log message if verbose mode enabled
     */
    private log;
}
//# sourceMappingURL=daemon-server.d.ts.map