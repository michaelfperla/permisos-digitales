/**
 * Validation utilities for vehicle permit forms
 */

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  error: string;
}

/**
 * Validate full name (nombre_completo)
 * @param value Full name to validate
 */
export const validateFullName = (value: string): ValidationResult => {
  // Handle undefined or null values
  if (value === undefined || value === null) {
    return { isValid: false, error: 'El nombre completo es requerido' };
  }

  // Trim the value to remove whitespace
  const trimmedValue = value.trim();

  // Check if empty after trimming
  if (trimmedValue === '') {
    return { isValid: false, error: 'El nombre completo es requerido' };
  }

  // Check minimum length
  if (trimmedValue.length < 3) {
    return { isValid: false, error: 'El nombre completo debe tener al menos 3 caracteres' };
  }

  // Check maximum length
  if (trimmedValue.length > 255) {
    return { isValid: false, error: 'El nombre completo no puede exceder 255 caracteres' };
  }

  // Very permissive validation - allow almost any character that might be in a name
  // This includes letters, numbers, spaces, accents, hyphens, apostrophes, periods, and commas
  const nameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\-'.,:;()]+$/;
  if (!nameRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: 'El nombre contiene caracteres no permitidos',
    };
  }

  // If all checks pass, the name is valid
  return { isValid: true, error: '' };
};

/**
 * Validate CURP/RFC
 * @param value CURP or RFC to validate
 */
export const validateCurpRfc = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El CURP o RFC es requerido' };
  }

  const trimmedValue = value.trim();

  // Check length (10-50 characters as per backend validation)
  if (trimmedValue.length < 10 || trimmedValue.length > 50) {
    return {
      isValid: false,
      error: 'El CURP o RFC debe tener entre 10 y 50 caracteres',
    };
  }

  // Check format (only letters and numbers as per backend validation)
  if (!/^[A-Z0-9]+$/i.test(trimmedValue)) {
    return {
      isValid: false,
      error: 'El CURP o RFC solo debe contener letras y números',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate address (domicilio)
 * @param value Address to validate
 */
export const validateAddress = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El domicilio es requerido' };
  }

  // Minimum length check for user experience
  if (value.trim().length < 5) {
    return { isValid: false, error: 'El domicilio debe tener al menos 5 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle make (marca)
 * @param value Vehicle make to validate
 */
export const validateVehicleMake = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'La marca del vehículo es requerida' };
  }

  // Check max length (100 characters as per backend validation)
  if (value.trim().length > 100) {
    return { isValid: false, error: 'La marca del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle model (linea)
 * @param value Vehicle model to validate
 */
export const validateVehicleModel = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El modelo del vehículo es requerido' };
  }

  // Check max length (100 characters as per backend validation)
  if (value.trim().length > 100) {
    return { isValid: false, error: 'El modelo del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle color
 * @param value Vehicle color to validate
 */
export const validateVehicleColor = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El color del vehículo es requerido' };
  }

  // Check max length (100 characters as per backend validation)
  if (value.trim().length > 100) {
    return { isValid: false, error: 'El color del vehículo no puede exceder 100 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle serial number (numero_serie)
 * @param value Vehicle serial number to validate
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

  // Check if it contains only letters and numbers
  if (!/^[A-Z0-9]+$/i.test(value.trim())) {
    return {
      isValid: false,
      error: 'El número de serie solo debe contener letras y números',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle engine number (numero_motor)
 * @param value Vehicle engine number to validate
 */
export const validateVehicleEngineNumber = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, error: 'El número de motor es requerido' };
  }

  // Minimum length check for user experience
  if (value.trim().length < 3) {
    return { isValid: false, error: 'El número de motor debe tener al menos 3 caracteres' };
  }

  // Check max length (50 characters as per backend validation)
  if (value.trim().length > 50) {
    return { isValid: false, error: 'El número de motor no puede exceder 50 caracteres' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate vehicle model year (ano_modelo)
 * @param value Vehicle model year to validate (can be number or string)
 */
export const validateVehicleModelYear = (value: string | number): ValidationResult => {
  // Convert to string for validation if it's a number
  const valueStr = typeof value === 'number' ? value.toString() : value;

  if (!valueStr || (typeof valueStr === 'string' && !valueStr.trim())) {
    return { isValid: false, error: 'El año del modelo es requerido' };
  }

  // If it's already a number, we can skip some checks
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

  // For string values, perform additional validation
  // Check if it's a number
  if (!/^\d+$/.test(valueStr.trim())) {
    return { isValid: false, error: 'El año debe ser un número sin símbolos' };
  }

  // Check if it's a 4-digit year
  if (valueStr.trim().length !== 4) {
    return { isValid: false, error: 'El año debe ser de 4 dígitos' };
  }

  // Additional validation for reasonable year range
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
