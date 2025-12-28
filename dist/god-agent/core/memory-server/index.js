/**
 * Memory Server Module
 * MEM-001 - Multi-process memory system exports
 *
 * This module provides:
 * - MemoryServer: Daemon process for centralized memory operations
 * - MemoryClient: Client for agents to access memory server
 * - MemoryHealthMonitor: Health checking and diagnostics
 * - Protocol utilities for IPC message handling
 */
// ==================== Server Exports ====================
export { MemoryServer, getMemoryServer, startMemoryServer, stopMemoryServer, } from './memory-server.js';
// ==================== Client Exports ====================
export { MemoryClient, getMemoryClient, createMemoryClient, } from './memory-client.js';
// ==================== Health Exports ====================
export { MemoryHealthMonitor, getHealthMonitor, isMemoryServerHealthy, discoverMemoryServer, } from './memory-health.js';
// ==================== Daemon Launcher Exports ====================
export { launchDaemon, stopDaemon, getDaemonStatus, ensureDaemonRunning, startMemoryDaemon, stopMemoryDaemon, getMemoryDaemonStatus, ensureMemoryDaemonRunning, } from './daemon-launcher.js';
// ==================== Error Exports ====================
export { MemoryError, InvalidRequestError, UnknownMethodError, ValidationError, StorageError, ServerShuttingDownError, TimeoutError, MaxConnectionsError, ServerNotRunningError, ServerDisconnectedError, errorFromInfo, isMemoryError, wrapError, } from './memory-errors.js';
// ==================== Protocol Exports ====================
export { createRequest, createSuccessResponse, createErrorResponse, serializeMessage, parseMessage, isRequest, isResponse, isValidMethod, validateParams, MessageBuffer, } from './memory-protocol.js';
// ==================== Constants Re-exports ====================
export { DEFAULT_SOCKET_PATH, DEFAULT_HTTP_PORT, DEFAULT_MAX_CONNECTIONS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_ATTEMPTS, DEFAULT_HEALTH_CHECK_INTERVAL_MS, DEFAULT_HEALTH_CHECK_TIMEOUT_MS, DEFAULT_FAILURE_THRESHOLD, MEMORY_SERVER_VERSION, } from '../types/memory-types.js';
//# sourceMappingURL=index.js.map