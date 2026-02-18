import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Watchlist from '../../components/Watchlist';
import type { WatchlistEntry } from '../../types/watchlist';

// ---- Mocks ----

const mockAddEntry = vi.fn();
const mockRemoveEntry = vi.fn();
const mockRefresh = vi.fn();
const mockSetActiveTicker = vi.fn();

let mockHookReturn: {
  entries: WatchlistEntry[];
  count: number;
  maxAllowed: number;
  loading: boolean;
  error: string | null;
  adding: boolean;
  addEntry: typeof mockAddEntry;
  removeEntry: typeof mockRemoveEntry;
  refresh: typeof mockRefresh;
};

let mockActiveTicker = '';

vi.mock('../../hooks/useWatchlist', () => ({
  useWatchlist: () => mockHookReturn,
}));

vi.mock('../../contexts/TickerContext', () => ({
  useTickerContext: () => ({
    activeTicker: mockActiveTicker,
    setActiveTicker: mockSetActiveTicker,
  }),
}));

// Mock WebSocketContext (Watchlist now uses useWebSocketContext for live prices)
const mockWsSubscribe = vi.fn();
const mockWsUnsubscribe = vi.fn();
const mockWsOnMessage = vi.fn(() => vi.fn()); // returns unsubscribe fn

vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: mockWsSubscribe,
    unsubscribe: mockWsUnsubscribe,
    onMessage: mockWsOnMessage,
  }),
}));

// ---- Helpers ----

function makeEntry(overrides: Partial<WatchlistEntry> & { symbol: string }): WatchlistEntry {
  return {
    group: 'default',
    added_at: '2024-02-15T10:00:00Z',
    position: 0,
    last_price: null,
    price_change_percent: null,
    last_composite_signal: null,
    last_composite_confidence: null,
    last_updated: null,
    ...overrides,
  };
}

function setHookReturn(overrides: Partial<typeof mockHookReturn> = {}) {
  mockHookReturn = {
    entries: [],
    count: 0,
    maxAllowed: 50,
    loading: false,
    error: null,
    adding: false,
    addEntry: mockAddEntry,
    removeEntry: mockRemoveEntry,
    refresh: mockRefresh,
    ...overrides,
  };
}

// ---- Tests ----

describe('Watchlist Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTicker = '';
    setHookReturn();
  });

  // ----------------------------------------------------------------
  // Basic rendering
  // ----------------------------------------------------------------

  it('should render component heading', () => {
    render(<Watchlist />);
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('should have proper styling classes on wrapper', () => {
    const { container } = render(<Watchlist />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  // ----------------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------------

  it('should show loading state', () => {
    setHookReturn({ loading: true });
    render(<Watchlist />);
    expect(screen.getByText('Loading watchlist...')).toBeInTheDocument();
  });

  it('should not show empty state while loading', () => {
    setHookReturn({ loading: true });
    render(<Watchlist />);
    expect(screen.queryByText('Watchlist is empty. Add a ticker above.')).not.toBeInTheDocument();
  });

  it('should not show entries while loading', () => {
    setHookReturn({
      loading: true,
      entries: [makeEntry({ symbol: 'AAPL', last_price: 100 })],
      count: 1,
    });
    render(<Watchlist />);
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Error state
  // ----------------------------------------------------------------

  it('should display error message', () => {
    setHookReturn({ error: 'Failed to load watchlist. Please try again.' });
    render(<Watchlist />);
    expect(screen.getByText('Failed to load watchlist. Please try again.')).toBeInTheDocument();
  });

  it('should display error from addEntry failure', () => {
    setHookReturn({ error: 'Failed to add ticker. Please try again.' });
    render(<Watchlist />);
    expect(screen.getByText('Failed to add ticker. Please try again.')).toBeInTheDocument();
  });

  it('should display duplicate ticker error', () => {
    setHookReturn({ error: 'Ticker already exists in watchlist.' });
    render(<Watchlist />);
    expect(screen.getByText('Ticker already exists in watchlist.')).toBeInTheDocument();
  });

  it('should not display error when error is null', () => {
    setHookReturn({ error: null });
    render(<Watchlist />);
    // No red-400 error paragraph should be present
    // No red-400 error paragraph should be present.
    // The error p tag specifically has text-red-400 class.
    expect(screen.queryByText('Failed to load watchlist. Please try again.')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Empty state
  // ----------------------------------------------------------------

  it('should show empty state when entries list is empty', () => {
    render(<Watchlist />);
    expect(screen.getByText('Watchlist is empty. Add a ticker above.')).toBeInTheDocument();
  });

  it('should not show empty state when there are entries', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });
    render(<Watchlist />);
    expect(screen.queryByText('Watchlist is empty. Add a ticker above.')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Entry rendering - price formatting
  // ----------------------------------------------------------------

  it('should render entries with symbols', () => {
    setHookReturn({
      entries: [
        makeEntry({ symbol: 'AAPL', last_price: 185.50, price_change_percent: 1.25 }),
        makeEntry({ symbol: 'MSFT', last_price: 410.20, price_change_percent: -0.75 }),
      ],
      count: 2,
    });

    render(<Watchlist />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('should display formatted price with 2 decimal places', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: 185.50 })],
      count: 1,
    });

    render(<Watchlist />);
    expect(screen.getByText('185.50')).toBeInTheDocument();
  });

  it('should display em-dash for null price', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: null, price_change_percent: null })],
      count: 1,
    });

    render(<Watchlist />);
    // Both null price and null change render em-dash
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  // ----------------------------------------------------------------
  // Entry rendering - change percent formatting
  // ----------------------------------------------------------------

  it('should display positive percent in green with + prefix', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: 185.50, price_change_percent: 1.25 })],
      count: 1,
    });

    render(<Watchlist />);
    const pctEl = screen.getByText('+1.25%');
    expect(pctEl).toBeInTheDocument();
    expect(pctEl).toHaveClass('text-green-400');
  });

  it('should display negative percent in red', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: 185.50, price_change_percent: -2.10 })],
      count: 1,
    });

    render(<Watchlist />);
    const pctEl = screen.getByText('-2.10%');
    expect(pctEl).toBeInTheDocument();
    expect(pctEl).toHaveClass('text-red-400');
  });

  it('should display zero percent as gray 0.00%', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: 100, price_change_percent: 0 })],
      count: 1,
    });

    render(<Watchlist />);
    const pctEl = screen.getByText('0.00%');
    expect(pctEl).toHaveClass('text-text-secondary');
  });

  it('should display em-dash for null percent with secondary color', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_price: 100, price_change_percent: null })],
      count: 1,
    });

    render(<Watchlist />);
    // price shows "100.00", change shows em-dash
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
    // The em-dash element should have secondary text color
    expect(dashes[0]).toHaveClass('text-text-secondary');
  });

  // ----------------------------------------------------------------
  // Signal badge rendering
  // ----------------------------------------------------------------

  it('should show bullish signal in green', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: 'bullish' })],
      count: 1,
    });

    render(<Watchlist />);
    const signal = screen.getByText('bullish');
    expect(signal).toHaveClass('text-green-400');
  });

  it('should show strong_bullish signal in green', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: 'strong_bullish' })],
      count: 1,
    });

    render(<Watchlist />);
    const signal = screen.getByText('strong_bullish');
    expect(signal).toHaveClass('text-green-400');
  });

  it('should show bearish signal in red', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: 'bearish' })],
      count: 1,
    });

    render(<Watchlist />);
    const signal = screen.getByText('bearish');
    expect(signal).toHaveClass('text-red-400');
  });

  it('should show strong_bearish signal in red', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: 'strong_bearish' })],
      count: 1,
    });

    render(<Watchlist />);
    const signal = screen.getByText('strong_bearish');
    expect(signal).toHaveClass('text-red-400');
  });

  it('should show neutral signal in secondary text color', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: 'neutral' })],
      count: 1,
    });

    render(<Watchlist />);
    const signal = screen.getByText('neutral');
    expect(signal).toHaveClass('text-text-secondary');
  });

  it('should not render signal span when signal is null', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL', last_composite_signal: null })],
      count: 1,
    });

    render(<Watchlist />);
    expect(screen.queryByText('bullish')).not.toBeInTheDocument();
    expect(screen.queryByText('bearish')).not.toBeInTheDocument();
    expect(screen.queryByText('neutral')).not.toBeInTheDocument();
    expect(screen.queryByText('strong_bullish')).not.toBeInTheDocument();
    expect(screen.queryByText('strong_bearish')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Confidence display
  // ----------------------------------------------------------------

  it('should display confidence percentage next to signal', () => {
    setHookReturn({
      entries: [
        makeEntry({
          symbol: 'AAPL',
          last_composite_signal: 'bullish',
          last_composite_confidence: 0.85,
        }),
      ],
      count: 1,
    });

    render(<Watchlist />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should not display confidence when confidence is null', () => {
    setHookReturn({
      entries: [
        makeEntry({
          symbol: 'AAPL',
          last_composite_signal: 'bullish',
          last_composite_confidence: null,
        }),
      ],
      count: 1,
    });

    render(<Watchlist />);
    // Signal should be present, but no confidence percentage
    expect(screen.getByText('bullish')).toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('should display confidence as rounded integer', () => {
    setHookReturn({
      entries: [
        makeEntry({
          symbol: 'AAPL',
          last_composite_signal: 'bearish',
          last_composite_confidence: 0.667,
        }),
      ],
      count: 1,
    });

    render(<Watchlist />);
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Count display
  // ----------------------------------------------------------------

  it('should display count / maxAllowed', () => {
    setHookReturn({ count: 3, maxAllowed: 50 });

    render(<Watchlist />);
    expect(screen.getByText('3 / 50')).toBeInTheDocument();
  });

  it('should display zero count when empty', () => {
    render(<Watchlist />);
    expect(screen.getByText('0 / 50')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Row selection - click
  // ----------------------------------------------------------------

  it('should call setActiveTicker when row is clicked', async () => {
    const user = userEvent.setup();
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const aaplText = screen.getByText('AAPL');
    const aaplRow = aaplText.closest('li')!;
    await user.click(aaplRow);

    expect(mockSetActiveTicker).toHaveBeenCalledWith('AAPL');
  });

  it('should highlight selected row with amber border when activeTicker matches', () => {
    mockActiveTicker = 'AAPL';
    setHookReturn({
      entries: [
        makeEntry({ symbol: 'AAPL' }),
        makeEntry({ symbol: 'MSFT' }),
      ],
      count: 2,
    });

    render(<Watchlist />);

    const aaplText = screen.getByText('AAPL');
    const aaplRow = aaplText.closest('li');
    expect(aaplRow).not.toBeNull();
    expect(aaplRow!.className).toContain('border-amber-500');

    const msftText = screen.getByText('MSFT');
    const msftRow = msftText.closest('li');
    expect(msftRow).not.toBeNull();
    expect(msftRow!.className).not.toContain('border-amber-500');
  });

  it('should not highlight any row when activeTicker does not match', () => {
    mockActiveTicker = 'GOOG';
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' }), makeEntry({ symbol: 'MSFT' })],
      count: 2,
    });

    render(<Watchlist />);

    const aaplRow = screen.getByText('AAPL').closest('li')!;
    const msftRow = screen.getByText('MSFT').closest('li')!;
    expect(aaplRow.className).not.toContain('border-amber-500');
    expect(msftRow.className).not.toContain('border-amber-500');
  });

  // ----------------------------------------------------------------
  // Row selection - keyboard
  // ----------------------------------------------------------------

  it('should support keyboard Enter on rows', async () => {
    const user = userEvent.setup();
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const aaplRow = screen.getByText('AAPL').closest('li')!;
    aaplRow.focus();
    await user.keyboard('{Enter}');

    expect(mockSetActiveTicker).toHaveBeenCalledWith('AAPL');
  });

  it('should support keyboard Space on rows', async () => {
    const user = userEvent.setup();
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const aaplRow = screen.getByText('AAPL').closest('li')!;
    aaplRow.focus();
    await user.keyboard(' ');

    expect(mockSetActiveTicker).toHaveBeenCalledWith('AAPL');
  });

  it('should have role="button" and tabIndex=0 on rows', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const aaplRow = screen.getByText('AAPL').closest('li')!;
    expect(aaplRow.getAttribute('role')).toBe('button');
    expect(aaplRow.getAttribute('tabindex')).toBe('0');
  });

  // ----------------------------------------------------------------
  // Add form - input
  // ----------------------------------------------------------------

  it('should auto-uppercase input', async () => {
    const user = userEvent.setup();
    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, 'aapl');

    expect(input).toHaveValue('AAPL');
  });

  it('should have maxLength=5 on input', () => {
    render(<Watchlist />);
    const input = screen.getByPlaceholderText('AAPL');
    expect(input).toHaveAttribute('maxlength', '5');
  });

  // ----------------------------------------------------------------
  // Add form - button disabled states
  // ----------------------------------------------------------------

  it('should disable add button when input is empty', () => {
    render(<Watchlist />);

    const addBtn = screen.getByRole('button', { name: '+' });
    expect(addBtn).toBeDisabled();
  });

  it('should disable add button when input has invalid symbol (numbers)', async () => {
    const user = userEvent.setup();
    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, '123');

    const addBtn = screen.getByRole('button', { name: '+' });
    expect(addBtn).toBeDisabled();
  });

  it('should disable add button when adding is true', () => {
    setHookReturn({ adding: true });

    render(<Watchlist />);

    const addBtn = screen.getByRole('button', { name: '+' });
    expect(addBtn).toBeDisabled();
  });

  it('should disable input when adding is true', () => {
    setHookReturn({ adding: true });

    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    expect(input).toBeDisabled();
  });

  it('should enable add button when input has valid symbol', async () => {
    const user = userEvent.setup();
    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, 'TSLA');

    const addBtn = screen.getByRole('button', { name: '+' });
    expect(addBtn).not.toBeDisabled();
  });

  // ----------------------------------------------------------------
  // Add form - submission
  // ----------------------------------------------------------------

  it('should call addEntry on valid submit and clear input', async () => {
    const user = userEvent.setup();
    mockAddEntry.mockResolvedValue(undefined);

    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, 'TSLA');
    await user.click(screen.getByRole('button', { name: '+' }));

    expect(mockAddEntry).toHaveBeenCalledWith('TSLA');
    expect(input).toHaveValue('');
  });

  it('should submit uppercase symbol even when typed in lowercase', async () => {
    const user = userEvent.setup();
    mockAddEntry.mockResolvedValue(undefined);

    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, 'msft');
    await user.click(screen.getByRole('button', { name: '+' }));

    expect(mockAddEntry).toHaveBeenCalledWith('MSFT');
  });

  it('should not call addEntry on invalid symbol submission', async () => {
    const user = userEvent.setup();
    render(<Watchlist />);

    const input = screen.getByPlaceholderText('AAPL');
    await user.type(input, '12');

    // Button is disabled, but test form submission path too
    const addBtn = screen.getByRole('button', { name: '+' });
    expect(addBtn).toBeDisabled();
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Remove button
  // ----------------------------------------------------------------

  it('should call removeEntry when remove button is clicked', async () => {
    const user = userEvent.setup();
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const removeBtn = screen.getByLabelText('Remove ticker');
    await user.click(removeBtn);

    expect(mockRemoveEntry).toHaveBeenCalledWith('AAPL');
  });

  it('should not propagate click to row when remove button is clicked', async () => {
    const user = userEvent.setup();
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const removeBtn = screen.getByLabelText('Remove ticker');
    await user.click(removeBtn);

    // setActiveTicker should NOT be called because of stopPropagation
    expect(mockSetActiveTicker).not.toHaveBeenCalled();
  });

  it('should have aria-label on remove button', () => {
    setHookReturn({
      entries: [makeEntry({ symbol: 'AAPL' })],
      count: 1,
    });

    render(<Watchlist />);

    const removeBtn = screen.getByLabelText('Remove ticker');
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn.tagName).toBe('BUTTON');
  });

  it('should render remove button for each entry', () => {
    setHookReturn({
      entries: [
        makeEntry({ symbol: 'AAPL' }),
        makeEntry({ symbol: 'MSFT' }),
        makeEntry({ symbol: 'GOOG' }),
      ],
      count: 3,
    });

    render(<Watchlist />);

    const removeButtons = screen.getAllByLabelText('Remove ticker');
    expect(removeButtons).toHaveLength(3);
  });

  // ----------------------------------------------------------------
  // Multiple entries
  // ----------------------------------------------------------------

  it('should render multiple entries correctly', () => {
    setHookReturn({
      entries: [
        makeEntry({ symbol: 'AAPL', last_price: 185.50, price_change_percent: 1.25, last_composite_signal: 'bullish', last_composite_confidence: 0.80 }),
        makeEntry({ symbol: 'MSFT', last_price: 410.20, price_change_percent: -0.75, last_composite_signal: 'bearish', last_composite_confidence: 0.60 }),
        makeEntry({ symbol: 'GOOG', last_price: null, price_change_percent: null, last_composite_signal: null, last_composite_confidence: null }),
      ],
      count: 3,
    });

    render(<Watchlist />);

    // All symbols present
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('GOOG')).toBeInTheDocument();

    // Prices
    expect(screen.getByText('185.50')).toBeInTheDocument();
    expect(screen.getByText('410.20')).toBeInTheDocument();

    // Changes
    expect(screen.getByText('+1.25%')).toBeInTheDocument();
    expect(screen.getByText('-0.75%')).toBeInTheDocument();

    // Signals
    expect(screen.getByText('bullish')).toBeInTheDocument();
    expect(screen.getByText('bearish')).toBeInTheDocument();

    // Confidences
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should render entries in order', () => {
    setHookReturn({
      entries: [
        makeEntry({ symbol: 'AAPL', position: 0 }),
        makeEntry({ symbol: 'MSFT', position: 1 }),
        makeEntry({ symbol: 'GOOG', position: 2 }),
      ],
      count: 3,
    });

    render(<Watchlist />);

    // Verify order through DOM ordering of list items
    const listItems = document.querySelectorAll('li[role="button"]');
    expect(listItems).toHaveLength(3);
    expect(listItems[0].textContent).toContain('AAPL');
    expect(listItems[1].textContent).toContain('MSFT');
    expect(listItems[2].textContent).toContain('GOOG');
  });

  // ----------------------------------------------------------------
  // Error messages are static strings (XSS verification)
  // ----------------------------------------------------------------

  it('should display static error strings (XSS safe)', () => {
    const staticErrors = [
      'Failed to load watchlist. Please try again.',
      'Failed to add ticker. Please try again.',
      'Ticker already exists in watchlist.',
      'Watchlist is full. Remove a ticker first.',
      'Ticker not found in watchlist.',
      'Failed to remove ticker. Please try again.',
      'Invalid ticker symbol format.',
    ];

    for (const errorMsg of staticErrors) {
      setHookReturn({ error: errorMsg });
      const { unmount } = render(<Watchlist />);
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
      unmount();
    }
  });
});
