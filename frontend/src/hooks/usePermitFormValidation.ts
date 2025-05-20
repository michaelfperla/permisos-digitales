import { useMemo } from 'react';
import { ApplicationFormRawData } from '../types/application.types';
import {
  validateFullName,
  validateCurpRfc,
  validateAddress,
  validateVehicleMake,
  validateVehicleModel,
  validateVehicleColor,
  validateVehicleSerialNumber,
  validateVehicleEngineNumber,
  validateVehicleModelYear
} from '../utils/permit-validation';

/**
 * Type for validation errors object
 * Maps each field of ApplicationFormRawData to an error message or undefined
 */
export type ValidationErrors = {
  [K in keyof ApplicationFormRawData]?: string;
};

/**
 * Type for validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
  applicantInfoValid: boolean;
  vehicleInfoValid: boolean;
}

/**
 * Custom hook for validating permit application form data
 * @param formData The form data to validate
 * @returns Validation result with isValid flag and errors object
 */
export const usePermitFormValidation = (formData: ApplicationFormRawData): ValidationResult => {
  return useMemo(() => {
    const errors: ValidationErrors = {};

    // Validate applicant info fields
    const nombreCompletoValidation = validateFullName(formData.nombre_completo || '');
    if (!nombreCompletoValidation.isValid) {
      errors.nombre_completo = nombreCompletoValidation.error;
    }

    const curpRfcValidation = validateCurpRfc(formData.curp_rfc || '');
    if (!curpRfcValidation.isValid) {
      errors.curp_rfc = curpRfcValidation.error;
    }

    const domicilioValidation = validateAddress(formData.domicilio || '');
    if (!domicilioValidation.isValid) {
      errors.domicilio = domicilioValidation.error;
    }

    // Validate vehicle info fields
    const marcaValidation = validateVehicleMake(formData.marca || '');
    if (!marcaValidation.isValid) {
      errors.marca = marcaValidation.error;
    }

    const lineaValidation = validateVehicleModel(formData.linea || '');
    if (!lineaValidation.isValid) {
      errors.linea = lineaValidation.error;
    }

    const colorValidation = validateVehicleColor(formData.color || '');
    if (!colorValidation.isValid) {
      errors.color = colorValidation.error;
    }

    const numeroSerieValidation = validateVehicleSerialNumber(formData.numero_serie || '');
    if (!numeroSerieValidation.isValid) {
      errors.numero_serie = numeroSerieValidation.error;
    }

    const numeroMotorValidation = validateVehicleEngineNumber(formData.numero_motor || '');
    if (!numeroMotorValidation.isValid) {
      errors.numero_motor = numeroMotorValidation.error;
    }

    const anoModeloValidation = validateVehicleModelYear(formData.ano_modelo?.toString() || '');
    if (!anoModeloValidation.isValid) {
      errors.ano_modelo = anoModeloValidation.error;
    }

    // Check if applicant info is valid
    const applicantInfoValid = !errors.nombre_completo && !errors.curp_rfc && !errors.domicilio;

    // Check if vehicle info is valid
    const vehicleInfoValid = !errors.marca && !errors.linea && !errors.color &&
                            !errors.numero_serie && !errors.numero_motor && !errors.ano_modelo;

    // Overall validity
    const isValid = applicantInfoValid && vehicleInfoValid;

    return {
      isValid,
      errors,
      applicantInfoValid,
      vehicleInfoValid
    };
  }, [formData]);
};

/**
 * Helper function to get the first error message from validation errors
 * @param errors Validation errors object
 * @returns First error message or undefined if no errors
 */
export const getFirstError = (errors: ValidationErrors): string | undefined => {
  for (const key in errors) {
    if (errors[key as keyof ApplicationFormRawData]) {
      return errors[key as keyof ApplicationFormRawData];
    }
  }
  return undefined;
};

/**
 * Helper function to get the first error message from a specific step's fields
 * @param errors Validation errors object
 * @param step Step name ('applicant' or 'vehicle')
 * @returns First error message for the specified step or undefined if no errors
 */
export const getFirstStepError = (
  errors: ValidationErrors,
  step: 'applicant' | 'vehicle'
): string | undefined => {
  const fields = step === 'applicant'
    ? ['nombre_completo', 'curp_rfc', 'domicilio']
    : ['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo'];

  for (const field of fields) {
    const key = field as keyof ApplicationFormData;
    if (errors[key]) {
      return errors[key];
    }
  }

  return undefined;
};
