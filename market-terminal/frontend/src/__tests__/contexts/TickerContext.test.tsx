import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { TickerProvider, useTickerContext } from '../../contexts/TickerContext';
import type { ReactNode } from 'react';

describe('TickerContext', () => {
  describe('TickerProvider', () => {
    it('should render children', () => {
      render(
        <TickerProvider>
          <div data-testid="test-child">Test Content</div>
        </TickerProvider>
      );

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should provide initial empty string for activeTicker', () => {
      const TestComponent = () => {
        const { activeTicker } = useTickerContext();
        return <div data-testid="ticker-value">{activeTicker || 'empty'}</div>;
      };

      render(
        <TickerProvider>
          <TestComponent />
        </TickerProvider>
      );

      expect(screen.getByTestId('ticker-value')).toHaveTextContent('empty');
    });

    it('should provide setActiveTicker function that updates state', () => {
      const TestComponent = () => {
        const { activeTicker, setActiveTicker } = useTickerContext();
        return (
          <div>
            <div data-testid="ticker-value">{activeTicker || 'empty'}</div>
            <button onClick={() => setActiveTicker('AAPL')}>Set AAPL</button>
          </div>
        );
      };

      render(
        <TickerProvider>
          <TestComponent />
        </TickerProvider>
      );

      // Initial state
      expect(screen.getByTestId('ticker-value')).toHaveTextContent('empty');

      // Update state
      act(() => {
        screen.getByRole('button', { name: 'Set AAPL' }).click();
      });

      expect(screen.getByTestId('ticker-value')).toHaveTextContent('AAPL');
    });

    it('should share state across multiple children', () => {
      const Consumer1 = () => {
        const { activeTicker } = useTickerContext();
        return <div data-testid="consumer-1">{activeTicker || 'none'}</div>;
      };

      const Consumer2 = () => {
        const { activeTicker, setActiveTicker } = useTickerContext();
        return (
          <div>
            <div data-testid="consumer-2">{activeTicker || 'none'}</div>
            <button onClick={() => setActiveTicker('TSLA')}>Set TSLA</button>
          </div>
        );
      };

      render(
        <TickerProvider>
          <Consumer1 />
          <Consumer2 />
        </TickerProvider>
      );

      // Both consumers see the same initial state
      expect(screen.getByTestId('consumer-1')).toHaveTextContent('none');
      expect(screen.getByTestId('consumer-2')).toHaveTextContent('none');

      // Update from Consumer2 affects Consumer1
      act(() => {
        screen.getByRole('button', { name: 'Set TSLA' }).click();
      });

      expect(screen.getByTestId('consumer-1')).toHaveTextContent('TSLA');
      expect(screen.getByTestId('consumer-2')).toHaveTextContent('TSLA');
    });
  });

  describe('useTickerContext', () => {
    it('should throw error when used outside TickerProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      const TestComponent = () => {
        useTickerContext();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTickerContext must be used within a TickerProvider');

      console.error = originalError;
    });

    it('should return context value when used inside TickerProvider', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TickerProvider>{children}</TickerProvider>
      );

      const { result } = renderHook(() => useTickerContext(), { wrapper });

      expect(result.current).toHaveProperty('activeTicker');
      expect(result.current).toHaveProperty('setActiveTicker');
      expect(result.current.activeTicker).toBe('');
      expect(typeof result.current.setActiveTicker).toBe('function');
    });

    it('should allow updating ticker via hook', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TickerProvider>{children}</TickerProvider>
      );

      const { result } = renderHook(() => useTickerContext(), { wrapper });

      expect(result.current.activeTicker).toBe('');

      act(() => {
        result.current.setActiveTicker('GOOGL');
      });

      expect(result.current.activeTicker).toBe('GOOGL');
    });

    it('should allow multiple updates to ticker', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TickerProvider>{children}</TickerProvider>
      );

      const { result } = renderHook(() => useTickerContext(), { wrapper });

      const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN'];

      tickers.forEach((ticker) => {
        act(() => {
          result.current.setActiveTicker(ticker);
        });
        expect(result.current.activeTicker).toBe(ticker);
      });
    });
  });
});
