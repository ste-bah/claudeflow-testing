/**
 * Dashboard Component
 *
 * Main dashboard view combining MetricsCards, TimelineChart, and activity feeds
 * for the God Agent Memory Visualization system.
 *
 * @module components/dashboard/Dashboard
 */

import React, { useMemo, useCallback } from 'react';
import { MetricsCard } from './MetricsCard';
import { TimelineChart, TimelineDataPoint, TimelineSeries } from './TimelineChart';
import { useGraphStore, selectGraphStats } from '@/stores/graphStore';
import { useDatabaseStore, selectDateRange, selectSessionCount, selectEventCount } from '@/stores/databaseStore';
import { useFilterStore, selectHasActiveFilters } from '@/stores/filterStore';

// ============================================================================
// Types
// ============================================================================

export interface DashboardProps {
  /** Additional CSS class name */
  className?: string;
  /** Callback when user clicks to navigate to graph view */
  onNavigateToGraph?: () => void;
  /** Whether to show the activity feed section */
  showActivityFeed?: boolean;
}

interface RecentEvent {
  id: string;
  type: string;
  label: string;
  timestamp: Date;
  agentId?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Quick action button component
 */
const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, description, onClick, disabled = false }) => {
  return (
    <button
      className={`dashboard__quick-action ${disabled ? 'dashboard__quick-action--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span className="dashboard__quick-action-icon">{icon}</span>
      <div className="dashboard__quick-action-content">
        <span className="dashboard__quick-action-label">{label}</span>
        <span className="dashboard__quick-action-description">{description}</span>
      </div>
    </button>
  );
};

/**
 * Recent activity item component
 */
const ActivityItem: React.FC<{
  event: RecentEvent;
  onClick?: (eventId: string) => void;
}> = ({ event, onClick }) => {
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      trajectory: 'var(--node-trajectory)',
      pattern: 'var(--node-pattern)',
      episode: 'var(--node-episode)',
      feedback: 'var(--node-feedback)',
      reasoning_step: 'var(--node-reasoning-step)',
      checkpoint: 'var(--node-checkpoint)',
      session: 'var(--color-info-500)',
      agent: 'var(--color-primary)',
    };
    return colors[type] || 'var(--color-neutral-500)';
  };

  return (
    <div
      className="dashboard__activity-item"
      onClick={() => onClick?.(event.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(event.id);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span
        className="dashboard__activity-dot"
        style={{ backgroundColor: getTypeColor(event.type) }}
      />
      <div className="dashboard__activity-content">
        <span className="dashboard__activity-label">{event.label}</span>
        <span className="dashboard__activity-meta">
          <span className="dashboard__activity-type">{event.type}</span>
          {event.agentId && (
            <>
              <span className="dashboard__activity-separator">-</span>
              <span className="dashboard__activity-agent">{event.agentId}</span>
            </>
          )}
        </span>
      </div>
      <span className="dashboard__activity-time">{formatTime(event.timestamp)}</span>
    </div>
  );
};

/**
 * Section header component
 */
const SectionHeader: React.FC<{
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ title, action }) => {
  return (
    <div className="dashboard__section-header">
      <h3 className="dashboard__section-title">{title}</h3>
      {action && (
        <button
          className="dashboard__section-action"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Icons
// ============================================================================

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GraphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5" cy="6" r="3" />
    <circle cx="19" cy="6" r="3" />
    <circle cx="12" cy="18" r="3" />
    <path d="M7.5 8L10.5 15.5" strokeLinecap="round" />
    <path d="M16.5 8L13.5 15.5" strokeLinecap="round" />
  </svg>
);

const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NodesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <circle cx="4" cy="8" r="2" />
    <circle cx="20" cy="8" r="2" />
    <circle cx="4" cy="16" r="2" />
    <circle cx="20" cy="16" r="2" />
    <path d="M9.5 10.5L5.5 8.5" strokeLinecap="round" />
    <path d="M14.5 10.5L18.5 8.5" strokeLinecap="round" />
    <path d="M9.5 13.5L5.5 15.5" strokeLinecap="round" />
    <path d="M14.5 13.5L18.5 15.5" strokeLinecap="round" />
  </svg>
);

const EdgesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h6v6H4z" />
    <path d="M14 14h6v6h-6z" />
    <path d="M10 7h4" strokeLinecap="round" />
    <path d="M7 10v4" strokeLinecap="round" />
    <path d="M17 10v4" strokeLinecap="round" />
    <path d="M10 17h4" strokeLinecap="round" />
  </svg>
);

const SessionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 8h18" strokeLinecap="round" />
    <circle cx="6" cy="6" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="9" cy="6" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

const PatternIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Dashboard component providing an overview of the God Agent memory system
 */
export const Dashboard: React.FC<DashboardProps> = ({
  className = '',
  onNavigateToGraph,
  showActivityFeed = true,
}) => {
  // Store selectors
  const graphStats = useGraphStore(selectGraphStats);
  const nodes = useGraphStore((state) => state.nodes);
  const isGraphLoading = useGraphStore((state) => state.isLoading);
  const refreshGraphData = useGraphStore((state) => state.refreshData);

  const events = useDatabaseStore((state) => state.events);
  const sessions = useDatabaseStore((state) => state.sessions);
  const dateRange = useDatabaseStore(selectDateRange);
  const sessionCount = useDatabaseStore(selectSessionCount);
  const eventCount = useDatabaseStore(selectEventCount);
  const isDatabaseLoading = useDatabaseStore((state) => state.isLoading);

  const hasActiveFilters = useFilterStore(selectHasActiveFilters);
  const resetFilters = useFilterStore((state) => state.resetAllFilters);

  // Loading state
  const isLoading = isGraphLoading || isDatabaseLoading;

  // Compute pattern count from nodes
  const patternCount = useMemo(() => {
    return nodes.filter((n) => n.type === 'pattern').length;
  }, [nodes]);

  // Generate sparkline data from events
  const generateSparklineData = useCallback((dataLength: number = 7): number[] => {
    if (events.length === 0) {
      return Array(dataLength).fill(0);
    }

    // Group events by time intervals
    const now = new Date();
    const intervalMs = (7 * 24 * 60 * 60 * 1000) / dataLength; // 7 days divided into intervals
    const counts: number[] = Array(dataLength).fill(0);

    for (const event of events) {
      const ageMs = now.getTime() - event.timestamp.getTime();
      const intervalIndex = Math.floor(ageMs / intervalMs);
      if (intervalIndex >= 0 && intervalIndex < dataLength) {
        counts[dataLength - 1 - intervalIndex]++;
      }
    }

    return counts;
  }, [events]);

  // Compute node trend
  const nodeTrend = useMemo(() => {
    const sparkline = generateSparklineData(7);
    if (sparkline.every((v) => v === 0)) return undefined;

    const recent = sparkline.slice(-3).reduce((a, b) => a + b, 0);
    const older = sparkline.slice(0, 4).reduce((a, b) => a + b, 0);
    const percentage = older === 0 ? 100 : ((recent - older) / older) * 100;

    return {
      direction: percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'neutral',
      percentage: Math.abs(percentage),
    } as const;
  }, [generateSparklineData]);

  // Prepare timeline data
  const timelineData = useMemo((): TimelineDataPoint[] => {
    if (events.length === 0) return [];

    // Group events by day
    const dayMap = new Map<string, { events: number; patterns: number; sessions: number }>();

    for (const event of events) {
      const dayKey = event.timestamp.toISOString().split('T')[0];
      const existing = dayMap.get(dayKey) || { events: 0, patterns: 0, sessions: 0 };
      existing.events++;
      if (event.eventType === 'pattern_match') {
        existing.patterns++;
      }
      dayMap.set(dayKey, existing);
    }

    // Track unique sessions per day
    const sessionDays = new Map<string, Set<string>>();
    for (const session of sessions) {
      if (session.startedAt) {
        const dayKey = session.startedAt.toISOString().split('T')[0];
        const existing = sessionDays.get(dayKey) || new Set();
        existing.add(session.id);
        sessionDays.set(dayKey, existing);
      }
    }

    // Merge session data
    for (const [dayKey, sessionSet] of sessionDays) {
      const existing = dayMap.get(dayKey) || { events: 0, patterns: 0, sessions: 0 };
      existing.sessions = sessionSet.size;
      dayMap.set(dayKey, existing);
    }

    // Convert to timeline data points
    return Array.from(dayMap.entries())
      .map(([dayKey, values]) => ({
        timestamp: new Date(dayKey),
        values: {
          events: values.events,
          patterns: values.patterns,
          sessions: values.sessions,
        },
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [events, sessions]);

  // Timeline series configuration
  const timelineSeries: TimelineSeries[] = useMemo(() => [
    { key: 'events', label: 'Events', color: 'var(--color-primary)', showArea: true },
    { key: 'patterns', label: 'Patterns', color: 'var(--node-pattern)', showArea: false },
    { key: 'sessions', label: 'Sessions', color: 'var(--color-info-500)', showArea: false },
  ], []);

  // Recent events for activity feed
  const recentEvents = useMemo((): RecentEvent[] => {
    return events
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
      .map((e) => ({
        id: String(e.id),
        type: e.eventType,
        label: e.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        timestamp: e.timestamp,
        agentId: e.agentId ?? undefined,
      }));
  }, [events]);

  // Date range display
  const dateRangeText = useMemo(() => {
    if (!dateRange.earliest || !dateRange.latest) return 'No data';
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = dateRange.earliest.toLocaleDateString('en-US', opts);
    const end = dateRange.latest.toLocaleDateString('en-US', opts);
    return start === end ? start : `${start} - ${end}`;
  }, [dateRange]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refreshGraphData();
  }, [refreshGraphData]);

  const handleExport = useCallback(() => {
    // Placeholder for export functionality
    console.log('Export data');
  }, []);

  const handleActivityClick = useCallback((eventId: string) => {
    console.log('View event:', eventId);
  }, []);

  // Build class names
  const containerClasses = [
    'dashboard',
    isLoading ? 'dashboard--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-content">
          <h1 className="dashboard__title">Memory Dashboard</h1>
          <p className="dashboard__subtitle">
            {dateRangeText} - {eventCount.toLocaleString()} events across {sessionCount} sessions
          </p>
        </div>
        <div className="dashboard__header-actions">
          <button
            className="btn btn--secondary btn--icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh data"
          >
            <RefreshIcon className={`btn__icon ${isLoading ? 'dashboard__refresh-icon--spinning' : ''}`} />
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="dashboard__metrics">
        <MetricsCard
          title="Total Nodes"
          value={graphStats.nodeCount.toLocaleString()}
          icon={<NodesIcon />}
          variant="default"
          sparklineData={generateSparklineData(7)}
          trend={nodeTrend}
          subtitle={`${graphStats.visibleNodeCount} visible`}
          loading={isLoading}
          onClick={onNavigateToGraph}
        />
        <MetricsCard
          title="Total Edges"
          value={graphStats.edgeCount.toLocaleString()}
          icon={<EdgesIcon />}
          variant="info"
          subtitle={`${graphStats.visibleEdgeCount} visible`}
          loading={isLoading}
          onClick={onNavigateToGraph}
        />
        <MetricsCard
          title="Sessions"
          value={sessionCount.toLocaleString()}
          icon={<SessionIcon />}
          variant="success"
          subtitle={sessions.length > 0 ? 'Active tracking' : 'No sessions'}
          loading={isLoading}
        />
        <MetricsCard
          title="Patterns"
          value={patternCount.toLocaleString()}
          icon={<PatternIcon />}
          variant="warning"
          subtitle="Learned patterns"
          loading={isLoading}
        />
      </section>

      {/* Main Content Grid */}
      <div className="dashboard__content">
        {/* Timeline Section */}
        <section className="dashboard__timeline">
          <SectionHeader
            title="Activity Timeline"
            action={{
              label: 'View Details',
              onClick: () => onNavigateToGraph?.(),
            }}
          />
          <div className="dashboard__timeline-chart">
            <TimelineChart
              data={timelineData}
              series={timelineSeries}
              height={280}
              showLegend={true}
              showGrid={true}
              showTooltip={true}
              animate={true}
            />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="dashboard__sidebar">
          {/* Quick Actions */}
          <section className="dashboard__quick-actions">
            <SectionHeader title="Quick Actions" />
            <div className="dashboard__quick-actions-list">
              <QuickAction
                icon={<GraphIcon />}
                label="Open Graph View"
                description="Explore memory nodes and relationships"
                onClick={() => onNavigateToGraph?.()}
              />
              <QuickAction
                icon={<FilterIcon />}
                label={hasActiveFilters ? 'Clear Filters' : 'Configure Filters'}
                description={hasActiveFilters ? 'Reset all active filters' : 'Set up data filters'}
                onClick={hasActiveFilters ? resetFilters : () => {}}
              />
              <QuickAction
                icon={<ExportIcon />}
                label="Export Data"
                description="Download memory snapshot"
                onClick={handleExport}
              />
            </div>
          </section>

          {/* Activity Feed */}
          {showActivityFeed && (
            <section className="dashboard__activity">
              <SectionHeader
                title="Recent Activity"
                action={
                  recentEvents.length > 5
                    ? { label: 'View All', onClick: () => {} }
                    : undefined
                }
              />
              <div className="dashboard__activity-list">
                {recentEvents.length === 0 ? (
                  <div className="dashboard__activity-empty">
                    <span>No recent activity</span>
                  </div>
                ) : (
                  recentEvents.slice(0, 5).map((event) => (
                    <ActivityItem
                      key={event.id}
                      event={event}
                      onClick={handleActivityClick}
                    />
                  ))
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
