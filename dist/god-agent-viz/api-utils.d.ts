/**
 * God Agent Visualization API Utilities
 *
 * Helper functions for query building, filtering, and data transformation.
 * Extracted to keep main server.ts under 800 lines.
 */
import type Database from 'better-sqlite3';
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
export declare function parseGraphQueryParams(query: Record<string, any>): GraphQueryParams;
export declare function buildTrajectoryQuery(params: GraphQueryParams): {
    sql: string;
    args: any[];
};
export declare function buildEventsQuery(params: GraphQueryParams): {
    sql: string;
    args: any[];
};
export declare function buildTokenUsageQuery(params: GraphQueryParams & {
    sessionId?: string;
    trajectoryId?: string;
}): {
    sql: string;
    args: any[];
};
export declare function buildFeedbackQuery(params: GraphQueryParams & {
    outcome?: string;
}): {
    sql: string;
    args: any[];
};
export declare function createEventNode(event: EventData): GraphNode;
export declare function createTokenUsageNode(usage: TokenUsageData): GraphNode;
export declare function createFeedbackNode(feedback: FeedbackData): GraphNode;
export declare function createSessionNode(sessionId: string, stats: {
    tokenCount: number;
    totalTokens: number;
}): GraphNode;
export declare function getFilterOptions(learningDb: Database.Database | null, eventsDb: Database.Database | null): FilterOptions;
export declare function computeGraphStats(nodes: GraphNode[], edges: GraphEdge[]): {
    nodeCount: number;
    edgeCount: number;
    byType: Record<string, number>;
};
//# sourceMappingURL=api-utils.d.ts.map