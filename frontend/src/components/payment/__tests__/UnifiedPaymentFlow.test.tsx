import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import UnifiedPaymentFlow from '../UnifiedPaymentFlow';

// Mock dependencies
vi.mock('../../contexts/StripeContext', () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-provider">{children}</div>
}));

vi.mock('../../services/stripePaymentService', () => ({
  createPaymentIntent: vi.fn(),
  createOxxoPayment: vi.fn(),
}));

vi.mock('../SecurePaymentElement', () => ({
  default: ({ clientSecret, onPaymentSuccess, onPaymentError, isSubmitting }: any) => (
    <div data-testid="secure-payment-element">
      <div>Client Secret: {clientSecret}</div>
      <div>Submitting: {isSubmitting.toString()}</div>
      <button 
        data-testid="mock-payment-success"
        onClick={() => onPaymentSuccess({ id: 'pi_test123' })}
      >
        Mock Success
      </button>
      <button 
        data-testid="mock-payment-error"
        onClick={() => onPaymentError('Mock payment error')}
      >
        Mock Error
      </button>
    </div>
  )
}));

vi.mock('./PaymentErrorBoundary', () => ({
  default: ({ children, onRetry }: { children: React.ReactNode, onRetry: () => void }) => (
    <div data-testid="payment-error-boundary">
      {children}
      <button data-testid="error-boundary-retry" onClick={onRetry}>Retry</button>
    </div>
  )
}));

vi.mock('../../shared/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}));

// Mock UI components
vi.mock('../../shared/components/ui/Icon', () => ({
  default: ({ IconComponent, className, size, ...props }: any) => (
    <span 
      data-testid="icon" 
      className={className} 
      data-size={size}
      data-icon={IconComponent?.name}
      {...props}
    >
      {IconComponent?.name}
    </span>
  )
}));

vi.mock('../../ui/Button/Button', () => ({
  default: ({ children, disabled, variant, size, onClick, icon, iconAfter, ...props }: any) => (
    <button
      data-testid="button"
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      onClick={onClick}
      data-icon-after={iconAfter}
      {...props}
    >
      {icon && <span data-testid="button-icon">{icon}</span>}
      {children}
      {iconAfter && icon && <span data-testid="button-icon-after">{icon}</span>}
    </button>
  )
}));

vi.mock('../../ui/Alert/Alert', () => ({
  default: ({ children, variant }: { children: React.ReactNode, variant: string }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  )
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaCreditCard: { name: 'FaCreditCard' },
  FaStore: { name: 'FaStore' },
  FaLock: { name: 'FaLock' },
  FaExclamationTriangle: { name: 'FaExclamationTriangle' },
  FaInfoCircle: { name: 'FaInfoCircle' },
  FaArrowLeft: { name: 'FaArrowLeft' }
}));

// Import mocked services
const { createPaymentIntent, createOxxoPayment } = await import('../../services/stripePaymentService');

describe('UnifiedPaymentFlow', () => {
  const defaultProps = {
    applicationId: 'app_123',
    customerId: 'cus_test123',
    onPrevious: vi.fn(),
    onCardPaymentSuccess: vi.fn(),
    onOxxoPaymentCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (createPaymentIntent as any).mockResolvedValue({
      clientSecret: 'pi_test_secret_client',
      paymentIntentId: 'pi_test123',
      amount: 150
    });

    (createOxxoPayment as any).mockResolvedValue({
      success: true,
      oxxoReference: '12345678901234',
      amount: 150,
      expiresAt: '2024-01-01T00:00:00Z'
    });
  });

  describe('Rendering', () => {
    it('renders payment flow with default card method selected', () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      expect(screen.getByText('Información de Pago')).toBeInTheDocument();
      expect(screen.getByText('Selecciona tu método de pago:')).toBeInTheDocument();
      expect(screen.getByText('Tarjeta (Crédito/Débito)')).toBeInTheDocument();
      expect(screen.getByText('OXXO')).toBeInTheDocument();
    });

    it('renders security notice', () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      expect(screen.getByText(/Tu información de pago está segura/)).toBeInTheDocument();
      expect(screen.getByText(/Utilizamos Stripe con encriptación/)).toBeInTheDocument();
    });

    it('shows card method as selected by default', () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      const cardButton = screen.getByText('Tarjeta (Crédito/Débito)').closest('button');
      expect(cardButton).toHaveClass(expect.stringContaining('Selected'));
    });
  });

  describe('Payment Method Selection', () => {
    it('allows switching between payment methods', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      const oxxoButton = screen.getByText('OXXO').closest('button');
      const cardButton = screen.getByText('Tarjeta (Crédito/Débito)').closest('button');

      // Switch to OXXO
      fireEvent.click(oxxoButton!);
      expect(oxxoButton).toHaveClass(expect.stringContaining('Selected'));
      expect(cardButton).not.toHaveClass(expect.stringContaining('Selected'));

      // Switch back to card
      fireEvent.click(cardButton!);
      expect(cardButton).toHaveClass(expect.stringContaining('Selected'));
      expect(oxxoButton).not.toHaveClass(expect.stringContaining('Selected'));
    });

    it('clears errors when switching payment methods', async () => {
      (createPaymentIntent as any).mockRejectedValueOnce(new Error('Card init failed'));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
      });

      // Switch to OXXO - error should be cleared
      const oxxoButton = screen.getByText('OXXO').closest('button');
      fireEvent.click(oxxoButton!);

      expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
    });

    it('disables method selection buttons when processing', () => {
      render(<UnifiedPaymentFlow {...defaultProps} isSubmitting={true} />);

      const cardButton = screen.getByText('Tarjeta (Crédito/Débito)').closest('button');
      const oxxoButton = screen.getByText('OXXO').closest('button');

      expect(cardButton).toBeDisabled();
      expect(oxxoButton).toBeDisabled();
    });
  });

  describe('Card Payment Flow', () => {
    it('initializes card payment on component mount', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(createPaymentIntent).toHaveBeenCalledWith('app_123', 'cus_test123');
      });

      expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      expect(screen.getByText('Client Secret: pi_test_secret_client')).toBeInTheDocument();
    });

    it('shows loading state during card payment initialization', () => {
      // Make createPaymentIntent hang
      (createPaymentIntent as any).mockImplementation(() => new Promise(() => {}));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      expect(screen.getByText('Inicializando sistema de pago...')).toBeInTheDocument();
    });

    it('handles card payment initialization errors', async () => {
      (createPaymentIntent as any).mockRejectedValueOnce(new Error('Network error'));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No se pudo inicializar el pago con tarjeta.')).toBeInTheDocument();
      });

      expect(screen.getByText('Reintentar')).toBeInTheDocument();
      expect(screen.getByText(/O puedes seleccionar OXXO/)).toBeInTheDocument();
    });

    it('allows retrying card payment initialization', async () => {
      (createPaymentIntent as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          clientSecret: 'pi_retry_secret',
          paymentIntentId: 'pi_retry123',
          amount: 150
        });

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Reintentar')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Reintentar');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(createPaymentIntent).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });
    });

    it('handles successful card payment', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });

      const successButton = screen.getByTestId('mock-payment-success');
      fireEvent.click(successButton);

      expect(defaultProps.onCardPaymentSuccess).toHaveBeenCalledWith('pi_test123');
    });

    it('handles card payment errors', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });

      const errorButton = screen.getByTestId('mock-payment-error');
      fireEvent.click(errorButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByText('Mock payment error')).toBeInTheDocument();
      });
    });

    it('shows previous button when card payment is not ready', () => {
      (createPaymentIntent as any).mockImplementation(() => new Promise(() => {}));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      const previousButtons = screen.getAllByText('Anterior');
      expect(previousButtons.length).toBeGreaterThan(0);
    });
  });

  describe('OXXO Payment Flow', () => {
    beforeEach(async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);
      
      const oxxoButton = screen.getByText('OXXO').closest('button');
      fireEvent.click(oxxoButton!);
    });

    it('renders OXXO payment information', () => {
      expect(screen.getByText('Pago en efectivo en OXXO')).toBeInTheDocument();
      expect(screen.getByText(/Recibirás una referencia única/)).toBeInTheDocument();
      expect(screen.getByText(/Tendrás 3 días \(72 horas\) para realizar/)).toBeInTheDocument();
      expect(screen.getByText(/Tu permiso se generará automáticamente/)).toBeInTheDocument();
    });

    it('renders OXXO action buttons', () => {
      expect(screen.getByText('Anterior')).toBeInTheDocument();
      expect(screen.getByText('Generar Ficha OXXO')).toBeInTheDocument();
    });

    it('handles OXXO payment creation successfully', async () => {
      const generateButton = screen.getByText('Generar Ficha OXXO');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(createOxxoPayment).toHaveBeenCalledWith('app_123', 'cus_test123');
      });

      expect(defaultProps.onOxxoPaymentCreated).toHaveBeenCalledWith({
        success: true,
        oxxoReference: '12345678901234',
        amount: 150,
        expiresAt: '2024-01-01T00:00:00Z'
      });
    });

    it('shows loading state during OXXO payment creation', async () => {
      (createOxxoPayment as any).mockImplementation(() => new Promise(() => {}));

      const generateButton = screen.getByText('Generar Ficha OXXO');
      fireEvent.click(generateButton);

      expect(screen.getByText('Generando...')).toBeInTheDocument();
      expect(generateButton).toBeDisabled();
    });

    it('handles OXXO payment creation errors', async () => {
      (createOxxoPayment as any).mockRejectedValueOnce(new Error('OXXO service unavailable'));

      const generateButton = screen.getByText('Generar Ficha OXXO');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByText('OXXO service unavailable')).toBeInTheDocument();
      });
    });

    it('handles OXXO payment service returning failure', async () => {
      (createOxxoPayment as any).mockResolvedValueOnce({ success: false });

      const generateButton = screen.getByText('Generar Ficha OXXO');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByText('No se pudo generar la referencia OXXO')).toBeInTheDocument();
      });
    });

    it('prevents multiple OXXO payment requests', async () => {
      const generateButton = screen.getByText('Generar Ficha OXXO');
      
      // Click multiple times rapidly
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);

      // Should only call the service once
      await waitFor(() => {
        expect(createOxxoPayment).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Navigation', () => {
    it('calls onPrevious when previous button is clicked', () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      const previousButton = screen.getByText('Anterior');
      fireEvent.click(previousButton);

      expect(defaultProps.onPrevious).toHaveBeenCalled();
    });

    it('disables navigation buttons when processing', () => {
      render(<UnifiedPaymentFlow {...defaultProps} isSubmitting={true} />);

      const previousButton = screen.getByText('Anterior');
      expect(previousButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('displays error messages in alert component', async () => {
      (createPaymentIntent as any).mockRejectedValueOnce(new Error('Custom error message'));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', 'error');
      });
    });

    it('clears errors when switching payment methods', async () => {
      (createPaymentIntent as any).mockRejectedValueOnce(new Error('Card error'));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
      });

      // Switch to OXXO
      const oxxoButton = screen.getByText('OXXO').closest('button');
      fireEvent.click(oxxoButton!);

      expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
    });

    it('shows fallback error message for missing error details', async () => {
      (createPaymentIntent as any).mockRejectedValueOnce(new Error());

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error al inicializar el pago con tarjeta')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Error Boundary Integration', () => {
    it('wraps SecurePaymentElement with PaymentErrorBoundary', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('payment-error-boundary')).toBeInTheDocument();
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });
    });

    it('allows retrying through error boundary', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('error-boundary-retry')).toBeInTheDocument();
      });

      // Trigger retry from error boundary
      const retryButton = screen.getByTestId('error-boundary-retry');
      fireEvent.click(retryButton);

      expect(createPaymentIntent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with StripeProvider', () => {
    it('wraps SecurePaymentElement with StripeProvider when ready', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('stripe-provider')).toBeInTheDocument();
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });
    });

    it('passes correct props to SecurePaymentElement', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Client Secret: pi_test_secret_client')).toBeInTheDocument();
        expect(screen.getByText('Submitting: false')).toBeInTheDocument();
      });
    });

    it('reflects isSubmitting prop in SecurePaymentElement', async () => {
      render(<UnifiedPaymentFlow {...defaultProps} isSubmitting={true} />);

      await waitFor(() => {
        expect(screen.getByText('Submitting: true')).toBeInTheDocument();
      });
    });
  });

  describe('Amount Handling', () => {
    it('handles string amount from API response', async () => {
      (createPaymentIntent as any).mockResolvedValue({
        clientSecret: 'pi_test_secret',
        paymentIntentId: 'pi_test123',
        amount: '150.00'
      });

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });

      // Amount should be parsed correctly
      expect(createPaymentIntent).toHaveBeenCalled();
    });

    it('handles numeric amount from API response', async () => {
      (createPaymentIntent as any).mockResolvedValue({
        clientSecret: 'pi_test_secret',
        paymentIntentId: 'pi_test123',
        amount: 150
      });

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing client secret in API response', async () => {
      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        amount: 150
        // clientSecret is missing
      });

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No se recibió la clave de pago del servidor')).toBeInTheDocument();
      });
    });

    it('handles card payment success callback errors', async () => {
      defaultProps.onCardPaymentSuccess.mockRejectedValueOnce(new Error('Callback failed'));

      render(<UnifiedPaymentFlow {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('secure-payment-element')).toBeInTheDocument();
      });

      const successButton = screen.getByTestId('mock-payment-success');
      fireEvent.click(successButton);

      await waitFor(() => {
        expect(screen.getByText('Error al confirmar el pago. Por favor, contacta soporte.')).toBeInTheDocument();
      });
    });
  });
});