import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import styles from './PaymentResultPage.module.css';

const PaymentErrorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Extract application ID, error message, and error code from query parameters if available
  const queryParams = new URLSearchParams(location.search);
  const applicationId = queryParams.get('id');
  const errorMessage = queryParams.get('message') || 'Hubo un problema al procesar tu pago.';
  const errorCode = queryParams.get('code');

  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    '3ds_declined': 'La autenticación 3D Secure fue rechazada por tu banco.',
    '3ds_timeout': 'La autenticación 3D Secure expiró. Por favor, intenta de nuevo.',
    '3ds_canceled': 'La autenticación 3D Secure fue cancelada.',
    'card_declined': 'Tu tarjeta fue rechazada. Por favor, intenta con otra tarjeta.',
    'insufficient_funds': 'Fondos insuficientes en la tarjeta.',
    'expired_card': 'La tarjeta ha expirado.',
    'processing_error': 'Error al procesar el pago. Por favor, intenta de nuevo más tarde.',
    'invalid_cvc': 'El código de seguridad (CVC) es inválido.',
    'invalid_card': 'Los datos de la tarjeta son inválidos.',
    'authentication_required': 'Se requiere autenticación adicional. Por favor, contacta a tu banco.'
  };

  // Get specific error message if code is available
  const specificErrorMessage = errorCode && errorMessages[errorCode]
    ? errorMessages[errorCode]
    : errorMessage;

  useEffect(() => {
    // Show error toast when component mounts
    showToast('Hubo un problema con tu pago', 'error');
  }, []);

  // Navigate to the specific permit details if ID is available, otherwise to dashboard
  const handleTryAgain = () => {
    if (applicationId) {
      navigate(`/permits/${applicationId}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          <div className={styles.errorIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>Hubo un problema con tu pago</h1>

        <p className={styles.message}>
          {specificErrorMessage}
        </p>

        <p className={styles.submessage}>
          {errorCode === '3ds_declined' || errorCode === '3ds_timeout' || errorCode === '3ds_canceled'
            ? 'La verificación 3D Secure es un requisito de seguridad de tu banco. Por favor, intenta de nuevo o usa otra tarjeta.'
            : 'Por favor, inténtalo de nuevo o contacta a soporte si el problema persiste.'}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleTryAgain}
          >
            {applicationId ? 'Intentar de Nuevo' : 'Volver a mi panel'}
          </button>

          <Link to="/contact" className={styles.secondaryButton}>
            Contactar Soporte
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentErrorPage;
