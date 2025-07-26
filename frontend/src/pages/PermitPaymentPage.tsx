// frontend/src/pages/PermitPaymentPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FaCreditCard, FaExclamationTriangle } from 'react-icons/fa';
import pageStyles from '../components/permit-form/CompleteForm.module.css';
import dashboardStyles from './UserDashboardPage.module.css';
import UnifiedPaymentFlow from '../components/payment/UnifiedPaymentFlow';
import Button from '../components/ui/Button/Button';
import { useToast } from '../shared/hooks/useToast';
import { getApplicationById, ApplicationDetails } from '../services/applicationService'; // CORRECTED: Import correct type
import * as stripePaymentService from '../services/stripePaymentService';
import { logger } from '../utils/logger';

const PermitPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: applicationId } = useParams<{ id: string }>();
  const { showToast } = useToast();
  
  logger.info('PermitPaymentPage - Route params:', { applicationId });
  logger.info('PermitPaymentPage - Location:', location);

  const [application, setApplication] = useState<ApplicationDetails | null>(null); // CORRECTED: Use imported type
  const [customerId, setCustomerId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) {
      logger.error('No application ID provided');
      setError('No se proporcionó un ID de solicitud.');
      setIsLoading(false);
      return;
    }

    const fetchApplicationDetails = async () => {
      try {
        logger.info('=== Payment Page Initialization ===');
        logger.info('Application ID:', applicationId);
        
        // Step 1: Fetch application details
        logger.info('Step 1: Fetching application details...');
        const response = await getApplicationById(applicationId);
        logger.info('Application response:', response);
        
        if (!response) {
          throw new Error('Failed to load application details');
        }
        
        if (!response.application) {
          throw new Error('Application not found');
        }
        
        setApplication(response.application);
        logger.info('Application loaded successfully');
        logger.info('Application status:', response.status?.currentStatus);
        
        // Step 2: Create payment order
        logger.info('Step 2: Creating payment order...');
        const orderResponse = await stripePaymentService.createPaymentOrder(applicationId);
        logger.info('Payment order response:', orderResponse);
        
        if (!orderResponse) {
          throw new Error('Failed to create payment session');
        }
        
        if (!orderResponse.customerId) {
          logger.error('Order response missing customerId:', orderResponse);
          throw new Error('Payment session created but customer ID is missing');
        }
        
        setCustomerId(orderResponse.customerId);
        logger.info('Payment session created successfully');
        logger.info('=== Initialization Complete ===');

      } catch (err: any) {
        logger.error("=== Payment Page Error ===");
        logger.error("Error details:", err);
        logger.error("Error message:", err.message);
        logger.error("Error response:", err.response);
        
        setError(err.message || 'Ocurrió un error al cargar los datos para el pago.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicationDetails();
  }, [applicationId]);
  
  const handleCardPaymentSuccess = async (paymentIntentId: string) => {
    setIsSubmitting(true);
    try {
      showToast('Pago procesado exitosamente', 'success');
      navigate(`/payment/success?application_id=${applicationId}&payment_intent=${paymentIntentId}`);
    } catch (err: any) {
      logger.error('Error during card payment submission:', err);
      showToast(err.message || 'Error al procesar el pago.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOxxoPaymentCreated = (oxxoDetails: any) => {
    navigate('/permits/oxxo-confirmation', {
      replace: true,
      state: {
        applicationId: applicationId,
        oxxoDetails: oxxoDetails,
      },
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={pageStyles.loadingContainer}>
          <div className={pageStyles.spinner}></div>
          <p>Cargando información de pago...</p>
        </div>
      );
    }

    if (error || !application || !customerId) {
      return (
        <div className={pageStyles.errorBox}>
            <FaExclamationTriangle />
            <p>{error || 'No se pudo cargar el componente de pago.'}</p>
            {!application && (
              <p className={pageStyles.errorText}>No se encontró la información de la solicitud.</p>
            )}
            {!customerId && application && (
              <p className={pageStyles.errorText}>No se pudo crear la sesión de pago.</p>
            )}
            <Button onClick={() => navigate('/dashboard')}>Volver al inicio</Button>
        </div>
      );
    }

    return (
      <UnifiedPaymentFlow
        applicationId={String(application.id)}
        customerId={customerId}
        onPrevious={() => navigate(`/permits/${application.id}`)}
        onCardPaymentSuccess={handleCardPaymentSuccess}
        onOxxoPaymentCreated={handleOxxoPaymentCreated}
        isSubmitting={isSubmitting}
      />
    );
  };

  return (
    <div className={pageStyles.formContainer}>
      <header className={pageStyles.formHeader}>
        <h1 className={pageStyles.formTitle}>Realizar Pago de Permiso</h1>
        <p className={pageStyles.formSubtitle}>
          {/* CORRECTED: Access the nested vehicleInfo property */}
          {application ? `Solicitud para ${application.vehicleInfo.marca} ${application.vehicleInfo.linea}` : 'Cargando...'}
        </p>
      </header>
      <div className={pageStyles.formLayout}>
        <div className={pageStyles.formMain}>
          <div className={pageStyles.formSection}>
            <div className={pageStyles.formSectionHeader}>
              <FaCreditCard className={pageStyles.formSectionIcon} />
              <h2 className={pageStyles.formSectionTitle}>Pago Seguro</h2>
            </div>
            <div className={pageStyles.formSectionContent}>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermitPaymentPage;