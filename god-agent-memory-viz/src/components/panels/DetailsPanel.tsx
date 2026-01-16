/**
 * DetailsPanel Component
 *
 * Shows detailed information about selected nodes and edges in the graph.
 * Displays type-specific fields, timestamps, and allows copying IDs.
 *
 * @module components/panels/DetailsPanel
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useGraphStore, selectSelectedNodes, selectSelectedEdges } from '../../stores/graphStore';
import type { GraphNode, GraphEdge, NodeType, EdgeType } from '../../types/graph';

// ============================================================================
// Types
// ============================================================================

interface DetailsPanelProps {
  /** Additional CSS class name */
  className?: string;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Whether to show the header */
  showHeader?: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

/** Node type colors matching the constitution specification */
const NODE_TYPE_COLORS: Record<NodeType | string, string> = {
  trajectory: 'var(--node-trajectory, #f59e0b)',
  pattern: 'var(--node-pattern, #ec4899)',
  episode: 'var(--node-episode, #14b8a6)',
  feedback: 'var(--node-feedback, #22c55e)',
  reasoning_step: 'var(--node-reasoning-step, #3b82f6)',
  checkpoint: 'var(--node-checkpoint, #8b5cf6)',
  session: 'var(--node-session, #6366f1)',
  agent: 'var(--node-agent, #f97316)',
  namespace: 'var(--node-namespace, #64748b)',
};

/** Node type icons (using Unicode symbols for simplicity) */
const NODE_TYPE_ICONS: Record<NodeType | string, string> = {
  trajectory: '\u2192', // Arrow
  pattern: '\u2727', // Star
  episode: '\u25CF', // Circle
  feedback: '\u2714', // Checkmark
  reasoning_step: '\u25B6', // Triangle
  checkpoint: '\u2691', // Flag
  session: '\u231B', // Hourglass
  agent: '\u2699', // Gear
  namespace: '\u2630', // Menu
};

/** Edge type display names */
const EDGE_TYPE_LABELS: Record<EdgeType | string, string> = {
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
// Helper Components
// ============================================================================

/**
 * Collapsible section for organizing details
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="details-panel__section">
      <button
        className="details-panel__section-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="details-panel__section-title">{title}</span>
        <span
          className={`details-panel__section-chevron ${isExpanded ? 'details-panel__section-chevron--expanded' : ''}`}
        >
          {'\u25BC'}
        </span>
      </button>
      {isExpanded && (
        <div className="details-panel__section-content">{children}</div>
      )}
    </div>
  );
};

/**
 * Individual field display with label and value
 */
const DetailField: React.FC<{
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  onCopy?: () => void;
}> = ({ label, value, copyable, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (typeof value === 'string') {
      navigator.clipboard.writeText(value)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          onCopy?.();
        })
        .catch((err) => {
          console.error('Failed to copy to clipboard:', err);
        });
    }
  }, [value, onCopy]);

  return (
    <div className="details-panel__field">
      <span className="details-panel__field-label">{label}</span>
      <div className="details-panel__field-value-wrapper">
        <span className="details-panel__field-value">{value}</span>
        {copyable && typeof value === 'string' && (
          <button
            className="details-panel__copy-btn"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? '\u2714' : '\u2398'}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Badge component for node/edge types
 */
const TypeBadge: React.FC<{
  type: string;
  color?: string;
  icon?: string;
}> = ({ type, color, icon }) => (
  <span
    className="details-panel__type-badge"
    style={{ backgroundColor: color ? `${color}20` : undefined, color }}
  >
    {icon && <span className="details-panel__type-badge-icon">{icon}</span>}
    <span className="details-panel__type-badge-label">
      {type.replace(/_/g, ' ')}
    </span>
  </span>
);

// ============================================================================
// Node Details Component
// ============================================================================

const NodeDetails: React.FC<{ node: GraphNode }> = ({ node }) => {
  const color = NODE_TYPE_COLORS[node.type] || '#888';
  const icon = NODE_TYPE_ICONS[node.type] || '\u25CF';

  /**
   * Get type-specific fields for the node
   */
  const typeSpecificFields = useMemo(() => {
    const data = node.data || {};
    const raw = (data.raw as Record<string, unknown>) || {};

    switch (node.type) {
      case 'trajectory':
        return [
          { label: 'Verdict', value: raw.verdict as string || 'N/A' },
          { label: 'Quality Score', value: raw.quality_score !== undefined ? String(raw.quality_score) : 'N/A' },
          { label: 'Created At', value: formatTimestamp(raw.created_at as string | Date) },
          { label: 'Agent ID', value: data.agentId || raw.agent_id as string || 'N/A' },
        ];

      case 'pattern':
        return [
          { label: 'Pattern Type', value: raw.pattern_type as string || 'N/A' },
          { label: 'Success Rate', value: raw.success_rate !== undefined ? `${(Number(raw.success_rate) * 100).toFixed(1)}%` : 'N/A' },
          { label: 'Usage Count', value: raw.usage_count !== undefined ? String(raw.usage_count) : 'N/A' },
          { label: 'Created At', value: formatTimestamp(raw.created_at as string | Date) },
        ];

      case 'episode':
        return [
          { label: 'Context', value: raw.context as string || 'N/A' },
          { label: 'Outcome', value: raw.outcome as string || 'N/A' },
          { label: 'Timestamp', value: formatTimestamp(data.timestamp || raw.timestamp as string | Date) },
          { label: 'Session ID', value: data.sessionId || raw.session_id as string || 'N/A' },
        ];

      case 'feedback':
        return [
          { label: 'Rating', value: raw.rating !== undefined ? renderRating(Number(raw.rating)) : 'N/A' },
          { label: 'Source', value: raw.source as string || 'N/A' },
          { label: 'Message', value: raw.message as string || 'N/A' },
          { label: 'Timestamp', value: formatTimestamp(data.timestamp || raw.timestamp as string | Date) },
        ];

      case 'reasoning_step':
        return [
          { label: 'Step Index', value: raw.step_index !== undefined ? String(raw.step_index) : 'N/A' },
          { label: 'Reasoning Type', value: raw.reasoning_type as string || 'N/A' },
          { label: 'Content', value: truncateText(raw.content as string, 200) || 'N/A' },
          { label: 'Timestamp', value: formatTimestamp(data.timestamp || raw.timestamp as string | Date) },
        ];

      case 'checkpoint':
        return [
          { label: 'Checkpoint Type', value: raw.checkpoint_type as string || 'N/A' },
          { label: 'State', value: raw.state as string || 'N/A' },
          { label: 'Timestamp', value: formatTimestamp(data.timestamp || raw.timestamp as string | Date) },
        ];

      default:
        return [
          { label: 'Event Type', value: data.eventType || 'N/A' },
          { label: 'Session ID', value: data.sessionId || 'N/A' },
          { label: 'Agent ID', value: data.agentId || 'N/A' },
          { label: 'Timestamp', value: formatTimestamp(data.timestamp) },
        ];
    }
  }, [node]);

  return (
    <div className="details-panel__node">
      <div className="details-panel__node-header">
        <div
          className="details-panel__node-icon"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div className="details-panel__node-info">
          <h3 className="details-panel__node-label">{node.label}</h3>
          <TypeBadge type={node.type} color={color} />
        </div>
      </div>

      <CollapsibleSection title="Basic Information">
        <DetailField label="ID" value={node.id} copyable />
        <DetailField label="Type" value={node.type.replace(/_/g, ' ')} />
        <DetailField label="Label" value={node.label} />
        {node.data?.eventId !== undefined && (
          <DetailField label="Event ID" value={String(node.data.eventId)} copyable />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Type-Specific Details">
        {typeSpecificFields.map((field) => (
          <DetailField
            key={field.label}
            label={field.label}
            value={field.value}
            copyable={field.label.includes('ID')}
          />
        ))}
      </CollapsibleSection>

      {node.data?.raw !== undefined && (
        <CollapsibleSection title="Raw Data" defaultExpanded={false}>
          <pre className="details-panel__raw-data">
            {truncateRawData(JSON.stringify(node.data.raw, null, 2))}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
};

// ============================================================================
// Edge Details Component
// ============================================================================

const EdgeDetails: React.FC<{ edge: GraphEdge }> = ({ edge }) => {
  const nodes = useGraphStore((state) => state.nodes);
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  return (
    <div className="details-panel__edge">
      <div className="details-panel__edge-header">
        <div className="details-panel__edge-icon">{'\u2194'}</div>
        <div className="details-panel__edge-info">
          <h3 className="details-panel__edge-label">
            {EDGE_TYPE_LABELS[edge.type] || edge.type.replace(/_/g, ' ')}
          </h3>
          <TypeBadge type={edge.type} />
        </div>
      </div>

      <CollapsibleSection title="Connection">
        <DetailField label="Edge ID" value={edge.id} copyable />
        <DetailField label="Type" value={edge.type.replace(/_/g, ' ')} />
        {edge.label && <DetailField label="Label" value={edge.label} />}
      </CollapsibleSection>

      <CollapsibleSection title="Source Node">
        <DetailField label="ID" value={edge.source} copyable />
        <DetailField
          label="Type"
          value={sourceNode?.type.replace(/_/g, ' ') || 'Unknown'}
        />
        <DetailField label="Label" value={sourceNode?.label || 'Unknown'} />
      </CollapsibleSection>

      <CollapsibleSection title="Target Node">
        <DetailField label="ID" value={edge.target} copyable />
        <DetailField
          label="Type"
          value={targetNode?.type.replace(/_/g, ' ') || 'Unknown'}
        />
        <DetailField label="Label" value={targetNode?.label || 'Unknown'} />
      </CollapsibleSection>

      {edge.data && (
        <CollapsibleSection title="Edge Data" defaultExpanded={false}>
          {edge.data.weight !== undefined && (
            <DetailField label="Weight" value={String(edge.data.weight)} />
          )}
          {edge.data.timestamp && (
            <DetailField
              label="Timestamp"
              value={formatTimestamp(edge.data.timestamp)}
            />
          )}
          {edge.data.metadata && (
            <pre className="details-panel__raw-data">
              {JSON.stringify(edge.data.metadata, null, 2)}
            </pre>
          )}
        </CollapsibleSection>
      )}
    </div>
  );
};

// ============================================================================
// Multiple Selection Summary Component
// ============================================================================

const MultipleSelectionSummary: React.FC<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> = ({ nodes, edges }) => {
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((node) => {
      counts[node.type] = (counts[node.type] || 0) + 1;
    });
    return counts;
  }, [nodes]);

  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach((edge) => {
      counts[edge.type] = (counts[edge.type] || 0) + 1;
    });
    return counts;
  }, [edges]);

  return (
    <div className="details-panel__multi-selection">
      <div className="details-panel__multi-header">
        <span className="details-panel__multi-icon">{'\u2630'}</span>
        <h3 className="details-panel__multi-title">Multiple Selection</h3>
      </div>

      <div className="details-panel__multi-summary">
        <div className="details-panel__multi-stat">
          <span className="details-panel__multi-stat-value">
            {nodes.length}
          </span>
          <span className="details-panel__multi-stat-label">
            node{nodes.length !== 1 ? 's' : ''} selected
          </span>
        </div>
        <div className="details-panel__multi-stat">
          <span className="details-panel__multi-stat-value">
            {edges.length}
          </span>
          <span className="details-panel__multi-stat-label">
            edge{edges.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      </div>

      {nodes.length > 0 && (
        <CollapsibleSection title="Selected Nodes by Type">
          <div className="details-panel__type-breakdown">
            {Object.entries(nodeTypeCounts).map(([type, count]) => (
              <div key={type} className="details-panel__type-row">
                <TypeBadge
                  type={type}
                  color={NODE_TYPE_COLORS[type]}
                  icon={NODE_TYPE_ICONS[type]}
                />
                <span className="details-panel__type-count">{count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {edges.length > 0 && (
        <CollapsibleSection title="Selected Edges by Type">
          <div className="details-panel__type-breakdown">
            {Object.entries(edgeTypeCounts).map(([type, count]) => (
              <div key={type} className="details-panel__type-row">
                <TypeBadge type={type} />
                <span className="details-panel__type-count">{count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {nodes.length > 0 && (
        <CollapsibleSection title="Selected Node IDs" defaultExpanded={false}>
          <div className="details-panel__id-list">
            {nodes.map((node) => (
              <div key={node.id} className="details-panel__id-item">
                <span
                  className="details-panel__id-dot"
                  style={{ backgroundColor: NODE_TYPE_COLORS[node.type] }}
                />
                <span className="details-panel__id-text">{node.id}</span>
                <button
                  className="details-panel__copy-btn details-panel__copy-btn--small"
                  onClick={() => {
                    navigator.clipboard.writeText(node.id)
                      .catch((err) => console.error('Failed to copy ID:', err));
                  }}
                  title="Copy ID"
                >
                  {'\u2398'}
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

// ============================================================================
// Empty State Component
// ============================================================================

const EmptyState: React.FC = () => (
  <div className="details-panel__empty">
    <div className="details-panel__empty-icon">{'\u2139'}</div>
    <h3 className="details-panel__empty-title">No Selection</h3>
    <p className="details-panel__empty-description">
      Select a node or edge in the graph to view its details.
    </p>
    <div className="details-panel__empty-hints">
      <div className="details-panel__empty-hint">
        <kbd>Click</kbd> to select a single element
      </div>
      <div className="details-panel__empty-hint">
        <kbd>Shift+Click</kbd> to add to selection
      </div>
      <div className="details-panel__empty-hint">
        <kbd>Cmd/Ctrl+A</kbd> to select all
      </div>
    </div>
  </div>
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a timestamp for display
 */
function formatTimestamp(
  timestamp: string | Date | undefined | null
): string {
  if (!timestamp) return 'N/A';
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

/**
 * Render a rating value (e.g., as stars)
 */
function renderRating(rating: number): React.ReactNode {
  if (isNaN(rating)) return 'N/A';
  const maxStars = 5;
  const normalizedRating = Math.min(Math.max(rating, 0), maxStars);
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating % 1 >= 0.5;

  return (
    <span className="details-panel__rating">
      {Array(fullStars)
        .fill(null)
        .map((_, i) => (
          <span key={i} className="details-panel__star details-panel__star--full">
            {'\u2605'}
          </span>
        ))}
      {hasHalfStar && (
        <span className="details-panel__star details-panel__star--half">
          {'\u2606'}
        </span>
      )}
      {Array(maxStars - fullStars - (hasHalfStar ? 1 : 0))
        .fill(null)
        .map((_, i) => (
          <span key={`empty-${i}`} className="details-panel__star details-panel__star--empty">
            {'\u2606'}
          </span>
        ))}
      <span className="details-panel__rating-value">({rating.toFixed(1)})</span>
    </span>
  );
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Maximum length for raw data display to prevent rendering issues
 */
const MAX_RAW_DATA_LENGTH = 10000;

/**
 * Truncate raw data for safe display
 * Prevents XSS-like rendering issues with very large data payloads
 */
function truncateRawData(text: string): string {
  if (text.length <= MAX_RAW_DATA_LENGTH) return text;
  return text.slice(0, MAX_RAW_DATA_LENGTH) + '\n\n... [truncated - data exceeds 10KB]';
}

// ============================================================================
// Main Component
// ============================================================================

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  className = '',
  onClose,
  showHeader = true,
}) => {
  const selectedNodes = useGraphStore(selectSelectedNodes);
  const selectedEdges = useGraphStore(selectSelectedEdges);
  const clearSelection = useGraphStore((state) => state.clearSelection);

  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
  const isSingleNodeSelection =
    selectedNodes.length === 1 && selectedEdges.length === 0;
  const isSingleEdgeSelection =
    selectedEdges.length === 1 && selectedNodes.length === 0;
  const isMultipleSelection =
    selectedNodes.length > 1 ||
    selectedEdges.length > 1 ||
    (selectedNodes.length > 0 && selectedEdges.length > 0);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return (
    <div className={`details-panel ${className}`}>
      {showHeader && (
        <div className="details-panel__header">
          <h2 className="details-panel__title">Details</h2>
          <div className="details-panel__header-actions">
            {hasSelection && (
              <button
                className="btn btn--ghost btn--icon-sm"
                onClick={handleClearSelection}
                title="Clear selection"
              >
                {'\u2715'}
              </button>
            )}
            {onClose && (
              <button
                className="btn btn--ghost btn--icon-sm"
                onClick={onClose}
                title="Close panel"
              >
                {'\u00D7'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="details-panel__content">
        {!hasSelection && <EmptyState />}

        {isSingleNodeSelection && <NodeDetails node={selectedNodes[0]} />}

        {isSingleEdgeSelection && <EdgeDetails edge={selectedEdges[0]} />}

        {isMultipleSelection && (
          <MultipleSelectionSummary nodes={selectedNodes} edges={selectedEdges} />
        )}
      </div>
    </div>
  );
};

export default DetailsPanel;
