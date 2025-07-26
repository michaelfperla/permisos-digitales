import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaRedo, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import Button from '../ui/Button/Button';
import Icon from '../../shared/components/ui/Icon';
import { getPaymentStatus } from '../../services/stripePaymentService';
import styles from './PaymentRecovery.module.css';

interface PaymentRecoveryProps {
  applicationId: string;
  paymentIntentId?: string;
  onRecoverySuccess?: (result: any) => void;
  onRecoveryFailed?: (error: string) => void;
  className?: string;
}

interface RecoveryStatus {
  isRecovering: boolean;
  lastAttempt?: Date;
  attempts: number;
  maxAttempts: number;
  canRetry: boolean;
  nextRetryIn?: number;
}

const PaymentRecovery: React.FC<PaymentRecoveryProps> = ({
  applicationId,
  paymentIntentId,
  onRecoverySuccess,
  onRecoveryFailed,
  className = ''
}) => {
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({
    isRecovering: false,
    attempts: 0,
    maxAttempts: 3,
    canRetry: true
  });
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    // Auto-check payment status on mount if we have a payment intent
    if (paymentIntentId && !recoveryStatus.isRecovering) {
      checkPaymentStatus();
    }
  }, [paymentIntentId]);

  const checkPaymentStatus = async () => {
    if (!paymentIntentId) {
      setStatusMessage('No hay información de pago para verificar.');
      return;
    }

    setIsCheckingStatus(true);
    setStatusMessage('Verificando estado del pago...');

    try {
      const status = await getPaymentStatus(applicationId, paymentIntentId);
      
      if (status.status === 'succeeded') {
        setStatusMessage('¡Pago confirmado exitosamente!');
        onRecoverySuccess?.(status);
      } else if (status.status === 'processing') {
        setStatusMessage('El pago está siendo procesado. Por favor, espere...');
        // Schedule another check in 30 seconds
        setTimeout(() => {
          if (!recoveryStatus.isRecovering) {
            checkPaymentStatus();
          }
        }, 30000);
      } else if (status.status === 'requires_action') {
        setStatusMessage('El pago requiere autenticación adicional. Por favor, complete el proceso en su banco.');
      } else if (status.status === 'requires_payment_method') {
        setStatusMessage('Se requiere un nuevo método de pago. Por favor, intente nuevamente.');
      } else {
        setStatusMessage(`Estado del pago: ${status.status}. ${status.lastError || ''}`);
      }
    } catch (error: any) {
      setStatusMessage(`Error al verificar el estado: ${error.message}`);
      onRecoveryFailed?.(error.message);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const attemptRecovery = async () => {
    if (!recoveryStatus.canRetry || recoveryStatus.attempts >= recoveryStatus.maxAttempts) {
      setStatusMessage('Se ha alcanzado el número máximo de intentos de recuperación.');
      return;
    }

    setRecoveryStatus(prev => ({
      ...prev,
      isRecovering: true,
      attempts: prev.attempts + 1,
      lastAttempt: new Date()
    }));

    setStatusMessage('Intentando recuperar el pago...');

    try {
      // First, check the current payment status
      await checkPaymentStatus();
      
      // If that doesn't resolve it, we could implement additional recovery logic here
      // For now, we'll just update the retry status
      
      setRecoveryStatus(prev => ({
        ...prev,
        isRecovering: false,
        canRetry: prev.attempts < prev.maxAttempts - 1
      }));

    } catch (error: any) {
      setRecoveryStatus(prev => ({
        ...prev,
        isRecovering: false,
        canRetry: prev.attempts < prev.maxAttempts - 1
      }));
      
      setStatusMessage(`Error durante la recuperación: ${error.message}`);
      onRecoveryFailed?.(error.message);
    }
  };

  const retryPayment = () => {
    // This would typically redirect to the payment form or trigger a new payment flow
    window.location.reload();
  };

  return (
    <div className={`${styles.recoveryContainer} ${className}`}>
      <div className={styles.recoveryHeader}>
        <Icon 
          IconComponent={FaExclamationTriangle} 
          className={styles.warningIcon}
          size="lg"
          color="var(--color-warning)"
        />
        <h3>Recuperación de Pago</h3>
      </div>

      <div className={styles.statusSection}>
        <p className={styles.statusMessage}>
          {statusMessage || 'Listo para verificar el estado del pago.'}
        </p>

        {recoveryStatus.lastAttempt && (
          <p className={styles.lastAttempt}>
            Último intento: {recoveryStatus.lastAttempt.toLocaleString()}
          </p>
        )}

        <div className={styles.attemptsInfo}>
          <span>Intentos: {recoveryStatus.attempts} / {recoveryStatus.maxAttempts}</span>
        </div>
      </div>

      <div className={styles.actionButtons}>
        <Button
          variant="secondary"
          onClick={checkPaymentStatus}
          disabled={isCheckingStatus || recoveryStatus.isRecovering}
          className={styles.checkButton}
        >
          {isCheckingStatus ? (
            <>
              <Icon IconComponent={FaSpinner} className={styles.spinningIcon} size="sm" />
              Verificando...
            </>
          ) : (
            <>
              <Icon IconComponent={FaCheckCircle} size="sm" />
              Verificar Estado
            </>
          )}
        </Button>

        {recoveryStatus.canRetry && (
          <Button
            variant="primary"
            onClick={attemptRecovery}
            disabled={recoveryStatus.isRecovering || isCheckingStatus}
            className={styles.recoveryButton}
          >
            {recoveryStatus.isRecovering ? (
              <>
                <Icon IconComponent={FaSpinner} className={styles.spinningIcon} size="sm" />
                Recuperando...
              </>
            ) : (
              <>
                <Icon IconComponent={FaRedo} size="sm" />
                Intentar Recuperación
              </>
            )}
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={retryPayment}
          disabled={recoveryStatus.isRecovering || isCheckingStatus}
          className={styles.retryButton}
        >
          Reintentar Pago
        </Button>
      </div>

      <div className={styles.helpText}>
        <h4>¿Qué puedo hacer?</h4>
        <ul>
          <li><strong>Verificar Estado:</strong> Comprueba si el pago se procesó correctamente</li>
          <li><strong>Intentar Recuperación:</strong> Intenta recuperar automáticamente el pago</li>
          <li><strong>Reintentar Pago:</strong> Inicia un nuevo proceso de pago</li>
        </ul>
        
        <p className={styles.contactInfo}>
          Si continúas teniendo problemas, contacta a soporte en{' '}
          <a href="mailto:contacto@permisosdigitales.com.mx" className="text-link">
            contacto@permisosdigitales.com.mx
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentRecovery;
