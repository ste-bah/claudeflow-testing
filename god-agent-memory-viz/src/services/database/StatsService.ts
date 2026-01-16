/**
 * StatsService - Comprehensive database statistics with caching
 *
 * Provides aggregated statistics across events, memory entries, sessions,
 * and agents with intelligent caching and timeline data for charts.
 *
 * @module services/database/StatsService
 */

import { getDatabaseService } from './DatabaseService';
import type { DatabaseStats } from './types';
import { getEventDateRange, getEventTypeCounts } from './queries/eventQueries';
import { getMemoryDateRange, getNamespaceStats } from './queries/memoryQueries';
import { getSessionStats } from './queries/sessionQueries';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Event statistics aggregation
 */
export interface EventStats {
  /** Total number of events */
  total: number;
  /** Event counts by type */
  byType: Record<string, number>;
  /** Date range of events */
  dateRange: { earliest: Date | null; latest: Date | null };
  /** Average events per day */
  avgPerDay: number;
  /** Average events per session */
  avgPerSession: number;
}

/**
 * Memory entry statistics aggregation
 */
export interface MemoryStats {
  /** Total number of memory entries */
  total: number;
  /** Entries grouped by namespace with embedding counts */
  byNamespace: Array<{ namespace: string; count: number; withEmbeddings: number }>;
  /** Date range of memory entries */
  dateRange: { earliest: Date | null; latest: Date | null };
  /** Number of entries with embeddings */
  withEmbeddings: number;
  /** Average access count across all entries */
  avgAccessCount: number;
}

/**
 * Session statistics aggregation
 */
export interface SessionStatsAggregated {
  /** Total number of sessions */
  total: number;
  /** Average session duration in milliseconds */
  avgDuration: number;
  /** Average event count per session */
  avgEventCount: number;
  /** Average agent count per session */
  avgAgentCount: number;
  /** Number of completed (ended) sessions */
  completedCount: number;
}

/**
 * Agent statistics aggregation
 */
export interface AgentStats {
  /** Number of unique agents */
  uniqueAgents: number;
  /** Average events per agent */
  avgEventsPerAgent: number;
  /** Most active agents by event count */
  mostActiveAgents: Array<{ agentId: string; eventCount: number }>;
}

/**
 * Comprehensive statistics combining all domains
 */
export interface ComprehensiveStats {
  /** Basic database statistics */
  database: DatabaseStats;
  /** Event statistics */
  events: EventStats;
  /** Memory entry statistics */
  memory: MemoryStats;
  /** Session statistics */
  sessions: SessionStatsAggregated;
  /** Agent statistics */
  agents: AgentStats;
  /** Timestamp when these stats were generated */
  generatedAt: Date;
}

/**
 * Timeline data point for charts
 */
export interface TimelineDataPoint {
  /** Timestamp for this bucket */
  timestamp: Date;
  /** Label for display */
  label: string;
  /** Event count */
  events: number;
  /** Memory entry count (created in this period) */
  memoryEntries: number;
  /** Session count (started in this period) */
  sessions: number;
}

/**
 * Bucket size options for timeline aggregation
 */
export type TimelineBucketSize = 'hour' | 'day' | 'week' | 'month';

// ============================================================================
// Cache Configuration
// ============================================================================

/** Cache TTL in milliseconds (1 minute) */
const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// StatsService Class
// ============================================================================

/**
 * StatsService - Singleton service for comprehensive database statistics
 *
 * @example
 * ```typescript
 * const statsService = StatsService.getInstance();
 * const stats = statsService.getStats();
 * const timeline = statsService.getTimelineData('day');
 * ```
 */
export class StatsService {
  private static instance: StatsService | null = null;

  /** Cache for comprehensive stats */
  private statsCache: CacheEntry<ComprehensiveStats> | null = null;

  /** Cache for timeline data by bucket size */
  private timelineCache: Map<TimelineBucketSize, CacheEntry<TimelineDataPoint[]>> = new Map();

  /**
   * Private constructor - use getInstance() to get the singleton
   */
  private constructor() {}

  /**
   * Get the singleton instance of StatsService
   */
  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    if (StatsService.instance) {
      StatsService.instance.invalidateCache();
      StatsService.instance = null;
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get comprehensive statistics across all data domains
   * @param forceRefresh - If true, bypass cache and fetch fresh data
   * @returns ComprehensiveStats object with all statistics
   */
  public getStats(forceRefresh: boolean = false): ComprehensiveStats {
    // Check cache validity
    if (!forceRefresh && this.statsCache && this.isCacheValid(this.statsCache.timestamp)) {
      return this.statsCache.data;
    }

    // Generate fresh stats
    const db = getDatabaseService();
    const fileSize = db.getConnectionInfo().fileSize;

    const stats: ComprehensiveStats = {
      database: this.getDatabaseStats(fileSize),
      events: this.getEventStatsInternal(),
      memory: this.getMemoryStatsInternal(),
      sessions: this.getSessionStatsInternal(),
      agents: this.getAgentStats(),
      generatedAt: new Date(),
    };

    // Update cache
    this.statsCache = {
      data: stats,
      timestamp: Date.now(),
    };

    return stats;
  }

  /**
   * Get timeline data for charting
   * @param bucketSize - Time bucket granularity ('hour', 'day', 'week', 'month')
   * @returns Array of timeline data points
   */
  public getTimelineData(bucketSize: TimelineBucketSize = 'day'): TimelineDataPoint[] {
    // Check cache validity
    const cached = this.timelineCache.get(bucketSize);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    // Generate fresh timeline data
    const timeline = this.generateTimelineData(bucketSize);

    // Update cache
    this.timelineCache.set(bucketSize, {
      data: timeline,
      timestamp: Date.now(),
    });

    return timeline;
  }

  /**
   * Invalidate all cached data
   */
  public invalidateCache(): void {
    this.statsCache = null;
    this.timelineCache.clear();
  }

  // ============================================================================
  // Internal Statistics Methods
  // ============================================================================

  /**
   * Get basic database statistics
   */
  private getDatabaseStats(fileSize: number): DatabaseStats {
    const db = getDatabaseService();

    try {
      const eventCountResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM events'
      );

      const memoryCountResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM memory_entries'
      );

      const sessionCountResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions'
      );

      const agentCountResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT agent_id) as count FROM events WHERE agent_id IS NOT NULL'
      );

      const namespaceCountResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT namespace) as count FROM memory_entries'
      );

      const dateRangeResult = db.queryOne<{ earliest: string | null; latest: string | null }>(
        'SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest FROM events'
      );

      return {
        eventCount: eventCountResult?.count ?? 0,
        memoryEntryCount: memoryCountResult?.count ?? 0,
        sessionCount: sessionCountResult?.count ?? 0,
        uniqueAgents: agentCountResult?.count ?? 0,
        uniqueNamespaces: namespaceCountResult?.count ?? 0,
        dateRange: {
          earliest: dateRangeResult?.earliest ? new Date(dateRangeResult.earliest) : null,
          latest: dateRangeResult?.latest ? new Date(dateRangeResult.latest) : null,
        },
        fileSize,
      };
    } catch {
      return {
        eventCount: 0,
        memoryEntryCount: 0,
        sessionCount: 0,
        uniqueAgents: 0,
        uniqueNamespaces: 0,
        dateRange: { earliest: null, latest: null },
        fileSize,
      };
    }
  }

  /**
   * Get event statistics
   */
  private getEventStatsInternal(): EventStats {
    const db = getDatabaseService();

    try {
      // Get total count
      const totalResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM events'
      );
      const total = totalResult?.count ?? 0;

      // Get counts by type
      const byType = getEventTypeCounts();

      // Get date range
      const dateRange = getEventDateRange();

      // Calculate average per day
      let avgPerDay = 0;
      if (dateRange.earliest && dateRange.latest && total > 0) {
        const days = this.daysBetween(dateRange.earliest, dateRange.latest);
        avgPerDay = days > 0 ? total / days : total;
      }

      // Calculate average per session
      const sessionCount = db.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT session_id) as count FROM events WHERE session_id IS NOT NULL'
      );
      const sessions = sessionCount?.count ?? 0;
      const avgPerSession = sessions > 0 ? total / sessions : 0;

      return {
        total,
        byType,
        dateRange,
        avgPerDay,
        avgPerSession,
      };
    } catch {
      return {
        total: 0,
        byType: {},
        dateRange: { earliest: null, latest: null },
        avgPerDay: 0,
        avgPerSession: 0,
      };
    }
  }

  /**
   * Get memory statistics
   */
  private getMemoryStatsInternal(): MemoryStats {
    const db = getDatabaseService();

    try {
      // Get total count
      const totalResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM memory_entries'
      );
      const total = totalResult?.count ?? 0;

      // Get namespace stats
      const namespaceStats = getNamespaceStats();
      const byNamespace = namespaceStats.map((ns) => ({
        namespace: ns.namespace,
        count: ns.entryCount,
        withEmbeddings: ns.entriesWithEmbeddings,
      }));

      // Get date range
      const dateRange = getMemoryDateRange();

      // Get embedding count
      const embeddingResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM memory_entries WHERE embedding IS NOT NULL'
      );
      const withEmbeddings = embeddingResult?.count ?? 0;

      // Get average access count
      const avgAccessResult = db.queryOne<{ avg: number }>(
        'SELECT AVG(access_count) as avg FROM memory_entries'
      );
      const avgAccessCount = avgAccessResult?.avg ?? 0;

      return {
        total,
        byNamespace,
        dateRange,
        withEmbeddings,
        avgAccessCount,
      };
    } catch {
      return {
        total: 0,
        byNamespace: [],
        dateRange: { earliest: null, latest: null },
        withEmbeddings: 0,
        avgAccessCount: 0,
      };
    }
  }

  /**
   * Get session statistics
   */
  private getSessionStatsInternal(): SessionStatsAggregated {
    const db = getDatabaseService();

    try {
      // Use the existing session stats query
      const stats = getSessionStats();

      // Get completed session count
      const completedResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions WHERE ended_at IS NOT NULL'
      );
      const completedCount = completedResult?.count ?? 0;

      // Calculate average event count
      const avgEventResult = db.queryOne<{ avg: number }>(
        'SELECT AVG(event_count) as avg FROM sessions'
      );
      const avgEventCount = avgEventResult?.avg ?? 0;

      // Calculate average agent count
      const avgAgentResult = db.queryOne<{ avg: number }>(
        'SELECT AVG(agent_count) as avg FROM sessions'
      );
      const avgAgentCount = avgAgentResult?.avg ?? 0;

      return {
        total: stats.totalSessions,
        avgDuration: stats.avgDuration ?? 0,
        avgEventCount,
        avgAgentCount,
        completedCount,
      };
    } catch {
      return {
        total: 0,
        avgDuration: 0,
        avgEventCount: 0,
        avgAgentCount: 0,
        completedCount: 0,
      };
    }
  }

  /**
   * Get agent statistics
   */
  private getAgentStats(): AgentStats {
    const db = getDatabaseService();

    try {
      // Get unique agent count
      const uniqueResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(DISTINCT agent_id) as count FROM events WHERE agent_id IS NOT NULL'
      );
      const uniqueAgents = uniqueResult?.count ?? 0;

      // Get total events with agents
      const totalEventsResult = db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM events WHERE agent_id IS NOT NULL'
      );
      const totalEvents = totalEventsResult?.count ?? 0;

      // Calculate average events per agent
      const avgEventsPerAgent = uniqueAgents > 0 ? totalEvents / uniqueAgents : 0;

      // Get most active agents
      const mostActiveResult = db.query<{ agent_id: string; event_count: number }>(
        `SELECT agent_id, COUNT(*) as event_count
         FROM events
         WHERE agent_id IS NOT NULL
         GROUP BY agent_id
         ORDER BY event_count DESC
         LIMIT 10`
      );

      const mostActiveAgents = mostActiveResult.rows.map((row) => ({
        agentId: row.agent_id,
        eventCount: row.event_count,
      }));

      return {
        uniqueAgents,
        avgEventsPerAgent,
        mostActiveAgents,
      };
    } catch {
      return {
        uniqueAgents: 0,
        avgEventsPerAgent: 0,
        mostActiveAgents: [],
      };
    }
  }

  // ============================================================================
  // Timeline Generation
  // ============================================================================

  /**
   * Generate timeline data for charts
   */
  private generateTimelineData(bucketSize: TimelineBucketSize): TimelineDataPoint[] {
    const db = getDatabaseService();
    const dateRange = getEventDateRange();

    if (!dateRange.earliest || !dateRange.latest) {
      return [];
    }

    // Determine SQL date format and bucket generation
    const { sqlFormat, labelFormat, bucketMs } = this.getBucketConfig(bucketSize);

    try {
      // Get event counts by bucket
      const eventBuckets = db.query<{ bucket: string; count: number }>(
        `SELECT strftime('${sqlFormat}', timestamp) as bucket, COUNT(*) as count
         FROM events
         GROUP BY bucket
         ORDER BY bucket ASC`
      );

      // Get memory entry counts by bucket (using created_at)
      const memoryBuckets = db.query<{ bucket: string; count: number }>(
        `SELECT strftime('${sqlFormat}', created_at) as bucket, COUNT(*) as count
         FROM memory_entries
         GROUP BY bucket
         ORDER BY bucket ASC`
      );

      // Get session counts by bucket (using started_at)
      const sessionBuckets = db.query<{ bucket: string; count: number }>(
        `SELECT strftime('${sqlFormat}', started_at) as bucket, COUNT(*) as count
         FROM sessions
         GROUP BY bucket
         ORDER BY bucket ASC`
      );

      // Create maps for quick lookup
      const eventMap = new Map(eventBuckets.rows.map((r) => [r.bucket, r.count]));
      const memoryMap = new Map(memoryBuckets.rows.map((r) => [r.bucket, r.count]));
      const sessionMap = new Map(sessionBuckets.rows.map((r) => [r.bucket, r.count]));

      // Generate all buckets in range
      const timeline: TimelineDataPoint[] = [];
      const startBucket = this.getBucketStart(dateRange.earliest, bucketSize);
      const endBucket = this.getBucketStart(dateRange.latest, bucketSize);

      let currentTime = startBucket.getTime();
      const endTime = endBucket.getTime() + bucketMs;

      while (currentTime <= endTime) {
        const bucketDate = new Date(currentTime);
        const bucketKey = this.formatBucketKey(bucketDate, sqlFormat);
        const label = this.formatBucketLabel(bucketDate, labelFormat);

        timeline.push({
          timestamp: bucketDate,
          label,
          events: eventMap.get(bucketKey) ?? 0,
          memoryEntries: memoryMap.get(bucketKey) ?? 0,
          sessions: sessionMap.get(bucketKey) ?? 0,
        });

        currentTime += bucketMs;
      }

      return timeline;
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get bucket configuration for timeline
   */
  private getBucketConfig(bucketSize: TimelineBucketSize): {
    sqlFormat: string;
    labelFormat: string;
    bucketMs: number;
  } {
    switch (bucketSize) {
      case 'hour':
        return {
          sqlFormat: '%Y-%m-%d %H:00',
          labelFormat: 'HH:mm',
          bucketMs: 60 * 60 * 1000,
        };
      case 'day':
        return {
          sqlFormat: '%Y-%m-%d',
          labelFormat: 'MMM dd',
          bucketMs: 24 * 60 * 60 * 1000,
        };
      case 'week':
        return {
          sqlFormat: '%Y-W%W',
          labelFormat: 'Week %W',
          bucketMs: 7 * 24 * 60 * 60 * 1000,
        };
      case 'month':
        return {
          sqlFormat: '%Y-%m',
          labelFormat: 'MMM yyyy',
          bucketMs: 30 * 24 * 60 * 60 * 1000, // Approximate
        };
    }
  }

  /**
   * Get the start of a time bucket
   */
  private getBucketStart(date: Date, bucketSize: TimelineBucketSize): Date {
    const result = new Date(date);

    switch (bucketSize) {
      case 'hour':
        result.setMinutes(0, 0, 0);
        break;
      case 'day':
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        result.setHours(0, 0, 0, 0);
        result.setDate(result.getDate() - result.getDay());
        break;
      case 'month':
        result.setHours(0, 0, 0, 0);
        result.setDate(1);
        break;
    }

    return result;
  }

  /**
   * Format a bucket key to match SQL strftime output
   */
  private formatBucketKey(date: Date, sqlFormat: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const week = this.getWeekNumber(date);

    return sqlFormat
      .replace('%Y', String(year))
      .replace('%m', month)
      .replace('%d', day)
      .replace('%H', hour)
      .replace('%W', String(week).padStart(2, '0'));
  }

  /**
   * Format a bucket label for display
   */
  private formatBucketLabel(date: Date, format: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = date.getFullYear();
    const month = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const week = this.getWeekNumber(date);

    return format
      .replace('yyyy', String(year))
      .replace('MMM', month)
      .replace('dd', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('%W', String(week).padStart(2, '0'));
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}

// Export singleton getter for convenience
export const getStatsService = (): StatsService => StatsService.getInstance();
