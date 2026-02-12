import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Fundamentals from '../../components/Fundamentals';

describe('Fundamentals Component', () => {
  it('should render component name', () => {
    render(<Fundamentals symbol="" />);
    expect(screen.getByRole('heading', { name: /Fundamentals/i })).toBeInTheDocument();
  });

  it('should show not implemented message', () => {
    render(<Fundamentals symbol="" />);
    expect(screen.getByText(/Not yet implemented/i)).toBeInTheDocument();
  });

  it('should accept symbol prop', () => {
    render(<Fundamentals symbol="AAPL" />);
    expect(screen.getByRole('heading', { name: /Fundamentals.*AAPL/i })).toBeInTheDocument();
  });

  it('should display symbol when provided', () => {
    render(<Fundamentals symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
  });

  it('should not show symbol when empty', () => {
    render(<Fundamentals symbol="" />);
    const heading = screen.getByRole('heading', { name: /Fundamentals/i });
    expect(heading).toHaveTextContent('Fundamentals');
    expect(heading).not.toHaveTextContent('—');
  });

  it('should have proper styling classes', () => {
    const { container } = render(<Fundamentals symbol="" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should update when symbol changes', () => {
    const { rerender } = render(<Fundamentals symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();

    rerender(<Fundamentals symbol="MSFT" />);
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
  });
});
