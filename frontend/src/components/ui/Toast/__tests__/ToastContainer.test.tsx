import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ToastType } from '../Toast';
import ToastContainer from '../ToastContainer';

// Mock the Toast component
vi.mock('../Toast', () => ({
  default: ({ id, message, type, onClose }: any) => (
    <div data-testid={`toast-${id}`} data-type={type}>
      {message}
      <button onClick={() => onClose(id)}>Close</button>
    </div>
  ),
}));

// Mock CSS modules
vi.mock('../Toast.module.css', () => ({
  default: {
    toastContainer: 'toastContainer',
    topRight: 'topRight',
    bottomLeft: 'bottomLeft',
    toast: 'toast',
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'warning',
  },
}));

describe('ToastContainer Component', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} onClose={() => {}} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders toasts when provided', () => {
    const mockOnClose = vi.fn();
    const toasts = [
      {
        id: 'toast-1',
        message: 'Mensaje de prueba 1',
        type: 'success' as ToastType,
      },
      {
        id: 'toast-2',
        message: 'Mensaje de prueba 2',
        type: 'error' as ToastType,
      },
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    expect(screen.getByTestId('toast-toast-1')).toBeInTheDocument();
    expect(screen.getByTestId('toast-toast-2')).toBeInTheDocument();
  });

  it('always uses top-right position regardless of the position prop', () => {
    const mockOnClose = vi.fn();
    const toasts = [
      {
        id: 'toast-1',
        message: 'Mensaje de prueba',
        type: 'success' as ToastType,
      },
    ];

    // Try to render with a different position
    const { container } = render(
      <ToastContainer toasts={toasts} onClose={mockOnClose} position="bottom-left" />,
    );

    // The container should have the topRight class
    expect(container.firstChild).toHaveClass('topRight');
    expect(container.firstChild).not.toHaveClass('bottomLeft');
  });

  it('limits the number of toasts to maxToasts', () => {
    const mockOnClose = vi.fn();
    const toasts = [
      {
        id: 'toast-1',
        message: 'Mensaje de prueba 1',
        type: 'success' as ToastType,
      },
      {
        id: 'toast-2',
        message: 'Mensaje de prueba 2',
        type: 'error' as ToastType,
      },
      {
        id: 'toast-3',
        message: 'Mensaje de prueba 3',
        type: 'info' as ToastType,
      },
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} maxToasts={2} />);

    // Only the last 2 toasts should be rendered
    expect(screen.queryByTestId('toast-toast-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-toast-2')).toBeInTheDocument();
    expect(screen.getByTestId('toast-toast-3')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const mockOnClose = vi.fn();
    const toasts = [
      {
        id: 'toast-1',
        message: 'Mensaje de prueba',
        type: 'success' as ToastType,
      },
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    // The container should have the proper accessibility attributes
    const container = screen.getByRole('region', { name: 'Notificaciones' });
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-live', 'polite');
  });
});
