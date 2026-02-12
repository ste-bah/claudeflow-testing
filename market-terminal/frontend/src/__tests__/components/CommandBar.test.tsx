import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandBar from '../../components/CommandBar';

describe('CommandBar Component', () => {
  it('should render component name', () => {
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    expect(screen.getByPlaceholderText('Enter command or ticker...')).toBeInTheDocument();
  });

  it('should render input field', () => {
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('should render prompt symbol', () => {
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    expect(screen.getByText('>')).toBeInTheDocument();
  });

  it('should call onCommand when Enter is pressed', async () => {
    const user = userEvent.setup();
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'AAPL{Enter}');

    expect(mockOnCommand).toHaveBeenCalledWith('AAPL');
    expect(mockOnCommand).toHaveBeenCalledTimes(1);
  });

  it('should clear input after Enter is pressed', async () => {
    const user = userEvent.setup();
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...') as HTMLInputElement;
    await user.type(input, 'MSFT{Enter}');

    expect(input.value).toBe('');
  });

  it('should not call onCommand for other keys', async () => {
    const user = userEvent.setup();
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');
    await user.type(input, 'TEST');

    expect(mockOnCommand).not.toHaveBeenCalled();
  });

  it('should allow typing in input field', async () => {
    const user = userEvent.setup();
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...') as HTMLInputElement;
    await user.type(input, 'GOOGL');

    expect(input.value).toBe('GOOGL');
  });

  it('should handle multiple commands in sequence', async () => {
    const user = userEvent.setup();
    const mockOnCommand = vi.fn();
    render(<CommandBar onCommand={mockOnCommand} />);

    const input = screen.getByPlaceholderText('Enter command or ticker...');

    await user.type(input, 'AAPL{Enter}');
    await user.type(input, 'MSFT{Enter}');
    await user.type(input, 'GOOGL{Enter}');

    expect(mockOnCommand).toHaveBeenCalledTimes(3);
    expect(mockOnCommand).toHaveBeenNthCalledWith(1, 'AAPL');
    expect(mockOnCommand).toHaveBeenNthCalledWith(2, 'MSFT');
    expect(mockOnCommand).toHaveBeenNthCalledWith(3, 'GOOGL');
  });

  it('should have proper styling classes', () => {
    const mockOnCommand = vi.fn();
    const { container } = render(<CommandBar onCommand={mockOnCommand} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-terminal-panel', 'border', 'border-terminal-border', 'rounded');
  });
});
