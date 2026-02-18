/**
 * CommandBar component tests.
 *
 * The CommandBar is zero-props (ADR-001): it obtains state from
 * useTickerContext() and useCommand() directly.  Tests mock both hooks
 * at the module level so the component can render in isolation.
 *
 * @module __tests__/components/CommandBar
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import CommandBar from '../../components/CommandBar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetActiveTicker = vi.fn();
const mockExecute = vi.fn();
const mockHistoryBack = vi.fn(() => null as string | null);
const mockHistoryForward = vi.fn(() => null as string | null);
const mockClearResult = vi.fn();

vi.mock('../../contexts/TickerContext', () => ({
  useTickerContext: () => ({
    activeTicker: 'AAPL',
    setActiveTicker: mockSetActiveTicker,
  }),
}));

vi.mock('../../hooks/useCommand', () => ({
  useCommand: () => ({
    result: mockResult,
    loading: mockLoading,
    error: null,
    execute: mockExecute,
    historyBack: mockHistoryBack,
    historyForward: mockHistoryForward,
    clearResult: mockClearResult,
  }),
}));

// Mutable module-level state so tests can change hook return values
let mockResult: { command: unknown; data: unknown; error: string | null; timestamp: number } | null = null;
let mockLoading = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCommandBar() {
  return render(<CommandBar />);
}

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandBar Component', () => {
  let user: UserEvent;

  beforeEach(() => {
    user = userEvent.setup();
    mockResult = null;
    mockLoading = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('rendering', () => {
    it('should render the input with placeholder text', () => {
      renderCommandBar();
      const input = screen.getByPlaceholderText('Enter command or ticker...');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should render the prompt character', () => {
      renderCommandBar();
      expect(screen.getByText('>')).toBeInTheDocument();
    });

    it('should render with proper ARIA combobox role', () => {
      renderCommandBar();
      const input = getInput();
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('should set aria-expanded to false when suggestions are hidden', () => {
      renderCommandBar();
      const input = getInput();
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have maxLength of 500', () => {
      renderCommandBar();
      const input = getInput();
      expect(input).toHaveAttribute('maxLength', '500');
    });
  });

  // -------------------------------------------------------------------------
  // Input behavior
  // -------------------------------------------------------------------------

  describe('input behavior', () => {
    it('should allow typing in the input field', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'GOOGL');
      expect(input.value).toBe('GOOGL');
    });

    it('should execute command on Enter and clear input', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'AAPL{Enter}');
      expect(mockExecute).toHaveBeenCalledWith('AAPL');
      expect(input.value).toBe('');
    });

    it('should not execute on Enter when input is empty', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, '{Enter}');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle multiple commands in sequence', async () => {
      renderCommandBar();
      const input = getInput();

      await user.type(input, 'AAPL{Enter}');
      await user.type(input, 'MSFT{Enter}');
      await user.type(input, 'GOOGL{Enter}');

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 'AAPL');
      expect(mockExecute).toHaveBeenNthCalledWith(2, 'MSFT');
      expect(mockExecute).toHaveBeenNthCalledWith(3, 'GOOGL');
    });
  });

  // -------------------------------------------------------------------------
  // Suggestions
  // -------------------------------------------------------------------------

  describe('suggestions', () => {
    it('should show suggestions when typing a matching command', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      // "analyze AAPL" suggestion should appear (ticker substituted from context)
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should not show suggestions for empty input', () => {
      renderCommandBar();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should hide suggestions on Escape', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should navigate suggestions with ArrowDown', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      await user.keyboard('{ArrowDown}');
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should navigate suggestions with ArrowUp (wraps to end)', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      // ArrowUp from -1 wraps to last item
      await user.keyboard('{ArrowUp}');
      const options = screen.getAllByRole('option');
      const lastOption = options[options.length - 1];
      expect(lastOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should fill input with suggestion value on Tab', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      await user.keyboard('{ArrowDown}');
      await user.tab();
      // Input should contain the suggestion's value (e.g. "analyze ")
      expect(input.value).toContain('analyze');
    });

    it('should execute suggestion on Enter when selected', async () => {
      renderCommandBar();
      const input = getInput();
      await user.type(input, 'ana');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      // Should have executed the suggestion value
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // History navigation
  // -------------------------------------------------------------------------

  describe('history', () => {
    it('should call historyBack on ArrowUp when no suggestions', async () => {
      renderCommandBar();
      const input = getInput();
      input.focus();
      // No text typed, so no suggestions shown -- ArrowUp goes to history
      await user.keyboard('{ArrowUp}');
      expect(mockHistoryBack).toHaveBeenCalled();
    });

    it('should call historyForward on ArrowDown when no suggestions', async () => {
      renderCommandBar();
      const input = getInput();
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(mockHistoryForward).toHaveBeenCalled();
    });

    it('should fill input from historyBack return value', async () => {
      mockHistoryBack.mockReturnValueOnce('analyze AAPL');
      renderCommandBar();
      const input = getInput();
      input.focus();
      await user.keyboard('{ArrowUp}');
      expect(input.value).toBe('analyze AAPL');
    });

    it('should clear input when historyForward returns null', async () => {
      mockHistoryForward.mockReturnValueOnce(null);
      renderCommandBar();
      const input = getInput();
      input.focus();
      await user.keyboard('{ArrowDown}');
      expect(input.value).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('should show Processing... text when loading', () => {
      mockLoading = true;
      renderCommandBar();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should make input readOnly when loading', () => {
      mockLoading = true;
      renderCommandBar();
      const input = getInput();
      expect(input).toHaveAttribute('readOnly');
    });

    it('should apply amber border when loading', () => {
      mockLoading = true;
      const { container } = renderCommandBar();
      const inputRow = container.querySelector('.border-accent-amber');
      expect(inputRow).toBeInTheDocument();
    });

    it('should not show Processing... text when not loading', () => {
      renderCommandBar();
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Response panel
  // -------------------------------------------------------------------------

  describe('response panel', () => {
    it('should show result data when result is set', () => {
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: { action: 'ticker_set', symbol: 'AAPL' },
        error: null,
        timestamp: Date.now(),
      };
      renderCommandBar();
      expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('should show error when result has error', () => {
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: null,
        error: 'Command execution failed',
        timestamp: Date.now(),
      };
      renderCommandBar();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Command execution failed')).toBeInTheDocument();
    });

    it('should not show response panel when result is null', () => {
      mockResult = null;
      renderCommandBar();
      expect(screen.queryByText('Result')).not.toBeInTheDocument();
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });

    it('should not show response panel while loading', () => {
      mockLoading = true;
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: { action: 'ticker_set' },
        error: null,
        timestamp: Date.now(),
      };
      renderCommandBar();
      expect(screen.queryByText('Result')).not.toBeInTheDocument();
    });

    it('should call clearResult when dismiss button is clicked', async () => {
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: { action: 'ticker_set' },
        error: null,
        timestamp: Date.now(),
      };
      renderCommandBar();
      const dismissButton = screen.getByLabelText('Dismiss result');
      await user.click(dismissButton);
      expect(mockClearResult).toHaveBeenCalled();
    });

    it('should dismiss result on Escape when no suggestions shown', async () => {
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: { action: 'ticker_set' },
        error: null,
        timestamp: Date.now(),
      };
      renderCommandBar();
      const input = getInput();
      input.focus();
      await user.keyboard('{Escape}');
      expect(mockClearResult).toHaveBeenCalled();
    });

    it('should auto-dismiss after 30 seconds', () => {
      vi.useFakeTimers();
      mockResult = {
        command: { type: 'ticker', symbol: 'AAPL', raw: 'AAPL' },
        data: { action: 'ticker_set' },
        error: null,
        timestamp: Date.now(),
      };
      renderCommandBar();
      expect(screen.getByText('Result')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockClearResult).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // Styling
  // -------------------------------------------------------------------------

  describe('styling', () => {
    it('should have proper container classes', () => {
      const { container } = renderCommandBar();
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('relative');
    });

    it('should have terminal panel styling on input row', () => {
      const { container } = renderCommandBar();
      const inputRow = container.querySelector('.bg-terminal-panel');
      expect(inputRow).toBeInTheDocument();
    });

    it('should show green prompt when not loading', () => {
      renderCommandBar();
      const prompt = screen.getByText('>');
      expect(prompt).toHaveClass('text-accent-green');
    });

    it('should show amber pulsing prompt when loading', () => {
      mockLoading = true;
      renderCommandBar();
      const prompt = screen.getByText('>');
      expect(prompt).toHaveClass('text-accent-amber', 'animate-pulse');
    });
  });
});
