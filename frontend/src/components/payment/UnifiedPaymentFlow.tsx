import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCreditCard,
  FaStore,
  FaLock,
  FaExclamationTriangle,
  FaInfoCircle,
  FaArrowLeft,
} from 'react-icons/fa';
import { PaymentIntent } from '@stripe/stripe-js';

import { StripeProvider } from '../../contexts/StripeContext';
import { 
  createPaymentIntent, 
  createOxxoPayment,
  OxxoPaymentDetails 
} from '../../services/stripePaymentService';
import styles from '../permit-form/CompleteForm.module.css';
import Icon from '../../shared/components/ui/Icon';
import Button from '../ui/Button/Button';
import Alert from '../ui/Alert/Alert';
import SecurePaymentElement from './SecurePaymentElement';
import PaymentErrorBoundary from './PaymentErrorBoundary';
import { useToast } from '../../shared/hooks/useToast';

export type PaymentMethod = 'card' | 'oxxo';

interface UnifiedPaymentFlowProps {
  applicationId: string;
  customerId: string;
  onPrevious: () => void;
  onCardPaymentSuccess: (paymentIntentId: string) => void;
  onOxxoPaymentCreated: (oxxoDetails: OxxoPaymentDetails) => void;
  isSubmitting?: boolean;
}


interface PaymentState {
  selectedMethod: PaymentMethod;
  cardInitStatus: 'idle' | 'loading' | 'ready' | 'error';
  oxxoStatus: 'idle' | 'creating' | 'error';
  clientSecret: string | null;
  paymentIntentId: string | null;
  amount: number | null;
  error: string | null;
}

const UnifiedPaymentFlow: React.FC<UnifiedPaymentFlowProps> = ({
  applicationId,
  customerId,
  onPrevious,
  onCardPaymentSuccess,
  onOxxoPaymentCreated,
  isSubmitting = false,
}) => {
  const { showToast } = useToast();
  const [state, setState] = useState<PaymentState>({
    selectedMethod: 'card',
    cardInitStatus: 'idle',
    oxxoStatus: 'idle',
    clientSecret: null,
    paymentIntentId: null,
    amount: null,
    error: null,
  });

  // Initialize card payment when component mounts or when switching to card
  useEffect(() => {
    if (state.selectedMethod === 'card' && state.cardInitStatus === 'idle') {
      initializeCardPayment();
    }
  }, [state.selectedMethod]);

  const initializeCardPayment = async () => {
    setState(prev => ({ ...prev, cardInitStatus: 'loading', error: null }));

    try {
      const response = await createPaymentIntent(applicationId, customerId);
      
      if (!response.clientSecret) {
        throw new Error('No se recibió la clave de pago del servidor');
      }


      setState(prev => ({
        ...prev,
        cardInitStatus: 'ready',
        clientSecret: response.clientSecret,
        paymentIntentId: response.paymentIntentId,
        amount: typeof response.amount === 'string' 
          ? parseFloat(response.amount) 
          : response.amount,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        cardInitStatus: 'error',
        error: error.message || 'Error al inicializar el pago con tarjeta',
      }));
    }
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setState(prev => ({
      ...prev,
      selectedMethod: method,
      error: null,
      // Reset OXXO status when switching methods
      oxxoStatus: method === 'oxxo' ? 'idle' : prev.oxxoStatus,
    }));
  };

  const handleCardPaymentSuccess = useCallback(async (paymentIntent: PaymentIntent) => {
    try {
      await onCardPaymentSuccess(paymentIntent.id);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: 'Error al confirmar el pago. Por favor, contacta soporte.',
      }));
    }
  }, [onCardPaymentSuccess]);

  const handleCardPaymentError = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      error: message,
    }));
  }, []);

  const handleOxxoPayment = async () => {
    if (state.oxxoStatus === 'creating' || isSubmitting) return;

    setState(prev => ({ ...prev, oxxoStatus: 'creating', error: null }));

    try {
      showToast('Generando referencia OXXO...', 'info');
      const oxxoResponse = await createOxxoPayment(applicationId, customerId);
      
      if (!oxxoResponse.success) {
        throw new Error('No se pudo generar la referencia OXXO');
      }

      setState(prev => ({ ...prev, oxxoStatus: 'idle' }));
      onOxxoPaymentCreated(oxxoResponse);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        oxxoStatus: 'error',
        error: error.message || 'Error al generar la referencia OXXO',
      }));
      showToast(error.message || 'Error al generar la referencia OXXO', 'error');
    }
  };

  const retryCardPayment = () => {
    setState(prev => ({ ...prev, cardInitStatus: 'idle' }));
    initializeCardPayment();
  };

  const isProcessing = isSubmitting || 
    state.cardInitStatus === 'loading' || 
    state.oxxoStatus === 'creating';


  return (
    <div className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <Icon IconComponent={FaCreditCard} className={styles.formSectionIcon} size="lg" />
        <h2 className={styles.formSectionTitle}>Información de Pago</h2>
      </div>

      <div className={styles.formSectionContent}>
        {/* Security Notice */}
        <div className={styles.infoBox}>
          <Icon IconComponent={FaLock} className={styles.infoIcon} size="md" />
          <p className={styles.infoText}>
            Tu información de pago está segura. Utilizamos Stripe con encriptación 
            de grado bancario para proteger tus datos.
          </p>
        </div>

        {/* Payment Method Selection */}
        <div className={styles.paymentMethodSelector}>
          <h3 className={styles.paymentMethodTitle}>Selecciona tu método de pago:</h3>
          <div className={styles.paymentMethodOptions}>
            <button
              type="button"
              className={`${styles.paymentMethodOption} ${
                state.selectedMethod === 'card' ? styles.paymentMethodOptionSelected : ''
              }`}
              onClick={() => handlePaymentMethodChange('card')}
              disabled={isProcessing}
            >
              <Icon IconComponent={FaCreditCard} className={styles.paymentMethodIcon} size="md" />
              <span>Tarjeta (Crédito/Débito)</span>
            </button>
            
            <button
              type="button"
              className={`${styles.paymentMethodOption} ${
                state.selectedMethod === 'oxxo' ? styles.paymentMethodOptionSelected : ''
              }`}
              onClick={() => handlePaymentMethodChange('oxxo')}
              disabled={isProcessing}
            >
              <Icon IconComponent={FaStore} className={styles.paymentMethodIcon} size="md" />
              <span>OXXO</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {state.error && (
          <Alert variant="error">
            {state.error}
          </Alert>
        )}

        {/* Card Payment Section */}
        {state.selectedMethod === 'card' && (
          <div className={styles.cardDetailsSection}>
            {state.cardInitStatus === 'loading' && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Inicializando sistema de pago...</p>
              </div>
            )}

            {state.cardInitStatus === 'error' && (
              <div className={styles.errorContainer}>
                <Icon 
                  IconComponent={FaExclamationTriangle} 
                  className={styles.errorIcon} 
                  size="md" 
                />
                <p className={styles.errorText}>
                  No se pudo inicializar el pago con tarjeta.
                </p>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={retryCardPayment}
                  disabled={isProcessing}
                >
                  Reintentar
                </Button>
                <p className={styles.alternativeText}>
                  O puedes seleccionar OXXO como método alternativo de pago.
                </p>
              </div>
            )}

            {state.cardInitStatus === 'ready' && state.clientSecret && (
              <PaymentErrorBoundary onRetry={retryCardPayment}>
                <StripeProvider clientSecret={state.clientSecret}>
                  <SecurePaymentElement
                    clientSecret={state.clientSecret}
                    onPaymentSuccess={handleCardPaymentSuccess}
                    onPaymentError={handleCardPaymentError}
                    isSubmitting={isProcessing}
                  />
                </StripeProvider>
              </PaymentErrorBoundary>
            )}
          </div>
        )}

        {/* OXXO Payment Section */}
        {state.selectedMethod === 'oxxo' && (
          <div className={styles.oxxoSection}>
            <div className={styles.infoBox}>
              <Icon IconComponent={FaInfoCircle} className={styles.infoIcon} size="md" />
              <div>
                <p className={styles.infoText}>
                  <strong>Pago en efectivo en OXXO</strong>
                </p>
                <ul className={styles.oxxoInfoList}>
                  <li>Recibirás una referencia única para pagar en cualquier OXXO</li>
                  <li>Tendrás 3 días (72 horas) para realizar el pago</li>
                  <li>Tu permiso se generará automáticamente al confirmar el pago</li>
                </ul>
              </div>
            </div>

            <div className={styles.formNavigation}>
              <Button
                type="button"
                variant="secondary"
                onClick={onPrevious}
                disabled={isProcessing}
                icon={<Icon IconComponent={FaArrowLeft} size="sm" />}
              >
                Anterior
              </Button>
              
              <Button
                type="button"
                variant="primary"
                onClick={handleOxxoPayment}
                disabled={isProcessing}
                icon={<Icon IconComponent={FaStore} size="sm" />}
                iconAfter
              >
                {state.oxxoStatus === 'creating' ? 'Generando...' : 'Generar Ficha OXXO'}
              </Button>
            </div>
          </div>
        )}

        {/* Navigation for Card Payment */}
        {state.selectedMethod === 'card' && state.cardInitStatus !== 'ready' && (
          <div className={styles.formNavigation}>
            <Button
              type="button"
              variant="secondary"
              onClick={onPrevious}
              disabled={isProcessing}
              icon={<Icon IconComponent={FaArrowLeft} size="sm" />}
            >
              Anterior
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedPaymentFlow;