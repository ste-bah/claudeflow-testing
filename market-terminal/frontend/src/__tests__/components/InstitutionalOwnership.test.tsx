import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import InstitutionalOwnership from '../../components/InstitutionalOwnership';
import type { OwnershipData, OwnershipHolder, OwnershipQoQ } from '../../types/ownership';

// ---------------------------------------------------------------------------
// Mock the useOwnership hook
// ---------------------------------------------------------------------------
const mockUseOwnership = vi.fn();
vi.mock('../../hooks/useOwnership', () => ({
  useOwnership: (...args: unknown[]) => mockUseOwnership(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set the return value of the mocked hook. */
function setHookReturn(
  overrides: Partial<{
    data: OwnershipData | null;
    loading: boolean;
    error: string | null;
  }> = {},
) {
  mockUseOwnership.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    ...overrides,
  });
}

/** Build a single holder record with sensible defaults. */
function makeHolder(overrides: Partial<OwnershipHolder> = {}): OwnershipHolder {
  return {
    holderName: 'Vanguard Group Inc',
    cik: '0000102909',
    shares: 1234567890,
    value: 123456789000,
    percentOfOutstanding: 8.5,
    changeShares: 5000000,
    changePercent: 2.3,
    filingDate: '2024-12-31',
    ...overrides,
  };
}

/** Build a full OwnershipData object. */
function makeOwnershipData(
  overrides: Partial<OwnershipData> = {},
): OwnershipData {
  const qoq: OwnershipQoQ = {
    newPositions: 10,
    increasedPositions: 25,
    decreasedPositions: 15,
    closedPositions: 5,
    netSharesChange: 100000000,
  };

  return {
    symbol: 'AAPL',
    filingPeriod: '2024-Q4',
    totalInstitutionalShares: 15000000000,
    totalInstitutionalValue: 2870000000000,
    institutionalOwnershipPercent: 65.2,
    holders: [
      makeHolder({ holderName: 'Vanguard Group Inc', shares: 1500000000 }),
      makeHolder({ holderName: 'BlackRock Inc', shares: 1200000000, changePercent: -1.5 }),
      makeHolder({ holderName: 'State Street Corp', shares: 900000000, changePercent: null }),
    ],
    quarterOverQuarter: qoq,
    dataSource: 'SEC EDGAR',
    dataTimestamp: '2024-12-01T12:00:00Z',
    note: '',
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
describe('InstitutionalOwnership Component', () => {
  // ---- Rendering states ----

  describe('Rendering states', () => {
    it('should render heading', () => {
      render(<InstitutionalOwnership symbol="AAPL" />);
      const heading = screen.getByRole('heading', { name: /Institutional Ownership/i });
      expect(heading).toBeInTheDocument();
    });

    it('should show loading skeleton when loading=true', () => {
      setHookReturn({ loading: true });
      const { container } = render(<InstitutionalOwnership symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should show error message when error is set', () => {
      setHookReturn({ error: 'Failed to load ownership data. Please try again later.' });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(
        screen.getByText(/Failed to load ownership data/i),
      ).toBeInTheDocument();
    });

    it('should show empty state when data=null and not loading', () => {
      setHookReturn({ data: null, loading: false });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(
        screen.getByText(/No institutional ownership data available/i),
      ).toBeInTheDocument();
    });

    it('should show data content when data is provided', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('Total Institutional Ownership')).toBeInTheDocument();
    });

    it('should not show empty state when loading', () => {
      setHookReturn({ loading: true, data: null });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(
        screen.queryByText(/No institutional ownership data available/i),
      ).not.toBeInTheDocument();
    });

    it('should not show error while loading', () => {
      setHookReturn({ loading: true, error: 'Some error' });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.queryByText(/Some error/)).not.toBeInTheDocument();
    });
  });

  // ---- Summary Row ----

  describe('Summary Row', () => {
    it('should render institutional ownership percent when available', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('65.2%')).toBeInTheDocument();
    });

    it('should fallback to totalInstitutionalValue when percent is null', () => {
      const data = makeOwnershipData({
        institutionalOwnershipPercent: null,
        totalInstitutionalValue: 2870000000000,
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      // Should show formatted currency instead of percent
      expect(screen.getByText('$2.87T')).toBeInTheDocument();
    });

    it('should show note when present', () => {
      const data = makeOwnershipData({
        note: 'Data may be incomplete for recent filings',
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText(/Data may be incomplete/i)).toBeInTheDocument();
    });

    it('should not show note when empty', () => {
      const data = makeOwnershipData({ note: '' });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.queryByText(/Data may be incomplete/i)).not.toBeInTheDocument();
    });
  });

  // ---- Holders Table ----

  describe('Holders Table', () => {
    it('should render table when holders present', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should show empty state when holders=[]', () => {
      const data = makeOwnershipData({ holders: [] });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(
        screen.getByText(/No institutional ownership data available/i),
      ).toBeInTheDocument();
    });

    it('should show up to 10 holders', () => {
      const holders = Array.from({ length: 15 }, (_, i) =>
        makeHolder({ holderName: `Holder ${i + 1}` }),
      );
      const data = makeOwnershipData({ holders });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      // 1 header row + 10 data rows (11th-15th holders are sliced off)
      expect(rows).toHaveLength(11);
    });

    it('should render holder name column', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('Vanguard Group Inc')).toBeInTheDocument();
    });

    it('should render shares column with formatted values', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      // 1500000000 -> 1.50B
      expect(screen.getByText('1.50B')).toBeInTheDocument();
    });

    it('should render percent of outstanding column', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ percentOfOutstanding: 8.5 })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('8.50%')).toBeInTheDocument();
    });

    it('should show "--" for null percent_of_outstanding', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ percentOfOutstanding: null })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      const table = screen.getByRole('table');
      const dashes = within(table).getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should render filing date column', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ filingDate: '2024-12-31' })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('2024-12-31')).toBeInTheDocument();
    });

    it('should show "--" for null filing date', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ filingDate: null })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      const table = screen.getByRole('table');
      const dashes = within(table).getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should render column headers', () => {
      setHookReturn({ data: makeOwnershipData() });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('Holder')).toBeInTheDocument();
      expect(screen.getByText('Shares')).toBeInTheDocument();
      expect(screen.getByText('% Out')).toBeInTheDocument();
      expect(screen.getByText('Change')).toBeInTheDocument();
      expect(screen.getByText('Filed')).toBeInTheDocument();
    });
  });

  // ---- Change Cell ----

  describe('Change Cell', () => {
    it('should show green text for positive change', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ changePercent: 2.3 })],
      });
      setHookReturn({ data });
      const { container } = render(<InstitutionalOwnership symbol="AAPL" />);
      const greenCells = container.querySelectorAll('.text-accent-green');
      expect(greenCells.length).toBeGreaterThan(0);
    });

    it('should show red text for negative change', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ changePercent: -1.5 })],
      });
      setHookReturn({ data });
      const { container } = render(<InstitutionalOwnership symbol="AAPL" />);
      const redCells = container.querySelectorAll('.text-accent-red');
      expect(redCells.length).toBeGreaterThan(0);
    });

    it('should show "--" for null change', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ changePercent: null })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      const table = screen.getByRole('table');
      const dashes = within(table).getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should format positive change with + prefix', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ changePercent: 2.3 })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('+2.30%')).toBeInTheDocument();
    });

    it('should format negative change without extra prefix', () => {
      const data = makeOwnershipData({
        holders: [makeHolder({ changePercent: -1.5 })],
      });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText('-1.50%')).toBeInTheDocument();
    });
  });

  // ---- Data Freshness Footer ----

  describe('Data Freshness Footer', () => {
    it('should render filing period footer when present', () => {
      const data = makeOwnershipData({ filingPeriod: '2024-Q4' });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.getByText(/13F data as of: 2024-Q4/i)).toBeInTheDocument();
    });

    it('should not render footer when filing period is null', () => {
      const data = makeOwnershipData({ filingPeriod: null });
      setHookReturn({ data });
      render(<InstitutionalOwnership symbol="AAPL" />);
      expect(screen.queryByText(/13F data as of/i)).not.toBeInTheDocument();
    });
  });

  // ---- XSS prevention ----

  describe('XSS prevention', () => {
    it('should use static error message (never contains symbol)', () => {
      setHookReturn({
        error: 'Failed to load ownership data. Please try again later.',
      });
      render(<InstitutionalOwnership symbol="<script>alert(1)</script>" />);
      const errorEl = screen.getByText(
        /Failed to load ownership data/i,
      );
      expect(errorEl.textContent).not.toContain('<script>');
    });

    it('should use static empty state message (never contains symbol)', () => {
      setHookReturn({ data: null, loading: false });
      render(<InstitutionalOwnership symbol="<img onerror=alert(1)>" />);
      const emptyEl = screen.getByText(/No institutional ownership data available/i);
      expect(emptyEl.textContent).not.toContain('<img');
    });
  });

  // ---- Styling ----

  describe('Styling', () => {
    it('should have terminal panel classes on root div', () => {
      const { container } = render(<InstitutionalOwnership symbol="" />);
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
      const { container } = render(<InstitutionalOwnership symbol="AAPL" />);
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should have error text in red', () => {
      setHookReturn({ error: 'Some error' });
      const { container } = render(<InstitutionalOwnership symbol="AAPL" />);
      const redEl = container.querySelector('.text-accent-red');
      expect(redEl).toBeTruthy();
    });
  });

  // ---- Hook integration ----

  describe('Hook integration', () => {
    it('should pass symbol to useOwnership', () => {
      render(<InstitutionalOwnership symbol="GOOG" />);
      expect(mockUseOwnership).toHaveBeenCalledWith('GOOG');
    });
  });
});
