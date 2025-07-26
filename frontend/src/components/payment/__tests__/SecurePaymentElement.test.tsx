import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import { 
  CardNumberElement, 
  CardExpiryElement, 
  CardCvcElement 
} from '@stripe/react-stripe-js';
import SecurePaymentElement from '../SecurePaymentElement';

// Mock Stripe React components
vi.mock('@stripe/react-stripe-js', () => ({
  CardNumberElement: vi.fn(({ onChange, options }) => (
    <input
      data-testid="card-number-element"
      onChange={(e) => onChange && onChange({
        brand: 'visa',
        complete: e.target.value.length >= 16,
        empty: e.target.value.length === 0,
        error: null
      })}
      placeholder={options?.placeholder || ''}
    />
  )),
  CardExpiryElement: vi.fn(({ options }) => (
    <input
      data-testid="card-expiry-element"
      placeholder={options?.placeholder || ''}
    />
  )),
  CardCvcElement: vi.fn(({ options }) => (
    <input
      data-testid="card-cvc-element"
      placeholder={options?.placeholder || ''}
    />
  )),
  useStripe: vi.fn(),
  useElements: vi.fn(),
}));

// Mock UI components
vi.mock('../../shared/components/ui/Icon', () => ({
  default: ({ IconComponent, className, size }: any) => (
    <span data-testid="icon" className={className} data-size={size}>
      {IconComponent.name}
    </span>
  )
}));

vi.mock('../../ui/Button/Button', () => ({
  default: ({ children, disabled, type, variant, className, ...props }: any) => (
    <button
      data-testid="payment-button"
      disabled={disabled}
      type={type}
      className={className}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  )
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaLock: { name: 'FaLock' },
  FaExclamationTriangle: { name: 'FaExclamationTriangle' }
}));

const { useStripe, useElements } = await import('@stripe/react-stripe-js');

describe('SecurePaymentElement', () => {
  const mockStripe = {
    confirmCardPayment: vi.fn(),
  };

  const mockElements = {
    getElement: vi.fn(),
  };

  const mockCardElement = {
    mount: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  const defaultProps = {
    clientSecret: 'pi_test_client_secret',
    onPaymentSuccess: vi.fn(),
    onPaymentError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (useStripe as any).mockReturnValue(mockStripe);
    (useElements as any).mockReturnValue(mockElements);
    mockElements.getElement.mockReturnValue(mockCardElement);
  });

  describe('Loading States', () => {
    it('shows loading state when Stripe is not available', () => {
      (useStripe as any).mockReturnValue(null);
      (useElements as any).mockReturnValue(null);

      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByText('Cargando sistema de pagos seguro...')).toBeInTheDocument();
      expect(screen.queryByTestId('payment-button')).not.toBeInTheDocument();
    });

    it('shows loading state when Elements is not available', () => {
      (useStripe as any).mockReturnValue(mockStripe);
      (useElements as any).mockReturnValue(null);

      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByText('Cargando sistema de pagos seguro...')).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders security notice', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByText('Pago Seguro')).toBeInTheDocument();
      expect(screen.getByText(/Tu información está protegida con encriptación/)).toBeInTheDocument();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('renders all card input elements', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByTestId('card-number-element')).toBeInTheDocument();
      expect(screen.getByTestId('card-expiry-element')).toBeInTheDocument();
      expect(screen.getByTestId('card-cvc-element')).toBeInTheDocument();
      expect(screen.getByLabelText('Código postal')).toBeInTheDocument();
    });

    it('renders payment button with correct text', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Confirmar Pago');
      expect(button).not.toBeDisabled();
    });

    it('renders input labels correctly', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByText('Número de tarjeta')).toBeInTheDocument();
      expect(screen.getByText('Fecha de vencimiento')).toBeInTheDocument();
      expect(screen.getByText('CVC')).toBeInTheDocument();
      expect(screen.getByText('Código postal')).toBeInTheDocument();
    });

    it('renders security information at bottom', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByText(/Todos los pagos son procesados de forma segura/)).toBeInTheDocument();
    });
  });

  describe('Card Input Interactions', () => {
    it('updates card brand when card number changes', async () => {
      render(<SecurePaymentElement {...defaultProps} />);

      const cardNumberInput = screen.getByTestId('card-number-element');
      fireEvent.change(cardNumberInput, { target: { value: '4111111111111111' } });

      await waitFor(() => {
        expect(screen.getByText('VISA')).toBeInTheDocument();
      });
    });

    it('handles postal code input correctly', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      const postalInput = screen.getByLabelText('Código postal');
      
      // Test valid numeric input
      fireEvent.change(postalInput, { target: { value: '12345' } });
      expect(postalInput).toHaveValue('12345');

      // Test filtering non-numeric characters
      fireEvent.change(postalInput, { target: { value: '123ab45' } });
      expect(postalInput).toHaveValue('12345');

      // Test length limitation
      fireEvent.change(postalInput, { target: { value: '123456789' } });
      expect(postalInput).toHaveValue('12345');
    });

    it('calls onSubmittingChange when loading state changes', () => {
      const mockOnSubmittingChange = vi.fn();
      render(
        <SecurePaymentElement 
          {...defaultProps} 
          onSubmittingChange={mockOnSubmittingChange}
        />
      );

      // Initially should not be called with true
      expect(mockOnSubmittingChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Form Submission', () => {
    it('handles successful payment submission', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 15000,
        currency: 'mxn'
      };

      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: mockPaymentIntent,
        error: null
      });

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith(
          defaultProps.clientSecret,
          expect.objectContaining({
            payment_method: expect.objectContaining({
              card: mockCardElement,
              billing_details: expect.objectContaining({
                address: expect.objectContaining({
                  postal_code: ''
                })
              })
            })
          })
        );
      });

      expect(defaultProps.onPaymentSuccess).toHaveBeenCalledWith(mockPaymentIntent);
      expect(defaultProps.onPaymentError).not.toHaveBeenCalled();
    });

    it('handles payment errors correctly', async () => {
      const mockError = {
        code: 'card_declined',
        message: 'Your card was declined.',
        type: 'card_error'
      };

      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: null,
        error: mockError
      });

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Su tarjeta fue rechazada/)).toBeInTheDocument();
      });

      expect(defaultProps.onPaymentError).toHaveBeenCalledWith(
        expect.stringContaining('Su tarjeta fue rechazada')
      );
      expect(defaultProps.onPaymentSuccess).not.toHaveBeenCalled();
    });

    it('handles missing card elements gracefully', async () => {
      mockElements.getElement.mockReturnValue(null);

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Error al obtener los elementos de tarjeta')).toBeInTheDocument();
      });

      expect(mockStripe.confirmCardPayment).not.toHaveBeenCalled();
      expect(defaultProps.onPaymentError).not.toHaveBeenCalled();
    });

    it('handles unexpected errors during payment', async () => {
      mockStripe.confirmCardPayment.mockRejectedValueOnce(new Error('Network error'));

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Error inesperado al procesar el pago/)).toBeInTheDocument();
      });

      expect(defaultProps.onPaymentError).toHaveBeenCalledWith(
        'Error inesperado al procesar el pago. Por favor, intenta de nuevo.'
      );
    });

    it('prevents submission when Stripe is not available', async () => {
      (useStripe as any).mockReturnValue(null);

      render(<SecurePaymentElement {...defaultProps} />);

      // Button should not be rendered when Stripe is not available
      expect(screen.queryByTestId('payment-button')).not.toBeInTheDocument();
    });

    it('shows loading state during payment processing', async () => {
      let resolvePayment: (value: any) => void;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      mockStripe.confirmCardPayment.mockReturnValue(paymentPromise);

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Procesando pago...')).toBeInTheDocument();
        expect(button).toBeDisabled();
      });

      // Resolve the payment
      resolvePayment!({ paymentIntent: { id: 'pi_test' }, error: null });

      await waitFor(() => {
        expect(screen.getByText('Confirmar Pago')).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('Error Messages', () => {
    it('maps Stripe error codes to user-friendly messages', async () => {
      const errorMappings = [
        { code: 'card_declined', expectedText: 'Su tarjeta fue rechazada' },
        { code: 'insufficient_funds', expectedText: 'Fondos insuficientes' },
        { code: 'expired_card', expectedText: 'Su tarjeta ha expirado' },
        { code: 'incorrect_cvc', expectedText: 'El código de seguridad (CVC) es incorrecto' },
        { code: 'invalid_number', expectedText: 'El número de tarjeta es inválido' },
        { code: 'invalid_expiry_month', expectedText: 'La fecha de vencimiento es inválida' },
        { code: 'processing_error', expectedText: 'Error al procesar el pago' },
        { code: 'rate_limit_error', expectedText: 'Demasiadas solicitudes' },
        { code: 'authentication_required', expectedText: 'Se requiere autenticación adicional' }
      ];

      for (const { code, expectedText } of errorMappings) {
        const mockError = { code, message: `Stripe error: ${code}`, type: 'card_error' };
        mockStripe.confirmCardPayment.mockResolvedValueOnce({
          paymentIntent: null,
          error: mockError
        });

        const { unmount } = render(<SecurePaymentElement {...defaultProps} />);

        const button = screen.getByTestId('payment-button');
        fireEvent.click(button);

        await waitFor(() => {
          expect(screen.getByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
        });

        unmount();
        vi.clearAllMocks();
      }
    });

    it('shows generic error for unknown error codes', async () => {
      const mockError = {
        code: 'unknown_error',
        message: 'Something went wrong',
        type: 'api_error'
      };

      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: null,
        error: mockError
      });

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });

    it('clears error message on new submission', async () => {
      // First submission with error
      const mockError = { code: 'card_declined', message: 'Card declined', type: 'card_error' };
      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: null,
        error: mockError
      });

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Su tarjeta fue rechazada/)).toBeInTheDocument();
      });

      // Second submission - error should be cleared during loading
      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: { id: 'pi_test' },
        error: null
      });

      fireEvent.click(button);

      // During loading, error should not be visible
      expect(screen.queryByText(/Su tarjeta fue rechazada/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      expect(form).toHaveAttribute('autoComplete', 'off');
    });

    it('has proper label associations', () => {
      render(<SecurePaymentElement {...defaultProps} />);

      expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument();
      expect(screen.getByLabelText('Fecha de vencimiento')).toBeInTheDocument();
      expect(screen.getByLabelText('CVC')).toBeInTheDocument();
      expect(screen.getByLabelText('Código postal')).toBeInTheDocument();
    });

    it('has proper ARIA attributes for error states', async () => {
      const mockError = { code: 'card_declined', message: 'Card declined', type: 'card_error' };
      mockStripe.confirmCardPayment.mockResolvedValueOnce({
        paymentIntent: null,
        error: mockError
      });

      render(<SecurePaymentElement {...defaultProps} />);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      await waitFor(() => {
        const errorContainer = screen.getByText(/Su tarjeta fue rechazada/).closest('div');
        expect(errorContainer).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('handles isSubmitting prop correctly', () => {
      render(<SecurePaymentElement {...defaultProps} isSubmitting={true} />);

      const button = screen.getByTestId('payment-button');
      expect(button).toBeDisabled();
    });

    it('calls onSubmittingChange when provided', async () => {
      const mockOnSubmittingChange = vi.fn();
      
      render(
        <SecurePaymentElement 
          {...defaultProps} 
          onSubmittingChange={mockOnSubmittingChange}
        />
      );

      // Should call with false initially
      expect(mockOnSubmittingChange).toHaveBeenCalledWith(false);

      // Mock a delayed payment
      let resolvePayment: (value: any) => void;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });
      mockStripe.confirmCardPayment.mockReturnValue(paymentPromise);

      const button = screen.getByTestId('payment-button');
      fireEvent.click(button);

      // Should call with true during processing
      await waitFor(() => {
        expect(mockOnSubmittingChange).toHaveBeenCalledWith(true);
      });

      // Resolve payment
      resolvePayment!({ paymentIntent: { id: 'pi_test' }, error: null });

      // Should call with false after completion
      await waitFor(() => {
        expect(mockOnSubmittingChange).toHaveBeenCalledWith(false);
      });
    });
  });
});