/**
 * Database types for God Agent Memory Visualization
 *
 * This module defines types for raw SQLite database rows and their
 * parsed/hydrated counterparts for application use.
 *
 * @module types/database
 */

// ============================================================================
// Raw Database Row Types (matching SQLite schema)
// ============================================================================

/**
 * Raw event row from the events table (actual events.db schema)
 */
export interface EventRow {
  /** TEXT primary key (e.g., 'evt_1768486051421_7fyfz7') */
  id: string;
  /** Unix timestamp in milliseconds when event occurred */
  timestamp: number;
  /** Event component (e.g., 'pipeline', 'memory', 'learning') */
  component: string;
  /** Event operation (e.g., 'step_started', 'memory_stored') */
  operation: string;
  /** Event status (e.g., 'running', 'success') */
  status: string;
  /** Duration in milliseconds, if applicable */
  duration_ms: number | null;
  /** JSON-encoded metadata with pipelineId, stepId, sessionId, etc. */
  metadata: string;
  /** Trace ID for distributed tracing */
  trace_id: string | null;
  /** Span ID for distributed tracing */
  span_id: string | null;
  /** Unix timestamp in milliseconds when row was created */
  created_at: number;
}

/**
 * Raw memory entry row from the memory table
 */
export interface MemoryEntryRow {
  /** Auto-incremented primary key */
  id: number;
  /** Unique memory key (e.g., 'project/api/users') */
  key: string;
  /** JSON-encoded stored value */
  value: string;
  /** Namespace for grouping related entries */
  namespace: string;
  /** JSON-encoded metadata, if any */
  metadata: string | null;
  /** Binary vector embedding for semantic search */
  embedding: Uint8Array | null;
  /** ISO timestamp when entry was created */
  created_at: string;
  /** ISO timestamp when entry was last updated */
  updated_at: string;
  /** ISO timestamp when entry was last accessed */
  accessed_at: string;
  /** Number of times entry has been accessed */
  access_count: number;
}

/**
 * Raw session row from the sessions table
 */
export interface SessionRow {
  /** UUID session identifier */
  id: string;
  /** ISO timestamp when session started */
  started_at: string;
  /** ISO timestamp when session ended, null if active */
  ended_at: string | null;
  /** Number of agents spawned in this session */
  agent_count: number;
  /** Total events recorded in this session */
  event_count: number;
}

// ============================================================================
// Event Type Definitions
// ============================================================================

/**
 * All supported event types in the God Agent system
 */
export type EventType =
  | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'agent_spawn'
  | 'agent_terminate'
  | 'memory_store'
  | 'memory_retrieve'
  | 'memory_delete'
  | 'session_start'
  | 'session_end'
  | 'trajectory_start'
  | 'trajectory_step'
  | 'trajectory_end'
  | 'pattern_match'
  | 'learning_update'
  | 'custom';

/**
 * Event data payload structure
 */
export interface EventData {
  /** Arbitrary key-value pairs */
  [key: string]: unknown;
  /** Human-readable event description */
  description?: string;
  /** Result of the operation, if applicable */
  result?: unknown;
  /** Error message if operation failed */
  error?: string;
  /** Numeric metrics associated with the event */
  metrics?: Record<string, number>;
}

/**
 * Memory entry metadata structure
 */
export interface MemoryMetadata {
  /** Origin/creator of the memory entry */
  source?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Priority level (higher = more important) */
  priority?: number;
  /** Additional arbitrary metadata */
  [key: string]: unknown;
}

// ============================================================================
// Parsed/Hydrated Types (for application use)
// ============================================================================

/**
 * Parsed God Agent event with typed fields
 */
export interface GodAgentEvent {
  /** Unique event identifier (string in actual events.db schema) */
  id: number | string;
  /** Typed event type */
  eventType: EventType;
  /** When the event occurred */
  timestamp: Date;
  /** Associated session, if any */
  sessionId: string | null;
  /** Associated agent, if any */
  agentId: string | null;
  /** Parsed event payload */
  data: EventData;
  /** When the record was created */
  createdAt: Date;
}

/**
 * Parsed memory entry with typed fields
 */
export interface MemoryEntry {
  /** Unique entry identifier */
  id: number;
  /** Memory key path */
  key: string;
  /** Parsed stored value */
  value: unknown;
  /** Namespace for grouping */
  namespace: string;
  /** Parsed metadata */
  metadata: MemoryMetadata | null;
  /** Whether this entry has a vector embedding */
  hasEmbedding: boolean;
  /** When entry was created */
  createdAt: Date;
  /** When entry was last modified */
  updatedAt: Date;
  /** When entry was last accessed */
  accessedAt: Date;
  /** Total access count */
  accessCount: number;
}

/**
 * Parsed session with typed fields and computed duration
 */
export interface Session {
  /** UUID session identifier */
  id: string;
  /** When session started */
  startedAt: Date;
  /** When session ended, null if still active */
  endedAt: Date | null;
  /** Number of agents in this session */
  agentCount: number;
  /** Number of events in this session */
  eventCount: number;
  /** Session duration in milliseconds, null if still active */
  duration: number | null;
}

// ============================================================================
// Query Options and Filters
// ============================================================================

/**
 * Generic query options for pagination and ordering
 */
export interface QueryOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Column to order by */
  orderBy?: string;
  /** Sort direction */
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Filter options for event queries
 */
export interface EventQueryFilters {
  /** Filter by specific event types */
  eventTypes?: EventType[];
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter events after this date */
  startDate?: Date;
  /** Filter events before this date */
  endDate?: Date;
  /** Full-text search in event data */
  searchText?: string;
}

/**
 * Filter options for memory queries
 */
export interface MemoryQueryFilters {
  /** Filter by namespaces */
  namespaces?: string[];
  /** Filter by key pattern (supports wildcards) */
  keyPattern?: string;
  /** Filter by embedding presence */
  hasEmbedding?: boolean;
  /** Filter by minimum access count */
  minAccessCount?: number;
  /** Full-text search in key and value */
  searchText?: string;
}

// ============================================================================
// Database Statistics
// ============================================================================

/**
 * Aggregated database statistics
 */
export interface DatabaseStats {
  /** Total number of events */
  totalEvents: number;
  /** Total number of memory entries */
  totalMemoryEntries: number;
  /** Total number of sessions */
  totalSessions: number;
  /** Event counts grouped by type */
  eventsByType: Record<EventType, number>;
  /** Memory entries grouped by namespace */
  memoriesByNamespace: Record<string, number>;
  /** Earliest event timestamp */
  oldestEvent: Date | null;
  /** Latest event timestamp */
  newestEvent: Date | null;
}
