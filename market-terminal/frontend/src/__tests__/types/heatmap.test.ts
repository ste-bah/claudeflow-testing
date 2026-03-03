import { describe, it, expect } from 'vitest';
import {
  normalizeHeatmapStock,
  normalizeHeatmapResponse,
  getHeatmapColor,
  SECTORS,
} from '../../types/heatmap';
import type { HeatmapStockRaw, HeatmapResponseRaw } from '../../types/heatmap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawStock(overrides: Partial<HeatmapStockRaw> = {}): HeatmapStockRaw {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    indices: ['sp500', 'nasdaq100'],
    change_pct: 1.23,
    market_cap: 3_100_000_000_000,
    price: 195.4,
    ...overrides,
  };
}

function makeRawResponse(overrides: Partial<HeatmapResponseRaw> = {}): HeatmapResponseRaw {
  return {
    stocks: [makeRawStock()],
    refreshed_at: '2026-03-02T14:30:00Z',
    next_refresh_in: 58,
    total_count: 523,
    filtered_count: 45,
    prices_ready: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeHeatmapStock
// ---------------------------------------------------------------------------

describe('normalizeHeatmapStock', () => {
  it('converts null changePct to 0.0', () => {
    const result = normalizeHeatmapStock(makeRawStock({ change_pct: null }));
    expect(result.changePct).toBe(0.0);
  });

  it('converts null marketCap to 0', () => {
    const result = normalizeHeatmapStock(makeRawStock({ market_cap: null }));
    expect(result.marketCap).toBe(0);
  });

  it('passes through finite changePct unchanged', () => {
    const result = normalizeHeatmapStock(makeRawStock({ change_pct: 2.75 }));
    expect(result.changePct).toBe(2.75);
  });

  it('passes through finite marketCap unchanged', () => {
    const result = normalizeHeatmapStock(makeRawStock({ market_cap: 3_100_000_000_000 }));
    expect(result.marketCap).toBe(3_100_000_000_000);
  });

  it('converts NaN changePct to 0.0', () => {
    const result = normalizeHeatmapStock(makeRawStock({ change_pct: NaN }));
    expect(result.changePct).toBe(0.0);
  });

  it('converts Infinity changePct to 0.0', () => {
    const result = normalizeHeatmapStock(makeRawStock({ change_pct: Infinity }));
    expect(result.changePct).toBe(0.0);
  });

  it('converts -Infinity changePct to 0.0', () => {
    const result = normalizeHeatmapStock(makeRawStock({ change_pct: -Infinity }));
    expect(result.changePct).toBe(0.0);
  });

  it('passes through a finite price', () => {
    const result = normalizeHeatmapStock(makeRawStock({ price: 195.4 }));
    expect(result.price).toBe(195.4);
  });

  it('converts null price to null', () => {
    const result = normalizeHeatmapStock(makeRawStock({ price: null }));
    expect(result.price).toBeNull();
  });

  it('converts non-finite price to null', () => {
    const result = normalizeHeatmapStock(makeRawStock({ price: NaN }));
    expect(result.price).toBeNull();
  });

  it('preserves symbol, name, sector and indices', () => {
    const result = normalizeHeatmapStock(makeRawStock());
    expect(result.symbol).toBe('AAPL');
    expect(result.name).toBe('Apple Inc.');
    expect(result.sector).toBe('Technology');
    expect(result.indices).toEqual(['sp500', 'nasdaq100']);
  });
});

// ---------------------------------------------------------------------------
// getHeatmapColor
// ---------------------------------------------------------------------------

describe('getHeatmapColor', () => {
  it('returns a dark red color at -3%  (r > 100, g < 50, b < 50)', () => {
    const color = getHeatmapColor(-3);
    // Should be rgb(139,0,0)
    const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!.map(Number);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeLessThan(50);
    expect(b).toBeLessThan(50);
  });

  it('returns the neutral dark color at 0% (close to near-black)', () => {
    const color = getHeatmapColor(0);
    // New neutral stop is rgb(18,18,24)
    expect(color).toBe('rgb(18,18,24)');
  });

  it('returns a green-dominant color at +3% (g > r, g > b)', () => {
    const color = getHeatmapColor(3);
    const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!.map(Number);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('clamps values below -5 to the -5 stop color', () => {
    // -6 is outside the scale; clamped to -5 which is the dark crimson stop
    expect(getHeatmapColor(-6)).toBe(getHeatmapColor(-5));
  });

  it('clamps values above +5 to the +5 stop color', () => {
    // +6 is outside the scale; clamped to +5 which is the dark green stop
    expect(getHeatmapColor(6)).toBe(getHeatmapColor(5));
  });

  it('interpolates between stops (0.5 is between 0.1 and +1 stops)', () => {
    const color = getHeatmapColor(0.5);
    const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    expect(match).not.toBeNull();
    // New stops: pct=0.1 → (20,50,20), pct=1 → (30,130,30)
    // t = (0.5 - 0.1) / (1 - 0.1) = 0.4/0.9 ≈ 0.4444
    // r = 20 + 0.4444*(30-20) = 20 + 4.444 ≈ 24
    // g = 50 + 0.4444*(130-50) = 50 + 35.56 ≈ 86
    // b = 20 + 0.4444*(30-20) = 20 + 4.444 ≈ 24
    const [, r, g, b] = match!.map(Number);
    expect(g).toBeGreaterThan(r); // green dominant
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(0);
  });

  it('returns an rgb() string format', () => {
    expect(getHeatmapColor(1.5)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });
});

// ---------------------------------------------------------------------------
// normalizeHeatmapResponse
// ---------------------------------------------------------------------------

describe('normalizeHeatmapResponse', () => {
  it('maps all snake_case fields to camelCase correctly', () => {
    const raw = makeRawResponse();
    const result = normalizeHeatmapResponse(raw);

    expect(result.refreshedAt).toBe('2026-03-02T14:30:00Z');
    expect(result.nextRefreshIn).toBe(58);
    expect(result.totalCount).toBe(523);
    expect(result.filteredCount).toBe(45);
  });

  it('normalizes each stock in the stocks array', () => {
    const raw = makeRawResponse({
      stocks: [makeRawStock({ change_pct: null }), makeRawStock({ symbol: 'MSFT', change_pct: -0.5 })],
    });
    const result = normalizeHeatmapResponse(raw);

    expect(result.stocks).toHaveLength(2);
    expect(result.stocks[0].changePct).toBe(0.0);
    expect(result.stocks[1].symbol).toBe('MSFT');
    expect(result.stocks[1].changePct).toBe(-0.5);
  });

  it('handles an empty stocks array', () => {
    const raw = makeRawResponse({ stocks: [] });
    const result = normalizeHeatmapResponse(raw);
    expect(result.stocks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SECTORS constant
// ---------------------------------------------------------------------------

describe('SECTORS', () => {
  it('includes "all" as the first entry', () => {
    expect(SECTORS[0]).toBe('all');
  });

  it('includes all 11 GICS sectors', () => {
    const gicsSectors = [
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
    ];
    for (const sector of gicsSectors) {
      expect(SECTORS).toContain(sector);
    }
  });

  it('includes "Other" for unclassified stocks', () => {
    expect(SECTORS).toContain('Other');
  });

  it('has 13 entries total (all + 11 GICS + Other)', () => {
    expect(SECTORS).toHaveLength(13);
  });
});
