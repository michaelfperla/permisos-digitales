import React from 'react';
import styles from './MobileForm.module.css';
import ResponsiveContainer from '../ResponsiveContainer/ResponsiveContainer';

export interface MobileFormProps {
  /**
   * Form children
   */
  children: React.ReactNode;
  /**
   * Function called when form is submitted
   */
  onSubmit: (e: React.FormEvent) => void;
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Form title
   */
  title?: string;
  /**
   * Form description
   */
  description?: string;
}

/**
 * MobileForm Component
 *
 * A form container optimized for mobile devices with touch-friendly inputs.
 * Uses ResponsiveContainer internally for standardized responsive behavior.
 */
const MobileForm: React.FC<MobileFormProps> = ({
  children,
  onSubmit,
  className = '',
  title,
  description
}) => {
  return (
    <ResponsiveContainer
      type="fluid"
      withPadding={true}
    >
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
  /**
   * Form group children
   */
  children: React.ReactNode;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormGroup Component
 *
 * A container for grouping form elements with consistent spacing.
 */
export const MobileFormGroup: React.FC<MobileFormGroupProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`${styles.formGroup} ${className}`}>
      {children}
    </div>
  );
};

export interface MobileFormLabelProps {
  /**
   * Label text
   */
  children: React.ReactNode;
  /**
   * HTML for attribute to associate label with input
   */
  htmlFor: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormLabel Component
 *
 * A form label with consistent styling and optional required indicator.
 */
export const MobileFormLabel: React.FC<MobileFormLabelProps> = ({
  children,
  htmlFor,
  required = false,
  className = ''
}) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`${styles.formLabel} ${className}`}
    >
      {children}
      {required && <span className={styles.requiredIndicator}>*</span>}
    </label>
  );
};

export interface MobileFormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Input ID
   */
  id: string;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormInput Component
 *
 * A touch-friendly input field with error handling.
 */
export const MobileFormInput: React.FC<MobileFormInputProps> = ({
  id,
  error,
  className = '',
  ...props
}) => {
  return (
    <>
      <input
        id={id}
        className={`${styles.formInput} ${error ? styles.inputError : ''} ${className}`}
        {...props}
      />
      {error && <div className={styles.errorMessage}>{error}</div>}
    </>
  );
};

export interface MobileFormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Select ID
   */
  id: string;
  /**
   * Select options
   */
  options: Array<{ value: string; label: string }>;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormSelect Component
 *
 * A touch-friendly select dropdown with error handling.
 */
export const MobileFormSelect: React.FC<MobileFormSelectProps> = ({
  id,
  options,
  error,
  className = '',
  ...props
}) => {
  return (
    <>
      <select
        id={id}
        className={`${styles.formSelect} ${error ? styles.inputError : ''} ${className}`}
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
};

export interface MobileFormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Textarea ID
   */
  id: string;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormTextarea Component
 *
 * A touch-friendly textarea with error handling.
 */
export const MobileFormTextarea: React.FC<MobileFormTextareaProps> = ({
  id,
  error,
  className = '',
  ...props
}) => {
  return (
    <>
      <textarea
        id={id}
        className={`${styles.formTextarea} ${error ? styles.inputError : ''} ${className}`}
        {...props}
      />
      {error && <div className={styles.errorMessage}>{error}</div>}
    </>
  );
};

export interface MobileFormCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Checkbox ID
   */
  id: string;
  /**
   * Checkbox label
   */
  label: React.ReactNode;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormCheckbox Component
 *
 * A touch-friendly checkbox with error handling.
 */
export const MobileFormCheckbox: React.FC<MobileFormCheckboxProps> = ({
  id,
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`${styles.formCheckbox} ${className}`}>
      <input
        type="checkbox"
        id={id}
        className={styles.checkboxInput}
        {...props}
      />
      <label htmlFor={id} className={styles.checkboxLabel}>
        {label}
      </label>
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
};

export interface MobileFormActionsProps {
  /**
   * Form action buttons
   */
  children: React.ReactNode;
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * MobileFormActions Component
 *
 * A container for form action buttons with consistent spacing.
 */
export const MobileFormActions: React.FC<MobileFormActionsProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`${styles.formActions} ${className}`}>
      {children}
    </div>
  );
};

export default MobileForm;
