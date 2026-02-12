import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewsFeed from '../../components/NewsFeed';

describe('NewsFeed Component', () => {
  it('should render component name', () => {
    render(<NewsFeed symbol="" />);
    expect(screen.getByText(/News Feed/i)).toBeInTheDocument();
  });

  it('should show not implemented message', () => {
    render(<NewsFeed symbol="" />);
    expect(screen.getByText(/Not yet implemented/i)).toBeInTheDocument();
  });

  it('should accept symbol prop', () => {
    render(<NewsFeed symbol="AAPL" />);
    expect(screen.getByText(/News Feed/i)).toBeInTheDocument();
  });

  it('should display symbol when provided', () => {
    render(<NewsFeed symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
  });

  it('should not show symbol when empty', () => {
    render(<NewsFeed symbol="" />);
    const heading = screen.getByRole('heading', { name: /News/i });
    expect(heading).toHaveTextContent('News');
    expect(heading).not.toHaveTextContent('—');
  });

  it('should have proper styling classes', () => {
    const { container } = render(<NewsFeed symbol="" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should update when symbol changes', () => {
    const { rerender } = render(<NewsFeed symbol="AAPL" />);
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();

    rerender(<NewsFeed symbol="MSFT" />);
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
  });
});
