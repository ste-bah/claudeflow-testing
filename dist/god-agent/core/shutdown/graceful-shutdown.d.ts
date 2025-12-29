/**
 * Graceful Shutdown Handler
 * TASK-ERR-005 - Implement graceful shutdown handlers
 *
 * Constitution: RULE-073 (All components MUST register graceful shutdown handlers)
 *
 * Features:
 * - 5-second timeout per shutdown handler (HARD LIMIT)
 * - SIGTERM and SIGINT signal handling
 * - Uncaught exception handling
 * - Flush all pending writes before exit
 * - Ordered shutdown with logging
 *
 * Components requiring shutdown:
 * - EpisodeStore: store.close() for HNSW index and SQLite
 * - WeightManager: manager.createCheckpoint() for recovery
 * - GraphDB: db.clear() for cleanup
 * - DualEmbeddingStore: store.flush() then store.close()
 * - DaemonServer: Stop listening, close connections
 * - SonaEngine: Flush trajectory buffers
 */
import { type StructuredLogger } from '../observability/index.js';
/** Default timeout per handler in milliseconds (Constitution: 5 seconds HARD LIMIT) */
export declare const DEFAULT_HANDLER_TIMEOUT_MS = 5000;
/** Maximum time for entire shutdown sequence */
export declare const MAX_SHUTDOWN_TIME_MS = 30000;
/** Minimum time between shutdown attempts to prevent rapid re-entry */
export declare const SHUTDOWN_DEBOUNCE_MS = 100;
/**
 * Priority levels for shutdown handlers
 * Higher priority handlers run first (e.g., flush before close)
 */
export declare enum ShutdownPriority {
    /** Critical operations that must run first (e.g., checkpoint creation) */
    CRITICAL = 100,
    /** High priority (e.g., flush pending writes) */
    HIGH = 75,
    /** Normal priority (e.g., close connections) */
    NORMAL = 50,
    /** Low priority (e.g., cleanup temp files) */
    LOW = 25,
    /** Final cleanup operations */
    CLEANUP = 0
}
/**
 * Shutdown handler function signature
 */
export type ShutdownHandlerFn = () => Promise<void>;
/**
 * Registered shutdown handler with metadata
 */
export interface IShutdownHandler {
    /** Unique name for this handler */
    name: string;
    /** The async function to execute during shutdown */
    handler: ShutdownHandlerFn;
    /** Priority level (higher runs first) */
    priority: ShutdownPriority;
    /** Optional timeout override (default: 5000ms) */
    timeoutMs?: number;
    /** Component this handler belongs to */
    component?: string;
}
/**
 * Result of executing a shutdown handler
 */
export interface IShutdownHandlerResult {
    name: string;
    success: boolean;
    durationMs: number;
    error?: Error;
    timedOut: boolean;
}
/**
 * Reason for shutdown
 */
export type ShutdownReason = 'SIGTERM' | 'SIGINT' | 'SIGHUP' | 'uncaughtException' | 'unhandledRejection' | 'manual' | 'error';
/**
 * Shutdown event emitted during the shutdown process
 */
export interface IShutdownEvent {
    reason: ShutdownReason;
    timestamp: number;
    handlers: IShutdownHandlerResult[];
    totalDurationMs: number;
    success: boolean;
}
/**
 * Configuration options for GracefulShutdown
 */
export interface IGracefulShutdownConfig {
    /** Default timeout per handler in ms (default: 5000) */
    defaultTimeoutMs?: number;
    /** Maximum total shutdown time in ms (default: 30000) */
    maxShutdownTimeMs?: number;
    /** Custom logger instance */
    logger?: StructuredLogger;
    /** Exit process after shutdown (default: true) */
    exitOnComplete?: boolean;
    /** Exit code on success (default: 0) */
    successExitCode?: number;
    /** Exit code on failure (default: 1) */
    failureExitCode?: number;
    /** Register process signal handlers automatically (default: true) */
    registerSignalHandlers?: boolean;
}
/**
 * Error thrown when a shutdown handler times out
 */
export declare class ShutdownTimeoutError extends Error {
    readonly handlerName: string;
    readonly timeoutMs: number;
    constructor(handlerName: string, timeoutMs: number);
}
/**
 * Error thrown when shutdown is already in progress
 */
export declare class ShutdownInProgressError extends Error {
    constructor();
}
/**
 * GracefulShutdown - Manages ordered shutdown of all registered components
 *
 * Usage:
 * ```typescript
 * const shutdown = new GracefulShutdown();
 *
 * // Register handlers
 * shutdown.register('database', async () => {
 *   await db.checkpoint();
 *   await db.close();
 * }, ShutdownPriority.CRITICAL);
 *
 * shutdown.register('cache', async () => {
 *   await cache.flush();
 * }, ShutdownPriority.HIGH);
 *
 * // Handlers are called automatically on SIGTERM/SIGINT
 * // Or manually:
 * await shutdown.shutdown('manual');
 * ```
 */
export declare class GracefulShutdown {
    private readonly handlers;
    private readonly config;
    private readonly log;
    private isShuttingDown;
    private lastShutdownAttempt;
    private shutdownPromise;
    private signalHandlersRegistered;
    constructor(config?: IGracefulShutdownConfig);
    /**
     * Register a shutdown handler
     *
     * @param name - Unique identifier for this handler
     * @param handler - Async function to execute during shutdown
     * @param priority - Execution priority (higher runs first)
     * @param options - Additional options
     * @throws Error if handler with same name already exists
     */
    register(name: string, handler: ShutdownHandlerFn, priority?: ShutdownPriority, options?: {
        timeoutMs?: number;
        component?: string;
    }): void;
    /**
     * Unregister a shutdown handler
     *
     * @param name - Name of handler to remove
     * @returns true if handler was removed, false if not found
     */
    unregister(name: string): boolean;
    /**
     * Check if a handler is registered
     */
    hasHandler(name: string): boolean;
    /**
     * Get count of registered handlers
     */
    get handlerCount(): number;
    /**
     * Check if shutdown is in progress
     */
    get shuttingDown(): boolean;
    /**
     * Get list of registered handler names
     */
    getHandlerNames(): string[];
    /**
     * Execute graceful shutdown
     *
     * Runs all registered handlers in priority order, with timeout enforcement.
     * Handlers at same priority level run in parallel.
     *
     * @param reason - Reason for shutdown
     * @returns Shutdown event with results
     */
    shutdown(reason?: ShutdownReason): Promise<IShutdownEvent>;
    /**
     * Internal shutdown execution
     */
    private executeShutdown;
    /**
     * Execute a single handler with timeout
     */
    private executeHandler;
    /**
     * Create a timeout promise that rejects after the specified time
     */
    private createTimeout;
    /**
     * Register process signal handlers
     */
    private registerSignalHandlers;
    /**
     * Remove all signal handlers (useful for testing)
     */
    removeSignalHandlers(): void;
}
/**
 * Get or create the global shutdown handler instance
 */
export declare function getGracefulShutdown(config?: IGracefulShutdownConfig): GracefulShutdown;
/**
 * Register a handler with the global shutdown instance
 */
export declare function registerShutdownHandler(name: string, handler: ShutdownHandlerFn, priority?: ShutdownPriority, options?: {
    timeoutMs?: number;
    component?: string;
}): void;
/**
 * Initiate graceful shutdown using the global instance
 */
export declare function initiateShutdown(reason?: ShutdownReason): Promise<IShutdownEvent>;
/**
 * Reset the global shutdown instance (for testing)
 */
export declare function resetGracefulShutdown(): void;
/**
 * Interface for components that support graceful shutdown
 */
export interface IShutdownable {
    close?(): Promise<void>;
    flush?(): Promise<void>;
    checkpoint?(): Promise<void>;
    stop?(): Promise<void>;
}
/**
 * Create and register shutdown handlers for common component patterns
 *
 * @param name - Handler name
 * @param component - Component implementing shutdown methods
 * @param options - Registration options
 */
export declare function registerComponentShutdown(name: string, component: IShutdownable, options?: {
    priority?: ShutdownPriority;
    timeoutMs?: number;
    flushFirst?: boolean;
    checkpointFirst?: boolean;
}): void;
/**
 * Register shutdown handler for database connection
 * Checkpoints and closes SQLite database
 */
export declare function registerDatabaseShutdown(name: string, connection: {
    checkpoint(): void;
    close(): void;
}, priority?: ShutdownPriority): void;
/**
 * Register shutdown handler for SonaEngine
 * Creates checkpoint for weight recovery
 */
export declare function registerSonaEngineShutdown(name: string, engine: {
    createCheckpoint(reason: string): Promise<string>;
}, priority?: ShutdownPriority): void;
/**
 * Register shutdown handler for GraphDB
 * Clears graph and releases resources
 */
export declare function registerGraphDBShutdown(name: string, db: {
    clear(): Promise<void>;
}, priority?: ShutdownPriority): void;
/**
 * Register shutdown handler for embedding store
 * Flushes and closes the store
 */
export declare function registerEmbeddingStoreShutdown(name: string, store: {
    flush?(): Promise<void>;
    close(): Promise<void>;
}, priority?: ShutdownPriority): void;
/**
 * Register shutdown handler for server (HTTP/Socket)
 * Stops accepting connections and closes existing ones
 */
export declare function registerServerShutdown(name: string, server: {
    stop?(): Promise<void>;
    close?(): Promise<void>;
}, priority?: ShutdownPriority): void;
//# sourceMappingURL=graceful-shutdown.d.ts.map