/**
 * StatsPanel Component
 *
 * Displays comprehensive statistics about the graph including node/edge counts,
 * type distributions, graph metrics (density, components), and database stats.
 *
 * @module components/panels/StatsPanel
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useGraphStore, selectNodes, selectEdges } from '../../stores/graphStore';
import { useDatabaseStore, selectEventCount, selectMemoryEntryCount, selectSessionCount } from '../../stores/databaseStore';
import type { GraphNode, GraphEdge, NodeType, EdgeType } from '../../types/graph';

// ============================================================================
// Types
// ============================================================================

interface StatsPanelProps {
  /** Additional CSS class name */
  className?: string;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Whether to show database statistics section */
  showDatabaseStats?: boolean;
}

interface NodeTypeCount {
  type: NodeType | string;
  count: number;
  percentage: number;
  color: string;
}

interface EdgeTypeCount {
  type: EdgeType | string;
  count: number;
  percentage: number;
}

interface MostConnectedNode {
  id: string;
  label: string;
  type: NodeType | string;
  degree: number;
}

interface GraphMetrics {
  density: number;
  connectedComponents: number;
  averageDegree: number;
  maxDegree: number;
  isolatedNodes: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Node type colors matching the requirements specification */
const NODE_TYPE_COLORS: Record<string, string> = {
  trajectory: '#3B82F6',
  pattern: '#10B981',
  episode: '#8B5CF6',
  feedback: '#F59E0B',
  reasoning_step: '#EC4899',
  checkpoint: '#6366F1',
  session: '#06B6D4',
  agent: '#F97316',
  namespace: '#64748B',
};

/** Node type display labels */
const NODE_TYPE_LABELS: Record<string, string> = {
  trajectory: 'Trajectory',
  pattern: 'Pattern',
  episode: 'Episode',
  feedback: 'Feedback',
  reasoning_step: 'Reasoning Step',
  checkpoint: 'Checkpoint',
  session: 'Session',
  agent: 'Agent',
  namespace: 'Namespace',
};

/** Edge type display labels */
const EDGE_TYPE_LABELS: Record<string, string> = {
  uses_pattern: 'Uses Pattern',
  creates_pattern: 'Creates Pattern',
  linked_to: 'Linked To',
  informed_by_feedback: 'Informed By Feedback',
  belongs_to_route: 'Belongs To Route',
  has_step: 'Has Step',
  has_checkpoint: 'Has Checkpoint',
  temporal: 'Temporal',
  membership: 'Membership',
  reference: 'Reference',
  similarity: 'Similarity',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate node type distribution
 */
function calculateNodeTypeCounts(nodes: GraphNode[]): NodeTypeCount[] {
  const typeCounts = new Map<string, number>();

  for (const node of nodes) {
    const count = typeCounts.get(node.type) || 0;
    typeCounts.set(node.type, count + 1);
  }

  const total = nodes.length;
  const result: NodeTypeCount[] = [];

  for (const [type, count] of typeCounts) {
    result.push({
      type,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: NODE_TYPE_COLORS[type] || '#6B7280',
    });
  }

  // Sort by count descending
  result.sort((a, b) => b.count - a.count);

  return result;
}

/**
 * Calculate edge type distribution
 */
function calculateEdgeTypeCounts(edges: GraphEdge[]): EdgeTypeCount[] {
  const typeCounts = new Map<string, number>();

  for (const edge of edges) {
    const count = typeCounts.get(edge.type) || 0;
    typeCounts.set(edge.type, count + 1);
  }

  const total = edges.length;
  const result: EdgeTypeCount[] = [];

  for (const [type, count] of typeCounts) {
    result.push({
      type,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    });
  }

  // Sort by count descending
  result.sort((a, b) => b.count - a.count);

  return result;
}

/**
 * Calculate node degrees (number of connected edges)
 */
function calculateNodeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();

  // Initialize all nodes with degree 0
  for (const node of nodes) {
    degrees.set(node.id, 0);
  }

  // Count edges for each node
  for (const edge of edges) {
    const sourceDegree = degrees.get(edge.source) || 0;
    const targetDegree = degrees.get(edge.target) || 0;
    degrees.set(edge.source, sourceDegree + 1);
    degrees.set(edge.target, targetDegree + 1);
  }

  return degrees;
}

/**
 * Find connected components using BFS
 */
function findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) return 0;

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.source);
    const targetNeighbors = adjacency.get(edge.target);
    if (sourceNeighbors) sourceNeighbors.add(edge.target);
    if (targetNeighbors) targetNeighbors.add(edge.source);
  }

  // BFS to find components
  const visited = new Set<string>();
  let componentCount = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    // Start new component
    componentCount++;
    const queue = [node.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      const neighbors = adjacency.get(currentId) || new Set();

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }
  }

  return componentCount;
}

/**
 * Calculate graph metrics
 */
function calculateGraphMetrics(nodes: GraphNode[], edges: GraphEdge[]): GraphMetrics {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Calculate density: ratio of actual edges to possible edges
  // For undirected graph: density = 2E / (N * (N - 1))
  const maxPossibleEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

  // Calculate degrees
  const degrees = calculateNodeDegrees(nodes, edges);

  // Calculate average and max degree
  let totalDegree = 0;
  let maxDegree = 0;
  let isolatedNodes = 0;

  for (const degree of degrees.values()) {
    totalDegree += degree;
    if (degree > maxDegree) maxDegree = degree;
    if (degree === 0) isolatedNodes++;
  }

  const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

  // Find connected components
  const connectedComponents = findConnectedComponents(nodes, edges);

  return {
    density,
    connectedComponents,
    averageDegree,
    maxDegree,
    isolatedNodes,
  };
}

/**
 * Find the most connected nodes
 */
function findMostConnectedNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  limit: number = 5
): MostConnectedNode[] {
  const degrees = calculateNodeDegrees(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const nodesWithDegrees: MostConnectedNode[] = [];

  for (const [nodeId, degree] of degrees) {
    const node = nodeMap.get(nodeId);
    if (node && degree > 0) {
      nodesWithDegrees.push({
        id: node.id,
        label: node.label,
        type: node.type,
        degree,
      });
    }
  }

  // Sort by degree descending and take top N
  nodesWithDegrees.sort((a, b) => b.degree - a.degree);

  return nodesWithDegrees.slice(0, limit);
}

/**
 * Format a number with comma separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format a percentage
 */
function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate data freshness
 */
function calculateDataFreshness(loadedAt: Date | string | null): {
  label: string;
  status: 'fresh' | 'stale' | 'old' | 'unknown';
  minutesAgo: number;
} {
  if (!loadedAt) {
    return { label: 'No data loaded', status: 'unknown', minutesAgo: -1 };
  }

  const loadedDate = typeof loadedAt === 'string' ? new Date(loadedAt) : loadedAt;
  const now = new Date();
  const diffMs = now.getTime() - loadedDate.getTime();
  const minutesAgo = Math.floor(diffMs / (1000 * 60));

  if (minutesAgo < 5) {
    return { label: 'Just now', status: 'fresh', minutesAgo };
  } else if (minutesAgo < 30) {
    return { label: `${minutesAgo}m ago`, status: 'fresh', minutesAgo };
  } else if (minutesAgo < 60) {
    return { label: `${minutesAgo}m ago`, status: 'stale', minutesAgo };
  } else if (minutesAgo < 1440) {
    const hours = Math.floor(minutesAgo / 60);
    return { label: `${hours}h ago`, status: 'stale', minutesAgo };
  } else {
    const days = Math.floor(minutesAgo / 1440);
    return { label: `${days}d ago`, status: 'old', minutesAgo };
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Mini bar chart for type distributions
 */
const MiniBarChart: React.FC<{
  items: Array<{ label: string; value: number; percentage: number; color?: string }>;
  maxItems?: number;
}> = ({ items, maxItems = 6 }) => {
  const displayItems = items.slice(0, maxItems);
  const maxValue = Math.max(...displayItems.map(i => i.value), 1);

  return (
    <div className="stats-panel__mini-chart">
      {displayItems.map((item) => (
        <div key={item.label} className="stats-panel__mini-chart-item">
          <div className="stats-panel__mini-chart-label">
            <span
              className="stats-panel__mini-chart-dot"
              style={{ backgroundColor: item.color || 'var(--color-primary)' }}
            />
            <span className="stats-panel__mini-chart-name">{item.label}</span>
          </div>
          <div className="stats-panel__mini-chart-bar-container">
            <div
              className="stats-panel__mini-chart-bar"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color || 'var(--color-primary)',
              }}
            />
          </div>
          <span className="stats-panel__mini-chart-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Progress metric with label and value
 */
const ProgressMetric: React.FC<{
  label: string;
  value: number;
  max: number;
  format?: (value: number) => string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}> = ({ label, value, max, format, variant = 'default' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const displayValue = format ? format(value) : value.toString();

  return (
    <div className="stats-panel__progress-metric">
      <div className="stats-panel__progress-header">
        <span className="stats-panel__progress-label">{label}</span>
        <span className="stats-panel__progress-value">{displayValue}</span>
      </div>
      <div className="stats-panel__progress-bar-container">
        <div
          className={`stats-panel__progress-bar stats-panel__progress-bar--${variant}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Stat card for key metrics
 */
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, sublabel, icon, trend }) => {
  return (
    <div className="stats-panel__stat-card">
      {icon && <div className="stats-panel__stat-icon">{icon}</div>}
      <div className="stats-panel__stat-content">
        <div className="stats-panel__stat-value">
          {value}
          {trend && (
            <span className={`stats-panel__stat-trend stats-panel__stat-trend--${trend}`}>
              {trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2194'}
            </span>
          )}
        </div>
        <div className="stats-panel__stat-label">{label}</div>
        {sublabel && <div className="stats-panel__stat-sublabel">{sublabel}</div>}
      </div>
    </div>
  );
};

/**
 * Most connected nodes list
 */
const MostConnectedList: React.FC<{
  nodes: MostConnectedNode[];
  onNodeClick?: (nodeId: string) => void;
}> = ({ nodes, onNodeClick }) => {
  if (nodes.length === 0) {
    return (
      <div className="stats-panel__empty-list">
        No connected nodes
      </div>
    );
  }

  return (
    <div className="stats-panel__connected-list">
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className="stats-panel__connected-item"
          onClick={() => onNodeClick?.(node.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onNodeClick?.(node.id);
            }
          }}
        >
          <span className="stats-panel__connected-rank">#{index + 1}</span>
          <span
            className="stats-panel__connected-dot"
            style={{ backgroundColor: NODE_TYPE_COLORS[node.type] || '#6B7280' }}
          />
          <span className="stats-panel__connected-label" title={node.label}>
            {node.label.length > 20 ? `${node.label.substring(0, 20)}...` : node.label}
          </span>
          <span className="stats-panel__connected-degree">{node.degree}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Data freshness indicator
 */
const FreshnessIndicator: React.FC<{
  loadedAt: Date | string | null;
}> = ({ loadedAt }) => {
  const [freshness, setFreshness] = useState(() => calculateDataFreshness(loadedAt));

  // Update freshness periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setFreshness(calculateDataFreshness(loadedAt));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [loadedAt]);

  // Update immediately when loadedAt changes
  useEffect(() => {
    setFreshness(calculateDataFreshness(loadedAt));
  }, [loadedAt]);

  return (
    <div className={`stats-panel__freshness stats-panel__freshness--${freshness.status}`}>
      <span className="stats-panel__freshness-dot" />
      <span className="stats-panel__freshness-label">{freshness.label}</span>
    </div>
  );
};

/**
 * Collapsible section
 */
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
}> = ({ title, children, defaultExpanded = true, badge }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="stats-panel__section">
      <button
        className="stats-panel__section-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="stats-panel__section-title">{title}</span>
        {badge && <span className="stats-panel__section-badge">{badge}</span>}
        <span className={`stats-panel__section-chevron ${isExpanded ? 'stats-panel__section-chevron--expanded' : ''}`}>
          {'\u25BC'}
        </span>
      </button>
      {isExpanded && (
        <div className="stats-panel__section-content">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * StatsPanel displays comprehensive statistics about the graph
 */
export const StatsPanel: React.FC<StatsPanelProps> = ({
  className = '',
  refreshInterval = 0,
  showDatabaseStats = true,
}) => {
  // Graph store state
  const nodes = useGraphStore(selectNodes);
  const edges = useGraphStore(selectEdges);
  const selectNode = useGraphStore(state => state.selectNode);
  const setFocusedNode = useGraphStore(state => state.setFocusedNode);

  // Database store state
  const eventCount = useDatabaseStore(selectEventCount);
  const memoryEntryCount = useDatabaseStore(selectMemoryEntryCount);
  const sessionCount = useDatabaseStore(selectSessionCount);
  const connection = useDatabaseStore(state => state.connection);

  // Auto-refresh state
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Calculate all statistics
  const nodeTypeCounts = useMemo(() => calculateNodeTypeCounts(nodes), [nodes]);
  const edgeTypeCounts = useMemo(() => calculateEdgeTypeCounts(edges), [edges]);
  const graphMetrics = useMemo(() => calculateGraphMetrics(nodes, edges), [nodes, edges]);
  const mostConnectedNodes = useMemo(() => findMostConnectedNodes(nodes, edges, 5), [nodes, edges]);

  // Format node type counts for mini chart
  const nodeTypeChartData = useMemo(() => {
    return nodeTypeCounts.map(tc => ({
      label: NODE_TYPE_LABELS[tc.type] || tc.type,
      value: tc.count,
      percentage: tc.percentage,
      color: tc.color,
    }));
  }, [nodeTypeCounts]);

  // Format edge type counts for mini chart
  const edgeTypeChartData = useMemo(() => {
    return edgeTypeCounts.map(ec => ({
      label: EDGE_TYPE_LABELS[ec.type] || ec.type,
      value: ec.count,
      percentage: ec.percentage,
      color: 'var(--color-primary)',
    }));
  }, [edgeTypeCounts]);

  // Handle node click from most connected list
  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
    setFocusedNode(nodeId);
  }, [selectNode, setFocusedNode]);

  // Auto-refresh effect
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  return (
    <div className={`stats-panel ${className}`}>
      {/* Header */}
      <div className="stats-panel__header">
        <h3 className="stats-panel__title">Graph Statistics</h3>
        <FreshnessIndicator loadedAt={connection.loadedAt} />
      </div>

      {/* Overview Cards */}
      <div className="stats-panel__overview">
        <StatCard
          label="Nodes"
          value={formatNumber(totalNodes)}
          sublabel={`${nodeTypeCounts.length} types`}
          icon={<span className="stats-panel__icon">&#9679;</span>}
        />
        <StatCard
          label="Edges"
          value={formatNumber(totalEdges)}
          sublabel={`${edgeTypeCounts.length} types`}
          icon={<span className="stats-panel__icon">&#8594;</span>}
        />
      </div>

      {/* Graph Metrics Section */}
      <Section title="Graph Metrics" badge={formatPercentage(graphMetrics.density * 100, 2)}>
        <div className="stats-panel__metrics-grid">
          <ProgressMetric
            label="Density"
            value={graphMetrics.density * 100}
            max={100}
            format={(v) => formatPercentage(v, 2)}
            variant={graphMetrics.density > 0.5 ? 'success' : graphMetrics.density > 0.1 ? 'warning' : 'default'}
          />
          <ProgressMetric
            label="Avg. Degree"
            value={graphMetrics.averageDegree}
            max={graphMetrics.maxDegree || 1}
            format={(v) => v.toFixed(1)}
          />
        </div>
        <div className="stats-panel__metrics-list">
          <div className="stats-panel__metric-row">
            <span className="stats-panel__metric-label">Connected Components</span>
            <span className="stats-panel__metric-value">{graphMetrics.connectedComponents}</span>
          </div>
          <div className="stats-panel__metric-row">
            <span className="stats-panel__metric-label">Max Degree</span>
            <span className="stats-panel__metric-value">{graphMetrics.maxDegree}</span>
          </div>
          <div className="stats-panel__metric-row">
            <span className="stats-panel__metric-label">Isolated Nodes</span>
            <span className="stats-panel__metric-value">{graphMetrics.isolatedNodes}</span>
          </div>
        </div>
      </Section>

      {/* Node Types Section */}
      <Section title="Node Types" badge={formatNumber(totalNodes)}>
        {nodeTypeChartData.length > 0 ? (
          <MiniBarChart items={nodeTypeChartData} maxItems={8} />
        ) : (
          <div className="stats-panel__empty">No nodes loaded</div>
        )}
      </Section>

      {/* Edge Types Section */}
      <Section title="Edge Types" badge={formatNumber(totalEdges)} defaultExpanded={false}>
        {edgeTypeChartData.length > 0 ? (
          <MiniBarChart items={edgeTypeChartData} maxItems={8} />
        ) : (
          <div className="stats-panel__empty">No edges loaded</div>
        )}
      </Section>

      {/* Most Connected Nodes Section */}
      <Section title="Most Connected" badge="Top 5" defaultExpanded={false}>
        <MostConnectedList
          nodes={mostConnectedNodes}
          onNodeClick={handleNodeClick}
        />
      </Section>

      {/* Database Stats Section */}
      {showDatabaseStats && (
        <Section title="Database" defaultExpanded={false}>
          <div className="stats-panel__db-stats">
            <div className="stats-panel__db-stat">
              <span className="stats-panel__db-stat-label">Events</span>
              <span className="stats-panel__db-stat-value">{formatNumber(eventCount)}</span>
            </div>
            <div className="stats-panel__db-stat">
              <span className="stats-panel__db-stat-label">Memory Entries</span>
              <span className="stats-panel__db-stat-value">{formatNumber(memoryEntryCount)}</span>
            </div>
            <div className="stats-panel__db-stat">
              <span className="stats-panel__db-stat-label">Sessions</span>
              <span className="stats-panel__db-stat-value">{formatNumber(sessionCount)}</span>
            </div>
            {connection.fileName && (
              <div className="stats-panel__db-stat stats-panel__db-stat--full">
                <span className="stats-panel__db-stat-label">Database</span>
                <span className="stats-panel__db-stat-value stats-panel__db-stat-value--truncate" title={connection.fileName}>
                  {connection.fileName}
                </span>
              </div>
            )}
            {connection.fileSize > 0 && (
              <div className="stats-panel__db-stat">
                <span className="stats-panel__db-stat-label">Size</span>
                <span className="stats-panel__db-stat-value">
                  {(connection.fileSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Last Updated */}
      {refreshInterval > 0 && (
        <div className="stats-panel__footer">
          <span className="stats-panel__last-updated">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
