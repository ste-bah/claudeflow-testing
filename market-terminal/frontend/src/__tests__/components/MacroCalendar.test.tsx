/**
 * Comprehensive component tests for MacroCalendar.
 *
 * Tests rendering states (loading, error, empty, data),
 * ImportanceFilter toggle, EventRow expand/collapse, past-event styling,
 * surprise indicators, and reaction panel display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MacroCalendar from '../../components/MacroCalendar';
import type { MacroCalendarApiResponse, MacroReactionApiResponse } from '../../types/macro';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------

const mockGetMacroCalendar = vi.fn<(...args: unknown[]) => Promise<MacroCalendarApiResponse>>();

const mockGetMacroReaction = vi.fn<(symbol: string, eventType: string, opts?: unknown) => Promise<MacroReactionApiResponse>>();

vi.mock('../../api/client', () => ({
  getMacroCalendar: (...args: unknown[]) => mockGetMacroCalendar(...args),
  getMacroReaction: (...args: unknown[]) => mockGetMacroReaction(...(args as [string, string, unknown?])),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a date string N days from today. */
function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Build a complete calendar response with the given events. */
function makeCalendarResponse(
  events: MacroCalendarApiResponse['events'] = [],
  overrides: Partial<MacroCalendarApiResponse> = {},
): MacroCalendarApiResponse {
  return {
    events,
    date_range: { from: '2024-01-01', to: '2024-02-01' },
    data_source: 'mock',
    data_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a single raw calendar event. */
function makeEvent(overrides: Partial<MacroCalendarApiResponse['events'][0]> = {}) {
  return {
    event_name: 'Consumer Price Index',
    event_type: 'cpi' as string | null,
    date: daysFromToday(1),
    time: '08:30',
    country: 'US',
    expected: 3.2,
    previous: 3.1,
    actual: null as number | null,
    unit: 'percent',
    importance: 'high',
    description: 'Consumer Price Index (YoY)',
    ...overrides,
  };
}

/** Build a reaction response. */
function makeReactionResponse(
  overrides: Partial<MacroReactionApiResponse> = {},
): MacroReactionApiResponse {
  return {
    symbol: 'AAPL',
    event_type: 'cpi',
    reactions: [
      {
        event_date: '2024-06-15',
        event_value: 3.3,
        expected: 3.2,
        surprise: 'above',
        price_before: 185.5,
        price_after_1d: 187.0,
        price_after_5d: 190.0,
        return_1d_percent: 0.81,
        return_5d_percent: 2.43,
        volume_ratio: 1.35,
      },
    ],
    averages: {
      avg_return_1d_on_beat: 0.45,
      avg_return_1d_on_miss: -0.32,
      avg_return_5d_on_beat: 1.1,
      avg_return_5d_on_miss: -0.88,
      avg_volume_ratio: 1.2,
    },
    sample_size: 12,
    data_sources: ['yfinance'],
    data_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: return empty calendar
  mockGetMacroCalendar.mockResolvedValue(makeCalendarResponse());
  mockGetMacroReaction.mockResolvedValue(makeReactionResponse());

  // Clear hook caches
  const { clearMacroCalendarCache, clearMacroReactionCache } = await import('../../hooks/useMacroCalendar');
  clearMacroCalendarCache();
  clearMacroReactionCache();
});

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('MacroCalendar Component', () => {
  it('should render component name', async () => {
    render(<MacroCalendar symbol="" />);
    expect(screen.getByText(/Macro Calendar/i)).toBeInTheDocument();
  });

  it('should show empty state message when no events', async () => {
    render(<MacroCalendar symbol="" />);
    await waitFor(() => {
      expect(screen.getByText(/No upcoming economic events found/i)).toBeInTheDocument();
    });
  });

  it('should accept symbol prop', () => {
    render(<MacroCalendar symbol="AAPL" />);
    expect(screen.getByText(/Macro Calendar/i)).toBeInTheDocument();
  });

  it('should show empty state when API returns empty events', async () => {
    render(<MacroCalendar symbol="AAPL" />);
    await waitFor(() => {
      expect(screen.getByText(/No upcoming economic events found/i)).toBeInTheDocument();
    });
  });

  it('should have proper styling classes', async () => {
    const { container } = render(<MacroCalendar symbol="" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should show events when API returns data', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent()]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('MacroCalendar Loading State', () => {
  it('should show loading skeleton while fetching', async () => {
    // Never-resolving promise to keep loading state
    mockGetMacroCalendar.mockReturnValue(new Promise(() => {}));

    const { container } = render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      const pulsars = container.querySelectorAll('.animate-pulse');
      expect(pulsars.length).toBeGreaterThan(0);
    });
  });

  it('should hide loading skeleton after data loads', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent()]),
    );

    const { container } = render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    const pulsars = container.querySelectorAll('.animate-pulse');
    expect(pulsars.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('MacroCalendar Error State', () => {
  it('should show static error message on API failure', async () => {
    mockGetMacroCalendar.mockRejectedValueOnce(new Error('Network error'));

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load calendar data. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should display error in red text', async () => {
    mockGetMacroCalendar.mockRejectedValueOnce(new Error('fail'));

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      const errorEl = screen.getByText('Failed to load calendar data. Please try again later.');
      expect(errorEl).toHaveClass('text-accent-red');
    });
  });

  it('should not reflect user input in error message (XSS prevention)', async () => {
    mockGetMacroCalendar.mockRejectedValueOnce(
      new Error('<img src=x onerror=alert(1)>'),
    );

    render(<MacroCalendar symbol="<script>xss</script>" />);

    await waitFor(() => {
      const errorEl = screen.getByText('Failed to load calendar data. Please try again later.');
      expect(errorEl.textContent).not.toContain('<script>');
      expect(errorEl.textContent).not.toContain('onerror');
    });
  });
});

// ---------------------------------------------------------------------------
// Events table rendering
// ---------------------------------------------------------------------------

describe('MacroCalendar Events Table', () => {
  it('should render table headers', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent()]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Event')).toBeInTheDocument();
      expect(screen.getByText('Actual')).toBeInTheDocument();
      expect(screen.getByText('Expected')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Surprise')).toBeInTheDocument();
      expect(screen.getByText('Impact')).toBeInTheDocument();
    });
  });

  it('should display event type badge', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'nfp' })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('NFP')).toBeInTheDocument();
    });
  });

  it('should display "Other" for unknown event type', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'custom_event' })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeInTheDocument();
    });
  });

  it('should display "Other" for null event type', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: null })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeInTheDocument();
    });
  });

  it('should format expected value with unit', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ expected: 3.2, unit: 'percent' })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('3.2%')).toBeInTheDocument();
    });
  });

  it('should show "--" for null actual value', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ actual: null })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      // There will be "--" for actual and possibly surprise
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display importance badge', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ importance: 'high' })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  it('should render multiple events', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'nfp', importance: 'medium' }),
        makeEvent({ event_type: 'fomc', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
      expect(screen.getByText('NFP')).toBeInTheDocument();
      expect(screen.getByText('FOMC')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Past event styling
// ---------------------------------------------------------------------------

describe('MacroCalendar Past Event Styling', () => {
  it('should apply opacity-50 to past events', async () => {
    const pastDate = daysFromToday(-3);
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ date: pastDate })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Find the row containing the event
    const cpiElement = screen.getByText('CPI');
    const row = cpiElement.closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveClass('opacity-50');
  });

  it('should NOT apply opacity-50 to future events', async () => {
    const futureDate = daysFromToday(3);
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ date: futureDate })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    const cpiElement = screen.getByText('CPI');
    const row = cpiElement.closest('tr');
    expect(row).not.toBeNull();
    expect(row).not.toHaveClass('opacity-50');
  });

  it('should sort future events before past events', async () => {
    const futureDate = daysFromToday(2);
    const pastDate = daysFromToday(-2);

    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'nfp', date: pastDate, event_name: 'Past NFP' }),
        makeEvent({ event_type: 'cpi', date: futureDate, event_name: 'Future CPI' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
      expect(screen.getByText('NFP')).toBeInTheDocument();
    });

    // Get all table rows (skipping header row)
    const tbody = screen.getByText('CPI').closest('tbody');
    expect(tbody).not.toBeNull();
    const rows = tbody!.querySelectorAll('tr');
    // Future event (CPI) should come first (no opacity), past (NFP) second (opacity-50)
    const firstRow = rows[0];
    const secondRow = rows[1];
    expect(firstRow).not.toHaveClass('opacity-50');
    expect(secondRow).toHaveClass('opacity-50');
  });
});

// ---------------------------------------------------------------------------
// Surprise indicators
// ---------------------------------------------------------------------------

describe('MacroCalendar Surprise Indicators', () => {
  it('should show "--" when actual is null', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: null, expected: 3.2 }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // The surprise indicator should show "--"
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should show green indicator for above-expected surprise', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: 3.5, expected: 3.2, unit: 'percent' }),
      ]),
    );

    const { container } = render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // The surprise value should be displayed with green class
    const greenElements = container.querySelectorAll('.text-accent-green');
    expect(greenElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show red indicator for below-expected surprise', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: 2.8, expected: 3.2, unit: 'percent' }),
      ]),
    );

    const { container } = render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    const redElements = container.querySelectorAll('.text-accent-red');
    expect(redElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show muted indicator for inline surprise', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: 3.2, expected: 3.2, unit: 'percent' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Inline surprise shows "0.00"
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ImportanceFilter toggle
// ---------------------------------------------------------------------------

describe('MacroCalendar ImportanceFilter', () => {
  it('should render filter buttons with counts', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'nfp', importance: 'high' }),
        makeEvent({ event_type: 'fomc', importance: 'medium' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Filter buttons should show counts
    expect(screen.getByText('All (4)')).toBeInTheDocument();
    expect(screen.getByText('High (2)')).toBeInTheDocument();
    expect(screen.getByText('Med (1)')).toBeInTheDocument();
    expect(screen.getByText('Low (1)')).toBeInTheDocument();
  });

  it('should filter to high-importance events when High button clicked', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
      expect(screen.getByText('GDP')).toBeInTheDocument();
    });

    // Click the "High" filter button
    fireEvent.click(screen.getByText('High (1)'));

    // Should show only high importance events
    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
      expect(screen.queryByText('GDP')).not.toBeInTheDocument();
    });
  });

  it('should filter to medium-importance events when Med button clicked', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'fomc', importance: 'medium' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Med (1)'));

    await waitFor(() => {
      expect(screen.getByText('FOMC')).toBeInTheDocument();
      expect(screen.queryByText('CPI')).not.toBeInTheDocument();
      expect(screen.queryByText('GDP')).not.toBeInTheDocument();
    });
  });

  it('should filter to low-importance events when Low button clicked', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Low (1)'));

    await waitFor(() => {
      expect(screen.getByText('GDP')).toBeInTheDocument();
      expect(screen.queryByText('CPI')).not.toBeInTheDocument();
    });
  });

  it('should show all events when All button clicked after filtering', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Filter to High only
    fireEvent.click(screen.getByText('High (1)'));
    await waitFor(() => {
      expect(screen.queryByText('GDP')).not.toBeInTheDocument();
    });

    // Click "All" to restore
    fireEvent.click(screen.getByText('All (2)'));
    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
      expect(screen.getByText('GDP')).toBeInTheDocument();
    });
  });

  it('should show empty state when filter matches no events', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Click "Low" filter -- no low-importance events exist
    fireEvent.click(screen.getByText('Low (0)'));

    await waitFor(() => {
      expect(screen.getByText(/No upcoming economic events found/i)).toBeInTheDocument();
    });
  });

  it('should highlight active filter button', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ event_type: 'cpi', importance: 'high' }),
        makeEvent({ event_type: 'gdp', importance: 'low' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // "All" button should be active by default (has bg-terminal-border)
    const allButton = screen.getByText('All (2)');
    expect(allButton).toHaveClass('bg-terminal-border');

    // Click "High" filter
    fireEvent.click(screen.getByText('High (1)'));

    await waitFor(() => {
      const highButton = screen.getByText('High (1)');
      expect(highButton).toHaveClass('bg-terminal-border');
      // "All" should no longer be active
      expect(allButton).not.toHaveClass('bg-terminal-border');
    });
  });
});

// ---------------------------------------------------------------------------
// EventRow expand/collapse
// ---------------------------------------------------------------------------

describe('MacroCalendar EventRow Expand/Collapse', () => {
  it('should show expand button for known event types when symbol is provided', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Look for the expand button (right-pointing triangle)
    const expandButton = screen.getByLabelText('Expand reaction data');
    expect(expandButton).toBeInTheDocument();
  });

  it('should NOT show expand button when symbol is empty', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );

    render(<MacroCalendar symbol="" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Expand reaction data')).not.toBeInTheDocument();
  });

  it('should NOT show expand button for null event type', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: null })]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Expand reaction data')).not.toBeInTheDocument();
  });

  it('should expand row and fetch reaction data on click', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockResolvedValueOnce(makeReactionResponse());

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Click expand button
    const expandButton = screen.getByLabelText('Expand reaction data');
    fireEvent.click(expandButton);

    // Should fetch reaction data
    await waitFor(() => {
      expect(mockGetMacroReaction).toHaveBeenCalledWith(
        'AAPL',
        'cpi',
        expect.anything(),
      );
    });

    // Should show reaction panel with historical data
    await waitFor(() => {
      expect(screen.getByText(/Historical reactions \(12 events\)/)).toBeInTheDocument();
    });
  });

  it('should change expand button to collapse button after expanding', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockResolvedValueOnce(makeReactionResponse());

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Click expand
    fireEvent.click(screen.getByLabelText('Expand reaction data'));

    await waitFor(() => {
      expect(screen.getByLabelText('Collapse reaction data')).toBeInTheDocument();
    });
  });

  it('should collapse expanded row on second click', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockResolvedValueOnce(makeReactionResponse());

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // Click expand
    fireEvent.click(screen.getByLabelText('Expand reaction data'));

    await waitFor(() => {
      expect(screen.getByText(/Historical reactions/)).toBeInTheDocument();
    });

    // Click collapse
    fireEvent.click(screen.getByLabelText('Collapse reaction data'));

    await waitFor(() => {
      expect(screen.queryByText(/Historical reactions/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Expand reaction data')).toBeInTheDocument();
    });
  });

  it('should display reaction averages in heatmap', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockResolvedValueOnce(makeReactionResponse());

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Expand reaction data'));

    await waitFor(() => {
      // Should show reaction average labels
      expect(screen.getByText('1D Beat')).toBeInTheDocument();
      expect(screen.getByText('1D Miss')).toBeInTheDocument();
      expect(screen.getByText('5D Beat')).toBeInTheDocument();
      expect(screen.getByText('5D Miss')).toBeInTheDocument();
      expect(screen.getByText('Vol Ratio')).toBeInTheDocument();
    });
  });

  it('should show "No historical reaction data available" when reactions empty', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockResolvedValueOnce(
      makeReactionResponse({ reactions: [], sample_size: 0 }),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Expand reaction data'));

    await waitFor(() => {
      expect(screen.getByText('No historical reaction data available')).toBeInTheDocument();
    });
  });

  it('should show error in reaction panel on API failure', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([makeEvent({ event_type: 'cpi' })]),
    );
    mockGetMacroReaction.mockRejectedValueOnce(new Error('Reaction API error'));

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Expand reaction data'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load reaction data. Please try again later.')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Display name mapping
// ---------------------------------------------------------------------------

describe('MacroCalendar Event Type Display Names', () => {
  const eventDisplayPairs: Array<[string, string]> = [
    ['cpi', 'CPI'],
    ['core_cpi', 'Core CPI'],
    ['ism_manufacturing', 'ISM Mfg'],
    ['ism_services', 'ISM Svc'],
    ['nfp', 'NFP'],
    ['unemployment', 'Unemployment'],
    ['fomc', 'FOMC'],
    ['gdp', 'GDP'],
    ['ppi', 'PPI'],
    ['retail_sales', 'Retail Sales'],
    ['housing_starts', 'Housing Starts'],
    ['building_permits', 'Building Permits'],
    ['consumer_confidence', 'Consumer Conf'],
    ['durable_goods', 'Durable Goods'],
    ['fed_funds_rate', 'Fed Funds'],
  ];

  it.each(eventDisplayPairs)(
    'should display "%s" as "%s"',
    async (eventType, displayName) => {
      mockGetMacroCalendar.mockResolvedValueOnce(
        makeCalendarResponse([makeEvent({ event_type: eventType })]),
      );

      const { unmount } = render(<MacroCalendar symbol="AAPL" />);

      await waitFor(() => {
        expect(screen.getByText(displayName)).toBeInTheDocument();
      });

      unmount();

      // Clear caches for next iteration
      const { clearMacroCalendarCache, clearMacroReactionCache } = await import('../../hooks/useMacroCalendar');
      clearMacroCalendarCache();
      clearMacroReactionCache();
    },
  );
});

// ---------------------------------------------------------------------------
// Value formatting in table cells
// ---------------------------------------------------------------------------

describe('MacroCalendar Value Formatting', () => {
  it('should display 0 as "0.0%" for percent unit, not "--"', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: 0, expected: 0, previous: 0, unit: 'percent' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('CPI')).toBeInTheDocument();
    });

    // All three numeric columns (actual, expected, previous) should show "0.0%"
    const zeroPercents = screen.getAllByText('0.0%');
    expect(zeroPercents.length).toBe(3);
  });

  it('should display index unit correctly', async () => {
    mockGetMacroCalendar.mockResolvedValueOnce(
      makeCalendarResponse([
        makeEvent({ actual: 52.3, unit: 'index' }),
      ]),
    );

    render(<MacroCalendar symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText('52.3')).toBeInTheDocument();
    });
  });
});
