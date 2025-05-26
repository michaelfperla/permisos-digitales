import React from 'react';
import { Controller, Control, Path, FieldValues, FieldError } from 'react-hook-form';

import Input, { InputProps } from './Input';

/**
 * Props for RHFInput component
 */
export interface RHFInputProps<TFieldValues extends FieldValues> extends Omit<InputProps, 'error'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Error from form validation
   */
  error?: FieldError;
}

/**
 * React Hook Form adapter for Input component
 *
 * @example
 * <RHFInput
 *   name="email"
 *   control={control}
 *   error={errors.email}
 *   type="email"
 * />
 */
export function RHFInput<TFieldValues extends FieldValues>({
  name,
  control,
  error,
  ...props
}: RHFInputProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => <Input error={error?.message} {...field} {...props} />}
    />
  );
}
