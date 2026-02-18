import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chart from '../../components/Chart';

// ---------------------------------------------------------------------------
// Mock lightweight-charts (jsdom has no canvas)
// ---------------------------------------------------------------------------
const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockPriceScale = vi.fn(() => ({ applyOptions: vi.fn() }));
const mockTimeScale = vi.fn(() => ({ fitContent: mockFitContent }));

const mockAddCandlestickSeries = vi.fn(() => ({ setData: mockSetData }));
const mockAddHistogramSeries = vi.fn(() => ({ setData: mockSetData }));

const mockChart = {
  addCandlestickSeries: mockAddCandlestickSeries,
  addHistogramSeries: mockAddHistogramSeries,
  priceScale: mockPriceScale,
  timeScale: mockTimeScale,
  applyOptions: mockApplyOptions,
  remove: mockRemove,
};

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
}));

// ---------------------------------------------------------------------------
// Mock the useTickerChart hook
// ---------------------------------------------------------------------------
const mockUseTickerChart = vi.fn();
vi.mock('../../hooks/useTickerChart', () => ({
  useTickerChart: (...args: unknown[]) => mockUseTickerChart(...args),
}));

// ---------------------------------------------------------------------------
// Mock WebSocketContext (components now use useWebSocketContext)
// ---------------------------------------------------------------------------
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnMessage = vi.fn(() => vi.fn()); // returns unsubscribe fn

vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    onMessage: mockOnMessage,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setHookReturn(overrides: Partial<{
  bars: unknown[];
  loading: boolean;
  error: string | null;
}> = {}) {
  mockUseTickerChart.mockReturnValue({
    bars: [],
    loading: false,
    error: null,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setHookReturn();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Chart Component', () => {
  // ---- Heading / basic rendering (matches existing Terminal.test.tsx assertions) ----

  it('should render component name', () => {
    render(<Chart symbol="" />);
    expect(screen.getByRole('heading', { name: /Chart/i })).toBeInTheDocument();
  });

  it('should show "No ticker selected" when symbol is empty', () => {
    render(<Chart symbol="" />);
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();
  });

  it('should display symbol when provided', () => {
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<Chart symbol="AAPL" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      'bg-terminal-panel',
      'border',
      'border-terminal-border',
      'rounded',
    );
  });

  it('should update when symbol changes', () => {
    const { rerender } = render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();

    rerender(<Chart symbol="MSFT" />);
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
    expect(screen.queryByText(/AAPL/)).not.toBeInTheDocument();
  });

  it('should handle symbol change from empty to populated', () => {
    const { rerender } = render(<Chart symbol="" />);
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();

    rerender(<Chart symbol="GOOGL" />);
    expect(screen.getByText(/GOOGL/)).toBeInTheDocument();
    expect(screen.queryByText(/No ticker selected/i)).not.toBeInTheDocument();
  });

  // ---- Heading format matches Terminal.test.tsx regex patterns ----

  it('should match Terminal heading regex for empty symbol', () => {
    render(<Chart symbol="" />);
    expect(
      screen.getByRole('heading', { name: /Chart.*No ticker selected/i }),
    ).toBeInTheDocument();
  });

  it('should match Terminal heading regex for populated symbol', () => {
    render(<Chart symbol="TSLA" />);
    expect(
      screen.getByRole('heading', { name: /Chart.*TSLA/i }),
    ).toBeInTheDocument();
  });

  // ---- Timeframe selector ----

  it('should show timeframe buttons when symbol is set', () => {
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText('1D')).toBeInTheDocument();
    expect(screen.getByText('1W')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('5Y')).toBeInTheDocument();
  });

  it('should NOT show timeframe buttons when symbol is empty', () => {
    render(<Chart symbol="" />);
    expect(screen.queryByText('1D')).not.toBeInTheDocument();
  });

  it('should highlight the default timeframe (3M)', () => {
    render(<Chart symbol="AAPL" />);
    const btn3m = screen.getByText('3M');
    expect(btn3m).toHaveClass('bg-amber-500');
  });

  it('should change active timeframe on click', async () => {
    const user = userEvent.setup();
    render(<Chart symbol="AAPL" />);

    const btn1d = screen.getByText('1D');
    await user.click(btn1d);

    expect(btn1d).toHaveClass('bg-amber-500');
    expect(screen.getByText('3M')).not.toHaveClass('bg-amber-500');
  });

  it('should call useTickerChart with updated timeframe', async () => {
    const user = userEvent.setup();
    render(<Chart symbol="AAPL" />);

    // Default call
    expect(mockUseTickerChart).toHaveBeenCalledWith('AAPL', '3m');

    await user.click(screen.getByText('1Y'));
    expect(mockUseTickerChart).toHaveBeenCalledWith('AAPL', '1y');
  });

  // ---- Loading state ----

  it('should show loading indicator when loading', () => {
    setHookReturn({ loading: true });
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/Loading chart data/i)).toBeInTheDocument();
  });

  // ---- Error state ----

  it('should show error message on failure', () => {
    setHookReturn({ error: 'Failed to load chart data. Please try again.' });
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/Failed to load chart data/i)).toBeInTheDocument();
  });

  it('should not show error while loading', () => {
    setHookReturn({ loading: true, error: 'Some error' });
    render(<Chart symbol="AAPL" />);
    expect(screen.queryByText(/Some error/)).not.toBeInTheDocument();
  });

  // ---- Empty data state ----

  it('should show empty message when symbol set but no bars', () => {
    setHookReturn({ bars: [] });
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/No chart data available/i)).toBeInTheDocument();
  });

  it('should show prompt when no symbol is set', () => {
    render(<Chart symbol="" />);
    expect(
      screen.getByText(/Enter a ticker symbol to view chart/i),
    ).toBeInTheDocument();
  });

  // ---- Chart container ----

  it('should render a chart container div', () => {
    render(<Chart symbol="AAPL" />);
    expect(screen.getByTestId('chart-container')).toBeInTheDocument();
  });

  // ---- Hook integration ----

  it('should call useTickerChart with symbol and default timeframe', () => {
    render(<Chart symbol="AAPL" />);
    expect(mockUseTickerChart).toHaveBeenCalledWith('AAPL', '3m');
  });

  it('should call useTickerChart with empty string for no symbol', () => {
    render(<Chart symbol="" />);
    expect(mockUseTickerChart).toHaveBeenCalledWith('', '3m');
  });
});
