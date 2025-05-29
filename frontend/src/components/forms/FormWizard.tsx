import React, { useState, ReactNode } from 'react';

import styles from './FormWizard.module.css';
import Button from '../ui/Button/Button';

export interface Step {
  id: string;
  title: string;
  content: ReactNode | ((_props: any) => ReactNode);
  validate?: (_formData: any) => boolean | Promise<boolean>;
}

interface FormWizardProps {
  steps: Step[];
  onComplete: (_data: any) => void;
  initialData: any;
  onDataChange?: (_data: any) => void;
}

/**
 * Multi-step form wizard with progress tracking and validation.
 * Manages form state and navigation between steps.
 */
const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onComplete,
  initialData,
  onDataChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;

  const updateFormData = (newData: any) => {
    if (!newData || Object.keys(newData).length === 0) {
      return;
    }

    setFormData((prevData: any) => {
      const updatedData = {
        ...prevData,
        ...newData,
      };

      if (onDataChange) {
        onDataChange(updatedData);
      }

      return updatedData;
    });
  };

  const handleNext = async () => {
    const currentStep = steps[currentStepIndex];
    console.debug('Attempting to move to next step from:', currentStep.id);

    if (currentStep.validate) {
      try {
        const isValid = await currentStep.validate(formData);
        if (!isValid) {
          return;
        }
      } catch (error) {
        console.error('Error during validation:', error);
        return;
      }
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    console.debug('Attempting to submit form with data:', formData);
    const finalStep = steps[currentStepIndex];

    if (finalStep.validate) {
      try {
        const isValid = await finalStep.validate(formData);
        if (!isValid) {
          return;
        }
      } catch (error) {
        console.error('Error during final validation:', error);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await onComplete(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className={styles.progressContainer}>
        <div className={styles.progressBar} style={{ width: `${progressPercentage}%` }} />
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`${styles.step} ${
              index === currentStepIndex
                ? styles.stepActive
                : index < currentStepIndex
                  ? styles.stepCompleted
                  : ''
            }`}
          >
            <div className={styles.stepCircle}>{index < currentStepIndex ? '✓' : index + 1}</div>
            <div className={styles.stepLabel}>{step.title}</div>
          </div>
        ))}
      </div>
    );
  };

  const currentStep = steps[currentStepIndex];

  const stepContent =
    typeof currentStep.content === 'function'
      ? currentStep.content({
          formData,
          updateFormData,
          isLastStep: currentStepIndex === steps.length - 1,
        })
      : React.isValidElement(currentStep.content)
        ? React.cloneElement(currentStep.content as React.ReactElement, {
            updateFormData,
            isLastStep: currentStepIndex === steps.length - 1,
          } as any)
        : currentStep.content;

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.wizardHeader}>
        <h1 className={styles.wizardTitle}>Solicitud de Permiso</h1>
        <p className={styles.wizardSubtitle}>Complete todos los pasos para enviar su solicitud</p>
      </div>

      {renderStepIndicator()}

      <div className={styles.stepContent}>{stepContent}</div>

      <div className={styles.navigationButtons}>
        {currentStepIndex > 0 && (
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={isSubmitting}
            className={styles.navigationButton}
          >
            Anterior
          </Button>
        )}

        {currentStepIndex === 0 && <div />}

        {currentStepIndex < steps.length - 1 ? (
          <Button variant="primary" onClick={handleNext} className={styles.navigationButton}>
            Siguiente
          </Button>
        ) : (
          <Button
            variant="success"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={styles.navigationButton}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FormWizard;
