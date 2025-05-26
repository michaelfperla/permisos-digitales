import React, { InputHTMLAttributes, forwardRef } from 'react';

import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error state - can be boolean or string message
   */
  error?: boolean | string;
  /**
   * Input mode for mobile keyboards
   * - 'numeric': Optimized for entering numbers
   * - 'tel': Optimized for entering telephone numbers
   * - 'email': Optimized for entering email addresses
   * - 'url': Optimized for entering URLs
   * - 'search': Optimized for search inputs
   */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
}

/**
 * Input component using the "Soft & Trustworthy" design set
 * Enhanced for mobile usability with appropriate input types and input modes
 * Compatible with React Hook Form's register function
 *
 * @example
 * // With React Hook Form
 * <Input {...register('email')} error={errors.email?.message} />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, inputMode, ...props }, ref) => {
    const inputClasses = [styles.input, error ? styles.inputError : '', className || '']
      .filter(Boolean)
      .join(' ');

    return <input className={inputClasses} inputMode={inputMode} ref={ref} {...props} />;
  },
);

Input.displayName = 'Input';

export default Input;
