/**
 * Daemon Module - Unix socket IPC for God Agent services
 *
 * PRD: PRD-GOD-AGENT-001
 * Tasks: TASK-DAEMON-001, TASK-DAEMON-002
 *
 * @module src/god-agent/core/daemon
 */
export type { DaemonConfig, ClientConnection, DaemonStats, RegisteredService, ServiceHandler, DaemonState, DaemonEventType, DaemonEvent, DaemonError, } from './daemon-types.js';
export { DEFAULT_SOCKET_PATH, MAX_CLIENTS, DEFAULT_KEEPALIVE_TIMEOUT_MS, GRACEFUL_SHUTDOWN_TIMEOUT_MS, DEFAULT_DAEMON_CONFIG, ClientRejectionReason, DaemonErrorCode, createDaemonError, generateClientId, isDaemonError, } from './daemon-types.js';
export type { JsonRpcRequest, JsonRpcResponse, JsonRpcError, JsonRpcNotification, JsonRpcBatchRequest, JsonRpcBatchResponse, ParsedMessage, } from './protocol-types.js';
export { JSONRPC_VERSION, MAX_MESSAGE_SIZE, MESSAGE_DELIMITER, RPC_ERROR_MESSAGES, RpcErrorCode, createRpcError, createSuccessResponse, createErrorResponse, isNotification, isValidRequest, isBatchRequest, isValidMethodName, extractServiceName, extractMethodName, } from './protocol-types.js';
export { DaemonServer } from './daemon-server.js';
export { MessageHandler, type IServiceRegistry } from './message-handler.js';
//# sourceMappingURL=index.d.ts.map