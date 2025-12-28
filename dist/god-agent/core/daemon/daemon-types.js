/**
 * Daemon Types - TypeScript interfaces for IPC daemon
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-DAEMON-001
 *
 * @module src/god-agent/core/daemon/daemon-types
 */
/**
 * Default socket path for daemon
 */
export const DEFAULT_SOCKET_PATH = '/tmp/godagent-db.sock';
/**
 * Maximum concurrent client connections
 */
export const MAX_CLIENTS = 10;
/**
 * Default keepalive timeout in milliseconds
 */
export const DEFAULT_KEEPALIVE_TIMEOUT_MS = 30_000;
/**
 * Maximum graceful shutdown wait time in milliseconds
 */
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5_000;
/**
 * Client rejection reason
 */
export var ClientRejectionReason;
(function (ClientRejectionReason) {
    /** Maximum clients reached */
    ClientRejectionReason["MAX_CLIENTS_EXCEEDED"] = "MAX_CLIENTS_EXCEEDED";
    /** Server is shutting down */
    ClientRejectionReason["SERVER_SHUTTING_DOWN"] = "SERVER_SHUTTING_DOWN";
    /** Invalid client state */
    ClientRejectionReason["INVALID_STATE"] = "INVALID_STATE";
})(ClientRejectionReason || (ClientRejectionReason = {}));
/**
 * Daemon error codes
 */
export var DaemonErrorCode;
(function (DaemonErrorCode) {
    /** Socket file already exists */
    DaemonErrorCode["SOCKET_EXISTS"] = "EADDRINUSE";
    /** Permission denied */
    DaemonErrorCode["PERMISSION_DENIED"] = "EACCES";
    /** Connection error */
    DaemonErrorCode["CONNECTION_ERROR"] = "ECONNREFUSED";
    /** Timeout error */
    DaemonErrorCode["TIMEOUT"] = "ETIMEDOUT";
    /** Unknown error */
    DaemonErrorCode["UNKNOWN"] = "UNKNOWN";
})(DaemonErrorCode || (DaemonErrorCode = {}));
/**
 * Create a daemon error
 */
export function createDaemonError(code, message, context) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    error.name = 'DaemonError';
    return error;
}
/**
 * Default daemon configuration
 */
export const DEFAULT_DAEMON_CONFIG = {
    socketPath: DEFAULT_SOCKET_PATH,
    maxClients: MAX_CLIENTS,
    keepAliveTimeout: DEFAULT_KEEPALIVE_TIMEOUT_MS,
};
/**
 * Generate unique client ID
 */
export function generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * Check if error is a daemon error
 */
export function isDaemonError(error) {
    return (error instanceof Error &&
        'code' in error &&
        Object.values(DaemonErrorCode).includes(error.code));
}
//# sourceMappingURL=daemon-types.js.map