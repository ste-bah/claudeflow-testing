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
 * Raw event row type for query results
 * Uses Record to satisfy DatabaseService.query constraints
 */
interface RawEventRow extends Record<string, unknown> {
  id: number;
  event_type: string;
  timestamp: string;
  session_id: string | null;
  agent_id: string | null;
  data: string;
  created_at: string;
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
 * Transform a raw database row into a typed GodAgentEvent
 * @param row - Raw event row from database
 * @returns Parsed and typed event object
 */
export function transformEvent(row: RawEventRow): GodAgentEvent {
  return {
    id: row.id,
    eventType: row.event_type as EventType,
    timestamp: new Date(row.timestamp),
    sessionId: row.session_id,
    agentId: row.agent_id,
    data: safeParseJSON<EventData>(row.data, {}),
    createdAt: new Date(row.created_at),
  };
}

// ============================================================================
// Query Builder Functions
// ============================================================================

/**
 * Build WHERE clause from filter options
 * @param filters - Query filters
 * @returns Object with clause string and parameter values
 */
export function buildWhereClause(filters: EventQueryFilters): {
  clause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const placeholders = filters.eventTypes.map(() => '?').join(', ');
    conditions.push(`event_type IN (${placeholders})`);
    params.push(...filters.eventTypes);
  }

  if (filters.sessionId) {
    conditions.push('session_id = ?');
    params.push(filters.sessionId);
  }

  if (filters.agentId) {
    conditions.push('agent_id = ?');
    params.push(filters.agentId);
  }

  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    params.push(filters.startDate.toISOString());
  }

  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    params.push(filters.endDate.toISOString());
  }

  if (filters.searchText) {
    conditions.push('(data LIKE ? OR event_type LIKE ?)');
    const searchPattern = `%${filters.searchText}%`;
    params.push(searchPattern, searchPattern);
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

  // Whitelist of allowed columns to prevent SQL injection
  const allowedColumns = ['id', 'event_type', 'timestamp', 'session_id', 'agent_id', 'created_at'];

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

  const sql = `
    SELECT id, event_type, timestamp, session_id, agent_id, data, created_at
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
 * @param id - Event ID
 * @returns Event or null if not found
 */
export function getEventById(id: number): GodAgentEvent | null {
  const db = getDatabaseService();
  const sql = `
    SELECT id, event_type, timestamp, session_id, agent_id, data, created_at
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
 * @param filters - Optional filter criteria
 * @returns Array of event type counts
 */
export function getEventsByType(filters: EventQueryFilters = {}): EventTypeCount[] {
  const db = getDatabaseService();
  const where = buildWhereClause(filters);

  const sql = `
    SELECT event_type, COUNT(*) as count
    FROM events
    ${where.clause}
    GROUP BY event_type
    ORDER BY count DESC
  `;

  const result = db.query<{ event_type: string; count: number }>(sql, where.params);

  return result.rows.map((row) => ({
    eventType: row.event_type as EventType,
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
 * @returns Array of unique session IDs
 */
export function getUniqueSessions(): string[] {
  const db = getDatabaseService();
  const sql = `
    SELECT DISTINCT session_id
    FROM events
    WHERE session_id IS NOT NULL
    ORDER BY session_id
  `;

  const result = db.query<{ session_id: string }>(sql);
  return result.rows.map((row) => row.session_id);
}

/**
 * Get all unique agent IDs from events
 * @returns Array of unique agent IDs
 */
export function getUniqueAgents(): string[] {
  const db = getDatabaseService();
  const sql = `
    SELECT DISTINCT agent_id
    FROM events
    WHERE agent_id IS NOT NULL
    ORDER BY agent_id
  `;

  const result = db.query<{ agent_id: string }>(sql);
  return result.rows.map((row) => row.agent_id);
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

  const result = db.queryOne<{ earliest: string | null; latest: string | null }>(sql);

  return {
    earliest: result?.earliest ? new Date(result.earliest) : null,
    latest: result?.latest ? new Date(result.latest) : null,
  };
}

/**
 * Get event timeline bucketed by time intervals
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

  // Convert bucketSize from milliseconds to seconds for SQLite
  const bucketSizeSeconds = Math.floor(bucketSize / 1000);

  // SQLite doesn't have native timestamp bucketing, so we use strftime
  // to convert to unix timestamp, divide by bucket size, and group
  const sql = `
    SELECT
      (CAST(strftime('%s', timestamp) AS INTEGER) / ?) * ? as bucket_start,
      event_type,
      COUNT(*) as count
    FROM events
    ${where.clause}
    GROUP BY bucket_start, event_type
    ORDER BY bucket_start ASC
  `;

  const params = [bucketSizeSeconds, bucketSizeSeconds, ...where.params];
  const result = db.query<{ bucket_start: number; event_type: string; count: number }>(sql, params);

  // Aggregate results into buckets
  const bucketMap = new Map<number, TimelineBucket>();

  for (const row of result.rows) {
    const bucketStart = row.bucket_start * 1000; // Convert back to milliseconds

    if (!bucketMap.has(bucketStart)) {
      bucketMap.set(bucketStart, {
        timestamp: new Date(bucketStart),
        count: 0,
        eventTypes: {},
      });
    }

    const bucket = bucketMap.get(bucketStart)!;
    bucket.count += row.count;
    bucket.eventTypes[row.event_type] = (bucket.eventTypes[row.event_type] || 0) + row.count;
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
