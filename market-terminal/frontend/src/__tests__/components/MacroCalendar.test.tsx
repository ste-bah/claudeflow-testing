import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MacroCalendar from '../../components/MacroCalendar';

describe('MacroCalendar Component', () => {
  it('should render component name', () => {
    render(<MacroCalendar events={[]} />);
    expect(screen.getByText(/Macro Calendar/i)).toBeInTheDocument();
  });

  it('should show empty state message', () => {
    render(<MacroCalendar events={[]} />);
    expect(screen.getByText(/No upcoming events/i)).toBeInTheDocument();
  });

  it('should accept events prop as empty array', () => {
    render(<MacroCalendar events={[]} />);
    expect(screen.getByText(/Macro Calendar/i)).toBeInTheDocument();
  });

  it('should show empty state when no events', () => {
    render(<MacroCalendar events={[]} />);
    expect(screen.getByText(/No upcoming events/i)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<MacroCalendar events={[]} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should accept events array with items', () => {
    const events = [
      { date: '2024-02-15', event: 'FOMC Meeting' },
      { date: '2024-02-20', event: 'CPI Report' },
    ];
    render(<MacroCalendar events={events} />);
    expect(screen.getByText(/Macro Calendar/i)).toBeInTheDocument();
  });
});
