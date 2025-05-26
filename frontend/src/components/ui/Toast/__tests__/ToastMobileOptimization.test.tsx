import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Toast from '../Toast';
import ToastContainer from '../ToastContainer';

// Mock the Icon component
vi.mock('../../../../shared/components/ui/Icon', () => ({
  default: ({ IconComponent, className, color }: any) => {
    const Icon = IconComponent();
    return (
      <span className={className} style={{ color }}>
        {Icon}
      </span>
    );
  },
}));

// Mock the Button component
vi.mock('../../Button/Button', () => ({
  default: ({ children, onClick, icon, 'aria-label': ariaLabel, className }: any) => (
    <button onClick={onClick} aria-label={ariaLabel} className={className}>
      {icon && <span data-testid="icon">{icon}</span>}
      {children}
    </button>
  ),
}));

// Mock CSS modules
vi.mock('../Toast.module.css', () => ({
  default: {
    toastContainer: 'toastContainer',
    topRight: 'topRight',
    toast: 'toast',
    success: 'success',
    error: 'error',
    info: 'info',
    warning: 'warning',
    toastContent: 'toastContent',
    toastIconContainer: 'toastIconContainer',
    toastMessage: 'toastMessage',
    closeButton: 'closeButton',
    icon: 'icon',
    progressBar: 'progressBar',
  },
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaCheckCircle: () => <div data-testid="success-icon">Success Icon</div>,
  FaExclamationCircle: () => <div data-testid="error-icon">Error Icon</div>,
  FaInfoCircle: () => <div data-testid="info-icon">Info Icon</div>,
  FaExclamationTriangle: () => <div data-testid="warning-icon">Warning Icon</div>,
  FaTimes: () => <div data-testid="close-icon">×</div>,
}));

describe('Toast Mobile Optimization', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock window.matchMedia for testing media queries
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders toast with proper structure for mobile', () => {
    render(
      <Toast
        id="test-toast"
        message="Este es un mensaje de prueba que debería ajustarse correctamente en pantallas pequeñas"
        type="info"
        onClose={mockOnClose}
      />,
    );

    // Check that all elements are present
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Este es un mensaje de prueba que debería ajustarse correctamente en pantallas pequeñas',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('close-icon')).toBeInTheDocument();

    // Check that the close button has the correct class
    const closeButton = screen.getByRole('button', { name: /cerrar notificación/i });
    expect(closeButton).toHaveClass('closeButton');
  });

  it('renders toast with long text that should wrap properly', () => {
    render(
      <Toast
        id="test-toast-long"
        message="Este es un mensaje de prueba muy largo que debería ajustarse correctamente en pantallas pequeñas sin que el botón de cierre ocupe demasiado espacio. El texto debe fluir naturalmente en múltiples líneas."
        type="warning"
        onClose={mockOnClose}
      />,
    );

    // Check that the message is rendered
    expect(screen.getByText(/Este es un mensaje de prueba muy largo/)).toBeInTheDocument();
  });

  it('renders multiple toasts in container with proper spacing', () => {
    const toasts = [
      {
        id: 'toast1',
        message: 'Primer mensaje de notificación',
        type: 'success' as const,
      },
      {
        id: 'toast2',
        message: 'Segundo mensaje de notificación con texto más largo para probar el ajuste',
        type: 'error' as const,
      },
    ];

    render(<ToastContainer toasts={toasts} onClose={mockOnClose} />);

    // Check that both toasts are rendered
    expect(screen.getByText('Primer mensaje de notificación')).toBeInTheDocument();
    expect(
      screen.getByText('Segundo mensaje de notificación con texto más largo para probar el ajuste'),
    ).toBeInTheDocument();

    // Check that the container has the correct class
    const container = screen.getByRole('region', { name: /notificaciones/i });
    expect(container).toHaveClass('toastContainer');
  });
});
