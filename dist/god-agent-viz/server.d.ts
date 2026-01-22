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
import express, { Express } from 'express';
import { GraphData, GraphQueryParams } from './api-utils.js';
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
/**
 * GET /api/graph - Returns full graph data as nodes + edges
 * Supports filtering via query params for expanded data access.
 */
declare function getGraphData(params?: GraphQueryParams): GraphData;
declare function getAgents(): Array<{
    id: string;
    taskCount: number;
    avgQuality: number;
}>;
declare function getTaskTypes(): Array<{
    id: string;
    feedbackCount: number;
    avgQuality: number;
}>;
declare function getStats(): StatsData;
declare function createServer(): Express;
declare const app: express.Express;
export { app, createServer, getGraphData, getAgents, getTaskTypes, getStats };
//# sourceMappingURL=server.d.ts.map