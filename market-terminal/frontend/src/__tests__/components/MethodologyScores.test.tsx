/**
 * Tests for the MethodologyScores component.
 *
 * Mocks the useAnalysis hook to isolate rendering logic from API calls.
 * All assertions use the new symbol-based prop interface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MethodologyScores from '../../components/MethodologyScores';
import type { AnalysisData } from '../../types/analysis';

// ---------------------------------------------------------------------------
// Mock useAnalysis hook
// ---------------------------------------------------------------------------

const mockUseAnalysis = vi.fn();

vi.mock('../../hooks/useAnalysis', () => ({
  useAnalysis: (...args: unknown[]) => mockUseAnalysis(...args),
  clearAnalysisCache: vi.fn(),
}));

// Mock WebSocketContext (MethodologyScores now uses useWebSocketContext for analysis_complete)
const mockWsOnMessage = vi.fn(() => vi.fn()); // returns unsubscribe fn

vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    status: 'connected' as const,
    clientId: 'test-client',
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: mockWsOnMessage,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAnalysisData(overrides?: Partial<AnalysisData>): AnalysisData {
  return {
    symbol: 'AAPL',
    composite: {
      overallDirection: 'bullish',
      overallConfidence: 0.75,
      confluenceCount: 4,
      timeframeBreakdown: {
        short: { direction: 'bullish', confidence: 0.8, methodologies: ['wyckoff'] },
        medium: { direction: 'neutral', confidence: 0.5, methodologies: ['elliott_wave'] },
        long: { direction: 'bearish', confidence: 0.6, methodologies: ['canslim'] },
      },
      tradeThesis: 'Strong uptrend with healthy pullback',
      weightsUsed: { wyckoff: 1.0, elliott_wave: 0.8 },
      timestamp: '2024-02-15T10:00:00Z',
    },
    signals: [
      {
        ticker: 'AAPL',
        methodology: 'wyckoff',
        direction: 'bullish',
        confidence: 0.85,
        timeframe: 'short',
        reasoning: 'Accumulation phase detected',
        keyLevels: { support: 148.5, resistance: 155.0 },
        timestamp: '2024-02-15T10:00:00Z',
      },
      {
        ticker: 'AAPL',
        methodology: 'elliott_wave',
        direction: 'neutral',
        confidence: 0.6,
        timeframe: 'medium',
        reasoning: 'Wave 3 complete',
        keyLevels: { target: 145.0 },
        timestamp: '2024-02-15T10:00:00Z',
      },
      {
        ticker: 'AAPL',
        methodology: 'canslim',
        direction: 'bearish',
        confidence: 0.55,
        timeframe: 'long',
        reasoning: 'Earnings deceleration',
        keyLevels: {},
        timestamp: '2024-02-15T10:00:00Z',
      },
    ],
    metadata: {
      analysisDurationMs: 1234,
      methodologiesRequested: 6,
      methodologiesCompleted: 3,
      methodologiesFailed: 0,
      failedMethodologies: [],
      cached: false,
      dataSourcesUsed: ['yfinance', 'edgar'],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MethodologyScores Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Null / empty symbol --------------------------------------------------

  it('should return null when symbol is empty', () => {
    mockUseAnalysis.mockReturnValue({ data: null, loading: false, error: null });
    const { container } = render(<MethodologyScores symbol="" />);
    expect(container.firstChild).toBeNull();
  });

  // -- Loading state --------------------------------------------------------

  it('should show loading skeleton while loading', () => {
    mockUseAnalysis.mockReturnValue({ data: null, loading: true, error: null });
    const { container } = render(<MethodologyScores symbol="AAPL" />);
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  // -- Error state ----------------------------------------------------------

  it('should show error message on fetch failure', () => {
    mockUseAnalysis.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load analysis data. Please try again later.',
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(
      screen.getByText('Failed to load analysis data. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('should render error text with accent-red class', () => {
    mockUseAnalysis.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load analysis data. Please try again later.',
    });
    render(<MethodologyScores symbol="AAPL" />);
    const errorEl = screen.getByText(
      'Failed to load analysis data. Please try again later.',
    );
    expect(errorEl).toHaveClass('text-accent-red');
  });

  // -- Empty state ----------------------------------------------------------

  it('should show empty state when data has no signals', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData({ signals: [] }),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(
      screen.getByText('No analysis data available'),
    ).toBeInTheDocument();
  });

  it('should show empty state when data is null', () => {
    mockUseAnalysis.mockReturnValue({ data: null, loading: false, error: null });
    render(<MethodologyScores symbol="AAPL" />);
    expect(
      screen.getByText('No analysis data available'),
    ).toBeInTheDocument();
  });

  // -- Data rendering -------------------------------------------------------

  it('should render composite header with overall direction', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getAllByText('Bullish').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('4 confluence')).toBeInTheDocument();
  });

  it('should render trade thesis text', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(
      screen.getByText('Strong uptrend with healthy pullback'),
    ).toBeInTheDocument();
  });

  it('should render signal cards for each methodology', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getByText('Wyckoff')).toBeInTheDocument();
    expect(screen.getByText('Elliott Wave')).toBeInTheDocument();
    expect(screen.getByText('CANSLIM')).toBeInTheDocument();
  });

  it('should render confidence percentages for signals', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('should render reasoning text for signals', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(
      screen.getByText('Accumulation phase detected'),
    ).toBeInTheDocument();
    expect(screen.getByText('Wave 3 complete')).toBeInTheDocument();
  });

  // -- Metadata footer ------------------------------------------------------

  it('should render metadata footer with duration and completion', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getByText('1234ms')).toBeInTheDocument();
    expect(screen.getByText('3/6')).toBeInTheDocument();
  });

  it('should show cached indicator when metadata.cached is true', () => {
    const data = makeAnalysisData();
    const cachedData = {
      ...data,
      metadata: { ...data.metadata, cached: true },
    };
    mockUseAnalysis.mockReturnValue({
      data: cachedData,
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('should show failed methodologies in red', () => {
    const data = makeAnalysisData();
    const failedData = {
      ...data,
      metadata: {
        ...data.metadata,
        failedMethodologies: ['sentiment', 'larry_williams'],
      },
    };
    mockUseAnalysis.mockReturnValue({
      data: failedData,
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    const failedEl = screen.getByText('Failed: sentiment, larry_williams');
    expect(failedEl).toHaveClass('text-accent-red');
  });

  // -- Timeframe filter bar -------------------------------------------------

  it('should render timeframe filter buttons with counts', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Short (1)')).toBeInTheDocument();
    expect(screen.getByText('Med (1)')).toBeInTheDocument();
    expect(screen.getByText('Long (1)')).toBeInTheDocument();
  });

  it('should filter signals when a timeframe button is clicked', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);

    // Click "Short" filter
    fireEvent.click(screen.getByText('Short (1)'));

    // Only the short-timeframe signal should remain visible
    expect(screen.getByText('Wyckoff')).toBeInTheDocument();
    expect(screen.queryByText('Elliott Wave')).not.toBeInTheDocument();
    expect(screen.queryByText('CANSLIM')).not.toBeInTheDocument();
  });

  it('should show all signals again when All filter is clicked', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);

    // Filter to short first
    fireEvent.click(screen.getByText('Short (1)'));
    expect(screen.queryByText('Elliott Wave')).not.toBeInTheDocument();

    // Click All to restore
    fireEvent.click(screen.getByText('All (3)'));
    expect(screen.getByText('Elliott Wave')).toBeInTheDocument();
    expect(screen.getByText('CANSLIM')).toBeInTheDocument();
  });

  // -- Key levels -----------------------------------------------------------

  it('should render key level values with toFixed(2)', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    render(<MethodologyScores symbol="AAPL" />);
    // support: 148.5 -> "148.50", resistance: 155.0 -> "155.00"
    expect(screen.getByText('148.50')).toBeInTheDocument();
    expect(screen.getByText('155.00')).toBeInTheDocument();
  });

  // -- Direction arrows (SVG) -----------------------------------------------

  it('should use SVG arrows, not Unicode characters', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    const { container } = render(<MethodologyScores symbol="AAPL" />);

    // Should have SVGs with aria-labels
    const bullishArrows = container.querySelectorAll('svg[aria-label="Bullish"]');
    const bearishArrows = container.querySelectorAll('svg[aria-label="Bearish"]');
    const neutralArrows = container.querySelectorAll('svg[aria-label="Neutral"]');

    expect(bullishArrows.length).toBeGreaterThan(0);
    expect(bearishArrows.length).toBeGreaterThan(0);
    expect(neutralArrows.length).toBeGreaterThan(0);
  });

  // -- Terminal theme styling -----------------------------------------------

  it('should use terminal theme classes on root element', () => {
    mockUseAnalysis.mockReturnValue({
      data: makeAnalysisData(),
      loading: false,
      error: null,
    });
    const { container } = render(<MethodologyScores symbol="AAPL" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('bg-terminal-bg');
    expect(root).toHaveClass('font-mono');
  });

  // -- Passes symbol to useAnalysis -----------------------------------------

  it('should call useAnalysis with the provided symbol and refreshKey', () => {
    mockUseAnalysis.mockReturnValue({ data: null, loading: false, error: null });
    render(<MethodologyScores symbol="TSLA" />);
    expect(mockUseAnalysis).toHaveBeenCalledWith('TSLA', 0);
  });
});
