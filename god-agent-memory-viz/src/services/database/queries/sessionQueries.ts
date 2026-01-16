/**
 * Session query functions for God Agent Memory Visualization
 *
 * Provides comprehensive query functions for sessions with support for
 * both dedicated sessions table and deriving sessions from events.
 *
 * @module services/database/queries/sessionQueries
 */

import { getDatabaseService } from '../DatabaseService';
import type { Session, QueryOptions } from '@/types/database';

/**
 * Raw session row type for query results from sessions table
 * Uses Record to satisfy DatabaseService.query constraints
 */
interface RawSessionRow extends Record<string, unknown> {
  id: string;
  started_at: string;
  ended_at: string | null;
  agent_count: number;
  event_count: number;
}

/**
 * Raw derived session row type from events table aggregation
 */
interface RawDerivedSessionRow extends Record<string, unknown> {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  agent_count: number;
  event_count: number;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Session query filter options
 */
export interface SessionQueryOptions extends QueryOptions {
  /** Filter sessions that started after this date */
  startDate?: Date;
  /** Filter sessions that started before this date */
  endDate?: Date;
  /** Filter only active (ongoing) sessions */
  activeOnly?: boolean;
}

/**
 * Aggregated session statistics
 */
export interface SessionStats {
  /** Total number of sessions */
  totalSessions: number;
  /** Number of active (ongoing) sessions */
  activeSessions: number;
  /** Total events across all sessions */
  totalEvents: number;
  /** Total unique agents across all sessions */
  totalAgents: number;
  /** Average session duration in milliseconds */
  avgDuration: number | null;
  /** Longest session duration in milliseconds */
  longestDuration: number | null;
  /** Session with most events */
  mostActiveSession: {
    id: string;
    eventCount: number;
  } | null;
}

/**
 * Session timeline entry for aggregation
 */
export interface SessionTimelineEntry {
  date: string;
  count: number;
}

/**
 * Agent in session information
 */
export interface AgentInSession {
  agentId: string;
  eventCount: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform a raw database row into a typed Session
 * @param row - Raw session row from database (from sessions table)
 * @returns Parsed and typed session object
 */
export function transformSession(row: RawSessionRow): Session {
  const startedAt = new Date(row.started_at);
  const endedAt = row.ended_at ? new Date(row.ended_at) : null;

  // Calculate duration if session has ended
  const duration = endedAt ? endedAt.getTime() - startedAt.getTime() : null;

  return {
    id: row.id,
    startedAt,
    endedAt,
    agentCount: row.agent_count ?? 0,
    eventCount: row.event_count ?? 0,
    duration,
  };
}

/**
 * Transform a derived session row (from events aggregation) into a typed Session
 * @param row - Raw derived session row from events aggregation
 * @returns Parsed and typed session object
 */
function transformDerivedSession(row: RawDerivedSessionRow): Session {
  const startedAt = new Date(row.started_at);
  const endedAt = row.ended_at ? new Date(row.ended_at) : null;

  // Calculate duration if session has ended
  const duration = endedAt ? endedAt.getTime() - startedAt.getTime() : null;

  return {
    id: row.session_id,
    startedAt,
    endedAt,
    agentCount: row.agent_count ?? 0,
    eventCount: row.event_count ?? 0,
    duration,
  };
}

// ============================================================================
// Table Detection
// ============================================================================

/**
 * Check if a dedicated sessions table exists with data
 * @returns True if sessions table exists and has data
 */
export function hasSessionsTable(): boolean {
  const db = getDatabaseService();

  try {
    // First check if table exists
    const tableCheck = db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master
       WHERE type='table' AND name='sessions'`
    );

    if (!tableCheck || tableCheck.count === 0) {
      return false;
    }

    // Check if it has any rows
    const rowCheck = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sessions'
    );

    return rowCheck !== null && rowCheck.count > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Query Builder Functions
// ============================================================================

/**
 * Build WHERE clause for session queries
 * @param options - Session query options
 * @returns Object with clause string and parameter values
 */
function buildSessionWhereClause(options: SessionQueryOptions): {
  clause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.startDate) {
    conditions.push('started_at >= ?');
    params.push(options.startDate.toISOString());
  }

  if (options.endDate) {
    conditions.push('started_at <= ?');
    params.push(options.endDate.toISOString());
  }

  if (options.activeOnly) {
    conditions.push('ended_at IS NULL');
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Build ORDER BY clause for session queries
 * @param options - Query options
 * @returns ORDER BY clause string
 */
function buildSessionOrderClause(options: QueryOptions): string {
  const column = options.orderBy || 'started_at';
  const direction = options.orderDirection || 'DESC';

  // Whitelist of allowed columns to prevent SQL injection
  const allowedColumns = ['id', 'started_at', 'ended_at', 'agent_count', 'event_count'];

  if (!allowedColumns.includes(column)) {
    return 'ORDER BY started_at DESC';
  }

  return `ORDER BY ${column} ${direction}`;
}

/**
 * Build LIMIT/OFFSET clause for session queries
 * @param options - Query options
 * @returns Object with clause string and parameter values
 */
function buildSessionLimitClause(options: QueryOptions): {
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
// Query Functions - Primary Interface
// ============================================================================

/**
 * Get sessions with filtering and pagination
 * Automatically uses sessions table if available, otherwise derives from events
 * @param options - Optional query options
 * @returns Array of parsed sessions
 */
export function getSessions(options: SessionQueryOptions = {}): Session[] {
  if (hasSessionsTable()) {
    return getSessionsFromTable(options);
  }
  return deriveSessionsFromEvents(options);
}

/**
 * Get sessions from the dedicated sessions table
 * @param options - Optional query options
 * @returns Array of parsed sessions
 */
export function getSessionsFromTable(options: SessionQueryOptions = {}): Session[] {
  const db = getDatabaseService();
  const where = buildSessionWhereClause(options);
  const order = buildSessionOrderClause(options);
  const limit = buildSessionLimitClause(options);

  const sql = `
    SELECT id, started_at, ended_at, agent_count, event_count
    FROM sessions
    ${where.clause}
    ${order}
    ${limit.clause}
  `;

  const params = [...where.params, ...limit.params];
  const result = db.query<RawSessionRow>(sql, params);

  return result.rows.map(transformSession);
}

/**
 * Derive sessions from events table aggregation
 * Used when no dedicated sessions table exists
 * @param options - Optional query options
 * @returns Array of derived sessions
 */
export function deriveSessionsFromEvents(options: SessionQueryOptions = {}): Session[] {
  const db = getDatabaseService();
  const params: (string | number)[] = [];

  // Build the derived query using events aggregation
  let sql = `
    SELECT
      session_id,
      MIN(timestamp) as started_at,
      MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) as ended_at,
      COUNT(DISTINCT agent_id) as agent_count,
      COUNT(*) as event_count
    FROM events
    WHERE session_id IS NOT NULL
    GROUP BY session_id
  `;

  // We need to filter after aggregation using HAVING or wrap in subquery
  const havingConditions: string[] = [];

  if (options.startDate) {
    havingConditions.push('MIN(timestamp) >= ?');
    params.push(options.startDate.toISOString());
  }

  if (options.endDate) {
    havingConditions.push('MIN(timestamp) <= ?');
    params.push(options.endDate.toISOString());
  }

  if (options.activeOnly) {
    havingConditions.push(
      "MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) IS NULL"
    );
  }

  if (havingConditions.length > 0) {
    sql += ` HAVING ${havingConditions.join(' AND ')}`;
  }

  // Add ordering
  const orderColumn = options.orderBy === 'started_at' ? 'MIN(timestamp)' : 'MIN(timestamp)';
  const orderDirection = options.orderDirection || 'DESC';
  sql += ` ORDER BY ${orderColumn} ${orderDirection}`;

  // Add limit/offset
  if (options.limit !== undefined && options.limit > 0) {
    sql += ' LIMIT ?';
    params.push(options.limit);

    if (options.offset !== undefined && options.offset > 0) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const result = db.query<RawDerivedSessionRow>(sql, params);

  return result.rows.map(transformDerivedSession);
}

/**
 * Get a single session by ID
 * @param sessionId - Session UUID
 * @returns Session or null if not found
 */
export function getSessionById(sessionId: string): Session | null {
  const db = getDatabaseService();

  if (hasSessionsTable()) {
    const sql = `
      SELECT id, started_at, ended_at, agent_count, event_count
      FROM sessions
      WHERE id = ?
    `;
    const row = db.queryOne<RawSessionRow>(sql, [sessionId]);
    return row ? transformSession(row) : null;
  }

  // Derive from events
  const sql = `
    SELECT
      session_id,
      MIN(timestamp) as started_at,
      MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) as ended_at,
      COUNT(DISTINCT agent_id) as agent_count,
      COUNT(*) as event_count
    FROM events
    WHERE session_id = ?
    GROUP BY session_id
  `;

  const row = db.queryOne<RawDerivedSessionRow>(sql, [sessionId]);
  return row ? transformDerivedSession(row) : null;
}

/**
 * Get total count of sessions
 * @param options - Optional query options for filtering
 * @returns Session count
 */
export function getSessionCount(options: SessionQueryOptions = {}): number {
  const db = getDatabaseService();

  if (hasSessionsTable()) {
    const where = buildSessionWhereClause(options);
    const sql = `SELECT COUNT(*) as count FROM sessions ${where.clause}`;
    const result = db.queryOne<{ count: number }>(sql, where.params);
    return result?.count ?? 0;
  }

  // Count from events
  let sql = `
    SELECT COUNT(DISTINCT session_id) as count
    FROM events
    WHERE session_id IS NOT NULL
  `;

  const params: (string | number)[] = [];

  // Note: For derived sessions, time filtering is more complex
  // We would need a subquery to properly filter by session start time
  if (options.startDate || options.endDate || options.activeOnly) {
    // Use a subquery for accurate filtering
    sql = `
      SELECT COUNT(*) as count FROM (
        SELECT
          session_id,
          MIN(timestamp) as started_at,
          MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) as ended_at
        FROM events
        WHERE session_id IS NOT NULL
        GROUP BY session_id
    `;

    const havingConditions: string[] = [];

    if (options.startDate) {
      havingConditions.push('MIN(timestamp) >= ?');
      params.push(options.startDate.toISOString());
    }

    if (options.endDate) {
      havingConditions.push('MIN(timestamp) <= ?');
      params.push(options.endDate.toISOString());
    }

    if (options.activeOnly) {
      havingConditions.push(
        "MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) IS NULL"
      );
    }

    if (havingConditions.length > 0) {
      sql += ` HAVING ${havingConditions.join(' AND ')}`;
    }

    sql += ')';
  }

  const result = db.queryOne<{ count: number }>(sql, params);
  return result?.count ?? 0;
}

/**
 * Get aggregated session statistics
 * @returns Session statistics object
 */
export function getSessionStats(): SessionStats {
  const db = getDatabaseService();

  if (hasSessionsTable()) {
    // Query from sessions table
    const statsResult = db.queryOne<{
      total_sessions: number;
      active_sessions: number;
      total_events: number;
      total_agents: number;
      avg_duration: number | null;
      longest_duration: number | null;
    }>(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN ended_at IS NULL THEN 1 ELSE 0 END) as active_sessions,
        SUM(event_count) as total_events,
        SUM(agent_count) as total_agents,
        AVG(
          CASE WHEN ended_at IS NOT NULL
          THEN (julianday(ended_at) - julianday(started_at)) * 86400000
          ELSE NULL END
        ) as avg_duration,
        MAX(
          CASE WHEN ended_at IS NOT NULL
          THEN (julianday(ended_at) - julianday(started_at)) * 86400000
          ELSE NULL END
        ) as longest_duration
      FROM sessions
    `);

    // Get most active session
    const mostActiveResult = db.queryOne<{ id: string; event_count: number }>(`
      SELECT id, event_count
      FROM sessions
      ORDER BY event_count DESC
      LIMIT 1
    `);

    return {
      totalSessions: statsResult?.total_sessions ?? 0,
      activeSessions: statsResult?.active_sessions ?? 0,
      totalEvents: statsResult?.total_events ?? 0,
      totalAgents: statsResult?.total_agents ?? 0,
      avgDuration: statsResult?.avg_duration ?? null,
      longestDuration: statsResult?.longest_duration ?? null,
      mostActiveSession: mostActiveResult
        ? { id: mostActiveResult.id, eventCount: mostActiveResult.event_count }
        : null,
    };
  }

  // Derive from events
  const statsResult = db.queryOne<{
    total_sessions: number;
    active_sessions: number;
    total_events: number;
    total_agents: number;
    avg_duration: number | null;
    longest_duration: number | null;
  }>(`
    SELECT
      COUNT(DISTINCT session_id) as total_sessions,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sessions,
      SUM(event_count) as total_events,
      SUM(agent_count) as total_agents,
      AVG(duration_ms) as avg_duration,
      MAX(duration_ms) as longest_duration
    FROM (
      SELECT
        session_id,
        COUNT(*) as event_count,
        COUNT(DISTINCT agent_id) as agent_count,
        CASE
          WHEN MAX(CASE WHEN event_type = 'session_end' THEN 1 ELSE 0 END) = 0
          THEN 1 ELSE 0
        END as is_active,
        CASE
          WHEN MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END) IS NOT NULL
          THEN (julianday(MAX(CASE WHEN event_type = 'session_end' THEN timestamp ELSE NULL END)) - julianday(MIN(timestamp))) * 86400000
          ELSE NULL
        END as duration_ms
      FROM events
      WHERE session_id IS NOT NULL
      GROUP BY session_id
    )
  `);

  // Get most active session
  const mostActiveResult = db.queryOne<{ session_id: string; event_count: number }>(`
    SELECT session_id, COUNT(*) as event_count
    FROM events
    WHERE session_id IS NOT NULL
    GROUP BY session_id
    ORDER BY event_count DESC
    LIMIT 1
  `);

  return {
    totalSessions: statsResult?.total_sessions ?? 0,
    activeSessions: statsResult?.active_sessions ?? 0,
    totalEvents: statsResult?.total_events ?? 0,
    totalAgents: statsResult?.total_agents ?? 0,
    avgDuration: statsResult?.avg_duration ?? null,
    longestDuration: statsResult?.longest_duration ?? null,
    mostActiveSession: mostActiveResult
      ? { id: mostActiveResult.session_id, eventCount: mostActiveResult.event_count }
      : null,
  };
}

/**
 * Get sessions within a specific time range
 * @param startDate - Start of time range
 * @param endDate - End of time range
 * @param options - Additional query options
 * @returns Array of sessions within the range
 */
export function getSessionsInTimeRange(
  startDate: Date,
  endDate: Date,
  options: QueryOptions = {}
): Session[] {
  return getSessions({
    ...options,
    startDate,
    endDate,
  });
}

/**
 * Get active (ongoing) sessions within recent time window
 * @param withinMinutes - Consider sessions active if they had events within this many minutes (default: 60)
 * @returns Array of active sessions
 */
export function getActiveSessions(withinMinutes: number = 60): Session[] {
  const db = getDatabaseService();
  const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);

  if (hasSessionsTable()) {
    // From sessions table - active means ended_at is null
    const sql = `
      SELECT id, started_at, ended_at, agent_count, event_count
      FROM sessions
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
    `;
    const result = db.query<RawSessionRow>(sql);
    return result.rows.map(transformSession);
  }

  // Derive from events - active means no session_end event and recent activity
  const sql = `
    SELECT
      session_id,
      MIN(timestamp) as started_at,
      NULL as ended_at,
      COUNT(DISTINCT agent_id) as agent_count,
      COUNT(*) as event_count
    FROM events
    WHERE session_id IS NOT NULL
    GROUP BY session_id
    HAVING MAX(CASE WHEN event_type = 'session_end' THEN 1 ELSE 0 END) = 0
      AND MAX(timestamp) >= ?
    ORDER BY MIN(timestamp) DESC
  `;

  const result = db.query<RawDerivedSessionRow>(sql, [cutoffTime.toISOString()]);
  return result.rows.map(transformDerivedSession);
}

/**
 * Get session timeline showing sessions per day
 * @returns Array of date/count pairs
 */
export function getSessionTimeline(): SessionTimelineEntry[] {
  const db = getDatabaseService();

  if (hasSessionsTable()) {
    const sql = `
      SELECT
        date(started_at) as date,
        COUNT(*) as count
      FROM sessions
      GROUP BY date(started_at)
      ORDER BY date ASC
    `;

    const result = db.query<{ date: string; count: number }>(sql);
    return result.rows.map((row) => ({
      date: row.date,
      count: row.count,
    }));
  }

  // Derive from events using subquery for correct grouping
  const sql = `
    SELECT date, COUNT(*) as count
    FROM (
      SELECT
        session_id,
        date(MIN(timestamp)) as date
      FROM events
      WHERE session_id IS NOT NULL
      GROUP BY session_id
    )
    GROUP BY date
    ORDER BY date ASC
  `;

  const result = db.query<{ date: string; count: number }>(sql);
  return result.rows.map((row) => ({
    date: row.date,
    count: row.count,
  }));
}

/**
 * Get all agents that participated in a specific session
 * @param sessionId - Session UUID
 * @returns Array of agent information for the session
 */
export function getAgentsInSession(sessionId: string): AgentInSession[] {
  const db = getDatabaseService();

  const sql = `
    SELECT
      agent_id,
      COUNT(*) as event_count,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen
    FROM events
    WHERE session_id = ? AND agent_id IS NOT NULL
    GROUP BY agent_id
    ORDER BY first_seen ASC
  `;

  const result = db.query<{
    agent_id: string;
    event_count: number;
    first_seen: string;
    last_seen: string;
  }>(sql, [sessionId]);

  return result.rows.map((row) => ({
    agentId: row.agent_id,
    eventCount: row.event_count,
    firstSeen: new Date(row.first_seen),
    lastSeen: new Date(row.last_seen),
  }));
}
