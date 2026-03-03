/**
 * HeatmapView renders the full market heatmap panel.
 *
 * Two-level squarified treemap:
 *  1. Sectors arranged proportional to their total market cap.
 *  2. Stocks within each sector block further squarified by individual market cap.
 *
 * All cells are absolutely positioned within one shared container so the layout
 * fills the full available space like TradingVision.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { IndexFilter, SectorFilter, HeatmapStock } from '../types/heatmap';
import { SECTORS } from '../types/heatmap';
import { useHeatmap } from '../hooks/useHeatmap';
import HeatmapCell from './HeatmapCell';
import { squarify } from '../utils/treemap';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTOR_GAP = 3;         // px gap between sector blocks
const LABEL_HEIGHT = 15;       // px reserved at top of each sector block for the name

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBySector(stocks: HeatmapStock[]): Map<string, HeatmapStock[]> {
  const map = new Map<string, HeatmapStock[]>();
  for (const s of stocks) {
    const arr = map.get(s.sector);
    if (arr) arr.push(s);
    else map.set(s.sector, [s]);
  }
  return map;
}

function formatAge(iso: string, nowMs: number): string {
  const diff = Math.floor((nowMs - new Date(iso).getTime()) / 1000);
  if (!isFinite(diff) || diff < 0) return '';
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

// ---------------------------------------------------------------------------
// Layout engine
// ---------------------------------------------------------------------------

interface CellLayout {
  stock: HeatmapStock;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LabelLayout {
  text: string;
  x: number;
  y: number;
  maxWidth: number;
}

function computeLayout(
  groups: Map<string, HeatmapStock[]>,
  W: number,
  H: number,
): { cells: CellLayout[]; labels: LabelLayout[] } {
  if (W <= 0 || H <= 0 || groups.size === 0) {
    return { cells: [], labels: [] };
  }

  // Level 1: sector treemap across the full container
  const sectorItems = Array.from(groups.entries()).map(([id, stocks]) => ({
    id,
    value: stocks.reduce((s, st) => s + Math.max(st.marketCap, 1), 0),
  }));

  const sectorRects = squarify(sectorItems, W / H);

  const cells: CellLayout[] = [];
  const labels: LabelLayout[] = [];

  for (const sr of sectorRects) {
    // Convert sector rect from 0-100 to pixels, leaving a gap on each side
    const sx = (sr.x / 100) * W + SECTOR_GAP / 2;
    const sy = (sr.y / 100) * H + SECTOR_GAP / 2;
    const sw = (sr.width / 100) * W - SECTOR_GAP;
    const sh = (sr.height / 100) * H - SECTOR_GAP;

    if (sw <= 0 || sh <= 0) continue;

    labels.push({ text: sr.id, x: sx + 3, y: sy + 1, maxWidth: sw - 6 });

    // Stock area is below the label line
    const aw = sw;
    const ah = sh - LABEL_HEIGHT;
    const ax = sx;
    const ay = sy + LABEL_HEIGHT;

    if (aw <= 4 || ah <= 4) continue;

    // Level 2: stock treemap within the sector area
    const sectorStocks = groups.get(sr.id) ?? [];
    const bySymbol = new Map(sectorStocks.map(s => [s.symbol, s]));
    const stockItems = sectorStocks.map(s => ({
      id: s.symbol,
      value: Math.max(s.marketCap, 1),
    }));

    const stockRects = squarify(stockItems, aw / ah);

    for (const stockR of stockRects) {
      const stock = bySymbol.get(stockR.id);
      if (!stock) continue;
      cells.push({
        stock,
        x: ax + (stockR.x / 100) * aw,
        y: ay + (stockR.y / 100) * ah,
        w: (stockR.width / 100) * aw,
        h: (stockR.height / 100) * ah,
      });
    }
  }

  return { cells, labels };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontSize: '12px',
        fontFamily: 'monospace',
      }}
    >
      Loading heatmap data...
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#cc3333',
        fontSize: '12px',
        fontFamily: 'monospace',
        padding: '16px',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const dropdownStyle: React.CSSProperties = {
  backgroundColor: '#111827',
  color: '#d1d5db',
  border: '1px solid #374151',
  fontSize: '11px',
  padding: '3px 6px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  borderRadius: '3px',
};

/** Full-screen market heatmap using a nested squarified treemap layout. */
export default function HeatmapView() {
  const [indexFilter, setIndexFilter] = useState<IndexFilter>('all');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('all');
  const { data, loading, error } = useHeatmap(indexFilter, sectorFilter);

  // 1-second tick for the "last updated" age label
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Measure the outer container size so the treemap fills all available space.
  const outerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [treemapSize, setTreemapSize] = useState({ w: 1200, h: 700 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const outerH = el.getBoundingClientRect().height;
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 44;
      setTreemapSize({
        w: el.getBoundingClientRect().width,
        h: Math.max(50, outerH - headerH),
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stocks = data?.stocks ?? [];
  const groups = useMemo(() => groupBySector(stocks), [stocks]);
  const { cells, labels } = useMemo(
    () => computeLayout(groups, treemapSize.w, treemapSize.h),
    [groups, treemapSize.w, treemapSize.h],
  );

  const lastUpdated = data?.refreshedAt ? formatAge(data.refreshedAt, nowMs) : '';

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0e1a',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        ref={headerRef}
        style={{
          flexShrink: 0,
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #1a2a3a',
        }}
      >
        <span style={{ color: '#c9d1d9', fontSize: '12px', fontWeight: 'bold' }}>
          Market Heatmap
        </span>

        <select
          style={dropdownStyle}
          value={indexFilter}
          onChange={e => setIndexFilter(e.target.value as IndexFilter)}
          aria-label="Index filter"
        >
          <option value="all">All Indices</option>
          <option value="sp500">S&amp;P 500</option>
          <option value="nasdaq100">NASDAQ 100</option>
        </select>

        <select
          style={dropdownStyle}
          value={sectorFilter}
          onChange={e => setSectorFilter(e.target.value as SectorFilter)}
          aria-label="Sector filter"
        >
          {SECTORS.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Sectors' : s}
            </option>
          ))}
        </select>

        {data && (
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            {data.filteredCount} / {data.totalCount} stocks
          </span>
        )}

        {lastUpdated && (
          <span
            style={{ color: '#4b5563', fontSize: '10px', marginLeft: 'auto' }}
            data-testid="last-updated"
          >
            {lastUpdated}
          </span>
        )}
      </div>

      {/* ── Treemap ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LoadingState />}
        {error && !loading && <ErrorState message={error} />}

        {!loading && !error && (
          <>
            {/* Sector labels */}
            {labels.map(label => (
              <div
                key={`sector-label-${label.text}`}
                style={{
                  position: 'absolute',
                  left: label.x,
                  top: label.y,
                  maxWidth: label.maxWidth,
                  color: '#9ca3af',
                  fontSize: '10px',
                  lineHeight: '13px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                {label.text}
              </div>
            ))}

            {/* Stock cells */}
            {cells.map(cell => (
              <HeatmapCell
                key={cell.stock.symbol}
                stock={cell.stock}
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
