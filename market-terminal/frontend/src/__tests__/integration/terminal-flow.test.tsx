import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import App from '../../App';

// ---------------------------------------------------------------------------
// Mocks (ADR-005: self-contained per test file)
// ---------------------------------------------------------------------------

vi.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: ReactNode }) => children,
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    addHistogramSeries: vi.fn(() => ({ setData: vi.fn() })),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  })),
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
}));

vi.mock('../../api/client', () => ({
  getTicker: vi.fn(() => Promise.resolve({})),
  getNews: vi.fn(() => Promise.resolve({ symbol: '', articles: [], total_count: 0, limit: 20, offset: 0, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getFundamentals: vi.fn(() => Promise.resolve({})),
  getOwnership: vi.fn(() => Promise.resolve({ symbol: '', holders: [], filing_period: '', total_institutional_shares: 0, total_institutional_value: 0, institutional_ownership_percent: null, quarter_over_quarter: { new_positions: 0, increased_positions: 0, decreased_positions: 0, closed_positions: 0, net_shares_change: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getInsider: vi.fn(() => Promise.resolve({ symbol: '', transactions: [], insider_stats: { bullish_ratio: 0, bearish_ratio: 0, net_transactions: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getMacroCalendar: vi.fn(() => Promise.resolve({ events: [], date_range: { from: '2024-01-01', to: '2024-02-01' }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getMacroReaction: vi.fn(() => Promise.resolve({ symbol: '', event_type: '', reactions: [], averages: { avg_return_1d_on_beat: null, avg_return_1d_on_miss: null, avg_return_5d_on_beat: null, avg_return_5d_on_miss: null, avg_volume_ratio: null }, sample_size: 0, data_sources: [], data_timestamp: new Date().toISOString() })),
  analyzeSymbol: vi.fn(() => Promise.resolve({})),
  getAnalysis: vi.fn(() => Promise.resolve({ symbol: '', composite: { overall_direction: 'neutral', overall_confidence: 0, confluence_count: 0, timeframe_breakdown: {}, trade_thesis: '', weights_used: {}, timestamp: '' }, signals: [], metadata: { analysis_duration_ms: 0, methodologies_requested: 0, methodologies_completed: 0, methodologies_failed: 0, failed_methodologies: [], cached: false, data_sources_used: [] } })),
  postQuery: vi.fn(() => Promise.resolve({})),
  getWatchlist: vi.fn(() => Promise.resolve({
    tickers: [
      { symbol: 'AAPL', group: 'default', added_at: '2024-01-01T00:00:00Z', position: 0, last_price: 185.50, price_change_percent: 1.2, last_composite_signal: null, last_composite_confidence: null, last_updated: null },
      { symbol: 'TSLA', group: 'default', added_at: '2024-01-02T00:00:00Z', position: 1, last_price: 240.00, price_change_percent: -0.5, last_composite_signal: null, last_composite_confidence: null, last_updated: null },
    ],
    count: 2,
    max_allowed: 50,
    groups: ['default'],
  })),
  addToWatchlist: vi.fn(() => Promise.resolve({})),
  removeFromWatchlist: vi.fn(() => Promise.resolve()),
  getTickerHistory: vi.fn(() => Promise.resolve({ ohlcv: [] })),
  getScan: vi.fn(() => Promise.resolve({ query: {}, results: [], total_matches: 0, total_scanned: 0, scan_duration_ms: 0, note: '' })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Terminal Flow Integration', () => {
  it('should update Chart, News, and Fundamentals when a watchlist entry is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for the watchlist to load and render AAPL entry
    const aaplEntry = await screen.findByText('AAPL');
    expect(aaplEntry).toBeInTheDocument();

    // Click on the AAPL entry in the watchlist to select it
    await user.click(aaplEntry);

    // All ticker-consuming panels should reflect the selected ticker
    expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /News.*AAPL/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fundamentals.*AAPL/i })).toBeInTheDocument();
  });

  it('should update all dependent panels when ticker is entered via command bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'msft{Enter}');

    expect(screen.getByRole('heading', { name: /Chart.*MSFT/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /News.*MSFT/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fundamentals.*MSFT/i })).toBeInTheDocument();
  });

  it('should render correctly with WebSocket connected status', () => {
    render(<App />);

    // The WebSocket status indicator should show "Connected"
    const wsStatus = screen.getByTestId('ws-status');
    expect(wsStatus).toHaveTextContent('Connected');

    // App should not crash -- command bar is present
    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
  });
});
