/**
 * Memory Types
 * MEM-001 - Shared type definitions for multi-process memory system
 *
 * Provides types for:
 * - IPC message structures (request/response)
 * - Memory operations
 * - Server/client configuration
 * - Knowledge storage
 */
// ==================== Default Constants ====================
/** Default socket path for Unix domain socket */
export const DEFAULT_SOCKET_PATH = '/tmp/god-agent-memory.sock';
/** Default HTTP port for Windows fallback */
export const DEFAULT_HTTP_PORT = 47654;
/** Default maximum connections */
export const DEFAULT_MAX_CONNECTIONS = 100;
/** Default request timeout (30 seconds) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
/** Default connection timeout (5 seconds) */
export const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
/** Default reconnection delay (1 second) */
export const DEFAULT_RECONNECT_DELAY_MS = 1000;
/** Default max reconnection attempts */
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
/** Default health check interval (10 seconds) */
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10000;
/** Default health check timeout (5 seconds) */
export const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000;
/** Default failure threshold */
export const DEFAULT_FAILURE_THRESHOLD = 3;
/** Memory server version */
export const MEMORY_SERVER_VERSION = '1.0.0';
//# sourceMappingURL=memory-types.js.map