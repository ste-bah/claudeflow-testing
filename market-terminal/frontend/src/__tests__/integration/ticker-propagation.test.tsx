import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import App from '../../App';

// Mock WebSocketContext so the provider does not open a real WebSocket
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
vi.mock('../../api/client', () => ({
  getTicker: vi.fn(() => Promise.resolve({})),
  getNews: vi.fn(() =>
    Promise.resolve({ symbol: '', articles: [], total_count: 0, limit: 20, offset: 0, data_source: 'mock', data_timestamp: new Date().toISOString() }),
  ),
  getFundamentals: vi.fn(() => Promise.resolve({})),
  getOwnership: vi.fn(() => Promise.resolve({ symbol: '', holders: [], filing_period: '', total_institutional_shares: 0, total_institutional_value: 0, institutional_ownership_percent: null, quarter_over_quarter: { new_positions: 0, increased_positions: 0, decreased_positions: 0, closed_positions: 0, net_shares_change: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getInsider: vi.fn(() => Promise.resolve({ symbol: '', transactions: [], insider_stats: { bullish_ratio: 0, bearish_ratio: 0, net_transactions: 0 }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getMacroCalendar: vi.fn(() => Promise.resolve({ events: [], date_range: { from: '2024-01-01', to: '2024-02-01' }, data_source: 'mock', data_timestamp: new Date().toISOString() })),
  getMacroReaction: vi.fn(() => Promise.resolve({ symbol: '', event_type: '', reactions: [], averages: { avg_return_1d_on_beat: null, avg_return_1d_on_miss: null, avg_return_5d_on_beat: null, avg_return_5d_on_miss: null, avg_volume_ratio: null }, sample_size: 0, data_sources: [], data_timestamp: new Date().toISOString() })),
  analyzeSymbol: vi.fn(() => Promise.resolve({})),
  getAnalysis: vi.fn(() => Promise.resolve({ symbol: '', composite: { overall_direction: 'neutral', overall_confidence: 0, confluence_count: 0, timeframe_breakdown: {}, trade_thesis: '', weights_used: {}, timestamp: '' }, signals: [], metadata: { analysis_duration_ms: 0, methodologies_requested: 0, methodologies_completed: 0, methodologies_failed: 0, failed_methodologies: [], cached: false, data_sources_used: [] } })),
  postQuery: vi.fn(() => Promise.resolve({})),
  getWatchlist: vi.fn(() =>
    Promise.resolve({ tickers: [], count: 0, max_allowed: 50, groups: ['default'] }),
  ),
  addToWatchlist: vi.fn(() => Promise.resolve({})),
  removeFromWatchlist: vi.fn(() => Promise.resolve()),
  getTickerHistory: vi.fn(() => Promise.resolve({ ohlcv: [] })),
  getScan: vi.fn(() => Promise.resolve({ query: {}, results: [], total_matches: 0, total_scanned: 0, scan_duration_ms: 0, note: '' })),
}));

describe('Ticker Propagation Integration', () => {
  describe('CommandBar -> All Panels (simultaneous propagation)', () => {
    it('should update Chart, NewsFeed, and Fundamentals simultaneously from one command', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'aapl{Enter}');

      // All three ticker-consuming panels must reflect the new ticker at once
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News.*AAPL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals.*AAPL/i })).toBeInTheDocument();
    });

    it('should not affect non-ticker panels when ticker changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'tsla{Enter}');

      // Watchlist and MacroCalendar should remain stable (ticker-independent)
      expect(screen.getByText('Watchlist')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Macro Calendar/i })).toBeInTheDocument();
    });
  });

  describe('Sequential ticker changes', () => {
    it('should replace previous ticker across all panels when a new ticker is entered', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      // First ticker
      await user.type(input, 'aapl{Enter}');
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News.*AAPL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals.*AAPL/i })).toBeInTheDocument();

      // Second ticker -- AAPL should be replaced with MSFT everywhere
      await user.type(input, 'msft{Enter}');
      expect(screen.getByRole('heading', { name: /Chart.*MSFT/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News.*MSFT/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals.*MSFT/i })).toBeInTheDocument();

      // AAPL should no longer appear in any heading
      expect(screen.queryByRole('heading', { name: /AAPL/i })).not.toBeInTheDocument();
    });

    it('should handle rapid sequential ticker changes correctly', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
      for (const ticker of tickers) {
        await user.type(input, `${ticker.toLowerCase()}{Enter}`);
      }

      // Only the last ticker should be displayed
      expect(screen.getByRole('heading', { name: /Chart.*NVDA/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News.*NVDA/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals.*NVDA/i })).toBeInTheDocument();

      // Previous tickers should not appear in headings
      for (const ticker of ['AAPL', 'MSFT', 'GOOGL', 'AMZN']) {
        expect(screen.queryByRole('heading', { name: new RegExp(`Chart.*${ticker}`, 'i') })).not.toBeInTheDocument();
      }
    });
  });

  describe('Empty and edge-case input', () => {
    it('should ignore empty Enter gracefully (ticker unchanged)', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      // First set a valid ticker
      await user.type(input, 'aapl{Enter}');
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();

      // Now press Enter with empty input -- execute() ignores empty strings,
      // so the ticker remains AAPL
      await user.type(input, '{Enter}');

      // Chart should still show AAPL (empty input is a no-op)
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
    });

    it('should uppercase mixed-case input across all panels', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'gOoGl{Enter}');

      expect(screen.getByRole('heading', { name: /Chart.*GOOGL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News.*GOOGL/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals.*GOOGL/i })).toBeInTheDocument();
    });
  });

  describe('Full App initialization flow', () => {
    it('should start with empty ticker context showing placeholder states everywhere', async () => {
      render(<App />);

      // Chart shows "No ticker selected"
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();

      // NewsFeed heading should NOT show the dash separator when no ticker
      const newsHeading = screen.getByRole('heading', { name: /News/i });
      expect(newsHeading).not.toHaveTextContent(/\u2014/);

      // Fundamentals heading should NOT show the dash separator when no ticker
      const fundsHeading = screen.getByRole('heading', { name: /Fundamentals/i });
      expect(fundsHeading).not.toHaveTextContent(/\u2014/);

      // Watchlist shows empty state (self-contained component loads asynchronously)
      await waitFor(() => {
        expect(screen.getByText('Watchlist is empty. Add a ticker above.')).toBeInTheDocument();
      });

      // MethodologyScores returns null when symbol is empty (no visible output)
      expect(screen.queryByText('No analysis data available')).not.toBeInTheDocument();

      // MacroCalendar has no events
      expect(screen.getByText('No upcoming economic events found')).toBeInTheDocument();

      // CommandBar is rendered and ready
      expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
    });

    it('should wrap Terminal in dark mode container', () => {
      const { container } = render(<App />);
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('dark');
    });

    it('should provide TickerContext so Terminal does not throw', () => {
      // If TickerProvider were missing, Terminal would throw.
      // This test verifies the full App renders without error.
      expect(() => render(<App />)).not.toThrow();
    });
  });

  describe('Cross-component state isolation', () => {
    it('should not leak ticker state between independent App renders', () => {
      // First render
      const { unmount } = render(<App />);
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();
      unmount();

      // Second render should start fresh
      render(<App />);
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();
    });
  });
});
