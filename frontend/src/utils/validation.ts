/**
 * Validation utilities for forms
 */

interface PasswordValidationResult {
  isValid: boolean;
  error: string;
  strength: 'weak' | 'medium' | 'strong';
  strengthText: string;
}

/**
 * Validates email address format
 */
export const validateEmail = (email: string): { isValid: boolean; error: string } => {
  if (!email) {
    return { isValid: false, error: 'Falta tu correo electrónico' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Escribe un correo electrónico válido' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validates password with strength checking
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  if (!password) {
    return {
      isValid: false,
      error: 'Falta tu contraseña',
      strength: 'weak',
      strengthText: 'Débil',
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Tu contraseña debe tener mínimo 8 caracteres',
      strength: 'weak',
      strengthText: 'Débil',
    };
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let strengthText = 'Débil';

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const criteriaCount = [hasUppercase, hasLowercase, hasNumber, hasSpecialChar].filter(
    Boolean,
  ).length;

  if (password.length >= 8) {
    if (criteriaCount >= 3) {
      strength = 'strong';
      strengthText = 'Fuerte';
    } else if (criteriaCount >= 2) {
      strength = 'medium';
      strengthText = 'Media';
    }
  }

  const isValid = password.length >= 8;
  const error = isValid ? '' : 'Tu contraseña debe tener mínimo 8 caracteres';

  return { isValid, error, strength, strengthText };
};

/**
 * Validates name fields
 */
export const validateName = (
  name: string,
  fieldName: string = 'nombre',
): { isValid: boolean; error: string } => {
  if (!name.trim()) {
    return { isValid: false, error: `Falta tu ${fieldName}` };
  }

  return { isValid: true, error: '' };
};

/**
 * Validates password confirmation match
 */
export const validatePasswordMatch = (
  password: string,
  confirmPassword: string,
): { isValid: boolean; error: string } => {
  if (!confirmPassword) {
    return { isValid: false, error: 'Confirma tu contraseña' };
  }

  if (confirmPassword !== password) {
    return { isValid: false, error: 'Las contraseñas no son iguales' };
  }

  return { isValid: true, error: '' };
};
