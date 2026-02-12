import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    // If it renders without throwing, test passes
    expect(document.body).toBeTruthy();
  });

  it('should have dark class on root div', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toHaveClass('dark');
  });

  it('should render TickerProvider context', () => {
    // We test that context is available by verifying Terminal renders
    // (Terminal uses useTickerContext which would throw if provider is missing)
    render(<App />);

    // Look for Terminal layout elements
    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
  });

  it('should render Terminal component', () => {
    render(<App />);

    // Check for CommandBar (part of Terminal)
    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();

    // Check for panel headings
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('should initialize with empty ticker context', () => {
    render(<App />);

    // Chart should show "No ticker selected" initially
    expect(screen.getByText(/No ticker selected/i)).toBeInTheDocument();
  });
});
