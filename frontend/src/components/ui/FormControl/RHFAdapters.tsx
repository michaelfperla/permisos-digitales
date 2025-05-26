import React from 'react';
import { Controller, Control, Path, FieldValues, FieldError } from 'react-hook-form';

import Checkbox, { CheckboxProps } from './Checkbox';
import Radio, { RadioProps } from './Radio';

/**
 * Props for RHFCheckbox component
 */
export interface RHFCheckboxProps<TFieldValues extends FieldValues>
  extends Omit<CheckboxProps, 'error'> {
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
 * React Hook Form adapter for Checkbox component
 *
 * @example
 * <RHFCheckbox
 *   name="acceptTerms"
 *   control={control}
 *   label="I accept the terms and conditions"
 *   error={errors.acceptTerms}
 * />
 */
export function RHFCheckbox<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  error,
  ...props
}: RHFCheckboxProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, onBlur, value, ref } }) => (
        <Checkbox
          label={label}
          error={error?.message}
          checked={!!value}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
          {...props}
        />
      )}
    />
  );
}

/**
 * Props for RHFRadioGroup component
 */
export interface RHFRadioGroupProps<TFieldValues extends FieldValues>
  extends Omit<RadioProps, 'error' | 'label' | 'value'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Options for the radio group
   */
  options: Array<{ value: string; label: React.ReactNode }>;
  /**
   * Error from form validation
   */
  error?: FieldError;
  /**
   * Additional class name for the radio group container
   */
  groupClassName?: string;
}

/**
 * React Hook Form adapter for Radio component as a group
 *
 * @example
 * <RHFRadioGroup
 *   name="gender"
 *   control={control}
 *   options={[
 *     { value: 'male', label: 'Male' },
 *     { value: 'female', label: 'Female' }
 *   ]}
 *   error={errors.gender}
 * />
 */
export function RHFRadioGroup<TFieldValues extends FieldValues>({
  name,
  control,
  options,
  error,
  groupClassName = '',
  ...props
}: RHFRadioGroupProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className={groupClassName}>
          {options.map((option, index) => (
            <Radio
              key={`${name}-${option.value}`}
              label={option.label}
              error={index === options.length - 1 ? error?.message : undefined}
              checked={field.value === option.value}
              onChange={() => field.onChange(option.value)}
              onBlur={field.onBlur}
              {...props}
            />
          ))}
        </div>
      )}
    />
  );
}
