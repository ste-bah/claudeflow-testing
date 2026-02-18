import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Fundamentals from '../../components/Fundamentals';
import type { FundamentalsData, FundamentalsTtm, FundamentalsQuarter } from '../../types/fundamentals';

// ---------------------------------------------------------------------------
// Mock the useFundamentals hook
// ---------------------------------------------------------------------------
const mockUseFundamentals = vi.fn();
vi.mock('../../hooks/useFundamentals', () => ({
  useFundamentals: (...args: unknown[]) => mockUseFundamentals(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set the return value of the mocked hook. */
function setHookReturn(
  overrides: Partial<{
    data: FundamentalsData | null;
    loading: boolean;
    error: string | null;
  }> = {},
) {
  mockUseFundamentals.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    ...overrides,
  });
}

/** Build a complete TTM object with sensible defaults. */
function makeTtm(overrides: Partial<FundamentalsTtm> = {}): FundamentalsTtm {
  return {
    revenue: 394328000000,
    netIncome: 96995000000,
    epsDiluted: 6.42,
    grossMargin: 0.4523,
    operatingMargin: 0.3031,
    netMargin: 0.2459,
    peRatio: 28.45,
    marketCap: 2870000000000,
    sharesOutstanding: 15461900000,
    freeCashFlow: 111443000000,
    debtToEquity: 1.76,
    returnOnEquity: 0.1715,
    dividendYield: 0.0055,
    ...overrides,
  };
}

/** Build a single quarterly entry with sensible defaults. */
function makeQuarter(overrides: Partial<FundamentalsQuarter> = {}): FundamentalsQuarter {
  return {
    period: 'Q4 2024',
    filingDate: '2024-11-01',
    filingType: '10-Q',
    revenue: 94930000000,
    netIncome: 23636000000,
    epsDiluted: 1.53,
    grossMargin: 0.4623,
    operatingMargin: 0.3178,
    netMargin: 0.2490,
    revenueGrowthYoy: 0.061,
    epsGrowthYoy: 0.122,
    freeCashFlow: 27000000000,
    ...overrides,
  };
}

/** Build a full FundamentalsData object. */
function makeFundamentalsData(
  overrides: Partial<FundamentalsData> = {},
): FundamentalsData {
  return {
    symbol: 'AAPL',
    companyName: 'Apple Inc',
    ttm: makeTtm(),
    quarterly: [
      makeQuarter({ period: 'Q4 2024' }),
      makeQuarter({
        period: 'Q3 2024',
        filingDate: '2024-08-02',
        revenue: 85777000000,
        netIncome: 21448000000,
        epsDiluted: 1.40,
        grossMargin: 0.4626,
        operatingMargin: 0.2977,
        netMargin: 0.2501,
        revenueGrowthYoy: 0.049,
        epsGrowthYoy: 0.111,
        freeCashFlow: 28900000000,
      }),
    ],
    dataSources: { financials: 'EDGAR', marketData: 'Finnhub' },
    dataTimestamp: '2024-12-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  setHookReturn();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Fundamentals Component', () => {
  // ---- Rendering states ----

  describe('Rendering states', () => {
    it('should render heading with symbol using em-dash', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      const heading = screen.getByRole('heading', { name: /Fundamentals/i });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toContain('\u2014');
      expect(heading.textContent).toContain('AAPL');
    });

    it('should render heading without em-dash when symbol is empty', () => {
      render(<Fundamentals symbol="" />);
      const heading = screen.getByRole('heading', { name: /Fundamentals/i });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).not.toContain('\u2014');
    });

    it('should show loading skeleton when loading=true', () => {
      setHookReturn({ loading: true });
      const { container } = render(<Fundamentals symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should show error message when error is set', () => {
      setHookReturn({ error: 'Failed to load fundamentals data. Please try again later.' });
      render(<Fundamentals symbol="AAPL" />);
      expect(
        screen.getByText(/Failed to load fundamentals data/i),
      ).toBeInTheDocument();
    });

    it('should show empty state when data=null and not loading', () => {
      setHookReturn({ data: null, loading: false });
      render(<Fundamentals symbol="AAPL" />);
      expect(
        screen.getByText(/No fundamental data available/i),
      ).toBeInTheDocument();
    });

    it('should show data content when data is provided', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // Should show metric labels
      expect(screen.getByText('Market Cap')).toBeInTheDocument();
      expect(screen.getByText('P/E Ratio')).toBeInTheDocument();
    });

    it('should not show empty state when loading', () => {
      setHookReturn({ loading: true, data: null });
      render(<Fundamentals symbol="AAPL" />);
      expect(
        screen.queryByText(/No fundamental data available/i),
      ).not.toBeInTheDocument();
    });

    it('should not show error while loading', () => {
      setHookReturn({ loading: true, error: 'Some error' });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.queryByText(/Some error/)).not.toBeInTheDocument();
    });
  });

  // ---- Heading regex ----

  describe('Heading format', () => {
    it('should match heading regex /Fundamentals/i', () => {
      render(<Fundamentals symbol="" />);
      expect(
        screen.getByRole('heading', { name: /Fundamentals/i }),
      ).toBeInTheDocument();
    });

    it('should match heading regex /Fundamentals.*AAPL/i when symbol="AAPL"', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(
        screen.getByRole('heading', { name: /Fundamentals.*AAPL/i }),
      ).toBeInTheDocument();
    });

    it('should NOT contain em-dash when symbol is empty string', () => {
      render(<Fundamentals symbol="" />);
      const heading = screen.getByRole('heading', { name: /Fundamentals/i });
      expect(heading.textContent).toBe('Fundamentals');
    });
  });

  // ---- Key Metrics Grid ----

  describe('Key Metrics Grid', () => {
    it('should render all 8 metric labels', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);

      const expectedLabels = [
        'Market Cap',
        'P/E Ratio',
        'EPS (TTM)',
        'Revenue',
        'Gross Margin',
        'Op. Margin',
        'Net Margin',
        'Div. Yield',
      ];
      for (const label of expectedLabels) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('should format currency values with K/M/B/T suffixes', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // Market Cap = 2870000000000 -> $2.87T
      expect(screen.getByText('$2.87T')).toBeInTheDocument();
      // Revenue = 394328000000 -> $394.33B
      expect(screen.getByText('$394.33B')).toBeInTheDocument();
    });

    it('should format percentages with %', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // Gross Margin = 0.4523 -> 45.23%
      expect(screen.getByText('45.23%')).toBeInTheDocument();
      // Div. Yield = 0.0055 -> 0.55%
      expect(screen.getByText('0.55%')).toBeInTheDocument();
    });

    it('should format P/E Ratio as a ratio (2 decimal places)', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // P/E = 28.45 -> "28.45"
      expect(screen.getByText('28.45')).toBeInTheDocument();
    });

    it('should format EPS as dollar value', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // EPS = 6.42 -> "$6.42"
      expect(screen.getByText('$6.42')).toBeInTheDocument();
    });

    it('should show "--" for null metrics', () => {
      const data = makeFundamentalsData({
        ttm: makeTtm({
          marketCap: null,
          peRatio: null,
          epsDiluted: null,
          revenue: null,
          grossMargin: null,
          operatingMargin: null,
          netMargin: null,
          dividendYield: null,
        }),
      });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      // All 8 metric values should be "--"
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(8);
    });

    it('should handle ttm=null gracefully (all metrics show "--")', () => {
      const data = makeFundamentalsData({ ttm: null });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      // All metrics should be "--", at least 8 from the grid
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ---- Quarterly Table ----

  describe('Quarterly Table', () => {
    it('should render table when quarters present', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should not render table when quarters=[]', () => {
      const data = makeFundamentalsData({ quarterly: [] });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('should show up to 4 quarters', () => {
      const quarters = [
        makeQuarter({ period: 'Q4 2024' }),
        makeQuarter({ period: 'Q3 2024' }),
        makeQuarter({ period: 'Q2 2024' }),
        makeQuarter({ period: 'Q1 2024' }),
        makeQuarter({ period: 'Q4 2023' }),
      ];
      const data = makeFundamentalsData({ quarterly: quarters });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      // 1 header row + 4 data rows (5th quarter is sliced off)
      expect(rows).toHaveLength(5);
    });

    it('should render period and filing date columns', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText('Q4 2024')).toBeInTheDocument();
      expect(screen.getByText('2024-11-01')).toBeInTheDocument();
    });

    it('should format EPS values in table as dollar amounts', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // EPS = 1.53 -> "$1.53"
      expect(screen.getByText('$1.53')).toBeInTheDocument();
    });

    it('should show green class for positive growth', () => {
      setHookReturn({ data: makeFundamentalsData() });
      const { container } = render(<Fundamentals symbol="AAPL" />);
      // revenueGrowthYoy = 0.061 -> 6.10%
      const greenCells = container.querySelectorAll('.text-accent-green');
      expect(greenCells.length).toBeGreaterThan(0);
    });

    it('should show red class for negative growth', () => {
      const data = makeFundamentalsData({
        quarterly: [
          makeQuarter({
            period: 'Q4 2024',
            revenueGrowthYoy: -0.05,
            epsGrowthYoy: -0.03,
          }),
        ],
      });
      setHookReturn({ data });
      const { container } = render(<Fundamentals symbol="AAPL" />);
      const redCells = container.querySelectorAll('.text-accent-red');
      expect(redCells.length).toBeGreaterThan(0);
    });

    it('should show "--" for null growth values', () => {
      const data = makeFundamentalsData({
        quarterly: [
          makeQuarter({
            period: 'Q4 2024',
            revenueGrowthYoy: null,
            epsGrowthYoy: null,
          }),
        ],
      });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      // Should find "--" in growth cells
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it('should show "--" for null filing date', () => {
      const data = makeFundamentalsData({
        quarterly: [makeQuarter({ period: 'Q4 2024', filingDate: null })],
      });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should render column headers', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText('Period')).toBeInTheDocument();
      expect(screen.getByText('Filing Date')).toBeInTheDocument();
      expect(screen.getByText('EPS')).toBeInTheDocument();
      expect(screen.getByText('Rev. Growth')).toBeInTheDocument();
      expect(screen.getByText('EPS Growth')).toBeInTheDocument();
    });
  });

  // ---- Key Ratios ----

  describe('Key Ratios', () => {
    it('should render D/E, ROE, FCF labels', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText('Debt/Equity')).toBeInTheDocument();
      expect(screen.getByText('ROE')).toBeInTheDocument();
      expect(screen.getByText('FCF')).toBeInTheDocument();
    });

    it('should format Debt/Equity as a ratio', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // D/E = 1.76 -> "1.76"
      expect(screen.getByText('1.76')).toBeInTheDocument();
    });

    it('should format ROE as a percentage', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // ROE = 0.1715 -> "17.15%"
      expect(screen.getByText('17.15%')).toBeInTheDocument();
    });

    it('should format FCF as currency', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      // FCF = 111443000000 -> "$111.44B"
      expect(screen.getByText('$111.44B')).toBeInTheDocument();
    });

    it('should show "--" when all ratio values are null', () => {
      const data = makeFundamentalsData({
        ttm: makeTtm({
          debtToEquity: null,
          returnOnEquity: null,
          freeCashFlow: null,
        }),
      });
      setHookReturn({ data });
      render(<Fundamentals symbol="AAPL" />);
      // The 3 ratio values should be "--"
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---- Data sources footer ----

  describe('Data sources footer', () => {
    it('should render data source info', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText(/Data:/)).toBeInTheDocument();
    });

    it('should show financials and marketData providers', () => {
      setHookReturn({ data: makeFundamentalsData() });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText(/EDGAR/)).toBeInTheDocument();
      expect(screen.getByText(/Finnhub/)).toBeInTheDocument();
    });

    it('should not render data sources when dataSources is falsy', () => {
      const data = makeFundamentalsData();
      // Remove dataSources by casting to bypass TS
      const noSources = { ...data, dataSources: undefined } as unknown as FundamentalsData;
      setHookReturn({ data: noSources });
      render(<Fundamentals symbol="AAPL" />);
      expect(screen.queryByText(/Data:/)).not.toBeInTheDocument();
    });
  });

  // ---- XSS prevention ----

  describe('XSS prevention', () => {
    it('should use static error message (never contains symbol)', () => {
      setHookReturn({
        error: 'Failed to load fundamentals data. Please try again later.',
      });
      render(<Fundamentals symbol="<script>alert(1)</script>" />);
      const errorEl = screen.getByText(
        /Failed to load fundamentals data/i,
      );
      expect(errorEl.textContent).not.toContain('<script>');
    });

    it('should use static empty state message (never contains symbol)', () => {
      setHookReturn({ data: null, loading: false });
      render(<Fundamentals symbol="<img onerror=alert(1)>" />);
      const emptyEl = screen.getByText(/No fundamental data available/i);
      expect(emptyEl.textContent).not.toContain('<img');
    });
  });

  // ---- Styling ----

  describe('Styling', () => {
    it('should have terminal panel classes on root div', () => {
      const { container } = render(<Fundamentals symbol="" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass(
        'bg-terminal-panel',
        'border',
        'border-terminal-border',
        'rounded',
      );
    });

    it('should have animate-pulse on loading skeleton elements', () => {
      setHookReturn({ loading: true });
      const { container } = render(<Fundamentals symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
      // Skeleton has grid placeholders + row placeholders + ratio placeholders
      // 8 grid items + 4 table rows + 3 ratio rows = 15 total
      expect(pulseElements.length).toBeGreaterThanOrEqual(10);
    });

    it('should have error text in red', () => {
      setHookReturn({ error: 'Some error' });
      const { container } = render(<Fundamentals symbol="AAPL" />);
      const redEl = container.querySelector('.text-accent-red');
      expect(redEl).toBeTruthy();
    });
  });

  // ---- Rerender ----

  describe('Rerender', () => {
    it('should update when symbol changes', () => {
      setHookReturn({ data: makeFundamentalsData() });
      const { rerender } = render(<Fundamentals symbol="AAPL" />);
      expect(screen.getByText(/AAPL/)).toBeInTheDocument();

      rerender(<Fundamentals symbol="MSFT" />);
      expect(screen.getByText(/MSFT/)).toBeInTheDocument();
      expect(screen.queryByText(/AAPL/)).not.toBeInTheDocument();
    });

    it('should call useFundamentals with updated symbol on rerender', () => {
      setHookReturn({ data: makeFundamentalsData() });
      const { rerender } = render(<Fundamentals symbol="AAPL" />);
      expect(mockUseFundamentals).toHaveBeenCalledWith('AAPL');

      rerender(<Fundamentals symbol="TSLA" />);
      expect(mockUseFundamentals).toHaveBeenCalledWith('TSLA');
    });

    it('should call useFundamentals with empty string for no symbol', () => {
      render(<Fundamentals symbol="" />);
      expect(mockUseFundamentals).toHaveBeenCalledWith('');
    });
  });

  // ---- Hook integration ----

  describe('Hook integration', () => {
    it('should pass symbol to useFundamentals', () => {
      render(<Fundamentals symbol="GOOG" />);
      expect(mockUseFundamentals).toHaveBeenCalledWith('GOOG');
    });
  });
});
