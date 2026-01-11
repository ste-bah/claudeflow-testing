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
// ==================== Types ====================
/**
 * Log levels
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (LogLevel = {}));
/**
 * Log level names for display
 */
export const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
};
/**
 * Parse log level from string
 */
export function parseLogLevel(level) {
    const normalized = level.toUpperCase();
    switch (normalized) {
        case 'DEBUG':
            return LogLevel.DEBUG;
        case 'INFO':
            return LogLevel.INFO;
        case 'WARN':
        case 'WARNING':
            return LogLevel.WARN;
        case 'ERROR':
            return LogLevel.ERROR;
        case 'FATAL':
        case 'CRITICAL':
            return LogLevel.FATAL;
        default:
            return LogLevel.INFO;
    }
}
// ==================== Default Handlers ====================
/**
 * Console log handler (writes to stdout/stderr)
 */
export class ConsoleLogHandler {
    useStderr;
    constructor(options = {}) {
        this.useStderr = options.useStderr ?? false;
    }
    write(entry) {
        const output = JSON.stringify(entry);
        if (this.useStderr && (entry.level === 'ERROR' || entry.level === 'FATAL')) {
            console.error(output);
        }
        else {
            console.log(output);
        }
    }
}
/**
 * In-memory log handler (for testing)
 */
export class MemoryLogHandler {
    entries = [];
    maxEntries;
    constructor(options = {}) {
        this.maxEntries = options.maxEntries ?? 10000;
    }
    write(entry) {
        this.entries.push(entry);
        // Trim if over max
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
    }
    clear() {
        this.entries = [];
    }
    getEntries() {
        return [...this.entries];
    }
    getEntriesByLevel(level) {
        return this.entries.filter(e => e.level === level);
    }
    getEntriesByComponent(component) {
        return this.entries.filter(e => e.context.component === component);
    }
    getEntriesByTraceId(traceId) {
        return this.entries.filter(e => e.context.trace_id === traceId);
    }
}
/**
 * Silent log handler (discards all logs)
 */
export class SilentLogHandler {
    write(_entry) {
        // Intentionally empty - discards all logs
    }
}
// ==================== Structured Logger ====================
/**
 * Structured logger with JSON output
 */
export class StructuredLogger {
    minLevel;
    context;
    handlers;
    constructor(options = {}) {
        this.minLevel = options.minLevel ?? LogLevel.INFO;
        this.context = options.context ?? {};
        this.handlers = options.handlers ?? [new ConsoleLogHandler()];
    }
    /**
     * Internal log method
     */
    log(level, message, additionalContext) {
        if (level < this.minLevel)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevelNames[level],
            message,
            context: { ...this.context, ...additionalContext },
        };
        // Write to all handlers
        for (const handler of this.handlers) {
            try {
                handler.write(entry);
            }
            catch (error) {
                // Don't let logging errors crash the application
                console.error('Logging error:', error);
            }
        }
    }
    /**
     * Log at DEBUG level
     */
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    /**
     * Log at INFO level
     */
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    /**
     * Log at WARN level
     */
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    /**
     * Log at ERROR level
     */
    error(message, error, context) {
        const errorContext = { ...context };
        if (error instanceof Error) {
            errorContext.error_message = error.message;
            errorContext.error_name = error.name;
            errorContext.error_stack = error.stack;
        }
        else if (error !== undefined) {
            errorContext.error_message = String(error);
        }
        this.log(LogLevel.ERROR, message, errorContext);
    }
    /**
     * Log at FATAL level
     */
    fatal(message, error, context) {
        const errorContext = { ...context };
        if (error instanceof Error) {
            errorContext.error_message = error.message;
            errorContext.error_name = error.name;
            errorContext.error_stack = error.stack;
        }
        else if (error !== undefined) {
            errorContext.error_message = String(error);
        }
        this.log(LogLevel.FATAL, message, errorContext);
    }
    /**
     * Create a child logger with additional context
     */
    child(additionalContext) {
        return new StructuredLogger({
            minLevel: this.minLevel,
            context: { ...this.context, ...additionalContext },
            handlers: this.handlers,
        });
    }
    /**
     * Set minimum log level
     */
    setLevel(level) {
        this.minLevel = level;
    }
    /**
     * Get current log level
     */
    getLevel() {
        return this.minLevel;
    }
    /**
     * Add a log handler
     */
    addHandler(handler) {
        this.handlers.push(handler);
    }
    /**
     * Remove all handlers
     */
    clearHandlers() {
        this.handlers = [];
    }
    /**
     * Set handlers (replaces existing)
     */
    setHandlers(handlers) {
        this.handlers = handlers;
    }
    /**
     * Get current context
     */
    getContext() {
        return { ...this.context };
    }
    /**
     * Update context (merges with existing)
     */
    updateContext(additionalContext) {
        this.context = { ...this.context, ...additionalContext };
    }
    /**
     * Measure and log execution time
     */
    async time(operation, fn, context) {
        const startTime = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - startTime;
            this.info(`${operation} completed`, {
                ...context,
                operation,
                duration_ms: duration,
                status: 'success',
            });
            return result;
        }
        catch (error) {
            const duration = performance.now() - startTime;
            this.error(`${operation} failed`, error, {
                ...context,
                operation,
                duration_ms: duration,
                status: 'error',
            });
            // INTENTIONAL: transparent rethrow - timing wrapper should not modify errors
            throw error;
        }
    }
    /**
     * Synchronous time measurement
     */
    timeSync(operation, fn, context) {
        const startTime = performance.now();
        try {
            const result = fn();
            const duration = performance.now() - startTime;
            this.info(`${operation} completed`, {
                ...context,
                operation,
                duration_ms: duration,
                status: 'success',
            });
            return result;
        }
        catch (error) {
            const duration = performance.now() - startTime;
            this.error(`${operation} failed`, error, {
                ...context,
                operation,
                duration_ms: duration,
                status: 'error',
            });
            // INTENTIONAL: transparent rethrow - timing wrapper should not modify errors
            throw error;
        }
    }
}
// ==================== Global Instance ====================
/**
 * Global logger instance
 */
export const logger = new StructuredLogger({
    minLevel: LogLevel.INFO,
    handlers: [new SilentLogHandler()], // Silent by default in library code
});
// ==================== Utility Functions ====================
/**
 * Create a component-scoped logger
 */
export function createComponentLogger(component, options) {
    return new StructuredLogger({
        minLevel: options?.minLevel ?? LogLevel.INFO,
        context: { component },
        handlers: options?.handlers ?? [new SilentLogHandler()],
    });
}
/**
 * Generate a unique request ID
 */
export function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId() {
    return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
//# sourceMappingURL=logger.js.map