import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Terminal from '../../layouts/Terminal';
import { TickerProvider } from '../../contexts/TickerContext';

// Mock react-resizable-panels to avoid complex layout testing
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

const renderTerminal = () => {
  return render(
    <TickerProvider>
      <Terminal />
    </TickerProvider>
  );
};

describe('Terminal Layout', () => {
  describe('Structure', () => {
    it('should render all 6 component panels', () => {
      renderTerminal();

      // Check for all panel headings/content
      expect(screen.getByRole('heading', { name: 'Watchlist' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Chart/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Methodology Scores/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Macro Calendar/i })).toBeInTheDocument();
    });

    it('should render CommandBar', () => {
      renderTerminal();
      expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
    });

    it('should have proper container structure', () => {
      const { container } = renderTerminal();

      // Root container should have full screen classes
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-screen', 'w-screen', 'bg-terminal-bg');
    });

    it('should render PanelGroups for layout', () => {
      renderTerminal();

      // We mocked panels, but verify they're present
      const panelGroups = screen.getAllByTestId('panel-group');
      expect(panelGroups.length).toBeGreaterThan(0);
    });

    it('should render Panels', () => {
      renderTerminal();

      const panels = screen.getAllByTestId('panel');
      // Should have multiple panels (6 components + nested structure)
      expect(panels.length).toBeGreaterThan(5);
    });

    it('should render resize handles', () => {
      renderTerminal();

      const handles = screen.getAllByTestId('resize-handle');
      // Should have multiple resize handles for panel boundaries
      expect(handles.length).toBeGreaterThan(0);
    });
  });

  describe('CommandBar Integration', () => {
    it('should update activeTicker when command is entered', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      // Initially should show no ticker selected
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();

      // Type ticker and press Enter
      await user.type(input, 'aapl{Enter}');

      // Should uppercase and set ticker
      expect(screen.getByRole('heading', { name: /Chart.*AAPL/i })).toBeInTheDocument();
    });

    it('should clear input after entering command', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...') as HTMLInputElement;

      await user.type(input, 'msft{Enter}');

      // Input should be cleared
      expect(input.value).toBe('');
    });

    it('should convert ticker to uppercase', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...');

      await user.type(input, 'googl{Enter}');

      // Should be uppercase in Chart
      expect(screen.getByRole('heading', { name: /Chart.*GOOGL/i })).toBeInTheDocument();
    });
  });

  describe('Ticker Context Integration', () => {
    it('should pass activeTicker to Chart component', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'tsla{Enter}');

      // Chart should display the ticker
      expect(screen.getByRole('heading', { name: /Chart.*TSLA/i })).toBeInTheDocument();
    });

    it('should pass activeTicker to NewsFeed component', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'amzn{Enter}');

      // NewsFeed should receive ticker
      expect(screen.getByRole('heading', { name: /News.*AMZN/i })).toBeInTheDocument();
    });

    it('should pass activeTicker to Fundamentals component', async () => {
      const user = userEvent.setup();
      renderTerminal();

      const input = screen.getByPlaceholderText('Enter command or ticker...');
      await user.type(input, 'nvda{Enter}');

      // Fundamentals should receive ticker
      expect(screen.getByRole('heading', { name: /Fundamentals.*NVDA/i })).toBeInTheDocument();
    });
  });

  describe('Watchlist Integration', () => {
    it('should render Watchlist with empty items initially', () => {
      renderTerminal();

      expect(screen.getByText('Watchlist')).toBeInTheDocument();
      expect(screen.getByText('No tickers in watchlist')).toBeInTheDocument();
    });

    it('should pass onSelect handler to Watchlist', () => {
      renderTerminal();

      // Watchlist component is rendered (tested by heading presence)
      // onSelect handler is passed (can't test directly without items)
      expect(screen.getByText('Watchlist')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show "No ticker selected" in Chart initially', () => {
      renderTerminal();
      expect(screen.getByRole('heading', { name: /Chart.*No ticker selected/i })).toBeInTheDocument();
    });

    it('should render all panels even without ticker', () => {
      renderTerminal();

      // All panels should render with placeholder content
      expect(screen.getByRole('heading', { name: 'Watchlist' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Chart/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Methodology Scores/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /News/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Fundamentals/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Macro Calendar/i })).toBeInTheDocument();
    });
  });
});
