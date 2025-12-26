/**
 * ExpressServer - HTTP Server with API Endpoints
 *
 * Implements Express server with all observability API endpoints
 * for the dashboard and external integrations.
 *
 * @module observability/express-server
 * @see TASK-OBS-008-EXPRESS-SERVER.md
 * @see SPEC-OBS-001-CORE.md
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import { IActivityStream } from './activity-stream.js';
import { IAgentExecutionTracker } from './agent-tracker.js';
import { IPipelineTracker } from './pipeline-tracker.js';
import { IRoutingHistory } from './routing-history.js';
import { IEventStore, IEventQuery } from './event-store.js';
import { ISSEBroadcaster } from './sse-broadcaster.js';
import { ActivityEventComponent, ActivityEventStatus } from './types.js';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Express server dependencies
 */
export interface IServerDependencies {
  activityStream: IActivityStream;
  agentTracker: IAgentExecutionTracker;
  pipelineTracker: IPipelineTracker;
  routingHistory: IRoutingHistory;
  eventStore: IEventStore;
  sseBroadcaster: ISSEBroadcaster;
}

/**
 * Express server configuration
 */
export interface IServerConfig {
  /** Server host (default: '127.0.0.1' for localhost only) */
  host?: string;
  /** Server port (default: 3847) */
  port?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * ExpressServer interface
 * Implements [REQ-OBS-07]: Express HTTP API server
 */
export interface IExpressServer {
  /**
   * Start the HTTP server
   * @param port Port to listen on
   * @returns Promise resolving when server is started
   */
  start(port: number): Promise<void>;

  /**
   * Stop the HTTP server
   * @returns Promise resolving when server is stopped
   */
  stop(): Promise<void>;

  /**
   * Get the Express application
   * @returns Express app instance
   */
  getApp(): Express;

  /**
   * Get the current port
   * @returns Port number or 0 if not started
   */
  getPort(): number;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * ExpressServer implementation
 *
 * Implements:
 * - [REQ-OBS-07]: Express HTTP API with 11 endpoints
 * - [RULE-OBS-006]: Security (localhost binding, headers)
 * - [RULE-OBS-003]: Graceful error handling
 */
export class ExpressServer implements IExpressServer {
  private app: Express;
  private server: http.Server | null = null;
  private port: number = 0;
  private host: string;
  private verbose: boolean;

  // Dependencies
  private activityStream: IActivityStream;
  private agentTracker: IAgentExecutionTracker;
  private pipelineTracker: IPipelineTracker;
  private routingHistory: IRoutingHistory;
  private eventStore: IEventStore;
  private sseBroadcaster: ISSEBroadcaster;

  // Daemon start time for uptime calculation
  private startTime: number = 0;

  /**
   * Create a new ExpressServer
   * @param dependencies Server dependencies
   * @param config Server configuration
   */
  constructor(dependencies: IServerDependencies, config?: IServerConfig) {
    this.activityStream = dependencies.activityStream;
    this.agentTracker = dependencies.agentTracker;
    this.pipelineTracker = dependencies.pipelineTracker;
    this.routingHistory = dependencies.routingHistory;
    this.eventStore = dependencies.eventStore;
    this.sseBroadcaster = dependencies.sseBroadcaster;

    // Configuration (RULE-OBS-006: Bind to localhost by default)
    this.host = config?.host || '127.0.0.1';
    this.verbose = config?.verbose || false;

    // Initialize Express app
    this.app = this.createApp();
  }

  /**
   * Create and configure Express application
   * @returns Configured Express app
   */
  private createApp(): Express {
    const app = express();

    // JSON parsing middleware
    app.use(express.json());

    // Security headers (RULE-OBS-006)
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      next();
    });

    // Request logging (if verbose)
    if (this.verbose) {
      app.use((req: Request, res: Response, next: NextFunction) => {
        console.log(`[ExpressServer] ${req.method} ${req.path}`);
        next();
      });
    }

    // Register API endpoints
    this.registerEndpoints(app);

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not Found' });
    });

    // Global error handler (RULE-OBS-003: Sanitized errors)
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (this.verbose) {
        console.error('[ExpressServer] Error:', err);
      }
      res.status(500).json({ error: 'Internal Server Error' });
    });

    return app;
  }

  /**
   * Register API endpoints
   * @param app Express application
   */
  private registerEndpoints(app: Express): void {
    // 1. Dashboard HTML (placeholder)
    app.get('/', this.serveDashboard.bind(this));

    // 2. SSE event stream
    app.get('/api/stream', this.handleSSE.bind(this));

    // 3. Historical events query
    app.get('/api/events', this.getEvents.bind(this));

    // 4. Active agents
    app.get('/api/agents', this.getAgents.bind(this));

    // 5. Active pipelines
    app.get('/api/pipelines', this.getPipelines.bind(this));

    // 6. Routing explanation
    app.get('/api/routing/:id', this.getRoutingExplanation.bind(this));

    // 7. Memory domains (placeholder)
    app.get('/api/memory/domains', this.getMemoryDomains.bind(this));

    // 8. Memory patterns (placeholder)
    app.get('/api/memory/patterns', this.getMemoryPatterns.bind(this));

    // 9. Learning stats (placeholder)
    app.get('/api/learning/stats', this.getLearningStats.bind(this));

    // 10. Prometheus metrics
    app.get('/api/metrics', this.getPrometheusMetrics.bind(this));

    // 11. Health check
    app.get('/api/health', this.healthCheck.bind(this));
  }

  // ===========================================================================
  // Endpoint Handlers
  // ===========================================================================

  /**
   * Serve dashboard HTML (placeholder)
   */
  private serveDashboard(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>God Agent Observability Dashboard</title>
</head>
<body>
  <h1>God Agent Observability Dashboard</h1>
  <p>Real-time observability dashboard (placeholder)</p>
  <ul>
    <li><a href="/api/health">Health Check</a></li>
    <li><a href="/api/events">Recent Events</a></li>
    <li><a href="/api/agents">Active Agents</a></li>
    <li><a href="/api/pipelines">Active Pipelines</a></li>
    <li><a href="/api/metrics">Prometheus Metrics</a></li>
  </ul>
</body>
</html>
    `);
  }

  /**
   * Handle SSE connection
   * Implements [REQ-OBS-09]: SSE real-time streaming
   */
  private handleSSE(req: Request, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Add client to SSE broadcaster
    const clientId = this.sseBroadcaster.addClient(res);

    // Handle client disconnect
    res.on('close', () => {
      this.sseBroadcaster.removeClient(clientId);
    });
  }

  /**
   * Get historical events with query parameters
   * Query params: limit, component, status, since, until
   */
  private async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const component = req.query.component as ActivityEventComponent | undefined;
      const status = req.query.status as ActivityEventStatus | undefined;
      const since = req.query.since ? parseInt(req.query.since as string) : undefined;
      const until = req.query.until ? parseInt(req.query.until as string) : undefined;

      const query: IEventQuery = {
        limit,
        component,
        status,
        since,
        until,
      };

      const events = await this.eventStore.query(query);

      res.setHeader('Content-Type', 'application/json');
      res.json({ events, count: events.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to query events' });
    }
  }

  /**
   * Get active agents
   */
  private getAgents(req: Request, res: Response): void {
    try {
      const agents = this.agentTracker.getActive();

      res.setHeader('Content-Type', 'application/json');
      res.json({ agents, count: agents.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get agents' });
    }
  }

  /**
   * Get active pipelines
   */
  private getPipelines(req: Request, res: Response): void {
    try {
      const pipelines = this.pipelineTracker.getActive();

      res.setHeader('Content-Type', 'application/json');
      res.json({ pipelines, count: pipelines.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pipelines' });
    }
  }

  /**
   * Get routing explanation by ID
   */
  private getRoutingExplanation(req: Request, res: Response): void {
    try {
      const routingId = req.params.id;
      const explanation = this.routingHistory.getById(routingId);

      if (!explanation) {
        res.status(404).json({ error: 'Routing decision not found' });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.json(explanation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get routing explanation' });
    }
  }

  /**
   * Get memory domains (placeholder)
   * TODO: Integrate with InteractionStore when available
   */
  private getMemoryDomains(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      domains: [],
      message: 'InteractionStore integration pending',
    });
  }

  /**
   * Get memory patterns (placeholder)
   * TODO: Integrate with ReasoningBank when available
   */
  private getMemoryPatterns(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      patterns: [],
      message: 'ReasoningBank integration pending',
    });
  }

  /**
   * Get learning statistics (placeholder)
   * TODO: Integrate with SonaEngine when available
   */
  private getLearningStats(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      totalTrajectories: 0,
      baselineQuality: 0,
      learnedQuality: 0,
      message: 'SonaEngine integration pending',
    });
  }

  /**
   * Get Prometheus metrics
   * Implements Prometheus text format
   */
  private getPrometheusMetrics(req: Request, res: Response): void {
    try {
      const now = Date.now();
      const eventStoreStats = this.eventStore.getStats();
      const activeAgents = this.agentTracker.getActive().length;
      const clientCount = this.sseBroadcaster.getClientCount();

      const metrics: string[] = [];

      // Event counters
      metrics.push('# HELP god_agent_events_total Total events in storage');
      metrics.push('# TYPE god_agent_events_total gauge');
      metrics.push(`god_agent_events_total{storage="buffer"} ${eventStoreStats.bufferSize}`);
      metrics.push(`god_agent_events_total{storage="db"} ${eventStoreStats.dbEventCount}`);

      // Active agents
      metrics.push('# HELP god_agent_active_agents Number of active agents');
      metrics.push('# TYPE god_agent_active_agents gauge');
      metrics.push(`god_agent_active_agents ${activeAgents}`);

      // SSE clients
      metrics.push('# HELP god_agent_sse_clients Number of connected SSE clients');
      metrics.push('# TYPE god_agent_sse_clients gauge');
      metrics.push(`god_agent_sse_clients ${clientCount}`);

      // Uptime
      const uptimeSeconds = Math.floor((now - this.startTime) / 1000);
      metrics.push('# HELP god_agent_uptime_seconds Daemon uptime in seconds');
      metrics.push('# TYPE god_agent_uptime_seconds counter');
      metrics.push(`god_agent_uptime_seconds ${uptimeSeconds}`);

      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics.join('\n') + '\n');
    } catch (error) {
      res.status(500).send('# Error generating metrics\n');
    }
  }

  /**
   * Health check endpoint
   * Implements [REQ-OBS-07]: Health monitoring
   */
  private healthCheck(req: Request, res: Response): void {
    const now = Date.now();
    const uptime = now - this.startTime;
    const clientCount = this.sseBroadcaster.getClientCount();
    const eventStats = this.eventStore.getStats();

    res.setHeader('Content-Type', 'application/json');
    res.json({
      status: 'healthy',
      uptime,
      clientCount,
      eventCount: eventStats.bufferSize,
      bufferUsage: (eventStats.bufferSize / eventStats.bufferCapacity) * 100,
      dbSize: eventStats.dbEventCount,
    });
  }

  // ===========================================================================
  // Server Lifecycle
  // ===========================================================================

  /**
   * Start the HTTP server
   * Implements [RULE-OBS-006]: Localhost binding
   *
   * @param port Port to listen on
   * @returns Promise resolving when server is started
   */
  public async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.startTime = Date.now();

      this.server = this.app.listen(port, this.host, () => {
        // Get the actual port (in case port 0 was used for auto-assign)
        const address = this.server?.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
        } else {
          this.port = port;
        }

        if (this.verbose) {
          console.log(`[ExpressServer] Server started on http://${this.host}:${this.port}`);
        }
        resolve();
      });

      this.server.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP server
   * @returns Promise resolving when server is stopped
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        if (this.verbose) {
          console.log('[ExpressServer] Server stopped');
        }
        this.server = null;
        this.port = 0;
        resolve();
      });
    });
  }

  /**
   * Get the Express application
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Get the current port
   */
  public getPort(): number {
    return this.port;
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default ExpressServer;
