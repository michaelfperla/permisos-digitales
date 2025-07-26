import React, { forwardRef } from 'react';

import styles from './FormControl.module.css';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Label text for the checkbox
   */
  label: React.ReactNode;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Additional class name for the wrapper
   */
  wrapperClassName?: string;
}

/**
 * Checkbox component using the "Soft & Trustworthy" design set
 * Compatible with React Hook Form
 *
 * @example
 * // Basic usage
 * <Checkbox label="Accept terms" />
 *
 * @example
 * // With React Hook Form
 * <Checkbox {...register('acceptTerms')} label="Accept terms" error={errors.acceptTerms?.message} />
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, wrapperClassName = '', className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={wrapperClassName}>
        <label className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            id={checkboxId}
            className={`${styles.checkboxInput} ${className}`}
            ref={ref}
            {...props}
          />
          <span className={styles.checkboxIndicator}></span>
          {label}
        </label>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
