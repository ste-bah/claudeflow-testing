import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Watchlist from '../../components/Watchlist';

describe('Watchlist Component', () => {
  it('should render component name', () => {
    render(<Watchlist items={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('should show empty state when no items', () => {
    render(<Watchlist items={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('No tickers in watchlist')).toBeInTheDocument();
  });

  it('should render items when provided', () => {
    const items = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
    ];

    render(<Watchlist items={items} onSelect={vi.fn()} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('should call onSelect when item is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();
    const items = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
    ];

    render(<Watchlist items={items} onSelect={mockOnSelect} />);

    const button = screen.getByRole('button', { name: 'AAPL' });
    await user.click(button);

    expect(mockOnSelect).toHaveBeenCalledWith('AAPL');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onSelect with correct symbol for each item', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();
    const items = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    ];

    render(<Watchlist items={items} onSelect={mockOnSelect} />);

    await user.click(screen.getByRole('button', { name: 'AAPL' }));
    expect(mockOnSelect).toHaveBeenCalledWith('AAPL');

    await user.click(screen.getByRole('button', { name: 'MSFT' }));
    expect(mockOnSelect).toHaveBeenCalledWith('MSFT');

    await user.click(screen.getByRole('button', { name: 'GOOGL' }));
    expect(mockOnSelect).toHaveBeenCalledWith('GOOGL');

    expect(mockOnSelect).toHaveBeenCalledTimes(3);
  });

  it('should have proper styling classes', () => {
    const { container } = render(<Watchlist items={[]} onSelect={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should render buttons as type="button"', () => {
    const items = [{ symbol: 'AAPL', name: 'Apple Inc.' }];
    render(<Watchlist items={items} onSelect={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'AAPL' });
    expect(button).toHaveAttribute('type', 'button');
  });
});
