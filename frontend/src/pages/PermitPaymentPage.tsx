import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaCreditCard, FaArrowLeft, FaStore } from 'react-icons/fa';
import styles from '../components/permit-form/CompleteForm.module.css';
import applicationService from '../services/applicationService';
import PaymentFormStep from '../components/permit-form/PaymentFormStep';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

const PermitPaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplicationData = async () => {
      if (!id) {
        setError('ID de permiso no válido');
        setIsLoading(false);
        return;
      }

      try {
        const response = await applicationService.getApplicationById(id);
        if (response && response.application) {
          setApplicationData(response.application);
        } else {
          setError('No se pudo cargar la información del permiso');
        }
      } catch (err) {
        console.error('Error fetching application:', err);
        setError('Error al cargar la información del permiso');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicationData();
  }, [id]);

  const handlePrevious = () => {
    navigate(`/permits/${id}`);
  };

  const handlePaymentToken = (token: string | null, paymentMethod: 'card' | 'oxxo', deviceSessionId: string) => {
    setIsSubmitting(true);

    // Here you would implement the payment processing logic
    // For now, we'll just navigate to the success page
    navigate(`/payment/success?id=${id}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className={styles.formSection}>
        <div className={styles.formSectionHeader}>
          <FaCreditCard className={styles.formSectionIcon} />
          <h2 className={styles.formSectionTitle}>Error</h2>
        </div>
        <div className={styles.formSectionContent}>
          <p className={styles.errorMessage}>{error}</p>
          <button
            type="button"
            className={`${styles.formButton} ${styles.buttonSecondary}`}
            onClick={() => navigate('/dashboard')}
          >
            <FaArrowLeft className={styles.buttonIcon} />
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.formWrapper}>
        <h1 className={styles.formTitle}>Pago de Permiso</h1>

        {applicationData && (
          <div className={styles.applicationSummary}>
            <h3>Resumen de la Solicitud</h3>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Solicitante:</span>
              <span className={styles.summaryValue}>{applicationData.nombre_completo}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Vehículo:</span>
              <span className={styles.summaryValue}>
                {applicationData.marca} {applicationData.linea} {applicationData.ano_modelo}
              </span>
            </div>
          </div>
        )}

        <PaymentFormStep
          onPrevious={handlePrevious}
          onSubmit={handlePaymentToken}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
};

export default PermitPaymentPage;
