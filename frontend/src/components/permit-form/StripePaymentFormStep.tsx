import React, { useState, useEffect } from 'react';
import {
  FaCreditCard,
  FaLock,
  FaArrowLeft,
  FaStore,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { Stripe, StripeElements } from '@stripe/stripe-js';

import styles from './CompleteForm.module.css';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../../constants';
import Icon from '../../shared/components/ui/Icon';
import TestCardInfo from '../payment/TestCardInfo';
import Button from "../ui/Button/Button";
import { initializeStripe, isStripeReady } from '../../utils/stripe-loader';

interface StripePaymentFormStepProps {
  onPrevious: () => void;
  onSubmit: (paymentIntentId: string | null, paymentMethod: 'card' | 'oxxo' | 'spei', clientSecret?: string) => void;
  isSubmitting: boolean;
}

const StripePaymentFormStep: React.FC<StripePaymentFormStepProps> = ({
  onPrevious,
  onSubmit,
  isSubmitting,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'oxxo' | 'spei'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isStripeInitialized, setIsStripeInitialized] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  // Initialize Stripe
  useEffect(() => {
    const setupStripe = async () => {
      try {
        if (import.meta.env.DEV) {
          console.info('[StripePayment] Initializing Stripe...');
        }

        const stripeInstance = await initializeStripe();
        
        if (stripeInstance) {
          setStripe(stripeInstance);
          setIsStripeInitialized(true);
          
          if (import.meta.env.DEV) {
            console.info('[StripePayment] Stripe initialized successfully');
          }
        } else {
          throw new Error('Failed to initialize Stripe');
        }
      } catch (error) {
        console.error('[StripePayment] Error initializing Stripe:', error);
        setErrors({
          general: 'Error al inicializar el sistema de pagos. Por favor, recarga la página.'
        });
      }
    };

    setupStripe();
  }, []);

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return; // Prevent multiple submissions
    }

    // Clear previous errors
    setErrors({});

    // For OXXO and SPEI payments, submit directly
    if (paymentMethod === 'oxxo') {
      if (import.meta.env.DEV) {
        console.info('[StripePayment] Submitting with OXXO payment method');
      }
      onSubmit(null, 'oxxo');
      return;
    }

    if (paymentMethod === 'spei') {
      if (import.meta.env.DEV) {
        console.info('[StripePayment] Submitting with SPEI payment method');
      }
      onSubmit(null, 'spei');
      return;
    }

    // For development mode, use test data to bypass validation
    if (import.meta.env.DEV && import.meta.env.VITE_USE_TEST_TOKENS !== 'false') {
      console.info('[StripePayment] Development mode: Using test payment intent');
      onSubmit('pi_test_development_mode', 'card', 'pi_test_development_mode_secret');
      return;
    }

    // Check if Stripe is ready
    if (!isStripeInitialized || !stripe) {
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

    try {
      // Create payment method with Stripe
      const { error, paymentMethod: stripePaymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: {
          number: cardNumber.replace(/\s+/g, ''),
          exp_month: parseInt(expMonth),
          exp_year: parseInt(`20${expYear}`),
          cvc: cvc,
        },
        billing_details: {
          name: cardName.trim(),
        },
      });

      if (error) {
        console.error('[StripePayment] Error creating payment method:', error);
        setErrors({ 
          general: mapStripeErrorToUserMessage(error)
        });
        return;
      }

      if (stripePaymentMethod) {
        if (import.meta.env.DEV) {
          console.info('[StripePayment] Payment method created successfully:', stripePaymentMethod.id);
        }

        // Submit with payment method ID (backend will create payment intent)
        onSubmit(stripePaymentMethod.id, 'card');
      }
    } catch (error) {
      console.error('[StripePayment] Exception during payment method creation:', error);
      setErrors({ 
        general: 'Error al procesar la tarjeta. Por favor, intenta de nuevo.' 
      });
    }
  };

  const mapStripeErrorToUserMessage = (error: any): string => {
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
      default:
        return error.message || 'Error al procesar el pago. Por favor, intente nuevamente o contacte soporte.';
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
            Tu información de pago está segura. Utilizamos Stripe con encriptación de grado bancario para
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

        <form id="stripe-card-form" onSubmit={handleSubmit}>
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
                aria-label="Seleccionar pago en OXXO"
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
                  <Icon
                    IconComponent={FaStore}
                    className={styles.paymentMethodIcon}
                    size="md"
                  />
                  <span className={styles.paymentMethodName}>OXXO</span>
                  <span className={styles.paymentMethodDescription}>
                    Paga en efectivo en cualquier tienda OXXO
                  </span>
                </label>
              </div>

              {/* SPEI Payment Option */}
              <div
                className={`${styles.paymentMethodOption} ${paymentMethod === 'spei' ? styles.paymentMethodOptionSelected : ''}`}
                onClick={() => setPaymentMethod('spei')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setPaymentMethod('spei');
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Seleccionar transferencia bancaria SPEI"
              >
                <input
                  type="radio"
                  id="payment-spei"
                  name="payment-method"
                  className={styles.paymentMethodRadio}
                  checked={paymentMethod === 'spei'}
                  onChange={() => setPaymentMethod('spei')}
                />
                <label htmlFor="payment-spei" className={styles.paymentMethodLabel}>
                  <Icon
                    IconComponent={FaCreditCard}
                    className={styles.paymentMethodIcon}
                    size="md"
                  />
                  <span className={styles.paymentMethodName}>Transferencia Bancaria (SPEI)</span>
                  <span className={styles.paymentMethodDescription}>
                    Transferencia inmediata desde tu banco
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Card Details Form - Only show for card payments */}
          {paymentMethod === 'card' && (
            <div className={styles.cardDetailsSection}>
              <h3 className={styles.cardDetailsTitle}>Detalles de la Tarjeta</h3>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="card-number" className={styles.formLabel}>
                    Número de Tarjeta *
                  </label>
                  <input
                    type="text"
                    id="card-number"
                    className={`${styles.formInput} ${errors.cardNumber ? styles.formInputError : ''}`}
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    maxLength={19}
                    disabled={isSubmitting}
                  />
                  {errors.cardNumber && (
                    <span className={styles.errorText}>{errors.cardNumber}</span>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="card-name" className={styles.formLabel}>
                    Nombre del Titular *
                  </label>
                  <input
                    type="text"
                    id="card-name"
                    className={`${styles.formInput} ${errors.cardName ? styles.formInputError : ''}`}
                    placeholder="Nombre como aparece en la tarjeta"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {errors.cardName && (
                    <span className={styles.errorText}>{errors.cardName}</span>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="exp-month" className={styles.formLabel}>
                    Mes de Expiración *
                  </label>
                  <select
                    id="exp-month"
                    className={`${styles.formInput} ${errors.expMonth ? styles.formInputError : ''}`}
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Mes</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <option key={month} value={month.toString().padStart(2, '0')}>
                        {month.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  {errors.expMonth && (
                    <span className={styles.errorText}>{errors.expMonth}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="exp-year" className={styles.formLabel}>
                    Año de Expiración *
                  </label>
                  <select
                    id="exp-year"
                    className={`${styles.formInput} ${errors.expYear ? styles.formInputError : ''}`}
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Año</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      const shortYear = year.toString().slice(-2);
                      return (
                        <option key={year} value={shortYear}>
                          {shortYear}
                        </option>
                      );
                    })}
                  </select>
                  {errors.expYear && (
                    <span className={styles.errorText}>{errors.expYear}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cvc" className={styles.formLabel}>
                    CVC *
                  </label>
                  <input
                    type="text"
                    id="cvc"
                    className={`${styles.formInput} ${errors.cvc ? styles.formInputError : ''}`}
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    disabled={isSubmitting}
                  />
                  {errors.cvc && (
                    <span className={styles.errorText}>{errors.cvc}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* OXXO Payment Info */}
          {paymentMethod === 'oxxo' && (
            <div className={styles.paymentInfoSection}>
              <div className={styles.infoBox}>
                <Icon IconComponent={FaStore} className={styles.infoIcon} size="md" />
                <div>
                  <h4 className={styles.infoTitle}>Pago en OXXO</h4>
                  <p className={styles.infoText}>
                    Después de confirmar tu solicitud, recibirás una referencia de pago para realizar el pago en efectivo en cualquier tienda OXXO.
                  </p>
                  <ul className={styles.infoList}>
                    <li>El pago debe realizarse dentro de 48 horas</li>
                    <li>Lleva la referencia de pago a cualquier OXXO</li>
                    <li>Tu permiso se procesará automáticamente después del pago</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SPEI Payment Info */}
          {paymentMethod === 'spei' && (
            <div className={styles.paymentInfoSection}>
              <div className={styles.infoBox}>
                <Icon IconComponent={FaCreditCard} className={styles.infoIcon} size="md" />
                <div>
                  <h4 className={styles.infoTitle}>Transferencia Bancaria SPEI</h4>
                  <p className={styles.infoText}>
                    Después de confirmar tu solicitud, recibirás los datos bancarios para realizar una transferencia SPEI desde tu banco.
                  </p>
                  <ul className={styles.infoList}>
                    <li>La transferencia debe realizarse dentro de 24 horas</li>
                    <li>Usa la referencia proporcionada en el concepto de pago</li>
                    <li>Tu permiso se procesará automáticamente después de la transferencia</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className={styles.formActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onPrevious}
              disabled={isSubmitting}
              className={styles.backButton}
            >
              <Icon IconComponent={FaArrowLeft} size="sm" />
              Anterior
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || (!isStripeInitialized && paymentMethod === 'card')}
              className={styles.submitButton}
              form="stripe-card-form"
            >
              {isSubmitting ? (
                'Procesando...'
              ) : (
                <>
                  {paymentMethod === 'card' && 'Procesar Pago'}
                  {paymentMethod === 'oxxo' && 'Generar Referencia OXXO'}
                  {paymentMethod === 'spei' && 'Generar Datos SPEI'}
                </>
              )}
            </Button>
          </div>

          {/* Payment Summary */}
          <div className={styles.paymentSummary}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Costo del Permiso:</span>
              <span className={styles.summaryValue}>
                ${DEFAULT_PERMIT_FEE.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} {DEFAULT_CURRENCY}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Método de Pago:</span>
              <span className={styles.summaryValue}>
                {paymentMethod === 'card' && 'Tarjeta de Crédito/Débito'}
                {paymentMethod === 'oxxo' && 'OXXO'}
                {paymentMethod === 'spei' && 'Transferencia Bancaria SPEI'}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StripePaymentFormStep;
