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
  analyzeSymbol: vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({}), 100))),
  getAnalysis: vi.fn(() => Promise.resolve({
    symbol: 'AAPL',
    composite: {
      overall_direction: 'bullish',
      overall_confidence: 0.75,
      confluence_count: 4,
      timeframe_breakdown: {},
      trade_thesis: 'Strong upward momentum across multiple methodologies.',
      weights_used: { wyckoff: 0.2, elliott_wave: 0.2 },
      timestamp: '2024-01-15T00:00:00Z',
    },
    signals: [
      { ticker: 'AAPL', methodology: 'wyckoff', direction: 'bullish', confidence: 0.8, timeframe: 'medium', reasoning: 'Accumulation phase detected', key_levels: { support: 180, resistance: 195 }, timestamp: '2024-01-15T00:00:00Z' },
      { ticker: 'AAPL', methodology: 'elliott_wave', direction: 'bullish', confidence: 0.7, timeframe: 'short', reasoning: 'Wave 3 in progress', key_levels: { target: 200 }, timestamp: '2024-01-15T00:00:00Z' },
    ],
    metadata: { analysis_duration_ms: 1250, methodologies_requested: 6, methodologies_completed: 6, methodologies_failed: 0, failed_methodologies: [], cached: false, data_sources_used: ['polygon', 'alpha_vantage'] },
  })),
  postQuery: vi.fn(() => Promise.resolve({})),
  getWatchlist: vi.fn(() => Promise.resolve({ tickers: [], count: 0, max_allowed: 50, groups: ['default'] })),
  addToWatchlist: vi.fn(() => Promise.resolve({})),
  removeFromWatchlist: vi.fn(() => Promise.resolve()),
  getTickerHistory: vi.fn(() => Promise.resolve({ ohlcv: [] })),
  getScan: vi.fn(() => Promise.resolve({ query: {}, results: [], total_matches: 0, total_scanned: 0, scan_duration_ms: 0, note: '' })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Analysis Flow Integration', () => {
  it('should show loading state in command bar when "analyze aapl" is submitted', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'analyze aapl{Enter}');

    // The command bar shows "Processing..." while the analyze request is in flight
    expect(screen.getByText('Processing...')).toBeInTheDocument();

    // Wait for the async analyzeSymbol call to resolve
    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    });
  });

  it('should display methodology scores after analysis for a ticker', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Enter a ticker so the MethodologyScores panel fetches analysis data
    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'aapl{Enter}');

    // The MethodologyScores panel should render analysis signals.
    // getAnalysis mock returns bullish Wyckoff and Elliott Wave signals.
    await waitFor(() => {
      expect(screen.getByText('Wyckoff')).toBeInTheDocument();
    });
    expect(screen.getByText('Elliott Wave')).toBeInTheDocument();

    // Composite header + signal cards should all show the bullish direction label
    const bullishElements = screen.getAllByText('Bullish');
    expect(bullishElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should set the active ticker when "analyze aapl" is run', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'analyze aapl{Enter}');

    // The analyze command sets the active ticker, updating dependent panels
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /News.*AAPL/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fundamentals.*AAPL/i })).toBeInTheDocument();
  });
});
