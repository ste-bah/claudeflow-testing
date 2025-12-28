/**
 * Observability System Types
 *
 * Shared type definitions for the God Agent Observability System.
 *
 * @module observability/types
 * @see SPEC-OBS-001-CORE.md#data_models
 * @see constitution.md#event_schema
 */
// =============================================================================
// Constants
// =============================================================================
/**
 * Buffer size limits per RULE-OBS-004
 */
export const BUFFER_LIMITS = {
    /** ActivityStream buffer max size */
    ACTIVITY_STREAM: 1000,
    /** RoutingHistory buffer max size */
    ROUTING_HISTORY: 100,
    /** EventStore buffer max size */
    EVENT_STORE: 10000,
    /** ObservabilityBus queue max size */
    BUS_QUEUE: 100,
};
/**
 * Default daemon configuration
 */
export const DEFAULT_DAEMON_CONFIG = {
    port: 3847,
    host: 'localhost',
    socketPath: '/tmp/god-agent.sock',
    dbPath: '.god-agent/events.db',
    maxEvents: BUFFER_LIMITS.EVENT_STORE,
    eventRetentionHours: 24,
    verbose: false,
};
/**
 * Performance budgets per constitution.md
 */
export const PERFORMANCE_BUDGETS = {
    /** Max time for event emit */
    EVENT_EMIT_MS: 1,
    /** Max time for socket send */
    SOCKET_SEND_MS: 0.5,
    /** Max time for buffer insert */
    BUFFER_INSERT_MS: 0.1,
    /** Max time for SSE broadcast */
    SSE_BROADCAST_MS: 1,
    /** Max time for SQLite write (async) */
    SQLITE_WRITE_MS: 5,
    /** Max API response time p95 */
    API_RESPONSE_MS: 100,
    /** Max dashboard load time */
    DASHBOARD_LOAD_MS: 1000,
    /** Max daemon startup time */
    DAEMON_STARTUP_MS: 2000,
    /** Max God Agent overhead */
    OVERHEAD_PERCENT: 5,
};
//# sourceMappingURL=types.js.map