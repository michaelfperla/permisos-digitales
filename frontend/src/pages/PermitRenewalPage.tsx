import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUserAuth as useAuth } from '../shared/hooks/useAuth';
import { getApplicationById, renewApplication } from '../services/applicationService';
import { CompletePermitFormData, completePermitSchema } from '../shared/schemas/permit.schema';
import { logger } from '../utils/logger';
import { useToast } from '../shared/hooks/useToast';

// Import form steps
import PersonalInfoStep from '../components/permit-form/PersonalInfoStep';
import CompleteVehicleInfoStep from '../components/permit-form/CompleteVehicleInfoStep';
import CompleteReviewStep from '../components/permit-form/CompleteReviewStep';
import ConfirmationStep from '../components/permit-form/ConfirmationStep';

import styles from './CompletePermitFormPage.module.css';
import { FaArrowLeft, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

type FormStep = 'personal' | 'vehicle' | 'review' | 'confirmation';

const PermitRenewalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<FormStep>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalApplication, setOriginalApplication] = useState<any>(null);

  const methods = useForm<CompletePermitFormData>({
    resolver: zodResolver(completePermitSchema),
    mode: 'onChange',
    defaultValues: {
      nombre_completo: '',
      curp_rfc: '',
      domicilio: '',
      marca: '',
      linea: '',
      color: '',
      numero_serie: '',
      numero_motor: '',
      ano_modelo: '',
    },
  });

  useEffect(() => {
    loadOriginalApplication();
  }, [id]);

  const loadOriginalApplication = async () => {
    if (!id) {
      navigate('/permits');
      return;
    }

    try {
      setIsLoading(true);
      const appDetails = await getApplicationById(id);
      
      // Check if application exists
      if (!appDetails.application) {
        showToast('No se pudo encontrar la aplicación.', 'error');
        navigate('/permits');
        return;
      }

      // Check if permit is eligible for renewal
      const currentStatus = appDetails.status?.currentStatus;
      if (currentStatus !== 'COMPLETED' && currentStatus !== 'PERMIT_READY') {
        showToast('Solo los permisos activos o completados pueden ser renovados.', 'error');
        navigate(`/permits/${id}`);
        return;
      }

      setOriginalApplication(appDetails);

      // Pre-populate form with existing data
      methods.reset({
        nombre_completo: appDetails.application.ownerInfo.nombre_completo || '',
        curp_rfc: appDetails.application.ownerInfo.curp_rfc || '',
        domicilio: appDetails.application.ownerInfo.domicilio || '',
        marca: appDetails.application.vehicleInfo.marca || '',
        linea: appDetails.application.vehicleInfo.linea || '',
        color: appDetails.application.vehicleInfo.color || '',
        numero_serie: appDetails.application.vehicleInfo.numero_serie || '',
        numero_motor: appDetails.application.vehicleInfo.numero_motor || '',
        ano_modelo: appDetails.application.vehicleInfo.ano_modelo?.toString() || '',
      });

    } catch (error) {
      logger.error('Error loading application for renewal:', error);
      showToast('No se pudo cargar la información del permiso.', 'error');
      navigate('/permits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    const stepOrder: FormStep[] = ['personal', 'vehicle', 'review', 'confirmation'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const stepOrder: FormStep[] = ['personal', 'vehicle', 'review', 'confirmation'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleStepClick = (step: FormStep) => {
    setCurrentStep(step);
  };

  const onSubmit = async (data: CompletePermitFormData) => {
    if (!id) return;

    try {
      setIsSubmitting(true);
      
      const renewalData = {
        ...data,
        renewed_from_id: parseInt(id, 10),
      };

      const response = await renewApplication(id, renewalData as any);
      
      showToast('Tu solicitud de renovación ha sido creada. Procede con el pago.', 'success');

      // Navigate to payment page for the new application
      navigate(`/permits/${response.application.id}/payment`);
    } catch (error) {
      logger.error('Error submitting renewal:', error);
      showToast('No se pudo procesar la renovación. Por favor intenta de nuevo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando información del permiso...</p>
      </div>
    );
  }

  const getStepNumber = (step: FormStep): number => {
    const stepNumbers = { personal: 1, vehicle: 2, review: 3, confirmation: 4 };
    return stepNumbers[step];
  };

  const getCompletedSteps = (): number => {
    const formValues = methods.watch();
    let completed = 0;
    
    // Personal info validation
    if (formValues.nombre_completo && formValues.curp_rfc && formValues.domicilio) completed++;
    
    // Vehicle info validation
    if (formValues.marca && formValues.linea && formValues.color && 
        formValues.numero_serie && formValues.numero_motor && formValues.ano_modelo) completed++;
    
    return completed;
  };

  const totalSteps = 3; // Not including confirmation
  const completedSteps = getCompletedSteps();
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <FormProvider {...methods}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/permits')}>
            <FaArrowLeft />
            <span>Regresar a mis permisos</span>
          </button>
          
          <h1 className={styles.title}>Renovar Permiso</h1>
          
          <div className={styles.renewalNotice}>
            <FaExclamationTriangle className={styles.noticeIcon} />
            <p>Estás renovando el permiso con folio: <strong>{originalApplication?.permitId}</strong></p>
          </div>
        </div>

        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className={styles.progressText}>{completedSteps} de {totalSteps} secciones completadas</p>
        </div>

        <div className={styles.content}>
          <div className={styles.stepIndicator}>
            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 'personal' ? styles.active : ''} ${getStepNumber(currentStep) > 1 ? styles.completed : ''}`}
              onClick={() => handleStepClick('personal')}
            >
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepLabel}>Información Personal</span>
            </button>
            
            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 'vehicle' ? styles.active : ''} ${getStepNumber(currentStep) > 2 ? styles.completed : ''}`}
              onClick={() => handleStepClick('vehicle')}
            >
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepLabel}>Información del Vehículo</span>
            </button>
            
            <button
              type="button"
              className={`${styles.stepButton} ${currentStep === 'review' ? styles.active : ''} ${getStepNumber(currentStep) > 3 ? styles.completed : ''}`}
              onClick={() => handleStepClick('review')}
            >
              <span className={styles.stepNumber}>3</span>
              <span className={styles.stepLabel}>Revisar y Confirmar</span>
            </button>
          </div>

          <form onSubmit={methods.handleSubmit(onSubmit)} className={styles.formContainer}>
            {currentStep === 'personal' && (
              <PersonalInfoStep onNext={handleNext} onPrevious={() => {}} />
            )}
            
            {currentStep === 'vehicle' && (
              <CompleteVehicleInfoStep onNext={handleNext} onPrevious={handlePrevious} />
            )}
            
            {currentStep === 'review' && (
              <CompleteReviewStep 
                onPrevious={handlePrevious}
                onSubmit={() => {
                  setCurrentStep('confirmation');
                  methods.handleSubmit(onSubmit)();
                }}
                isSubmitting={isSubmitting}
                goToStep={(step: string) => setCurrentStep(step as FormStep)}
              />
            )}
            
            {currentStep === 'confirmation' && (
              <ConfirmationStep 
                applicationId={id || ''} 
                formData={methods.watch()} 
              />
            )}
          </form>

          {originalApplication && (
            <div className={styles.originalDataInfo}>
              <FaCheckCircle className={styles.infoIcon} />
              <p>Los datos han sido pre-llenados con la información de tu permiso anterior. 
                 Puedes modificar cualquier campo antes de proceder con la renovación.</p>
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  );
};

export default PermitRenewalPage;