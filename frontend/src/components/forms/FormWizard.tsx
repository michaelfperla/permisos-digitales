import React, { useState, ReactNode } from 'react';
import styles from './FormWizard.module.css';
import FormDebugger from '../debug/FormDebugger';
import Button from '../ui/Button/Button';

export interface Step {
  id: string;
  title: string;
  content: ReactNode | ((props: any) => ReactNode);
  validate?: (formData: any) => boolean | Promise<boolean>;
}

interface FormWizardProps {
  steps: Step[];
  onComplete: (data: any) => void;
  initialData: any;
  onDataChange?: (data: any) => void;
}

const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onComplete,
  initialData,
  onDataChange
}) => {
  // Single source of truth - FormWizard manages form state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate progress percentage
  const progressPercentage = ((currentStepIndex) / (steps.length - 1)) * 100;

  // Update form data with change detection
  const updateFormData = (newData: any) => {
    if (!newData || Object.keys(newData).length === 0) {
      return;
    }

    setFormData(prevData => {
      const updatedData = {
        ...prevData,
        ...newData
      };

      // Notify parent of the change if needed
      if (onDataChange) {
        onDataChange(updatedData);
      }

      return updatedData;
    });
  };

  // Handle next step
  const handleNext = async () => {
    const currentStep = steps[currentStepIndex];
    console.log('Attempting to move to next step from:', currentStep.id);

    // Validate current step if validation function exists
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

  // Handle previous step
  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    console.log('Attempting to submit form with data:', formData);
    const finalStep = steps[currentStepIndex];

    // Validate final step if validation function exists
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

  // Render step indicator
  const renderStepIndicator = () => {
    return (
      <div className={styles.progressContainer}>
        <div
          className={styles.progressBar}
          style={{ width: `${progressPercentage}%` }}
        />
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
            <div className={styles.stepCircle}>
              {index < currentStepIndex ? '✓' : index + 1}
            </div>
            <div className={styles.stepLabel}>{step.title}</div>
          </div>
        ))}
      </div>
    );
  };

  // Get current step
  const currentStep = steps[currentStepIndex];

  // Render the current step content with necessary props
  const stepContent = typeof currentStep.content === 'function'
    ? currentStep.content({
        formData,
        updateFormData,
        isLastStep: currentStepIndex === steps.length - 1
      })
    : React.isValidElement(currentStep.content)
      ? React.cloneElement(currentStep.content as React.ReactElement, {
          formData,
          updateFormData,
          isLastStep: currentStepIndex === steps.length - 1
        })
      : currentStep.content;

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.wizardHeader}>
        <h1 className={styles.wizardTitle}>Solicitud de Permiso</h1>
        <p className={styles.wizardSubtitle}>
          Complete todos los pasos para enviar su solicitud
        </p>
      </div>

      <FormDebugger
        data={{
          currentStepIndex,
          currentStepId: steps[currentStepIndex].id,
          formData,
          isSubmitting
        }}
        title="FormWizard Debug"
      />

      {renderStepIndicator()}

      <div className={styles.stepContent}>
        {stepContent}
      </div>

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
          <Button
            variant="primary"
            onClick={handleNext}
            className={styles.navigationButton}
          >
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