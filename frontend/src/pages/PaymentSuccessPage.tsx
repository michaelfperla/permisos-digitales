import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import Button from '../components/ui/Button/Button';
import styles from './PaymentResultPage.module.css';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Extract application ID and payment method from query parameters if available
  const queryParams = new URLSearchParams(location.search);
  const applicationId = queryParams.get('id');
  const paymentMethod = queryParams.get('method') || 'card';
  const is3dsPayment = queryParams.get('is3ds') === 'true';

  useEffect(() => {
    // Show success toast when component mounts
    showToast('¡Pago completado exitosamente!', 'success');
  }, []);

  // Navigate to the specific permit details if ID is available, otherwise to dashboard
  const handleContinue = () => {
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
          <div className={styles.successIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>¡Pago Completado!</h1>

        <p className={styles.message}>
          {is3dsPayment
            ? 'Tu pago ha sido verificado y procesado exitosamente con autenticación 3D Secure.'
            : 'Tu pago ha sido procesado exitosamente. Estamos actualizando el estado de tu permiso.'}
        </p>

        <p className={styles.submessage}>
          {paymentMethod === 'card'
            ? 'El proceso de actualización puede tomar unos minutos. Puedes revisar el estado de tu permiso en cualquier momento.'
            : 'Tu permiso será activado una vez que confirmemos tu pago. Puedes revisar el estado de tu permiso en cualquier momento.'}
        </p>

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={handleContinue}
            className={styles.actionButton}
          >
            {applicationId ? 'Ver Detalles del Permiso' : 'Ir al Panel Principal'}
          </Button>

          {!applicationId && (
            <Button
              variant="secondary"
              to="/dashboard"
              className={styles.actionButton}
            >
              Ir al Panel Principal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
