/**
 * Structured Logger
 * TASK-OBS-001 - Observability Stack
 *
 * Provides JSON-formatted structured logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Correlation IDs for request tracking
 * - Contextual metadata (component, operation, user)
 * - Child loggers with inherited context
 */
/**
 * Log levels
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}
/**
 * Log level names for display
 */
export declare const LogLevelNames: Record<LogLevel, string>;
/**
 * Parse log level from string
 */
export declare function parseLogLevel(level: string): LogLevel;
/**
 * Log context with optional fields
 */
export interface LogContext {
    component?: string;
    operation?: string;
    trace_id?: string;
    span_id?: string;
    user_id?: string;
    request_id?: string;
    duration_ms?: number;
    [key: string]: unknown;
}
/**
 * Log entry structure
 */
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context: LogContext;
}
/**
 * Log output handler interface
 */
export interface LogHandler {
    write(entry: LogEntry): void;
}
/**
 * Console log handler (writes to stdout/stderr)
 */
export declare class ConsoleLogHandler implements LogHandler {
    private useStderr;
    constructor(options?: {
        useStderr?: boolean;
    });
    write(entry: LogEntry): void;
}
/**
 * In-memory log handler (for testing)
 */
export declare class MemoryLogHandler implements LogHandler {
    entries: LogEntry[];
    private maxEntries;
    constructor(options?: {
        maxEntries?: number;
    });
    write(entry: LogEntry): void;
    clear(): void;
    getEntries(): LogEntry[];
    getEntriesByLevel(level: string): LogEntry[];
    getEntriesByComponent(component: string): LogEntry[];
    getEntriesByTraceId(traceId: string): LogEntry[];
}
/**
 * Silent log handler (discards all logs)
 */
export declare class SilentLogHandler implements LogHandler {
    write(_entry: LogEntry): void;
}
/**
 * Structured logger with JSON output
 */
export declare class StructuredLogger {
    private minLevel;
    private context;
    private handlers;
    constructor(options?: {
        minLevel?: LogLevel;
        context?: LogContext;
        handlers?: LogHandler[];
    });
    /**
     * Internal log method
     */
    private log;
    /**
     * Log at DEBUG level
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Log at INFO level
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log at WARN level
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log at ERROR level
     */
    error(message: string, error?: Error | unknown, context?: LogContext): void;
    /**
     * Log at FATAL level
     */
    fatal(message: string, error?: Error | unknown, context?: LogContext): void;
    /**
     * Create a child logger with additional context
     */
    child(additionalContext: LogContext): StructuredLogger;
    /**
     * Set minimum log level
     */
    setLevel(level: LogLevel): void;
    /**
     * Get current log level
     */
    getLevel(): LogLevel;
    /**
     * Add a log handler
     */
    addHandler(handler: LogHandler): void;
    /**
     * Remove all handlers
     */
    clearHandlers(): void;
    /**
     * Set handlers (replaces existing)
     */
    setHandlers(handlers: LogHandler[]): void;
    /**
     * Get current context
     */
    getContext(): LogContext;
    /**
     * Update context (merges with existing)
     */
    updateContext(additionalContext: LogContext): void;
    /**
     * Measure and log execution time
     */
    time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
    /**
     * Synchronous time measurement
     */
    timeSync<T>(operation: string, fn: () => T, context?: LogContext): T;
}
/**
 * Global logger instance
 */
export declare const logger: StructuredLogger;
/**
 * Create a component-scoped logger
 */
export declare function createComponentLogger(component: string, options?: {
    minLevel?: LogLevel;
    handlers?: LogHandler[];
}): StructuredLogger;
/**
 * Generate a unique request ID
 */
export declare function generateRequestId(): string;
/**
 * Generate a unique correlation ID
 */
export declare function generateCorrelationId(): string;
//# sourceMappingURL=logger.d.ts.map