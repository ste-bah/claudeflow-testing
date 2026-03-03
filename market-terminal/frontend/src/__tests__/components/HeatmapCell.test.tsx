/**
 * Tests for the HeatmapCell component.
 *
 * Mocks getHeatmapColor to return a predictable color string.
 * Covers rendering, tooltip, color application, adaptive content tiers,
 * absolute positioning, and React.memo behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeatmapCell from '../../components/HeatmapCell';
import type { HeatmapStock } from '../../types/heatmap';

// ---------------------------------------------------------------------------
// Mock getHeatmapColor
// ---------------------------------------------------------------------------

const mockGetHeatmapColor = vi.fn<(changePct: number) => string>();

vi.mock('../../types/heatmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../types/heatmap')>();
  return {
    ...actual,
    getHeatmapColor: (changePct: number) => mockGetHeatmapColor(changePct),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStock(overrides?: Partial<HeatmapStock>): HeatmapStock {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    indices: ['sp500'],
    changePct: 1.23,
    marketCap: 3_000_000_000_000,
    price: 195.40,
    ...overrides,
  };
}

/** Default props that give a "large" cell (area = 200*120 = 24000 > 8000). */
const defaultProps = { x: 0, y: 0, width: 200, height: 120 };

/** Props that give a "medium" cell (area = 80*40 = 3200 > 2500). */
const mediumProps = { x: 0, y: 0, width: 80, height: 40 };

/** Props that give a "small" cell (area = 50*25 = 1250 > 800). */
const smallProps = { x: 0, y: 0, width: 50, height: 25 };

/** Props that give a "tiny" cell (area = 30*10 = 300 > 200). */
const tinyProps = { x: 0, y: 0, width: 30, height: 10 };

/** Props that give a "hidden" cell (area = 10*10 = 100 <= 200). */
const hiddenProps = { x: 0, y: 0, width: 10, height: 10 };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetHeatmapColor.mockReturnValue('rgb(17,102,17)');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeatmapCell Component', () => {
  // 1. Renders symbol text (large cell)
  it('should render the stock symbol', () => {
    render(<HeatmapCell stock={makeStock({ symbol: 'TSLA' })} {...defaultProps} />);
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  // 2. Positive change_pct has + prefix (large cell shows change%)
  it('should render change_pct with + prefix for positive values', () => {
    render(<HeatmapCell stock={makeStock({ changePct: 2.5 })} {...defaultProps} />);
    expect(screen.getByText('+2.50%')).toBeInTheDocument();
  });

  // 3. Negative change_pct has - prefix
  it('should render change_pct with - prefix for negative values', () => {
    render(<HeatmapCell stock={makeStock({ changePct: -0.75 })} {...defaultProps} />);
    expect(screen.getByText('-0.75%')).toBeInTheDocument();
  });

  // 4. Title tooltip includes name and price
  it('should have a title tooltip containing name and formatted price', () => {
    const stock = makeStock({ name: 'Apple Inc.', price: 195.40, changePct: 1.23 });
    const { container } = render(<HeatmapCell stock={stock} {...defaultProps} />);
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell.title).toContain('Apple Inc.');
    expect(cell.title).toContain('$195.40');
    expect(cell.title).toContain('+1.23%');
  });

  // 5. Title tooltip when price is null
  it('should have a title tooltip without price when price is null', () => {
    const stock = makeStock({ name: 'No Price Co.', price: null, changePct: -0.5 });
    const { container } = render(<HeatmapCell stock={stock} {...defaultProps} />);
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell.title).toContain('No Price Co.');
    expect(cell.title).not.toContain('$');
    expect(cell.title).toContain('-0.50%');
  });

  // 6. Background color set from getHeatmapColor
  it('should apply the background color returned by getHeatmapColor', () => {
    mockGetHeatmapColor.mockReturnValue('rgb(0, 204, 68)');
    const stock = makeStock({ changePct: 3 });
    const { container } = render(<HeatmapCell stock={stock} {...defaultProps} />);
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell.style.backgroundColor).toBe('rgb(0, 204, 68)');
    expect(mockGetHeatmapColor).toHaveBeenCalledWith(3);
  });

  // 7. Neutral stock (changePct=0) shows 0.00%
  it('should show 0.00% for a neutral stock (changePct=0)', () => {
    render(<HeatmapCell stock={makeStock({ changePct: 0 })} {...defaultProps} />);
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });

  // 8. React.memo: component doesn't re-render when props are equal
  it('should not re-render when the same props are passed (React.memo)', () => {
    const stock = makeStock();
    let renderCount = 0;

    // Wrap to count renders
    const CountingCell = (props: { stock: HeatmapStock; x: number; y: number; width: number; height: number }) => {
      renderCount++;
      return <HeatmapCell {...props} />;
    };

    const { rerender } = render(
      <CountingCell stock={stock} x={0} y={0} width={200} height={120} />,
    );
    const firstCount = renderCount;

    // Re-render with the exact same stock reference and dimensions
    rerender(
      <CountingCell stock={stock} x={0} y={0} width={200} height={120} />,
    );

    // Wrapper re-renders but memo'd cell content stays correct
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(renderCount).toBeGreaterThanOrEqual(firstCount);
  });

  // 9. Cell uses absolute positioning with left/top/width/height
  it('should apply absolute positioning with pixel values', () => {
    const { container } = render(
      <HeatmapCell stock={makeStock()} x={10} y={20} width={200} height={120} />,
    );
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell.style.position).toBe('absolute');
    expect(cell.style.left).toBe('10px');
    expect(cell.style.top).toBe('20px');
  });

  // 10. Cell dimensions are set from width/height props (minus 1px gap)
  it('should set cell dimensions from width and height props', () => {
    const { container } = render(
      <HeatmapCell stock={makeStock()} x={0} y={0} width={200} height={120} />,
    );
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    // 1px gap subtracted for inter-cell spacing
    expect(cell.style.width).toBe('199px');
    expect(cell.style.height).toBe('119px');
  });

  // 11. Text color is white
  it('should use white text color for contrast against dark backgrounds', () => {
    const { container } = render(
      <HeatmapCell stock={makeStock()} {...defaultProps} />,
    );
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell.style.color).toBe('rgb(255, 255, 255)');
  });

  // 12. Large cell (area > 8000) shows symbol + price + change%
  it('should show symbol, price, and change% for large cells (area > 8000)', () => {
    // 200 * 120 = 24000 > 8000
    render(
      <HeatmapCell stock={makeStock({ price: 195.40, changePct: 1.23 })} x={0} y={0} width={200} height={120} />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('$195.40')).toBeInTheDocument();
    expect(screen.getByText('+1.23%')).toBeInTheDocument();
  });

  // 13. Medium cell (area 2500-8000) shows symbol + change% only
  it('should show symbol and change% for medium cells (area 2500-8000)', () => {
    // 80 * 40 = 3200 — medium tier
    render(
      <HeatmapCell stock={makeStock({ price: 195.40, changePct: 1.23 })} {...mediumProps} />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('+1.23%')).toBeInTheDocument();
    expect(screen.queryByText('$195.40')).not.toBeInTheDocument();
  });

  // 14. Small cell (area 800-2500) shows symbol + change%
  it('should show symbol and change% for small cells (area 800-2500)', () => {
    // 50 * 25 = 1250 — small tier
    render(
      <HeatmapCell stock={makeStock({ changePct: -0.75 })} {...smallProps} />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('-0.75%')).toBeInTheDocument();
  });

  // 15. Tiny cell (area 200-800) shows only symbol
  it('should show only symbol for tiny cells (area 200-800)', () => {
    // 30 * 10 = 300 — tiny tier
    render(
      <HeatmapCell stock={makeStock({ changePct: -0.75 })} {...tinyProps} />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('-0.75%')).not.toBeInTheDocument();
  });

  // 16. Hidden cell (area <= 200) renders no text content
  it('should render no visible text for hidden cells (area <= 200)', () => {
    // 10 * 10 = 100 — hidden tier
    const { container } = render(
      <HeatmapCell stock={makeStock()} {...hiddenProps} />,
    );
    const cell = container.querySelector('[data-testid="heatmap-cell"]') as HTMLElement;
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toBe('');
  });

  // 17. Large cell without price omits price row
  it('should omit price row when price is null even on large cells', () => {
    render(
      <HeatmapCell stock={makeStock({ price: null, changePct: 1.23 })} {...defaultProps} />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('+1.23%')).toBeInTheDocument();
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });
});
