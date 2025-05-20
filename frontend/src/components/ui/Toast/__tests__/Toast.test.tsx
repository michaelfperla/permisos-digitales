import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from '../Toast';
import { ToastType } from '../Toast';

// Mock the Button component
vi.mock('../../Button/Button', () => ({
  default: ({ children, onClick, icon, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {icon && <span data-testid="icon">{icon}</span>}
      {children}
    </button>
  ),
}));

// Mock CSS modules
vi.mock('../Toast.module.css', () => ({
  default: {
    toast: 'toast',
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'warning',
    toastExiting: 'toastExiting',
    toastContent: 'toastContent',
    toastIconContainer: 'toastIconContainer',
    toastMessage: 'toastMessage',
    closeButton: 'closeButton',
    toastAction: 'toastAction',
    actionButton: 'actionButton',
    progressBar: 'progressBar',
    paused: 'paused',
    toastSwiping: 'toastSwiping',
  }
}));

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with the correct message and type', () => {
    const mockOnClose = vi.fn();

    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Mensaje de prueba')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('success');
  });

  it('uses the standardized duration of 3300ms', () => {
    const mockOnClose = vi.fn();

    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={mockOnClose}
        // Attempt to set a different duration, which should be ignored
        duration={5000}
      />
    );

    // Advance timer by 3300ms (standardized duration)
    act(() => {
      vi.advanceTimersByTime(3300);
    });

    // The toast should not have closed yet (it needs the animation time)
    expect(mockOnClose).not.toHaveBeenCalled();

    // Advance timer by the animation time (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now the toast should have closed
    expect(mockOnClose).toHaveBeenCalledWith('test-toast');
  });

  it('closes when the close button is clicked', () => {
    const mockOnClose = vi.fn();

    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={mockOnClose}
      />
    );

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: /Cerrar notificación/i });
    fireEvent.click(closeButton);

    // The toast should start exiting (animation)
    expect(screen.getByRole('alert')).toHaveClass('toastExiting');

    // Advance timer by the animation time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The onClose callback should have been called
    expect(mockOnClose).toHaveBeenCalledWith('test-toast');
  });

  it('pauses the timer when mouse enters', () => {
    const mockOnClose = vi.fn();

    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={mockOnClose}
      />
    );

    // Advance timer by 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Simulate mouse enter
    fireEvent.mouseEnter(screen.getByRole('alert'));

    // Advance timer by the full duration (3300ms)
    act(() => {
      vi.advanceTimersByTime(3300);
    });

    // The toast should not have closed because the timer was paused
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('renders action button when action is provided', () => {
    const mockOnClose = vi.fn();
    const mockActionClick = vi.fn();

    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={mockOnClose}
        action={{
          label: 'Acción',
          onClick: mockActionClick
        }}
      />
    );

    // Find and click the action button
    const actionButton = screen.getByRole('button', { name: /Acción para esta notificación/i });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);

    // The action callback should have been called
    expect(mockActionClick).toHaveBeenCalled();
  });
});
