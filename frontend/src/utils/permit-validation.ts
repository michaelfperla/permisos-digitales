/**
 * Validation utilities for vehicle permit forms
 */

interface ValidationResult {
  isValid: boolean;
  error: string;
}

/**
 * Validate full name with character restrictions
 */
export const validateFullName = (value: string): ValidationResult => {
  if (value === undefined || value === null) {
    return { isValid: false, error: 'El nombre completo es requerido' };
  }

  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return { isValid: false, error: 'El nombre completo es requerido' };
  }

  if (trimmedValue.length < 3) {
    return { isValid: false, error: 'El nombre completo debe tener al menos 3 caracteres' };
  }

  if (trimmedValue.length > 255) {
    return { isValid: false, error: 'El nombre completo no puede exceder 255 caracteres' };
  }

  const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\-'.,:;()]+$/;
  if (!nameRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: 'El nombre contiene caracteres no permitidos',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate CURP/RFC format and length
 */
export const validateCurpRfc = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El CURP o RFC es requerido' };
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length < 10 || trimmedValue.length > 50) {
    return {
      isValid: false,
      error: 'El CURP o RFC debe tener entre 10 y 50 caracteres',
    };
  }

  if (!/^[A-Z0-9]+$/i.test(trimmedValue)) {
    return {
      isValid: false,
      error: 'El CURP o RFC solo debe contener letras y números',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate address with minimum length requirement
 */
export const validateAddress = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El domicilio es requerido' };
  }

  if (value.trim().length < 5) {
    return { isValid: false, error: 'El domicilio debe tener al menos 5 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle make with length limits
 */
export const validateVehicleMake = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'La marca del vehículo es requerida' };
  }

  if (value.trim().length > 100) {
    return { isValid: false, error: 'La marca del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle model with length limits
 */
export const validateVehicleModel = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El modelo del vehículo es requerido' };
  }

  if (value.trim().length > 100) {
    return { isValid: false, error: 'El modelo del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle color with length limits
 */
export const validateVehicleColor = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El color del vehículo es requerido' };
  }

  if (value.trim().length > 100) {
    return { isValid: false, error: 'El color del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle serial number with alphanumeric restriction
 */
export const validateVehicleSerialNumber = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El número de serie es requerido' };
  }

  if (value.trim().length < 5 || value.trim().length > 50) {
    return {
      isValid: false,
      error: 'El número de serie debe tener entre 5 y 50 caracteres',
    };
  }

  if (!/^[A-Z0-9]+$/i.test(value.trim())) {
    return {
      isValid: false,
      error: 'El número de serie solo debe contener letras y números',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle engine number with length limits
 */
export const validateVehicleEngineNumber = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El número de motor es requerido' };
  }

  if (value.trim().length < 3) {
    return { isValid: false, error: 'El número de motor debe tener al menos 3 caracteres' };
  }

  if (value.trim().length > 50) {
    return { isValid: false, error: 'El número de motor no puede exceder 50 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle model year with range checking
 */
export const validateVehicleModelYear = (value: string | number): ValidationResult => {
  const valueStr = typeof value === 'number' ? value.toString() : value;

  if (!valueStr || (typeof valueStr === 'string' && !valueStr.trim())) {
    return { isValid: false, error: 'El año del modelo es requerido' };
  }

  if (typeof value === 'number') {
    const currentYear = new Date().getFullYear();
    if (value < 1900 || value > currentYear + 2) {
      return {
        isValid: false,
        error: `El año debe estar entre 1900 y ${currentYear + 2}`,
      };
    }
    return { isValid: true, error: '' };
  }

  if (!/^\d+$/.test(valueStr.trim())) {
    return { isValid: false, error: 'El año debe ser un número sin símbolos' };
  }

  if (valueStr.trim().length !== 4) {
    return { isValid: false, error: 'El año debe ser de 4 dígitos' };
  }

  const year = parseInt(valueStr, 10);
  const currentYear = new Date().getFullYear();

  if (year < 1900 || year > currentYear + 2) {
    return {
      isValid: false,
      error: `El año debe estar entre 1900 y ${currentYear + 2}`,
    };
  }

  return { isValid: true, error: '' };
};
