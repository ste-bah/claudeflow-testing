import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MethodologyScores from '../../components/MethodologyScores';

describe('MethodologyScores Component', () => {
  it('should render component name', () => {
    render(<MethodologyScores signals={[]} />);
    expect(screen.getByText(/Methodology Scores/i)).toBeInTheDocument();
  });

  it('should show empty state message', () => {
    render(<MethodologyScores signals={[]} />);
    expect(screen.getByText(/No analysis signals available/i)).toBeInTheDocument();
  });

  it('should accept signals prop as empty array', () => {
    render(<MethodologyScores signals={[]} />);
    expect(screen.getByText(/Methodology Scores/i)).toBeInTheDocument();
  });

  it('should show empty state when no signals', () => {
    render(<MethodologyScores signals={[]} />);
    expect(screen.getByText(/No analysis signals available/i)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<MethodologyScores signals={[]} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });

  it('should accept signals array with items', () => {
    const signals = [
      { methodology: 'Wyckoff', score: 0.8 },
      { methodology: 'Elliott Wave', score: 0.6 },
    ];
    render(<MethodologyScores signals={signals} />);
    expect(screen.getByText(/Methodology Scores/i)).toBeInTheDocument();
  });
});
