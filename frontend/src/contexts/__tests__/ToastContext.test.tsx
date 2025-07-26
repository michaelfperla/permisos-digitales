import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ToastType } from '../../components/ui/Toast';
import { ToastProvider } from '../../shared/contexts/ToastContext';
import { useToast } from '../../shared/hooks/useToast';

// Mock the ToastContainer component
vi.mock('../../components/ui/Toast', () => {
  const originalModule = vi.importActual('../../components/ui/Toast');
  return {
    ...originalModule,
    ToastContainer: ({ toasts, onClose, position }: any) => (
      <div data-testid="toast-container" data-position={position}>
        {toasts.map((toast: any) => (
          <div
            key={toast.id}
            data-testid={`toast-${toast.id}`}
            data-type={toast.type}
            data-duration={toast.duration}
          >
            {toast.message}
            <button onClick={() => onClose(toast.id)}>Close</button>
          </div>
        ))}
      </div>
    ),
  };
});

// Test component that uses the toast context
const TestComponent = ({
  message = 'Test message',
  type = 'info' as ToastType,
  duration,
  action,
}: {
  message?: string;
  type?: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}) => {
  const { showToast, hideToast: _hideToast, setPosition, position } = useToast();

  return (
    <div>
      <button
        onClick={() => showToast(message, type, duration ? { duration } : undefined)}
        data-testid="show-toast-button"
      >
        Show Toast
      </button>
      <button
        onClick={() => showToast(message, type, { action })}
        data-testid="show-toast-with-action-button"
      >
        Show Toast with Action
      </button>
      <button onClick={() => setPosition('bottom-left')} data-testid="set-position-button">
        Set Position
      </button>
      <div data-testid="position-value">{position}</div>
    </div>
  );
};

describe('ToastContext', () => {
  // Mock console.warn to test the setPosition warning
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  it('provides the toast context to children', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    expect(screen.getByTestId('show-toast-button')).toBeInTheDocument();
    expect(screen.getByTestId('position-value').textContent).toBe('top-right');
  });

  it('shows a toast with the standardized duration when showToast is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    // Click the button to show a toast
    act(() => {
      screen.getByTestId('show-toast-button').click();
    });

    // A toast should be rendered with the standardized duration (3300ms)
    // Use getAllByTestId and filter to get only the actual toast elements (not buttons)
    const toastElements = screen
      .getAllByTestId(/toast-/)
      .filter((el) => el.hasAttribute('data-type') && el.hasAttribute('data-duration'));
    expect(toastElements.length).toBe(1);
    const toast = toastElements[0];
    expect(toast).toBeInTheDocument();
    expect(toast.getAttribute('data-duration')).toBe('3300');
  });

  it('ignores custom duration and always uses the standardized duration', () => {
    render(
      <ToastProvider>
        <TestComponent duration={10000} />
      </ToastProvider>,
    );

    // Click the button to show a toast with a custom duration
    act(() => {
      screen.getByTestId('show-toast-button').click();
    });

    // The toast should still use the standardized duration (3300ms)
    // Use getAllByTestId and filter to get only the actual toast elements (not buttons)
    const toastElements = screen
      .getAllByTestId(/toast-/)
      .filter((el) => el.hasAttribute('data-type') && el.hasAttribute('data-duration'));
    expect(toastElements.length).toBe(1);
    const toast = toastElements[0];
    expect(toast).toBeInTheDocument();
    expect(toast.getAttribute('data-duration')).toBe('3300');
  });

  it('always uses top-right position and ignores setPosition calls', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    // The initial position should be top-right
    expect(screen.getByTestId('position-value').textContent).toBe('top-right');

    // The toast container should have the top-right position
    expect(screen.getByTestId('toast-container').getAttribute('data-position')).toBe('top-right');

    // Try to change the position
    act(() => {
      screen.getByTestId('set-position-button').click();
    });

    // The position should still be top-right
    expect(screen.getByTestId('position-value').textContent).toBe('top-right');

    // The toast container should still have the top-right position
    expect(screen.getByTestId('toast-container').getAttribute('data-position')).toBe('top-right');

    // A warning should have been logged
    expect(console.warn).toHaveBeenCalledWith(
      'setPosition está obsoleto. Las notificaciones siempre aparecerán en la esquina superior derecha.',
    );
  });
});
