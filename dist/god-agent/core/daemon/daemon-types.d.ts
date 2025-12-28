/**
 * Daemon Types - TypeScript interfaces for IPC daemon
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001
 *
 * @module src/god-agent/core/daemon/daemon-types
 */
import type { Socket } from 'net';
/**
 * Default socket path for daemon
 */
export declare const DEFAULT_SOCKET_PATH = "/tmp/godagent-db.sock";
/**
 * Maximum concurrent client connections
 */
export declare const MAX_CLIENTS = 10;
/**
 * Default keepalive timeout in milliseconds
 */
export declare const DEFAULT_KEEPALIVE_TIMEOUT_MS = 30000;
/**
 * Maximum graceful shutdown wait time in milliseconds
 */
export declare const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;
/**
 * Daemon server configuration
 */
export interface DaemonConfig {
    /** Path to Unix socket file */
    socketPath: string;
    /** Maximum concurrent client connections */
    maxClients: number;
    /** Keepalive timeout in milliseconds */
    keepAliveTimeout: number;
}
/**
 * Connected client information
 */
export interface ClientConnection {
    /** Unique client identifier */
    id: string;
    /** Client socket */
    socket: Socket;
    /** Timestamp when client connected (ms since epoch) */
    connectedAt: number;
    /** Timestamp of last activity (ms since epoch) */
    lastActivity: number;
}
/**
 * Daemon server statistics
 */
export interface DaemonStats {
    /** Number of currently active connections */
    activeConnections: number;
    /** Total requests processed since startup */
    totalRequests: number;
    /** Uptime in milliseconds */
    uptime: number;
    /** Server start time (ms since epoch) */
    startedAt: number;
}
/**
 * Service handler function type
 */
export type ServiceHandler = (method: string, params: unknown) => Promise<unknown>;
/**
 * Registered service info
 */
export interface RegisteredService {
    /** Service name */
    name: string;
    /** Service handler function */
    handler: ServiceHandler;
    /** Methods supported by service */
    methods: string[];
}
/**
 * Daemon server state
 */
export type DaemonState = 'stopped' | 'starting' | 'running' | 'stopping';
/**
 * Daemon event types
 */
export type DaemonEventType = 'start' | 'stop' | 'client_connect' | 'client_disconnect' | 'client_rejected' | 'error';
/**
 * Daemon event payload
 */
export interface DaemonEvent {
    /** Event type */
    type: DaemonEventType;
    /** Timestamp (ms since epoch) */
    timestamp: number;
    /** Event-specific data */
    data?: Record<string, unknown>;
}
/**
 * Client rejection reason
 */
export declare enum ClientRejectionReason {
    /** Maximum clients reached */
    MAX_CLIENTS_EXCEEDED = "MAX_CLIENTS_EXCEEDED",
    /** Server is shutting down */
    SERVER_SHUTTING_DOWN = "SERVER_SHUTTING_DOWN",
    /** Invalid client state */
    INVALID_STATE = "INVALID_STATE"
}
/**
 * Daemon error codes
 */
export declare enum DaemonErrorCode {
    /** Socket file already exists */
    SOCKET_EXISTS = "EADDRINUSE",
    /** Permission denied */
    PERMISSION_DENIED = "EACCES",
    /** Connection error */
    CONNECTION_ERROR = "ECONNREFUSED",
    /** Timeout error */
    TIMEOUT = "ETIMEDOUT",
    /** Unknown error */
    UNKNOWN = "UNKNOWN"
}
/**
 * Daemon error with code
 */
export interface DaemonError extends Error {
    /** Error code */
    code: DaemonErrorCode;
    /** Additional context */
    context?: Record<string, unknown>;
}
/**
 * Create a daemon error
 */
export declare function createDaemonError(code: DaemonErrorCode, message: string, context?: Record<string, unknown>): DaemonError;
/**
 * Default daemon configuration
 */
export declare const DEFAULT_DAEMON_CONFIG: DaemonConfig;
/**
 * Generate unique client ID
 */
export declare function generateClientId(): string;
/**
 * Check if error is a daemon error
 */
export declare function isDaemonError(error: unknown): error is DaemonError;
//# sourceMappingURL=daemon-types.d.ts.map