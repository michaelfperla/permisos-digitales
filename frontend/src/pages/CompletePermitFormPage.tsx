// frontend/src/pages/CompletePermitFormPage.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  FaUser,
  FaCar,
  FaClipboardCheck,
  FaCheckCircle,
  FaInfoCircle,
  FaChartBar,
  FaArrowRight,
  FaSave,
  FaCreditCard,
} from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';

import pageStyles from './CompletePermitFormPage.module.css';
import dashboardStyles from './UserDashboardPage.module.css';
import styles from '../components/permit-form/CompleteForm.module.css';
import CompleteReviewStep from '../components/permit-form/CompleteReviewStep';
import CompleteVehicleInfoStep from '../components/permit-form/CompleteVehicleInfoStep';
import ConfirmationStep from '../components/permit-form/ConfirmationStep';
import PersonalInfoStep from '../components/permit-form/PersonalInfoStep';
import UnifiedPaymentFlow from '../components/payment/UnifiedPaymentFlow';
import Button from '../components/ui/Button/Button';
import { getApplicationById, createApplication, submitApplication } from '../services/applicationService';
import * as stripePaymentService from '../services/stripePaymentService';
import * as useAuth from '../shared/hooks/useAuth';
import { useToast } from '../shared/hooks/useToast';
import { completePermitSchema, CompletePermitFormData } from '../shared/schemas/permit.schema';
import { logger } from '../utils/logger';
import { ApplicationFormData } from '../types/application.types';

type FormStep = 'intro' | 'personal' | 'vehicle' | 'review' | 'payment' | 'confirmation';

const CompletePermitFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth.useUserAuth();

  const { isRenewal, originalApplicationData } = location.state || {};

  const [currentStep, setCurrentStep] = useState<FormStep>(isRenewal ? 'review' : 'intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');

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
    } : {},
  });

  const [completedSteps, setCompletedSteps] = useState({
    intro: isRenewal,
    personal: isRenewal,
    vehicle: isRenewal,
    review: false,
    payment: false
  });

  const steps = [
    { id: 'intro', label: 'Introducción', icon: <FaInfoCircle /> },
    { id: 'personal', label: 'Datos Personales', icon: <FaUser /> },
    { id: 'vehicle', label: 'Datos del Vehículo', icon: <FaCar /> },
    { id: 'review', label: 'Revisar', icon: <FaClipboardCheck /> },
    { id: 'payment', label: 'Pago', icon: <FaCreditCard /> },
    { id: 'confirmation', label: 'Confirmación', icon: <FaCheckCircle /> }
  ];

  const renewalNotificationShown = useRef(false);
  const savedDataNotificationShown = useRef(false);
  
  useEffect(() => {
    if (isRenewal && originalApplicationData && !renewalNotificationShown.current) {
      showToast('Procesando renovación de permiso. Por favor revise la información y proceda al pago.', 'info');
      renewalNotificationShown.current = true;
      return;
    }
    if (!isRenewal && !savedDataNotificationShown.current) {
      const savedData = localStorage.getItem('permitFormData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          methods.reset(parsedData);
          if (parsedData.nombre_completo) setCompletedSteps(prev => ({ ...prev, intro: true, personal: true }));
          if (parsedData.marca) setCompletedSteps(prev => ({ ...prev, vehicle: true }));
          showToast('Se ha cargado información guardada previamente', 'info');
          savedDataNotificationShown.current = true;
        } catch (error) {
          logger.error('Error parsing saved form data:', error);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getProgressFillClass = (percentage: number) => {
    const roundedPercentage = Math.round(percentage / 10) * 10;
    return styles[`progressFill${roundedPercentage}`] || styles.progressFill0;
  };

  const handleNextStep = async () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      let isValid = true;
      if (currentStep === 'personal') isValid = await methods.trigger(['nombre_completo', 'curp_rfc', 'domicilio']);
      if (currentStep === 'vehicle') isValid = await methods.trigger(['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo']);
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
      setCurrentStep(steps[currentIndex - 1].id as FormStep);
      window.scrollTo(0, 0);
    }
  };

  const goToStep = (step: FormStep) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const handleProceedToPayment = async () => {
    setIsSubmitting(true);
    showToast('Creando solicitud, por favor espere...', 'info');
    try {
      const formValues = methods.getValues();
      const applicationData: ApplicationFormData = { ...formValues, ano_modelo: parseInt(String(formValues.ano_modelo), 10) || 0, email: user?.email };
      const response = await createApplication(applicationData);
      if (response.success && response.application.id) {
        setApplicationId(String(response.application.id));
        setCustomerId(response.customerId || '');
        setCompletedSteps(prev => ({ ...prev, review: true }));
        setCurrentStep('payment');
        window.scrollTo(0, 0);
      } else {
        showToast(response.message || 'Error al crear la solicitud preliminar.', 'error');
      }
    } catch (error: any) {
      logger.error('Error proceeding to payment:', error);
      showToast(error.response?.data?.message || 'Error fatal al crear la solicitud.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardPaymentSuccess = async (paymentIntentId: string) => {
    setIsSubmitting(true);
    try {
      // Card payment successful - confirm payment with backend
      showToast('Confirmando pago...', 'info');
      
      // Call the confirm payment endpoint to trigger PDF generation
      await stripePaymentService.confirmPayment(applicationId, paymentIntentId);
      
      showToast('Pago procesado exitosamente', 'success');
      navigate(`/payment/success?application_id=${applicationId}&payment_intent=${paymentIntentId}&method=card`, {
        replace: true
      });
      localStorage.removeItem('permitFormData');
    } catch (error: any) {
      logger.error('Error during card payment submission:', error);
      showToast(error.message || 'Error al finalizar el pago.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOxxoPaymentCreated = (oxxoDetails: any) => {
    // OXXO payment created successfully - navigate to confirmation page
    navigate('/permits/oxxo-confirmation', {
      replace: true,
      state: {
        applicationId: applicationId,
        oxxoDetails: oxxoDetails,
      },
    });
    localStorage.removeItem('permitFormData');
  };

  const saveProgress = () => {
    localStorage.setItem('permitFormData', JSON.stringify(methods.getValues()));
    showToast('Progreso guardado correctamente', 'success');
  };

  const renderSidebar = () => {
    if (currentStep === 'confirmation') return null;
    const completion = calculateCompletion();
    return (
      <div className={styles.formSidebar}>
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}><FaChartBar className={styles.summaryIcon} />Resumen de Solicitud</h3>
          <div className={styles.summaryItem}><span className={styles.summaryLabel}>Completado:</span><span className={styles.summaryValue}>{completion}%</span></div>
          <div className={styles.summaryProgress}><div className={styles.progressBar}><div className={`${styles.progressFill} ${getProgressFillClass(completion)}`}></div></div></div>
          <div className={styles.summarySteps}>
            {steps.map((step, index) => {
              if (step.id === 'confirmation') return null;
              const isActive = currentStep === step.id;
              const isCompleted = completedSteps[step.id as keyof typeof completedSteps];
              return (
                <div key={step.id} className={`${styles.summaryStep} ${isActive ? styles.summaryStepActive : ''} ${isCompleted ? styles.summaryStepCompleted : ''}`}>
                  <div className={styles.summaryStepIcon}>{isCompleted ? '✓' : index + 1}</div>
                  <span className={styles.summaryStepText}>{step.label}</span>
                  {(isCompleted || isActive) && <button type="button" className={styles.summaryStepEdit} onClick={() => goToStep(step.id as FormStep)}>Editar</button>}
                </div>
              );
            })}
          </div>
          {methods.watch('marca') && <div className={styles.summaryItem}><span className={styles.summaryLabel}>Vehículo:</span><span className={styles.summaryValue}>{methods.watch('marca')} {methods.watch('linea')}</span></div>}
          {methods.watch('ano_modelo') && <div className={styles.summaryItem}><span className={styles.summaryLabel}>Año:</span><span className={styles.summaryValue}>{methods.watch('ano_modelo')}</span></div>}
          {methods.watch('color') && <div className={styles.summaryItem}><span className={styles.summaryLabel}>Color:</span><span className={styles.summaryValue}>{methods.watch('color')}</span></div>}
          <div className={styles.saveProgress}><Button variant="secondary" size="small" onClick={saveProgress} icon={<FaSave className={styles.saveProgressIcon} />} className={styles.saveProgressButton}>Guardar progreso</Button></div>
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
              <Button variant="primary" onClick={handleNextStep} icon={<FaArrowRight />} iconAfter className={styles.navigationButton}>
                Comenzar
              </Button>
            </div>
          </div>
        );
      case 'personal': return <PersonalInfoStep onNext={handleNextStep} onPrevious={handlePreviousStep} />;
      case 'vehicle': return <CompleteVehicleInfoStep onNext={handleNextStep} onPrevious={handlePreviousStep} />;
      case 'review': return <CompleteReviewStep onPrevious={handlePreviousStep} onSubmit={handleProceedToPayment} isSubmitting={isSubmitting} goToStep={goToStep} />;
      case 'payment':
        return (
          <UnifiedPaymentFlow
            applicationId={applicationId}
            customerId={customerId}
            onPrevious={handlePreviousStep}
            onCardPaymentSuccess={handleCardPaymentSuccess}
            onOxxoPaymentCreated={handleOxxoPaymentCreated}
            isSubmitting={isSubmitting}
          />
        );
      case 'confirmation':
        return <ConfirmationStep applicationId={applicationId} formData={methods.getValues()} />;
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
        {currentStep !== 'confirmation' && (
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
        <div className={`${styles.formLayout} ${currentStep === 'confirmation' ? styles.confirmationLayout : ''}`}>
          <div className={styles.formMain}>
            {renderStepContent()}
            {currentStep !== 'confirmation' && (
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