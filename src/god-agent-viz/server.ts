/**
 * God Agent Visualization API Server
 *
 * Express.js backend that queries the god-agent SQLite databases
 * and returns graph-ready JSON for visualization.
 *
 * Agent #1 of 3 | Next: Frontend Graph (needs node/edge schema), Integration
 *
 * API Endpoints:
 *   GET /api/graph           - Full graph data with filtering
 *   GET /api/filters         - Available filter options
 *   GET /api/events          - Event data with filters
 *   GET /api/token-usage     - Token usage data with filters
 *   GET /api/feedback        - Learning feedback data
 *   GET /api/agents          - Unique agents list
 *   GET /api/task-types      - Unique task types
 *   GET /api/stats           - Summary statistics
 *   GET /api/patterns        - Pattern data
 *   GET /api/trajectories    - Trajectory metadata
 *   GET /api/health          - Health check
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

import {
  GraphNode,
  GraphEdge,
  GraphData,
  GraphQueryParams,
  FilterOptions,
  EventData,
  TokenUsageData,
  FeedbackData,
  parseGraphQueryParams,
  buildTrajectoryQuery,
  buildEventsQuery,
  buildTokenUsageQuery,
  buildFeedbackQuery,
  createEventNode,
  createTokenUsageNode,
  createFeedbackNode,
  createSessionNode,
  getFilterOptions,
  computeGraphStats,
} from './api-utils.js';

// =============================================================================
// Types (backward compat)
// =============================================================================

interface StatsData {
  trajectories: {
    total: number;
    active: number;
    completed: number;
    avgQuality: number | null;
  };
  patterns: {
    total: number;
    avgWeight: number;
  };
  feedback: {
    total: number;
    avgQuality: number | null;
  };
  agents: string[];
  taskTypes: string[];
}

// =============================================================================
// Configuration
// =============================================================================

const PORT = 3456;
const GOD_AGENT_DIR = path.join(process.cwd(), '.god-agent');
const LEARNING_DB_PATH = path.join(GOD_AGENT_DIR, 'learning.db');
const EVENTS_DB_PATH = path.join(GOD_AGENT_DIR, 'events.db');

// =============================================================================
// Database Helpers
// =============================================================================

function getDatabase(dbPath: string): Database.Database | null {
  if (!fs.existsSync(dbPath)) {
    console.warn(`Database not found: ${dbPath}`);
    return null;
  }
  try {
    return new Database(dbPath, { readonly: true });
  } catch (err) {
    console.error(`Failed to open database ${dbPath}:`, err);
    return null;
  }
}

// =============================================================================
// Core Graph Data Builder
// =============================================================================

/**
 * GET /api/graph - Returns full graph data as nodes + edges
 * Supports filtering via query params for expanded data access.
 */
function getGraphData(params: GraphQueryParams = {}): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  const learningDb = getDatabase(LEARNING_DB_PATH);
  const eventsDb = getDatabase(EVENTS_DB_PATH);

  if (!learningDb) {
    return { nodes, edges };
  }

  try {
    // =========================================================================
    // 1. Agent -> Task Type relationships from learning_feedback
    // =========================================================================
    const agentTaskRelations = learningDb.prepare(`
      SELECT
        agent_id,
        task_type,
        COUNT(*) as count,
        AVG(quality) as avg_quality,
        SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN outcome = 'negative' THEN 1 ELSE 0 END) as negative_count
      FROM learning_feedback
      GROUP BY agent_id, task_type
      ORDER BY count DESC
    `).all() as Array<{
      agent_id: string;
      task_type: string;
      count: number;
      avg_quality: number;
      positive_count: number;
      negative_count: number;
    }>;

    const agents = new Set<string>();
    const taskTypes = new Set<string>();

    for (const rel of agentTaskRelations) {
      agents.add(rel.agent_id);
      taskTypes.add(rel.task_type);
    }

    // Add agent nodes
    for (const agentId of agents) {
      const nodeId = `agent:${agentId}`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        const agentStats = agentTaskRelations.filter(r => r.agent_id === agentId);
        const totalTasks = agentStats.reduce((sum, r) => sum + r.count, 0);
        const avgQuality = agentStats.reduce((sum, r) => sum + r.avg_quality * r.count, 0) / totalTasks;

        nodes.push({
          id: nodeId,
          type: 'agent',
          label: agentId,
          metadata: {
            totalTasks,
            avgQuality: Math.round(avgQuality * 100) / 100,
            taskTypeCount: agentStats.length,
          },
        });
      }
    }

    // Add task_type nodes
    for (const taskType of taskTypes) {
      const nodeId = `task_type:${taskType}`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        const taskStats = agentTaskRelations.filter(r => r.task_type === taskType);
        const totalFeedback = taskStats.reduce((sum, r) => sum + r.count, 0);
        const avgQuality = taskStats.reduce((sum, r) => sum + r.avg_quality * r.count, 0) / totalFeedback;

        nodes.push({
          id: nodeId,
          type: 'task_type',
          label: taskType,
          metadata: {
            totalFeedback,
            avgQuality: Math.round(avgQuality * 100) / 100,
            agentCount: taskStats.length,
          },
        });
      }
    }

    // Add agent -> task_type edges
    for (const rel of agentTaskRelations) {
      edges.push({
        source: `agent:${rel.agent_id}`,
        target: `task_type:${rel.task_type}`,
        type: 'performs',
        weight: rel.count,
      });
    }

    // =========================================================================
    // 2. Pattern data
    // =========================================================================
    const patterns = learningDb.prepare(`
      SELECT
        id, name, agent_id, task_type, weight,
        success_count, failure_count, trajectory_ids
      FROM patterns
      WHERE deprecated = 0
    `).all() as Array<{
      id: string;
      name: string;
      agent_id: string;
      task_type: string;
      weight: number;
      success_count: number;
      failure_count: number;
      trajectory_ids: string;
    }>;

    for (const pattern of patterns) {
      const nodeId = `pattern:${pattern.id}`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        nodes.push({
          id: nodeId,
          type: 'pattern',
          label: pattern.name,
          metadata: {
            weight: pattern.weight,
            successCount: pattern.success_count,
            failureCount: pattern.failure_count,
            agentId: pattern.agent_id,
            taskType: pattern.task_type,
          },
        });
      }

      const taskTypeNodeId = `task_type:${pattern.task_type}`;
      if (nodeIds.has(taskTypeNodeId)) {
        edges.push({
          source: nodeId,
          target: taskTypeNodeId,
          type: 'matches',
          weight: pattern.weight,
        });
      }

      const agentNodeId = `agent:${pattern.agent_id}`;
      if (nodeIds.has(agentNodeId)) {
        edges.push({
          source: agentNodeId,
          target: nodeId,
          type: 'learned',
          weight: pattern.weight,
        });
      }
    }

    // =========================================================================
    // 3. Trajectories (with filtering)
    // =========================================================================
    const trajMode = params.includeTrajectories ?? 'top50';
    if (trajMode !== 'none') {
      const { sql, args } = buildTrajectoryQuery(params);
      const trajectories = learningDb.prepare(sql).all(...args) as Array<{
        id: string;
        route: string;
        step_count: number;
        quality_score: number | null;
        status: string;
        created_at: number;
        completed_at: number | null;
      }>;

      for (const traj of trajectories) {
        const nodeId = `trajectory:${traj.id}`;
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodes.push({
            id: nodeId,
            type: 'trajectory',
            label: traj.route.length > 30 ? `${traj.route.substring(0, 30)}...` : traj.route,
            metadata: {
              route: traj.route,
              stepCount: traj.step_count,
              qualityScore: traj.quality_score,
              completedAt: traj.completed_at,
            },
            timestamp: traj.created_at,
            taskType: traj.route,
            status: traj.status,
          });

          const taskTypeNodeId = `task_type:${traj.route}`;
          if (nodeIds.has(taskTypeNodeId)) {
            edges.push({
              source: nodeId,
              target: taskTypeNodeId,
              type: 'belongs_to',
              weight: traj.quality_score ?? 0.5,
            });
          }
        }
      }
    }

    // =========================================================================
    // 4. Events (optional, from events.db)
    // =========================================================================
    if (params.includeEvents && eventsDb) {
      const { sql, args } = buildEventsQuery(params);
      const events = eventsDb.prepare(sql).all(...args) as EventData[];

      // Track trace chains
      const traceEvents: Map<string, string[]> = new Map();

      for (const event of events) {
        const node = createEventNode(event);
        if (!nodeIds.has(node.id)) {
          nodeIds.add(node.id);
          nodes.push(node);

          // Track for trace chain edges
          if (event.trace_id) {
            const traceList = traceEvents.get(event.trace_id) || [];
            traceList.push(node.id);
            traceEvents.set(event.trace_id, traceList);
          }
        }
      }

      // Create trace chain edges (event -> event)
      for (const [, eventIds] of traceEvents) {
        for (let i = 0; i < eventIds.length - 1; i++) {
          edges.push({
            source: eventIds[i],
            target: eventIds[i + 1],
            type: 'trace_chain',
          });
        }
      }
    }

    // =========================================================================
    // 5. Token Usage (optional)
    // =========================================================================
    if (params.includeTokenUsage) {
      const { sql, args } = buildTokenUsageQuery(params);
      const tokenUsages = learningDb.prepare(sql).all(...args) as TokenUsageData[];

      // Collect session stats
      const sessionStats: Map<string, { tokenCount: number; totalTokens: number }> = new Map();

      for (const usage of tokenUsages) {
        const node = createTokenUsageNode(usage);
        if (!nodeIds.has(node.id)) {
          nodeIds.add(node.id);
          nodes.push(node);

          // Aggregate session stats
          const stats = sessionStats.get(usage.session_id) || { tokenCount: 0, totalTokens: 0 };
          stats.tokenCount++;
          stats.totalTokens += usage.total_tokens;
          sessionStats.set(usage.session_id, stats);

          // Link to trajectory if exists
          if (usage.trajectory_id) {
            const trajNodeId = `trajectory:${usage.trajectory_id}`;
            if (nodeIds.has(trajNodeId)) {
              edges.push({
                source: node.id,
                target: trajNodeId,
                type: 'consumed_by',
              });
            }
          }
        }
      }

      // Create session nodes and edges
      for (const [sessionId, stats] of sessionStats) {
        const sessionNode = createSessionNode(sessionId, stats);
        if (!nodeIds.has(sessionNode.id)) {
          nodeIds.add(sessionNode.id);
          nodes.push(sessionNode);
        }
      }

      // Link token_usage to sessions
      for (const usage of tokenUsages) {
        const tokenNodeId = `token_usage:${usage.id}`;
        const sessionNodeId = `session:${usage.session_id}`;
        if (nodeIds.has(tokenNodeId) && nodeIds.has(sessionNodeId)) {
          edges.push({
            source: tokenNodeId,
            target: sessionNodeId,
            type: 'in_session',
          });
        }
      }
    }

    // =========================================================================
    // 6. Individual Feedback nodes (optional)
    // =========================================================================
    if (params.includeFeedback) {
      const { sql, args } = buildFeedbackQuery(params);
      const feedbacks = learningDb.prepare(sql).all(...args) as FeedbackData[];

      for (const feedback of feedbacks) {
        const node = createFeedbackNode(feedback);
        if (!nodeIds.has(node.id)) {
          nodeIds.add(node.id);
          nodes.push(node);

          // Link feedback to trajectory
          const trajNodeId = `trajectory:${feedback.trajectory_id}`;
          if (nodeIds.has(trajNodeId)) {
            edges.push({
              source: node.id,
              target: trajNodeId,
              type: 'has_feedback',
            });
          }

          // Link feedback to pattern if exists
          if (feedback.pattern_id) {
            const patternNodeId = `pattern:${feedback.pattern_id}`;
            if (nodeIds.has(patternNodeId)) {
              edges.push({
                source: node.id,
                target: patternNodeId,
                type: 'used_pattern',
              });
            }
          }
        }
      }
    }

    learningDb.close();
    eventsDb?.close();
  } catch (err) {
    console.error('Error building graph data:', err);
  }

  return {
    nodes,
    edges,
    stats: computeGraphStats(nodes, edges),
  };
}

// =============================================================================
// Existing API Handlers (backward compatible)
// =============================================================================

function getAgents(): Array<{ id: string; taskCount: number; avgQuality: number }> {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const agents = db.prepare(`
      SELECT
        agent_id as id,
        COUNT(*) as taskCount,
        AVG(quality) as avgQuality
      FROM learning_feedback
      GROUP BY agent_id
      ORDER BY taskCount DESC
    `).all() as Array<{ id: string; taskCount: number; avgQuality: number }>;

    db.close();
    return agents;
  } catch (err) {
    console.error('Error getting agents:', err);
    return [];
  }
}

function getTaskTypes(): Array<{ id: string; feedbackCount: number; avgQuality: number }> {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const taskTypes = db.prepare(`
      SELECT
        task_type as id,
        COUNT(*) as feedbackCount,
        AVG(quality) as avgQuality
      FROM learning_feedback
      GROUP BY task_type
      ORDER BY feedbackCount DESC
    `).all() as Array<{ id: string; feedbackCount: number; avgQuality: number }>;

    db.close();
    return taskTypes;
  } catch (err) {
    console.error('Error getting task types:', err);
    return [];
  }
}

function getStats(): StatsData {
  const stats: StatsData = {
    trajectories: { total: 0, active: 0, completed: 0, avgQuality: null },
    patterns: { total: 0, avgWeight: 0 },
    feedback: { total: 0, avgQuality: null },
    agents: [],
    taskTypes: [],
  };

  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return stats;

  try {
    const trajStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        AVG(quality_score) as avgQuality
      FROM trajectory_metadata
    `).get() as { total: number; active: number; completed: number; avgQuality: number | null };

    if (trajStats) stats.trajectories = trajStats;

    const patternStats = db.prepare(`
      SELECT COUNT(*) as total, AVG(weight) as avgWeight
      FROM patterns WHERE deprecated = 0
    `).get() as { total: number; avgWeight: number };

    if (patternStats) stats.patterns = patternStats;

    const feedbackStats = db.prepare(`
      SELECT COUNT(*) as total, AVG(quality) as avgQuality
      FROM learning_feedback
    `).get() as { total: number; avgQuality: number | null };

    if (feedbackStats) stats.feedback = feedbackStats;

    const agents = db.prepare(`SELECT DISTINCT agent_id FROM learning_feedback`).all() as Array<{ agent_id: string }>;
    stats.agents = agents.map(a => a.agent_id);

    const taskTypes = db.prepare(`SELECT DISTINCT task_type FROM learning_feedback`).all() as Array<{ task_type: string }>;
    stats.taskTypes = taskTypes.map(t => t.task_type);

    db.close();
  } catch (err) {
    console.error('Error getting stats:', err);
  }

  return stats;
}

function getPatterns(): Array<Record<string, any>> {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const patterns = db.prepare(`
      SELECT
        id, name, agent_id, task_type, weight,
        success_count, failure_count, trajectory_ids,
        created_at, updated_at
      FROM patterns
      WHERE deprecated = 0
      ORDER BY weight DESC
    `).all();

    db.close();
    return patterns as Array<Record<string, any>>;
  } catch (err) {
    console.error('Error getting patterns:', err);
    return [];
  }
}

function getTrajectories(limit: number = 50, offset: number = 0): Array<Record<string, any>> {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const trajectories = db.prepare(`
      SELECT
        id, route, step_count, quality_score, status, created_at
      FROM trajectory_metadata
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    db.close();
    return trajectories as Array<Record<string, any>>;
  } catch (err) {
    console.error('Error getting trajectories:', err);
    return [];
  }
}

function getFeedback(
  taskType?: string,
  agentId?: string,
  limit: number = 100
): Array<Record<string, any>> {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    let sql = `
      SELECT
        id, trajectory_id, episode_id, pattern_id,
        quality, outcome, task_type, agent_id, created_at
      FROM learning_feedback
      WHERE 1=1
    `;
    const params: any[] = [];

    if (taskType) {
      sql += ` AND task_type = ?`;
      params.push(taskType);
    }
    if (agentId) {
      sql += ` AND agent_id = ?`;
      params.push(agentId);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const feedback = db.prepare(sql).all(...params);
    db.close();
    return feedback as Array<Record<string, any>>;
  } catch (err) {
    console.error('Error getting feedback:', err);
    return [];
  }
}

// =============================================================================
// New API Handlers
// =============================================================================

function getEvents(params: GraphQueryParams & { limit?: number }): EventData[] {
  const db = getDatabase(EVENTS_DB_PATH);
  if (!db) return [];

  try {
    const { sql, args } = buildEventsQuery(params);
    const events = db.prepare(sql).all(...args) as EventData[];
    db.close();
    return events;
  } catch (err) {
    console.error('Error getting events:', err);
    return [];
  }
}

function getTokenUsage(params: GraphQueryParams & { sessionId?: string; trajectoryId?: string }): TokenUsageData[] {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const { sql, args } = buildTokenUsageQuery(params);
    const usage = db.prepare(sql).all(...args) as TokenUsageData[];
    db.close();
    return usage;
  } catch (err) {
    console.error('Error getting token usage:', err);
    return [];
  }
}

function getDetailedFeedback(params: GraphQueryParams & { outcome?: string }): FeedbackData[] {
  const db = getDatabase(LEARNING_DB_PATH);
  if (!db) return [];

  try {
    const { sql, args } = buildFeedbackQuery(params);
    const feedback = db.prepare(sql).all(...args) as FeedbackData[];
    db.close();
    return feedback;
  } catch (err) {
    console.error('Error getting detailed feedback:', err);
    return [];
  }
}

// =============================================================================
// Express Server Setup
// =============================================================================

function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // ==========================================================================
  // API Routes
  // ==========================================================================

  // GET /api/graph - Full graph data with filtering
  app.get('/api/graph', (req: Request, res: Response) => {
    try {
      const params = parseGraphQueryParams(req.query);
      const graphData = getGraphData(params);
      res.json(graphData);
    } catch (err) {
      console.error('Error in /api/graph:', err);
      res.status(500).json({ error: 'Failed to get graph data' });
    }
  });

  // GET /api/filters - Available filter options
  app.get('/api/filters', (req: Request, res: Response) => {
    try {
      const learningDb = getDatabase(LEARNING_DB_PATH);
      const eventsDb = getDatabase(EVENTS_DB_PATH);
      const filters = getFilterOptions(learningDb, eventsDb);
      learningDb?.close();
      eventsDb?.close();
      res.json(filters);
    } catch (err) {
      console.error('Error in /api/filters:', err);
      res.status(500).json({ error: 'Failed to get filter options' });
    }
  });

  // GET /api/events - Event data with filters
  app.get('/api/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const component = req.query.component as string | undefined;
      const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

      const events = getEvents({ component, dateFrom, dateTo, limit });
      res.json({ events, count: events.length });
    } catch (err) {
      console.error('Error in /api/events:', err);
      res.status(500).json({ error: 'Failed to get events' });
    }
  });

  // GET /api/token-usage - Token usage data with filters
  app.get('/api/token-usage', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const sessionId = req.query.sessionId as string | undefined;
      const trajectoryId = req.query.trajectoryId as string | undefined;
      const taskType = req.query.taskType as string | undefined;
      const agentId = req.query.agentId as string | undefined;

      const usage = getTokenUsage({ sessionId, trajectoryId, taskType, agentId, limit });
      res.json({ tokenUsage: usage, count: usage.length });
    } catch (err) {
      console.error('Error in /api/token-usage:', err);
      res.status(500).json({ error: 'Failed to get token usage' });
    }
  });

  // GET /api/agents - List unique agents
  app.get('/api/agents', (req: Request, res: Response) => {
    try {
      const agents = getAgents();
      res.json({ agents, count: agents.length });
    } catch (err) {
      console.error('Error in /api/agents:', err);
      res.status(500).json({ error: 'Failed to get agents' });
    }
  });

  // GET /api/task-types - List unique task types
  app.get('/api/task-types', (req: Request, res: Response) => {
    try {
      const taskTypes = getTaskTypes();
      res.json({ taskTypes, count: taskTypes.length });
    } catch (err) {
      console.error('Error in /api/task-types:', err);
      res.status(500).json({ error: 'Failed to get task types' });
    }
  });

  // GET /api/stats - Summary statistics
  app.get('/api/stats', (req: Request, res: Response) => {
    try {
      const stats = getStats();
      res.json(stats);
    } catch (err) {
      console.error('Error in /api/stats:', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // GET /api/patterns - All patterns
  app.get('/api/patterns', (req: Request, res: Response) => {
    try {
      const patterns = getPatterns();
      res.json({ patterns, count: patterns.length });
    } catch (err) {
      console.error('Error in /api/patterns:', err);
      res.status(500).json({ error: 'Failed to get patterns' });
    }
  });

  // GET /api/trajectories - Trajectory metadata with pagination
  app.get('/api/trajectories', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const trajectories = getTrajectories(limit, offset);
      res.json({ trajectories, count: trajectories.length, limit, offset });
    } catch (err) {
      console.error('Error in /api/trajectories:', err);
      res.status(500).json({ error: 'Failed to get trajectories' });
    }
  });

  // GET /api/feedback - Learning feedback with filters (backward compatible)
  app.get('/api/feedback', (req: Request, res: Response) => {
    try {
      const taskType = req.query.task_type as string | undefined;
      const agentId = req.query.agent_id as string | undefined;
      const outcome = req.query.outcome as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      // If outcome filter is used, use detailed method
      if (outcome) {
        const feedback = getDetailedFeedback({ taskType, agentId, outcome, limit });
        res.json({ feedback, count: feedback.length });
      } else {
        const feedback = getFeedback(taskType, agentId, limit);
        res.json({ feedback, count: feedback.length });
      }
    } catch (err) {
      console.error('Error in /api/feedback:', err);
      res.status(500).json({ error: 'Failed to get feedback' });
    }
  });

  // GET /api/health - Health check
  app.get('/api/health', (req: Request, res: Response) => {
    const learningDbExists = fs.existsSync(LEARNING_DB_PATH);
    const eventsDbExists = fs.existsSync(EVENTS_DB_PATH);

    res.json({
      status: learningDbExists ? 'healthy' : 'degraded',
      databases: {
        learning: learningDbExists ? 'connected' : 'not found',
        events: eventsDbExists ? 'connected' : 'not found',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  return app;
}

// =============================================================================
// Server Startup
// =============================================================================

const app = createServer();

app.listen(PORT, () => {
  console.log(`
====================================
  God Agent Visualization API
====================================
  Server:     http://localhost:${PORT}

  Core Endpoints:
    - GET /api/graph           Full graph data (supports filters)
    - GET /api/filters         Available filter options

  Data Endpoints:
    - GET /api/events          Event data with filters
    - GET /api/token-usage     Token usage data
    - GET /api/feedback        Learning feedback
    - GET /api/trajectories    Trajectory metadata
    - GET /api/patterns        Pattern data

  Metadata Endpoints:
    - GET /api/agents          Unique agents list
    - GET /api/task-types      Unique task types
    - GET /api/stats           Summary statistics
    - GET /api/health          Health check

  Graph Filter Params:
    includeTrajectories=all|top50|top100|none
    includeEvents=true|false
    includeTokenUsage=true|false
    includeFeedback=true|false
    taskType=<filter>
    dateFrom=<timestamp>
    dateTo=<timestamp>
    status=active|completed|failed|abandoned
====================================
  `);

  console.log('Database paths:');
  console.log(`  Learning DB: ${LEARNING_DB_PATH} (${fs.existsSync(LEARNING_DB_PATH) ? 'found' : 'NOT FOUND'})`);
  console.log(`  Events DB:   ${EVENTS_DB_PATH} (${fs.existsSync(EVENTS_DB_PATH) ? 'found' : 'NOT FOUND'})`);
});

export { app, createServer, getGraphData, getAgents, getTaskTypes, getStats };
