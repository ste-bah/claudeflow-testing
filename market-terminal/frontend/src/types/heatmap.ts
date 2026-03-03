/**
 * Heatmap types, normalizer, color helper, and constants.
 * Wire-format types match the backend GET /api/heatmap response exactly.
 */

// ---------------------------------------------------------------------------
// Wire-format types (snake_case -- matches backend response)
// ---------------------------------------------------------------------------

export interface HeatmapStockRaw {
  readonly symbol: string;
  readonly name: string;
  readonly sector: string;
  readonly indices: string[];
  readonly change_pct: number | null;
  readonly market_cap: number | null;
  readonly price: number | null;
}

export interface HeatmapResponseRaw {
  readonly stocks: HeatmapStockRaw[];
  readonly refreshed_at: string;
  readonly next_refresh_in: number;
  readonly total_count: number;
  readonly filtered_count: number;
  readonly prices_ready: boolean;
}

// ---------------------------------------------------------------------------
// Display types (camelCase -- for React components)
// ---------------------------------------------------------------------------

export interface HeatmapStock {
  readonly symbol: string;
  readonly name: string;
  readonly sector: string;
  readonly indices: string[];
  readonly changePct: number;      // 0.0 if null
  readonly marketCap: number;      // 0 if null
  readonly price: number | null;
}

export interface HeatmapData {
  readonly stocks: HeatmapStock[];
  readonly refreshedAt: string;
  readonly nextRefreshIn: number;
  readonly totalCount: number;
  readonly filteredCount: number;
  readonly pricesReady: boolean;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type IndexFilter = 'all' | 'sp500' | 'nasdaq100';

export const SECTORS = [
  'all',
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Industrials',
  'Communication Services',
  'Materials',
  'Utilities',
  'Real Estate',
  'Other',
] as const;

export type SectorFilter = typeof SECTORS[number];

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

export function normalizeHeatmapStock(raw: HeatmapStockRaw): HeatmapStock {
  return {
    symbol: raw.symbol,
    name: raw.name,
    sector: raw.sector,
    indices: raw.indices,
    changePct:
      typeof raw.change_pct === 'number' && Number.isFinite(raw.change_pct)
        ? raw.change_pct
        : 0.0,
    marketCap:
      typeof raw.market_cap === 'number' &&
      Number.isFinite(raw.market_cap) &&
      raw.market_cap > 0
        ? raw.market_cap
        : 0,
    price:
      typeof raw.price === 'number' && Number.isFinite(raw.price)
        ? raw.price
        : null,
  };
}

export function normalizeHeatmapResponse(raw: HeatmapResponseRaw): HeatmapData {
  return {
    stocks: raw.stocks.map(normalizeHeatmapStock),
    refreshedAt: raw.refreshed_at,
    nextRefreshIn: raw.next_refresh_in,
    totalCount: raw.total_count,
    filteredCount: raw.filtered_count,
    pricesReady: raw.prices_ready,
  };
}

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------

// Bright TradingVision-style color scale: ±5% range with vivid reds and greens
const COLOR_STOPS: Array<{ pct: number; r: number; g: number; b: number }> = [
  { pct: -5,   r: 150, g: 0,   b: 0  },  // dark crimson
  { pct: -3,   r: 190, g: 20,  b: 20 },  // bright red
  { pct: -1,   r: 130, g: 30,  b: 30 },  // medium red
  { pct: -0.1, r: 60,  g: 20,  b: 20 },  // near-neutral dark red
  { pct:  0,   r: 18,  g: 18,  b: 24 },  // neutral near-black
  { pct:  0.1, r: 20,  g: 50,  b: 20 },  // near-neutral dark green
  { pct:  1,   r: 30,  g: 130, b: 30 },  // medium green
  { pct:  3,   r: 20,  g: 190, b: 20 },  // bright green
  { pct:  5,   r: 0,   g: 150, b: 0  },  // dark green
];

/**
 * Map a percentage change to an RGB background color for heatmap tiles.
 * Input is clamped to [-5, +5] before interpolation.
 * Produces bright TradingVision-style reds and greens.
 *
 * @param changePct - Percentage change (e.g. 1.5 for +1.5%)
 * @returns CSS rgb() string
 */
export function getHeatmapColor(changePct: number): string {
  const clamped = Math.max(-5, Math.min(5, changePct));

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lo = COLOR_STOPS[i];
    const hi = COLOR_STOPS[i + 1];
    if (clamped >= lo.pct && clamped <= hi.pct) {
      const t = (hi.pct === lo.pct) ? 0 : (clamped - lo.pct) / (hi.pct - lo.pct);
      const r = Math.round(lo.r + t * (hi.r - lo.r));
      const g = Math.round(lo.g + t * (hi.g - lo.g));
      const b = Math.round(lo.b + t * (hi.b - lo.b));
      return `rgb(${r},${g},${b})`;
    }
  }

  // Fallback: return last stop color (reached at exactly +5)
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  return `rgb(${last.r},${last.g},${last.b})`;
}
