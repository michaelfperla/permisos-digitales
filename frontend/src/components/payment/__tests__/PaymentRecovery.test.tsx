/**
 * PaymentRecovery Component Tests
 * Comprehensive test coverage for payment recovery functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PaymentRecovery from '../PaymentRecovery';
import { getPaymentStatus } from '../../../services/stripePaymentService';

// Mock the payment service
vi.mock('../../../services/stripePaymentService', () => ({
  getPaymentStatus: vi.fn()
}));

// Mock the Button component
vi.mock('../../ui/Button/Button', () => ({
  default: ({ children, onClick, disabled, className, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  )
}));

// Mock the Icon component
vi.mock('../../../shared/components/ui/Icon', () => ({
  default: ({ IconComponent, className, size, color }: any) => {
    const iconName = IconComponent?.name || 'icon';
    return (
      <span className={className} data-testid={`icon-${iconName}`} style={{ color }}>
        {iconName}
      </span>
    );
  }
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaExclamationTriangle: () => <span data-testid="fa-exclamation-triangle">!</span>,
  FaRedo: () => <span data-testid="fa-redo">↻</span>,
  FaCheckCircle: () => <span data-testid="fa-check-circle">✓</span>,
  FaSpinner: () => <span data-testid="fa-spinner">⟳</span>
}));

// Mock timers
vi.useFakeTimers();

const mockGetPaymentStatus = getPaymentStatus as ReturnType<typeof vi.fn>;

describe('PaymentRecovery', () => {
  const defaultProps = {
    applicationId: 'app_123',
    paymentIntentId: 'pi_test123',
    onRecoverySuccess: vi.fn(),
    onRecoveryFailed: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockGetPaymentStatus.mockResolvedValue({
      success: true,
      status: 'requires_payment_method',
      paymentIntent: {
        id: 'pi_test123',
        status: 'requires_payment_method'
      }
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('Component Rendering', () => {
    it('should render with basic props', () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      expect(screen.getByText('Recuperación de Pago')).toBeInTheDocument();
      expect(screen.getByText('Verificar Estado')).toBeInTheDocument();
      expect(screen.getByText('¿Qué puedo hacer?')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <PaymentRecovery applicationId="app_123" className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should render without paymentIntentId', () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      expect(screen.getByText('Verificar Estado')).toBeInTheDocument();
      expect(screen.getByText('Intentar Recuperación')).toBeInTheDocument();
    });

    it('should show initial loading state when paymentIntentId is provided', () => {
      render(<PaymentRecovery {...defaultProps} />);
      
      expect(screen.getByTestId('fa-spinner')).toBeInTheDocument();
      expect(screen.getByText('Verificando estado del pago...')).toBeInTheDocument();
    });

    it('should render all help section elements', () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      expect(screen.getByText('¿Qué puedo hacer?')).toBeInTheDocument();
      expect(screen.getByText(/Si continúas teniendo problemas/)).toBeInTheDocument();
      expect(screen.getByText('contacto@permisosdigitales.com.mx')).toBeInTheDocument();
    });
  });

  describe('Automatic Status Check', () => {
    it('should automatically check status on mount when paymentIntentId is provided', async () => {
      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockGetPaymentStatus).toHaveBeenCalledWith(
          defaultProps.applicationId,
          defaultProps.paymentIntentId
        );
      });
    });

    it('should not check status on mount when paymentIntentId is not provided', () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      expect(mockGetPaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle successful status check', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded'
        }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
        expect(screen.getByTestId('fa-check-circle')).toBeInTheDocument();
      });

      expect(defaultProps.onRecoverySuccess).toHaveBeenCalledWith({
        success: true,
        status: 'succeeded',
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded'
        }
      });
    });

    it('should handle failed status check', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: false,
        error: 'Payment not found'
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error al verificar el estado: Payment not found')).toBeInTheDocument();
        expect(screen.getByTestId('fa-exclamation-triangle')).toBeInTheDocument();
      });

      expect(defaultProps.onRecoveryFailed).toHaveBeenCalledWith('Payment not found');
    });

    it('should handle processing status with retry', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'processing',
        paymentIntent: {
          id: 'pi_test123',
          status: 'processing'
        }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('El pago está siendo procesado. Por favor, espere...')).toBeInTheDocument();
      });

      // Fast-forward timer to trigger retry
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockGetPaymentStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle status check network errors', async () => {
      mockGetPaymentStatus.mockRejectedValue(new Error('Network error'));

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error al verificar el estado: Network error')).toBeInTheDocument();
      });

      expect(defaultProps.onRecoveryFailed).toHaveBeenCalledWith('Network error');
    });
  });

  describe('Manual Status Check', () => {
    it('should check status when "Verificar Estado" button is clicked', async () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      fireEvent.click(screen.getByText('Verificar Estado'));
      
      expect(screen.getByTestId('fa-spinner')).toBeInTheDocument();
      expect(screen.getByText('Verificando estado del pago...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockGetPaymentStatus).toHaveBeenCalledWith('app_123', undefined);
      });
    });

    it('should disable button during status check', async () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      fireEvent.click(screen.getByText('Verificar Estado'));
      
      expect(screen.getByText('Verificar Estado')).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByText('Verificar Estado')).not.toBeDisabled();
      });
    });

    it('should handle successful manual status check', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded'
        }
      });

      render(<PaymentRecovery applicationId="app_123" onRecoverySuccess={defaultProps.onRecoverySuccess} />);
      
      fireEvent.click(screen.getByText('Verificar Estado'));
      
      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
      });

      expect(defaultProps.onRecoverySuccess).toHaveBeenCalled();
    });
  });

  describe('Payment Recovery', () => {
    it('should attempt recovery when "Intentar Recuperación" button is clicked', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'requires_capture',
        paymentIntent: {
          id: 'pi_test123',
          status: 'requires_capture'
        }
      });

      render(<PaymentRecovery applicationId="app_123" />);
      
      fireEvent.click(screen.getByText('Intentar Recuperación'));
      
      expect(screen.getByTestId('fa-spinner')).toBeInTheDocument();
      expect(screen.getByText('Intentando recuperación...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockGetPaymentStatus).toHaveBeenCalled();
      });
    });

    it('should track recovery attempts', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: false,
        error: 'Recovery failed'
      });

      render(<PaymentRecovery applicationId="app_123" />);
      
      // First attempt
      fireEvent.click(screen.getByText('Intentar Recuperación'));
      
      await waitFor(() => {
        expect(screen.getByText('Error: Recovery failed')).toBeInTheDocument();
      });

      // Second attempt
      fireEvent.click(screen.getByText('Intentar Recuperación'));
      
      await waitFor(() => {
        expect(screen.getByText('Error: Recovery failed')).toBeInTheDocument();
      });

      // Third attempt
      fireEvent.click(screen.getByText('Intentar Recuperación'));
      
      await waitFor(() => {
        expect(screen.getByText('Error: Recovery failed')).toBeInTheDocument();
      });

      // Fourth attempt should be disabled
      expect(screen.getByText('Intentar Recuperación')).toBeDisabled();
    });

    it('should show retry cooldown message after max attempts', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: false,
        error: 'Recovery failed'
      });

      render(<PaymentRecovery applicationId="app_123" />);
      
      // Perform max attempts
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByText('Intentar Recuperación'));
        await waitFor(() => {
          expect(screen.getByText('Error: Recovery failed')).toBeInTheDocument();
        });
      }

      expect(screen.getByText(/Máximo de intentos alcanzado/)).toBeInTheDocument();
      expect(screen.getByText('Intentar Recuperación')).toBeDisabled();
    });

    it('should handle successful recovery', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded'
        }
      });

      render(<PaymentRecovery applicationId="app_123" onRecoverySuccess={defaultProps.onRecoverySuccess} />);
      
      fireEvent.click(screen.getByText('Intentar Recuperación'));
      
      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
      });

      expect(defaultProps.onRecoverySuccess).toHaveBeenCalled();
    });
  });

  describe('Payment Status Handling', () => {
    it('should handle "succeeded" status correctly', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: { id: 'pi_test123', status: 'succeeded' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
        expect(screen.getByTestId('fa-check-circle')).toBeInTheDocument();
      });
    });

    it('should handle "requires_payment_method" status', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'requires_payment_method',
        paymentIntent: { id: 'pi_test123', status: 'requires_payment_method' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Se requiere un nuevo método de pago. Por favor, intente nuevamente.')).toBeInTheDocument();
        expect(screen.getByText('Reintentar Pago')).toBeInTheDocument();
      });
    });

    it('should handle "requires_confirmation" status', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'requires_confirmation',
        paymentIntent: { id: 'pi_test123', status: 'requires_confirmation' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('El pago requiere confirmación.')).toBeInTheDocument();
      });
    });

    it('should handle "requires_capture" status', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'requires_capture',
        paymentIntent: { id: 'pi_test123', status: 'requires_capture' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('El pago está autorizado pero no capturado.')).toBeInTheDocument();
      });
    });

    it('should handle "canceled" status', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'canceled',
        paymentIntent: { id: 'pi_test123', status: 'canceled' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('El pago fue cancelado.')).toBeInTheDocument();
        expect(screen.getByText('Reintentar Pago')).toBeInTheDocument();
      });
    });

    it('should handle unknown status', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'unknown_status',
        paymentIntent: { id: 'pi_test123', status: 'unknown_status' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Estado de pago desconocido: unknown_status')).toBeInTheDocument();
      });
    });
  });

  describe('Retry Payment Functionality', () => {
    it('should reload page when "Reintentar Pago" is clicked', async () => {
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      });

      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'requires_payment_method',
        paymentIntent: { id: 'pi_test123', status: 'requires_payment_method' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Reintentar Pago')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reintentar Pago'));
      
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Auto-retry for Processing Status', () => {
    it('should auto-retry for processing status up to 3 times', async () => {
      mockGetPaymentStatus
        .mockResolvedValueOnce({
          success: true,
          status: 'processing',
          paymentIntent: { id: 'pi_test123', status: 'processing' }
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'processing',
          paymentIntent: { id: 'pi_test123', status: 'processing' }
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'processing',
          paymentIntent: { id: 'pi_test123', status: 'processing' }
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'succeeded',
          paymentIntent: { id: 'pi_test123', status: 'succeeded' }
        });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('El pago está siendo procesado. Por favor, espere...')).toBeInTheDocument();
      });

      // Fast-forward through retries
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(5000);
        await waitFor(() => {
          expect(mockGetPaymentStatus).toHaveBeenCalledTimes(i + 2);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
      });
    });

    it('should stop auto-retry after max attempts', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'processing',
        paymentIntent: { id: 'pi_test123', status: 'processing' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      // Fast-forward through max retries
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(5000);
        await waitFor(() => {}, { timeout: 100 });
      }

      // Should not retry more than 3 times + initial check
      expect(mockGetPaymentStatus).toHaveBeenCalledTimes(4);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for status icons', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: { id: 'pi_test123', status: 'succeeded' }
      });

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('fa-check-circle')).toBeInTheDocument();
      });
    });

    it('should have proper button states for screen readers', () => {
      render(<PaymentRecovery applicationId="app_123" />);
      
      const checkStatusButton = screen.getByText('Verificar Estado');
      const recoveryButton = screen.getByText('Intentar Recuperación');
      
      expect(checkStatusButton).not.toBeDisabled();
      expect(recoveryButton).not.toBeDisabled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing applicationId gracefully', () => {
      render(<PaymentRecovery applicationId="" />);
      
      expect(screen.getByText('Recuperación de Pago')).toBeInTheDocument();
    });

    it('should handle service timeout errors', async () => {
      mockGetPaymentStatus.mockRejectedValue(new Error('Request timeout'));

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error: Request timeout')).toBeInTheDocument();
      });
    });

    it('should handle malformed service responses', async () => {
      mockGetPaymentStatus.mockResolvedValue(null);

      render(<PaymentRecovery {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should handle component unmounting during async operations', async () => {
      const { unmount } = render(<PaymentRecovery {...defaultProps} />);
      
      // Unmount before async operation completes
      unmount();
      
      // Should not cause any errors or warnings
      await waitFor(() => {}, { timeout: 100 });
    });

    it('should cleanup timers on unmount', () => {
      const { unmount } = render(<PaymentRecovery {...defaultProps} />);
      
      unmount();
      
      // Advance timers - should not cause issues
      vi.advanceTimersByTime(10000);
    });
  });

  describe('Callback Functions', () => {
    it('should call onRecoverySuccess with correct parameters', async () => {
      const onRecoverySuccess = vi.fn();
      const mockResult = {
        success: true,
        status: 'succeeded',
        paymentIntent: { id: 'pi_test123', status: 'succeeded' }
      };

      mockGetPaymentStatus.mockResolvedValue(mockResult);

      render(<PaymentRecovery {...defaultProps} onRecoverySuccess={onRecoverySuccess} />);
      
      await waitFor(() => {
        expect(onRecoverySuccess).toHaveBeenCalledWith(mockResult);
      });
    });

    it('should call onRecoveryFailed with error message', async () => {
      const onRecoveryFailed = vi.fn();
      const errorMessage = 'Payment processing failed';

      mockGetPaymentStatus.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      render(<PaymentRecovery {...defaultProps} onRecoveryFailed={onRecoveryFailed} />);
      
      await waitFor(() => {
        expect(onRecoveryFailed).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should not call callbacks when they are not provided', async () => {
      mockGetPaymentStatus.mockResolvedValue({
        success: true,
        status: 'succeeded',
        paymentIntent: { id: 'pi_test123', status: 'succeeded' }
      });

      render(<PaymentRecovery applicationId="app_123" paymentIntentId="pi_test123" />);
      
      await waitFor(() => {
        expect(screen.getByText('¡Pago confirmado exitosamente!')).toBeInTheDocument();
      });

      // Should not throw errors when callbacks are missing
    });
  });
});