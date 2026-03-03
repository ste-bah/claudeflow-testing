/**
 * Tests for the HeatmapView component.
 *
 * Mocks the useHeatmap hook to isolate rendering from API calls.
 * Covers loading/error states, treemap grouping, dropdowns, and stats bar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeatmapView from '../../components/HeatmapView';
import type { HeatmapData } from '../../types/heatmap';

// ---------------------------------------------------------------------------
// Mock useHeatmap hook
// ---------------------------------------------------------------------------

const mockUseHeatmap = vi.fn();

vi.mock('../../hooks/useHeatmap', () => ({
  useHeatmap: (...args: unknown[]) => mockUseHeatmap(...args),
  clearHeatmapCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockData(overrides?: Partial<HeatmapData>): HeatmapData {
  return {
    stocks: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        indices: ['sp500'],
        changePct: 1.23,
        marketCap: 3_000_000_000_000,
        price: 195.40,
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft',
        sector: 'Technology',
        indices: ['sp500'],
        changePct: -0.45,
        marketCap: 2_800_000_000_000,
        price: 380.20,
      },
      {
        symbol: 'JPM',
        name: 'JPMorgan',
        sector: 'Financials',
        indices: ['sp500'],
        changePct: 0.82,
        marketCap: 500_000_000_000,
        price: 185.00,
      },
    ],
    refreshedAt: '2026-03-02T14:30:00Z',
    nextRefreshIn: 55,
    totalCount: 523,
    filteredCount: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return data
  mockUseHeatmap.mockReturnValue({ data: makeMockData(), loading: false, error: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeatmapView Component', () => {
  // 1. Loading state
  it('should show loading state when loading is true', () => {
    mockUseHeatmap.mockReturnValue({ data: null, loading: true, error: null });
    render(<HeatmapView />);
    expect(screen.getByText('Loading heatmap data...')).toBeInTheDocument();
  });

  // 2. Error state
  it('should show error message when error is set', () => {
    mockUseHeatmap.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load heatmap data. Please try again.',
    });
    render(<HeatmapView />);
    expect(screen.getByText('Failed to load heatmap data. Please try again.')).toBeInTheDocument();
  });

  // 3. Sector labels rendered from stocks
  it('should render sector labels from the grouped stocks', () => {
    render(<HeatmapView />);
    // "Technology" also appears in the sector dropdown, so use getAllByText
    expect(screen.getAllByText('Technology').length).toBeGreaterThanOrEqual(1);
    // "Financials" also appears in the sector dropdown
    expect(screen.getAllByText('Financials').length).toBeGreaterThanOrEqual(1);
  });

  // 4. Stock symbols rendered in cells
  it('should render stock symbols in heatmap cells', () => {
    render(<HeatmapView />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('JPM')).toBeInTheDocument();
  });

  // 5. Index dropdown changes call hook with new index
  it('should call useHeatmap with sp500 when S&P 500 is selected', () => {
    render(<HeatmapView />);
    const indexDropdown = screen.getByRole('combobox', { name: /index filter/i });
    fireEvent.change(indexDropdown, { target: { value: 'sp500' } });
    expect(mockUseHeatmap).toHaveBeenCalledWith('sp500', 'all');
  });

  // 6. Sector dropdown changes call hook with new sector
  it('should call useHeatmap with Technology when Technology sector is selected', () => {
    render(<HeatmapView />);
    const sectorDropdown = screen.getByRole('combobox', { name: /sector filter/i });
    fireEvent.change(sectorDropdown, { target: { value: 'Technology' } });
    expect(mockUseHeatmap).toHaveBeenCalledWith('all', 'Technology');
  });

  // 7. Shows "Showing X of Y stocks" count
  it('should display the showing count from data.filteredCount and data.totalCount', () => {
    render(<HeatmapView />);
    expect(screen.getByText('Showing 3 of 523 stocks')).toBeInTheDocument();
  });

  // 8. "All Sectors" label for sector=all option
  it('should render "All Sectors" as the label for the all sector option', () => {
    render(<HeatmapView />);
    const sectorDropdown = screen.getByRole('combobox', { name: /sector filter/i });
    const allOption = Array.from(sectorDropdown.querySelectorAll('option')).find(
      (opt) => (opt as HTMLOptionElement).value === 'all',
    ) as HTMLOptionElement;
    expect(allOption).toBeDefined();
    expect(allOption.text).toBe('All Sectors');
  });

  // 9. Empty stocks array renders no cells but no crash
  it('should render without crashing when stocks array is empty', () => {
    mockUseHeatmap.mockReturnValue({
      data: makeMockData({ stocks: [], filteredCount: 0, totalCount: 500 }),
      loading: false,
      error: null,
    });
    render(<HeatmapView />);
    expect(screen.getByText('Showing 0 of 500 stocks')).toBeInTheDocument();
    expect(screen.queryByTestId('heatmap-cell')).not.toBeInTheDocument();
  });

  // 10. Both dropdowns are rendered with correct options
  it('should render index dropdown with all three options', () => {
    render(<HeatmapView />);
    const indexDropdown = screen.getByRole('combobox', { name: /index filter/i });
    const options = Array.from(indexDropdown.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toContain('all');
    expect(options).toContain('sp500');
    expect(options).toContain('nasdaq100');
  });

  // 11. Sector dropdown includes all SECTORS values
  it('should render sector dropdown with all sector options', () => {
    render(<HeatmapView />);
    const sectorDropdown = screen.getByRole('combobox', { name: /sector filter/i });
    const options = Array.from(sectorDropdown.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toContain('all');
    expect(options).toContain('Technology');
    expect(options).toContain('Financials');
    expect(options).toContain('Healthcare');
    expect(options).toContain('Energy');
  });

  // 12. Stats bar not shown when data is null
  it('should not show stats bar when data is null', () => {
    mockUseHeatmap.mockReturnValue({ data: null, loading: true, error: null });
    render(<HeatmapView />);
    expect(screen.queryByText(/Showing \d+ of \d+ stocks/)).not.toBeInTheDocument();
  });

  // 13. Stocks in the same sector are grouped together
  it('should group AAPL and MSFT under the same Technology sector label', () => {
    render(<HeatmapView />);
    // "Technology" appears in both the dropdown and as a sector label.
    // Find the sector label div (not the option element).
    const techLabels = screen.getAllByText('Technology');
    const sectorLabelDiv = techLabels.find(
      (el) => el.tagName.toLowerCase() === 'div',
    )!;
    expect(sectorLabelDiv).toBeDefined();
    // The parent div contains the label + the row of cells
    const sectorContainer = sectorLabelDiv.parentElement!;
    expect(sectorContainer.textContent).toContain('AAPL');
    expect(sectorContainer.textContent).toContain('MSFT');
  });

  // 14. Hook called initially with default filters
  it('should call useHeatmap with default filters on initial render', () => {
    render(<HeatmapView />);
    expect(mockUseHeatmap).toHaveBeenCalledWith('all', 'all');
  });

  // 15. Index dropdown initial value is "all"
  it('should have "all" selected by default in the index dropdown', () => {
    render(<HeatmapView />);
    const indexDropdown = screen.getByRole('combobox', { name: /index filter/i }) as HTMLSelectElement;
    expect(indexDropdown.value).toBe('all');
  });

  // 16. Sector dropdown initial value is "all"
  it('should have "all" selected by default in the sector dropdown', () => {
    render(<HeatmapView />);
    const sectorDropdown = screen.getByRole('combobox', { name: /sector filter/i }) as HTMLSelectElement;
    expect(sectorDropdown.value).toBe('all');
  });

  // 17. Title "Market Heatmap" is displayed
  it('should display "Market Heatmap" as the panel title', () => {
    render(<HeatmapView />);
    expect(screen.getByText('Market Heatmap')).toBeInTheDocument();
  });

  // 18. Error state does not show cells
  it('should not render heatmap cells when in error state', () => {
    mockUseHeatmap.mockReturnValue({
      data: null,
      loading: false,
      error: 'Connection refused.',
    });
    render(<HeatmapView />);
    expect(screen.queryByTestId('heatmap-cell')).not.toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });
});
