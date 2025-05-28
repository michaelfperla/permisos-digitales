import React, { useState, useEffect } from 'react';
import {
  FaCreditCard,
  FaLock,
  FaArrowLeft,
  FaStore,
  FaExclamationTriangle,
} from 'react-icons/fa';

import styles from './CompleteForm.module.css';
import Icon from '../../shared/components/ui/Icon';
import TestCardInfo from '../payment/TestCardInfo';
import Button from "../ui/Button/Button";
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../../constants';

// Define Conekta types for TypeScript
declare global {
  interface Window {
    Conekta: {
      setPublicKey: (key: string) => void;
      deviceFingerprint?: () => string;
      getDeviceFingerprint?: () => string;
      deviceData?: {
        getDeviceFingerprint?: () => string;
        getDeviceId?: () => string;
      };
      Token: {
        create: (
          params: any,
          successCallback: (token: { id: string }) => void,
          errorCallback: (error: { message: string }) => void,
        ) => void;
      };
    };
  }
}

interface PaymentFormStepProps {
  onPrevious: () => void;
  onSubmit: (token: string | null, paymentMethod: 'card' | 'oxxo', deviceSessionId: string) => void;
  isSubmitting: boolean;
}

const PaymentFormStep: React.FC<PaymentFormStepProps> = ({
  onPrevious,
  onSubmit,
  isSubmitting,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'oxxo'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isConektaReady, setIsConektaReady] = useState(false);
  const [deviceSessionId, setDeviceSessionId] = useState<string>('');

  // Note: We're not using React Hook Form for the payment form
  // because it's a specialized form with custom validation and submission logic
  // that doesn't fit well with the schema-based validation approach

  // Conekta initialization disabled until live payments are implemented
  useEffect(() => {
    // Log that Conekta is disabled (development only)
    if (import.meta.env.DEV) {
      console.info('Conekta initialization disabled - live payments not yet implemented');
    }

    // TODO: Re-enable when implementing live payments
    /*
    // Log API key for verification (development only)
    if (import.meta.env.DEV) {
      console.info('Public Key:', import.meta.env.VITE_CONEKTA_PUBLIC_KEY.slice(0, 8) + '...');
    }

    let checkConektaInterval: number | null = null;

    const initializeConekta = () => {
      const checkConekta = setInterval(() => {
        if (window.Conekta) {
          clearInterval(checkConekta);

          // Set the public key
          window.Conekta.setPublicKey(import.meta.env.VITE_CONEKTA_PUBLIC_KEY);
          if (import.meta.env.DEV) {
            console.info('Conekta public key set successfully');
          }

          // Try to get device fingerprint after initialization
          let deviceFingerprintValue;
          const attempts = [
            () => window.Conekta.deviceData?.getDeviceId?.(),
            () => window.Conekta.deviceData?.getDeviceFingerprint?.(),
            () => window.Conekta.getDeviceFingerprint?.(),
            () => window.Conekta.deviceFingerprint?.(),
          ];

          for (const attempt of attempts) {
            try {
              deviceFingerprintValue = attempt();
              if (deviceFingerprintValue) {
                console.info('Device Fingerprint:', deviceFingerprintValue);
                break;
              }
            } catch (e) {
              console.warn('Error in fingerprint attempt:', e);
            }
          }

          if (!deviceFingerprintValue) {
            deviceFingerprintValue = crypto.randomUUID();
            console.info('Fallback UUID:', deviceFingerprintValue);
          }

          setDeviceSessionId(deviceFingerprintValue);
          setIsConektaReady(true);
          console.info('Conekta initialized successfully with device fingerprint');
        }
      }, 100);

      // Store the interval ID for cleanup
      checkConektaInterval = checkConekta;
    };

    // Start initialization immediately
    initializeConekta();

    // Cleanup function to clear interval if component unmounts
    return () => {
      if (checkConektaInterval) {
        clearInterval(checkConektaInterval);
      }
    };
    */
  }, [setDeviceSessionId, setIsConektaReady]);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  // Handle card number input
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCardNumber(e.target.value);
    setCardNumber(value);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return; // Prevent multiple submissions
    }

    // Clear previous errors
    setErrors({});

    // Use the device fingerprint that was set during initialization
    // If it's not available, generate a fallback UUID
    let currentDeviceSessionId = deviceSessionId;

    if (!currentDeviceSessionId) {
      // Try to get it one more time
      try {
        if (window.Conekta?.deviceData?.getDeviceId) {
          currentDeviceSessionId = window.Conekta.deviceData.getDeviceId();
        }
      } catch (e) {
        console.warn('Error getting device fingerprint in handleSubmit:', e);
      }

      // If still not available, use UUID as fallback
      if (!currentDeviceSessionId) {
        currentDeviceSessionId = crypto.randomUUID();
        console.warn('Using UUID fallback for device fingerprint:', currentDeviceSessionId);
      }
    }

    // Add debug logging for device fingerprint (development only)
    if (import.meta.env.DEV) {
      console.info('Device fingerprint for payment:', currentDeviceSessionId.substring(0, 8) + '...');
    }

    // For testing purposes, if we're in development mode, suggest using a valid test card number
    if (import.meta.env.DEV && cardNumber.trim() !== '4242424242424242') {
      console.info('For testing, use Conekta test card number: 4242 4242 4242 4242');
    }

    // If OXXO payment method is selected, submit with null token, 'oxxo' method, and deviceSessionId
    if (paymentMethod === 'oxxo') {
      if (import.meta.env.DEV) {
        console.info('Submitting with OXXO payment method and deviceSessionId');
      }
      onSubmit(null, 'oxxo', currentDeviceSessionId);
      return;
    }

    // For development mode, use predefined test tokens to bypass token creation issues
    // This is enabled by default in development mode, but can be disabled with VITE_USE_TEST_TOKENS=false
    if (import.meta.env.DEV && import.meta.env.VITE_USE_TEST_TOKENS !== 'false') {
      // Map card numbers to appropriate test tokens
      let testToken = 'tok_test_visa_4242'; // Default test token

      // Use specific test tokens based on the card number
      if (cardNumber.replace(/\s+/g, '') === '4000000000000002') {
        testToken = 'tok_test_card_declined';
      } else if (cardNumber.replace(/\s+/g, '') === '4000000000000127') {
        testToken = 'tok_test_insufficient_funds';
      } else if (cardNumber.replace(/\s+/g, '') === '5555555555554444') {
        testToken = 'tok_test_mastercard_4444';
      } else if (cardNumber.replace(/\s+/g, '') === '4000000000009979') {
        testToken = 'tok_test_stolen_card';
      }

      console.info('Development mode: Using predefined test token:', testToken);
      onSubmit(testToken, 'card', currentDeviceSessionId);
      return;
    }

    // Check if Conekta is ready
    if (!isConektaReady) {
      setErrors({
        general: 'El sistema de pagos no está listo. Por favor, intenta de nuevo en unos momentos.',
      });
      return;
    }

    // For card payment, validate card details
    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    if (!cardNumber.trim()) {
      newErrors.cardNumber = 'El número de tarjeta es obligatorio';
      hasErrors = true;
    }

    if (!cardName.trim()) {
      newErrors.cardName = 'El nombre del titular es obligatorio';
      hasErrors = true;
    }

    if (!expMonth.trim()) {
      newErrors.expMonth = 'El mes de expiración es obligatorio';
      hasErrors = true;
    } else if (!/^\d{1,2}$/.test(expMonth) || parseInt(expMonth) < 1 || parseInt(expMonth) > 12) {
      newErrors.expMonth = 'Mes inválido';
      hasErrors = true;
    }

    if (!expYear.trim()) {
      newErrors.expYear = 'El año de expiración es obligatorio';
      hasErrors = true;
    } else if (!/^\d{2}$/.test(expYear)) {
      newErrors.expYear = 'Formato inválido (YY)';
      hasErrors = true;
    }

    if (!cvc.trim()) {
      newErrors.cvc = 'El código de seguridad es obligatorio';
      hasErrors = true;
    } else if (!/^\d{3,4}$/.test(cvc)) {
      newErrors.cvc = 'CVC inválido';
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    // Create token with Conekta
    // Ensure all values are properly formatted according to Conekta's requirements
    // Do NOT explicitly add device_fingerprint to tokenParams - let Conekta.js handle this internally
    const tokenParams = {
      card: {
        number: cardNumber.replace(/\s+/g, ''), // Remove all spaces
        name: cardName.trim(), // Trim whitespace
        exp_year: expYear.trim(), // Ensure it's a string and trim whitespace
        exp_month: expMonth.trim(), // Ensure it's a string and trim whitespace
        cvc: cvc.trim(), // Trim whitespace
      },
      // device_fingerprint is now handled internally by Conekta.js
    };

    // For testing, log a reminder about using valid test cards (development only)
    if (import.meta.env.DEV) {
      console.info(
        'Using card details as entered. For testing, remember to use Conekta test cards.',
      );

      // Log the token parameters (without sensitive data) - development only
      console.info('Creating token with parameters:', {
        card: {
          number: '************' + tokenParams.card.number.slice(-4),
          name: tokenParams.card.name,
          exp_year: tokenParams.card.exp_year,
          exp_month: tokenParams.card.exp_month,
          cvc: '***',
        },
      });

      // Log the device session ID separately (will be sent to backend with token)
      console.info('Device session ID for backend:', currentDeviceSessionId.substring(0, 8) + '...');
    }

    try {
      // Log token creation attempt (development only)
      if (import.meta.env.DEV) {
        console.info('Attempting to create Conekta token with the following parameters:');
        console.info(
          '- Card number (masked):',
          '*'.repeat(cardNumber.length - 4) + cardNumber.slice(-4),
        );
        console.info('- Card holder name:', cardName);
        console.info('- Expiration month/year:', expMonth + '/' + expYear);
        console.info('- Device fingerprint available:', !!deviceSessionId);
        console.info('- Conekta ready state:', isConektaReady);
      }

      window.Conekta.Token.create(
        tokenParams,
        function (token: { id: string }) {
          // Success callback - token created
          if (import.meta.env.DEV) {
            console.info('Token created successfully:', token.id);
            console.info(
              'Token format validation:',
              token.id.startsWith('tok_') ? 'Valid format' : 'Unexpected format',
            );
          }
          if (import.meta.env.DEV) {
            console.info('Token length:', token.id.length);
          }

          // Get the device fingerprint again after token creation
          // Sometimes Conekta only generates the fingerprint during token creation
          let updatedDeviceSessionId = currentDeviceSessionId;
          try {
            if (window.Conekta?.deviceData?.getDeviceId) {
              const newFingerprint = window.Conekta.deviceData.getDeviceId();
              if (newFingerprint && newFingerprint !== currentDeviceSessionId) {
                console.info(
                  'Updated device fingerprint after token creation:',
                  newFingerprint.substring(0, 8) + '...',
                );
                updatedDeviceSessionId = newFingerprint;
                // Update the state for future use
                setDeviceSessionId(newFingerprint);
              }
            }
          } catch (e) {
            console.warn('Error getting updated device fingerprint:', e);
          }

          // Submit the form with the token, payment method, and device session ID
          onSubmit(token.id, 'card', updatedDeviceSessionId);
        },
        function (error: { message: string; code?: string; details?: any[] }) {
          // Error callback - always log errors regardless of environment
          console.error('Conekta error during token creation:', error);
          if (import.meta.env.DEV) {
            console.error('Error code:', error.code || 'No error code provided');
            console.error('Error details:', error.details || 'No details provided');
          }

          // Format user-friendly error message
          let errorMessage = error.message;

          // Check for specific error types
          if (
            error.message.includes('card was declined') ||
            error.message.includes('tarjeta fue declinada') ||
            error.message.includes('The card was declined')
          ) {
            errorMessage =
              'Tu tarjeta fue rechazada. Por favor, verifica los datos o utiliza otra tarjeta. Para pruebas, usa 4242 4242 4242 4242.';
          } else if (error.message.includes('expired')) {
            errorMessage = 'Tu tarjeta ha expirado. Por favor, utiliza otra tarjeta.';
          } else if (error.message.includes('insufficient funds')) {
            errorMessage =
              'Tu tarjeta no tiene fondos suficientes. Por favor, utiliza otra tarjeta.';
          } else if (error.message.includes('security code')) {
            errorMessage =
              'El código de seguridad (CVC) es inválido. Por favor, verifica e intenta de nuevo.';
          }

          setErrors({ general: errorMessage });
        },
      );
    } catch (error) {
      console.error('Exception during Conekta token creation:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      setErrors({ general: 'Error al procesar la tarjeta. Por favor, intenta de nuevo.' });
    }
  };

  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <Icon IconComponent={FaCreditCard} className={styles.formSectionIcon} size="lg" />
        <h2 className={styles.formSectionTitle}>Información de Pago</h2>
      </div>

      <div className={styles.formSectionContent}>
        <div className={styles.infoBox}>
          <Icon IconComponent={FaLock} className={styles.infoIcon} size="md" />
          <p className={styles.infoText}>
            Tu información de pago está segura. Utilizamos encriptación de grado bancario para
            proteger tus datos. No almacenamos los detalles completos de tu tarjeta.
          </p>
        </div>

        {/* Test Card Information - Always show in development and test environments */}
        {(import.meta.env.DEV || import.meta.env.MODE !== 'production') && (
          <TestCardInfo
            onSelectCard={(cardNumber, name, expMonth, expYear, cvc) => {
              setCardNumber(formatCardNumber(cardNumber));
              setCardName(name);
              setExpMonth(expMonth);
              setExpYear(expYear);
              setCvc(cvc);
            }}
          />
        )}

        {(errors.general || errors.deviceFingerprint) && (
          <div className={styles.errorBox}>
            {errors.general && <p className={styles.errorText}>{errors.general}</p>}
            {errors.deviceFingerprint && (
              <p className={styles.errorText}>{errors.deviceFingerprint}</p>
            )}
          </div>
        )}

        <form id="card-form" onSubmit={handleSubmit}>
          {/* Payment Method Selection */}
          <div className={styles.paymentMethodSelector}>
            <h3 className={styles.paymentMethodTitle}>Selecciona tu método de pago:</h3>

            <div className={styles.paymentMethodOptions}>
              {/* Card Payment Option */}
              <div
                className={`${styles.paymentMethodOption} ${paymentMethod === 'card' ? styles.paymentMethodOptionSelected : ''}`}
                onClick={() => setPaymentMethod('card')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setPaymentMethod('card');
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Seleccionar pago con tarjeta"
              >
                <input
                  type="radio"
                  id="payment-card"
                  name="payment-method"
                  className={styles.paymentMethodRadio}
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                <label htmlFor="payment-card" className={styles.paymentMethodLabel}>
                  <Icon
                    IconComponent={FaCreditCard}
                    className={styles.paymentMethodIcon}
                    size="md"
                  />
                  <span className={styles.paymentMethodName}>Tarjeta (Crédito/Débito)</span>
                  <span className={styles.paymentMethodDescription}>
                    Pago inmediato con tarjeta bancaria
                  </span>
                </label>
              </div>

              {/* OXXO Payment Option */}
              <div
                className={`${styles.paymentMethodOption} ${paymentMethod === 'oxxo' ? styles.paymentMethodOptionSelected : ''}`}
                onClick={() => setPaymentMethod('oxxo')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setPaymentMethod('oxxo');
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Seleccionar pago con OXXO"
              >
                <input
                  type="radio"
                  id="payment-oxxo"
                  name="payment-method"
                  className={styles.paymentMethodRadio}
                  checked={paymentMethod === 'oxxo'}
                  onChange={() => setPaymentMethod('oxxo')}
                />
                <label htmlFor="payment-oxxo" className={styles.paymentMethodLabel}>
                  <Icon IconComponent={FaStore} className={styles.paymentMethodIcon} size="md" />
                  <span className={styles.paymentMethodName}>OXXO Pay</span>
                  <span className={styles.paymentMethodDescription}>
                    Pago en efectivo en tiendas OXXO
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Card Payment Form - Only show if card payment method is selected */}
          {paymentMethod === 'card' && (
            <div className={styles.cardForm}>
              {/* Warning message for test environment */}
              {(import.meta.env.DEV || import.meta.env.MODE !== 'production') && (
                <div className={styles.warningBox}>
                  <Icon
                    IconComponent={FaExclamationTriangle}
                    className={styles.warningIcon}
                    size="md"
                    color="var(--color-warning)"
                  />
                  <p className={styles.warningText}>
                    <strong>¡IMPORTANTE!</strong> Para pruebas, usa la tarjeta{' '}
                    <strong>4242 4242 4242 4242</strong> con cualquier fecha futura y CVC. Otras
                    tarjetas pueden ser rechazadas.
                  </p>
                </div>
              )}

              <div className={styles.cardFormField}>
                <label htmlFor="card-number" className={styles.formLabel}>
                  Número de Tarjeta
                </label>
                <input
                  type="text"
                  id="card-number"
                  className={`${styles.formInput} ${errors.cardNumber ? styles.invalid : ''}`}
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  maxLength={19}
                  autoComplete="cc-number"
                  data-conekta="card[number]"
                  inputMode="numeric"
                  pattern="[0-9\s]*"
                />
                {errors.cardNumber && (
                  <div className={styles.errorMessage}>{errors.cardNumber}</div>
                )}
              </div>

              <div className={styles.cardFormField}>
                <label htmlFor="card-name" className={styles.formLabel}>
                  Nombre del Titular
                </label>
                <input
                  type="text"
                  id="card-name"
                  className={`${styles.formInput} ${errors.cardName ? styles.invalid : ''}`}
                  placeholder="Como aparece en la tarjeta"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  autoComplete="cc-name"
                  data-conekta="card[name]"
                  inputMode="text"
                />
                {errors.cardName && <div className={styles.errorMessage}>{errors.cardName}</div>}
              </div>

              <div className={styles.cardFormRow}>
                <div className={styles.cardFormField}>
                  <label htmlFor="card-exp-month" className={styles.formLabel}>
                    Mes de Expiración
                  </label>
                  <input
                    type="text"
                    id="card-exp-month"
                    className={`${styles.formInput} ${errors.expMonth ? styles.invalid : ''}`}
                    placeholder="MM"
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    maxLength={2}
                    autoComplete="cc-exp-month"
                    data-conekta="card[exp_month]"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  {errors.expMonth && <div className={styles.errorMessage}>{errors.expMonth}</div>}
                </div>

                <div className={styles.cardFormField}>
                  <label htmlFor="card-exp-year" className={styles.formLabel}>
                    Año de Expiración
                  </label>
                  <input
                    type="text"
                    id="card-exp-year"
                    className={`${styles.formInput} ${errors.expYear ? styles.invalid : ''}`}
                    placeholder="YY"
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    maxLength={2}
                    autoComplete="cc-exp-year"
                    data-conekta="card[exp_year]"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  {errors.expYear && <div className={styles.errorMessage}>{errors.expYear}</div>}
                </div>

                <div className={styles.cardFormField}>
                  <label htmlFor="card-cvc" className={styles.formLabel}>
                    CVC
                  </label>
                  <input
                    type="text"
                    id="card-cvc"
                    className={`${styles.formInput} ${errors.cvc ? styles.invalid : ''}`}
                    placeholder="CVC"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    autoComplete="cc-csc"
                    data-conekta="card[cvc]"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  {errors.cvc && <div className={styles.errorMessage}>{errors.cvc}</div>}
                </div>
              </div>
            </div>
          )}

          {/* OXXO Payment Information - Only show if OXXO payment method is selected */}
          {paymentMethod === 'oxxo' && (
            <div className={styles.oxxoInstructions}>
              <FaStore className={styles.oxxoInstructionsIcon} />
              <p className={styles.oxxoInstructionsText}>
                Al elegir OXXO Pay, recibirás una referencia para pagar en cualquier tienda OXXO. Tu
                solicitud se procesará cuando se confirme tu pago.
              </p>
            </div>
          )}

          <div className={styles.paymentDetails}>
            <div className={styles.paymentAmount}>
              <span className={styles.paymentLabel}>Monto a pagar:</span>
              <span className={styles.paymentValue}>
                ${DEFAULT_PERMIT_FEE.toFixed(2)} {DEFAULT_CURRENCY}
              </span>
            </div>
          </div>

          <div className={styles.formNavigation}>
            <Button
              variant="secondary"
              onClick={onPrevious}
              icon={<FaArrowLeft />}
              className={styles.navigationButton}
            >
              Anterior
            </Button>

            <Button
              variant="primary"
              htmlType="submit"
              disabled={isSubmitting}
              className={styles.navigationButton}
              icon={
                !isSubmitting ? (
                  paymentMethod === 'card' ? (
                    <FaCreditCard />
                  ) : (
                    <FaStore />
                  )
                ) : undefined
              }
            >
              {isSubmitting ? (
                <>
                  <div className={styles.loadingSpinner}></div>
                  Procesando...
                </>
              ) : paymentMethod === 'card' ? (
                'Pagar con Tarjeta'
              ) : (
                'Generar Referencia OXXO'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentFormStep;
