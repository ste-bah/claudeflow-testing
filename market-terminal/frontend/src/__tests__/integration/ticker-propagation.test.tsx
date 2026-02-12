import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

// Mock react-resizable-panels to avoid complex layout testing
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
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

      // Watchlist, MethodologyScores, MacroCalendar should remain stable
      expect(screen.getByText('Watchlist')).toBeInTheDocument();
      expect(screen.getByText('No tickers in watchlist')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Methodology Scores/i })).toBeInTheDocument();
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
    it('should handle empty Enter gracefully (set ticker to empty string)', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      // First set a valid ticker
      await user.type(input, 'aapl{Enter}');
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();

      // Now press Enter with empty input -- the onCommand will be called with ''
      // which uppercased is still '' -- effectively clearing the ticker
      await user.type(input, '{Enter}');

      // Chart should revert to "No ticker selected"
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();
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
    it('should start with empty ticker context showing placeholder states everywhere', () => {
      render(<App />);

      // Chart shows "No ticker selected"
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();

      // NewsFeed heading should NOT show the dash separator when no ticker
      const newsHeading = screen.getByRole('heading', { name: /News/i });
      expect(newsHeading).not.toHaveTextContent(/\u2014/);

      // Fundamentals heading should NOT show the dash separator when no ticker
      const fundsHeading = screen.getByRole('heading', { name: /Fundamentals/i });
      expect(fundsHeading).not.toHaveTextContent(/\u2014/);

      // Watchlist is empty
      expect(screen.getByText('No tickers in watchlist')).toBeInTheDocument();

      // MethodologyScores has no signals
      expect(screen.getByText('No analysis signals available')).toBeInTheDocument();

      // MacroCalendar has no events
      expect(screen.getByText('No upcoming events')).toBeInTheDocument();

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
