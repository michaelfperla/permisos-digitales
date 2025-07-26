import React, { forwardRef } from 'react';

import styles from './FormControl.module.css';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Label text for the radio button
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
 * Radio button component using the "Soft & Trustworthy" design set
 * Compatible with React Hook Form
 *
 * @example
 * // Basic usage
 * <Radio name="gender" value="male" label="Male" />
 * <Radio name="gender" value="female" label="Female" />
 *
 * @example
 * // With React Hook Form
 * <Controller
 *   name="gender"
 *   control={control}
 *   render={({ field }) => (
 *     <>
 *       <Radio
 *         {...field}
 *         value="male"
 *         label="Male"
 *         checked={field.value === 'male'}
 *         onChange={() => field.onChange('male')}
 *       />
 *       <Radio
 *         {...field}
 *         value="female"
 *         label="Female"
 *         checked={field.value === 'female'}
 *         onChange={() => field.onChange('female')}
 *       />
 *     </>
 *   )}
 * />
 */
const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, wrapperClassName = '', className = '', id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={wrapperClassName}>
        <label className={styles.radioWrapper}>
          <input
            type="radio"
            id={radioId}
            className={`${styles.radioInput} ${className}`}
            ref={ref}
            {...props}
          />
          <span className={styles.radioIndicator}></span>
          {label}
        </label>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    );
  },
);

Radio.displayName = 'Radio';

export default Radio;
