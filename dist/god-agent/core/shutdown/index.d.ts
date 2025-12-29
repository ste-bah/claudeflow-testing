/**
 * Shutdown Module
 * TASK-ERR-005 - Graceful shutdown handlers
 *
 * Constitution: RULE-073 (All components MUST register graceful shutdown handlers)
 *
 * Exports:
 * - GracefulShutdown class
 * - Signal handler registration
 * - Component shutdown factories
 * - Priority constants
 */
export { GracefulShutdown, ShutdownPriority, type ShutdownHandlerFn, type IShutdownHandler, type IShutdownHandlerResult, type ShutdownReason, type IShutdownEvent, type IGracefulShutdownConfig, type IShutdownable, ShutdownTimeoutError, ShutdownInProgressError, DEFAULT_HANDLER_TIMEOUT_MS, MAX_SHUTDOWN_TIME_MS, SHUTDOWN_DEBOUNCE_MS, getGracefulShutdown, registerShutdownHandler, initiateShutdown, resetGracefulShutdown, registerComponentShutdown, registerDatabaseShutdown, registerSonaEngineShutdown, registerGraphDBShutdown, registerEmbeddingStoreShutdown, registerServerShutdown, } from './graceful-shutdown.js';
//# sourceMappingURL=index.d.ts.map