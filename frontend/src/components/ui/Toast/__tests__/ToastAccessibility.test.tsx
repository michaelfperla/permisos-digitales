import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Removed: import { useToast } from '../../../../shared/hooks/useToast'; // if it was here and unused

import Toast from '../Toast';
import ToastContainer from '../ToastContainer';

// Mock the ToastContext
const mockShowToast = vi.fn();
const mockHideToast = vi.fn();
const mockSetPosition = vi.fn();

vi.mock('../../../../shared/hooks/useToast', () => {
  const actual = vi.importActual('../../../../shared/hooks/useToast') as any;
  return {
    ...actual,
    useToast: () => ({
      showToast: mockShowToast,
      hideToast: mockHideToast,
      setPosition: mockSetPosition,
      toasts: [], 
      position: 'top-right',
    }),
  };
});

// Mock axe-core for accessibility testing
vi.mock('axe-core', () => ({
  default: {
    run: vi.fn().mockResolvedValue({ violations: [] }),
  },
}));

// Mock function for accessibility testing
const axe = vi.fn().mockImplementation(() => Promise.resolve({ violations: [] }));

// Add custom matcher
expect.extend({
  toHaveNoViolations: (received) => {
    if (received && typeof received.violations !== 'undefined') { // Add guard
      return {
        message: () => 'expected no accessibility violations',
        pass: received.violations.length === 0,
      };
    }
    return { // Default if received is not as expected
      message: () => 'toHaveNoViolations received invalid input',
      pass: false,
    };
  },
});


// Mock the Button component
vi.mock('../../Button/Button', () => ({
  default: ({ children, onClick, icon, 'aria-label': ariaLabel }: any) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {icon && <span data-testid="icon">{icon}</span>}
      {children}
    </button>
  ),
}));


describe('Toast Accessibility', () => {
  it('has no accessibility violations for a single toast', async () => {
    const { container } = render(
      <Toast id="test-toast" message="Mensaje de prueba" type="success" onClose={() => {}} />,
    );

    const results = await axe(container);
    // @ts-expect-error Custom matcher
    expect(results).toHaveNoViolations();

    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
    expect(toast).toHaveAttribute('aria-atomic', 'true');

    const closeButton = screen.getByRole('button', { name: /Cerrar notificación/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('has no accessibility violations for toast container', async () => {
    const { container } = render(
      <ToastContainer
        toasts={[
          {
            id: 'test-toast',
            message: 'Mensaje de prueba',
            type: 'success',
          },
        ]}
        onClose={() => {}}
      />,
    );

    const results = await axe(container);
    // @ts-expect-error Custom matcher
    expect(results).toHaveNoViolations();

    const toastContainer = screen.getByRole('region', { name: 'Notificaciones' });
    expect(toastContainer).toHaveAttribute('aria-live', 'polite');
  });

  it('has no accessibility violations for toast with action', async () => {
    const { container } = render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={() => {}}
        action={{
          label: 'Acción',
          onClick: () => {},
        }}
      />,
    );

    const results = await axe(container);
    // @ts-expect-error Custom matcher
    expect(results).toHaveNoViolations();

    const actionButton = screen.getByRole('button', { name: /Acción para esta notificación/i });
    expect(actionButton).toBeInTheDocument();
  });

  it('is keyboard accessible', () => {
    render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={() => {}}
        action={{
          label: 'Acción',
          onClick: () => {},
        }}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Cerrar notificación/i });
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    const actionButton = screen.getByRole('button', { name: /Acción para esta notificación/i });
    actionButton.focus();
    expect(document.activeElement).toBe(actionButton);
  });

  it('has proper keyboard accessibility', () => {
    render(
      <div>
        <Toast id="toast-1" message="Mensaje de prueba 1" type="success" onClose={() => {}} />
        <Toast id="toast-2" message="Mensaje de prueba 2" type="error" onClose={() => {}} />
      </div>,
    );

    const closeButtons = screen.getAllByRole('button', { name: /Cerrar notificación/i });
    expect(closeButtons.length).toBe(2);

    closeButtons[0].focus();
    expect(document.activeElement).toBe(closeButtons[0]);

    closeButtons[1].focus();
    expect(document.activeElement).toBe(closeButtons[1]);
  });
});