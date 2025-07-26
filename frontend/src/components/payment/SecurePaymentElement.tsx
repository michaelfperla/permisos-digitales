import React, { useState, useEffect } from 'react';
import {
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { PaymentIntent, StripeError, StripeCardNumberElementChangeEvent } from '@stripe/stripe-js';
import { FaLock, FaExclamationTriangle } from 'react-icons/fa';
import Icon from '../../shared/components/ui/Icon';
import Button from '../ui/Button/Button';
import styles from './SecurePaymentElement.module.css';

interface SecurePaymentElementProps {
  clientSecret: string;
  onPaymentSuccess: (paymentIntent: PaymentIntent) => void;
  onPaymentError: (error: string) => void;
  isSubmitting?: boolean;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

/**
 * Secure Payment Element using Stripe CardElement
 * PCI-compliant card processing without Link or other payment methods
 */
const SecurePaymentElement: React.FC<SecurePaymentElementProps> = ({
  clientSecret,
  onPaymentSuccess,
  onPaymentError,
  isSubmitting = false,
  onSubmittingChange,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cardBrand, setCardBrand] = useState<string>('');
  const [isCardComplete, setIsCardComplete] = useState(false);
  const [postalCode, setPostalCode] = useState<string>('');

  // Update parent component about loading state
  useEffect(() => {
    if (onSubmittingChange) {
      onSubmittingChange(isLoading);
    }
  }, [isLoading, onSubmittingChange]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe no está disponible. Por favor, recarga la página.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Get all card elements
      const cardNumber = elements.getElement(CardNumberElement);
      const cardExpiry = elements.getElement(CardExpiryElement);
      const cardCvc = elements.getElement(CardCvcElement);
      
      if (!cardNumber || !cardExpiry || !cardCvc) {
        setErrorMessage('Error al obtener los elementos de tarjeta');
        return;
      }

      // Confirm the card payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            address: {
              postal_code: postalCode,
            },
          },
        },
      });

      if (error) {
        // Map Stripe errors to user-friendly messages
        const userMessage = mapStripeErrorToUserMessage(error);
        setErrorMessage(userMessage);
        onPaymentError(userMessage);
      } else if (paymentIntent) {
        onPaymentSuccess(paymentIntent);
      }
    } catch (err) {
      const errorMsg = 'Error inesperado al procesar el pago. Por favor, intenta de nuevo.';
      setErrorMessage(errorMsg);
      onPaymentError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const mapStripeErrorToUserMessage = (error: StripeError): string => {
    switch (error.code) {
      case 'card_declined':
        return 'Su tarjeta fue rechazada. Por favor, verifique los datos o intente con otra tarjeta.';
      case 'insufficient_funds':
        return 'Fondos insuficientes en su tarjeta. Por favor, intente con otra tarjeta.';
      case 'expired_card':
        return 'Su tarjeta ha expirado. Por favor, verifique la fecha de vencimiento.';
      case 'incorrect_cvc':
        return 'El código de seguridad (CVC) es incorrecto. Por favor, verifíquelo.';
      case 'invalid_number':
        return 'El número de tarjeta es inválido. Por favor, verifíquelo.';
      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
        return 'La fecha de vencimiento es inválida. Por favor, verifíquela.';
      case 'processing_error':
        return 'Error al procesar el pago. Por favor, intente nuevamente.';
      case 'rate_limit_error':
        return 'Demasiadas solicitudes. Por favor, espere un momento e intente nuevamente.';
      case 'authentication_required':
        return 'Se requiere autenticación adicional. Por favor, complete la verificación.';
      case 'payment_intent_authentication_failure':
        return 'Falló la autenticación del pago. Por favor, intente de nuevo.';
      default:
        return error.message || 'Error al procesar el pago. Por favor, intente nuevamente o contacte soporte.';
    }
  };

  // Show loading state while Stripe is initializing
  if (!stripe || !elements) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Cargando sistema de pagos seguro...</p>
      </div>
    );
  }

  return (
    <div className={styles.paymentContainer}>
      {/* Security Notice */}
      <div className={styles.securityNotice}>
        <Icon IconComponent={FaLock} className={styles.securityIcon} size="md" />
        <div className={styles.securityText}>
          <h4>Pago Seguro</h4>
          <p>
            Tu información está protegida con encriptación de grado bancario. 
            No almacenamos los detalles de tu tarjeta.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className={styles.errorContainer}>
          <Icon IconComponent={FaExclamationTriangle} className={styles.errorIcon} size="md" />
          <p className={styles.errorMessage}>{errorMessage}</p>
        </div>
      )}

      {/* Payment Form */}
      <form 
        onSubmit={handleSubmit} 
        className={styles.paymentForm}
        autoComplete="off"
        data-stripe-link="false"
      >
        <div className={styles.cardInputSection}>
          <h3 className={styles.cardInputTitle}>
            Información de Pago
          </h3>
          
          {/* Card Number */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>
              Número de tarjeta
            </label>
            <div className={styles.inputWrapper}>
              <CardNumberElement
                className={styles.stripeInput}
                options={{
                  placeholder: '1234 5678 9012 3456',
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#e5424d',
                      iconColor: '#e5424d',
                    },
                  },
                  showIcon: true,
                  // Disable Link and autofill
                  disableLink: true,
                }}
                onChange={(e: StripeCardNumberElementChangeEvent) => {
                  setCardBrand(e.brand);
                  setIsCardComplete(e.complete);
                }}
              />
              {cardBrand && (
                <span className={styles.cardBrand}>
                  {cardBrand.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Expiry and CVC Row */}
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                Fecha de vencimiento
              </label>
              <CardExpiryElement
                className={styles.stripeInput}
                options={{
                  placeholder: 'MM / AA',
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#e5424d',
                    },
                  },
                }}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                CVC
                <span className={styles.inputHelp} title="Código de seguridad de 3 o 4 dígitos">?</span>
              </label>
              <CardCvcElement
                className={styles.stripeInput}
                options={{
                  placeholder: '123',
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#e5424d',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Postal Code */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>
              Código postal
            </label>
            <input
              type="text"
              className={styles.postalInput}
              placeholder="12345"
              value={postalCode}
              onChange={(e) => {
                // Only allow numbers and limit to 5 digits for Mexican postal codes
                const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                setPostalCode(value);
              }}
              maxLength={5}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className={styles.securityInfo}>
            <Icon IconComponent={FaLock} size="sm" />
            <span>Todos los pagos son procesados de forma segura con encriptación SSL</span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={!stripe || isLoading || isSubmitting}
          className={styles.submitButton}
        >
          {isLoading ? (
            <>
              <div className={styles.spinner}></div>
              Procesando pago...
            </>
          ) : (
            'Confirmar Pago'
          )}
        </Button>
      </form>
    </div>
  );
};

export default SecurePaymentElement;
