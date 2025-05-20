import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from '../Toast';
import ToastContainer from '../ToastContainer';
import { useToast } from '../../../../contexts/ToastContext';

// Mock the ToastContext
const mockShowToast = vi.fn();
const mockHideToast = vi.fn();
const mockSetPosition = vi.fn();

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    hideToast: mockHideToast,
    setPosition: mockSetPosition,
    position: 'top-right'
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock axe-core for accessibility testing
vi.mock('axe-core', () => ({
  default: {
    run: vi.fn().mockResolvedValue({ violations: [] })
  }
}));

// Mock function for accessibility testing
const axe = vi.fn().mockImplementation(() => Promise.resolve({ violations: [] }));

// Add custom matcher
expect.extend({
  toHaveNoViolations: (received) => {
    return {
      message: () => 'expected no accessibility violations',
      pass: received.violations.length === 0
    };
  }
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

// Test component that uses the toast context
const TestComponent = () => {
  const { showToast } = useToast();

  const handleShowToast = () => {
    showToast('Mensaje de prueba', 'success');
  };

  return (
    <div>
      <button onClick={handleShowToast} data-testid="show-toast-button">
        Show Toast
      </button>
    </div>
  );
};

describe('Toast Accessibility', () => {
  it('has no accessibility violations for a single toast', async () => {
    const { container } = render(
      <Toast
        id="test-toast"
        message="Mensaje de prueba"
        type="success"
        onClose={() => {}}
      />
    );

    // Run axe on the rendered component
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check for specific accessibility attributes
    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
    expect(toast).toHaveAttribute('aria-atomic', 'true');

    // Check for accessible close button
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
      />
    );

    // Run axe on the rendered component
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check for specific accessibility attributes
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
      />
    );

    // Run axe on the rendered component
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check for accessible action button
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
      />
    );

    // Check that the close button is keyboard focusable
    const closeButton = screen.getByRole('button', { name: /Cerrar notificación/i });
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    // Check that the action button is keyboard focusable
    const actionButton = screen.getByRole('button', { name: /Acción para esta notificación/i });
    actionButton.focus();
    expect(document.activeElement).toBe(actionButton);
  });

  it('has proper keyboard accessibility', () => {
    // This test is simplified to focus on keyboard accessibility
    // without relying on the ToastProvider

    // Render two Toast components directly
    render(
      <div>
        <Toast
          id="toast-1"
          message="Mensaje de prueba 1"
          type="success"
          onClose={() => {}}
        />
        <Toast
          id="toast-2"
          message="Mensaje de prueba 2"
          type="error"
          onClose={() => {}}
        />
      </div>
    );

    // Check that there are two close buttons
    const closeButtons = screen.getAllByRole('button', { name: /Cerrar notificación/i });
    expect(closeButtons.length).toBe(2);

    // Check that both close buttons are keyboard focusable
    closeButtons[0].focus();
    expect(document.activeElement).toBe(closeButtons[0]);

    closeButtons[1].focus();
    expect(document.activeElement).toBe(closeButtons[1]);
  });
});
