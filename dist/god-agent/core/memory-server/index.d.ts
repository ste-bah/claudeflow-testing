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
export { MemoryServer, getMemoryServer, startMemoryServer, stopMemoryServer, } from './memory-server.js';
export { MemoryClient, getMemoryClient, createMemoryClient, } from './memory-client.js';
export { MemoryHealthMonitor, getHealthMonitor, isMemoryServerHealthy, discoverMemoryServer, type IDiagnosticReport, } from './memory-health.js';
export { launchDaemon, stopDaemon, getDaemonStatus, ensureDaemonRunning, startMemoryDaemon, stopMemoryDaemon, getMemoryDaemonStatus, ensureMemoryDaemonRunning, type IDaemonLaunchResult, type IDaemonStopResult, type IDaemonStatus, } from './daemon-launcher.js';
export { MemoryError, InvalidRequestError, UnknownMethodError, ValidationError, StorageError, ServerShuttingDownError, TimeoutError, MaxConnectionsError, ServerNotRunningError, ServerDisconnectedError, errorFromInfo, isMemoryError, wrapError, } from './memory-errors.js';
export { createRequest, createSuccessResponse, createErrorResponse, serializeMessage, parseMessage, isRequest, isResponse, isValidMethod, validateParams, MessageBuffer, } from './memory-protocol.js';
export type { MemoryMethod, IMemoryRequest, IMemoryResponse, IMemoryErrorInfo, MemoryErrorCode, IKnowledgeEntry, IStoreKnowledgeParams, IGetKnowledgeByDomainParams, IGetKnowledgeByTagsParams, IDeleteKnowledgeParams, IProvideFeedbackParams, IProvideFeedbackResult, IQueryPatternsParams, IQueryPatternsResult, IPatternMatch, IServerStatus, IStorageStats, IPingResult, ServerState, IMemoryServerConfig, IPidFileContent, IMemoryClientConfig, ClientState, IClientConnection, IHealthCheckResult, IHealthMonitorConfig, } from '../types/memory-types.js';
export { DEFAULT_SOCKET_PATH, DEFAULT_HTTP_PORT, DEFAULT_MAX_CONNECTIONS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS, DEFAULT_MAX_RECONNECT_ATTEMPTS, DEFAULT_HEALTH_CHECK_INTERVAL_MS, DEFAULT_HEALTH_CHECK_TIMEOUT_MS, DEFAULT_FAILURE_THRESHOLD, MEMORY_SERVER_VERSION, } from '../types/memory-types.js';
//# sourceMappingURL=index.d.ts.map