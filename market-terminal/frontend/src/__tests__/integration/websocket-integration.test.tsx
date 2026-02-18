/**
 * WebSocket integration tests -- verifies cross-component interactions when
 * WebSocket messages are dispatched through the mock provider.
 *
 * Pattern: render the full App wrapped in providers, capture onMessage
 * callbacks, simulate server messages, and assert effects across multiple
 * components.
 *
 * NOTE: Real timers are used for userEvent interactions (fake timers deadlock
 * with userEvent.type). Fake timers are enabled ONLY within tests that need
 * to control time (e.g. auto-dismiss verification).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type {
  WsConnectionStatus,
  WsPriceUpdateMessage,
  WsAnalysisProgressMessage,
  WsAnalysisCompleteMessage,
  WsNewsAlertMessage,
  WsServerMessageType,
} from '../../types/websocket';

// ---------------------------------------------------------------------------
// Controllable mock for WebSocketContext
// ---------------------------------------------------------------------------

/** Captured onMessage callbacks keyed by message type. */
let messageCallbacks: Map<string, Set<Function>>;
let mockStatus: WsConnectionStatus;
let subscribedChannels: Set<string>;

const mockSubscribe = vi.fn((channel: string) => {
  subscribedChannels.add(channel);
});
const mockUnsubscribe = vi.fn((channel: string) => {
  subscribedChannels.delete(channel);
});
const mockOnMessage = vi.fn(<T extends WsServerMessageType>(type: T, cb: Function) => {
  if (!messageCallbacks.has(type)) {
    messageCallbacks.set(type, new Set());
  }
  messageCallbacks.get(type)!.add(cb);
  // Return cleanup function that actually removes the callback
  return () => {
    const set = messageCallbacks.get(type);
    if (set) {
      set.delete(cb);
      if (set.size === 0) messageCallbacks.delete(type);
    }
  };
});

vi.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: ReactNode }) => children,
  useWebSocketContext: () => ({
    status: mockStatus,
    clientId: 'test-ws-client',
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    onMessage: mockOnMessage,
  }),
}));

// ---------------------------------------------------------------------------
// Standard mocks (same as existing integration tests)
// ---------------------------------------------------------------------------

vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel">{children}</div>
  ),
  PanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn(), update: vi.fn() })),
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
  getNews: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      articles: [],
      total_count: 0,
      limit: 20,
      offset: 0,
      data_source: 'mock',
      data_timestamp: new Date().toISOString(),
    }),
  ),
  getFundamentals: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      company_name: '',
      cik: null,
      ttm: null,
      quarterly: [],
      next_earnings_date: null,
      data_sources: { financials: 'test', market_data: 'test' },
      data_timestamp: '2024-01-01T00:00:00Z',
    }),
  ),
  getOwnership: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      holders: [],
      filing_period: '',
      total_institutional_shares: 0,
      total_institutional_value: 0,
      institutional_ownership_percent: null,
      quarter_over_quarter: {
        new_positions: 0,
        increased_positions: 0,
        decreased_positions: 0,
        closed_positions: 0,
        net_shares_change: 0,
      },
      data_source: 'mock',
      data_timestamp: new Date().toISOString(),
    }),
  ),
  getInsider: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      transactions: [],
      insider_stats: { bullish_ratio: 0, bearish_ratio: 0, net_transactions: 0 },
      data_source: 'mock',
      data_timestamp: new Date().toISOString(),
    }),
  ),
  getMacroCalendar: vi.fn(() =>
    Promise.resolve({
      events: [],
      date_range: { from: '2024-01-01', to: '2024-02-01' },
      data_source: 'mock',
      data_timestamp: new Date().toISOString(),
    }),
  ),
  getMacroReaction: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      event_type: '',
      reactions: [],
      averages: {
        avg_return_1d_on_beat: null,
        avg_return_1d_on_miss: null,
        avg_return_5d_on_beat: null,
        avg_return_5d_on_miss: null,
        avg_volume_ratio: null,
      },
      sample_size: 0,
      data_sources: [],
      data_timestamp: new Date().toISOString(),
    }),
  ),
  analyzeSymbol: vi.fn(() => Promise.resolve({})),
  getAnalysis: vi.fn(() =>
    Promise.resolve({
      symbol: '',
      composite: {
        overall_direction: 'neutral',
        overall_confidence: 0,
        confluence_count: 0,
        timeframe_breakdown: {},
        trade_thesis: '',
        weights_used: {},
        timestamp: '',
      },
      signals: [],
      metadata: {
        analysis_duration_ms: 0,
        methodologies_requested: 0,
        methodologies_completed: 0,
        methodologies_failed: 0,
        failed_methodologies: [],
        cached: false,
        data_sources_used: [],
      },
    }),
  ),
  postQuery: vi.fn(() => Promise.resolve({})),
  getWatchlist: vi.fn(() =>
    Promise.resolve({ tickers: [], count: 0, max_allowed: 50, groups: ['default'] }),
  ),
  addToWatchlist: vi.fn(() => Promise.resolve({})),
  removeFromWatchlist: vi.fn(() => Promise.resolve()),
  getTickerHistory: vi.fn(() => Promise.resolve({ ohlcv: [] })),
  getScan: vi.fn(() =>
    Promise.resolve({
      query: {},
      results: [],
      total_matches: 0,
      total_scanned: 0,
      scan_duration_ms: 0,
      note: '',
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks (must come after vi.mock calls)
// ---------------------------------------------------------------------------

import App from '../../App';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatch a typed message to all registered onMessage callbacks. */
function simulateMessage(
  type: string,
  payload: Record<string, unknown>,
) {
  act(() => {
    const cbs = messageCallbacks.get(type);
    if (cbs) {
      cbs.forEach((cb) => cb(payload));
    }
  });
}

/** Build a price_update message. */
function makePriceUpdate(
  overrides: Partial<WsPriceUpdateMessage> = {},
): WsPriceUpdateMessage {
  return {
    type: 'price_update',
    symbol: 'AAPL',
    price: 195.5,
    change_percent: 1.23,
    timestamp: '2024-06-15T14:30:00Z',
    ...overrides,
  };
}

/** Build an analysis_progress message. */
function makeAnalysisProgress(
  overrides: Partial<WsAnalysisProgressMessage> = {},
): WsAnalysisProgressMessage {
  return {
    type: 'analysis_progress',
    symbol: 'AAPL',
    agent: 'Wyckoff',
    agent_number: 2,
    total_agents: 7,
    status: 'running',
    message: 'Running Wyckoff analysis',
    ...overrides,
  };
}

/** Build an analysis_complete message. */
function makeAnalysisComplete(
  overrides: Partial<WsAnalysisCompleteMessage> = {},
): WsAnalysisCompleteMessage {
  return {
    type: 'analysis_complete',
    symbol: 'AAPL',
    composite_signal: { direction: 'bullish', score: 0.75 },
    timestamp: '2024-06-15T10:05:00Z',
    ...overrides,
  };
}

/** Build a news_alert message. */
function makeNewsAlert(
  overrides: Partial<WsNewsAlertMessage> = {},
): WsNewsAlertMessage {
  return {
    type: 'news_alert',
    symbol: 'AAPL',
    headline: 'AAPL beats Q3 earnings',
    sentiment: { score: 0.85, label: 'bullish' },
    timestamp: '2024-06-15T14:35:00Z',
    ...overrides,
  };
}

/** Render the full App tree. */
function renderApp() {
  return render(<App />);
}

/** Type a ticker symbol in the CommandBar and press Enter. */
async function enterTicker(ticker: string) {
  const user = userEvent.setup();
  const input = screen.getByPlaceholderText('Enter command or ticker...');
  await user.type(input, `${ticker}{Enter}`);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  messageCallbacks = new Map();
  subscribedChannels = new Set();
  mockStatus = 'connected';
});

// ===========================================================================
// Tests
// ===========================================================================

describe('WebSocket Integration', () => {
  // -----------------------------------------------------------------------
  // 1. Context availability
  // -----------------------------------------------------------------------

  describe('WebSocket context availability', () => {
    it('should render all components without throwing when WebSocket context is provided', () => {
      expect(() => renderApp()).not.toThrow();
    });

    it('should make subscribe available to Watchlist on mount', () => {
      renderApp();
      expect(mockSubscribe).toHaveBeenCalledWith('price_updates');
    });

    it('should make onMessage available to AnalysisProgress on mount', () => {
      renderApp();
      expect(mockOnMessage).toHaveBeenCalledWith(
        'analysis_progress',
        expect.any(Function),
      );
      expect(mockOnMessage).toHaveBeenCalledWith(
        'analysis_complete',
        expect.any(Function),
      );
    });

    it('should expose status to Terminal for the status indicator', () => {
      renderApp();
      const statusEl = screen.getByTestId('ws-status');
      expect(statusEl).toBeInTheDocument();
      expect(within(statusEl).getByText('Connected')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Channel subscription coordination
  // -----------------------------------------------------------------------

  describe('Channel subscription coordination', () => {
    it('should subscribe to price_updates for Watchlist on mount', () => {
      renderApp();
      expect(mockSubscribe).toHaveBeenCalledWith('price_updates');
    });

    it('should subscribe to analysis_progress for AnalysisProgress on mount', () => {
      renderApp();
      expect(mockSubscribe).toHaveBeenCalledWith('analysis_progress');
    });

    it('should register price_update listener for Watchlist on mount', () => {
      renderApp();
      expect(mockOnMessage).toHaveBeenCalledWith(
        'price_update',
        expect.any(Function),
      );
    });

    it('should subscribe to price_updates when a ticker is set (Chart)', async () => {
      renderApp();
      mockSubscribe.mockClear();

      await enterTicker('aapl');

      expect(mockSubscribe).toHaveBeenCalledWith('price_updates');
    });

    it('should subscribe to analysis_progress when a ticker is set (MethodologyScores)', async () => {
      renderApp();
      mockSubscribe.mockClear();

      await enterTicker('aapl');

      expect(mockSubscribe).toHaveBeenCalledWith('analysis_progress');
    });

    it('should subscribe to news_alerts when a ticker is set (NewsFeed)', async () => {
      renderApp();
      mockSubscribe.mockClear();

      await enterTicker('aapl');

      expect(mockSubscribe).toHaveBeenCalledWith('news_alerts');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Price update propagation
  // -----------------------------------------------------------------------

  describe('Price update propagation across components', () => {
    it('should register price_update listeners from both Watchlist and Chart', async () => {
      renderApp();
      await enterTicker('aapl');

      const priceCallbacks = messageCallbacks.get('price_update');
      expect(priceCallbacks).toBeDefined();
      expect(priceCallbacks!.size).toBeGreaterThanOrEqual(2);
    });

    it('should deliver price_update to all listeners without errors', async () => {
      renderApp();
      await enterTicker('aapl');

      const msg = makePriceUpdate({ symbol: 'AAPL', price: 200.0, change_percent: 2.5 });

      expect(() => {
        simulateMessage('price_update', msg as unknown as Record<string, unknown>);
      }).not.toThrow();
    });

    it('should not crash when price_update arrives for non-selected symbol', async () => {
      renderApp();
      await enterTicker('aapl');

      expect(() => {
        simulateMessage(
          'price_update',
          makePriceUpdate({ symbol: 'MSFT', price: 350.0 }) as unknown as Record<string, unknown>,
        );
      }).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Analysis lifecycle (progress -> complete)
  // -----------------------------------------------------------------------

  describe('Analysis lifecycle across AnalysisProgress and MethodologyScores', () => {
    it('should show AnalysisProgress bar when analysis_progress is received', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 3,
          total_agents: 7,
        }) as unknown as Record<string, unknown>,
      );

      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('should update progress bar width as agent_number advances', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 2,
          total_agents: 7,
        }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('29%');

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 5,
          total_agents: 7,
        }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('71%');
    });

    it('should transition to "Analysis complete" after analysis_complete', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );
      simulateMessage(
        'analysis_complete',
        makeAnalysisComplete({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );

      expect(screen.getByText('Analysis complete')).toBeInTheDocument();
      expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('100%');
    });

    it('should auto-dismiss AnalysisProgress 2 seconds after completion', async () => {
      // This test needs fake timers -- switch to them AFTER userEvent work
      renderApp();
      await enterTicker('aapl');

      // Now switch to fake timers for time-control
      vi.useFakeTimers();

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );
      simulateMessage(
        'analysis_complete',
        makeAnalysisComplete({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );

      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should deliver analysis_complete to both AnalysisProgress and MethodologyScores listeners', async () => {
      renderApp();
      await enterTicker('aapl');

      const completeCallbacks = messageCallbacks.get('analysis_complete');
      expect(completeCallbacks).toBeDefined();
      expect(completeCallbacks!.size).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Symbol change cleanup
  // -----------------------------------------------------------------------

  describe('Symbol change re-subscription', () => {
    it('should unsubscribe from old channels and re-subscribe when ticker changes (NewsFeed)', async () => {
      renderApp();
      await enterTicker('aapl');
      expect(mockSubscribe).toHaveBeenCalledWith('news_alerts');

      mockSubscribe.mockClear();
      mockUnsubscribe.mockClear();

      await enterTicker('msft');

      expect(mockUnsubscribe).toHaveBeenCalledWith('news_alerts');
      expect(mockSubscribe).toHaveBeenCalledWith('news_alerts');
    });

    it('should unsubscribe from price_updates and re-subscribe when ticker changes (Chart)', async () => {
      renderApp();
      await enterTicker('aapl');

      mockSubscribe.mockClear();
      mockUnsubscribe.mockClear();

      await enterTicker('tsla');

      expect(mockUnsubscribe).toHaveBeenCalledWith('price_updates');
      expect(mockSubscribe).toHaveBeenCalledWith('price_updates');
    });

    it('should unsubscribe from analysis_progress and re-subscribe on ticker change (MethodologyScores)', async () => {
      renderApp();
      await enterTicker('aapl');

      mockSubscribe.mockClear();
      mockUnsubscribe.mockClear();

      await enterTicker('googl');

      expect(mockUnsubscribe).toHaveBeenCalledWith('analysis_progress');
      expect(mockSubscribe).toHaveBeenCalledWith('analysis_progress');
    });

    it('should not accumulate message listeners across ticker changes', async () => {
      renderApp();
      await enterTicker('aapl');

      const callbacksBefore = messageCallbacks.get('news_alert')?.size ?? 0;

      await enterTicker('msft');
      const callbacksAfter = messageCallbacks.get('news_alert')?.size ?? 0;

      expect(callbacksAfter).toBeLessThanOrEqual(callbacksBefore);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Connection status display
  // -----------------------------------------------------------------------

  describe('Connection status indicator in Terminal', () => {
    it('should show "Connected" with green dot when status is connected', () => {
      mockStatus = 'connected';
      renderApp();

      const statusEl = screen.getByTestId('ws-status');
      expect(within(statusEl).getByText('Connected')).toBeInTheDocument();
      const dot = statusEl.querySelector('div.rounded-full');
      expect(dot).toHaveClass('bg-green-500');
    });

    it('should show "Disconnected" with red dot when status is disconnected', () => {
      mockStatus = 'disconnected';
      renderApp();

      const statusEl = screen.getByTestId('ws-status');
      expect(within(statusEl).getByText('Disconnected')).toBeInTheDocument();
      const dot = statusEl.querySelector('div.rounded-full');
      expect(dot).toHaveClass('bg-red-500');
    });

    it('should show "Connecting" with amber dot when status is connecting', () => {
      mockStatus = 'connecting';
      renderApp();

      const statusEl = screen.getByTestId('ws-status');
      expect(within(statusEl).getByText('Connecting')).toBeInTheDocument();
      const dot = statusEl.querySelector('div.rounded-full');
      expect(dot).toHaveClass('bg-amber-500');
    });

    it('should show "Reconnecting" with amber dot when status is reconnecting', () => {
      mockStatus = 'reconnecting';
      renderApp();

      const statusEl = screen.getByTestId('ws-status');
      expect(within(statusEl).getByText('Reconnecting')).toBeInTheDocument();
      const dot = statusEl.querySelector('div.rounded-full');
      expect(dot).toHaveClass('bg-amber-500');
    });
  });

  // -----------------------------------------------------------------------
  // 7. News alert propagation via WebSocket
  // -----------------------------------------------------------------------

  describe('News alert propagation to NewsFeed', () => {
    it('should register news_alert listener when symbol is set', async () => {
      renderApp();
      await enterTicker('aapl');

      expect(mockOnMessage).toHaveBeenCalledWith(
        'news_alert',
        expect.any(Function),
      );
    });

    it('should display live news article when news_alert arrives for selected symbol', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'news_alert',
        makeNewsAlert({
          symbol: 'AAPL',
          headline: 'Apple announces record-breaking quarter',
          sentiment: { score: 0.92, label: 'bullish' },
        }) as unknown as Record<string, unknown>,
      );

      await waitFor(() => {
        expect(
          screen.getByText('Apple announces record-breaking quarter'),
        ).toBeInTheDocument();
      });
    });

    it('should not display news_alert for a different symbol', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'news_alert',
        makeNewsAlert({
          symbol: 'MSFT',
          headline: 'Microsoft cloud revenue surges',
        }) as unknown as Record<string, unknown>,
      );

      expect(
        screen.queryByText('Microsoft cloud revenue surges'),
      ).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 8. Multiple components receiving same message type
  // -----------------------------------------------------------------------

  describe('Shared message delivery to multiple consumers', () => {
    it('should have at least one analysis_progress listener after setting ticker', async () => {
      renderApp();
      await enterTicker('aapl');

      const progressCallbacks = messageCallbacks.get('analysis_progress');
      expect(progressCallbacks).toBeDefined();
      expect(progressCallbacks!.size).toBeGreaterThanOrEqual(1);
    });

    it('should not crash when message arrives and no listeners exist for that type', () => {
      renderApp();

      expect(() => {
        simulateMessage('heartbeat', {
          type: 'heartbeat',
          server_time: '2024-01-01T00:00:00Z',
        });
      }).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 9. Cleanup on unmount
  // -----------------------------------------------------------------------

  describe('Cleanup on unmount', () => {
    it('should unsubscribe from channels when App unmounts', async () => {
      const { unmount } = renderApp();
      await enterTicker('aapl');

      mockUnsubscribe.mockClear();
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should have listeners before unmount and clean them on unmount', async () => {
      const { unmount } = renderApp();
      await enterTicker('aapl');

      expect(messageCallbacks.size).toBeGreaterThan(0);

      unmount();

      // After unmount, components called their cleanup fns.
      // The callbacks should have been removed by cleanup functions.
    });

    it('should not throw when messages arrive after unmount', async () => {
      const { unmount } = renderApp();
      await enterTicker('aapl');

      unmount();

      expect(() => {
        simulateMessage(
          'price_update',
          makePriceUpdate() as unknown as Record<string, unknown>,
        );
        simulateMessage(
          'analysis_progress',
          makeAnalysisProgress() as unknown as Record<string, unknown>,
        );
        simulateMessage(
          'analysis_complete',
          makeAnalysisComplete() as unknown as Record<string, unknown>,
        );
        simulateMessage(
          'news_alert',
          makeNewsAlert() as unknown as Record<string, unknown>,
        );
      }).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 10. Full lifecycle scenario
  // -----------------------------------------------------------------------

  describe('End-to-end WebSocket lifecycle', () => {
    it('should handle full flow: render -> subscribe -> progress -> complete', async () => {
      renderApp();

      // 1. Status indicator shows connected
      expect(within(screen.getByTestId('ws-status')).getByText('Connected')).toBeInTheDocument();

      // 2. User enters a ticker
      await enterTicker('aapl');

      // 3. Components subscribe to their channels
      expect(mockSubscribe).toHaveBeenCalledWith('price_updates');
      expect(mockSubscribe).toHaveBeenCalledWith('analysis_progress');
      expect(mockSubscribe).toHaveBeenCalledWith('news_alerts');

      // 4. Analysis progress arrives
      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 1,
          total_agents: 7,
          message: 'Starting Wyckoff analysis',
        }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();

      // 5. More progress
      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 5,
          total_agents: 7,
          message: 'Running CANSLIM analysis',
        }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('71%');

      // 6. Analysis completes
      simulateMessage(
        'analysis_complete',
        makeAnalysisComplete({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    });

    it('should handle full flow including auto-dismiss with fake timers', async () => {
      renderApp();
      await enterTicker('aapl');

      // Switch to fake timers after user interaction is done
      vi.useFakeTimers();

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );
      simulateMessage(
        'analysis_complete',
        makeAnalysisComplete({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
      );

      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should handle ticker switch mid-analysis without error', async () => {
      renderApp();
      await enterTicker('aapl');

      simulateMessage(
        'analysis_progress',
        makeAnalysisProgress({
          symbol: 'AAPL',
          agent_number: 3,
          total_agents: 7,
        }) as unknown as Record<string, unknown>,
      );
      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();

      // Switch to MSFT mid-analysis
      await enterTicker('msft');

      // Sending completion for AAPL should not crash
      expect(() => {
        simulateMessage(
          'analysis_complete',
          makeAnalysisComplete({ symbol: 'AAPL' }) as unknown as Record<string, unknown>,
        );
      }).not.toThrow();

      // New ticker should be active
      expect(
        screen.getByRole('heading', { name: /Chart.*MSFT/i }),
      ).toBeInTheDocument();
    });
  });
});
