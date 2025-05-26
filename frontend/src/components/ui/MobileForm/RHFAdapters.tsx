import React from 'react';
import { Controller, Control, Path, FieldValues, FieldError } from 'react-hook-form';

import {
  MobileFormInput,
  MobileFormSelect,
  MobileFormTextarea,
  MobileFormCheckbox,
  MobileFormLabel,
  MobileFormGroup,
  MobileFormInputProps,
  MobileFormSelectProps,
  MobileFormTextareaProps,
  MobileFormCheckboxProps,
} from './MobileForm';

/**
 * Props for RHFMobileFormInput component
 */
export interface RHFMobileFormInputProps<TFieldValues extends FieldValues>
  extends Omit<MobileFormInputProps, 'error'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Label for the input
   */
  label?: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Error from form validation
   */
  error?: FieldError;
}

/**
 * React Hook Form adapter for MobileFormInput
 *
 * @example
 * <RHFMobileFormInput
 *   name="email"
 *   control={control}
 *   label="Email"
 *   required
 *   error={errors.email}
 *   type="email"
 * />
 */
export function RHFMobileFormInput<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  error,
  id = name,
  ...props
}: RHFMobileFormInputProps<TFieldValues>) {
  return (
    <MobileFormGroup>
      {label && (
        <MobileFormLabel htmlFor={id} required={required}>
          {label}
        </MobileFormLabel>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MobileFormInput id={id} error={error?.message} {...field} {...props} />
        )}
      />
    </MobileFormGroup>
  );
}

/**
 * Props for RHFMobileFormSelect component
 */
export interface RHFMobileFormSelectProps<TFieldValues extends FieldValues>
  extends Omit<MobileFormSelectProps, 'error'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Label for the select
   */
  label?: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Error from form validation
   */
  error?: FieldError;
}

/**
 * React Hook Form adapter for MobileFormSelect
 *
 * @example
 * <RHFMobileFormSelect
 *   name="category"
 *   control={control}
 *   label="Category"
 *   required
 *   error={errors.category}
 *   options={[
 *     { value: 'option1', label: 'Option 1' },
 *     { value: 'option2', label: 'Option 2' }
 *   ]}
 * />
 */
export function RHFMobileFormSelect<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  error,
  id = name,
  options,
  ...props
}: RHFMobileFormSelectProps<TFieldValues>) {
  return (
    <MobileFormGroup>
      {label && (
        <MobileFormLabel htmlFor={id} required={required}>
          {label}
        </MobileFormLabel>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MobileFormSelect
            id={id}
            options={options}
            error={error?.message}
            {...field}
            {...props}
          />
        )}
      />
    </MobileFormGroup>
  );
}

/**
 * Props for RHFMobileFormTextarea component
 */
export interface RHFMobileFormTextareaProps<TFieldValues extends FieldValues>
  extends Omit<MobileFormTextareaProps, 'error'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Label for the textarea
   */
  label?: string;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Error from form validation
   */
  error?: FieldError;
}

/**
 * React Hook Form adapter for MobileFormTextarea
 *
 * @example
 * <RHFMobileFormTextarea
 *   name="description"
 *   control={control}
 *   label="Description"
 *   required
 *   error={errors.description}
 * />
 */
export function RHFMobileFormTextarea<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  error,
  id = name,
  ...props
}: RHFMobileFormTextareaProps<TFieldValues>) {
  return (
    <MobileFormGroup>
      {label && (
        <MobileFormLabel htmlFor={id} required={required}>
          {label}
        </MobileFormLabel>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MobileFormTextarea id={id} error={error?.message} {...field} {...props} />
        )}
      />
    </MobileFormGroup>
  );
}

/**
 * Props for RHFMobileFormCheckbox component
 */
export interface RHFMobileFormCheckboxProps<TFieldValues extends FieldValues>
  extends Omit<MobileFormCheckboxProps, 'error' | 'label'> {
  /**
   * Field name in the form
   */
  name: Path<TFieldValues>;
  /**
   * Form control from useForm
   */
  control: Control<TFieldValues>;
  /**
   * Label for the checkbox
   */
  label: React.ReactNode;
  /**
   * Error from form validation
   */
  error?: FieldError;
}

/**
 * React Hook Form adapter for MobileFormCheckbox
 *
 * @example
 * <RHFMobileFormCheckbox
 *   name="acceptTerms"
 *   control={control}
 *   label="I accept the terms and conditions"
 *   error={errors.acceptTerms}
 * />
 */
export function RHFMobileFormCheckbox<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  error,
  id = name,
  ...props
}: RHFMobileFormCheckboxProps<TFieldValues>) {
  return (
    <MobileFormGroup>
      <Controller
        name={name}
        control={control}
        render={({ field: { onChange, onBlur, value, ref } }) => (
          <MobileFormCheckbox
            id={id}
            label={label}
            error={error?.message}
            checked={value}
            onChange={onChange}
            onBlur={onBlur}
            inputRef={ref}
            {...props}
          />
        )}
      />
    </MobileFormGroup>
  );
}
