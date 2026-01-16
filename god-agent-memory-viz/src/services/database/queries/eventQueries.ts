/**
 * Event query functions for God Agent Memory Visualization
 *
 * Provides comprehensive query functions for the events table with
 * filtering, pagination, aggregation, and timeline analysis.
 *
 * @module services/database/queries/eventQueries
 */

import { getDatabaseService } from '../DatabaseService';
import { safeParseJSON } from '@/utils/validation';
import type {
  GodAgentEvent,
  EventType,
  EventData,
  EventQueryFilters,
  QueryOptions,
} from '@/types/database';

/**
 * Raw event row type for query results matching ACTUAL events.db schema
 * Uses Record to satisfy DatabaseService.query constraints
 */
interface RawEventRow extends Record<string, unknown> {
  id: string;                    // TEXT not number
  timestamp: number;             // INTEGER (Unix ms)
  component: string;             // 'pipeline', 'memory', 'learning', etc.
  operation: string;             // 'step_started', 'memory_stored', etc.
  status: string;
  duration_ms: number | null;
  metadata: string;              // JSON with pipelineId, stepId, sessionId, etc.
  trace_id: string | null;
  span_id: string | null;
  created_at: number;            // INTEGER (Unix ms)
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Event type count aggregation result
 */
export interface EventTypeCount {
  eventType: EventType;
  count: number;
}

/**
 * Timeline bucket for event aggregation
 */
export interface TimelineBucket {
  timestamp: Date;
  count: number;
  eventTypes: Record<string, number>;
}

/**
 * Date range result
 */
export interface DateRange {
  earliest: Date | null;
  latest: Date | null;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Map component+operation from actual schema to EventType
 * @param component - Event component (e.g., 'pipeline', 'memory', 'learning')
 * @param operation - Event operation (e.g., 'step_started', 'memory_stored')
 * @returns Mapped EventType
 */
function mapToEventType(component: string, operation: string): EventType {
  const key = `${component}:${operation}`;
  const mapping: Record<string, EventType> = {
    // Pipeline events
    'pipeline:step_started': 'task_start',
    'pipeline:step_completed': 'task_complete',
    'pipeline:step_failed': 'task_error',
    'pipeline:pipeline_started': 'session_start',
    'pipeline:pipeline_completed': 'session_end',
    // Memory events
    'memory:memory_stored': 'memory_store',
    'memory:memory_retrieved': 'memory_retrieve',
    'memory:memory_deleted': 'memory_delete',
    // Learning events
    'learning:learning_feedback': 'learning_update',
    'learning:pattern_matched': 'pattern_match',
    // Agent events
    'agent:agent_spawned': 'agent_spawn',
    'agent:agent_terminated': 'agent_terminate',
    // Session events
    'session:session_started': 'session_start',
    'session:session_ended': 'session_end',
    // Trajectory events
    'trajectory:trajectory_started': 'trajectory_start',
    'trajectory:trajectory_step': 'trajectory_step',
    'trajectory:trajectory_ended': 'trajectory_end',
  };
  return mapping[key] ?? 'custom';
}

/**
 * Transform a raw database row into a typed GodAgentEvent
 * Maps from actual events.db schema to application types
 * @param row - Raw event row from database
 * @returns Parsed and typed event object
 */
export function transformEvent(row: RawEventRow): GodAgentEvent {
  const metadata = safeParseJSON<Record<string, unknown>>(row.metadata, {});

  // Map component+operation to EventType
  const eventType = mapToEventType(row.component, row.operation);

  // Extract sessionId and agentId from metadata
  const sessionId = (metadata.sessionId as string) ?? (metadata.pipelineId as string) ?? null;
  const agentId = (metadata.agentId as string) ?? (metadata.stepName as string) ?? null;

  // Enrich the data with component info
  const data: EventData = {
    ...metadata,
    component: row.component,
    operation: row.operation,
    status: row.status,
    duration_ms: row.duration_ms,
    trace_id: row.trace_id,
    span_id: row.span_id,
  };

  return {
    id: row.id as unknown as number,  // Keep compatibility with existing interface (string ID treated as number)
    eventType,
    timestamp: new Date(row.timestamp),              // Unix ms to Date
    sessionId,
    agentId,
    data,
    createdAt: new Date(row.created_at),
  };
}

// ============================================================================
// Query Builder Functions
// ============================================================================

/**
 * Map EventType back to component+operation for SQL filtering
 * Returns array of [component, operation] pairs
 */
function eventTypeToComponentOperation(eventType: EventType): [string, string][] {
  const reverseMapping: Record<EventType, [string, string][]> = {
    'task_start': [['pipeline', 'step_started']],
    'task_complete': [['pipeline', 'step_completed']],
    'task_error': [['pipeline', 'step_failed']],
    'memory_store': [['memory', 'memory_stored']],
    'memory_retrieve': [['memory', 'memory_retrieved']],
    'memory_delete': [['memory', 'memory_deleted']],
    'learning_update': [['learning', 'learning_feedback']],
    'pattern_match': [['learning', 'pattern_matched']],
    'agent_spawn': [['agent', 'agent_spawned']],
    'agent_terminate': [['agent', 'agent_terminated']],
    'session_start': [['session', 'session_started'], ['pipeline', 'pipeline_started']],
    'session_end': [['session', 'session_ended'], ['pipeline', 'pipeline_completed']],
    'trajectory_start': [['trajectory', 'trajectory_started']],
    'trajectory_step': [['trajectory', 'trajectory_step']],
    'trajectory_end': [['trajectory', 'trajectory_ended']],
    'custom': [],  // Custom events can't be reverse-mapped
  };
  return reverseMapping[eventType] ?? [];
}

/**
 * Build WHERE clause from filter options
 * Maps application filter types to actual database columns
 * @param filters - Query filters
 * @returns Object with clause string and parameter values
 */
export function buildWhereClause(filters: EventQueryFilters): {
  clause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Map eventTypes filter to component+operation pairs
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const componentOpPairs: [string, string][] = [];
    for (const eventType of filters.eventTypes) {
      componentOpPairs.push(...eventTypeToComponentOperation(eventType));
    }

    if (componentOpPairs.length > 0) {
      const pairConditions = componentOpPairs.map(() => '(component = ? AND operation = ?)').join(' OR ');
      conditions.push(`(${pairConditions})`);
      for (const [comp, op] of componentOpPairs) {
        params.push(comp, op);
      }
    }
  }

  // sessionId is stored in metadata JSON, use JSON_EXTRACT for SQLite
  if (filters.sessionId) {
    conditions.push("(JSON_EXTRACT(metadata, '$.sessionId') = ? OR JSON_EXTRACT(metadata, '$.pipelineId') = ?)");
    params.push(filters.sessionId, filters.sessionId);
  }

  // agentId is stored in metadata JSON
  if (filters.agentId) {
    conditions.push("(JSON_EXTRACT(metadata, '$.agentId') = ? OR JSON_EXTRACT(metadata, '$.stepName') = ?)");
    params.push(filters.agentId, filters.agentId);
  }

  // timestamp is now INTEGER (Unix ms), not ISO string
  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    params.push(filters.startDate.getTime());
  }

  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    params.push(filters.endDate.getTime());
  }

  // Search in metadata JSON and component/operation columns
  if (filters.searchText) {
    conditions.push('(metadata LIKE ? OR component LIKE ? OR operation LIKE ?)');
    const searchPattern = `%${filters.searchText}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Build ORDER BY clause from query options
 * @param options - Query options
 * @returns ORDER BY clause string
 */
export function buildOrderClause(options: QueryOptions): string {
  const column = options.orderBy || 'timestamp';
  const direction = options.orderDirection || 'DESC';

  // Whitelist of allowed columns to prevent SQL injection (matching actual schema)
  const allowedColumns = ['id', 'timestamp', 'component', 'operation', 'status', 'duration_ms', 'created_at'];

  if (!allowedColumns.includes(column)) {
    return 'ORDER BY timestamp DESC';
  }

  return `ORDER BY ${column} ${direction}`;
}

/**
 * Build LIMIT/OFFSET clause from query options
 * @param options - Query options
 * @returns Object with clause string and parameter values
 */
export function buildLimitClause(options: QueryOptions): {
  clause: string;
  params: number[];
} {
  const params: number[] = [];
  let clause = '';

  if (options.limit !== undefined && options.limit > 0) {
    clause = 'LIMIT ?';
    params.push(options.limit);

    if (options.offset !== undefined && options.offset > 0) {
      clause += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  return { clause, params };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get events with filtering and pagination
 * @param filters - Optional filter criteria
 * @param options - Optional pagination and ordering options
 * @returns Array of parsed events
 */
export function getEvents(
  filters: EventQueryFilters = {},
  options: QueryOptions = {}
): GodAgentEvent[] {
  const db = getDatabaseService();
  const where = buildWhereClause(filters);
  const order = buildOrderClause(options);
  const limit = buildLimitClause(options);

  // Select columns matching actual events.db schema
  const sql = `
    SELECT id, timestamp, component, operation, status, duration_ms, metadata, trace_id, span_id, created_at
    FROM events
    ${where.clause}
    ${order}
    ${limit.clause}
  `;

  const params = [...where.params, ...limit.params];
  const result = db.query<RawEventRow>(sql, params);

  return result.rows.map(transformEvent);
}

/**
 * Get a single event by ID
 * @param id - Event ID (string in actual schema)
 * @returns Event or null if not found
 */
export function getEventById(id: number | string): GodAgentEvent | null {
  const db = getDatabaseService();
  const sql = `
    SELECT id, timestamp, component, operation, status, duration_ms, metadata, trace_id, span_id, created_at
    FROM events
    WHERE id = ?
  `;

  const row = db.queryOne<RawEventRow>(sql, [id]);
  return row ? transformEvent(row) : null;
}

/**
 * Get total count of events matching filters
 * @param filters - Optional filter criteria
 * @returns Event count
 */
export function getEventCount(filters: EventQueryFilters = {}): number {
  const db = getDatabaseService();
  const where = buildWhereClause(filters);

  const sql = `SELECT COUNT(*) as count FROM events ${where.clause}`;
  const result = db.queryOne<{ count: number }>(sql, where.params);

  return result?.count ?? 0;
}

/**
 * Get events grouped by type with counts
 * Maps component+operation to EventType for aggregation
 * @param filters - Optional filter criteria
 * @returns Array of event type counts
 */
export function getEventsByType(filters: EventQueryFilters = {}): EventTypeCount[] {
  const db = getDatabaseService();
  const where = buildWhereClause(filters);

  // Group by component and operation, then map to EventType
  const sql = `
    SELECT component, operation, COUNT(*) as count
    FROM events
    ${where.clause}
    GROUP BY component, operation
    ORDER BY count DESC
  `;

  const result = db.query<{ component: string; operation: string; count: number }>(sql, where.params);

  return result.rows.map((row) => ({
    eventType: mapToEventType(row.component, row.operation),
    count: row.count,
  }));
}

/**
 * Get event type counts as a record
 * @param filters - Optional filter criteria
 * @returns Record mapping event types to counts
 */
export function getEventTypeCounts(filters: EventQueryFilters = {}): Record<string, number> {
  const typeCounts = getEventsByType(filters);
  return typeCounts.reduce(
    (acc, { eventType, count }) => {
      acc[eventType] = count;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Get all unique session IDs from events
 * Extracts from metadata JSON (sessionId or pipelineId)
 * @returns Array of unique session IDs
 */
export function getUniqueSessions(): string[] {
  const db = getDatabaseService();
  // Extract sessionId and pipelineId from metadata JSON
  const sql = `
    SELECT DISTINCT COALESCE(
      JSON_EXTRACT(metadata, '$.sessionId'),
      JSON_EXTRACT(metadata, '$.pipelineId')
    ) as session_id
    FROM events
    WHERE JSON_EXTRACT(metadata, '$.sessionId') IS NOT NULL
       OR JSON_EXTRACT(metadata, '$.pipelineId') IS NOT NULL
    ORDER BY session_id
  `;

  const result = db.query<{ session_id: string }>(sql);
  return result.rows.map((row) => row.session_id).filter(Boolean);
}

/**
 * Get all unique agent IDs from events
 * Extracts from metadata JSON (agentId or stepName)
 * @returns Array of unique agent IDs
 */
export function getUniqueAgents(): string[] {
  const db = getDatabaseService();
  // Extract agentId and stepName from metadata JSON
  const sql = `
    SELECT DISTINCT COALESCE(
      JSON_EXTRACT(metadata, '$.agentId'),
      JSON_EXTRACT(metadata, '$.stepName')
    ) as agent_id
    FROM events
    WHERE JSON_EXTRACT(metadata, '$.agentId') IS NOT NULL
       OR JSON_EXTRACT(metadata, '$.stepName') IS NOT NULL
    ORDER BY agent_id
  `;

  const result = db.query<{ agent_id: string }>(sql);
  return result.rows.map((row) => row.agent_id).filter(Boolean);
}

/**
 * Get events within a time range
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive)
 * @param options - Optional pagination and ordering options
 * @returns Array of events in the time range
 */
export function getEventsInTimeRange(
  start: Date,
  end: Date,
  options: QueryOptions = {}
): GodAgentEvent[] {
  return getEvents(
    {
      startDate: start,
      endDate: end,
    },
    options
  );
}

/**
 * Get all events for a specific session
 * @param sessionId - Session ID
 * @param options - Optional pagination and ordering options
 * @returns Array of events for the session
 */
export function getEventsForSession(
  sessionId: string,
  options: QueryOptions = {}
): GodAgentEvent[] {
  return getEvents({ sessionId }, options);
}

/**
 * Get all events for a specific agent
 * @param agentId - Agent ID
 * @param options - Optional pagination and ordering options
 * @returns Array of events for the agent
 */
export function getEventsForAgent(
  agentId: string,
  options: QueryOptions = {}
): GodAgentEvent[] {
  return getEvents({ agentId }, options);
}

/**
 * Get the date range of all events
 * timestamp is INTEGER (Unix ms) in actual schema
 * @returns Object with earliest and latest event timestamps
 */
export function getEventDateRange(): DateRange {
  const db = getDatabaseService();
  const sql = `
    SELECT
      MIN(timestamp) as earliest,
      MAX(timestamp) as latest
    FROM events
  `;

  const result = db.queryOne<{ earliest: number | null; latest: number | null }>(sql);

  return {
    earliest: result?.earliest ? new Date(result.earliest) : null,
    latest: result?.latest ? new Date(result.latest) : null,
  };
}

/**
 * Get event timeline bucketed by time intervals
 * timestamp is INTEGER (Unix ms) in actual schema
 * @param bucketSize - Size of each bucket in milliseconds
 * @param filters - Optional filter criteria
 * @returns Array of timeline buckets with counts
 */
export function getEventTimeline(
  bucketSize: number,
  filters: EventQueryFilters = {}
): TimelineBucket[] {
  const db = getDatabaseService();
  const where = buildWhereClause(filters);

  // timestamp is already Unix ms, so we divide directly by bucketSize
  // No need to convert from ISO string
  const sql = `
    SELECT
      (timestamp / ?) * ? as bucket_start,
      component,
      operation,
      COUNT(*) as count
    FROM events
    ${where.clause}
    GROUP BY bucket_start, component, operation
    ORDER BY bucket_start ASC
  `;

  const params = [bucketSize, bucketSize, ...where.params];
  const result = db.query<{ bucket_start: number; component: string; operation: string; count: number }>(sql, params);

  // Aggregate results into buckets
  const bucketMap = new Map<number, TimelineBucket>();

  for (const row of result.rows) {
    const bucketStart = row.bucket_start;  // Already in milliseconds

    if (!bucketMap.has(bucketStart)) {
      bucketMap.set(bucketStart, {
        timestamp: new Date(bucketStart),
        count: 0,
        eventTypes: {},
      });
    }

    const bucket = bucketMap.get(bucketStart)!;
    bucket.count += row.count;

    // Map component+operation to EventType for the bucket
    const eventType = mapToEventType(row.component, row.operation);
    bucket.eventTypes[eventType] = (bucket.eventTypes[eventType] || 0) + row.count;
  }

  return Array.from(bucketMap.values());
}

/**
 * Search events by text in data field
 * @param searchText - Text to search for
 * @param options - Optional pagination and ordering options
 * @returns Array of matching events
 */
export function searchEvents(
  searchText: string,
  options: QueryOptions = {}
): GodAgentEvent[] {
  return getEvents({ searchText }, options);
}
