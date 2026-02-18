import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import InsiderActivity from '../../components/InsiderActivity';
import type { InsiderData, InsiderTransaction, InsiderSummary } from '../../types/ownership';

// ---------------------------------------------------------------------------
// Mock the useInsider hook
// ---------------------------------------------------------------------------
const mockUseInsider = vi.fn();
vi.mock('../../hooks/useInsider', () => ({
  useInsider: (...args: unknown[]) => mockUseInsider(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set the return value of the mocked hook. */
function setHookReturn(
  overrides: Partial<{
    data: InsiderData | null;
    loading: boolean;
    error: string | null;
  }> = {},
) {
  mockUseInsider.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    ...overrides,
  });
}

/** Build a single insider transaction with sensible defaults. */
function makeTransaction(overrides: Partial<InsiderTransaction> = {}): InsiderTransaction {
  return {
    insiderName: 'John Doe',
    title: 'CEO',
    transactionType: 'P-Purchase',
    transactionDate: '2024-12-15',
    shares: 50000,
    pricePerShare: 150.5,
    totalValue: 7525000,
    sharesRemaining: 1000000,
    filingDate: '2024-12-17',
    ...overrides,
  };
}

/** Build a full InsiderData object. */
function makeInsiderData(
  overrides: Partial<InsiderData> = {},
): InsiderData {
  const summary: InsiderSummary = {
    periodDays: 90,
    totalInsiderBuys: 150000,
    totalInsiderSells: 50000,
    totalBuyValue: 22575000,
    totalSellValue: 7525000,
    netActivity: 'net_buying',
    buySellRatio: 3.0,
  };

  return {
    symbol: 'AAPL',
    transactions: [
      makeTransaction({ transactionType: 'P-Purchase', shares: 50000 }),
      makeTransaction({
        transactionType: 'S-Sale',
        shares: 25000,
        insiderName: 'Jane Smith',
        title: 'CFO',
      }),
      makeTransaction({
        transactionType: 'M-Exercise',
        shares: 10000,
        insiderName: 'Bob Johnson',
        title: null,
      }),
    ],
    summary,
    dataSource: 'SEC EDGAR',
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
describe('InsiderActivity Component', () => {
  // ---- Rendering states ----

  describe('Rendering states', () => {
    it('should render heading', () => {
      render(<InsiderActivity symbol="AAPL" />);
      const heading = screen.getByRole('heading', { name: /Insider Activity/i });
      expect(heading).toBeInTheDocument();
    });

    it('should show loading skeleton when loading=true', () => {
      setHookReturn({ loading: true });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should show error message when error is set', () => {
      setHookReturn({ error: 'Failed to load insider data. Please try again later.' });
      render(<InsiderActivity symbol="AAPL" />);
      expect(
        screen.getByText(/Failed to load insider data/i),
      ).toBeInTheDocument();
    });

    it('should show empty state when data=null and not loading', () => {
      setHookReturn({ data: null, loading: false });
      render(<InsiderActivity symbol="AAPL" />);
      expect(
        screen.getByText(/No insider activity data available/i),
      ).toBeInTheDocument();
    });

    it('should show data content when data is provided', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText(/Net Insider Activity/i)).toBeInTheDocument();
    });

    it('should not show empty state when loading', () => {
      setHookReturn({ loading: true, data: null });
      render(<InsiderActivity symbol="AAPL" />);
      expect(
        screen.queryByText(/No insider activity data available/i),
      ).not.toBeInTheDocument();
    });

    it('should not show error while loading', () => {
      setHookReturn({ loading: true, error: 'Some error' });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.queryByText(/Some error/)).not.toBeInTheDocument();
    });
  });

  // ---- Net Activity Summary ----

  describe('Net Activity Summary', () => {
    it('should render net activity label with period days', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText(/Net Insider Activity \(90d\)/i)).toBeInTheDocument();
    });

    it('should show green text for net buying', () => {
      const data = makeInsiderData({
        summary: {
          periodDays: 90,
          totalInsiderBuys: 150000,
          totalInsiderSells: 50000,
          totalBuyValue: 22575000,
          totalSellValue: 7525000,
          netActivity: 'net_buying',
          buySellRatio: 3.0,
        },
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const greenCells = container.querySelectorAll('.text-accent-green');
      expect(greenCells.length).toBeGreaterThan(0);
    });

    it('should show red text for net selling', () => {
      const data = makeInsiderData({
        summary: {
          periodDays: 90,
          totalInsiderBuys: 50000,
          totalInsiderSells: 150000,
          totalBuyValue: 7525000,
          totalSellValue: 22575000,
          netActivity: 'net_selling',
          buySellRatio: 0.33,
        },
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const redCells = container.querySelectorAll('.text-accent-red');
      expect(redCells.length).toBeGreaterThan(0);
    });

    it('should show muted text for neutral activity', () => {
      const data = makeInsiderData({
        summary: {
          periodDays: 90,
          totalInsiderBuys: 100000,
          totalInsiderSells: 100000,
          totalBuyValue: 15000000,
          totalSellValue: 15000000,
          netActivity: 'neutral',
          buySellRatio: 1.0,
        },
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const mutedCells = container.querySelectorAll('.text-text-muted');
      expect(mutedCells.length).toBeGreaterThan(0);
    });

    it('should format net shares with + prefix for buying', () => {
      const data = makeInsiderData({
        summary: {
          periodDays: 90,
          totalInsiderBuys: 150000,
          totalInsiderSells: 50000,
          totalBuyValue: 22575000,
          totalSellValue: 7525000,
          netActivity: 'net_buying',
          buySellRatio: 3.0,
        },
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      // 150000 - 50000 = 100000 -> +100.00K shares
      expect(screen.getByText(/\+100.00K shares/i)).toBeInTheDocument();
    });

    it('should format net shares without extra prefix for selling', () => {
      const data = makeInsiderData({
        summary: {
          periodDays: 90,
          totalInsiderBuys: 50000,
          totalInsiderSells: 150000,
          totalBuyValue: 7525000,
          totalSellValue: 22575000,
          netActivity: 'net_selling',
          buySellRatio: 0.33,
        },
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      // 50000 - 150000 = -100000 -> -100.00K shares
      expect(screen.getByText(/-100.00K shares/i)).toBeInTheDocument();
    });
  });

  // ---- Transaction Badges ----

  describe('Transaction Badges', () => {
    it('should render Purchase badge in green', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionType: 'P-Purchase' })],
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const greenBadges = container.querySelectorAll('.bg-accent-green');
      expect(greenBadges.length).toBeGreaterThan(0);
      expect(screen.getByText('Buy')).toBeInTheDocument();
    });

    it('should render Sale badge in red', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionType: 'S-Sale' })],
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const redBadges = container.querySelectorAll('.bg-accent-red');
      expect(redBadges.length).toBeGreaterThan(0);
      expect(screen.getByText('Sell')).toBeInTheDocument();
    });

    it('should render Exercise badge in amber', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionType: 'M-Exercise' })],
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const amberBadges = container.querySelectorAll('.bg-accent-amber');
      expect(amberBadges.length).toBeGreaterThan(0);
      expect(screen.getByText('Exercise')).toBeInTheDocument();
    });

    it('should render Grant badge in blue', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionType: 'A-Grant' })],
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const blueBadges = container.querySelectorAll('.bg-accent-blue');
      expect(blueBadges.length).toBeGreaterThan(0);
      expect(screen.getByText('Grant')).toBeInTheDocument();
    });

    it('should render unknown transaction type with gray fallback', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionType: 'X-Unknown' })],
      });
      setHookReturn({ data });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const grayBadges = container.querySelectorAll('.bg-gray-600');
      expect(grayBadges.length).toBeGreaterThan(0);
      expect(screen.getByText('X-Unknown')).toBeInTheDocument();
    });
  });

  // ---- Transactions Table ----

  describe('Transactions Table', () => {
    it('should render table when transactions present', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should show empty state when transactions=[]', () => {
      const data = makeInsiderData({ transactions: [] });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      expect(
        screen.getByText(/No insider activity data available/i),
      ).toBeInTheDocument();
    });

    it('should render insider name', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render insider title when present', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText('CEO')).toBeInTheDocument();
    });

    it('should not render title when null', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ title: null })],
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.queryByText('CEO')).not.toBeInTheDocument();
    });

    it('should render shares column with formatted values', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      // 50000 -> 50.00K
      expect(screen.getByText('50.00K')).toBeInTheDocument();
    });

    it('should render value column with formatted currency', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ totalValue: 7525000 })],
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      // 7525000 -> $7.53M
      expect(screen.getByText('$7.53M')).toBeInTheDocument();
    });

    it('should show "--" for null total value', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ totalValue: null })],
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      const table = screen.getByRole('table');
      const dashes = within(table).getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should render transaction date', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionDate: '2024-12-15' })],
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText('2024-12-15')).toBeInTheDocument();
    });

    it('should show "--" for null transaction date', () => {
      const data = makeInsiderData({
        transactions: [makeTransaction({ transactionDate: null })],
      });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      const table = screen.getByRole('table');
      const dashes = within(table).getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should render column headers', () => {
      setHookReturn({ data: makeInsiderData() });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText('Insider')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Shares')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });
  });

  // ---- Data Freshness Footer ----

  describe('Data Freshness Footer', () => {
    it('should render data timestamp footer', () => {
      const data = makeInsiderData({ dataTimestamp: '2024-12-01T12:00:00Z' });
      setHookReturn({ data });
      render(<InsiderActivity symbol="AAPL" />);
      expect(screen.getByText(/Form 4 data as of: 2024-12-01T12:00:00Z/i)).toBeInTheDocument();
    });
  });

  // ---- XSS prevention ----

  describe('XSS prevention', () => {
    it('should use static error message (never contains symbol)', () => {
      setHookReturn({
        error: 'Failed to load insider data. Please try again later.',
      });
      render(<InsiderActivity symbol="<script>alert(1)</script>" />);
      const errorEl = screen.getByText(
        /Failed to load insider data/i,
      );
      expect(errorEl.textContent).not.toContain('<script>');
    });

    it('should use static empty state message (never contains symbol)', () => {
      setHookReturn({ data: null, loading: false });
      render(<InsiderActivity symbol="<img onerror=alert(1)>" />);
      const emptyEl = screen.getByText(/No insider activity data available/i);
      expect(emptyEl.textContent).not.toContain('<img');
    });
  });

  // ---- Styling ----

  describe('Styling', () => {
    it('should have terminal panel classes on root div', () => {
      const { container } = render(<InsiderActivity symbol="" />);
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
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should have error text in red', () => {
      setHookReturn({ error: 'Some error' });
      const { container } = render(<InsiderActivity symbol="AAPL" />);
      const redEl = container.querySelector('.text-accent-red');
      expect(redEl).toBeTruthy();
    });
  });

  // ---- Hook integration ----

  describe('Hook integration', () => {
    it('should pass symbol to useInsider', () => {
      render(<InsiderActivity symbol="GOOG" />);
      expect(mockUseInsider).toHaveBeenCalledWith('GOOG');
    });
  });
});
