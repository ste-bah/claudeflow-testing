import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AnalysisProgress from '../../components/AnalysisProgress';
import type {
  WsAnalysisProgressMessage,
  WsAnalysisCompleteMessage,
} from '../../types/websocket';

// ---------------------------------------------------------------------------
// Mock WebSocketContext
// ---------------------------------------------------------------------------

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

/** Captured callbacks keyed by message type (e.g. 'analysis_progress'). */
let capturedCallbacks: Record<string, Function>;

const mockOnMessage = vi.fn((type: string, cb: Function) => {
  capturedCallbacks[type] = cb;
  return vi.fn(); // cleanup function
});

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

/** Build a valid analysis_progress WebSocket message. */
function makeProgressMsg(overrides: Partial<WsAnalysisProgressMessage> = {}): WsAnalysisProgressMessage {
  return {
    type: 'analysis_progress',
    symbol: 'AAPL',
    agent: 'Wyckoff',
    agent_number: 2,
    total_agents: 7,
    status: 'running',
    message: 'Running Wyckoff analysis',
    ...overrides,
  } as WsAnalysisProgressMessage;
}

/** Build a valid analysis_complete WebSocket message. */
function makeCompleteMsg(overrides: Partial<WsAnalysisCompleteMessage> = {}): WsAnalysisCompleteMessage {
  return {
    type: 'analysis_complete',
    symbol: 'AAPL',
    composite_signal: { direction: 'bullish', score: 0.75 },
    timestamp: '2024-06-15T10:05:00Z',
    ...overrides,
  } as WsAnalysisCompleteMessage;
}

/** Simulate receiving an analysis_progress message via the captured callback. */
function sendProgress(msg: WsAnalysisProgressMessage) {
  act(() => {
    capturedCallbacks['analysis_progress']?.(msg);
  });
}

/** Simulate receiving an analysis_complete message via the captured callback. */
function sendComplete(msg: WsAnalysisCompleteMessage) {
  act(() => {
    capturedCallbacks['analysis_complete']?.(msg);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalysisProgress Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    capturedCallbacks = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------------
  // Channel subscription
  // ----------------------------------------------------------------

  it('should subscribe to analysis_progress channel on mount', () => {
    render(<AnalysisProgress />);
    expect(mockSubscribe).toHaveBeenCalledWith('analysis_progress');
  });

  it('should register listeners for analysis_progress and analysis_complete', () => {
    render(<AnalysisProgress />);
    expect(mockOnMessage).toHaveBeenCalledWith('analysis_progress', expect.any(Function));
    expect(mockOnMessage).toHaveBeenCalledWith('analysis_complete', expect.any(Function));
  });

  it('should unsubscribe from channel on unmount', () => {
    const { unmount } = render(<AnalysisProgress />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith('analysis_progress');
  });

  // ----------------------------------------------------------------
  // Empty state
  // ----------------------------------------------------------------

  it('should render nothing when no active analyses', () => {
    const { container } = render(<AnalysisProgress />);
    expect(container.firstChild).toBeNull();
  });

  it('should not show analysis-progress testid when empty', () => {
    render(<AnalysisProgress />);
    expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Progress display
  // ----------------------------------------------------------------

  it('should show progress container when analysis_progress message received', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
  });

  it('should display the heading text', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    expect(screen.getByText('Analysis Progress')).toBeInTheDocument();
  });

  it('should display the symbol name', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'TSLA' }));
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('should display agent status text with agent number and total', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({
      agent: 'Wyckoff',
      agent_number: 3,
      total_agents: 7,
      message: 'Running Wyckoff analysis',
    }));
    expect(screen.getByText('Agent 3/7: Running Wyckoff analysis')).toBeInTheDocument();
  });

  it('should render progress bar with data-testid', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));
    expect(screen.getByTestId('progress-bar-AAPL')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Progress percentage
  // ----------------------------------------------------------------

  it('should calculate correct progress width', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ agent_number: 3, total_agents: 10 }));
    const bar = screen.getByTestId('progress-bar-AAPL');
    expect(bar.style.width).toBe('30%');
  });

  it('should update progress percentage as agent_number changes', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ agent_number: 1, total_agents: 5 }));
    expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('20%');

    sendProgress(makeProgressMsg({ agent_number: 3, total_agents: 5 }));
    expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('60%');

    sendProgress(makeProgressMsg({ agent_number: 5, total_agents: 5 }));
    expect(screen.getByTestId('progress-bar-AAPL').style.width).toBe('100%');
  });

  it('should show 0% width when total_agents is 0', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ agent_number: 0, total_agents: 0 }));
    const bar = screen.getByTestId('progress-bar-AAPL');
    expect(bar.style.width).toBe('0%');
  });

  // ----------------------------------------------------------------
  // Elapsed time
  // ----------------------------------------------------------------

  it('should display initial elapsed time as 0s', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('should update elapsed time after seconds pass', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    expect(screen.getByText('0s')).toBeInTheDocument();

    // Advance fake timers by 5 seconds -- this advances Date.now() AND fires the
    // setInterval tick, which triggers a state update re-rendering the elapsed time.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('should format elapsed time as minutes and seconds when >= 60s', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());

    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByText('1m 30s')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Completion
  // ----------------------------------------------------------------

  it('should show "Analysis complete" text after analysis_complete', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    sendComplete(makeCompleteMsg());
    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
  });

  it('should show 100% width progress bar after completion', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));
    sendComplete(makeCompleteMsg({ symbol: 'AAPL' }));
    const bar = screen.getByTestId('progress-bar-AAPL');
    expect(bar.style.width).toBe('100%');
  });

  // ----------------------------------------------------------------
  // Auto-dismiss
  // ----------------------------------------------------------------

  it('should auto-dismiss 2 seconds after analysis_complete', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    sendComplete(makeCompleteMsg());

    // Still visible right after completion
    expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();

    // Advance by 2 seconds for auto-dismiss
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();
  });

  it('should not dismiss before 2 seconds', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    sendComplete(makeCompleteMsg());

    act(() => {
      vi.advanceTimersByTime(1999);
    });

    // Should still be visible
    expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Multiple concurrent analyses
  // ----------------------------------------------------------------

  it('should handle multiple concurrent analyses', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL', agent_number: 1, total_agents: 5 }));
    sendProgress(makeProgressMsg({ symbol: 'MSFT', agent_number: 3, total_agents: 7 }));

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar-AAPL')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar-MSFT')).toBeInTheDocument();
  });

  it('should dismiss only the completed symbol after 2s, keep others', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));
    sendProgress(makeProgressMsg({ symbol: 'MSFT' }));

    // Complete only AAPL
    sendComplete(makeCompleteMsg({ symbol: 'AAPL' }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // AAPL dismissed, MSFT still visible
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Symbol filter prop
  // ----------------------------------------------------------------

  it('should show all symbols when no symbol prop is provided', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));
    sendProgress(makeProgressMsg({ symbol: 'GOOG' }));

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOG')).toBeInTheDocument();
  });

  it('should only show matching symbol when symbol prop is set', () => {
    render(<AnalysisProgress symbol="AAPL" />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));
    sendProgress(makeProgressMsg({ symbol: 'GOOG' }));

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('GOOG')).not.toBeInTheDocument();
  });

  it('should not show progress for non-matching symbol', () => {
    render(<AnalysisProgress symbol="TSLA" />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));

    expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();
  });

  it('should filter analysis_complete by symbol prop too', () => {
    render(<AnalysisProgress symbol="AAPL" />);
    sendProgress(makeProgressMsg({ symbol: 'AAPL' }));

    // Send complete for GOOG (should be ignored)
    sendComplete(makeCompleteMsg({ symbol: 'GOOG' }));

    // AAPL should NOT show "Analysis complete" since the complete was for GOOG
    expect(screen.queryByText('Analysis complete')).not.toBeInTheDocument();
    // The agent status text should still show
    expect(screen.getByText(/Agent 2\/7/)).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Cleanup on unmount
  // ----------------------------------------------------------------

  it('should clean up timers on unmount', () => {
    const { unmount } = render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    sendComplete(makeCompleteMsg());

    // There's a dismiss timer pending - unmount should clear it
    unmount();

    // Advancing timers after unmount should not cause errors
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  it('should clean up tick interval on unmount', () => {
    const { unmount } = render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());

    // Active analysis starts the tick interval
    unmount();

    // Advancing timers after unmount should not cause errors
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  // ----------------------------------------------------------------
  // analysis_complete without prior progress (edge case)
  // ----------------------------------------------------------------

  it('should ignore analysis_complete if no prior progress for that symbol', () => {
    render(<AnalysisProgress />);
    sendComplete(makeCompleteMsg({ symbol: 'AAPL' }));

    // Should remain empty because there was no progress entry to update
    expect(screen.queryByTestId('analysis-progress')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // data-testid attributes
  // ----------------------------------------------------------------

  it('should have data-testid="analysis-progress" on the container', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg());
    const container = screen.getByTestId('analysis-progress');
    expect(container).toBeInTheDocument();
  });

  it('should have data-testid="progress-bar-{SYMBOL}" on each progress bar', () => {
    render(<AnalysisProgress />);
    sendProgress(makeProgressMsg({ symbol: 'NVDA' }));
    expect(screen.getByTestId('progress-bar-NVDA')).toBeInTheDocument();
  });
});
