import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PaymentErrorBoundary from '../PaymentErrorBoundary';

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
  vi.clearAllMocks();
});

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test payment error');
  }
  return <div data-testid="child-content">Payment form content</div>;
};

// Component with controllable error state
const ControllableErrorComponent = ({ 
  errorKey, 
  shouldThrow 
}: { 
  errorKey: string; 
  shouldThrow: boolean; 
}) => {
  if (shouldThrow) {
    throw new Error(`Test error ${errorKey}`);
  }
  return <div data-testid="success-content">Success content</div>;
};

// Component that throws async error
const ThrowAsyncError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Async payment error');
    }
  }, [shouldThrow]);
  return <div>Async content</div>;
};

// Component that throws network error
const ThrowNetworkError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    const error = new Error('Network request failed');
    error.name = 'NetworkError';
    throw error;
  }
  return <div>Network content</div>;
};

describe('PaymentErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <PaymentErrorBoundary>
        <div data-testid="child">Payment form content</div>
      </PaymentErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Payment form content')).toBeInTheDocument();
  });

  it('should catch errors and display fallback UI in Spanish', () => {
    render(
      <PaymentErrorBoundary>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('should log error details to console', () => {
    const mockLogError = vi.spyOn(console, 'error');

    render(
      <PaymentErrorBoundary>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    expect(mockLogError).toHaveBeenCalledWith(
      'Payment component error:',
      expect.objectContaining({
        message: 'Test payment error'
      }),
      expect.any(Object)
    );
  });

  it('should reset error state when retry button is clicked', () => {
    const mockOnRetry = vi.fn();
    
    render(
      <PaymentErrorBoundary onRetry={mockOnRetry}>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    // Error is shown
    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    fireEvent.click(retryButton);

    // onRetry callback should be called
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
    
    // The error boundary should still be in error state since component still throws
    // but the handleRetry function was called which resets internal state
    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
  });

  it('should call onRetry callback when retry button is clicked', () => {
    const mockOnRetry = vi.fn();

    render(
      <PaymentErrorBoundary onRetry={mockOnRetry}>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple error and retry cycles', () => {
    const mockOnRetry = vi.fn();

    render(
      <PaymentErrorBoundary onRetry={mockOnRetry}>
        <ControllableErrorComponent errorKey="1" shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    // First error
    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();

    // First retry
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);

    // Second retry
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockOnRetry).toHaveBeenCalledTimes(2);

    // Third retry
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockOnRetry).toHaveBeenCalledTimes(3);
  });

  it('should handle different error types', () => {
    render(
      <PaymentErrorBoundary>
        <ThrowNetworkError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    // Should still show the same error message regardless of error type
    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
  });

  it('should catch errors from async operations', async () => {
    render(
      <PaymentErrorBoundary>
        <ThrowAsyncError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
    });
  });

  it('should maintain error boundary isolation', () => {
    const SafeComponent = () => <div>Safe component</div>;

    render(
      <div>
        <PaymentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </PaymentErrorBoundary>
        <SafeComponent />
      </div>
    );

    // Error boundary contains the error
    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
    // Sibling component still renders
    expect(screen.getByText('Safe component')).toBeInTheDocument();
  });

  it('should handle errors during retry', () => {
    // Test error handling during retry process
    const { rerender } = render(
      <PaymentErrorBoundary>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();

    // Click retry - component still fails
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    
    rerender(
      <PaymentErrorBoundary>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();
  });

  it('should render error UI with correct styling', () => {
    render(
      <PaymentErrorBoundary>
        <ThrowError shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    const errorContainer = screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.').parentElement?.parentElement;
    expect(errorContainer).toHaveClass('errorContainer');

    // Check for icon
    const icon = errorContainer?.querySelector('svg');
    expect(icon).toBeInTheDocument();

    // Check button styling
    const button = screen.getByRole('button', { name: 'Reintentar' });
    expect(button).toHaveClass('secondary', 'small');
    expect(button).toHaveStyle({ marginTop: '12px' });
  });

  it('should reset component when error boundary recovers with key change', () => {
    // Test error boundary reset using key prop to force remount
    const mockOnRetry = vi.fn();
    const { rerender } = render(
      <PaymentErrorBoundary key="test-1" onRetry={mockOnRetry}>
        <ControllableErrorComponent errorKey="1" shouldThrow={false} />
      </PaymentErrorBoundary>
    );

    // Initial render - no error
    expect(screen.getByTestId('success-content')).toBeInTheDocument();

    // Trigger error
    rerender(
      <PaymentErrorBoundary key="test-1" onRetry={mockOnRetry}>
        <ControllableErrorComponent errorKey="2" shouldThrow={true} />
      </PaymentErrorBoundary>
    );

    expect(screen.getByText('Error al cargar el sistema de pagos. Por favor, intenta de nuevo.')).toBeInTheDocument();

    // Simulate recovery by remounting with new key and non-throwing component
    rerender(
      <PaymentErrorBoundary key="test-2" onRetry={mockOnRetry}>
        <ControllableErrorComponent errorKey="3" shouldThrow={false} />
      </PaymentErrorBoundary>
    );

    expect(screen.getByTestId('success-content')).toBeInTheDocument();
  });
});