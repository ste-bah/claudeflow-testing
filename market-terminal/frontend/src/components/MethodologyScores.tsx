/**
 * Methodology Scores panel displaying multi-methodology analysis signals.
 * Shows composite direction, per-methodology signal cards with confidence bars,
 * key levels, and metadata footer.
 *
 * All sub-components are file-private (not exported).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useAnalysis, clearAnalysisCache } from '../hooks/useAnalysis';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { WS_CHANNELS } from '../types/websocket';
import type {
  AnalysisSignal,
  AnalysisComposite,
  AnalysisMetadata,
  SignalTimeframe,
  SignalDirection,
  OverallDirection,
} from '../types/analysis';
import {
  METHODOLOGY_DISPLAY_NAMES,
  DIRECTION_CONFIG,
  TIMEFRAME_LABELS,
} from '../types/analysis';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MethodologyScoresProps {
  symbol: string;
}

// ---------------------------------------------------------------------------
// Sub-components (file-private)
// ---------------------------------------------------------------------------

/** Pulsing skeleton placeholder shown while analysis data loads. */
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3 bg-terminal-bg font-mono text-sm">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse bg-terminal-panel rounded"
        />
      ))}
    </div>
  );
}

/** Static error message in red. Never reflects user input (XSS prevention). */
function ErrorState({ error }: { readonly error: string }) {
  return (
    <div className="p-3 bg-terminal-bg font-mono text-sm">
      <p className="text-accent-red text-sm">{error}</p>
    </div>
  );
}

/** Muted text shown when no analysis data is available. */
function EmptyState() {
  return (
    <div className="p-3 bg-terminal-bg font-mono text-sm">
      <p className="text-text-muted text-sm">No analysis data available</p>
    </div>
  );
}

/**
 * Inline SVG arrow indicating signal direction.
 * - bullish/strong_bullish: upward green arrow
 * - bearish/strong_bearish: downward red arrow
 * - neutral: horizontal gray dash
 */
function DirectionArrow({ direction }: { readonly direction: SignalDirection | OverallDirection }) {
  if (direction === 'bullish' || direction === 'strong_bullish') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="inline-block text-accent-green"
        aria-label="Bullish"
      >
        <path
          d="M7 2L12 9H2L7 2Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (direction === 'bearish' || direction === 'strong_bearish') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="inline-block text-accent-red"
        aria-label="Bearish"
      >
        <path
          d="M7 12L2 5H12L7 12Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  // neutral
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="inline-block text-text-muted"
      aria-label="Neutral"
    >
      <rect x="2" y="6" width="10" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Composite header showing overall direction, confidence, confluence, and thesis.
 */
const CompositeHeader = React.memo(function CompositeHeader({ composite }: { readonly composite: AnalysisComposite }) {
  const config = DIRECTION_CONFIG[composite.overallDirection] ?? DIRECTION_CONFIG.neutral;

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-3">
      <div className="flex items-center gap-2 mb-1">
        <DirectionArrow direction={composite.overallDirection} />
        <span className={`font-bold ${config.colorClass}`}>
          {config.label}
        </span>
        <span className="text-text-primary">
          {(composite.overallConfidence * 100).toFixed(0)}%
        </span>
        <span className="ml-auto bg-terminal-border text-text-secondary text-xs px-2 py-0.5 rounded">
          {composite.confluenceCount} confluence
        </span>
      </div>
      {composite.tradeThesis && (
        <p className="text-text-secondary text-xs line-clamp-2 mt-1">
          {composite.tradeThesis}
        </p>
      )}
    </div>
  );
});

/**
 * Four-button filter bar: All, Short, Med, Long.
 * Active button is highlighted; inactive buttons are muted.
 */
const TimeframeFilterBar = React.memo(function TimeframeFilterBar({
  active,
  onChange,
  counts,
}: {
  readonly active: SignalTimeframe | 'all';
  readonly onChange: (tf: SignalTimeframe | 'all') => void;
  readonly counts: { short: number; medium: number; long: number };
}) {
  const totalCount = counts.short + counts.medium + counts.long;

  const buttons: Array<{ value: SignalTimeframe | 'all'; label: string; count: number }> = [
    { value: 'all', label: 'All', count: totalCount },
    { value: 'short', label: 'Short', count: counts.short },
    { value: 'medium', label: 'Med', count: counts.medium },
    { value: 'long', label: 'Long', count: counts.long },
  ];

  return (
    <div className="flex gap-1">
      {buttons.map((btn) => {
        const isActive = active === btn.value;
        return (
          <button
            key={btn.value}
            type="button"
            onClick={() => onChange(btn.value)}
            className={`
              px-2 py-1 rounded text-xs font-mono transition-colors duration-100
              ${isActive
                ? 'bg-terminal-border text-text-primary'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            {btn.label} ({btn.count})
          </button>
        );
      })}
    </div>
  );
});

/**
 * Horizontal confidence bar with direction-colored fill.
 */
function ConfidenceBar({
  confidence,
  direction,
}: {
  readonly confidence: number;
  readonly direction: SignalDirection | OverallDirection;
}) {
  const config = DIRECTION_CONFIG[direction] ?? DIRECTION_CONFIG.neutral;
  const widthPercent = Math.max(0, Math.min(100, confidence * 100));

  // Map text color class to background color class
  const bgColorMap: Record<string, string> = {
    'text-accent-green': 'bg-accent-green',
    'text-accent-red': 'bg-accent-red',
    'text-text-muted': 'bg-text-muted',
  };
  const barColor = bgColorMap[config.colorClass] ?? 'bg-text-muted';

  return (
    <div className="w-full h-1.5 bg-terminal-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${barColor}`}
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}

/**
 * Recursive key-levels renderer with depth and entry limits.
 * - depth limit: 2
 * - entry limit: 8 per level
 * - number -> toFixed(2)
 * - string -> as-is
 * - boolean -> "Yes"/"No"
 * - array -> "[N items]"
 * - object -> recurse (if depth allows)
 */
function KeyLevelsSection({
  levels,
  depth = 0,
}: {
  readonly levels: Record<string, unknown>;
  readonly depth?: number;
}) {
  const entries = Object.entries(levels);
  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, 8);

  return (
    <div className={`text-xs ${depth > 0 ? 'ml-3 mt-0.5' : 'mt-1'}`}>
      {visibleEntries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <span className="text-text-muted shrink-0">{key}:</span>
          {renderKeyLevelValue(value, depth)}
        </div>
      ))}
      {entries.length > 8 && (
        <span className="text-text-muted">...{entries.length - 8} more</span>
      )}
    </div>
  );
}

/** Renders a single key-level value according to its type. */
function renderKeyLevelValue(value: unknown, depth: number): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">--</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-text-secondary">{value ? 'Yes' : 'No'}</span>;
  }

  if (typeof value === 'number') {
    return (
      <span className="text-text-primary">
        {Number.isFinite(value) ? value.toFixed(2) : '--'}
      </span>
    );
  }

  if (typeof value === 'string') {
    return <span className="text-text-secondary">{value}</span>;
  }

  if (Array.isArray(value)) {
    return <span className="text-text-muted">[{value.length} items]</span>;
  }

  if (typeof value === 'object' && depth < 2) {
    return (
      <KeyLevelsSection
        levels={value as Record<string, unknown>}
        depth={depth + 1}
      />
    );
  }

  // Depth exceeded for nested objects
  if (typeof value === 'object') {
    return <span className="text-text-muted">[object]</span>;
  }

  return <span className="text-text-muted">--</span>;
}

/**
 * Card for a single methodology signal showing direction, confidence,
 * timeframe, reasoning, and key levels.
 */
const SignalCard = React.memo(function SignalCard({ signal }: { readonly signal: AnalysisSignal }) {
  const displayName =
    METHODOLOGY_DISPLAY_NAMES[signal.methodology] ?? signal.methodology;
  const config = DIRECTION_CONFIG[signal.direction] ?? DIRECTION_CONFIG.neutral;
  const timeframeLabel = TIMEFRAME_LABELS[signal.timeframe] ?? signal.timeframe;

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded p-2">
      {/* Header: methodology name + direction */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-text-primary font-bold text-xs">
          {displayName}
        </span>
        <DirectionArrow direction={signal.direction} />
        <span className={`text-xs ${config.colorClass}`}>
          {config.label}
        </span>
        <span className="ml-auto text-text-muted text-xs">
          {timeframeLabel}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-text-muted">Confidence</span>
          <span className="text-text-primary">
            {(signal.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <ConfidenceBar
          confidence={signal.confidence}
          direction={signal.direction}
        />
      </div>

      {/* Reasoning */}
      {signal.reasoning && (
        <p className="text-text-secondary text-xs line-clamp-2 mt-1">
          {signal.reasoning}
        </p>
      )}

      {/* Key levels */}
      {Object.keys(signal.keyLevels).length > 0 && (
        <KeyLevelsSection levels={signal.keyLevels} />
      )}
    </div>
  );
});

/**
 * Footer showing analysis duration, completion status, and any failures.
 */
const MetadataFooter = React.memo(function MetadataFooter({ metadata }: { readonly metadata: AnalysisMetadata }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted border-t border-terminal-border pt-2 mt-1">
      {/* Duration or cached indicator */}
      <span>
        {metadata.cached ? 'Cached' : `${metadata.analysisDurationMs}ms`}
      </span>

      {/* Completion count */}
      <span>
        {metadata.methodologiesCompleted}/{metadata.methodologiesRequested}
      </span>

      {/* Failed methodologies */}
      {metadata.failedMethodologies.length > 0 && (
        <span className="text-accent-red">
          Failed: {metadata.failedMethodologies.join(', ')}
        </span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MethodologyScores({ symbol }: MethodologyScoresProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useAnalysis(symbol, refreshKey);
  const [timeframeFilter, setTimeframeFilter] = useState<SignalTimeframe | 'all'>('all');
  const { subscribe, unsubscribe, onMessage } = useWebSocketContext();

  // When analysis completes for this symbol, clear cache and trigger re-fetch.
  useEffect(() => {
    if (!symbol) return;

    subscribe(WS_CHANNELS.AnalysisProgress);

    const removeListener = onMessage('analysis_complete', (msg) => {
      if (msg.symbol !== symbol) return;
      clearAnalysisCache();
      setRefreshKey((k) => k + 1);
    });

    return () => {
      removeListener();
      unsubscribe(WS_CHANNELS.AnalysisProgress);
    };
  }, [symbol, subscribe, unsubscribe, onMessage]);

  const filteredSignals = useMemo(() => {
    if (!data) return [];
    if (timeframeFilter === 'all') return data.signals;
    return data.signals.filter((s) => s.timeframe === timeframeFilter);
  }, [data, timeframeFilter]);

  const timeframeCounts = useMemo(() => {
    if (!data) return { short: 0, medium: 0, long: 0 };
    return {
      short: data.signals.filter((s) => s.timeframe === 'short').length,
      medium: data.signals.filter((s) => s.timeframe === 'medium').length,
      long: data.signals.filter((s) => s.timeframe === 'long').length,
    };
  }, [data]);

  if (!symbol) return null;
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.signals.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-3 p-3 bg-terminal-bg font-mono text-sm">
      <CompositeHeader composite={data.composite} />
      <TimeframeFilterBar
        active={timeframeFilter}
        onChange={setTimeframeFilter}
        counts={timeframeCounts}
      />
      <div className="flex flex-col gap-2">
        {filteredSignals.map((signal) => (
          <SignalCard key={signal.methodology} signal={signal} />
        ))}
      </div>
      <MetadataFooter metadata={data.metadata} />
    </div>
  );
}
