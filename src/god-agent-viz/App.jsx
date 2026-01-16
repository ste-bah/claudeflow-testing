/**
 * God Agent Memory Visualization - React App
 * Interactive graph visualization with filtering for large datasets
 * Fetches data from backend API at http://localhost:3456
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// =============================================================================
// Configuration
// =============================================================================

const API_BASE = 'http://localhost:3456';

const NODE_COLORS = {
  agent: '#3b82f6',
  task_type: '#10b981',
  pattern: '#8b5cf6',
  trajectory: '#f59e0b',
  event: '#ef4444',
  token_usage: '#06b6d4',
  feedback: '#ec4899',
  session: '#eab308',
};

const NODE_SIZES = {
  agent: 45,
  task_type: 35,
  pattern: 28,
  trajectory: 22,
  event: 20,
  token_usage: 18,
  feedback: 20,
  session: 30,
};

const NODE_LABELS = {
  agent: 'Agent',
  task_type: 'Task Type',
  pattern: 'Pattern',
  trajectory: 'Trajectory',
  event: 'Event',
  token_usage: 'Token Usage',
  feedback: 'Feedback',
  session: 'Session',
};

// =============================================================================
// Cytoscape Styles
// =============================================================================

const cytoscapeStyles = [
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#e2e8f0',
      'font-size': '10px',
      'text-wrap': 'ellipsis',
      'text-max-width': '80px',
      'background-opacity': 0.9,
      'border-width': 2,
      'border-opacity': 0.8,
    },
  },
  { selector: 'node[type="agent"]', style: { 'background-color': NODE_COLORS.agent, 'border-color': '#60a5fa', 'width': NODE_SIZES.agent, 'height': NODE_SIZES.agent, 'font-weight': 600 }},
  { selector: 'node[type="task_type"]', style: { 'background-color': NODE_COLORS.task_type, 'border-color': '#34d399', 'width': NODE_SIZES.task_type, 'height': NODE_SIZES.task_type }},
  { selector: 'node[type="pattern"]', style: { 'background-color': NODE_COLORS.pattern, 'border-color': '#a78bfa', 'width': NODE_SIZES.pattern, 'height': NODE_SIZES.pattern, 'font-size': '8px' }},
  { selector: 'node[type="trajectory"]', style: { 'background-color': NODE_COLORS.trajectory, 'border-color': '#fbbf24', 'width': NODE_SIZES.trajectory, 'height': NODE_SIZES.trajectory, 'font-size': '7px' }},
  { selector: 'node[type="event"]', style: { 'background-color': NODE_COLORS.event, 'border-color': '#f87171', 'width': NODE_SIZES.event, 'height': NODE_SIZES.event, 'font-size': '7px' }},
  { selector: 'node[type="token_usage"]', style: { 'background-color': NODE_COLORS.token_usage, 'border-color': '#22d3ee', 'width': NODE_SIZES.token_usage, 'height': NODE_SIZES.token_usage, 'font-size': '6px' }},
  { selector: 'node[type="feedback"]', style: { 'background-color': NODE_COLORS.feedback, 'border-color': '#f472b6', 'width': NODE_SIZES.feedback, 'height': NODE_SIZES.feedback, 'font-size': '7px' }},
  { selector: 'node[type="session"]', style: { 'background-color': NODE_COLORS.session, 'border-color': '#facc15', 'width': NODE_SIZES.session, 'height': NODE_SIZES.session, 'font-size': '8px' }},
  { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#ffffff', 'background-opacity': 1 }},
  { selector: 'node:active', style: { 'overlay-opacity': 0.2, 'overlay-color': '#ffffff' }},
  { selector: 'edge', style: { 'width': 'data(weight)', 'line-color': '#475569', 'target-arrow-color': '#475569', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'opacity': 0.6 }},
  { selector: 'edge[type="performs"]', style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6' }},
  { selector: 'edge[type="matches"]', style: { 'line-color': '#8b5cf6', 'target-arrow-color': '#8b5cf6' }},
  { selector: 'edge[type="learned"]', style: { 'line-color': '#10b981', 'target-arrow-color': '#10b981', 'line-style': 'dashed' }},
  { selector: 'edge[type="belongs_to"]', style: { 'line-color': '#f59e0b', 'target-arrow-color': '#f59e0b' }},
  { selector: 'edge[type="has_event"]', style: { 'line-color': '#ef4444', 'target-arrow-color': '#ef4444' }},
  { selector: 'edge[type="has_token"]', style: { 'line-color': '#06b6d4', 'target-arrow-color': '#06b6d4' }},
  { selector: 'edge[type="has_feedback"]', style: { 'line-color': '#ec4899', 'target-arrow-color': '#ec4899' }},
  { selector: 'edge[type="in_session"]', style: { 'line-color': '#eab308', 'target-arrow-color': '#eab308' }},
  { selector: 'edge:selected', style: { 'opacity': 1, 'width': 3 }},
];

// =============================================================================
// FilterPanel Component
// =============================================================================

function FilterPanel({ filters, filterOptions, onFilterChange, onApply, isLoading }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className={`filter-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="filter-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="filter-title">Filters</span>
        <span className="filter-toggle">{isCollapsed ? '+' : '-'}</span>
      </div>

      {!isCollapsed && (
        <div className="filter-content">
          <div className="filter-row">
            <div className="filter-group">
              <label>Trajectories</label>
              <select
                value={filters.includeTrajectories}
                onChange={(e) => onFilterChange('includeTrajectories', e.target.value)}
              >
                <option value="all">All</option>
                <option value="top50">Top 50</option>
                <option value="top100">Top 100</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="filter-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={filters.includeEvents}
                  onChange={(e) => onFilterChange('includeEvents', e.target.checked)}
                />
                Events
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filters.includeTokenUsage}
                  onChange={(e) => onFilterChange('includeTokenUsage', e.target.checked)}
                />
                Token Usage
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filters.includeFeedback}
                  onChange={(e) => onFilterChange('includeFeedback', e.target.checked)}
                />
                Feedback
              </label>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>Task Type</label>
              <select
                value={filters.taskType}
                onChange={(e) => onFilterChange('taskType', e.target.value)}
              >
                <option value="">All Types</option>
                {filterOptions.taskTypes?.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => onFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                {filterOptions.statuses?.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Agent</label>
              <select
                value={filters.agentId}
                onChange={(e) => onFilterChange('agentId', e.target.value)}
              >
                <option value="">All Agents</option>
                {filterOptions.agents?.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>Date From</label>
              <input
                type="date"
                value={filters.dateFrom ? formatDate(filters.dateFrom) : ''}
                onChange={(e) => onFilterChange('dateFrom', e.target.value ? new Date(e.target.value).getTime() : null)}
              />
            </div>

            <div className="filter-group">
              <label>Date To</label>
              <input
                type="date"
                value={filters.dateTo ? formatDate(filters.dateTo) : ''}
                onChange={(e) => onFilterChange('dateTo', e.target.value ? new Date(e.target.value).getTime() : null)}
              />
            </div>

            <div className="filter-group">
              <label>Limit</label>
              <input
                type="number"
                min="10"
                max="2000"
                value={filters.limit}
                onChange={(e) => onFilterChange('limit', parseInt(e.target.value) || 500)}
              />
            </div>

            <div className="filter-group filter-actions">
              <button
                className="btn btn-primary"
                onClick={onApply}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
          </div>

          {filterOptions.counts && (
            <div className="filter-counts">
              <span>Available: {filterOptions.counts.trajectories || 0} trajectories</span>
              <span>{filterOptions.counts.events || 0} events</span>
              <span>{filterOptions.counts.feedback || 0} feedback</span>
              <span>{filterOptions.counts.tokenUsage || 0} token records</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NodeDetails Component
// =============================================================================

function NodeDetails({ node, connections }) {
  if (!node) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128269;</div>
        <h3>No Node Selected</h3>
        <p>Click on a node in the graph to view its details and connections.</p>
      </div>
    );
  }

  const { type, label, metadata } = node;

  const formatValue = (key, value) => {
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('quality') || key.toLowerCase().includes('score')) {
        return value.toFixed(2);
      }
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
  };

  const metadataEntries = Object.entries(metadata || {}).filter(
    ([key]) => !['id', 'type', 'label'].includes(key)
  );

  const displayConnections = connections.slice(0, 50);
  const hasMoreConnections = connections.length > 50;

  return (
    <div className="node-details">
      <span className={`node-type-badge ${type}`}>{type.replace('_', ' ')}</span>
      <div className="node-label">{label}</div>

      {metadataEntries.length > 0 && (
        <div className="metadata-section">
          <div className="metadata-title">Metadata</div>
          <div className="metadata-grid">
            {metadataEntries.slice(0, 20).map(([key, value]) => (
              <div
                key={key}
                className={`metadata-item ${String(value).length > 20 ? 'full-width' : ''}`}
              >
                <div className="metadata-key">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="metadata-value">{formatValue(key, value)}</div>
              </div>
            ))}
          </div>
          {metadataEntries.length > 20 && (
            <div className="metadata-more">+{metadataEntries.length - 20} more fields</div>
          )}
        </div>
      )}

      {connections && connections.length > 0 && (
        <div className="connections-section">
          <div className="metadata-title">Connections ({connections.length})</div>
          {displayConnections.map((conn, idx) => (
            <div key={idx} className="connection-item">
              <span className={`connection-dot ${conn.nodeType}`}></span>
              <span className="connection-label">{conn.label}</span>
              <span className="connection-type">{conn.edgeType}</span>
            </div>
          ))}
          {hasMoreConnections && (
            <div className="connections-more">+{connections.length - 50} more connections</div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Legend Component with Counts
// =============================================================================

function Legend({ nodeCounts }) {
  const types = Object.keys(NODE_COLORS);

  return (
    <div className="legend">
      <div className="legend-title">Node Types</div>
      <div className="legend-items">
        {types.map(type => {
          const count = nodeCounts[type] || 0;
          if (count === 0 && !['agent', 'task_type', 'pattern', 'trajectory'].includes(type)) {
            return null;
          }
          return (
            <div key={type} className="legend-item">
              <span className={`legend-dot ${type}`}></span>
              <span>{NODE_LABELS[type]}</span>
              <span className="legend-count">({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Loading Overlay Component
// =============================================================================

function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay">
      <div className="spinner"></div>
      <p>{message || 'Loading...'}</p>
    </div>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function App() {
  const cyRef = useRef(null);
  const containerRef = useRef(null);

  const [graphData, setGraphData] = useState(null);
  const [stats, setStats] = useState(null);
  const [filterOptions, setFilterOptions] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    includeTrajectories: 'top100',
    includeEvents: false,
    includeTokenUsage: false,
    includeFeedback: false,
    taskType: '',
    status: '',
    agentId: '',
    dateFrom: null,
    dateTo: null,
    limit: 500,
  });

  // Calculate node counts
  const nodeCounts = useMemo(() => {
    if (!graphData?.nodes) return {};
    const counts = {};
    graphData.nodes.forEach(node => {
      counts[node.type] = (counts[node.type] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  // Build query string from filters
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('includeTrajectories', filters.includeTrajectories);
    params.set('includeEvents', filters.includeEvents.toString());
    params.set('includeTokenUsage', filters.includeTokenUsage.toString());
    params.set('includeFeedback', filters.includeFeedback.toString());
    if (filters.taskType) params.set('taskType', filters.taskType);
    if (filters.status) params.set('status', filters.status);
    if (filters.agentId) params.set('agentId', filters.agentId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toString());
    if (filters.dateTo) params.set('dateTo', filters.dateTo.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    return params.toString();
  }, [filters]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/filters`);
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (err) {
      console.warn('Could not fetch filter options:', err);
    }
  }, []);

  // Fetch graph data with filters
  const fetchData = useCallback(async (showOverlay = false) => {
    if (showOverlay) {
      setGraphLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const queryString = buildQueryString();
      const [graphRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/graph?${queryString}`),
        fetch(`${API_BASE}/api/stats`),
      ]);

      if (!graphRes.ok) throw new Error(`Graph API error: ${graphRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats API error: ${statsRes.status}`);

      const [graphJson, statsJson] = await Promise.all([
        graphRes.json(),
        statsRes.json(),
      ]);

      setGraphData(graphJson);
      setStats(statsJson);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setGraphLoading(false);
    }
  }, [buildQueryString]);

  // Initial load
  useEffect(() => {
    fetchFilterOptions();
    fetchData();
  }, []);

  // Get optimized layout settings based on node count
  const getLayoutSettings = useCallback((nodeCount) => {
    if (nodeCount > 500) {
      return {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 30,
        nodeRepulsion: 4000,
        idealEdgeLength: 50,
        edgeElasticity: 50,
        nestingFactor: 5,
        gravity: 100,
        numIter: 300,
        initialTemp: 150,
        coolingFactor: 0.99,
        minTemp: 1.0,
      };
    } else if (nodeCount > 300) {
      return {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 40,
        nodeRepulsion: 6000,
        idealEdgeLength: 80,
        edgeElasticity: 80,
        nestingFactor: 5,
        gravity: 90,
        numIter: 500,
        initialTemp: 180,
        coolingFactor: 0.97,
        minTemp: 1.0,
      };
    } else {
      return {
        name: 'cose',
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 50,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      };
    }
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Transform data for Cytoscape
    const elements = [
      ...graphData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label.length > 25 ? node.label.substring(0, 22) + '...' : node.label,
          fullLabel: node.label,
          type: node.type,
          ...node.metadata,
        },
      })),
      ...graphData.edges.map((edge, idx) => ({
        data: {
          id: `edge-${idx}`,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: Math.max(1, Math.min(5, Math.log10((edge.weight || 1) + 1) * 2)),
        },
      })),
    ];

    const layoutSettings = getLayoutSettings(graphData.nodes.length);

    // Initialize Cytoscape
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: cytoscapeStyles,
      layout: layoutSettings,
      minZoom: 0.05,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    // Node click handler
    cyRef.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = {
        id: node.data('id'),
        type: node.data('type'),
        label: node.data('fullLabel') || node.data('label'),
        metadata: { ...node.data() },
      };
      delete nodeData.metadata.id;
      delete nodeData.metadata.label;
      delete nodeData.metadata.fullLabel;
      delete nodeData.metadata.type;

      setSelectedNode(nodeData);

      // Get connections
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes().filter(n => n.id() !== node.id());

      const conns = connectedNodes.map(n => {
        const edge = connectedEdges.filter(e =>
          e.source().id() === n.id() || e.target().id() === n.id()
        ).first();

        return {
          nodeId: n.data('id'),
          nodeType: n.data('type'),
          label: n.data('fullLabel') || n.data('label'),
          edgeType: edge ? edge.data('type') : 'unknown',
        };
      });

      setConnections(conns);
    });

    // Background click - deselect
    cyRef.current.on('tap', (evt) => {
      if (evt.target === cyRef.current) {
        setSelectedNode(null);
        setConnections([]);
      }
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, getLayoutSettings]);

  // Filter change handler
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Control handlers
  const handleFit = () => cyRef.current?.fit(50);
  const handleRefresh = () => fetchData(true);
  const handleRelayout = () => {
    if (!cyRef.current || !graphData) return;
    const layoutSettings = getLayoutSettings(graphData.nodes.length);
    cyRef.current.layout(layoutSettings).run();
  };

  // Loading state
  if (loading) {
    return (
      <div className="app-container">
        <div className="graph-container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading graph data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app-container">
        <div className="graph-container">
          <div className="error-state">
            <h3>Failed to Load Data</h3>
            <p>{error}</p>
            <p style={{ marginTop: '12px' }}>Make sure the API server is running at {API_BASE}</p>
            <button className="btn btn-primary" onClick={() => fetchData()} style={{ marginTop: '16px' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="graph-container">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          onApply={handleApplyFilters}
          isLoading={graphLoading}
        />

        {/* Header with stats */}
        <div className="header">
          <h1>God Agent Memory Graph</h1>
          {stats && (
            <div className="header-stats">
              <div className="stat-item">
                <div className="stat-value">{graphData?.nodes?.length || 0}</div>
                <div className="stat-label">Nodes</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{graphData?.edges?.length || 0}</div>
                <div className="stat-label">Edges</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.agents?.length || 0}</div>
                <div className="stat-label">Agents</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.patterns?.total || 0}</div>
                <div className="stat-label">Patterns</div>
              </div>
            </div>
          )}
        </div>

        {/* Cytoscape container */}
        <div id="cy" ref={containerRef}></div>

        {/* Loading overlay */}
        {graphLoading && <LoadingOverlay message="Applying filters..." />}

        {/* Controls */}
        <div className="controls">
          <button className="btn btn-primary" onClick={handleFit}>Fit View</button>
          <button className="btn btn-secondary" onClick={handleRelayout}>Re-Layout</button>
          <button className="btn btn-secondary" onClick={handleRefresh}>Refresh</button>
        </div>

        {/* Legend with counts */}
        <Legend nodeCounts={nodeCounts} />
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Node Details</h2>
          <p>Click a node to view its properties</p>
        </div>
        <div className="sidebar-content">
          <NodeDetails node={selectedNode} connections={connections} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Render
// =============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
