/**
 * Raw database types for sql.js queries
 *
 * These types represent the raw rows returned from SQLite queries
 * before any parsing or transformation.
 *
 * @module services/database/types
 */

/**
 * Raw event row from the events table
 */
export interface RawEventRow {
  /** Auto-incremented primary key */
  id: number;
  /** Type of event (e.g., 'task_start', 'memory_store') */
  event_type: string;
  /** ISO timestamp when event occurred */
  timestamp: string;
  /** Associated session ID, if any */
  session_id: string | null;
  /** Associated agent ID, if any */
  agent_id: string | null;
  /** JSON-encoded event payload */
  data: string;
  /** ISO timestamp when row was created */
  created_at: string;
}

/**
 * Raw memory entry row from the memory_entries table
 */
export interface RawMemoryEntryRow {
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
export interface RawSessionRow {
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

/**
 * Database connection state
 */
export type ConnectionState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed';

/**
 * Connection information for the database
 */
export interface ConnectionInfo {
  /** Current connection state */
  state: ConnectionState;
  /** Name of the loaded database file */
  fileName: string | null;
  /** Size of the database in bytes */
  fileSize: number;
  /** Timestamp when database was loaded */
  loadedAt: Date | null;
  /** Error message if state is 'error' */
  error: string | null;
}

/**
 * Aggregated database statistics
 */
export interface DatabaseStats {
  /** Total number of events */
  eventCount: number;
  /** Total number of memory entries */
  memoryEntryCount: number;
  /** Total number of sessions */
  sessionCount: number;
  /** Number of unique agents */
  uniqueAgents: number;
  /** Number of unique namespaces */
  uniqueNamespaces: number;
  /** Date range of events */
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  /** Size of the database file in bytes */
  fileSize: number;
}

/**
 * Result of a database query execution
 */
export interface QueryResult<T = unknown> {
  /** Array of result rows */
  rows: T[];
  /** Number of rows returned */
  rowCount: number;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Schema validation result
 */
export interface SchemaValidation {
  /** Whether the schema is valid */
  isValid: boolean;
  /** Array of missing required tables */
  missingTables: string[];
  /** Array of tables that exist */
  foundTables: string[];
  /** Detailed error message if invalid */
  error: string | null;
}

/**
 * Listener callback for connection state changes
 */
export type ConnectionStateListener = (info: ConnectionInfo) => void;
