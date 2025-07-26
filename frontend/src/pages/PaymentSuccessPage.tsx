import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import styles from './PaymentResultPage.module.css';
import Button from '../components/ui/Button/Button';
import { useToast } from '../shared/hooks/useToast';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Extract application ID and payment method from query parameters if available
  const queryParams = new URLSearchParams(location.search);
  const applicationId = queryParams.get('application_id') || queryParams.get('id');
  const paymentMethod = queryParams.get('method') || 'card';
  const is3dsPayment = queryParams.get('is3ds') === 'true';

  useEffect(() => {
    // Show success toast when component mounts
    showToast('¡Pago completado exitosamente!', 'success');
    
    // Invalidate relevant queries to ensure fresh data and trigger status polling
    if (applicationId) {
      // Invalidate the specific application query
      queryClient.invalidateQueries({
        queryKey: ['application', applicationId]
      });
      
      // Invalidate dashboard/user applications queries
      queryClient.invalidateQueries({
        queryKey: ['userApplications']
      });
      
      // Invalidate applications list queries
      queryClient.invalidateQueries({
        queryKey: ['applications']
      });
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable but adding it would cause infinite re-renders
  }, [applicationId, queryClient]);

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>¡Pago Completado!</h1>

        <p className={styles.message}>
          {is3dsPayment
            ? 'Tu pago ha sido verificado y procesado exitosamente con autenticación 3D Secure.'
            : 'Tu pago ha sido procesado exitosamente. Tu permiso está siendo generado.'}
        </p>

        <p className={styles.submessage}>
          {paymentMethod === 'card'
            ? 'El proceso de generación del permiso puede tomar unos minutos. Podrás ver tu posición en la cola de generación.'
            : 'Tu permiso será activado una vez que confirmemos tu pago. Puedes revisar el estado de tu permiso en cualquier momento.'}
        </p>

        <div className={styles.actions}>
          <Button variant="primary" onClick={handleContinue} className={styles.actionButton}>
            {applicationId ? 'Ver Detalles del Permiso' : 'Ir al Panel Principal'}
          </Button>

          {!applicationId && (
            <Button variant="secondary" to="/dashboard" className={styles.actionButton}>
              Ir al Panel Principal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
