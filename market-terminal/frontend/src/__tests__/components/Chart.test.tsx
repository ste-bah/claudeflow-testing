import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Chart from '../../components/Chart';

describe('Chart Component', () => {
  it('should render component name', () => {
    render(<Chart symbol="" />);
    expect(screen.getByRole('heading', { name: /Chart/i })).toBeInTheDocument();
  });

  it('should show "No ticker selected" when symbol is empty', () => {
    render(<Chart symbol="" />);
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();
  });

  it('should display symbol when provided', () => {
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
  });

  it('should show not implemented message', () => {
    render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/Not yet implemented/i)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<Chart symbol="AAPL" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should update when symbol changes', () => {
    const { rerender } = render(<Chart symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();

    rerender(<Chart symbol="MSFT" />);
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
    expect(screen.queryByText(/AAPL/)).not.toBeInTheDocument();
  });

  it('should handle symbol change from empty to populated', () => {
    const { rerender } = render(<Chart symbol="" />);
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();

    rerender(<Chart symbol="GOOGL" />);
    expect(screen.getByText(/GOOGL/)).toBeInTheDocument();
    expect(screen.queryByText(/No ticker selected/i)).not.toBeInTheDocument();
  });
});
