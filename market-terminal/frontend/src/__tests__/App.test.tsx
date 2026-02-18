import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../App';

// Mock WebSocketContext so the provider does not open a real WebSocket
vi.mock('../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: ReactNode }) => children,
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  }),
}));

// Mock react-resizable-panels to avoid complex layout testing
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

// Mock lightweight-charts to avoid canvas/matchMedia errors in jsdom
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

// Mock API client to prevent real HTTP requests in jsdom
vi.mock('../api/client', () => ({
  getTicker: vi.fn(() => Promise.resolve({})),
  getNews: vi.fn(() =>
    Promise.resolve({ symbol: '', articles: [], total_count: 0, limit: 20, offset: 0, data_source: 'mock', data_timestamp: new Date().toISOString() }),
  ),
  getFundamentals: vi.fn(() => Promise.resolve({})),
  getMacroCalendar: vi.fn(() => Promise.resolve({ events: [], date_range: { from: '2024-01-01', to: '2024-02-01' }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getMacroReaction: vi.fn(() => Promise.resolve({ symbol: '', event_type: '', reactions: [], averages: { avg_return_1d_on_beat: null, avg_return_1d_on_miss: null, avg_return_5d_on_beat: null, avg_return_5d_on_miss: null, avg_volume_ratio: null }, sample_size: 0, data_sources: [], data_timestamp: new Date().toISOString() })),
  analyzeSymbol: vi.fn(() => Promise.resolve({})),
  getAnalysis: vi.fn(() => Promise.resolve({ symbol: '', composite: { overall_direction: 'neutral', overall_confidence: 0, confluence_count: 0, timeframe_breakdown: {}, trade_thesis: '', weights_used: {}, timestamp: '' }, signals: [], metadata: { analysis_duration_ms: 0, methodologies_requested: 0, methodologies_completed: 0, methodologies_failed: 0, failed_methodologies: [], cached: false, data_sources_used: [] } })),
  getOwnership: vi.fn(() => Promise.resolve({ symbol: '', holders: [], filing_period: '', total_institutional_shares: 0, total_institutional_value: 0, institutional_ownership_percent: null, quarter_over_quarter: { new_positions: 0, increased_positions: 0, decreased_positions: 0, closed_positions: 0, net_shares_change: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getInsider: vi.fn(() => Promise.resolve({ symbol: '', transactions: [], insider_stats: { bullish_ratio: 0, bearish_ratio: 0, net_transactions: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  postQuery: vi.fn(() => Promise.resolve({})),
  getWatchlist: vi.fn(() => Promise.resolve([])),
  addToWatchlist: vi.fn(() => Promise.resolve({})),
  removeFromWatchlist: vi.fn(() => Promise.resolve()),
  getTickerHistory: vi.fn(() => Promise.resolve({ ohlcv: [] })),
}));

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    // If it renders without throwing, test passes
    expect(document.body).toBeTruthy();
  });

  it('should have dark class on root div', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toHaveClass('dark');
  });

  it('should render TickerProvider context', () => {
    // We test that context is available by verifying Terminal renders
    // (Terminal uses useTickerContext which would throw if provider is missing)
    render(<App />);

    // Look for Terminal layout elements
    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
  });

  it('should render Terminal component', () => {
    render(<App />);

    // Check for CommandBar (part of Terminal)
    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();

    // Check for panel headings
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('should initialize with empty ticker context', () => {
    render(<App />);

    // Chart should show "No ticker selected" initially
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();
  });
});
