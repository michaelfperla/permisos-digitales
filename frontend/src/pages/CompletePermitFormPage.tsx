import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useForm, FormProvider } from 'react-hook-form';
import {
  FaUser,
  FaCar,
  FaClipboardCheck,
  FaCheckCircle,
  FaInfoCircle,
  FaChartBar,
  // FaArrowLeft, // Removed unused
  FaArrowRight,
  FaSave,
  FaCreditCard,
  // FaStore // Removed unused
} from 'react-icons/fa';
import { useLocation } from 'react-router-dom'; // Removed unused useNavigate

import pageStyles from './CompletePermitFormPage.module.css';
import dashboardStyles from './UserDashboardPage.module.css'; // Combined relative imports
import styles from '../components/permit-form/CompleteForm.module.css'; // Combined relative imports
// Import step components
import CompleteReviewStep from '../components/permit-form/CompleteReviewStep';
import CompleteVehicleInfoStep from '../components/permit-form/CompleteVehicleInfoStep';
import ConfirmationStep from '../components/permit-form/ConfirmationStep';
import OxxoConfirmationStep from '../components/permit-form/OxxoConfirmationStep';
import PaymentFormStep from '../components/permit-form/PaymentFormStep';
import PersonalInfoStep from '../components/permit-form/PersonalInfoStep';
import Button from '../components/ui/Button/Button';
import { DEFAULT_PERMIT_FEE, DEFAULT_CURRENCY } from '../constants';
import applicationService from '../services/applicationService';
import paymentService from '../services/paymentService';
import { useToast } from '../shared/hooks/useToast';
import { completePermitSchema, CompletePermitFormData } from '../shared/schemas/permit.schema';
import { ApplicationFormData } from '../types/application.types';

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
  // const navigate = useNavigate(); // Removed unused
  const location = useLocation();
  const { showToast } = useToast();

  // Check if this is a renewal from location state
  const isRenewal = location.state?.isRenewal === true;
  const originalApplicationData = location.state?.originalApplicationData;
  const originalPermitId = location.state?.originalPermitId;

  // Form state
  const [currentStep, setCurrentStep] = useState<FormStep>(isRenewal ? 'review' : 'intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string>('');

  // React Hook Form setup
  const methods = useForm<CompletePermitFormData>({
    resolver: zodResolver(completePermitSchema),
    mode: 'onChange',
    defaultValues: isRenewal && originalApplicationData ? {
      nombre_completo: originalApplicationData.nombre_completo || '',
      curp_rfc: originalApplicationData.curp_rfc || '',
      domicilio: originalApplicationData.domicilio || '',
      marca: originalApplicationData.marca || '',
      linea: originalApplicationData.linea || '',
      color: originalApplicationData.color || '',
      numero_serie: originalApplicationData.numero_serie || '',
      numero_motor: originalApplicationData.numero_motor || '',
      ano_modelo: originalApplicationData.ano_modelo?.toString() || ''
    } : {
      nombre_completo: '',
      curp_rfc: '',
      domicilio: '',
      marca: '',
      linea: '',
      color: '',
      numero_serie: '',
      numero_motor: '',
      ano_modelo: ''
    }
  });

  // Completed steps - mark all steps as completed for renewals
  const [completedSteps, setCompletedSteps] = useState({
    intro: isRenewal,
    personal: isRenewal,
    vehicle: isRenewal,
    review: false,
    payment: false
  });

  // Payment related state
  const [_paymentToken, setPaymentToken] = useState<string>(''); // Prefixed with _
  const [_paymentMethod, setPaymentMethod] = useState<'card' | 'oxxo'>('card'); // Prefixed with _
  const [_paymentDeviceSessionId, setPaymentDeviceSessionId] = useState<string>(''); // Prefixed with _
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

  // Load saved form data from localStorage on mount or show renewal notification
  const renewalNotificationShown = useRef(false); // Changed to useRef

  useEffect(() => {
    if (isRenewal && originalApplicationData && !renewalNotificationShown.current) {
      showToast('Procesando renovación de permiso. Por favor revise la información y proceda al pago.', 'info');
      renewalNotificationShown.current = true;
      return;
    }

    if (!isRenewal) {
      const savedData = localStorage.getItem('permitFormData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          methods.reset(parsedData);
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // Removed dependencies that were causing issues and not strictly needed for this mount logic


  // Removed unused updateFormData function

  // Calculate completion percentage
  const calculateCompletion = () => {
    const formValues = methods.getValues();
    let total = 0;
    let completed = 0;

    total += 3;
    if (formValues.nombre_completo) completed++;
    if (formValues.curp_rfc) completed++;
    if (formValues.domicilio) completed++;

    total += 6;
    if (formValues.marca) completed++;
    if (formValues.linea) completed++;
    if (formValues.color) completed++;
    if (formValues.numero_serie) completed++;
    if (formValues.numero_motor) completed++;
    if (formValues.ano_modelo) completed++;

    return total > 0 ? Math.round((completed / total) * 100) : 0; // Avoid division by zero
  };

  const getProgressFillClass = (percentage: number) => {
    const roundedPercentage = Math.round(percentage / 10) * 10;
    return styles[`progressFill${roundedPercentage}`] || styles.progressFill0;
  };

  const handleNextStep = async () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      let isValid = true;
      if (currentStep === 'personal') {
        isValid = await methods.trigger(['nombre_completo', 'curp_rfc', 'domicilio']);
      } else if (currentStep === 'vehicle') {
        isValid = await methods.trigger(['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo']);
      }
      if (isValid) {
        const nextStep = steps[currentIndex + 1].id as FormStep;
        setCurrentStep(nextStep);
        setCompletedSteps(prev => ({ ...prev, [currentStep]: true }));
        localStorage.setItem('permitFormData', JSON.stringify(methods.getValues()));
        window.scrollTo(0, 0);
      }
    }
  };

  const handlePreviousStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1].id as FormStep;
      setCurrentStep(prevStep);
      window.scrollTo(0, 0);
    }
  };

  const goToStep = (step: FormStep) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const handlePaymentToken = (token: string | null, method: 'card' | 'oxxo', deviceSessionId: string) => {
    setPaymentToken(token || '');
    setPaymentMethod(method);
    setPaymentDeviceSessionId(deviceSessionId);
    setCompletedSteps(prev => ({ ...prev, payment: true }));
    handleSubmitWithPayment(token || '', method, deviceSessionId);
  };

  const handleSubmitWithPayment = async (token: string, paymentMethodType: string, deviceSessionIdVal: string) => {
    setIsSubmitting(true);
    try {
      const userEmail = localStorage.getItem('userEmail') || '';
      const formValues = methods.getValues();
      const applicationData: ApplicationFormData = {
        ...formValues,
        ano_modelo: typeof formValues.ano_modelo === 'string'
          ? parseInt(formValues.ano_modelo)
          : formValues.ano_modelo || 0,
        payment_token: token,
        payment_method: paymentMethodType,
        device_session_id: deviceSessionIdVal,
        email: userEmail
      };

      let response;
      if (isRenewal && originalPermitId) {
        response = await applicationService.createRenewalApplication(originalPermitId, {
          domicilio: formValues.domicilio,
          color: formValues.color,
          renewal_reason: 'Renovación regular',
          renewal_notes: '',
          payment_method: paymentMethodType,
          payment_token: token,
          device_session_id: deviceSessionIdVal
        });
      } else {
        response = await applicationService.createApplication(applicationData);
      }

      if (response.success) {
        localStorage.removeItem('permitFormData');
        setApplicationId(response.application.id);

        if (paymentMethodType === 'oxxo') {
          try {
            const oxxoPaymentResult = await paymentService.processOxxoPayment(
              response.application.id,
              response.customerId || response.application.user_id
            );
            if (oxxoPaymentResult.success) {
              setOxxoDetails({
                reference: oxxoPaymentResult.oxxoReference || '',
                amount: DEFAULT_PERMIT_FEE,
                currency: DEFAULT_CURRENCY,
                expiresAt: oxxoPaymentResult.expiresAt ?
                  new Date(oxxoPaymentResult.expiresAt * 1000).toISOString() :
                  new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                barcodeUrl: oxxoPaymentResult.barcodeUrl || undefined
              });
              if (!applicationId && response.application && response.application.id) {
                setApplicationId(response.application.id);
              }
              setCurrentStep('oxxo-confirmation');
              console.info('Showing OXXO success toast'); // Changed to console.info
              const successType: 'success' = 'success';
              showToast('Referencia OXXO generada exitosamente', successType);
            } else {
              showToast(oxxoPaymentResult.message || 'Error al generar referencia OXXO', 'error');
              setCurrentStep('payment');
            }
          } catch (error) {
            console.error('Error processing OXXO payment:', error);
            if (response.payment && response.oxxo) {
              setOxxoDetails({
                reference: response.oxxo.reference,
                amount: response.oxxo.amount || DEFAULT_PERMIT_FEE,
                currency: response.oxxo.currency || DEFAULT_CURRENCY,
                expiresAt: response.oxxo.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                barcodeUrl: response.oxxo.barcodeUrl
              });
              if (!applicationId && response.application && response.application.id) {
                setApplicationId(response.application.id);
              }
              setCurrentStep('oxxo-confirmation');
              console.info('Showing OXXO fallback success toast'); // Changed to console.info
              const successType: 'success' = 'success';
              showToast('Referencia OXXO generada exitosamente', successType);
            } else {
              showToast('Error al generar referencia OXXO. Por favor intente de nuevo.', 'error');
              setCurrentStep('payment');
            }
          }
        } else {
          if (response.payment && response.payment.success) {
            setCurrentStep('confirmation');
            const successType: 'success' = 'success';
            showToast('Solicitud enviada exitosamente', successType);
          } else {
            showToast(
              response.payment?.message || 'Error en el pago. Por favor intente con otra tarjeta.',
              'error'
            );
            setCurrentStep('payment');
          }
        }
      } else {
        if (response.paymentError) {
          console.error('Payment error:', response);
          const errorMessage = response.message || 'Error al procesar el pago. Por favor, intenta con otra tarjeta.';
          showToast(errorMessage, 'error');
          setCurrentStep('payment');
          if (response.errorCode) {
            console.error(`Payment error code: ${response.errorCode}`);
          }
        } else {
          showToast(response.message || 'Error al enviar la solicitud', 'error');
        }
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      showToast('Error al enviar la solicitud. Por favor intente de nuevo.', 'error');
      setCurrentStep('payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    setCompletedSteps(prev => ({ ...prev, review: true }));
    setCurrentStep('payment');
  };

  const saveProgress = () => {
    localStorage.setItem('permitFormData', JSON.stringify(methods.getValues()));
    const successType: 'success' = 'success';
    showToast('Progreso guardado correctamente', successType);
  };

  const renderSidebar = () => {
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
              <div className={`${styles.progressFill} ${getProgressFillClass(calculateCompletion())}`}></div>
            </div>
          </div>
          <div className={styles.summarySteps}>
            {steps.map((step, index) => {
              if (step.id === 'confirmation') return null;
              const isActive = currentStep === step.id;
              const isCompleted = completedSteps[step.id as keyof typeof completedSteps];
              return (
                <div key={step.id} className={`${styles.summaryStep} ${isActive ? styles.summaryStepActive : ''} ${isCompleted ? styles.summaryStepCompleted : ''}`}>
                  <div className={styles.summaryStepIcon}>{isCompleted ? '✓' : index + 1}</div>
                  <span className={styles.summaryStepText}>{step.label}</span>
                  {(isCompleted || isActive) && (
                    <button type="button" className={styles.summaryStepEdit} onClick={() => goToStep(step.id as FormStep)}>
                      Editar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {methods.watch('marca') && methods.watch('linea') && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Vehículo:</span>
              <span className={styles.summaryValue}>{methods.watch('marca')} {methods.watch('linea')}</span>
            </div>
          )}
          {methods.watch('ano_modelo') && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Año:</span>
              <span className={styles.summaryValue}>{methods.watch('ano_modelo')}</span>
            </div>
          )}
          {methods.watch('color') && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Color:</span>
              <span className={styles.summaryValue}>{methods.watch('color')}</span>
            </div>
          )}
          <div className={styles.saveProgress}>
            <Button variant="secondary" size="small" onClick={saveProgress} icon={<FaSave className={styles.saveProgressIcon} />} className={styles.saveProgressButton}>
              Guardar progreso
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className={styles.introSection}>
            <h2 className={styles.introTitle}><FaInfoCircle className={styles.introIcon} /> Bienvenido a la Solicitud de Permiso Digital</h2>
            <p className={styles.introText}>Complete este formulario para solicitar su permiso de circulación digital. El proceso tomará aproximadamente 5 minutos.</p>
            <h3>Necesitará tener a mano:</h3>
            <ul className={styles.introList}>
              <li className={styles.introListItem}><FaInfoCircle className={styles.introListIcon} /> <span>Identificación oficial (CURP o RFC)</span></li>
              <li className={styles.introListItem}><FaInfoCircle className={styles.introListIcon} /> <span>Datos completos del vehículo (marca, modelo, año, etc.)</span></li>
              <li className={styles.introListItem}><FaInfoCircle className={styles.introListIcon} /> <span>Número de serie (VIN) y número de motor del vehículo</span></li>
            </ul>
            <div className={styles.formNavigation}>
              <div></div>
              <Button variant="primary" onClick={handleNextStep} icon={<FaArrowRight />} iconAfter className={styles.navigationButton}>Comenzar</Button>
            </div>
          </div>
        );
      case 'personal': return <PersonalInfoStep onNext={handleNextStep} onPrevious={handlePreviousStep} />;
      case 'vehicle': return <CompleteVehicleInfoStep onNext={handleNextStep} onPrevious={handlePreviousStep} />;
      case 'review': return <CompleteReviewStep onPrevious={handlePreviousStep} onSubmit={handleSubmit} isSubmitting={isSubmitting} goToStep={goToStep} />;
      case 'payment': return <PaymentFormStep onPrevious={handlePreviousStep} onSubmit={handlePaymentToken} isSubmitting={isSubmitting} />;
      case 'confirmation':
        return <ConfirmationStep applicationId={applicationId} formData={{ nombre_completo: methods.getValues('nombre_completo'), marca: methods.getValues('marca'), linea: methods.getValues('linea'), ano_modelo: methods.getValues('ano_modelo')}} />;
      case 'oxxo-confirmation':
        return oxxoDetails ? <OxxoConfirmationStep applicationId={applicationId} formData={{ nombre_completo: methods.getValues('nombre_completo'), marca: methods.getValues('marca'), linea: methods.getValues('linea'), ano_modelo: methods.getValues('ano_modelo')}} oxxoDetails={oxxoDetails} /> : <div>Error: No se encontraron detalles de pago OXXO</div>;
      default: return <div>Paso no encontrado</div>;
    }
  };

  return (
    <FormProvider {...methods}>
      <div className={pageStyles.pageContainer}>
        <header className={dashboardStyles.pageHeader}>
          <h1 className={dashboardStyles.pageTitle}>Solicitud de Permiso Digital</h1>
          <p className={dashboardStyles.pageSubtitle}>Complete la información para solicitar su permiso</p>
        </header>
        {currentStep !== 'confirmation' && currentStep !== 'oxxo-confirmation' && (
          <div className={styles.stepIndicator}>
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = completedSteps[step.id as keyof typeof completedSteps];
              return (
                <div key={step.id} className={`${styles.step} ${isActive ? styles.stepActive : ''} ${isCompleted ? styles.stepCompleted : ''}`}>
                  <div className={styles.stepMarker}>{isCompleted ? '✓' : index + 1}</div>
                  <div className={styles.stepLabel}>{step.label}</div>
                </div>
              );
            })}
          </div>
        )}
        <div className={`${styles.formLayout} ${(currentStep === 'confirmation' || currentStep === 'oxxo-confirmation') ? styles.confirmationLayout : ''}`}>
          <div className={styles.formMain}>
            {renderStepContent()}
            {currentStep !== 'confirmation' && currentStep !== 'oxxo-confirmation' && (
              <div className={styles.mobileStepIndicator}>
                Paso {steps.findIndex(step => step.id === currentStep) + 1} de {steps.length}: {steps.find(step => step.id === currentStep)?.label || ''}
              </div>
            )}
          </div>
          {renderSidebar()}
        </div>
      </div>
    </FormProvider>
  );
};

export default CompletePermitFormPage;