/**
 * HeatmapCell renders a single stock tile in the market heatmap treemap.
 * Uses absolute pixel positioning; size is determined by the squarified treemap layout.
 * Background color is derived from the stock's percentage change via getHeatmapColor().
 * Content adapts based on available cell area.
 */
import React from 'react';
import type { HeatmapStock } from '../types/heatmap';
import { getHeatmapColor } from '../types/heatmap';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeatmapCellProps {
  readonly stock: HeatmapStock;
  /** Pixel width of the cell (absolute positioning). */
  readonly width: number;
  /** Pixel height of the cell (absolute positioning). */
  readonly height: number;
  /** Pixel x position (left offset within the treemap container). */
  readonly x: number;
  /** Pixel y position (top offset within the treemap container). */
  readonly y: number;
  /** False while the backend price cache is warming up; shows placeholder text. */
  readonly pricesReady?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a change percentage with an explicit sign prefix. */
function formatChangePct(changePct: number): string {
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

/** Build the tooltip title string for a cell. */
function buildTitle(stock: HeatmapStock): string {
  const priceStr =
    stock.price !== null ? `$${stock.price.toFixed(2)}` : '';
  const changeStr = formatChangePct(stock.changePct);
  const parts = [stock.name, priceStr, changeStr].filter(Boolean);
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Content tier based on cell area
// ---------------------------------------------------------------------------

type ContentTier = 'large' | 'medium' | 'small' | 'tiny' | 'hidden';

/**
 * Tier based on both area AND minimum dimension so thin strips don't try
 * to render multi-line text that overflows or becomes unreadable.
 */
function getContentTier(width: number, height: number): ContentTier {
  const area = width * height;
  const minDim = Math.min(width, height);
  if (minDim < 16) return 'hidden';
  if (minDim < 28 || area < 500) return 'tiny';
  if (minDim < 48 || area < 1400) return 'small';
  if (area < 5500) return 'medium';
  return 'large';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** A single stock tile in the heatmap treemap, absolutely positioned by treemap layout. */
const HeatmapCell = React.memo(function HeatmapCell({
  stock,
  width,
  height,
  x,
  y,
  pricesReady = true,
}: HeatmapCellProps) {
  const bgColor = getHeatmapColor(stock.changePct);
  const changePctStr = pricesReady ? formatChangePct(stock.changePct) : '---';
  const title = buildTitle(stock);
  const tier = getContentTier(width, height);

  // 1px gap via slight size reduction, keeping absolute position exact
  const cellStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: width - 1,
    height: height - 1,
    boxSizing: 'border-box',
    backgroundColor: bgColor,
    color: '#ffffff',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(0,0,0,0.3)',
    cursor: 'default',
  };

  if (tier === 'hidden') {
    return <div style={cellStyle} title={title} data-testid="heatmap-cell" />;
  }

  const shadow = '0 1px 3px rgba(0,0,0,0.85)';

  if (tier === 'tiny') {
    return (
      <div style={cellStyle} title={title} data-testid="heatmap-cell">
        <span
          style={{
            fontSize: '8px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            lineHeight: 1,
            maxWidth: '100%',
            textShadow: shadow,
          }}
        >
          {stock.symbol}
        </span>
      </div>
    );
  }

  if (tier === 'small') {
    return (
      <div style={cellStyle} title={title} data-testid="heatmap-cell">
        <span style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: shadow }}>
          {stock.symbol}
        </span>
        <span style={{ fontSize: '10px', lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: shadow }}>
          {changePctStr}
        </span>
      </div>
    );
  }

  if (tier === 'medium') {
    return (
      <div style={cellStyle} title={title} data-testid="heatmap-cell">
        <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: shadow }}>
          {stock.symbol}
        </span>
        <span style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'nowrap', textShadow: shadow }}>
          {changePctStr}
        </span>
      </div>
    );
  }

  // tier === 'large': show symbol + price + change%
  const priceStr = !pricesReady ? '---' : (stock.price !== null ? `$${stock.price.toFixed(2)}` : null);
  return (
    <div style={cellStyle} title={title} data-testid="heatmap-cell">
      <span style={{ fontSize: '17px', fontWeight: 'bold', lineHeight: 1.2, textShadow: shadow }}>
        {stock.symbol}
      </span>
      {priceStr && (
        <span style={{ fontSize: '12px', lineHeight: 1.3, opacity: 0.9, textShadow: shadow }}>
          {priceStr}
        </span>
      )}
      <span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: 1.2, textShadow: shadow }}>
        {changePctStr}
      </span>
    </div>
  );
});

export default HeatmapCell;
export type { HeatmapCellProps };
