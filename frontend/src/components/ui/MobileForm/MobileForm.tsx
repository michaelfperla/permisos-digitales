import React from 'react';

import styles from './MobileForm.module.css';
import ResponsiveContainer from '../ResponsiveContainer/ResponsiveContainer';

export interface MobileFormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
  title?: string;
  description?: string;
}

/**
 * Form container optimized for mobile devices with touch-friendly inputs
 */
const MobileForm: React.FC<MobileFormProps> = ({
  children,
  onSubmit,
  className = '',
  title,
  description,
}) => {
  return (
    <ResponsiveContainer type="fluid" withPadding={true}>
      {title && <h2 className={styles.formTitle}>{title}</h2>}
      {description && <p className={styles.formDescription}>{description}</p>}
      <form
        className={`${styles.mobileForm} ${className}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        noValidate
      >
        {children}
      </form>
    </ResponsiveContainer>
  );
};

export interface MobileFormGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for grouping form elements with consistent spacing
 */
export const MobileFormGroup: React.FC<MobileFormGroupProps> = ({ children, className = '' }) => {
  return <div className={`${styles.formGroup} ${className}`}>{children}</div>;
};

export interface MobileFormLabelProps {
  children: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  className?: string;
}

/**
 * Form label with consistent styling and optional required indicator
 */
export const MobileFormLabel: React.FC<MobileFormLabelProps> = ({
  children,
  htmlFor,
  required = false,
  className = '',
}) => {
  return (
    <label htmlFor={htmlFor} className={`${styles.formLabel} ${className}`}>
      {children}
      {required && <span className={styles.requiredIndicator}>*</span>}
    </label>
  );
};

export interface MobileFormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  error?: string;
  className?: string;
}

/**
 * Touch-friendly input field with error handling.
 * Compatible with React Hook Form's register function.
 */
export const MobileFormInput = React.forwardRef<HTMLInputElement, MobileFormInputProps>(
  ({ id, error, className = '', ...props }, ref) => {
    return (
      <>
        <input
          id={id}
          className={`${styles.formInput} ${error ? styles.inputError : ''} ${className}`}
          ref={ref}
          {...props}
        />
        {error && <div className={styles.errorMessage}>{error}</div>}
      </>
    );
  },
);

MobileFormInput.displayName = 'MobileFormInput';

export interface MobileFormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  className?: string;
}

/**
 * Touch-friendly select dropdown with error handling.
 * Compatible with React Hook Form's Controller component.
 */
export const MobileFormSelect = React.forwardRef<HTMLSelectElement, MobileFormSelectProps>(
  ({ id, options, error, className = '', ...props }, ref) => {
    return (
      <>
        <select
          id={id}
          className={`${styles.formSelect} ${error ? styles.inputError : ''} ${className}`}
          ref={ref}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </>
    );
  },
);

MobileFormSelect.displayName = 'MobileFormSelect';

export interface MobileFormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  error?: string;
  className?: string;
}

/**
 * Touch-friendly textarea with error handling.
 * Compatible with React Hook Form's Controller component.
 */
export const MobileFormTextarea = React.forwardRef<HTMLTextAreaElement, MobileFormTextareaProps>(
  ({ id, error, className = '', ...props }, ref) => {
    return (
      <>
        <textarea
          id={id}
          className={`${styles.formTextarea} ${error ? styles.inputError : ''} ${className}`}
          ref={ref}
          {...props}
        />
        {error && <div className={styles.errorMessage}>{error}</div>}
      </>
    );
  },
);

MobileFormTextarea.displayName = 'MobileFormTextarea';

export interface MobileFormCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: React.ReactNode;
  error?: string;
  className?: string;
}

/**
 * Touch-friendly checkbox with error handling.
 * Compatible with React Hook Form's Controller component.
 */
export const MobileFormCheckbox = React.forwardRef<
  HTMLInputElement,
  MobileFormCheckboxProps & { inputRef?: React.Ref<HTMLInputElement> }
>(({ id, label, error, className = '', inputRef, ...props }, ref) => {
  const resolvedRef = inputRef || ref;

  return (
    <div className={`${styles.formCheckbox} ${className}`}>
      <input
        type="checkbox"
        id={id}
        className={styles.checkboxInput}
        ref={resolvedRef}
        {...props}
      />
      <label htmlFor={id} className={styles.checkboxLabel}>
        {label}
      </label>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
});

MobileFormCheckbox.displayName = 'MobileFormCheckbox';

export interface MobileFormActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for form action buttons with consistent spacing
 */
export const MobileFormActions: React.FC<MobileFormActionsProps> = ({
  children,
  className = '',
}) => {
  return <div className={`${styles.formActions} ${className}`}>{children}</div>;
};

export default MobileForm;
