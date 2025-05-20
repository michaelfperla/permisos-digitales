import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaCar,
  FaClipboardCheck,
  FaCheckCircle,
  FaInfoCircle,
  FaChartBar,
  FaArrowLeft,
  FaArrowRight,
  FaSave,
  FaCreditCard,
  FaStore
} from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';
import applicationService from '../services/applicationService';
import Button from '../components/ui/Button/Button';
import paymentService from '../services/paymentService';
import { ApplicationFormData } from '../types/application.types';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';
import styles from '../components/permit-form/CompleteForm.module.css';
import pageStyles from './CompletePermitFormPage.module.css';

// Import step components
import PersonalInfoStep from '../components/permit-form/PersonalInfoStep';
import CompleteVehicleInfoStep from '../components/permit-form/CompleteVehicleInfoStep';
import CompleteReviewStep from '../components/permit-form/CompleteReviewStep';
import PaymentFormStep from '../components/permit-form/PaymentFormStep';
import ConfirmationStep from '../components/permit-form/ConfirmationStep';
import OxxoConfirmationStep from '../components/permit-form/OxxoConfirmationStep';

// Step types
type FormStep = 'intro' | 'personal' | 'vehicle' | 'review' | 'payment' | 'confirmation' | 'oxxo-confirmation';

// OXXO payment details type
interface OxxoPaymentDetails {
  reference: string;
  amount: number;
  currency: string;
  expiresAt: string;
  barcodeUrl?: string;
}

const CompletePermitFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Form state
  const [currentStep, setCurrentStep] = useState<FormStep>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string>('');

  // Form data
  const [formData, setFormData] = useState({
    nombre_completo: '',
    curp_rfc: '',
    domicilio: '',
    marca: '',
    linea: '',
    color: '',
    numero_serie: '',
    numero_motor: '',
    ano_modelo: ''
  });

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Completed steps
  const [completedSteps, setCompletedSteps] = useState({
    intro: false,
    personal: false,
    vehicle: false,
    review: false,
    payment: false
  });

  // Payment related state
  const [paymentToken, setPaymentToken] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'oxxo'>('card');
  const [paymentDeviceSessionId, setPaymentDeviceSessionId] = useState<string>('');
  const [oxxoDetails, setOxxoDetails] = useState<OxxoPaymentDetails | null>(null);

  // Steps configuration
  const steps = [
    { id: 'intro', label: 'Introducción', icon: <FaInfoCircle /> },
    { id: 'personal', label: 'Datos Personales', icon: <FaUser /> },
    { id: 'vehicle', label: 'Datos del Vehículo', icon: <FaCar /> },
    { id: 'review', label: 'Revisar', icon: <FaClipboardCheck /> },
    { id: 'payment', label: 'Pago', icon: <FaCreditCard /> },
    { id: 'confirmation', label: 'Confirmación', icon: <FaCheckCircle /> }
  ];

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('permitFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(parsedData);

        // Check if we have enough data to mark steps as completed
        if (parsedData.nombre_completo && parsedData.curp_rfc && parsedData.domicilio) {
          setCompletedSteps(prev => ({ ...prev, intro: true, personal: true }));
        }

        if (parsedData.marca && parsedData.linea && parsedData.color &&
            parsedData.numero_serie && parsedData.numero_motor && parsedData.ano_modelo) {
          setCompletedSteps(prev => ({ ...prev, vehicle: true }));
        }

        showToast('Se ha cargado información guardada previamente', 'info');
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
  }, []);

  // Update form data
  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...data };
      // Save to localStorage
      localStorage.setItem('permitFormData', JSON.stringify(newData));
      return newData;
    });
  };

  // Calculate completion percentage
  const calculateCompletion = () => {
    let total = 0;
    let completed = 0;

    // Personal info fields (3)
    total += 3;
    if (formData.nombre_completo) completed++;
    if (formData.curp_rfc) completed++;
    if (formData.domicilio) completed++;

    // Vehicle info fields (6)
    total += 6;
    if (formData.marca) completed++;
    if (formData.linea) completed++;
    if (formData.color) completed++;
    if (formData.numero_serie) completed++;
    if (formData.numero_motor) completed++;
    if (formData.ano_modelo) completed++;

    return Math.round((completed / total) * 100);
  };

  // Get the appropriate CSS class for the progress fill based on completion percentage
  const getProgressFillClass = (percentage: number) => {
    // Round to the nearest 10
    const roundedPercentage = Math.round(percentage / 10) * 10;
    return styles[`progressFill${roundedPercentage}`] || styles.progressFill0;
  };

  // Handle next step
  const handleNextStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1].id as FormStep;
      setCurrentStep(nextStep);

      // Mark current step as completed
      setCompletedSteps(prev => ({
        ...prev,
        [currentStep]: true
      }));

      // Scroll to top
      window.scrollTo(0, 0);
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1].id as FormStep;
      setCurrentStep(prevStep);

      // Scroll to top
      window.scrollTo(0, 0);
    }
  };

  // Go to specific step
  const goToStep = (step: FormStep) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  // Handle payment token, method, and deviceSessionId received from PaymentFormStep
  const handlePaymentToken = (token: string | null, method: 'card' | 'oxxo', deviceSessionId: string) => {
    setPaymentToken(token || '');
    setPaymentMethod(method);
    setPaymentDeviceSessionId(deviceSessionId);

    // Mark payment step as completed
    setCompletedSteps(prev => ({
      ...prev,
      payment: true
    }));

    // Submit the application with the payment token, method, and deviceSessionId
    handleSubmitWithPayment(token || '', method, deviceSessionId);
  };

  // Handle form submission with payment token, method, and deviceSessionId
  const handleSubmitWithPayment = async (token: string, method: string, deviceSessionId: string) => {
    setIsSubmitting(true);

    try {
      // Add user email for better payment processing
      // This is important for Conekta to send payment notifications
      const userEmail = localStorage.getItem('userEmail') || '';

      // Prepare data for submission
      const applicationData: ApplicationFormData = {
        ...formData,
        ano_modelo: typeof formData.ano_modelo === 'string'
          ? parseInt(formData.ano_modelo)
          : formData.ano_modelo || 0,
        payment_token: token, // Add the payment token to the submission data (empty for OXXO)
        payment_method: method, // Add the payment method to the submission data
        device_session_id: deviceSessionId, // Add the device session ID for fraud prevention
        email: userEmail // Add user email for payment notifications
      };

      // Log the data being submitted for debugging (without sensitive info)
      console.log('Submitting Application Data:', {
        ...applicationData,
        payment_token: token ? token.substring(0, 8) + '...' : 'null',
        device_session_id: deviceSessionId ? deviceSessionId.substring(0, 8) + '...' : 'null',
        payment_method: method
      });

      // Submit application
      const response = await applicationService.createApplication(applicationData);

      // Log the entire response for debugging
      console.log('Complete application response:', response);

      if (response.success) {
        // Clear localStorage after successful submission
        localStorage.removeItem('permitFormData');

        // Set application ID for confirmation step
        setApplicationId(response.application.id);

        // Handle different payment methods
        if (method === 'oxxo') {
          try {
            // Process OXXO payment using our payment service
            const oxxoPaymentResult = await paymentService.processOxxoPayment(
              response.application.id,
              response.customerId || response.application.user_id
            );

            if (oxxoPaymentResult.success) {
              // Store OXXO payment details
              setOxxoDetails({
                reference: oxxoPaymentResult.oxxoReference || '',
                amount: DEFAULT_PERMIT_FEE,
                currency: DEFAULT_CURRENCY,
                expiresAt: oxxoPaymentResult.expiresAt ?
                  new Date(oxxoPaymentResult.expiresAt * 1000).toISOString() :
                  new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                barcodeUrl: oxxoPaymentResult.barcodeUrl || undefined
              });

              // Set application ID for confirmation step
              if (!applicationId && response.application && response.application.id) {
                setApplicationId(response.application.id);
              }

              // Move to OXXO confirmation step
              setCurrentStep('oxxo-confirmation');
              showToast('Referencia OXXO generada exitosamente', 'success');
            } else {
              // If OXXO payment processing failed, show error
              showToast(oxxoPaymentResult.message || 'Error al generar referencia OXXO', 'error');
              setCurrentStep('payment');
            }
          } catch (error) {
            console.error('Error processing OXXO payment:', error);

            // If there was an error, try to use fallback values from the application response
            if (response.payment && response.oxxo) {
              // Store OXXO payment details from application response
              setOxxoDetails({
                reference: response.oxxo.reference,
                amount: response.oxxo.amount || DEFAULT_PERMIT_FEE,
                currency: response.oxxo.currency || DEFAULT_CURRENCY,
                expiresAt: response.oxxo.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                barcodeUrl: response.oxxo.barcodeUrl
              });

              // Set application ID for confirmation step if not already set
              if (!applicationId && response.application && response.application.id) {
                setApplicationId(response.application.id);
              }

              // Move to OXXO confirmation step
              setCurrentStep('oxxo-confirmation');
              showToast('Referencia OXXO generada exitosamente', 'success');
            } else {
              // If all else fails, show error and return to payment step
              showToast('Error al generar referencia OXXO. Por favor intente de nuevo.', 'error');
              setCurrentStep('payment');
            }
          }
        } else {
          // For card payments, check if payment was successful
          if (response.payment && response.payment.success) {
            // Payment successful, proceed to confirmation
            setCurrentStep('confirmation');
            showToast('Solicitud enviada exitosamente', 'success');
          } else {
            // Payment failed or declined
            showToast(
              response.payment?.message || 'Error en el pago. Por favor intente con otra tarjeta.',
              'error'
            );
            setCurrentStep('payment');
          }
        }
      } else {
        // Check if this is a payment error
        if (response.paymentError) {
          console.error('Payment error:', response);

          // Show a more specific error message for payment errors
          const errorMessage = response.message || 'Error al procesar el pago. Por favor, intenta con otra tarjeta.';
          showToast(errorMessage, 'error');

          // Return to payment step to allow the user to try again
          setCurrentStep('payment');

          // If there's a specific error code, log it for debugging
          if (response.errorCode) {
            console.error(`Payment error code: ${response.errorCode}`);
          }
        } else {
          // For other errors, just show the error message
          showToast(response.message || 'Error al enviar la solicitud', 'error');
        }
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      showToast('Error al enviar la solicitud. Por favor intente de nuevo.', 'error');

      // Return to payment step to allow the user to try again
      setCurrentStep('payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle review step completion - proceed to payment
  const handleSubmit = () => {
    // Mark review step as completed
    setCompletedSteps(prev => ({
      ...prev,
      review: true
    }));

    // Move to payment step
    setCurrentStep('payment');
  };

  // Save progress manually
  const saveProgress = () => {
    localStorage.setItem('permitFormData', JSON.stringify(formData));
    showToast('Progreso guardado correctamente', 'success');
  };

  // Render step indicator
  const renderStepIndicator = () => {
    // Find current step index
    const currentStepIndex = steps.findIndex(step => step.id === currentStep);
    const currentStepNumber = currentStepIndex + 1;
    const totalSteps = steps.length;
    const currentStepName = steps[currentStepIndex]?.label || '';

    return (
      <>
        {/* Desktop Step Indicator */}
        <div className={styles.stepIndicator}>
          {steps.map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = completedSteps[step.id as keyof typeof completedSteps];

            return (
              <div
                key={step.id}
                className={`${styles.step} ${isActive ? styles.stepActive : ''} ${isCompleted ? styles.stepCompleted : ''}`}
              >
                <div className={styles.stepMarker}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div className={styles.stepLabel}>{step.label}</div>
              </div>
            );
          })}
        </div>

        {/* Mobile Step Indicator */}
        <div className={styles.mobileStepIndicator}>
          Paso {currentStepNumber} de {totalSteps}: {currentStepName}
        </div>
      </>
    );
  };

  // Render sidebar
  const renderSidebar = () => {
    // Don't show sidebar on confirmation steps
    if (currentStep === 'confirmation' || currentStep === 'oxxo-confirmation') return null;

    return (
      <div className={styles.formSidebar}>
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}>
            <FaChartBar className={styles.summaryIcon} />
            Resumen de Solicitud
          </h3>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Completado:</span>
            <span className={styles.summaryValue}>{calculateCompletion()}%</span>
          </div>

          <div className={styles.summaryProgress}>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${getProgressFillClass(calculateCompletion())}`}
              ></div>
            </div>
          </div>

          <div className={styles.summarySteps}>
            {steps.map((step, index) => {
              if (step.id === 'confirmation') return null; // Don't show confirmation in summary

              const isActive = currentStep === step.id;
              const isCompleted = completedSteps[step.id as keyof typeof completedSteps];

              return (
                <div
                  key={step.id}
                  className={`${styles.summaryStep} ${isActive ? styles.summaryStepActive : ''} ${isCompleted ? styles.summaryStepCompleted : ''}`}
                >
                  <div className={styles.summaryStepIcon}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span className={styles.summaryStepText}>{step.label}</span>
                  {(isCompleted || isActive) && (
                    <button
                      type="button"
                      className={styles.summaryStepEdit}
                      onClick={() => goToStep(step.id as FormStep)}
                    >
                      Editar
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {formData.marca && formData.linea && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Vehículo:</span>
              <span className={styles.summaryValue}>{formData.marca} {formData.linea}</span>
            </div>
          )}

          {formData.ano_modelo && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Año:</span>
              <span className={styles.summaryValue}>{formData.ano_modelo}</span>
            </div>
          )}

          {formData.color && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Color:</span>
              <span className={styles.summaryValue}>{formData.color}</span>
            </div>
          )}

          <div className={styles.saveProgress}>
            <Button
              variant="secondary"
              size="small"
              onClick={saveProgress}
              icon={<FaSave className={styles.saveProgressIcon} />}
              className={styles.saveProgressButton}
            >
              Guardar progreso
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className={styles.introSection}>
            <h2 className={styles.introTitle}>
              <FaInfoCircle className={styles.introIcon} />
              Bienvenido a la Solicitud de Permiso Digital
            </h2>
            <p className={styles.introText}>
              Complete este formulario para solicitar su permiso de circulación digital. El proceso tomará aproximadamente 5 minutos.
            </p>

            <h3>Necesitará tener a mano:</h3>
            <ul className={styles.introList}>
              <li className={styles.introListItem}>
                <FaInfoCircle className={styles.introListIcon} />
                <span>Identificación oficial (CURP o RFC)</span>
              </li>
              <li className={styles.introListItem}>
                <FaInfoCircle className={styles.introListIcon} />
                <span>Datos completos del vehículo (marca, modelo, año, etc.)</span>
              </li>
              <li className={styles.introListItem}>
                <FaInfoCircle className={styles.introListIcon} />
                <span>Número de serie (VIN) y número de motor del vehículo</span>
              </li>
            </ul>

            <div className={styles.formNavigation}>
              <div></div> {/* Empty div for spacing */}
              <Button
                variant="primary"
                onClick={handleNextStep}
                icon={<FaArrowRight />}
                iconAfter
                className={styles.navigationButton}
              >
                Comenzar
              </Button>
            </div>
          </div>
        );

      case 'personal':
        return (
          <PersonalInfoStep
            formData={{
              nombre_completo: formData.nombre_completo,
              curp_rfc: formData.curp_rfc,
              domicilio: formData.domicilio
            }}
            errors={errors}
            updateFormData={updateFormData}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
          />
        );

      case 'vehicle':
        return (
          <CompleteVehicleInfoStep
            formData={{
              marca: formData.marca,
              linea: formData.linea,
              color: formData.color,
              numero_serie: formData.numero_serie,
              numero_motor: formData.numero_motor,
              ano_modelo: formData.ano_modelo
            }}
            errors={errors}
            updateFormData={updateFormData}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
          />
        );

      case 'review':
        return (
          <CompleteReviewStep
            formData={formData}
            onPrevious={handlePreviousStep}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            goToStep={goToStep}
          />
        );

      case 'payment':
        return (
          <PaymentFormStep
            onPrevious={handlePreviousStep}
            onSubmit={handlePaymentToken}
            isSubmitting={isSubmitting}
          />
        );

      case 'confirmation':
        return (
          <ConfirmationStep
            applicationId={applicationId}
            formData={{
              nombre_completo: formData.nombre_completo,
              marca: formData.marca,
              linea: formData.linea,
              ano_modelo: formData.ano_modelo
            }}
          />
        );

      case 'oxxo-confirmation':
        return oxxoDetails ? (
          <OxxoConfirmationStep
            applicationId={applicationId}
            formData={{
              nombre_completo: formData.nombre_completo,
              marca: formData.marca,
              linea: formData.linea,
              ano_modelo: formData.ano_modelo
            }}
            oxxoDetails={oxxoDetails}
          />
        ) : (
          <div>Error: No se encontraron detalles de pago OXXO</div>
        );

      default:
        return <div>Paso no encontrado</div>;
    }
  };

  return (
    <div className={pageStyles.pageContainer}>
      {currentStep !== 'confirmation' && currentStep !== 'oxxo-confirmation' && (
        <div className={`${styles.formHeader} page-header-main-content`}>
          <h1 className={`${styles.formTitle} ${pageStyles.pageTitle} page-title-h1`}>Solicitud de Permiso Digital</h1>
          <h2 className={`${styles.formSubtitle} ${pageStyles.pageSubtitle} page-subtitle-h2`}>Complete la información para solicitar su permiso</h2>
        </div>
      )}

      {currentStep !== 'confirmation' && currentStep !== 'oxxo-confirmation' && renderStepIndicator()}

      <div className={`${styles.formLayout} ${(currentStep === 'confirmation' || currentStep === 'oxxo-confirmation') ? styles.confirmationLayout : ''}`}>
        <div className={styles.formMain}>
          {renderStepContent()}
        </div>

        {renderSidebar()}
      </div>
    </div>
  );
};

export default CompletePermitFormPage;
