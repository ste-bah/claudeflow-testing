/**
 * God Agent Visualization API Utilities
 *
 * Helper functions for query building, filtering, and data transformation.
 * Extracted to keep main server.ts under 800 lines.
 */

import type Database from 'better-sqlite3';

// =============================================================================
// Types
// =============================================================================

export interface GraphNode {
  id: string;
  type: 'agent' | 'task_type' | 'pattern' | 'trajectory' | 'event' | 'token_usage' | 'feedback' | 'session';
  label: string;
  metadata: Record<string, any>;
  timestamp?: number;
  taskType?: string;
  status?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: {
    nodeCount: number;
    edgeCount: number;
    byType: Record<string, number>;
  };
}

export interface GraphQueryParams {
  includeTrajectories?: 'all' | 'top50' | 'top100' | 'none';
  includeEvents?: boolean;
  includeTokenUsage?: boolean;
  includeFeedback?: boolean;
  taskType?: string;
  dateFrom?: number;
  dateTo?: number;
  status?: 'active' | 'completed' | 'failed' | 'abandoned';
  agentId?: string;
  component?: string;
  limit?: number;
}

export interface FilterOptions {
  taskTypes: string[];
  agents: string[];
  components: string[];
  sessions: string[];
  statuses: string[];
  dateRange: {
    min: number | null;
    max: number | null;
  };
  counts: {
    trajectories: number;
    events: number;
    tokenUsage: number;
    feedback: number;
    patterns: number;
  };
}

export interface EventData {
  id: string;
  component: string;
  operation: string;
  status: string;
  timestamp: number;
  duration_ms: number | null;
  trace_id: string | null;
  span_id: string | null;
  metadata: string;
}

export interface TokenUsageData {
  id: string;
  session_id: string;
  request_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  task_type: string;
  agent_id: string;
  trajectory_id: string | null;
  timestamp: number;
}

export interface FeedbackData {
  id: string;
  trajectory_id: string;
  episode_id: string | null;
  pattern_id: string | null;
  quality: number;
  outcome: string;
  task_type: string;
  agent_id: string;
  result_length: number | null;
  has_code_blocks: number;
  created_at: number;
}

// =============================================================================
// Query Param Parsing
// =============================================================================

export function parseGraphQueryParams(query: Record<string, any>): GraphQueryParams {
  return {
    includeTrajectories: parseTrajectoryMode(query.includeTrajectories),
    includeEvents: query.includeEvents === 'true',
    includeTokenUsage: query.includeTokenUsage === 'true',
    includeFeedback: query.includeFeedback === 'true',
    taskType: query.taskType as string | undefined,
    dateFrom: query.dateFrom ? parseInt(query.dateFrom as string) : undefined,
    dateTo: query.dateTo ? parseInt(query.dateTo as string) : undefined,
    status: parseStatus(query.status),
    agentId: query.agentId as string | undefined,
    component: query.component as string | undefined,
    limit: query.limit ? parseInt(query.limit as string) : undefined,
  };
}

function parseTrajectoryMode(value: any): 'all' | 'top50' | 'top100' | 'none' | undefined {
  if (value === 'all' || value === 'top50' || value === 'top100' || value === 'none') {
    return value;
  }
  return undefined;
}

function parseStatus(value: any): 'active' | 'completed' | 'failed' | 'abandoned' | undefined {
  if (value === 'active' || value === 'completed' || value === 'failed' || value === 'abandoned') {
    return value;
  }
  return undefined;
}

// =============================================================================
// SQL Query Builders
// =============================================================================

export function buildTrajectoryQuery(params: GraphQueryParams): { sql: string; args: any[] } {
  let sql = `
    SELECT id, route, step_count, quality_score, status, created_at, completed_at
    FROM trajectory_metadata
    WHERE 1=1
  `;
  const args: any[] = [];

  if (params.taskType) {
    sql += ` AND route = ?`;
    args.push(params.taskType);
  }

  if (params.status) {
    sql += ` AND status = ?`;
    args.push(params.status);
  }

  if (params.dateFrom) {
    sql += ` AND created_at >= ?`;
    args.push(params.dateFrom);
  }

  if (params.dateTo) {
    sql += ` AND created_at <= ?`;
    args.push(params.dateTo);
  }

  sql += ` ORDER BY quality_score DESC NULLS LAST, created_at DESC`;

  // Limit based on mode
  const mode = params.includeTrajectories || 'top50';
  if (mode === 'top50') {
    sql += ` LIMIT 50`;
  } else if (mode === 'top100') {
    sql += ` LIMIT 100`;
  } else if (mode === 'none') {
    sql += ` LIMIT 0`;
  }
  // 'all' = no limit

  return { sql, args };
}

export function buildEventsQuery(params: GraphQueryParams): { sql: string; args: any[] } {
  let sql = `
    SELECT id, component, operation, status, timestamp, duration_ms, trace_id, span_id, metadata
    FROM events
    WHERE 1=1
  `;
  const args: any[] = [];

  if (params.component) {
    sql += ` AND component = ?`;
    args.push(params.component);
  }

  if (params.dateFrom) {
    sql += ` AND timestamp >= ?`;
    args.push(params.dateFrom);
  }

  if (params.dateTo) {
    sql += ` AND timestamp <= ?`;
    args.push(params.dateTo);
  }

  sql += ` ORDER BY timestamp DESC`;

  const limit = params.limit || 500;
  sql += ` LIMIT ${limit}`;

  return { sql, args };
}

export function buildTokenUsageQuery(params: GraphQueryParams & { sessionId?: string; trajectoryId?: string }): { sql: string; args: any[] } {
  let sql = `
    SELECT id, session_id, request_id, input_tokens, output_tokens, total_tokens,
           task_type, agent_id, trajectory_id, timestamp
    FROM token_usage
    WHERE 1=1
  `;
  const args: any[] = [];

  if (params.sessionId) {
    sql += ` AND session_id = ?`;
    args.push(params.sessionId);
  }

  if (params.trajectoryId) {
    sql += ` AND trajectory_id = ?`;
    args.push(params.trajectoryId);
  }

  if (params.taskType) {
    sql += ` AND task_type = ?`;
    args.push(params.taskType);
  }

  if (params.agentId) {
    sql += ` AND agent_id = ?`;
    args.push(params.agentId);
  }

  if (params.dateFrom) {
    sql += ` AND timestamp >= ?`;
    args.push(params.dateFrom);
  }

  if (params.dateTo) {
    sql += ` AND timestamp <= ?`;
    args.push(params.dateTo);
  }

  sql += ` ORDER BY timestamp DESC`;

  const limit = params.limit || 500;
  sql += ` LIMIT ${limit}`;

  return { sql, args };
}

export function buildFeedbackQuery(params: GraphQueryParams & { outcome?: string }): { sql: string; args: any[] } {
  let sql = `
    SELECT id, trajectory_id, episode_id, pattern_id, quality, outcome,
           task_type, agent_id, result_length, has_code_blocks, created_at
    FROM learning_feedback
    WHERE 1=1
  `;
  const args: any[] = [];

  if (params.outcome) {
    sql += ` AND outcome = ?`;
    args.push(params.outcome);
  }

  if (params.taskType) {
    sql += ` AND task_type = ?`;
    args.push(params.taskType);
  }

  if (params.agentId) {
    sql += ` AND agent_id = ?`;
    args.push(params.agentId);
  }

  if (params.dateFrom) {
    sql += ` AND created_at >= ?`;
    args.push(params.dateFrom);
  }

  if (params.dateTo) {
    sql += ` AND created_at <= ?`;
    args.push(params.dateTo);
  }

  sql += ` ORDER BY created_at DESC`;

  const limit = params.limit || 500;
  sql += ` LIMIT ${limit}`;

  return { sql, args };
}

// =============================================================================
// Node/Edge Builders
// =============================================================================

export function createEventNode(event: EventData): GraphNode {
  return {
    id: `event:${event.id}`,
    type: 'event',
    label: `${event.component}:${event.operation}`,
    metadata: {
      component: event.component,
      operation: event.operation,
      eventStatus: event.status,
      durationMs: event.duration_ms,
      traceId: event.trace_id,
      spanId: event.span_id,
    },
    timestamp: event.timestamp,
    status: event.status,
  };
}

export function createTokenUsageNode(usage: TokenUsageData): GraphNode {
  return {
    id: `token_usage:${usage.id}`,
    type: 'token_usage',
    label: `${usage.input_tokens}/${usage.output_tokens} tokens`,
    metadata: {
      sessionId: usage.session_id,
      requestId: usage.request_id,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.total_tokens,
      agentId: usage.agent_id,
      trajectoryId: usage.trajectory_id,
    },
    timestamp: usage.timestamp,
    taskType: usage.task_type,
  };
}

export function createFeedbackNode(feedback: FeedbackData): GraphNode {
  return {
    id: `feedback:${feedback.id}`,
    type: 'feedback',
    label: `${feedback.outcome} (${Math.round(feedback.quality * 100)}%)`,
    metadata: {
      quality: feedback.quality,
      outcome: feedback.outcome,
      trajectoryId: feedback.trajectory_id,
      episodeId: feedback.episode_id,
      patternId: feedback.pattern_id,
      agentId: feedback.agent_id,
      resultLength: feedback.result_length,
      hasCodeBlocks: feedback.has_code_blocks === 1,
    },
    timestamp: feedback.created_at,
    taskType: feedback.task_type,
    status: feedback.outcome,
  };
}

export function createSessionNode(sessionId: string, stats: { tokenCount: number; totalTokens: number }): GraphNode {
  return {
    id: `session:${sessionId}`,
    type: 'session',
    label: sessionId.substring(0, 30) + (sessionId.length > 30 ? '...' : ''),
    metadata: {
      fullId: sessionId,
      tokenUsageCount: stats.tokenCount,
      totalTokens: stats.totalTokens,
    },
  };
}

// =============================================================================
// Filter Options Builder
// =============================================================================

export function getFilterOptions(learningDb: Database.Database | null, eventsDb: Database.Database | null): FilterOptions {
  const options: FilterOptions = {
    taskTypes: [],
    agents: [],
    components: [],
    sessions: [],
    statuses: ['active', 'completed', 'failed', 'abandoned'],
    dateRange: { min: null, max: null },
    counts: {
      trajectories: 0,
      events: 0,
      tokenUsage: 0,
      feedback: 0,
      patterns: 0,
    },
  };

  if (learningDb) {
    try {
      // Task types from trajectories
      const taskTypes = learningDb.prepare(`
        SELECT DISTINCT route FROM trajectory_metadata ORDER BY route
      `).all() as Array<{ route: string }>;
      options.taskTypes = taskTypes.map(t => t.route);

      // Agents from learning_feedback
      const agents = learningDb.prepare(`
        SELECT DISTINCT agent_id FROM learning_feedback ORDER BY agent_id
      `).all() as Array<{ agent_id: string }>;
      options.agents = agents.map(a => a.agent_id);

      // Sessions from token_usage
      const sessions = learningDb.prepare(`
        SELECT DISTINCT session_id FROM token_usage ORDER BY session_id LIMIT 100
      `).all() as Array<{ session_id: string }>;
      options.sessions = sessions.map(s => s.session_id);

      // Date range from trajectories
      const dateRange = learningDb.prepare(`
        SELECT MIN(created_at) as min_date, MAX(created_at) as max_date
        FROM trajectory_metadata
      `).get() as { min_date: number | null; max_date: number | null };
      options.dateRange.min = dateRange?.min_date ?? null;
      options.dateRange.max = dateRange?.max_date ?? null;

      // Counts
      const trajCount = learningDb.prepare(`SELECT COUNT(*) as cnt FROM trajectory_metadata`).get() as { cnt: number };
      options.counts.trajectories = trajCount.cnt;

      const tokenCount = learningDb.prepare(`SELECT COUNT(*) as cnt FROM token_usage`).get() as { cnt: number };
      options.counts.tokenUsage = tokenCount.cnt;

      const feedbackCount = learningDb.prepare(`SELECT COUNT(*) as cnt FROM learning_feedback`).get() as { cnt: number };
      options.counts.feedback = feedbackCount.cnt;

      const patternCount = learningDb.prepare(`SELECT COUNT(*) as cnt FROM patterns WHERE deprecated = 0`).get() as { cnt: number };
      options.counts.patterns = patternCount.cnt;
    } catch (err) {
      console.error('Error getting filter options from learning.db:', err);
    }
  }

  if (eventsDb) {
    try {
      // Components from events
      const components = eventsDb.prepare(`
        SELECT DISTINCT component FROM events ORDER BY component
      `).all() as Array<{ component: string }>;
      options.components = components.map(c => c.component);

      // Events count
      const eventsCount = eventsDb.prepare(`SELECT COUNT(*) as cnt FROM events`).get() as { cnt: number };
      options.counts.events = eventsCount.cnt;
    } catch (err) {
      console.error('Error getting filter options from events.db:', err);
    }
  }

  return options;
}

// =============================================================================
// Stats Computation
// =============================================================================

export function computeGraphStats(nodes: GraphNode[], edges: GraphEdge[]): { nodeCount: number; edgeCount: number; byType: Record<string, number> } {
  const byType: Record<string, number> = {};

  for (const node of nodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    byType,
  };
}
